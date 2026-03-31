import { useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useUserStore } from '@/stores/useUserStore'
import { useOrderStore } from '@/stores/useOrderStore'
import { useNotificationStore } from '@/stores/useNotificationStore'
import { useSettingsStore } from '@/stores/useSettingsStore'
import {
  collection, query, where,
  orderBy, limit, onSnapshot,
  getDocs, getDoc, doc
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import {
  isInitialSyncCompleted,
  syncAllFinalOrders,
  needsDeltaSync,
  deltaSyncYesterday,
  moveToLocalDB,
  checkIntegrity
} from '@/lib/orderCache'
import { seedFirestore } from '@/lib/firebaseSeeder'
import { Order } from '@/types'

// Fungsi fetch helper di luar komponen AppListeners
// courierId opsional: jika ada, hanya ambil pesanan milik kurir tsb
async function fetchFinalOrders(
  start: Date,
  end: Date,
  courierId?: string
): Promise<Order[]> {
  // Base constraints: tanggal & status final
  const constraints: any[] = [
    where('created_at', '>=',
      start.toISOString()),
    where('created_at', '<=',
      end.toISOString()),
    where('status', 'in',
      ['delivered', 'cancelled']),
    orderBy('created_at', 'desc')
  ]
  const q = query(
    collection(db, 'orders'),
    ...constraints
  )
  const snapshot = await getDocs(q)
  let orders = snapshot.docs
    .map(d => d.data() as Order)
  // Filter di client-side untuk kurir
  // (menghindari composite index baru di Firebase)
  if (courierId) {
    orders = orders.filter(
      o => o.courier_id === courierId
    )
  }
  return orders
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
    // Hanya admin yang butuh daftar semua user secara real-time
    let unsubUsers = () => {};
    if (user && ['admin', 'admin_kurir', 'owner'].includes(user.role)) {
      unsubUsers = subscribeUsers()
    }

    // Seed Firestore users if empty — skip if already seeded
    if (!localStorage.getItem('kurirdev_seeded')) {
      seedFirestore().then(() => {
        localStorage.setItem('kurirdev_seeded', '1')
      }).catch(console.error)
    }

    // Queue positions only needed for admin roles, not courier
    setTimeout(() => {
      const sessionStr = sessionStorage.getItem('user-session')
      if (sessionStr) {
        try {
          const { state } = JSON.parse(sessionStr)
          if (state?.user?.role && state.user.role !== 'courier') {
            initQueuePositions().catch(console.error)
          }
        } catch {}
      }
    }, 5000)

    return () => unsubUsers()
  }, [])

  useEffect(() => {
    if (!user) return

    // Onetime fetch for global settings sync (local-first approach)
    const syncGlobalSettings = async () => {
      try {
        const docSnap = await getDoc(doc(db, 'settings', 'business'))
        if (docSnap.exists()) {
          const data = docSnap.data()
          if (data && data.courier_instructions) {
             useSettingsStore.getState().updateSettings({
               courier_instructions: data.courier_instructions,
               commission_rate: data.commission_rate ?? 80,
               commission_threshold: data.commission_threshold ?? 5000,
             })
             console.log('Global settings synced to local store.')
          }
        }
      } catch (err) {
        console.error('Failed to sync global settings:', err)
      }
    }
    syncGlobalSettings()

  }, [user?.id])

  useEffect(() => {
    // Semua role admin (admin, admin_kurir, owner, finance) butuh subscribeOrders
    if (!user || user.role === 'courier') return

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
        // Tentukan fetch function berdasar role
        const fetchFn = (start: Date, end: Date) =>
          fetchFinalOrders(
            start, end,
            user.role === 'courier'
              ? user.id
              : undefined
          )

        // INITIAL SYNC — user baru di device ini
        if (!isInitialSyncCompleted(user.id)) {
          console.log(`Running initial sync for ${user.role} ${user.id}...`)
          const count = await syncAllFinalOrders(
            fetchFn, user.id
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
              fetchFn, user.id
            )
            // Cek storage setelah sync
            await checkStorageBudget()
            return
          }
        }

        // DELTA SYNC — setiap hari
        if (needsDeltaSync(user.id)) {
          console.log(`Running delta sync for ${user.role} ${user.id}...`)
          const count = await deltaSyncYesterday(
            fetchFn, user.id
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

    // Delay 5 detik agar listener lain sudah aktif dulu
    // dan skip jika tab tidak visible (save resources)
    const timer = setTimeout(() => {
      if (document.visibilityState === 'visible') {
        runSync()
      }
    }, 5000)
    return () => clearTimeout(timer)
  }, [user?.id])

  useEffect(() => {
    if (!user || !['admin', 'admin_kurir'].includes(user.role)) return
    const unsub = subscribeAllNotifications()
    return () => unsub()
  }, [user?.id])

  return null
}
