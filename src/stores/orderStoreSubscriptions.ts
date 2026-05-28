/**
 * orderStoreSubscriptions.ts
 * ==========================================================================
 * Realtime channel lifecycle management for the Order store.
 *
 * ARCHITECTURE NOTES:
 * - Module-level Maps (orderChannels, orderStates, orderRefs) live HERE
 *   to preserve channel state across HMR / component remounts.
 * - Functions receive `set` / `get` via parameter injection (NOT by
 *   importing useOrderStore) to prevent circular dependencies.
 * - All imports in this file are STATIC — no dynamic import() for store
 *   modules, which guards against tree-shaking initialization races.
 * ==========================================================================
 */
import { supabase } from '@/lib/supabaseClient'
import { RealtimeChannel } from '@supabase/supabase-js'
import { Order } from '@/types'
import type { OrderStoreSet, OrderStoreGet } from './useOrderStore'

// ==========================================================================
// MODULE-LEVEL STATE — persists across HMR / component remounts
// These Maps are the SINGLE source of truth for channel management.
// They must NEVER be duplicated in useOrderStore.ts or any other file.
// ==========================================================================
let orderResyncTime = 0
const orderChannels = new Map<string, RealtimeChannel>()
const orderStates = new Map<string, string>()
const orderRefs = new Map<string, number>()

// ---------------------------------------------------------------
// resyncRealtime
// ---------------------------------------------------------------
export function createResyncRealtime(set: OrderStoreSet, get: OrderStoreGet) {
  return async (
    filter?: { courierId?: string; activeOnly?: boolean },
    options?: { force?: boolean }
  ): Promise<void> => {
    // 1. Operation Lock: Prevent parallel resyncs (HMR friendly)
    if (get()._resyncLock) {
      console.log('⏳ Order store resync already in progress, skipping duplicate call.')
      return get()._resyncLock as Promise<void>
    }

    const resyncPromise = (async () => {
      try {
        // 2. THROTTLE check (unless forced)
        const now = Date.now()
        if (!options?.force && (now - orderResyncTime < 30000)) return
        orderResyncTime = now

        if (options?.force) {
          console.log('🔄 Forced orders resync triggered...')
        } else {
          console.log('🔄 Throttled orders resync triggered...')
        }
        
        // 3. Gap fill via HTTP
        await get().fetchInitialOrders(filter)
        
        // 4. WebSocket Recovery
        const channelId = `orders:active`
        if (!orderChannels.has(channelId)) {
          console.warn(`⚠️ Channel ${channelId} not found in map — re-subscribing...`)
          await get().subscribeOrders(filter)
        } else {
          console.log(`ℹ️ Channel ${channelId} exists (state: ${orderStates.get(channelId)}) — trusting Supabase auto-reconnect`)
        }
      } finally {
        set({ _resyncLock: null })
      }
    })()

    set({ _resyncLock: resyncPromise })
    return resyncPromise
  }
}

