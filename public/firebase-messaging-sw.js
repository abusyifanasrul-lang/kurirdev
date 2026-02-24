importScripts('https://www.gstatic.com/firebasejs/12.9.0/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/12.9.0/firebase-messaging-compat.js')

firebase.initializeApp({
  apiKey: "AIzaSyAA08VR7Exg76V4T7Bcf2MtFVN6zaXwpCw",
  authDomain: "kurirdev.firebaseapp.com",
  projectId: "kurirdev",
  storageBucket: "kurirdev.firebasestorage.app",
  messagingSenderId: "901413883627",
  appId: "1:901413883627:web:59cba02ddbd1b19fd6f8ae"
})

const messaging = firebase.messaging()

messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification || {}
  const data = payload.data || {}

  self.registration.showNotification(title || 'KurirDev', {
    body: body || '',
    icon: '/icons/android/android-launchericon-192-192.png',
    badge: '/icons/android/android-launchericon-96-96.png',
    vibrate: [200, 100, 200],
    data: data, // Pass data for notificationclick handler
    tag: data.orderId || 'kurirdev-notification', // Prevent duplicate notifications
  })
})

// Handle notification click — open/focus the relevant page
self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const data = event.notification.data || {}
  const urlToOpen = data.orderId
    ? '/courier/orders/' + data.orderId
    : '/courier/orders'

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // If there's already a tab open, focus and navigate
        for (const client of clientList) {
          if (client.url.includes('kurirdev') && 'focus' in client) {
            return client.focus().then((focusedClient) => {
              if (focusedClient && 'navigate' in focusedClient) {
                return focusedClient.navigate(urlToOpen)
              }
            })
          }
        }
        // Otherwise open a new tab
        return clients.openWindow(urlToOpen)
      })
  )
})

