require('dotenv').config({ override: true });
const express = require('express');
const mysql = require('mysql2/promise');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');

const app = express();
const PORT = process.env.APP_PORT || 3000;
const HOST = process.env.APP_HOST || '0.0.0.0';
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL;


app.use(express.json());
app.use(express.static('public')); // serve QR images from /public

// MySQL pool
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});



//
// 📌 QR CODE ENDPOINTS
//

// Bulk create QR codes
app.post('/qrcodes/bulk', async (req, res) => {
  const { count } = req.body;
  if (!count || count <= 0) return res.status(400).send("Invalid count");

  try {
    const qrDir = path.join(__dirname, 'public', 'qr');
    if (!fs.existsSync(qrDir)) fs.mkdirSync(qrDir, { recursive: true });

    const created = [];
    for (let i = 0; i < count; i++) {
      // Generate unique QR code identifier
      const qr_code = `QR_${Date.now()}_${i}`;

      const qrFileName = `${qr_code}.png`;
      const qrFilePath = path.join(qrDir, qrFileName);
      const qrUrl = `${PUBLIC_BASE_URL}/scan?qrId=${qr_code}`;

      await QRCode.toFile(qrFilePath, qrUrl, { color: { dark: "#000", light: "#fff" } });
      const qrImagePath = `/qr/${qrFileName}`;

      await pool.execute(
        "INSERT INTO qrcodes (qr_code, qr_image) VALUES (?, ?)",
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
app.get('/qrcodes', async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT 
        q.qr_id,
        q.qr_code,
        q.qr_image,
        d.id AS device_id,
        d.device_name
      FROM qrcodes q
      LEFT JOIN devices d ON d.qr_id = q.qr_id
      ORDER BY q.qr_id ASC
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching QR codes");
  }
});



// Assign a device name to a QR code
app.post('/qrcodes/:qrId/assign_device', async (req, res) => {
  const { qrId } = req.params;
  const { device_name } = req.body;
  if (!device_name) return res.status(400).send("Missing device_name");

  try {
    // Insert device mapped to existing QR code
    await pool.execute(
      "INSERT INTO devices (device_name, qr_id) VALUES (?, ?)",
      [device_name, qrId]
    );
    res.send(`Device "${device_name}" mapped to QR code successfully`);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error mapping device to QR code");
  }
});

//
// 📌 DEVICE ENDPOINTS
//

// Fetch all devices with QR info
app.get('/devices', async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT d.id, d.device_name, q.qr_code, q.qr_image
      FROM devices d
      LEFT JOIN qrcodes q ON d.qr_id = q.qr_id
      ORDER BY d.id ASC
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching devices");
  }
});

// Delete a device by ID
app.delete('/devices/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.execute("DELETE FROM devices WHERE id = ?", [id]);
    res.send("Device deleted");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error deleting device");
  }
});

//
// 📌 DEVICE RULES ENDPOINTS
//

