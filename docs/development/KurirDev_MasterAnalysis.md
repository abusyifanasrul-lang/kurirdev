# KurirDev — Master Analysis & Improvement Plan
> Dokumen terpadu hasil merge dari **IMPROVEMENT_PLAN.md** (analisa praktis, action-oriented) dan **Comprehensive Analysis** (analisa arsitektur mendalam). Disertai lapisan analisa tambahan di setiap bagian.

---

## 📌 Tentang KurirDev

**KurirDev** adalah delivery management system untuk bisnis kurir skala kecil–menengah. Dibangun dengan stack modern:

| Layer | Teknologi |
|---|---|
| Frontend | React 19 + TypeScript 5.9 + Vite 7.2 + Tailwind CSS 4.1 |
| State | Zustand 5.0 (localStorage persistence) |
| Backend | Supabase (PostgreSQL + Auth + Realtime + RLS) |
| Offline | Dexie 4.0 + idb 8.0 (IndexedDB) |
| Mobile | Capacitor 8.3 + PWA (Workbox 7.x) |
| Notifikasi | Firebase FCM 11.6 |
| Lainnya | Recharts, jsPDF, html2canvas, date-fns, Axios |

**Target skala:** 300 order/hari saat ini, menuju 1.000+ order/hari dengan 20 kurir aktif.

**Role pengguna:** Super Admin · Admin Kurir · Owner · Keuangan · Kurir

---

## ✅ Yang Sudah Bagus (Jangan Disentuh Dulu)

Sebelum membahas masalah, penting untuk mengakui fondasi yang sudah kokoh:

- **Arsitektur offline-first** dengan IndexedDB — desain yang tepat untuk kurir di lapangan dengan koneksi tidak stabil
- **RBAC (Role-Based Access Control)** — routing sudah terlindungi per-role dengan lazy loading
- **Zustand store management** — bersih, modular, mudah diikuti
- **Realtime Supabase subscriptions** — implementasi sudah benar
- **PWA dengan Workbox** — strategi caching sudah tepat
- **Commission calculation logic** — pure functions, sudah bisa di-test
- **UI components** (Card, Button, Modal, dll) — reusable dan typed
- **Commission logic di DB functions** — `complete_order` dan `mark_order_paid` sebagai atomic operations adalah keputusan arsitektur yang tepat

---

## 🔴 MASALAH KRITIS

### 1. ID Order Bisa Duplikat

**Apa masalahnya:**
Fungsi `generateOrderId()` di `useOrderStore.ts` (baris 464–472) menghasilkan format `P{DDMMYY}{NNN}` hanya berdasarkan hitungan order di **memori browser**, bukan dari database. Setelah browser di-refresh, memori kosong → counter kembali ke 0 → ID bisa bertabrakan.

```typescript
// useOrderStore.ts — KODE BERMASALAH
generateOrderId: () => {
  const todayOrders = get().orders.filter(o => o.order_number.startsWith(`P${dateKey}`))
  return `P${dateKey}${String(todayOrders.length + 1).padStart(3, '0')}` 
}
```

**Dampak:** Dua order berbeda bisa punya nomor yang sama → data tertimpa, invoice tidak akurat, laporan rusak.

**Fix yang direkomendasikan:**
1. Query Supabase untuk `COUNT` order hari ini sebelum generate ID
2. Atau gunakan UUID internal + nomor order via database trigger/sequence
3. **Wajib:** tambahkan `UNIQUE CONSTRAINT` pada kolom `order_number` di database sebagai safety net terakhir

**Estimasi:** 1–2 jam
**Lokasi:** `src/stores/useOrderStore.ts` baris 464–472

---

### 2. Password Tidak Aman (Celah Keamanan Paling Serius)

Masalah ini memiliki **4 vektor serangan** yang saling terkait:

| # | Masalah | File | Baris |
|---|---|---|---|
| a | Password dikirim ke browser (tidak di-strip) | `useUserStore.ts` | 21–41 |
| b | Password hardcoded di source code (`courier123`) | `useCourierStore.ts` | 23–66 |
| c | Password tersimpan di localStorage sebagai plain text | `useCourierStore.ts` | — |
| d | Validasi password dilakukan di client-side | `CourierProfile.tsx` | — |

