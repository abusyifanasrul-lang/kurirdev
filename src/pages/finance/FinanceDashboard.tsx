import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  DollarSign, AlertTriangle, CheckCircle, Package, TrendingUp,
  ArrowRight
} from 'lucide-react';
import { isWIBToday } from '@/utils/date';
import { Header } from '@/components/layout/Header';
import { Card, StatCard } from '@/components/ui/Card';
import { useAuth } from '@/context/AuthContext';
import { useOrderStore } from '@/stores/useOrderStore';
import { useUserStore } from '@/stores/useUserStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { calcAdminEarning } from '@/lib/calcEarning';
import { getOrdersForWeek, getAllUnpaidOrdersLocal } from '@/lib/orderCache';
import { useNavigate } from 'react-router-dom';
import type { Order } from '@/types';

export function FinanceDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { orders, activeOrdersByCourier } = useOrderStore();
  const { users } = useUserStore();
  const { commission_rate, commission_threshold } = useSettingsStore();
  const earningSettings = { commission_rate, commission_threshold };

  const couriers = users.filter(u => u.role === 'courier');
  const [weekOrders, setWeekOrders] = useState<Order[]>([]);
  const [allUnpaidOrders, setAllUnpaidOrders] = useState<Order[]>([]);
  const [isDataReady, setIsDataReady] = useState(false);

  const loadFinanceData = useCallback(async () => {
    try {
      const [dbWeekOrders, dbUnpaidOrders] = await Promise.all([
        getOrdersForWeek(),
        getAllUnpaidOrdersLocal()
      ]);
      setWeekOrders(dbWeekOrders);
      setAllUnpaidOrders(dbUnpaidOrders);
    } finally {
      setIsDataReady(true);
    }
  }, []);

  useEffect(() => {
    loadFinanceData();
    window.addEventListener('indexeddb-synced', loadFinanceData);
    return () => window.removeEventListener('indexeddb-synced', loadFinanceData);
  }, [loadFinanceData]);

  // All hooks MUST be called before any early return (Rules of Hooks)
  // Merge orders — safe to compute even when weekOrders is empty
  const allOrders = useMemo(() => {
    const map = new Map<string, Order>();
    weekOrders.forEach(o => map.set(o.id, o));
    allUnpaidOrders.forEach(o => map.set(o.id, o));
    orders.forEach(o => map.set(o.id, o));
    activeOrdersByCourier.forEach(o => map.set(o.id, o));
    return Array.from(map.values());
  }, [weekOrders, allUnpaidOrders, orders, activeOrdersByCourier]);

  // Delivered orders
  const deliveredOrders = useMemo(() =>
    allOrders.filter(o => o.status === 'delivered'),
    [allOrders]
  );

  // Today stats
  const todayStats = useMemo(() => {
    const todayDelivered = deliveredOrders.filter(o =>
      isWIBToday(o.created_at)
    );
    const totalFee = todayDelivered.reduce((sum, o) => sum + (o.total_fee || 0), 0);
    const adminEarning = todayDelivered.reduce((sum, o) =>
      sum + calcAdminEarning(o, earningSettings), 0
    );
    return {
      orderCount: todayDelivered.length,
      grossRevenue: totalFee,
      netRevenue: adminEarning,
      courierPayout: totalFee - adminEarning,
    };
  }, [deliveredOrders]);

  // Unpaid summary per courier
  const unpaidByCourier = useMemo(() => {
    const result: Array<{
      courierId: string;
      courierName: string;
      totalAmount: number;
      orderCount: number;
    }> = [];

    for (const courier of couriers) {
      const unpaidOrders = deliveredOrders.filter(
        o => o.courier_id === courier.id && o.payment_status === 'unpaid'
      );
      if (unpaidOrders.length > 0) {
        const totalAmount = unpaidOrders.reduce((sum, o) =>
          sum + calcAdminEarning(o, earningSettings), 0
        );
        result.push({
          courierId: courier.id,
          courierName: courier.name,
          totalAmount,
          orderCount: unpaidOrders.length,
        });
      }
    }

    return result.sort((a, b) => b.totalAmount - a.totalAmount);
  }, [deliveredOrders, couriers]);

  // Paid today
  const paidToday = useMemo(() => {
    return deliveredOrders.filter(o =>
      o.payment_status === 'paid' && isWIBToday(o.updated_at)
    );
  }, [deliveredOrders]);

  const totalUnpaid = unpaidByCourier.reduce((sum, c) => sum + c.totalAmount, 0);
  const totalUnpaidCount = unpaidByCourier.reduce((sum, c) => sum + c.orderCount, 0);

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val);

  // Early return AFTER all hooks — safe and correct
  if (!isDataReady) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mb-4" />
        <p className="text-gray-500 font-medium">Menyuapkan data keuangan...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header
        title="Dashboard Keuangan"
        subtitle={`Selamat datang, ${user?.name}`}
        onRefresh={loadFinanceData}
      />

      <div className="p-4 lg:p-8 space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
          <StatCard
            title="Tagihan Belum Lunas"
            value={formatCurrency(totalUnpaid)}
            icon={<AlertTriangle className="h-5 w-5" />}
            subtitle={`${totalUnpaidCount} order dari ${unpaidByCourier.length} kurir`}
            to="/admin/finance/penagihan"
          />
          <StatCard
            title="Setoran Hari Ini"
            value={formatCurrency(paidToday.reduce((s, o) => s + calcAdminEarning(o, earningSettings), 0))}
            icon={<CheckCircle className="h-5 w-5" />}
            subtitle={`${paidToday.length} order lunas`}
          />
          <StatCard
            title="Revenue Hari Ini"
            value={formatCurrency(todayStats.grossRevenue)}
            icon={<DollarSign className="h-5 w-5" />}
            subtitle={`${todayStats.orderCount} order delivered`}
          />
          <StatCard
            title="Net Revenue"
            value={formatCurrency(todayStats.netRevenue)}
            icon={<TrendingUp className="h-5 w-5" />}
            subtitle="Pendapatan bersih hari ini"
          />
        </div>

        {/* Unpaid by Courier */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Tagihan per Kurir
            </h3>
            <button
              onClick={() => navigate('/admin/finance/penagihan')}
              className="text-sm text-teal-600 hover:text-teal-700 font-medium flex items-center gap-1"
            >
              Lihat Semua <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          {unpaidByCourier.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle className="h-12 w-12 text-green-400 mx-auto mb-3" />
              <p className="text-gray-600 font-medium">Semua tagihan sudah lunas</p>
              <p className="text-sm text-gray-400 mt-1">Tidak ada kurir yang memiliki tagihan tertunda</p>
            </div>
          ) : (
            <div className="space-y-3">
              {unpaidByCourier.slice(0, 5).map((item) => (
                <div
                  key={item.courierId}
                  className="flex items-center justify-between p-4 bg-amber-50 border border-amber-200 rounded-xl"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
                      <span className="font-bold text-amber-700">{item.courierName.charAt(0)}</span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{item.courierName}</p>
                      <p className="text-xs text-gray-500">{item.orderCount} order belum disetor</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-amber-700">{formatCurrency(item.totalAmount)}</p>
                    <button
                      onClick={() => navigate('/admin/finance/penagihan')}
                      className="text-xs text-teal-600 hover:underline mt-1"
                    >
                      Tagih
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            onClick={() => navigate('/admin/finance/penagihan')}
            className="flex items-center gap-3 p-4 bg-white border border-gray-200 rounded-xl hover:border-teal-300 hover:shadow-sm transition-all"
          >
            <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center">
              <DollarSign className="h-5 w-5 text-teal-600" />
            </div>
            <div className="text-left">
              <p className="font-medium text-gray-900">Penagihan</p>
              <p className="text-xs text-gray-500">Kelola setoran kurir</p>
            </div>
          </button>
          <button
            onClick={() => navigate('/admin/finance/analisa')}
            className="flex items-center gap-3 p-4 bg-white border border-gray-200 rounded-xl hover:border-emerald-300 hover:shadow-sm transition-all"
          >
            <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-emerald-600" />
            </div>
            <div className="text-left">
              <p className="font-medium text-gray-900">Analisa</p>
              <p className="text-xs text-gray-500">Laporan keuangan</p>
            </div>
          </button>
          <button
            onClick={() => navigate('/admin/reports')}
            className="flex items-center gap-3 p-4 bg-white border border-gray-200 rounded-xl hover:border-teal-300 hover:shadow-sm transition-all"
          >
            <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center">
              <Package className="h-5 w-5 text-teal-600" />
            </div>
            <div className="text-left">
              <p className="font-medium text-gray-900">Laporan</p>
              <p className="text-xs text-gray-500">Export laporan detail</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
