import { getToken, onMessage } from 'firebase/messaging'
import { messaging } from './firebase'
import { db } from './firebase'
import { doc, updateDoc } from 'firebase/firestore'

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY

export const requestFCMPermission = async (userId: string): Promise<string | null> => {
  try {
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
      console.log('⚠️ Notification permission denied')
      return null
    }

    const token = await getToken(messaging, { vapidKey: VAPID_KEY })
    if (token) {
      // Simpan token ke Firestore
      await updateDoc(doc(db, 'users', userId), { fcm_token: token })
      console.log('✅ FCM token saved:', token)
      return token
    }
    return null
  } catch (error) {
    console.error('❌ FCM token error:', error)
    return null
  }
}

export const onForegroundMessage = (callback: (payload: any) => void) => {
  return onMessage(messaging, callback)
}