```typescript
// useCourierStore.ts — SANGAT BERBAHAYA
const INITIAL_QUEUE: Courier[] = [
  { id: "3", name: 'Budi Santoso', password: 'courier123', ... },
]
```

**Tambahan dari analisa mendalam:** Terdapat juga `VITE_API_SECRET` yang ter-expose di client bundle — memungkinkan siapapun mengirim push notification tidak sah ke semua kurir. Ini **celah kritis** yang terpisah dari masalah password.

**Selain itu:** Session store menyimpan peran user sebagai plain JSON yang bisa dimanipulasi via DevTools → privilege escalation dari Kurir ke Admin.

**Fix:**
1. Hapus field `password?` dari interface `User`
2. Strip password di `mapProfileToUser` — jangan pernah kirim ke client
3. Hapus `INITIAL_QUEUE`, ganti dengan seed via script database
4. Pindahkan push notification trigger ke **Supabase Edge Functions** (hapus `VITE_API_SECRET`)
5. Validasi role di server (Supabase RLS), bukan hanya client-side
6. Tambahkan rate limiting untuk login (5 gagal → lock 15 menit)

**Estimasi:** 3–5 jam
**Lokasi:** `useUserStore.ts`, `useCourierStore.ts`, `types/index.ts`, `CourierProfile.tsx`, `.env`

---

### 3. `localStorage.clear()` Saat Logout

**Apa masalahnya:**
`AuthContext.tsx` baris 144 memanggil `localStorage.clear()` yang menghapus **semua** data localStorage di domain tersebut, termasuk data milik aplikasi lain yang co-located.

```typescript
// AuthContext.tsx baris 144
try { localStorage.clear(); } catch(e) {}  // Hapus SEMUA — termasuk data bukan KurirDev!
```

**Fix:** Ganti dengan hapus selektif:
```typescript
const keysToRemove = [
  'session-storage', 'courier-storage', 'settings-storage',
  'lastLoginEmail', 'pwa_update_dismissed', 'kurirdev_db_meta'
];
keysToRemove.forEach(key => localStorage.removeItem(key));
```

**Estimasi:** 30 menit
**Lokasi:** `src/context/AuthContext.tsx` baris 144

---

### 4. Data Kurir Ganda (Dua Sumber Kebenaran)

**Apa masalahnya:**
Data kurir tersimpan di dua tempat berbeda yang bisa tidak sinkron:
1. **localStorage** — array `queue` di `useCourierStore` (persisted di browser)
2. **Supabase** — tabel `profiles` (sumber yang seharusnya jadi acuan)

Desinkronisasi terjadi saat: koneksi gagal, buka di dua tab, atau store version mismatch.

**Dampak:** Sistem FIFO giliran kurir jadi tidak akurat → kurir yang seharusnya dapat order bisa terlewat.

**Fix:**
1. Hapus array `queue` dari localStorage
2. Jadikan `queue_position` di Supabase sebagai **single source of truth**
3. `useCourierStore` hanya jadi view layer dari `useUserStore`, tidak simpan data sendiri
4. Hapus `persist` middleware dari courier store

**Estimasi:** 4–6 jam
**Lokasi:** `src/stores/useCourierStore.ts` (seluruh file)

---

### 5. User Di-Suspend Masih Bisa Login

**Apa masalahnya:**
Flag `is_active` di-hardcode menjadi `true` saat login — sistem tidak membaca nilai dari database.

```typescript
// Login.tsx baris 79–94
const userData = {
  is_active: true,  // Hardcoded! Fitur suspend jadi mati total
}
```

**Dampak:** Kurir yang di-suspend masih bisa login dan terima order. Staff yang dipecat masih bisa akses sistem.

**Fix:** Cek `profile.is_active` setelah fetch profile. Jika `false`, tolak login dengan pesan jelas.

**Estimasi:** 15 menit
**Lokasi:** `src/pages/Login.tsx` baris 79–94

---

## 🟠 MASALAH MENENGAH

### 6. Tidak Ada Error Boundary (Crash = Layar Putih)

Aplikasi tidak memiliki mekanisme React Error Boundary di level manapun. Error runtime = white screen tanpa recovery.

**Fix — tambahkan 3 level:**
1. Root level (`App.tsx`) — tangkap semua error
2. Per-route level — isolate crash (admin crash ≠ kurir crash)
3. Per-chart level — komponen chart error tidak merusak halaman

