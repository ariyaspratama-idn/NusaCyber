const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.TIDB_HOST || 'localhost',
  port: process.env.TIDB_PORT || 4000,
  user: process.env.TIDB_USER || 'root',
  password: process.env.TIDB_PASSWORD || '',
  database: process.env.TIDB_DATABASE || 'nusacyber',
  ssl: {
    minVersion: 'TLSv1.2',
    rejectUnauthorized: true,
  },
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

async function initDb() {
  const config = {
    host: process.env.TIDB_HOST || 'localhost',
    port: process.env.TIDB_PORT || 4000,
    user: process.env.TIDB_USER || 'root',
    password: process.env.TIDB_PASSWORD || '',
    ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true }
  };

  try {
    const tempConn = await mysql.createConnection(config);
    await tempConn.query(`CREATE DATABASE IF NOT EXISTS \`${process.env.TIDB_DATABASE || 'nusacyber'}\``);
    await tempConn.end();

    const connection = await pool.getConnection();
    await connection.query(`USE \`${process.env.TIDB_DATABASE || 'nusacyber'}\``);
    await connection.query(`
      CREATE TABLE IF NOT EXISTS audit_reports (
        id INT AUTO_INCREMENT PRIMARY KEY,
        target_url VARCHAR(255) NOT NULL,
        test_type VARCHAR(50),
        performance_score INT,
        accessibility_score INT,
        best_practices_score INT,
        seo_score INT,
        findings_count INT,
        report_json LONGTEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Database NusaCyber Siap Antar-Perangkat.');
    connection.release();
  } catch (err) {
    console.error('❌ Gagal Inisialisasi Database:', err.message);
  }
}

module.exports = { pool, initDb };
