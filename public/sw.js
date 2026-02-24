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

messaging.onBackgroundMessage((payload) => {
  console.log('[sw.js] Background message received:', payload)
  const { title, body, icon, badge } = payload.notification || {}
  const data = payload.data || {}

  return self.registration.showNotification(title || data.title || 'KurirDev', {
    body: body || data.body || '',
    icon: icon || '/icons/android/android-launchericon-192-192.png',
    badge: badge || '/icons/android/android-launchericon-96-96.png',
    vibrate: [200, 100, 200],
    data: data,
    tag: data.orderId || 'kurirdev-notification',
    requireInteraction: true
  })
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

import { precacheAndRoute } from 'workbox-precaching';

// Required for VitePWA injectManifest
precacheAndRoute(self.__WB_MANIFEST);

const CACHE_VERSION = 'v1.0.4';
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
