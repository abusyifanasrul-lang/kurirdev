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
  console.log('[firebase-messaging-sw.js] Background message received:', payload)

  const { title, body, icon, badge } = payload.notification || {}
  const data = payload.data || {}

  const notificationTitle = title || data.title || 'KurirDev'
  const notificationOptions = {
    body: body || data.body || '',
    icon: icon || '/icons/android/android-launchericon-192-192.png',
    badge: badge || '/icons/android/android-launchericon-96-96.png',
    vibrate: [200, 100, 200],
    data: data,
    tag: data.orderId || 'kurirdev-notification',
    requireInteraction: true
  }

  return self.registration.showNotification(notificationTitle, notificationOptions)
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

