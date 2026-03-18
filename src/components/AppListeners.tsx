import { useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useUserStore } from '@/stores/useUserStore'
import { useOrderStore } from '@/stores/useOrderStore'
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

    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const unsubOrders = onSnapshot(
      query(
        collection(db, 'orders'),
        where('created_at', '>=',
          sevenDaysAgo.toISOString()),
        orderBy('created_at', 'desc'),
        limit(300)
      ),
      (snapshot) => {
        const orders = snapshot.docs
          .map(d => d.data() as Order)
        useOrderStore.getState().setOrders(orders)
      }
    )

    return () => unsubOrders()
  }, [user?.role])

  return null
}
