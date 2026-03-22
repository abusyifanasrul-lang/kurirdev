import { useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useUserStore } from '@/stores/useUserStore'
import { useOrderStore } from '@/stores/useOrderStore'
import { useNotificationStore } from '@/stores/useNotificationStore'
import {
  collection, query, where,
  orderBy, limit, onSnapshot,
  getDocs
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import {
  isInitialSyncCompleted,
  syncAllFinalOrders,
  needsDeltaSync,
  deltaSyncYesterday,
  moveToLocalDB,
  checkIntegrity,
  getCacheMeta
} from '@/lib/orderCache'
import { Order } from '@/types'

// Fungsi fetch helper di luar komponen AppListeners
async function fetchFinalOrders(
  start: Date,
  end: Date
): Promise<Order[]> {
  const q = query(
    collection(db, 'orders'),
    where('created_at', '>=',
      start.toISOString()),
    where('created_at', '<=',
      end.toISOString()),
    where('status', 'in',
      ['delivered', 'cancelled']),
    orderBy('created_at', 'desc')
  )
  const snapshot = await getDocs(q)
  return snapshot.docs
    .map(d => d.data() as Order)
}

// Storage budget check
async function checkStorageBudget() {
  if (!navigator.storage?.estimate) return
  try {
    const { usage, quota } =
      await navigator.storage.estimate()
    if (!usage || !quota) return
    const usagePercent = (usage / quota) * 100
    if (usagePercent > 80) {
      console.warn(`Storage ${usagePercent.toFixed(1)}%
        used — consider pruning`)
      // Hapus order > 1 tahun yang
      // sudah final dan paid
      const oneYearAgo = new Date()
      oneYearAgo.setFullYear(
        oneYearAgo.getFullYear() - 1
      )
      const cutoff = oneYearAgo
        .toISOString().split('T')[0]
      const { localDB } = await import(
        '@/lib/orderCache'
      )
      await localDB.orders
        .where('_date')
        .below(cutoff)
        .filter(o =>
          o.payment_status === 'paid' &&
          (o.status === 'delivered' ||
           o.status === 'cancelled')
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

        // Mirror write ke IndexedDB
        // untuk order yang sudah final
        snapshot.docChanges().forEach(change => {
          const order = change.doc.data() as Order
          if (
            order.status === 'delivered' ||
            order.status === 'cancelled'
          ) {
            // Fire and forget — tidak perlu await
            moveToLocalDB(order).catch(
              err => console.error(
                'Mirror write error:', err
              )
            )
          }
        })
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
    if (!user) return

    const runSync = async () => {
      try {
        // INITIAL SYNC — device baru
        if (!isInitialSyncCompleted()) {
          console.log('Running initial sync...')
          const count = await syncAllFinalOrders(
            fetchFinalOrders
          )
          console.log(`Initial sync: ${count}
            orders cached`)

          // Notify semua komponen bahwa
          // IndexedDB sudah terisi
          window.dispatchEvent(
            new CustomEvent('indexeddb-synced')
          )

          // Cek storage setelah sync
          await checkStorageBudget()
          return
        }

        // INTEGRITY CHECK — deteksi rusak
        const { ok, localCount, metaCount } =
          await checkIntegrity()
        if (!ok) {
          console.warn(`Integrity check failed:
            local=${localCount},
            meta=${metaCount}`)
          // Re-sync jika selisih > 10 records
          if (Math.abs(localCount - metaCount)
              > 10) {
            await syncAllFinalOrders(
              fetchFinalOrders
            )
            // Cek storage setelah sync
            await checkStorageBudget()
            return
          }
        }

        // DELTA SYNC — setiap hari
        if (needsDeltaSync()) {
          console.log('Running delta sync...')
          const count = await deltaSyncYesterday(
            fetchFinalOrders
          )
          console.log(`Delta sync: ${count}
            orders cached`)

          window.dispatchEvent(
            new CustomEvent('indexeddb-synced')
          )
        }

        // Cek storage setelah sync
        await checkStorageBudget()

      } catch (error) {
        console.error('Sync error:', error)
      }
    }

    // Delay 3 detik agar listener lain
    // sudah aktif dulu
    const timer = setTimeout(runSync, 3000)
    return () => clearTimeout(timer)
  }, [user?.id])

  useEffect(() => {
    if (!user || user.role !== 'admin') return
    const unsub = subscribeAllNotifications()
    return () => unsub()
  }, [user?.id])

  return null
}
