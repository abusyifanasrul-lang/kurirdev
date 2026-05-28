/**
 * useOrderStore.ts  —  AGGREGATOR
 * ==========================================================================
 * Thin Zustand store that wires together:
 *   • State values & basic setters  (inline)
 *   • Fetch methods                 (inline — they only read from Supabase)
 *   • Subscription lifecycle        (from orderStoreSubscriptions.ts)
 *   • Mutation actions              (from orderStoreActions.ts)
 *
 * PUBLIC API IS UNCHANGED — no external imports need to be modified.
 *
 * ANTI-CIRCULAR-DEP PATTERN:
 *   The helper modules import `OrderState`, `OrderStoreSet`, `OrderStoreGet`
 *   as TYPE-ONLY imports from this file. They never call `useOrderStore` at
 *   runtime, so the dependency graph is strictly one-way:
 *
 *       useOrderStore.ts  ──(static)──►  orderStoreSubscriptions.ts
 *       useOrderStore.ts  ──(static)──►  orderStoreActions.ts
 *
 *   Both helper files receive `set` / `get` as constructor parameters.
 * ==========================================================================
 */
import { create, StateCreator } from 'zustand'
import { supabase } from '@/lib/supabaseClient'
import { Order, OrderStatus, OrderStatusHistory } from '@/types'
import { getLocalTodayRange } from '@/utils/date'

// STATIC imports from helper modules — no dynamic import() allowed here
import {
  createResyncRealtime,
  createSubscribeOrders,
  createUnsubscribeOrders,
  createSubscribeOrderById,
  createUnsubscribeOrderById,
  createPingRealtime,
} from './orderStoreSubscriptions'

import {
  createAddOrder,
  createUpdateOrderStatus,
  createCancelOrder,
  createUpdateOrder,
  createUpdateBiayaTambahan,
  createUpdateItemBarang,
  createUpdateOrderField,
  createSettleOrder,
  createUpdateItems,
  createUpdateOngkir,
  createUpdateOrderWaiting,
} from './orderStoreActions'

// ==========================================================================
// TYPE EXPORTS — consumed by helper modules via `import type`
// ==========================================================================
export type OrderStoreSet = Parameters<StateCreator<OrderState>>[0]
export type OrderStoreGet = Parameters<StateCreator<OrderState>>[1]

export interface OrderState {
  orders: Order[]
  statusHistory: Record<string, OrderStatusHistory[]>
  isLoading: boolean

  fetchOrdersByCourier: (courierId: string) => Promise<void>
  courierOrders: Order[]
  isFetchingCourierOrders: boolean
  historicalOrders: Order[]
  isFetchingHistory: boolean
  fetchOrdersByDateRange: (start: Date, end: Date, courierId?: string) => Promise<Order[]>
  fetchRecentlyUpdated: (since: string, filter?: { courierId?: string; activeOnly?: boolean }) => Promise<void>
  activeOrdersByCourier: Order[]
  isSyncing: boolean
  currentOrder: Order | null
  fetchActiveOrdersByCourier: (courierId: string) => Promise<void>
  // Internal lock for resync operations (helps with HMR stability)
  _resyncLock: Promise<void> | null
  resyncRealtime: (filter?: { courierId?: string; activeOnly?: boolean }, options?: { force?: boolean }) => Promise<void>
  
  isSyncingOrders: Set<string>
  setSyncing: (orderId: string, isSyncing: boolean) => void
  reset: () => void

  // Realtime "oneSnapshot" pattern
  fetchInitialOrders: (filter?: { courierId?: string; activeOnly?: boolean }) => Promise<void>
  subscribeOrders: (filter?: { courierId?: string; activeOnly?: boolean }) => () => void
  subscribeOrderById: (orderId: string) => () => void
  unsubscribeOrders: (channelId: string) => void
  unsubscribeOrderById: (orderId: string) => void
  
