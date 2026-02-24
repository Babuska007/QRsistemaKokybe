const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const pool = require('../config/database');

// Login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Įveskite vartotojo vardą ir slaptažodį' });
  }

  try {
    const [users] = await pool.execute(
      'SELECT * FROM admins WHERE username = ? AND is_active = 1',
      [username]
    );

    if (users.length === 0) {
      return res.status(401).json({ success: false, message: 'Neteisingas vartotojo vardas arba slaptažodis' });
    }

    const user = users[0];
    const isValid = await bcrypt.compare(password, user.password_hash);

    if (!isValid) {
      return res.status(401).json({ success: false, message: 'Neteisingas vartotojo vardas arba slaptažodis' });
    }

    // Update last login
    await pool.execute('UPDATE admins SET last_login = NOW() WHERE id = ?', [user.id]);

    // Set session
    req.session.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role
    };

    res.json({ success: true, role: user.role });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Serverio klaida' });
  }
});

// Logout
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Logout failed' });
    }
    res.clearCookie('connect.sid'); // Clear session cookie
    res.json({ success: true });
  });
});

// Check auth status
router.get('/status', (req, res) => {
  if (req.session.user) {
    res.json({ authenticated: true, user: req.session.user });
  } else {
    res.json({ authenticated: false });
  }
});

module.exports = router;