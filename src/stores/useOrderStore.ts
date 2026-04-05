import { create } from 'zustand'
import { supabase } from '@/lib/supabaseClient'
import { withRetry } from '@/utils/retry'
import { useToastStore } from '@/stores/useToastStore'
import { Order, OrderStatus, OrderStatusHistory } from '@/types'
import { 
  moveToLocalDB, 
  removeFromLocalDB, 
  getOrdersForWeek, 
  getOrdersByCourierFromLocal, 
  markAsPaidInLocalDB 
} from '@/lib/orderCache'
import { sendMockNotification } from '@/utils/notification'
import { useSettingsStore } from '@/stores/useSettingsStore'
import { logger } from '@/lib/logger'

// Module-level tracker for active channels to prevent redundant subscriptions
const activeChannels = new Map<string, any>()

interface OrderState {
  orders: Order[]
  statusHistory: Record<string, OrderStatusHistory[]>
  isLoading: boolean

  fetchOrdersByCourier: (courierId: string) => Promise<void>
  courierOrders: Order[]
  isFetchingCourierOrders: boolean
  historicalOrders: Order[]
  isFetchingHistory: boolean
  fetchOrdersByDateRange: (start: Date, end: Date, courierId?: string) => Promise<Order[]>
  activeOrdersByCourier: Order[]
  isFetchingActiveOrders: boolean
  currentOrder: Order | null
  fetchActiveOrdersByCourier: (courierId: string) => Promise<void>
  
  // Realtime "oneSnapshot" pattern
  fetchInitialOrders: (filter?: { courierId?: string; activeOnly?: boolean }) => Promise<void>
  subscribeOrders: (filter?: { courierId?: string; activeOnly?: boolean }) => () => void
  subscribeOrderById: (orderId: string) => () => void
  
  addOrder: (order: Order) => Promise<void>
  updateOrderStatus: (orderId: string, status: OrderStatus, userId: string, userName: string, notes?: string) => Promise<void>
  assignCourier: (orderId: string, courierId: string, courierName: string, userId: string, userName: string) => Promise<void>
  cancelOrder: (orderId: string, reason: string, userId: string, userName: string, cancelReasonType?: string) => Promise<void>
  updateOrder: (orderId: string, updates: Partial<Order>) => Promise<void>
  updateBiayaTambahan: (orderId: string, titik: number, beban: { nama: string; biaya: number }[]) => Promise<void>
  updateItemBarang: (orderId: string, itemName: string, itemPrice: number) => Promise<void>
  updateItems: (orderId: string, items: { nama: string; harga: number }[]) => Promise<void>
  updateOngkir: (orderId: string, totalFee: number) => Promise<void>
  updateOrderWaiting: (orderId: string, isWaiting: boolean) => Promise<void>
  updateOrderField: (orderId: string, field: string, value: any) => Promise<void>
  
  getOrdersByCourier: (courierId: string) => Order[]
  getRecentOrders: (limit?: number) => Order[]
  
  setOrders: (orders: Order[]) => void
  setActiveOrdersByCourier: (orders: Order[]) => void
  isSyncingOrders: Set<string>
  setSyncing: (orderId: string, isSyncing: boolean) => void
  reset: () => void
}

