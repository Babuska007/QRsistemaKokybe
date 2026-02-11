const express = require('express');
const router = express.Router();
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');
const pool = require('../config/database');

const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL;

// Bulk create QR codes
router.post('/bulk', async (req, res) => {
  const { count } = req.body;
  if (!count || count <= 0) return res.status(400).send("Invalid count");

  try {
    const qrDir = path.join(__dirname, '..', 'public', 'qr');
    if (!fs.existsSync(qrDir)) fs.mkdirSync(qrDir, { recursive: true });

    const created = [];
    for (let i = 0; i < count; i++) {
      const qr_code = `QR_${Date.now()}_${i}`;
      const qrFileName = `${qr_code}.png`;
      const qrFilePath = path.join(qrDir, qrFileName);
      const qrUrl = `${PUBLIC_BASE_URL}/scan?qrId=${qr_code}`;

      await QRCode.toFile(qrFilePath, qrUrl, { color: { dark: "#000", light: "#fff" } });
      const qrImagePath = `/qr/${qrFileName}`;

      await pool.execute(
        'INSERT INTO qrcodes (qr_code, qr_image) VALUES (?, ?)',
        [qr_code, qrImagePath]
      );

      created.push({ qr_code, qr_image: qrImagePath });
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
        q.qr_image,
        q.city_id,
        q.system_group_id,
        c.name AS city_name,
        c.code AS city_code,
        sg.group_name AS system_group_name,
        d.id AS device_id,
        d.device_name
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

// Assign a device name to a QR code
router.post('/:qrId/assign_device', async (req, res) => {
  const { qrId } = req.params;
  const { device_name, city_id } = req.body;
  if (!device_name) return res.status(400).send("Missing device_name");
  if (!city_id) return res.status(400).send("Missing city_id");

  try {
    await pool.execute(
      "UPDATE qrcodes SET city_id = ? WHERE qr_id = ?",
      [city_id, qrId]
    );
    
    await pool.execute(
      "INSERT INTO devices (device_name, qr_id, city_id) VALUES (?, ?, ?)",
      [device_name, qrId, city_id]
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
    await pool.execute(
      "UPDATE qrcodes SET city_id = ? WHERE qr_id = ?",
      [city_id, qrId]
    );
    
    await pool.execute(
      "UPDATE devices SET city_id = ? WHERE qr_id = ?",
      [city_id, qrId]
    );
    
    res.send("City updated successfully");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error updating city");
  }
});

module.exports = router;