const chromeLauncher = require('chrome-launcher');

// Map of Lighthouse audit IDs to plain Indonesian fix suggestions
const FIX_SUGGESTIONS = {
  'largest-contentful-paint': 'Optimalkan gambar, aktifkan lazy loading, dan perbaiki critical rendering path.',
  'total-blocking-time': 'Pisahkan JS besar atau tambahkan defer pada script non-kritis.',
  'cumulative-layout-shift': 'Pastikan gambar dan elemen embed memiliki dimensi lebar/tinggi eksplisit.',
  'speed-index': 'Minimalkan render-blocking resources dan gunakan inline critical CSS.',
  'first-contentful-paint': 'Kurangi waktu respon server (TTFB) dan aktifkan kompresi HTTP/2-3.',
  'interactive': 'Kurangi waktu eksekusi JavaScript utama. Audit dengan Chrome DevTools.',
  'render-blocking-resources': 'Tambahkan atribut defer atau async pada tag script eksternal.',
  'unused-javascript': 'Hapus JavaScript yang tidak digunakan untuk mengurangi ukuran bundle.',
  'unused-css-rules': 'Hapus aturan CSS yang tidak digunakan dengan tools seperti PurgeCSS.',
  'unminified-javascript': 'Lakukan minifikasi pada file JavaScript sebelum dikirim ke browser.',
  'unminified-css': 'Lakukan minifikasi pada file CSS untuk menghemat bandwidth.',
  'uses-optimized-images': 'Kompres gambar agar ukurannya di bawah 100KB per file.',
  'uses-webp-images': 'Gunakan format gambar modern seperti WebP atau AVIF.',
  'uses-responsive-images': 'Gunakan srcset untuk menyesuaikan ukuran gambar dengan layar.',
  'offscreen-images': 'Tunda pemuatan gambar di luar layar dengan loading="lazy".',
  'uses-rel-preconnect': 'Wujudkan koneksi lebih awal dengan link rel preconnect.',
  'uses-text-compression': 'Aktifkan kompresi teks (Gzip/Brotli) pada konfigurasi server.',
  'uses-long-cache-ttl': 'Gunakan cache jangka panjang untuk file statis (minimal 1 tahun).',
  'efficient-animated-content': 'Ganti file GIF dengan format video seperti WebM atau MP4.',
  'duplicated-javascript': 'Hindari penginstalan library yang sama secara berulang.',
  'legacy-javascript': 'Gunakan kompilasi modern untuk menghindari polyfill yang tidak perlu.',
  'uses-http2': 'Pastikan server mendukung dan telah menggunakan protokol HTTP/2.',
  'no-document-write': 'Hindari penggunaan document.write() karena memblokir parser.',
  'no-vulnerable-libraries': 'Perbarui semua pustaka ke versi aman terbaru (npm audit fix).',
  'js-libraries': 'Pilih library yang lebih ringan sebagai alternatif dari yang berat.',
  'color-contrast': 'Pastikan kontras teks cukup jelas untuk dibaca (minimal 4.5:1).',
  'image-alt': 'Berikan atribut alt yang relevan pada setiap tag gambar.',
  'label': 'Pastikan semua elemen form memiliki label yang sesuai.',
  'button-name': 'Setiap tombol harus memiliki teks judul atau label aria.',
  'link-name': 'Gunakan teks link yang menjelaskan tujuan navigasi dengan jelas.',
  'meta-description': 'Lengkapi meta description di bagian head untuk SEO.',
  'document-title': 'Setiap halaman harus memiliki judul dokumen (title) yang unik.',
  'html-has-lang': 'Pastikan tag html memiliki atribut bahasa (lang).',
  'viewport': 'Pastikan viewport telah diatur untuk responsivitas mobile.',
  'http-status-code': 'Pastikan halaman mengembalikan kode status 200 OK.',
  'is-crawlable': 'Pastikan halaman tidak diblokir oleh robot noindex.',
  'link-text': 'Sediakan teks link yang deskriptif dan mudah dipahami.',
  'crawlable-anchors': 'Pastikan semua link menggunakan atribut href yang valid.',
  'tap-targets': 'Elemen interaktif harus cukup besar untuk disentuh di mobile.',
  'structured-data': 'Gunakan format JSON-LD untuk data terstruktur.',
};

