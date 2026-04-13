import { create } from 'zustand'
import { supabase } from '@/lib/supabaseClient'
import { RealtimeChannel } from '@supabase/supabase-js'
import { Notification } from '@/types'
import { cacheNotifications, getCachedNotifications, markNotificationReadLocal } from '@/lib/orderCache'

let notifResyncTime = 0
const notifChannels = new Map<string, RealtimeChannel>()
const notifStates = new Map<string, string>()
const notifRefs = new Map<string, number>()

interface NotificationState {
  notifications: Notification[]
  isLoading: boolean
  subscribeNotifications: (userId: string) => (() => void)
  subscribeAllNotifications: () => (() => void)
  unsubscribeNotifications: (userId: string) => void
  unsubscribeAllNotifications: () => void
  resyncRealtime: (userId?: string, options?: { force?: boolean }) => Promise<void>
  fetchRecentNotifications: (userId: string | undefined, since: string) => Promise<void>
  addNotification: (notification: Omit<Notification, 'id' | 'sent_at' | 'is_read'>) => Promise<void>
  markAsRead: (id: string) => Promise<void>
  markAllAsRead: (userId: string) => Promise<void>
  getNotificationsByUser: (userId: string) => Notification[]
  reset: () => void
  _resyncLock: Promise<void> | null
  realtimeStatus: Record<string, string>
  pingRealtime: () => Promise<void>
}

// PERBAIKAN UTAMA: Fungsi snapshot yang hanya fetch data, 
// tidak memanggil resyncRealtime() sehingga tidak memicu kaskade
const fetchSnapshot = async (userId?: string) => {
  let query = supabase.from('notifications').select('*')
  if (userId) query = query.eq('user_id', userId)
  const { data } = await query.order('sent_at', { ascending: false }).limit(50)
  return data as Notification[] | null
}

