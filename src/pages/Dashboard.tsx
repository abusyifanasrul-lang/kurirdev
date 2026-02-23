import { useState, useEffect, useMemo } from 'react';
import {
  Package,
  DollarSign,
  Users,
  Clock,
  TrendingUp
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { Link } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { Card, StatCard } from '@/components/ui/Card';
import { Badge, getStatusBadgeVariant, getStatusLabel } from '@/components/ui/Badge';
import { format, isToday, subDays, startOfDay, endOfDay, isWithinInterval } from 'date-fns';

// Stores
import { useOrderStore } from '@/stores/useOrderStore';
import { useCourierStore } from '@/stores/useCourierStore';

const COLORS = ['#F59E0B', '#3B82F6', '#8B5CF6', '#06B6D4', '#22C55E', '#EF4444'];

export function Dashboard() {
  const { orders, getRecentOrders } = useOrderStore();
  const { queue = [], couriers = [] } = useCourierStore();

  const [isConnected] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  // Simulate polling/refresh
  useEffect(() => {
    const interval = setInterval(() => {
      setLastUpdated(new Date());
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = () => {
    setLastUpdated(new Date());
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(value);
  };

  // --- Derived Analytics ---
  const analytics = useMemo(() => {
    const todayOrders = (orders || []).filter(o => isToday(new Date(o.created_at)));
    const pendingOrders = (orders || []).filter(o => o.status === 'pending');

    // Revenue: Sum of total_fee for 'delivered' orders today
    const revenueToday = todayOrders
      .filter(o => o.status === 'delivered')
      .reduce((sum, o) => sum + (o.total_fee || 0), 0);

    const activeCouriersCount = (couriers || []).filter(c => c.is_active && c.is_online).length;

    // Pie Chart Data
    const statusCounts = orders.reduce((acc, order) => {
      acc[order.status] = (acc[order.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const pieData = Object.entries(statusCounts).map(([status, count]) => ({
      status,
      count
    }));

    return {
      total_orders_today: todayOrders.length,
      total_revenue_today: revenueToday,
      active_couriers: activeCouriersCount,
      pending_orders: pendingOrders.length,
      orders_by_status: pieData
    };
  }, [orders, couriers]);

  const revenueChartData = useMemo(() => {
    // Last 7 days
    const data = [];
    for (let i = 6; i >= 0; i--) {
      const date = subDays(new Date(), i);
      const start = startOfDay(date);
      const end = endOfDay(date);

      const dayOrders = (orders || []).filter(o =>
        isWithinInterval(new Date(o.created_at), { start, end })
      );

      const revenue = dayOrders
        .filter(o => o.status === 'delivered')
        .reduce((sum, o) => sum + (o.total_fee || 0), 0);

      data.push({
        date: date.toISOString(),
        revenue,
        orders: dayOrders.length
      });
    }
    return data;
  }, [orders]);

  const recentOrders = getRecentOrders(5);

  return (
    <div className="min-h-screen">
      <Header
        title="Dashboard"
        subtitle={`Last updated: ${format(lastUpdated, 'HH:mm:ss')}`}
        isConnected={isConnected}
        onRefresh={handleRefresh}
      />

      <div className="p-4 lg:p-8 space-y-6 lg:space-y-8">
        {/* Stats Grid - Linked to Pages */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-6">
          <StatCard
            title="Orders Today"
            value={analytics.total_orders_today}
            icon={<Package className="h-6 w-6" />}
            trend={{ value: 12, isPositive: true }}
            to="/admin/orders"
          />
          <StatCard
            title="Revenue Today"
            value={formatCurrency(analytics.total_revenue_today)}
            icon={<DollarSign className="h-6 w-6" />}
            trend={{ value: 8, isPositive: true }}
            to="/admin/reports"
          />
          <StatCard
            title="Active Couriers"
            value={analytics.active_couriers}
            icon={<Users className="h-6 w-6" />}
            subtitle="Out of total registered"
            to="/admin/couriers"
          />
          <StatCard
            title="Pending Orders"
            value={analytics.pending_orders}
            icon={<Clock className="h-6 w-6" />}
            subtitle="Awaiting assignment"
            to="/admin/orders"
          />
        </div>

        {/* Core Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Main Chart Column (2/3 width) */}
          <div className="lg:col-span-2 space-y-6">
            {/* Revenue Chart */}
            <Card>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Revenue Trend</h3>
                  <p className="text-sm text-gray-500">Last 7 days performance</p>
                </div>
                <div className="flex items-center gap-2 text-green-600">
                  <TrendingUp className="h-4 w-4" />
                  <span className="text-sm font-medium">Live</span>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={revenueChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(value) => format(new Date(value), 'MMM dd')}
                    stroke="#9CA3AF"
                    fontSize={12}
                  />
                  <YAxis
                    tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                    stroke="#9CA3AF"
                    fontSize={12}
                  />
                  <Tooltip
                    formatter={(value) => [formatCurrency(value as number), 'Revenue']}
                    labelFormatter={(label) => format(new Date(label), 'MMM dd, yyyy')}
                  />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    stroke="#4F46E5"
                    strokeWidth={2}
                    dot={{ fill: '#4F46E5', strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </Card>

            {/* Recent Orders */}
            <Card>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">Recent Orders</h3>
                <Link to="/admin/orders" className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">
                  View all →
                </Link>
              </div>
              <div className="space-y-4">
                {recentOrders.map((order) => (
                  <div
                    key={order.id}
                    className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{order.order_number}</p>
                      <p className="text-sm text-gray-500">{order.customer_name}</p>
                    </div>
                    <div className="text-right">
                      <Badge variant={getStatusBadgeVariant(order.status)}>
                        {getStatusLabel(order.status)}
                      </Badge>
                      <p className="text-sm text-gray-500 mt-1">
                        {formatCurrency(order.total_fee)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Right Column (1/3 width) - Panels */}
          <div className="space-y-6">
            {/* Courier Queue Panel (FIFO) */}
            <Card className="flex flex-col h-[400px]">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Courier Queue</h3>
                <Badge variant="info">FIFO</Badge>
              </div>
              <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                {queue.filter(c => c.is_active && c.is_online).length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">No online couriers in queue</p>
                ) : (
                  queue.filter(c => c.is_active && c.is_online).map((courier, index) => (
                    <div key={courier.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 font-bold text-xs">
                          {index + 1}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 text-sm">{courier.name}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <div className={`w-2 h-2 rounded-full ${courier.is_online ? 'bg-green-500' : 'bg-gray-400'}`} />
                            <span className="text-xs text-gray-500">{courier.is_online ? 'Online' : 'Offline'}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        {/* Could add actionable status here later */}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>

            {/* Order Status Distribution */}
            <Card>
              <h3 className="text-lg font-semibold text-gray-900 mb-6">Status Overview</h3>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={analytics.orders_by_status}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={70}
                    paddingAngle={5}
                    dataKey="count"
                  >
                    {analytics.orders_by_status.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-2 gap-2 mt-4">
                {analytics.orders_by_status.slice(0, 4).map((item, index) => (
                  <div key={item.status} className="flex items-center gap-2">
                    <div
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <span className="text-xs text-gray-600 capitalize">
                      {getStatusLabel(item.status)}: {item.count}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          </div>

        </div>
      </div>
    </div>
  );
}
