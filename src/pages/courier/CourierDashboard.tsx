import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, DollarSign, CheckCircle, Clock, Wifi, WifiOff, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/utils/cn';
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

export function CourierDashboard() {
  const navigate = useNavigate();
  const [isOnline, setIsOnline] = useState(true);
  const [isConnected, setIsConnected] = useState(true);
  const [todayEarnings] = useState(51200);
  const [completedToday] = useState(8);
  const [activeOrders] = useState<CourierOrder[]>([
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
  ]);

  // Polling simulation
  useEffect(() => {
    const interval = setInterval(() => {
      setIsConnected(true);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleToggleOnline = () => {
    setIsOnline(!isOnline);
    // In real app, this would call API to update online status
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
            className={cn(
              "relative w-14 h-8 rounded-full transition-colors duration-200",
              isOnline ? "bg-green-500" : "bg-gray-300"
            )}
          >
            <span
              className={cn(
                "absolute top-1 w-6 h-6 bg-white rounded-full shadow transition-transform duration-200",
                isOnline ? "translate-x-7" : "translate-x-1"
              )}
            />
          </button>
        </div>
        {!isOnline && (
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
            {activeOrders.map((order) => (
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
