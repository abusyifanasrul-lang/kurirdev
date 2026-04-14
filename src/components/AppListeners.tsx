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

// Pelacakan upaya recovery per channel untuk exponential backoff
const _recoveryAttempts = new Map<string, number>();
const _lastAttemptAt = new Map<string, number>();

// Fungsi helper exponential backoff: 5s, 10s, 20s, 40s, 80s... max 5 menit
const getBackoffDelay = (attempts: number) => {
  return Math.min(300_000, 5000 * Math.pow(2, Math.max(0, attempts - 1)));
};

// Cek apakah ada channel yang benar-benar butuh recovery sesuai aturan grace period & backoff
const getChannelsNeedingRecovery = (gracePeriodMs = 8000): string[] => {
  const stores = [
    useOrderStore.getState(),
    useNotificationStore.getState(),
    useUserStore.getState(),
    useSettingsStore.getState(),
    useCustomerStore.getState(),
  ];

  const now = Date.now();
  const needingRecovery: string[] = [];

  for (const store of stores) {
    for (const [channelId, status] of Object.entries(store.realtimeStatus)) {
      if (status === 'errored' || status === 'closed') {
        // 1. Inisialisasi timer grace period jika belum ada
        if (!_channelDeadSince.has(channelId)) {
          _channelDeadSince.set(channelId, now);
          continue;
        }

        // 2. Cek Grace Period (8s)
        const timeDead = now - _channelDeadSince.get(channelId)!;
        if (timeDead < gracePeriodMs) continue;

        // 3. Cek Exponential Backoff
        const attempts = _recoveryAttempts.get(channelId) || 0;
        const lastAttempt = _lastAttemptAt.get(channelId) || 0;
        const backoff = getBackoffDelay(attempts);

        if (now - lastAttempt >= backoff) {
          needingRecovery.push(channelId);
        }
      } else {
        // Channel kembali sehat — reset tracking
        _channelDeadSince.delete(channelId);
        _recoveryAttempts.delete(channelId);
        _lastAttemptAt.delete(channelId);
      }
    }
  }

  return needingRecovery;
};

