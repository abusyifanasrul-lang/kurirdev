import { useEffect, useRef } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useUserStore } from '@/stores/useUserStore'
import { useOrderStore } from '@/stores/useOrderStore'
import { useSettingsStore } from '@/stores/useSettingsStore'
import { useNotificationStore } from '@/stores/useNotificationStore'
import { useCustomerStore } from '@/stores/useCustomerStore'
import { supabase } from '@/lib/supabaseClient'

import {
  isInitialSyncCompleted,
  syncAllFinalOrders,
  needsDeltaSync,
  deltaSyncYesterday,
  checkIntegrity,
  pruneOldCache
} from '@/lib/orderCache'


export const AppListeners = () => {
  const { user, logout } = useAuth()
  const { fetchSettings } = useSettingsStore()
  const sessionCheckPromise = useRef<Promise<boolean> | null>(null);

  // 1. Settings listeners (Global)
  useEffect(() => {
    if (user) {
      fetchSettings()
      const unsub = (useSettingsStore.getState() as any).subscribeSettings()
      return () => unsub()
    }
  }, [user?.id])

    // 1.b Profile specific listener (Force logout if suspended + Real-time sync)
    useEffect(() => {
      if (user) {
        // subscribeProfile already handles the realtime 'on' listener for profiles
        const unsubProfile = useUserStore.getState().subscribeProfile(user.id)
        return () => unsubProfile()
      }
    }, [user?.id])

    // 1.c Watch store for suspension status (Security Gate)
    const liveUser = useUserStore((state) => state.users.find(u => u.id === user?.id));
    useEffect(() => {
      if (liveUser && liveUser.is_active === false) {
        console.warn('⚠️ Akun disuspend oleh admin. Melakukan logout otomatis...')
        logout()
      }
    }, [liveUser?.is_active, logout])
  // 2. Orders & FCM Sync (The "oneSnapshot" paradigm)
  useEffect(() => {
    if (!user) return

    // Memoize filter options to prevent redundant effect runs
    const filter = {
      courierId: user.role === 'courier' ? user.id : undefined,
      activeOnly: user.role === 'courier'
    }

    // 2.a Initial Load (Cache-first then background fetch)
    const orderStore = useOrderStore.getState()
    orderStore.fetchInitialOrders(filter)

    // 2.b Real-time Subscription
    const unsubOrders = orderStore.subscribeOrders(filter)

    // 2.c Notifications Subscription
    const notifStore = useNotificationStore.getState()
    const unsubNotifs = user.role === 'courier' 
      ? notifStore.subscribeNotifications(user.id)
      : notifStore.subscribeAllNotifications()

    // 2.d Integration with FCM for Token Refresh & Foreground Refresh
    let fcmCleanup: { unsubscribe?: any } = {}
    let fcmRefreshInterval: any = null

    if (user.role === 'courier') {
       // Only load and initialize FCM for courier role
       import('@/lib/fcm').then(({ refreshFCMToken, onForegroundMessage }) => {
         // Initial check
         refreshFCMToken(user.id).catch(console.error)

         // Periodic check (every 7 days)
         const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000
         fcmRefreshInterval = setInterval(() => {
           refreshFCMToken(user.id).catch(console.error)
         }, SEVEN_DAYS_MS)

         fcmCleanup.unsubscribe = onForegroundMessage((payload) => {
           console.log('🔔 Foreground FCM caught:', payload)
           
           // A. Refresh Order Store
           orderStore.fetchActiveOrdersByCourier(user.id)

           // B. Show Browser Notification (if permission granted)
           const notifData = payload.notification || payload.data || {}
           const title = notifData.title
           const body = notifData.body
           if (title && Notification.permission === 'granted') {
             const notif = new Notification(title, {
               body: body || '',
               icon: '/icons/android/android-launchericon-192-192.png',
               tag: payload.data?.orderId || 'kurirdev-foreground',
             })
             notif.onclick = () => window.focus()
           }
         })
       }).catch(err => console.error('[FCM] Dynamic import failed:', err))
    }

    return () => {
      if (typeof unsubOrders === 'function') unsubOrders()
      if (typeof unsubNotifs === 'function') unsubNotifs()
      if (fcmRefreshInterval) clearInterval(fcmRefreshInterval)
      if (fcmCleanup.unsubscribe) {
        const u = fcmCleanup.unsubscribe
        if (typeof u === 'function') {
          u()
        } else if (u && typeof (u as any).then === 'function') {
          (u as any).then((h: any) => h.remove?.())
        }
      }
    }
  }, [user?.id, user?.role])

  // 2.e Support Stores Loading (Customers & Profiles)
  useEffect(() => {
    if (user) {
       // Only perform initial load/sync once
       const userStore = useUserStore.getState()
       if (!userStore.isLoaded) {
         userStore.loadFromLocal().then(() => {
           userStore.syncFromServer()
         })
       }

       const customerStore = useCustomerStore.getState()
       customerStore.loadFromLocal().then(() => {
         customerStore.syncFromServer()
       })
    }
  }, [user?.id])

  // 3. Background Sync & Integrity (All Roles Mirroring)
  useEffect(() => {
    if (user) {
      const runSync = async () => {
        const userId = user.id
        const orderStore = useOrderStore.getState()
        
        // Define a filtered fetch function for background mirroring
        const fetchFn = (start: Date, end: Date) => 
          orderStore.fetchOrdersByDateRange(start, end, user.role === 'courier' ? user.id : undefined)

        // Delay background sync to prioritize initial render and real-time connections
        setTimeout(async () => {
          try {
            if (!isInitialSyncCompleted(userId)) {
              console.log(`[Sync] 🔄 Initial sync for ${user.role} (${userId})...`)
              await syncAllFinalOrders(fetchFn, userId)
            } else if (needsDeltaSync(userId)) {
              console.log(`[Sync] 🔄 Incremental delta sync for ${userId}...`)
              await deltaSyncYesterday(fetchFn, userId)
            }
            await checkIntegrity()
            await pruneOldCache()
          } catch (err) {
            console.error('[Sync] ❌ Sync failed:', err)
          }
        }, 3000) // 3s delay for heavy background work
      }
      runSync()
    }
  }, [user?.id, user?.role])

  // 4. Admin-wide Users subscription
  useEffect(() => {
    if (user && user.role !== 'courier') {
      const unsubUsers = useUserStore.getState().subscribeUsers()
      return () => unsubUsers()
    }
  }, [user?.id, user?.role])

  // 5. Visibility / Online / Window Focus Sync (Self-Healing with Auth Check)
  useEffect(() => {
    if (!user) return

    let timeoutId: any = null
    let lastSyncTime = 0

    const ensureValidSession = async (): Promise<boolean> => {
      // 1. If a check is already in flight, reuse its promise
      if (sessionCheckPromise.current) {
        console.log('⏳ Session check already in progress, awaiting...');
        return sessionCheckPromise.current;
      }

      // 2. Wrap the session check in a persistent promise
      sessionCheckPromise.current = (async () => {
        try {
          const { data: { session }, error } = await supabase.auth.getSession()
          if (error || !session) {
            console.warn('⚠️ No valid session, attempting refresh...')
            const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession()
            if (refreshError || !refreshed.session) {
              console.error('❌ Session refresh failed:', refreshError)
              return false
            }
          }
          console.log('✅ Session validated')
          // ENSURE REALTIME AUTH SYNC
          if (session && session.access_token) {
            console.log('🔑 Syncing realtime auth token...')
            supabase.realtime.setAuth(session.access_token)
          }
          return true
        } catch (err: any) {
          if (err?.name === 'AbortError') {
             console.warn('⚠️ Lock broken by another tab/process. Recovering gracefully.');
             return true; // Assume valid or allow retry later
          }
          console.error('❌ ensureValidSession error:', err)
          return false
        } finally {
          // Clear reference after completion (success or fail)
          sessionCheckPromise.current = null;
        }
      })();

      return sessionCheckPromise.current;
    }

    const resyncAll = () => {
      // Throttle by 5 seconds to avoid firing multiple times
      // and to avoid clashing with AuthContext background refreshes
      const now = Date.now();
      if (now - lastSyncTime < 5000) {
        console.log('⏳ Skipping resyncAll (cooldown active)');
        return;
      }
      
      if (timeoutId) return;
      timeoutId = setTimeout(() => { timeoutId = null }, 2000);
      lastSyncTime = now;

      console.log('🔄 Triggering realtime resync...');
      
      const filter = {
        courierId: user.role === 'courier' ? user.id : undefined,
        activeOnly: user.role === 'courier'
      }

      useOrderStore.getState().resyncRealtime(filter)
      
      if (user.role === 'courier') {
        useUserStore.getState().resyncRealtime(user.id)
      } else {
        useUserStore.getState().resyncRealtime()
      }
    }

    const handleSyncTrigger = async (source: string) => {
      // Delay slightly to bundle rapid visibility/focus events
      await new Promise(r => setTimeout(r, 100));

      const now = Date.now();
      if (now - lastSyncTime < 5000) {
        console.log(`📡 [${source}] Sync skipped (cooldown active)`);
        return;
      }

      console.log(`📡 [${source}] Triggered. Pre-flight auth check...`)
      const isValid = await ensureValidSession()
      if (isValid) {
        resyncAll()
      } else {
        console.warn(`⚠️ [${source}] Session invalid. Resync aborted.`)
      }
    }

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') handleSyncTrigger('Visibility')
    }
    
    const handleFocus = () => {
      handleSyncTrigger('Focus')
    }

    const handleOnline = () => {
      handleSyncTrigger('Online')
    }

    window.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('focus', handleFocus)
    window.addEventListener('online', handleOnline)

    return () => {
      window.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener('online', handleOnline)
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [user?.id, user?.role])

  return null
}
