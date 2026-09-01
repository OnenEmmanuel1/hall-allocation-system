/**
 * EHAS Allocation Engine (ehasEngine.js)
 * ──────────────────────────────────────
 * Houses ALL allocation business logic:
 *  • Single-schedule allocation (with capacity, double-booking, time-clash checks)
 *  • Bulk allocation across all pending schedules
 *  • Clear-and-replace idempotency (re-running deletes old rows first)
 *  • Query helpers for student views and admin reports
 *
 * Kept fully separate from Express route handlers.
 */

class AllocationEngine {
  /**
   * @param {import('mysql2/promise').Pool} db  mysql2 connection pool
   */
  constructor(db) {
    this.db = db;
  }

  /* ═══════════════════════════════════════════════════
     CORE: Run allocation for a single exam schedule
     ═══════════════════════════════════════════════════ */

  /**
   * Allocate students enrolled in a scheduled exam to available halls.
   *
   * Enforces:
   *  1. Hall capacity — never exceeds hall.capacity
   *  2. Hall double-booking — a hall already used at the same date/time is skipped
   *  3. Student time-clash — a student already allocated at the same date/time is flagged
   *
   * Idempotency: clear-and-replace. Existing allocations for this schedule_id
   * are DELETEd before new ones are written.
   *
   * @param {number} scheduleId
   * @returns {{ success: boolean, message: string, allocations?: object[], errors?: string[] }}
   */
  async runAllocation(scheduleId) {
    /* ── 1. Fetch the schedule + its course ─────────── */
    const [schedRows] = await this.db.query(
      `SELECT es.*, c.course_code, c.course_title, c.level
       FROM tbl_exam_schedule es
       JOIN tbl_courses c ON es.course_id = c.course_id
       WHERE es.schedule_id = ?`,
      [scheduleId]
    );

    if (!schedRows.length) {
      return { success: false, message: 'Exam schedule not found.' };
    }
    const schedule = schedRows[0];

    /* ── 2. Fetch enrolled students for this course ── */
    const [students] = await this.db.query(
      `SELECT s.*
       FROM tbl_students s
       JOIN tbl_student_courses sc ON s.student_id = sc.student_id
       WHERE sc.course_id = ?
       ORDER BY s.full_name`,
      [schedule.course_id]
    );

    if (!students.length) {
      return {
        success: false,
        message: `No students enrolled in ${schedule.course_code}. Cannot allocate.`
      };
    }

    /* ── 3. Fetch all halls (ordered by capacity DESC) ── */
    const [allHalls] = await this.db.query(
      `SELECT * FROM tbl_halls ORDER BY capacity DESC`
    );

    if (!allHalls.length) {
      return { success: false, message: 'No examination halls configured.' };
    }

    /* ── 4. Find halls already booked at this date/time (by OTHER schedules) ── */
    const [bookedHallRows] = await this.db.query(
      `SELECT DISTINCT a.hall_id, COUNT(*) AS seat_count
       FROM tbl_allocations a
       JOIN tbl_exam_schedule es ON a.schedule_id = es.schedule_id
       WHERE es.exam_date = ? AND es.exam_time = ? AND es.schedule_id != ?
       GROUP BY a.hall_id`,
      [schedule.exam_date, schedule.exam_time, scheduleId]
    );

    /* Build a map: hall_id → number of seats already taken at this slot */
    const hallUsage = {};
    for (const row of bookedHallRows) {
      hallUsage[row.hall_id] = row.seat_count;
    }

    /* ── 5. Check student time-clashes ─────────────── */
    const [clashRows] = await this.db.query(
      `SELECT a.student_id, s.full_name, s.matric_no, c.course_code AS clash_course
       FROM tbl_allocations a
       JOIN tbl_exam_schedule es ON a.schedule_id = es.schedule_id
       JOIN tbl_students s ON a.student_id = s.student_id
       JOIN tbl_exam_schedule es2 ON es2.schedule_id = ?
       JOIN tbl_courses c ON es.course_id = c.course_id
       WHERE es.exam_date = es2.exam_date
         AND es.exam_time = es2.exam_time
         AND es.schedule_id != ?
         AND a.student_id IN (
           SELECT sc.student_id FROM tbl_student_courses sc WHERE sc.course_id = ?
         )`,
      [scheduleId, scheduleId, schedule.course_id]
    );

    if (clashRows.length > 0) {
      const clashDetails = clashRows.map(
        r => `${r.full_name} (${r.matric_no}) — already in ${r.clash_course}`
      );
      return {
        success: false,
        message: `Student time-clash detected. ${clashRows.length} student(s) already have an exam at ${schedule.exam_date} ${schedule.exam_time}.`,
        errors: clashDetails
      };
    }

    /* ── 6. Clear-and-replace: delete existing allocations for this schedule ── */
    await this.db.query(
      `DELETE FROM tbl_allocations WHERE schedule_id = ?`,
      [scheduleId]
    );

    /* ── 7. Build available-halls list with remaining capacity ── */
    const availableHalls = [];
    for (const hall of allHalls) {
      const used = hallUsage[hall.hall_id] || 0;
      const remaining = hall.capacity - used;
      if (remaining > 0) {
        availableHalls.push({
          ...hall,
          remainingCapacity: remaining
        });
      }
    }

    /* ── 8. Check total available capacity ─────────── */
    const totalCapacity = availableHalls.reduce((sum, h) => sum + h.remainingCapacity, 0);
    if (totalCapacity < students.length) {
      return {
        success: false,
        message: `Insufficient hall capacity. Need ${students.length} seats for ${schedule.course_code}, but only ${totalCapacity} seats available at ${schedule.exam_date} ${schedule.exam_time}. Consider adding more halls or rescheduling.`
      };
    }

    /* ── 9. Assign students to halls sequentially ──── */
    const allocations = [];
    let hallIndex = 0;
    let seatInHall = 0;

    for (const student of students) {
      /* Move to next hall if current is full */
      while (hallIndex < availableHalls.length && seatInHall >= availableHalls[hallIndex].remainingCapacity) {
        hallIndex++;
        seatInHall = 0;
      }

      if (hallIndex >= availableHalls.length) {
        /* Should not reach here due to capacity check above, but safety net */
        return {
          success: false,
          message: `Ran out of hall space while allocating ${schedule.course_code}. This should not happen — please report this as a bug.`
        };
      }

      seatInHall++;
      allocations.push({
        schedule_id: scheduleId,
        student_id: student.student_id,
        hall_id: availableHalls[hallIndex].hall_id,
        seat_no: seatInHall
      });
    }

    /* ── 10. Write allocations to DB ───────────────── */
    for (const alloc of allocations) {
      await this.db.query(
        `INSERT INTO tbl_allocations (schedule_id, student_id, hall_id, seat_no) VALUES (?, ?, ?, ?)`,
        [alloc.schedule_id, alloc.student_id, alloc.hall_id, alloc.seat_no]
      );
    }

    /* ── 11. Mark schedule as allocated ────────────── */
    await this.db.query(
      `UPDATE tbl_exam_schedule SET status = 'allocated' WHERE schedule_id = ?`,
      [scheduleId]
    );

    return {
      success: true,
      message: `Successfully allocated ${allocations.length} students for ${schedule.course_code} (${schedule.exam_date} ${schedule.exam_time}).`,
      allocations
    };
  }

