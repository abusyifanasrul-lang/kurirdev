# KurirDev — DeliveryPro: Master Context Document
**Versi:** 8.0 (Updated: Firebase Integration + FCM Detail)
**Tanggal:** 24 Februari 2026
**Tujuan:** Onboarding AI baru ke proyek secara menyeluruh

---

## 1. GAMBARAN BISNIS

### Apa yang Dibangun
Sistem manajemen pengiriman (Delivery Management System) untuk bisnis delivery skala kecil-menengah:

```
Pelanggan memesan via WhatsApp (di luar sistem)
         ↓
Admin memasukkan pesanan ke sistem
         ↓
Admin menugaskan kurir secara manual (atau via antrian FIFO)
         ↓
Kurir menerima notifikasi & memproses pengiriman via PWA
         ↓
Admin memantau semua aktivitas di dashboard real-time
```

### Model Bisnis Payment (COD + Setoran)
```
Order Delivered
      ↓
Uang COD di tangan kurir (100%)
      ↓
Kurir setor platform fee (default 20%) ke admin
Cash atau transfer — dilakukan akhir hari
      ↓
Admin konfirmasi via:
  A) Tombol "Konfirmasi Setor" per order di tabel Orders
  B) Tombol "Konfirmasi Setor Semua" di Courier Detail (Bulk)
```

### Skala Target
- Awal: 300 order/hari, Target: 1000+ order/hari
- Pengguna: 20 kurir aktif + 2 admin

---

## 2. STATUS PENGEMBANGAN

### Fase: Firebase Integration (Sedang Berjalan)

#### Admin Side — ✅ Semua Selesai
| Halaman | Status |
|---------|--------|
| Login | ✅ |
| Dashboard | ✅ Analytics dari Firestore |
| Orders | ✅ CRUD, assign FIFO, konfirmasi setor |
| Couriers | ✅ Bulk settlement, suspend account |
| Reports | ✅ Export PDF jsPDF native |
| Notifications | ✅ In-app, kirim ke kurir via Firestore |
| Settings | ✅ Add/suspend user |

#### Courier PWA — ✅ Semua Selesai
| Halaman | Status |
|---------|--------|
| Login | ✅ + FCM permission request |
| Home Dashboard | ✅ Toggle online/offline, warning card setor |
| Orders | ✅ Active orders, dikunci jika suspended |
| Order Detail | ✅ Status flow + badge Sudah/Belum Setor |
| History | ✅ Badge setoran |
| Notifications | ✅ Real-time dari Firestore |
| Earnings | ✅ Derived dari orders |
| Profile | ✅ Read-only, Ganti Password |

---

## 3. ARSITEKTUR DATA (Firebase Ready)

### Prinsip
- Semua ID bertipe STRING — kompatibel Firestore document ID
- Earnings derived state — tidak disimpan, dihitung dari orders
- Tidak ada `courier_name` di Order — gunakan `getCourierName(courier_id)`

### TypeScript Interface

```typescript
interface User {
  id: string
  name: string
  email: string
  password?: string
  role: 'admin' | 'courier'
  phone?: string
  is_active: boolean
  is_online?: boolean
  commission_rate?: number      // default 80
  vehicle_type?: 'motorcycle' | 'car' | 'bicycle' | 'van'
  plate_number?: string
  fcm_token?: string            // FCM push notification token
  created_at: string
  updated_at: string
  created_by?: string
}

interface Order {
  id: string
  order_number: string          // format: PDDMMYYNNN
  customer_name: string
  customer_phone: string
  customer_address: string
  courier_id?: string
  created_by?: string
  status: OrderStatus
  total_fee: number
  payment_status: 'unpaid' | 'paid'
  notes?: string
  estimated_delivery_time?: string
  actual_pickup_time?: string
  actual_delivery_time?: string
  assigned_at?: string
  cancelled_at?: string
  cancellation_reason?: string
  created_at: string
  updated_at: string
}

type OrderStatus =
  'pending' | 'assigned' | 'picked_up' |
  'in_transit' | 'delivered' | 'cancelled'

interface Notification {
  id: string
  user_id: string
  user_name?: string
  title: string
  body: string
  data?: Record<string, unknown>
  is_read: boolean
  sent_at: string
}
```

---

## 4. FIREBASE CONFIGURATION

