import { create } from 'zustand'
import { db } from '@/lib/firebase'
import {
  collection, doc, setDoc, updateDoc,
  onSnapshot, increment, getDocs, query, where, orderBy
} from 'firebase/firestore'
import { Order, OrderStatus, OrderStatusHistory } from '@/types'
import { sendMockNotification } from '@/utils/notification'
import { useSettingsStore } from '@/stores/useSettingsStore'
import { calcCourierEarning } from '@/lib/calcEarning'

interface OrderState {
  orders: Order[]
  statusHistory: Record<string, OrderStatusHistory[]>
  isLoading: boolean

  subscribeOrders: () => () => void
  subscribeActiveOrders: () => () => void
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
  fetchAllActiveOrders: () => Promise<void>
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

  subscribeOrders: () => {
    const unsub = onSnapshot(collection(db, 'orders'), (snapshot) => {
      const orders = snapshot.docs.map(d => d.data() as Order)
      set({ orders, isLoading: false })
    })
    return unsub
  },

  subscribeActiveOrders: () => {
    const q = query(
      collection(db, 'orders'),
      where('status', 'not-in', ['delivered', 'cancelled'])
    )
    const unsub = onSnapshot(q, (snapshot) => {
      const orders = snapshot.docs.map(d => d.data() as Order)
      set({ orders, isLoading: false })
    })
    return unsub
  },

  fetchOrdersByCourier: async (courierId) => {
    set({ isFetchingCourierOrders: true })
    try {
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
      const q = query(
        collection(db, 'orders'),
        where('courier_id', '==', courierId),
        where('status', 'in', ['delivered', 'cancelled']),
        orderBy('created_at', 'desc')
      )
      const snapshot = await getDocs(q)
      const allOrders = snapshot.docs.map(d => d.data() as Order)
      const courierOrders = allOrders.filter(o => new Date(o.created_at) >= sevenDaysAgo)
      set({ courierOrders, isFetchingCourierOrders: false })
    } catch (error) {
      console.error('fetchOrdersByCourier error:', error)
      set({ isFetchingCourierOrders: false })
    }
  },

  fetchOrdersByDateRange: async (start, end) => {
    set({ isFetchingHistory: true })
    try {
      const q = query(
        collection(db, 'orders'),
        where('created_at', '>=', start.toISOString()),
        where('created_at', '<=', end.toISOString()),
        orderBy('created_at', 'desc')
      )
      const snapshot = await getDocs(q)
      const historicalOrders = snapshot.docs.map(d => d.data() as Order)
      set({ historicalOrders, isFetchingHistory: false })
    } catch (error) {
      console.error('fetchOrdersByDateRange error:', error)
      set({ isFetchingHistory: false })
    }
  },

  fetchActiveOrdersByCourier: async (courierId) => {
    set({ isFetchingActiveOrders: true })
    try {
      const q = query(
        collection(db, 'orders'),
        where('courier_id', '==', courierId),
        where('status', 'in', ['assigned', 'picked_up', 'in_transit'])
      )
      const snapshot = await getDocs(q)
      const activeOrdersByCourier = snapshot.docs.map(d => d.data() as Order)
      set({ activeOrdersByCourier, isFetchingActiveOrders: false })
    } catch (error) {
      console.error('fetchActiveOrdersByCourier error:', error)
      set({ isFetchingActiveOrders: false })
    }
  },

  fetchAllActiveOrders: async () => {
    try {
      const q = query(
        collection(db, 'orders'),
        where('status', 'not-in', ['delivered', 'cancelled'])
      )
      const snapshot = await getDocs(q)
      const orders = snapshot.docs.map(d => d.data() as Order)
      set({ orders, isLoading: false })
    } catch (error) {
      console.error('fetchAllActiveOrders error:', error)
    }
  },

  subscribeOrderById: (orderId) => {
    const unsub = onSnapshot(doc(db, 'orders', orderId), (snapshot) => {
      if (snapshot.exists()) {
        set({ currentOrder: snapshot.data() as Order })
      } else {
        set({ currentOrder: null })
      }
    })
    return unsub
  },

