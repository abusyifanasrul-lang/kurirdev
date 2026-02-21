import { Bell, CheckCircle } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useNotificationStore } from '@/stores/useNotificationStore';
import { useAuth } from '@/context/AuthContext';

export function CourierNotifications() {
    const { user } = useAuth();
    const { notifications, markAsRead } = useNotificationStore();

    const myNotifications = notifications
        .filter(n => n.user_id === user?.id)
        .sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime());

    const handleMarkAsRead = (id: string) => {
        markAsRead(id);
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
                <h1 className="text-xl font-bold text-gray-900">Notifications</h1>
                {/* Optional: Mark all read button */}
            </div>

            <div className="space-y-3">
                {myNotifications.length === 0 ? (
                    <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 text-center">
                        <Bell className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500">No notifications</p>
                    </div>
                ) : (
                    myNotifications.map((notif) => (
                        <div
                            key={notif.id}
                            onClick={() => handleMarkAsRead(notif.id)}
                            className={`bg-white rounded-2xl p-4 shadow-sm border transition-colors cursor-pointer ${notif.is_read ? 'border-gray-100' : 'border-blue-200 bg-blue-50/30'
                                }`}
                        >
                            <div className="flex items-start gap-3">
                                <div className={`p-2 rounded-full flex-shrink-0 ${notif.is_read ? 'bg-gray-100 text-gray-500' : 'bg-blue-100 text-blue-600'
                                    }`}>
                                    <Bell className="h-5 w-5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-2 mb-1">
                                        <p className={`text-sm font-semibold ${notif.is_read ? 'text-gray-900' : 'text-blue-900'}`}>
                                            {notif.title}
                                        </p>
                                        <span className="text-xs text-gray-400 whitespace-nowrap">
                                            {format(parseISO(notif.sent_at), 'MMM dd, HH:mm')}
                                        </span>
                                    </div>
                                    <p className={`text-sm ${notif.is_read ? 'text-gray-600' : 'text-blue-800'}`}>
                                        {notif.body}
                                    </p>

                                    {!notif.is_read && (
                                        <div className="mt-2 flex items-center text-xs text-blue-600 font-medium">
                                            <CheckCircle className="w-3 h-3 mr-1" />
                                            Tap to mark as read
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
