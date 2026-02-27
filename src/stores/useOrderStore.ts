import { create } from 'zustand'
import { db } from '@/lib/firebase'
import {
  collection, doc, setDoc, updateDoc,
  onSnapshot
} from 'firebase/firestore'
import { Order, OrderStatus, OrderStatusHistory } from '@/types'
import { useNotificationStore } from './useNotificationStore'
import { sendMockNotification } from '@/utils/notification'

interface OrderState {
  orders: Order[]
  statusHistory: Record<string, OrderStatusHistory[]>
  isLoading: boolean

  subscribeOrders: () => () => void
  addOrder: (order: Order) => Promise<void>
  updateOrderStatus: (orderId: string, status: OrderStatus, userId: string, userName: string, notes?: string) => Promise<void>
  assignCourier: (orderId: string, courierId: string, courierName: string, userId: string, userName: string) => Promise<void>
  cancelOrder: (orderId: string, reason: string, userId: string, userName: string) => Promise<void>
  updateOrder: (orderId: string, updates: Partial<Order>) => Promise<void>
  updateBiayaTambahan: (orderId: string, titik: number, beban: { nama: string; biaya: number }[]) => Promise<void>

  generateOrderId: () => string
  getOrdersByCourier: (courierId: string) => Order[]
  getRecentOrders: (limit?: number) => Order[]
}

export const useOrderStore = create<OrderState>()((set, get) => ({
  orders: [],
  statusHistory: {},
  isLoading: true,

  subscribeOrders: () => {
    const unsub = onSnapshot(collection(db, 'orders'), (snapshot) => {
      const orders = snapshot.docs.map(d => d.data() as Order)
      set({ orders, isLoading: false })
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

    const order = get().orders.find(o => o.id === orderId)
    await updateDoc(doc(db, 'orders', orderId), {
      courier_id: courierId,
      assigned_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })

    useNotificationStore.getState().addNotification({
      user_id: courierId,
      user_name: courierName,
      title: 'New Order Assigned',
      body: `Order ${order?.order_number} has been assigned to you.`,
      data: { orderId }
    })
  },

  cancelOrder: async (orderId, reason, userId, userName) => {
    await get().updateOrderStatus(orderId, 'cancelled', userId, userName, reason)
    await updateDoc(doc(db, 'orders', orderId), {
      cancellation_reason: reason,
      cancelled_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
  },

  updateOrder: async (orderId, updates) => {
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
  }
}))