app.get('/device_rules/:deviceId', async (req, res) => {
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

app.post('/device_rules/:deviceId', async (req, res) => {
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

// Get single device by ID (for rules page)
app.get('/devices/:id', async (req, res) => {
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

//
// 📌 SCAN ENDPOINT
//
//
// 📌 SCAN ENDPOINT – dabar rodo puslapį su kodo įvedimu
//

app.get('/scan', async (req, res) => {
  const qrId = req.query.qrId;
  if (!qrId) return res.status(400).send("Klaida: trūksta qrId parametro");

  try {
    const [qrRows] = await pool.execute(
      "SELECT * FROM qrcodes WHERE qr_code = ?",
      [qrId]
    );
    if (qrRows.length === 0) {
      return res.status(404).send("QR kodas nerastas arba negaliojantis.");
    }

    const qr = qrRows[0];

    const [deviceRows] = await pool.execute(
      "SELECT * FROM devices WHERE qr_id = ?",
      [qr.qr_id]
    );
    if (deviceRows.length === 0) {
      return res.status(404).send("Šiam QR kodui nepriskirtas joks įrenginys.");
    }

    const device = deviceRows[0];

    const [todayRows] = await pool.execute(
      "SELECT scan_id, is_scanned FROM scans WHERE device_id = ? AND DATE(scan_timestamp) = CURDATE() LIMIT 1",
      [device.id]
    );

    if (todayRows.length === 0) {
      return res
        .status(403)
        .send("Šiandien šiam įrenginiui skenavimas nesuplanuotas.");
    }

    // Jei iki čia atėjome – pirminis etapas pavyko.
    // Rodom PIN įvedimo puslapį
    res.send(`
<!DOCTYPE html>
<html lang="lt">
<head>
  <meta charset="UTF-8" />
  <title>QR patvirtinimas</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    body { font-family: Arial; text-align: center; padding: 20px; }
    input {
      font-size: 24px; padding: 10px; width: 140px;
      text-align: center; letter-spacing: 6px;
    }
    button {
      margin-top: 12px; padding: 10px 20px; font-size: 16px;
    }
    #message { margin-top: 15px; font-weight: bold; min-height: 20px; }
    .success { color: #155724; }
    .error { color: #721c24; }
  </style>
</head>
<body>
  <h2>Įrenginys: ${device.device_name}</h2>
  <p>Įveskite savo 4 skaitmenų kodą:</p>

  <input id="pinInput" type="tel" inputmode="numeric" maxlength="4" />

  <br />
  <button onclick="submitCode()">Patvirtinti</button>

  <div id="message"></div>

  <script>
    const deviceId = ${device.id};

    async function submitCode() {
      const pin = document.getElementById('pinInput').value.trim();
      if (!/^\\d{4}$/.test(pin)) {
        showMessage("Kodas turi būti tik 4 skaitmenys", "error");
        return;
      }

      const res = await fetch('/scan/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_id: deviceId, pin_code: pin })
      });

      const data = await res.json();
      if (!data.success) {
        showMessage(data.message, "error");
      } else {
        showMessage(data.message, "success");
      }
    }

    function showMessage(text, type) {
      const el = document.getElementById('message');
      el.textContent = text;
      el.className = type;
    }

    document.getElementById('pinInput').focus();
  </script>
</body>
</html>
    `);

  } catch (err) {
    console.error(err);
    res.status(500).send("Klaida apdorojant QR");
  }
});



app.post('/scan/confirm', async (req, res) => {
  const { device_id, pin_code } = req.body;

  if (!device_id || !pin_code) {
    return res.status(400).json({ success: false, message: "Trūksta duomenų" });
  }

  const pinStr = String(pin_code).trim();
  if (!/^\d{4}$/.test(pinStr)) {
    return res.status(400).json({ success: false, message: "Kodas turi būti 4 skaitmenys" });
  }

  try {
    // 1) Tikriname users lentelėje
    const [userRows] = await pool.execute(
      "SELECT id, first_name, last_name FROM users WHERE pin_code = ? AND is_active = 1",
      [pinStr]
    );

    if (userRows.length === 0) {
      return res.status(400).json({ success: false, message: "Toks kodas neegzistuoja" });
    }

    const user = userRows[0];

    // 2) Tikriname, ar šiandien yra suplanuotas scan šiam įrenginiui
    const [todayRows] = await pool.execute(
      "SELECT scan_id, is_scanned FROM scans WHERE device_id = ? AND DATE(scan_timestamp) = CURDATE() LIMIT 1",
      [device_id]
    );

    if (todayRows.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Šiandien šiam įrenginiui skenavimas nesuplanuotas."
      });
    }

    const scan = todayRows[0];

    // 3) Jei jau nuskenuota – laiko NEkeičiame
    if (scan.is_scanned) {
      return res.json({
        success: true,
        message: `Šis įrenginys jau nuskenuotas šiandien. Ačiū, ${user.first_name} ${user.last_name}!`
      });
    }

    // 4) Pirmas skenavimas šią dieną – pažymim kaip nuskenuotą, nustatom laiką ir naudotoją
    await pool.execute(
      "UPDATE scans SET is_scanned = 1, scan_timestamp = NOW(), user_id = ? WHERE scan_id = ?",
      [user.id, scan.scan_id]
    );

    return res.json({
      success: true,
      message: `Patvirtinta. Ačiū, ${user.first_name} ${user.last_name}!`
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: "Klaida tvirtinant skenavimą"
    });
  }
});


//
// 📌 LOGS ENDPOINT
//

app.get('/logs', async (req, res) => {
  try {
    const { deviceId, from, to, scanned, user } = req.query;

    // Debug – kad matytum, kas ateina iš fronto
    //console.log('LOGS query params:', req.query);

    let sql = `
      SELECT 
        s.scan_id,
        d.device_name,
        s.is_scanned,
        DATE_FORMAT(s.scan_timestamp, '%Y-%m-%d %H:%i:%s') AS scan_timestamp,
        CONCAT(u.first_name, ' ', u.last_name) AS user_name
      FROM scans s
      JOIN devices d ON s.device_id = d.id
      LEFT JOIN users u ON s.user_id = u.id
      WHERE 1=1
    `;

    const params = [];

    // Įrenginys pagal ID (iš <select>, value=device.id)
    if (deviceId) {
      sql += " AND d.id = ?";
      params.push(deviceId);
    }

    // Vartotojas (value="Vardas Pavardė")
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

    //console.log('LOGS SQL:', sql, 'PARAMS:', params);

    const [rows] = await pool.execute(sql, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching logs");
  }
});




app.get('/users', async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT id, first_name, last_name, pin_code, is_active, created_at
      FROM users
      ORDER BY created_at DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching users");
  }
});

app.post('/users', async (req, res) => {
  const { first_name, last_name, pin_code } = req.body;

  if (!first_name || !last_name || !pin_code) {
    return res.status(400).send("Trūksta vardo, pavardės arba kodo");
  }

  const pinStr = String(pin_code);
  if (!/^\d{4}$/.test(pinStr)) {
    return res.status(400).send("Kodas turi būti 4 skaitmenys");
  }

  try {
    await pool.execute(
      "INSERT INTO users (first_name, last_name, pin_code) VALUES (?, ?, ?)",
      [first_name, last_name, pinStr]
    );
    res.status(201).send("Vartotojas sukurtas");
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).send("Toks kodas jau egzistuoja");
    }
    console.error(err);
    res.status(500).send("Klaida kuriant vartotoją");
  }
});

app.delete('/users/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.execute("DELETE FROM users WHERE id = ?", [id]);
    res.send("Vartotojas ištrintas");
  } catch (err) {
    console.error(err);
    res.status(500).send("Klaida trinant vartotoją");
  }
});

