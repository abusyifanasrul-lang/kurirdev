import { create } from 'zustand'
import { supabase } from '@/lib/supabaseClient'
import { Notification } from '@/types'
import { cacheNotifications, getCachedNotifications, markNotificationReadLocal } from '@/lib/orderCache'

// Module-level tracker for active channels
const activeChannels = new Map<string, any>()

interface NotificationState {
  notifications: Notification[]
  isLoading: boolean

  subscribeNotifications: (userId: string) => () => void
  subscribeAllNotifications: () => () => void
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
          // 3. Update Mirror
          cacheNotifications(fetched)
        }
      })

    const instanceId = Date.now()
    const channelBaseName = `notifications:user:${userId}`
    const channelId = `${channelBaseName}:${instanceId}`
    
    // Cleanup overlapping
    activeChannels.forEach((ch, key) => {
      if (key.startsWith(channelBaseName)) {
        console.log(`📡 Cleaning up overlapping notification channel ${key}...`)
        supabase.removeChannel(ch)
        activeChannels.delete(key)
      }
    })

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
        console.log(`✅ Realtime subscription active for ${channelId}`)
        activeChannels.set(channelId, channel)

        // HEARTBEAT
        if (heartbeatInterval) clearInterval(heartbeatInterval)
        heartbeatInterval = setInterval(() => {
          channel.send({
            type: 'broadcast',
            event: 'heartbeat',
            payload: { t: Date.now() }
          })
        }, 30000)

      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        console.error(`❌ Realtime notifications ${status} for ${channelId}:`, err)
        if (heartbeatInterval) clearInterval(heartbeatInterval)
        
        const currentChannel = activeChannels.get(channelId)
        if (currentChannel) {
          console.log(`♻️ Auto-reconnecting notification channel ${channelBaseName}...`)
          supabase.removeChannel(currentChannel)
          activeChannels.delete(channelId)
          
          setTimeout(() => {
            get().subscribeNotifications(userId)
          }, status === 'TIMED_OUT' ? 2000 : 5000)
        }
      }
    })

    return () => { 
      if (heartbeatInterval) clearInterval(heartbeatInterval)
      supabase.removeChannel(channel)
      activeChannels.delete(channelId)
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

    const instanceId = Date.now()
    const channelBaseName = 'notifications:all'
    const channelId = `${channelBaseName}:${instanceId}`
    
    // Cleanup overlapping
    activeChannels.forEach((ch, key) => {
      if (key.startsWith(channelBaseName)) {
        console.log(`📡 Cleaning up overlapping admin notification channel ${key}...`)
        supabase.removeChannel(ch)
        activeChannels.delete(key)
      }
    })

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
        console.log(`✅ Realtime subscription active for ${channelId}`)
        activeChannels.set(channelId, channel)

        // HEARTBEAT
        if (heartbeatInterval) clearInterval(heartbeatInterval)
        heartbeatInterval = setInterval(() => {
          channel.send({
            type: 'broadcast',
            event: 'heartbeat',
            payload: { t: Date.now() }
          })
        }, 30000)

      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        console.error(`❌ Realtime admin notifications ${status} for ${channelId}:`, err)
        if (heartbeatInterval) clearInterval(heartbeatInterval)
        
        const currentChannel = activeChannels.get(channelId)
        if (currentChannel) {
          console.log(`♻️ Auto-reconnecting admin notification channel ${channelBaseName}...`)
          supabase.removeChannel(currentChannel)
          activeChannels.delete(channelId)
          
          setTimeout(() => {
            get().subscribeAllNotifications()
          }, status === 'TIMED_OUT' ? 2000 : 5000)
        }
      }
    })

    return () => { 
      if (heartbeatInterval) clearInterval(heartbeatInterval)
      supabase.removeChannel(channel)
      activeChannels.delete(channelId)
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