**Estimasi:** 2–3 jam
**Lokasi:** `src/App.tsx` + buat `src/components/ErrorBoundary.tsx`

---

### 7. Tidak Ada Retry Saat Internet Putus

Semua Supabase writes bersifat fire-and-forget. Kurir di lapangan sinyal jelek → tap "Delivered" → gagal → status order tidak terupdate → kurir tidak dibayar.

```typescript
// useOrderStore.ts — Tidak ada retry
const { error } = await supabase.from('orders').insert(order)
if (error) throw error
```

**Fix — buat fungsi `withRetry`:**
```typescript
async function withRetry(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try { return await fn() }
    catch (error) {
      if (i === maxRetries - 1) throw error
      await sleep(1000 * Math.pow(2, i))  // Exponential backoff
    }
  }
}
```

Prioritas retry: update status delivery → assign kurir → konfirmasi pembayaran → create order baru.

**Estimasi:** 3–4 jam
**Lokasi:** Buat `src/lib/retry.ts`, update semua store files

---

### 8. File Kode Terlalu Besar (God Components)

| File | Baris | Masalah |
|---|---|---|
| `Orders.tsx` | ~1.300 | CRUD + modal + CSV + print + bulk settle |
| `Settings.tsx` | ~1.300 | 5 tab berbeda dalam 1 file |
| `CourierOrderDetail.tsx` | ~985 | Status flow + customer edit + invoice + cancel |
| `Reports.tsx` | ~623 | Juga perlu dipecah |

**Fix contoh untuk `Orders.tsx`:**
```
Orders.tsx (~200 baris, orchestrator)
├── OrderList.tsx
├── OrderModal.tsx
├── AssignModal.tsx
├── CancelModal.tsx
├── InvoicePrint.tsx
└── BulkSettle.tsx
```

**Estimasi:** 8–12 jam
**Lokasi:** `Orders.tsx`, `Settings.tsx`, `CourierOrderDetail.tsx`

---

### 9. Type Safety Lemah (`as any`)

30+ penggunaan `as any` pada Supabase calls → TypeScript tidak bisa mendeteksi error type saat coding. Refactoring menjadi berbahaya.

**Fix:**
1. Generate Supabase types: `npx supabase gen types typescript`
2. Update Supabase client dengan generated types
3. Hapus `as any` satu per satu

**Estimasi:** 4–6 jam

---

### 10. Kalkulasi Earnings di Client Berulang Kali (Performance)

Earnings kurir dihitung ulang dari data mentah setiap kali render — O(n) computation di client. Dengan 1.000+ order/hari di perangkat mobile → potensi UI lag.

**Fix:** Simpan `courier_earning` dan `admin_earning` langsung di record order saat delivery. Gunakan Supabase trigger / Edge Function untuk kalkulasi server-side.

**Tambahan:** Reports.tsx menggunakan commission rate **saat ini** (bukan saat order dibuat), sehingga laporan keuangan bisa salah jika rate pernah berubah. Gunakan `order.applied_commission_rate` yang sudah tersimpan per order.

**Estimasi:** 2–4 jam
**Lokasi:** `src/lib/calcEarning.ts`, `src/pages/Reports.tsx` baris 189–193

---

### 11. Race Condition pada Realtime Subscriptions

Multiple Supabase subscriptions tanpa koordinasi → potensi state tidak konsisten saat dua event datang bersamaan (misalnya, dua admin assign order yang sama secara bersamaan).

**Fix:** Implementasi optimistic updates dengan conflict resolution + debouncing pada rapid subscription events.

**Estimasi:** 3–5 jam
**Lokasi:** `src/components/AppListeners.tsx`, `src/stores/useOrderStore.ts` baris 30–33

---

### 12. Tidak Ada Testing Infrastructure

Tidak ada satu pun file test di seluruh project. Tidak ada Vitest, Jest, atau Playwright.

**Risiko:** Setiap perubahan pada business logic (kalkulasi komisi, status order, auth flow) berpotensi membuat regresi tanpa terdeteksi.

**Fix yang direkomendasikan:**
1. Setup **Vitest + React Testing Library** untuk unit/integration test
2. Prioritas test: `calcEarning.ts`, order status transitions, authentication flow
3. Target coverage 60%+ untuk business logic
4. Tambahkan **Playwright** untuk E2E test pada user journey kritis

