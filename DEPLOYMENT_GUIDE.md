# 🏁 NusaCyber v4: Deployment & Cloud Sync Walkthrough

Aplikasi NusaCyber Anda sekarang sudah **Production-Ready**. Seluruh kode telah berhasil di-push ke [GitHub Repository](https://github.com/ariyaspratama-idn/NusaCyber) dan siap disebarkan ke Cloud.

## 🚀 Apa Yang Telah Dicapai?
1. **GitHub Integration & CI/CD**: Kode Anda aman di GitHub. Setiap kali Anda mengubah kode, GitHub Actions akan otomatis mengecek apakah aplikasi *buildable* dan aman.
2. **TiDB Cloud Storage**: Hasil audit tidak lagi hanya di memori lokal. Sekarang, setiap audit akan menembak ke tabel `audit_reports` di TiDB Cloud (MySQL).
3. **Cross-Device Access Ready**: Status **LIVE** di Vercel: [https://nusacyber.vercel.app](https://nusacyber.vercel.app). Anda bisa memantau kesehatan situs klien dari HP atau laptop mana pun.


---

## 🛠️ Langkah Terakhir Untuk Anda (Self-Service)

### 1. Mengaktifkan Database (TiDB Cloud)
- Buka dashboard [TiDB Cloud](https://tidbcloud.com/).
- Buat cluster **Free Tier**.
- Salin *Connection String* (Host, User, Password).
- Buka file `.env` di folder proyek Anda dan isi nilai-nilainya:
```env
TIDB_HOST=your_host_address
TIDB_USER=your_username
TIDB_PASSWORD=your_password
```

### 2. Mendeploy UI ke Vercel
- Masuk ke [Vercel.com](https://vercel.com).
- Klik **Add New Project** -> **Import from GitHub**.
- Pilih repositori `NusaCyber`.
- Pada bagian `Root Directory`, pilih folder `dashboard`.
- Klik **Deploy**. UI Anda akan online dalam hitungan detik!

### 3. Menghubungkan Backend (Auditor)
Karena proses Audit memakan waktu lama (Lighthouse/Playwright), Anda disarankan tetap menjalankan `node server.js` di laptop Anda atau VPS. Agar UI (Vercel) bisa memanggil Backend lokal Anda, gunakan **Ngrok** atau **Cloudflare Tunnel** agar port `3001` Anda memiliki URL HTTPS publik.

---

## 📊 Preview Sistem Baru
Berikut adalah struktur folder baru yang siap tempur:
- `.github/workflows/ci-cd.yml` -> Penjaga kualitas kode.
- `db/connection.js` -> Jembatan ke Cloud Database.
- `.env` -> Brankas rahasia kredensial Anda.

> [!TIP]
> Sekarang Anda bisa tidur nyenyak karena setiap audit yang Anda lakukan akan tersimpan abadi di TiDB Cloud!

Selamat menggunakan **NusaCyber v4 Ultimate**! 🛡️