### File Structure
```
src/lib/
  firebase.ts          → inisialisasi Firebase app, db, messaging
  fcm.ts               → requestFCMPermission, onForegroundMessage
  firebaseSeeder.ts    → seed INITIAL_USERS ke Firestore (sekali)
  firebaseOrderSeeder.ts → seed mock orders (sekali)

public/
  firebase-messaging-sw.js → Service Worker untuk background notification
  sw.js                    → Workbox PWA service worker

api/
  send-notification.js → Vercel Serverless API untuk kirim FCM via Admin SDK
```

### src/lib/firebase.ts
```typescript
import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import { getMessaging } from 'firebase/messaging'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)
export const messaging = getMessaging(app)
export default app
```

### Environment Variables

#### File .env (lokal, JANGAN push ke GitHub)
```
VITE_FIREBASE_API_KEY=AIzaSyAA08VR7Exg76V4T7Bcf2MtFVN6zaXwpCw
VITE_FIREBASE_AUTH_DOMAIN=kurirdev.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=kurirdev
VITE_FIREBASE_STORAGE_BUCKET=kurirdev.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=901413883627
VITE_FIREBASE_APP_ID=1:901413883627:web:59cba02ddbd1b19fd6f8ae
VITE_FIREBASE_VAPID_KEY=BLDDi7kgu9CA6HEOTQRzUIqzSY-GREhOqYikKVHb5F2ODubduJMgsZ8AibbKfd5ofjP6sNxooiuFnUOBaOtWfW8
```

#### Vercel Environment Variables (production)
```
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
VITE_FIREBASE_VAPID_KEY
FIREBASE_PROJECT_ID       → untuk Admin SDK (tanpa VITE_)
FIREBASE_CLIENT_EMAIL     → untuk Admin SDK
FIREBASE_PRIVATE_KEY      → untuk Admin SDK (private key dari Service Account)
```

### Firestore Collections
```
users/          → User interface (id = "1" s/d "5" + kurir baru)
orders/         → Order interface
notifications/  → Notification interface
tracking_logs/  → OrderStatusHistory interface
```

### Firestore Security Rules (Rancangan)
```
users:
  Admin: read/write semua
  Kurir: read own, write is_online only

orders:
  Admin: read/write semua
  Kurir: read where courier_id == userId, write status only

notifications:
  Admin: write semua
  Kurir: read where user_id == userId, write is_read only
```

---

## 5. FCM PUSH NOTIFICATION — DETAIL LENGKAP

### Mengapa FCM Kritis untuk Aplikasi Ini
Kurir lapangan menggunakan HP Android. Saat HP dikantong dan app di-minimize, OS Android mematikan koneksi WebSocket Firestore untuk hemat baterai. Akibatnya:
- In-app notification (Firestore realtime) TIDAK sampai ke kurir yang sedang tidak buka app
- Kurir tidak tahu ada order baru yang di-assign
- Order terbengkalai

FCM Push Notification menyelesaikan ini karena notifikasi dikirim via server Google langsung ke OS Android — melewati app dan browser, kurir tetap mendapat notifikasi meskipun HP sedang terkunci.

### Arsitektur FCM — 3 Komponen

```
[1. CLIENT — PWA Kurir]
Saat login → minta izin notifikasi browser
           → generate FCM Token menggunakan VAPID key
           → simpan FCM Token ke Firestore users/{userId}.fcm_token

[2. FIRESTORE]
Menyimpan FCM Token terikat dengan ID kurir
Admin kirim notifikasi → data notifikasi masuk ke Firestore notifications/
Vercel API dipanggil dengan FCM Token kurir sebagai target

[3. BACKEND — Vercel Serverless API]
Menerima request dari frontend: { token, title, body, data }
Menggunakan Firebase Admin SDK + Service Account (OAuth2 otomatis)
Memanggil FCM HTTP V1 API: admin.messaging().send(message)
FCM server Google mengirim push ke HP kurir
```

### Kenapa Client Tidak Bisa Langsung Kirim FCM
FCM HTTP V1 API membutuhkan OAuth 2.0 token dari Service Account — credential ini hanya boleh ada di server (backend), tidak boleh ada di frontend/browser karena akan terekspos publik. Inilah mengapa error 401 terjadi saat client mencoba register token langsung:

