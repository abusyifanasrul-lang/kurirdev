import { useEffect, useRef } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useUserStore } from '@/stores/useUserStore'
import { useOrderStore } from '@/stores/useOrderStore'
import { useSettingsStore } from '@/stores/useSettingsStore'
import { useNotificationStore } from '@/stores/useNotificationStore'
import { useCustomerStore } from '@/stores/useCustomerStore'

// =============================================================
// AppListeners — Versi Final
//
// Filosofi:
// 1. Realtime channel adalah sumber kebenaran utama (postgres_changes)
// 2. Saat channel aktif & JWT valid → semua update masuk otomatis
// 3. Saat tab kembali aktif → isi "gap" dengan delta fetch (bukan full refetch)
// 4. Saat channel benar-benar mati → re-subscribe (bukan reload halaman)
// 5. JWT refresh → update auth realtime saja (tidak trigger resync)
// =============================================================

export const AppListeners = () => {
  const { user, logout } = useAuth()
  const { fetchSettings, subscribeSettings } = useSettingsStore()

  // Waktu terakhir tab kita aktif & berhasil fetch data
  // Digunakan untuk delta/gap fill — "fetch semua yang berubah sejak saya pergi"
  const lastActiveRef = useRef<number>(Date.now())
  const gapFillLock = useRef<boolean>(false)
  const resyncLock = useRef<Promise<void> | null>(null)

  // ----------------------------------------------------------------
  // 1. Settings
  // ----------------------------------------------------------------
  useEffect(() => {
    if (!user) return
    let cleanup: (() => void) | undefined
    const task = () => {
      fetchSettings()
      cleanup = subscribeSettings()
    }
    if ('requestIdleCallback' in window) {
      (window as any).requestIdleCallback(() => setTimeout(task, 1200), { timeout: 10000 })
    } else {
      setTimeout(task, 2000)
    }
    return () => { if (cleanup) cleanup() }
  }, [user?.id, fetchSettings, subscribeSettings])

  // ----------------------------------------------------------------
  // 1.b Profile realtime
  // ----------------------------------------------------------------
  useEffect(() => {
    if (!user) return
    let cleanup: (() => void) | undefined
    const task = () => { cleanup = useUserStore.getState().subscribeProfile(user.id) }
    if ('requestIdleCallback' in window) {
      (window as any).requestIdleCallback(() => setTimeout(task, 1500), { timeout: 10000 })
    } else {
      setTimeout(task, 2500)
    }
    return () => { if (cleanup) cleanup() }
  }, [user?.id])

  // ----------------------------------------------------------------
  // 1.c Suspension gate
  // ----------------------------------------------------------------
  const liveUser = useUserStore((state) => state.users.find(u => u.id === user?.id))
  useEffect(() => {
    if (liveUser && liveUser.is_active === false) {
      console.warn('⚠️ Akun disuspend. Logout otomatis...')
      logout()
    }
  }, [liveUser?.is_active, logout])

  // ----------------------------------------------------------------
  // 2. Orders, Notifs, FCM
  // ----------------------------------------------------------------
  useEffect(() => {
    if (!user) return

    const filter = {
      courierId: user.role === 'courier' ? user.id : undefined,
      activeOnly: user.role === 'courier'
    }

    const orderStore = useOrderStore.getState()
    const task = () => orderStore.fetchInitialOrders(filter)
    if ('requestIdleCallback' in window) {
      (window as any).requestIdleCallback(() => setTimeout(task, 500), { timeout: 5000 })
    } else {
      setTimeout(task, 1000)
    }

    const unsubOrders = orderStore.subscribeOrders(filter)
    const notifStore = useNotificationStore.getState()
    const unsubNotifs = user.role === 'courier'
      ? notifStore.subscribeNotifications(user.id)
      : notifStore.subscribeAllNotifications()

    let fcmCleanup: { unsubscribe?: any } = {}
    let fcmRefreshInterval: any = null

    if (user.role === 'courier') {
      import('@/lib/fcm').then(({ refreshFCMToken, onForegroundMessage }) => {
        refreshFCMToken(user.id).catch(console.error)
        fcmRefreshInterval = setInterval(() => {
          refreshFCMToken(user.id).catch(console.error)
        }, 7 * 24 * 60 * 60 * 1000)
        fcmCleanup.unsubscribe = onForegroundMessage((payload) => {
          orderStore.fetchActiveOrdersByCourier(user.id)
          const notifData = payload.notification || payload.data || {}
          if (notifData.title && Notification.permission === 'granted') {
            const notif = new Notification(notifData.title, {
              body: notifData.body || '',
              icon: '/icons/android/android-launchericon-192-192.png',
              tag: payload.data?.orderId || 'kurirdev-foreground',
            })
            notif.onclick = () => window.focus()
          }
        })
      }).catch(err => console.error('[FCM] import failed:', err))
    }

    return () => {
      unsubOrders()
      unsubNotifs()
      if (fcmRefreshInterval) clearInterval(fcmRefreshInterval)
      if (fcmCleanup.unsubscribe && typeof fcmCleanup.unsubscribe === 'function') {
        fcmCleanup.unsubscribe()
      }
    }
  }, [user?.id, user?.role])

  // ----------------------------------------------------------------
  // 2.e Support stores
  // ----------------------------------------------------------------
  useEffect(() => {
    if (!user) return
    ;(async () => {
      await new Promise(r => setTimeout(r, 800))
      const userStore = useUserStore.getState()
      if (!userStore.isLoaded) {
        await userStore.loadFromLocal()
        userStore.syncFromServer()
      }
      const loadCustomers = async () => {
        const customerStore = useCustomerStore.getState()
        await customerStore.loadFromLocal()
        customerStore.syncFromServer()
      }
      if ('requestIdleCallback' in window) {
        (window as any).requestIdleCallback(() => setTimeout(loadCustomers, 2000), { timeout: 10000 })
      } else {
        setTimeout(loadCustomers, 3000)
      }
    })()
  }, [user?.id])

  // ----------------------------------------------------------------
  // 3. Background sync (cache)
  // ----------------------------------------------------------------
  useEffect(() => {
    if (!user) return
    const userId = user.id
    const orderStore = useOrderStore.getState()
    const fetchFn = (start: Date, end: Date) =>
      orderStore.fetchOrdersByDateRange(start, end, user.role === 'courier' ? user.id : undefined)

    const syncTask = async () => {
      try {
        const { isInitialSyncCompleted, syncAllFinalOrders, needsDeltaSync, deltaSyncYesterday, checkIntegrity, pruneOldCache } = await import('@/lib/orderCache')
        if (!isInitialSyncCompleted(userId)) {
          await syncAllFinalOrders(fetchFn, userId)
        } else if (needsDeltaSync(userId)) {
          await deltaSyncYesterday(fetchFn, userId)
        }
        await checkIntegrity()
        await pruneOldCache()
      } catch (err) {
        console.error('[Sync] failed:', err)
      }
    }

    if ('requestIdleCallback' in window) {
      (window as any).requestIdleCallback(() => setTimeout(syncTask, 2000), { timeout: 10000 })
    } else {
      setTimeout(syncTask, 5000)
    }
  }, [user?.id, user?.role])

  // ----------------------------------------------------------------
  // 4. Admin users subscription
  // ----------------------------------------------------------------
  useEffect(() => {
    if (user && user.role !== 'courier') {
      const cleanup = useUserStore.getState().subscribeUsers()
      return () => { cleanup() }
    }
  }, [user?.id, user?.role])

  // ----------------------------------------------------------------
  // 5. INTI PERBAIKAN: Gap fill + Channel recovery
  // ----------------------------------------------------------------
  useEffect(() => {
    if (!user) return

    // ---
    // Gap fill: isi data yang missed selama tab tidak aktif
    // Hanya fetch record yang BERUBAH sejak kita pergi (updated_at > since)
    // Jauh lebih ringan dari full refetch
    // ---
    const fillDataGap = async () => {
      if (gapFillLock.current) return
      gapFillLock.current = true

      const since = new Date(lastActiveRef.current).toISOString()
      const filter = {
        courierId: user.role === 'courier' ? user.id : undefined,
        activeOnly: user.role === 'courier'
      }

      console.log(`📥 Filling data gap since ${since}...`)

      try {
        await Promise.allSettled([
          // Hanya orders yang berubah sejak kita offline
          useOrderStore.getState().fetchRecentlyUpdated?.(since, filter),

          // Hanya notifikasi baru
          user.role === 'courier'
            ? useNotificationStore.getState().fetchRecentNotifications?.(user.id, since)
            : useNotificationStore.getState().fetchRecentNotifications?.(undefined, since),
        ])

        lastActiveRef.current = Date.now()
        console.log('✅ Data gap filled.')
      } catch (err) {
        console.error('❌ Gap fill failed:', err)
      } finally {
        gapFillLock.current = false
      }
    }

    // ---
    // Channel recovery: re-subscribe jika channel benar-benar mati
    // Dipanggil hanya saat ada status 'errored' atau 'closed' yang eksplisit
    // ---
    const recoverDeadChannels = async () => {
      if (resyncLock.current) return resyncLock.current

      resyncLock.current = (async () => {
        try {
          const filter = {
            courierId: user.role === 'courier' ? user.id : undefined,
            activeOnly: user.role === 'courier'
          }

          // Stagger 2 detik — tidak rush ke server bersamaan
          const stores = [
            { name: 'Orders', fn: () => useOrderStore.getState().resyncRealtime(filter) },
            { name: 'Users', fn: () => user.role === 'courier'
              ? useUserStore.getState().resyncRealtime(user.id)
              : useUserStore.getState().resyncRealtime(undefined)
            },
            { name: 'Notifs', fn: () => user.role === 'courier'
              ? useNotificationStore.getState().resyncRealtime(user.id)
              : useNotificationStore.getState().resyncRealtime(undefined)
            },
            { name: 'Customers', fn: () => useCustomerStore.getState().resyncRealtime() },
            { name: 'Settings', fn: () => useSettingsStore.getState().resyncRealtime() },
          ]

          for (const store of stores) {
            try {
              await store.fn()
              await new Promise(r => setTimeout(r, 2000))
            } catch (err) {
              console.error(`Channel recovery failed for ${store.name}:`, err)
            }
          }
        } finally {
          resyncLock.current = null
        }
      })()

      return resyncLock.current
    }

    // ---
    // Cek apakah ada channel yang benar-benar mati
    // ---
    const hasDeadChannels = (): boolean => {
      const stores = [
        useOrderStore.getState(),
        useNotificationStore.getState(),
        useUserStore.getState(),
        useSettingsStore.getState(),
        useCustomerStore.getState(),
      ]
      return stores.some(store =>
        Object.values(store.realtimeStatus).some(s => s === 'errored' || s === 'closed')
      )
    }

    // ---
    // Handler utama saat tab kembali aktif
    // Logika: gap fill DULU (data freshness), channel recovery HANYA jika perlu
    // ---
    let visibilityDebounce: ReturnType<typeof setTimeout> | null = null

    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') {
        // Tab pergi — catat waktu terakhir aktif
        lastActiveRef.current = Date.now()
        return
      }

      // Debounce 500ms untuk hindari double-fire
      if (visibilityDebounce) clearTimeout(visibilityDebounce)
      visibilityDebounce = setTimeout(async () => {
        if (!navigator.onLine) return

        // Step 1: Isi data gap terlebih dahulu
        await fillDataGap()

        // Step 2: Hanya recover channel jika memang mati
        if (hasDeadChannels()) {
          console.warn('⚠️ Dead channels found. Recovering...')
          await recoverDeadChannels()
        }
      }, 500)
    }

    // Saat kembali online setelah offline
    const handleOnline = async () => {
      console.log('🌐 Back online.')
      await fillDataGap()
      if (hasDeadChannels()) {
        await recoverDeadChannels()
      }
    }

    // Window focus — lebih ringan, hanya gap fill jika ada gap signifikan (>2 menit)
    let lastFocusTime = Date.now()
    const handleFocus = async () => {
      const now = Date.now()
      // Hanya gap fill jika sudah lebih dari 2 menit sejak focus terakhir
      if (now - lastFocusTime < 2 * 60 * 1000) return
      lastFocusTime = now
      await fillDataGap()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('online', handleOnline)
    window.addEventListener('focus', handleFocus)

    // ---
    // Periodic health check: setiap 3 menit
    // Hanya recover jika ada yang mati — tidak trigger gap fill
    // ---
    const healthCheck = async () => {
      if (!navigator.onLine) return
      if (hasDeadChannels()) {
        console.warn('📡 [Health] Dead channels detected. Recovering...')
        await recoverDeadChannels()
      }
    }

    const healthInterval = setInterval(healthCheck, 3 * 60 * 1000)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('focus', handleFocus)
      clearInterval(healthInterval)
      if (visibilityDebounce) clearTimeout(visibilityDebounce)
    }
  }, [user?.id, user?.role])

  return null
}