**Estimasi:** 8–16 jam (investasi jangka panjang)

---

### 13. Dual Infrastructure Firebase + Supabase

Menggunakan Supabase untuk auth/database tetapi Firebase untuk notifikasi — dua ekosistem yang harus di-maintain secara terpisah.

**Analisa:** Untuk skala saat ini (20 kurir), overhead ini masih bisa ditoleransi. Namun ke depan, evaluasi apakah Supabase Realtime bisa menggantikan FCM untuk in-app notifications, dengan FCM hanya untuk push notification ke background app.

**Estimasi review:** 2 jam (analisa dulu sebelum keputusan migrasi)

---

## 🟡 MASALAH KECIL

### 14. File Sampah Tidak Dipakai

| File | Baris | Kenapa Tidak Dipakai |
|---|---|---|
| `src/services/api.ts` | 201 | REST API client untuk backend yang tidak ada |
| `src/services/mockData.ts` | 223 | Data dummy — sudah tidak relevan |
| `src/components/layout/Sidebar.tsx` | 96 | Sidebar lama ("DeliveryPro"), sudah diganti |

**Estimasi:** 30 menit (hapus setelah konfirmasi tidak ada yang import)

---

### 15. Data Trend Palsu di Dashboard

Angka trend (misalnya "+12%") adalah nilai hardcoded, bukan kalkulasi dari data real.

```typescript
trend: { value: 12, isPositive: true }  // Tidak ada data di balik angka ini
```

**Fix:** Hitung perbandingan revenue/order hari ini vs kemarin (atau minggu ini vs minggu lalu).

**Estimasi:** 30 menit
**Lokasi:** `src/pages/Dashboard.tsx`

---

### 16. Masalah Timezone di IndexedDB

`getLocalDateStr()` di `orderCache.ts` (baris 5–17) mengkonversi tanggal dari UTC ke timezone lokal saat menyimpan. Jika user berpindah timezone atau buka app di timezone berbeda, order bisa muncul di tanggal yang salah atau tidak muncul sama sekali.

**Fix:** Gunakan UTC string secara konsisten di semua layer. Konversi ke timezone lokal hanya saat menampilkan di UI.

**Estimasi:** 2–3 jam

---

### 17. `console.log` Berlebih di Production

`firebase.ts`, `fcm.ts`, `AuthContext.tsx`, `Login.tsx` dan banyak file lainnya akan tetap print log di production — termasuk partial API key dan FCM token.

**Fix — buat logging utility:**
```typescript
// src/lib/logger.ts
export const logger = {
  debug: (...args) => import.meta.env.DEV && console.log(...args),
  info: (...args) => console.info(...args),
  warn: (...args) => console.warn(...args),
  error: (...args) => console.error(...args),
}
```

**Estimasi:** 1 jam

---

### 18. IndexedDB Tidak Punya Auto-Cleanup

Tidak ada mekanisme pembersihan data lama di IndexedDB. Dengan 1.000 order/hari, storage bisa penuh dalam beberapa bulan → app crash di perangkat low-storage.

**Fix:** Prune otomatis order > 1 tahun. Monitoring storage quota, cleanup ketika > 80%.

**Estimasi:** 2–3 jam
**Lokasi:** `src/lib/orderCache.ts`

---

## 🗺️ ROADMAP PERBAIKAN

### Phase 1 — SEGERA (Minggu Ini) | ~8–12 jam

| # | Masalah | Estimasi | Kenapa Urgent |
|---|---|---|---|
| 2 | Password + API Secret Exposure | 3–5 jam | Celah keamanan aktif |
| 5 | User Suspend Masih Login | 15 menit | Fitur suspend mati total |
| 3 | `localStorage.clear()` | 30 menit | Side effect berbahaya |
| 1 | ID Order Duplikat | 1–2 jam | Risiko integritas data |

### Phase 2 — Reliabilitas (2–3 Minggu ke Depan) | ~12–18 jam

| # | Masalah | Estimasi | Kenapa Penting |
|---|---|---|---|
| 4 | Data Kurir Ganda | 4–6 jam | Assignment kurir tidak akurat |
| 6 | Error Boundary | 2–3 jam | Crash = white screen |
| 7 | Retry Logic | 3–4 jam | Data hilang saat sinyal jelek |
| 11 | Race Condition | 3–5 jam | Stabilitas realtime |

