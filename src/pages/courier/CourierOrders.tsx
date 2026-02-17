import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, ChevronRight, Search } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { Badge, getStatusBadgeVariant, getStatusLabel } from '@/components/ui/Badge';
import { useOrderStore } from '@/stores/useOrderStore';
import { useUserStore } from '@/stores/useUserStore';

export function CourierOrders() {
  const navigate = useNavigate();
  const { user } = useUserStore();
  const { orders } = useOrderStore(); // Global orders

  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<string>('all');

  // Filter orders for THIS courier
  const myOrders = orders.filter(o => o.courier_id === user?.id);

  // Active orders typically exclude delivered/cancelled for the "Orders" tab? 
  // Or maybe show all but filter by status tab?
  // Let's keep logic similar to before but allow filtering.
  // Actually, usually "History" has delivered/cancelled. "Orders" has active.
  // But let's follow the existing UI tabs: "All", "Assigned", "Picked Up", "In Transit".

  const filteredOrders = myOrders.filter((order) => {
    // Search
    const matchesSearch =
      !searchQuery ||
      order.order_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.customer_name.toLowerCase().includes(searchQuery.toLowerCase());

    // Filter Tab
    let matchesFilter = true;
    if (activeFilter !== 'all') {
      matchesFilter = order.status === activeFilter;
    } else {
      // If "All" in Orders tab, maybe hide delivered/cancelled?
      // Let's hide delivered/cancelled from "Orders" tab generally, as they go to History.
      // But the previous code had them. Let's stick to active statuses for this view.
      matchesFilter = ['assigned', 'picked_up', 'in_transit'].includes(order.status);
    }

    return matchesSearch && matchesFilter;
  });

  const filters = [
    { key: 'all', label: 'Active' },
    { key: 'assigned', label: 'Assigned' },
    { key: 'picked_up', label: 'Picked Up' },
    { key: 'in_transit', label: 'In Transit' },
  ];

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search orders..."
          className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500"
        />
      </div>

      {/* Filters */}
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4">
        {filters.map((filter) => (
          <button
            key={filter.key}
            onClick={() => setActiveFilter(filter.key)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${activeFilter === filter.key
                ? 'bg-green-600 text-white'
                : 'bg-white text-gray-600 border border-gray-200'
              }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {/* Orders List */}
      {filteredOrders.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 text-center">
          <Package className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No active orders</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map((order) => (
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
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-xs text-gray-400">
                      {order.created_at ? format(parseISO(order.created_at), 'MMM dd, HH:mm') : '-'}
                    </p>
                    <p className="text-sm font-medium text-green-600">
                      Rp {(order.total_fee || 0).toLocaleString()}
                    </p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-gray-400 flex-shrink-0 mt-2" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
