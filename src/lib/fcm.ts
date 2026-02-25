import { getToken, onMessage } from 'firebase/messaging'
import { deleteInstallations, getInstallations } from 'firebase/installations'
import { messaging } from './firebase'
import app from './firebase'
import { db } from './firebase'
import { doc, updateDoc } from 'firebase/firestore'

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY

/**
 * Clear all stale Firebase data from IndexedDB.
 * This fixes 401 errors when switching Firebase apps (old cached FIS credentials).
 */
async function clearStaleFirebaseData(): Promise<void> {
  try {
    // 1. Delete all Firebase-related IndexedDB databases
    const dbNames = [
      'firebase-installations-database',
      'firebase-heartbeat-database',
      'firebase-messaging-database',
      // older SDK format
      'fcm_token_details_db',
    ]

    if ('databases' in indexedDB) {
      // Modern browsers: list all databases and delete Firebase-related ones
      const allDbs = await (indexedDB as any).databases()
      for (const dbInfo of allDbs) {
        if (dbInfo.name && (
          dbInfo.name.startsWith('firebase-') ||
          dbInfo.name.includes('fcm') ||
          dbInfo.name.includes('FirebaseInstallations')
        )) {
          console.log(`🗑️ Deleting IndexedDB: ${dbInfo.name}`)
          indexedDB.deleteDatabase(dbInfo.name)
        }
      }
    } else {
      // Fallback: try to delete known database names
      for (const name of dbNames) {
        console.log(`🗑️ Deleting IndexedDB: ${name}`)
          ; (indexedDB as IDBFactory).deleteDatabase(name)
      }
    }

    // 2. Unsubscribe any existing push subscription
    const registrations = await navigator.serviceWorker.getRegistrations()
    for (const reg of registrations) {
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await sub.unsubscribe()
        console.log('🗑️ Unsubscribed old push subscription')
      }
    }

    // 3. Delete Firebase Installation (forces new FID)
    try {
      const installations = getInstallations(app)
      await deleteInstallations(installations)
      console.log('🗑️ Deleted Firebase Installation (FID)')
    } catch (e) {
      // May fail if no installation exists — that's fine
      console.debug('FID delete skipped:', e)
    }

    console.log('✅ Stale Firebase data cleared')
  } catch (error) {
    console.warn('⚠️ Could not clear stale data (non-fatal):', error)
  }
}

/**
 * Key used to track if we've already cleaned stale data after an app change.
 * This prevents clearing data on every login — only needed once.
 */
const CLEANUP_KEY = 'fcm_cleanup_done_v4' // bumped: fix push notification popup not showing

export const requestFCMPermission = async (userId: string): Promise<string | null> => {
  try {
    if (!messaging) {
      console.warn('⚠️ Firebase Messaging not available')
      return null
    }

    // Skip FCM on localhost (requires HTTPS)
    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
      console.debug('⏭️ FCM skipped on localhost')
      return null
    }

    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
      console.log('⚠️ Notification permission denied')
      return null
    }

    // One-time cleanup of stale Firebase data (fixes 401 from cached old app credentials)
    if (!localStorage.getItem(CLEANUP_KEY)) {
      console.log('🧹 First run after update — clearing stale Firebase data...')
      await clearStaleFirebaseData()

      // Unregister old firebase SW to force fresh registration
      const existingRegs = await navigator.serviceWorker.getRegistrations()
      for (const reg of existingRegs) {
        if (reg.active?.scriptURL.includes('firebase-messaging-sw') ||
          reg.active?.scriptURL.includes('sw.js')) {
          await reg.unregister()
          console.log(`🗑️ Unregistered old SW: ${reg.active?.scriptURL}`)
        }
      }

      localStorage.setItem(CLEANUP_KEY, new Date().toISOString())

      // Small delay to let IndexedDB deletions complete
      await new Promise(resolve => setTimeout(resolve, 1000))
    }

    // Ensure we have a valid SW registration (re-register if cleanup removed it)
    let registration = await navigator.serviceWorker.getRegistration('/')
    if (!registration) {
      console.log('📦 Re-registering service worker...')
      registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
      // Wait for SW to be active
      await navigator.serviceWorker.ready
      console.log('✅ Service worker re-registered')
    } else {
      // Just check for updates without re-registering
      await registration.update().catch(() => {
        console.debug('SW update check skipped')
      })
    }

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
  } catch (error: any) {
    if (error?.code === 'messaging/token-subscribe-failed') {
      console.warn('⚠️ FCM token subscribe failed — attempting recovery...')

      // If it still fails, force clear and retry ONCE
      if (localStorage.getItem(CLEANUP_KEY)) {
        console.log('🔄 Forcing full cleanup and retry...')
        localStorage.removeItem(CLEANUP_KEY)
        // Retry on next login — don't infinite loop
        localStorage.setItem('fcm_retry_pending', 'true')
      }
    } else {
      console.error('❌ FCM token error:', error)
    }
    return null
  }
}

export const refreshFCMToken = async (userId: string): Promise<void> => {
  try {
    if (!messaging) return

    // Skip FCM on localhost (requires HTTPS)
    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') return

    const registration = await navigator.serviceWorker.getRegistration('/sw.js')
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