  addOrder: (order: Order) => Promise<void>
  updateOrderStatus: (orderId: string, status: OrderStatus, userId: string, userName: string, notes?: string) => Promise<void>
  cancelOrder: (orderId: string, reason: string, userId: string, userName: string, cancelReasonType?: string) => Promise<void>
  updateOrder: (orderId: string, updates: Partial<Order>) => Promise<void>
  updateBiayaTambahan: (orderId: string, titik: number, beban: { nama: string; biaya: number }[]) => Promise<void>
  updateItemBarang: (orderId: string, itemName: string, itemPrice: number) => Promise<void>
  updateItems: (orderId: string, items: { nama: string; harga: number }[]) => Promise<void>
  updateOngkir: (orderId: string, totalFee: number) => Promise<void>
  updateOrderWaiting: (orderId: string, isWaiting: boolean) => Promise<void>
  updateOrderField: (orderId: string, field: string, value: any) => Promise<void>
  settleOrder: (orderId: string, userId: string, userName: string) => Promise<void>
  
  getOrdersByCourier: (courierId: string) => Order[]
  getRecentOrders: (limit?: number) => Order[]
  
  setOrders: (orders: Order[]) => void
  setActiveOrdersByCourier: (orders: Order[]) => void
  
  // Real-time Subscriptions Status
  realtimeStatus: Record<string, string>
  pingRealtime: () => Promise<void>
}

