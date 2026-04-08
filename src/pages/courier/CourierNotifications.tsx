import { useEffect } from 'react';
import { Bell, CheckCircle, Clock } from 'lucide-react';
import { cn } from '@/utils/cn';
import { Badge } from '@/components/ui/Badge';
import { format, parseISO } from 'date-fns';
import { useNotificationStore } from '@/stores/useNotificationStore';
import { useAuth } from '@/context/AuthContext';

export function CourierNotifications() {
    const { user } = useAuth();
    const { notifications, markAsRead, markAllAsRead, subscribeNotifications } = useNotificationStore();

    useEffect(() => {
        if (!user?.id) return
        const unsub = subscribeNotifications(user.id)
        return () => unsub()
    }, [user?.id])

    const myNotifications = notifications
        .filter(n => n.user_id === user?.id)
        .sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime());

    const handleMarkAsRead = async (id: string) => {
        await markAsRead(id);
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between px-1">
                <h1 className="text-xl font-black text-gray-900 uppercase tracking-tight">Notifikasi</h1>
                {myNotifications.some(n => !n.is_read) && (
                    <button
                        onClick={() => user?.id && markAllAsRead(user.id)}
                        className="flex items-center gap-1.5 text-[10px] font-black text-emerald-700 bg-emerald-50 border border-emerald-100 hover:bg-emerald-100 px-4 py-2.5 rounded-2xl transition-all active:scale-95 shadow-sm uppercase tracking-widest"
                    >
                        <CheckCircle className="w-3.5 h-3.5" />
                        BACA SEMUA
                    </button>
                )}
            </div>

            <div className="space-y-4">
                {myNotifications.length === 0 ? (
                    <div className="bg-white rounded-[2.5rem] p-16 shadow-sm border border-gray-100 text-center">
                        <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-5 border border-gray-100">
                            <Bell className="h-10 w-10 text-gray-200" />
                        </div>
                        <p className="text-sm font-black text-gray-400 uppercase tracking-tight">KOSONG</p>
                        <p className="text-[11px] text-gray-400 mt-1 font-medium">Belum ada pemberitahuan baru</p>
                    </div>
                ) : (
                    myNotifications.map((notif) => (
                        <button
                            key={notif.id}
                            onClick={() => handleMarkAsRead(notif.id)}
                            className={cn(
                                "w-full text-left bg-white rounded-3xl p-5 shadow-sm border transition-all active:scale-[0.98] group",
                                notif.is_read 
                                    ? 'border-gray-100/70 hover:border-emerald-200 opacity-90' 
                                    : 'border-emerald-100 bg-emerald-50/20 shadow-xl shadow-emerald-500/5'
                            )}
                        >
                            <div className="flex items-start gap-4">
                                <div className={cn(
                                    "p-3.5 rounded-2xl flex-shrink-0 border transition-all",
                                    notif.is_read 
                                        ? 'bg-gray-50 text-gray-300 border-gray-100' 
                                        : 'bg-emerald-100 text-emerald-600 border-emerald-200 scale-105'
                                )}>
                                    <Bell className="h-5 w-5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-2 mb-1">
                                        <p className={cn(
                                            "text-base font-black transition-colors tracking-tight",
                                            notif.is_read ? 'text-gray-700' : 'text-emerald-900'
                                        )}>
                                            {notif.title}
                                        </p>
                                        {!notif.is_read && (
                                            <Badge variant="secondary" className="text-[9px] border-emerald-100 text-emerald-600 font-black bg-emerald-50 px-2 h-5 uppercase tracking-widest">BARU</Badge>
                                        )}
                                    </div>
                                    <p className={cn(
                                        "text-xs leading-relaxed transition-colors",
                                        notif.is_read ? 'text-gray-500' : 'text-emerald-800/90 font-bold'
                                    )}>
                                        {notif.message}
                                    </p>

                                    <div className="mt-4 pt-4 border-t border-gray-50 flex items-center justify-between">
                                        <div className="flex items-center gap-1.5 text-[10px] font-black text-gray-400 uppercase tracking-[0.15em]">
                                            <Clock className="w-3.5 h-3.5" />
                                            {format(parseISO(notif.sent_at), 'MMM dd, HH:mm')}
                                        </div>
                                        
                                        {!notif.is_read && (
                                            <div className="flex items-center text-[10px] text-emerald-600 font-black uppercase tracking-widest bg-emerald-50/80 px-3 py-1 rounded-lg border border-emerald-100">
                                                <CheckCircle className="w-3 h-3 mr-1.5" />
                                                TAP UNTUK BACA
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </button>
                    ))
                )}
            </div>
        </div>
    );
}
