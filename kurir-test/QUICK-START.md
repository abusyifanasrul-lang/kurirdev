# 🚀 Quick Start Guide

## Langkah 1: Install (Sekali Saja)

```bash
cd kurir-test
npm install
npm run install-browser
```

## Langkah 2: Edit Konfigurasi

Buka `users.config.js` dan sesuaikan:

### A. URL Aplikasi

```javascript
APP_URL: 'http://localhost:5173', // ← Ganti dengan URL Anda
```

**Pilihan**:
- Development: `http://localhost:5173`
- Production: `https://kurirdev.vercel.app`

### B. Akun Admin

```javascript
ADMIN: {
  name: 'Admin',
  route: '/admin',
  loginEmail: 'admin@test.com',     // ← Email admin Anda
  loginPassword: 'test123',          // ← Password admin Anda
},
```

### C. Akun Kurir

```javascript
COURIERS: [
  { name: 'Budi', loginEmail: 'budi@courier.com', loginPassword: 'test123' },
  { name: 'Sari', loginEmail: 'sari@courier.com', loginPassword: 'test123' },
  // ... tambah atau kurangi sesuai kebutuhan
],
```

**PENTING**: Akun-akun ini harus sudah ada di Supabase!

## Langkah 3: Jalankan

```bash
npm test
```

## ✅ Hasil yang Diharapkan

Terminal akan menampilkan:

```
╔════════════════════════════════════════════════════════════╗
║  KurirMe Multi-User Testing — Playwright Launcher         ║
╚════════════════════════════════════════════════════════════╝

📊 Total windows: 7 (1 Admin + 6 Kurir)
🌐 Target URL: http://localhost:5173

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 Membuka dashboard Admin...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  🔐 Mencoba login: admin@test.com
  ✅ Login berhasil: Admin
  🎯 Window position: (0, 0)
  📐 Window size: 640x520
  ✅ Admin window siap

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚴 Membuka dashboard Budi...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  🔐 Mencoba login: budi@courier.com
  ✅ Login berhasil: Budi
  ...

╔════════════════════════════════════════════════════════════╗
║                    🎉 SETUP SELESAI! 🎉                    ║
╚════════════════════════════════════════════════════════════╝

✅ 7 windows berhasil dibuka dan terisolasi
📱 Setiap window memiliki IndexedDB, SW, dan localStorage terpisah
🔍 Cek title bar tiap window untuk identifikasi (👑 Admin, 🚴 Kurir)

💡 Tips Testing:
   • Admin: Buat order baru dan assign ke kurir
   • Kurir: Ubah status (ON/STAY/OFF) untuk testing antrian
   • Dashboard admin akan update real-time via Supabase

⚠️  Tutup terminal ini (Ctrl+C) untuk menutup semua window
```

Dan 7 jendela Chrome akan terbuka tersusun grid!

## 🎯 Testing Cepat

### Test 1: Cek Antrian Kurir

1. Buka window **👑 Admin**
2. Lihat sidebar → Dashboard
3. Scroll ke "Courier Queue" widget
4. Cek urutan kurir sesuai tier

### Test 2: Assign Order

1. Window **👑 Admin** → Orders → New Order
2. Isi form order
3. Klik "Assign" → pilih kurir pertama
4. Cek kurir pindah ke belakang antrian
5. Window **🚴 Kurir** → cek notifikasi order masuk

### Test 3: STAY Status

1. Window **🚴 Budi** → Profile → Status → STAY
2. Window **👑 Admin** → Dashboard → cek Budi naik ke Tier 2
3. Assign order → Budi dapat prioritas

## ❌ Troubleshooting Cepat

### Login Gagal
```
⚠️  Login gagal atau sudah masuk: Timeout
```

**Solusi**:
- Cek `APP_URL` benar
- Cek email/password benar
- Cek akun ada di Supabase

### Window Tidak Muncul
```
Error: Browser closed
```

**Solusi**:
- Install ulang browser: `npm run install-browser`
- Cek antivirus tidak block Playwright

### Resolusi Layar Kecil

Jika window bertumpuk, edit `launch-test.js`:

```javascript
const SCREEN_WIDTH = 1280;  // ← Ganti sesuai layar Anda
const SCREEN_HEIGHT = 800;  // ← Ganti sesuai layar Anda
```

## 🛑 Cara Menutup

Tekan **Ctrl+C** di terminal → semua window otomatis tertutup.

---

**Selamat Testing! 🎉**
