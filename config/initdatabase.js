const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

async function initDatabase() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    multipleStatements: true,
  });

  try {
    const sqlPath = path.join(__dirname, '../sql/init.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    await conn.query(sql);
  } finally {
    await conn.end();
  }
}

module.exports = initDatabase;
