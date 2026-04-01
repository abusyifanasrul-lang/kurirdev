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

    const channel = supabase.channel(`public:notifications:user_id=eq.${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        (payload) => {
          const { eventType, new: newRec, old: oldRec } = payload
          const notifications = [...get().notifications]
          
          if (eventType === 'INSERT') {
            notifications.unshift(newRec as Notification)
          } else if (eventType === 'UPDATE') {
            const idx = notifications.findIndex(n => n.id === newRec.id)
            if (idx !== -1) notifications[idx] = { ...notifications[idx], ...newRec }
          } else if (eventType === 'DELETE') {
            const idx = notifications.findIndex(n => n.id === oldRec.id)
            if (idx !== -1) notifications.splice(idx, 1)
          }
          
          set({ 
            notifications: notifications.sort((a,b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime()) 
          })
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  },

  subscribeAllNotifications: () => {
    // Admins usually see everything, but this wasn't strictly filtered by role in firebase either
    supabase.from('notifications')
      .select('*')
      .order('sent_at', { ascending: false })
      .then(({ data }) => {
        if (data) set({ notifications: data as Notification[], isLoading: false })
      })

    const channel = supabase.channel(`public:notifications:all`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications' },
        (payload) => {
          const { eventType, new: newRec, old: oldRec } = payload
          const notifications = [...get().notifications]
          
          if (eventType === 'INSERT') {
            notifications.unshift(newRec as Notification)
          } else if (eventType === 'UPDATE') {
            const idx = notifications.findIndex(n => n.id === newRec.id)
            if (idx !== -1) notifications[idx] = { ...notifications[idx], ...newRec }
          } else if (eventType === 'DELETE') {
            const idx = notifications.findIndex(n => n.id === oldRec.id)
            if (idx !== -1) notifications.splice(idx, 1)
          }
          
          set({ 
            notifications: notifications.sort((a,b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime()) 
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
