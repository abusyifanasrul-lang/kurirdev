import { getToken, onMessage } from 'firebase/messaging'
import { messaging } from './firebase'
import { db } from './firebase'
import { doc, updateDoc } from 'firebase/firestore'

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY

export const requestFCMPermission = async (userId: string): Promise<string | null> => {
  try {
    if (!messaging) {
      console.warn('⚠️ Firebase Messaging not available')
      return null
    }

    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
      console.log('⚠️ Notification permission denied')
      return null
    }

    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js')
    await navigator.serviceWorker.ready

    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration
    })

    if (token) {
      await updateDoc(doc(db, 'users', userId), {
        fcm_token: token,
        fcm_token_updated_at: new Date().toISOString()
      })
      console.log('✅ FCM token saved:', token.substring(0, 20) + '...')
      return token
    }
    return null
  } catch (error) {
    console.error('❌ FCM token error:', error)
    return null
  }
}

export const refreshFCMToken = async (userId: string): Promise<void> => {
  try {
    if (!messaging) return

    const registration = await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js')
    if (!registration) return

    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration
    })

    if (token) {
      await updateDoc(doc(db, 'users', userId), {
        fcm_token: token,
        fcm_token_updated_at: new Date().toISOString()
      })
      console.log('🔄 FCM token refreshed')
    }
  } catch (error) {
    console.error('Token refresh failed:', error)
  }
}

export const onForegroundMessage = (callback: (payload: any) => void) => {
  if (!messaging) return () => { }
  return onMessage(messaging, callback)
}

