const chromeLauncher = require('chrome-launcher');

// Map of Lighthouse audit IDs to plain Indonesian fix suggestions
const FIX_SUGGESTIONS = {
  'largest-contentful-paint': 'Optimalkan gambar (gunakan WebP/AVIF), aktifkan lazy loading, dan perbaiki critical rendering path.',
  'total-blocking-time': 'Pisahkan JavaScript besar menjadi code-splitting atau defer non-critical scripts.',
  'cumulative-layout-shift': 'Pastikan semua gambar dan elemen embed memiliki width/height yang eksplisit di HTML.',
  'speed-index': 'Minimalkan render-blocking resources dan inline critical CSS di <head>.',
  'first-contentful-paint': 'Kurangi ukuran server response time (TTFB) dan aktifkan HTTP/2.',
  'interactive': 'Kurangi JavaScript execution time. Audit dengan Chrome DevTools Coverage.',
  'render-blocking-resources': 'Tambahkan defer atau async pada tag <script>. Pindahkan CSS non-kritis ke bawah.',
  'unused-javascript': 'Hapus atau bundle JavaScript yang tidak dipakai. Gunakan tree-shaking di webpack/rollup.',
  'unused-css-rules': 'Gunakan PurgeCSS untuk menghapus CSS yang tidak dipakai dari production build.',
  'unminified-javascript': 'Minify JavaScript dengan terser atau esbuild sebelum deploy ke production.',
  'unminified-css': 'Minify CSS menggunakan clean-css atau PostCSS.',
  'uses-optimized-images': 'Kompres gambar dengan squoosh.app atau imagemin. Target < 100KB per gambar.',
  'uses-webp-images': 'Konversi semua gambar ke format WebP atau AVIF untuk ukuran 25-35% lebih kecil.',
  'uses-responsive-images': 'Gunakan srcset dan sizes attribute agar gambar menyesuaikan resolusi layar.',
  'offscreen-images': 'Tambahkan loading="lazy" pada gambar yang tidak muncul di layar awal.',
  'uses-rel-preconnect': 'Tambahkan <link rel="preconnect"> untuk domain eksternal penting (fonts, CDN).',
  'uses-text-compression': 'Aktifkan kompresi Gzip atau Brotli di server. Contoh Nginx: gzip on;',
  'uses-long-cache-ttl': 'Set Cache-Control header dengan max-age minimal 1 tahun untuk static assets.',
  'efficient-animated-content': 'Ganti GIF animasi dengan video WebM/MP4 yang ukurannya jauh lebih kecil.',
  'duplicated-javascript': 'Periksa duplikasi library di bundler. Pastikan satu versi React/lodash yang terpakai.',
  'legacy-javascript': 'Target browser modern di Babel config. Hapus polyfill yang tidak perlu.',
  'uses-http2': 'Aktifkan HTTP/2 di server (Nginx: listen 443 ssl http2). Memungkinkan multiplexing.',
  'no-document-write': 'Hapus semua penggunaan document.write() yang memblokir parser.',
  'no-vulnerable-libraries': 'Update semua dependency ke versi terbaru. Jalankan npm audit fix.',
  'js-libraries': 'Pertimbangkan mengganti library besar dengan alternatif yang lebih ringan.',
  'color-contrast': 'Pastikan rasio kontras teks minimal 4.5:1. Gunakan tools seperti coolors.co untuk cek.',
  'image-alt': 'Tambahkan atribut alt yang deskriptif pada semua tag <img>. Contoh: alt="Logo NusaCyber"',
  'label': 'Tambahkan <label for="id-input"> atau aria-label pada setiap elemen form.',
  'button-name': 'Pastikan setiap <button> memiliki teks yang jelas atau aria-label.',
  'link-name': 'Hindari link dengan teks "Klik di sini". Gunakan teks deskriptif yang menjelaskan tujuan.',
  'meta-description': 'Tambahkan tag <meta name="description" content="..."> di <head> untuk SEO.',
  'document-title': 'Tambahkan tag <title> yang unik dan deskriptif di setiap halaman.',
  'html-has-lang': 'Tambahkan atribut lang di tag <html>. Contoh: <html lang="id">',
  'viewport': 'Tambahkan <meta name="viewport" content="width=device-width, initial-scale=1"> di <head>.',
  'http-status-code': 'Pastikan server mengembalikan status 200 OK untuk halaman utama.',
  'is-crawlable': 'Hapus tag <meta name="robots" content="noindex"> jika halaman perlu diindex.',
  'link-text': 'Hindari link dengan teks generik. Gunakan teks yang mendeskripsikan tujuan link.',
  'crawlable-anchors': 'Pastikan semua link menggunakan href yang valid, bukan hanya JavaScript.',
  'tap-targets': 'Tombol dan link di mobile harus berukuran minimal 48x48px agar mudah disentuh.',
  'structured-data': 'Tambahkan JSON-LD structured data untuk meningkatkan rich snippet di Google.',
  'robots-txt': 'Buat file robots.txt yang valid di root website.',
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