### Phase 3 — Maintainability (Bulan Ini) | ~18–28 jam

| # | Masalah | Estimasi | Kenapa Penting |
|---|---|---|---|
| 8 | File Terlalu Besar | 8–12 jam | Developer velocity |
| 9 | Type Safety | 4–6 jam | Refactoring safety |
| 12 | Testing Infrastructure | 8–16 jam | Investasi jangka panjang |
| 17 | Console.log | 1 jam | Cleanup production |
| 14 | File Sampah | 30 menit | Bundle size & kebersihan |

### Phase 4 — Polish (Kapan-Kapan) | ~8–14 jam

| # | Masalah | Estimasi |
|---|---|---|
| 10 | Earnings calculation + Reports | 2–4 jam |
| 15 | Trend Palsu di Dashboard | 30 menit |
| 16 | Timezone Issue | 2–3 jam |
| 18 | IndexedDB Auto-cleanup | 2–3 jam |
| 13 | Dual Firebase/Supabase Review | 2 jam |

### **Total Estimasi: ~46–72 jam kerja**

---

## 🔍 ANALISA MENDALAM

### Penilaian Risiko Keseluruhan

Dari semua temuan, terdapat **hierarki risiko** yang jelas:

**Tier 1 — Risiko Langsung (harus fix sekarang):**
Masalah password dan API secret bukan hanya "celah keamanan teori" — siapapun yang membuka DevTools di browser bisa:
1. Membaca password kurir
2. Menyamar sebagai user lain dengan edit session storage
3. Mengirim push notification palsu ke semua kurir dengan menggunakan `VITE_API_SECRET`

Ini bukan skenario edge case — ini bisa dilakukan oleh kurir yang iseng dalam hitungan menit.

**Tier 2 — Risiko Operasional (berdampak bisnis setiap hari):**
ID duplikat dan data kurir ganda adalah "time bomb" — saat ini mungkin belum terasa, tapi semakin banyak order dan semakin sering refresh, semakin sering terjadi. Ketika terjadi, debugging-nya sangat sulit karena data sudah terlanjur rusak.

**Tier 3 — Risiko Pertumbuhan (akan terasa saat skala naik):**
Kalkulasi earnings di client, tidak ada testing, dan file God Component akan memperlambat development velocity secara signifikan saat tim perlu menambah fitur atau ketika volume order mencapai 1.000+/hari.

---

### Arsitektur: Kekuatan dan Kelemahan Tersembunyi

**Kekuatan arsitektur yang sering diabaikan:**
- Keputusan menggunakan **database functions** (`complete_order`, `mark_order_paid`) untuk atomic operations adalah pilihan yang sangat tepat — ini mencegah partial state di level paling kritis
- **Hybrid caching** (Supabase untuk active orders, IndexedDB untuk history) adalah tradeoff yang reasonable dan well-considered
- **Lazy loading per role** bukan hanya optimasi bundle — ini juga memperkuat keamanan karena kode admin tidak pernah di-load di browser kurir

**Kelemahan tersembunyi yang belum didokumentasikan:**
- **Tight coupling antar store** — `useOrderStore` langsung import `useCourierStore` dan `useUserStore`. Ini membuat unit testing hampir mustahil dan bisa menyebabkan circular dependency jika fitur bertambah. Solusi jangka panjang: event-driven communication via Zustand subscribe pattern
- **Tidak ada abstraction layer** di atas Supabase — semua store langsung memanggil Supabase client. Jika suatu saat perlu migrasi backend atau tambah offline queue, perubahan harus dilakukan di puluhan tempat sekaligus
- **Mock API (`api.ts`)** masih ada dan belum dibersihkan — berisiko developer baru salah menggunakannya, membuat dua jalur data yang tidak konsisten

---

### Skenario "What Could Go Wrong" di Production

**Skenario 1 — Order Duplikat saat Peak Hour:**
Pada jam sibuk (misal pagi 08:00–10:00), banyak admin membuat order secara bersamaan. Masing-masing browser memiliki cache memori yang berbeda. Kemungkinan ID `P030426001` dibuat dua kali dalam satu hari sangat tinggi. Konsekuensi: data order saling tertimpa di Supabase, kurir yang assign ke order "asli" tiba-tiba tidak punya order.

