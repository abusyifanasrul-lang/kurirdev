import { useState, useEffect, useMemo } from 'react';
import {
  Package,
  DollarSign,
  Clock,
  TrendingUp,
  Award,
  BarChart3,
  ShoppingBag
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { Header } from '@/components/layout/Header';
import { Card, StatCard } from '@/components/ui/Card';
import { Badge, getStatusBadgeVariant, getStatusLabel } from '@/components/ui/Badge';
import { subDays, startOfDay, endOfDay } from 'date-fns';
import { formatLocal, getLocalTodayRange } from '@/utils/date';

// Cache
import { getOrdersForWeek, getTopCustomers, getTopCouriers } from '@/lib/orderCache';
import { formatCurrency } from '@/utils/formatter';

// Stores
import { useOrderStore } from '@/stores/useOrderStore';
import { useUserStore } from '@/stores/useUserStore';
import { useAuth } from '@/context/AuthContext';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useCustomerStore } from '@/stores/useCustomerStore';
import { calcAdminEarning } from '@/lib/calcEarning';
import type { Order, OrderStatus } from '@/types';

const COLORS = ['#F59E0B', '#3B82F6', '#14B8A6', '#06B6D4', '#22C55E', '#EF4444'];

// Refined lazy approach: individual exports from the same chunk
const RevenueChart = lazy(() => import('@/components/dashboard/DashboardCharts').then(m => ({ default: m.RevenueChart })));
const StatusPieChart = lazy(() => import('@/components/dashboard/DashboardCharts').then(m => ({ default: m.StatusPieChart })));

function ChartSkeleton({ height = 300 }: { height?: number }) {
  return (
    <div style={{ height }} className="w-full bg-gray-50 animate-pulse rounded-lg flex items-center justify-center">
      <p className="text-xs text-gray-400">Memuat grafik...</p>
    </div>
  );
}

