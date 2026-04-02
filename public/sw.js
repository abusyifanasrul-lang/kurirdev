// Removed Firebase SDK as we are using native push listener in SW for performance

// Manual push handler — catches ALL push events including those Firebase SDK might miss
self.addEventListener('push', (event) => {
  console.log('[sw.js] Push event received:', event)
  if (!event.data) return

  try {
    const payload = event.data.json()
    console.log('[sw.js] Push payload:', payload)

    /**
     * FCM v1 Payload Handling
     * My Edge Function sends a message structure that looks like:
     * {
     *   "notification": { "title": "...", "body": "..." },
     *   "data": { ... }
     * }
     */
    const notification = payload.notification || (payload.message && payload.message.notification)
    const data = payload.data || (payload.message && payload.message.data) || {}

    // Extract title and body with deep fallback checking
    const title = notification?.title || data.title || payload.title || 'KurirDev'
    const body = notification?.body || data.body || payload.body || 'Anda memiliki pesan baru'

    console.log(`[sw.js] Attempting to show: "${title}" - "${body}"`)

    // Only show if we have a title/body to display
    if (title || body) {
      const options = {
        body,
        icon: '/icons/android/android-launchericon-192-192.png',
        badge: '/icons/android/android-launchericon-96-96.png',
        vibrate: [200, 100, 200],
        data: data,
        tag: data.orderId || 'kurirdev-notification',
        requireInteraction: true,
        actions: [
          { action: 'open', title: 'Buka Aplikasi' }
        ]
      }

      event.waitUntil(
        self.registration.showNotification(title, options)
          .then(() => console.log('[sw.js] Notification shown successfully'))
          .catch(err => console.error('[sw.js] showNotification failed:', err))
      )
    }
  } catch (e) {
    console.error('[sw.js] Push parse error:', e)
    // Fallback if JSON parse fails or data is missing
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
  const CACHE_VERSION = 'v1.0.7'; 
  const CACHE_NAME = `kurirdev-${CACHE_VERSION}`;

  event.waitUntil(
    Promise.all([
      clients.claim(),
      caches.keys().then(keys => 
        Promise.all(
          keys.filter(key => 
            (key.startsWith('kurirdev-') && key !== CACHE_NAME) ||
            key === 'static-resources' // Clean up the old problematic cache
          ).map(key => caches.delete(key))
        )
      )
    ])
  );
});


import { precacheAndRoute, createHandlerBoundToURL } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

// Precache injected assets
precacheAndRoute(self.__WB_MANIFEST);

// SPA Fallback: Ensure navigating to /courier or /admin serves index.html
try {
  const handler = createHandlerBoundToURL('/index.html');
  const navigationRoute = new NavigationRoute(handler, {
    denylist: [
      new RegExp('/api/'), // Exclude APIs
      new RegExp('/_/') // Exclude internal paths
    ],
  });
  registerRoute(navigationRoute);
} catch (e) {
  console.log('[sw.js] NavigationRoute error:', e);
}

// 1. Google Fonts Cache (CacheFirst)
registerRoute(
  ({url}) => url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com',
  new CacheFirst({
    cacheName: 'google-fonts',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 20,
        maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
      }),
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
    ],
  })
);

// 2. Images Cache (CacheFirst)
registerRoute(
  ({request}) => request.destination === 'image',
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

// 3. Audio / Media Cache (CacheFirst)
registerRoute(
  ({request}) => request.destination === 'audio' || request.destination === 'video',
  new CacheFirst({
    cacheName: 'media-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 10,
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 Days
      }),
    ],
  })
);

// Static Assets - Handled by precacheAndRoute(self.__WB_MANIFEST)
// No need for redundant StaleWhileRevalidate for JS/CSS as it can lead to 
// caching 404/HTML responses when chunks change between deployments.


// 5. API / External Services (NetworkFirst)
registerRoute(
  ({request, url}) => {
    // Bypass navigation requests and static assets
    if (['document', 'script', 'style', 'image', 'font'].includes(request.destination)) {
      return false;
    }
    // Match only specific external API requests
    return url.origin.includes('supabase.co');
  },
  new NetworkFirst({
    cacheName: 'api-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 60 * 60 * 24, // 1 Day
      }),
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
    ],
    networkTimeoutSeconds: 5,
  })
);

// Activate and cleanup handled above


// For update banner to know when to skipWaiting
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