**Skenario 2 — Kurir di Lapangan Sinyal Buruk:**
Kurir di daerah dengan sinyal tidak stabil tap "Delivered" → request gagal → tidak ada retry → kurir tidak tahu apakah berhasil → tap lagi → bisa double update atau tidak update sama sekali. Tanpa Error Boundary, jika error JavaScript terjadi setelahnya, layar kurir menjadi putih. Kurir tidak bisa lapor ke siapa pun karena tidak ada pesan error.

**Skenario 3 — Skalabilitas ke 1.000+ Order/hari:**
Dengan 1.000 order/hari dan tidak ada pagination/indexing database + kalkulasi earnings di client side setiap render, halaman Reports dan Dashboard akan semakin lambat. Pada titik tertentu, ini bukan sekadar "agak lambat" — bisa time out atau browser crash di mobile.

---

### Pertanyaan Strategis untuk Tim

Sebelum memulai perbaikan besar, ada baiknya menjawab pertanyaan ini terlebih dahulu:

1. **Apakah ada rencana backend REST API?** Jika ya, `api.ts` jangan dihapus — refactor saja isinya
2. **Apakah ada rencana rilis ke Google Play Store?** Ini akan mempengaruhi prioritas Capacitor + native features
3. **Apakah ada rencana multi-tenant?** (satu instance untuk banyak bisnis kurir berbeda) Ini mengubah arsitektur secara fundamental
4. **Berapa banyak user aktif dan order/hari sekarang?** Untuk menentukan seberapa mendesak optimasi performance
5. **Apakah ada requirement audit log?** Jika ya, configuration versioning (masalah #18 dari analisa mendalam) perlu diprioritaskan lebih cepat

---

## 📎 Lampiran: Daftar Lengkap File yang Perlu Diubah

| Masalah | File | Aksi |
|---|---|---|
| ID Order Duplikat | `src/stores/useOrderStore.ts:464–472` | Edit |
| Password Exposure | `src/stores/useUserStore.ts:21–41` | Edit |
| Password Exposure | `src/stores/useCourierStore.ts:23–66` | Edit |
| Password Exposure | `src/types/index.ts:35` | Edit |
| Password Exposure | `src/pages/courier/CourierProfile.tsx` | Edit |
| API Secret | `src/services/notificationService.ts:14` | Refactor |
| API Secret | `.env:8` | Hapus `VITE_API_SECRET` |
| localStorage.clear | `src/context/AuthContext.tsx:144` | Edit |
| Data Kurir Ganda | `src/stores/useCourierStore.ts` | Refactor besar |
| User Suspend | `src/pages/Login.tsx:79–94` | Edit |
| Error Boundary | `src/App.tsx` | Edit |
| Error Boundary | `src/components/ErrorBoundary.tsx` | Buat baru |
| Retry Logic | `src/lib/retry.ts` | Buat baru |
| Retry Logic | Semua store files | Update |
| File Besar | `src/pages/Orders.tsx` | Pecah menjadi 6 komponen |
| File Besar | `src/pages/Settings.tsx` | Pecah per tab |
| File Besar | `src/pages/courier/CourierOrderDetail.tsx` | Pecah |
| Type Safety | `src/types/supabase.ts` | Generate ulang |
| Type Safety | `src/lib/supabaseClient.ts` | Update |
| Reports Bug | `src/pages/Reports.tsx:189–193` | Edit |
| Trend Palsu | `src/pages/Dashboard.tsx` | Edit |
| Timezone | `src/lib/orderCache.ts:5–17` | Edit |
| Console.log | `src/lib/logger.ts` | Buat baru |
| Console.log | `src/lib/firebase.ts`, `fcm.ts`, dll | Update |
| File Sampah | `src/services/api.ts` | Hapus (konfirmasi dulu) |
| File Sampah | `src/services/mockData.ts` | Hapus |
| File Sampah | `src/components/layout/Sidebar.tsx` | Hapus |

---

> **Dokumen ini merupakan gabungan dari dua analisa terpisah terhadap codebase KurirDev, diperkaya dengan analisa risiko, skenario failure, dan rekomendasi strategis.**
>
> Dibuat: 3 April 2026
