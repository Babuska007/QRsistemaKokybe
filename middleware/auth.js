const requireAuth = (req, res, next) => {
  if (!req.session.user) {
    if (req.xhr || req.headers['content-type']?.includes('application/json') || !req.accepts('html')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    return res.redirect('/login.html');
  }
  next();
};

const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.session.user) {
      if (req.xhr || req.headers['content-type']?.includes('application/json') || !req.accepts('html')) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      return res.redirect('/login.html');
    }
    if (!roles.includes(req.session.user.role)) {
      return res.status(403).send('Access denied');
    }
    next();
  };
};

module.exports = { requireAuth, requireRole };