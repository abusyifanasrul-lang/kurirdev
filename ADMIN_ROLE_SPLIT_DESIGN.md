# Admin Role Split Design - KurirDev

## Daftar Isi

- [Overview](#overview)
- [Current State Analysis](#current-state-analysis)
- [Target Architecture](#target-architecture)
- [Role Definitions](#role-definitions)
- [UI/UX Design per Role](#uiux-design-per-role)
- [Navigation Structure](#navigation-structure)
- [Permission Matrix](#permission-matrix)
- [Data Access Control](#data-access-control)
- [Implementation Plan](#implementation-plan)
- [Technical Considerations](#technical-considerations)

---

## Overview

### Problem Statement

Saat ini KurirDev memiliki satu tipe admin (`role: 'admin'`) yang mengakses semua fitur:
- Dashboard analytics
- Order management & courier assignment
- Courier management
- Reports
- Notifications
- Settings (termasuk business config)

Dalam operasional bisnis kurir yang berkembang, terdapat **3 persona berbeda** dengan kebutuhan yang sangat berbeda:

| Persona | Fokus Utama | Yang Dibutuhkan |
|---------|-------------|-----------------|
| **Admin Kurir** | Operasional harian | Order masuk, assign kurir, monitor status |
| **Owner** | Visibilitas bisnis | KPI, tren, performa kurir, keputusan strategis |
| **Bagian Keuangan** | Keuangan & penagihan | Setoran kurir, analisa keuangan, laporan fiskal |

Memberikan akses penuh ke semua fitur untuk ketiganya:
- Membingungkan (terlalu banyak fitur yang tidak relevan)
- Berisiko keamanan (bagian keuangan tidak perlu ubah settings)
- Tidak efisien (owner tidak perlu lihat setiap order satu per satu)

---

## Current State Analysis

### Existing Admin Pages

| Page | Current Features | Relevansi per Persona |
|------|------------------|----------------------|
| **Dashboard** | Stats hari ini, revenue chart, courier queue, status pie | Owner (KPI), Admin Kurir (queue) |
| **Orders** | CRUD order, assign kurir, filter status, edit fee | Admin Kurir (primary), Finance (read) |
| **Couriers** | List kurir, performa, settle unpaid, tambah kurir | Admin Kurir (manage), Finance (settle), Owner (performance) |
| **Reports** | Date range filter, revenue chart, top courier, export PDF | Owner (primary), Finance (primary) |
| **Notifications** | Kirim notifikasi ke kurir | Admin Kurir (primary) |
| **Settings** | Profile, password, user management, business config, instructions | Owner (config), Admin Kurir (profile) |

### Current User Type

```typescript
// types/index.ts
interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'courier';  // ← Hanya 2 role
  // ...
}
```

---

## Target Architecture

### Role Hierarchy

```
                    ┌─────────────────┐
                    │   Super Admin   │  ← (Opsional) Akses penuh, manage semua
                    │   (owner awal)  │
                    └────────┬────────┘
                             │
          ┌──────────────────┼──────────────────┐
          │                  │                  │
          ▼                  ▼                  ▼
  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐
  │  admin_kurir  │  │    owner      │  │    finance    │
  │               │  │               │  │               │
  │ • Order mgmt  │  │ • Dashboard   │  │ • Settlement  │
  │ • Assignment  │  │ • Analytics   │  │ • Financial   │
  │ • Courier ops │  │ • Reports     │  │   reports     │
  │ • Notifikasi  │  │ • Performance │  │ • Penagihan   │
  └───────────────┘  └───────────────┘  └───────────────┘
```

### Updated User Type

```typescript
// types/index.ts - Updated
type UserRole = 'admin_kurir' | 'owner' | 'finance' | 'courier';

interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  // ...existing fields
}
```

### Route Structure

```
/login                      → Login (pilih role)

/admin                      → Redirect ke dashboard sesuai sub-role
/admin/dashboard            → Shared dashboard (filtered per role)
/admin/orders               → Admin Kurir & Finance (read)
/admin/couriers             → Admin Kurir & Owner & Finance (settle)
/admin/reports              → Owner & Finance
/admin/finance              → Finance专属 (settlement, penagihan)
/admin/notifications        → Admin Kurir only
/admin/settings             → Owner only

/courier                    → Courier layout (unchanged)
```

---

## Role Definitions

### 1. Admin Kurir (Operations Admin)

**Persona:** Staff operasional yang mengelola order harian dan assign kurir.

**Responsibilities:**
- Menerima order masuk dari WhatsApp (input manual)
- Assign kurir berdasarkan antrian FIFO atau manual
- Monitor status pengiriman real-time
- Kirim notifikasi/instruksi ke kurir
- Handle order batal dan komplain
- Kelola data kurir (tambah, nonaktifkan, update info)

**Key Workflows:**
1. Order masuk → Input ke sistem → Assign kurir → Monitor → Selesai
2. Kurir tidak tersedia → Re-assign ke kurir lain
3. Order batal → Update status → Catat alasan

---

### 2. Owner (Business Owner)

**Persona:** Pemilik bisnis yang ingin melihat performa bisnis secara keseluruhan.

**Responsibilities:**
- Monitor KPI bisnis (revenue, order volume, success rate)
- Analisa performa kurir (siapa terbaik, siapa perlu coaching)
- Lihat tren bisnis (harian, mingguan, bulanan)
- Export laporan untuk analisa lebih lanjut
- Konfigurasi pengaturan bisnis (komisi, threshold)
- Kelola user admin (tambah admin kurir, finance)

**Key Workflows:**
1. Buka dashboard → Lihat KPI hari ini → Bandingkan dengan kemarin
2. Weekly review → Lihat tren 7 hari → Identifikasi pola
3. Monthly review → Export laporan → Review dengan tim

---

### 3. Bagian Keuangan (Finance)

**Persona:** Staff keuangan yang menangani penagihan setoran kurir dan analisa fiskal.

**Responsibilities:**
- Monitor setoran kurir (siapa yang belum setor)
- Proses konfirmasi pembayaran/setoran kurir
- Lihat detail transaksi per kurir
- Analisa pendapatan bersih (setelah komisi kurir)
- Export laporan keuangan
- Rekonsiliasi pembayaran

**Key Workflows:**
1. Cek unpaid orders → Tagih kurir → Konfirmasi setoran → Update status
2. Daily closing → Hitung total revenue vs setoran masuk
3. Monthly report → Export laporan keuangan → Serahkan ke owner

---

## UI/UX Design per Role

### 1. Admin Kurir - UI/UX

#### Design Philosophy
- **Fokus:** Kecepatan & efisiensi operasional
- **Warna dominan:** Indigo (existing brand)
- **Layout:** Dashboard ringkas + aksi cepat
- **Mobile:** Sangat penting (admin bisa mobile)

#### Dashboard View

```
┌─────────────────────────────────────────────────────────────┐
│  📦 Orders Hari Ini    🚗 Kurir Online    ⏳ Pending        │
│      47 orders            12 kurir          8 orders        │
│      ▲ +12%              ▲ +3              ▼ -2            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─── Courier Queue ─────────────────────────────────────┐ │
│  │  #1  Budi Santoso    🚀 ON     ⏳ Menunggu P290326001 │ │
│  │  #2  Siti Aminah     🚀 ON                              │ │
│  │  #3  Agus Pratama    🏠 STAY                            │ │
│  │  ─── Offline ──────────────────────────────────────    │ │
│  │  —   Dewi Lestari    ❌ OFF (Sakit)                     │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌─── Pending Orders (8) ───────────────────────────────┐ │
│  │  P290326045  Bpk. Ahmad  Rp 12.000  [Assign →]       │ │
│  │  P290326044  Ibu Sari   Rp  8.000  [Assign →]        │ │
│  │  P290326043  Toko ABC   Rp 25.000  [Assign →]        │ │
│  │  ...                                                   │ │
│  │  [Lihat Semua Orders →]                                │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌─── Active Deliveries (15) ───────────────────────────┐  │
│  │  P290326040  Budi    📍 In Transit    → Jl. Sudirman  │  │
│  │  P290326038  Siti    📦 Picked Up     → Jl. Gatot     │  │
│  │  ...                                                   │  │
│  │  [Lihat Semua Active →]                                │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌─── Quick Actions ────────────────────────────────────┐  │
│  │  [+ Order Baru]  [Assign Massal]  [Kirim Notifikasi] │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

#### Orders Page (Admin Kurir)

```
┌─────────────────────────────────────────────────────────────┐
│  Orders                                     [+ Order Baru]  │
│  [Semua] [Pending] [Assigned] [In Transit] [Done] [Cancel] │
├─────────────────────────────────────────────────────────────┤
│  🔍 Cari order...                    [Filter ▼] [Urutkan ▼]│
├──────┬──────────┬────────────┬─────────┬────────┬──────────┤
│ No.  │ Customer │ Kurir      │ Status  │ Fee    │ Aksi     │
├──────┼──────────┼────────────┼─────────┼────────┼──────────┤
│ 045  │ Bpk Ahmd │ (unassign) │ Pending │ 12.000 │[Assign]  │
│ 044  │ Ibu Sari │ (unassign) │ Pending │  8.000 │[Assign]  │
│ 040  │ Toko ABC │ Budi       │ Transit │ 15.000 │[Detail]  │
│ 038  │ Cv Maju  │ Siti       │ Picked  │ 20.000 │[Detail]  │
└──────┴──────────┴────────────┴─────────┴────────┴──────────┘
```

#### Key UX Features untuk Admin Kurir:
1. **One-click assign:** Tombol assign langsung dari list, dengan dropdown kurir available
2. **Drag & drop assign:** (opsional) Drag order ke kurir di queue
3. **Keyboard shortcuts:** N untuk order baru, A untuk assign, S untuk search
4. **Real-time badge:** Badge merah di tab saat ada order baru masuk
5. **Sound alert:** Notifikasi suara saat order baru masuk
6. **Mobile-first order form:** Form input order yang mudah di mobile

---

### 2. Owner - UI/UX

#### Design Philosophy
- **Fokus:** Data visualization & business insights
- **Warna dominan:** Emerald/Green (melambangkan growth & money)
- **Layout:** Dashboard-heavy, charts, KPIs
- **Mobile:** Nice to have (owner cek di HP kadang-kadang)

#### Dashboard View

```
┌─────────────────────────────────────────────────────────────┐
│  📊 Business Overview                     Periode: Hari Ini │
│  [Hari Ini] [7 Hari] [30 Hari] [Custom]                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐       │
│  │ Revenue │  │ Orders  │  │ Success │  │ Active  │       │
│  │ Rp 4.5M │  │   47    │  │  94.2%  │  │ 12 kurir│       │
│  │ ▲ 12%   │  │ ▲ 8%    │  │ ▲ 2.1%  │  │ ▲ 3     │       │
│  │ vs kmrn │  │ vs kmrn │  │ vs kmrn │  │ vs kmrn │       │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘       │
│                                                             │
│  ┌─── Revenue Trend (30 hari) ──────────────────────────┐  │
│  │     📈                                              │  │
│  │    ╱╲    ╱╲                                         │  │
│  │   ╱  ╲  ╱  ╲   ╱╲                                  │  │
│  │  ╱    ╲╱    ╲ ╱  ╲╱╲                               │  │
│  │ ╱              ╲    ╲                               │  │
│  │ [1 Mar] [8 Mar] [15 Mar] [22 Mar] [29 Mar]          │  │
│  └────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌─── Top Performers ──────┐  ┌─── Order Distribution ──┐ │
│  │  🥇 Budi    156 orders  │  │      ┌───┐              │ │
│  │     Rp 2.1M earnings    │  │   ┌──┤Del├──┐           │ │
│  │  🥈 Siti    142 orders  │  │   │  └───┘  │           │ │
│  │     Rp 1.9M earnings    │  │ Can       Transit       │ │
│  │  🥉 Agus    98 orders   │  │  4%        12%          │ │
│  │     Rp 1.3M earnings    │  │                          │ │
│  └─────────────────────────┘  └──────────────────────────┘ │
│                                                             │
│  ┌─── Key Insights ─────────────────────────────────────┐  │
│  │  • Rata-rata 47 order/hari (▲ dari 42 minggu lalu)   │  │
│  │  • Kurir Budi paling produktif (156 order bulan ini)  │  │
│  │  • Cancel rate turun dari 8% ke 4%                    │  │
│  │  • Revenue bulan ini: Rp 127.5M (▲ 15% MoM)          │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

#### Reports Page (Owner)

```
┌─────────────────────────────────────────────────────────────┐
│  📊 Business Reports                                        │
│  Periode: [01 Mar 2026] s/d [29 Mar 2026]  [Export PDF]    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─── Ringkasan Bisnis ─────────────────────────────────┐  │
│  │  Total Orders: 1,247    Revenue Kotor: Rp 156.8M     │  │
│  │  Avg/Hari: 43           Revenue Bersih: Rp 31.4M     │  │
│  │  Success Rate: 94.2%    Komisi Kurir: Rp 125.4M      │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌─── Daily Revenue Chart ──────────────────────────────┐  │
│  │  [Bar chart harian untuk 30 hari]                     │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌─── Kurir Leaderboard ────────────────────────────────┐  │
│  │  #  Nama          Orders  Revenue    Earnings  Rating│  │
│  │  1  Budi Santoso   156    Rp 19.5M   Rp 15.6M  ⭐4.8 │  │
│  │  2  Siti Aminah    142    Rp 17.8M   Rp 14.2M  ⭐4.7 │  │
│  │  3  Agus Pratama    98    Rp 12.3M   Rp  9.8M  ⭐4.5 │  │
│  │  4  Dewi Lestari    87    Rp 10.9M   Rp  8.7M  ⭐4.6 │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  [Export Laporan PDF] [Export CSV] [Kirim ke Email]         │
└─────────────────────────────────────────────────────────────┘
```

#### Key UX Features untuk Owner:
1. **Period comparison:** Setiap KPI dibandingkan dengan periode sebelumnya
2. **Drill-down:** Klik KPI → Lihat detail breakdown
3. **Insights/Alerts:** Notifikasi otomatis jika ada anomali (cancel rate naik, revenue turun)
4. **Exportable:** Semua data bisa di-export ke PDF/CSV
5. **Scheduled reports:** (opsional) Auto-email laporan mingguan/bulanan

---

### 3. Bagian Keuangan - UI/UX

#### Design Philosophy
- **Fokus:** Akurasi, penagihan, dan rekonsiliasi
- **Warna dominan:** Amber/Gold (melambangkan uang & keuangan)
- **Layout:** Table-heavy, detail transaksi, status pembayaran
- **Mobile:** Penting (konfirmasi pembayaran bisa di lapangan)

#### Dashboard View (Finance Home)

```
┌─────────────────────────────────────────────────────────────┐
│  💰 Keuangan Dashboard                  Periode: Hari Ini   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ Total    │  │ Sudah    │  │ Belum    │  │ Setoran  │   │
│  │ Tagihan  │  │ Disetor  │  │ Disetor  │  │ Hari Ini │   │
│  │ Rp 12.4M │  │ Rp 8.2M  │  │ Rp 4.2M  │  │ 5 kurir  │   │
│  │ 23 order │  │ 15 order │  │ 8 order  │  │          │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
│                                                             │
│  ┌─── Tagihan per Kurir (Belum Lunas) ──────────────────┐  │
│  │                                                       │  │
│  │  ⚠️ Budi Santoso         Rp 1.850.000   5 order      │  │
│  │     Terakhir setor: 2 hari lalu                       │  │
│  │     [Lihat Detail] [Konfirmasi Setoran]               │  │
│  │                                                       │  │
│  │  ⚠️ Agus Pratama         Rp 890.000    3 order       │  │
│  │     Terakhir setor: 1 hari lalu                       │  │
│  │     [Lihat Detail] [Konfirmasi Setoran]               │  │
│  │                                                       │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌─── Setoran Hari Ini ─────────────────────────────────┐  │
│  │  ✅ Siti Aminah    Rp 1.2M   10:30  [Konfirmasi ✓]   │  │
│  │  ✅ Dewi Lestari   Rp 980K   11:45  [Konfirmasi ✓]   │  │
│  │  ⏳ Rudi Hermawan  Rp 1.5M   14:00  [Konfirmasi →]   │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌─── Quick Actions ────────────────────────────────────┐  │
│  │  [Konfirmasi Setoran]  [Tagih Kurir]  [Export Laporan]│  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

#### Penagihan Page (Finance)

```
┌─────────────────────────────────────────────────────────────┐
│  💵 Penagihan Setoran                                       │
│  [Belum Lunas] [Sudah Lunas] [Semua]                        │
├─────────────────────────────────────────────────────────────┤
│  🔍 Cari kurir...                    [Filter Periode ▼]     │
├──────┬──────────────┬───────────┬────────┬────────┬────────┤
│ #    │ Kurir        │ Total     │ Order  │ Status │ Aksi   │
├──────┼──────────────┼───────────┼────────┼────────┼────────┤
│  1   │ Budi Santoso │ Rp 1.85M  │ 5      │ ⚠️ Belum│[Tagih] │
│  2   │ Agus Pratama │ Rp 890K   │ 3      │ ⚠️ Belum│[Tagih] │
│  3   │ Siti Aminah  │ Rp 0      │ 0      │ ✅ Lunas│[Detail]│
│  4   │ Dewi Lestari │ Rp 0      │ 0      │ ✅ Lunas│[Detail]│
└──────┴──────────────┴───────────┴────────┴────────┴────────┘
```

#### Konfirmasi Setoran Modal

```
┌─────────────────────────────────────────────────┐
│  Konfirmasi Setoran - Budi Santoso              │
├─────────────────────────────────────────────────┤
│                                                 │
│  Total Tagihan: Rp 1.850.000 (5 order)          │
│                                                 │
│  Detail Order yang Belum Disetor:               │
│  ┌──────────┬──────────┬──────────┬──────────┐  │
│  │ Order    │ Tanggal  │ Fee      │ Earning  │  │
│  ├──────────┼──────────┼──────────┼──────────┤  │
│  │ P290326  │ 29 Mar   │ Rp 15K   │ Rp 12K   │  │
│  │ P280326  │ 28 Mar   │ Rp 20K   │ Rp 16K   │  │
│  │ P270326  │ 27 Mar   │ Rp 12K   │ Rp 9.6K  │  │
│  │ P270326  │ 27 Mar   │ Rp 18K   │ Rp 14.4K │  │
│  │ P260326  │ 26 Mar   │ Rp 25K   │ Rp 20K   │  │
│  └──────────┴──────────┴──────────┴──────────┘  │
│                                                 │
│  Jumlah Diterima: [________________] Rp         │
│  Metode: [Transfer ▼] [Cash] [E-Wallet]         │
│  Catatan: [________________________]            │
│                                                 │
│        [Batal]  [Konfirmasi Setoran ✓]          │
└─────────────────────────────────────────────────┘
```

#### Financial Analysis Page (Finance)

```
┌─────────────────────────────────────────────────────────────┐
│  📈 Analisa Keuangan              Periode: [Maret 2026 ▼]  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─── Ringkasan Fiskal ─────────────────────────────────┐  │
│  │  Pendapatan Kotor:     Rp 156.800.000                 │  │
│  │  Komisi Kurir:         Rp 125.440.000  (80%)          │  │
│  │  Pendapatan Bersih:    Rp  31.360.000  (20%)          │  │
│  │  ─────────────────────────────────────                │  │
│  │  Setoran Masuk:        Rp 118.200.000  (94.2%)        │  │
│  │  Belum Disetor:        Rp  7.240.000  (5.8%)          │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌─── Tren Pendapatan Bersih (Bulanan) ────────────────┐   │
│  │  [Line chart: Net revenue per bulan]                  │   │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌─── Setoran vs Tagihan (Harian) ─────────────────────┐   │
│  │  [Stacked bar: Tagihan vs Setoran per hari]           │   │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌─── Aging Report (Umur Piutang) ─────────────────────┐   │
│  │  0-3 hari:   Rp 2.1M  (3 kurir)    ✅ Normal         │   │
│  │  4-7 hari:   Rp 3.8M  (2 kurir)    ⚠️ Perlu follow   │   │
│  │  8-14 hari:  Rp 1.2M  (1 kurir)    🔴 Urgent         │   │
│  │  15+ hari:   Rp 140K  (0 kurir)    —                 │   │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  [Export Laporan Excel] [Export PDF] [Kirim Email]          │
└─────────────────────────────────────────────────────────────┘
```

#### Key UX Features untuk Finance:
1. **Color-coded status:** Hijau = lunas, Kuning = belum, Merah = overdue
2. **One-tap confirm:** Konfirmasi setoran dalam 1 tap di mobile
3. **Aging alerts:** Notifikasi otomatis jika ada piutang > 7 hari
4. **Split payment:** Support konfirmasi setoran sebagian
5. **Receipt generation:** Auto-generate bukti setoran setelah konfirmasi
6. **Reconciliation view:** Bandingkan sistem vs real cash flow

---

## Navigation Structure

### Admin Kurir Navigation

```
┌─────────────────────────────────┐
│  🚚 KurirDev                    │
│  ─────────────────────────────  │
│  📊 Dashboard                   │  ← Ringkasan operasional
│  📦 Orders                      │  ← CRUD & assign
│  👥 Couriers                    │  ← Manage kurir & queue
│  🔔 Notifications               │  ← Kirim notifikasi
│  ─────────────────────────────  │
│  ⚙️ Settings                    │  ← Profile only
│  🚪 Sign Out                    │
└─────────────────────────────────┘
```

### Owner Navigation

```
┌─────────────────────────────────┐
│  🚚 KurirDev                    │
│  ─────────────────────────────  │
│  📊 Business Overview           │  ← KPI dashboard
│  📈 Reports                     │  ← Analytics & trends
│  👥 Couriers                    │  ← Performance view
│  ─────────────────────────────  │
│  ⚙️ Settings                    │  ← Business config + users
│  🚪 Sign Out                    │
└─────────────────────────────────┘
```

### Finance Navigation

```
┌─────────────────────────────────┐
│  🚚 KurirDev                    │
│  ─────────────────────────────  │
│  💰 Keuangan                    │  ← Settlement dashboard
│  💵 Penagihan                   │  ← Unpaid & collection
│  📈 Analisa Keuangan            │  ← Financial reports
│  📦 Orders (Read-Only)          │  ← Reference data
│  ─────────────────────────────  │
│  ⚙️ Settings                    │  ← Profile only
│  🚪 Sign Out                    │
└─────────────────────────────────┘
```

---

## Permission Matrix

### Feature Access Matrix

| Feature | Admin Kurir | Owner | Finance |
|---------|:-----------:|:-----:|:-------:|
| **Dashboard** | ✅ (ops) | ✅ (biz) | ✅ (finance) |
| **View Orders** | ✅ Full | ✅ Read | ✅ Read |
| **Create Order** | ✅ | ❌ | ❌ |
| **Edit Order** | ✅ | ❌ | ❌ |
| **Delete/Cancel Order** | ✅ | ❌ | ❌ |
| **Assign Courier** | ✅ | ❌ | ❌ |
| **View Couriers** | ✅ Full | ✅ Performance | ✅ Payment status |
| **Add/Edit Courier** | ✅ | ✅ | ❌ |
| **Settle Payment** | ❌ | ❌ | ✅ |
| **Reports** | ❌ | ✅ Full | ✅ Financial |
| **Export PDF** | ❌ | ✅ | ✅ |
| **Notifications** | ✅ Send | ❌ | ❌ |
| **Business Settings** | ❌ | ✅ | ❌ |
| **User Management** | ❌ | ✅ | ❌ |
| **Commission Config** | ❌ | ✅ | ❌ |
| **Password Change** | ✅ Own | ✅ Own | ✅ Own |

### Firestore Access Matrix

| Collection | Admin Kurir | Owner | Finance |
|------------|:-----------:|:-----:|:-------:|
| `users` | Read all, Write couriers | Read/Write all | Read all |
| `orders` | Read/Write all | Read all | Read (payment_status) |
| `tracking_logs` | Read/Write | Read | Read |
| `customers` | Read/Write | Read | Read |
| `notifications` | Write | Read | Read |
| `settings/business` | Read | Read/Write | Read |

---

## Data Access Control

### Firestore Security Rules (Updated)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isAuthenticated() {
      return request.auth != null;
    }

    function getUserRole() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role;
    }

    function isAdminKurir() {
      return getUserRole() == 'admin_kurir';
    }

    function isOwner() {
      return getUserRole() == 'owner';
    }

    function isFinance() {
      return getUserRole() == 'finance';
    }

    function isAdmin() {
      return isAdminKurir() || isOwner() || isFinance();
    }

    // Users collection
    match /users/{userId} {
      allow read: if isAuthenticated() && isAdmin();

      allow create: if isAuthenticated() && (
        isOwner() ||  // Owner bisa create semua user
        isAdminKurir()  // Admin kurir bisa create courier
        && request.resource.data.role == 'courier'
      );

      allow update: if isAuthenticated() && (
        // User bisa update diri sendiri (limited fields)
        request.auth.uid == userId
        && request.write.fields().hasOnly(['name', 'phone', 'password', 'updated_at'])
      ) || (
        // Owner bisa update semua
        isOwner()
      ) || (
        // Admin kurir bisa update courier
        isAdminKurir()
        && resource.data.role == 'courier'
      );

      allow delete: if false; // Soft delete only
    }

    // Orders collection
    match /orders/{orderId} {
      allow read: if isAuthenticated() && isAdmin();

      allow create: if isAuthenticated() && isAdminKurir();

      allow update: if isAuthenticated() && (
        isAdminKurir() ||  // Full update
        (isFinance() && request.write.fields().hasOnly(['payment_status', 'updated_at']))
        // Finance hanya bisa update payment_status
      );

      allow delete: if false;
    }

    // Tracking logs
    match /tracking_logs/{logId} {
      allow read: if isAuthenticated() && isAdmin();
      allow create: if isAuthenticated() && isAdminKurir();
      allow update, delete: if false;
    }

    // Settings
    match /settings/{settingId} {
      allow read: if isAuthenticated() && isAdmin();
      allow write: if isAuthenticated() && isOwner();
    }

    // Notifications
    match /notifications/{notifId} {
      allow read: if isAuthenticated() && isAdmin();
      allow create: if isAuthenticated() && isAdminKurir();
      allow update: if isAuthenticated() && resource.data.user_id == request.auth.uid;
      allow delete: if false;
    }
  }
}
```

---

## Implementation Plan

### Phase 1: Foundation (Week 1-2)

| Task | Description | Est. |
|------|-------------|------|
| Update User type | Tambah `admin_kurir`, `owner`, `finance` ke type | 0.5 hari |
| Update Login flow | Validasi sub-role, redirect ke dashboard yang sesuai | 1 hari |
| Update Firestore seed | Tambah user demo untuk 3 sub-role | 0.5 hari |
| Create role-based sidebar | Sidebar berbeda per sub-role | 1 hari |
| Update ProtectedRoute | Support multiple admin sub-roles | 0.5 hari |

### Phase 2: Admin Kurir Refinement (Week 2-3)

| Task | Description | Est. |
|------|-------------|------|
| Refine Dashboard | Fokus pada operasional (queue, pending, active) | 1 hari |
| Quick assign feature | One-click assign dari pending orders | 1 hari |
| Sound alert | Notifikasi suara saat order baru | 0.5 hari |
| Mobile optimization | Perbaiki UX untuk mobile admin | 1 hari |

### Phase 3: Owner Dashboard (Week 3-4)

| Task | Description | Est. |
|------|-------------|------|
| Business Overview page | KPI cards, revenue chart, trends | 2 hari |
| Kurir Leaderboard | Top performers, ranking | 1 hari |
| Enhanced Reports | Business-focused analytics | 1 hari |
| Settings restriction | Hanya owner yang bisa akses business config | 0.5 hari |

### Phase 4: Finance Module (Week 4-5)

| Task | Description | Est. |
|------|-------------|------|
| Keuangan Dashboard | Settlement overview, tagihan per kurir | 2 hari |
| Penagihan page | List unpaid, konfirmasi setoran flow | 2 hari |
| Financial Analysis | Net revenue, aging report, trends | 2 hari |
| Export functionality | Export laporan keuangan ke PDF/Excel | 1 hari |

### Phase 5: Polish & Testing (Week 5-6)

| Task | Description | Est. |
|------|-------------|------|
| Firestore rules update | Implementasi permission matrix | 1 hari |
| Cross-role testing | Test semua flow per role | 2 hari |
| UI polish | Consistent styling, responsive design | 1 hari |
| Documentation | Update user guide per role | 1 hari |

---

## Technical Considerations

### 1. Backward Compatibility

**Challenge:** Existing users memiliki `role: 'admin'`.

**Solution:**
```typescript
// Migration strategy
// 1. Tambah role baru tanpa hapus 'admin'
type UserRole = 'admin' | 'admin_kurir' | 'owner' | 'finance' | 'courier';

// 2. Treat 'admin' sebagai 'owner' (super admin) untuk backward compat
function getEffectiveRole(user: User): SubAdminRole {
  if (user.role === 'admin') return 'owner';  // Legacy admin = owner
  return user.role;
}

// 3. Migration script: update existing admin users
// admin@delivery.com → role: 'owner'
// ops@delivery.com → role: 'admin_kurir'
```

### 2. Role-Based Route Configuration

```typescript
// App.tsx - Updated routing
const ROLE_ROUTES: Record<string, string> = {
  admin_kurir: '/admin/dashboard',
  owner: '/admin/overview',
  finance: '/admin/finance',
};

// Login redirect
const getRedirectPath = (role: string) => {
  if (role === 'courier') return '/courier';
  return ROLE_ROUTES[role] || '/admin/dashboard';
};
```

### 3. Shared Components

Beberapa komponen bisa di-share antar role dengan data yang difilter:

| Component | Admin Kurir View | Owner View | Finance View |
|-----------|------------------|------------|--------------|
| Orders list | Full CRUD | Read-only summary | Read-only + payment status |
| Courier list | Management view | Performance view | Payment status view |
| Dashboard | Operational KPI | Business KPI | Financial KPI |

### 4. Role Indicator di UI

Tambahkan visual indicator untuk menunjukkan role aktif:

```
┌─────────────────────────────────┐
│  🚚 KurirDev                    │
│  ─────────────────────────────  │
│  Role: Admin Kurir              │  ← Badge/indicator
│  [Ganti Role ▼]                 │  ← Jika user punya multiple roles
└─────────────────────────────────┘
```

---

*Dokumen desain untuk fitur Admin Role Split - KurirDev.*
*Dibuat: 29 Maret 2026*
