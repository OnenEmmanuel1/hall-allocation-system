/**
 * EHAS Page Routes — Student
 */

const router = require('express').Router();
const db = require('../../config/db');
const { isStudent } = require('../../middleware/auth');
const AllocationEngine = require('../../engine/ehasEngine');

router.use(isStudent);

/* GET /student/dashboard */
router.get('/dashboard', async (req, res) => {
  try {
    const studentId = req.session.user.linkedStudentId;
    if (!studentId) {
      return res.status(403).render('error', {
        title: 'Error',
        message: 'Your user account is not linked to a student record.',
        user: req.session.user
      });
    }

    const engine = new AllocationEngine(db);
    const allocations = await engine.getAllocationsForStudent(studentId);

    /* Fetch student details for the header */
    const [studentRows] = await db.query('SELECT full_name, matric_no, department, level FROM tbl_students WHERE student_id = ?', [studentId]);
    const studentInfo = studentRows.length ? studentRows[0] : null;

    res.render('student/dashboard', {
      title: 'My Allocations — Student',
      user: req.session.user,
      studentInfo,
      allocations
    });
  } catch (err) {
    console.error('Student dashboard error:', err);
    res.status(500).render('error', { title: 'Error', message: 'Could not load dashboard.', user: req.session.user });
  }
});

module.exports = router;
