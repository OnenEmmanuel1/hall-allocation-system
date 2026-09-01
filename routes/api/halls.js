/**
 * EHAS API — Halls (Admin only)
 * Full CRUD on tbl_halls
 */

const router = require('express').Router();
const db = require('../../config/db');
const { isAdmin } = require('../../middleware/auth');

/* GET /api/halls — list all halls */
router.get('/', isAdmin, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM tbl_halls ORDER BY capacity DESC');
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('GET /api/halls error:', err);
    res.status(500).json({ success: false, error: 'Server error.' });
  }
});

/* POST /api/halls — create hall */
router.post('/', isAdmin, async (req, res) => {
  try {
    const { hall_name, capacity, location } = req.body;

    if (!hall_name || !capacity) {
      return res.json({ success: false, error: 'Name and capacity are required.' });
    }
    if (!Number.isInteger(Number(capacity)) || Number(capacity) < 1) {
      return res.json({ success: false, error: 'Capacity must be a positive integer.' });
    }

    await db.query(
      'INSERT INTO tbl_halls (hall_name, capacity, location) VALUES (?, ?, ?)',
      [hall_name.trim(), Number(capacity), (location || '').trim()]
    );

    res.json({ success: true, message: 'Hall created successfully.' });
  } catch (err) {
    console.error('POST /api/halls error:', err);
    res.status(500).json({ success: false, error: 'Server error.' });
  }
});

/* PUT /api/halls/:id — update hall */
router.put('/:id', isAdmin, async (req, res) => {
  try {
    const { hall_name, capacity, location } = req.body;
    const hallId = req.params.id;

    if (!hall_name || !capacity) {
      return res.json({ success: false, error: 'Name and capacity are required.' });
    }

    await db.query(
      'UPDATE tbl_halls SET hall_name = ?, capacity = ?, location = ? WHERE hall_id = ?',
      [hall_name.trim(), Number(capacity), (location || '').trim(), hallId]
    );

    res.json({ success: true, message: 'Hall updated successfully.' });
  } catch (err) {
    console.error('PUT /api/halls error:', err);
    res.status(500).json({ success: false, error: 'Server error.' });
  }
});

/* DELETE /api/halls/:id — delete hall */
router.delete('/:id', isAdmin, async (req, res) => {
  try {
    const hallId = req.params.id;
    await db.query('DELETE FROM tbl_halls WHERE hall_id = ?', [hallId]);
    res.json({ success: true, message: 'Hall deleted successfully.' });
  } catch (err) {
    console.error('DELETE /api/halls error:', err);
    res.status(500).json({ success: false, error: 'Server error.' });
  }
});

module.exports = router;
