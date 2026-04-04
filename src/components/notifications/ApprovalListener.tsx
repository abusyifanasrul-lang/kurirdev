import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/context/AuthContext';
import { CustomerChangeRequest } from '@/types';
import { ApprovalNotification } from './ApprovalNotification';

export function ApprovalListener() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<CustomerChangeRequest[]>([]);

  // Only admins, owners, and admin_kurir should listen
  const canListen = user?.role === 'admin' || user?.role === 'owner' || user?.role === 'admin_kurir';

  useEffect(() => {
    if (!canListen) return;

    // 1. Initial check for any unhandled requests (optional, but good for persistence)
    // For now, we only focus on REALTIME notifications as requested.

    // 2. Subscribe to new inserts
    const channel = supabase
      .channel('customer_change_requests_changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'customer_change_requests',
          filter: `status=eq.pending`
        },
        async (payload) => {
          const newRequest = payload.new as any;
          
          // Fetch additional details (names, order number) for the notification
          // We do this because the payload only contains ID fields
          const { data, error } = await supabase
            .from('customer_change_requests')
            .select(`
              *,
              customers(name),
              profiles:requester_id(name),
              orders:order_id(order_number)
            `)
            .eq('id', newRequest.id)
            .single();

          if (!error && data) {
            const typedRequest = data as any;
            const notification: CustomerChangeRequest = {
              ...data,
              customer_name: typedRequest.customers?.name,
              requester_name: typedRequest.profiles?.name,
              order_number: typedRequest.orders?.order_number
            } as any;

            setNotifications(prev => [notification, ...prev]);
            
            // Auto-hide after 15 seconds if ignored
            setTimeout(() => {
                setNotifications(prev => prev.filter(n => n.id !== notification.id));
            }, 15000);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [canListen]);

  if (notifications.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 pointer-events-none">
      {notifications.map((n) => (
        <div key={n.id} className="pointer-events-auto">
          <ApprovalNotification
            orderNumber={n.order_number}
            requesterName={n.requester_name}
            onClose={() => setNotifications(prev => prev.filter(req => req.id !== n.id))}
          />
        </div>
      ))}
    </div>
  );
}
