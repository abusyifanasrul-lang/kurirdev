// public/sw.js
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'KurirDev';
  const options = {
    body: data.body || 'Ada orderan baru! Segera ambil sebelum diambil kurir lain.',
    icon: '/icons/icon-192.png', // Ensure this exists or use a default
    badge: '/icons/icon-96.png', // Monochrome badge if available
    vibrate: [500, 110, 500, 110, 450, 110, 200, 110, 170, 40, 450],
    data: {
      url: data.url || '/',
      orderId: data.orderId
    },
    actions: [
      {
        action: 'view-detail',
        title: 'LIHAT DETAIL'
      }
    ]
  };

  // Notify clients for foreground audio/effects
  self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
    clients.forEach(client => {
      client.postMessage({
        type: 'PUSH_NOTIFICATION',
        payload: data
      });
    });
  });

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const urlToOpen = event.notification.data.url;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a window is already open, focus it and navigate
      for (constclient of clientList) {
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open a new window
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
