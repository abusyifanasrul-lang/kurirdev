import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import { getAuth, Auth } from 'firebase/auth'

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
export const auth = getAuth(app)

// Lazy-load secondary auth only when needed (e.g. for seeder or create courier)
// This prevents initializing a second Auth iframe on app boot, saving ~300ms TBT.
let secondaryAuthInstance: Auth | null = null;
export const getSecondaryAuth = () => {
  if (!secondaryAuthInstance) {
    const secondaryApp = initializeApp(firebaseConfig, 'SecondaryApp')
    secondaryAuthInstance = getAuth(secondaryApp)
  }
  return secondaryAuthInstance
}

// NOTE: firebase/messaging is lazy-loaded in fcm.ts (only for courier role)
// to avoid pulling ~30KB into the main bundle for all users.
export default app
