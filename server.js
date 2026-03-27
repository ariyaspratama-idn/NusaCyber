const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const http = require('http');
const https = require('https');
const util = require('util');
const { runLighthouse } = require('./tests/lighthouse-runner.js');

const execPromise = util.promisify(exec);
const app = express();
app.use(cors());
app.use(express.json());

const SEV_ICON = { critical: '🔴 KRITIS', error: '🟠 ERROR', warning: '🟡 PERINGATAN' };

// ── Built-in Node.js Load Simulator (Fallback kalau k6 tidak ada) ─────────────
async function runNodeLoadTest(targetUrl, log) {
  const VUS = 20;         // Simulasi 20 pengguna paralel
  const DURATION_MS = 20000; // 20 detik
  const SPIKE_VUS = 80;   // 80 pengguna saat spike

  const results = {
    totalReqs: 0, successReqs: 0, failedReqs: 0,
    durations: [], errors: [], checksPass: 0, checksFail: 0,
  };

  const parsedUrl = new URL(targetUrl);
  const client = parsedUrl.protocol === 'https:' ? https : http;

  const makeRequest = (path = '/', headers = {}) => new Promise(resolve => {
    const start = Date.now();
    const opts = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path,
      method: 'GET',
      headers: { 'User-Agent': 'NusaCyber-Stress/3.2', ...headers },
      timeout: 5000,
    };
    const req = client.request(opts, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => resolve({ status: res.statusCode, duration: Date.now() - start, body }));
    });
    req.on('error', e => resolve({ status: 0, duration: Date.now() - start, error: e.message }));
    req.on('timeout', () => { req.destroy(); resolve({ status: 0, duration: Date.now() - start, error: 'timeout' }); });
    req.end();
  });

  const runVU = async (variant = 'normal') => {
    const res = await makeRequest(parsedUrl.pathname || '/');
    results.totalReqs++;
    if (res.status >= 200 && res.status < 500) {
      results.successReqs++; results.durations.push(res.duration);
      results.checksPass++;
    } else {
      results.failedReqs++;
      if (res.error) results.errors.push(res.error);
      results.checksFail++;
    }
  };

  // Phase 1: Normal Load (20 VUs for 10s)
  log(`  Fase 1/2 — Normal Load: ${VUS} pengguna selama 10 detik...`);
  const phase1Start = Date.now();
  while (Date.now() - phase1Start < 10000) {
    await Promise.all(Array.from({ length: VUS }, () => runVU('normal')));
    await new Promise(r => setTimeout(r, 200));
  }

  // Phase 2: Spike (80 VUs for 5s)
  log(`  Fase 2/2 — Spike: ${SPIKE_VUS} pengguna mendadak selama 5 detik...`);
  const phase2Start = Date.now();
  while (Date.now() - phase2Start < 5000) {
    await Promise.all(Array.from({ length: SPIKE_VUS }, () => runVU('spike')));
    await new Promise(r => setTimeout(r, 100));
  }

  // Compute stats
  const sorted = [...results.durations].sort((a, b) => a - b);
  const avg  = sorted.length > 0 ? sorted.reduce((a, b) => a + b, 0) / sorted.length : 0;
  const p95  = sorted[Math.floor(sorted.length * 0.95)] || 0;
  const p99  = sorted[Math.floor(sorted.length * 0.99)] || 0;
  const errRate = results.totalReqs > 0 ? (results.failedReqs / results.totalReqs * 100) : 0;
  const duration = (10 + 5);
  const rps = (results.totalReqs / duration).toFixed(2);

  return {
    totalReqs: results.totalReqs,
    successReqs: results.successReqs,
    failedReqs: results.failedReqs,
    errRate: errRate.toFixed(2),
    avgMs: avg.toFixed(0),
    p95Ms: p95,
    p99Ms: p99,
    rps,
    errorsExample: [...new Set(results.errors)].slice(0, 3),
    passed: errRate < 10 && p95 < 3000,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/run-test', async (req, res) => {
  const { targetUrl, testType } = req.body;
  let output = '';
  const log = (...args) => { output += args.join(' ') + '\n'; };

  log(`════════════════════════════════════════`);
  log(`  NUSA CYBER ULTIMATE v3.2 — DEEP AUDIT`);
  log(`════════════════════════════════════════`);
  log(`Target   : ${targetUrl}`);
  log(`Tipe     : ${testType.toUpperCase()}`);
  log(`Waktu    : ${new Date().toLocaleString('id-ID')}`);
  log(`════════════════════════════════════════\n`);

  let finalReport = {
    lighthouse: null,
    playwright: { passed: 0, failures: [] },
    k6: { stats: {}, failures: [] }
  };

  try {

    // ─── 1. LIGHTHOUSE ───────────────────────────────────────────────────────
    if (testType === 'ultimate' || testType === 'mega') {
      log(`┌─────────────────────────────────────┐`);
      log(`│ [1/3] GOOGLE LIGHTHOUSE ANALYSIS    │`);
      log(`└─────────────────────────────────────┘`);
      try {
        const lh = await runLighthouse(targetUrl);
        finalReport.lighthouse = lh;
        const s = lh.scores, m = lh.metrics;

        log(`\n  📊 SKOR KATEGORI:`);
        log(`  ┌──────────────────────────────────┐`);
        log(`  │ Performance   : ${String(s.performance).padEnd(3)} /100  ${s.performance>=90?'✅ BAIK':s.performance>=50?'⚠️ CUKUP':'❌ BURUK'}`);
        log(`  │ Accessibility : ${String(s.accessibility).padEnd(3)} /100  ${s.accessibility>=90?'✅ BAIK':s.accessibility>=50?'⚠️ CUKUP':'❌ BURUK'}`);
        log(`  │ Best Practices: ${String(s.bestPractices).padEnd(3)} /100  ${s.bestPractices>=90?'✅ BAIK':s.bestPractices>=50?'⚠️ CUKUP':'❌ BURUK'}`);
        log(`  │ SEO           : ${String(s.seo).padEnd(3)} /100  ${s.seo>=90?'✅ BAIK':s.seo>=50?'⚠️ CUKUP':'❌ BURUK'}`);
        log(`  └──────────────────────────────────┘`);

        log(`\n  ⚡ CORE WEB VITALS:`);
        log(`  ┌──────────────────────────────────┐`);
        log(`  │ LCP (Load Speed)  : ${(m.lcp||'N/A').padEnd(8)} ${parseFloat(m.lcp)<=2.5?'✅ OPTIMAL':'❌ LAMBAT   ideal <2.5s'}`);
        log(`  │ CLS (Layout Shift): ${(m.cls||'N/A').padEnd(8)} ${parseFloat(m.cls)<=0.1?'✅ STABIL':'⚠️ GESER   ideal <0.1'}`);
        log(`  │ TBT (Input Delay) : ${(m.tbt||'N/A').padEnd(8)} ${parseFloat(m.tbt)<=200?'✅ CEPAT':'❌ LAMBAT   ideal <200ms'}`);
        log(`  │ FID (Responsive)  : ${(m.fid||'N/A').padEnd(8)}`);
        log(`  │ FCP (First Paint) : ${(m.fcp||'N/A').padEnd(8)}`);
        log(`  │ Speed Index       : ${(m.si||'N/A').padEnd(8)}`);
        log(`  │ Time to Interact  : ${(m.tti||'N/A').padEnd(8)}`);
        log(`  └──────────────────────────────────┘`);

        log(`\n  🔍 DETAIL TEMUAN (${lh.detailedFindings.length} masalah):\n`);
        lh.detailedFindings.forEach((f, i) => {
          log(`  ──────────────────────────────────`);
          log(`  #${String(i+1).padStart(2,'0')} ${SEV_ICON[f.severity]||'⚠️'} [${f.category}]`);
          log(`  Nama    : ${f.name}`);
          if (f.displayValue) log(`  Nilai   : ${f.displayValue}`);
          log(`  Masalah : ${f.description?.slice(0,150)}`);
          if (f.affectedItems?.length) {
            log(`  Terdampak:`);
            f.affectedItems.forEach(item => log(`    → ${item.slice(0,120)}`));
          }
          log(`  Solusi  : ${f.suggestion?.slice(0,180)}`);
        });
        log(`\n✅ Lighthouse Analysis SELESAI.\n`);
      } catch (e) {
        log(`⚠️  Lighthouse Warning: ${e.message}\n`);
      }
    }

    // ─── 2. PLAYWRIGHT / AXE-CORE ────────────────────────────────────────────
    if (testType === 'ultimate' || testType === 'mega' || testType === 'deep') {
      log(`┌─────────────────────────────────────┐`);
      log(`│ [2/3] PLAYWRIGHT & AXE-CORE SCAN    │`);
      log(`└─────────────────────────────────────┘`);
      try {
        const { stdout } = await execPromise(
          `npx playwright test tests/siksaan-fungsional.spec.js --reporter=json`,
          { env: { ...process.env, TARGET_URL: targetUrl }, timeout: 120000 }
        );
        const pwResults = JSON.parse(stdout);
        pwResults.suites?.forEach(suite => {
          suite.specs?.forEach(spec => {
            spec.tests?.forEach(test => {
              if (test.status === 'expected') {
                finalReport.playwright.passed++;
                log(`  ✅ LULUS : ${spec.title}`);
              } else {
                const err = test.results?.[0]?.error?.message || 'Anomali.';
                log(`  ❌ GAGAL : ${spec.title}`);
                log(`     Error : ${err.split('\n')[0].slice(0,150)}`);
                finalReport.playwright.failures.push({
                  name: spec.title, error: err.split('\n')[0].slice(0,200),
                  suggestion: 'Periksa integritas DOM dan aksesibilitas elemen interaktif.',
                });
              }
            });
          });
        });
        log(`\n  Ringkasan: ${finalReport.playwright.passed} Lulus | ${finalReport.playwright.failures.length} Gagal`);
        log(`✅ Playwright Scan SELESAI.\n`);
      } catch (e) {
        if (e.stdout) {
          try {
            const pwResults = JSON.parse(e.stdout);
            pwResults.suites?.forEach(suite => {
              suite.specs?.forEach(spec => {
                spec.tests?.forEach(test => {
                  if (test.status !== 'expected') {
                    const err = test.results?.[0]?.error?.message || 'Anomali.';
                    finalReport.playwright.failures.push({
                      name: spec.title, error: err.split('\n')[0].slice(0,200),
                      suggestion: 'Periksa integritas DOM dan aksesibilitas elemen.',
                    });
                  } else finalReport.playwright.passed++;
                });
              });
            });
          } catch(_) {}
          log(`  Selesai dengan ${finalReport.playwright.failures.length} isu.\n`);
        } else {
          log(`⚠️  Playwright: ${e.message?.slice(0,100)}\n`);
        }
      }
    }

    // ─── 3. LOAD TEST (k6 atau fallback Node.js) ──────────────────────────────
    if (testType === 'ultimate' || testType === 'beban') {
      log(`┌─────────────────────────────────────┐`);
      log(`│ [3/3] LOAD & STRESS SIMULATION      │`);
      log(`└─────────────────────────────────────┘`);

      // Gunakan Node.js Load Simulator (universal, tidak perlu k6 terinstall)
      log(`  ℹ️  Menggunakan Node.js Built-in Load Simulator (Universal)\n`);
      {
        // ── Built-in fallback ──
        try {
          const stats = await runNodeLoadTest(targetUrl, log);
          finalReport.k6.stats = stats;

          log(`\n  📈 HASIL UJI BEBAN (Node.js Simulator):`);
          log(`  ┌──────────────────────────────────┐`);
          log(`  │ Total Request   : ${stats.totalReqs}`);
          log(`  │ Request/detik   : ${stats.rps}/s`);
          log(`  │ Berhasil        : ${stats.successReqs}  (${(stats.successReqs/Math.max(stats.totalReqs,1)*100).toFixed(1)}%)`);
          log(`  │ Gagal           : ${stats.failedReqs}   (${stats.errRate}%)`);
          log(`  │ Avg Resp Time   : ${stats.avgMs} ms`);
          log(`  │ P95 Resp Time   : ${stats.p95Ms} ms  ${stats.p95Ms<3000?'✅ LULUS':'❌ LAMBAT'}`);
          log(`  │ P99 Resp Time   : ${stats.p99Ms} ms`);
          log(`  │ Error Rate      : ${stats.errRate}%  ${parseFloat(stats.errRate)<10?'✅ LULUS':'❌ TINGGI'}`);
          log(`  └──────────────────────────────────┘`);

          if (!stats.passed) {
            const reasons = [];
            if (stats.p95Ms >= 3000) reasons.push(`Resp time P95 ${stats.p95Ms}ms (maks 3000ms)`);
            if (parseFloat(stats.errRate) >= 10) reasons.push(`Error rate ${stats.errRate}% (maks 10%)`);
            finalReport.k6.failures.push({
              name: 'Load Test — Performa Server Tidak Memadai',
              error: reasons.join(' | '),
              suggestion: 'Tambahkan caching (Redis/Memcached), optimalkan query database dengan indexing, aktifkan kompresi Gzip/Brotli, dan pertimbangkan load balancer.',
            });
            log(`\n⚠️  Load Test: Server perlu optimasi.`);
          } else {
            log(`\n✅ Load Test LULUS — Server tahan beban.`);
          }
        } catch (e) {
          log(`⚠️  Load Test Error: ${e.message}\n`);
        }
      }
    }

    log(`\n════════════════════════════════════════`);
    log(`  🎯 AUDIT SELESAI — Lihat Tab LAPORAN`);
    log(`════════════════════════════════════════`);

    res.json({ output, report: finalReport });
  } catch (error) {
    res.status(500).json({ error: error.message, output: output + `\n❌ FATAL: ${error.message}` });
  }
});

