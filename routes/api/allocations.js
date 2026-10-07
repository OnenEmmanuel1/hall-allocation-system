/**
 * EHAS API — Allocations (Admin only)
 * Endpoints for triggering the allocation engine and fetching reports
 */

const router = require('express').Router();
const db = require('../../config/db');
const { isAdmin } = require('../../middleware/auth');
const AllocationEngine = require('../../engine/ehasEngine');

/* POST /api/allocations/run/:scheduleId — run single allocation */
router.post('/run/:scheduleId', isAdmin, async (req, res) => {
  try {
    const engine = new AllocationEngine(db);
    const result = await engine.runAllocation(req.params.scheduleId);
    res.json(result);
  } catch (err) {
    console.error('Run allocation error:', err);
    res.status(500).json({ success: false, error: 'Server error during allocation.' });
  }
});

/* POST /api/allocations/run-all — run bulk allocation */
router.post('/run-all', isAdmin, async (req, res) => {
  try {
    const engine = new AllocationEngine(db);
    const result = await engine.runBulkAllocation();
    res.json(result);
  } catch (err) {
    console.error('Bulk allocation error:', err);
    res.status(500).json({ success: false, error: 'Server error during bulk allocation.' });
  }
});

/* DELETE /api/allocations/:scheduleId — remove a schedule's seat assignments */
router.delete('/:scheduleId', isAdmin, async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [schedules] = await connection.query(
      'SELECT schedule_id FROM tbl_exam_schedule WHERE schedule_id = ? FOR UPDATE',
      [req.params.scheduleId]
    );
    if (!schedules.length) {
      await connection.rollback();
      return res.status(404).json({ success: false, error: 'Exam schedule not found.' });
    }
    const [result] = await connection.query(
      'DELETE FROM tbl_allocations WHERE schedule_id = ?', [req.params.scheduleId]
    );
    await connection.query(
      "UPDATE tbl_exam_schedule SET status = 'pending' WHERE schedule_id = ?",
      [req.params.scheduleId]
    );
    await connection.commit();
    res.json({ success: true, message: `Removed ${result.affectedRows} seat assignment(s). Schedule is pending again.` });
  } catch (err) {
    await connection.rollback();
    console.error('Deallocate error:', err);
    res.status(500).json({ success: false, error: 'Could not remove allocations.' });
  } finally {
    connection.release();
  }
});

/* GET /api/allocations/report — fetch allocation report */
router.get('/report', isAdmin, async (req, res) => {
  try {
    const engine = new AllocationEngine(db);
    const filters = {
      course_id: req.query.course_id || null,
      hall_id: req.query.hall_id || null,
      exam_date: req.query.exam_date || null,
      student_id: req.query.student_id || null
    };
    const data = await engine.getAllocationReport(filters);
    res.json({ success: true, data });
  } catch (err) {
    console.error('Report error:', err);
    res.status(500).json({ success: false, error: 'Server error fetching report.' });
  }
});

module.exports = router;
