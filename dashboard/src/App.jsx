import { useState, useEffect, useRef } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import { generatePDFContent } from './reportGenerator'

// ─── Utils ────────────────────────────────────────────────────
const scoreColor  = s => s >= 90 ? '#22c55e' : s >= 50 ? '#f59e0b' : '#ef4444';
const scoreLabel  = s => s >= 90 ? 'BAIK' : s >= 50 ? 'CUKUP' : 'BURUK';
const vitalStatus = (val, good, ok) => val <= good ? 'good' : val <= ok ? 'warn' : 'bad';

const SEV = {
  critical: { ring: 'border-l-red-500',   bg: 'bg-red-950/30',    badge: 'bg-red-500 text-white',    icon: '🔴', label: 'KRITIS'     },
  error:    { ring: 'border-l-orange-500', bg: 'bg-orange-950/20', badge: 'bg-orange-500 text-black', icon: '🟠', label: 'ERROR'      },
  warning:  { ring: 'border-l-yellow-500', bg: 'bg-yellow-950/10', badge: 'bg-yellow-400 text-black', icon: '🟡', label: 'PERINGATAN' },
};

const CAT_ICON = { Performance: '⚡', Accessibility: '♿', 'Best Practices': '🛡️', SEO: '🔍', 'Security/A11y': '🔒', 'Load/Stress': '🌊' };
const VITAL_COLOR = { good: 'text-green-400', warn: 'text-yellow-400', bad: 'text-red-400' };

// ─── Sub-components ────────────────────────────────────────────
function Ring({ score, label }) {
  const c = scoreColor(score || 0);
  const d = [{ value: score || 0 }, { value: 100 - (score || 0) }];
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-28 h-28">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={d} innerRadius={40} outerRadius={52} startAngle={90} endAngle={450} dataKey="value" stroke="none">
              <Cell fill={c} /><Cell fill="#1e293b" />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-black" style={{color:c}}>{score||0}</span>
          <span className="text-[8px] font-black uppercase" style={{color:c}}>{scoreLabel(score||0)}</span>
        </div>
      </div>
      <span className="text-[10px] font-black uppercase tracking-widest text-center text-gray-500">{label}</span>
    </div>
  );
}

function VitalCard({ label, value, unit, good, ok }) {
  const raw = parseFloat(value) || 0;
  const st  = vitalStatus(raw, good, ok);
  return (
    <div className={`flex-1 min-w-[130px] bg-[#0b1229] border rounded-2xl p-5 ${st==='bad'?'border-red-900/40':st==='warn'?'border-yellow-900/30':'border-green-900/20'}`}>
      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2">{label}</p>
      <div className="flex items-end gap-1">
        <span className={`text-2xl font-black italic ${VITAL_COLOR[st]}`}>{value||'N/A'}</span>
      </div>
      <p className="text-[9px] text-gray-700 mt-1">Ideal: {unit}</p>
      <div className={`text-[8px] font-black mt-2 ${VITAL_COLOR[st]}`}>
        {st === 'good' ? '✅ OPTIMAL' : st === 'warn' ? '⚠️ PERLU PERBAIKAN' : '❌ KRITIS'}
      </div>
    </div>
  );
}

