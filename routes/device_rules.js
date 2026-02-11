const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// Get rules for a device
router.get('/:deviceId', async (req, res) => {
  const { deviceId } = req.params;
  try {
    const [rows] = await pool.execute(
      `SELECT 
         rule_id,
         device_id,
         recurrence_type,
         daily_interval,
         weekly_days,
         monthly_day,
         yearly_date,
         DATE_FORMAT(start_date, '%Y-%m-%d') AS start_date,
         DATE_FORMAT(end_date, '%Y-%m-%d') AS end_date,
         created_at
       FROM device_rules
       WHERE device_id = ?
       ORDER BY rule_id DESC`,
      [deviceId]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching device rules");
  }
});


// Save/Update rules for a device
router.post('/:deviceId', async (req, res) => {
  const { deviceId } = req.params;
  const {
    rule_id,
    recurrence_type,
    daily_interval,
    weekly_days,
    monthly_day,
    yearly_date,
    start_date,
    end_date
  } = req.body;

  try {
    if (rule_id) {
      // ✅ UPDATE: nekeičia rule_id
      const [result] = await pool.execute(
        `UPDATE device_rules
         SET recurrence_type = ?,
             daily_interval = ?,
             weekly_days = ?,
             monthly_day = ?,
             yearly_date = ?,
             start_date = ?,
             end_date = ?
         WHERE rule_id = ? AND device_id = ?`,
        [
          recurrence_type,
          daily_interval || null,
          weekly_days || null,
          monthly_day || null,
          yearly_date || null,
          start_date,
          end_date || null,
          rule_id,
          deviceId
        ]
      );

      if (result.affectedRows === 0) {
        return res.status(404).send("Rule not found for this device");
      }

      return res.send("Rules updated successfully");
    }

    // Jei rule_id nepaduotas (pvz. pirmas kartas) – sukuriam naują
    const [insert] = await pool.execute(
      `INSERT INTO device_rules
       (device_id, recurrence_type, daily_interval, weekly_days, monthly_day, yearly_date, start_date, end_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        deviceId,
        recurrence_type,
        daily_interval || null,
        weekly_days || null,
        monthly_day || null,
        yearly_date || null,
        start_date,
        end_date || null
      ]
    );

    res.json({ message: "Rules saved successfully", rule_id: insert.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error saving device rules");
  }
});


// Delete all rules for a device
// Delete one rule by rule_id (NOT device_id)
router.delete('/rule/:ruleId', async (req, res) => {
  const { ruleId } = req.params;

  try {
    const [result] = await pool.execute(
      "DELETE FROM device_rules WHERE rule_id = ?",
      [ruleId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).send("Rule not found");
    }

    res.send("Rule deleted");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error deleting rule");
  }
});



module.exports = router;