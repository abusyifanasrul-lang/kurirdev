import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Notification } from '@/types';

interface NotificationState {
    notifications: Notification[];
    unreadCount: number;

    addNotification: (notification: Omit<Notification, 'id' | 'sent_at' | 'is_read'>) => void;
    markAsRead: (id: number) => void;
    markAllAsRead: () => void;
    getNotificationsByUser: (userId: number) => Notification[];
}

export const useNotificationStore = create<NotificationState>()(
    persist(
        (set, get) => ({
            notifications: [],
            unreadCount: 0,

            addNotification: (data) =>
                set((state) => {
                    const newNotification: Notification = {
                        id: Date.now(),
                        ...data,
                        is_read: false,
                        sent_at: new Date().toISOString(),
                    };
                    return {
                        notifications: [newNotification, ...state.notifications],
                        unreadCount: state.unreadCount + 1,
                    };
                }),

            markAsRead: (id) =>
                set((state) => {
                    const notification = state.notifications.find((n) => n.id === id);
                    if (notification && !notification.is_read) {
                        return {
                            notifications: state.notifications.map((n) =>
                                n.id === id ? { ...n, is_read: true } : n
                            ),
                            unreadCount: Math.max(0, state.unreadCount - 1),
                        };
                    }
                    return state;
                }),

            markAllAsRead: () =>
                set((state) => ({
                    notifications: state.notifications.map((n) => ({ ...n, is_read: true })),
                    unreadCount: 0,
                })),

            getNotificationsByUser: (userId) => {
                return get().notifications.filter(n => n.user_id === userId);
            }
        }),
        {
            name: 'notification-storage',
        }
    )
);
