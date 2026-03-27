export function generatePDFContent(report, targetUrl) {
  const lh = report?.lighthouse;
  const list = [
    ...(lh?.detailedFindings || []),
    ...(report?.playwright?.failures?.map(f => ({...f, category: 'Security/A11y', severity: 'error', displayValue: '', description: f.error, affectedItems: []})) || []),
    ...(report?.k6?.failures?.map(f => ({...f, category: 'Load/Stress', severity: 'critical', displayValue: '', description: f.error, affectedItems: []})) || []),
  ];
  const crit = list.filter(f => f.severity === 'critical').length;
  const errs = list.filter(f => f.severity === 'error').length;
  const safeStr = str => (str || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const ts = new Date().toLocaleString('id-ID');
  const yr = new Date().getFullYear();

  let lhHtml = '';
  if (lh) {
    const cPerf = lh.scores.performance >= 90 ? '#16a34a' : lh.scores.performance >= 50 ? '#d97706' : '#dc2626';
    const cA11y = lh.scores.accessibility >= 90 ? '#16a34a' : lh.scores.accessibility >= 50 ? '#d97706' : '#dc2626';
    const cBp = lh.scores.bestPractices >= 90 ? '#16a34a' : lh.scores.bestPractices >= 50 ? '#d97706' : '#dc2626';
    const cSeo = lh.scores.seo >= 90 ? '#16a34a' : lh.scores.seo >= 50 ? '#d97706' : '#dc2626';
    
    lhHtml = `
      <div class="section">1. RINGKASAN PERFORMA LIGHTHOUSE</div>
      <div class="scores">
        <div class="box"><div class="num" style="color: ${cPerf}">${lh.scores.performance}</div><div class="lbl">Performance</div></div>
        <div class="box"><div class="num" style="color: ${cA11y}">${lh.scores.accessibility}</div><div class="lbl">Accessibility</div></div>
        <div class="box"><div class="num" style="color: ${cBp}">${lh.scores.bestPractices}</div><div class="lbl">Best Practices</div></div>
        <div class="box"><div class="num" style="color: ${cSeo}">${lh.scores.seo}</div><div class="lbl">SEO</div></div>
      </div>
      <p style="font-size:9pt; color:#666; text-align:center;"><strong>LCP:</strong> ${lh.metrics.lcp} | <strong>CLS:</strong> ${lh.metrics.cls} | <strong>TBT:</strong> ${lh.metrics.tbt} | <strong>Speed Index:</strong> ${lh.metrics.si}</p>
    `;
  }

  const findingsHtml = list.length === 0 
    ? '<p style="text-align:center; padding: 20px; font-weight:bold; color:#16a34a;">✅ Tidak ditemukan isu pada target.</p>'
    : list.map((f, i) => {
        const cls = f.severity === 'critical' ? 'critical' : f.severity === 'error' ? 'error' : 'warning';
        const badgeCls = f.severity === 'critical' ? 'b-crit' : f.severity === 'error' ? 'b-err' : 'b-warn';
        const num = String(i+1).padStart(2,'0');
        const itemsHtml = f.affectedItems?.length > 0 
          ? `<div style="margin-bottom: 12px;">
              <div style="font-size:8pt; font-weight:800; color:#555; text-transform:uppercase; margin-bottom:5px;">Elemen / Source Terdampak:</div>
              ${f.affectedItems.map(item => `<code class="code">${safeStr(item)}</code>`).join('')}
             </div>` 
          : '';
          
        return `
          <div class="f ${cls}">
            <div class="f-head">
              <p class="f-title">#${num} - ${safeStr(f.name)}</p>
              <span class="badge ${badgeCls}">${f.severity.toUpperCase()}</span>
            </div>
            <div class="cat">Kategori: ${f.category} ${f.displayValue ? ` | Nilai: ${safeStr(f.displayValue)}` : ''}</div>
            <p class="f-desc">${safeStr(f.description)}</p>
            ${itemsHtml}
            <div class="fix">
              <p class="fix-lbl">💡 Rekomendasi Perbaikan</p>
              <p class="fix-txt">${safeStr(f.suggestion)}</p>
            </div>
          </div>
        `;
      }).join('');

  return `
    <!DOCTYPE html>
    <html lang="id">
    <head>
      <title>Laporan Audit - NusaCyber Ultimate</title>
      <style>
        @page { size: A4 portrait; margin: 2cm; }
        body { font-family: 'Inter', 'Segoe UI', sans-serif; color: #111; line-height: 1.6; font-size: 11pt; }
        .header { border-bottom: 2px solid #111; padding-bottom: 10px; margin-bottom: 25px; display: flex; justify-content: space-between; align-items: flex-end; }
        .h1 { font-size: 22pt; font-weight: 900; margin: 0; text-transform: uppercase; letter-spacing: -0.5px; }
        .h2 { font-size: 10pt; color: #555; margin: 4px 0 0 0; letter-spacing: 2px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
        th, td { text-align: left; padding: 10px 15px; border: 1px solid #ddd; }
        th { background: #f8f9fa; width: 160px; font-weight: 700; }
        td { font-family: monospace; font-size: 10.5pt; color: #333; }
        
        .section { font-size: 14pt; font-weight: 800; border-bottom: 1px solid #111; padding-bottom: 6px; margin: 35px 0 20px 0; page-break-after: avoid; }
        
        .scores { display: flex; gap: 15px; margin-bottom: 30px; }
        .box { border: 1px solid #e5e7eb; border-radius: 8px; padding: 15px; flex: 1; text-align: center; background: #fafafa; }
        .num { font-size: 24pt; font-weight: 900; }
        .lbl { font-size: 8pt; text-transform: uppercase; font-weight: 700; color: #666; margin-top: 5px; letter-spacing: 1px; }

        .f { border: 1px solid #e5e7eb; border-left: 5px solid #ccc; padding: 16px; margin-bottom: 16px; border-radius: 0 8px 8px 0; page-break-inside: avoid; }
        .f.critical { border-left-color: #dc2626; background: #fef2f2; }
        .f.error { border-left-color: #ea580c; background: #fff7ed; }
        .f.warning { border-left-color: #eab308; background: #fefce8; }
        
        .f-head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; }
        .f-title { font-weight: 800; font-size: 12pt; margin: 0; }
        .badge { padding: 4px 10px; border-radius: 4px; font-size: 8pt; font-weight: 800; text-transform: uppercase; }
        .b-crit { background: #dc2626; color: white; }
        .b-err { background: #ea580c; color: white; }
        .b-warn { background: #eab308; color: black; }
        
        .cat { font-size: 8pt; font-weight: 800; color: #666; text-transform: uppercase; margin-bottom: 8px; letter-spacing: 1px; }
        .f-desc { font-size: 10.5pt; color: #374151; margin-bottom: 12px; }
        .code { font-family: monospace; font-size: 8.5pt; background: white; border: 1px solid #e5e7eb; padding: 6px 12px; border-radius: 6px; display: block; margin-bottom: 6px; word-break: break-all; color: #b45309; }
        .fix { background: #f0fdf4; border: 1px solid #bbf7d0; padding: 12px; border-radius: 6px; margin-top: 14px; }
        .fix-lbl { font-size: 8pt; font-weight: 800; color: #166534; text-transform: uppercase; margin-bottom: 4px; letter-spacing: 1px; }
        .fix-txt { font-size: 10.5pt; color: #064e3b; font-weight: 600; margin: 0; }
        
        @media print { button { display: none !important; } }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <p class="h1">Laporan Audit Sistem</p>
          <p class="h2">NUSACYBER ULTIMATE TESTING ENGINE</p>
        </div>
        <div style="text-align: right; color:#555; font-size:9pt;">
          <strong>Versi:</strong> 3.2<br><strong>Format:</strong> Professional A4
        </div>
      </div>

      <table>
        <tr><th>Target URL</th><td>${safeStr(targetUrl)}</td></tr>
        <tr><th>Waktu Eksekusi</th><td>${ts}</td></tr>
        <tr><th>Total Temuan</th><td><strong>${list.length} Isu</strong> (${crit} Kritis, ${errs} Error, ${list.length - crit - errs} Peringatan)</td></tr>
        <tr><th>Cakupan Audit</th><td>Google Lighthouse (Perf/SEO/A11y), k6 Load Simulator, Playwright E2E</td></tr>
      </table>

      ${lhHtml}

      <div class="section">2. DAFTAR TEMUAN DETAIL (${list.length} Isu)</div>
      
      ${findingsHtml}

      <div style="margin-top: 40px; border-top: 2px solid #eee; padding-top: 20px; text-align: center; color: #888; font-size: 9pt;">
        <p>Dokumen ini dihasilkan secara otomatis oleh NusaCyber Testing Hub v3.2.</p>
        <p>Hak Cipta © ${yr} NusaCyber.</p>
      </div>

      <script>window.onload = () => setTimeout(() => window.print(), 500);</script>
    </body>
    </html>
  `;
}
