// KurirDev Modern Service Worker
// Optimized for performance and offline-first reliability

import { clientsClaim, skipWaiting } from 'workbox-core';
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { createHandlerBoundToURL } from 'workbox-precaching';

// 1. Initial Setup
skipWaiting();
clientsClaim();
cleanupOutdatedCaches();

// 2. Precache Assets (Injected by Vite)
precacheAndRoute(self.__WB_MANIFEST || []);

// 3. Navigation Routing (SPA Support)
const handler = createHandlerBoundToURL('/index.html');
const navigationRoute = new NavigationRoute(handler, {
  allowlist: [/^(?!\/__).*/],
});
registerRoute(navigationRoute);

// 4. Runtime Caching Strategies

// Cache Google Fonts (Styling)
registerRoute(
  /^https:\/\/fonts\.googleapis\.com\/.*/i,
  new CacheFirst({
    cacheName: 'google-fonts-stylesheets',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxAgeSeconds: 60 * 60 * 24 * 365 }), // 1 year
    ],
  })
);

// Cache Google Fonts (Files)
registerRoute(
  /^https:\/\/fonts\.gstatic\.com\/.*/i,
  new CacheFirst({
    cacheName: 'google-fonts-webfonts',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxAgeSeconds: 60 * 60 * 24 * 365,
        maxEntries: 30,
      }),
    ],
  })
);

// Cache Images
registerRoute(
  /\.(?:png|jpg|jpeg|svg|gif|webp)$/i,
  new CacheFirst({
    cacheName: 'images-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 60,
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 Days
      }),
    ],
  })
);

// Cache Static Assets (JS/CSS) - NetworkFirst to ensure updates but still work offline
registerRoute(
  /\.(?:js|css)$/i,
  new NetworkFirst({
    cacheName: 'static-resources',
    networkTimeoutSeconds: 3,
  })
);

// Cache API Requests - StaleWhileRevalidate for speed
registerRoute(
  /^https:\/\/(?:n8n\.kurirdev\.my\.id|.*\.supabase\.co|firestore\.googleapis\.com)\/.*/i,
  new StaleWhileRevalidate({
    cacheName: 'api-cache',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 60 * 60 }), // 1 hour
    ],
  })
);

// 5. Native Native Push Implementation (No Firebase SDK needed in background)
// This significantly reduces SW boot time and memory usage.

self.addEventListener('push', (event) => {
  console.log('[sw.js] Push received:', event);
  
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      console.warn('[sw.js] Push data is not JSON:', event.data.text());
      data = { notification: { title: 'KurirDev', body: event.data.text() } };
    }
  }

  const payload = data.notification || data.data || data || {};
  const title = payload.title || 'KurirDev Update';
  const options = {
    body: payload.body || 'Ada pembaruan status pesanan.',
    icon: '/icons/android/android-launchericon-192-192.png',
    badge: '/icons/android/android-launchericon-96-96.png',
    vibrate: [200, 100, 200],
    tag: payload.orderId || 'kurirdev-notification',
    data: payload,
    requireInteraction: true,
    actions: [
      { action: 'open', title: 'Buka Aplikasi' }
    ]
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  const payload = event.notification.data || {};
  const orderId = payload.orderId;
  const urlToOpen = orderId ? `/courier/orders/${orderId}` : '/courier';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes('kurirdev') && 'focus' in client) {
          return client.focus().then(c => c.navigate(urlToOpen));
        }
      }
      return clients.openWindow(urlToOpen);
    })
  );
});

// Broadcast Channel for UI Communication
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
