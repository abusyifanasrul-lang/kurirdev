import { initializeApp, SDK_VERSION } from 'firebase/app'

console.log('🔑 API Key:', import.meta.env.VITE_FIREBASE_API_KEY?.substring(0, 10) ?? 'UNDEFINED')
console.log('🔥 Firebase SDK version:', SDK_VERSION)

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

const app = initializeApp(firebaseConfig)

// NOTE: firebase/messaging is lazy-loaded in fcm.ts (only for courier role)
// to avoid pulling ~30KB into the main bundle for all users.
export default app