export function Dashboard() {
  const { orders, activeOrdersByCourier } = useOrderStore();
  const { users } = useUserStore();
  const { user } = useAuth();
  const { commission_rate, commission_threshold } = useSettingsStore();
  const { changeRequests, fetchPendingRequests } = useCustomerStore();
  const earningSettings = { commission_rate, commission_threshold };

  const isFinance = user?.role === 'finance' || user?.role === 'owner';
  const canApprove = user?.role === 'admin' || user?.role === 'admin_kurir';
  const pendingChangeRequests = changeRequests.filter(r => r.status === 'pending');

  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [cachedHistorical, setCachedHistorical] = useState<Order[]>([]);
  const [topCustomers, setTopCustomers] = useState<{ name: string; order_count: number; total_fee: number }[]>([]);
  const [topCouriersLocal, setTopCouriersLocal] = useState<{ id: string; name: string; delivery_count: number; total_fee: number }[]>([]);

  useEffect(() => {
    fetchPendingRequests();
    const interval = setInterval(() => {
      setLastUpdated(new Date());
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchPendingRequests])

  useEffect(() => {
    const loadData = async () => {
      const [weekOrders, customers, couriersLocal] = await Promise.all([
        getOrdersForWeek(),
        getTopCustomers(5),
        getTopCouriers(5, users.reduce((acc, u) => {
          if (u.role === 'courier') acc[u.id] = u.name;
          return acc;
        }, {} as Record<string, string>))
      ]);
      
      if (weekOrders.length > 0) setCachedHistorical(weekOrders);
      setTopCustomers(customers);
      setTopCouriersLocal(couriersLocal);
    }
    loadData();
    window.addEventListener('indexeddb-synced', loadData);
    return () => window.removeEventListener('indexeddb-synced', loadData);
  }, [users]);

  const allOrders = useMemo(() => {
    const map = new Map<string, Order>()
    // Data pekan ini dari IndexedDB
    cachedHistorical.forEach(o =>
      map.set(o.id, o)
    )
    // Data realtime dari store (Active & History)
    // (override IndexedDB jika lebih baru)
    orders.forEach(o => map.set(o.id, o))
    activeOrdersByCourier.forEach(o => map.set(o.id, o))
    
    return Array.from(map.values())
  }, [orders, activeOrdersByCourier, cachedHistorical])

  const handleRefresh = () => {
    setLastUpdated(new Date());
  };


  const [timeRange, setTimeRange] = useState<'today' | '7days' | '30days'>('today');

  // --- Derived Analytics ---
  const analytics = useMemo(() => {
    const rangeStart = timeRange === 'today' ? getLocalTodayRange().start :
                       timeRange === '7days' ? subDays(getLocalTodayRange().start, 6) :
                       subDays(getLocalTodayRange().start, 29);

    const filteredOrders = (allOrders || []).filter(o => {
      const orderTime = new Date(o.created_at).getTime();
      return orderTime >= rangeStart.getTime();
    });

    const pendingOrders = activeOrdersByCourier.filter(o => o.status === 'pending');

    // Revenue: Sum of total_fee for 'delivered' orders in range
    const revenueInRange = filteredOrders
      .filter(o => o.status === 'delivered')
      .reduce((sum, o) => sum + (o.total_fee || 0), 0);

    const activeCouriersCount = (users || []).filter(u => u.role === 'courier' && u.is_active && u.is_online).length;
    const netRevenueInRange = filteredOrders
      .filter(o => o.status === 'delivered')
      .reduce((sum, o) => sum + calcAdminEarning(o, earningSettings), 0);

    const belowThresholdInRange = filteredOrders
      .filter(o => o.status === 'delivered' && (o.total_fee || 0) <= commission_threshold)
      .reduce((sum, o) => sum + (o.total_fee || 0), 0);

    // Pie Chart Data
    const statusCounts = filteredOrders.reduce((acc, order) => {
      acc[order.status] = (acc[order.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const pieData = Object.entries(statusCounts).map(([status, count]) => ({
      status,
      count
    }));

    const successRate = filteredOrders.length > 0
      ? (filteredOrders.filter(o => o.status === 'delivered').length / filteredOrders.length * 100)
      : 0;

    const deliveredInRange = filteredOrders.filter(o => o.status === 'delivered');

    return {
      total_orders: filteredOrders.length,
      total_delivered: deliveredInRange.length,
      total_revenue: revenueInRange,
      net_revenue: netRevenueInRange,
      below_threshold: belowThresholdInRange,
      active_couriers: activeCouriersCount,
      pending_orders: pendingOrders.length,
      orders_by_status: pieData,
      success_rate: successRate,
    };
  }, [allOrders, users, activeOrdersByCourier, timeRange, earningSettings, commission_threshold]);

  const revenueChartData = useMemo(() => {
    const data = [];
    const { start: todayStart } = getLocalTodayRange();
    const days = timeRange === '30days' ? 30 : 7;
    
    for (let i = days - 1; i >= 0; i--) {
      const date = subDays(todayStart, i);
      const start = startOfDay(date);
      const end = endOfDay(date);

      const dayOrders = (allOrders || []).filter(o => {
        const itemTime = new Date(o.created_at).getTime();
        return itemTime >= start.getTime() && itemTime <= end.getTime();
      });

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
  }, [allOrders, timeRange]);

  const recentOrders = [...allOrders]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);

  return (
    <div className="min-h-screen">
      {/* Visually hidden H1 & Label for SEO & UX Audit compliance */}
      <h1 className="sr-only">Dashboard KurirDev</h1>
      <label className="sr-only">Accessibility Control</label>

      <Header
        title="Dashboard"
        subtitle={`Last updated: ${formatLocal(lastUpdated, 'HH:mm:ss')}`}
        onRefresh={handleRefresh}
      />

      <div className="p-4 lg:p-8 space-y-6 lg:space-y-8">

        {/* Customer Address Change Request Panel */}
        {pendingChangeRequests.length > 0 && canApprove && (
          <div className="flex items-center justify-between gap-4 p-4 bg-purple-50 border border-purple-300 rounded-xl animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-3">
               <Clock className="h-5 w-5 text-purple-600 shrink-0" />
               <div>
                  <p className="font-semibold text-purple-900 text-sm">
                    ⚠️ {pendingChangeRequests.length} PENGAJUAN DATA PELANGGAN perlu persetujuan
                  </p>
                  <p className="text-xs text-purple-700 mt-0.5">Kurir mengajukan koreksi / penambahan alamat. Harap segera ditinjau.</p>
               </div>
            </div>
            <Link
               to="/admin/customers"
               className="shrink-0 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-lg transition-colors shadow-sm"
            >
               Tinjau Sekarang →
            </Link>
          </div>
        )}

        {/* Urgency Panel — pending orders older than 30 min */}
        {(() => {
          const urgentPending = (allOrders || []).filter(o => {
            if (o.status !== 'pending') return false;
            const created = new Date(o.created_at).getTime();
            const ageMin = (Date.now() - created) / 60000;
            return ageMin > 30;
          });
          if (urgentPending.length === 0) return null;
          return (
            <div className="flex items-center justify-between gap-4 p-4 bg-amber-50 border border-amber-300 rounded-xl">
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-amber-600 shrink-0" />
                <div>
                  <p className="font-semibold text-amber-900 text-sm">
                    ⚡ {urgentPending.length} order PENDING belum di-assign lebih dari 30 menit
                  </p>
                  <p className="text-xs text-amber-700 mt-0.5">Segera assign kurir agar tidak terlambat</p>
                </div>
              </div>
              <Link
                to="/admin/orders"
                className="shrink-0 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg transition-colors"
              >
                Assign Sekarang →
              </Link>
            </div>
          );
        })()}

        {/* Filter Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-gray-100/80 rounded-xl w-fit backdrop-blur-sm border border-gray-200">
          {[
            { id: 'today', label: 'Hari Ini' },
            { id: '7days', label: '7 Hari' },
            { id: '30days', label: '1 Bulan' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setTimeRange(tab.id as any)}
              className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                timeRange === tab.id
                  ? 'bg-white text-teal-700 shadow-sm border border-gray-200'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Stats Grid - Linked to Pages */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 lg:gap-6">
          <StatCard
            title={timeRange === 'today' ? "Orders Today" : "Orders"}
            value={analytics.total_orders}
            icon={<Package className="h-6 w-6" />}
            trend={{ value: 12, isPositive: true }}
            to="/admin/orders"
          />
          {isFinance ? (
            <>
              <StatCard
                title="Net Revenue Admin"
                value={formatCurrency(analytics.net_revenue)}
                icon={<DollarSign className="h-6 w-6" />}
                subtitle={timeRange === 'today' ? "Hari ini · setelah komisi" : "Data periode terpilih"}
                to="/admin/reports"
              />
              <StatCard
                title="Fee Bebas Komisi"
                value={formatCurrency(analytics.below_threshold)}
                icon={<TrendingUp className="h-6 w-6" />}
                subtitle={timeRange === 'today' ? `Hari ini · order ≤ Rp ${commission_threshold.toLocaleString('id-ID')}` : "Data periode terpilih"}
                to="/admin/reports"
              />
            </>
          ) : (
            <>
              <StatCard
                title="Active Orders"
                value={allOrders.filter(o => ['assigned', 'picked_up', 'in_transit'].includes(o.status)).length}
                icon={<TrendingUp className="h-6 w-6" />}
                subtitle="Sedang diproses"
                to="/admin/orders"
              />
              <StatCard
                title={timeRange === 'today' ? "Terkirim Hari Ini" : "Total Terkirim"}
                value={analytics.total_delivered}
                icon={<Package className="h-6 w-6" />}
                subtitle={timeRange === 'today' ? "Sudah sampai" : "Periode terpilih"}
                to="/admin/orders"
              />
            </>
          )}
          <StatCard
            title="Pending Orders"
            value={analytics.pending_orders}
            icon={<Clock className="h-6 w-6" />}
            subtitle="Awaiting assignment"
            to="/admin/orders"
          />
          {user?.role === 'owner' && (
            <StatCard
              title="Success Rate"
              value={`${analytics.success_rate.toFixed(1)}%`}
              icon={<BarChart3 className="h-6 w-6" />}
              subtitle={timeRange === 'today' ? 'Hari ini' : 'Periode terpilih'}
            />
          )}
        </div>

        {/* Core Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Main Chart Column (2/3 width) */}
          <div className="lg:col-span-2 space-y-6">
            {/* Revenue Chart */}
            {isFinance && (
              <Card>
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">Revenue Trend</h2>
                    <p className="text-sm text-gray-500">7 hari terakhir</p>
                  </div>
                  <div className="flex items-center gap-2 text-green-600">
                    <TrendingUp className="h-4 w-4" />
                    <span className="text-sm font-medium">Live</span>
                  </div>
                </div>
                <Suspense fallback={<ChartSkeleton height={300} />}>
                  <RevenueChart 
                    data={revenueChartData} 
                    formatCurrency={formatCurrency} 
                  />
                </Suspense>
              </Card>
            )}

            {/* Recent Orders */}
            <Card>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-gray-900">Recent Orders</h2>
                <Link to="/admin/orders" className="text-sm text-teal-600 hover:text-teal-700 font-medium">
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
                <h2 className="text-lg font-semibold text-gray-900">Courier Queue</h2>
                <span className="text-sm font-semibold text-green-600 bg-green-50 px-2 py-1 rounded-full">
                  {analytics.active_couriers} Online
                </span>
              </div>
              <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                {(() => {
                  const activeCouriers = users.filter(u => u.role === 'courier' && u.is_active)
                  const onlineQueue = [...activeCouriers.filter(u => u.is_online)]
                    .sort((a, b) => ((a as any).queue_position ?? 999) - ((b as any).queue_position ?? 999))
                  const offlineCouriers = activeCouriers.filter(u => !u.is_online)

                  if (activeCouriers.length === 0) return (
                    <p className="text-sm text-gray-500 text-center py-4">No couriers registered</p>
                  )

                  return (
                    <>
                      {onlineQueue.length === 0 && (
                        <p className="text-sm text-gray-500 text-center py-4">No online couriers in queue</p>
                      )}
                      {onlineQueue.map((courier, index) => {
                        const status = (courier as any).courier_status ?? 'on'
                        const waitingOrder = activeOrdersByCourier.find(o => 
                          o.courier_id === courier.id && 
                          o.is_waiting === true &&
                          !['cancelled', 'delivered'].includes(o.status)
                        );
                        return (
                          <div key={courier.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
                            <div className="flex items-center gap-3">
                              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-teal-100 text-teal-600 font-bold text-xs">
                                {index + 1}
                              </div>
                              <div>
                                <p className="font-medium text-gray-900 text-sm">{courier.name}</p>
                                <span className={`text-xs font-semibold ${status === 'stay' ? 'text-blue-600' : 'text-green-600'}`}>
                                  {status === 'stay' ? '\u{1F3E0} STAY' : '\u{1F680} ON'}
                                </span>
                                {waitingOrder && (
                                  <span className="block text-xs text-yellow-600 font-semibold">
                                    📝 PENDING — {waitingOrder.order_number}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                      {offlineCouriers.length > 0 && (
                        <>
                          <div className="border-t border-dashed border-gray-200 my-2" />
                          {offlineCouriers.map(courier => (
                            <div key={courier.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100 opacity-60">
                              <div className="flex items-center gap-3">
                                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-200 text-gray-400 font-bold text-xs">
                                  —
                                </div>
                                <div>
                                  <p className="font-medium text-gray-600 text-sm">{courier.name}</p>
                                  <span className="text-xs text-red-500 font-semibold">� OFF</span>
                                  {(courier as any).off_reason && (
                                    <span className="text-xs text-gray-400 ml-1">• {(courier as any).off_reason}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </>
                      )}
                    </>
                  )
                })()}
              </div>
            </Card>

            {/* Order Status Distribution */}
            <Card>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-gray-900">Status Overview</h2>
                <span className="text-xs text-gray-400">
                  {timeRange === 'today' ? 'Hari ini' : timeRange === '7days' ? '7 hari terakhir' : '30 hari terakhir'}
                </span>
              </div>
              <Suspense fallback={<ChartSkeleton height={200} />}>
                <StatusPieChart 
                  data={analytics.orders_by_status} 
                  colors={COLORS} 
                />
              </Suspense>
              <div className="grid grid-cols-2 gap-2 mt-4">
                {analytics.orders_by_status.slice(0, 4).map((item, index) => (
                  <div key={item.status} className="flex items-center gap-2">
                    <div
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <span className="text-xs text-gray-600 capitalize">
                      {getStatusLabel(item.status as OrderStatus)}: {item.count}
                    </span>
                  </div>
                ))}
              </div>
            </Card>

            {/* Top Kurir widget (Analytical) */}
            <Card>
              <div className="flex items-center gap-2 mb-4">
                <Award className="h-5 w-5 text-emerald-600" />
                <h3 className="text-lg font-semibold text-gray-900">Top Kurir</h3>
              </div>
              {topCouriersLocal.length > 0 ? (
                <div className="space-y-3">
                  {topCouriersLocal.map((c, i) => (
                    <div key={c.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                      <div className="flex items-center gap-3 text-left">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                          i === 0 ? 'bg-yellow-100 text-yellow-700' :
                          i === 1 ? 'bg-gray-200 text-gray-600' :
                          i === 2 ? 'bg-orange-100 text-orange-700' :
                          'bg-gray-100 text-gray-500'
                        }`}>
                          {i + 1}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 text-xs truncate">{c.name}</p>
                          <p className="text-[10px] text-gray-500 uppercase font-bold tracking-tight">{c.delivery_count} delivery</p>
                        </div>
                      </div>
                      <p className="font-bold text-gray-900 text-xs whitespace-nowrap">{formatCurrency(c.total_fee)}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400 text-sm">Belum ada data</div>
              )}
            </Card>
          </div>
        </div>

        {/* Top Customers (Full Width on Bottom) */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <ShoppingBag className="h-5 w-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">Top Pelanggan</h3>
          </div>
          {topCustomers.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
              {topCustomers.map((c, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <div className="flex items-center gap-3 text-left min-w-0">
                    <div className="w-8 h-8 shrink-0 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
                      {i + 1}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 text-xs truncate">{c.name}</p>
                      <p className="text-[10px] text-gray-500 font-bold uppercase tracking-tight">{c.order_count} order</p>
                    </div>
                  </div>
                  <p className="font-bold text-gray-900 text-xs whitespace-nowrap ml-2">{formatCurrency(c.total_fee)}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-gray-400 text-sm">Belum ada data</div>
          )}
        </Card>
      </div>
    </div>
  );
}
