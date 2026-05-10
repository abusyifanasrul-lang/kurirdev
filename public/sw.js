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
  const CACHE_VERSION = 'v1.0.9'; // INCREMENTED: Test auto-update with welcome message
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


// Load Workbox from CDN using importScripts (Service Worker compatible)
importScripts('https://storage.googleapis.com/workbox-cdn/releases/7.0.0/workbox-sw.js');

// Initialize Workbox
if (workbox) {
  console.log('[sw.js] Workbox loaded successfully');

  // Configure Workbox
  workbox.setConfig({ debug: false });

  // 1. Google Fonts Cache (CacheFirst)
  workbox.routing.registerRoute(
    ({url}) => url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com',
    new workbox.strategies.CacheFirst({
      cacheName: 'google-fonts',
      plugins: [
        new workbox.expiration.ExpirationPlugin({
          maxEntries: 20,
          maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
        }),
        new workbox.cacheableResponse.CacheableResponsePlugin({
          statuses: [0, 200],
        }),
      ],
    })
  );

  // 2. Images Cache (CacheFirst)
  workbox.routing.registerRoute(
    ({request}) => request.destination === 'image',
    new workbox.strategies.CacheFirst({
      cacheName: 'images-cache',
      plugins: [
        new workbox.expiration.ExpirationPlugin({
          maxEntries: 60,
          maxAgeSeconds: 30 * 24 * 60 * 60, // 30 Days
        }),
      ],
    })
  );

  // 3. Audio / Media Cache (CacheFirst)
  workbox.routing.registerRoute(
    ({request}) => request.destination === 'audio' || request.destination === 'video',
    new workbox.strategies.CacheFirst({
      cacheName: 'media-cache',
      plugins: [
        new workbox.expiration.ExpirationPlugin({
          maxEntries: 10,
          maxAgeSeconds: 30 * 24 * 60 * 60, // 30 Days
        }),
      ],
    })
  );

  // 4. API / External Services (NetworkFirst)
  workbox.routing.registerRoute(
    ({request, url}) => {
      // Bypass navigation requests and static assets
      if (['document', 'script', 'style', 'image', 'font'].includes(request.destination)) {
        return false;
      }
      // Match only specific external API requests
      return url.origin.includes('supabase.co');
    },
    new workbox.strategies.NetworkFirst({
      cacheName: 'api-cache',
      plugins: [
        new workbox.expiration.ExpirationPlugin({
          maxEntries: 100,
          maxAgeSeconds: 60 * 60 * 24, // 1 Day
        }),
        new workbox.cacheableResponse.CacheableResponsePlugin({
          statuses: [0, 200],
        }),
      ],
      networkTimeoutSeconds: 5,
    })
  );
} else {
  console.error('[sw.js] Workbox failed to load');
}


// For update banner to know when to skipWaiting
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
