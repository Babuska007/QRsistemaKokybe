const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// Fetch all devices with QR info + city
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT 
        d.id, 
        d.device_name, 
        q.qr_code, 
        q.qr_image,
        q.city_id,
        c.code AS city_code,
        c.name AS city_name
      FROM devices d
      LEFT JOIN qrcodes q ON d.qr_id = q.qr_id
      LEFT JOIN cities c ON q.city_id = c.id
      ORDER BY d.id ASC
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching devices");
  }
});

// Get single device by ID
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await pool.execute(
      "SELECT id, device_name, qr_id FROM devices WHERE id = ?",
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).send("Device not found");
    }

    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching device");
  }
});

// Delete a device by ID
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const [deviceRows] = await pool.execute(
      "SELECT qr_id FROM devices WHERE id = ?", 
      [id]
    );
    
    if (deviceRows.length > 0) {
      const qr_id = deviceRows[0].qr_id;
      
      await pool.execute("DELETE FROM devices WHERE id = ?", [id]);
      
      await pool.execute(
        "UPDATE qrcodes SET city_id = NULL WHERE qr_id = ?",
        [qr_id]
      );
    } else {
      await pool.execute("DELETE FROM devices WHERE id = ?", [id]);
    }
    
    res.send("Device deleted");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error deleting device");
  }
});

// Get device rules
router.get('/:deviceId/rules', async (req, res) => {
  const { deviceId } = req.params;
  try {
    const [rows] = await pool.execute(
      "SELECT rule_id, device_id, rule_day FROM device_rules WHERE device_id = ?",
      [deviceId]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching device rules");
  }
});

// Update device rules
router.post('/:deviceId/rules', async (req, res) => {
  const { deviceId } = req.params;
  const rules = req.body;
  if (!Array.isArray(rules)) return res.status(400).send("Invalid rules format");

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute("DELETE FROM device_rules WHERE device_id = ?", [deviceId]);
    for (const rule of rules) {
      await conn.execute(
        "INSERT INTO device_rules (device_id, rule_day) VALUES (?, ?)",
        [deviceId, rule.rule_day]
      );
    }
    await conn.commit();
    res.send("Rules updated");
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).send("Error saving device rules");
  } finally {
    conn.release();
  }
});

module.exports = router;