export const useNotificationStore = create<NotificationState>()((set, get) => ({
  notifications: [],
  isLoading: true,
  realtimeStatus: {},
  _resyncLock: null,

  subscribeNotifications: (userId: string) => {
    getCachedNotifications(userId).then(cached => {
      if (cached.length > 0) set({ notifications: cached, isLoading: false })
    })

    supabase.from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('sent_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        if (data) {
          set({ notifications: data as Notification[], isLoading: false })
          cacheNotifications(data as Notification[])
        }
      })

    const channelId = `notifications:user:${userId}`
    
    // 1. ATOMIC INCREMENT & SYNC GUARD
    const currentRef = notifRefs.get(channelId) || 0
    notifRefs.set(channelId, currentRef + 1)

    const existing = notifChannels.get(channelId)
    // Synchronously check both joined and joining
    if (existing && (notifStates.get(channelId) === 'joined' || notifStates.get(channelId) === 'joining')) {
      return () => get().unsubscribeNotifications(userId)
    }

    // 2. SYNCHRONOUS JOIN STATE
    notifStates.set(channelId, 'joining')

    // 3. INTERNAL ASYNC INIT
    ;(async () => {
      if (existing) {
        console.log(`♻️ Cleaning up existing channel for ${channelId}...`)
        await supabase.removeChannel(existing)
        notifChannels.delete(channelId)
      }

      // Safeguard: Check if we are still supposed to be joining
      if (notifStates.get(channelId) !== 'joining') return;

      const channel = supabase.channel(channelId)
        .on('postgres_changes',
          { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
          (payload) => {
            const { eventType, new: newRec, old: oldRec } = payload
            set((state) => {
              const updated = [...state.notifications]
              if (eventType === 'INSERT') {
                if (!updated.some(n => n.id === (newRec as any).id)) {
                  updated.unshift(newRec as Notification)
                  cacheNotifications([newRec as Notification])
                }
              } else if (eventType === 'UPDATE') {
                const idx = updated.findIndex(n => n.id === (newRec as any).id)
                if (idx !== -1) {
                  updated[idx] = { ...updated[idx], ...newRec }
                  cacheNotifications([updated[idx]])
                }
              } else if (eventType === 'DELETE') {
                const idx = updated.findIndex(n => n.id === (oldRec as any).id)
                if (idx !== -1) updated.splice(idx, 1)
              }
              return {
                notifications: updated.sort((a, b) =>
                  new Date(b.sent_at || 0).getTime() - new Date(a.sent_at || 0).getTime()
                )
              }
            })
          }
        )
        .on('broadcast', { event: 'ping' }, () => {
          set(state => ({ realtimeStatus: { ...state.realtimeStatus, [channelId]: 'joined' } }))
        })

      notifChannels.set(channelId, channel)

      channel.subscribe(async (status, err) => {
        // STALE GUARD: Ignore callbacks from superseded channels
        if (notifChannels.get(channelId) !== channel) return

        if (status === 'SUBSCRIBED') {
          console.log(`✅ Notif channel active: ${channelId}`)
          notifStates.set(channelId, 'joined')
          set(state => ({ realtimeStatus: { ...state.realtimeStatus, [channelId]: 'joined' } }))

          // PERBAIKAN: Gunakan fetchSnapshot() bukan resyncRealtime(force: true)
          try {
            const data = await fetchSnapshot(userId)
            if (data) {
              set({ notifications: data, isLoading: false })
              cacheNotifications(data)
            }
          } catch (e) {
            console.error('[NotifStore] Snapshot fetch failed:', e)
          }
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          console.warn(`❌ Notif channel ${channelId} ${status}:`, err)
          const finalStatus = status === 'CLOSED' ? 'closed' : 'errored'
          notifStates.set(channelId, finalStatus)
          set(state => ({ realtimeStatus: { ...state.realtimeStatus, [channelId]: finalStatus } }))
          notifChannels.delete(channelId)
        }
      })
    })()

    return () => get().unsubscribeNotifications(userId)
  },

  unsubscribeNotifications: (userId: string) => {
    const channelId = `notifications:user:${userId}`
    const currentRef = notifRefs.get(channelId) || 0
    if (currentRef <= 1) {
      const channel = notifChannels.get(channelId)
      if (channel) {
        supabase.removeChannel(channel).catch(() => {})
        notifChannels.delete(channelId)
        notifStates.delete(channelId)
      }
      notifRefs.set(channelId, 0)
    } else {
      notifRefs.set(channelId, currentRef - 1)
    }
  },

  subscribeAllNotifications: () => {
    supabase.from('notifications')
      .select('*')
      .order('sent_at', { ascending: false })
      .then(({ data }) => {
        if (data) set({ notifications: data as Notification[], isLoading: false })
      })

    const channelId = 'notifications:all'
    
    // 1. ATOMIC INCREMENT & SYNC GUARD
    const currentRef = notifRefs.get(channelId) || 0
    notifRefs.set(channelId, currentRef + 1)

    const existing = notifChannels.get(channelId)
    // Synchronously check both joined and joining
    if (existing && (notifStates.get(channelId) === 'joined' || notifStates.get(channelId) === 'joining')) {
      return () => get().unsubscribeAllNotifications()
    }

    // 2. SYNCHRONOUS JOIN STATE
    notifStates.set(channelId, 'joining')

    // 3. INTERNAL ASYNC INIT
    ;(async () => {
      if (existing) {
        console.log(`♻️ Cleaning up existing channel for ${channelId}...`)
        await supabase.removeChannel(existing)
        notifChannels.delete(channelId)
      }

      // Safeguard: Check if we are still supposed to be joining
      if (notifStates.get(channelId) !== 'joining') return;

      const channel = supabase.channel(channelId)

      channel.on('postgres_changes',
        { event: '*', schema: 'public', table: 'notifications' },
        (payload) => {
          const { eventType, new: newRec, old: oldRec } = payload
          set((state) => {
            const updated = [...state.notifications]
            if (eventType === 'INSERT') {
              if (!updated.some(n => n.id === (newRec as any).id)) {
                updated.unshift(newRec as Notification)
                cacheNotifications([newRec as Notification])
              }
            } else if (eventType === 'UPDATE') {
              const idx = updated.findIndex(n => n.id === (newRec as any).id)
              if (idx !== -1) {
                updated[idx] = { ...updated[idx], ...newRec }
                cacheNotifications([updated[idx]])
              }
            } else if (eventType === 'DELETE') {
              const idx = updated.findIndex(n => n.id === (oldRec as any).id)
              if (idx !== -1) updated.splice(idx, 1)
            }
            return {
              notifications: updated.sort((a, b) =>
                new Date(b.sent_at || 0).getTime() - new Date(a.sent_at || 0).getTime()
              )
            }
          })
        }
      )

      notifChannels.set(channelId, channel)

      channel.subscribe(async (status, err) => {
        // STALE GUARD: Ignore callbacks from superseded channels
        if (notifChannels.get(channelId) !== channel) return

        if (status === 'SUBSCRIBED') {
          console.log(`✅ Admin notif channel active: ${channelId}`)
          notifStates.set(channelId, 'joined')
          set(state => ({ realtimeStatus: { ...state.realtimeStatus, [channelId]: 'joined' } }))
          try {
            const data = await fetchSnapshot()
            if (data) set({ notifications: data, isLoading: false })
          } catch (e) {
            console.error('[NotifStore] Admin snapshot failed:', e)
          }
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          console.warn(`❌ Admin notif ${channelId} ${status}:`, err)
          const finalStatus = status === 'CLOSED' ? 'closed' : 'errored'
          notifStates.set(channelId, finalStatus)
          set(state => ({ realtimeStatus: { ...state.realtimeStatus, [channelId]: finalStatus } }))
          notifChannels.delete(channelId)
        }
      })
    })()

    return () => get().unsubscribeAllNotifications()
  },

  unsubscribeAllNotifications: () => {
    const channelId = 'notifications:all'
    const currentRef = notifRefs.get(channelId) || 0
    if (currentRef <= 1) {
      const channel = notifChannels.get(channelId)
      if (channel) {
        supabase.removeChannel(channel).catch(() => {})
        notifChannels.delete(channelId)
        notifStates.delete(channelId)
      }
      notifRefs.set(channelId, 0)
    } else {
      notifRefs.set(channelId, currentRef - 1)
    }
  },

  resyncRealtime: async (userId, options) => {
    if (get()._resyncLock) {
      return get()._resyncLock as Promise<void>
    }

    const resyncPromise = (async () => {
      try {
        const now = Date.now()
        // Throttle 30 detik kecuali force=true
        if (!options?.force && (now - notifResyncTime < 30_000)) {
          console.log('⏳ Skipping notif resync (cooldown)')
          return
        }
        notifResyncTime = now

        const data = await fetchSnapshot(userId)
        if (data) {
          set({ notifications: data })
          if (userId) cacheNotifications(data)
        }

        const channelId = userId ? `notifications:user:${userId}` : 'notifications:all'
        const channelState = notifStates.get(channelId)

        if (channelState === 'closed' || channelState === 'errored' || !notifChannels.has(channelId)) {
          console.warn(`⚠️ [NotifStore] Re-subscribing dead channel: ${channelId}`)
          if (userId) get().subscribeNotifications(userId)
          else get().subscribeAllNotifications()
        }
      } finally {
        set({ _resyncLock: null })
      }
    })()

    set({ _resyncLock: resyncPromise })
    return resyncPromise
  },

  fetchRecentNotifications: async (userId: string | undefined, since: string) => {
    try {
      let query = supabase
        .from('notifications')
        .select('*')
        .gt('sent_at', since)
        .order('sent_at', { ascending: false })
        .limit(20)

      if (userId) query = query.eq('user_id', userId)

      const { data, error } = await query
      if (error || !data || data.length === 0) return

      console.log(`📥 [NotifStore] Gap fill: ${data.length} new notifications since ${since}`)

      set((state) => {
        const updated = [...state.notifications]
        for (const n of data as Notification[]) {
          if (!updated.some(existing => existing.id === n.id)) {
            updated.unshift(n)
          }
        }
        
        const sorted = updated.sort((a, b) =>
          new Date(b.sent_at || 0).getTime() - new Date(a.sent_at || 0).getTime()
        )

        // Cache the new notifications
        cacheNotifications(data as Notification[])
        
        return { notifications: sorted }
      })
    } catch (err) {
      console.error('fetchRecentNotifications error:', err)
    }
  },

  addNotification: async (data) => {
    await (supabase.from('notifications') as any).insert({
      ...data,
      is_read: false,
      sent_at: new Date().toISOString(),
      type: data.type || 'manual_alert',
      fcm_status: data.fcm_status || 'pending'
    })
  },

  markAsRead: async (id) => {
    markNotificationReadLocal(id)
    set((state) => ({
      notifications: state.notifications.map(n => n.id === id ? { ...n, is_read: true } : n)
    }))
    await (supabase.from('notifications') as any).update({ is_read: true }).eq('id', id)
  },

  markAllAsRead: async (userId) => {
    set((state) => ({
      notifications: state.notifications.map(n => n.user_id === userId ? { ...n, is_read: true } : n)
    }))
    await (supabase.from('notifications') as any).update({ is_read: true }).eq('user_id', userId).eq('is_read', false)
  },

  getNotificationsByUser: (userId) => get().notifications.filter(n => n.user_id === userId),

  reset: () => set({ notifications: [], isLoading: false, realtimeStatus: {} }),

  pingRealtime: async () => {
    const channels = Array.from(notifChannels.values())
    if (channels.length === 0) return
    await Promise.all(channels.map(ch => ch.send({ type: 'broadcast', event: 'ping', payload: {} })))
  }
}))
