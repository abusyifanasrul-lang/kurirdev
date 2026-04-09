import { create } from 'zustand'
import { supabase } from '@/lib/supabaseClient'
import { Notification } from '@/types'
import { cacheNotifications, getCachedNotifications, markNotificationReadLocal } from '@/lib/orderCache'

// Module-level tracker for active channels
const activeChannels = new Map<string, any>()
const channelStates = new Map<string, 'joining' | 'joined' | 'errored'>()
let lastResyncTime = 0

interface NotificationState {
  notifications: Notification[]
  isLoading: boolean

  subscribeNotifications: (userId: string) => () => void
  subscribeAllNotifications: () => () => void
  resyncRealtime: (userId?: string) => Promise<void>
  addNotification: (notification: Omit<Notification, 'id' | 'sent_at' | 'is_read'>) => Promise<void>
  markAsRead: (id: string) => Promise<void>
  markAllAsRead: (userId: string) => Promise<void>
  getNotificationsByUser: (userId: string) => Notification[]
  reset: () => void
}

export const useNotificationStore = create<NotificationState>()((set, get) => ({
  notifications: [],
  isLoading: true,

  subscribeNotifications: (userId: string) => {
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
    const existing = activeChannels.get(channelId)
    if (existing && (channelStates.get(channelId) === 'joined' || channelStates.get(channelId) === 'joining')) {
      return () => {} // Already active or connecting
    }

    // 4. CLEANUP PREVIOUS IF ERRORED
    if (existing) {
      supabase.removeChannel(existing)
      activeChannels.delete(channelId)
    }

    console.log(`📡 Initializing stable notifications for ${userId}...`)
    channelStates.set(channelId, 'joining')

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

    activeChannels.set(channelId, channel)

    channel.subscribe((status, err) => {
      if (status === 'SUBSCRIBED') {
        console.log(`✅ Realtime notifications active for ${channelId}`)
        channelStates.set(channelId, 'joined')
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        console.warn(`❌ Realtime notifications ${channelId} ${status}:`, err)
        channelStates.set(channelId, status === 'CLOSED' ? 'closed' : 'errored')
        // Clean up singleton Map to allow recovery
        activeChannels.delete(channelId)
      }
    })

    return () => { 
      supabase.removeChannel(channel)
      activeChannels.delete(channelId)
      channelStates.delete(channelId)
    }
  },

  subscribeAllNotifications: () => {
    // Admins usually see everything
    supabase.from('notifications')
      .select('*')
      .order('sent_at', { ascending: false })
      .then(({ data }) => {
        if (data) set({ notifications: data as Notification[], isLoading: false })
      })

    const channelId = 'notifications:all'
    
    // 1. FAST DEDUPLICATION
    const existing = activeChannels.get(channelId)
    if (existing && (channelStates.get(channelId) === 'joined' || channelStates.get(channelId) === 'joining')) {
      return () => {} // Already active or connecting
    }

    // 2. CLEANUP PREVIOUS IF ERRORED
    if (existing) {
      supabase.removeChannel(existing)
      activeChannels.delete(channelId)
    }

    console.log(`📡 Initializing stable admin notifications...`)
    channelStates.set(channelId, 'joining')

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

    activeChannels.set(channelId, channel)

    channel.subscribe((status, err) => {
      if (status === 'SUBSCRIBED') {
        console.log(`✅ Admin notifications active: ${channelId}`)
        channelStates.set(channelId, 'joined')
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        console.warn(`❌ Admin notifications ${channelId} ${status}:`, err)
        channelStates.set(channelId, status === 'CLOSED' ? 'closed' : 'errored')
        activeChannels.delete(channelId)
      }
    })

    return () => { 
      supabase.removeChannel(channel)
      activeChannels.delete(channelId)
      channelStates.delete(channelId)
    }
  },

  resyncRealtime: async (userId?: string) => {
    const now = Date.now()
    if (now - lastResyncTime < 30000) {
      console.log('⏳ Skipping notification resync (cooldown active)')
      return
    }
    lastResyncTime = now

    console.log('🔄 Resyncing notifications...')
    
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
    const state = channelStates.get(channelId)
    
    if (state === 'closed' || state === 'errored' || !activeChannels.has(channelId)) {
      console.warn(`⚠️ [NotificationStore] Connection dead (${state}). Re-subscribing...`)
      activeChannels.delete(channelId)
      if (userId) get().subscribeNotifications(userId)
      else get().subscribeAllNotifications()
    }
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
