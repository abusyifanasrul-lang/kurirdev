import { useMemo } from 'react';
import { useOrderStore } from '@/stores/useOrderStore';
import { useNotificationStore } from '@/stores/useNotificationStore';
import { useUserStore } from '@/stores/useUserStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useCustomerStore } from '@/stores/useCustomerStore';

export type RealtimeHealthStatus = 'healthy' | 'degraded' | 'disconnected' | 'joining';

export interface ChannelInfo {
  id: string;
  store: string;
  status: string;
  isCritical: boolean;
}

export const useRealtimeHealth = () => {
  const orderStatus = useOrderStore((state) => state.realtimeStatus);
  const notifStatus = useNotificationStore((state) => state.realtimeStatus);
  const userStatus = useUserStore((state) => state.realtimeStatus);
  const settingsStatus = useSettingsStore((state) => state.realtimeStatus);
  const customerStatus = useCustomerStore((state) => state.realtimeStatus);

  const channels = useMemo(() => {
    const allChannels: ChannelInfo[] = [];

    // Order Channels
    Object.entries(orderStatus).forEach(([id, status]) => {
      allChannels.push({ id, store: 'Orders', status, isCritical: true });
    });

    // Notification Channels
    Object.entries(notifStatus).forEach(([id, status]) => {
      allChannels.push({ id, store: 'Notifications', status, isCritical: true });
    });

    // User Channels
    Object.entries(userStatus).forEach(([id, status]) => {
      allChannels.push({ id, store: 'Users', status, isCritical: false });
    });

    // Settings Channels
    Object.entries(settingsStatus).forEach(([id, status]) => {
      allChannels.push({ id, store: 'Settings', status, isCritical: false });
    });

    // Customer Channels
    Object.entries(customerStatus).forEach(([id, status]) => {
      allChannels.push({ id, store: 'Customers', status, isCritical: false });
    });

    return allChannels;
  }, [orderStatus, notifStatus, userStatus, settingsStatus, customerStatus]);

  const stats = useMemo(() => {
    const total = channels.length;
    const joined = channels.filter((c) => c.status === 'joined').length;
    const joining = channels.filter((c) => c.status === 'joining').length;
    const errored = channels.filter((c) => c.status === 'errored' || c.status === 'closed').length;

    let overall: RealtimeHealthStatus = 'healthy';
    
    if (total === 0) {
      overall = 'joining';
    } else if (errored === total) {
      overall = 'disconnected';
    } else if (errored > 0 || joining > 0) {
      overall = 'degraded';
    }

    return {
      total,
      joined,
      joining,
      errored,
      overall,
    };
  }, [channels]);

  return {
    channels,
    ...stats,
  };
};
