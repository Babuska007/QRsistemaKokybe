const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// Get logs with filtering
router.get('/', async (req, res) => {
  try {
    const { deviceId, from, to, scanned, user, cityId } = req.query;

    let sql = `
      SELECT 
        s.scan_id,
        d.device_name,
        s.is_scanned,
        DATE_FORMAT(s.scan_timestamp, '%Y-%m-%d %H:%i:%s') AS scan_timestamp,
        CONCAT(u.first_name, ' ', u.last_name) AS user_name,
        c.name AS city_name,
        c.id AS city_id
      FROM scans s
      JOIN devices d ON s.device_id = d.id
      LEFT JOIN users u ON s.user_id = u.id
      LEFT JOIN cities c ON d.city_id = c.id
      WHERE 1=1
    `;

    const params = [];

    if (cityId) {
      sql += " AND d.city_id = ?";
      params.push(cityId);
    }

    if (deviceId) {
      sql += " AND d.id = ?";
      params.push(deviceId);
    }

    if (req.query.groupId) {
      sql += ` AND d.system_group_id = ?`;
      params.push(req.query.groupId);
    }

    if (user) {
      sql += " AND CONCAT(COALESCE(u.first_name,''), ' ', COALESCE(u.last_name,'')) = ?";
      params.push(user);
    }

    if (from) {
      sql += " AND s.scan_timestamp >= ?";
      params.push(from);
    }

    if (to) {
      sql += " AND s.scan_timestamp <= ?";
      params.push(to);
    }

    if (scanned === '1' || scanned === '0') {
      sql += " AND s.is_scanned = ?";
      params.push(Number(scanned));
    }

    sql += " ORDER BY s.scan_timestamp DESC LIMIT 50";

    const [rows] = await pool.execute(sql, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching logs");
  }
});

module.exports = router;