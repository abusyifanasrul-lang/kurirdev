import { create } from 'zustand'
import { supabase } from '@/lib/supabaseClient'
import { Order, OrderStatus, OrderStatusHistory } from '@/types'
import { sendMockNotification } from '@/utils/notification'
import { useSettingsStore } from '@/stores/useSettingsStore'
import {
  moveToLocalDB,
  markAsPaidInLocalDB
} from '@/lib/orderCache'

interface OrderState {
  orders: Order[]
  statusHistory: Record<string, OrderStatusHistory[]>
  isLoading: boolean

  fetchOrdersByCourier: (courierId: string) => Promise<void>
  courierOrders: Order[]
  isFetchingCourierOrders: boolean
  historicalOrders: Order[]
  isFetchingHistory: boolean
  fetchOrdersByDateRange: (start: Date, end: Date) => Promise<void>
  activeOrdersByCourier: Order[]
  isFetchingActiveOrders: boolean
  currentOrder: Order | null
  fetchActiveOrdersByCourier: (courierId: string) => Promise<void>
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
  setOrders: (orders: Order[]) => void
  setActiveOrdersByCourier: (orders: Order[]) => void
  reset: () => void

  generateOrderId: () => string
  getOrdersByCourier: (courierId: string) => Order[]
  getRecentOrders: (limit?: number) => Order[]
}

export const useOrderStore = create<OrderState>()((set, get) => ({
  orders: [],
  courierOrders: [],
  historicalOrders: [],
  statusHistory: {},
  isLoading: true,
  isFetchingCourierOrders: false,
  isFetchingHistory: false,
  activeOrdersByCourier: [],
  isFetchingActiveOrders: false,
  currentOrder: null,

  fetchOrdersByCourier: async (courierId) => {
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

  fetchOrdersByDateRange: async (start, end) => {
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
    } catch (error) {
      console.error('fetchOrdersByDateRange error:', error)
      set({ isFetchingHistory: false })
    }
  },

  fetchActiveOrdersByCourier: async (courierId) => {
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

  subscribeOrderById: (orderId) => {
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

  addOrder: async (order) => {
    const { error } = await supabase.from('orders').insert(order)
    
    if (error) {
      console.error('Supabase error inserting order:', error)
      throw new Error(error.message || 'Gagal menyimpan order ke database')
    }
    
    // Optimistically add to list
    set(state => ({ orders: [order, ...state.orders] }))

    // Push Notif might be triggered via edge function instead in proper prod schema, but keep mock for now
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

    // If delivered, use atomic RPC to calculate and deduct earnings securely
    if (status === 'delivered') {
      const { commission_rate, commission_threshold } = useSettingsStore.getState()
      
      const { error } = await supabase.rpc('complete_order', {
         p_order_id: orderId,
         p_user_id: userId,
         p_user_name: userName,
         p_notes: notes || '',
         p_commission_rate: commission_rate,
         p_commission_threshold: commission_threshold
      })
      
      if (error) {
         console.error('Complete order RPC error:', error)
         throw error
      }
      
      // Update local cache
      const updatedOrder = { ...order, status: 'delivered', is_waiting: false, applied_commission_rate: commission_rate, applied_commission_threshold: commission_threshold, actual_delivery_time: new Date().toISOString() }
      moveToLocalDB(updatedOrder as Order).catch(err => console.error('Mirror write error:', err))

    } else {
      // Normal Status Update logic
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

      const { error: updateError } = await supabase.from('orders').update(updates).eq('id', orderId)
      if (updateError) throw updateError

      // Insert tracking log
      const newHistory: OrderStatusHistory = {
        id: crypto.randomUUID(),
        order_id: orderId,
        status,
        changed_by: userId,
        changed_by_name: userName,
        changed_at: new Date().toISOString(),
        notes: notes || ''
      }
      
      await supabase.from('tracking_logs').insert(newHistory)

      // Mirror write ke IndexedDB
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
    // We update order first, then status
    await supabase.from('orders').update({
      courier_id: courierId,
      assigned_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }).eq('id', orderId)

    await get().updateOrderStatus(orderId, 'assigned', userId, userName, `Assigned to ${courierName}`)
  },

  cancelOrder: async (orderId, reason, userId, userName, cancelReasonType) => {
    // updateOrderStatus handles log insertion and local DB mirroring.
    // We do explicit updates here for specific cancellation reason types.
    await supabase.from('orders').update({
      cancellation_reason: reason,
      cancel_reason_type: cancelReasonType ?? null,
      cancelled_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }).eq('id', orderId)

    await get().updateOrderStatus(orderId, 'cancelled', userId, userName, reason)
  },

  updateOrder: async (orderId, updates) => {
    if (updates.payment_status === 'paid') {
        const { error: rpcError } = await supabase.rpc('mark_order_paid', { p_order_id: orderId })
        if (rpcError) throw rpcError
        
        const { payment_status, ...restUpdates } = updates as any
        if (Object.keys(restUpdates).length > 0) {
           await supabase.from('orders').update({ ...restUpdates, updated_at: new Date().toISOString() }).eq('id', orderId)
        }
        
        // Mirror write ke IndexedDB
        markAsPaidInLocalDB(orderId).catch(err => console.error('Mirror paid error:', err))
    } else {
       await supabase.from('orders').update({
         ...updates,
         updated_at: new Date().toISOString()
       }).eq('id', orderId)
    }
  },
  
  updateBiayaTambahan: async (orderId, titik, beban) => {
    const total_biaya_titik = titik * 3000;
    const total_biaya_beban = beban.reduce((sum, b) => sum + b.biaya, 0);
    await supabase.from('orders').update({
      titik,
      total_biaya_titik,
      beban,
      total_biaya_beban,
      updated_at: new Date().toISOString()
    }).eq('id', orderId)
  },

  updateItemBarang: async (orderId, itemName, itemPrice) => {
    await supabase.from('orders').update({
      item_name: itemName,
      item_price: itemPrice,
      updated_at: new Date().toISOString()
    }).eq('id', orderId);
  },

  updateItems: async (orderId, items) => {
    await supabase.from('orders').update({
      items,
      updated_at: new Date().toISOString()
    }).eq('id', orderId);
  },

  updateOngkir: async (orderId, totalFee) => {
    await supabase.from('orders').update({
      total_fee: totalFee,
      updated_at: new Date().toISOString()
    }).eq('id', orderId);
  },

  updateOrderWaiting: async (orderId, isWaiting) => {
    await supabase.from('orders').update({
      is_waiting: isWaiting,
      updated_at: new Date().toISOString()
    }).eq('id', orderId);
  },

  generateOrderId: () => {
    const now = new Date()
    const DD = String(now.getDate()).padStart(2, '0')
    const MM = String(now.getMonth() + 1).padStart(2, '0')
    const YY = String(now.getFullYear()).slice(-2)
    const dateKey = `${DD}${MM}${YY}` 
    const todayOrders = get().orders.filter(o => o.order_number.startsWith(`P${dateKey}`))
    return `P${dateKey}${String(todayOrders.length + 1).padStart(3, '0')}` 
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
