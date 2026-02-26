# Tips & Tricks: Debugging & Perbaikan ala KurirDev 🚀

Dokumentasi ini menjelaskan bagaimana saya (sebagai asisten AI) mengidentifikasi masalah dan melakukan perbaikan pada proyek ini. Kamu bisa mengikuti langkah-langkah ini untuk troubleshooting mandiri.

---

## 🔍 1. Bagaimana Saya Menemukan Error?

Proses saya biasanya mengikuti alur logis berikut:

### A. Analisis Statis (Membaca Kode)
Saya tidak hanya melihat file yang error, tapi juga **keterkaitannya**.
-   **Mencari Mismatch**: Misalnya, jika kolom tabel berantakan, saya membandingkan urutan `header` di `<thead>` dengan urutan data di `<tbody>`.
-   **Dependency Check**: Jika ada fungsi yang tidak jalan, saya cek apakah *import*-nya benar dan apakah *props* yang dipassing sudah sesuai tipe datanya.

### B. Simulasi & Log Inspection
Karena saya tidak punya layar fisik, saya mengandalkan:
-   **Console Logs**: Saya sering menyarankan penambahan `console.log` di titik-titik krusial (seperti sebelum `fetch` atau di dalam `useEffect`).
-   **Network Trace**: Memeriksa status code (401 Unauthorized, 404 Not Found, 500 Server Error) untuk menentukan apakah masalah ada di Frontend atau Backend (Vercel/Firebase).

### C. Re-verifikasi Manual
Saya sering meminta kamu (USER) untuk:
-   Membuka **DevTools > Application > Service Workers**.
-   Mencentang **"Update on reload"**.
-   Melihat **Vercel Logs** untuk fungsi serverless.

---

## 🛠️ 2. Tips Spesifik untuk KurirDev

### 📲 PWA & Service Worker (sw.js)
Masalah paling umum adalah **Cache yang Basi** (User tidak melihat perubahan terbaru).
-   **Tip**: Selalu ubah `CACHE_NAME` atau `version` di `sw.js` setiap ada perubahan besar.
-   **Trick**: Gunakan `skipWaiting()` agar Service Worker baru langsung aktif tanpa menunggu user menutup semua tab.

### 🔔 Firebase Cloud Messaging (FCM)
Jika notifikasi tidak masuk:
1.  **Cek VAPID Key**: Pastikan kunci di Frontend (`getToken`) sama persis dengan yang ada di Firebase Console.
2.  **401 Unauthorized**: Biasanya karena `serviceAccountKey.json` di Vercel/Backend sudah kadaluarsa atau salah konfigurasi Environment Variables.
3.  **Permission**: Pastikan browser sudah mengizinkan notifikasi (klik ikon gembok di URL bar).

### 📦 Zustand & LocalStorage Versioning
Jika kamu menambah atau menghapus field di "Store" (authStore, orderStore), user yang sudah login mungkin akan mengalami error karena data di `localStorage` mereka tidak cocok dengan struktur baru.
-   **Trick**: Gunakan sistem **Store Versioning**. Setiap kali mengubah skema data, saya biasanya menambahkan logika untuk mengecek versi dan melakukan `localStorage.clear()` atau migrasi data manual jika versinya tidak cocok.

### 🌉 Vercel FCM Bridge (Serverless)
Karena kita ingin backend yang gratis dan portabel, kita menggunakan Vercel Functions sebagai jembatan (`bridge`) ke Firebase Admin SDK.
-   **Tip**: Jika pengiriman notifikasi gagal, cek tab **Logs** di Vercel Dashboard. Biasanya error muncul di sana jika Environment Variables (`FIREBASE_SERVICE_ACCOUNT`) tidak terbaca dengan benar.
-   **Trick**: Gunakan `fetch` dengan *timeout* pendek agar UI tidak menggantung jika server FCM lambat merespon.

### ⚡ Kecepatan (Lighthouse Optimization)
-   **LCP (Largest Contentful Paint)**: Jangan gunakan gambar mentah yang besar. Kompres gambar sebelum upload.
-   **Preload**: Tambahkan `<link rel="preload">` di `index.html` hanya untuk aset yang benar-benar kritikal di awal (seperti font atau logo utama).

---

## 💡 3. "Golden Rules" Saat Memperbaiki Code

1.  **Incremental Fix**: Jangan perbaiki 5 hal sekaligus. Perbaiki 1, tes, lalu lanjut ke berikutnya. Ini memudahkan *rollback* jika ada yang rusak.
2.  **Double Check Hooks**: Di React, seringkali error terjadi karena *dependency array* di `useEffect` atau `useMemo` kosong atau kurang lengkap.
3.  **Handle Silently**: Selalu gunakan `try...catch` pada fungsi async (seperti API call) agar aplikasi tidak *crash* total (White Screen of Death).

---

## 🤖 Menghubungi Saya untuk Error Baru?
Jika kamu menemukan error, berikan saya:
1.  **Pesan Error Lengkap** (dari terminal atau console browser).
2.  **Konteks**: "Saya baru saja mengubah file X, lalu muncul error Y".
3.  **Screenshot/Video**: Jika masalahnya adalah visual (layout berantakan).

---
*Happy Coding!* 🛠️
