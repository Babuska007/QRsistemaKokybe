const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const pool = require('../config/database');

// Get all admins (superadmin only)
router.get('/users', async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT id, username, email, role, is_active, 
             DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
             DATE_FORMAT(last_login, '%Y-%m-%d %H:%i:%s') AS last_login
      FROM admins
      ORDER BY created_at DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching users");
  }
});

// Create new admin user (superadmin only)
router.post('/users', async (req, res) => {
  const { username, email, password, role } = req.body;

  if (!username || !email || !password || !role) {
    return res.status(400).send("Užpildykite visus laukus");
  }

  if (!['user', 'admin', 'superadmin'].includes(role)) {
    return res.status(400).send("Neteisinga rolė");
  }

  if (password.length < 6) {
    return res.status(400).send("Slaptažodis turi būti bent 6 simbolių");
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);

    await pool.execute(
      'INSERT INTO admins (username, email, password_hash, role) VALUES (?, ?, ?, ?)',
      [username, email, passwordHash, role]
    );

    res.status(201).send("Vartotojas sukurtas");
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).send("Toks vartotojo vardas arba el. paštas jau egzistuoja");
    }
    console.error(err);
    res.status(500).send("Klaida kuriant vartotoją");
  }
});

// Reset password (superadmin only)
router.post('/users/:id/reset-password', async (req, res) => {
  const { id } = req.params;
  const { newPassword } = req.body;


  if (!newPassword || newPassword.length < 6) {
    console.log('Validation failed');
    return res.status(400).send("Slaptažodis turi būti bent 6 simbolių");
  }

  try {
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await pool.execute(
      'UPDATE admins SET password_hash = ? WHERE id = ?',
      [passwordHash, id]
    );
    res.send("Slaptažodis pakeistas");
  } catch (err) {
    console.error(err);
    res.status(500).send("Klaida keičiant slaptažodį");
  }
});

// Toggle user active status (superadmin only)
router.post('/users/:id/toggle-status', async (req, res) => {
  const { id } = req.params;

  try {
    await pool.execute(
      'UPDATE admins SET is_active = NOT is_active WHERE id = ?',
      [id]
    );

    res.send("Vartotojo statusas pakeistas");
  } catch (err) {
    console.error(err);
    res.status(500).send("Klaida keičiant statusą");
  }
});

// Delete user (superadmin only)
router.delete('/users/:id', async (req, res) => {
  const { id } = req.params;

  // Prevent deleting yourself
  if (req.session.user.id === parseInt(id)) {
    return res.status(400).send("Negalite ištrinti savęs");
  }

  try {
    await pool.execute('DELETE FROM admins WHERE id = ?', [id]);
    res.send("Vartotojas ištrintas");
  } catch (err) {
    console.error(err);
    res.status(500).send("Klaida trinant vartotoją");
  }
});

module.exports = router;