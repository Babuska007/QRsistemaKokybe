require('dotenv').config();
const express = require('express');
const session = require('express-session');

const app = express();
const PORT = process.env.APP_PORT || 3000;
const HOST = process.env.APP_HOST || '0.0.0.0';
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL;

// Session configuration (BEFORE other middleware)
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // set to true if using https
    httpOnly: true,
    maxAge: 1 * 60 * 60 * 1000 // 1 hours
  }
}));

// Middleware
app.use(express.json());


//Protect ALL .html pages (except login.html) when not authenticated.
app.use((req, res, next) => {
  const isHtml = req.path === '/' || req.path.endsWith('.html');
  const isLogin = req.path === '/' || req.path === '/login.html';
  const isPublicScan = req.path.startsWith('/scan'); // keep scan public (QR users)

  // Not logged in: only allow login page (and public scan)
  if (!req.session?.user) {
    if (isHtml && !isLogin && !isPublicScan) {
      return res.redirect('/login.html');
    }
    return next();
  }

  // Logged in: don't allow going back to login page
  if (req.session?.user && req.path === '/login.html') {
    return res.redirect('/index.html');
  }

  next();
});

// Serve static files, but DO NOT auto-serve index.html at "/"
app.use(express.static('public', { index: false }));

// Root route: smart redirect
app.get('/', (req, res) => {
  if (req.session?.user) return res.redirect('/index.html');
  return res.redirect('/login.html');
});

const initDatabase = require('./config/initdatabase');

// Import middleware
const { requireAuth, requireRole } = require('./middleware/auth');

// Import routes
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const qrcodesRoutes = require('./routes/qrcodes');
const devicesRoutes = require('./routes/devices');
const usersRoutes = require('./routes/users');
const groupsRoutes = require('./routes/groups');
const scansRoutes = require('./routes/scans');
const logsRoutes = require('./routes/logs');
const calendarRoutes = require('./routes/calendar');
const citiesRoutes = require('./routes/cities');
const deviceRulesRoutes = require('./routes/device_rules');

// Auth routes (NO protection)
app.use('/auth', authRoutes);

// Admin routes (superadmin only)
app.use('/admin', requireRole(['superadmin']), adminRoutes);

// QR scan route (NO protection - must be public for users to scan QR codes)
app.use('/scan', scansRoutes);

// Protected routes (require authentication)
app.use('/qrcodes', requireAuth, qrcodesRoutes);
app.use('/devices', requireAuth, devicesRoutes);
app.use('/users', requireAuth, usersRoutes);
app.use('/system_groups', requireAuth, groupsRoutes);
app.use('/logs', requireAuth, logsRoutes);
app.use('/calendar', requireAuth, calendarRoutes);
app.use('/cities', requireAuth, citiesRoutes);
app.use('/device_rules', requireAuth, deviceRulesRoutes);

// Error handling middleware
app.use((err, req, res) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

// Start server (after DB init)
(async () => {
  await initDatabase();
  require('./jobs/daily-scan-creator');

  app.listen(PORT, HOST, () => {
    console.log(`Server running at ${PUBLIC_BASE_URL}`);
  });
})();
