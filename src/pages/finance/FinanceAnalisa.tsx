import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  TrendingUp, DollarSign, Package,
  BarChart3, PieChart as PieChartIcon
} from 'lucide-react';
import { 
  parseISO, startOfDay, endOfDay, subDays, isWithinInterval,
  eachDayOfInterval, format
} from 'date-fns';
import { 
  getLocalNow, getLocalStartOfMonth
} from '@/utils/date';
import { Header } from '@/components/layout/Header';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { lazy, Suspense } from 'react';
import { Card, StatCard } from '@/components/ui/Card';
import { useOrderStore } from '@/stores/useOrderStore';
import { useUserStore } from '@/stores/useUserStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { calcCourierEarning, calcAdminEarning } from '@/lib/calcEarning';
import { getOrdersByDateRange, getAllUnpaidOrdersLocal } from '@/lib/orderCache';
import { formatCurrency, formatShortCurrency } from '@/utils/formatter';
import type { Order } from '@/types';

type Period = '7days' | '30days' | 'thisMonth';

const RevenueBarChart = lazy(() => import('@/components/finance/FinanceCharts').then(m => ({ default: m.RevenueBarChart })));
const PaymentPieChart = lazy(() => import('@/components/finance/FinanceCharts').then(m => ({ default: m.PaymentPieChart })));

function ChartSkeleton({ height = 300 }: { height?: number }) {
  return (
    <div style={{ height }} className="w-full bg-gray-50 animate-pulse rounded-lg flex items-center justify-center">
      <p className="text-xs text-gray-400">Memuat analisis...</p>
    </div>
  );
}

