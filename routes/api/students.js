/**
 * EHAS API — Students (Admin only)
 * Full CRUD on tbl_students + paired tbl_users entry.
 */

const router = require('express').Router();
const bcrypt = require('bcryptjs');
const db = require('../../config/db');
const { isAdmin } = require('../../middleware/auth');

/* GET /api/students — list all students */
router.get('/', isAdmin, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT s.*, u.username AS email, u.user_id
       FROM tbl_students s
       LEFT JOIN tbl_users u ON u.linked_student_id = s.student_id AND u.role = 'Student'
       ORDER BY s.full_name`
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('GET /api/students error:', err);
    res.status(500).json({ success: false, error: 'Server error.' });
  }
});

/* POST /api/students — create student + user account */
router.post('/', isAdmin, async (req, res) => {
  try {
    const { full_name, matric_no, department, level, email, password } = req.body;

    /* Validation */
    if (!full_name || !matric_no || !department || !level) {
      return res.json({ success: false, error: 'All fields are required.' });
    }
    if (!Number.isInteger(Number(level)) || Number(level) < 100) {
      return res.json({ success: false, error: 'Level must be a positive integer (e.g. 100, 200).' });
    }

    /* Check matric uniqueness */
    const [existing] = await db.query(
      'SELECT student_id FROM tbl_students WHERE matric_no = ?',
      [matric_no.trim()]
    );
    if (existing.length) {
      return res.json({ success: false, error: 'A student with this matric number already exists.' });
    }

    /* Insert student */
    const [result] = await db.query(
      'INSERT INTO tbl_students (full_name, matric_no, department, level) VALUES (?, ?, ?, ?)',
      [full_name.trim(), matric_no.trim(), department.trim(), Number(level)]
    );
    const studentId = result.insertId;

    /* Create paired user account if email provided */
    if (email) {
      const hash = await bcrypt.hash(password || 'password123', 10);
      await db.query(
        "INSERT INTO tbl_users (username, password_hash, role, linked_student_id) VALUES (?, ?, 'Student', ?)",
        [email.trim(), hash, studentId]
      );
    }

    res.json({ success: true, message: 'Student created successfully.', student_id: studentId });
  } catch (err) {
    console.error('POST /api/students error:', err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.json({ success: false, error: 'Duplicate entry. Check matric number or email.' });
    }
    res.status(500).json({ success: false, error: 'Server error.' });
  }
});

/* PUT /api/students/:id — update student */
router.put('/:id', isAdmin, async (req, res) => {
  try {
    const { full_name, matric_no, department, level } = req.body;
    const studentId = req.params.id;

    if (!full_name || !matric_no || !department || !level) {
      return res.json({ success: false, error: 'All fields are required.' });
    }

    /* Check matric uniqueness (exclude self) */
    const [existing] = await db.query(
      'SELECT student_id FROM tbl_students WHERE matric_no = ? AND student_id != ?',
      [matric_no.trim(), studentId]
    );
    if (existing.length) {
      return res.json({ success: false, error: 'Another student already has this matric number.' });
    }

    await db.query(
      'UPDATE tbl_students SET full_name = ?, matric_no = ?, department = ?, level = ? WHERE student_id = ?',
      [full_name.trim(), matric_no.trim(), department.trim(), Number(level), studentId]
    );

    res.json({ success: true, message: 'Student updated successfully.' });
  } catch (err) {
    console.error('PUT /api/students error:', err);
    res.status(500).json({ success: false, error: 'Server error.' });
  }
});

/* DELETE /api/students/:id — delete student and paired user */
router.delete('/:id', isAdmin, async (req, res) => {
  try {
    const studentId = req.params.id;

    /* Delete paired user account first */
    await db.query(
      "DELETE FROM tbl_users WHERE linked_student_id = ? AND role = 'Student'",
      [studentId]
    );

    /* Delete student (cascades to enrollments and allocations) */
    await db.query('DELETE FROM tbl_students WHERE student_id = ?', [studentId]);

    res.json({ success: true, message: 'Student deleted successfully.' });
  } catch (err) {
    console.error('DELETE /api/students error:', err);
    res.status(500).json({ success: false, error: 'Server error.' });
  }
});

module.exports = router;
