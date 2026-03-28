const dotenv = require('dotenv');
dotenv.config();

console.log('');
console.log('=== NusaCyber Cloud Auditor Starting ===');
console.log(`Node: ${process.version}`);
console.log(`Target URL: ${process.env.TARGET_URL || '(NOT SET)'}`);
console.log(`TIDB_HOST set: ${process.env.TIDB_HOST ? 'YES' : 'NO'}`);
console.log(`TIDB_USER set: ${process.env.TIDB_USER ? 'YES' : 'NO'}`);
console.log(`TIDB_DATABASE set: ${process.env.TIDB_DATABASE ? 'YES' : 'NO'}`);
console.log('========================================');
console.log('');

// Validasi semua secrets SEBELUM load modul apapun
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
  missingSecrets.forEach(s => console.error(`║    > KURANG: ${s.padEnd(36)}║`));
  console.error('╠══════════════════════════════════════════════════╣');
  console.error('║  Buka: Settings > Secrets > Actions di GitHub    ║');
  console.error('╚══════════════════════════════════════════════════╝');
  console.error('');
  process.exit(1);
}

const targetUrl = process.env.TARGET_URL;
const testType  = process.env.TEST_TYPE || 'ultimate';

if (!targetUrl) {
  console.error('❌ TARGET_URL tidak ada dalam payload dispatch!');
  process.exit(1);
}

// Load modul setelah validasi
let runLighthouse, mysql;
try {
  ({ runLighthouse } = require('../tests/lighthouse-runner.js'));
  mysql = require('mysql2/promise');
  console.log('✅ Modul berhasil dimuat.');
} catch (loadErr) {
  console.error(`❌ Gagal load modul: ${loadErr.message}`);
  console.error(loadErr.stack);
  process.exit(1);
}

async function runCloudAudit() {
  console.log(`\n📡 Memulai audit untuk: ${targetUrl}`);

  // Koneksi TiDB - coba tanpa SSL dulu, fallback ke SSL
  let pool;
  try {
    pool = mysql.createPool({
      host:     process.env.TIDB_HOST,
      port:     parseInt(process.env.TIDB_PORT || '4000'),
      user:     process.env.TIDB_USER,
      password: process.env.TIDB_PASSWORD,
      database: process.env.TIDB_DATABASE,
      ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: false },
      connectTimeout: 10000,
    });

    const conn = await pool.getConnection();
    console.log('✅ Koneksi TiDB berhasil!');
    conn.release();
  } catch (dbErr) {
    console.error(`❌ Gagal konek TiDB: ${dbErr.message}`);
    console.error('   Periksa nilai TIDB_HOST, TIDB_USER, TIDB_PASSWORD, TIDB_DATABASE');
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
    console.log('✅ Tabel siap.');
  } catch (err) {
    console.warn(`⚠️ Info tabel: ${err.message}`);
  }

  // Jalankan Lighthouse
  try {
    console.log('\n🚀 Menjalankan Lighthouse...');
    const result = await runLighthouse(targetUrl);
    const { scores, metrics, detailedFindings } = result;

    console.log('\n📊 Skor:');
    console.log(`   Performance  : ${scores.performance}`);
    console.log(`   Accessibility: ${scores.accessibility}`);
    console.log(`   Best Practices: ${scores.bestPractices}`);
    console.log(`   SEO          : ${scores.seo}`);
    console.log(`   Temuan       : ${detailedFindings.length} issue`);

    await pool.query(
      `INSERT INTO audit_reports
       (target_url, test_type, performance_score, accessibility_score, best_practices_score, seo_score, findings_count, report_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [targetUrl, testType, scores.performance, scores.accessibility, scores.bestPractices, scores.seo, detailedFindings.length, JSON.stringify({ scores, metrics, detailedFindings })]
    );

    console.log('\n✅ AUDIT SELESAI! Data tersimpan ke TiDB Cloud.');
    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error(`\n❌ Gagal Audit: ${err.message}`);
    console.error(err.stack);
    await pool.end().catch(() => {});
    process.exit(1);
  }
}

runCloudAudit();