// ---------------------------------------------------------------
// subscribeOrders  (bulk channel for active orders)
// ---------------------------------------------------------------
export function createSubscribeOrders(set: OrderStoreSet, get: OrderStoreGet) {
  return (filter?: { courierId?: string; activeOnly?: boolean }): (() => void) => {
    const { courierId } = filter || {}
    const channelId = courierId ? `orders:courier:${courierId}` : 'orders:global'
    const filterStr = courierId ? `courier_id=eq.${courierId}` : undefined

    // 1. ATOMIC INCREMENT & SYNC GUARD
    const currentRef = orderRefs.get(channelId) || 0
    orderRefs.set(channelId, currentRef + 1)

    const existing = orderChannels.get(channelId)
    // Synchronously check both joined and joining
    if (existing && (orderStates.get(channelId) === 'joined' || orderStates.get(channelId) === 'joining')) {
      return () => get().unsubscribeOrders(channelId)
    }

    // 2. SYNCHRONOUS JOIN STATE
    orderStates.set(channelId, 'joining')

    // 3. INTERNAL ASYNC INIT
    ;(async () => {
      if (existing) {
        console.log(`♻️ Cleaning up existing channel for ${channelId}...`)
        await supabase.removeChannel(existing)
        orderChannels.delete(channelId)
      }

      // Safeguard: Check if we are still supposed to be joining
      if (orderStates.get(channelId) !== 'joining') return;

      const channelConfig: any = { event: '*', schema: 'public', table: 'orders' }
      if (filterStr) channelConfig.filter = filterStr

      const channel = supabase.channel(channelId)
        .on(
          'postgres_changes',
          channelConfig,
          async (payload) => {
            const { eventType, new: newRec, old: oldRec } = payload
            console.log(`🔔 Realtime [${channelId}] ${eventType}:`, newRec || oldRec)
            
            // MIRRORING ARCHITECTURE: Only finalized orders to localDB
            if (eventType === 'UPDATE' || eventType === 'INSERT') {
              const FINAL_STATUSES = ['delivered', 'cancelled']
              const isFinal = FINAL_STATUSES.includes(newRec.status)
              
              if (isFinal) {
                console.info(`[useOrderStore] Realtime ${eventType} mirroring to localDB: ${newRec.id}`)
                const { moveToLocalDB } = await import('@/lib/orderCache')
                await moveToLocalDB(newRec as unknown as Order, eventType === 'UPDATE')
              }
            }

            set((state) => {
              let updatedActive = [...state.activeOrdersByCourier]
              let updatedHistory = [...state.orders]

              if (eventType === 'INSERT') {
                const order = newRec as unknown as Order
                const isNowActive = !['delivered', 'cancelled'].includes(order.status)
                if (isNowActive) {
                  // Prevent duplicate inserts if already in state
                  if (!updatedActive.some(o => o.id === order.id)) {
                    updatedActive = [order, ...updatedActive]
                  }
                } else {
                  if (!updatedHistory.some(o => o.id === order.id)) {
                    updatedHistory = [order, ...updatedHistory]
                  }
                }
              } else if (eventType === 'UPDATE') {
                const orderId = (newRec as Order).id
                const existingActive = updatedActive.find(o => o.id === orderId)
                const existingHistory = updatedHistory.find(o => o.id === orderId)
                
                // MERGE logic: Use existing state or full row from newRec
                let baseOrder: Order = (existingActive || existingHistory) as Order

                let mergedOrder: Order
                if (baseOrder) {
                  mergedOrder = { ...baseOrder }
                  Object.keys(newRec).forEach(k => { 
                    if (newRec[k] !== undefined && newRec[k] !== null) (mergedOrder as any)[k] = newRec[k] 
                  })
                } else {
                  mergedOrder = newRec as unknown as Order
                }

                const wasActive = updatedActive.some(o => o.id === mergedOrder.id)
                const isNowActive = !['delivered', 'cancelled'].includes(mergedOrder.status)

                if (wasActive && !isNowActive) {
                  updatedActive = updatedActive.filter(o => o.id !== mergedOrder.id)
                  if (!updatedHistory.some(o => o.id === mergedOrder.id)) {
                    updatedHistory = [mergedOrder, ...updatedHistory]
                  } else {
                    updatedHistory = updatedHistory.map(o => o.id === mergedOrder.id ? mergedOrder : o)
                  }
                } else if (isNowActive) {
                  const idx = updatedActive.findIndex(o => o.id === mergedOrder.id)
                  if (idx !== -1) updatedActive[idx] = mergedOrder
                  else updatedActive = [mergedOrder, ...updatedActive]
                } else {
                  const idx = updatedHistory.findIndex(o => o.id === mergedOrder.id)
                  if (idx !== -1) updatedHistory[idx] = mergedOrder
                }
              } else if (eventType === 'DELETE') {
                updatedActive = updatedActive.filter(o => o.id !== oldRec.id)
                updatedHistory = updatedHistory.filter(o => o.id !== oldRec.id)
                import('@/lib/orderCache').then(({ removeFromLocalDB }) => removeFromLocalDB(oldRec.id))
              }

              return { 
                activeOrdersByCourier: updatedActive,
                orders: updatedHistory
              }
            })
          }
        )
        .on(
          'broadcast',
          { event: 'ping' },
          () => {
            console.log(`📡 [OrderStore] Loopback PONG received for ${channelId}`);
            set(state => ({ realtimeStatus: { ...state.realtimeStatus, [channelId]: 'joined' } }));
          }
        )

      // Set map BEFORE subscribe to lock other callers
      orderChannels.set(channelId, channel)

      channel.subscribe((status, err) => {
        // STALE GUARD: Ignore callbacks from superseded channels
        // This prevents the CLOSED callback of a cleaned-up channel from
        // corrupting the state of a newly registered replacement channel.
        if (orderChannels.get(channelId) !== channel) return

        if (status === 'SUBSCRIBED') {
          const prevState = orderStates.get(channelId)
          const wasCleanReconnect = prevState === 'closed'
          console.log(`✅ [OrderStore] ${channelId} ${wasCleanReconnect ? 'Reconnected (clean)' : 'Connected/Recovered'}`)
          orderStates.set(channelId, 'joined')
          set(state => ({ realtimeStatus: { ...state.realtimeStatus, [channelId]: 'joined' } }))

          if (wasCleanReconnect) {
            console.log(`📡 [OrderStore] ${channelId} Reconnect detected — skipping snapshot (handled by AppListeners gap-fill)`)
          } else {
            console.log(`📡 [OrderStore] ${channelId} First connect — fetching initial data...`)
            get().fetchInitialOrders(filter).catch(err => console.error('Snapshot fetch error:', err))
          }
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          if (status === 'CLOSED' && !err) {
             console.info(`ℹ️ [OrderStore] Realtime ${channelId} closed gracefully (superseded or unmounted).`)
          } else {
             console.warn(`⚠️ [OrderStore] Realtime ${channelId} ${status} — letting Supabase auto-reconnect.`, err || '')
          }
          
          const finalStatus = status === 'CLOSED' ? 'closed' : 'errored'
          orderStates.set(channelId, finalStatus)
          set(state => ({ realtimeStatus: { ...state.realtimeStatus, [channelId]: finalStatus } }))
          // PENTING: Jangan delete channel di sini agar auto-reconnect Supabase bekerja
        }
      })
    })()

    return () => get().unsubscribeOrders(channelId)
  }
}

