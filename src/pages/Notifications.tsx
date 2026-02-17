import { useState } from 'react';
import { Send, Bell, CheckCircle, Clock, AlertTriangle, Info, Smile } from 'lucide-react';
import { format, isSameDay, parseISO } from 'date-fns';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Badge } from '@/components/ui/Badge';
import { useAuth } from '@/context/AuthContext'; // To know who is sending
import { useUserStore } from '@/stores/useUserStore';
import { useNotificationStore } from '@/stores/useNotificationStore';
import { useCourierStore } from '@/stores/useCourierStore';

// Stores

export function Notifications() {
  const { user } = useUserStore(); // Current admin
  const { couriers } = useCourierStore(); // To select recipient
  const { notifications, addNotification } = useNotificationStore();

  const [selectedCourierId, setSelectedCourierId] = useState('');
  const [notificationTitle, setNotificationTitle] = useState('');
  const [notificationBody, setNotificationBody] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const activeCouriers = couriers.filter((c) => c.is_active);

  // Filter notifications to show history of what ADMIN sent (or all if we want transparency)
  // Let's show all for now to monitor system.
  // Sort by newest first
  const sortedNotifications = [...notifications].sort(
    (a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime()
  );

  const handleSendNotification = async () => {
    if (!selectedCourierId || !notificationTitle || !notificationBody) return;

    setIsLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 800)); // Simulate net delay

    const courier = activeCouriers.find((c) => c.id === parseInt(selectedCourierId));

    if (courier) {
      addNotification({
        user_id: courier.id,
        user_name: courier.name,
        title: notificationTitle,
        body: notificationBody,
        data: { type: 'manual_alert', sender_id: user?.id },
      });

      setSelectedCourierId('');
      setNotificationTitle('');
      setNotificationBody('');
      setSuccessMessage('Notification sent successfully!');

      setTimeout(() => setSuccessMessage(''), 3000);
    }
    setIsLoading(false);
  };

  const sentToday = notifications.filter(
    (n) => isSameDay(parseISO(n.sent_at), new Date())
  ).length;

  const readCount = notifications.filter((n) => n.is_read).length;

  return (
    <div className="min-h-screen">
      <Header title="Notifications" subtitle="Send push notifications to couriers" />

      <div className="p-4 lg:p-8 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="flex items-center gap-4">
            <div className="p-3 bg-indigo-100 rounded-lg">
              <Bell className="h-6 w-6 text-indigo-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{notifications.length}</p>
              <p className="text-sm text-gray-500">Total Sent</p>
            </div>
          </Card>
          <Card className="flex items-center gap-4">
            <div className="p-3 bg-green-100 rounded-lg">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{readCount}</p>
              <p className="text-sm text-gray-500">Read</p>
            </div>
          </Card>
          <Card className="flex items-center gap-4">
            <div className="p-3 bg-yellow-100 rounded-lg">
              <Clock className="h-6 w-6 text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{sentToday}</p>
              <p className="text-sm text-gray-500">Sent Today</p>
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Send Notification Form */}
          <Card>
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Send Notification</h3>

            {successMessage && (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                {successMessage}
              </div>
            )}

            <div className="space-y-4">
              <Select
                label="Select Courier"
                options={activeCouriers.map((c) => ({ value: c.id, label: c.name }))}
                value={selectedCourierId}
                onChange={(e) => setSelectedCourierId(e.target.value)}
                placeholder="Choose a courier"
              />

              <Input
                label="Title"
                value={notificationTitle}
                onChange={(e) => setNotificationTitle(e.target.value)}
                placeholder="Notification title"
              />

              <Textarea
                label="Message"
                value={notificationBody}
                onChange={(e) => setNotificationBody(e.target.value)}
                placeholder="Enter notification message"
                rows={4}
              />

              <Button
                className="w-full"
                leftIcon={<Send className="h-4 w-4" />}
                onClick={handleSendNotification}
                isLoading={isLoading}
                disabled={!selectedCourierId || !notificationTitle || !notificationBody}
              >
                Send Notification
              </Button>
            </div>

            {/* Quick Templates */}
            <div className="mt-6 pt-6 border-t border-gray-200">
              <h4 className="text-sm font-medium text-gray-700 mb-3">Quick Templates</h4>
              <div className="space-y-2">
                <button
                  className="w-full text-left p-3 bg-gray-50 hover:bg-gray-100 rounded-lg text-sm transition-colors flex items-start gap-3"
                  onClick={() => {
                    setNotificationTitle('New Order Reminder');
                    setNotificationBody('You have pending orders waiting for pickup. Please check your app.');
                  }}
                >
                  <div className="p-1.5 bg-blue-100 rounded-md text-blue-600 mt-0.5">
                    <Info className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="font-medium">New Order Reminder</p>
                    <p className="text-gray-500 text-xs mt-1">Remind courier about pending orders</p>
                  </div>
                </button>
                <button
                  className="w-full text-left p-3 bg-gray-50 hover:bg-gray-100 rounded-lg text-sm transition-colors flex items-start gap-3"
                  onClick={() => {
                    setNotificationTitle('Urgent: High Priority Order');
                    setNotificationBody('You have a high priority order. Please deliver as soon as possible.');
                  }}
                >
                  <div className="p-1.5 bg-red-100 rounded-md text-red-600 mt-0.5">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="font-medium">High Priority Alert</p>
                    <p className="text-gray-500 text-xs mt-1">Alert for urgent deliveries</p>
                  </div>
                </button>
                <button
                  className="w-full text-left p-3 bg-gray-50 hover:bg-gray-100 rounded-lg text-sm transition-colors flex items-start gap-3"
                  onClick={() => {
                    setNotificationTitle('Great Job Today!');
                    setNotificationBody('Thank you for your hard work today. Keep up the excellent service!');
                  }}
                >
                  <div className="p-1.5 bg-yellow-100 rounded-md text-yellow-600 mt-0.5">
                    <Smile className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="font-medium">Appreciation Message</p>
                    <p className="text-gray-500 text-xs mt-1">Send thank you message</p>
                  </div>
                </button>
              </div>
            </div>
          </Card>

          {/* Notification History */}
          <Card>
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Notification History</h3>

            <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
              {sortedNotifications.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Bell className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No notifications sent yet</p>
                </div>
              ) : (
                sortedNotifications.map((notification) => (
                  <div
                    key={notification.id}
                    className="p-4 bg-gray-50 rounded-lg border border-gray-100"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium text-sm">{notification.title}</p>
                          <Badge variant={notification.is_read ? 'success' : 'warning'} size="sm">
                            {notification.is_read ? 'Read' : 'Unread'}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600">{notification.body}</p>
                        <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                          <span>To: {notification.user_name}</span>
                          <span>•</span>
                          <span>{format(parseISO(notification.sent_at), 'MMM dd, HH:mm')}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