function FindingCard({ f, targetUrl }) {
  const [fixing, setFixing] = useState(false);
  const [modalType, setModalType] = useState(null); // 'confirm' | 'result'
  const [modalMsg, setModalMsg] = useState('');
  const s = SEV[f.severity] || SEV.warning;
  
  const initiateFix = () => {
    if (!targetUrl) {
      setModalMsg('Target URL tidak ditemukan.');
      setModalType('result');
      return;
    }
    setModalType('confirm');
  };

  const executeFix = async () => {
    setModalType(null);
    setFixing(true);
    try {
      const res = await fetch('http://localhost:3001/api/auto-fix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUrl, finding: f }),
      });
      const data = await res.json();
      setModalMsg(data.message);
      setModalType('result');
    } catch (e) {
      setModalMsg('Gagal menghubungi Auto-Fix engine: ' + e.message);
      setModalType('result');
    }
    setFixing(false);
  };

  // Basic check for supported fixes
  const isFixable = f.name?.includes('contrast ratio') || 
                    f.name?.includes('main landmark') || 
                    f.name?.includes('[lang] attribute');

  return (
    <div className={`${s.bg} border-l-4 ${s.ring} rounded-r-2xl rounded-l-none p-5 space-y-3 relative`}>
      
      {/* ─── CUSTOM MODAL OVERLAY ─── */}
      {modalType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-[#0b1229] border border-cyan-500/30 rounded-3xl p-8 max-w-md w-full shadow-2xl shadow-cyan-900/20">
            {modalType === 'confirm' ? (
              <>
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-full bg-cyan-950/50 flex items-center justify-center text-2xl border border-cyan-500/20">⚙️</div>
                  <div>
                    <h3 className="text-lg font-black text-white uppercase tracking-wider">Konfirmasi Auto-Fix</h3>
                    <p className="text-[10px] text-cyan-500 font-mono tracking-widest mt-1">SYSTEM_MODIFICATION_PENDING</p>
                  </div>
                </div>
                <p className="text-sm text-gray-300 mb-8 leading-relaxed">
                  Fitur ini akan <strong className="text-white">memodifikasi file kode sumber (React/HTML) Anda secara langsung</strong> untuk memperbaiki masalah:<br/><br/>
                  <code className="bg-black/50 p-2.5 rounded-lg block text-xs border border-white/10 text-orange-300 break-words leading-normal">{f.name}</code><br/>
                  Apakah Anda yakin ingin melanjutkan dan menulis ulang kode sumber?
                </p>
                <div className="flex gap-3 justify-end">
                  <button onClick={() => setModalType(null)} className="px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest text-gray-400 hover:text-white hover:bg-white/10 transition-colors">Batal</button>
                  <button onClick={executeFix} className="px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest bg-cyan-600 hover:bg-cyan-500 text-black transition-all shadow-[0_0_15px_rgba(8,145,178,0.5)]">✨ Ya, Perbaiki Kode!</button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-full bg-black/50 flex items-center justify-center text-2xl border border-white/10 shadow-inner">
                    {modalMsg.toLowerCase().includes('berhasil') || modalMsg.toLowerCase().includes('sukses') ? '✅' : '⚠️'}
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-white uppercase tracking-wider">Laporan Auto-Fix</h3>
                    <p className="text-[10px] text-gray-500 font-mono tracking-widest mt-1">MODIFICATION_RESULT</p>
                  </div>
                </div>
                <div className="bg-black/40 border border-white/5 rounded-xl p-5 mb-8">
                  <p className="text-xs text-gray-300 whitespace-pre-wrap font-mono leading-relaxed">{modalMsg}</p>
                </div>
                <div className="flex justify-end">
                  <button onClick={() => setModalType(null)} className="px-8 py-3 rounded-xl font-black text-xs uppercase tracking-widest bg-white text-black hover:bg-gray-200 transition-colors shadow-lg">Tutup</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-[9px] font-black px-2 py-1 rounded-full ${s.badge}`}>{s.icon} {s.label}</span>
          <span className="text-[9px] text-gray-500 font-black uppercase">{CAT_ICON[f.category]||'⚠️'} {f.category}</span>
          {f.displayValue && <code className="text-[9px] text-cyan-400 bg-cyan-950/30 px-2 py-0.5 rounded font-mono">{f.displayValue}</code>}
        </div>
        <span className="text-[9px] text-gray-700 font-mono">Skor: {f.score ?? '—'}/100</span>
      </div>

      {/* Title */}
      <h4 className="text-sm font-black text-white">{f.name}</h4>

      {/* What's wrong */}
      {f.description && (
        <div>
          <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">📋 Penjelasan Masalah</p>
          <p className="text-xs text-gray-400 leading-relaxed">{f.description}</p>
        </div>
      )}

      {/* Affected items - ALWAYS VISIBLE */}
      {f.affectedItems?.length > 0 && (
        <div>
          <p className="text-[9px] font-black text-orange-500 uppercase tracking-widest mb-2">📌 Elemen/Kode yang Bermasalah ({f.affectedItems.length})</p>
          <div className="space-y-1.5">
            {f.affectedItems.map((item, i) => (
              <div key={i} className="flex gap-2">
                <span className="text-orange-500 text-[10px] shrink-0 font-black">#{i+1}</span>
                <code className="text-[10px] text-orange-300 bg-black/50 px-3 py-1.5 rounded-lg font-mono break-all flex-1 border border-orange-900/20">{item}</code>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Fix */}
      <div className="bg-cyan-950/20 border border-cyan-500/10 rounded-xl p-4 flex justify-between items-start flex-wrap gap-4">
        <div className="flex-1">
          <p className="text-[9px] font-black text-cyan-500 uppercase tracking-widest mb-1.5">💡 Cara Memperbaiki</p>
          <p className="text-xs text-cyan-100 font-semibold leading-relaxed">{f.suggestion}</p>
        </div>
        {isFixable && (
          <button 
            onClick={initiateFix} 
            disabled={fixing || modalType !== null}
            className={`shrink-0 ${fixing ? 'bg-cyan-900 text-cyan-500 cursor-wait' : 'bg-cyan-600 hover:bg-cyan-500 text-black cursor-pointer'} font-black text-xs px-5 py-3 rounded-xl transition-all uppercase tracking-wider relative overflow-hidden shadow-lg`}
          >
            {fixing ? 'MEMPERBAIKI...' : '✨ AUTO-FIX KODE INC.'}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Report ────────────────────────────────────────────────────
function Report({ report, targetUrl }) {
  const [filter, setFilter] = useState('Semua');
  if (!report) return (
    <div className="flex flex-col items-center justify-center h-80 text-gray-700 space-y-3">
      <span className="text-5xl">📋</span>
      <p className="font-black uppercase tracking-widest text-xs">Jalankan audit untuk melihat laporan</p>
    </div>
  );

  const lh = report.lighthouse;
  const allFindings = [
    ...(lh?.detailedFindings || []),
    ...(report.playwright?.failures?.map(f => ({...f, category: 'Security/A11y', severity: 'error', displayValue: '', description: f.error, affectedItems: []})) || []),
    ...(report.k6?.failures?.map(f => ({...f, category: 'Load/Stress', severity: 'critical', displayValue: '', description: f.error, affectedItems: []})) || []),
  ];

  const cats = ['Semua', ...new Set(allFindings.map(f => f.category))];
  const shown = filter === 'Semua' ? allFindings : allFindings.filter(f => f.category === filter);
  const crit = allFindings.filter(f => f.severity === 'critical').length;
  const errs = allFindings.filter(f => f.severity === 'error').length;

  return (
    <div className="space-y-10 pb-24">

      {/* Top summary banner */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[#0c1427] border border-white/5 rounded-3xl p-8 space-y-4">
          <h2 className="text-3xl font-black italic uppercase text-white">Full Audit <span className="text-cyan-500">Report</span></h2>
          <p className="text-[10px] font-mono text-gray-400">Target: <span className="text-cyan-400">{targetUrl}</span></p>

          {/* Priority summary */}
          <div className="space-y-2 pt-2">
            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Ringkasan Prioritas</p>
            <div className={`flex items-center gap-2 px-4 py-3 rounded-xl border ${crit > 0 ? 'bg-red-950/30 border-red-500/20 text-red-400' : 'bg-green-950/20 border-green-500/20 text-green-400'}`}>
              <span className="text-lg">{crit > 0 ? '🔴' : '✅'}</span>
              <div>
                <p className="text-sm font-black">{crit > 0 ? `${crit} Masalah KRITIS` : 'Tidak Ada Masalah Kritis'}</p>
                <p className="text-[9px] opacity-70">{crit > 0 ? 'Harus segera diperbaiki sebelum launch!' : 'Langsung ke masalah minor di bawah'}</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 pt-1">
              <div className="bg-red-950/20 border border-red-900/20 rounded-xl p-3 text-center">
                <p className="text-2xl font-black text-red-400">{crit}</p>
                <p className="text-[8px] text-red-700 uppercase font-black">Kritis</p>
              </div>
              <div className="bg-orange-950/20 border border-orange-900/20 rounded-xl p-3 text-center">
                <p className="text-2xl font-black text-orange-400">{errs}</p>
                <p className="text-[8px] text-orange-700 uppercase font-black">Error</p>
              </div>
              <div className="bg-yellow-950/20 border border-yellow-900/20 rounded-xl p-3 text-center">
                <p className="text-2xl font-black text-yellow-400">{allFindings.length - crit - errs}</p>
                <p className="text-[8px] text-yellow-700 uppercase font-black">Peringatan</p>
              </div>
            </div>
          </div>
        </div>

        {lh && (
          <div className="bg-[#0c1427] border border-white/5 rounded-3xl p-8 flex flex-col justify-center">
            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-6">Skor Lighthouse</p>
            <div className="flex gap-4 flex-wrap justify-center">
              <Ring score={lh.scores.performance} label="Performance" />
              <Ring score={lh.scores.accessibility} label="Accessibility" />
              <Ring score={lh.scores.bestPractices} label="Best Practices" />
              <Ring score={lh.scores.seo} label="SEO" />
            </div>
          </div>
        )}
      </div>

      {/* Core Web Vitals */}
      {lh && (
        <div>
          <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-4">⚡ Core Web Vitals — Status Kecepatan & Stabilitas</p>
          <div className="flex flex-wrap gap-3">
            <VitalCard label="LCP — Waktu Load" value={lh.metrics.lcp} unit="< 2.5s" good={2.5} ok={4} />
            <VitalCard label="CLS — Pergeseran Layout" value={lh.metrics.cls} unit="< 0.1" good={0.1} ok={0.25} />
            <VitalCard label="TBT — Jeda Input" value={lh.metrics.tbt?.replace('ms','')} unit="< 200ms" good={200} ok={600} />
            <VitalCard label="FID — Responsivitas" value={lh.metrics.fid?.replace('ms','')} unit="< 100ms" good={100} ok={300} />
            <VitalCard label="FCP — Konten Pertama" value={lh.metrics.fcp} unit="< 1.8s" good={1.8} ok={3} />
            <VitalCard label="Speed Index" value={lh.metrics.si} unit="< 3.4s" good={3.4} ok={5.8} />
            <VitalCard label="TTI — Siap Dipakai" value={lh.metrics.tti} unit="< 5s" good={5} ok={7.3} />
          </div>
        </div>
      )}

      {/* Findings */}
      <div>
        <div className="flex items-center justify-between flex-wrap gap-4 mb-5">
          <h3 className="text-lg font-black uppercase tracking-tighter text-white">
            🔍 {allFindings.length} Temuan — Daftar Lengkap Masalah
          </h3>
          <div className="flex gap-2 flex-wrap">
            {cats.map(cat => (
              <button key={cat} onClick={() => setFilter(cat)}
                className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all ${filter===cat ? 'bg-cyan-500 text-black' : 'bg-white/5 text-gray-500 hover:text-white'}`}>
                {cat === 'Semua' ? `Semua (${allFindings.length})` : `${CAT_ICON[cat]||''} ${cat} (${allFindings.filter(f=>f.category===cat).length})`}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          {shown.length === 0 ? (
            <p className="text-center py-12 text-green-500 font-black">✅ Tidak ada temuan di kategori ini!</p>
          ) : (
            shown.map((f,i) => <FindingCard key={f.id||i} f={f} targetUrl={targetUrl} />)
          )}
        </div>
      </div>

      {/* Save/Print */}
      <div className="flex gap-3 pt-4 flex-wrap">
        <button onClick={() => {
          const w = window.open('', '_blank');
          w.document.write(generatePDFContent(report, targetUrl));
          w.document.close();
        }}
        className="px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all bg-white text-black hover:bg-gray-200">
          🖨️ Cetak PDF Professional
        </button>
      </div>
    </div>
  );
}

// ─── Main App ──────────────────────────────────────────────────
export default function App() {
  const [url, setUrl]           = useState('');
  const [backendUrl, setBackendUrl] = useState('http://localhost:3001');
  const [auditMode, setAuditMode]   = useState('local'); // 'local' atau 'cloud'
  const [githubToken, setGithubToken] = useState(''); // Token untuk Cloud Audit
  const [loading, setLoading]   = useState(false);
  const [output, setOutput]     = useState('');
  
  const [report, setReport]     = useState(null);
  const [tab, setTab]           = useState('terminal');
  const [booting, setBooting]   = useState(true);
  const termRef = useRef(null);

  useEffect(() => { const t = setTimeout(() => setBooting(false), 2200); return () => clearTimeout(t); }, []);
  useEffect(() => { if (termRef.current) termRef.current.scrollTop = termRef.current.scrollHeight; }, [output]);

  const triggerCloudAudit = async () => {
    if (!githubToken) { alert('Masukkan GitHub Classic Token (PAT) untuk Cloud Audit!'); return; }
    setOutput('📡 Mengirim perintah ke Cloud Auditor (Proxy)...\n   Mesin GitHub akan mulai dalam ~20 detik.\n');
    try {
      // Panggil proxy serverless kita sendiri di Vercel untuk menghindari CORS
      const res = await fetch('/api/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: githubToken, payload: { target_url: url, test_type: 'ultimate' } }),
      });
      if (res.ok) {
        setOutput(p => p + '✅ PERINTAH DITERIMA! Menunggu hasil di Database TiDB Cloud...\n   (Proses ini memakan waktu 2-4 menit di server GitHub)\n\n   👉 LIHAT PROGRES NYATA DI SINI (KLIK):\n   https://github.com/ariyaspratama-idn/NusaCyber/actions\n');
      } else {
        const errData = await res.json();
        throw new Error(errData.message || 'Gagal memicu Cloud Audit! Cek Token Anda.');
      }
    } catch (e) {
      setOutput(p => p + `\n❌ ERROR CLOUD: ${e.message}`);
    }
    setLoading(false);
  };

  const runAudit = async () => {
    if (!url) { alert('Masukkan URL target!'); return; }
    setLoading(true); setReport(null); setTab('terminal');

    if (auditMode === 'cloud') {
      triggerCloudAudit();
      return;
    }

    setOutput('🚀 Menghubungkan ke audit engine...\n   Mohon tunggu, proses ini memerlukan 1-3 menit.\n');
    try {
      const res = await fetch(`${backendUrl}/api/run-test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUrl: url, testType: 'ultimate' }),
      });
      const data = await res.json();
      setOutput(data.output || 'Selesai.');
      if (data.report) { setReport(data.report); setTimeout(() => setTab('laporan'), 1500); }
    } catch (e) {
      setOutput(p => p + `\n❌ GAGAL TERHUBUNG: ${e.message}\n   Pastikan server sudah aktif di port 3001.`);
    }
    setLoading(false);
  };



  if (booting) return (
    <div className="fixed inset-0 bg-[#020617] flex flex-col items-center justify-center">
      <div className="w-20 h-20 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin mb-8"></div>
      <h1 className="text-4xl font-black italic uppercase text-white">NusaCyber <span className="text-cyan-500">v3.2</span></h1>
      <p className="text-cyan-400 text-[10px] font-mono tracking-[0.5em] mt-4 animate-pulse uppercase">Booting Deep Audit Engine...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#020617] text-white font-sans">
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8 pb-28">

        {/* Header */}
        <header className="flex justify-between items-center border-b border-white/5 pb-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-cyan-500 rounded-xl flex items-center justify-center font-black italic text-black text-xl shadow-[0_0_20px_rgba(6,182,212,0.3)]">NC</div>
            <div>
              <h1 className="text-2xl font-black italic uppercase tracking-tighter">NusaCyber <span className="text-cyan-500">Ultimate</span></h1>
              <p className="text-[9px] text-cyan-400 font-black uppercase tracking-widest">Deep System Audit v3.2 · One Click · Full Report</p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-ping"></div>
            <p className="text-xs text-green-600 font-mono">SENSORS ACTIVE</p>
          </div>
        </header>

        {/* Control Panel */}
        <section className="bg-gradient-to-br from-[#0b1229] to-[#020617] border border-white/5 rounded-[36px] p-10 space-y-7 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent"></div>
          <div className="text-center">
            <h2 className="text-3xl font-black italic uppercase text-white mb-2">Full System <span className="text-cyan-500">Deep Audit</span></h2>
            <p className="text-gray-400 text-sm">Lighthouse · Axe-core · Playwright · k6 — detail penuh, langsung bisa diperbaiki</p>
          </div>
          <div className="max-w-3xl mx-auto space-y-4">
             <div className="flex items-center justify-center gap-4 py-2 border-b border-white/5 bg-black/20 rounded-t-3xl">
                <button onClick={()=>setAuditMode('local')} className={`text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-full transition-all ${auditMode==='local'?'bg-cyan-500 text-black shadow-lg shadow-cyan-500/20':'text-gray-600'}`}>Local Engine</button>
                <button onClick={()=>setAuditMode('cloud')} className={`text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-full transition-all ${auditMode==='cloud'?'bg-purple-600 text-white shadow-lg shadow-purple-500/20':'text-gray-600'}`}>Cloud Engine (Free)</button>
             </div>

             <div className="relative group">
               <input type="url" value={url} onChange={e => setUrl(e.target.value)} onKeyDown={e => e.key === 'Enter' && runAudit()}
                  className="w-full bg-black/80 border-2 border-cyan-500/50 focus:border-cyan-400 rounded-b-[32px] rounded-t-none px-8 py-6 text-xl text-white placeholder-gray-600 outline-none transition-all font-mono text-center shadow-[0_0_30px_rgba(6,182,212,0.15)]"
                  placeholder="https://target-anda.com"
                />
             </div>

             <div className="flex flex-col items-center justify-center gap-2">
                {auditMode === 'local' ? (
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-black text-gray-700 uppercase tracking-widest">Local Auditor:</span>
                    <input type="text" value={backendUrl} onChange={e => setBackendUrl(e.target.value)}
                      className="bg-transparent border-b border-cyan-500/10 hover:border-cyan-500/40 text-cyan-500/50 focus:text-cyan-400 text-[10px] font-mono px-2 py-1 outline-none transition-all w-64 text-center"
                      placeholder="http://localhost:3001"
                    />
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-black text-purple-700 uppercase tracking-widest">GitHub PAT Token:</span>
                    <input type="password" value={githubToken} onChange={e => setGithubToken(e.target.value)}
                      className="bg-transparent border-b border-purple-500/10 hover:border-purple-500/40 text-purple-500/50 focus:text-purple-400 text-[10px] font-mono px-2 py-1 outline-none transition-all w-64 text-center"
                      placeholder="ghp_xxxxxxxxxxxx"
                    />
                  </div>
                )}
             </div>
            <button onClick={runAudit} disabled={loading}
              className="group w-full relative overflow-hidden bg-cyan-500 hover:bg-cyan-400 disabled:bg-cyan-900 disabled:cursor-not-allowed text-black font-black text-xl py-6 rounded-[24px] transition-all shadow-2xl shadow-cyan-500/20">
              <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-500"></div>
              <span className="relative z-10">{loading ? '⏳ Sedang Mengaudit...' : '🚀 START ULTIMATE SYSTEM AUDIT'}</span>
            </button>
          </div>
          <div className="flex justify-center gap-5 flex-wrap opacity-20 text-[9px] font-black tracking-widest">
            {['LIGHTHOUSE','AXE-CORE','PLAYWRIGHT','K6 STRESS','XSS SCAN','SQLI TEST'].map(l=><span key={l}>● {l}</span>)}
          </div>
        </section>

        {/* Tab Results */}
        <div className="space-y-4">
          <div className="flex gap-3">
            <button onClick={()=>setTab('terminal')} className={`px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${tab==='terminal'?'bg-white/10 text-cyan-400 border border-cyan-500/30':'text-gray-400 hover:text-gray-400'}`}>📟 System Output</button>
            <button onClick={()=>setTab('laporan')} className={`px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${tab==='laporan'?'bg-cyan-500 text-black':report?'text-cyan-600 hover:text-cyan-400':'text-gray-400 hover:text-gray-400'}`}>
              📋 Laporan Detail {report ? `(${(report.lighthouse?.detailedFindings?.length||0) + (report.playwright?.failures?.length||0) + (report.k6?.failures?.length||0)} temuan)` : ''}
            </button>
          </div>
          <div className="bg-[#050a1f] border border-white/5 rounded-[32px] p-8 min-h-[500px]">
            {tab === 'terminal' ? (
              <pre ref={termRef} className="text-cyan-400 font-mono text-xs leading-loose h-[580px] overflow-y-auto p-4 bg-black/40 rounded-2xl border border-white/5 whitespace-pre-wrap">{output || '$ SIAP. MASUKKAN URL DAN KLIK AUDIT...'}</pre>
            ) : (
              <Report report={report} targetUrl={url} />
            )}
          </div>
        </div>
      </div>



      {loading && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-3xl z-[300] flex flex-col items-center justify-center gap-6">
          <div className="w-24 h-24 border-8 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin"></div>
          <div className="text-center space-y-2">
            <h2 className="text-4xl font-black italic uppercase text-white tracking-widest">MENGAUDIT...</h2>
            <p className="text-cyan-900 font-mono text-xs animate-pulse uppercase tracking-[0.3em]">Lighthouse · Playwright · k6 berjalan serentak...</p>
            <p className="text-gray-700 text-xs">Mohon tunggu 1–3 menit. Jangan tutup halaman ini.</p>
          </div>
        </div>
      )}
    </div>
  );
}
