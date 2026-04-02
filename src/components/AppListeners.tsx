import { useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useUserStore } from '@/stores/useUserStore'
import { useOrderStore } from '@/stores/useOrderStore'
import { useSettingsStore } from '@/stores/useSettingsStore'
import { supabase } from '@/lib/supabaseClient'
import {
  isInitialSyncCompleted,
  syncAllFinalOrders,
  needsDeltaSync,
  deltaSyncYesterday,
  checkIntegrity
} from '@/lib/orderCache'
import { onForegroundMessage } from '@/lib/fcm'

export const AppListeners = () => {
  const { user } = useAuth()
  const { fetchProfile } = useUserStore()
  const { fetchSettings } = useSettingsStore()

  // 1. Profile & Settings listeners
  useEffect(() => {
    if (user) {
      fetchProfile(user.id)
      fetchSettings()

      const profileChannel = supabase
        .channel(`public:profiles:id=eq.${user.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'profiles',
            filter: `id=eq.${user.id}`
          },
          () => {
            fetchProfile(user.id)
          }
        )
        .subscribe()

      const settingsChannel = supabase
        .channel('public:settings')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'settings' },
          () => {
            fetchSettings()
          }
        )
        .subscribe()

      return () => {
        supabase.removeChannel(profileChannel)
        supabase.removeChannel(settingsChannel)
      }
    }
  }, [user?.id])

  // 2. Orders & FCM Sync (The "oneSnapshot" paradigm)
  useEffect(() => {
    if (!user) return

    // Subscribe to Orders
    const unsubOrders = useOrderStore.getState().subscribeOrders(
      user.role === 'courier' 
        ? { courierId: user.id, activeOnly: true } 
        : undefined
    )

    // Integration with FCM for Foreground Refresh
    let unsubFCM = () => {}
    if (user.role === 'courier') {
      const cleanup = onForegroundMessage((payload) => {
        console.log('🔔 Foreground FCM caught, refreshing active orders...', payload)
        useOrderStore.getState().fetchActiveOrdersByCourier(user.id)
      })
      
      if (typeof cleanup === 'function') {
        unsubFCM = cleanup as () => void
      }
    }

    return () => {
      unsubOrders()
      unsubFCM()
    }
  }, [user?.id, user?.role])

  // 3. Background Sync & Integrity (Admin only or high-level)
  useEffect(() => {
    if (user && user.role !== 'courier') {
      const runSync = async () => {
        const userId = user.id
        const fetchFn = useOrderStore.getState().fetchOrdersByDateRange

        if (!isInitialSyncCompleted(userId)) {
          console.log('🔄 First time load, syncing all final orders...')
          await syncAllFinalOrders(fetchFn, userId)
        } else if (needsDeltaSync(userId)) {
          console.log('🔄 Daily delta sync...')
          await deltaSyncYesterday(fetchFn, userId)
        }
        await checkIntegrity()
      }
      runSync()
    }
  }, [user?.id])

  return null
}
