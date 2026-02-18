# KurirDev — DeliveryPro: Bug Report & AI Coder Prompt
**Versi:** 2.0 (Update dengan temuan baru dari pengguna iOS)  
**Tanggal:** 18 Februari 2026  
**Status:** CRITICAL — Data Inconsistency Sistem-Wide

---

## Daftar Isi
1. [Ringkasan Eksekutif](#1-ringkasan-eksekutif)
2. [Temuan Baru — Laporan Pengguna iOS](#2-temuan-baru--laporan-pengguna-ios)
3. [Daftar Bug Lengkap](#3-daftar-bug-lengkap)
4. [Prompt Wajib untuk AI Coder](#4-prompt-wajib-untuk-ai-coder)
5. [Checklist Verifikasi Pasca Perbaikan](#5-checklist-verifikasi-pasca-perbaikan)

---

## 1. Ringkasan Eksekutif

Sistem DeliveryPro telah dianalisis menyeluruh melalui dua sesi screenshot (Admin Dashboard + Courier PWA) dan satu laporan langsung dari pengguna iOS.

Ditemukan bahwa mayoritas fitur UI sudah terbentuk dengan baik, namun terdapat **masalah fundamental pada lapisan data**: banyak halaman masih menggunakan mock data yang berdiri sendiri *(hardcoded langsung di komponen)* dan tidak terhubung ke state global yang sama.

**Dampak utama yang sudah dikonfirmasi:**
- Data numerik berubah-ubah antar sesi tanpa ada perubahan transaksi nyata
- Chart dan diagram di seluruh sistem menampilkan angka yang tidak dapat dipercaya
- Alur end-to-end dari Admin → Kurir → Laporan tidak terintegrasi
- Pengguna iOS melaporkan angka yang berbeda dari sesi testing sebelumnya

> ⚠️ **Risiko bisnis:** Jika sistem ini dipakai live, laporan pendapatan dan performa kurir yang ditampilkan kepada pemilik bisnis adalah **data yang salah**.

---

## 2. Temuan Baru — Laporan Pengguna iOS

> Sumber: Screenshot langsung dari perangkat iOS pengguna, side-by-side dengan Admin Reports.

### 2.1 Inkonsistensi "Orders Today" di Earnings Kurir

| Sesi | Orders Today (Earnings Kurir) | Keterangan |
|------|-------------------------------|------------|
| Sesi sebelumnya | 8 orders | Semua ORD-20260218-0001~0008, Rp 6.400 flat |
| Laporan iOS | 8 orders | Sama — angka tidak berubah meski ada transaksi baru |

**Masalah:** "Orders Today" di halaman Earnings kurir selalu menampilkan 8 orders dengan nilai identik Rp 6.400 per order, tidak peduli order nyata apa yang sudah diproses. Ini adalah **data dummy statis** yang tidak terhubung ke transaksi aktual.

---

### 2.2 Inkonsistensi Data Budi Santoso di Admin Reports

Pengguna iOS melingkari data Budi Santoso di halaman Reports yang menunjukkan angka mencurigakan:

| Sumber Data | Orders Delivered | Revenue Generated |
|-------------|-----------------|-------------------|
| Courier Detail Modal (sesi 1) | 3 completed | Rp 53.000 |
| Admin Reports — sesi 1 | 4 orders | Rp 82.000 |
| Admin Reports — laporan iOS | **6 orders** | **Rp 104.000** |

**Analisis inkonsistensi:**
- Rp 104.000 ÷ 6 orders = **Rp 17.333 rata-rata per order**. Ini tidak masuk akal karena fee order berkisar Rp 15.000–24.000 dan kurir hanya menerima 80% (maks Rp 19.200).
- Angka berubah dari sesi ke sesi **tanpa ada transaksi baru yang diverifikasi** — konfirmasi bahwa chart/tabel Reports membaca dari data yang di-generate ulang secara acak atau tidak stabil setiap render.
- Siti Aminah: 5 orders / Rp 95.000 → rata-rata Rp 19.000 per order (Rp 19.000 ÷ 80% = Rp 23.750 fee asli). Ini lebih masuk akal tapi tetap tidak bisa diverifikasi ke data order aktual.

---

### 2.3 Chart "Orders by Status" Tidak Konsisten Antar Sesi

| Status | Sesi Sebelumnya | Laporan iOS | Selisih |
|--------|----------------|-------------|---------|
| Delivered | 10 | **14** | +4 |
| Cancelled | 5 | **8** | +3 |
| Assigned | 9 | 9 | 0 |
| In Transit | 9 | 9 | 0 |
| Picked Up | 8 | 8 | 0 |
| Pending | 10 | **6** | -4 |
| **Total** | **51** | **54** | **+3** |

**Analisis:** Total order berubah dari 51 menjadi 54 tanpa penambahan order yang terverifikasi. Ini mengkonfirmasi kecurigaan pengguna iOS bahwa **chart di seluruh sistem juga menggunakan data yang tidak stabil**. Kemungkinan besar chart membaca dari mock data yang di-generate ulang setiap kali komponen di-render.

---

### 2.4 Konfirmasi: Chart Sistem-Wide Bermasalah

Berdasarkan temuan di atas, **semua chart dan diagram** berikut perlu dianggap tidak dapat dipercaya hingga perbaikan dilakukan:

- `Admin > Dashboard`: Revenue Trend (7 hari), Status Overview (donut chart)
- `Admin > Reports`: Daily Revenue (bar chart), Orders by Status (pie chart), Top Performing Couriers
- `Courier PWA > Earnings`: Daily Earnings (bar chart, This Week view)

Semua chart ini berpotensi membaca dari mock data lokal yang di-generate dinamis berdasarkan formula/randomisasi, bukan dari transaksi aktual di store.

---

## 3. Daftar Bug Lengkap

### 🔴 BUG #1 — KRITIS: History & Earnings Kurir Tidak Terhubung ke Order Aktual

| Atribut | Detail |
|---------|--------|
| **File** | `src/pages/courier/History.tsx`, `src/pages/courier/Earnings.tsx` |
| **Prioritas** | KRITIS |
| **Ditemukan via** | Trace order ORD-20260218-007 (Nasrul Jihadi) |

**Deskripsi:**  
Order ORD-20260218-007 (Nasrul Jihadi) berhasil diproses penuh hingga status `Delivered`. Namun order tersebut **tidak muncul** di halaman History maupun Earnings kurir.

**Bukti:**
- History menampilkan order format `ORD-20240214-XXXX` (tahun 2024) dengan nama "John Doe", "Jane Smith" — bukan data sistem aktual
- Earnings menampilkan `ORD-20260218-0001~0008` dengan earnings seragam Rp 6.400 dan timestamp identik 19:32
- Format order number tidak konsisten: sistem aktual `ORD-YYYYMMDD-NNN`, mock data `ORD-YYYYMMDD-NNNN`

**Akar masalah:**  
`History.tsx` dan `Earnings.tsx` membaca dari mock data statis lokal yang di-hardcode di dalam file komponen, bukan dari OrderStore/state global.

---

### 🔴 BUG #2 — KRITIS: Halaman Profil Kurir Tidak Membaca Data User yang Login

| Atribut | Detail |
|---------|--------|
| **File** | `src/pages/courier/Profile.tsx` |
| **Prioritas** | KRITIS |
| **Bukti** | Login sebagai `budi@courier.com`, profil menampilkan nama "Courier", email "courier@delivery.com" |

**Akar masalah:**  
`Profile.tsx` tidak mengambil data dari AuthContext. Halaman merender data placeholder statis, bukan data user yang sedang aktif dalam sesi login.

---

### 🔴 BUG #3 — KRITIS (BARU): Semua Chart & Diagram Menggunakan Data Tidak Stabil

| Atribut | Detail |
|---------|--------|
| **File** | Semua komponen chart di Admin dan Courier PWA |
| **Prioritas** | KRITIS |
| **Ditemukan via** | Laporan pengguna iOS — perbandingan lintas sesi |

**Deskripsi:**  
Angka di semua chart dan tabel laporan berubah antar sesi tanpa transaksi baru yang terverifikasi. Dikonfirmasi oleh:
- Orders by Status: total berubah dari 51 → 54 orders
- Top Couriers: Budi Santoso berubah dari 3→4→6 delivered orders
- Revenue: angka tidak dapat diverifikasi ke transaksi aktual

**Chart yang terdampak:**
```
Admin > Dashboard    : Revenue Trend, Status Overview
Admin > Reports      : Daily Revenue, Orders by Status, Top Performing Couriers
Courier > Earnings   : Daily Earnings (bar chart)
```

**Akar masalah:**  
Chart membaca dari fungsi generator mock data yang menghasilkan nilai dinamis/acak setiap render, bukan dari kalkulasi berbasis data transaksi aktual di store.

---

### 🟠 BUG #4 — TINGGI: Aggregasi Earnings di Couriers Page Tidak Sinkron

| Atribut | Detail |
|---------|--------|
| **File** | `src/pages/admin/Couriers.tsx` |
| **Prioritas** | TINGGI |
| **Bukti** | Summary: Total Deliveries = 0, Total Earnings = Rp 0. Courier Detail Budi: 11 total orders, Rp 53.000 |

**Akar masalah:**  
Summary cards tidak melakukan agregasi dinamis dari data aktual. Field berbeda atau re-computation tidak terpicu saat data berubah.

---

### 🟠 BUG #5 — TINGGI: Rasio Split Earnings 80% Hardcoded

| Atribut | Detail |
|---------|--------|
| **File** | `src/pages/courier/OrderDetail.tsx` (dan logika kalkulasi earnings) |
| **Prioritas** | TINGGI |
| **Bukti** | Order fee Rp 15.000 → "Your Earnings (80%) Rp 12.000" — tidak ada field konfigurasi |

**Risiko:**
- Tidak dapat dikonfigurasi per kurir atau per periode
- Tidak ada jejak `platform_fee` dan `courier_amount` sebagai entitas terpisah
- Tidak ada interface `CourierEarning` per-transaksi seperti yang dirancang di awal

---

### 🟡 BUG #6 — SEDANG: Dua Entry Point Add Courier Berpotensi Tidak Sinkron

| Atribut | Detail |
|---------|--------|
| **File** | `src/pages/admin/Couriers.tsx`, `src/pages/admin/Settings.tsx` |
| **Prioritas** | SEDANG |

Tombol `+Add Courier` (Couriers page) dan `+Add User` dengan role Courier (Settings > System Users) perlu dipastikan memanggil action yang sama di store.

---

### 🟡 BUG #7 — SEDANG: `payment_status` Tidak Ada di Form New Order

| Atribut | Detail |
|---------|--------|
| **File** | `src/pages/admin/Orders.tsx` (modal New Order) |
| **Prioritas** | SEDANG |

Form New Order tidak memiliki field `payment_status`, sehingga semua order baru otomatis dibuat dengan status default tanpa pilihan Admin.

---

### 🔵 BUG #8 — INFO: FCM Token Tidak Diimplementasi

| Atribut | Detail |
|---------|--------|
| **Prioritas** | INFO — Fase berikutnya |

Field `fcm_token` di User interface belum diimplementasi. Sistem saat ini hanya menggunakan in-app notification melalui Zustand store, bukan push notification ke device.

---

## 4. Wajib untuk mu:

> Seluruh teks di bawah ini adalah konteks dan instruksi perbaikan.

---

```
====================================================================
  KURIRDEV — DELIVRYPRO: BUG FIX & DATA ARCHITECTURE OVERHAUL
  Versi Prompt: 2.0 | Tanggal: 18 Februari 2026
====================================================================

KONTEKS:
Sistem ini adalah aplikasi PWA Delivery Management dengan dua sisi:
Admin Dashboard (React + Tailwind) dan Courier PWA (React + Tailwind).
State management menggunakan Zustand dengan persistensi localStorage.

Ditemukan masalah fundamental: banyak halaman menggunakan mock data
hardcoded di komponen UI dan TIDAK terhubung ke Single Source of Truth.
Pengguna iOS telah melaporkan inkonsistensi data secara langsung.
Semua chart dan diagram di sistem terkonfirmasi menggunakan data
yang tidak stabil — angka berubah antar sesi tanpa transaksi baru.

====================================================================
  ARSITEKTUR WAJIB: SINGLE SOURCE OF TRUTH
====================================================================

PERINTAH WAJIB #1 — SINGLE SOURCE OF TRUTH:
Bangun satu sumber data terpusat yang mensimulasikan database
relasional. Semua halaman (Admin dan Kurir) WAJIB mereferensikan
objek data yang sama. Tidak boleh ada data dummy yang berdiri
sendiri (hardcoded) di dalam komponen UI manapun.

Buat lima 'tabel' terpisah dalam store:
  - users[]         : semua user (admin & kurir)
  - orders[]        : semua pesanan
  - tracking_logs[] : log perubahan status (audit trail)
  - earnings[]      : record pendapatan per transaksi
  - notifications[] : notifikasi sistem

Pastikan Foreign Key Consistency antar entitas:
  - orders.courier_id          -> users.id
  - orders.created_by          -> users.id
  - tracking_logs.order_id     -> orders.id
  - tracking_logs.changed_by   -> users.id
  - earnings.order_id          -> orders.id
  - earnings.courier_id        -> users.id
  - notifications.user_id      -> users.id

PERINTAH WAJIB #2 — DATA NORMALIZATION:
Simulasikan Query Database menggunakan logika find/filter.
Jangan pernah menyalin (duplicate) data antar store.
Gunakan relasi ID untuk join data saat dibutuhkan.

  // SALAH - data diduplikasi:
  order.courier_name = 'Budi Santoso'  // hardcoded string

  // BENAR - relasi via ID:
  const courier = users.find(u => u.id === order.courier_id)
  const courierName = courier?.name

PERINTAH WAJIB #3 — CROSS-PAGE DATA SYNC:
Jika status pengiriman diubah di halaman Kurir, status tersebut
HARUS otomatis berubah saat halaman Admin dibuka, tanpa reload.

Implementasi yang benar:
  1. Kurir klik 'Pick Up Order'
  2. Zustand action: updateOrderStatus(orderId, 'picked_up', userId)
  3. orders[] di store diupdate
  4. tracking_logs[] ditambah entri baru
  5. Admin Dashboard yang subscribe ke store otomatis re-render
  6. SEMUA chart yang menampilkan data status ikut re-render

PERINTAH WAJIB #4 — CHART DATA INTEGRITY (BARU):
Semua chart dan diagram HARUS membaca dari kalkulasi dinamis
berbasis data aktual di store. DILARANG menggunakan:
  - Fungsi generator angka acak/random
  - Array angka yang hardcoded di dalam komponen chart
  - Data yang di-compute sekali lalu disimpan sebagai konstanta

Pola yang benar untuk setiap chart:

  // Revenue Trend (7 hari) — Admin Dashboard & Reports:
  const revenueByDate = orders
    .filter(o => o.status === 'delivered')
    .reduce((acc, o) => {
      const date = o.created_at.split('T')[0]
      acc[date] = (acc[date] || 0) + o.total_fee
      return acc
    }, {})

  // Orders by Status — Admin Dashboard & Reports:
  const statusCount = Object.fromEntries(
    ['pending','assigned','picked_up','in_transit','delivered','cancelled']
    .map(s => [s, orders.filter(o => o.status === s).length])
  )

  // Top Performing Couriers — Admin Reports:
  const topCouriers = users
    .filter(u => u.role === 'courier')
    .map(courier => ({
      ...courier,
      ordersDelivered: orders.filter(o =>
        o.courier_id === courier.id && o.status === 'delivered').length,
      revenueGenerated: earnings.filter(e =>
        e.courier_id === courier.id)
        .reduce((sum, e) => sum + e.courier_amount, 0)
    }))
    .sort((a, b) => b.ordersDelivered - a.ordersDelivered)

  // Daily Earnings Chart — Courier Earnings:
  const earningsByDay = earnings
    .filter(e => e.courier_id === currentUser.id)
    .reduce((acc, e) => {
      const day = getDayOfWeek(e.earned_at)
      acc[day] = (acc[day] || 0) + e.courier_amount
      return acc
    }, {})

====================================================================
  DAFTAR BUG YANG HARUS DIPERBAIKI (PRIORITAS URUT)
====================================================================

BUG #1 [KRITIS] — History & Earnings Kurir Tidak Terhubung:
  File: src/pages/courier/History.tsx
        src/pages/courier/Earnings.tsx
  Masalah: Kedua file menggunakan mock data lokal hardcoded.
  Solusi:
    - Hapus semua data dummy lokal dari kedua komponen.
    - History: filter orders[] dari store dimana
        order.courier_id === currentUser.id
        AND order.status === 'delivered' OR 'cancelled'
      Kelompokkan hasil berdasarkan tanggal (group by date).
    - Earnings: filter earnings[] dari store dimana
        earning.courier_id === currentUser.id
      Hitung total berdasarkan periode (today/week/month)
      menggunakan kalkulasi dari data aktual.
    - VALIDASI: Setelah perbaikan, order Nasrul Jihadi
      (ORD-20260218-007) HARUS muncul di History dan Earnings
      Budi Santoso segera setelah order berstatus Delivered.

BUG #2 [KRITIS] — Profile Kurir Menampilkan Data Placeholder:
  File: src/pages/courier/Profile.tsx
  Masalah: Menampilkan nama 'Courier', email 'courier@delivery.com'
  Solusi:
    - Baca data dari AuthContext: const { currentUser } = useAuth()
    - Tampilkan currentUser.name, currentUser.email, currentUser.phone
    - Form edit profil harus update UserStore dengan ID yang sesuai

BUG #3 [KRITIS] — Semua Chart Menggunakan Data Tidak Stabil:
  File: Semua komponen chart di Admin dan Courier PWA
  Masalah: Angka chart berubah antar sesi tanpa transaksi baru.
           Dikonfirmasi oleh pengguna iOS (laporan langsung).
  Solusi:
    - Audit seluruh komponen chart, identifikasi semua sumber data
      yang bukan berasal dari store (Zustand).
    - Hapus semua fungsi generator/randomizer mock data.
    - Implementasikan kalkulasi dinamis dari store seperti
      pola yang dijelaskan di PERINTAH WAJIB #4 di atas.
    - Pastikan chart subscribe ke store dan re-render otomatis
      saat data di store berubah.

BUG #4 [TINGGI] — Summary Cards Couriers Page Tidak Sinkron:
  File: src/pages/admin/Couriers.tsx
  Solusi:
    totalDeliveries = orders.filter(o =>
      o.courier_id === courier.id &&
      o.status === 'delivered').length
    totalEarnings = earnings.filter(e =>
      e.courier_id === courier.id)
      .reduce((sum, e) => sum + e.courier_amount, 0)

BUG #5 [TINGGI] — Rasio Split Earnings 80% Hardcoded:
  Solusi:
    - Tambahkan field commission_rate (number) pada Courier entity.
    - Saat order Delivered, buat entri di earnings[]:
        { order_id, courier_id,
          order_fee: order.total_fee,
          courier_amount: order.total_fee * (courier.commission_rate/100),
          platform_fee: order.total_fee * (1 - courier.commission_rate/100),
          earned_at: new Date().toISOString()
        }
    - Admin bisa edit commission_rate per kurir di Courier Detail.

BUG #6 [SEDANG] — Dua Entry Point Add Courier:
  Solusi: Pastikan +Add Courier dan +Add User (Settings, role=courier)
          memanggil action yang SAMA di UserStore dan CourierStore.

BUG #7 [SEDANG] — payment_status Tidak Ada di Form New Order:
  Solusi: Tambahkan field payment_status (select: unpaid/paid)
          dengan default 'unpaid' ke modal New Order.

====================================================================
  VALIDASI WAJIB SETELAH PERBAIKAN
====================================================================

SKENARIO A — End-to-End Order Flow:
  1. Login Admin, buat order baru untuk 'Test User'
  2. Assign ke Kurir Budi Santoso
  3. Login Kurir (budi@courier.com), cek: order muncul di Home
  4. Kurir proses: Picked Up > In Transit > Delivered
  5. Cek History Kurir: order 'Test User' HARUS muncul
  6. Cek Earnings Kurir Today: nominal order HARUS muncul
  7. Login Admin, cek Dashboard: status order HARUS updated
  8. Cek Reports > Top Couriers: angka Budi HARUS bertambah
  9. Cek semua chart: angka HARUS konsisten dengan langkah 1-8

SKENARIO B — Chart Consistency Check:
  1. Catat semua angka di chart Admin Dashboard
  2. Refresh halaman (Ctrl+R / Cmd+R)
  3. Angka di chart HARUS SAMA persis dengan sebelum refresh
  4. Tidak boleh ada perubahan angka tanpa transaksi baru
  5. Lakukan di tiga browser berbeda — hasilnya harus identik

SKENARIO C — Cross-Device Consistency (iOS Report Fix):
  1. Buka Admin Reports di Desktop
  2. Buka Courier Earnings di perangkat iOS (atau browser kedua)
  3. Orders Today di Earnings HARUS sesuai jumlah order
     yang benar-benar diproses hari ini
  4. Revenue di Reports HARUS sesuai dengan kalkulasi
     dari order yang berstatus 'delivered'

SKENARIO D — Data Integrity Check:
  - Tidak boleh ada komponen yang merender data dari variabel
    lokal/konstanta yang didefinisikan di dalam file komponen itu
    sendiri (kecuali nilai UI: label, warna badge, teks tombol).
  - Setiap angka yang ditampilkan HARUS bisa di-trace ke store.

SKENARIO E — Profile Accuracy:
  - Login Budi -> Profile tampilkan "Budi Santoso", budi@courier.com
  - Login Siti -> Profile tampilkan "Siti Aminah", siti@courier.com
  - Tidak boleh ada data yang sama di dua akun berbeda.

====================================================================
  CATATAN TEKNIS
====================================================================

- Gunakan istilah "Foreign Key Consistency" dalam komentar kode
  untuk setiap relasi antar entitas.
- Terapkan Data Normalization: satu data hanya disimpan di satu
  tempat, halaman lain mengambil via relasi ID.
- Semua perubahan state harus propagasi via Zustand store
  sehingga Cross-page Data Sync terjamin otomatis.
- Chart components HARUS menggunakan useMemo() atau computed values
  yang di-derive dari store state, bukan dari data lokal.
- Saat migrasi ke backend nanti, hanya perlu mengganti
  implementasi store action dengan API call — struktur data
  tidak perlu berubah.

====================================================================
```

---

## 5. Checklist Verifikasi Pasca Perbaikan

| # | Item Verifikasi | Status |
|---|----------------|--------|
| 1 | Order baru muncul di Home Kurir setelah di-assign Admin | `[ ]` |
| 2 | Order Nasrul Jihadi (ORD-20260218-007) muncul di History Kurir Budi | `[ ]` |
| 3 | Earnings kurir dihitung dari order nyata, bukan data dummy | `[ ]` |
| 4 | Profile Kurir menampilkan nama & email sesuai akun login | `[ ]` |
| 5 | Summary cards Couriers page menampilkan angka yang akurat | `[ ]` |
| 6 | Status order di Admin berubah otomatis setelah Kurir update | `[ ]` |
| 7 | Tidak ada data dummy hardcoded di `History.tsx` | `[ ]` |
| 8 | Tidak ada data dummy hardcoded di `Earnings.tsx` | `[ ]` |
| 9 | Chart **tidak berubah** setelah browser di-refresh tanpa transaksi baru | `[ ]` |
| 10 | Angka chart **identik** di Desktop dan perangkat iOS | `[ ]` |
| 11 | Top Couriers di Reports konsisten dengan data Courier Detail | `[ ]` |
| 12 | Revenue di Reports dapat diverifikasi ke transaksi aktual | `[ ]` |
| 13 | `payment_status` tersedia di form New Order | `[ ]` |
| 14 | Add Courier dan Add User (Settings) menulis ke store yang sama | `[ ]` |
| 15 | `commission_rate` dapat dikonfigurasi per kurir di Admin | `[ ]` |

---

*Dokumen ini digenerate berdasarkan analisis screenshot KurirDev v1.0 + laporan langsung pengguna iOS — 18 Februari 2026*  
*Versi sebelumnya: v1.0 (format .docx)*
