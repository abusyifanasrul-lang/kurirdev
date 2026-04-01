import { useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useUserStore } from '@/stores/useUserStore'
import { useOrderStore } from '@/stores/useOrderStore'
import { useNotificationStore } from '@/stores/useNotificationStore'
import { useSettingsStore } from '@/stores/useSettingsStore'
import { supabase } from '@/lib/supabaseClient'
import {
  isInitialSyncCompleted,
  syncAllFinalOrders,
  needsDeltaSync,
  deltaSyncYesterday,
  moveToLocalDB,
  checkIntegrity
} from '@/lib/orderCache'
import { Order } from '@/types'

// Setup Realtime fetch helper
async function fetchFinalOrders(
  start: Date,
  end: Date,
  courierId?: string
): Promise<Order[]> {
  let query = supabase
    .from('orders')
    .select('*')
    .in('status', ['delivered', 'cancelled'])
    .gte('created_at', start.toISOString())
    .lte('created_at', end.toISOString())
    .order('created_at', { ascending: false })

  if (courierId) {
    query = query.eq('courier_id', courierId)
  }

  const { data, error } = await query
  if (error) {
    console.error('Error fetching final orders:', error)
    return []
  }
  return data as Order[]
}

// Storage budget check
async function checkStorageBudget() {
  if (!navigator.storage?.estimate) return
  try {
    const { usage, quota } = await navigator.storage.estimate()
    if (!usage || !quota) return
    const usagePercent = (usage / quota) * 100
    if (usagePercent > 80) {
      console.warn(`Storage ${usagePercent.toFixed(1)}% used — consider pruning`)
      // Hapus order > 1 tahun yang sudah final dan paid
      const oneYearAgo = new Date()
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
      const cutoff = oneYearAgo.toISOString().split('T')[0]
      const { localDB } = await import('@/lib/orderCache')
      await localDB.orders
        .where('_date')
        .below(cutoff)
        .filter(o =>
          o.payment_status === 'paid' &&
          (o.status === 'delivered' || o.status === 'cancelled')
        )
        .delete()
      console.log('Pruning completed')
    }
  } catch (err) {
    console.error('Storage check error:', err)
  }
}