```
POST fcmregistrations.googleapis.com 401 Unauthorized
"Expected OAuth 2 access token"
```

Client hanya bertugas **mendapatkan** FCM token (menggunakan VAPID key). **Mengirim** notifikasi adalah tugas backend.

### Alur Lengkap End-to-End

```
FASE 1 — Registrasi Token (terjadi saat kurir login):
Kurir login di PWA
  → requestFCMPermission(userId) dipanggil di Login.tsx
  → Notification.requestPermission() → user klik "Allow"
  → navigator.serviceWorker.register('/firebase-messaging-sw.js')
  → getToken(messaging, { vapidKey, serviceWorkerRegistration })
  → FCM server Google verifikasi VAPID key → kembalikan token string
  → updateDoc(db, 'users', userId, { fcm_token: token })
  → Token tersimpan di Firestore

FASE 2 — Pengiriman Notifikasi (terjadi saat Admin assign order):
Admin assign order ke Budi
  → Frontend fetch POST /api/send-notification
     body: { token: budi.fcm_token, title: "Order Baru", body: "...", data: { orderId } }
  → Vercel API (api/send-notification.js) menerima request
  → Firebase Admin SDK init dengan Service Account credentials
  → admin.messaging().send({ notification, data, token })
  → FCM server Google terima request (OAuth2 valid via Admin SDK)
  → FCM kirim push ke HP Budi via Android/iOS push service

FASE 3 — Penerimaan Notifikasi di HP Kurir:
App aktif (foreground):
  → onMessage() di fcm.ts menangkap payload
  → Tampilkan in-app notification

App di background/minimize/HP terkunci:
  → firebase-messaging-sw.js (Service Worker) menangkap payload
  → onBackgroundMessage() → self.registration.showNotification()
  → Notifikasi muncul di notification tray HP
  → Kurir klik notifikasi → app terbuka ke halaman order
```

### File-file FCM dan Fungsinya

#### src/lib/fcm.ts — Client-side FCM utilities
```typescript
import { getToken, onMessage } from 'firebase/messaging'
import { messaging } from './firebase'
import { db } from './firebase'
import { doc, updateDoc } from 'firebase/firestore'

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY

// Dipanggil saat kurir login — minta izin + dapatkan token
export const requestFCMPermission = async (userId: string): Promise<string | null> => {
  try {
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
      console.log('⚠️ Notification permission denied')
      return null
    }

    // Register Service Worker secara eksplisit
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js')
    await navigator.serviceWorker.ready

    // Dapatkan FCM token dengan VAPID key + Service Worker
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration
    })

    if (token) {
      // Simpan token ke Firestore
      await updateDoc(doc(db, 'users', userId), { fcm_token: token })
      console.log('✅ FCM token saved:', token)
      return token
    }
    return null
  } catch (error) {
    console.error('❌ FCM token error:', error)
    return null
  }
}

// Dipanggil untuk handle notifikasi saat app aktif (foreground)
export const onForegroundMessage = (callback: (payload: any) => void) => {
  return onMessage(messaging, callback)
}
```

#### public/firebase-messaging-sw.js — Background notification handler
```javascript
// WAJIB menggunakan compat version (bukan modular) di Service Worker
importScripts('https://www.gstatic.com/firebasejs/12.9.0/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/12.9.0/firebase-messaging-compat.js')

// Config Firebase di-hardcode di sini karena Service Worker
// tidak bisa akses import.meta.env (Vite env variables)
firebase.initializeApp({
  apiKey: "AIzaSyAA08VR7Exg76V4T7Bcf2MtFVN6zaXwpCw",
  authDomain: "kurirdev.firebaseapp.com",
  projectId: "kurirdev",
  storageBucket: "kurirdev.firebasestorage.app",
  messagingSenderId: "901413883627",
  appId: "1:901413883627:web:59cba02ddbd1b19fd6f8ae"
})

const messaging = firebase.messaging()

// Handle notifikasi saat app di background/minimize/HP terkunci
messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification
  self.registration.showNotification(title, {
    body,
    icon: '/icons/android/android-launchericon-192-192.png',
    badge: '/icons/android/android-launchericon-96-96.png',
  })
})
```