  addOrder: async (order) => {
    await setDoc(doc(db, 'orders', order.id), order)
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

    const updates: Partial<Order> = {
      status,
      updated_at: new Date().toISOString()
    }

    if (status === 'picked_up' && !order.actual_pickup_time) {
      updates.actual_pickup_time = new Date().toISOString()
    } else if (status === 'delivered' && !order.actual_delivery_time) {
      updates.actual_delivery_time = new Date().toISOString()
    }

    if (status === 'delivered' || status === 'cancelled') {
      updates.is_waiting = false
    }

    if (status === 'delivered') {
      const { commission_rate, commission_threshold } = useSettingsStore.getState()
      updates.applied_commission_rate = commission_rate
      updates.applied_commission_threshold = commission_threshold

      if (order.courier_id) {
        const courierEarning = calcCourierEarning(order, { commission_rate, commission_threshold })
        await updateDoc(doc(db, 'users', order.courier_id), {
          total_deliveries_alltime: increment(1),
          total_earnings_alltime: increment(courierEarning),
          unpaid_count: increment(1),
          unpaid_amount: increment(courierEarning),
          updated_at: new Date().toISOString()
        })
      }
    }

    await updateDoc(doc(db, 'orders', orderId), updates)

    const newHistory: OrderStatusHistory = {
      id: crypto.randomUUID(),
      order_id: orderId,
      status,
      changed_by: userId,
      changed_by_name: userName,
      changed_at: new Date().toISOString(),
      notes
    }

    const currentHistory = get().statusHistory[orderId] || []
    set(state => ({
      statusHistory: {
        ...state.statusHistory,
        [orderId]: [...currentHistory, newHistory]
      }
    }))
    await setDoc(
      doc(db, 'tracking_logs', newHistory.id),
      newHistory
    )
  },

  assignCourier: async (orderId, courierId, courierName, userId, userName) => {
    await get().updateOrderStatus(orderId, 'assigned', userId, userName, `Assigned to ${courierName}`)

    await updateDoc(doc(db, 'orders', orderId), {
      courier_id: courierId,
      assigned_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
  },

  cancelOrder: async (orderId, reason, userId, userName, cancelReasonType) => {
    await get().updateOrderStatus(orderId, 'cancelled', userId, userName, reason)
    await updateDoc(doc(db, 'orders', orderId), {
      cancellation_reason: reason,
      cancel_reason_type: cancelReasonType ?? null,
      cancelled_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
  },

  updateOrder: async (orderId, updates) => {
    if (updates.payment_status === 'paid') {
      const order = get().orders.find(o => o.id === orderId)
      if (order && order.payment_status === 'unpaid' && order.courier_id) {
        const { commission_rate, commission_threshold } = useSettingsStore.getState()
        const courierEarning = calcCourierEarning(order, { commission_rate, commission_threshold })
        await updateDoc(doc(db, 'users', order.courier_id), {
          unpaid_count: increment(-1),
          unpaid_amount: increment(-courierEarning),
          updated_at: new Date().toISOString()
        })
      }
    }
    await updateDoc(doc(db, 'orders', orderId), {
      ...updates,
      updated_at: new Date().toISOString()
    })
  },
  updateBiayaTambahan: async (orderId, titik, beban) => {
    const total_biaya_titik = titik * 3000;
    const total_biaya_beban = beban.reduce((sum, b) => sum + b.biaya, 0);
    await updateDoc(doc(db, 'orders', orderId), {
      titik,
      total_biaya_titik,
      beban,
      total_biaya_beban,
      updated_at: new Date().toISOString()
    })
  },

  updateItemBarang: async (orderId, itemName, itemPrice) => {
    await updateDoc(doc(db, 'orders', orderId), {
      item_name: itemName,
      item_price: itemPrice,
      updated_at: new Date().toISOString()
    });
  },

  updateItems: async (orderId, items) => {
    await updateDoc(doc(db, 'orders', orderId), {
      items,
      updated_at: new Date().toISOString()
    });
  },

  updateOngkir: async (orderId, totalFee) => {
    await updateDoc(doc(db, 'orders', orderId), {
      total_fee: totalFee,
      updated_at: new Date().toISOString()
    });
  },

  updateOrderWaiting: async (orderId, isWaiting) => {
    await updateDoc(doc(db, 'orders', orderId), {
      is_waiting: isWaiting,
      updated_at: new Date().toISOString()
    });
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
  }
}))
