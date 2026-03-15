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
  const { orders, courierOrders, fetchOrdersByCourier } = useOrderStore();

  useEffect(() => {
    if (user?.id) {
      fetchOrdersByCourier(user.id)
    }
  }, [user?.id])
  const { setCourierOffline, setCourierOnline } = useCourierStore();
  const { users } = useUserStore();
  const { user: currentUser } = useSessionStore();

  // Real-time suspended check from useUserStore
  const liveUser = users.find(u => u.id === currentUser?.id);
  const isSuspended = liveUser?.is_active === false;

  // Find this courier's data for online status
  const isOnline = liveUser?.is_online ?? false;

  const [isConnected, setIsConnected] = useState(true);
  const [showOffModal, setShowOffModal] = useState(false);
  const [selectedOffReason, setSelectedOffReason] = useState('');
  const [customOffReason, setCustomOffReason] = useState('');

  const courierStatus = (liveUser as any)?.courier_status ?? (isOnline ? 'on' : 'off');

  const OFF_REASONS = [
    { value: 'Makan', label: '🍽️ Makan' },
    { value: 'BAB/BAK', label: '🚽 BAB/BAK' },
    { value: 'Isi Bensin', label: '⛽ Isi Bensin' },
    { value: 'Masalah Kendaraan', label: '🔧 Masalah Kendaraan' },
    { value: 'Lainnya', label: '📝 Lainnya' },
  ];

  // Derived Stats
  const myOrders = useMemo(() => orders.filter((o: Order) => o.courier_id === user?.id), [orders, user?.id]);

  const activeOrders = useMemo(() =>
    myOrders.filter((o: Order) => ['assigned', 'picked_up', 'in_transit'].includes(o.status)),
    [myOrders]
  );

  const completedToday = useMemo(() =>
    courierOrders.filter((o: Order) => o.status === 'delivered' && isToday(new Date(o.created_at))).length,
    [courierOrders]
  );

  const todayEarnings = useMemo(() =>
    courierOrders
      .filter((o: Order) => o.status === 'delivered' && isToday(new Date(o.created_at)))
      .reduce((sum: number, o: Order) => sum + (o.total_fee || 0), 0),
    [courierOrders]
  );

  const unpaidDeliveredOrdersCount = (liveUser as any)?.unpaid_count ?? 0;

  // Polling simulation
  useEffect(() => {
    const interval = setInterval(() => {
      setIsConnected(true);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleSetOn = async () => {
    if (!user?.id || isSuspended) return;
    await setCourierOnline(user.id, 'on');
    useSessionStore.getState().updateUser({ is_online: true });
  };

  const handleSetStay = async () => {
    if (!user?.id || isSuspended) return;
    await setCourierOnline(user.id, 'stay');
    useSessionStore.getState().updateUser({ is_online: true });
  };

  const handleConfirmOff = async () => {
    if (!user?.id) return;
    const reason = selectedOffReason === 'Lainnya' ? customOffReason : selectedOffReason;
    if (!reason) return;
    await setCourierOffline(user.id, reason);
    useSessionStore.getState().updateUser({ is_online: false });
    setShowOffModal(false);
    setSelectedOffReason('');
    setCustomOffReason('');
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

      {/* Status Toggle — ON / STAY / OFF */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
        <p className="text-sm text-gray-500 mb-3">Status Kamu</p>
        {isSuspended ? (
          <p className="text-xs text-red-500 font-medium">Akun sedang disuspend — tidak bisa mengubah status</p>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={handleSetOn}
              disabled={isSuspended}
              className={cn(
                "flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all",
                courierStatus === 'on'
                  ? "bg-green-500 text-white border-green-500"
                  : "bg-white text-gray-500 border-gray-200 hover:border-green-300"
              )}
            >
              🚀 ON
            </button>
            <button
              onClick={handleSetStay}
              disabled={isSuspended}
              className={cn(
                "flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all",
                courierStatus === 'stay'
                  ? "bg-blue-500 text-white border-blue-500"
                  : "bg-white text-gray-500 border-gray-200 hover:border-blue-300"
              )}
            >
              🏠 STAY
            </button>
            <button
              onClick={() => setShowOffModal(true)}
              disabled={isSuspended}
              className={cn(
                "flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all",
                courierStatus === 'off'
                  ? "bg-red-500 text-white border-red-500"
                  : "bg-white text-gray-500 border-gray-200 hover:border-red-300"
              )}
            >
              🔴 OFF
            </button>
          </div>
        )}
        {courierStatus === 'off' && (liveUser as any)?.off_reason && (
          <p className="text-xs text-gray-400 mt-2 italic">Alasan: {(liveUser as any).off_reason}</p>
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
                        {getStatusLabel(order.status, 'courier')}
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

      {/* Modal Alasan OFF */}
      {showOffModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm space-y-4">
            <h3 className="font-bold text-gray-900">Alasan Offline</h3>
            <div className="space-y-2">
              {OFF_REASONS.map(r => (
                <button
                  key={r.value}
                  onClick={() => setSelectedOffReason(r.value)}
                  className={cn(
                    "w-full text-left px-4 py-2.5 rounded-xl border text-sm font-medium transition-all",
                    selectedOffReason === r.value
                      ? "bg-red-50 border-red-400 text-red-700"
                      : "bg-gray-50 border-gray-200 text-gray-700 hover:border-gray-300"
                  )}
                >
                  {r.label}
                </button>
              ))}
            </div>
            {selectedOffReason === 'Lainnya' && (
              <input
                type="text"
                placeholder="Jelaskan alasan..."
                value={customOffReason}
                onChange={e => setCustomOffReason(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-red-400"
              />
            )}
            <div className="flex gap-3">
              <button
                onClick={() => { setShowOffModal(false); setSelectedOffReason(''); setCustomOffReason(''); }}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600"
              >
                Batal
              </button>
              <button
                onClick={handleConfirmOff}
                disabled={!selectedOffReason || (selectedOffReason === 'Lainnya' && !customOffReason)}
                className="flex-1 py-2.5 bg-red-500 text-white rounded-xl text-sm font-semibold disabled:opacity-50"
              >
                Konfirmasi OFF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
