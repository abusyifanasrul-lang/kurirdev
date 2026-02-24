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
  const { title, body } = payload.notification
  self.registration.showNotification(title, {
    body,
    icon: '/icons/android/android-launchericon-192-192.png',
    badge: '/icons/android/android-launchericon-96-96.png',
  })
})