  /* ═══════════════════════════════════════════════════
     BULK: Run allocation for ALL pending schedules
     ═══════════════════════════════════════════════════ */

  /**
   * Runs allocation for every pending schedule, in date/time order.
   * Returns a summary of successes and failures.
   */
  async runBulkAllocation() {
    const [pending] = await this.db.query(
      `SELECT schedule_id, exam_date, exam_time
       FROM tbl_exam_schedule
       WHERE status = 'pending'
       ORDER BY exam_date, exam_time`
    );

    if (!pending.length) {
      return { success: false, message: 'No pending exam schedules to allocate.', results: [] };
    }

    const results = [];
    let successCount = 0;
    let failCount = 0;

    for (const sched of pending) {
      const result = await this.runAllocation(sched.schedule_id);
      results.push({
        schedule_id: sched.schedule_id,
        exam_date: sched.exam_date,
        exam_time: sched.exam_time,
        ...result
      });
      if (result.success) successCount++;
      else failCount++;
    }

    return {
      success: failCount === 0,
      message: `Bulk allocation complete: ${successCount} succeeded, ${failCount} failed.`,
      results
    };
  }

  /* ═══════════════════════════════════════════════════
     QUERY HELPERS
     ═══════════════════════════════════════════════════ */

  /** Fetch allocations for a specific student (SQL-level scoping). */
  async getAllocationsForStudent(studentId) {
    const [rows] = await this.db.query(
      `SELECT
         a.allocation_id, a.seat_no, a.allocated_at,
         es.exam_date, es.exam_time,
         c.course_code, c.course_title,
         h.hall_name, h.location
       FROM tbl_allocations a
       JOIN tbl_exam_schedule es ON a.schedule_id = es.schedule_id
       JOIN tbl_courses c ON es.course_id = c.course_id
       JOIN tbl_halls h ON a.hall_id = h.hall_id
       WHERE a.student_id = ?
       ORDER BY es.exam_date, es.exam_time`,
      [studentId]
    );
    return rows;
  }

