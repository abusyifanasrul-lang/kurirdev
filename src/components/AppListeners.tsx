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
  // 1. Subscription Orchestrator (Serial Queue) — FINAL HARDENED
  // BERHASIL: Menggantikan slot-based timers dengan antrean event-based.
  // Channel dibuka satu per satu setelah channel sebelumnya terhubung (joined)
  // atau timeout lokal tercapai, mencegah throttling Supabase.
  // ----------------------------------------------------------------
  useEffect(() => {
    if (!user) return
    let active = true // Flag untuk mencegah kebocoran async (isMounted)
    const cleanups: Array<() => void> = []

    // waitForStatus sengaja di dalam useEffect agar capture flag 'active' yang bersifat lokal
    const waitForStatus = (storeGetter: () => any, channelId: string, timeout = 8000) => {
      return new Promise((resolve) => {
        const start = Date.now()
        const check = setInterval(() => {
          if (!active) { clearInterval(check); resolve('cancelled'); return; }
          const status = storeGetter().realtimeStatus?.[channelId]
          if (status === 'joined' || status === 'errored' || status === 'timed_out' || Date.now() - start > timeout) {
            clearInterval(check)
            resolve(status || 'timeout')
          }
        }, 150)
      })
    }

    const runQueue = async () => {
      const userId = user.id
      const userRole = user.role
      const filter = {
        courierId: userRole === 'courier' ? userId : undefined,
        activeOnly: userRole === 'courier'
      }

      // --- STEP 1: ORDERS (Paling Kritis) ---
      if (!active) return
      try {
        console.log('📡 [Orchestrator] Step 1: Orders...')
        const orderStore = useOrderStore.getState()
        // Note: fetchInitialOrders dipanggil otomatis di dalam callback SUBSCRIBED di store
        cleanups.push(orderStore.subscribeOrders(filter))
        const orderCId = userRole === 'courier' ? `orders:courier:${userId}` : 'orders:global'
        await waitForStatus(() => useOrderStore.getState(), orderCId)
      } catch (e) {
        console.error('❌ [Orchestrator] Orders subscription failed:', e)
      }

      // --- STEP 2: NOTIFICATIONS ---
      if (!active) return
      try {
        console.log('📡 [Orchestrator] Step 2: Notifications...')
        const notifStore = useNotificationStore.getState()
        cleanups.push(userRole === 'courier' 
          ? notifStore.subscribeNotifications(userId) 
          : notifStore.subscribeAllNotifications()
        )
        const notifCId = userRole === 'courier' ? `notifications:user:${userId}` : 'notifications:all'
        await waitForStatus(() => useNotificationStore.getState(), notifCId)
      } catch (e) {
        console.error('❌ [Orchestrator] Notifications subscription failed:', e)
      }

      // --- STEP 3: PROFILE (Presence/Status) ---
      if (!active) return
      try {
        console.log('📡 [Orchestrator] Step 3: Profile...')
        cleanups.push(useUserStore.getState().subscribeProfile(userId))
        await waitForStatus(() => useUserStore.getState(), `profile:single:${userId}`)
      } catch (e) {
        console.error('❌ [Orchestrator] Profile subscription failed:', e)
      }

      // --- STEP 4: SETTINGS ---
      if (!active) return
      try {
        console.log('📡 [Orchestrator] Step 4: Settings...')
        const settingsStore = useSettingsStore.getState()
        await settingsStore.fetchSettings()
        cleanups.push(settingsStore.subscribeSettings())
        await waitForStatus(() => useSettingsStore.getState(), 'public:settings')
      } catch (e) {
        console.error('❌ [Orchestrator] Settings subscription failed:', e)
      }

      // --- STEP 5: ADMIN USERS ---
      if (active && userRole !== 'courier') {
        try {
          console.log('📡 [Orchestrator] Step 5: Admin Users...')
          cleanups.push(useUserStore.getState().subscribeUsers())
          await waitForStatus(() => useUserStore.getState(), 'users:list')
        } catch (e) {
          console.error('❌ [Orchestrator] Admin Users subscription failed:', e)
        }
      }

      // --- STEP 6: CUSTOMERS & REQUESTS ---
      if (!active) return
      try {
        console.log('📡 [Orchestrator] Step 6: Customers & Requests...')
        const customerStore = useCustomerStore.getState()
        cleanups.push(customerStore.subscribeToRequests())
        await waitForStatus(() => useCustomerStore.getState(), 'customer_requests_all')
        
        if (active) {
          cleanups.push(customerStore.subscribeToCustomers())
          console.log('✅ [Orchestrator] All subscription slots initialized.')
        }
      } catch (e) {
        console.error('❌ [Orchestrator] Customer data subscription failed:', e)
      }
    }

    runQueue().catch(err => {
      if (active) console.error('🚨 [Orchestrator] FATAL QUEUE ERROR:', err)
    })

    return () => {
      active = false
      cleanups.forEach((unsub, i) => {
        try { 
          if (typeof unsub === 'function') unsub(); 
        } catch (e) { 
          console.warn(`⚠️ [Orchestrator] Cleanup failed at index ${i}:`, e); 
        }
      })
    }
  }, [user?.id, user?.role])




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
  // 2. FCM Push Notifications (Separate from Realtime)
  // ----------------------------------------------------------------
  useEffect(() => {
    if (!user || user.role !== 'courier') return

    let fcmCleanup: { unsubscribe?: any } = {}
    let fcmRefreshInterval: any = null

    import('@/lib/fcm').then(({ refreshFCMToken, onForegroundMessage }) => {
      if (!user) return // Stale check
      refreshFCMToken(user.id).catch(console.error)
      fcmRefreshInterval = setInterval(() => {
        if (user) refreshFCMToken(user.id).catch(console.error)
      }, 7 * 24 * 60 * 60 * 1000)

      fcmCleanup.unsubscribe = onForegroundMessage((payload) => {
        useOrderStore.getState().fetchActiveOrdersByCourier(user.id)
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

    return () => {
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
