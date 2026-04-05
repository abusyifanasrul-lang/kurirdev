import { useEffect } from 'react'
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
import { onForegroundMessage } from '@/lib/fcm'

export const AppListeners = () => {
  const { user, logout } = useAuth()
  const { fetchProfile } = useUserStore()
  const { fetchSettings } = useSettingsStore()

  // 1. Settings listeners (Global)
  useEffect(() => {
    if (user) {
      fetchSettings()
      const unsub = (useSettingsStore.getState() as any).subscribeSettings()
      return () => unsub()
    }
  }, [user?.id])

  // 1.b Profile specific listener (Force logout if suspended)
  useEffect(() => {
    if (user) {
      fetchProfile(user.id)

      const profileChannelId = `profile:active:${user.id}`
      const profileChannel = supabase
        .channel(profileChannelId)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'profiles',
            filter: `id=eq.${user.id}`
          },
          (payload: any) => {
            if (payload.new && payload.new.is_active === false) {
              console.warn('⚠️ Akun disuspend oleh admin. Melakukan logout otomatis...')
              logout()
            } else {
              fetchProfile(user.id)
            }
          }
        )
        .subscribe()

      return () => {
        supabase.removeChannel(profileChannel)
      }
    }
  }, [user?.id])
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

    // 2.d Integration with FCM for Foreground Refresh
    let unsubFCM = () => {}
    if (user.role === 'courier') {
      const cleanup = onForegroundMessage((payload) => {
        console.log('🔔 Foreground FCM caught, refreshing active orders...', payload)
        orderStore.fetchActiveOrdersByCourier(user.id)
      })
      
      if (typeof cleanup === 'function') {
        unsubFCM = cleanup as () => void
      }
    }

    return () => {
      unsubOrders()
      unsubNotifs()
      unsubFCM()
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

  return null
}