export function FinanceAnalisa() {
  const { orders } = useOrderStore();
  const { users } = useUserStore();
  const { commission_rate, commission_threshold } = useSettingsStore();
  const earningSettings = { commission_rate, commission_threshold };

  const [period, setPeriod] = useState<Period>('7days');
  const [periodOrders, setPeriodOrders] = useState<Order[]>([]);
  const [globalUnpaidOrders, setGlobalUnpaidOrders] = useState<Order[]>([]);

  const loadPeriodOrders = useCallback(async () => {
    const now = getLocalNow();
    let start: Date;
    if (period === '7days') start = startOfDay(subDays(now, 6));
    else if (period === '30days') start = startOfDay(subDays(now, 29));
    else start = getLocalStartOfMonth();
    const end = endOfDay(now);

    const [dbOrders, dbUnpaid] = await Promise.all([
      getOrdersByDateRange(start.toISOString(), end.toISOString()),
      getAllUnpaidOrdersLocal()
    ]);
    setPeriodOrders(dbOrders);
    setGlobalUnpaidOrders(dbUnpaid);
  }, [period]);

  useEffect(() => {
    loadPeriodOrders();
    window.addEventListener('indexeddb-synced', loadPeriodOrders);
    return () => window.removeEventListener('indexeddb-synced', loadPeriodOrders);
  }, [loadPeriodOrders]);

  const allOrders = useMemo(() => {
    const map = new Map<string, Order>();
    periodOrders.forEach(o => map.set(o.id, o));
    globalUnpaidOrders.forEach(o => map.set(o.id, o));
    orders.forEach(o => map.set(o.id, o));
    return Array.from(map.values());
  }, [periodOrders, globalUnpaidOrders, orders]);

  const dateRange = useMemo(() => {
    const now = getLocalNow();
    if (period === '7days') {
      return { start: startOfDay(subDays(now, 6)), end: endOfDay(now) };
    }
    if (period === '30days') {
      return { start: startOfDay(subDays(now, 29)), end: endOfDay(now) };
    }
    return { start: getLocalStartOfMonth(), end: endOfDay(now) };
  }, [period]);

  // Filtered orders in range
  const filteredOrders = useMemo(() => {
    return allOrders.filter(o => {
      const dateStr = o.actual_delivery_time || o.created_at;
      if (!dateStr) return false;
      const date = parseISO(dateStr);
      return isWithinInterval(date, dateRange);
    });
  }, [allOrders, dateRange]);

  const filteredDelivered = useMemo(() =>
    filteredOrders.filter(o => o.status === 'delivered'),
    [filteredOrders]
  );

  // Financial summary
  const financialSummary = useMemo(() => {
    const grossRevenue = filteredDelivered.reduce((sum, o) => sum + (o.total_fee || 0), 0);
    const courierPayout = filteredDelivered.reduce((sum, o) =>
      sum + calcCourierEarning(o, earningSettings), 0
    );
    const netRevenue = filteredDelivered.reduce((sum, o) =>
      sum + calcAdminEarning(o, earningSettings), 0
    );

    const paidOrders = filteredDelivered.filter(o => o.payment_status === 'paid');
    const unpaidOrders = filteredDelivered.filter(o => o.payment_status === 'unpaid');

    const collectedAmount = paidOrders.reduce((sum, o) =>
      sum + calcAdminEarning(o, earningSettings), 0
    );
    const uncollectedAmount = unpaidOrders.reduce((sum, o) =>
      sum + calcAdminEarning(o, earningSettings), 0
    );

    return {
      grossRevenue,
      courierPayout,
      netRevenue,
      totalOrders: filteredOrders.length,
      deliveredCount: filteredDelivered.length,
      successRate: filteredOrders.length > 0
        ? (filteredDelivered.length / filteredOrders.length * 100).toFixed(1)
        : '0',
      collectedAmount,
      uncollectedAmount,
      collectionRate: (collectedAmount + uncollectedAmount) > 0
        ? (collectedAmount / (collectedAmount + uncollectedAmount) * 100).toFixed(1)
        : '0',
    };
  }, [filteredOrders, filteredDelivered]);

  // Daily data for chart
  const dailyData = useMemo(() => {
    const days = eachDayOfInterval(dateRange);
    return days.map(day => {
      const dayStart = startOfDay(day);
      const dayEnd = endOfDay(day);
      const dayDelivered = filteredDelivered.filter(o => {
        const dateStr = o.actual_delivery_time || o.created_at;
        return isWithinInterval(parseISO(dateStr), { start: dayStart, end: dayEnd });
      });

      const gross = dayDelivered.reduce((sum, o) => sum + (o.total_fee || 0), 0);

      return {
        date: format(day, 'dd/MM'),
        gross,
        net: dayDelivered.reduce((sum, o) => sum + calcAdminEarning(o, earningSettings), 0),
        orders: dayDelivered.length,
      };
    });
  }, [filteredDelivered, dateRange]);

  // Top couriers by revenue
  const topCouriers = useMemo(() => {
    const stats: Record<string, { name: string; orders: number; gross: number; earning: number }> = {};
    filteredDelivered.forEach(o => {
      if (!o.courier_id) return;
      if (!stats[o.courier_id]) {
        const courier = users.find(u => u.id === o.courier_id);
        stats[o.courier_id] = { name: o.courier_name || courier?.name || 'Unknown', orders: 0, gross: 0, earning: 0 };
      }
      stats[o.courier_id].orders++;
      stats[o.courier_id].gross += o.total_fee || 0;
      stats[o.courier_id].earning += calcCourierEarning(o, earningSettings);
    });
    return Object.values(stats)
      .sort((a, b) => b.gross - a.gross)
      .slice(0, 5);
  }, [filteredDelivered, users]);

  // Payment status distribution
  const paymentData = useMemo(() => {
    const paid = filteredDelivered.filter(o => o.payment_status === 'paid').length;
    const unpaid = filteredDelivered.filter(o => o.payment_status === 'unpaid').length;
    return [
      { name: 'Sudah Setor', value: paid, color: '#22C55E' },
      { name: 'Belum Setor', value: unpaid, color: '#F59E0B' },
    ].filter(d => d.value > 0);
  }, [filteredDelivered]);


  return (
    <div className="min-h-screen bg-gray-50">
      <h1 className="sr-only">Analisa Keuangan KurirMe</h1>
      <label className="sr-only">Financial Dashboard Control</label>

      <Header
        title="Analisa Keuangan"
        subtitle="Laporan fiskal dan tren bisnis"
      />

      <div className="p-4 lg:p-8 space-y-6">
        {/* Period Selector */}
        <div className="flex items-center justify-between">
          <div className="flex bg-white rounded-lg border border-gray-200 p-1">
            {([
              { key: '7days', label: '7 Hari' },
              { key: '30days', label: '30 Hari' },
              { key: 'thisMonth', label: 'Bulan Ini' },
            ] as const).map((p) => (
              <button
                key={p.key}
                onClick={() => setPeriod(p.key)}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  period === p.key
                    ? 'bg-amber-600 text-white'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard
            title="Pendapatan Kotor"
            value={formatCurrency(financialSummary.grossRevenue)}
            icon={<DollarSign className="h-5 w-5" />}
            subtitle={`${financialSummary.deliveredCount} order delivered`}
          />
          <StatCard
            title="Komisi Kurir"
            value={formatCurrency(financialSummary.courierPayout)}
            icon={<Package className="h-5 w-5" />}
            subtitle={`${commission_rate}% dari fee`}
          />
          <StatCard
            title="Net Revenue"
            value={formatCurrency(financialSummary.netRevenue)}
            icon={<TrendingUp className="h-5 w-5" />}
            subtitle="Pendapatan bersih platform"
          />
          <StatCard
            title="Tingkat Setoran"
            value={`${financialSummary.collectionRate}%`}
            icon={<BarChart3 className="h-5 w-5" />}
            subtitle={formatCurrency(financialSummary.collectedAmount)}
          />
        </div>

        {/* Revenue Chart */}
        <Card>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Tren Pendapatan</h2>
          <ErrorBoundary>
            <Suspense fallback={<ChartSkeleton height={300} />}>
              <RevenueBarChart 
                data={dailyData} 
                formatCurrency={formatCurrency} 
                formatShortCurrency={formatShortCurrency}
              />
            </Suspense>
          </ErrorBoundary>
        </Card>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Payment Status */}
          <Card>
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <PieChartIcon className="h-5 w-5 text-amber-600" />
              Status Setoran
            </h2>
            {paymentData.length > 0 ? (
              <div className="flex items-center gap-6">
              <ErrorBoundary>
                <Suspense fallback={<ChartSkeleton height={180} />}>
                  <PaymentPieChart data={paymentData} />
                </Suspense>
              </ErrorBoundary>
                <div className="space-y-3">
                  {paymentData.map((item) => (
                    <div key={item.name} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-sm text-gray-600">{item.name}: {item.value}</span>
                    </div>
                  ))}
                  <div className="pt-2 border-t border-gray-100">
                    <p className="text-sm text-gray-500">
                      Belum disetor: <span className="font-semibold text-amber-600">
                        {formatCurrency(financialSummary.uncollectedAmount)}
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400">Tidak ada data</div>
            )}
          </Card>

          {/* Top Couriers */}
          <Card>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Top Kurir</h2>
            {topCouriers.length > 0 ? (
              <div className="space-y-3">
                {topCouriers.map((c, i) => (
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
                        <p className="text-xs text-gray-500">{c.orders} order</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gray-900 text-sm">{formatCurrency(c.gross)}</p>
                      <p className="text-xs text-green-600">Net: {formatCurrency(c.gross - c.earning)}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400">Tidak ada data</div>
            )}
          </Card>
        </div>

        {/* Aging Report */}
        <Card>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Umur Piutang (Aging Report)</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {(() => {
              const now = getLocalNow();
              const unpaid = allOrders.filter(o => o.status === 'delivered' && o.payment_status === 'unpaid');
              const buckets = [
                { label: '0-3 hari', min: 0, max: 3, color: 'green' },
                { label: '4-7 hari', min: 4, max: 7, color: 'amber' },
                { label: '8-14 hari', min: 8, max: 14, color: 'orange' },
                { label: '15+ hari', min: 15, max: 999, color: 'red' },
              ];
              return buckets.map(bucket => {
                const bucketOrders = unpaid.filter(o => {
                  const days = Math.floor((now.getTime() - new Date(o.created_at).getTime()) / (1000 * 60 * 60 * 24));
                  return days >= bucket.min && days <= bucket.max;
                });
                const total = bucketOrders.reduce((sum, o) =>
                  sum + calcAdminEarning(o, earningSettings), 0
                );
                const colorMap: Record<string, string> = {
                  green: 'bg-green-50 border-green-200 text-green-800',
                  amber: 'bg-amber-50 border-amber-200 text-amber-800',
                  orange: 'bg-orange-50 border-orange-200 text-orange-800',
                  red: 'bg-red-50 border-red-200 text-red-800',
                };
                return (
                  <div key={bucket.label} className={`p-4 rounded-xl border ${colorMap[bucket.color]}`}>
                    <p className="text-sm font-medium">{bucket.label}</p>
                    <p className="text-lg font-bold mt-1">{formatCurrency(total)}</p>
                    <p className="text-xs opacity-70 mt-1">{bucketOrders.length} order</p>
                  </div>
                );
              });
            })()}
          </div>
        </Card>
      </div>
    </div>
  );
}