export const useOrderStore = create<OrderState>()((set, get) => ({
  orders: [],
  courierOrders: [],
  historicalOrders: [],
  statusHistory: {},
  isLoading: false,
  isFetchingCourierOrders: false,
  isFetchingHistory: false,
  activeOrdersByCourier: [],
  isFetchingActiveOrders: false,
  currentOrder: null,
  isSyncingOrders: new Set(),

  setSyncing: (orderId, isSyncing) => set((state) => {
    const next = new Set(state.isSyncingOrders)
    if (isSyncing) next.add(orderId)
    else next.delete(orderId)
    return { isSyncingOrders: next }
  }),

  fetchOrdersByCourier: async (courierId: string) => {
    set({ isFetchingCourierOrders: true })
    try {
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
      
      const { data: allOrders, error } = await supabase
        .from('orders')
        .select('*')
        .eq('courier_id', courierId)
        .in('status', ['delivered', 'cancelled'])
        .gte('created_at', sevenDaysAgo.toISOString())
        .order('created_at', { ascending: false })

      if (error) throw error

      set({ courierOrders: allOrders as Order[], isFetchingCourierOrders: false })
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
        .select('*')
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString())

      if (courierId) {
        query = query.eq('courier_id', courierId)
      }

      const { data: historicalOrders, error } = await query
        .order('created_at', { ascending: false })

      if (error) throw error
      set({ historicalOrders: historicalOrders as Order[], isFetchingHistory: false })
      return (historicalOrders as Order[]) || []
    } catch (error) {
      console.error('fetchOrdersByDateRange error:', error)
      set({ isFetchingHistory: false })
      return []
    }
  },

  fetchActiveOrdersByCourier: async (courierId: string) => {
    set({ isFetchingActiveOrders: true })
    try {
      const { data: activeOrdersByCourier, error } = await supabase
        .from('orders')
        .select('*')
        .eq('courier_id', courierId)
        .in('status', ['assigned', 'picked_up', 'in_transit'])
        
      if (error) throw error
      set({ activeOrdersByCourier: activeOrdersByCourier as Order[], isFetchingActiveOrders: false })
    } catch (error) {
      console.error('fetchActiveOrdersByCourier error:', error)
      set({ isFetchingActiveOrders: false })
    }
  },

  fetchInitialOrders: async (filter) => {
    const { courierId } = filter || {}
    set({ isLoading: true })
    
    // 1. LATEST MIRROR LOAD (Optimistic)
    // Prefer cache for history to avoid heavy initial reads
    if (courierId) {
      const cached = await getOrdersByCourierFromLocal(courierId)
      if (cached.length > 0) {
        set({ orders: cached })
      }
    } else {
      const cached = await getOrdersForWeek()
      if (cached.length > 0) {
        set({ orders: cached })
      }
    }

    // 2. Clear/Fetch Active Stores (Strictly Real-time)
    set({ activeOrdersByCourier: [], isFetchingActiveOrders: true })

    try {
      let query = supabase.from('orders').select('*')
      if (courierId) query = query.eq('courier_id', courierId)
      
      // Fetch active statuses from server to save reads
      const activeStatuses = ['pending', 'assigned', 'picked_up', 'in_transit']
      query = query.in('status', activeStatuses)

      const { data: activeData, error } = await query.order('created_at', { ascending: false })
      
      if (error) throw error

      const fetchedActive = (activeData as Order[]) || []
      
      // Mirror active orders to local DB for offline access
      for (const order of fetchedActive) {
        await moveToLocalDB(order)
      }

      set({ 
        activeOrdersByCourier: fetchedActive, 
        isFetchingActiveOrders: false,
        isLoading: false 
      })
    } catch (error) {
      console.error('fetchInitialOrders error:', error)
      set({ isFetchingActiveOrders: false, isLoading: false })
    }
  },

  subscribeOrders: (filter) => {
    const { courierId } = filter || {}
    
    const channelId = courierId ? `orders:courier:${courierId}` : 'orders:global'
    const filterStr = courierId ? `courier_id=eq.${courierId}` : undefined

    // Deduplication check: if a channel for this ID already exists, don't create a new one
    if (activeChannels.has(channelId)) {
      console.log(`♻️ Reusing existing realtime channel for ${channelId}`)
      return () => {
        // We don't remove if it's shared to avoid breaking other listeners
        // In a more complex app, we'd use reference counting
      }
    }

    const channel = supabase.channel(channelId)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: filterStr },
        async (payload) => {
          const { eventType, new: newRec, old: oldRec } = payload
          
          // MIRRORING ARCHITECTURE: Every change goes to localDB
          if (eventType === 'UPDATE' || eventType === 'INSERT') {
            await moveToLocalDB(newRec as Order, eventType === 'UPDATE')
          }

          set((state) => {
            let updatedActive = [...state.activeOrdersByCourier]
            let updatedHistory = [...state.orders]

            if (eventType === 'INSERT') {
              const order = newRec as Order
              const isNowActive = !['delivered', 'cancelled'].includes(order.status)
              if (isNowActive) {
                updatedActive = [order, ...updatedActive]
              } else {
                updatedHistory = [order, ...updatedHistory]
              }
            } else if (eventType === 'UPDATE') {
              const orderId = (newRec as Order).id
              const existingActive = updatedActive.find(o => o.id === orderId)
              const existingHistory = updatedHistory.find(o => o.id === orderId)
              
              // MERGE partial data
              let order: Order
              if (existingActive) {
                order = { ...existingActive }
                Object.keys(newRec).forEach(k => { if (newRec[k] !== undefined) (order as any)[k] = newRec[k] })
              } else if (existingHistory) {
                order = { ...existingHistory }
                Object.keys(newRec).forEach(k => { if (newRec[k] !== undefined) (order as any)[k] = newRec[k] })
              } else {
                // If not in state, treat as full new mapping (unlikely but safe)
                order = newRec as Order
              }

              const wasActive = updatedActive.some(o => o.id === order.id)
              const isNowActive = !['delivered', 'cancelled'].includes(order.status)

              if (wasActive && !isNowActive) {
                // Move from Active to History
                updatedActive = updatedActive.filter(o => o.id !== order.id)
                updatedHistory = [order, ...updatedHistory]
              } else if (isNowActive) {
                // Update in Active
                const idx = updatedActive.findIndex(o => o.id === order.id)
                if (idx !== -1) updatedActive[idx] = order
                else updatedActive = [order, ...updatedActive]
              } else {
                // Update in History
                const idx = updatedHistory.findIndex(o => o.id === order.id)
                if (idx !== -1) updatedHistory[idx] = order
              }
            } else if (eventType === 'DELETE') {
              updatedActive = updatedActive.filter(o => o.id !== oldRec.id)
              updatedHistory = updatedHistory.filter(o => o.id !== oldRec.id)
              removeFromLocalDB(oldRec.id)
            }

            return { 
              activeOrdersByCourier: updatedActive,
              orders: updatedHistory
            }
          })
        }
      )
      .subscribe((status, err) => {
        if (status === 'CHANNEL_ERROR') {
          console.error(`❌ Realtime subscription failed for ${channelId}:`, err)
          logger.error(`Realtime subscription error for ${channelId}`, err)
          activeChannels.delete(channelId)
        } else if (status === 'SUBSCRIBED') {
          console.log(`✅ Realtime subscription active for ${channelId}`)
          activeChannels.set(channelId, channel)
        }
      })

    return () => {
      supabase.removeChannel(channel)
      activeChannels.delete(channelId)
    }
  },

  subscribeOrderById: (orderId: string) => {
    const fetchCurrent = async () => {
       const { data } = await supabase.from('orders').select('*').eq('id', orderId).single()
       if (data) set({ currentOrder: data as Order })
    }
    fetchCurrent()

    const channelId = `order:single:${orderId}`

    if (activeChannels.has(channelId)) {
      console.log(`♻️ Reusing existing realtime channel for ${channelId}`)
      return () => {}
    }

    const channel = supabase.channel(channelId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` }, (payload) => {
        if (payload.eventType === 'DELETE') {
           set({ currentOrder: null })
        } else if (payload.eventType === 'UPDATE') {
           const existing = get().currentOrder
           if (existing && existing.id === orderId) {
             const merged = JSON.parse(JSON.stringify(existing)) // deep clone for safety
             Object.keys(payload.new).forEach(k => { if (payload.new[k] !== undefined) (merged as any)[k] = payload.new[k] })
             set({ currentOrder: merged as Order })
           } else {
             set({ currentOrder: payload.new as Order })
           }
        } else {
           set({ currentOrder: payload.new as Order })
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          activeChannels.set(channelId, channel)
        }
      })

    return () => {
      supabase.removeChannel(channel)
      activeChannels.delete(channelId)
    }
  },

  addOrder: async (orderData: any) => {
    const addToast = useToastStore.getState().addToast
    const removeToast = useToastStore.getState().removeToast
    let retryToastId: string | undefined

    try {
      await withRetry(async () => {
        // 1. Generate Order Number via RPC (Atomic & Daily Reset)
        const { data: orderNumber, error: rpcError } = await supabase.rpc('generate_order_number')
        
        if (rpcError) throw rpcError

        // 2. Insert with the atomic number
        const finalOrderData = {
          ...orderData,
          order_number: orderNumber
        }

        const { data, error } = await (supabase.from('orders') as any)
          .insert(finalOrderData)
          .select()
          .single()
        
        if (error) throw error
        
        const newOrder = data as Order
        set(state => ({ orders: [newOrder, ...state.orders] }))

        sendMockNotification(
          'Order Baru Masuk!',
          `Order ${newOrder.order_number} sebesar Rp ${newOrder.total_fee.toLocaleString('id-ID')} menunggumu!`,
          { orderId: newOrder.id }
        )
      }, {
        onRetry: (attempt) => {
          if (!retryToastId) {
            retryToastId = addToast(`Koneksi tidak stabil. Mencoba kembali... (Sisa ${3 - attempt} percobaan)`, 'loading', 0)
          } else {
            useToastStore.getState().updateToast(retryToastId, {
              message: `Mencoba kembali... (Sisa ${3 - attempt} percobaan)`
            })
          }
        }
      })
    } catch (error: any) {
      throw new Error(error.message || 'Gagal menyimpan order setelah beberapa kali mencoba. Silakan cek koneksi internet Anda.')
    } finally {
      if (retryToastId) removeToast(retryToastId)
    }
  },

  updateOrderStatus: async (orderId, status, userId, userName, notes) => {
    const isSyncing = get().isSyncingOrders.has(orderId)
    if (isSyncing) return // Prevent duplicate syncs while one is in progress

    const order = get().orders.find(o => o.id === orderId)
      || get().currentOrder
      || get().activeOrdersByCourier.find(o => o.id === orderId)
      
    if (!order) return
    if (order.status === status) return // Already updated

    const setSyncing = get().setSyncing
    const addToast = useToastStore.getState().addToast
    const removeToast = useToastStore.getState().removeToast
    let retryToastId: string | undefined

    setSyncing(orderId, true)

    try {
      await withRetry(async () => {
        if (status === 'delivered') {
          const { commission_rate, commission_threshold } = useSettingsStore.getState()
          
          await (supabase.from('tracking_logs') as any).insert({
            order_id: orderId,
            status,
            changed_by: userId,
            changed_by_name: userName,
            notes: notes || ''
          })
          
          const { error } = await (supabase.rpc as any)('complete_order', {
             p_order_id: orderId,
             p_user_id: userId,
             p_user_name: userName,
             p_notes: notes || '',
             p_commission_rate: commission_rate,
             p_commission_threshold: commission_threshold
          })
          
          if (error) throw error
          
          const updatedOrder = { 
            ...order, 
            status: 'delivered', 
            is_waiting: false, 
            applied_commission_rate: commission_rate, 
            applied_commission_threshold: commission_threshold, 
            actual_delivery_time: new Date().toISOString() 
          }
          moveToLocalDB(updatedOrder as Order).catch(err => console.error('Mirror write error:', err))

        } else {
          const updates: Partial<Order> = {
            status,
            updated_at: new Date().toISOString()
          }

          if (status === 'picked_up' && !order.actual_pickup_time) {
            updates.actual_pickup_time = new Date().toISOString()
          }

          if (status === 'cancelled') {
            updates.is_waiting = false
            updates.cancelled_at = new Date().toISOString()
            updates.cancellation_reason = notes || ''
          }

          const { error: updateError } = await (supabase.from('orders') as any).update(updates).eq('id', orderId)
          if (updateError) throw updateError

          await (supabase.from('tracking_logs') as any).insert({
            order_id: orderId,
            status,
            changed_by: userId,
            changed_by_name: userName,
            notes: notes || ''
          })

          if (status === 'cancelled') {
            const updatedOrder = { ...order, ...updates }
            moveToLocalDB(updatedOrder as Order).catch(err => console.error('Mirror write error:', err))
          }

          // Optimistic local state update
          set(state => ({
            orders: state.orders.map(o => o.id === orderId ? { ...o, ...updates } : o),
            activeOrdersByCourier: state.activeOrdersByCourier.map(o => o.id === orderId ? { ...o, ...updates } : o)
          }))
        }
      }, {
        onRetry: (attempt) => {
          if (!retryToastId) {
            retryToastId = addToast(`Gagal sinkronasi... Mencoba kembali (${attempt}/3)`, 'loading', 0)
          } else {
            useToastStore.getState().updateToast(retryToastId, {
              message: `Sinkronasi status ${status}... (${attempt}/3)`
            })
          }
        }
      })
    } catch (error: any) {
      addToast(`Gagal memperbarui status order: ${error.message}`, 'error', 5000)
    } finally {
      setSyncing(orderId, false)
      if (retryToastId) removeToast(retryToastId)
    }
  },

  assignCourier: async (orderId, courierId, courierName, userId, userName) => {
    const addToast = useToastStore.getState().addToast
    const removeToast = useToastStore.getState().removeToast
    let retryToastId: string | undefined

    try {
      await withRetry(async () => {
        const { error } = await (supabase.from('orders') as any)
          .update({ 
            status: 'assigned', 
            courier_id: courierId,
            assigned_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', orderId)

        if (error) throw error
 
        // 2. Insert Tracking Log
        await (supabase.from('tracking_logs') as any).insert({
          order_id: orderId,
          status: 'assigned',
          changed_by: userId,
          changed_by_name: userName,
          notes: `Assigned to ${courierName}`
        })
 
        // 3. Optimistic local state update
        set(state => ({
          orders: state.orders.map(o => o.id === orderId ? { 
            ...o, 
            status: 'assigned', 
            courier_id: courierId,
            assigned_at: new Date().toISOString()
          } : o)
        }))
 
        // Mirror write for offline consistency
        const order = get().orders.find(o => o.id === orderId)
        if (order) {
          moveToLocalDB({
            ...order,
            status: 'assigned',
            courier_id: courierId,
            assigned_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }).catch(err => console.error('Mirror write error:', err))
        }
      }, {
        onRetry: (attempt) => {
          if (!retryToastId) {
            retryToastId = addToast(`Gagal menetapkan kurir... Mencoba kembali (${attempt}/3)`, 'loading', 0)
          } else {
            useToastStore.getState().updateToast(retryToastId, {
              message: `Menetapkan ${courierName}... (${attempt}/3)`
            })
          }
        }
      })
    } catch (error: any) {
      addToast(`Gagal menetapkan kurir: ${error.message}`, 'error', 5000)
    } finally {
      if (retryToastId) removeToast(retryToastId)
    }
  },

  cancelOrder: async (orderId, reason, userId, userName, cancelReasonType) => {
    const { error } = await (supabase.from('orders') as any).update({
      cancellation_reason: reason,
      cancel_reason_type: cancelReasonType ?? null,
      cancelled_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }).eq('id', orderId)

    if (error) throw error

    await get().updateOrderStatus(orderId, 'cancelled', userId, userName, reason)
  },

  updateOrder: async (orderId, updates) => {
    if (updates.payment_status === 'paid') {
        const { error: rpcError } = await (supabase.rpc as any)('mark_order_paid', { p_order_id: orderId })
        if (rpcError) throw rpcError
        
        const { payment_status, ...restUpdates } = updates as any
        if (Object.keys(restUpdates).length > 0) {
           await (supabase.from('orders') as any).update({ ...restUpdates, updated_at: new Date().toISOString() }).eq('id', orderId)
        }
        markAsPaidInLocalDB(orderId).catch(err => console.error('Confirm payment error:', err))
    } else {
       await (supabase.from('orders') as any).update({
         ...updates,
         updated_at: new Date().toISOString()
       }).eq('id', orderId)
    }

    // Common optimistic update for any updateOrder call
    set(state => ({
      orders: state.orders.map(o => o.id === orderId ? { ...o, ...updates } : o)
    }))
  },
  
  updateBiayaTambahan: async (orderId, titik, beban) => {
    const total_biaya_titik = titik * 3000;
    const total_biaya_beban = beban.reduce((sum: number, b: any) => sum + b.biaya, 0);
    await (supabase.from('orders') as any).update({
      titik,
      total_biaya_titik,
      beban,
      total_biaya_beban,
      updated_at: new Date().toISOString()
    }).eq('id', orderId)
  },

  updateItemBarang: async (orderId, itemName, itemPrice) => {
    await (supabase.from('orders') as any).update({
      item_name: itemName,
      item_price: itemPrice,
      updated_at: new Date().toISOString()
    }).eq('id', orderId);
  },

  updateOrderField: async (orderId: string, field: string, value: any) => {
    await (supabase.from('orders') as any).update({ [field]: value, updated_at: new Date().toISOString() }).eq('id', orderId)
  },

  updateItems: async (orderId, items) => {
    await (supabase.from('orders') as any).update({
      items,
      updated_at: new Date().toISOString()
    }).eq('id', orderId);
  },

  updateOngkir: async (orderId, totalFee) => {
    await (supabase.from('orders') as any).update({
      total_fee: totalFee,
      updated_at: new Date().toISOString()
    }).eq('id', orderId);
  },

  updateOrderWaiting: async (orderId, isWaiting) => {
    await (supabase.from('orders') as any).update({
      is_waiting: isWaiting,
      updated_at: new Date().toISOString()
    }).eq('id', orderId);
  },


  getOrdersByCourier: (courierId) => {
    return get().orders.filter(o => o.courier_id === courierId)
  },

  getRecentOrders: (limit = 5) => {
    return [...get().orders]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, limit)
  },

  setOrders: (orders: Order[]) => {
    set({ orders, isLoading: false })
  },

  setActiveOrdersByCourier: (orders: Order[]) => {
    set({ activeOrdersByCourier: orders, isFetchingActiveOrders: false })
  },

  reset: () => set({
    orders: [],
    courierOrders: [],
    historicalOrders: [],
    statusHistory: {},
    activeOrdersByCourier: [],
    currentOrder: null,
    isLoading: false
  })
}))
