import { useEffect, useRef } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useUserStore } from '@/stores/useUserStore'
import { useOrderStore } from '@/stores/useOrderStore'
import { useSettingsStore } from '@/stores/useSettingsStore'
import { useNotificationStore } from '@/stores/useNotificationStore'
import { useCustomerStore } from '@/stores/useCustomerStore'

// =============================================================
// MODULE-LEVEL state — persists across component remounts
//
// PERBAIKAN UTAMA: Sebelumnya resyncLock adalah useRef di dalam
// komponen. Saat komponen unmount+remount (karena SIGNED_IN loop),
// ref baru dibuat dengan nilai null → lock tidak efektif →
// recovery dipanggil puluhan kali dalam detik yang sama.
//
// Dengan memindahkan ke module level, lock tetap ada bahkan
// saat komponen remount. Satu instance recovery untuk seluruh
// siklus hidup aplikasi.
// =============================================================

// Lock untuk recoverDeadChannels — module-level agar persist lintas remount
let _recoveryLock: Promise<void> | null = null;
// Timestamp recovery terakhir — cooldown eksplisit 60 detik
let _lastRecoveryTime = 0;
// Lock untuk gap fill
let _gapFillLock = false;

// Timestamp channel pertama kali masuk status dead
// Digunakan untuk grace period — jangan langsung recover saat baru CLOSED
const _channelDeadSince = new Map<string, number>();

// Cek apakah ada channel yang SUDAH mati > grace period
// Grace period 8 detik: channel yang baru CLOSED mungkin sedang reconnect
// otomatis oleh Supabase client. Jangan interrupt proses itu.
const hasDeadChannelsPastGrace = (gracePeriodMs = 8000): boolean => {
  const stores = [
    useOrderStore.getState(),
    useNotificationStore.getState(),
    useUserStore.getState(),
    useSettingsStore.getState(),
    useCustomerStore.getState(),
  ];

  const now = Date.now();
  let anyDead = false;

  for (const store of stores) {
    for (const [channelId, status] of Object.entries(store.realtimeStatus)) {
      if (status === 'errored' || status === 'closed') {
        if (!_channelDeadSince.has(channelId)) {
          // Pertama kali terdeteksi mati — mulai timer grace period
          _channelDeadSince.set(channelId, now);
        } else if (now - (_channelDeadSince.get(channelId)!) > gracePeriodMs) {
          // Sudah mati lebih dari grace period → benar-benar perlu recovery
          anyDead = true;
        }
      } else {
        // Channel kembali sehat — hapus dari tracking
        _channelDeadSince.delete(channelId);
      }
    }
  }

  return anyDead;
};

