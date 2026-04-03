import { create } from 'zustand'
import { supabase } from '@/lib/supabaseClient'
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

interface OrderState {
  orders: Order[]
  statusHistory: Record<string, OrderStatusHistory[]>
  isLoading: boolean

  fetchOrdersByCourier: (courierId: string) => Promise<void>
  courierOrders: Order[]
  isFetchingCourierOrders: boolean
  historicalOrders: Order[]
  isFetchingHistory: boolean
  fetchOrdersByDateRange: (start: Date, end: Date) => Promise<Order[]>
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
  
  generateOrderId: () => Promise<string>
  getOrdersByCourier: (courierId: string) => Order[]
  getRecentOrders: (limit?: number) => Order[]
  
  setOrders: (orders: Order[]) => void
  setActiveOrdersByCourier: (orders: Order[]) => void
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

  fetchOrdersByDateRange: async (start: Date, end: Date): Promise<Order[]> => {
    set({ isFetchingHistory: true })
    try {
      const { data: historicalOrders, error } = await supabase
        .from('orders')
        .select('*')
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString())
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
    
    // 1. Load FINAL orders from Cache for history (Mirroring)
    if (courierId) {
      const cachedFinal = await getOrdersByCourierFromLocal(courierId)
      set({ orders: cachedFinal })
    } else {
      const cachedRecent = await getOrdersForWeek()
      set({ orders: cachedRecent })
    }

    // 2. Clear Active Store if needed
    set({ activeOrdersByCourier: [], isFetchingActiveOrders: true })

    // 3. Fetch ACTIVE orders from Supabase (Strictly Real-time)
    let query = supabase.from('orders').select('*')
    
    if (courierId) {
      query = query.eq('courier_id', courierId)
    }
    
    // Fetch only active statuses from server to save reads
    const activeStatuses = ['pending', 'assigned', 'picked_up', 'in_transit']
    query = query.in('status', activeStatuses)

    const { data: activeData, error } = await query.order('created_at', { ascending: false })
    
    if (error) {
      console.error('Fetch active orders error:', error)
      set({ isFetchingActiveOrders: false })
      return
    }

    const fetchedActive = (activeData as Order[]) || []
    
    set({ 
      activeOrdersByCourier: fetchedActive, 
      isFetchingActiveOrders: false,
      isLoading: false 
    })
  },

  subscribeOrders: (filter) => {
    const { courierId } = filter || {}
    
    const channelId = courierId ? `orders:courier:${courierId}` : 'orders:global'
    const filterStr = courierId ? `courier_id=eq.${courierId}` : undefined

    const channel = supabase.channel(channelId)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: filterStr },
        async (payload) => {
          const { eventType, new: newRec, old: oldRec } = payload
          const order = newRec as Order
          
          // Hybrid Logic: If final state, move to Local DB
          if (eventType === 'UPDATE' || eventType === 'INSERT') {
            const isFinal = ['delivered', 'cancelled'].includes(order.status)
            if (isFinal) {
              await moveToLocalDB(order)
            }
          }

          set((state) => {
            let updatedActive = [...state.activeOrdersByCourier]
            let updatedHistory = [...state.orders]

            if (eventType === 'INSERT') {
              const isNowActive = !['delivered', 'cancelled'].includes(order.status)
              if (isNowActive) {
                updatedActive = [order, ...updatedActive]
              } else {
                updatedHistory = [order, ...updatedHistory]
              }
            } else if (eventType === 'UPDATE') {
              // Handle movement between Active and History slots
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
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  },

  subscribeOrderById: (orderId: string) => {
    const fetchCurrent = async () => {
       const { data } = await supabase.from('orders').select('*').eq('id', orderId).single()
       if (data) set({ currentOrder: data as Order })
    }
    fetchCurrent()

    const channel = supabase.channel(`public:orders:${orderId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` }, (payload) => {
        if (payload.eventType === 'DELETE') {
           set({ currentOrder: null })
        } else {
           set({ currentOrder: payload.new as Order })
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  },

  addOrder: async (order: Order) => {
    const { error } = await (supabase.from('orders') as any).insert(order)
    
    if (error) {
      console.error('Supabase error inserting order:', error)
      throw new Error(error.message || 'Gagal menyimpan order ke database')
    }
    
    set(state => ({ orders: [order, ...state.orders] }))

    sendMockNotification(
      'Order Baru Masuk!',
      `Order ${order.order_number} sebesar Rp ${order.total_fee.toLocaleString('id-ID')} menunggumu!`,
      { orderId: order.id }
    )
  },

  updateOrderStatus: async (orderId, status, userId, userName, notes) => {
    const order = get().orders.find(o => o.id === orderId)
      || get().currentOrder
      || get().activeOrdersByCourier.find(o => o.id === orderId)
      
    if (!order) return

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

      const newHistory: OrderStatusHistory = {
        id: crypto.randomUUID(),
        order_id: orderId,
        status,
        changed_by: userId,
        changed_by_name: userName,
        changed_at: new Date().toISOString(),
        notes: notes || ''
      }
      
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

      const currentHistory = get().statusHistory[orderId] || []
      set(state => ({
        statusHistory: {
          ...state.statusHistory,
          [orderId]: [...currentHistory, newHistory]
        }
      }))
    }
  },

  assignCourier: async (orderId, courierId, courierName, userId, userName) => {
    const { error } = await (supabase.from('orders') as any)
      .update({ 
        status: 'assigned', 
        courier_id: courierId,
        assigned_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId)

    if (error) throw error

    await get().updateOrderStatus(orderId, 'assigned', userId, userName, `Assigned to ${courierName}`)
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

  generateOrderId: async () => {
    const now = new Date()
    const DD = String(now.getDate()).padStart(2, '0')
    const MM = String(now.getMonth() + 1).padStart(2, '0')
    const YY = String(now.getFullYear()).slice(-2)
    const prefix = `P${DD}${MM}${YY}`
    
    // Count directly from Supabase for all orders today (using prefix match)
    // we use await inside the async function
    const { count, error } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .ilike('order_number', `${prefix}%`)
      
    if (error) {
      console.error('Error generating order ID:', error)
      // Fallback: randomized suffix to avoid collision if DB check fails
      const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
      return `${prefix}${random}`
    }
    
    return `${prefix}${String((count ?? 0) + 1).padStart(3, '0')}`
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