#### api/send-notification.js — Vercel Serverless API (pengirim notifikasi)
```javascript
import admin from 'firebase-admin'

// Inisialisasi Admin SDK dengan Service Account
// Service Account memberikan OAuth2 token otomatis ke FCM HTTP V1 API
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      // \n harus di-replace karena Vercel menyimpan env sebagai satu baris
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  })
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { token, title, body, data } = req.body

  if (!token) return res.status(400).json({ error: 'FCM token required' })

  const message = {
    notification: { title, body },
    data: data || {},
    token,  // FCM token kurir yang disimpan di Firestore
  }

  try {
    const response = await admin.messaging().send(message)
    res.status(200).json({ success: true, messageId: response })
  } catch (error) {
    console.error('Error sending FCM:', error)
    res.status(500).json({ error: error.message })
  }
}
```

### Status FCM Saat Ini
```
✅ firebase-messaging-sw.js — ada di public/
✅ fcm.ts — requestFCMPermission dengan serviceWorkerRegistration
✅ Login.tsx — requestFCMPermission dipanggil saat kurir login
✅ api/send-notification.js — Vercel API dengan Admin SDK
✅ Service Account — sudah di-generate, credentials di Vercel env
✅ VAPID key — ada di .env dan Vercel env
✅ firebase-admin v13.6.1 — terinstall
✅ vercel.json — header untuk firebase-messaging-sw.js

❌ FCM token belum berhasil didapat di production
   Error: POST fcmregistrations.googleapis.com 401 Unauthorized
   "Expected OAuth 2 access token"
   
   Status investigasi:
   - FCM Registration API: Enabled di Google Cloud Console ✅
   - Firebase Cloud Messaging API V1: Enabled ✅
   - Legacy API: Tidak bisa diaktifkan (Google tidak izinkan di project baru)
   - VAPID key: Sudah benar ✅
   - serviceWorkerRegistration: Sudah ditambahkan ✅
   - Browser Incognito: Sudah ditest di browser normal ✅
   
   Root cause yang dicurigai:
   getToken() di client masih gagal dengan 401 meskipun semua
   konfigurasi sudah benar. Kemungkinan ada OAuth scope atau
   project permission yang belum diaktifkan di Google Cloud Console.
   
   Yang perlu dicoba:
   1. Cek Google Cloud Console → APIs & Services → Credentials
      apakah ada OAuth 2.0 Client ID yang perlu dikonfigurasi
   2. Cek apakah FCM Registration API memerlukan billing account
   3. Coba aktifkan "Identity Toolkit API" di Google Cloud Console
```

### Yang BELUM Diimplementasi (Next Steps FCM)
```
1. Panggil /api/send-notification dari frontend saat Admin assign order
   → Di Orders.tsx, setelah assignCourier berhasil:
   fetch('/api/send-notification', {
     method: 'POST',
     body: JSON.stringify({
       token: courier.fcm_token,
       title: 'Order Baru Assigned',
       body: `Order ${order.order_number} telah di-assign ke kamu`,
       data: { orderId: order.id }
     })
   })

2. Handle klik notifikasi → navigate ke Order Detail
   → Di firebase-messaging-sw.js:
   self.addEventListener('notificationclick', (event) => {
     event.notification.close()
     event.waitUntil(clients.openWindow('/courier/orders/' + event.notification.data.orderId))
   })

3. Refresh FCM token jika expired
   → Token FCM bisa expired, perlu refresh periodik
```

---

## 6. ARSITEKTUR AUTENTIKASI

### Hybrid Storage
```typescript
// useUserStore → localStorage (database, lintas tab)
{ name: 'user-database', storage: createJSONStorage(() => localStorage) }

// useSessionStore → sessionStorage (sesi, per tab)
// Field bernama 'user' — BUKAN 'currentUser'
{ name: 'user-session', storage: createJSONStorage(() => sessionStorage) }
```

### Demo Accounts
```
Admin:  admin@delivery.com  / admin123   (id: "1", Super Admin)
Admin:  ops@delivery.com    / admin123   (id: "2")
Kurir:  budi@courier.com    / courier123 (id: "3")
Kurir:  siti@courier.com    / courier123 (id: "4")
Kurir:  agus@courier.com    / courier123 (id: "5")
```

---

## 7. FITUR SUSPEND ACCOUNT

