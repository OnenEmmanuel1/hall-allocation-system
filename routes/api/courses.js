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

/* POST /api/courses/:id/enroll — enroll student(s) in course */
router.post('/:id/enroll', isAdmin, async (req, res) => {
  try {
    const courseId = req.params.id;
    const { studentIds } = req.body; // array of student_ids

    if (!Array.isArray(studentIds) || studentIds.length === 0) {
      return res.json({ success: false, error: 'No students selected.' });
    }

    for (const sId of studentIds) {
      await db.query(
        'INSERT IGNORE INTO tbl_student_courses (student_id, course_id) VALUES (?, ?)',
        [sId, courseId]
      );
    }

    res.json({ success: true, message: 'Students enrolled successfully.' });
  } catch (err) {
    console.error('Enroll error:', err);
    res.status(500).json({ success: false, error: 'Server error.' });
  }
});

module.exports = router;
