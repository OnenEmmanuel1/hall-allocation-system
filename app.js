/**
 * EHAS — Application Entry Point
 * Examination Hall Allocation System
 * Faculty of Computing, UNICROSS
 */

require('dotenv').config();
const express = require('express');
const path = require('path');
const session = require('express-session');
const morgan = require('morgan');
const sessionConfig = require('./config/session');

const app = express();

/* ── View Engine ───────────────────────────────── */
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

/* ── Middleware ─────────────────────────────────── */
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session(sessionConfig));

/* Make user available to all EJS views */
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.currentPath = req.path;
  next();
});

/* ── Page Routes ───────────────────────────────── */
app.use('/',         require('./routes/pages/auth'));
app.use('/admin',    require('./routes/pages/admin'));
app.use('/student',  require('./routes/pages/student'));

/* ── API Routes ────────────────────────────────── */
app.use('/api/auth',        require('./routes/api/auth'));
app.use('/api/students',    require('./routes/api/students'));
app.use('/api/courses',     require('./routes/api/courses'));
app.use('/api/halls',       require('./routes/api/halls'));
app.use('/api/schedules',   require('./routes/api/schedules'));
app.use('/api/allocations', require('./routes/api/allocations'));

/* ── 404 Handler ───────────────────────────────── */
app.use((req, res) => {
  res.status(404).render('error', {
    title: '404 — Page Not Found',
    message: 'The page you are looking for does not exist.',
    user: req.session.user || null
  });
});

/* ── Global Error Handler ──────────────────────── */
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render('error', {
    title: '500 — Server Error',
    message: 'An unexpected error occurred. Please try again later.',
    user: req.session.user || null
  });
});

/* ── Start Server ──────────────────────────────── */
const PORT = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`\n  ⚡ EHAS running on http://localhost:${PORT}\n`);
  });
}

module.exports = app;
