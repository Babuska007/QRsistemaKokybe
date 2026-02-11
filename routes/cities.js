const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// Get all cities
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id, code, name FROM cities ORDER BY id ASC'
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching cities");
  }
});

module.exports = router;