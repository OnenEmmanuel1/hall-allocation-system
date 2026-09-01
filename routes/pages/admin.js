/**
 * EHAS Page Routes — Admin
 */

const router = require('express').Router();
const db = require('../../config/db');
const { isAdmin } = require('../../middleware/auth');
const AllocationEngine = require('../../engine/ehasEngine');

router.use(isAdmin);

/* GET /admin/dashboard */
router.get('/dashboard', async (req, res) => {
  try {
    const engine = new AllocationEngine(db);
    const stats = await engine.getStats();
    
    // Fetch recent schedules with enrolled student counts
    const [recentSchedules] = await db.query(`
      SELECT es.schedule_id, es.exam_date, es.exam_time, es.status,
             c.course_code, c.course_title, c.level,
             (SELECT COUNT(*) FROM tbl_student_courses sc WHERE sc.course_id = es.course_id) AS enrolled_count
      FROM tbl_exam_schedule es
      JOIN tbl_courses c ON es.course_id = c.course_id
      ORDER BY es.exam_date ASC, es.exam_time ASC
      LIMIT 6
    `);

    // Fetch halls with total capacities
    const [halls] = await db.query(`
      SELECT hall_id, hall_name, capacity, location
      FROM tbl_halls
      ORDER BY capacity DESC
    `);

    res.render('admin/dashboard', { 
      title: 'Dashboard — Admin', 
      stats, 
      recentSchedules,
      halls,
      user: req.session.user 
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).render('error', { title: 'Error', message: 'Could not load dashboard.', user: req.session.user });
  }
});

/* GET /admin/students */
router.get('/students', (req, res) => {
  res.render('admin/students', { title: 'Manage Students — Admin', user: req.session.user });
});

/* GET /admin/courses */
router.get('/courses', async (req, res) => {
  try {
    const [students] = await db.query('SELECT student_id, full_name, matric_no FROM tbl_students ORDER BY full_name');
    res.render('admin/courses', { title: 'Manage Courses — Admin', user: req.session.user, students });
  } catch (err) {
    console.error('Courses page error:', err);
    res.status(500).render('error', { title: 'Error', message: 'Could not load courses page.', user: req.session.user });
  }
});

/* GET /admin/halls */
router.get('/halls', (req, res) => {
  res.render('admin/halls', { title: 'Manage Halls — Admin', user: req.session.user });
});

/* GET /admin/schedules */
router.get('/schedules', async (req, res) => {
  try {
    const [courses] = await db.query('SELECT course_id, course_code, course_title FROM tbl_courses ORDER BY course_code');
    res.render('admin/schedules', { title: 'Exam Schedules — Admin', user: req.session.user, courses });
  } catch (err) {
    console.error('Schedules page error:', err);
    res.status(500).render('error', { title: 'Error', message: 'Could not load schedules page.', user: req.session.user });
  }
});

/* GET /admin/allocations */
router.get('/allocations', async (req, res) => {
  try {
    const [schedules] = await db.query(`
      SELECT es.schedule_id, es.exam_date, es.exam_time, es.status, c.course_code
      FROM tbl_exam_schedule es
      JOIN tbl_courses c ON es.course_id = c.course_id
      ORDER BY es.exam_date DESC, es.exam_time DESC
    `);
    res.render('admin/allocations', { title: 'Run Allocations — Admin', user: req.session.user, schedules });
  } catch (err) {
    console.error('Allocations page error:', err);
    res.status(500).render('error', { title: 'Error', message: 'Could not load allocations page.', user: req.session.user });
  }
});

/* GET /admin/reports */
router.get('/reports', async (req, res) => {
  try {
    const [courses] = await db.query('SELECT course_id, course_code FROM tbl_courses ORDER BY course_code');
    const [halls] = await db.query('SELECT hall_id, hall_name FROM tbl_halls ORDER BY hall_name');
    res.render('admin/reports', { title: 'Allocation Reports — Admin', user: req.session.user, courses, halls });
  } catch (err) {
    console.error('Reports page error:', err);
    res.status(500).render('error', { title: 'Error', message: 'Could not load reports page.', user: req.session.user });
  }
});

module.exports = router;
