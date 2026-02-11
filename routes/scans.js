const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// QR scan endpoint - shows PIN entry page
router.get('/', async (req, res) => {
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

// Confirm scan with PIN
router.post('/confirm', async (req, res) => {
  const { device_id, pin_code } = req.body;

  if (!device_id || !pin_code) {
    return res.status(400).json({ success: false, message: "Trūksta duomenų" });
  }

  const pinStr = String(pin_code).trim();
  if (!/^\d{4}$/.test(pinStr)) {
    return res.status(400).json({ success: false, message: "Kodas turi būti 4 skaitmenys" });
  }

  try {
    const [userRows] = await pool.execute(
      "SELECT id, first_name, last_name FROM users WHERE pin_code = ? AND is_active = 1",
      [pinStr]
    );

    if (userRows.length === 0) {
      return res.status(400).json({ success: false, message: "Toks kodas neegzistuoja" });
    }

    const user = userRows[0];

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

    if (scan.is_scanned) {
      return res.json({
        success: true,
        message: `Šis įrenginys jau nuskenuotas šiandien. Ačiū, ${user.first_name} ${user.last_name}!`
      });
    }

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

module.exports = router;