```typescript
// Cek suspended WAJIB dari useUserStore (real-time), bukan sessionStore
const { users } = useUserStore()
const liveUser = users.find(u => u.id === currentUser?.id)
const isSuspended = liveUser?.is_active === false

// Yang diblokir saat suspended:
// - Toggle online/offline (disabled)
// - Tombol aksi order (disembunyikan)
// - Change Password (disabled)
// History & Earnings tetap bisa diakses
```

---

## 8. PWA CONFIGURATION

```
Service Worker: injectManifest strategy
CACHE_NAME: 'kurirdev-v1.0.4'
Icons: 192px + 512px (purpose dipisah: "any" dan "maskable")
vercel.json: headers untuk sw.js dan firebase-messaging-sw.js
```

---

## 9. STACK TEKNIS

```
Frontend:   React + TypeScript + Vite 7
Styling:    Tailwind CSS 4
Routing:    React Router v7
State:      Zustand + persist (hybrid localStorage + sessionStorage)
Charts:     Recharts + jsPDF native
PWA:        VitePWA injectManifest + custom sw.js
Database:   Firebase Firestore
Push Notif: Firebase Cloud Messaging (FCM) — in progress
Backend:    Vercel Serverless API (api/send-notification.js)
Deploy:     Vercel (kurirdev.vercel.app)
Repo:       GitHub (auto-deploy on push)
```

---

## 10. LESSONS LEARNED

### ❌ Jangan Lakukan
| Keputusan | Akibat |
|-----------|--------|
| Semua storage localStorage | Tab Kurir redirect ke Admin |
| Semua storage sessionStorage | Kurir baru tidak bisa login lintas tab |
| Client kirim FCM langsung tanpa backend | 401 Unauthorized — FCM V1 butuh OAuth2 |
| Gunakan html2canvas untuk PDF | Blank page, SVG tidak ter-capture |
| ID INITIAL_COURIERS tidak sinkron | Toggle update kurir yang salah |
| Test FCM di Incognito | Notifikasi diblokir browser |
| Push .env ke GitHub | Credentials terekspos publik |
| Hardcode nilai di mock data | Melanggar single source of truth |

### ✅ Pola yang Terbukti Benar
| Keputusan | Alasan |
|-----------|--------|
| Vercel API Route untuk kirim FCM | Server-side auth via Service Account |
| serviceWorkerRegistration eksplisit di getToken | FCM tahu SW mana yang digunakan |
| firebase-messaging-sw.js terpisah dari sw.js | FCM butuh file dengan nama spesifik ini |
| Config hardcode di SW (bukan env vars) | SW tidak bisa akses import.meta.env |
| FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') | Vercel simpan env sebagai satu baris |
| Soft delete via is_active | Data historis terjaga |
| Perbaiki per file, verifikasi browser | Mencegah regression |

---

## 11. UNTUK AI YANG MELANJUTKAN

### Aturan Kerja
1. Baca file aktual sebelum mengubah apapun
2. Sebutkan: acuan context **v8**
3. Tunjukkan kode aktual sebelum klaim selesai
4. Konfirmasi jumlah file yang diubah
5. Satu perubahan per instruksi
6. Verifikasi di browser setelah perubahan signifikan

### Peringatan AI Coder
AI coder dalam **aggressive mode** — langsung eksekusi tanpa konfirmasi. Instruksi harus menyebutkan file yang boleh diubah secara eksplisit.

### Prioritas Berikutnya
```
1. Selesaikan FCM token registration (error 401)
   → Investigasi: Google Cloud Console → APIs & Services → Credentials
   → Kemungkinan perlu Identity Toolkit API atau billing

2. Integrasikan /api/send-notification ke Orders.tsx
   → Panggil saat Admin assign order
   → Panggil saat Admin kirim manual notification

3. Handle notificationclick di firebase-messaging-sw.js
   → Navigate ke order yang relevan saat notif diklik

4. Firestore Security Rules implementasi
   → Saat ini masih test mode (semua bisa read/write)
   → Harus diperketat sebelum go-live
```

### Filosofi
> "Tanya kode aktual sebelum perintah apapun."
> "Verifikasi visual di browser — bukan hanya klaim AI coder."
> "TypeScript 0 errors bukan jaminan aplikasi berjalan benar."
> "Client hanya mendapat FCM token. Backend yang mengirim notifikasi."

---

*KurirDev / DeliveryPro — Master Context v8.0 — 24 Februari 2026*
