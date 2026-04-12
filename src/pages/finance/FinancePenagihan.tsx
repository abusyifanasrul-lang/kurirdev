import { useState, useMemo, useEffect, useCallback } from 'react';
import { 
  Search, CheckCircle, AlertTriangle, Clock, 
  ChevronDown, ChevronUp 
} from 'lucide-react';
import { formatWIB, getWIBNow, differenceInDaysWIB } from '@/utils/date';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { CourierBadge } from '@/components/couriers/CourierBadge';
import {
  Table, TableHead, TableBody, TableRow, TableHeader, TableCell
} from '@/components/ui/Table';
import { Input } from '@/components/ui/Input';
import { useOrderStore } from '@/stores/useOrderStore';
import { useUserStore } from '@/stores/useUserStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { calcAdminEarning } from '@/lib/calcEarning';
import { getOrdersForWeek, getAllUnpaidOrdersLocal, markAsPaidInLocalDB } from '@/lib/orderCache';
import { cn } from '@/utils/cn';
import type { Order } from '@/types';

type FilterType = 'unpaid' | 'paid' | 'all';

export function FinancePenagihan() {
  const { orders, updateOrder } = useOrderStore();
  const { users } = useUserStore();
  const { commission_rate, commission_threshold } = useSettingsStore();
  const earningSettings = { commission_rate, commission_threshold };

  const couriers = users.filter(u => u.role === 'courier');
  const [localOrders, setLocalOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState<FilterType>('unpaid');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCourier, setExpandedCourier] = useState<string | null>(null);
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());

  // Confirm modal state
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmCourier, setConfirmCourier] = useState<{ id: string; name: string; orders: Order[] } | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [confirmSuccess, setConfirmSuccess] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const loadLocalOrders = useCallback(async () => {
    const [recentOrders, unpaidOrders] = await Promise.all([
      getOrdersForWeek(),
      getAllUnpaidOrdersLocal()
    ]);
    const map = new Map<string, Order>();
    recentOrders.forEach(o => map.set(o.id, o));
    unpaidOrders.forEach(o => map.set(o.id, o));
    setLocalOrders(Array.from(map.values()));
  }, []);

  useEffect(() => {
    loadLocalOrders();
    window.addEventListener('indexeddb-synced', loadLocalOrders);
    return () => window.removeEventListener('indexeddb-synced', loadLocalOrders);
  }, [loadLocalOrders]);

  const allOrders = useMemo(() => {
    const map = new Map<string, Order>();
    localOrders.forEach(o => map.set(o.id, o));
    orders.forEach(o => map.set(o.id, o));
    return Array.from(map.values());
  }, [localOrders, orders]);

  const deliveredOrders = useMemo(() =>
    allOrders.filter(o => o.status === 'delivered'),
    [allOrders]
  );

  // Group by courier
  const courierSummary = useMemo(() => {
    const result: Array<{
      courierId: string;
      courierName: string;
      courierVehicle?: any;
      totalEarning: number;
      unpaidOrders: Order[];
      paidOrders: Order[];
      lastSettlement: string | null;
    }> = [];

    for (const courier of couriers) {
      const courierDelivered = deliveredOrders.filter(o => o.courier_id === courier.id);
      const unpaid = courierDelivered.filter(o => o.payment_status === 'unpaid');
      const paid = courierDelivered.filter(o => o.payment_status === 'paid');

      const totalEarning = unpaid.reduce((sum, o) =>
        sum + calcAdminEarning(o, earningSettings), 0
      );

      // Filter based on search
      if (searchQuery && !courier.name.toLowerCase().includes(searchQuery.toLowerCase())) {
        continue;
      }

      // Filter based on payment status
      if (filter === 'unpaid' && unpaid.length === 0) continue;
      if (filter === 'paid' && (paid.length === 0 || unpaid.length > 0)) continue;

      result.push({
        courierId: courier.id,
        courierName: courier.name,
        courierVehicle: courier.vehicle_type,
        totalEarning,
        unpaidOrders: unpaid.sort((a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        ),
        paidOrders: paid.sort((a, b) =>
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        ).slice(0, 5),
        lastSettlement: paid.length > 0 ? paid[0].updated_at : null,
      });
    }

    // Add Orphaned Orders (Courier missing)
    const activeIds = couriers.map(c => c.id);
    const orphans = deliveredOrders.filter(o => o.courier_id && !activeIds.includes(o.courier_id));
    
    if (orphans.length > 0) {
      const unpaid = orphans.filter(o => o.payment_status === 'unpaid');
      const paid = orphans.filter(o => o.payment_status === 'paid');
      
      const totalEarning = unpaid.reduce((sum, o) =>
        sum + calcAdminEarning(o, earningSettings), 0
      );

      // Only show orphans if they match the filter or search (search matches 'Terhapus')
      const matchesSearch = !searchQuery || 'terhapus'.includes(searchQuery.toLowerCase()) || 'unknown'.includes(searchQuery.toLowerCase());
      const matchesFilter = filter === 'all' || (filter === 'unpaid' && unpaid.length > 0) || (filter === 'paid' && unpaid.length === 0);

      if (matchesSearch && matchesFilter) {
        result.push({
          courierId: 'unknown_legacy',
          courierName: '📦 Kurir Terhapus / Unknown',
          totalEarning,
          unpaidOrders: unpaid.sort((a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          ),
          paidOrders: paid.sort((a, b) =>
            new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
          ).slice(0, 5),
          lastSettlement: null
        });
      }
    }

    return result.sort((a, b) => b.totalEarning - a.totalEarning);
  }, [deliveredOrders, couriers, filter, searchQuery, earningSettings]);

  const totalUnpaid = courierSummary.reduce((sum, c) => sum + c.totalEarning, 0);
  const totalUnpaidOrders = courierSummary.reduce((sum, c) => sum + c.unpaidOrders.length, 0);

   const handleConfirmSettlement = (courierId: string, courierName: string, orders: Order[]) => {
    setConfirmCourier({ id: courierId, name: courierName, orders });
    setShowConfirmModal(true);
    setConfirmSuccess(false);
    setConfirmError(null);
  };

   const processSettlement = async () => {
    if (!confirmCourier) return;
    setConfirmLoading(true);
    setConfirmError(null);

    try {
      for (const order of confirmCourier.orders) {
        await updateOrder(order.id, { payment_status: 'paid' });
        await markAsPaidInLocalDB(order.id);
      }
      setSelectedOrders(prev => {
        const next = new Set(prev);
        confirmCourier.orders.forEach(o => next.delete(o.id));
        return next;
      });
      setConfirmSuccess(true);
      setTimeout(() => {
        setShowConfirmModal(false);
        setConfirmCourier(null);
        loadLocalOrders();
      }, 1500);
    } catch (err) {
      console.error('Settlement error:', err);
      setConfirmError(err instanceof Error ? err.message : 'Gagal memproses setoran. Silakan coba lagi.');
    } finally {
      setConfirmLoading(false);
    }
  };

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val);

  const getAgingBadge = (dateStr: string) => {
    const days = differenceInDaysWIB(getWIBNow(), dateStr);
    if (days <= 3) return { label: `${days} hari`, className: 'bg-green-100 text-green-700' };
    if (days <= 7) return { label: `${days} hari`, className: 'bg-amber-100 text-amber-700' };
    return { label: `${days} hari`, className: 'bg-red-100 text-red-700' };
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header
        title="Penagihan Setoran"
        subtitle={`${totalUnpaidOrders} order belum disetor`}
      />

      <div className="p-4 lg:p-8 space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              <span className="text-sm font-medium text-amber-800">Total Belum Setor</span>
            </div>
            <p className="text-xl font-bold text-amber-900">{formatCurrency(totalUnpaid)}</p>
            <p className="text-xs text-amber-600 mt-1">Total piutang {totalUnpaidOrders} order dari {courierSummary.length} kurir</p>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-5 w-5 text-red-600" />
              <span className="text-sm font-medium text-red-800">Tunggakan > 7 Hari</span>
            </div>
            <p className="text-xl font-bold text-red-900">
              {courierSummary.filter(c =>
                c.unpaidOrders.some(o => differenceInDaysWIB(getWIBNow(), o.created_at) > 7)
              ).length} kurir
            </p>
            <p className="text-xs text-red-600 mt-1">Ada pengantaran yang sudah lewat seminggu</p>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 col-span-2 lg:col-span-1">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <span className="text-sm font-medium text-green-800">Setoran Selesai</span>
            </div>
            <p className="text-xl font-bold text-green-900">
              {couriers.length - courierSummary.filter(c => c.unpaidOrders.length > 0).length}/{couriers.length}
            </p>
            <p className="text-xs text-green-600 mt-1">Kurir yang sudah melunasi semua tagihan</p>
          </div>
        </div>

        {/* Filter & Search */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex bg-white rounded-lg border border-gray-200 p-1">
            {([
              { key: 'unpaid', label: 'Belum Lunas' },
              { key: 'paid', label: 'Sudah Lunas' },
              { key: 'all', label: 'Semua' },
            ] as const).map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={cn(
                  "flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors",
                  filter === f.key
                    ? 'bg-amber-600 text-white'
                    : 'text-gray-600 hover:bg-gray-50'
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nama kurir..."
            leftIcon={<Search className="h-4 w-4" />}
            className="flex-1 focus:border-amber-500 focus:ring-amber-500 rounded-lg"
          />
        </div>

        {/* Courier Cards */}
        <div className="space-y-4">
          {courierSummary.length === 0 ? (
            <Card>
              <div className="text-center py-8">
                <CheckCircle className="h-12 w-12 text-green-400 mx-auto mb-3" />
                <p className="text-gray-600 font-medium">
                  {filter === 'unpaid' ? 'Semua tagihan sudah lunas' : 'Tidak ada data'}
                </p>
              </div>
            </Card>
          ) : (
            courierSummary.map((courier) => {
              const isExpanded = expandedCourier === courier.courierId;
              const hasUnpaid = courier.unpaidOrders.length > 0;

              return (
                <Card key={courier.courierId} className={cn(
                  "transition-all",
                  hasUnpaid && "border-l-4 border-l-amber-400"
                )}>
                  {/* Courier Header */}
                  <div
                    className="flex items-center justify-between cursor-pointer"
                    onClick={() => setExpandedCourier(isExpanded ? null : courier.courierId)}
                  >
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        "w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg",
                        hasUnpaid ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
                      )}>
                        {courier.courierName.charAt(0)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-gray-900">{courier.courierName}</p>
                          {courier.courierId !== 'unknown_legacy' && (
                            <CourierBadge type={courier.courierVehicle} showLabel={false} />
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          {hasUnpaid ? (
                            <Badge className="bg-amber-100 text-amber-700">
                              {courier.unpaidOrders.length} order belum disetor
                            </Badge>
                          ) : (
                            <Badge className="bg-green-100 text-green-700">
                              Lunas
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {hasUnpaid && (
                        <div className="text-right">
                          <p className="text-lg font-bold text-amber-700">
                            {formatCurrency(courier.unpaidOrders.some(o => selectedOrders.has(o.id)) 
                              ? courier.unpaidOrders.filter(o => selectedOrders.has(o.id)).reduce((sum, o) => sum + calcAdminEarning(o, earningSettings), 0)
                              : courier.totalEarning)}
                          </p>
                        </div>
                      )}
                      {hasUnpaid && (
                        <Button
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            const courierSelected = courier.unpaidOrders.filter(o => selectedOrders.has(o.id));
                            handleConfirmSettlement(
                              courier.courierId, 
                              courier.courierName, 
                              courierSelected.length > 0 ? courierSelected : courier.unpaidOrders
                            );
                          }}
                          className="bg-amber-600 hover:bg-amber-700"
                        >
                          {courier.unpaidOrders.some(o => selectedOrders.has(o.id)) 
                            ? `Konfirmasi (${courier.unpaidOrders.filter(o => selectedOrders.has(o.id)).length})` 
                            : 'Konfirmasi Semua'}
                        </Button>
                      )}
                      {isExpanded ? (
                        <ChevronUp className="h-5 w-5 text-gray-400" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-gray-400" />
                      )}
                    </div>
                  </div>

                  {/* Expanded Detail */}
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      {hasUnpaid && (
                        <>
                          <div className="flex justify-between items-center mb-3">
                            <h4 className="text-sm font-semibold text-gray-700">Order Belum Disetor</h4>
                            <span className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-md">Pilih checkbox untuk setor sebagian</span>
                          </div>
                          <div className="overflow-x-auto">
                            <Table>
                              <TableHead>
                                <TableRow>
                                  <TableHeader className="w-10">
                                    <input 
                                      type="checkbox" 
                                      className="rounded border-gray-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                                      checked={courier.unpaidOrders.length > 0 && courier.unpaidOrders.every(o => selectedOrders.has(o.id))}
                                      onChange={(e) => {
                                        const newSet = new Set(selectedOrders);
                                        if (e.target.checked) courier.unpaidOrders.forEach(o => newSet.add(o.id));
                                        else courier.unpaidOrders.forEach(o => newSet.delete(o.id));
                                        setSelectedOrders(newSet);
                                      }}
                                    />
                                  </TableHeader>
                                  <TableHeader>Order</TableHeader>
                                  <TableHeader>Tanggal</TableHeader>
                                  <TableHeader>Fee</TableHeader>
                                  <TableHeader>Setoran</TableHeader>
                                  <TableHeader>Umur</TableHeader>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {courier.unpaidOrders.map((order) => {
                                  const aging = getAgingBadge(order.created_at);
                                  return (
                                    <TableRow key={order.id}>
                                      <TableCell>
                                        <input 
                                          type="checkbox" 
                                          className="rounded border-gray-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                                          checked={selectedOrders.has(order.id)}
                                          onChange={(e) => {
                                            const newSet = new Set(selectedOrders);
                                            if (e.target.checked) newSet.add(order.id);
                                            else newSet.delete(order.id);
                                            setSelectedOrders(newSet);
                                          }}
                                        />
                                      </TableCell>
                                      <TableCell className="font-medium">{order.order_number}</TableCell>
                                      <TableCell>{formatWIB(order.created_at, 'dd MMM yyyy')}</TableCell>
                                      <TableCell>{formatCurrency(order.total_fee)}</TableCell>
                                      <TableCell className="font-medium text-amber-700">
                                        {formatCurrency(calcAdminEarning(order, earningSettings))}
                                      </TableCell>
                                      <TableCell>
                                        <Badge className={aging.className}>{aging.label}</Badge>
                                      </TableCell>
                                    </TableRow>
                                  );
                                })}
                              </TableBody>
                            </Table>
                          </div>
                        </>
                      )}

                      {courier.paidOrders.length > 0 && (
                        <>
                          <h4 className="text-sm font-semibold text-gray-700 mt-4 mb-3">Riwayat Setoran Terakhir</h4>
                          <div className="space-y-2">
                            {courier.paidOrders.map((order) => (
                              <div key={order.id} className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                                <div>
                                  <p className="text-sm font-medium text-gray-900">{order.order_number}</p>
                                  <p className="text-xs text-gray-500">
                                    {formatWIB(order.updated_at, 'dd MMM yyyy, HH:mm')}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="text-sm font-medium text-green-700">
                                    {formatCurrency(calcAdminEarning(order, earningSettings))}
                                  </p>
                                  <CheckCircle className="h-4 w-4 text-green-500 ml-auto" />
                                </div>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </Card>
              );
            })
          )}
        </div>
      </div>

      {/* Confirm Settlement Modal */}
      {showConfirmModal && confirmCourier && (
        <Modal
          isOpen={showConfirmModal}
          onClose={() => setShowConfirmModal(false)}
          title="Konfirmasi Setoran"
        >
          {confirmSuccess ? (
            <div className="text-center py-6">
              <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <p className="text-lg font-semibold text-gray-900">Setoran Dikonfirmasi!</p>
              <p className="text-sm text-gray-500 mt-1">
                {confirmCourier.orders.length} order telah ditandai lunas.
              </p>
            </div>
          ) : (
             <div className="space-y-4">
              {confirmError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-sm">
                  <AlertTriangle className="h-4 w-4" />
                  <p>{confirmError}</p>
                </div>
              )}

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <p className="font-medium text-amber-900">{confirmCourier.name}</p>
                <p className="text-2xl font-bold text-amber-700 mt-1">
                  {formatCurrency(confirmCourier.orders.reduce((sum, o) =>
                    sum + calcAdminEarning(o, earningSettings), 0
                  ))}
                </p>
                <p className="text-sm text-amber-600">{confirmCourier.orders.length} order</p>
              </div>

              <div className="max-h-40 overflow-y-auto">
                {confirmCourier.orders.map((order) => (
                  <div key={order.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                    <div>
                      <p className="text-sm font-medium">{order.order_number}</p>
                      <p className="text-xs text-gray-500">{formatWIB(order.created_at, 'dd MMM')}</p>
                    </div>
                    <p className="text-sm font-medium text-amber-700">
                      {formatCurrency(calcAdminEarning(order, earningSettings))}
                    </p>
                  </div>
                ))}
              </div>

              <div className="flex gap-3">
                <Button
                  variant="secondary"
                  className="flex-1"
                  onClick={() => setShowConfirmModal(false)}
                  disabled={confirmLoading}
                >
                  Batal
                </Button>
                <Button
                  className="flex-1 bg-amber-600 hover:bg-amber-700"
                  onClick={processSettlement}
                  disabled={confirmLoading}
                >
                  {confirmLoading ? 'Memproses...' : 'Konfirmasi Setoran'}
                </Button>
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
