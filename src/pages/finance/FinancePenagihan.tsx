import { useState, useMemo, useEffect, useCallback } from 'react';
import { 
  Search, CheckCircle, AlertTriangle, Clock, 
  ChevronDown, ChevronUp 
} from 'lucide-react';
import { formatLocal, getLocalNow, differenceInDaysLocal } from '@/utils/date';
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
import { useAttendanceStore } from '@/stores/useAttendanceStore';
import { useAuth } from '@/context/AuthContext';
import { useOrderStore } from '@/stores/useOrderStore';
import { useUserStore } from '@/stores/useUserStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { getOrdersForWeek, getAllUnpaidOrdersLocal } from '@/lib/orderCache';
import { calcAdminEarning, calcCourierEarning } from '@/lib/calcEarning';
import { formatCurrency } from '@/utils/formatter';
import { cn } from '@/utils/cn';
import type { Order } from '@/types';

interface AttendanceLog {
  id: string;
  courier_id: string;
  date: string;
  first_online_at: string | null;
  last_online_at: string | null;
  status: 'on_time' | 'late' | 'late_minor' | 'late_major' | 'alpha' | 'sick' | 'off';
  late_minutes: number;
  flat_fine: number;
  payment_status: 'unpaid' | 'paid';
  shift_name?: string;
  shift_start?: string;
  shift_end?: string;
}

type FilterType = 'unpaid' | 'paid' | 'all';

