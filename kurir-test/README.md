# KurirMe Multi-User Testing Setup

Setup simulasi multi-user untuk testing sistem antrian kurir dengan Playwright.

## 🎯 Tujuan

Mensimulasikan 6-10 kurir + 1 admin secara bersamaan untuk menguji:
- Sistem antrian prioritas (6-tier system)
- Real-time updates via Supabase
- STAY status monitoring
- Order assignment flow
- Queue rotation

## 📋 Prerequisites

1. **Node.js** (v16 atau lebih baru)
2. **Akun Supabase** dengan minimal:
   - 1 akun admin (role: `admin` atau `admin_kurir`)
   - 3-6 akun kurir (role: `courier`)
3. **Aplikasi KurirMe** running di localhost atau deployed

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd kurir-test
npm install
npm run install-browser
```

### 2. Konfigurasi Akun

Edit file `users.config.js`:

```javascript
module.exports = {
  APP_URL: 'http://localhost:5173', // ← Sesuaikan URL Anda
  
  ADMIN: {
    name: 'Admin',
    route: '/admin',
    loginEmail: 'admin@test.com',     // ← Sesuaikan
    loginPassword: 'test123',          // ← Sesuaikan
  },
  
  COURIERS: [
    { name: 'Budi', loginEmail: 'budi@courier.com', loginPassword: 'test123' },
    { name: 'Sari', loginEmail: 'sari@courier.com', loginPassword: 'test123' },
    // ... tambah sesuai kebutuhan
  ],
};
```

**PENTING**: Akun-akun ini harus sudah ada di Supabase!

### 3. Jalankan

```bash
npm test
```

## 📊 Output

Script akan membuka multiple browser windows dalam layout grid:

```
┌─────────────┬─────────────┬─────────────┐
│ 👑 Admin    │ 🚴 Budi     │ 🚴 Sari     │
├─────────────┼─────────────┼─────────────┤
│ 🚴 Andi     │ 🚴 Dewi     │ 🚴 Riko     │
└─────────────┴─────────────┴─────────────┘
```

Setiap window:
- ✅ Terisolasi penuh (IndexedDB, Service Worker, localStorage terpisah)
- ✅ Auto-login dengan akun yang dikonfigurasi
- ✅ Title bar menunjukkan nama user (mudah identifikasi)
- ✅ Posisi dan ukuran otomatis (grid layout)

## 🧪 Skenario Testing

### Scenario 1: Normal Queue Flow
1. **Admin**: Buat order baru
2. **Admin**: Lihat daftar kurir di modal assignment (sorted by tier)
3. **Admin**: Assign ke kurir pertama
4. **Kurir**: Terima notifikasi order
5. **Admin**: Cek kurir sudah pindah ke belakang antrian

### Scenario 2: STAY Priority
1. **Kurir A**: Scan QR (status → STAY)
2. **Admin**: Cek kurir A naik ke Tier 2
3. **Admin**: Assign order → kurir A dapat prioritas
4. **Kurir A**: Keluar radius → auto-revoke ke ON
5. **Admin**: Cek kurir A turun tier

### Scenario 3: Priority Recovery
1. **Kurir B**: Cancel order
2. **Admin**: Set `is_priority_recovery = true` (manual via Supabase)
3. **Admin**: Cek kurir B naik ke Tier 1 (tertinggi)
4. **Admin**: Assign order berikutnya → kurir B dapat prioritas
5. **Admin**: Cek flag recovery di-reset

### Scenario 4: Multiple Concurrent Orders
1. **Admin**: Buat 5 order sekaligus
2. **Admin**: Assign satu per satu
3. **Observe**: Antrian berputar sesuai tier + FIFO
4. **Kurir**: Cek semua dapat order sesuai prioritas

## 🔧 Troubleshooting

### Login Gagal
- **Penyebab**: Email/password salah atau akun belum ada di Supabase
- **Solusi**: Cek Supabase Dashboard → Authentication → Users

### Window Bertumpuk
- **Penyebab**: Resolusi layar berbeda
- **Solusi**: Edit `SCREEN_WIDTH` dan `SCREEN_HEIGHT` di `launch-test.js`

### Navigation Timeout
- **Penyebab**: Aplikasi lambat load atau URL salah
- **Solusi**: 
  - Cek `APP_URL` di `users.config.js`
  - Naikkan timeout di `doLogin()` function

### Service Worker Tidak Terisolasi
- **Penyebab**: Menggunakan tab biasa (bukan context baru)
- **Solusi**: Pastikan script menggunakan `browser.newContext()` (sudah benar)

## 📁 Struktur File

```
kurir-test/
├── package.json          # Dependencies
├── users.config.js       # Konfigurasi akun (EDIT INI!)
├── launch-test.js        # Script utama
└── README.md            # Dokumentasi ini
```

## 🎓 Catatan Teknis

### Mengapa Playwright?

Aplikasi KurirMe adalah PWA yang menggunakan:
- **IndexedDB** untuk caching order
- **Service Worker** untuk offline support
- **localStorage** untuk preferences

Setiap `browser.newContext()` di Playwright membuat profil browser yang **sepenuhnya terisolasi**, termasuk semua storage di atas. Ini tidak bisa dicapai dengan membuka banyak tab biasa.

### Isolasi Context

```javascript
// ❌ SALAH: Semua tab share storage
const page1 = await browser.newPage();
const page2 = await browser.newPage();

// ✅ BENAR: Setiap context terisolasi
const ctx1 = await browser.newContext();
const page1 = await ctx1.newPage();

const ctx2 = await browser.newContext();
const page2 = await ctx2.newPage();
```

### Window Positioning

Script menggunakan `window.moveTo()` dan `window.resizeTo()` untuk mengatur posisi window. Ini hanya berfungsi di **headed mode** (headless: false).

## 🚦 Next Steps

Setelah setup berhasil:

1. **Baca dokumentasi queue system**: `temp/courier-queue-system-analysis.md`
2. **Testing STAY monitor**: Lihat `android/GEMINI_TASKS4.md` untuk bug fixes
3. **Debug Panel**: Gunakan QR/STAY toggle untuk testing tanpa GPS

## 📞 Support

Jika ada masalah, cek:
1. Console log di terminal (error messages)
2. Browser DevTools di tiap window (F12)
3. Supabase Dashboard → Logs (database errors)

---

**Dibuat oleh**: Kiro AI  
**Tanggal**: 8 Mei 2026  
**Project**: KurirMe PWA
