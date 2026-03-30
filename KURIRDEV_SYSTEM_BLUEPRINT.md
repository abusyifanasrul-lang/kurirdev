# 🛵 KurirDev — Delivery Management System
## Blueprint & Frontend Design Schema

> **Versi:** 3.0 (Masterpiece Enterprise Edition)
> **Tanggal:** 31 Maret 2026
> **Status:** Stable / Production Ready

---

## Daftar Isi
1. [Gambaran Umum Sistem](#1-gambaran-umum-sistem)
2. [Analisa Kebutuhan Data Per Entitas](#2-analisa-kebutuhan-data-per-entitas)
3. [RBAC — Matriks Hak Akses](#3-rbac--matriks-hak-akses)
4. [Data Master Sistem](#4-data-master-sistem)
5. [Database Schema (Firestore)](#5-database-schema-firestore)
6. [Alur Bisnis Antar Entitas](#6-alur-bisnis-antar-entitas)
7. [Wireframe Frontend Per Entitas](#7-wireframe-frontend-per-entitas)
8. [Sitemap & Struktur Route](#8-sitemap--struktur-route)
9. [Arsitektur Komponen Frontend](#9-arsitektur-komponen-frontend)
10. [Auth Flow & Route Guard](#10-auth-flow--route-guard)
11. [Tech Stack & Infrastruktur](#11-tech-stack--infrastruktur)
12. [Catatan Implementasi PWA & Offline](#12-catatan-implementasi-pwa--offline)

---

## 1. Gambaran Umum Sistem

Sistem ini menggunakan **Role-Based Access Control (RBAC)** dengan satu halaman login terpusat. Setelah autentikasi via Firebase, pengguna diarahkan ke antarmuka (UI) dan dashboard sesuai *role* masing-masing yang ditentukan di Firestore Security Rules.

```text
       ┌─────────────────┐
       │   LOGIN PAGE    │
       │ (Single Entry)  │
       └────────┬────────┘
                │ Auth Token + Role Check (Zustand/Context)
 ┌──────────────┼──────────────┬──────────────┐
 ▼              ▼              ▼              ▼
 ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
 │ 👑 OWNER     │ │ ⚙️ ADMIN OPS │ │ 💰 FINANCE   │ │ 🛵 KURIR     │
 │ /admin/      │ │ /admin/      │ │ /admin/      │ │ /courier/    │
 │ overview     │ │ dashboard    │ │ finance      │ │ dashboard    │
 └──────┬───────┘ └──────┬───────┘ └──────┬───────┘ └──────┬───────┘
        │                │                │                │
        └─────────────┬──┴────────────────┴──┬─────────────┘
                      │                      │
             ┌────────▼────────┐    ┌────────▼────────┐
             │ CLOUD FIRESTORE │    │   INDEXED DB    │
             │(Realtime Master)│◄──►│(Local/Offline)  │
             └─────────────────┘    └─────────────────┘
```

**Prinsip Kunci:**
- Satu *database*, empat perspektif berbeda.
- Owner **menganalisa** strategi makro secara penuh.
- Admin Ops **mengoperasikan** pembuatan dan penugasan transaksi harian.
- Finance **memvalidasi** kelancaran dan penyelesaian arus kas (setoran uang).
- Kurir **mengeksekusi** status pengiriman barang dari titik ke titik.

---

## 2. Analisa Kebutuhan Data Per Entitas

### 👑 OWNER — Strategic / Decision Maker Level

> **"Bagaimana performa, tren, dan profitabilitas bisnis kurir saya hari ini?"**

| Kategori | Data yang Dibutuhkan |
|---|---|
| **Revenue & Profit** | Total pendapatan kotor, laba bersih (setelah komisi kurir), aliran uang harian. |
| **Order Volume** | Statistik volume order masuk/selesai/gagal. |
| **Courier Performance** | Daftar kurir teraktif, persentase keberhasilan (*success rate*). |
| **Audit & Monitoring** | Akses bebas (*read-only/write*) ke semua halaman operasional dan pengaturan sistem pendaftaran. |

**Fitur Utama Owner:**
- Akses penuh ke dashboard "Overview" (Diagram, Statistik Global).
- Mengatur konfigurasi persentase komisi (*commission rate*).
- Menambah/mengedit akun admin & kurir baru.

### ⚙️ ADMIN KURIR — Operational Level

> **"Bagaimana saya menugaskan kurir agar tidak ada paket pelanggan yang telat?"**

| Kategori | Data yang Dibutuhkan |
|---|---|
| **Order Management** | Form pembuatan order (konsumen, alamat tujuan, harga, ongkos). |
| **Dispatch / Assign** | Melihat ketersediaan kurir (*Online/Offline*) dan antrean prioritas FIFO. |
| **Tracking Harian** | Daftar seluruh order, opsi filter pencarian dan pembatalan (*cancel*). |
| **Customer Database** | Tambah lokasi (*address book*), nomor telepon pengirim rutin. |

**Fitur Utama Admin:**
- Input order baru via Form Modal (dengan fitur auto-suggest relasi customer).
- Tombol cepat untuk menetapkan/merekomendasikan kurir (`assignCourier`).
- *Cancel Order* jika terkendala operasional, export data terbatas.

### 💰 FINANCE — Financial Control Level

> **"Apakah semua kurir sudah menyetorkan uang ongkir yang mereka kumpulkan?"**

| Kategori | Data yang Dibutuhkan |
|---|---|
| **Setoran (Settlement)** | Order dengan status `delivered` tetapi `payment_status` masih `unpaid`. |
| **Batch Confirmation** | Mode konfirmasi setoran sekaligus (Bulk Settle) per kurir. |
| **Cash Flow Rekap** | Kalkulasi bersih (Net Revenue) setelah dikurangi hak komisi kurir di hari tersebut. |
| **Invoicing** | Kemampuan melacak/mencetak resi *invoice* per pelanggan. |

**Fitur Utama Finance:**
- Dashboard Keuangan (Rekap *Gross*, *Net*, dan *Payout* hak kurir).
- Modul Penagihan (Melihat total rupiah per kurir yang "menggantung").
- Mengubah status uang menjadi `paid` (tervalidasi).
- **Tombol "New Order" atau "Assign" dinonaktifkan** demi *separation of duty*.

### 🛵 KURIR — Field Execution Level

> **"Apa paket selanjutnya yang harus saya ambil dan berapa rupiah komisi saya hari ini?"**

| Kategori | Data yang Dibutuhkan |
|---|---|
| **Task List** | Order yang statusnya ter-*assign* ke `uid` mereka sendiri. |
| **Order Detail** | Lokasi jemput, lokasi antar, total biaya yang wajib ditagih (Ongkir + Biaya Titik). |
| **Status Update** | Interaksi ubah status (`picked_up` -> `in_transit` -> `delivered`). |
| **Personal Earnings** | Target harian, saldo komisi yang diperoleh (*Real-time*). |

**Fitur Utama Kurir:**
- Tombol *One-tap* buka map lokasi.
- Tampilan berbasis Mobile (PWA).
- Menyimpan *cache* IndexedDB agar tetap bisa buka detail pengiriman saat _blank spot_ sinyal internet.

---

## 3. RBAC — Matriks Hak Akses

| Modul | 👑 Owner | ⚙️ Admin | 💰 Keuangan | 🛵 Kurir |
|---|---|---|---|---|
| **Login / Auth** | Full | Full | Full | Full |
| **Tugaskan Kurir** | Ya | **Ya** | Tidak | Tidak |
| **Buat Order** | Ya | **Ya** | Tidak | Tidak |
| **Konfirmasi Setoran** | Ya | Tidak | **Ya** | Tidak |
| **Edit Profil Kurir** | Ya | Ya | Tidak | **Profil Sendiri** |
| **List Customers** | Full | Full | View Only | Tidak |
| **Batal Order (Cancel)** | Ya | **Ya** | Tidak | Tidak |
| **Ubah Persentase Komisi** | **Ya** | Tidak | Tidak | Tidak |
| **Halaman Dashboard Ops** | Ya | Ya | Ya | Tidak |
| **Halaman Keuangan** | Ya | Tidak | Ya | Tidak |

---

## 4. Data Master Sistem (Firestore Collections)

Karena menggunakan NoSQL (Firestore), skema direpresentasikan dalam dokumen JSON berelasi via `UID` dan `ID`.

```text
Master Users     -> id (UID Auth), name, email, phone, role, is_online, queue_position
Master Customers -> id, name, phone, addresses[] (array objek lokasi)
Master Orders    -> id, order_number, customer_id, items[], biaya (titik, beban), total_fee
Master Settings  -> id ('global'), commission_rate, commission_threshold
```

---

## 5. Database Schema (Firestore)

### **Collections: `users`**
```json
{
  "id": "J8sA91K...",           // Firebase UID
  "email": "budi@delivery.com",
  "name": "Budi Kurir 1",
  "phone": "0812345678",
  "role": "courier",            // 'owner' | 'finance' | 'admin_kurir' | 'courier'
  "is_online": true,            // Toggle shift aktif
  "queue_position": 1711782200, // Unix timestamp untuk prioritas urutan FIFO
  "fcm_token": "fcm_xyz123...",
  "last_active": "2026-03-31T08:00:00.000Z"
}
```

### **Collections: `orders`**
```json
{
  "id": "uuid-v4-generated",
  "order_number": "KD-92138",
  "customer_name": "Ibu Sari",
  "customer_phone": "08111222333",
  "customer_address": "Jl. Mawar Merah No 5",
  "items": [
    { "nama": "Paket Pakaian", "harga": 0 }
  ],
  "titik": 1,
  "total_biaya_titik": 5000,
  "beban": [],
  "total_fee": 15000,
  "status": "pending",          // 'pending'|'assigned'|'picked_up'|'delivered'|'cancelled'
  "payment_status": "unpaid",   // 'unpaid'|'paid'
  "courier_id": "J8sA91K...",   // Referensi UID Kurir
  "applied_commission_rate": 10 // Hak komisi pada hari Masehi tersebut
}
```

---

## 6. Alur Bisnis Antar Entitas

### **Alur 1 — Work Flow Order Normal (Happy Path)**

```text
  Admin Ops         Kurir         Finance           Owner
      │               │              │                │
      │ 1. Buat Order │              │                │
      │───────────────│              │                │
      │ 2. Tetapkan / Assign         │                │
      │───────────────▶              │                │
      │               │ 3. Notifikasi Berbunyi        │
      │               │ 4. "Pick Up" Paket            │
      │               │ 5. "Delivered" ke Tujuan      │
      │               │              │                │
      │               │──────────────▶                │
      │               │ Jika COD: Setor Tunai         │
      │               │ 6. Kurir Datang Bawa Uang     │
      │               │──────────────▶                │
      │               │              │ 7. Verifikasi  │
      │               │              │ 8. Klik LUNAS  │
      │               │              │────────────────▶
      │               │              │    9. Dashboard Revenue Update
```

### **Alur 2 — Tambah Karyawan / Pembuatan Akun Baru (Secondary Auth)**

```text
  Owner / Admin     Firebase Auth (Secondary)   Firestore (Storage)
      │                     │                          │
      │ 1. Klik Tambah Kurir│                          │
      │─────────────────────▶                          │
      │ 2. Create User w/o breaking Admin's Auth Token │
      │                     │──(Yields UID)───────────▶│
      │                     │                          │ 3. Save User Doc
      │ 4. Kurir dapat login di HP mereka              │
```

---

## 7. Wireframe Frontend Per Entitas

> Pendekatan desain: Dashboard operasional berbasis meja kerja (Desktop-first dengan Sidebar), sementara interface Kurir mutlak menggunakan konsep Thumb-friendly (Mobile-first).

### **7.1 Owner/Admin/Finance Base Layout (Desktop)**

```text
┌─────────────────────────────────────────────────────────────────────┐
│  🛵 KURIRDEV          Header Page Title   [ 🔔 ] [ 👱‍♂️ Budi Setiawan ▾]│
├──────────────┬──────────────────────────────────────────────────────┤
│ 📊 Overview  │                                                      │
│ 📦 Orders    │  [ QUICK STATS ]                                     │
│ 👥 Couriers  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐  │
│ 💰 Finance   │  │ HARI INI     │ │ REVENUE BERSIH │ │ TOTAL KURIR  │  │
│ ⚙️ Settings  │  │ 128 Orders   │ │ Rp 1.5M      │ │ 12 / 15 Actv │  │
│              │  └──────────────┘ └──────────────┘ └──────────────┘  │
│              │                                                      │
│              │  [ MAIN CONTENT / DATA TABLES ]                      │
│              │  ┌────────────────────────────────────────────────┐  │
│              │  │ Search [_____________]  Filter [Semua Status ▾]│  │
│              │  ├─────┬──────────┬──────────┬────────────┬───────┤  │
│              │  │ ORD#│ CUSTOMER │ STATUS   │ KURIR      │ FEE   │  │
│              │  ├─────┼──────────┼──────────┼────────────┼───────┤  │
│              │  │ KD01│ PT ABC   │ ASSIGNED │ Rudi       │ 10K   │  │
│              │  │ KD02│ Sari     │ DELIVERED│ Anton      │ 15K   │  │
│              │  └─────┴──────────┴──────────┴────────────┴───────┘  │
└──────────────┴──────────────────────────────────────────────────────┘
```

### **7.2 Create Order Modal (Admin Ops)**

```text
┌───────────────────────────────────────────────────────┐
│ ← BUAT ORDER BARU                               [×]   │
├───────────────────────────────────────────────────────┤
│ ── INFORMASI ──────────────────────────────────────   │
│ [ 🔍 Cari pelanggan lama...                 ]         │
│ ┌─────────────────────┐ ┌─────────────────────┐       │
│ │ Nama Pelanggan      │ │ No. Handphone       │       │
│ └─────────────────────┘ └─────────────────────┘       │
│ ┌───────────────────────────────────────────────┐     │
│ │ Alamat Detail / Titik Pengiriman              │     │
│ └───────────────────────────────────────────────┘     │
│                                                       │
│ ── BIAYA & STATUS ─────────────────────────────────   │
│ ┌─────────────────────┐ ┌─────────────────────┐       │
│ │ Ongkir Dasar (Rp)   │ │ Metode Pembayaran ▾ │       │
│ │ 15.000              │ │ Unpaid (Belum)      │       │
│ └─────────────────────┘ └─────────────────────┘       │
│                                                       │
│ ┌───────────────┐           ┌───────────────────────┐ │
│ │ ✕ Batal       │           │ ✓ Create Order        │ │
│ └───────────────┘           └───────────────────────┘ │
└───────────────────────────────────────────────────────┘
```

### **7.3 Kurir Application (Mobile PWA First)**

```text
┌─────────────────────────────┐
│ 🛵 TUGAS SAYA      [ ≡ ]      │
├─────────────────────────────┤
│                             │
│ ┌─────────────────────────┐ │
│ │ 👱‍♂️ Rudi H.              │ │
│ │ Status: [🟢 ON DUTY]    │ │
│ └─────────────────────────┘ │
│                             │
│ ── PENGHASILAN KOMISI ────  │
│ ┌─────────────────────────┐ │
│ │ Hari ini: Rp 45.000     │ │
│ └─────────────────────────┘ │
│                             │
│ ── DAFTAR TUGAS AKTIF ────  │
│                             │
│ ┌─────────────────────────┐ │
│ │ 📦 KD-92138             │ │
│ │ Tujuan: Ibu Sari        │ │
│ │         Jl. Mawar No 5  │ │
│ │ Status: 🟡 ASSIGNED     │ │
│ │                           │ │
│ │ [📍 Navigate] [✓ Update]│ │
│ └─────────────────────────┘ │
│                             │
├─────────────────────────────┤
│ [ 🏠 ]   [ 📦 ]   [ 👤 ]    │
│  Home    Tasks    Profile   │
└─────────────────────────────┘
```

---

## 8. Sitemap & Struktur Route

Aplikasi menggunakan React Router v6 dengan arsitektur terbagi untuk public dan private routes.

```text
/login                   ← Halaman Sign In (Semua Role)
/

/admin
├── /overview            ← Dashboard Bisnis (Owner Only)
├── /dashboard           ← Dashboard Operasional (Admin & Owner)
├── /orders              ← Manajemen Pesanan Lengkap (Semua Admin, Filter Sesuai Role)
├── /couriers            ← Daftar & Lokasi Kurir
├── /finance/*           ← Penagihan & Laporan (Finance & Owner)
├── /settings            ← Konfigurasi Master Data (Owner Only)
└── /customers           ← Database Pelanggan & Alamat

/courier
├── /dashboard           ← Ringkasan Komisi & Status Shift
├── /orders              ← Daftar Pekerjaan (Live Active Tasks)
└── /history             ← Riwayat Pesanan Selesai
```

---

## 9. Arsitektur Komponen Frontend

Sistem direktori berbasis *Vite Feature-Driven* (Folder by Type & Feature).

```text
src/
├── components/          ← Reusable UI Bits
│   ├── layout/          ← Structural Wrappers
│   │   ├── Header.tsx        ← Notifikasi & Top Bar
│   │   ├── Layout.tsx        ← Sidebar Desktop dinamis berdasarkan Role
│   │   └── ProtectedRoute    ← Edge Gateway Authentication
│   └── ui/              ← Shadcn-like Primitives
│       ├── Button.tsx
│       ├── Input.tsx
│       ├── Modal.tsx
│       └── Table.tsx
│
├── context/
│   └── AuthContext.tsx  ← Firebase Auth session persistence & Profile Hydration
│
├── lib/
│   ├── firebase.ts      ← Initialize App & Secondary App instances
│   ├── firebaseSeeder   ← Skrip injeksi database sandbox
│   └── orderCache.ts    ← Abstraksi IndexedDB untuk Cache Offline Order
│
├── pages/               ← Halaman Konkret (View)
│   ├── Login.tsx
│   ├── Orders.tsx       ← Mega-component yang menangani List, Bulk Settle & Detail Ops
│   ├── Couriers.tsx
│   └── finance/
│       ├── FinanceDashboard.tsx
│       ├── InvoiceList.tsx
│       └── AnalyticsReport.tsx
│
└── stores/              ← Zustand Global States
    ├── useOrderStore.ts ← Sinkronisasi Realtime Listener Orders
    └── useUserStore.ts  ← Data kurir dan ketersediaan Shift
```

---

## 10. Auth Flow & Route Guard

Sistem otentikasi menggunakan Firebase. Mengingat Firestore SDK bisa me-render halaman sebelum klaim Role diterima, terdapat `ProtectedRoute` spesifik.

### Flow Middleware Klien (React Guard):
```tsx
// src/components/layout/ProtectedRoute.tsx
export function ProtectedRoute({ children, allowedRoles }: Props) {
  const { user, loading } = useAuth();
  
  if (loading) return <LoadingSpinner />;
  
  // 1. Cek Login
  if (!user) return <Navigate to="/login" replace />;
  
  // 2. Cek Resolusi Role (Akses)
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // Tendang ke rute fallback yang aman
    return <Navigate to={user.role === 'courier' ? '/courier' : '/admin/dashboard'} />;
  }
  
  return <>{children}</>;
}
```

### Flow Firebase Rules (Server Guard):
Bahkan jika *hacker* menembus React Guard, data tidak dapat dibaca karena diblokir oleh mesin Firestore:
```javascript
// firestore.rules
match /orders/{orderId} {
  allow read: if request.auth != null && (
    getUserRole() == "admin_kurir" || 
    getUserRole() == "owner" || 
    getUserRole() == "finance" ||
    resource.data.courier_id == request.auth.uid // Kurir hanya bisa baca paketnya sendiri
  );
  allow update: if ... // Blokir finance dari ubah alamat, blokir kurir ubah ongkir.
}
```

---

## 11. Tech Stack & Infrastruktur

| Lapisan | Teknologi | Penjelasan Teknis |
|---|---|---|
| **Frontend Framework** | React 18 + Vite | Pilihan tercepat untuk CSR (Client Side Rendering) PWA yang *snappy*. |
| **Bahasa** | TypeScript | Type-safety untuk definisi model Orders & User Profile. |
| **Styling** | Tailwind CSS v3 | Framework utility-first untuk desain responsif tanpa overhead CSS file. |
| **State Management** | Zustand | Penyimpanan *real-time event data* dari socket Firestore ringan tanpa Boilerplate Redux. |
| **Database & Auth** | Firebase suite | Menggunakan metode `signInWithEmailAndPassword`, disusul fetch objek Profile. |
| **Local Offline Cache**| IndexedDB (`idb`) | Modul `orderCache.ts` menyimpan ribuan order mingguan untuk latensi baca 0ms. |
| **Hosting Deployment** | Firebase Hosting | Deploy terintegrasi satu perintah otomatis ke edge CDN global Google. |

---

## 12. Catatan Implementasi PWA & Offline

### Prioritas Kurir "Sinyal Buruk"
Aplikasi kurir (HP) beroperasi di area *sub-urban* dengan koneksi tidak stabil.
- **Tantangan**: Database Google butuh internet untuk membaca data, berisiko tinggi jika tagihan tertinggal.
- **Solusi IndexedDB (Local-First)**: Kurir tetap bisa memuat daftar order, alamat, dan total tagihan (COD / Ongkir), **sebelum mereka kehilangan sinyal**. Semua mutasi order di latar belakang disalin ke DB internal (Browser Storage).

### Batasan Komisi Konstan (Integrity)
Owner bisa memanipulasi persentase di menu Settings (misal: Komisi kurir naik dari 10% jadi 12%).
- **Rules Absolute**: Order lama tidak boleh terpengaruh. Oleh karena itu, aplikasi menembak field statis `applied_commission_rate` secara *Hardcopy* ke baris order pada saat order tersebut dibuat (Create/Assign). Kalkulasi omzet absolut dihitung dari nilai statis ini. 

---
*End of Blueprint Document. Prepared by Advanced AI Architect Team - 2026.*
