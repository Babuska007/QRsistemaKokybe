const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// Get calendar data for a specific month
router.get('/month', async (req, res) => {
  let { year, month } = req.query;

  if (!year || !month) {
    return res.status(400).json({ error: "Missing year or month" });
  }

  year = parseInt(year, 10);
  month = parseInt(month, 10);

  try {
    const [rows] = await pool.execute(`
      SELECT 
        s.scan_id,
        s.device_id,
        d.device_name,
        s.is_scanned,
        DATE_FORMAT(s.scan_timestamp, '%Y-%m-%d') AS date,
        DATE_FORMAT(s.scan_timestamp, '%Y-%m-%d %H:%i:%s') AS scan_timestamp,
        CONCAT(u.first_name, ' ', u.last_name) AS user_name
      FROM scans s
      JOIN devices d ON s.device_id = d.id
      LEFT JOIN users u ON s.user_id = u.id
      WHERE YEAR(s.scan_timestamp) = ?
        AND MONTH(s.scan_timestamp) = ?
      ORDER BY s.scan_timestamp ASC
    `, [year, month]);

    const grouped = {};

    rows.forEach(r => {
      const key = r.date;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(r);
    });

    res.json(grouped);

  } catch (err) {
    console.error("Calendar fetch error:", err);
    res.status(500).json({ error: "Database error" });
  }
});

module.exports = router;