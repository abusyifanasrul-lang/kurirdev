import { getToken, onMessage, getMessaging, type Messaging } from 'firebase/messaging'
import { deleteInstallations, getInstallations } from 'firebase/installations'
import app from './firebase'
import { Capacitor } from '@capacitor/core'
import { PushNotifications } from '@capacitor/push-notifications'
import { supabase } from './supabaseClient'

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY

// Lazy messaging init — this file is only loaded for courier role (dynamic import in App.tsx)
let _messaging: Messaging | null = null
try {
  _messaging = getMessaging(app)
} catch (e) {
  console.warn('⚠️ Firebase Messaging not supported in this browser:', e)
}
const messaging = _messaging

/**
 * Clear all stale Firebase data from IndexedDB.
 */
async function clearStaleFirebaseData(): Promise<void> {
  if (Capacitor.isNativePlatform()) return // Native handled by FCM SDK directly

  try {
    if ('databases' in indexedDB) {
      const allDbs = await (indexedDB as any).databases()
      for (const dbInfo of allDbs) {
        if (dbInfo.name && (
          dbInfo.name.startsWith('firebase-') ||
          dbInfo.name.includes('fcm') ||
          dbInfo.name.includes('FirebaseInstallations')
        )) {
          indexedDB.deleteDatabase(dbInfo.name)
        }
      }
    }

    const installations = getInstallations(app)
    await deleteInstallations(installations)
    console.log('✅ Stale Web Firebase data cleared')
  } catch (error) {
    console.warn('⚠️ Could not clear stale data:', error)
  }
}

/**
 * Native Registration for Capacitor
 */
const registerNativePush = async (userId: string): Promise<string | null> => {
  try {
    let perm = await PushNotifications.checkPermissions()
    
    if (perm.receive !== 'granted') {
      perm = await PushNotifications.requestPermissions()
    }

    if (perm.receive !== 'granted') {
      throw new Error('User denied push permissions')
    }

    // Add listeners for native notifications
    await PushNotifications.addListener('registration', async ({ value: token }) => {
      console.log('🚀 Native FCM token received:', token.substring(0, 20) + '...')
      await supabase.from('profiles').update({
        fcm_token: token,
        fcm_token_updated_at: new Date().toISOString(),
        platform: 'android'
      }).eq('id', userId)
    })

    await PushNotifications.addListener('registrationError', (err) => {
      console.error('❌ Native registration error:', err)
    })

    // Listen for notifications while app is open
    await PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('🔔 Notification received while app open:', notification.title)
    })

    await PushNotifications.register()
    return 'pending_native_callback'
  } catch (e) {
    console.error('❌ Failed native registration:', e)
    return null
  }
}

/**
 * Web Registration for PWA
 */
const registerWebPush = async (userId: string): Promise<string | null> => {
  if (!messaging) return null
  
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return null

  let registration = await navigator.serviceWorker.getRegistration('/')
  if (!registration) {
    registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
    await navigator.serviceWorker.ready
  } else {
    await registration.update().catch(() => {})
  }

  const token = await getToken(messaging, {
    vapidKey: VAPID_KEY,
    serviceWorkerRegistration: registration
  })

  if (token) {
    await supabase.from('profiles').update({
      fcm_token: token,
      fcm_token_updated_at: new Date().toISOString(),
      platform: 'web'
    }).eq('id', userId)
    return token
  }
  return null
}

export const requestFCMPermission = async (userId: string): Promise<string | null> => {
  if (Capacitor.isNativePlatform()) {
    console.log('📱 Using Native Push (Capacitor)')
    return registerNativePush(userId)
  } else {
    console.log('🌐 Using Web Push (PWA)')
    await clearStaleFirebaseData()
    return registerWebPush(userId)
  }
}

export const refreshFCMToken = async (userId: string): Promise<void> => {
  try {
    if (Capacitor.isNativePlatform()) {
      await PushNotifications.register() // Re-triggers current registration listener
    } else {
      if (!messaging) return
      const registration = await navigator.serviceWorker.getRegistration('/sw.js')
      if (!registration) return
      const token = await getToken(messaging, {
        vapidKey: VAPID_KEY,
        serviceWorkerRegistration: registration
      })
      if (token) {
        await supabase.from('profiles').update({
          fcm_token: token,
          fcm_token_updated_at: new Date().toISOString()
        }).eq('id', userId)
      }
    }
  } catch (error) {
    console.error('Token refresh failed:', error)
  }
}

export const onForegroundMessage = (callback: (payload: any) => void) => {
  if (Capacitor.isNativePlatform()) {
    // Native foreground listener
    return PushNotifications.addListener('pushNotificationReceived', (notification) => {
      callback({
        notification: {
          title: notification.title,
          body: notification.body,
        },
        data: notification.data
      })
    })
  } else {
    // Web foreground listener
    if (!messaging) return () => { }
    return onMessage(messaging, callback)
  }
}
