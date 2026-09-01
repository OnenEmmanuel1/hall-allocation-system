/**
 * EHAS API — Authentication
 * POST /api/auth/login   — validate credentials, set session
 * POST /api/auth/logout  — destroy session
 */

const router = require('express').Router();
const bcrypt = require('bcryptjs');
const db = require('../../config/db');

/* POST /api/auth/login */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.json({ success: false, error: 'Email and password are required.' });
    }

    const [users] = await db.query(
      'SELECT * FROM tbl_users WHERE username = ?',
      [email.trim()]
    );

    if (!users.length) {
      return res.json({ success: false, error: 'Invalid email or password.' });
    }

    const user = users[0];
    const valid = await bcrypt.compare(password, user.password_hash);

    if (!valid) {
      return res.json({ success: false, error: 'Invalid email or password.' });
    }

    /* Set session */
    req.session.user = {
      id: user.user_id,
      username: user.username,
      role: user.role,
      linkedStudentId: user.linked_student_id
    };

    /* Redirect based on role */
    const redirect = user.role === 'Administrator' ? '/admin/dashboard' : '/student/dashboard';

    return res.json({ success: true, redirect });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ success: false, error: 'Server error. Please try again.' });
  }
});

/* POST /api/auth/logout */
router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true });
  });
});

module.exports = router;
