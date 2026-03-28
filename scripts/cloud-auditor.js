const { runLighthouse } = require('../tests/lighthouse-runner.js');
const { pool } = require('../db/connection.js');
const dotenv = require('dotenv');
dotenv.config();

/**
 * Script untuk dijalankan oleh GitHub Actions
 * Parameter: TARGET_URL, TEST_TYPE
 */

const targetUrl = process.argv[2] || process.env.TARGET_URL;
const testType = process.argv[3] || 'ultimate';

async function runCloudAudit() {
  console.log(`📡 Memulai Remote Audit untuk: ${targetUrl}`);
  
  try {
    // 1. Jalankan Lighthouse
    const report = await runLighthouse(targetUrl);
    
    // 2. Simpan ke TiDB Cloud
    const lh = report.lighthouse;
    const scores = lh ? lh.scores : { performance: 0, accessibility: 0, bestPractices: 0, seo: 0 };
    const findingsCount = (lh?.detailedFindings?.length || 0);

    const query = `
      INSERT INTO audit_reports 
      (target_url, test_type, performance_score, accessibility_score, best_practices_score, seo_score, findings_count, report_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const values = [
      targetUrl, 
      testType, 
      scores.performance, 
      scores.accessibility, 
      scores.bestPractices, 
      scores.seo, 
      findingsCount, 
      JSON.stringify(report)
    ];

    await pool.query(query, values);
    console.log(`✅ Audit Selesai! Data tersingkron ke TiDB Cloud.`);
    process.exit(0);
  } catch (err) {
    console.error(`❌ Gagal Audit: ${err.message}`);
    process.exit(1);
  }
}

if (!targetUrl) {
  console.error("❌ TARGET_URL tidak ditemukan!");
  process.exit(1);
}

runCloudAudit();
