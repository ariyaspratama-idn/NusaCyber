# 🔥 QA Testing Hub 🔥

Repositori khusus untuk menjalankan pengujian otomatis (E2E, Fuzzing, dan Beban) pada aplikasi buatan Anda.

## 1. Siksaan Fungsional & UI (Playwright)
Digunakan untuk simulasi user barbar (Chaos test) dan mengecek error (HTTP 500) di browser.

**Cara Menjalankan:**
1. Buka file `tests/siksaan-fungsional.spec.js`.
2. Ganti `TARGET_URL` dengan link project Anda (misal: `http://localhost:3000` atau Vercel).
3. Jalankan pengujian di background:
   ```bash
   npm run test:barbar
   ```
4. Atau, tonton bot-nya bekerja secara visual:
   ```bash
   npm run test:ui
   ```

**Mencetak Laporan Uji (PDF/HTML):**
```bash
npm run report
```
Halaman web Laporan (dengan bukti Error, Rekaman, dan Screenshot) akan terbuka dan siap untuk Anda *Print/Save as PDF*!

---

## 2. Siksaan Beban Server (k6)
Digunakan untuk Spill test & Stress test ke Vercel/TiDB Anda.

**Cara Menjalankan:**
1. Jika Windows Anda belum install k6, download dan install dari: `https://k6.io/docs/get-started/installation/`
2. Buka file `tests/siksaan-beban.js` dan ganti `TARGET_URL`.
3. Gunakan terminal untuk menembak target:
   ```bash
   k6 run tests/siksaan-beban.js
   ```
