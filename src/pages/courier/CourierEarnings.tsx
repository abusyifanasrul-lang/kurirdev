import { useState } from 'react';
import { DollarSign, TrendingUp, Calendar, Package } from 'lucide-react';
import { format, subDays, startOfWeek, endOfWeek, eachDayOfInterval } from 'date-fns';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface EarningData {
  date: string;
  earnings: number;
  orders: number;
}

export function CourierEarnings() {
  const [activeTab, setActiveTab] = useState<'daily' | 'weekly' | 'monthly'>('daily');

  // Generate mock data
  const generateDailyData = (): EarningData[] => {
    return [
      { date: format(new Date(), 'yyyy-MM-dd'), earnings: 51200, orders: 8 },
    ];
  };

  const generateWeeklyData = (): EarningData[] => {
    const today = new Date();
    const start = startOfWeek(today, { weekStartsOn: 1 });
    const end = endOfWeek(today, { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start, end });

    return days.map((day) => ({
      date: format(day, 'yyyy-MM-dd'),
      earnings: Math.floor(Math.random() * 50000) + 30000,
      orders: Math.floor(Math.random() * 8) + 3,
    }));
  };

  const generateMonthlyData = (): EarningData[] => {
    const today = new Date();
    return Array.from({ length: 4 }, (_, i) => ({
      date: format(subDays(today, (3 - i) * 7), 'yyyy-MM-dd'),
      earnings: Math.floor(Math.random() * 300000) + 200000,
      orders: Math.floor(Math.random() * 40) + 20,
    }));
  };

  const [dailyData] = useState(generateDailyData());
  const [weeklyData] = useState(generateWeeklyData());
  const [monthlyData] = useState(generateMonthlyData());

  const getCurrentData = () => {
    switch (activeTab) {
      case 'daily':
        return dailyData;
      case 'weekly':
        return weeklyData;
      case 'monthly':
        return monthlyData;
      default:
        return dailyData;
    }
  };

  const getTotalEarnings = () => {
    return getCurrentData().reduce((sum, d) => sum + d.earnings, 0);
  };

  const getTotalOrders = () => {
    return getCurrentData().reduce((sum, d) => sum + d.orders, 0);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const tabs = [
    { key: 'daily', label: 'Today' },
    { key: 'weekly', label: 'This Week' },
    { key: 'monthly', label: 'This Month' },
  ] as const;

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex bg-gray-100 rounded-xl p-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-white text-green-600 shadow'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Summary Card */}
      <div className="bg-gradient-to-br from-green-600 to-green-700 rounded-2xl p-6 text-white">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-green-100 text-sm">Total Earnings</p>
            <p className="text-3xl font-bold mt-1">{formatCurrency(getTotalEarnings())}</p>
          </div>
          <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
            <DollarSign className="h-6 w-6" />
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-green-200" />
            <span className="text-green-100">{getTotalOrders()} orders</span>
          </div>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-green-200" />
            <span className="text-green-100">+12% vs last {activeTab === 'daily' ? 'day' : activeTab === 'weekly' ? 'week' : 'month'}</span>
          </div>
        </div>
      </div>

      {/* Chart */}
      {activeTab !== 'daily' && (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-gray-900 mb-4">
            {activeTab === 'weekly' ? 'Daily Earnings' : 'Weekly Earnings'}
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={getCurrentData()}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis
                dataKey="date"
                tickFormatter={(value) => {
                  if (activeTab === 'weekly') {
                    return format(new Date(value), 'EEE');
                  }
                  return format(new Date(value), 'MMM dd');
                }}
                stroke="#9CA3AF"
                fontSize={12}
              />
              <YAxis
                tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                stroke="#9CA3AF"
                fontSize={12}
              />
              <Tooltip
                formatter={(value) => [formatCurrency(value as number), 'Earnings']}
                labelFormatter={(label) => format(new Date(label), 'EEEE, MMM dd')}
              />
              <Bar dataKey="earnings" fill="#16a34a" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Daily Breakdown */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
        <h3 className="font-semibold text-gray-900 mb-4">
          {activeTab === 'daily' ? "Today's Earnings" : 'Earnings Breakdown'}
        </h3>
        
        {activeTab === 'daily' ? (
          <div className="space-y-3">
            {dailyData[0].orders > 0 ? (
              Array.from({ length: dailyData[0].orders }, (_, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                      <Package className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">ORD-{format(new Date(), 'yyyyMMdd')}-{String(i + 1).padStart(4, '0')}</p>
                      <p className="text-xs text-gray-500">{format(subDays(new Date(), 0), 'HH:mm')}</p>
                    </div>
                  </div>
                  <p className="font-semibold text-green-600">{formatCurrency(6400)}</p>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500">
                <DollarSign className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>No earnings yet today</p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {getCurrentData().map((data, i) => (
              <div
                key={i}
                className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                    <Calendar className="h-5 w-5 text-gray-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      {format(new Date(data.date), activeTab === 'weekly' ? 'EEEE' : 'MMM dd')}
                    </p>
                    <p className="text-xs text-gray-500">{data.orders} orders</p>
                  </div>
                </div>
                <p className="font-semibold text-green-600">{formatCurrency(data.earnings)}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500">Avg per Order</p>
          <p className="text-xl font-bold text-gray-900">
            {formatCurrency(getTotalOrders() > 0 ? getTotalEarnings() / getTotalOrders() : 0)}
          </p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500">
            {activeTab === 'daily' ? 'Orders Today' : activeTab === 'weekly' ? 'Avg per Day' : 'Avg per Week'}
          </p>
          <p className="text-xl font-bold text-gray-900">
            {activeTab === 'daily' 
              ? getTotalOrders()
              : (getTotalOrders() / getCurrentData().length).toFixed(1)
            } orders
          </p>
        </div>
      </div>
    </div>
  );
}
