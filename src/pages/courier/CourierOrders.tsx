import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, ChevronRight, Search } from 'lucide-react';
import { format } from 'date-fns';
import { Badge, getStatusBadgeVariant, getStatusLabel } from '@/components/ui/Badge';

interface CourierOrder {
  id: number;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  status: 'assigned' | 'picked_up' | 'in_transit';
  total_fee: number;
  created_at: string;
}

export function CourierOrders() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<string>('all');

  const [orders] = useState<CourierOrder[]>([
    {
      id: 1,
      order_number: 'ORD-20240215-0001',
      customer_name: 'John Doe',
      customer_phone: '+62812345678',
      customer_address: 'Jl. Sudirman No. 123, Jakarta Selatan',
      status: 'assigned',
      total_fee: 8000,
      created_at: new Date().toISOString(),
    },
    {
      id: 2,
      order_number: 'ORD-20240215-0002',
      customer_name: 'Jane Smith',
      customer_phone: '+62898765432',
      customer_address: 'Jl. Gatot Subroto No. 45, Jakarta Pusat',
      status: 'picked_up',
      total_fee: 8000,
      created_at: new Date().toISOString(),
    },
    {
      id: 3,
      order_number: 'ORD-20240215-0003',
      customer_name: 'Bob Wilson',
      customer_phone: '+62811223344',
      customer_address: 'Jl. Kemang Raya No. 78, Jakarta Selatan',
      status: 'in_transit',
      total_fee: 8000,
      created_at: new Date().toISOString(),
    },
    {
      id: 4,
      order_number: 'ORD-20240215-0004',
      customer_name: 'Alice Brown',
      customer_phone: '+62855667788',
      customer_address: 'Jl. Senopati No. 90, Jakarta Selatan',
      status: 'assigned',
      total_fee: 8000,
      created_at: new Date().toISOString(),
    },
  ]);

  const filteredOrders = orders.filter((order) => {
    const matchesSearch =
      !searchQuery ||
      order.order_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.customer_name.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesFilter = activeFilter === 'all' || order.status === activeFilter;
    
    return matchesSearch && matchesFilter;
  });

  const filters = [
    { key: 'all', label: 'All' },
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
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              activeFilter === filter.key
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
          <p className="text-gray-500">No orders found</p>
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
                      {format(new Date(order.created_at), 'MMM dd, HH:mm')}
                    </p>
                    <p className="text-sm font-medium text-green-600">
                      Rp {order.total_fee.toLocaleString()}
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
