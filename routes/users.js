const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// Get all users
router.get('/', async (req, res) => {
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

// Create new user
router.post('/', async (req, res) => {
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

// Delete user
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.execute("DELETE FROM users WHERE id = ?", [id]);
    res.send("Vartotojas ištrintas");
  } catch (err) {
    console.error(err);
    res.status(500).send("Klaida trinant vartotoją");
  }
});

module.exports = router;