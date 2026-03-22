import { useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useUserStore } from '@/stores/useUserStore'
import { useOrderStore } from '@/stores/useOrderStore'
import { useNotificationStore } from '@/stores/useNotificationStore'
import { collection, query, where,
         orderBy, limit, onSnapshot }
  from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { Order } from '@/types'

export function AppListeners() {
  const { user } = useAuth()
  const subscribeUsers = useUserStore(
    state => state.subscribeUsers
  )
  const initQueuePositions = useUserStore(
    state => state.initQueuePositions
  )
  const subscribeAllNotifications =
    useNotificationStore(
      state => state.subscribeAllNotifications
    )

  useEffect(() => {
    // Semua user butuh subscribeUsers
    // (untuk cek suspended, data kurir, dll)
    const unsubUsers = subscribeUsers()

    setTimeout(() => {
      initQueuePositions().catch(console.error)
    }, 2000)

    return () => unsubUsers()
  }, [])

  useEffect(() => {
    // Hanya Admin yang butuh subscribeOrders
    if (!user || user.role !== 'admin') return

    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    // Query 1: order hari ini
    const unsubToday = onSnapshot(
      query(
        collection(db, 'orders'),
        where('created_at', '>=', todayStart.toISOString()),
        orderBy('created_at', 'desc'),
        limit(100)
      ),
      (snapshot) => {
        const todayOrders = snapshot.docs.map(d => d.data() as Order)
        // merge ke store
        const current = useOrderStore.getState().orders
        const activeIds = new Set(
          current
            .filter(o => !['delivered', 'cancelled'].includes(o.status))
            .map(o => o.id)
        )
        const merged = [
          ...todayOrders,
          ...current.filter(o =>
            activeIds.has(o.id) &&
            !todayOrders.find(t => t.id === o.id)
          )
        ]
        useOrderStore.getState().setOrders(merged)
      }
    )

    // Query 2: order aktif (belum selesai)
    // tanpa filter tanggal — tangkap order lama yang masih aktif
    const unsubActive = onSnapshot(
      query(
        collection(db, 'orders'),
        where('status', 'not-in', ['delivered', 'cancelled']),
        limit(50)
      ),
      (snapshot) => {
        const activeOrders = snapshot.docs.map(d => d.data() as Order)
        const current = useOrderStore.getState().orders
        const merged = [
          ...activeOrders,
          ...current.filter(o =>
            !activeOrders.find(a => a.id === o.id)
          )
        ]
        useOrderStore.getState().setOrders(merged)
      }
    )

    return () => {
      unsubToday()
      unsubActive()
    }
  }, [user?.id])

  useEffect(() => {
    if (!user || user.role !== 'admin') return
    const unsub = subscribeAllNotifications()
    return () => unsub()
  }, [user?.id])

  return null
}
