const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// Get all system groups (optionally filter by city)
router.get('/', async (req, res) => {
  try {
    const { cityId } = req.query;
    let sql = `
      SELECT 
        sg.id,
        sg.city_id,
        sg.group_name,
        sg.description,
        sg.created_at,
        c.name AS city_name,
        c.code AS city_code,
        COUNT(DISTINCT q.qr_id) AS qr_count,
        COUNT(DISTINCT d.id) AS device_count
      FROM system_groups sg
      LEFT JOIN cities c ON sg.city_id = c.id
      LEFT JOIN qrcodes q ON q.system_group_id = sg.id
      LEFT JOIN devices d ON d.system_group_id = sg.id
    `;
    
    const params = [];
    if (cityId) {
      sql += " WHERE sg.city_id = ?";
      params.push(cityId);
    }
    
    sql += " GROUP BY sg.id ORDER BY c.name, sg.group_name";
    
    const [rows] = await pool.execute(sql, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching system groups");
  }
});

// Create a new system group
router.post('/', async (req, res) => {
  const { city_id, group_name, description } = req.body;
  
  if (!city_id || !group_name) {
    return res.status(400).send("Missing city_id or group_name");
  }
  
  try {
    const [result] = await pool.execute(
      "INSERT INTO system_groups (city_id, group_name, description) VALUES (?, ?, ?)",
      [city_id, group_name, description || null]
    );
    
    res.status(201).json({ 
      id: result.insertId, 
      message: "System group created successfully" 
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).send("Group with this name already exists in this city");
    }
    console.error(err);
    res.status(500).send("Error creating system group");
  }
});

// Update a system group
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { group_name, description } = req.body;
  
  if (!group_name) {
    return res.status(400).send("Missing group_name");
  }
  
  try {
    await pool.execute(
      "UPDATE system_groups SET group_name = ?, description = ? WHERE id = ?",
      [group_name, description || null, id]
    );
    res.send("System group updated successfully");
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).send("Group with this name already exists in this city");
    }
    console.error(err);
    res.status(500).send("Error updating system group");
  }
});

// Delete a system group
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  
  try {
    await pool.execute("UPDATE qrcodes SET system_group_id = NULL WHERE system_group_id = ?", [id]);
    await pool.execute("UPDATE devices SET system_group_id = NULL WHERE system_group_id = ?", [id]);
    await pool.execute("DELETE FROM system_groups WHERE id = ?", [id]);
    res.send("System group deleted successfully");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error deleting system group");
  }
});

// Assign QR codes to a system group
router.post('/:id/assign_qrcodes', async (req, res) => {
  const { id } = req.params;
  const { qr_ids } = req.body;
  
  if (!Array.isArray(qr_ids) || qr_ids.length === 0) {
    return res.status(400).send("Invalid qr_ids array");
  }
  
  try {
    const placeholders = qr_ids.map(() => '?').join(',');
    await pool.execute(
      `UPDATE qrcodes SET system_group_id = ? WHERE qr_id IN (${placeholders})`,
      [id, ...qr_ids]
    );
    
    await pool.execute(
      `UPDATE devices SET system_group_id = ? WHERE qr_id IN (${placeholders})`,
      [id, ...qr_ids]
    );
    
    res.send(`${qr_ids.length} QR codes assigned to group`);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error assigning QR codes to group");
  }
});

// Unassign QR codes from a system group
router.post('/:id/unassign_qrcodes', async (req, res) => {
  const { id } = req.params;
  const { qr_ids } = req.body;
  
  if (!Array.isArray(qr_ids) || qr_ids.length === 0) {
    return res.status(400).send("Invalid qr_ids array");
  }
  
  try {
    const placeholders = qr_ids.map(() => '?').join(',');
    await pool.execute(
      `UPDATE qrcodes SET system_group_id = NULL WHERE qr_id IN (${placeholders}) AND system_group_id = ?`,
      [...qr_ids, id]
    );
    
    await pool.execute(
      `UPDATE devices SET system_group_id = NULL WHERE qr_id IN (${placeholders}) AND system_group_id = ?`,
      [...qr_ids, id]
    );
    
    res.send(`${qr_ids.length} QR codes unassigned from group`);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error unassigning QR codes from group");
  }
});

// Get QR codes for a specific group
router.get('/:id/qrcodes', async (req, res) => {
  const { id } = req.params;
  
  try {
    const [rows] = await pool.execute(`
      SELECT 
        q.qr_id,
        q.qr_code,
        q.qr_image,
        q.city_id,
        q.system_group_id,
        d.id AS device_id,
        d.device_name
      FROM qrcodes q
      LEFT JOIN devices d ON d.qr_id = q.qr_id
      WHERE q.system_group_id = ?
      ORDER BY q.qr_id ASC
    `, [id]);
    
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching QR codes for group");
  }
});

module.exports = router;