export function FinancePenagihan() {
  const { user } = useAuth();
  const { orders, settleOrder } = useOrderStore();
  const { users } = useUserStore();
  const { unpaidAttendance, fetchUnpaidAttendance, settleAttendance } = useAttendanceStore();
  const { commission_rate, commission_threshold, commission_type } = useSettingsStore();
  const earningSettings = { commission_rate, commission_threshold, commission_type };

  const couriers = users.filter(u => u.role === 'courier');
  const [localOrders, setLocalOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState<FilterType>('unpaid');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCourier, setExpandedCourier] = useState<string | null>(null);
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());

  // Confirm modal state
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmCourier, setConfirmCourier] = useState<{ id: string; name: string; orders: Order[]; fines: AttendanceLog[] } | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [confirmSuccess, setConfirmSuccess] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const getUserName = (id?: string | null) => {
    if (!id) return 'Unknown';
    const u = users.find(x => x.id === id);
    return u ? u.name : 'Staf Terhapus';
  };

  const getAdminEarning = (order: Order) => {
    // Prioritaskan snapshot yang tersimpan di database saat order selesai
    let baseEarning = 0;
    if (order.applied_admin_fee !== undefined && order.applied_admin_fee !== null) {
      baseEarning = order.applied_admin_fee;
    } else {
      // Fallback ke kalkulasi live hanya jika snapshot tidak ada
      // (untuk order lama sebelum kolom applied_admin_fee ada)
      baseEarning = calcAdminEarning(order, earningSettings);
    }

    // Setoran Admin = Admin Fee + Denda (jika ada)
    // Denda per order (fine_deducted) adalah uang yang seharusnya milik kurir
    // tapi dipotong ke admin karena keterlambatan.
    return baseEarning + (order.fine_deducted || 0);
  };

  const loadLocalOrders = useCallback(async () => {
    const [recentOrders, unpaidOrders] = await Promise.all([
      getOrdersForWeek(),
      getAllUnpaidOrdersLocal()
    ]);
    const map = new Map<string, Order>();
    recentOrders.forEach(o => map.set(o.id, o));
    unpaidOrders.forEach(o => map.set(o.id, o));
    setLocalOrders(Array.from(map.values()));
    fetchUnpaidAttendance();
  }, [fetchUnpaidAttendance]);

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

  // 1. Raw grouping of ALL couriers (Global state for dashboard cards)
  const rawCourierSummary = useMemo(() => {
    const result: Array<{
      courierId: string;
      courierName: string;
      courierVehicle?: any;
      totalEarning: number;
      totalFines: number;
      unpaidOrders: Order[];
      paidOrders: Order[];
      unpaidFines: AttendanceLog[];
      lastSettlement: string | null;
    }> = [];

    for (const courier of couriers) {
      const courierOrders = deliveredOrders.filter(o => o.courier_id === courier.id);
      const courierFines = unpaidAttendance.filter(a => a.courier_id === courier.id);
      
      if (courierOrders.length === 0 && courierFines.length === 0) continue; 

      const unpaid = courierOrders.filter(o => o.payment_status === 'unpaid');
      const paid = courierOrders.filter(o => o.payment_status === 'paid');

      const totalEarning = unpaid.reduce((sum, o) =>
        sum + getAdminEarning(o), 0
      );
      
      const totalFines = courierFines.reduce((sum, f) => sum + f.flat_fine, 0);

      result.push({
        courierId: courier.id,
        courierName: courier.name,
        courierVehicle: courier.vehicle_type,
        totalEarning,
        totalFines,
        unpaidOrders: unpaid.sort((a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        ),
        paidOrders: paid.sort((a, b) =>
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        ).slice(0, 5),
        unpaidFines: courierFines,
        lastSettlement: paid.length > 0 ? paid[0].updated_at : null,
      });
    }

    // Add Orphaned Orders (Courier missing or deleted)
    const activeIds = couriers.map(c => c.id);
    const orphans = deliveredOrders.filter(o => o.courier_id && !activeIds.includes(o.courier_id));
    
    if (orphans.length > 0) {
      const unpaid = orphans.filter(o => o.payment_status === 'unpaid');
      const paid = orphans.filter(o => o.payment_status === 'paid');
      
      // Only include orphans if there's actually something to show
      if (unpaid.length > 0 || paid.length > 0) {
        const totalEarning = unpaid.reduce((sum, o) =>
          sum + getAdminEarning(o), 0
        );

        result.push({
          courierId: 'unknown_legacy',
          courierName: '📦 Kurir Terhapus / Unknown',
          totalEarning,
          totalFines: 0,
          unpaidOrders: unpaid.sort((a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          ),
          paidOrders: paid.sort((a, b) =>
            new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
          ).slice(0, 5),
          unpaidFines: [],
          lastSettlement: null
        });
      }
    }

    return result.sort((a, b) => b.totalEarning - a.totalEarning);
  }, [deliveredOrders, couriers, earningSettings]);

  // 2. Filtered summary for table display
  const courierSummary = useMemo(() => {
    return rawCourierSummary.filter(c => {
      // Filter based on search (Already includes 'Unknown' or 'Terhapus' in the name)
      if (searchQuery && !c.courierName.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }

      // Filter based on payment status
      if (filter === 'unpaid' && c.unpaidOrders.length === 0 && c.unpaidFines.length === 0) return false;
      if (filter === 'paid' && (c.paidOrders.length === 0 || c.unpaidOrders.length > 0 || c.unpaidFines.length > 0)) return false;

      return true;
    });
  }, [rawCourierSummary, filter, searchQuery]);

  // Global stats for dashboard cards and header
  const totalUnpaid = rawCourierSummary.reduce((sum, c) => sum + c.totalEarning + c.totalFines, 0);
  const totalUnpaidOrders = rawCourierSummary.reduce((sum, c) => sum + c.unpaidOrders.length, 0);

   const handleConfirmSettlement = (courierId: string, courierName: string, orders: Order[], fines: AttendanceLog[]) => {
    setConfirmCourier({ id: courierId, name: courierName, orders, fines });
    setShowConfirmModal(true);
    setConfirmSuccess(false);
    setConfirmError(null);
  };

   const processSettlement = async () => {
    if (!confirmCourier) return;
    setConfirmLoading(true);
    setConfirmError(null);

    try {
      if (!user) throw new Error('Anda harus login untuk melakukan konfirmasi setoran');

      for (const order of confirmCourier.orders) {
        await settleOrder(order.id, user.id, user.name);
      }
      for (const fine of confirmCourier.fines) {
        await settleAttendance(fine.id, user.id);
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


  const getAgingBadge = (dateStr: string) => {
    const days = differenceInDaysLocal(getLocalNow(), dateStr);
    if (days <= 3) return { label: `${days} hari`, className: 'bg-green-100 text-green-700' };
    if (days < 7) return { label: `${days} hari`, className: 'bg-amber-100 text-amber-700' };
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
            <p className="text-xs text-amber-600 mt-1">Total piutang {totalUnpaidOrders} order</p>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-5 w-5 text-red-600" />
              <span className="text-sm font-medium text-red-800">Tunggakan &gt;= 7 Hari</span>
            </div>
            <p className="text-xl font-bold text-red-900">
              {rawCourierSummary.filter(c =>
                c.unpaidOrders.some(o => differenceInDaysLocal(getLocalNow(), o.created_at) >= 7)
              ).length} kurir
            </p>
            <p className="text-xs text-red-600 mt-1">Ada setoran yang sudah lewat seminggu</p>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 col-span-2 lg:col-span-1">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <span className="text-sm font-medium text-green-800">Setoran Selesai</span>
            </div>
            <p className="text-xl font-bold text-green-900">
              {(() => {
                const activeWithUnpaid = rawCourierSummary.filter(c => 
                  c.courierId !== 'unknown_legacy' && c.unpaidOrders.length > 0
                ).length;
                return `${couriers.length - activeWithUnpaid}/${couriers.length}`;
              })()}
            </p>
            <p className="text-xs text-green-600 mt-1">Kurir AKTIF yang sudah melunasi semua tagihan</p>
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
                            {formatCurrency(
                              (courier.unpaidOrders.some(o => selectedOrders.has(o.id)) 
                                  ? courier.unpaidOrders.filter(o => selectedOrders.has(o.id)).reduce((sum, o) => sum + getAdminEarning(o), 0)
                                  : courier.totalEarning) + courier.totalFines
                            )}
                          </p>
                          {(() => {
                            const relevantOrders = courier.unpaidOrders.some(o => selectedOrders.has(o.id))
                              ? courier.unpaidOrders.filter(o => selectedOrders.has(o.id))
                              : courier.unpaidOrders;
                            const totalFine = relevantOrders.reduce((sum, o) => sum + ((o as any).fine_deducted || 0), 0) + courier.totalFines;
                            return totalFine > 0 ? (
                              <p className="text-[10px] text-red-600 font-medium">
                                Total Denda: {formatCurrency(totalFine)}
                              </p>
                            ) : null;
                          })()}
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
                              courierSelected.length > 0 ? courierSelected : courier.unpaidOrders,
                              courier.unpaidFines
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
                                  <TableHeader className="text-red-600">Denda</TableHeader>
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
                                      <TableCell>{formatLocal(order.created_at, 'dd MMM yyyy')}</TableCell>
                                      <TableCell>{formatCurrency(order.total_fee)}</TableCell>
                                      <TableCell className="font-medium text-amber-700">
                                        {formatCurrency(getAdminEarning(order))}
                                      </TableCell>
                                      <TableCell className="font-medium text-red-600">
                                        {(order as any).fine_deducted > 0 
                                          ? `-${formatCurrency((order as any).fine_deducted)}` 
                                          : <span className="text-gray-300">-</span>
                                        }
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

                          {courier.unpaidFines.length > 0 && (
                            <div className="mt-4">
                              <h4 className="text-sm font-semibold text-gray-700 mb-3">Denda Kehadiran</h4>
                              <div className="space-y-2">
                                {courier.unpaidFines.map((fine) => (
                                  <div key={fine.id} className="flex items-center justify-between p-3 bg-red-50 border border-red-100 rounded-lg">
                                    <div>
                                      <p className="text-sm font-medium text-gray-900">
                                        {fine.status === 'alpha' ? 'Denda Alpha (Tidak Masuk)' : 
                                         fine.status === 'late_major' ? 'Denda Terlambat Parah (>60m)' : 
                                         'Denda Terlambat (Flat)'} ({fine.shift_name || 'Shift'})
                                      </p>
                                      <p className="text-xs text-gray-500">
                                        {formatLocal(fine.date, 'dd MMM yyyy')} • {fine.status === 'alpha' ? 'Absen' : `${fine.late_minutes} menit terlambat`}
                                      </p>
                                    </div>
                                    <p className="text-sm font-bold text-red-600">
                                      {formatCurrency(fine.flat_fine)}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
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
                                  <div className="flex flex-col gap-0.5 mt-0.5">
                                    <p className="text-[10px] text-gray-500">
                                      {formatLocal(order.updated_at, 'dd MMM yyyy, HH:mm')}
                                    </p>
                                    {order.payment_confirmed_by && (
                                      <p className="text-[10px] text-green-600 font-medium italic">
                                        Verified by: {order.payment_confirmed_by_name || getUserName(order.payment_confirmed_by)}
                                      </p>
                                    )}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="text-sm font-medium text-green-700">
                                    {formatCurrency(getAdminEarning(order))}
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
                  {formatCurrency(
                    confirmCourier.orders.reduce((sum, o) => sum + getAdminEarning(o), 0) +
                    confirmCourier.fines.reduce((sum, f) => sum + f.flat_fine, 0)
                  )}
                </p>
                <p className="text-sm text-amber-600">
                  {confirmCourier.orders.length} order + {confirmCourier.fines.length} denda
                </p>
              </div>

              <div className="max-h-40 overflow-y-auto">
                {confirmCourier.orders.map((order) => (
                  <div key={order.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{order.order_number}</p>
                      <p className="text-xs text-gray-500">{formatLocal(order.created_at, 'dd MMM')}</p>
                    </div>
                    <p className="text-sm font-medium text-amber-700">
                      {formatCurrency(getAdminEarning(order))}
                    </p>
                  </div>
                ))}
                
                {confirmCourier.fines.map((fine) => (
                  <div key={fine.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-red-600">
                        {fine.status === 'alpha' ? 'Denda Alpha' : 'Denda Terlambat'} ({fine.shift_name})
                      </p>
                      <p className="text-xs text-gray-500">{formatLocal(fine.date, 'dd MMM')}</p>
                    </div>
                    <p className="text-sm font-medium text-red-600">
                      {formatCurrency(fine.flat_fine)}
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
