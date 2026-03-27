import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = (__ENV.TARGET_URL || 'http://localhost:5173').replace(/\/$/, '');

// ──────────────────────────────────────────────────────────────
// Skenario Pengujian Beban — Universal (Web App maupun API)
// ──────────────────────────────────────────────────────────────
export const options = {
  scenarios: {
    // 1. Normal Load: Trafik normal harian
    normal_load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '10s', target: 20 },  // Ramp up
        { duration: '15s', target: 20 },  // Stabil
        { duration: '5s',  target: 0 },   // Ramp down
      ],
      gracefulRampDown: '5s',
    },
    // 2. Spike: Lonjakan trafik mendadak
    spike: {
      executor: 'ramping-vus',
      startVUs: 0,
      startTime: '30s',
      stages: [
        { duration: '5s',  target: 100 }, // Spike tiba-tiba
        { duration: '5s',  target: 0 },   // Kembali normal
      ],
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<3000'],    // 95% request < 3 detik
    http_req_failed:   ['rate<0.10'],     // Max 10% error
    http_reqs:         ['rate>1'],        // Minimal 1 req/s
  },
};

export default function () {
  // ── Tes 1: Load halaman utama ──────────────────────────────
  const mainPage = http.get(BASE_URL, {
    tags: { name: 'Main Page' },
    headers: { 'User-Agent': 'NusaCyber-LoadTest/3.2', 'Accept': 'text/html,*/*' },
  });
  check(mainPage, {
    '✅ Halaman utama 200': (r) => r.status === 200,
    '✅ Response < 3s':     (r) => r.timings.duration < 3000,
    '✅ Body tidak kosong': (r) => r.body?.length > 0,
  });

  sleep(0.5);

  // ── Tes 2: Request simulasi trafik paralel ─────────────────
  const requests = {
    'Halaman Utama (ulang)': ['GET', BASE_URL, null],
  };
  // Jika ada path /assets, test juga (untuk SPA Vite)
  const batchRes = http.batch([
    ['GET', BASE_URL, null, { tags: { name: 'Reload Test' } }],
    ['GET', `${BASE_URL}/`, null, { tags: { name: 'Root Redirect' } }],
  ]);
  batchRes.forEach(r => {
    check(r, { '✅ Batch Request OK': (r) => r.status < 500 });
  });

  sleep(0.5);

  // ── Tes 3: Header Injection / Security ────────────────────
  const injectionRes = http.get(BASE_URL, {
    tags: { name: 'Header Injection Test' },
    headers: {
      'X-Forwarded-For': '1.2.3.4',
      'X-Custom-Header': '<script>alert(1)</script>',
      'User-Agent': 'sqlmap/1.0 (sql injection test)',
    },
  });
  check(injectionRes, {
    '✅ Server tidak crash karena header aneh': (r) => r.status < 500,
    '✅ Tidak ada error 500 pada injection':    (r) => r.status !== 500,
  });

  sleep(0.5);

  // ── Tes 4: Large Payload ───────────────────────────────────
  const largePayload = 'A'.repeat(1024 * 100); // 100KB
  const largeRes = http.post(BASE_URL, largePayload, {
    tags: { name: 'Large Payload Test' },
    headers: { 'Content-Type': 'text/plain' },
  });
  check(largeRes, {
    '✅ Server tidak crash payload besar': (r) => r.status < 500,
  });

  sleep(1);
}

// ── Summary pada akhir test ────────────────────────────────────
export function handleSummary(data) {
  const reqs    = data.metrics.http_reqs?.values?.count || 0;
  const p95     = data.metrics.http_req_duration?.values?.['p(95)'] || 0;
  const avgDur  = data.metrics.http_req_duration?.values?.avg || 0;
  const errRate = (data.metrics.http_req_failed?.values?.rate || 0) * 100;

  console.log('\n═══════════════════════════════════════');
  console.log('  NUSA CYBER — HASIL UJI BEBAN K6');
  console.log('═══════════════════════════════════════');
  console.log(`  Total Request   : ${reqs}`);
  console.log(`  Avg Resp Time   : ${avgDur.toFixed(0)} ms`);
  console.log(`  P95 Resp Time   : ${p95.toFixed(0)} ms  ${p95 < 3000 ? '✅ LULUS' : '❌ GAGAL (>3s)'}`);
  console.log(`  Error Rate      : ${errRate.toFixed(2)}%  ${errRate < 10 ? '✅ LULUS' : '❌ TINGGI (>10%)'}`);
  console.log('═══════════════════════════════════════\n');

  return {}; // No file output, just console
}
