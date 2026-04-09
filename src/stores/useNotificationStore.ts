import { create } from 'zustand'
import { supabase } from '@/lib/supabaseClient'
import { RealtimeChannel } from '@supabase/supabase-js'
import { Notification } from '@/types'
import { cacheNotifications, getCachedNotifications, markNotificationReadLocal } from '@/lib/orderCache'

let notifResyncTime = 0
const notifChannels = new Map<string, RealtimeChannel>()
const notifStates = new Map<string, string>()

interface NotificationState {
  notifications: Notification[]
  isLoading: boolean

  subscribeNotifications: (userId: string) => Promise<(() => void) | void>
  subscribeAllNotifications: () => Promise<(() => void) | void>
  resyncRealtime: (userId?: string, options?: { force?: boolean }) => Promise<void>
  addNotification: (notification: Omit<Notification, 'id' | 'sent_at' | 'is_read'>) => Promise<void>
  markAsRead: (id: string) => Promise<void>
  markAllAsRead: (userId: string) => Promise<void>
  getNotificationsByUser: (userId: string) => Notification[]
  reset: () => void
  
  // Internal lock for resync operations (helps with HMR stability)
  _resyncLock: Promise<void> | null
  // Real-time Subscriptions Status
  realtimeStatus: Record<string, string>
}

