require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.APP_PORT || 3000;
const HOST = process.env.APP_HOST || '0.0.0.0';
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL;

// Middleware
app.use(express.json());
app.use(express.static('public'));

const initDatabase = require('./config/initdatabase');

// Import routes
const qrcodesRoutes = require('./routes/qrcodes');
const devicesRoutes = require('./routes/devices');
const usersRoutes = require('./routes/users');
const groupsRoutes = require('./routes/groups');
const scansRoutes = require('./routes/scans');
const logsRoutes = require('./routes/logs');
const calendarRoutes = require('./routes/calendar');
const citiesRoutes = require('./routes/cities');
const deviceRulesRoutes = require('./routes/device_rules');

app.use('/qrcodes', qrcodesRoutes);
app.use('/devices', devicesRoutes);
app.use('/users', usersRoutes);
app.use('/system_groups', groupsRoutes);
app.use('/scan', scansRoutes);
app.use('/logs', logsRoutes);
app.use('/calendar', calendarRoutes);
app.use('/cities', citiesRoutes);
app.use('/device_rules', deviceRulesRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
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
