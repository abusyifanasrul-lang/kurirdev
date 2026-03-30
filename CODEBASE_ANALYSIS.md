# KurirDev - Codebase Analysis

## Daftar Isi

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Struktur Folder](#struktur-folder)
- [Arsitektur Aplikasi](#arsitektur-aplikasi)
- [Database Schema](#database-schema)
- [Routing](#routing)
- [Autentikasi](#autentikasi)
- [Business Logic](#business-logic)
- [State Management](#state-management)
- [Offline & PWA](#offline--pwa)
- [Push Notification](#push-notification)
- [Deployment](#deployment)
- [Catatan & Rekomendasi](#catatan--rekomendasi)

---

## Overview

| Field | Value |
|-------|-------|
| **Nama Proyek** | KurirDev (DeliveryPro) |
| **Deskripsi** | Sistem Manajemen Pengiriman untuk bisnis kurir skala kecil-menengah |
| **URL Deploy** | `https://kurirdev.vercel.app/` |
| **Bahasa Domain** | Indonesia (ID) |
| **Versi PWA** | v1.0.5 |
| **Model Bisnis** | COD (Cash on Delivery) dengan sistem komisi admin-kurir |

### Alur Bisnis

1. Pelanggan melakukan pemesanan melalui **WhatsApp** (di luar sistem)
2. **Admin** memasukkan pesanan ke dalam sistem secara manual
3. Admin **menugaskan kurir** secara manual atau melalui antrian FIFO
4. Kurir menerima **push notification** dan memperbarui status pengiriman via **PWA mobile**
5. Admin memonitor semua aktivitas melalui **dashboard real-time**
6. Kurir mengumpulkan pembayaran dan menyetorkan **fee platform** (default 20%) ke admin

### Target Skala

- **Awal:** 300 order/hari
- **Target:** 1000+ order/hari
- **Kurir aktif:** 20 orang
- **Admin:** 2 orang

---

## Tech Stack

### Frontend

| Technology | Version | Purpose |
|-----------|---------|---------|
| React | 19.2.3 | UI framework |
| TypeScript | 5.9.3 | Type safety |
| Vite | 7.2.4 | Build tool & dev server |
| Tailwind CSS | 4.1.17 | Utility-first styling (via `@tailwindcss/vite`) |
| React Router DOM | 7.13.0 | Client-side routing (nested routes) |
| Zustand | 5.0.11 | State management (dengan persist middleware) |
| Recharts | 3.7.0 | Charts & data visualization |
| Lucide React | 0.564.0 | Icon library |
| date-fns | 4.1.0 | Date utility library |
| clsx + tailwind-merge | 2.1.1 / 3.4.0 | Conditional class names (`cn()` utility) |
| html2canvas | 1.4.1 | Screenshot/image capture |
| jsPDF | 4.2.0 | PDF generation (reports) |

### Backend / BaaS

| Technology | Version | Purpose |
|-----------|---------|---------|
| Firebase Firestore | (firebase 11.6.0) | Real-time NoSQL database |
| Firebase Cloud Messaging | (firebase 11.6.0) | Push notifications |
| Firebase Admin SDK | 13.6.1 | Server-side FCM sending (Vercel serverless) |
| Axios | 1.13.5 | HTTP client (prepared for REST API) |

### Offline / PWA

| Technology | Purpose |
|-----------|---------|
| vite-plugin-pwa | PWA manifest, service worker injection |
| Workbox (via VitePWA) | Precaching, runtime caching strategies |
| Dexie (IndexedDB) | Offline order cache, customer cache |
| idb | Low-level IndexedDB operations |

### Deployment

| Platform | Purpose |
|-----------|---------|
| Vercel | Hosting + serverless functions |
| Service Workers | Background push, offline caching |

---

## Struktur Folder

```
kurirdev/
├── api/
│   └── send-notification.js              # Vercel serverless function (FCM via firebase-admin)
├── public/
│   ├── sw.js                             # Service worker (Firebase messaging + Workbox precaching)
│   ├── alert.mp3                         # Push notification alert sound
│   ├── icons/                            # PWA icons (Android, iOS)
│   └── screenshots/                      # PWA store screenshots
├── src/
│   ├── main.tsx                          # React entry point
│   ├── App.tsx                           # Root component (routing, lazy loading, PWA update)
│   ├── index.css                         # Global Tailwind styles
│   ├── vite-env.d.ts                     # Vite type declarations
│   │
│   ├── components/
│   │   ├── AppListeners.tsx              # Global Firestore subscriptions, IndexedDB sync
│   │   ├── layout/
│   │   │   ├── Layout.tsx                # Admin layout (responsive sidebar + outlet)
│   │   │   ├── Sidebar.tsx               # Admin sidebar navigation
│   │   │   └── Header.tsx                # Top header bar
│   │   └── ui/
│   │       ├── Badge.tsx                 # Status badges
│   │       ├── Button.tsx                # Button variants
│   │       ├── Card.tsx                  # Card + StatCard components
│   │       ├── Input.tsx                 # Form input
│   │       ├── Modal.tsx                 # Modal dialog
│   │       ├── Select.tsx                # Dropdown select
│   │       ├── Table.tsx                 # Data table
│   │       └── Textarea.tsx              # Textarea input
│   │
│   ├── context/
│   │   └── AuthContext.tsx               # Authentication context (wraps session store)
│   ├── contexts/
│   │   └── ThemeContext.tsx              # Dark mode toggle context
│   │
│   ├── hooks/                            # (empty - hooks inline in components)
│   │
│   ├── lib/
│   │   ├── firebase.ts                   # Firebase app init, Firestore DB, Messaging exports
│   │   ├── fcm.ts                        # FCM token management, foreground messages
│   │   ├── calcEarning.ts                # Courier/admin earning calculation logic
│   │   ├── orderCache.ts                 # Dexie IndexedDB: order & customer caching
│   │   ├── firebaseSeeder.ts             # Seed initial users to Firestore
│   │   ├── firebaseUserSeeder.ts         # Seed default users (alternative)
│   │   ├── firebaseOrderSeeder.ts        # Seed 50 mock orders to Firestore
│   │   ├── backfillCourierSummary.ts     # Recalculate courier stats from delivered orders
│   │   └── migrateCustomers.ts           # Migrate customer data from orders to customers
│   │
│   ├── pages/
│   │   ├── Login.tsx                     # Login page (role selection: Admin/Courier)
│   │   ├── Dashboard.tsx                 # Admin dashboard (analytics, charts, stats)
│   │   ├── Orders.tsx                    # Admin order management (CRUD, assign, filter)
│   │   ├── Couriers.tsx                  # Admin courier management
│   │   ├── Reports.tsx                   # Admin reports (date range, export PDF)
│   │   ├── Notifications.tsx             # Admin notification center
│   │   ├── Settings.tsx                  # Admin settings (profile, password, users, business)
│   │   └── courier/
│   │       ├── CourierLayout.tsx         # Courier bottom-nav layout
│   │       ├── CourierDashboard.tsx      # Courier home (toggle online, summary)
│   │       ├── CourierOrders.tsx         # Courier active orders list
│   │       ├── CourierOrderDetail.tsx    # Order detail + status update flow
│   │       ├── CourierNotifications.tsx  # Courier notification inbox
│   │       ├── CourierHistory.tsx        # Delivery history
│   │       ├── CourierEarnings.tsx       # Earnings summary (daily/weekly/monthly)
│   │       └── CourierProfile.tsx        # Courier profile (read-only + password change)
│   │
│   ├── scripts/
│   │   └── cleanupOrders.ts             # Utility to finalize/cancel dummy orders
│   │
│   ├── services/
│   │   ├── api.ts                       # Axios API service (REST endpoints, unused)
│   │   ├── mockData.ts                  # Mock data for demo/testing
│   │   └── notificationService.ts       # Push notification service (calls /api/send-notification)
│   │
│   ├── stores/                           # Zustand state stores
│   │   ├── useSessionStore.ts           # Auth session (persisted to sessionStorage)
│   │   ├── useUserStore.ts              # Users (Firestore real-time subscription)
│   │   ├── useCourierStore.ts           # Courier queue management (persisted to localStorage)
│   │   ├── useOrderStore.ts             # Orders (Firestore CRUD, status transitions)
│   │   ├── useCustomerStore.ts          # Customers (Firestore + IndexedDB hybrid)
│   │   ├── useNotificationStore.ts      # Notifications (Firestore real-time)
│   │   └── useSettingsStore.ts          # Business settings (persisted to localStorage)
│   │
│   ├── types/
│   │   └── index.ts                     # All TypeScript interfaces and types
│   │
│   └── utils/
│       ├── cn.ts                        # clsx + twMerge class name utility
│       └── notification.ts              # Browser notification helpers, alert sound
│
├── .env                                  # Firebase config (API keys)
├── index.html                            # SPA entry point (PWA meta tags)
├── package.json                          # Dependencies & scripts
├── tsconfig.json                         # TypeScript configuration
├── vite.config.ts                        # Vite + PWA + Tailwind + chunk splitting
├── vercel.json                           # Vercel routing & cache headers
├── README.md                             # Project documentation
├── KurirDev_MasterContext_v8 (1).md      # Master context document for AI onboarding
├── KurirDev_BugReport_v2.md              # Bug tracking
├── CHANGELOG_CourierInstruction.md       # Feature changelog
└── tips&trick.md                         # Developer tips
```

---

## Arsitektur Aplikasi

### Diagram Alur Data

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│   WhatsApp   │────▶│  Admin Web   │────▶│  Firestore DB   │
│  (Customer)  │     │  (Dashboard) │     │  (Real-time)    │
└─────────────┘     └──────┬───────┘     └────────┬────────┘
                           │                       │
                    assign kurir            onSnapshot sync
                           │                       │
                           ▼                       ▼
                    ┌──────────────┐     ┌─────────────────┐
                    │  Push Notif  │────▶│  Courier PWA    │
                    │  (FCM)       │     │  (Mobile)       │
                    └──────────────┘     └────────┬────────┘
                                                  │
                                          update status
                                                  │
                                                  ▼
                                         ┌─────────────────┐
                                         │  Firestore DB   │
                                         │  (Real-time)    │
                                         └─────────────────┘
```

### Hybrid Data Strategy

- **Firestore:** Real-time data untuk order aktif, user, notifikasi
- **IndexedDB (Dexie):** Offline cache untuk order yang sudah finalized (delivered/cancelled) dan data customer
- **localStorage:** Settings bisnis, courier queue, remember me
- **sessionStorage:** Auth session (clear on tab close)

---

## Database Schema

### Firestore Collections

#### 1. `users` Collection

| Field | Type | Description |
|-------|------|-------------|
| id | string | Document ID |
| name | string | Nama pengguna |
| email | string | Email login |
| role | 'admin' \| 'courier' | Peran pengguna |
| password | string | Password (plain text - demo only) |
| phone | string | Nomor telepon |
| is_active | boolean | Status aktif akun |
| is_online | boolean | Status online kurir |
| fcm_token | string | Firebase Cloud Messaging token |
| courier_status | 'on' \| 'stay' \| 'off' | Status ketersediaan kurir |
| off_reason | string | Alasan kurir offline |
| queue_position | number | Posisi antrian FIFO |
| total_deliveries_alltime | number | Total pengiriman sepanjang waktu |
| total_earnings_alltime | number | Total pendapatan sepanjang waktu |
| unpaid_count | number | Jumlah order belum dibayar |
| unpaid_amount | number | Jumlah uang belum disetor |
| vehicle_type | 'motorcycle' \| 'car' \| 'bicycle' \| 'van' | Jenis kendaraan |
| plate_number | string | Nomor plat kendaraan |
| created_at | string | ISO timestamp |
| updated_at | string | ISO timestamp |

#### 2. `orders` Collection

| Field | Type | Description |
|-------|------|-------------|
| id | string | Document ID |
| order_number | string | Format: P{DDMMYY}{NNN} (e.g., P290326001) |
| customer_name | string | Nama pelanggan |
| customer_phone | string | Telepon pelanggan |
| customer_address | string | Alamat pengiriman |
| customer_id | string | Reference ke customers collection |
| customer_address_id | string | Reference ke alamat spesifik |
| courier_id | string | Reference ke users collection |
| assigned_at | string | Waktu penugasan |
| status | OrderStatus | Status order saat ini |
| total_fee | number | Biaya pengiriman |
| payment_status | 'unpaid' \| 'paid' | Status pembayaran |
| estimated_delivery_time | string | Estimasi waktu tiba |
| actual_pickup_time | string | Waktu aktual pickup |
| actual_delivery_time | string | Waktu aktual delivery |
| cancelled_at | string | Waktu pembatalan |
| cancellation_reason | string | Alasan pembatalan |
| cancel_reason_type | 'customer' \| 'item_unavailable' \| 'other' | Tipe alasan batal |
| titik | number | Jumlah titik antar |
| total_biaya_titik | number | titik * 3000 |
| beban | array | Biaya tambahan [{nama, biaya}] |
| total_biaya_beban | number | Total biaya tambahan |
| items | array | Barang yang dikirim [{nama, harga}] |
| notes | string | Catatan tambahan |
| is_waiting | boolean | Flag kurir menunggu |
| applied_commission_rate | number | Rate komisi saat delivery |
| applied_commission_threshold | number | Threshold komisi saat delivery |
| created_at | string | ISO timestamp |
| updated_at | string | ISO timestamp |

#### 3. `tracking_logs` Collection

| Field | Type | Description |
|-------|------|-------------|
| id | string | UUID |
| order_id | string | Reference ke orders |
| status | OrderStatus | Status yang dicatat |
| changed_by | string | User ID yang mengubah |
| changed_by_name | string | Nama pengubah |
| changed_at | string | Waktu perubahan |
| notes | string | Catatan tambahan |

#### 4. `customers` Collection

| Field | Type | Description |
|-------|------|-------------|
| id | string | Document ID |
| name | string | Nama pelanggan |
| phone | string | Nomor telepon |
| addresses | CustomerAddress[] | Daftar alamat |
| order_count | number | Jumlah order |
| last_order_at | string | Order terakhir |
| created_at | string | ISO timestamp |
| updated_at | string | ISO timestamp |

**CustomerAddress:**

| Field | Type | Description |
|-------|------|-------------|
| id | string | Address ID |
| label | string | Label alamat (e.g., "Rumah", "Kantor") |
| address | string | Alamat lengkap |
| is_default | boolean | Alamat default |
| notes | string | Catatan alamat |

#### 5. `notifications` Collection

| Field | Type | Description |
|-------|------|-------------|
| id | string | Document ID |
| user_id | string | Penerima notifikasi |
| user_name | string | Nama penerima |
| title | string | Judul notifikasi |
| body | string | Isi notifikasi |
| data | object | Data tambahan |
| is_read | boolean | Status baca |
| sent_at | string | Waktu pengiriman |

#### 6. `settings/business` Document

| Field | Type | Description |
|-------|------|-------------|
| commission_rate | number | Persentase komisi kurir (default: 80) |
| commission_threshold | number | Batas fee untuk komisi (default: 5000) |
| courier_instructions | array | Instruksi untuk kurir |

### IndexedDB Schema (Dexie)

Database name: `KurirDevCache`

```
orders: 'id, _date, courier_id, status, created_at'
customers: 'id, name, phone, updated_at'
```

---

## Routing

### Struktur Route

```
/                           → Redirect ke login
/login                      → Login page (role selection)

/admin                      → AdminLayout (protected: admin role)
  /admin/                   → Dashboard
  /admin/orders             → Orders management
  /admin/couriers           → Courier management
  /admin/reports            → Reports dengan date range
  /admin/notifications      → Kirim notifikasi
  /admin/settings           → System settings

/courier                    → CourierLayout (protected: courier role)
  /courier/                 → Courier Dashboard
  /courier/orders           → Active orders list
  /courier/orders/:id       → Order detail + status update
  /courier/notifications    → Notification inbox
  /courier/history          → Delivery history
  /courier/earnings         → Earnings summary
  /courier/profile          → Profile management
```

### Route Protection

- `ProtectedRoute` component memeriksa `isAuthenticated`, `user`, dan `allowedRoles`
- Unauthorized users di-redirect ke `/`
- Lazy loading dengan `React.lazy()` untuk semua pages

---

## Autentikasi

### Login Flow

1. User memilih role (admin/courier)
2. User memasukkan email + password
3. App memvalidasi terhadap users dari Firestore (`useUserStore`)
4. Password disimpan dalam **plain text** di Firestore (demo only)
5. Session disimpan di `useSessionStore` (persisted ke sessionStorage)
6. Auth state di-expose via React Context (`AuthContext`)

### Session Management

- **Zustand `useSessionStore`:** Disimpan di sessionStorage (clear on tab close)
- **"Remember Me":** Menyimpan email per-role ke localStorage (bukan password)
- **FCM Integration:** Saat kurir login, FCM permission diminta dan token disimpan ke Firestore

### Security Notes

- ⚠️ Password disimpan dalam plain text - **tidak aman untuk production**
- ⚠️ Tidak ada rate limiting pada login attempts
- ⚠️ Tidak ada email verification

---

## Business Logic

### Order Status Flow

```
pending → assigned → picked_up → in_transit → delivered
   ↓
cancelled (admin only)
```

**Rules:**

- Admin dapat membatalkan order di status apapun
- Kurir **TIDAK** dapat membatalkan atau menolak order
- Kurir hanya dapat memajukan status (tidak bisa mundur)
- Setiap perubahan status membuat entry di `tracking_logs`

### Perhitungan Komisi

```typescript
// Jika total_fee <= threshold: kurir mendapat 100% dari fee
// Jika total_fee > threshold: kurir mendapat (rate%) dari fee, admin mendapat sisanya
// Plus: titik (drop-off points * 3000) dan beban (biaya tambahan) masuk ke kurir

courierEarning = (fee <= threshold ? fee : fee * rate/100) + titik*3000 + sum(beban)
adminEarning = fee > threshold ? fee * (1 - rate/100) : 0
```

**Default Config:**

- `commission_rate = 80` (kurir dapat 80%)
- `commission_threshold = 5000` (Rp)

**Contoh:**

| Fee | Titik | Beban | Kurir Earning | Admin Earning |
|-----|-------|-------|---------------|---------------|
| 3000 | 1 | 0 | 3000 + 3000 = 6000 | 0 |
| 8000 | 2 | 1000 | 6400 + 6000 + 1000 = 13400 | 1600 |
| 15000 | 3 | 2000 | 12000 + 9000 + 2000 = 23000 | 3000 |

### Courier Queue (FIFO Assignment)

1. Setiap kurir memiliki `queue_position`
2. Saat kurir di-assign order, mereka rotate ke belakang antrian
3. Going offline menghapus dari antrian
4. Coming back online menambahkan ke akhir antrian

### Denormalized Stats

Statistik kurir di-denormalisasi ke dokumen user:

- `total_deliveries_alltime`: Jumlah total pengiriman
- `total_earnings_alltime`: Total pendapatan
- `unpaid_count`: Jumlah order belum dibayar
- `unpaid_amount`: Jumlah uang belum disetor

---

## State Management

### Zustand Stores

| Store | Persist | Purpose |
|-------|---------|---------|
| `useSessionStore` | sessionStorage | Auth session (user, token, isAuthenticated) |
| `useUserStore` | - | Users dari Firestore (real-time subscription) |
| `useCourierStore` | localStorage | Courier queue management |
| `useOrderStore` | - | Orders dari Firestore (CRUD, status transitions) |
| `useCustomerStore` | - | Customers (Firestore + IndexedDB hybrid) |
| `useNotificationStore` | - | Notifications (Firestore real-time) |
| `useSettingsStore` | localStorage | Business settings (commission rate, instructions) |

### Data Flow

```
Firestore ──onSnapshot──▶ Zustand Store ──▶ React Components
     │
     └──▶ IndexedDB (offline cache untuk finalized orders)
```

---

## Offline & PWA

### PWA Configuration

- **Manifest:** "KurirDev - Sistem Manajemen Pengiriman", standalone display, portrait orientation
- **Service Worker:** Firebase messaging background handler + Workbox precaching

### Caching Strategies

| Resource | Strategy | Details |
|----------|----------|---------|
| JS/CSS | NetworkFirst | 3s timeout |
| Fonts | CacheFirst | 1 year expiry |
| Images | CacheFirst | 30 days expiry |
| Audio | CacheFirst | 30 days expiry |
| API (n8n/supabase) | NetworkFirst | 1 hour expiry |

### Offline Sync Strategy

1. **Initial sync:** Semua final orders (delivered/cancelled) dari Firestore ke IndexedDB saat login pertama
2. **Delta sync:** Sinkronisasi harian untuk order final kemarin
3. **Integrity check:** Membandingkan count IndexedDB vs metadata
4. **Storage budget:** Auto-prune orders older than 1 year saat storage > 80%
5. **Customer sync:** Local-first dari IndexedDB, delta sync dari Firestore harian

### Update Mechanism

- PWA Update Banner dengan 6-hour dismiss cooldown
- Suppressed saat kurir memiliki active deliveries

### Code Splitting

Manual chunk splitting:

- `vendor-firebase`
- `vendor-react`
- `vendor-zustand`
- `vendor-charts`
- `vendor-pdf`
- `vendor-date`
- `vendor-dexie`

---

## Push Notification

### Arsitektur

```
Admin trigger
    ↓
/api/send-notification (Vercel serverless)
    ↓
Firebase Admin SDK
    ↓
FCM (data-only message)
    ↓
Service Worker (sw.js)
    ↓
onBackgroundMessage / push event
    ↓
Browser Notification + alert.mp3
```

### Komponen

1. **Sending:** Admin trigger via notification page atau order assignment
2. **Serverless function** (`/api/send-notification`): Menggunakan `firebase-admin` untuk mengirim FCM data-only messages
3. **Service worker** (`sw.js`): Handle `onBackgroundMessage` dan manual `push` event listener
4. **Foreground:** `App.tsx` listen via `onMessage()` dan tampilkan browser `Notification`
5. **Alert sound:** `alert.mp3` diputar saat foreground push diterima
6. **Auth:** API endpoint dilindungi oleh `x-api-secret` header

---

## Deployment

### Platform

- **Vercel:** Hosting + serverless functions
- **Service Workers:** Background push, offline caching

### Environment Variables

**Client (.env):**

```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_VAPID_KEY=...
VITE_API_SECRET=...
```

**Serverless (Vercel):**

```env
FIREBASE_SERVICE_ACCOUNT_BASE64=...
API_SECRET=...
```

### NPM Scripts

```json
{
  "dev": "vite",
  "build": "vite build",
  "preview": "vite preview"
}
```

---

## Catatan & Rekomendasi

### Keamanan

#### Ringkasan Vulnerability

| # | Issue | Severity | File Terkait | Status |
|---|-------|----------|-------------|--------|
| 1 | Password plain text di Firestore | 🔴 Critical | `Login.tsx:67`, `firebaseSeeder.ts:5-9` | Belum ditangani |
| 2 | Tidak ada rate limiting login | 🔴 Critical | `Login.tsx:47-104` | Belum ditangani |
| 3 | API secret exposed ke client | 🔴 Critical | `notificationService.ts:14`, `.env:8` | Belum ditangani |
| 4 | Firebase config hardcoded di SW | 🟡 Medium | `sw.js:4-11` | Perlu review |
| 5 | Tidak ada Firestore Security Rules | 🔴 Critical | (tidak ada file rules) | Belum ditangani |
| 6 | Session manipulable via DevTools | 🟡 Medium | `useSessionStore.ts:25-27` | Belum ditangani |
| 7 | User data (termasuk password) di-load ke client | 🔴 Critical | `useUserStore.ts:22-26` | Belum ditangani |
| 8 | Demo credentials di UI Login | 🟡 Low | `Login.tsx:184-198` | Perlu dihapus untuk production |
| 9 | Console logging sensitif | 🟡 Medium | `firebase.ts:5-6`, `fcm.ts:143` | Perlu dibersihkan |
| 10 | Tidak ada CSRF protection | 🟡 Medium | `send-notification.js` | Belum ditangani |

---

#### Detail Vulnerability

##### 1. Password Plain Text di Firestore 🔴

**Lokasi:** `src/pages/Login.tsx:67`, `src/lib/firebaseSeeder.ts:5-9`

**Masalah:**
Password disimpan dan divalidasi sebagai plain text. Siapapun yang memiliki akses baca ke Firestore `users` collection dapat melihat semua password.

```typescript
// Login.tsx:67 - Validasi password plain text
const isValidPassword = foundUser && foundUser.password === password;
```

```typescript
// firebaseSeeder.ts:5-9 - Password hard-coded dalam seed data
{ id: "1", email: "admin@delivery.com", password: "admin123", role: "admin" },
{ id: "3", email: "budi@courier.com", password: "courier123", role: "courier" },
```

**Dampak:**
- Credential reuse attack: user yang menggunakan password sama di layanan lain terancam
- Insider threat: siapapun dengan akses Firestore console dapat melihat semua password
- Data breach: jika Firestore rules salah konfigurasi, password terekspos ke publik

**Rekomendasi Fix:**
- **Opsi A (Recommended):** Migrasi ke Firebase Authentication. Ini menangani hashing, rate limiting, email verification, dan MFA secara built-in. Password tidak pernah disimpan di Firestore.
- **Opsi B:** Jika harus custom auth, gunakan bcrypt/scrypt untuk hashing. Hash password saat seeding dan saat user mengubah password. Validasi dengan `bcrypt.compare()`.

---

##### 2. Tidak Ada Rate Limiting Login 🔴

**Lokasi:** `src/pages/Login.tsx:47-104`

**Masalah:**
Tidak ada pembatasan attempt login. Attacker dapat melakukan brute-force password tanpa batasan.

```typescript
// Login.tsx:47-104 - Tidak ada mekanisme rate limiting
const handleLogin = async (e: React.FormEvent) => {
  // ... tidak ada check untuk jumlah attempt
  const foundUser = users.find((u) =>
    u.email.toLowerCase().trim() === email.toLowerCase().trim() &&
    u.role === selectedRole
  );
  const isValidPassword = foundUser && foundUser.password === password;
  // ...
}
```

**Dampak:**
- Brute force attack: attacker dapat mencoba semua kombinasi password
- Dictionary attack: attacker dapat menggunakan daftar password umum
- DoS: spam request login dapat membebani Firestore reads

**Rekomendasi Fix:**
- Implementasi client-side cooldown (misal 5 attempt → lock 15 menit)
- Implementasi server-side rate limiting menggunakan Firebase Functions + Redis/Firestore counter
- Atau migrasi ke Firebase Auth yang memiliki built-in rate limiting

---

##### 3. API Secret Exposed ke Client 🔴

**Lokasi:** `src/services/notificationService.ts:14`, `.env:8` (`VITE_API_SECRET`)

**Masalah:**
Variabel `VITE_API_SECRET` menggunakan prefix `VITE_` yang membuatnya accessible di client-side JavaScript bundle. Siapapun dapat membuka DevTools → Sources dan melihat nilai secret ini.

```typescript
// notificationService.ts:14 - Secret di-expose ke client bundle
headers: {
  'Content-Type': 'application/json',
  'x-api-secret': import.meta.env.VITE_API_SECRET,  // ← Exposed!
},
```

```env
# .env:8 - Prefix VITE_ membuat variabel ini di-bundle ke client JS
VITE_API_SECRET=...  // ← Siapapun bisa baca ini dari browser
```

**Dampak:**
- Attacker dapat mengirim push notification palsu ke semua kurir
- Attacker dapat spam FCM tokens
- API endpoint `/api/send-notification` dapat di-abuse

**Rekomendasi Fix:**
- **Opsi A:** Gunakan Firebase Auth token sebagai ganti static secret. Serverless function memverifikasi JWT token dari Firebase Auth.
- **Opsi B:** Pindahkan notifikasi trigger ke server-side (admin action → Firestore trigger → Cloud Function → FCM). Client tidak pernah langsung call API.
- **Opsi C (Quick fix):** Hapus prefix `VITE_` dan gunakan environment variable server-side saja. Refactor notification flow agar tidak perlu client-side secret.

---

##### 4. Firebase Config Hardcoded di Service Worker 🟡

**Lokasi:** `public/sw.js:4-11`

**Masalah:**
Firebase config (API key, project ID, dll) di-hardcode langsung di service worker file yang dapat diakses publik.

```javascript
// sw.js:4-11 - Config hardcoded
firebase.initializeApp({
  apiKey: "AIzaSyBqS5x5BWFFU19Gi4rGtEv7CcF9P_cLD-Q",
  authDomain: "kurirdev-prod.firebaseapp.com",
  projectId: "kurirdev-prod",
  storageBucket: "kurirdev-prod.firebasestorage.app",
  messagingSenderId: "945083209932",
  appId: "1:945083209932:web:aa57a8c7c2cbab174cca69"
})
```

**Dampak:**
- Firebase API key untuk web app memang designed untuk public, tapi tanpa Firestore Security Rules, siapapun dengan key ini dapat akses database
- Memudahkan reconnaissance untuk attacker

**Rekomendasi Fix:**
- Pastikan Firestore Security Rules dikonfigurasi dengan benar (lihat issue #5)
- Gunakan Firebase App Check untuk memverifikasi request hanya dari app yang legitimate
- Restrict API key di Google Cloud Console (HTTP referrer, API restrictions)

---

##### 5. Tidak Ada Firestore Security Rules 🔴

**Lokasi:** Tidak ada file `firestore.rules` di repository

**Masalah:**
Tidak ditemukan file Firestore Security Rules di repository. Jika rules belum dikonfigurasi di Firebase Console, kemungkinan besar menggunakan default yang **sangat tidak aman** atau rules yang terlalu permisif.

**Analisis Akses Client:**

```typescript
// useUserStore.ts:22 - Baca SEMUA users (termasuk password!)
const unsub = onSnapshot(collection(db, 'users'), (snapshot) => {
  const users = snapshot.docs.map(d => d.data() as User)
  // ↑ Siapapun yang subscribe akan dapat data semua user termasuk password
})

// useOrderStore.ts:130 - Siapapun bisa tulis order
await setDoc(doc(db, 'orders', order.id), order)

// useOrderStore.ts:176 - Siapapun bisa update order
await updateDoc(doc(db, 'orders', orderId), updates)
```

**Dampak:**
- Jika rules open: siapapun dapat baca semua data (termasuk password), tulis/edit/hapus data apapun
- Client-side validation saja tidak cukup karena dapat di-bypass via DevTools
- Attacker dapat: mengubah status order, menghapus data, melihat password semua user, mengubah komisi

**Rekomendasi Fix:**
Tambahkan `firestore.rules` dengan prinsip least-privilege:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Helper: cek apakah user terautentikasi
    function isAuthenticated() {
      return request.auth != null;
    }

    // Helper: cek apakah user adalah admin
    function isAdmin() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }

    // Users collection
    match /users/{userId} {
      allow read: if isAuthenticated();
      allow create, update: if isAuthenticated() && isAdmin();
      allow delete: if false; // Soft delete only
      // JANGAN expose password ke client — filter di server
    }

    // Orders collection
    match /orders/{orderId} {
      allow read: if isAuthenticated();
      allow create: if isAuthenticated() && isAdmin();
      allow update: if isAuthenticated() && (
        isAdmin() ||
        // Courier hanya boleh update status, bukan fee/komisi
        (resource.data.courier_id == request.auth.uid &&
         request.write.fields.hasAll(['status', 'updated_at']) &&
         !request.write.fields.hasAny(['total_fee', 'commission_rate']))
      );
      allow delete: if false; // Soft delete via status
    }

    // Tracking logs
    match /tracking_logs/{logId} {
      allow read: if isAuthenticated();
      allow create: if isAuthenticated();
      allow update, delete: if false; // Immutable
    }

    // Customers
    match /customers/{customerId} {
      allow read: if isAuthenticated();
      allow write: if isAuthenticated() && isAdmin();
    }

    // Settings
    match /settings/{settingId} {
      allow read: if isAuthenticated();
      allow write: if isAuthenticated() && isAdmin();
    }

    // Notifications
    match /notifications/{notifId} {
      allow read: if isAuthenticated() && resource.data.user_id == request.auth.uid;
      allow create: if isAuthenticated() && isAdmin();
      allow update: if isAuthenticated() && resource.data.user_id == request.auth.uid;
      allow delete: if false;
    }
  }
}
```

---

##### 6. Session Manipulable via DevTools 🟡

**Lokasi:** `src/stores/useSessionStore.ts:25-27`

**Masalah:**
Session disimpan di `sessionStorage` sebagai plain JSON. Siapapun dapat membuka DevTools → Application → Session Storage dan mengubah data user, termasuk role.

```typescript
// useSessionStore.ts:25-27 - Session di sessionStorage sebagai plain JSON
{
  name: 'session-storage',
  storage: createJSONStorage(() => sessionStorage),
}
```

**Contoh attack:**
Attacker dapat mengubah `role: "courier"` menjadi `role: "admin"` di sessionStorage, kemudian refresh halaman untuk mendapatkan akses admin.

**Dampak:**
- Privilege escalation: courier dapat mengakses admin dashboard
- Data manipulation: mengubah user ID, nama, dll

**Rekomendasi Fix:**
- Validasi session di server-side (jika menggunakan Firebase Auth, token divalidasi otomatis)
- Tambahkan server-side session validation: setiap request ke Firestore harus diverifikasi role-nya
- Implementasi Firestore Security Rules yang memverifikasi role dari server (bukan dari client)
- Jangan percaya client-side state untuk authorization

---

##### 7. User Data (Termasuk Password) Di-Load ke Client 🔴

**Lokasi:** `src/stores/useUserStore.ts:22-26`

**Masalah:**
Seluruh collection `users` (termasuk field `password`) di-load ke client melalui Firestore `onSnapshot`. Data ini tersedia di memory dan dapat diakses via DevTools console.

```typescript
// useUserStore.ts:22-26 - Semua user data (termasuk password) di-load ke client
subscribeUsers: () => {
  const unsub = onSnapshot(collection(db, 'users'), (snapshot) => {
    const users = snapshot.docs.map(d => d.data() as User)  // ← Password included!
    set({ users, isLoading: false })
  })
  return unsub
},
```

**Dampak:**
- Password semua user accessible dari browser DevTools
- Console command `useUserStore.getState().users` akan menampilkan semua data termasuk password
- Attacker tidak perlu akses Firebase Console untuk melihat password

**Rekomendasi Fix:**
- **Opsi A:** Jangan pernah simpan password di Firestore (gunakan Firebase Auth)
- **Opsi B:** Buat Cloud Function yang meng-return user data tanpa field password
- **Opsi C:** Strip field password di Firestore Security Rules menggunakan `request.resource.data.keys()` atau `removeFields()`

---

##### 8. Demo Credentials di UI Login 🟡

**Lokasi:** `src/pages/Login.tsx:184-198`

**Masalah:**
Kredensial demo ditampilkan langsung di UI login, memudahkan attacker untuk mencoba login.

```tsx
// Login.tsx:184-198
<div className="grid grid-cols-2 gap-4 text-xs">
  <div className="text-center">
    <p className="font-medium text-gray-700">Admin</p>
    <p className="text-gray-500">admin@delivery.com</p>
    <p className="text-gray-500">admin123</p>  // ← Password visible!
  </div>
  <div className="text-center">
    <p className="font-medium text-gray-700">Courier</p>
    <p className="text-gray-500">siti@courier.com</p>
    <p className="text-gray-500">courier123</p>  // ← Password visible!
  </div>
</div>
```

**Dampak:**
- Memudahkan unauthorized access
- Attacker tidak perlu melakukan reconnaissance

**Rekomendasi Fix:**
- Hapus demo credentials dari UI untuk production build
- Gunakan environment-based feature flag: `import.meta.env.DEV && <DemoCredentials />`
- Atau buat dedicated demo mode dengan restricted access

---

##### 9. Console Logging Sensitif 🟡

**Lokasi:** `src/lib/firebase.ts:5-6`, `src/lib/fcm.ts:143`, berbagai file lain

**Masalah:**
Banyak `console.log` yang menampilkan informasi sensitif atau internal.

```typescript
// firebase.ts:5-6 - Log API key (partial)
console.log('🔑 API Key:', import.meta.env.VITE_FIREBASE_API_KEY?.substring(0, 10) ?? 'UNDEFINED')
console.log('🔥 Firebase SDK version:', SDK_VERSION)

// fcm.ts:143 - Log FCM token
console.log('✅ FCM token saved:', token.substring(0, 20) + '...')

// AppListeners.tsx - Log sync details
console.log(`Running initial sync for ${user.role} ${user.id}...`)
console.log(`Running delta sync for ${user.role} ${user.id}...`)
```

**Dampak:**
- Informasi internal terekspos di browser console
- Memudahkan attacker memahami sistem
- FCM token partial dapat membantu reconnaissance

**Rekomendasi Fix:**
- Gunakan logging library dengan log levels (debug, info, warn, error)
- Hapus atau guard `console.log` dengan environment check: `if (import.meta.env.DEV)`
- Jangan log informasi sensitif (API key, tokens, user IDs) di production

---

##### 10. Tidak Ada CSRF Protection 🟡

**Lokasi:** `api/send-notification.js`, `src/services/notificationService.ts`

**Masalah:**
API endpoint `/api/send-notification` hanya dilindungi oleh static `x-api-secret` header. Tidak ada CSRF token atau origin validation yang kuat.

```javascript
// send-notification.js:25-29 - CORS check sederhana
const allowedOrigins = ['https://kurirdev.vercel.app', 'http://localhost:5173']
const origin = req.headers.origin
if (allowedOrigins.includes(origin)) {
  res.setHeader('Access-Control-Allow-Origin', origin)
}

// send-notification.js:36-38 - Auth hanya berdasarkan static secret
const secret = req.headers['x-api-secret']
if (!secret || secret !== process.env.API_SECRET) {
  return res.status(401).json({ error: 'Unauthorized' })
}
```

**Dampak:**
- Jika secret bocor (issue #3), attacker dapat mengirim request dari domain manapun
- Tidak ada protection terhadap replay attack

**Rekomendasi Fix:**
- Gunakan Firebase Auth ID token sebagai ganti static secret
- Verifikasi token di server: `admin.auth().verifyIdToken(token)`
- Tambahkan request signing atau nonce untuk mencegah replay attack

---

#### Attack Vector Analysis

```
┌─────────────────────────────────────────────────────────────────┐
│                     POTENTIAL ATTACK VECTORS                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Credential Theft (via Firestore console access)             │
│     → Baca semua password dari Firestore users collection       │
│     → Login sebagai admin/courier manapun                        │
│                                                                  │
│  2. Session Hijacking (via sessionStorage manipulation)         │
│     → Ubah role di sessionStorage dari "courier" ke "admin"     │
│     → Akses admin dashboard tanpa credential                    │
│                                                                  │
│  3. API Abuse (via exposed VITE_API_SECRET)                     │
│     → Kirim push notification palsu ke semua kurir              │
│     → Spam FCM endpoint                                         │
│                                                                  │
│  4. Data Manipulation (via missing Firestore Rules)             │
│     → Ubah status order, fee, komisi                            │
│     → Hapus data users/orders                                    │
│     → Baca data sensitif (phone numbers, addresses)             │
│                                                                  │
│  5. Brute Force (via no rate limiting)                          │
│     → Crack password dengan dictionary attack                   │
│     → Lock rate tergantung kecepatan koneksi                    │
│                                                                  │
│  6. Privilege Escalation (via client-side role check)           │
│     → Modify Firestore document untuk ubah role                 │
│     → Akses fitur admin sebagai courier                         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

#### Security Roadmap (Prioritized)

| Phase | Action | Effort | Impact |
|-------|--------|--------|--------|
| **P0 - Immediate** | Tambahkan Firestore Security Rules | Medium | Critical - mencegah unauthorized access |
| **P0 - Immediate** | Hapus password dari Firestore, migrasi ke Firebase Auth | High | Critical - mencegah credential theft |
| **P0 - Immediate** | Hapus `VITE_API_SECRET`, pindahkan notification ke server-side | Medium | Critical - mencegah API abuse |
| **P1 - Short-term** | Tambahkan rate limiting pada login | Low | High - mencegah brute force |
| **P1 - Short-term** | Implementasi server-side session validation | Medium | High - mencegah privilege escalation |
| **P1 - Short-term** | Bersihkan console.log sensitif | Low | Medium - mengurangi information leakage |
| **P2 - Medium-term** | Implementasi Firebase App Check | Medium | Medium - memverifikasi client legitimacy |
| **P2 - Medium-term** | Hapus demo credentials dari production | Low | Medium - mengurangi attack surface |
| **P2 - Medium-term** | Implementasi CSRF protection | Medium | Medium - mencegah cross-site attacks |
| **P3 - Long-term** | Implementasi audit logging | Medium | Low - deteksi dan forensik |
| **P3 - Long-term** | Implementasi MFA untuk admin | High | Low - defense in depth |

---

### Arsitektur

#### Ringkasan Architecture Issues

| # | Issue | Severity | File Terkait | Dampak |
|---|-------|----------|-------------|--------|
| 1 | Earnings dihitung on-the-fly | 🟡 Medium | `calcEarning.ts`, `CourierEarnings.tsx`, `Dashboard.tsx` | Performa & konsistensi data |
| 2 | Tidak ada Error Boundary | 🔴 High | `App.tsx` (root) | UX crash tanpa recovery |
| 3 | Tidak ada testing | 🟡 Medium | (tidak ada test files) | Regresi tidak terdeteksi |
| 4 | Tidak ada centralized error handling | 🟡 Medium | Semua store & page components | Error tidak konsisten |
| 5 | Race condition pada Firestore subscriptions | 🟡 Medium | `AppListeners.tsx`, `useOrderStore.ts` | Data inconsistency |
| 6 | Tidak ada data validation layer | 🟡 Medium | Semua store | Invalid data masuk ke DB |
| 7 | Tight coupling antara stores | 🟡 Medium | `useOrderStore.ts` → `useSettingsStore` | Sulit di-test & refactor |
| 8 | Inconsistent date handling | 🟡 Low | Berbagai file | Timezone-related bugs |

---

#### Detail Architecture Issues

##### 1. Earnings Dihitung On-the-Fly 🟡

**Lokasi:** `src/lib/calcEarning.ts`, `src/pages/courier/CourierEarnings.tsx`, `src/pages/Dashboard.tsx`, `src/pages/Reports.tsx`

**Masalah:**
Earnings (pendapatan kurir & admin) tidak disimpan sebagai field terpisah di Firestore. Setiap kali earnings perlu ditampilkan, fungsi `calcCourierEarning()` dijalankan ulang untuk setiap order.

```typescript
// calcEarning.ts - Kalkulasi dijalankan berulang kali
export const calcCourierEarning = (order: Order, settings: EarningSettings): number => {
  const effectiveRate = (order.applied_commission_rate ?? settings.commission_rate) / 100
  const effectiveThreshold = order.applied_commission_threshold ?? settings.commission_threshold
  const ongkirKurir = order.total_fee <= effectiveThreshold
    ? order.total_fee
    : order.total_fee * effectiveRate
  return ongkirKurir + (order.total_biaya_titik ?? 0) + (order.total_biaya_beban ?? 0)
}
```

```typescript
// CourierEarnings.tsx:51-72 - Earnings dihitung setiap render via useMemo
const todayStats = useMemo(() => {
  // ...filter orders...
  return {
    earnings: todayOrders.reduce((sum, o) => sum + calcCourierEarning(o, earningSettings), 0),
  };
}, [deliveredOrders]);

const allTimeStats = useMemo(() => {
  return {
    earnings: deliveredOrders.reduce((sum, o) => sum + calcCourierEarning(o, earningSettings), 0),
  };
}, [deliveredOrders]);
```

```typescript
// CourierEarnings.tsx:75-116 - Chart data juga hitung earnings per-order
const chartData = useMemo(() => {
  // Loop 7 hari × N orders × calcCourierEarning() per order
  const days = Array.from({ length: 7 }, (_, i) => {
    // ...
    return {
      earnings: dayOrders.reduce((sum, o) => sum + calcCourierEarning(o, earningSettings), 0),
    };
  });
}, [deliveredOrders, period]);
```

**Dampak:**
- **Performa:** Pada skala 1000 order/hari dengan 20 kurir, setiap halaman earnings menghitung ulang 1000+ kali `calcCourierEarning()`. Dashboard menghitung untuk admin earnings juga.
- **Konsistensi:** Jika `commission_rate` atau `commission_threshold` berubah di tengah periode, earnings lama akan dihitung dengan setting baru (salah). Saat order di-deliver, `applied_commission_rate` sudah di-lock (`useOrderStore.ts:160-162`), tapi Reports.tsx:189-193 menggunakan `commission_rate` dari settings saat ini, bukan dari order.
- **Bug di Reports.tsx:**

```typescript
// Reports.tsx:189-193 - BUG: Menggunakan current settings, bukan applied rate
let totalCourierPayout = 0;
deliveredOrders.forEach(o => {
  const rate = commission_rate / 100;  // ← BUG: harusnya o.applied_commission_rate
  totalCourierPayout += (o.total_fee || 0) * rate;
});
```

**Rekomendasi Fix:**
- Simpan `courier_earning` dan `admin_earning` sebagai field di order saat delivery (bersamaan dengan `applied_commission_rate`)
- Atau buat Firestore Cloud Function yang auto-calculate saat order status berubah ke `delivered`
- Fix bug di `Reports.tsx` agar menggunakan `applied_commission_rate` dari order, bukan dari settings
- Pertimbangkan materialized collection untuk aggregate data (daily/weekly earnings per courier)

---

##### 2. Tidak Ada Error Boundary 🔴

**Lokasi:** `src/App.tsx` (root component)

**Masalah:**
Tidak ada React Error Boundary di manapun dalam aplikasi. Jika terjadi unhandled error di component tree, seluruh aplikasi akan crash dengan white screen of death (WSOD).

```tsx
// App.tsx:237-287 - Suspense tanpa Error Boundary
<Suspense fallback={<LoadingScreen />}>
  <Routes>
    <Route path="/login" element={<AuthRoute><Login /></AuthRoute>} />
    <Route path="/admin" element={<ProtectedRoute allowedRoles={['admin']}><AdminLayout /></ProtectedRoute>}>
      {/* ...routes... */}
    </Route>
    {/* ...tanpa Error Boundary... */}
  </Routes>
</Suspense>
```

**Dampak:**
- User melihat white screen tanpa penjelasan
- Tidak ada cara untuk recover selain refresh halaman
- Courier yang sedang dalam pengiriman kehilangan akses ke order detail
- Error tidak ter-log untuk debugging

**Contoh scenario crash:**
1. Firestore mengembalikan data dengan format tidak terduga
2. `date-fns` throw error karena invalid date string
3. `recharts` crash karena data kosong/invalid
4. IndexedDB quota exceeded

**Rekomendasi Fix:**
Tambahkan Error Boundary di beberapa level:

```tsx
// Level 1: Root - catch semua unhandled error
function RootErrorBoundary({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary
      fallbackRender={({ error, resetErrorBoundary }) => (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center p-8">
            <h1 className="text-xl font-bold text-red-600">Terjadi Kesalahan</h1>
            <p className="text-gray-600 mt-2">{error.message}</p>
            <button onClick={resetErrorBoundary} className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded">
              Coba Lagi
            </button>
          </div>
        </div>
      )}
      onError={(error, info) => {
        // Log error untuk monitoring
        console.error('Root error:', error, info);
      }}
    >
      {children}
    </ErrorBoundary>
  );
}

// Level 2: Per-section - isolasi error ke section tertentu
// Admin dashboard crash tidak mengganggu courier app
```

Gunakan library `react-error-boundary` atau buat custom Error Boundary component.

---

##### 3. Tidak Ada Testing 🟡

**Lokasi:** Tidak ada file test di repository

**Masalah:**
Tidak ada satupun file test (`.test.ts`, `.spec.ts`, `__tests__/`) di repository. Tidak ada testing framework yang dikonfigurasi.

```
// Tidak ditemukan:
- *.test.ts
- *.test.tsx
- *.spec.ts
- __tests__/
- vitest.config.ts
- jest.config.ts
- playwright.config.ts
```

**Dampak:**
- Refactoring berisiko tinggi: perubahan kode tanpa test coverage berpotensi introduce bug
- Regresi tidak terdeteksi: bug yang sudah diperbaiki bisa muncul kembali
- Sulit untuk onboarding developer baru: test sebagai dokumentasi behavior
- Kalkulasi earnings yang kompleks tidak terverifikasi secara otomatis

**Area yang paling butuh test:**

| Area | Alasan | Contoh Test |
|------|--------|-------------|
| `calcEarning.ts` | Logic bisnis kritis, banyak edge case | Test commission calculation dengan berbagai fee, threshold, titik, beban |
| `useOrderStore.ts` | Status transition rules | Test bahwa courier tidak bisa cancel, admin bisa cancel kapan saja |
| `useCourierStore.ts` | Queue FIFO logic | Test queue position saat online/offline/assign |
| `orderCache.ts` | Offline sync logic | Test initial sync, delta sync, integrity check |
| `ProtectedRoute` | Auth & authorization | Test redirect untuk unauthorized access |

**Rekomendasi Fix:**
- **Unit tests:** Gunakan Vitest + React Testing Library untuk component & utility tests
- **Integration tests:** Test store interactions (Zustand stores dengan Firestore mock)
- **E2E tests:** Gunakan Playwright untuk critical flows (login → create order → assign → deliver)
- Target coverage minimal 60% untuk business logic

---

##### 4. Tidak Ada Centralized Error Handling 🟡

**Lokasi:** Semua store dan page components

**Masalah:**
Error handling tidak konsisten di seluruh codebase. Beberapa tempat menggunakan `try/catch` dengan `console.error`, beberapa menggunakan `.catch(console.error)`, beberapa tidak handle error sama sekali.

```typescript
// Pattern 1: try/catch dengan console.error (Pages.tsx:442)
} catch (error) {
  console.error('Error:', error);
}

// Pattern 2: .catch(console.error) inline (Orders.tsx:497)
}).catch(console.error);

// Pattern 3: try/catch tanpa user feedback (AppListeners.tsx:295)
} catch (error) {
  console.error('Sync error:', error);
}

// Pattern 4: Error ditangkap tapi tidak di-handle (CourierEarnings.tsx:26)
} catch (err) {
  console.error('CourierEarnings load error:', err);
  // User tidak tahu ada error
}

// Pattern 5: Error sepenuhnya diabaikan (useOrderStore.ts - fire and forget)
moveToLocalDB(updatedOrder as Order)
  .catch(err => console.error('Mirror write error:', err))
```

**Dampak:**
- User tidak mendapat feedback saat operasi gagal
- Error di-sync operations (IndexedDB) tidak terlihat oleh user
- Sulit untuk debug karena log tidak terstruktur
- Tidak ada retry mechanism untuk transient errors

**Rekomendasi Fix:**
- Buat centralized error handler utility:

```typescript
// utils/errorHandler.ts
type ErrorSeverity = 'low' | 'medium' | 'critical';

interface ErrorContext {
  operation: string;
  component?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
}

export function handleError(error: unknown, context: ErrorContext, severity: ErrorSeverity = 'medium') {
  const errorMessage = error instanceof Error ? error.message : String(error);

  // 1. Log structured error
  console.error(`[${severity.toUpperCase()}] ${context.operation}:`, {
    message: errorMessage,
    ...context,
    timestamp: new Date().toISOString(),
  });

  // 2. Show user feedback (untuk medium/critical)
  if (severity !== 'low') {
    // Dispatch ke notification system
    showErrorToast(errorMessage);
  }

  // 3. Report ke monitoring service (jika ada)
  if (severity === 'critical') {
    // reportToSentry(error, context);
  }
}
```

- Gunakan wrapper untuk async operations:

```typescript
// utils/asyncWrapper.ts
export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  context: ErrorContext,
  options?: { retries?: number; showToast?: boolean }
): Promise<T | null> {
  try {
    return await operation();
  } catch (error) {
    handleError(error, context, 'medium');
    return null;
  }
}
```

---

##### 5. Race Condition pada Firestore Subscriptions 🟡

**Lokasi:** `src/components/AppListeners.tsx`, `src/stores/useOrderStore.ts`

**Masalah:**
Multiple `onSnapshot` subscriptions berjalan secara paralel dan menulis ke store yang sama (`useOrderStore`). Tidak ada mekanisme untuk mencegah race condition saat merge data.

```typescript
// AppListeners.tsx:154-196 - Query 1: Order hari ini
const unsubToday = onSnapshot(
  query(collection(db, 'orders'), where('created_at', '>=', todayStart.toISOString()), ...),
  (snapshot) => {
    const todayOrders = snapshot.docs.map(d => d.data() as Order)
    // Merge dengan existing orders
    const current = useOrderStore.getState().orders
    const merged = [...todayOrders, ...current.filter(o => /* ... */)]
    useOrderStore.getState().setOrders(merged)  // ← Write 1
  }
)

// AppListeners.tsx:200-217 - Query 2: Order aktif (paralel dengan Query 1)
const unsubActive = onSnapshot(
  query(collection(db, 'orders'), where('status', 'not-in', ['delivered', 'cancelled']), ...),
  (snapshot) => {
    const activeOrders = snapshot.docs.map(d => d.data() as Order)
    const current = useOrderStore.getState().orders  // ← Bisa baca state lama
    const merged = [...activeOrders, ...current.filter(o => /* ... */)]
    useOrderStore.getState().setOrders(merged)  // ← Write 2 (bisa overwrite Write 1)
  }
)
```

**Dampak:**
- Data inconsistency: order bisa muncul/hilang secara flickering
- Double rendering: React re-render setiap kali salah satu subscription fire
- Merge logic yang duplikasi dan tidak konsisten

**Rekomendasi Fix:**
- Gunakan single source of truth untuk merge: satu fungsi `mergeOrders()` yang digunakan oleh semua subscriptions
- Gunakan `useRef` atau atomic update untuk mencegah race condition
- Pertimbangkan menggunakan Firestore query aggregation (jika tersedia) untuk mengurangi jumlah subscriptions

---

##### 6. Tidak Ada Data Validation Layer 🟡

**Lokasi:** Semua store yang menulis ke Firestore

**Masalah:**
Tidak ada validasi data sebelum menulis ke Firestore. Validasi hanya dilakukan di UI layer (form validation), yang dapat di-bypass.

```typescript
// useOrderStore.ts:129-130 - Menulis order tanpa validasi
addOrder: async (order) => {
  await setDoc(doc(db, 'orders', order.id), order)  // ← Tanpa validasi
  // ...
}

// useOrderStore.ts:264-273 - Update biaya tanpa validasi range
updateBiayaTambahan: async (orderId, titik, beban) => {
  const total_biaya_titik = titik * 3000;  // ← Tidak validasi titik >= 0
  const total_biaya_beban = beban.reduce((sum, b) => sum + b.biaya, 0);  // ← Tidak validasi biaya >= 0
  await updateDoc(doc(db, 'orders', orderId), { /* ... */ })
}

// useOrderStore.ts:291-296 - Update ongkir tanpa validasi
updateOngkir: async (orderId, totalFee) => {
  await updateDoc(doc(db, 'orders', orderId), {
    total_fee: totalFee,  // ← Tidak validasi totalFee > 0
    // ...
  });
}
```

**Dampak:**
- Negative fee masuk ke database
- Invalid status transition (walaupun sudah ada logic, tidak ada schema validation)
- Data corruption jika field yang required kosong

**Rekomendasi Fix:**
- Tambahkan Zod schema untuk validasi data sebelum write:

```typescript
// schemas/orderSchema.ts
import { z } from 'zod';

export const OrderSchema = z.object({
  order_number: z.string().regex(/^P\d{9}$/, 'Invalid order number format'),
  customer_name: z.string().min(1).max(100),
  customer_phone: z.string().regex(/^\+?[0-9]{10,15}$/),
  customer_address: z.string().min(1),
  total_fee: z.number().min(0, 'Fee cannot be negative'),
  status: z.enum(['pending', 'assigned', 'picked_up', 'in_transit', 'delivered', 'cancelled']),
  payment_status: z.enum(['unpaid', 'paid']),
  titik: z.number().int().min(0).optional(),
  items: z.array(z.object({
    nama: z.string().min(1),
    harga: z.number().min(0),
  })).optional(),
});
```

---

##### 7. Tight Coupling antara Stores 🟡

**Lokasi:** `src/stores/useOrderStore.ts` → `src/stores/useSettingsStore.ts`

**Masalah:**
`useOrderStore` secara langsung meng-import dan memanggil `useSettingsStore.getState()` untuk mendapatkan commission settings. Ini menciptakan tight coupling.

```typescript
// useOrderStore.ts:160-162 - Direct dependency ke store lain
if (status === 'delivered') {
  const { commission_rate, commission_threshold } = useSettingsStore.getState()  // ← Direct coupling
  // ...
}

// useOrderStore.ts:241-242 - Lagi
const { commission_rate, commission_threshold } = useSettingsStore.getState()
```

**Dampak:**
- Sulit di-test: mock dua store sekaligus
- Hidden dependency: tidak obvious dari signature function
- Circular dependency risk jika useSettingsStore perlu data dari useOrderStore

**Rekomendasi Fix:**
- Inject dependency via parameter:

```typescript
// Sebelum (coupled)
updateOrderStatus: async (orderId, status, userId, userName, notes) => {
  const { commission_rate, commission_threshold } = useSettingsStore.getState()  // ← Coupled
  // ...
}

// Sesudah (injected)
updateOrderStatus: async (orderId, status, userId, userName, notes, earningSettings) => {
  // earningSettings di-pass dari caller
  // ...
}
```

---

##### 8. Inconsistent Date Handling 🟡

**Lokasi:** Berbagai file

**Masalah:**
Penanganan tanggal tidak konsisten. Beberapa tempat menggunakan `toISOString()` (UTC), beberapa menggunakan `new Date()` (local), beberapa menggunakan `date-fns` helpers.

```typescript
// orderCache.ts:5-17 - Konversi ke local date string
function getLocalDateStr(isoString: string): string {
  const date = new Date(isoString)
  const year = date.getFullYear()      // ← Local timezone
  const month = String(date.getMonth() + 1).padStart(2, '0')
  // ...
}

// AppListeners.tsx:32-33 - Query dengan UTC ISO string
where('created_at', '>=', start.toISOString()),  // ← UTC

// Dashboard.tsx:91 - Filter dengan local date
const todayOrders = (allOrders || []).filter(o => isToday(new Date(o.created_at)));  // ← Local

// Reports.tsx:119 - Ambil tanggal dari delivery_time atau created_at
const dateStr = (o.status === 'delivered' && o.actual_delivery_time) ? o.actual_delivery_time : o.created_at;
```

**Dampak:**
- Bug di timezone boundary: order yang dibuat jam 23:30 UTC+7 (16:30 UTC) mungkin masuk ke hari yang berbeda tergantung query
- IndexedDB `_date` field menggunakan local timezone, tapi Firestore query menggunakan UTC
- Di negara dengan DST, perhitungan tanggal bisa bergeser 1 jam

**Rekomendasi Fix:**
- Standardisasi: gunakan UTC untuk semua storage dan query
- Buat date utility library yang konsisten:

```typescript
// utils/date.ts
export function toUTCDateStr(isoString: string): string {
  const date = new Date(isoString);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

export function getTodayUTC(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));
  return { start: start.toISOString(), end: end.toISOString() };
}
```

---

#### Architecture Diagram - Current vs Recommended

**Current (Problematic):**

```
┌─────────────────────────────────────────────────────────────────┐
│                        React Components                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │Dashboard │  │ Courier  │  │ Reports  │  │ Orders   │       │
│  │          │  │ Earnings │  │          │  │          │       │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘       │
│       │              │              │              │              │
│       │    ┌─────────┴──────────────┴──────────────┘              │
│       │    │  calcCourierEarning() dipanggil berulang            │
│       │    │  di setiap component                                 │
│       ▼    ▼                                                      │
│  ┌──────────────┐    ┌──────────────┐                             │
│  │useOrderStore │───▶│useSettings   │  ← Tight coupling          │
│  │              │    │Store         │                              │
│  └──────┬───────┘    └──────────────┘                             │
│         │                                                         │
│         ▼                                                         │
│  ┌──────────────┐    ┌──────────────┐                             │
│  │  Firestore   │    │  IndexedDB   │  ← No validation           │
│  │  (no rules)  │    │  (Dexie)     │                              │
│  └──────────────┘    └──────────────┘                             │
│                                                                    │
│  ❌ No Error Boundary                                             │
│  ❌ No Testing                                                    │
│  ❌ Race conditions pada parallel subscriptions                   │
└─────────────────────────────────────────────────────────────────┘
```

**Recommended:**

```
┌─────────────────────────────────────────────────────────────────┐
│                     React Components                             │
│  ┌──────────────────────────────────────────────────────┐       │
│  │              Error Boundary (Root)                    │       │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐           │       │
│  │  │Dashboard │  │ Courier  │  │ Reports  │           │       │
│  │  │(boundary)│  │ Earnings │  │(boundary)│           │       │
│  │  └────┬─────┘  └────┬─────┘  └────┬─────┘           │       │
│  └───────┼──────────────┼──────────────┼─────────────────┘       │
│          │              │              │                          │
│          ▼              ▼              ▼                          │
│  ┌──────────────────────────────────────────────────────┐       │
│  │              Data Layer (Normalized)                  │       │
│  │  • orders (dengan pre-calculated earnings)            │       │
│  │  • courier_daily_summary (materialized)               │       │
│  └──────────────────────────────────────────────────────┘       │
│          │              │              │                          │
│          ▼              ▼              ▼                          │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │  Zustand     │    │  Zod Schema  │    │  Error       │       │
│  │  Stores      │◄──▶│  Validation  │───▶│  Handler     │       │
│  │  (decoupled) │    │              │    │  (central)   │       │
│  └──────┬───────┘    └──────────────┘    └──────────────┘       │
│         │                                                         │
│         ▼                                                         │
│  ┌──────────────┐    ┌──────────────┐                             │
│  │  Firestore   │    │  IndexedDB   │  ← Consistent UTC          │
│  │  (with rules)│    │  (validated) │                              │
│  └──────────────┘    └──────────────┘                             │
│                                                                    │
│  ✅ Error Boundaries at multiple levels                          │
│  ✅ Unit + Integration + E2E tests                               │
│  ✅ Single merge function for subscriptions                       │
│  ✅ Centralized error handling                                    │
│  ✅ Data validation before writes                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### Architecture Roadmap (Prioritized)

| Phase | Action | Effort | Impact |
|-------|--------|--------|--------|
| **P0 - Immediate** | Tambahkan Error Boundary di root | Low | High - mencegah WSOD |
| **P0 - Immediate** | Fix bug Reports.tsx: gunakan `applied_commission_rate` | Low | High - data accuracy |
| **P1 - Short-term** | Simpan `courier_earning` & `admin_earning` di order saat delivery | Medium | High - performa & konsistensi |
| **P1 - Short-term** | Tambahkan Zod validation layer | Medium | High - data integrity |
| **P1 - Short-term** | Buat centralized error handler | Low | Medium - debugging & UX |
| **P2 - Medium-term** | Setup Vitest + write unit tests untuk business logic | Medium | Medium - prevent regressions |
| **P2 - Medium-term** | Standardisasi date handling (UTC) | Medium | Medium - prevent timezone bugs |
| **P2 - Medium-term** | Refactor store coupling (dependency injection) | Medium | Medium - testability |
| **P3 - Long-term** | Setup Playwright E2E tests | High | Low - comprehensive coverage |
| **P3 - Long-term** | Buat materialized summary collections | High | Low - scale to 10k+ orders |

---

### Fitur yang Bisa Ditambahkan

- [ ] Multi-language support (Indonesia/English)
- [ ] Real-time tracking dengan GPS
- [ ] Customer-facing tracking page
- [ ] Automated courier assignment berdasarkan lokasi
- [ ] Payment gateway integration
- [ ] Analytics dashboard yang lebih advanced
- [ ] WhatsApp Business API integration untuk notifikasi customer

### Performa

- Lazy loading sudah diimplementasi dengan baik
- Code splitting dengan manual chunks sudah optimal
- Firestore queries sudah di-filter dengan benar
- IndexedDB caching mengurangi load pada Firestore reads
- **Perlu perhatian:** Earnings calculation on-the-fly akan menjadi bottleneck pada skala 1000+ orders

---

*Dokumen dibuat otomatis berdasarkan analisis codebase KurirDev.*
*Terakhir diperbarui: 29 Maret 2026*
