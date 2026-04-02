import { create } from 'zustand'
import { supabase } from '@/lib/supabaseClient'
import { Notification } from '@/types'

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
    // Initial fetch
    supabase.from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('sent_at', { ascending: false })
      .then(({ data }) => {
        if (data) set({ notifications: data as Notification[], isLoading: false })
      })

    // Use a unique channel name for each subscription call to avoid "cannot add callbacks after subscribe" error
    // when multiple components (Layout + Page) subscribe simultaneously.
    const channelId = `notif_user_${userId}_${Math.random().toString(36).substring(7)}`
    const channel = supabase.channel(channelId)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        (payload) => {
          const { eventType, new: newRec, old: oldRec } = payload
          const notifications = [...get().notifications]
          
          if (eventType === 'INSERT') {
            // Prevent duplicates if multiple channels receive the same event
            if (!notifications.some(n => n.id === newRec.id)) {
              notifications.unshift(newRec as Notification)
            }
          } else if (eventType === 'UPDATE') {
            const idx = notifications.findIndex(n => n.id === newRec.id)
            if (idx !== -1) {
              notifications[idx] = { ...notifications[idx], ...newRec }
            } else {
              // If not found (maybe first subscription missed it), add it
              notifications.unshift(newRec as Notification)
            }
          } else if (eventType === 'DELETE') {
            const idx = notifications.findIndex(n => n.id === oldRec.id)
            if (idx !== -1) notifications.splice(idx, 1)
          }
          
          set({ 
            notifications: notifications.sort((a,b) => new Date(b.sent_at || 0).getTime() - new Date(a.sent_at || 0).getTime()) 
          })
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  },

  subscribeAllNotifications: () => {
    // Admins usually see everything
    supabase.from('notifications')
      .select('*')
      .order('sent_at', { ascending: false })
      .then(({ data }) => {
        if (data) set({ notifications: data as Notification[], isLoading: false })
      })

    const channelId = `notif_all_${Math.random().toString(36).substring(7)}`
    const channel = supabase.channel(channelId)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications' },
        (payload) => {

          const { eventType, new: newRec, old: oldRec } = payload
          const notifications = [...get().notifications]
          
          if (eventType === 'INSERT') {
            if (!notifications.some(n => n.id === newRec.id)) {
              notifications.unshift(newRec as Notification)
            }
          } else if (eventType === 'UPDATE') {
            const idx = notifications.findIndex(n => n.id === newRec.id)
            if (idx !== -1) {
              notifications[idx] = { ...notifications[idx], ...newRec }
            } else {
              notifications.unshift(newRec as Notification)
            }
          } else if (eventType === 'DELETE') {
            const idx = notifications.findIndex(n => n.id === oldRec.id)
            if (idx !== -1) notifications.splice(idx, 1)
          }
          
          set({ 
            notifications: notifications.sort((a,b) => new Date(b.sent_at || 0).getTime() - new Date(a.sent_at || 0).getTime()) 
          })
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  },

  addNotification: async (data) => {
    const newNotification: Partial<Notification> = {
      ...data,
      is_read: false,
      sent_at: new Date().toISOString(),
    }
    
    await supabase.from('notifications').insert(newNotification)
  },

  markAsRead: async (id) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id)
  },

  markAllAsRead: async (userId) => {
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', userId).eq('is_read', false)
  },

  getNotificationsByUser: (userId) => {
    return get().notifications.filter(n => n.user_id === userId)
  },
  reset: () => set({ notifications: [], isLoading: false })
}))
