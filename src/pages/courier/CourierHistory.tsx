import { useMemo, useState } from 'react';
import { ArrowLeft, Package, Clock, CheckCircle, XCircle, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format, isToday, isYesterday, parseISO } from 'date-fns';
import { useOrderStore } from '@/stores/useOrderStore';
import { useAuth } from '@/context/AuthContext';
import { useUserStore } from '@/stores/useUserStore';
import { useCourierStore } from '@/stores/useCourierStore';

type StatusFilter = 'all' | 'delivered' | 'cancelled' | 'in_transit' | 'picked_up' | 'assigned';

const statusConfig: Record<string, { color: string; bg: string; icon: typeof CheckCircle; label: string }> = {
  delivered: { color: 'text-green-600', bg: 'bg-green-50', icon: CheckCircle, label: 'Delivered' },
  cancelled: { color: 'text-red-600', bg: 'bg-red-50', icon: XCircle, label: 'Cancelled' },
  in_transit: { color: 'text-blue-600', bg: 'bg-blue-50', icon: Package, label: 'In Transit' },
  picked_up: { color: 'text-orange-600', bg: 'bg-orange-50', icon: Package, label: 'Picked Up' },
  assigned: { color: 'text-indigo-600', bg: 'bg-indigo-50', icon: Clock, label: 'Assigned' },
  pending: { color: 'text-gray-600', bg: 'bg-gray-50', icon: Clock, label: 'Pending' },
};

export function CourierHistory() {
  const navigate = useNavigate();
  const auth = useAuth();
  const userStore = useUserStore();
  const { orders } = useOrderStore();
  const { couriers } = useCourierStore();

  const user = auth.user || userStore.user;

  const currentCourier = useMemo(() => couriers.find(c => c.id === user?.id), [couriers, user?.id]);
  const COMMISSION_RATE = (currentCourier?.commission_rate ?? 80) / 100;

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  // Filter orders assigned to this courier
  const courierOrders = useMemo(() => {
    if (!user) return [];

    return orders
      .filter((order) => {
        // Only orders assigned to this courier
        const isMyCourier = order.courier_id === user.id;
        if (!isMyCourier) return false;

        // Apply status filter
        if (statusFilter !== 'all' && order.status !== statusFilter) return false;

        // Apply search filter
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          return (
            order.order_number.toLowerCase().includes(q) ||
            order.customer_name.toLowerCase().includes(q) ||
            order.customer_address.toLowerCase().includes(q)
          );
        }

        return true;
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [orders, user, statusFilter, searchQuery]);

  // Group orders by date
  const groupedOrders = useMemo(() => {
    const groups: Record<string, typeof courierOrders> = {};
    courierOrders.forEach((order) => {
      const date = format(parseISO(order.created_at), 'yyyy-MM-dd');
      if (!groups[date]) groups[date] = [];
      groups[date].push(order);
    });
    return groups;
  }, [courierOrders]);

  const getDateLabel = (dateStr: string) => {
    const date = parseISO(dateStr);
    if (isToday(date)) return 'Hari Ini';
    if (isYesterday(date)) return 'Kemarin';
    return format(date, 'dd MMMM yyyy');
  };

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val);

  const totalEarnings = useMemo(() => {
    const courier = couriers.find(c => c.id === user?.id);
    const rate = (courier?.commission_rate ?? 80) / 100;
    return courierOrders
      .filter((o) => o.status === 'delivered')
      .reduce((sum, o) => sum + (o.total_fee || 0) * rate, 0);
  }, [courierOrders, couriers, user]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="flex items-center gap-3 p-4">
          <button onClick={() => navigate('/courier')} className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-gray-900">Riwayat Pengiriman</h1>
            <p className="text-xs text-gray-500">
              {courierOrders.length} pesanan • {formatCurrency(totalEarnings)} total pendapatan
            </p>
          </div>
        </div>

        {/* Search & Filter */}
        <div className="px-4 pb-3 flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Cari pesanan..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">Semua</option>
            <option value="delivered">Delivered</option>
            <option value="cancelled">Cancelled</option>
            <option value="in_transit">In Transit</option>
            <option value="picked_up">Picked Up</option>
            <option value="assigned">Assigned</option>
          </select>
        </div>
      </div>

      {/* Order List */}
      <div className="p-4 space-y-4">
        {Object.keys(groupedOrders).length === 0 ? (
          <div className="text-center py-16">
            <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">Belum ada riwayat pengiriman</p>
            <p className="text-sm text-gray-400 mt-1">Pesanan yang dikirim akan muncul di sini</p>
          </div>
        ) : (
          Object.entries(groupedOrders).map(([date, dateOrders]) => (
            <div key={date}>
              <h3 className="text-sm font-semibold text-gray-500 mb-2 px-1">{getDateLabel(date)}</h3>
              <div className="space-y-2">
                {dateOrders.map((order) => {
                  const config = statusConfig[order.status] || statusConfig.pending;
                  const StatusIcon = config.icon;
                  const courierEarning = order.status === 'delivered' ? (order.total_fee || 0) * COMMISSION_RATE : 0;

                  return (
                    <div
                      key={order.id}
                      onClick={() => navigate(`/courier/order/${order.id}`)}
                      className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 cursor-pointer hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-semibold text-gray-900 text-sm">{order.order_number}</p>
                          <p className="text-xs text-gray-500">{format(parseISO(order.created_at), 'HH:mm')}</p>
                        </div>
                        <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.bg} ${config.color}`}>
                          <StatusIcon className="w-3 h-3" />
                          {config.label}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm text-gray-700">{order.customer_name}</p>
                        <p className="text-xs text-gray-500 line-clamp-1">{order.customer_address}</p>
                      </div>
                      <div className="flex justify-between items-center mt-3 pt-2 border-t border-gray-50">
                        <span className="text-xs text-gray-500">Total Fee: {formatCurrency(order.total_fee)}</span>
                        {courierEarning > 0 && (
                          <span className="text-sm font-semibold text-green-600">+{formatCurrency(courierEarning)}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
