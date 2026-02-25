importScripts('https://www.gstatic.com/firebasejs/11.6.0/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/11.6.0/firebase-messaging-compat.js')

firebase.initializeApp({
  apiKey: "AIzaSyBqS5x5BWFFU19Gi4rGtEv7CcF9P_cLD-Q",
  authDomain: "kurirdev-prod.firebaseapp.com",
  projectId: "kurirdev-prod",
  storageBucket: "kurirdev-prod.firebasestorage.app",
  messagingSenderId: "945083209932",
  appId: "1:945083209932:web:aa57a8c7c2cbab174cca69"
})

const messaging = firebase.messaging()

// Handle background messages from Firebase SDK
messaging.onBackgroundMessage((payload) => {
  console.log('[sw.js] Background message received:', payload)

  // Extract title/body from notification OR data (data-only messages)
  const notif = payload.notification || {}
  const data = payload.data || {}
  const title = notif.title || data.title || 'KurirDev'
  const body = notif.body || data.body || ''

  return self.registration.showNotification(title, {
    body,
    icon: notif.icon || '/icons/android/android-launchericon-192-192.png',
    badge: notif.badge || '/icons/android/android-launchericon-96-96.png',
    vibrate: [200, 100, 200],
    data: data,
    tag: data.orderId || 'kurirdev-notification',
    requireInteraction: true
  })
})

// Manual push handler — catches ALL push events including those Firebase SDK might miss
self.addEventListener('push', (event) => {
  console.log('[sw.js] Push event received:', event)
  if (!event.data) return

  try {
    const payload = event.data.json()
    console.log('[sw.js] Push payload:', payload)

    // Check if this is a data-only message (no "notification" key at top level)
    // Firebase SDK's onBackgroundMessage should handle notification-bearing messages,
    // but for data-only payloads we must show it ourselves.
    const notif = payload.notification
    const data = payload.data || {}

    // If there IS a notification key, Firebase SDK will handle showing it — don't duplicate.
    // If there is NO notification key, we need to manually show it.
    if (!notif && (data.title || data.body)) {
      const title = data.title || 'KurirDev'
      const body = data.body || ''

      event.waitUntil(
        self.registration.showNotification(title, {
          body,
          icon: '/icons/android/android-launchericon-192-192.png',
          badge: '/icons/android/android-launchericon-96-96.png',
          vibrate: [200, 100, 200],
          data: data,
          tag: data.orderId || 'kurirdev-notification',
          requireInteraction: true
        })
      )
    }
  } catch (e) {
    console.error('[sw.js] Push parse error:', e)
    // Even if JSON parse fails, try to show something
    event.waitUntil(
      self.registration.showNotification('KurirDev', {
        body: 'Anda memiliki notifikasi baru',
        icon: '/icons/android/android-launchericon-192-192.png',
        badge: '/icons/android/android-launchericon-96-96.png',
        vibrate: [200, 100, 200],
        tag: 'kurirdev-fallback'
      })
    )
  }
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const data = event.notification.data || {}
  const urlToOpen = data.orderId ? '/courier/orders/' + data.orderId : '/courier/orders'

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes('kurirdev') && 'focus' in client) {
            return client.focus().then(c => c.navigate(urlToOpen))
          }
        }
        return clients.openWindow(urlToOpen)
      })
  )
})

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim())
})

// --- Workbox precaching (injected by VitePWA injectManifest) ---
import { precacheAndRoute } from 'workbox-precaching';
precacheAndRoute(self.__WB_MANIFEST);

const CACHE_VERSION = 'v1.0.5';
const CACHE_NAME = `kurirdev-${CACHE_VERSION}`;

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    )
  );
});

// For update banner to know when to skipWaiting
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
