# Master Technical Design & Architecture: Proyek KurirDev (Deep-Dive Edition)

Dokumen ini adalah panduan teknis otoritatif untuk aplikasi **KurirDev**, yang menggabungkan analisis arsitektur tingkat tinggi dengan rincian implementasi tingkat rendah (TDD) berdasarkan inspeksi kode sumber secara mendalam.

---

## 1. Blueprint Arsitektur: Mirroring & Resilience

KurirDev menggunakan **Mirroring Architecture** untuk mengatasi tantangan konektivitas di lapangan bagi kurir.

### A. Aliran Data Mirroring (`src/lib/orderCache.ts`)
Aplikasi tidak melakukan fetch data secara naif. Aliran datanya adalah:
1.  **Optimistic UI**: Halaman memuat data dari `IndexedDB` via Dexie untuk render instan (< 100ms).
2.  **Metadata Tracking**: `localStorage` menyimpan `kurirdev_db_meta` yang melacak `last_delta_sync` per-user ID.
3.  **Gap Filling**: `useOrderStore` melakukan query `updated_at > last_sync` ke Supabase untuk mengambil perubahan selama aplikasi tertutup.
4.  **WebSocket Mirror**: Setiap perubahan di database (INSERT/UPDATE) dicerminkan ke `IndexedDB` dan state `Zustand` secara atomik.

### B. Hardened Realtime (`src/stores/useOrderStore.ts`)
Menghindari "Session Leakage" dan "Channel Overload" dengan:
- **`_resyncLock`**: Mekanisme Promise-based lock untuk mencegah multiple resync saat HMR atau reconnect.
- **Throttling**: Resync dibatasi 30 detik untuk efisiensi baterai dan bandwidth.
- **Atomic Subscriptions**: Menggunakan Map (`orderChannels`) untuk memastikan satu filter hanya memiliki satu koneksi aktif.

---

## 2. Bedah Jeroan: Logika Inti Aplikasi

### A. Dispatching System: FIFO 2.0 (`src/pages/Orders.tsx`)
Logika penugasan kurir menggunakan sistem antrian 6-Tier yang sangat spesifik:

| Tier | Kondisi Kode | Keterangan |
| :--- | :--- | :--- |
| **1** | `is_priority_recovery` | Kurir yang terkena error sistem/force logout (Prioritas Tertinggi). |
| **2** | `courier_status === 'stay'` | Kurir yang standby di pangkalan/pos. |
| **3** | `status === 'on'` & 0 active | Kurir aktif yang benar-benar tidak punya tugas (True FIFO). |
| **4** | `status === 'on'` & has pending | Kurir yang sudah ditugasi tapi belum pickup. |
| **5** | `status === 'on'` & in transit | Kurir yang sedang di jalan (Paling akhir di antrian). |
| **6** | Default | Fallback untuk kurir offline/tidak valid. |

**Tiebreaker**: Jika tier sama, diurutkan berdasarkan `queue_joined_at` (waktu mulai online).

### B. Financial Engine: Hybrid Commission (`supabase/migrations/..._deduction_logic.sql`)
Logika keuangan KurirDev bersifat "Immutable History":
- **JS Implementation (`calcEarning.ts`)**: Digunakan untuk estimasi di UI (Live Preview).
- **SQL Implementation (`complete_order` RPC)**: Sumber kebenaran (Source of Truth). Menghitung `applied_admin_fee` saat order diselesaikan dan menyimpannya di tabel `orders`.
- **Dua Model**:
    - `percentage`: Admin mengambil sisa persentase (misal: Rate 80% -> Admin 20%).
    - `flat`: Biaya tetap (misal 1000 per 10rb) dengan batas `commission_threshold`.

### C. Kehadiran & Denda (`src/stores/useAttendanceStore.ts`)
- **QR Attendance**: Absensi mencatat `first_online_at` dan `last_online_at`.
- **Automatic Fines**: Sistem menghitung keterlambatan (`late_minutes`) dan mengenakan `flat_fine`.
- **Settle Mechanism**: Admin harus melakukan RPC `settle_attendance_fine` untuk memvalidasi pembayaran denda kurir.

---

## 3. Technical Design Document (TDD): Implementasi Rendah

### A. Penanganan Native QR Scanner
Karena menggunakan `Capacitor-Google-ML-Kit`, UI WebView harus dibuat transparan agar kamera native terlihat.
```css
/* src/index.css */
body.scanner-active #root {
  opacity: 0 !important;
  pointer-events: none !important;
}
html.scanner-active {
  background-color: transparent !important;
}
```

### B. Notifikasi & FCM Bridge (`src/stores/useNotificationStore.ts`)
- **FCM Token Management**: Token dikelola di tabel `profiles`.
- **Gap Filling Notif**: Menggunakan `fetchRecentNotifications` dengan operator `.gt('sent_at', since)` untuk mengambil notifikasi yang terlewat saat offline.
- **Broadcast Ping**: Fitur `pingRealtime` untuk memverifikasi apakah channel notifikasi masih aktif secara dua arah.

### C. Desain Sistem (Tailwind CSS v4)
Menggunakan konfigurasi CSS-first untuk performa maksimal:
- **Brand Identity**: `--color-brand-cyan`, `--color-brand-teal`, `--color-brand-dark`.
- **Mobile First**: Breakpoints khusus `mini` (320px) dan `xs` (375px) untuk optimasi layar HP lama.

---

## 4. Keamanan & Performa (Rugged Programming)

### A. Multi-Phase Cleanup
Sistem pemeliharaan database dilakukan secara bertahap:
1.  Identifikasi data sampah.
2.  Buffer delay (mencegah beban CPU 100%).
3.  Atomic Delete via RPC.

### B. Health Monitoring
Aplikasi memantau kesehatan sistem via `useRealtimeHealth` yang memberikan indikator warna pada Logo Sidebar:
- **Emerald (Pulse)**: Sehat & Terhubung.
- **Amber**: Menghubungkan kembali/Syncing.
- **Red**: Terputus (Offline Mode Aktif).

---

## 5. Analisis Graphify (Stats & Community)

Berdasarkan laporan terakhir (`graphify-out/GRAPH_REPORT.md`):
- **Nodes**: 3,448 | **Edges**: 11,062.
- **Centrality**: `useOrderStore` dan `orderCache` adalah hub utama informasi.
- **Komunitas 9**: Fokus pada logika perhitungan keuangan.
- **God Nodes**: Dominasi `io()`, `filter()`, dan `map()` menandakan aplikasi ini bersifat *heavy client-side data processing*.

---

## 6. Struktur Keputusan (Antigravity Memory)

Seluruh keputusan teknis di atas disinkronkan ke `KNOWLEDGE_MAP.md`. Setiap kali perintah `commit and push` dijalankan, skrip `.agent/scripts/antigravity_mem/sync_mem.py` akan memastikan pengetahuan ini tetap terbarui dan konsisten dengan kode terbaru.

---
*Dokumen ini bersifat dinamis dan diperbarui berdasarkan analisis kode sumber terbaru (2026-04-28).*
