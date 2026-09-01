/**
 * EHAS API — Schedules (Admin only)
 * CRUD on tbl_exam_schedule
 */

const router = require('express').Router();
const db = require('../../config/db');
const { isAdmin } = require('../../middleware/auth');

/* GET /api/schedules — list all schedules */
router.get('/', isAdmin, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT es.*, c.course_code, c.course_title,
             (SELECT COUNT(*) FROM tbl_student_courses WHERE course_id = es.course_id) AS enrolled_count
      FROM tbl_exam_schedule es
      JOIN tbl_courses c ON es.course_id = c.course_id
      ORDER BY es.exam_date, es.exam_time
    `);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('GET /api/schedules error:', err);
    res.status(500).json({ success: false, error: 'Server error.' });
  }
});

/* POST /api/schedules — create schedule */
router.post('/', isAdmin, async (req, res) => {
  try {
    const { course_id, exam_date, exam_time } = req.body;

    if (!course_id || !exam_date || !exam_time) {
      return res.json({ success: false, error: 'All fields are required.' });
    }

    const [existing] = await db.query(
      'SELECT schedule_id FROM tbl_exam_schedule WHERE course_id = ? AND exam_date = ? AND exam_time = ?',
      [course_id, exam_date, exam_time]
    );
    if (existing.length) {
      return res.json({ success: false, error: 'This course already has an exam scheduled for this date and time.' });
    }

    await db.query(
      "INSERT INTO tbl_exam_schedule (course_id, exam_date, exam_time, status) VALUES (?, ?, ?, 'pending')",
      [course_id, exam_date, exam_time]
    );

    res.json({ success: true, message: 'Schedule created successfully.' });
  } catch (err) {
    console.error('POST /api/schedules error:', err);
    res.status(500).json({ success: false, error: 'Server error.' });
  }
});

/* PUT /api/schedules/:id — update schedule */
router.put('/:id', isAdmin, async (req, res) => {
  try {
    const { course_id, exam_date, exam_time } = req.body;
    const scheduleId = req.params.id;

    if (!course_id || !exam_date || !exam_time) {
      return res.json({ success: false, error: 'All fields are required.' });
    }

    const [existing] = await db.query(
      'SELECT schedule_id FROM tbl_exam_schedule WHERE course_id = ? AND exam_date = ? AND exam_time = ? AND schedule_id != ?',
      [course_id, exam_date, exam_time, scheduleId]
    );
    if (existing.length) {
      return res.json({ success: false, error: 'This course already has an exam scheduled for this date and time.' });
    }

    await db.query(
      'UPDATE tbl_exam_schedule SET course_id = ?, exam_date = ?, exam_time = ? WHERE schedule_id = ?',
      [course_id, exam_date, exam_time, scheduleId]
    );

    res.json({ success: true, message: 'Schedule updated successfully.' });
  } catch (err) {
    console.error('PUT /api/schedules error:', err);
    res.status(500).json({ success: false, error: 'Server error.' });
  }
});

/* DELETE /api/schedules/:id — delete schedule */
router.delete('/:id', isAdmin, async (req, res) => {
  try {
    const scheduleId = req.params.id;
    await db.query('DELETE FROM tbl_exam_schedule WHERE schedule_id = ?', [scheduleId]);
    res.json({ success: true, message: 'Schedule deleted successfully.' });
  } catch (err) {
    console.error('DELETE /api/schedules error:', err);
    res.status(500).json({ success: false, error: 'Server error.' });
  }
});

module.exports = router;
