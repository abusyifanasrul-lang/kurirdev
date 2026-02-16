import { useState } from 'react';
import { Package, CheckCircle, XCircle, Calendar } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { Badge, getStatusBadgeVariant, getStatusLabel } from '@/components/ui/Badge';

interface HistoryOrder {
  id: number;
  order_number: string;
  customer_name: string;
  customer_address: string;
  status: 'delivered' | 'cancelled';
  total_fee: number;
  courier_earnings: number;
  completed_at: string;
}

export function CourierHistory() {
  const [dateFilter, setDateFilter] = useState('week');
  
  const [orders] = useState<HistoryOrder[]>([
    {
      id: 1,
      order_number: 'ORD-20240214-0015',
      customer_name: 'John Doe',
      customer_address: 'Jl. Sudirman No. 123, Jakarta Selatan',
      status: 'delivered',
      total_fee: 8000,
      courier_earnings: 6400,
      completed_at: subDays(new Date(), 0).toISOString(),
    },
    {
      id: 2,
      order_number: 'ORD-20240214-0014',
      customer_name: 'Jane Smith',
      customer_address: 'Jl. Gatot Subroto No. 45, Jakarta Pusat',
      status: 'delivered',
      total_fee: 8000,
      courier_earnings: 6400,
      completed_at: subDays(new Date(), 0).toISOString(),
    },
    {
      id: 3,
      order_number: 'ORD-20240213-0010',
      customer_name: 'Bob Wilson',
      customer_address: 'Jl. Kemang Raya No. 78, Jakarta Selatan',
      status: 'delivered',
      total_fee: 8000,
      courier_earnings: 6400,
      completed_at: subDays(new Date(), 1).toISOString(),
    },
    {
      id: 4,
      order_number: 'ORD-20240213-0008',
      customer_name: 'Alice Brown',
      customer_address: 'Jl. Senopati No. 90, Jakarta Selatan',
      status: 'cancelled',
      total_fee: 8000,
      courier_earnings: 0,
      completed_at: subDays(new Date(), 1).toISOString(),
    },
    {
      id: 5,
      order_number: 'ORD-20240212-0005',
      customer_name: 'Charlie Davis',
      customer_address: 'Jl. Rasuna Said No. 12, Jakarta Selatan',
      status: 'delivered',
      total_fee: 8000,
      courier_earnings: 6400,
      completed_at: subDays(new Date(), 2).toISOString(),
    },
    {
      id: 6,
      order_number: 'ORD-20240211-0003',
      customer_name: 'Diana Miller',
      customer_address: 'Jl. Thamrin No. 56, Jakarta Pusat',
      status: 'delivered',
      total_fee: 8000,
      courier_earnings: 6400,
      completed_at: subDays(new Date(), 3).toISOString(),
    },
  ]);

  const filterOptions = [
    { key: 'today', label: 'Today' },
    { key: 'week', label: 'This Week' },
    { key: 'month', label: 'This Month' },
  ];

  const filteredOrders = orders.filter((order) => {
    const orderDate = new Date(order.completed_at);
    const today = new Date();
    
    switch (dateFilter) {
      case 'today':
        return orderDate.toDateString() === today.toDateString();
      case 'week':
        const weekAgo = subDays(today, 7);
        return orderDate >= weekAgo;
      case 'month':
        return orderDate.getMonth() === today.getMonth() && 
               orderDate.getFullYear() === today.getFullYear();
      default:
        return true;
    }
  });

  const deliveredCount = filteredOrders.filter(o => o.status === 'delivered').length;
  const cancelledCount = filteredOrders.filter(o => o.status === 'cancelled').length;
  const totalEarnings = filteredOrders.reduce((sum, o) => sum + o.courier_earnings, 0);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(value);
  };

  // Group orders by date
  const groupedOrders = filteredOrders.reduce((groups, order) => {
    const date = format(new Date(order.completed_at), 'yyyy-MM-dd');
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(order);
    return groups;
  }, {} as Record<string, HistoryOrder[]>);

  return (
    <div className="space-y-4">
      {/* Date Filter */}
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4">
        {filterOptions.map((option) => (
          <button
            key={option.key}
            onClick={() => setDateFilter(option.key)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              dateFilter === option.key
                ? 'bg-green-600 text-white'
                : 'bg-white text-gray-600 border border-gray-200'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100 text-center">
          <div className="flex items-center justify-center gap-1 text-green-600 mb-1">
            <CheckCircle className="h-4 w-4" />
            <span className="text-lg font-bold">{deliveredCount}</span>
          </div>
          <p className="text-xs text-gray-500">Delivered</p>
        </div>
        <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100 text-center">
          <div className="flex items-center justify-center gap-1 text-red-600 mb-1">
            <XCircle className="h-4 w-4" />
            <span className="text-lg font-bold">{cancelledCount}</span>
          </div>
          <p className="text-xs text-gray-500">Cancelled</p>
        </div>
        <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100 text-center">
          <p className="text-lg font-bold text-gray-900">{formatCurrency(totalEarnings)}</p>
          <p className="text-xs text-gray-500">Earnings</p>
        </div>
      </div>

      {/* Orders List */}
      {Object.keys(groupedOrders).length === 0 ? (
        <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 text-center">
          <Package className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No orders found</p>
          <p className="text-sm text-gray-400 mt-1">Try changing the date filter</p>
        </div>
      ) : (
        Object.entries(groupedOrders).map(([date, dateOrders]) => (
          <div key={date}>
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="h-4 w-4 text-gray-400" />
              <p className="text-sm font-medium text-gray-600">
                {format(new Date(date), 'EEEE, MMMM dd, yyyy')}
              </p>
            </div>
            <div className="space-y-3">
              {dateOrders.map((order) => (
                <div
                  key={order.id}
                  className="bg-white rounded-xl p-4 shadow-sm border border-gray-100"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold text-gray-900 text-sm">{order.order_number}</p>
                        <Badge variant={getStatusBadgeVariant(order.status)} size="sm">
                          {getStatusLabel(order.status)}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-700">{order.customer_name}</p>
                      <p className="text-xs text-gray-500 truncate">{order.customer_address}</p>
                    </div>
                    <div className="text-right">
                      <p className={`font-semibold ${order.status === 'delivered' ? 'text-green-600' : 'text-gray-400'}`}>
                        {order.status === 'delivered' ? formatCurrency(order.courier_earnings) : '-'}
                      </p>
                      <p className="text-xs text-gray-400">
                        {format(new Date(order.completed_at), 'HH:mm')}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