app.get('/calendar/month', async (req, res) => {
  let { year, month } = req.query;

  if (!year || !month) {
    return res.status(400).json({ error: "Missing year or month" });
  }

  // užtikrinam, kad skaičiai
  year = parseInt(year, 10);
  month = parseInt(month, 10);

  try {
    const [rows] = await pool.execute(`
      SELECT 
        s.scan_id,
        s.device_id,
        d.device_name,
        s.is_scanned,
        DATE_FORMAT(s.scan_timestamp, '%Y-%m-%d') AS date,             -- 👈 ČIA SVARBIAUSIA
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

    // grupuojam pagal YYYY-MM-DD stringą (sutampa su calendar.html dateKey)
    rows.forEach(r => {
      const key = r.date; // pvz. "2025-12-07"
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(r);
    });

    res.json(grouped);

  } catch (err) {
    console.error("Calendar fetch error:", err);
    res.status(500).json({ error: "Database error" });
  }
});




//
// 📌 SERVER START
//

app.listen(PORT, HOST, () => {
  console.log(`Server running at ${PUBLIC_BASE_URL}`);
});

//
// 📌 CRON JOB - Automatic scan creation for next day
//

cron.schedule('56 16 * * *', async () => {
  try {
    const conn = await pool.getConnection();

    const [result] = await conn.execute(`
      INSERT IGNORE INTO scans (device_id, scan_timestamp, is_scanned)
      SELECT 
        dr.device_id,
        DATE_ADD(CURDATE(), INTERVAL 1 DAY) AS scan_timestamp,
        0 AS is_scanned
      FROM device_rules dr
      WHERE LOWER(dr.rule_day) = LOWER(DAYNAME(DATE_ADD(CURDATE(), INTERVAL 1 DAY)))
    `);

    // mysql2 grąžina 'affectedRows' (kiek eilučių realiai įdėta/neignoruota)
    console.log(
      `Created ${result.affectedRows} automatic scans for next day at`,
      new Date()
    );

    conn.release();
  } catch (err) {
    console.error("Error creating automatic scans:", err);
  }
}, { timezone: "Europe/Vilnius" });

