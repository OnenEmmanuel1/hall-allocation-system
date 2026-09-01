/**
 * EHAS Page Routes — Auth
 */

const router = require('express').Router();

/* GET /login */
router.get('/login', (req, res) => {
  if (req.session && req.session.user) {
    if (req.session.user.role === 'Administrator') {
      return res.redirect('/admin/dashboard');
    } else {
      return res.redirect('/student/dashboard');
    }
  }
  res.render('login', { title: 'Login — EHAS' });
});

/* GET /logout */
router.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

/* GET / — Root redirect */
router.get('/', (req, res) => {
  if (req.session && req.session.user) {
    if (req.session.user.role === 'Administrator') {
      return res.redirect('/admin/dashboard');
    } else {
      return res.redirect('/student/dashboard');
    }
  }
  res.redirect('/login');
});

module.exports = router;
