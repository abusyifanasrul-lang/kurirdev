# 🛵 KurirDev: Comprehensive System Blueprint
**Version**: 2.0 (Secure & Modular Architecture)  
**Last Updated**: 2026-03-31  
**Status**: Stable / Production Ready

---

## 🛠 1. Arsitektur Teknis (Deep Dive)

### **1.1. Core Engine: Local-First & Realtime**
Aplikasi ini dibangun dengan paradigma **Offline-First**. Data utama disimpan di **Firebase Cloud Firestore**, namun UI berinteraksi langsung dengan **IndexedDB** melalui **orderCache.ts** untuk memastikan latensi nol dan efisiensi biaya.

- **Storage Layer**: 
  - **Firestore**: Master data (Realtime sync).
  - **IndexedDB**: Persistent local storage (Order history, Customer database).
  - **Zustand**: In-memory state management (Active UI state).
- **Network Layer**: Service Worker yang menangani caching aset statis dan notifikasi latar belakang (FCM).

### **1.2. Strategi Autentikasi Ganda (Secondary App Pattern)**
Guna mengatasi limitasi Firebase SDK di mana `createUser` akan otomatis mengganti sesi user yang sedang aktif, KurirDev menggunakan **Instance Firebase Kedua**:
- **App A (Primary)**: Menangani login/logout user saat ini (`admin`, `owner`, dll).
- **App B (Secondary)**: Digunakan secara eksklusif oleh fungsi `addCourier` untuk mendaftarkan akun kurir baru ke Firebase Auth tanpa merusak token sesi Admin.

---

## 🛡 2. Sistem Keamanan & Hak Akses (RBAC)

### **2.1. Peran User (Role Definitions)**
| Peran | Scope | Detail Akses |
| :--- | :--- | :--- |
| **Owner** | Full System | Dashboard, Finance, Settings, Pengaturan Komisi, Reports. |
| **Finance** | Keuangan | Dashboard Finance, Penagihan, Analisa, Konfirmasi Setoran. |
| **Admin Kurir** | Operasional | Create Order, Assign Courier, Edit Order, Notifications. |
| **Courier** | Lapangan | Update Status, Lihat Order Aktif, History Pribadi, Map. |

### **2.2. Implementasi Keamanan Firestore (Security Rules)**
Berikut adalah logika teknis di balik `firestore.rules`:
- **Orders**: 
  - `read`: Semua admin dan kurir yang ditugaskan (`resource.data.courier_id == request.auth.uid`).
  - `write`: Admin kurir (buat/edit), Kurir (hanya update `status` & `titik`), Finance (hanya update `payment_status`).
- **Users**: 
  - `read`: Semua admin bisa melihat list kurir.
  - `write`: Hanya Owner yang bisa mengubah peran atau menghapus user.

---

## 📦 3. Skema Database & Relasi (Schema Reference)

### **3.1. Collection: `orders`**
Koleksi paling krusial yang menyimpan siklus hidup pengiriman.
```typescript
interface Order {
  id: string;                       // UUID
  order_number: string;             // Format: KD-{YYYYMMDD}-{INDEX}
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  items?: {nama: string, harga: number}[];
  total_fee: number;                // Ongkir dasar
  total_biaya_titik: number;        // Tambahan per titik
  total_biaya_beban: number;        // Tambahan barang berat/khusus
  status: 'pending' | 'assigned' | 'picked_up' | 'delivered' | 'cancelled';
  payment_status: 'unpaid' | 'paid'; // Status setoran ke Finance
  courier_id: string;               // Reference to users.id
  created_at: ISOString;
  updated_at: ISOString;
  assigned_at?: ISOString;
  delivered_at?: ISOString;
  applied_commission_rate: number;  // Snapshot rate komisi saat order dibuat
}
```

### **3.2. Collection: `users`**
```typescript
interface User {
  id: string;                       // UID Firebase Auth
  name: string;
  phone: string;
  role: 'admin' | 'owner' | 'finance' | 'admin_kurir' | 'courier';
  is_online: boolean;               // Untuk algoritma antrean (FIFO)
  queue_position: number;           // Urutan antrean kurir
  fcm_token?: string;               // Untuk push notification
  last_active: ISOString;
}
```

---

## ⚡ 4. Logika Bisnis & Algoritma Utama

### **4.1. Algoritma Antrean Kurir (FIFO Queue)**
Sistem menentukan kurir "Rekomendasi" berdasarkan:
1. **Status Online**: Hanya yang memiliki `is_online: true`.
2. **First In, First Out**: Kurir yang paling lama menunggu (berdasarkan timestamp `last_active_online` atau `queue_position`) akan muncul di urutan teratas pada modal *Assign*.
3. **Load Balancing**: Saat kurir menerima order, `queue_position` akan diperbarui ke nilai paling akhir untuk memberi giliran bagi kurir lain.

### **4.2. Perhitungan Komisi (Platform Fee)**
Sistem menggunakan komisi dinamis yang dikelola oleh **Owner**:
- **Rumus**: `Setoran = (Total Fee - Komisi Dasar)`
- **Safety**: Rate komisi di-snapshot ke dalam setiap dokumen `order` saat dibuat. Jika Owner mengubah komisi besok, order hari ini tidak akan berubah nilainya (Data Integrity).

---

## 🚀 5. Alur Kerja Operasional (End-to-End)

### **5.1. Skenario Operasional Standard**
1. **Penerimaan Order**: Admin Kurir input data -> Klik "Create Order".
2. **Push Notification**: Sistem mengirim notifikasi via **FCM** ke seluruh kurir Online atau kurir spesifik yang di-*assign*.
3. **Eksekusi Kurir**: Kurir buka HP -> Klik "Ambil" -> Menuju Lokasi -> Update "Picked Up" -> Foto Bukti (optional) -> Selesai "Delivered".
4. **Rekonsiliasi Keuangan**: 
   - Kurir pulang membawa uang tunai.
   - Finance buka "Dashboard Finance".
   - Finance memilih "Penagihan" -> Pilih nama kurir -> Klik "Konfirmasi Setor Semua".
   - Saldo tercatat secara realtime di sistem sebagai pendapatan bersih perusahaan.

---

## 📱 6. PWA & Mobile Experience
- **Offline Sync**: Jika kurir berada di area *dead zone* (tanpa internet), IndexedDB menyimpan update status, dan akan melakukan *background sync* saat sinyal kembali.
- **Installability**: Aplikasi bisa di-install langsung dari Chrome/Safari tanpa melalui PlayStore, memberikan sensasi aplikasi native (Fullscreen, App Icon, Push Notif).

---

## 🛠 7. Panduan Pengembang (Dev Ops)
- **Local Dev**: `npm run dev`
- **Seeding**: Menjalankan `firebaseSeeder.ts` via UI AppListeners untuk inisialisasi akun demo.
- **Security Check**: Selalu verifikasi `AuthContext.tsx` dan `ProtectedRoute` jika ada penambahan rute baru di `App.tsx`.

---
*Dokumen ini dirancang sebagai panduan teknis komprehensif KurirDev.*
