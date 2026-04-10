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
  const { fetchSettings, subscribeSettings } = useSettingsStore()
  const sessionCheckPromise = useRef<Promise<boolean> | null>(null);
  const resyncAllLock = useRef<Promise<void> | null>(null);
  const watchdogTimer = useRef<NodeJS.Timeout | null>(null);

  // 1. Settings listeners (Global)
  useEffect(() => {
    if (user) {
      fetchSettings()
      const cleanup = subscribeSettings()
      return () => { cleanup() }
    }
  }, [user?.id, fetchSettings, subscribeSettings])

    // 1.b Profile specific listener (Force logout if suspended + Real-time sync)
    useEffect(() => {
      if (user) {
        const cleanup = useUserStore.getState().subscribeProfile(user.id)
        return () => { cleanup() }
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

    // 2.a Initial Load (Cache-first then background fetch) - Delayed for boot efficiency
    const orderStore = useOrderStore.getState()
    const task = () => orderStore.fetchInitialOrders(filter)
    
    if ('requestIdleCallback' in window) {
      (window as any).requestIdleCallback(() => setTimeout(task, 500), { timeout: 5000 })
    } else {
      setTimeout(task, 1000)
    }

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
      unsubOrders()
      unsubNotifs()
      if (fcmRefreshInterval) clearInterval(fcmRefreshInterval)
      if (fcmCleanup.unsubscribe) {
        const u = fcmCleanup.unsubscribe
        if (typeof u === 'function') {
          u()
        }
      }
    }
  }, [user?.id, user?.role])

  // 2.e Support Stores Loading (Customers & Profiles) - Staggered/Delayed
  useEffect(() => {
    if (user) {
       const initStores = async () => {
         // Delay all store inits to let React finish hydration/initial render
         await new Promise(r => setTimeout(r, 800))

         // Stagger 1: User Profile
         const userStore = useUserStore.getState()
         if (!userStore.isLoaded) {
           await userStore.loadFromLocal()
           userStore.syncFromServer()
         }

         // Stagger 2: Customers (Deeper delay and idle-based)
         const loadCustomers = async () => {
           const customerStore = useCustomerStore.getState()
           await customerStore.loadFromLocal()
           customerStore.syncFromServer()
         }

         if ('requestIdleCallback' in window) {
           (window as any).requestIdleCallback(() => setTimeout(loadCustomers, 2000), { timeout: 10000 })
         } else {
           setTimeout(loadCustomers, 3000)
         }
       }
       initStores()
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

        // Use requestIdleCallback or longer timeout for non-critical work
        const scheduleSync = () => {
          const syncTask = async () => {
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
          }

          if ('requestIdleCallback' in window) {
            (window as any).requestIdleCallback(() => {
              setTimeout(syncTask, 2000) // Delay even when idle to be safe
            }, { timeout: 10000 })
          } else {
            setTimeout(syncTask, 5000)
          }
        }
        
        scheduleSync()
      }
      runSync()
    }
  }, [user?.id, user?.role])

  // 4. Admin-wide Users subscription
  useEffect(() => {
    if (user && user.role !== 'courier') {
      const cleanup = useUserStore.getState().subscribeUsers()
      return () => { cleanup() }
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

    const resyncAll = async (force: boolean = false) => {
      // 1. Operation Lock: Prevent multiple staggered resync waves
      if (resyncAllLock.current) {
        console.log('⏳ Global resync already in flight, queuing for next trigger.');
        return resyncAllLock.current;
      }

      resyncAllLock.current = (async () => {
        try {
          // Throttle by 5 seconds to avoid firing multiple times (unless forced)
          const now = Date.now();
          if (!force && (now - lastSyncTime < 5000)) {
            console.log('⏳ Skipping resyncAll (cooldown active)');
            return;
          }
          
          if (timeoutId) return;
          timeoutId = setTimeout(() => { timeoutId = null }, 2000);
          lastSyncTime = now;

          console.log(`🔄 Triggering staggered ${force ? 'FORCED ' : ''}realtime resync...`);
          
          const filter = {
            courierId: user.role === 'courier' ? user.id : undefined,
            activeOnly: user.role === 'courier'
          }

          // Step 1: Orders (Highest Priority)
          await useOrderStore.getState().resyncRealtime(filter, { force })
          
          // Step 2: Stagger (300ms)
          await new Promise(r => setTimeout(r, 300))

          // Step 3: Users/Profile
          if (user.role === 'courier') {
            await useUserStore.getState().resyncRealtime(user.id, { force })
          } else {
            await useUserStore.getState().resyncRealtime(undefined, { force })
          }

          // Step 4: Stagger (300ms)
          await new Promise(r => setTimeout(r, 300))

          // Step 5: Notifications
          if (user.role === 'courier') {
            await useNotificationStore.getState().resyncRealtime(user.id, { force })
          } else {
            await useNotificationStore.getState().resyncRealtime(undefined, { force })
          }

          // Step 6: Stagger (300ms)
          await new Promise(r => setTimeout(r, 300))

          // Step 7: Customers
          await useCustomerStore.getState().resyncRealtime({ force })

          // Step 8: Stagger (300ms)
          await new Promise(r => setTimeout(r, 300))

          // Step 9: Settings
          await useSettingsStore.getState().resyncRealtime({ force })

          console.log(`✅ Staggered ${force ? 'FORCED ' : ''}resync completed`);
        } finally {
          resyncAllLock.current = null;
        }
      })();

      return resyncAllLock.current;
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
      
      // 1. START WATCHDOG (10s limit for recover)
      if (watchdogTimer.current) clearTimeout(watchdogTimer.current);
      watchdogTimer.current = setTimeout(() => {
        console.warn(`🚨 [Watchdog] Resync from ${source} stuck > 10s. Forcing hard reload.`);
        window.location.reload();
      }, 10000);

      try {
        const isValid = await ensureValidSession()
        if (isValid) {
          // AppListeners resyncs are ALWAYS forced to bypass store throttles, 
          // since AppListeners itself implements a 5s throttle.
          await resyncAll(true)
        } else {
          console.warn(`⚠️ [${source}] Session invalid. Resync aborted.`)
        }
      } finally {
        // 2. CLEAR WATCHDOG
        if (watchdogTimer.current) {
          clearTimeout(watchdogTimer.current);
          watchdogTimer.current = null;
          console.log(`✅ [Watchdog] Resync from ${source} completed. Timer cleared.`);
        }
      }
    }

    const handleOnline = () => {
      handleSyncTrigger('Online')
    }

    const handleRealtimeAuthSync = () => {
      handleSyncTrigger('AuthSync')
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('supabase-realtime-auth-synced', handleRealtimeAuthSync)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('supabase-realtime-auth-synced', handleRealtimeAuthSync)
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [user?.id, user?.role])

  return null
}
