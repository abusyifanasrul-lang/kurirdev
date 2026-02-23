import { create } from 'zustand'
import { db } from '@/lib/firebase'
import {
  collection, doc, setDoc, updateDoc,
  onSnapshot, query, where, orderBy
} from 'firebase/firestore'
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
}

export const useNotificationStore = create<NotificationState>()((set, get) => ({
  notifications: [],
  isLoading: true,

  subscribeNotifications: (userId: string) => {
    const q = query(
      collection(db, 'notifications'),
      where('user_id', '==', userId)
    )
    const unsub = onSnapshot(q, (snapshot) => {
      const notifications = snapshot.docs
        .map(d => d.data() as Notification)
        .sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime())
      set({ notifications, isLoading: false })
    })
    return unsub
  },

  subscribeAllNotifications: () => {
    const q = query(
      collection(db, 'notifications'),
      orderBy('sent_at', 'desc')
    )
    const unsub = onSnapshot(q, (snapshot) => {
      const notifications = snapshot.docs
        .map(d => d.data() as Notification)
      set({ notifications, isLoading: false })
    })
    return unsub
  },

  addNotification: async (data) => {
    const newNotification: Notification = {
      id: crypto.randomUUID(),
      ...data,
      is_read: false,
      sent_at: new Date().toISOString(),
    }
    await setDoc(doc(db, 'notifications', newNotification.id), newNotification)
  },

  markAsRead: async (id) => {
    await updateDoc(doc(db, 'notifications', id), { is_read: true })
  },

  markAllAsRead: async (userId) => {
    const unread = get().notifications.filter(
      n => n.user_id === userId && !n.is_read
    )
    await Promise.all(
      unread.map(n => updateDoc(doc(db, 'notifications', n.id), { is_read: true }))
    )
  },

  getNotificationsByUser: (userId) => {
    return get().notifications.filter(n => n.user_id === userId)
  }
}))
