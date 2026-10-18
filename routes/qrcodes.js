const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// Bulk create QR codes
router.post('/bulk', async (req, res) => {
  const { count } = req.body;
  if (!count || count <= 0) return res.status(400).send("Invalid count");

  try {
    const created = [];
    for (let i = 0; i < count; i++) {
      const qr_code = `QR_${Date.now()}_${i}`;
      await pool.execute('INSERT INTO qrcodes (qr_code) VALUES (?)', [qr_code]);
      created.push({ qr_code });
    }
    res.status(201).json({ message: `${count} QR codes created`, created });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error creating QR codes");
  }
});

// Get all QR codes
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT 
        q.qr_id,
        q.qr_code,
        q.city_id,
        q.system_group_id,
        c.name AS city_name,
        c.code AS city_code,
        sg.group_name AS system_group_name,
        d.id AS device_id,
        d.device_name,
        d.description
      FROM qrcodes q
      LEFT JOIN devices d ON d.qr_id = q.qr_id
      LEFT JOIN cities c ON q.city_id = c.id
      LEFT JOIN system_groups sg ON q.system_group_id = sg.id
      ORDER BY q.qr_id ASC
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching QR codes");
  }
});

router.post('/:qrId/assign_device', async (req, res) => {
  const { qrId } = req.params;
  const { device_name, description, city_id } = req.body;

  if (!device_name) return res.status(400).send("Missing device_name");
  if (!city_id) return res.status(400).send("Missing city_id");

  try {
    await pool.execute(
      "UPDATE qrcodes SET city_id = ? WHERE qr_id = ?",
      [city_id, qrId]
    );

    await pool.execute(
      "INSERT INTO devices (device_name, description, qr_id, city_id) VALUES (?, ?, ?, ?)",
      [device_name, description || null, qrId, city_id]
    );

    res.send(`Device "${device_name}" mapped to QR code successfully`);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error mapping device to QR code");
  }
});

// Change city for a QR code
router.post('/:qrId/change_city', async (req, res) => {
  const { qrId } = req.params;
  const { city_id } = req.body;
  if (!city_id) return res.status(400).send("Missing city_id");

  try {
    await pool.execute("UPDATE qrcodes SET city_id = ? WHERE qr_id = ?", [city_id, qrId]);
    await pool.execute("UPDATE devices SET city_id = ? WHERE qr_id = ?", [city_id, qrId]);
    res.send("City updated successfully");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error updating city");
  }
});

// Edit assigned device
router.post('/:qrId/edit_device', async (req, res) => {
  const { qrId } = req.params;
  const { device_name, description, city_id } = req.body;

  if (!device_name) return res.status(400).send("Missing device_name");
  if (!city_id) return res.status(400).send("Missing city_id");

  try {
    await pool.execute(
      "UPDATE qrcodes SET city_id = ? WHERE qr_id = ?",
      [city_id, qrId]
    );

    await pool.execute(
      "UPDATE devices SET device_name = ?, description = ?, city_id = ? WHERE qr_id = ?",
      [device_name, description || null, city_id, qrId]
    );

    res.send("Device updated successfully");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error updating device");
  }
});

// DELETE QR code — superadmin only
// This checks req.session.user.role on the route level
router.delete('/:qrId', async (req, res) => {
  if (!req.session?.user || req.session.user.role !== 'superadmin') {
    return res.status(403).send("Tik superadmin gali trinti QR kodus");
  }

  const { qrId } = req.params;

  try {
    // First delete linked device (FK constraint), then the QR code
    await pool.execute("UPDATE devices SET qr_id = NULL WHERE qr_id = ?", [qrId]);
    await pool.execute("DELETE FROM qrcodes WHERE qr_id = ?", [qrId]);
    res.send("QR kodas ištrintas");
  } catch (err) {
    console.error(err);
    res.status(500).send("Klaida trinant QR kodą");
  }
});

module.exports = router;