export const useNotificationStore = create<NotificationState>()((set, get) => ({
  notifications: [],
  isLoading: true,
  realtimeStatus: {},
  _resyncLock: null,

  subscribeNotifications: async (userId: string) => {
    // 1. Initial Load from Local Cache (Mirroring)
    getCachedNotifications(userId).then(cached => {
      if (cached.length > 0) {
        set({ notifications: cached, isLoading: false })
      }
    })

    // 2. Fetch Latest from Supabase
    supabase.from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('sent_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        if (data) {
          const fetched = data as Notification[]
          set({ notifications: fetched, isLoading: false })
          cacheNotifications(fetched)
        }
      })

    const channelId = `notifications:user:${userId}`
    
    // 3. FAST DEDUPLICATION
    const existing = notifChannels.get(channelId)
    if (existing && (notifStates.get(channelId) === 'joined' || notifStates.get(channelId) === 'joining')) {
      return () => {} // Already active or connecting
    }

    // 4. CLEANUP PREVIOUS IF EXISTS (Awaited)
    if (existing) {
      console.log(`♻️ Cleaning up existing notification channel for ${userId}...`)
      await supabase.removeChannel(existing)
      notifChannels.delete(channelId)
    }

    console.log(`📡 Initializing stable notifications for ${userId}...`)
    notifStates.set(channelId, 'joining')

    const channel = supabase.channel(channelId)
    let heartbeatInterval: any = null

    channel.on(
        'postgres_changes',
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
              notifications: updated.sort((a,b) => new Date(b.sent_at || 0).getTime() - new Date(a.sent_at || 0).getTime()) 
            }
          })
        }
      )

    notifChannels.set(channelId, channel)

    channel.subscribe((status, err) => {
      if (status === 'SUBSCRIBED') {
        console.log(`✅ Realtime notifications active for ${channelId}`)
        notifStates.set(channelId, 'joined')
        set(state => ({ realtimeStatus: { ...state.realtimeStatus, [channelId]: 'joined' } }))
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        console.warn(`❌ Realtime notifications ${channelId} ${status}:`, err)
        const finalStatus = status === 'CLOSED' ? 'closed' : 'errored'
        notifStates.set(channelId, finalStatus)
        set(state => ({ realtimeStatus: { ...state.realtimeStatus, [channelId]: finalStatus } }))
        // Clean up singleton Map to allow recovery
        notifChannels.delete(channelId)
      }
    })

    return () => { 
      supabase.removeChannel(channel)
      notifChannels.delete(channelId)
      notifStates.delete(channelId)
    }
  },

  subscribeAllNotifications: async () => {
    // Admins usually see everything
    supabase.from('notifications')
      .select('*')
      .order('sent_at', { ascending: false })
      .then(({ data }) => {
        if (data) set({ notifications: data as Notification[], isLoading: false })
      })

    const channelId = 'notifications:all'
    
    // 1. FAST DEDUPLICATION
    const existing = notifChannels.get(channelId)
    if (existing && (notifStates.get(channelId) === 'joined' || notifStates.get(channelId) === 'joining')) {
      return () => {} // Already active or connecting
    }

    // 2. CLEANUP PREVIOUS IF EXISTS (Awaited)
    if (existing) {
      console.log(`♻️ Cleaning up existing admin notification channel...`)
      await supabase.removeChannel(existing)
      notifChannels.delete(channelId)
    }

    console.log(`📡 Initializing stable admin notifications...`)
    notifStates.set(channelId, 'joining')

    const channel = supabase.channel(channelId)
    let heartbeatInterval: any = null

    channel.on(
        'postgres_changes',
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
              notifications: updated.sort((a,b) => new Date(b.sent_at || 0).getTime() - new Date(a.sent_at || 0).getTime()) 
            }
          })
        }
      )

    notifChannels.set(channelId, channel)

    channel.subscribe((status, err) => {
      if (status === 'SUBSCRIBED') {
        console.log(`✅ Admin notifications active: ${channelId}`)
        notifStates.set(channelId, 'joined')
        set(state => ({ realtimeStatus: { ...state.realtimeStatus, [channelId]: 'joined' } }))
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        console.warn(`❌ Admin notifications ${channelId} ${status}:`, err)
        const finalStatus = status === 'CLOSED' ? 'closed' : 'errored'
        notifStates.set(channelId, finalStatus)
        set(state => ({ realtimeStatus: { ...state.realtimeStatus, [channelId]: finalStatus } }))
        notifChannels.delete(channelId)
      }
    })

    return () => { 
      supabase.removeChannel(channel)
      notifChannels.delete(channelId)
      notifStates.delete(channelId)
    }
  },

  resyncRealtime: async (userId, options) => {
    // 1. Operation Lock: Prevent parallel resyncs (HMR friendly)
    if (get()._resyncLock) {
      console.log('⏳ Notification store resync already in progress, skipping duplicate call.')
      return get()._resyncLock as Promise<void>
    }

    const resyncPromise = (async () => {
      try {
        const now = Date.now()
        if (!options?.force && (now - notifResyncTime < 30000)) {
          console.log('⏳ Skipping notification resync (cooldown active)')
          return
        }
        notifResyncTime = now

        if (options?.force) {
          console.log('🔄 Forced notifications resync triggered...')
        } else {
          console.log('🔄 Resyncing notifications...')
        }
        
        // 1. Data Gap Fill
        let query = supabase.from('notifications').select('*')
        if (userId) {
          query = query.eq('user_id', userId)
        }
        
        const { data } = await query.order('sent_at', { ascending: false }).limit(50)
        
        if (data) {
          const fetched = data as Notification[]
          set({ notifications: fetched })
          if (userId) cacheNotifications(fetched)
        }

        // 2. WebSocket Recovery
        const channelId = userId ? `notifications:user:${userId}` : 'notifications:all'
        const channelState = notifStates.get(channelId)
        
        if (channelState === 'closed' || channelState === 'errored' || !notifChannels.has(channelId)) {
          console.warn(`⚠️ [NotificationStore] Connection dead (${channelState}). Re-subscribing...`)
          if (userId) await get().subscribeNotifications(userId)
          else await get().subscribeAllNotifications()
        }
      } finally {
        set({ _resyncLock: null })
      }
    })()

    set({ _resyncLock: resyncPromise })
    return resyncPromise
  },

  addNotification: async (data: Omit<Notification, 'id' | 'sent_at' | 'is_read'>) => {
    const newNotification: any = {
      ...data,
      is_read: false,
      sent_at: new Date().toISOString(),
      type: data.type || 'manual_alert',
      fcm_status: data.fcm_status || 'pending'
    }
    
    await supabase.from('notifications').insert(newNotification)
  },

  markAsRead: async (id) => {
    markNotificationReadLocal(id)
    await (supabase.from('notifications') as any).update({ is_read: true }).eq('id', id)
  },

  markAllAsRead: async (userId) => {
    await (supabase.from('notifications') as any).update({ is_read: true }).eq('user_id', userId).eq('is_read', false)
  },

  getNotificationsByUser: (userId) => {
    return get().notifications.filter(n => n.user_id === userId)
  },
  reset: () => set({ notifications: [], isLoading: false })
}))
