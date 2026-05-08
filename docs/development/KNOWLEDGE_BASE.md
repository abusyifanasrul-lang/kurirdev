# KurirDev Knowledge Base & Technical Specifications

Dokumen ini merupakan rangkuman komprehensif mengenai spesifikasi teknis, keputusan arsitektur, dan pola-pola pengembangan yang telah disepakati berdasarkan riwayat pengembangan (changelog) interaksi AI dan *Human Engineer* hingga April 2026.

---

## 1. Stack Teknologi & Standar *Build*

- **Framework:** React + Vite
- **Bahasa:** TypeScript (`tsc --noEmit` adalah gerbang wajib yang mensyaratkan 0 error kompilasi *strict mode* sebelum melakukan proses pembangunan *built* aplikasi PWA).
- **Backend/BaaS:** Supabase (PostgreSQL, Auth, Realtime)
- **State Management:** Zustand
- **Target OS:** Android/Mobile First (Berjalan dalam wujud Progressive Web App / PWA)

---

## 2. Arsitektur State & Supabase Realtime

Sistem *Realtime* di KurirDev menggunakan pendekatan *Singleton* untuk koneksi *Web Socket*, namun pengelolaan data (State) sepenuhnya disebar (*Decentralized*) ke dalam Zustand *stores*.

### Aturan Wajib Zustand Stores
Setiap entitas data besar dipecah ke dalam storanya masing-masing (`useOrderStore`, `useCustomerStore`, `useSettingsStore`, dsb.).
1.  **Tracking Status:** Setiap Store **wajib** mencatat status jalinan koneksinya (terhadap channel Supabase spesifik) ke dalam properti internal bernama `realtimeStatus: Record<string, string>`.
2.  **Tabula Rasa (Bersih Total):** Setiap store **wajib** memiliki ekspor fungsi `.reset()` yang tidak memodifikasi sisa objek lama (*No spreading the old state in unpredictable ways*). `.reset()` harus mereset ulang secara eksplisit status realtime menjadi kosong: `realtimeStatus: {}`.
3.  **Session Hygiene:** Di dalam lapisan `AuthContext`, pada alur fungsi otentikasi Logout, Anda **wajib** secara simultan memanggil `.reset()` milik seluruh *stores*. Hal ini mencegah kebocoran sesi di mana *status channel lost* pada profil lama memicu indikator "Degraded Network/Syncing" saat melakukan *role switching* tanpa menyegarkan halaman.

### Full Snapshot Replacement
Untuk mengatasi disrupsi data karena masa diam ponsel (idle mode / offline singkat), KurirDev mengabaikan pembaruan parsial (`array.mutations`) paska sambungan ulang. 
Jika sebuah channel mengalami kendala (`errored`/`closed`) dan kembali tergabung, sistem secara otomatis melakukan "Full Snapshot Replacement" yaitu prosedur pengambilan ulang keseluruhan data via API reguler `.select()` Supabase lalu menimpa (replace) seluruh *state cache* guna menihilkan ancaman sinkronisasi tertinggal separuh (*half-synced state*).

---

## 3. UI/UX dan Mobile-First Ergonomics

Desain difokuskan pada pengemudi kurir (*Delivery Partners*) yang memegang gawai berbasis layar sempit dan memiliki spesifikasi yang bervariatif.
- **Kondensasi Tampilan (Condensing Data):** Untuk area padat informasi seperti Bon / Invoice, desain menggunakan tata letak *horisontal stacking*, tidak sekadar menumpuk paragraf ke bawah untuk meminimalisasi *scroll* vertikal.
- **Batasan Skala:** Pencegahan teks dan kotak tumpah (overflow) dari *viewport*, tertutama untuk ikon nama atau formulir isian detail alamat kurir. Pembuatan komponen notifikasi pop-up buatan (*Custom UI Alerts*) menyingkirkan `window.alert` bawaan browser untuk koherensi tema.
- **Performa TBT & TTI (Lazy-by-Default):** Untuk memotong metrik antrean peluncuran aplikasi awal di ponsel murah (*Total Blocking Time* & *Time to Interactive*), pra-muat bundel agresif telah dieliminasi. Evaluasi *Javascript* dibagi secara terpisah (fragmented js evaluations).

---

## 4. Keamanan dan Audit Log (*Audit Trails*)

Kejernihan rantai komando adalah syarat mutlak dalam finansial sistem pengantaran:
1.  **Log Aksi Admin:** Setiap pembuatan data transaksi (assignment), konfirmasi pembayaran, hingga pembatalan transaksi (*cancelation*), secara wajib menancapkan data aktor otorisasinya. (cth: `Ditugaskan Oleh`, `Dikonfirmasi Oleh`, `Dibatalkan Oleh`).
2.  **Pemisahan "PENDING":** Filter logika secara eksplisit memisahkan order yang sukses "Selesai" atau "Batal" agar tidak membebani dan nyangkut di dalam UI *pending* di sisi kurir. Data flag boolean `is_waiting` dibersihkan pada iterasi final di backend.
3.  **Sanitasi Integritas Tipe UUID:** String asal yang dirangkai seperti `260407-0004` (Nomor Tagihan Internal) diwajibkan untuk diubah formatnya atau dicegah dilempar masuk ke kolom bertipe UUID pada postgreSQL/Supabase. Error "Format Input Invalid" harus ditangkap di layer klien dan ditolak.

---

## 5. IndexedDB & Offline Resilience

Laporan keuangan dasbor dan riwayat order disinkronkan secara ganda ke antarmuka `IndexedDB` sebagai penampung lokal untuk mencegah layar yang *blank* serta meringankan konsumsi *bandwidth* di jalanan sewaktu sinyal seluler drop, sembari tetap mencocokan nilai *settlement* bersih antar departemen *Finance* dan saldo *Courier*.
