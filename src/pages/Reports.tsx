import { useState } from 'react';
import { Download, Calendar, TrendingUp, DollarSign, Package, Award } from 'lucide-react';
import { format, subDays } from 'date-fns';
import {
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
  Legend,
} from 'recharts';
import { Header } from '@/components/layout/Header';
import { Card, StatCard } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { mockReportSummary, mockRevenueChart } from '@/services/mockData';

const COLORS = ['#F59E0B', '#3B82F6', '#8B5CF6', '#06B6D4', '#22C55E', '#EF4444'];

export function Reports() {
  const [dateRange, setDateRange] = useState({
    start: format(subDays(new Date(), 7), 'yyyy-MM-dd'),
    end: format(new Date(), 'yyyy-MM-dd'),
  });
  const [reportData] = useState(mockReportSummary);
  const [revenueData] = useState(mockRevenueChart);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const handleExportReport = () => {
    const headers = ['Metric', 'Value'];
    const rows = [
      ['Total Orders', reportData.total_orders],
      ['Total Revenue', formatCurrency(reportData.total_revenue)],
      ['Average Orders/Day', reportData.average_orders_per_day.toFixed(1)],
      ['Top Courier', reportData.top_courier?.name || 'N/A'],
      ['Top Courier Orders', reportData.top_courier?.orders_count || 0],
    ];

    const csvContent = [headers, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `report-${dateRange.start}-to-${dateRange.end}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const statusData = reportData.orders_by_status.filter((s) => s.count > 0);

  return (
    <div className="min-h-screen">
      <Header
        title="Reports"
        subtitle="Analytics and performance reports"
        actions={
          <Button leftIcon={<Download className="h-4 w-4" />} onClick={handleExportReport}>
            Export Report
          </Button>
        }
      />

      <div className="p-8 space-y-6">
        {/* Date Range Picker */}
        <Card>
          <div className="flex items-center gap-4 flex-wrap">
            <Calendar className="h-5 w-5 text-gray-400" />
            <span className="text-sm font-medium text-gray-700">Date Range:</span>
            <Input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
              className="w-40"
            />
            <span className="text-gray-400">to</span>
            <Input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
              className="w-40"
            />
            <Button variant="secondary" size="sm">
              Apply
            </Button>
          </div>
        </Card>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            title="Total Orders"
            value={reportData.total_orders}
            icon={<Package className="h-6 w-6" />}
          />
          <StatCard
            title="Total Revenue"
            value={formatCurrency(reportData.total_revenue)}
            icon={<DollarSign className="h-6 w-6" />}
          />
          <StatCard
            title="Avg. Orders/Day"
            value={reportData.average_orders_per_day.toFixed(1)}
            icon={<TrendingUp className="h-6 w-6" />}
          />
          <StatCard
            title="Top Courier"
            value={reportData.top_courier?.name || 'N/A'}
            icon={<Award className="h-6 w-6" />}
            subtitle={reportData.top_courier ? `${reportData.top_courier.orders_count} orders` : undefined}
          />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Revenue by Day */}
          <Card>
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Daily Revenue</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={revenueData}>
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
                <Bar dataKey="revenue" fill="#4F46E5" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          {/* Orders by Status */}
          <Card>
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Orders by Status</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  dataKey="count"
                  nameKey="status"
                  label={({ name, value }) => `${name}: ${value}`}
                  labelLine={false}
                >
                  {statusData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </div>

        {/* Orders by Day */}
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Daily Orders</h3>
          <ResponsiveContainer width="100%" height={300}>
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
                formatter={(value) => [value, 'Orders']}
                labelFormatter={(label) => format(new Date(label), 'MMM dd, yyyy')}
              />
              <Bar dataKey="orders" fill="#22C55E" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Top Couriers Table */}
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Top Performing Couriers</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left text-sm font-medium text-gray-500 pb-3">Rank</th>
                  <th className="text-left text-sm font-medium text-gray-500 pb-3">Courier</th>
                  <th className="text-left text-sm font-medium text-gray-500 pb-3">Orders</th>
                  <th className="text-left text-sm font-medium text-gray-500 pb-3">Earnings</th>
                  <th className="text-left text-sm font-medium text-gray-500 pb-3">Avg. Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                <tr>
                  <td className="py-3">
                    <span className="inline-flex items-center justify-center w-6 h-6 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium">
                      1
                    </span>
                  </td>
                  <td className="py-3 font-medium">Ahmad Kurniawan</td>
                  <td className="py-3">85</td>
                  <td className="py-3">{formatCurrency(544000)}</td>
                  <td className="py-3">38 min</td>
                </tr>
                <tr>
                  <td className="py-3">
                    <span className="inline-flex items-center justify-center w-6 h-6 bg-gray-100 text-gray-800 rounded-full text-sm font-medium">
                      2
                    </span>
                  </td>
                  <td className="py-3 font-medium">Budi Santoso</td>
                  <td className="py-3">72</td>
                  <td className="py-3">{formatCurrency(460800)}</td>
                  <td className="py-3">42 min</td>
                </tr>
                <tr>
                  <td className="py-3">
                    <span className="inline-flex items-center justify-center w-6 h-6 bg-orange-100 text-orange-800 rounded-full text-sm font-medium">
                      3
                    </span>
                  </td>
                  <td className="py-3 font-medium">Citra Dewi</td>
                  <td className="py-3">65</td>
                  <td className="py-3">{formatCurrency(416000)}</td>
                  <td className="py-3">45 min</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