  /** Fetch allocations for a specific schedule (admin view). */
  async getAllocationsForSchedule(scheduleId) {
    const [rows] = await this.db.query(
      `SELECT
         a.allocation_id, a.seat_no, a.allocated_at,
         s.full_name, s.matric_no, s.department, s.level,
         h.hall_name, h.capacity, h.location,
         es.exam_date, es.exam_time,
         c.course_code, c.course_title
       FROM tbl_allocations a
       JOIN tbl_students s ON a.student_id = s.student_id
       JOIN tbl_halls h ON a.hall_id = h.hall_id
       JOIN tbl_exam_schedule es ON a.schedule_id = es.schedule_id
       JOIN tbl_courses c ON es.course_id = c.course_id
       WHERE a.schedule_id = ?
       ORDER BY h.hall_name, a.seat_no`,
      [scheduleId]
    );
    return rows;
  }

  /** Full allocation report with optional filters. */
  async getAllocationReport(filters = {}) {
    let sql = `
      SELECT
        a.allocation_id, a.seat_no, a.allocated_at,
        s.full_name, s.matric_no, s.department AS student_dept, s.level AS student_level,
        c.course_code, c.course_title,
        es.exam_date, es.exam_time,
        h.hall_name, h.capacity, h.location
      FROM tbl_allocations a
      JOIN tbl_students s ON a.student_id = s.student_id
      JOIN tbl_exam_schedule es ON a.schedule_id = es.schedule_id
      JOIN tbl_courses c ON es.course_id = c.course_id
      JOIN tbl_halls h ON a.hall_id = h.hall_id
      WHERE 1=1
    `;
    const params = [];

    if (filters.course_id) {
      sql += ' AND es.course_id = ?';
      params.push(filters.course_id);
    }
    if (filters.hall_id) {
      sql += ' AND a.hall_id = ?';
      params.push(filters.hall_id);
    }
    if (filters.exam_date) {
      sql += ' AND es.exam_date = ?';
      params.push(filters.exam_date);
    }
    if (filters.student_id) {
      sql += ' AND a.student_id = ?';
      params.push(filters.student_id);
    }

    sql += ' ORDER BY es.exam_date, es.exam_time, h.hall_name, a.seat_no';

    const [rows] = await this.db.query(sql, params);
    return rows;
  }

  /** Dashboard statistics. */
  async getStats() {
    const [[{ totalStudents }]]    = await this.db.query('SELECT COUNT(*) AS totalStudents FROM tbl_students');
    const [[{ totalCourses }]]     = await this.db.query('SELECT COUNT(*) AS totalCourses FROM tbl_courses');
    const [[{ totalHalls }]]       = await this.db.query('SELECT COUNT(*) AS totalHalls FROM tbl_halls');
    const [[{ totalSchedules }]]   = await this.db.query('SELECT COUNT(*) AS totalSchedules FROM tbl_exam_schedule');
    const [[{ pendingSchedules }]] = await this.db.query("SELECT COUNT(*) AS pendingSchedules FROM tbl_exam_schedule WHERE status = 'pending'");
    const [[{ allocatedSchedules }]] = await this.db.query("SELECT COUNT(*) AS allocatedSchedules FROM tbl_exam_schedule WHERE status = 'allocated'");
    const [[{ totalAllocations }]] = await this.db.query('SELECT COUNT(*) AS totalAllocations FROM tbl_allocations');

    return {
      totalStudents,
      totalCourses,
      totalHalls,
      totalSchedules,
      pendingSchedules,
      allocatedSchedules,
      totalAllocations
    };
  }
}

module.exports = AllocationEngine;
