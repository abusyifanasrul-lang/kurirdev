import { useMemo, useState } from 'react';
import { ArrowLeft, TrendingUp, DollarSign, Package, Calendar } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format, parseISO, startOfDay, subDays, startOfWeek, startOfMonth, isWithinInterval, endOfDay } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useOrderStore } from '@/stores/useOrderStore';
import { useAuth } from '@/context/AuthContext';
import { useCourierStore } from '@/stores/useCourierStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { calcCourierEarning } from '@/lib/calcEarning';

type Period = 'daily' | 'weekly' | 'monthly';

export function CourierEarnings() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { orders } = useOrderStore();
  const { couriers } = useCourierStore();
  const [period, setPeriod] = useState<Period>('daily');

  const currentCourier = useMemo(() => couriers.find(c => c.id === user?.id), [couriers, user]);
  const COMMISSION_RATE = (currentCourier?.commission_rate ?? 80) / 100;
  const { commission_rate, commission_threshold } = useSettingsStore()
  const earningSettings = { commission_rate, commission_threshold }

  // All delivered orders for this courier
  const deliveredOrders = useMemo(() => {
    if (!user) return [];
    return orders.filter(
      (o) => o.courier_id === user.id && o.status === 'delivered'
    );
  }, [orders, user]);

  // Today's stats
  const todayStats = useMemo(() => {
    const today = startOfDay(new Date());
    const todayEnd = endOfDay(new Date());
    const todayOrders = deliveredOrders.filter((o) => {
      const deliveryDate = o.actual_delivery_time ? parseISO(o.actual_delivery_time) : parseISO(o.created_at);
      return isWithinInterval(deliveryDate, { start: today, end: todayEnd });
    });
    return {
      orders: todayOrders.length,
      totalFee: todayOrders.reduce((sum, o) => sum + (o.total_fee || 0), 0),
      earnings: todayOrders.reduce((sum, o) => sum + calcCourierEarning(o, earningSettings), 0),
    };
  }, [deliveredOrders]);

  // All-time stats
  const allTimeStats = useMemo(() => {
    return {
      orders: deliveredOrders.length,
      totalFee: deliveredOrders.reduce((sum, o) => sum + (o.total_fee || 0), 0),
      earnings: deliveredOrders.reduce((sum, o) => sum + calcCourierEarning(o, earningSettings), 0),
    };
  }, [deliveredOrders]);

  // Chart data - computed from actual orders
  const chartData = useMemo(() => {
    const now = new Date();

    if (period === 'daily') {
      // Last 7 days
      const days = Array.from({ length: 7 }, (_, i) => {
        const date = subDays(now, 6 - i);
        const dayStart = startOfDay(date);
        const dayEnd = endOfDay(date);
        const dayOrders = deliveredOrders.filter((o) => {
          const deliveryDate = o.actual_delivery_time ? parseISO(o.actual_delivery_time) : parseISO(o.created_at);
          return isWithinInterval(deliveryDate, { start: dayStart, end: dayEnd });
        });
        return {
          label: format(date, 'dd/MM'),
          earnings: dayOrders.reduce((sum, o) => sum + calcCourierEarning(o, earningSettings), 0),
          orders: dayOrders.length,
        };
      });
      return days;
    }

    if (period === 'weekly') {
      // Last 4 weeks
      const weeks = Array.from({ length: 4 }, (_, i) => {
        const weekStart = startOfWeek(subDays(now, (3 - i) * 7), { weekStartsOn: 1 });
        const weekEnd = endOfDay(subDays(startOfWeek(subDays(now, (2 - i) * 7), { weekStartsOn: 1 }), 1));
        const weekOrders = deliveredOrders.filter((o) => {
          const deliveryDate = o.actual_delivery_time ? parseISO(o.actual_delivery_time) : parseISO(o.created_at);
          return deliveryDate >= weekStart && deliveryDate <= weekEnd;
        });
        return {
          label: `W${i + 1}`,
          earnings: weekOrders.reduce((sum, o) => sum + calcCourierEarning(o, earningSettings), 0),
          orders: weekOrders.length,
        };
      });
      return weeks;
    }

    // Monthly - last 6 months
    const months = Array.from({ length: 6 }, (_, i) => {
      const date = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const monthStart = startOfMonth(date);
      const monthEnd = endOfDay(new Date(date.getFullYear(), date.getMonth() + 1, 0));
      const monthOrders = deliveredOrders.filter((o) => {
        const d = parseISO(o.created_at);
        return d >= monthStart && d <= monthEnd;
      });
      return {
        label: format(date, 'MMM'),
        earnings: monthOrders.reduce((sum, o) => sum + calcCourierEarning(o, earningSettings), 0),
        orders: monthOrders.length,
      };
    });
    return months;
  }, [deliveredOrders, period]);

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val);

  const formatChartCurrency = (val: number) => {
    if (val >= 1000000) return `${(val / 1000000).toFixed(1)}jt`;
    if (val >= 1000) return `${(val / 1000).toFixed(0)}rb`;
    return val.toString();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
        <div className="flex items-center gap-3 p-4">
          <button onClick={() => navigate('/courier')} className="p-2 hover:bg-white/10 rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg font-bold">Pendapatan</h1>
            <p className="text-xs text-indigo-200">Ringkasan pendapatan kamu</p>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-3 p-4 pt-0">
          <div className="bg-white/10 backdrop-blur rounded-xl p-3">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="w-4 h-4 text-indigo-200" />
              <span className="text-xs text-indigo-200">Hari Ini</span>
            </div>
            <p className="text-lg font-bold break-words leading-tight">{formatCurrency(todayStats.earnings)}</p>
            <p className="text-xs text-indigo-200">{todayStats.orders} pesanan</p>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-xl p-3">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-indigo-200" />
              <span className="text-xs text-indigo-200">Total Semua</span>
            </div>
            <p className="text-lg font-bold break-words leading-tight">{formatCurrency(allTimeStats.earnings)}</p>
            <p className="text-xs text-indigo-200">{allTimeStats.orders} pesanan</p>
          </div>
        </div>
      </div>

      {/* Period Selector */}
      <div className="p-4">
        <div className="flex bg-white rounded-lg border border-gray-200 p-1">
          {(['daily', 'weekly', 'monthly'] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${period === p
                ? 'bg-indigo-600 text-white'
                : 'text-gray-600 hover:bg-gray-50'
                }`}
            >
              {p === 'daily' ? 'Harian' : p === 'weekly' ? 'Mingguan' : 'Bulanan'}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="px-4 pb-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Grafik Pendapatan
          </h3>
          {chartData.every((d) => d.earnings === 0) ? (
            <div className="text-center py-12">
              <Package className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">Belum ada data pendapatan</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={formatChartCurrency} width={45} />
                <Tooltip
                  formatter={(value: number | undefined) => [formatCurrency(value ?? 0), 'Pendapatan']}
                  labelFormatter={(label) => `Periode: ${label}`}
                />
                <Bar dataKey="earnings" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="px-4 pb-8">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Transaksi Terakhir</h3>
        {deliveredOrders.length === 0 ? (
          <div className="text-center py-8 bg-white rounded-xl border border-gray-200">
            <Package className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">Belum ada transaksi</p>
          </div>
        ) : (
          <div className="space-y-2">
            {deliveredOrders.slice(0, 10).map((order) => {
              const earning = calcCourierEarning(order, earningSettings);
              return (
                <div
                  key={order.id}
                  onClick={() => navigate('/courier/history', { state: { highlightOrderId: order.id } })}
                  className="bg-white rounded-xl p-3 border border-gray-100 flex justify-between items-center cursor-pointer hover:shadow-sm transition-shadow"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">{order.order_number}</p>
                    <p className="text-xs text-gray-500">
                      {format(parseISO(order.created_at), 'dd MMM yyyy, HH:mm')} • {order.customer_name}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-green-600">+{formatCurrency(earning)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