export const AppListeners = () => {
  const { user, logout } = useAuth()
  const { fetchSettings, subscribeSettings } = useSettingsStore()
  const lastActiveRef = useRef<number>(Date.now())

  // ----------------------------------------------------------------
  // 1. Settings — delay 2000ms (slot 4)
  // ----------------------------------------------------------------
  useEffect(() => {
    if (!user) return
    let cleanup: (() => void) | undefined
    const timerId = setTimeout(() => {
      fetchSettings()
      cleanup = subscribeSettings()
    }, 2000)
    return () => {
      clearTimeout(timerId)
      if (cleanup) cleanup()
    }
  }, [user?.id, fetchSettings, subscribeSettings])

  // ----------------------------------------------------------------
  // 1.b Profile realtime — delay 2500ms (slot 5)
  // ----------------------------------------------------------------
  useEffect(() => {
    if (!user) return
    let cleanup: (() => void) | undefined
    const timerId = setTimeout(() => {
      cleanup = useUserStore.getState().subscribeProfile(user.id)
    }, 2500)
    return () => {
      clearTimeout(timerId)
      if (cleanup) cleanup()
    }
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
  //
  // PERBAIKAN KRITIS: Sebelumnya subscribeOrders dan subscribeNotifications
  // dipanggil langsung di t=0ms bersamaan dengan subscribeUsers (t=0ms).
  // Ini menyebabkan 5 channel dibuka sekaligus → Supabase throttle → TIMED_OUT.
  //
  // Solusi: Stagger setiap subscribe dengan jeda 600ms antar slot:
  //   Slot 1 (t=300ms)  → subscribeOrders
  //   Slot 2 (t=900ms)  → subscribeNotifications
  //   Slot 3 (t=1500ms) → subscribeUsers (effect 4)
  //   Slot 4 (t=2000ms) → subscribeSettings (effect 1)
  //   Slot 5 (t=2500ms) → subscribeProfile  (effect 1.b)
  //   Slot 6 (t=3100ms) → subscribeCustomers & Requests (effect 4.b)
  // ----------------------------------------------------------------
  useEffect(() => {
    if (!user) return

    const filter = {
      courierId: user.role === 'courier' ? user.id : undefined,
      activeOnly: user.role === 'courier'
    }

    const orderStore = useOrderStore.getState()
    const notifStore = useNotificationStore.getState()

    // Initial data load — bisa langsung, tidak membuka WebSocket
    const fetchTimerId = setTimeout(() => orderStore.fetchInitialOrders(filter), 500)

    // Slot 1: subscribeOrders — t=300ms
    let unsubOrders: (() => void) | undefined
    const ordersTimerId = setTimeout(() => {
      console.log('📡 [AppListeners] Opening orders channel (slot 1)...')
      unsubOrders = orderStore.subscribeOrders(filter)
    }, 300)

    // Slot 2: subscribeNotifications — t=900ms
    let unsubNotifs: (() => void) | undefined
    const notifTimerId = setTimeout(() => {
      console.log('📡 [AppListeners] Opening notifications channel (slot 2)...')
      unsubNotifs = user.role === 'courier'
        ? notifStore.subscribeNotifications(user.id)
        : notifStore.subscribeAllNotifications()
    }, 900)

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
      clearTimeout(fetchTimerId)
      clearTimeout(ordersTimerId)
      clearTimeout(notifTimerId)
      if (unsubOrders) unsubOrders()
      if (unsubNotifs) unsubNotifs()
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
  // 4. Admin users subscription — delay 1500ms (slot 3)
  // ----------------------------------------------------------------
  useEffect(() => {
    if (!user || user.role === 'courier') return
    let cleanup: (() => void) | undefined
    const timerId = setTimeout(() => {
      console.log('📡 [AppListeners] Opening users channel (slot 3)...')
      cleanup = useUserStore.getState().subscribeUsers()
    }, 1500)
    return () => {
      clearTimeout(timerId)
      if (cleanup) cleanup()
    }
  }, [user?.id, user?.role])

  // ----------------------------------------------------------------
  // 4.b Global Customer Subscriptions — delay 3100ms (slot 6)
  // ----------------------------------------------------------------
  useEffect(() => {
    if (!user) return
    let unsubRequests: (() => void) | undefined
    let unsubCustomers: (() => void) | undefined
    
    const timerId = setTimeout(() => {
      const customerStore = useCustomerStore.getState()
      
      console.log('📡 [AppListeners] Opening customer channels (slot 6)...')
      // Both Admin and Courier need these for Dashboard and Realtime updates
      unsubRequests = customerStore.subscribeToRequests()
      unsubCustomers = customerStore.subscribeToCustomers()
    }, 3100)
    
    return () => {
      clearTimeout(timerId)
      if (unsubRequests) unsubRequests()
      if (unsubCustomers) unsubCustomers()
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
      // 1. Identifikasi channel yang benar-benar butuh recovery
      const channelsToRecover = getChannelsNeedingRecovery()
      if (channelsToRecover.length === 0) return

      // Promise lock — cegah concurrent calls
      if (_recoveryLock) return _recoveryLock

      // Cooldown global (60s) — perlindungan tambahan
      const now = Date.now()
      if (now - _lastRecoveryTime < 60_000) {
        console.log('⏳ Global recovery cooldown active, skipping.')
        return
      }
      _lastRecoveryTime = now

      _recoveryLock = (async () => {
        console.log(`🔄 Recovering ${channelsToRecover.length} dead channels...`)
        try {
          const filter = {
            courierId: userRole === 'courier' ? userId : undefined,
            activeOnly: userRole === 'courier'
          }

          const storesToRecover = [
            { id: 'orders', name: 'Orders', check: () => channelsToRecover.some(c => c.startsWith('orders')), fn: () => useOrderStore.getState().resyncRealtime(filter) },
            { id: 'users', name: 'Users', check: () => channelsToRecover.some(c => c.includes('users') || c.includes('profile')), fn: () => userRole === 'courier'
              ? useUserStore.getState().resyncRealtime(userId)
              : useUserStore.getState().resyncRealtime(undefined)
            },
            { id: 'notifs', name: 'Notifs', check: () => channelsToRecover.some(c => c.includes('notifications')), fn: () => userRole === 'courier'
              ? useNotificationStore.getState().resyncRealtime(userId)
              : useNotificationStore.getState().resyncRealtime(undefined)
            },
            { id: 'customers', name: 'Customers', check: () => channelsToRecover.some(c => c.includes('customer')), fn: () => useCustomerStore.getState().resyncRealtime() },
            { id: 'settings', name: 'Settings', check: () => channelsToRecover.some(c => c.includes('settings')), fn: () => useSettingsStore.getState().resyncRealtime() },
          ]

          for (const store of storesToRecover) {
            if (!store.check()) continue

            try {
              console.log(`🛠️ Attempting recovery for ${store.name}...`)
              
              // Update individual attempt counter
              channelsToRecover.filter(c => {
                if (store.id === 'orders') return c.startsWith('orders')
                if (store.id === 'users') return c.includes('users') || c.includes('profile')
                if (store.id === 'notifs') return c.includes('notifications')
                if (store.id === 'customers') return c.includes('customer')
                if (store.id === 'settings') return c.includes('settings')
                return false
              }).forEach(c => {
                _recoveryAttempts.set(c, (_recoveryAttempts.get(c) || 0) + 1)
                _lastAttemptAt.set(c, Date.now())
              })

              await store.fn()
              await new Promise(r => setTimeout(r, 2000))
            } catch (err) {
              console.error(`Recovery failed for ${store.name}:`, err)
            }
          }
          console.log('✅ Channel recovery sequence complete.')
        } finally {
          _recoveryLock = null
          // HANYA hapus _channelDeadSince, biarkan _recoveryAttempts tetap ada 
          // agar backoff berfungsi jika recovery gagal lagi
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
        // Recovery HANYA jika ada channel yang butuh (pasca grace & backoff)
        const dead = getChannelsNeedingRecovery()
        if (dead.length > 0) {
          console.warn(`⚠️ ${dead.length} dead channels need recovery. Attempting...`)
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
      const dead = getChannelsNeedingRecovery()
      if (dead.length > 0) {
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
      const dead = getChannelsNeedingRecovery()
      if (dead.length > 0) {
        console.warn(`📡 [Health] ${dead.length} dead channels detected. Recovering...`)
        await recoverDeadChannels()
      } else {
        console.log('✅ [Health] All channels OK or in backoff.')
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
