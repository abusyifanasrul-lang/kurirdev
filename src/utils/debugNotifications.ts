/**
 * Debug Utilities for Courier Notification System
 * 
 * Usage:
 * 1. Import in browser console: import { debugNotifications } from './utils/debugNotifications'
 * 2. Run checks: await debugNotifications.checkAll()
 * 3. Test specific courier: await debugNotifications.testCourierToken('courier-id')
 */

import { supabase } from '@/lib/supabaseClient';

export const debugNotifications = {
  /**
   * Check if courier has valid FCM token
   */
  async checkCourierToken(courierId: string) {
    console.group('🔍 Checking Courier FCM Token');
    
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('id, name, fcm_token, fcm_token_updated_at, platform, is_active, is_online')
      .eq('id', courierId)
      .single();

    if (error) {
      console.error('❌ Error fetching profile:', error);
      console.groupEnd();
      return { success: false, error };
    }

    const hasToken = !!profile.fcm_token;
    const tokenAge = profile.fcm_token_updated_at 
      ? Math.floor((Date.now() - new Date(profile.fcm_token_updated_at).getTime()) / 1000 / 60 / 60)
      : null;

    console.log('Courier:', profile.name);
    console.log('Has Token:', hasToken ? '✅ YES' : '❌ NO');
    console.log('Token Age:', tokenAge ? `${tokenAge} hours` : 'N/A');
    console.log('Platform:', profile.platform || 'Unknown');
    console.log('Is Active:', profile.is_active ? '✅' : '❌');
    console.log('Is Online:', profile.is_online ? '✅' : '❌');
    
    if (hasToken && tokenAge && tokenAge > 168) {
      console.warn('⚠️ Token is older than 7 days, may need refresh');
    }

    console.groupEnd();
    return { success: true, profile, hasToken, tokenAge };
  },

  /**
   * Check notifications for a specific order
   */
  async checkOrderNotifications(orderId: string) {
    console.group('🔍 Checking Order Notifications');
    
    const { data: notifications, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('data->>order_id', orderId)
      .order('sent_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching notifications:', error);
      console.groupEnd();
      return { success: false, error };
    }

    console.log(`Found ${notifications.length} notification(s)`);
    
    notifications.forEach((notif, index) => {
      console.group(`Notification ${index + 1}`);
      console.log('Title:', notif.title);
      console.log('Sent At:', notif.sent_at);
      console.log('FCM Status:', notif.fcm_status || 'pending');
      console.log('FCM Error:', notif.fcm_error || 'none');
      console.log('Is Read:', notif.is_read ? '✅' : '❌');
      console.groupEnd();
    });

    console.groupEnd();
    return { success: true, notifications };
  },

  /**
   * Check recent notification delivery status
   */
  async checkRecentDeliveryStatus() {
    console.group('🔍 Checking Recent Notification Delivery');
    
    const { data: notifications, error } = await supabase
      .from('notifications')
      .select('id, title, fcm_status, fcm_error, sent_at, user_id')
      .gte('sent_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('sent_at', { ascending: false })
      .limit(20);

    if (error) {
      console.error('❌ Error fetching notifications:', error);
      console.groupEnd();
      return { success: false, error };
    }

    const statusCounts = notifications.reduce((acc, n) => {
      const status = n.fcm_status || 'pending';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    console.log('Total Notifications (24h):', notifications.length);
    console.log('Status Breakdown:', statusCounts);
    
    const failed = notifications.filter(n => n.fcm_status === 'failed');
    if (failed.length > 0) {
      console.group(`❌ Failed Notifications (${failed.length})`);
      failed.forEach(n => {
        console.log(`- ${n.title}: ${n.fcm_error}`);
      });
      console.groupEnd();
    }

    const skipped = notifications.filter(n => n.fcm_status === 'skipped');
    if (skipped.length > 0) {
      console.group(`⚠️ Skipped Notifications (${skipped.length})`);
      skipped.forEach(n => {
        console.log(`- ${n.title}: ${n.fcm_error}`);
      });
      console.groupEnd();
    }

    console.groupEnd();
    return { success: true, notifications, statusCounts };
  },

  /**
   * Test notification creation for a courier
   */
  async sendTestNotification(courierId: string) {
    console.group('🧪 Sending Test Notification');
    
    const { data, error } = await supabase
      .from('notifications')
      .insert({
        user_id: courierId,
        title: '🧪 Test Notification',
        message: 'This is a test notification from debug utility',
        type: 'test',
        data: { test: true, timestamp: new Date().toISOString() }
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Error creating notification:', error);
      console.groupEnd();
      return { success: false, error };
    }

    console.log('✅ Test notification created:', data.id);
    console.log('Waiting 5 seconds for FCM delivery...');
    
    // Wait and check status
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    const { data: updated } = await supabase
      .from('notifications')
      .select('fcm_status, fcm_error')
      .eq('id', data.id)
      .single();

    console.log('FCM Status:', updated?.fcm_status || 'pending');
    if (updated?.fcm_error) {
      console.error('FCM Error:', updated.fcm_error);
    }

    console.groupEnd();
    return { success: true, notification: data, status: updated };
  },

  /**
   * Check database triggers status
   */
  async checkTriggers() {
    console.group('🔍 Checking Database Triggers');
    
    const { data, error } = await supabase.rpc('check_notification_triggers');

    if (error) {
      console.error('❌ Error checking triggers:', error);
      console.log('ℹ️ You may need to create a helper function in Supabase');
      console.groupEnd();
      return { success: false, error };
    }

    console.log('Trigger Status:', data);
    console.groupEnd();
    return { success: true, data };
  },

  /**
   * Run all checks
   */
  async checkAll(courierId?: string) {
    console.log('🚀 Running Complete Notification System Diagnostics\n');
    
    const results = {
      recentDelivery: await this.checkRecentDeliveryStatus(),
    };

    if (courierId) {
      results['courierToken'] = await this.checkCourierToken(courierId);
    }

    console.log('\n📊 Diagnostic Summary:');
    console.table(
      Object.entries(results).map(([check, result]) => ({
        Check: check,
        Status: result.success ? '✅ Pass' : '❌ Fail'
      }))
    );

    return results;
  },

  /**
   * Monitor notifications in real-time
   */
  monitorNotifications(courierId?: string) {
    console.log('👀 Starting real-time notification monitor...');
    console.log('Press Ctrl+C to stop');

    const channel = supabase
      .channel('notification-monitor')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: courierId ? `user_id=eq.${courierId}` : undefined
        },
        (payload) => {
          const notif = payload.new as any;
          console.log('\n🔔 New Notification:');
          console.log('  Title:', notif.title);
          console.log('  User:', notif.user_id);
          console.log('  Type:', notif.type);
          console.log('  Sent:', notif.sent_at);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: courierId ? `user_id=eq.${courierId}` : undefined
        },
        (payload) => {
          const notif = payload.new as any;
          console.log('\n📝 Notification Updated:');
          console.log('  ID:', notif.id);
          console.log('  FCM Status:', notif.fcm_status);
          if (notif.fcm_error) {
            console.log('  FCM Error:', notif.fcm_error);
          }
        }
      )
      .subscribe();

    return () => {
      console.log('Stopping monitor...');
      supabase.removeChannel(channel);
    };
  }
};

// Make available in browser console
if (typeof window !== 'undefined') {
  (window as any).debugNotifications = debugNotifications;
}