async function runLighthouse(url) {
  const { default: lighthouse } = await import('lighthouse');
  
  const chrome = await chromeLauncher.launch({ 
    chromeFlags: ['--headless', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'] 
  });
  
  const options = { logLevel: 'error', output: 'json', port: chrome.port };
  
  try {
    const runnerResult = await lighthouse(url, options);
    const lhr = runnerResult.lhr;
    
    // Top-level category scores
    const scores = {
      performance: Math.round((lhr.categories.performance?.score || 0) * 100),
      accessibility: Math.round((lhr.categories.accessibility?.score || 0) * 100),
      bestPractices: Math.round((lhr.categories['best-practices']?.score || 0) * 100),
      seo: Math.round((lhr.categories.seo?.score || 0) * 100),
    };

    // Core Web Vitals
    const metrics = {
      lcp: lhr.audits['largest-contentful-paint']?.displayValue || 'N/A',
      cls: lhr.audits['cumulative-layout-shift']?.displayValue || 'N/A',
      tbt: lhr.audits['total-blocking-time']?.displayValue || 'N/A',
      fid: lhr.audits['max-potential-fid']?.displayValue || 'N/A',
      fcp: lhr.audits['first-contentful-paint']?.displayValue || 'N/A',
      si:  lhr.audits['speed-index']?.displayValue || 'N/A',
      tti: lhr.audits['interactive']?.displayValue || 'N/A',
    };

    // Extract ALL failed/warning audits with details
    const detailedFindings = [];
    const allAuditIds = [
      ...Object.keys(lhr.categories.performance?.auditRefs?.reduce((a, r) => ({...a, [r.id]: true}), {}) || {}),
      ...Object.keys(lhr.categories.accessibility?.auditRefs?.reduce((a, r) => ({...a, [r.id]: true}), {}) || {}),
      ...Object.keys(lhr.categories['best-practices']?.auditRefs?.reduce((a, r) => ({...a, [r.id]: true}), {}) || {}),
      ...Object.keys(lhr.categories.seo?.auditRefs?.reduce((a, r) => ({...a, [r.id]: true}), {}) || {}),
    ];

    for (const auditId of allAuditIds) {
      const audit = lhr.audits[auditId];
      if (!audit) continue;
      // Only include failed (score < 0.9) and numeric audits
      if (audit.score !== null && audit.score < 0.9 && audit.scoreDisplayMode !== 'informative' && audit.scoreDisplayMode !== 'manual') {
        const category = lhr.categories.performance?.auditRefs?.find(r => r.id === auditId) ? 'Performance' :
                         lhr.categories.accessibility?.auditRefs?.find(r => r.id === auditId) ? 'Accessibility' :
                         lhr.categories['best-practices']?.auditRefs?.find(r => r.id === auditId) ? 'Best Practices' : 'SEO';

        // Extract affected elements if available
        const items = audit.details?.items?.slice(0, 5).map(item => {
          if (item.url) return item.url;
          if (item.node?.snippet) return item.node.snippet.slice(0, 120);
          if (item.label) return item.label;
          return null;
        }).filter(Boolean) || [];

        detailedFindings.push({
          id: auditId,
          category,
          name: audit.title,
          description: audit.description?.replace(/\[.*?\]\(.*?\)/g, '').trim().slice(0, 200),
          score: Math.round((audit.score || 0) * 100),
          severity: audit.score === 0 ? 'critical' : audit.score < 0.5 ? 'error' : 'warning',
          displayValue: audit.displayValue || '',
          affectedItems: items,
          suggestion: FIX_SUGGESTIONS[auditId] || audit.description?.slice(0, 150) || 'Periksa panduan di web.dev/measure',
        });
      }
    }

    // Sort: critical first, then by category
    detailedFindings.sort((a, b) => {
      const sev = { critical: 0, error: 1, warning: 2 };
      return (sev[a.severity] - sev[b.severity]) || a.category.localeCompare(b.category);
    });

    try { 
      await chrome.kill().catch(() => {}); // Suppress EPERM on temp dir delete
    } catch (e) {}

    return { scores, metrics, detailedFindings };
  } catch (error) {
    try { await chrome.kill().catch(() => {}); } catch (e) {}
    throw error;
  }
}

module.exports = { runLighthouse };
