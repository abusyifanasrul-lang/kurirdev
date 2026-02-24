import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import { getMessaging, type Messaging } from 'firebase/messaging'

console.log('🔑 API Key:', import.meta.env.VITE_FIREBASE_API_KEY?.substring(0, 10) ?? 'UNDEFINED')

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

// Safe init: getMessaging() throws in unsupported browsers (non-HTTPS, older browsers)
let _messaging: Messaging | null = null
try {
  _messaging = getMessaging(app)
} catch (e) {
  console.warn('⚠️ Firebase Messaging not supported in this browser:', e)
}
export const messaging = _messaging
export default app
