import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  TrendingUp, DollarSign, Package, Users,
  Award, BarChart3, ArrowRight
} from 'lucide-react';
import {
  format, parseISO, startOfDay, endOfDay, subDays, isWithinInterval
} from 'date-fns';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { Header } from '@/components/layout/Header';
import { Card, StatCard } from '@/components/ui/Card';
import { useOrderStore } from '@/stores/useOrderStore';
import { useUserStore } from '@/stores/useUserStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { calcAdminEarning } from '@/lib/calcEarning';
import { getOrdersForWeek } from '@/lib/orderCache';
import { useNavigate } from 'react-router-dom';
import type { Order } from '@/types';

const COLORS = ['#F59E0B', '#3B82F6', '#8B5CF6', '#06B6D4', '#22C55E', '#EF4444'];

type Period = 'today' | '7days' | '30days';

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  assigned: 'Assigned',
  picked_up: 'Picked Up',
  in_transit: 'In Transit',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

export function OwnerOverview() {
  const navigate = useNavigate();
  const { orders } = useOrderStore();
  const { users } = useUserStore();
  const { commission_rate, commission_threshold } = useSettingsStore();
  const earningSettings = { commission_rate, commission_threshold };

  const couriers = users.filter(u => u.role === 'courier');
  const activeCouriers = couriers.filter(u => u.is_online);

  const [period, setPeriod] = useState<Period>('today');
  const [weekOrders, setWeekOrders] = useState<Order[]>([]);

  const loadWeekOrders = useCallback(async () => {
    const dbOrders = await getOrdersForWeek();
    setWeekOrders(dbOrders);
  }, []);

  useEffect(() => {
    loadWeekOrders();
    window.addEventListener('indexeddb-synced', loadWeekOrders);
    return () => window.removeEventListener('indexeddb-synced', loadWeekOrders);
  }, [loadWeekOrders]);

  const allOrders = useMemo(() => {
    const map = new Map<string, Order>();
    weekOrders.forEach(o => map.set(o.id, o));
    orders.forEach(o => map.set(o.id, o));
    return Array.from(map.values());
  }, [weekOrders, orders]);

  // Period range
  const dateRange = useMemo(() => {
    const now = new Date();
    if (period === 'today') {
      return { start: startOfDay(now), end: endOfDay(now) };
    }
    if (period === '7days') {
      return { start: startOfDay(subDays(now, 6)), end: endOfDay(now) };
    }
    return { start: startOfDay(subDays(now, 29)), end: endOfDay(now) };
  }, [period]);

  // Filtered orders
  const filteredOrders = useMemo(() => {
    return allOrders.filter(o => {
      const dateStr = o.created_at;
      if (!dateStr) return false;
      const date = parseISO(dateStr);
      return isWithinInterval(date, dateRange);
    });
  }, [allOrders, dateRange]);

  const deliveredOrders = useMemo(() =>
    filteredOrders.filter(o => o.status === 'delivered'),
    [filteredOrders]
  );

  // KPIs
  const kpis = useMemo(() => {
    const grossRevenue = deliveredOrders.reduce((sum, o) => sum + (o.total_fee || 0), 0);
    const netRevenue = deliveredOrders.reduce((sum, o) =>
      sum + calcAdminEarning(o, earningSettings), 0
    );
    const successRate = filteredOrders.length > 0
      ? (deliveredOrders.length / filteredOrders.length * 100)
      : 0;
    const pendingOrders = allOrders.filter(o => o.status === 'pending').length;

    return {
      totalOrders: filteredOrders.length,
      grossRevenue,
      netRevenue,
      successRate,
      pendingOrders,
      activeCouriers: activeCouriers.length,
      totalCouriers: couriers.length,
    };
  }, [filteredOrders, deliveredOrders, allOrders, activeCouriers, couriers]);

  // Revenue trend (7 days)
  const revenueTrend = useMemo(() => {
    const now = new Date();
    const days = Array.from({ length: 7 }, (_, i) => {
      const date = subDays(now, 6 - i);
      const dayStart = startOfDay(date);
      const dayEnd = endOfDay(date);
      const dayDelivered = allOrders.filter(o => {
        if (o.status !== 'delivered') return false;
        return isWithinInterval(parseISO(o.created_at), { start: dayStart, end: dayEnd });
      });
      const revenue = dayDelivered.reduce((sum, o) => sum + (o.total_fee || 0), 0);
      return {
        date: format(date, 'dd/MM'),
        revenue,
        orders: dayDelivered.length,
      };
    });
    return days;
  }, [allOrders]);

  // Order status distribution
  const statusDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredOrders.forEach(o => {
      counts[o.status] = (counts[o.status] || 0) + 1;
    });
    return Object.entries(counts).map(([status, count]) => ({
      name: STATUS_LABELS[status] || status,
      value: count,
    }));
  }, [filteredOrders]);

  // Top performers
  const topPerformers = useMemo(() => {
    const stats: Record<string, { name: string; orders: number; revenue: number }> = {};
    deliveredOrders.forEach(o => {
      if (!o.courier_id) return;
      if (!stats[o.courier_id]) {
        const courier = users.find(u => u.id === o.courier_id);
        stats[o.courier_id] = { name: courier?.name || 'Unknown', orders: 0, revenue: 0 };
      }
      stats[o.courier_id].orders++;
      stats[o.courier_id].revenue += o.total_fee || 0;
    });
    return Object.values(stats).sort((a, b) => b.orders - a.orders).slice(0, 5);
  }, [deliveredOrders, users]);

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val);

  const formatShortCurrency = (val: number) => {
    if (val >= 1000000) return `${(val / 1000000).toFixed(1)}jt`;
    if (val >= 1000) return `${(val / 1000).toFixed(0)}rb`;
    return val.toString();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header
        title="Business Overview"
        subtitle={`Ringkasan bisnis • ${format(new Date(), 'dd MMM yyyy')}`}
      />

      <div className="p-4 lg:p-8 space-y-6">
        {/* Period Selector */}
        <div className="flex items-center justify-between">
          <div className="flex bg-white rounded-lg border border-gray-200 p-1">
            {([
              { key: 'today', label: 'Hari Ini' },
              { key: '7days', label: '7 Hari' },
              { key: '30days', label: '30 Hari' },
            ] as const).map((p) => (
              <button
                key={p.key}
                onClick={() => setPeriod(p.key)}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  period === p.key
                    ? 'bg-emerald-600 text-white'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard
            title="Revenue Kotor"
            value={formatCurrency(kpis.grossRevenue)}
            icon={<DollarSign className="h-5 w-5" />}
            subtitle={`${kpis.totalOrders} order`}
          />
          <StatCard
            title="Net Revenue"
            value={formatCurrency(kpis.netRevenue)}
            icon={<TrendingUp className="h-5 w-5" />}
            subtitle="Pendapatan bersih"
          />
          <StatCard
            title="Success Rate"
            value={`${kpis.successRate.toFixed(1)}%`}
            icon={<BarChart3 className="h-5 w-5" />}
            subtitle={`${deliveredOrders.length}/${kpis.totalOrders} delivered`}
          />
          <StatCard
            title="Kurir Aktif"
            value={`${kpis.activeCouriers}/${kpis.totalCouriers}`}
            icon={<Users className="h-5 w-5" />}
            subtitle={`${kpis.pendingOrders} order pending`}
            to="/admin/dashboard"
          />
        </div>

        {/* Revenue Trend */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Tren Revenue (7 Hari)</h3>
            <div className="flex items-center gap-2 text-emerald-600">
              <TrendingUp className="h-4 w-4" />
              <span className="text-sm font-medium">Live</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={revenueTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#9CA3AF" />
              <YAxis tickFormatter={formatShortCurrency} tick={{ fontSize: 11 }} stroke="#9CA3AF" width={50} />
              <Tooltip
                formatter={(value) => [formatCurrency(Number(value || 0))]}
                labelFormatter={(label) => `Tanggal: ${label}`}
              />
              <Line
                type="monotone"
                dataKey="revenue"
                stroke="#10B981"
                strokeWidth={2}
                dot={{ fill: '#10B981', strokeWidth: 2 }}
                name="Revenue"
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        {/* Two Column */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Status Distribution */}
          <Card>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Distribusi Status</h3>
            {statusDistribution.length > 0 ? (
              <div className="flex items-center gap-6">
                <ResponsiveContainer width="50%" height={180}>
                  <PieChart>
                    <Pie
                      data={statusDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={60}
                      dataKey="value"
                    >
                      {statusDistribution.map((_, index) => (
                        <Cell key={index} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2">
                  {statusDistribution.slice(0, 5).map((item, i) => (
                    <div key={item.name} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="text-sm text-gray-600">{item.name}: {item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400">Tidak ada data</div>
            )}
          </Card>

          {/* Top Performers */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Award className="h-5 w-5 text-emerald-600" />
                Top Performers
              </h3>
              <button
                onClick={() => navigate('/admin/couriers')}
                className="text-sm text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1"
              >
                Lihat Semua <ArrowRight className="h-4 w-4" />
              </button>
            </div>
            {topPerformers.length > 0 ? (
              <div className="space-y-3">
                {topPerformers.map((c, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                        i === 0 ? 'bg-yellow-100 text-yellow-700' :
                        i === 1 ? 'bg-gray-200 text-gray-600' :
                        i === 2 ? 'bg-orange-100 text-orange-700' :
                        'bg-gray-100 text-gray-500'
                      }`}>
                        {i + 1}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 text-sm">{c.name}</p>
                        <p className="text-xs text-gray-500">{c.orders} order delivered</p>
                      </div>
                    </div>
                    <p className="font-semibold text-gray-900 text-sm">{formatCurrency(c.revenue)}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400">Tidak ada data</div>
            )}
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            onClick={() => navigate('/admin/dashboard')}
            className="flex items-center gap-3 p-4 bg-white border border-gray-200 rounded-xl hover:border-indigo-300 hover:shadow-sm transition-all"
          >
            <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
              <Package className="h-5 w-5 text-indigo-600" />
            </div>
            <div className="text-left">
              <p className="font-medium text-gray-900">Operasional</p>
              <p className="text-xs text-gray-500">Kelola order & kurir</p>
            </div>
          </button>
          <button
            onClick={() => navigate('/admin/reports')}
            className="flex items-center gap-3 p-4 bg-white border border-gray-200 rounded-xl hover:border-emerald-300 hover:shadow-sm transition-all"
          >
            <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
              <BarChart3 className="h-5 w-5 text-emerald-600" />
            </div>
            <div className="text-left">
              <p className="font-medium text-gray-900">Laporan</p>
              <p className="text-xs text-gray-500">Export laporan detail</p>
            </div>
          </button>
          <button
            onClick={() => navigate('/admin/settings')}
            className="flex items-center gap-3 p-4 bg-white border border-gray-200 rounded-xl hover:border-purple-300 hover:shadow-sm transition-all"
          >
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <Users className="h-5 w-5 text-purple-600" />
            </div>
            <div className="text-left">
              <p className="font-medium text-gray-900">Pengaturan</p>
              <p className="text-xs text-gray-500">Konfigurasi bisnis</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