// ─── AUTO-FIX ENGINE ─────────────────────────────────────────────────────────
const fs = require('fs/promises');
const path = require('path');

app.post('/api/auto-fix', async (req, res) => {
  const { targetUrl, finding } = req.body;
  
  if (!finding || !targetUrl) {
    return res.status(400).json({ success: false, message: 'Data temuan atau target URL tidak valid.' });
  }

  // 1. Tentukan Root path dari targetUrl (Asumsi development di folder paralel)
  // Ini adalah simulasi sederhana. Di dunia nyata, agen harus tau workspace user.
  // Karena kita tau project kita di 'c:\Users\Admin\.gemini\antigravity\scratch\qa-testing-hub'
  const projectRoot = 'c:\\Users\\Admin\\.gemini\\antigravity\\scratch\\qa-testing-hub\\dashboard';

  try {
    let fixedAny = false;
    let fixLog = '';

    // ─── Fix 1: Contrast Ratio (A11y) ─────────────────────────────────────────
    if (finding.name.includes('contrast ratio')) {
      const appJsxPath = path.join(projectRoot, 'src', 'App.jsx');
      try {
        let content = await fs.readFile(appJsxPath, 'utf-8');
        // Ganti warna teks yang bermasalah (contoh: text-cyan-950 -> text-cyan-500)
        if (content.includes('text-cyan-950')) {
          content = content.replace(/text-cyan-950/g, 'text-cyan-400');
          fixedAny = true;
          fixLog += 'Berhasil memperbaiki kontras warna di App.jsx (cyan-950 -> cyan-400).\n';
        }
        if (content.includes('text-gray-600') && content.includes('bg-[#0c1427]')) {
           content = content.replace(/text-gray-600/g, 'text-gray-400');
           fixedAny = true;
           fixLog += 'Berhasil memperbaiki kontras warna abu-abu di App.jsx.\n';
        }
        if (fixedAny) await fs.writeFile(appJsxPath, content, 'utf-8');
      } catch (err) {
         fixLog += `Gagal membaca/menulis App.jsx: ${err.message}\n`;
      }
    }

    // ─── Fix 2: HTML Lang Attribute ───────────────────────────────────────────
    if (finding.name.includes('<html> element does not have a [lang] attribute')) {
      const indexHtmlPath = path.join(projectRoot, 'index.html');
      try {
        let content = await fs.readFile(indexHtmlPath, 'utf-8');
        if (content.includes('<html>') && !content.includes('<html lang=')) {
          content = content.replace('<html>', '<html lang="id">');
          await fs.writeFile(indexHtmlPath, content, 'utf-8');
          fixedAny = true;
          fixLog += 'Berhasil menambahkan atribut lang="id" pada index.html.\n';
        }
      } catch (err) {
         fixLog += `Gagal mengedit index.html: ${err.message}\n`;
      }
    }

    // ─── Fix 3: Main Landmark ─────────────────────────────────────────────────
    if (finding.name.includes('Document does not have a main landmark')) {
      const appJsxPath = path.join(projectRoot, 'src', 'App.jsx');
      try {
        let content = await fs.readFile(appJsxPath, 'utf-8');
        // Bungkus div utama luar App dengan <main> (Simplifikasi Regex)
        // Kita ubah div className="min-h-screen bg-[#070b14] text-gray-200 ... " jadi main
        if (content.includes('<div className="min-h-screen bg-[#070b14]')) {
           content = content.replace('<div className="min-h-screen bg-[#070b14]', '<main className="min-h-screen bg-[#070b14]');
           // Tutup main (asumsi di paling bawah file)
           const lastDivIndex = content.lastIndexOf('</div>');
           if (lastDivIndex !== -1) {
             content = content.substring(0, lastDivIndex) + '</main>' + content.substring(lastDivIndex + 6);
           }
           await fs.writeFile(appJsxPath, content, 'utf-8');
           fixedAny = true;
           fixLog += 'Berhasil mengubah wrapper utama menjadi elemen semantic <main>.\n';
        }
      } catch (err) {
         fixLog += `Gagal menambahkan tag <main>: ${err.message}\n`;
      }
    }

    if (fixedAny) {
      res.json({ success: true, message: '🔧 Perbaikan Otomatis Diterapkan:\n' + fixLog });
    } else {
      res.json({ success: false, message: 'Auto-Fix belum mendukung jenis temuan ini atau tidak ditemukan kecocokan kode sumber. Harap perbaiki secara manual.' });
    }

  } catch (error) {
    console.error('AutoFix Error:', error);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan sistem saat mencoba memperbaiki kode: ' + error.message });
  }
});

// ─── DISTRIBUTED CHAOS ENGINE (V4) ───────────────────────────────────────────
app.post('/api/run-chaos', async (req, res) => {
  const { targetUrl, mode, vus } = req.body;
  if (!targetUrl) return res.status(400).json({ error: 'Target URL is required' });
  
  const safeMode = ['standard', 'slowloris', 'websocket', 'soak'].includes(mode) ? mode : 'standard';
  const safeVus = parseInt(vus) || 500;

  try {
    const { stdout, stderr } = await execPromise(
      `node tests/siksaan-beban-v4.js "${targetUrl}" ${safeVus} ${safeMode}`, 
      { timeout: 300000 } // 5 minutes max
    );

    // Ekstrak JSON metric dari stdout script V4
    const match = stdout.match(/JSON_START:(.*?):JSON_END/s);
    let metrics = null;
    if (match && match[1]) {
        try { metrics = JSON.parse(match[1]); } catch(e){}
    }

    res.json({ output: stdout, errorLog: stderr, metrics });
  } catch (error) {
    res.status(500).json({ error: error.message, output: error.stdout || '' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`🚀 NusaCyber Deep Auditor v3.2 — Port ${PORT}`));
