const cron = require('node-cron');
const pool = require('../config/database');
const { addDays, addWeeks, addMonths, addYears, format, parseISO, getDay } = require('date-fns');

cron.schedule('59 23 * * *', async () => {
  try {
    const conn = await pool.getConnection();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = format(tomorrow, 'yyyy-MM-dd');
    
    // Get all active rules
    const [rules] = await conn.execute(`
      SELECT dr.*, d.id as device_id
      FROM device_rules dr
      JOIN devices d ON dr.device_id = d.id
      WHERE dr.start_date <= ? 
        AND (dr.end_date IS NULL OR dr.end_date >= ?)
    `, [tomorrowStr, tomorrowStr]);
    
    let createdCount = 0;
    
    for (const rule of rules) {
      let shouldCreateScan = false;
      
      if (rule.recurrence_type === 'daily') {
        // MySQL DATE gali būti Date objektas, todėl parseISO nenaudojam
        const start = rule.start_date instanceof Date ? rule.start_date : parseISO(String(rule.start_date).slice(0, 10));
      
        // normalizuojam į "vidurnaktį", kad nebūtų timezone/valandų šokinėjimo automatiškai pildant taisyklių laukelius
        const startMid = new Date(start.getFullYear(), start.getMonth(), start.getDate());
        const tomorrowMid = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate());
      
        const diffDays = Math.floor((tomorrowMid - startMid) / (1000 * 60 * 60 * 24));
        const interval = Number(rule.daily_interval) || 1;
      
        shouldCreateScan = diffDays >= 0 && diffDays % interval === 0;
      } else if (rule.recurrence_type === 'weekly') {
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const tomorrowDayName = dayNames[getDay(tomorrow)];
        const allowedDays = rule.weekly_days.split(',').map(d => d.trim());
        shouldCreateScan = allowedDays.includes(tomorrowDayName);
        
      } else if (rule.recurrence_type === 'monthly') {
        shouldCreateScan = tomorrow.getDate() === rule.monthly_day;
        
      } else if (rule.recurrence_type === 'yearly') {
        const [month, day] = rule.yearly_date.split('-').map(Number);
        shouldCreateScan = tomorrow.getMonth() + 1 === month && tomorrow.getDate() === day;
      }
      
      if (shouldCreateScan) {
        await conn.execute(`
          INSERT IGNORE INTO scans (device_id, scan_timestamp, is_scanned)
          VALUES (?, ?, 0)
        `, [rule.device_id, tomorrowStr]);
        createdCount++;
      }
    }
    
    console.log(`Created ${createdCount} automatic scans for ${tomorrowStr}`);
    conn.release();
  } catch (err) {
    console.error("Error creating automatic scans:", err);
  }
}, { timezone: "Europe/Vilnius" });