// ---------------------------------------------------------------
// unsubscribeOrders
// ---------------------------------------------------------------
export function createUnsubscribeOrders(set: OrderStoreSet, _get: OrderStoreGet) {
  return (channelId: string): void => {
    const currentRef = orderRefs.get(channelId) || 0
    if (currentRef <= 1) {
      const channel = orderChannels.get(channelId)
      if (channel) {
        supabase.removeChannel(channel).catch(() => {})
        orderChannels.delete(channelId)
        orderStates.delete(channelId)

        // Cleanup health status
        set(state => {
          const next = { ...state.realtimeStatus }
          delete next[channelId]
          return { realtimeStatus: next }
        })
      }
      orderRefs.set(channelId, 0)
    } else {
      orderRefs.set(channelId, currentRef - 1)
    }
  }
}

// ---------------------------------------------------------------
// subscribeOrderById  (single-order channel)
// ---------------------------------------------------------------
export function createSubscribeOrderById(set: OrderStoreSet, get: OrderStoreGet) {
  return (orderId: string): (() => void) => {
    // 1. Initial Load
    const fetchCurrent = async () => {
      const { data } = await supabase.from('orders').select(`
        *,
        is_waiting,
        courier:profiles!courier_id(name, vehicle_type, plate_number),
        assigner:profiles!assigned_by(name)
      `).eq('id', orderId).single()
      if (data) set({ currentOrder: data as unknown as Order })
    }
    fetchCurrent()

    const channelId = `order:single:${orderId}`

    // 1. ATOMIC INCREMENT & SYNC GUARD
    const currentRef = orderRefs.get(channelId) || 0
    orderRefs.set(channelId, currentRef + 1)

    const existing = orderChannels.get(channelId)
    if (existing && (orderStates.get(channelId) === 'joined' || orderStates.get(channelId) === 'joining')) {
      return () => get().unsubscribeOrderById(orderId)
    }

    // 2. SYNCHRONOUS JOIN STATE
    orderStates.set(channelId, 'joining')

    // 3. INTERNAL ASYNC INIT
    ;(async () => {
      if (existing) {
        console.log(`♻️ Cleaning up existing channel for ${channelId}...`)
        await supabase.removeChannel(existing)
        orderChannels.delete(channelId)
      }

      // Safeguard: Check if we are still supposed to be joining
      if (orderStates.get(channelId) !== 'joining') return;

      const channel = supabase.channel(channelId)

      channel
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` }, (payload) => {
          if (payload.eventType === 'DELETE') {
             set({ currentOrder: null })
          } else if (payload.eventType === 'UPDATE') {
             const existing = get().currentOrder
             if (existing && existing.id === orderId) {
               const merged = JSON.parse(JSON.stringify(existing))
               Object.keys(payload.new).forEach(k => { if (payload.new[k] !== undefined) (merged as any)[k] = payload.new[k] })
               set({ currentOrder: merged as Order })
             } else {
               set({ currentOrder: payload.new as unknown as Order })
             }
          } else {
             set({ currentOrder: payload.new as Order })
          }
        })

      // Set map BEFORE subscribe to allow stale guard to work correctly
      orderChannels.set(channelId, channel)

      channel.subscribe((status, err) => {
        // STALE GUARD: Ignore callbacks from superseded channels
        if (orderChannels.get(channelId) !== channel) return

        if (status === 'SUBSCRIBED') {
          const prevState = orderStates.get(channelId)
          const wasCleanReconnect = prevState === 'closed'
          console.log(`✅ [OrderStore] ${channelId} ${wasCleanReconnect ? 'Reconnected (clean)' : 'Connected/Recovered'}`)
          orderStates.set(channelId, 'joined')
          set(state => ({ realtimeStatus: { ...state.realtimeStatus, [channelId]: 'joined' } }))

          if (wasCleanReconnect) {
            console.log(`📡 [OrderStore] ${channelId} Reconnect detected — skipping single fetch`)
          } else {
            console.log(`📡 [OrderStore] ${channelId} First connect — fetching order data...`)
            fetchCurrent().catch(err => console.error('Single snapshot fetch error:', err))
          }
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          if (status === 'CLOSED' && !err) {
            console.info(`ℹ️ [OrderStore] Realtime ${channelId} closed gracefully.`)
          } else {
            console.warn(`⚠️ [OrderStore] Realtime ${channelId} ${status} — letting Supabase auto-reconnect.`, err || '')
          }
          const finalStatus = status === 'CLOSED' ? 'closed' : 'errored'
          orderStates.set(channelId, finalStatus)
          set(state => ({ realtimeStatus: { ...state.realtimeStatus, [channelId]: finalStatus } }))
          // PENTING: Jangan delete channel di sini
        }
      })
    })()

    return () => get().unsubscribeOrderById(orderId)
  }
}

// ---------------------------------------------------------------
// unsubscribeOrderById
// ---------------------------------------------------------------
export function createUnsubscribeOrderById(set: OrderStoreSet, _get: OrderStoreGet) {
  return (orderId: string): void => {
    const channelId = `order:single:${orderId}`
    const currentRef = orderRefs.get(channelId) || 0
    if (currentRef <= 1) {
      const channel = orderChannels.get(channelId)
      if (channel) {
        supabase.removeChannel(channel).catch(() => {})
        orderChannels.delete(channelId)
        orderStates.delete(channelId)

        // Cleanup health status
        set(state => {
          const next = { ...state.realtimeStatus }
          delete next[channelId]
          return { realtimeStatus: next }
        })
      }
      orderRefs.set(channelId, 0)
    } else {
      orderRefs.set(channelId, currentRef - 1)
    }
  }
}

// ---------------------------------------------------------------
// pingRealtime
// ---------------------------------------------------------------
export function createPingRealtime() {
  return async (): Promise<void> => {
    const channels = Array.from(orderChannels.values());
    if (channels.length === 0) return;
    
    console.log(`📡 [OrderStore] Sending broadcast ping to ${channels.length} channels...`);
    await Promise.all(
      channels.map(ch => 
        ch.send({
          type: 'broadcast',
          event: 'ping',
          payload: {}
        })
      )
    );
  }
}
