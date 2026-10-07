/**
 * EHAS API — Courses (Admin only)
 * Full CRUD on tbl_courses + managing student enrollments
 */

const router = require('express').Router();
const db = require('../../config/db');
const { isAdmin } = require('../../middleware/auth');

/* GET /api/courses — list all courses */
router.get('/', isAdmin, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT c.*, COUNT(sc.student_id) AS enrolled_count
       FROM tbl_courses c
       LEFT JOIN tbl_student_courses sc ON c.course_id = sc.course_id
       GROUP BY c.course_id
       ORDER BY c.course_code`
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('GET /api/courses error:', err);
    res.status(500).json({ success: false, error: 'Server error.' });
  }
});

/* POST /api/courses — create course */
router.post('/', isAdmin, async (req, res) => {
  try {
    const { course_code, course_title, department, level } = req.body;

    if (!course_code || !course_title || !department || !level) {
      return res.json({ success: false, error: 'All fields are required.' });
    }

    const [existing] = await db.query(
      'SELECT course_id FROM tbl_courses WHERE course_code = ?',
      [course_code.trim()]
    );
    if (existing.length) {
      return res.json({ success: false, error: 'Course code already exists.' });
    }

    await db.query(
      'INSERT INTO tbl_courses (course_code, course_title, department, level) VALUES (?, ?, ?, ?)',
      [course_code.trim().toUpperCase(), course_title.trim(), department.trim(), Number(level)]
    );

    res.json({ success: true, message: 'Course created successfully.' });
  } catch (err) {
    console.error('POST /api/courses error:', err);
    res.status(500).json({ success: false, error: 'Server error.' });
  }
});

/* PUT /api/courses/:id — update course */
router.put('/:id', isAdmin, async (req, res) => {
  try {
    const { course_code, course_title, department, level } = req.body;
    const courseId = req.params.id;

    const [existing] = await db.query(
      'SELECT course_id FROM tbl_courses WHERE course_code = ? AND course_id != ?',
      [course_code.trim(), courseId]
    );
    if (existing.length) {
      return res.json({ success: false, error: 'Another course has this code.' });
    }

    await db.query(
      'UPDATE tbl_courses SET course_code = ?, course_title = ?, department = ?, level = ? WHERE course_id = ?',
      [course_code.trim().toUpperCase(), course_title.trim(), department.trim(), Number(level), courseId]
    );

    res.json({ success: true, message: 'Course updated successfully.' });
  } catch (err) {
    console.error('PUT /api/courses error:', err);
    res.status(500).json({ success: false, error: 'Server error.' });
  }
});

/* DELETE /api/courses/:id — delete course */
router.delete('/:id', isAdmin, async (req, res) => {
  try {
    const courseId = req.params.id;
    await db.query('DELETE FROM tbl_courses WHERE course_id = ?', [courseId]);
    res.json({ success: true, message: 'Course deleted successfully.' });
  } catch (err) {
    console.error('DELETE /api/courses error:', err);
    res.status(500).json({ success: false, error: 'Server error.' });
  }
});

/* POST /api/courses/:id/enroll — replace the course roster (supports enrol and de-enrol) */
router.get('/:id/enroll', isAdmin, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT student_id FROM tbl_student_courses WHERE course_id = ?', [req.params.id]
    );
    res.json({ success: true, studentIds: rows.map(row => row.student_id) });
  } catch (err) {
    console.error('Get enrollment error:', err);
    res.status(500).json({ success: false, error: 'Could not load course roster.' });
  }
});

router.post('/:id/enroll', isAdmin, async (req, res) => {
  const connection = await db.getConnection();
  try {
    const courseId = req.params.id;
    const { studentIds } = req.body;

    if (!Array.isArray(studentIds) || studentIds.some(id => !Number.isInteger(Number(id)) || Number(id) < 1)) {
      return res.status(400).json({ success: false, error: 'Provide a valid student list.' });
    }

    const ids = [...new Set(studentIds.map(Number))];
    await connection.beginTransaction();
    const [courses] = await connection.query('SELECT course_id FROM tbl_courses WHERE course_id = ? FOR UPDATE', [courseId]);
    if (!courses.length) {
      await connection.rollback();
      return res.status(404).json({ success: false, error: 'Course not found.' });
    }

    if (ids.length) {
      const placeholders = ids.map(() => '?').join(',');
      const [valid] = await connection.query(`SELECT student_id FROM tbl_students WHERE student_id IN (${placeholders})`, ids);
      if (valid.length !== ids.length) {
        await connection.rollback();
        return res.status(400).json({ success: false, error: 'One or more selected students do not exist.' });
      }
    }

    const [currentRows] = await connection.query('SELECT student_id FROM tbl_student_courses WHERE course_id = ?', [courseId]);
    const currentIds = currentRows.map(row => row.student_id);
    const changed = currentIds.length !== ids.length || currentIds.some(id => !ids.includes(id));
    if (changed) {
      // Roster changes invalidate this course's seating plan. Require a fresh allocation.
      await connection.query('DELETE FROM tbl_allocations WHERE schedule_id IN (SELECT schedule_id FROM tbl_exam_schedule WHERE course_id = ?)', [courseId]);
      await connection.query("UPDATE tbl_exam_schedule SET status = 'pending' WHERE course_id = ?", [courseId]);
      await connection.query('DELETE FROM tbl_student_courses WHERE course_id = ?', [courseId]);
      if (ids.length) {
        const values = ids.map(() => '(?, ?)').join(',');
        await connection.query(`INSERT INTO tbl_student_courses (student_id, course_id) VALUES ${values}`, ids.flatMap(id => [id, courseId]));
      }
    }
    await connection.commit();

    res.json({ success: true, message: `Course roster saved with ${ids.length} student(s).${changed ? ' Existing allocations were cleared; rerun allocation.' : ''}` });
  } catch (err) {
    await connection.rollback();
    console.error('Enroll error:', err);
    res.status(500).json({ success: false, error: 'Server error.' });
  } finally {
    connection.release();
  }
});

module.exports = router;
