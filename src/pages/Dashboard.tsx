import { useState, useEffect } from 'react';
import {
  Package,
  DollarSign,
  Users,
  Clock,
  TrendingUp,
} from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
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
import { mockAnalytics, mockRevenueChart, mockOrders } from '@/services/mockData';
import { format } from 'date-fns';

const COLORS = ['#F59E0B', '#3B82F6', '#8B5CF6', '#06B6D4', '#22C55E', '#EF4444'];

export function Dashboard() {
  const [analytics] = useState(mockAnalytics);
  const [revenueData] = useState(mockRevenueChart);
  const [isConnected, setIsConnected] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  // Simulate polling for real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      // In real app, this would call the API
      setLastUpdated(new Date());
      setIsConnected(true);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const handleRefresh = () => {
    setLastUpdated(new Date());
    // In real app, would refetch data here
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const recentOrders = mockOrders.slice(0, 5);

  return (
    <div className="min-h-screen">
      <Header
        title="Dashboard"
        subtitle={`Last updated: ${format(lastUpdated, 'HH:mm:ss')}`}
        isConnected={isConnected}
        onRefresh={handleRefresh}
      />

      <div className="p-4 lg:p-8 space-y-6 lg:space-y-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-6">
          <StatCard
            title="Orders Today"
            value={analytics.total_orders_today}
            icon={<Package className="h-6 w-6" />}
            trend={{ value: 12, isPositive: true }}
          />
          <StatCard
            title="Revenue Today"
            value={formatCurrency(analytics.total_revenue_today)}
            icon={<DollarSign className="h-6 w-6" />}
            trend={{ value: 8, isPositive: true }}
          />
          <StatCard
            title="Active Couriers"
            value={analytics.active_couriers}
            icon={<Users className="h-6 w-6" />}
            subtitle="Out of 20 total"
          />
          <StatCard
            title="Pending Orders"
            value={analytics.pending_orders}
            icon={<Clock className="h-6 w-6" />}
            subtitle="Awaiting assignment"
          />
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
          {/* Revenue Chart */}
          <Card className="lg:col-span-2">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Revenue Trend</h3>
                <p className="text-sm text-gray-500">Last 7 days performance</p>
              </div>
              <div className="flex items-center gap-2 text-green-600">
                <TrendingUp className="h-4 w-4" />
                <span className="text-sm font-medium">+15.3%</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={revenueData}>
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

          {/* Orders by Status */}
          <Card>
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Orders by Status</h3>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={analytics.orders_by_status}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
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
              {analytics.orders_by_status.map((item, index) => (
                <div key={item.status} className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  />
                  <span className="text-sm text-gray-600 capitalize">
                    {getStatusLabel(item.status)}: {item.count}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Orders Chart & Recent Orders */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
          {/* Daily Orders Chart */}
          <Card>
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Daily Orders</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(value) => format(new Date(value), 'MMM dd')}
                  stroke="#9CA3AF"
                  fontSize={12}
                />
                <YAxis stroke="#9CA3AF" fontSize={12} />
                <Tooltip
                  formatter={(value) => [value as number, 'Orders']}
                  labelFormatter={(label) => format(new Date(label), 'MMM dd, yyyy')}
                />
                <Bar dataKey="orders" fill="#4F46E5" radius={[4, 4, 0, 0]} />
              </BarChart>
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
      </div>
    </div>
  );
}