export function AppListeners() {
  const { user } = useAuth()
  const subscribeUsers = useUserStore(state => state.subscribeUsers)
  const initQueuePositions = useUserStore(state => state.initQueuePositions)
  const subscribeAllNotifications = useNotificationStore(state => state.subscribeAllNotifications)

  useEffect(() => {
    // Hanya admin yang butuh daftar semua user secara real-time
    let unsubUsers = () => {};
    if (user && ['admin', 'admin_kurir', 'owner'].includes(user.role)) {
      unsubUsers = subscribeUsers()
    }

    // Queue positions only needed for admin roles, not courier
    setTimeout(() => {
      const sessionStr = sessionStorage.getItem('user-session')
      if (sessionStr) {
        try {
          const { state } = JSON.parse(sessionStr)
          if (state?.user?.role && state.user.role !== 'courier') {
             initQueuePositions().catch(console.error)
          }
        } catch {}
      }
    }, 5000)

    return () => {
      if (unsubUsers && typeof unsubUsers === 'function') {
        try { unsubUsers() } catch (e) { /* ignore */ }
      }
    }
  }, [user?.id, subscribeUsers, initQueuePositions])

  useEffect(() => {
    if (!user) return

    // Onetime fetch for global settings sync
    const syncGlobalSettings = async () => {
      try {
        const { data, error } = await supabase.from('settings').select('*').eq('id', 'global').single()
        if (data && !error) {
           useSettingsStore.getState().updateSettings({
             commission_rate: data.commission_rate ?? 10,
             commission_threshold: data.commission_threshold ?? 5000,
           })
           console.log('Global settings synced to local store.')
        }
      } catch (err) {
        console.error('Failed to sync global settings:', err)
      }
    }
    syncGlobalSettings()

  }, [user?.id])

  useEffect(() => {
    // Semua role admin (admin, admin_kurir, owner, finance) butuh live orders
    if (!user || user.role === 'courier') return

    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    
    // Initial fetch to populate the store
    const fetchInitialAdminOrders = async () => {
      // Fetch today's orders
      const { data: todayOrders } = await supabase
        .from('orders')
        .select('*')
        .gte('created_at', todayStart.toISOString())
        .order('created_at', { ascending: false })
        .limit(100)

      // Fetch active orders (can be older than today)
      const { data: activeOrders } = await supabase
        .from('orders')
        .select('*')
        .neq('status', 'delivered')
        .neq('status', 'cancelled')
        .order('created_at', { ascending: false })
        .limit(50)
        
      const allFetched = [...(todayOrders || []), ...(activeOrders || [])] as Order[]
      // deduplicate
      const uniqueOrders = Array.from(new Map(allFetched.map(item => [item.id, item])).values())
      
      useOrderStore.getState().setOrders(uniqueOrders)
    }

    fetchInitialAdminOrders()

    // Realtime subscription for ALL order changes
    const channel = supabase.channel('admin:orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
        const { eventType, new: newRec, old: oldRec } = payload
        const currentOrders = useOrderStore.getState().orders
        let updatedOrders = [...currentOrders]

        if (eventType === 'INSERT') {
          // Check if it's relevant (active or today) before pushing blindly
          const isToday = new Date(newRec.created_at) >= todayStart
          const isActive = !['delivered', 'cancelled'].includes(newRec.status)
          if (isToday || isActive) {
            updatedOrders = [newRec as Order, ...updatedOrders]
          }
        } 
        else if (eventType === 'UPDATE') {
          const idx = updatedOrders.findIndex(o => o.id === newRec.id)
          if (idx !== -1) {
            updatedOrders[idx] = { ...updatedOrders[idx], ...(newRec as Order) }
          } else {
            // Might be an old order that just became active again? Unlikely but safe to add
            const isToday = new Date(newRec.created_at) >= todayStart
            const isActive = !['delivered', 'cancelled'].includes(newRec.status)
            if (isToday || isActive) {
               updatedOrders.unshift(newRec as Order)
            }
          }

          // Mirror write ke IndexedDB untuk order yang final
          if (newRec.status === 'delivered' || newRec.status === 'cancelled') {
             moveToLocalDB(newRec as Order).catch(err => console.error('Mirror write error:', err))
          }
        }
        else if (eventType === 'DELETE') {
          updatedOrders = updatedOrders.filter(o => o.id !== oldRec.id)
        }

        useOrderStore.getState().setOrders(updatedOrders)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user?.id])

  useEffect(() => {
    if (!user) return

    const runSync = async () => {
      try {
        const fetchFn = (start: Date, end: Date) =>
          fetchFinalOrders(
            start, end,
            user.role === 'courier' ? user.id : undefined
          )

        // INITIAL SYNC
        if (!isInitialSyncCompleted(user.id)) {
          console.log(`Running initial sync for ${user.role} ${user.id}...`)
          const count = await syncAllFinalOrders(fetchFn, user.id)
          console.log(`Initial sync: ${count} orders cached`)
          window.dispatchEvent(new CustomEvent('indexeddb-synced'))
          await checkStorageBudget()
          return
        }

        // INTEGRITY CHECK
        const { ok, localCount, metaCount } = await checkIntegrity()
        if (!ok) {
          console.warn(`Integrity check failed: local=${localCount}, meta=${metaCount}`)
          if (Math.abs(localCount - metaCount) > 10) {
            await syncAllFinalOrders(fetchFn, user.id)
            await checkStorageBudget()
            return
          }
        }

        // DELTA SYNC
        if (needsDeltaSync(user.id)) {
          console.log(`Running delta sync for ${user.role} ${user.id}...`)
          const count = await deltaSyncYesterday(fetchFn, user.id)
          console.log(`Delta sync: ${count} orders cached`)
          window.dispatchEvent(new CustomEvent('indexeddb-synced'))
        }

        await checkStorageBudget()
      } catch (error) {
        console.error('Sync error:', error)
      }
    }

    const timer = setTimeout(() => {
      if (document.visibilityState === 'visible') {
        runSync()
      }
    }, 5000)
    return () => clearTimeout(timer)
  }, [user?.id])

  useEffect(() => {
    if (!user || !['admin', 'admin_kurir', 'owner'].includes(user.role)) return;
    
    let unsub: any = null;
    const setupNotifications = async () => {
      try {
        unsub = await subscribeAllNotifications();
      } catch (e) {
        console.error('Failed to subscribe notifications:', e);
      }
    };
    
    setupNotifications();
    
    return () => {
      if (unsub && typeof unsub === 'function') {
        try { unsub() } catch (e) { /* ignore */ }
      }
    };
  }, [user?.id, subscribeAllNotifications]);

  return null
}