// ==========================================================================
// STORE CREATION
// ==========================================================================
export const useOrderStore = create<OrderState>()((set, get) => ({
  // ------------------------------------------------------------------
  // STATE VALUES
  // ------------------------------------------------------------------
  orders: [],
  courierOrders: [],
  historicalOrders: [],
  statusHistory: {},
  isLoading: false,
  isFetchingCourierOrders: false,
  isFetchingHistory: false,
  activeOrdersByCourier: [],
  currentOrder: null,
  isSyncingOrders: new Set(),
  isSyncing: false,
  realtimeStatus: {},
  _resyncLock: null,

  // ------------------------------------------------------------------
  // BASIC SETTERS
  // ------------------------------------------------------------------
  setSyncing: (orderId, isSyncing) => set((state) => {
    const next = new Set(state.isSyncingOrders)
    if (isSyncing) next.add(orderId)
    else next.delete(orderId)
    return { isSyncingOrders: next }
  }),

  setOrders: (orders: Order[]) => {
    set({ orders, isLoading: false })
  },

  setActiveOrdersByCourier: (orders: Order[]) => {
    set({ activeOrdersByCourier: orders })
  },

  reset: () => set({
    orders: [],
    courierOrders: [],
    historicalOrders: [],
    statusHistory: {},
    activeOrdersByCourier: [],
    currentOrder: null,
    isLoading: false,
    realtimeStatus: {},
  }),

  // ------------------------------------------------------------------
  // GETTERS (pure, no side effects)
  // ------------------------------------------------------------------
  getOrdersByCourier: (courierId) => {
    return get().orders.filter(o => o.courier_id === courierId)
  },

  getRecentOrders: (limit = 5) => {
    return [...get().orders]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, limit)
  },

  // ------------------------------------------------------------------
  // FETCH METHODS (read-only Supabase queries, kept inline for simplicity)
  // ------------------------------------------------------------------
  fetchOrdersByCourier: async (courierId: string) => {
    set({ isFetchingCourierOrders: true })
    try {
      const { start } = getLocalTodayRange();
      const sevenDaysAgo = new Date(start);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const sevenDaysAgoStr = sevenDaysAgo.toISOString();
      
      const { data: allOrders, error } = await supabase
        .from('orders')
        .select(`
          *,
          is_waiting,
          courier:profiles!courier_id(name, vehicle_type, plate_number),
          assigner:profiles!assigned_by(name)
        `)
        .eq('courier_id', courierId)
        .or(`and(status.in.(delivered,cancelled),created_at.gte.${sevenDaysAgoStr}),and(status.eq.delivered,payment_status.eq.unpaid)`)
        .order('created_at', { ascending: false })

      if (error) throw error

      set({ courierOrders: allOrders as unknown as Order[], isFetchingCourierOrders: false })
    } catch (error) {
      console.error('fetchOrdersByCourier error:', error)
      set({ isFetchingCourierOrders: false })
    }
  },

  fetchOrdersByDateRange: async (start: Date, end: Date, courierId?: string): Promise<Order[]> => {
    set({ isFetchingHistory: true })
    try {
      let query = supabase
        .from('orders')
        .select(`
          *,
          is_waiting,
          courier:profiles!courier_id(name, vehicle_type, plate_number),
          assigner:profiles!assigned_by(name)
        `)
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString())

      if (courierId) {
        query = query.eq('courier_id', courierId)
      }

      const { data: historicalOrders, error } = await query
        .order('created_at', { ascending: false })

      if (error) throw error
      set({ historicalOrders: historicalOrders as Order[], isFetchingHistory: false })
      return (historicalOrders as unknown as Order[]) || []
    } catch (error) {
      console.error('fetchOrdersByDateRange error:', error)
      set({ isFetchingHistory: false })
      return []
    }
  },

  fetchActiveOrdersByCourier: async (courierId: string) => {
    set({ isSyncing: true })
    try {
      const { data: activeOrdersByCourier, error } = await supabase
        .from('orders')
        .select(`
          *,
          is_waiting,
          courier:profiles!courier_id(name, vehicle_type, plate_number),
          assigner:profiles!assigned_by(name)
        `)
        .eq('courier_id', courierId)
        .in('status', ['assigned', 'picked_up', 'in_transit'])
        
      if (error) throw error
      set({ activeOrdersByCourier: activeOrdersByCourier as unknown as Order[] })
    } catch (error) {
      console.error('fetchActiveOrdersByCourier error:', error)
    } finally {
      set({ isSyncing: false })
    }
  },

  fetchRecentlyUpdated: async (since, filter) => {
    try {
      let query = supabase
        .from('orders')
        .select(`
          *,
          is_waiting,
          courier:profiles!courier_id(name, vehicle_type, plate_number),
          assigner:profiles!assigned_by(name)
        `)
        .gt('updated_at', since)
        .order('updated_at', { ascending: false })
        .limit(50)

      if (filter?.courierId) {
        query = query.eq('courier_id', filter.courierId)
      }

      const { data, error } = await query
      if (error || !data || data.length === 0) return

      console.log(`📥 [OrderStore] Gap fill: ${data.length} orders updated since ${since}`)

      // Merge into state and local DB
      set((state) => {
        const updatedOrders = [...state.orders]
        const updatedActive = [...state.activeOrdersByCourier]

        for (const order of data as unknown as Order[]) {
          const isActive = !['delivered', 'cancelled'].includes(order.status)
          
          if (isActive) {
            const idx = updatedActive.findIndex(o => o.id === order.id)
            if (idx !== -1) updatedActive[idx] = order
            else updatedActive.unshift(order)
          } else {
            // Remove from active if it was there
            const activeIdx = updatedActive.findIndex(o => o.id === order.id)
            if (activeIdx !== -1) updatedActive.splice(activeIdx, 1)

            const idx = updatedOrders.findIndex(o => o.id === order.id)
            if (idx !== -1) updatedOrders[idx] = order
            else updatedOrders.unshift(order)
          }
        }

        return {
          orders: updatedOrders.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
          activeOrdersByCourier: updatedActive
        }
      })

      // Mirror finalized orders to local DB
      const finalized = (data as Order[]).filter(o => ['delivered', 'cancelled'].includes(o.status))
      if (finalized.length > 0) {
        const { bulkMoveToLocalDB } = await import('@/lib/orderCache')
        await bulkMoveToLocalDB(finalized)
      }
    } catch (err) {
      console.error('fetchRecentlyUpdated error:', err)
    }
  },

  fetchInitialOrders: async (filter) => {
    const { courierId } = filter || {}
    const { 
      getOrdersByCourierFromLocal, 
      getOrdersForWeek, 
      needsWeeklySync,
      saveWeeklySyncTime
    } = await import('@/lib/orderCache')

    // 1. LATEST MIRROR LOAD (Optimistic - Instant UI) - Start immediately
    if (courierId) {
      const cached = await getOrdersByCourierFromLocal(courierId)
      if (cached.length > 0) set({ orders: cached })
    } else {
      const cached = await getOrdersForWeek()
      if (cached.length > 0) set({ orders: cached })
    }

    // 2. MANDATORY Cleanup (Non-blocking for UI)
    // We do this after optimistic load to ensure UI paints first
    import('@/lib/orderCache').then(({ purgeNonFinalizedOrders }) => {
      purgeNonFinalizedOrders().catch(console.error)
    })
    
    // 3. Clear/Fetch Active Stores (Strictly Real-time)
    set({ activeOrdersByCourier: [], isSyncing: true })

    try {
      // 2.a ACTIVE ORDERS FETCH
      const activeStatuses = ['pending', 'assigned', 'picked_up', 'in_transit']
      let activeQuery = supabase.from('orders').select(`
        *,
        is_waiting,
        courier:profiles!courier_id(name, vehicle_type, plate_number),
        assigner:profiles!assigned_by(name)
      `).in('status', activeStatuses)
      if (courierId) activeQuery = activeQuery.eq('courier_id', courierId)

      const { data: activeData, error: activeError } = await activeQuery.order('created_at', { ascending: false })
      if (activeError) throw activeError
      const fetchedActive = (activeData as unknown as Order[]) || []

      // 2.b INTELLIGENT GAP-FILL (Finalized Orders: Delivered/Cancelled)
      const isWeeklyNeeded = needsWeeklySync(courierId);
      const { start } = getLocalTodayRange();
      const startOfTodayStr = start.toISOString();
      const sixDaysAgo = new Date(start);
      sixDaysAgo.setDate(sixDaysAgo.getDate() - 6);
      const sixDaysAgoStr = sixDaysAgo.toISOString();
      
      const fetchStart = isWeeklyNeeded ? sixDaysAgoStr : startOfTodayStr;
      
      console.log(`[Sync] Fetching finalized orders since ${fetchStart} (Weekly: ${isWeeklyNeeded})`)

      let finalQuery = supabase.from('orders')
        .select(`
          *,
          is_waiting,
          courier:profiles!courier_id(name, vehicle_type, plate_number),
          assigner:profiles!assigned_by(name)
        `)
        .or(`and(status.in.(delivered,cancelled),created_at.gte.${fetchStart}),and(status.eq.delivered,payment_status.eq.unpaid)`)

      if (courierId) finalQuery = finalQuery.eq('courier_id', courierId)

      const { data: finalData, error: finalError } = await finalQuery.order('created_at', { ascending: false })
      if (finalError) throw finalError
      const fetchedFinal = (finalData as unknown as Order[]) || []

      // 3. Mirror finalized orders to local DB
      const { bulkMoveToLocalDB } = await import('@/lib/orderCache')
      await bulkMoveToLocalDB(fetchedFinal)

      // 4. Update Weekly Sync Metadata
      if (isWeeklyNeeded) {
        saveWeeklySyncTime(courierId)
      }

      // 5. Final state update
      set(state => {
         const newOrders = [...state.orders];
         fetchedFinal.forEach(o => {
           if (!newOrders.some(existing => existing.id === o.id)) {
             newOrders.push(o as unknown as Order);
           }
         });
         return {
           activeOrdersByCourier: fetchedActive,
           orders: newOrders.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
         }
      })
      
    } catch (error) {
      console.error('fetchInitialOrders error:', error)
    } finally {
      set({ isSyncing: false, isLoading: false })
      window.dispatchEvent(new CustomEvent('indexeddb-synced'))
    }
  },

  // ------------------------------------------------------------------
  // SUBSCRIPTIONS — delegated to orderStoreSubscriptions.ts
  // Factory functions receive (set, get) to avoid circular deps.
  // ------------------------------------------------------------------
  resyncRealtime: createResyncRealtime(set, get),
  subscribeOrders: createSubscribeOrders(set, get),
  unsubscribeOrders: createUnsubscribeOrders(set, get),
  subscribeOrderById: createSubscribeOrderById(set, get),
  unsubscribeOrderById: createUnsubscribeOrderById(set, get),
  pingRealtime: createPingRealtime(),

  // ------------------------------------------------------------------
  // ACTIONS — delegated to orderStoreActions.ts
  // Factory functions receive (set, get) to avoid circular deps.
  // ------------------------------------------------------------------
  addOrder: createAddOrder(set, get),
  updateOrderStatus: createUpdateOrderStatus(set, get),
  cancelOrder: createCancelOrder(set, get),
  updateOrder: createUpdateOrder(set, get),
  updateBiayaTambahan: createUpdateBiayaTambahan(set, get),
  updateItemBarang: createUpdateItemBarang(set, get),
  updateOrderField: createUpdateOrderField(set, get),
  settleOrder: createSettleOrder(set, get),
  updateItems: createUpdateItems(set, get),
  updateOngkir: createUpdateOngkir(set, get),
  updateOrderWaiting: createUpdateOrderWaiting(set, get),
}))
