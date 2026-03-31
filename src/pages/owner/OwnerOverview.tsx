import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  TrendingUp, DollarSign, Users,
  Award, BarChart3, ShoppingBag,
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
import { getOrdersForWeek, getTopCustomers, getTopCouriers } from '@/lib/orderCache';
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
  const { orders } = useOrderStore();
  const { users } = useUserStore();
  const { commission_rate, commission_threshold } = useSettingsStore();
  const earningSettings = { commission_rate, commission_threshold };

  const couriers = users.filter(u => u.role === 'courier');
  const activeCouriers = couriers.filter(u => u.is_online);

  const [period, setPeriod] = useState<Period>('today');
  const [weekOrders, setWeekOrders] = useState<Order[]>([]);
  const [topCustomers, setTopCustomers] = useState<{ name: string; order_count: number; total_fee: number }[]>([]);
  const [topCouriersLocal, setTopCouriersLocal] = useState<{ id: string; name: string; delivery_count: number; total_fee: number }[]>([]);

  // Build courier name map for local aggregation
  const courierNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    users.filter(u => u.role === 'courier').forEach(u => { map[u.id] = u.name; });
    return map;
  }, [users]);

  const loadLocalData = useCallback(async () => {
    const dbOrders = await getOrdersForWeek();
    setWeekOrders(dbOrders);
    const [customers, localCouriers] = await Promise.all([
      getTopCustomers(5),
      getTopCouriers(5, courierNameMap),
    ]);
    setTopCustomers(customers);
    setTopCouriersLocal(localCouriers);
  }, [courierNameMap]);

  useEffect(() => {
    loadLocalData();
    window.addEventListener('indexeddb-synced', loadLocalData);
    return () => window.removeEventListener('indexeddb-synced', loadLocalData);
  }, [loadLocalData]);

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

  // Top performers — from local IndexedDB aggregation
  const topPerformers = topCouriersLocal;

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

          {/* Top Kurir (Local-First) */}
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <Award className="h-5 w-5 text-emerald-600" />
              <h3 className="text-lg font-semibold text-gray-900">Top Kurir</h3>
            </div>
            {topPerformers.length > 0 ? (
              <div className="space-y-3">
                {topPerformers.map((c, i) => (
                  <div key={c.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
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
                        <p className="text-xs text-gray-500">{c.delivery_count} delivery</p>
                      </div>
                    </div>
                    <p className="font-semibold text-gray-900 text-sm">{formatCurrency(c.total_fee)}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400">Tidak ada data lokal</div>
            )}
          </Card>
        </div>

        {/* Top Customers (Local-First) */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <ShoppingBag className="h-5 w-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">Top Pelanggan</h3>
          </div>
          {topCustomers.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {topCustomers.map((c, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm">
                      {i + 1}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{c.name}</p>
                      <p className="text-xs text-gray-500">{c.order_count} order</p>
                    </div>
                  </div>
                  <p className="font-semibold text-gray-900 text-sm">{formatCurrency(c.total_fee)}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-gray-400 text-sm">Tidak ada data lokal</div>
          )}
        </Card>
      </div>
    </div>
  );
}