export const AppListeners = () => {
  const { user, logout } = useAuth()
  const { fetchSettings, subscribeSettings } = useSettingsStore()
  const lastActiveRef = useRef<number>(Date.now())

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
  // 3. Background sync
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
  // 5. Gap fill + Channel recovery
  // ----------------------------------------------------------------
  useEffect(() => {
    if (!user) return

    // Closure untuk user yang stabil — tidak berubah saat useEffect ini aktif
    const userId = user.id
    const userRole = user.role

    // ---
    // Gap fill: delta fetch hanya record yang berubah sejak tab pergi
    // ---
    const fillDataGap = async () => {
      if (_gapFillLock) return
      _gapFillLock = true

      const since = new Date(lastActiveRef.current).toISOString()
      const filter = {
        courierId: userRole === 'courier' ? userId : undefined,
        activeOnly: userRole === 'courier'
      }

      console.log(`📥 Filling data gap since ${since}...`)

      try {
        await Promise.allSettled([
          useOrderStore.getState().fetchRecentlyUpdated?.(since, filter),
          userRole === 'courier'
            ? useNotificationStore.getState().fetchRecentNotifications?.(userId, since)
            : useNotificationStore.getState().fetchRecentNotifications?.(undefined, since),
        ])
        lastActiveRef.current = Date.now()
        console.log('✅ Data gap filled.')
      } catch (err) {
        console.error('❌ Gap fill failed:', err)
      } finally {
        _gapFillLock = false
      }
    }

    // ---
    // Channel recovery: re-subscribe channel yang benar-benar mati
    // Menggunakan module-level lock dan cooldown eksplisit
    // ---
    const recoverDeadChannels = async () => {
      // Lock level 1: Promise lock — cegah concurrent calls
      if (_recoveryLock) {
        return _recoveryLock
      }

      // Lock level 2: Cooldown timestamp — cegah spam recovery
      // Bahkan jika lock entah bagaimana terlewat, cooldown ini menghentikannya
      const now = Date.now()
      if (now - _lastRecoveryTime < 60_000) {
        console.log('⏳ Recovery cooldown active, skipping.')
        return
      }
      _lastRecoveryTime = now

      _recoveryLock = (async () => {
        console.log('🔄 Recovering dead channels...')
        try {
          const filter = {
            courierId: userRole === 'courier' ? userId : undefined,
            activeOnly: userRole === 'courier'
          }

          // Stagger 2 detik antar store
          const stores = [
            { name: 'Orders', fn: () => useOrderStore.getState().resyncRealtime(filter) },
            { name: 'Users', fn: () => userRole === 'courier'
              ? useUserStore.getState().resyncRealtime(userId)
              : useUserStore.getState().resyncRealtime(undefined)
            },
            { name: 'Notifs', fn: () => userRole === 'courier'
              ? useNotificationStore.getState().resyncRealtime(userId)
              : useNotificationStore.getState().resyncRealtime(undefined)
            },
            { name: 'Customers', fn: () => useCustomerStore.getState().resyncRealtime() },
            { name: 'Settings', fn: () => useSettingsStore.getState().resyncRealtime() },
          ]

          for (const store of stores) {
            try {
              await store.fn()
              // Jeda 2 detik — beri server waktu untuk memproses koneksi baru
              await new Promise(r => setTimeout(r, 2000))
            } catch (err) {
              console.error(`Recovery failed for ${store.name}:`, err)
            }
          }
          console.log('✅ Channel recovery complete.')
        } finally {
          _recoveryLock = null
          // Reset grace period tracker setelah recovery selesai
          _channelDeadSince.clear()
        }
      })()

      return _recoveryLock
    }

    // ---
    // Handler visibilitychange: gap fill + kondisional recovery
    // ---
    let visibilityDebounce: ReturnType<typeof setTimeout> | null = null

    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') {
        lastActiveRef.current = Date.now()
        return
      }
      if (visibilityDebounce) clearTimeout(visibilityDebounce)
      visibilityDebounce = setTimeout(async () => {
        if (!navigator.onLine) return
        // Gap fill selalu dilakukan saat tab kembali aktif
        await fillDataGap()
        // Recovery hanya jika ada channel mati melewati grace period
        if (hasDeadChannelsPastGrace()) {
          console.warn('⚠️ Dead channels found after grace period. Recovering...')
          await recoverDeadChannels()
        }
      }, 800) // Debounce 800ms untuk menghindari double-fire
    }

    // ---
    // Handler online: gap fill + recovery jika perlu
    // ---
    const handleOnline = async () => {
      console.log('🌐 Back online.')
      await fillDataGap()
      if (hasDeadChannelsPastGrace()) {
        await recoverDeadChannels()
      }
    }

    // ---
    // Handler focus: hanya gap fill jika sudah lama tidak aktif (>5 menit)
    // TIDAK trigger recovery — visibility sudah menangani itu
    // ---
    const FOCUS_GAP_THRESHOLD_MS = 5 * 60 * 1000
    let lastFocusTime = Date.now()
    const handleFocus = async () => {
      const now = Date.now()
      if (now - lastFocusTime < FOCUS_GAP_THRESHOLD_MS) return
      lastFocusTime = now
      if (!navigator.onLine) return
      await fillDataGap()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('online', handleOnline)
    window.addEventListener('focus', handleFocus)

    // ---
    // Health check: setiap 3 menit, HANYA recovery (bukan gap fill)
    // Gap fill diurus oleh visibility/focus handler
    // ---
    const healthCheck = async () => {
      if (!navigator.onLine) return
      if (hasDeadChannelsPastGrace()) {
        console.warn('📡 [Health] Dead channels detected. Recovering...')
        await recoverDeadChannels()
      } else {
        console.log('✅ [Health] All channels OK.')
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
