import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, DollarSign, CheckCircle, Clock, Wifi, WifiOff, ChevronRight, AlertTriangle } from 'lucide-react';
import { format, isToday } from 'date-fns';
import { cn } from '@/utils/cn';
import { Badge, getStatusBadgeVariant, getStatusLabel } from '@/components/ui/Badge';
import { useOrderStore } from '@/stores/useOrderStore';
import { useCourierStore } from '@/stores/useCourierStore';
import { useAuth } from '@/context/AuthContext';
import { useSessionStore } from '@/stores/useSessionStore';
import { useUserStore } from '@/stores/useUserStore';
import { Order } from '@/types';

// Removed unused CourierOrder interface as we use global Order type

export function CourierDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { orders } = useOrderStore();
  const { } = useCourierStore();
  const { users } = useUserStore();
  const { user: currentUser } = useSessionStore();

  // Real-time suspended check from useUserStore
  const liveUser = users.find(u => u.id === currentUser?.id);
  const isSuspended = liveUser?.is_active === false;

  // Find this courier's data for online status
  const isOnline = liveUser?.is_online ?? false;

  const [isConnected, setIsConnected] = useState(true);

  // Derived Stats
  const myOrders = useMemo(() => orders.filter((o: Order) => o.courier_id === user?.id), [orders, user?.id]);

  const activeOrders = useMemo(() =>
    myOrders.filter((o: Order) => ['assigned', 'picked_up', 'in_transit'].includes(o.status)),
    [myOrders]
  );

  const completedToday = useMemo(() =>
    myOrders.filter((o: Order) => o.status === 'delivered' && isToday(new Date(o.created_at))).length,
    [myOrders]
  );

  const todayEarnings = useMemo(() =>
    myOrders
      .filter((o: Order) => o.status === 'delivered' && isToday(new Date(o.created_at)))
      .reduce((sum: number, o: Order) => sum + (o.total_fee || 0), 0),
    [myOrders]
  );

  const unpaidDeliveredOrdersCount = useMemo(() =>
    myOrders.filter((o: Order) => o.status === 'delivered' && o.payment_status === 'unpaid').length,
    [myOrders]
  );

  // Polling simulation
  useEffect(() => {
    const interval = setInterval(() => {
      setIsConnected(true);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleToggleOnline = async () => {
    if (user?.id) {
      const newStatus = !isOnline;
      await useUserStore.getState().updateUser(user.id, { is_online: newStatus });
      useSessionStore.getState().updateUser({ is_online: newStatus });
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="space-y-6">
      {/* Connection Status */}
      <div className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium",
        isConnected ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
      )}>
        {isConnected ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
        {isConnected ? "Connected" : "Connection lost - Showing cached data"}
      </div>

      {/* Unpaid Warning Card */}
      {unpaidDeliveredOrdersCount > 0 && (
        <div
          onClick={() => navigate('/courier/history')}
          className="flex items-center justify-between gap-3 bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 cursor-pointer active:scale-[0.98] transition-all"
        >
          <div className="flex items-center gap-2 min-w-0">
            <AlertTriangle className="h-4 w-4 text-orange-500 flex-shrink-0" />
            <p className="text-sm font-medium text-orange-800 truncate">
              {unpaidDeliveredOrdersCount} order belum disetor
            </p>
          </div>
          <span className="text-xs font-semibold text-orange-600 whitespace-nowrap flex items-center gap-1 flex-shrink-0">
            Lihat <ChevronRight className="h-3.5 w-3.5" />
          </span>
        </div>
      )}

      {/* Online/Offline Toggle */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">Your Status</p>
            <p className={cn(
              "text-lg font-bold",
              isOnline ? "text-green-600" : "text-gray-500"
            )}>
              {isOnline ? "Online" : "Offline"}
            </p>
          </div>
          <button
            onClick={handleToggleOnline}
            disabled={isSuspended}
            className={cn(
              "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
              isOnline ? "bg-green-500 focus-visible:ring-green-500" : "bg-gray-300 focus-visible:ring-gray-400",
              isSuspended && "opacity-50 cursor-not-allowed"
            )}
          >
            <span
              className={cn(
                "pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-md ring-0 transition-transform duration-200 ease-in-out",
                isOnline ? "translate-x-6" : "translate-x-1"
              )}
            />
          </button>
        </div>
        {isSuspended ? (
          <p className="text-xs text-red-500 mt-2 font-medium">
            Tidak bisa online: Akun sedang disuspend
          </p>
        ) : !isOnline && (
          <p className="text-xs text-gray-500 mt-2">
            Turn online to receive new orders
          </p>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center">
          <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
            <DollarSign className="h-5 w-5 text-green-600" />
          </div>
          <p className="text-lg font-bold text-gray-900">{formatCurrency(todayEarnings)}</p>
          <p className="text-xs text-gray-500">Today's Earnings</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center">
          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2">
            <CheckCircle className="h-5 w-5 text-blue-600" />
          </div>
          <p className="text-lg font-bold text-gray-900">{completedToday}</p>
          <p className="text-xs text-gray-500">Completed</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center">
          <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-2">
            <Clock className="h-5 w-5 text-orange-600" />
          </div>
          <p className="text-lg font-bold text-gray-900">{activeOrders.length}</p>
          <p className="text-xs text-gray-500">Active</p>
        </div>
      </div>

      {/* Active Orders */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">Active Orders</h2>
          <span className="text-sm text-gray-500">{activeOrders.length} orders</span>
        </div>

        {activeOrders.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 text-center">
            <Package className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No active orders</p>
            <p className="text-sm text-gray-400 mt-1">New orders will appear here</p>
          </div>
        ) : (
          <div className="space-y-3">
            {activeOrders.map((order: Order) => (
              <button
                key={order.id}
                onClick={() => navigate(`/courier/orders/${order.id}`)}
                className="w-full bg-white rounded-2xl p-4 shadow-sm border border-gray-100 text-left hover:border-green-300 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold text-gray-900">{order.order_number}</p>
                      <Badge variant={getStatusBadgeVariant(order.status)} size="sm">
                        {getStatusLabel(order.status)}
                      </Badge>
                    </div>
                    <p className="text-sm font-medium text-gray-700">{order.customer_name}</p>
                    <p className="text-sm text-gray-500 truncate">{order.customer_address}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {format(new Date(order.created_at), 'HH:mm')}
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-gray-400 flex-shrink-0 mt-2" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
