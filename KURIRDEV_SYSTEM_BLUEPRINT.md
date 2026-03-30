# 🛵 KurirDev System Blueprint
**Version**: 1.0 (Secure Auth & Role Split Edition)  
**Last Updated**: 2026-03-31

---

## 1. Arsitektur Sistem (High Level)
KurirDev adalah aplikasi manajemen pengiriman berbasis **Progressive Web App (PWA)** dengan arsitektur **Local-First & Realtime**.

### **Tech Stack:**
- **Frontend**: React.js + Vite + TailwindCSS + Lucide Icons.
- **State Management**: Zustand (Global) & React Context (Auth).
- **Backend-as-a-Service**: Firebase (Auth, Firestore, Hosting, Cloud Messaging).
- **Offline Reliability**: IndexedDB (Local cache) & Service Workers (PWA).

---

## 2. Framework Autentikasi & Keamanan
Sistem telah bermigrasi dari legacy password (Firestore-based) ke **Firebase Authentication** tingkat industri.

### **Strategi Dual-Auth (Secondary App):**
Untuk mendukung pembuatan akun kurir oleh admin tanpa merusak sesi login admin yang sedang aktif, sistem menggunakan instance Firebase kedua (`secondaryApp`):
1. **Primary Auth**: Mengelola sesi user yang sedang login di browser.
2. **Secondary Auth**: Digunakan di latar belakang oleh Admin untuk melakukan *provisioning* (pembuatan akun) user baru ke Firebase Auth agar UID tersinkronisasi.

### **Firestore Security Rules:**
Keamanan berbasis server (Server-side) yang membatasi akses koleksi berdasarkan peran:
- **`request.auth != null`**: Hanya user terautentikasi yang bisa masuk.
- **`get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role`**: Aturan validasi peran dinamis untuk setiap request database.

---

## 3. Role-Based Access Control (RBAC) Matrix
Sistem membagi tugas admin ke dalam tiga segmen spesifik untuk mencegah *overlap* tanggung jawab.

| Peran | Tanggung Jawab Utama | Akses Halaman | Aksi Kritis |
| :--- | :--- | :--- | :--- |
| **Admin Kurir** | Operasional Harian | Dashboard, Orders, Couriers, Notifications | New Order, Assign Courier, Cancel Order |
| **Finance** | Keuangan & Setoran | Finance Dashboard, Penagihan, Analisa, Reports | Confirm Payment (Setoran), View Fiscal Data |
| **Owner** | Analisa Bisnis | Overview, Reports, Finance, Settings | Full System Wide Access, Global Analytics |
| **Courier** | Pengiriman (Mobile) | Courier Dashboard, History, Profile | Status Update, Map Navigation, Personal Earnings |

---

## 4. Workflows Utama

### **4.1. Lifecycle Pesanan (Order)**
1. **Creation**: **Admin Kurir** membuat order (bisa via Database Konsumen Master/Manual).
2. **Assignment**: Sistem menggunakan **FIFO Queue** (First-In, First-Out) untuk merekomendasikan kurir yang paling lama menunggu (berdasarkan `queue_position`).
3. **Execution**: **Kurir** menerima notifikasi PWA (FCM) -> Menuju Penjual -> Picked Up -> In Transit -> Delivered.
4. **Settlement**: **Finance** melakukan verifikasi setoran kurir via tombol khusus "Konfirmasi Setoran". Status bayar berubah menjadi `paid`.

### **4.2. Local-First Caching (Performance Optimizer)**
- **IndexedDB**: Digunakan untuk menyimpan data order historis skala besar di perangkat user.
- **Delta Sync**: Aplikasi hanya mendownload perubahan data terbaru (delta), sehingga menghemat kuota Firebase Read secara signifikan.
- **Offline Mode**: Kurir tetap bisa melihat detail alamat meskipun sinyal terputus di jalan.

---

## 5. Skema Data (Schema Highlight)

### **Collection: `users`**
```json
{
  "id": "UID_FIREBASE",
  "name": "Full Name",
  "role": "admin_kurir | finance | owner | courier",
  "is_online": true,
  "last_active": "ISOString",
  "fcm_token": "TOKEN_FCM_NOTIFICATION"
}
```

### **Collection: `orders`**
```json
{
  "id": "UUID",
  "order_number": "KD-2024XXXX",
  "status": "pending | assigned | picked_up | in_transit | delivered | cancelled",
  "payment_status": "unpaid | paid",
  "total_fee": 15000,
  "courier_id": "LOCKED_UID",
  "applied_commission_rate": 10
}
```

---

## 6. Fitur Unggulan
- **Automatic Queue Rotation**: Mengatur giliran kurir secara adil berdasarkan ketersediaan (Online/Offline).
- **Dynamic Invoicing**: Print struk instan (PDF/Thermal) langsung dari browser dengan rincian biaya beban & titik tambahan.
- **Smart Notification**: Push notification ke HP kurir saat ada order baru tanpa perlu refresh aplikasi.

---
*Dokumen ini adalah acuan resmi bagi pengembang dan administrator KurirDev.*
