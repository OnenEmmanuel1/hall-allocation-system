/**
 * EHAS Authentication & Authorization Middleware
 * Session-based auth guards and role-based route protection.
 */

function isAuthenticated(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }
  if (req.xhr || req.path.startsWith('/api/')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  return res.redirect('/login');
}

function authorizeRoles(...roles) {
  return (req, res, next) => {
    if (!req.session || !req.session.user) {
      if (req.xhr || req.path.startsWith('/api/')) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      return res.redirect('/login');
    }
    if (!roles.includes(req.session.user.role)) {
      if (req.xhr || req.path.startsWith('/api/')) {
        return res.status(403).json({ error: 'Access denied' });
      }
      return res.status(403).render('error', {
        title: 'Access Denied',
        message: 'You do not have permission to access this resource.',
        user: req.session.user
      });
    }
    return next();
  };
}

const isAdmin = [isAuthenticated, authorizeRoles('Administrator')];
const isStudent = [isAuthenticated, authorizeRoles('Student')];

module.exports = {
  isAuthenticated,
  authorizeRoles,
  isAdmin,
  isStudent
};
