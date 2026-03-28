const dotenv = require('dotenv');
dotenv.config();

/**
 * Cloud Auditor - dijalankan oleh GitHub Actions
 * Validasi secrets DULU sebelum require modul database
 */

const targetUrl = process.env.TARGET_URL;
const testType  = process.env.TEST_TYPE || 'ultimate';

// Validasi semua secrets SEBELUM melakukan apapun
const missingSecrets = [];
if (!process.env.TIDB_HOST)     missingSecrets.push('TIDB_HOST');
if (!process.env.TIDB_USER)     missingSecrets.push('TIDB_USER');
if (!process.env.TIDB_PASSWORD) missingSecrets.push('TIDB_PASSWORD');
if (!process.env.TIDB_DATABASE) missingSecrets.push('TIDB_DATABASE');

if (missingSecrets.length > 0) {
  console.error('');
  console.error('╔══════════════════════════════════════════════════╗');
  console.error('║  ❌ GITHUB SECRETS BELUM DIISI!                  ║');
  console.error('╠══════════════════════════════════════════════════╣');
  console.error('║  Secrets yang kurang:                            ║');
  missingSecrets.forEach(s => console.error(`║    - ${s.padEnd(44)}║`));
  console.error('╠══════════════════════════════════════════════════╣');
  console.error('║  Cara mengisi:                                   ║');
  console.error('║  1. Buka GitHub repo ini                         ║');
  console.error('║  2. Settings > Secrets and variables > Actions   ║');
  console.error('║  3. Tambahkan semua secret di atas               ║');
  console.error('╚══════════════════════════════════════════════════╝');
  console.error('');
  process.exit(1);
}

if (!targetUrl) {
  console.error('❌ TARGET_URL tidak ditemukan dalam payload!');
  process.exit(1);
}

// Baru load modul setelah validasi berhasil
const { runLighthouse } = require('../tests/lighthouse-runner.js');
const mysql = require('mysql2/promise');

async function runCloudAudit() {
  console.log('');
  console.log(`📡 Memulai Remote Audit untuk: ${targetUrl}`);
  console.log(`🧪 Tipe Test: ${testType}`);
  console.log('');

  console.log('🔌 Menghubungkan ke TiDB Cloud...');
  const pool = mysql.createPool({
    host:     process.env.TIDB_HOST,
    port:     parseInt(process.env.TIDB_PORT || '4000'),
    user:     process.env.TIDB_USER,
    password: process.env.TIDB_PASSWORD,
    database: process.env.TIDB_DATABASE,
    ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true },
  });

  // Test koneksi dulu
  try {
    const conn = await pool.getConnection();
    console.log('✅ Koneksi TiDB berhasil!');
    conn.release();
  } catch (dbErr) {
    console.error(`❌ Gagal konek ke TiDB: ${dbErr.message}`);
    console.error('   Pastikan Host/User/Password/Database di Secrets sudah benar.');
    process.exit(1);
  }

  // Buat tabel jika belum ada
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS audit_reports (
        id INT AUTO_INCREMENT PRIMARY KEY,
        target_url VARCHAR(512) NOT NULL,
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
  } catch (err) {
    console.warn('⚠️ Tidak bisa buat tabel (mungkin sudah ada):', err.message);
  }

  try {
    console.log('🚀 Menjalankan Lighthouse Audit...');
    const report = await runLighthouse(targetUrl);

    const scores = report.scores || { performance: 0, accessibility: 0, bestPractices: 0, seo: 0 };
    const findingsCount = report.detailedFindings?.length || 0;

    console.log('');
    console.log('📊 Hasil Audit:');
    console.log(`   Performance : ${scores.performance}`);
    console.log(`   Accessibility: ${scores.accessibility}`);
    console.log(`   Best Practices: ${scores.bestPractices}`);
    console.log(`   SEO          : ${scores.seo}`);
    console.log(`   Temuan       : ${findingsCount} issue`);
    console.log('');

    await pool.query(
      `INSERT INTO audit_reports 
       (target_url, test_type, performance_score, accessibility_score, best_practices_score, seo_score, findings_count, report_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [targetUrl, testType, scores.performance, scores.accessibility, scores.bestPractices, scores.seo, findingsCount, JSON.stringify(report)]
    );

    console.log('✅ AUDIT SELESAI! Data berhasil disimpan ke TiDB Cloud.');
    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error(`❌ Gagal Audit: ${err.message}`);
    console.error(err.stack);
    await pool.end().catch(() => {});
    process.exit(1);
  }
}

runCloudAudit();
