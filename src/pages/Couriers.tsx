import { useState, useMemo, useEffect, lazy, Suspense } from 'react';
import { Plus, Eye, EyeOff, ToggleLeft, ToggleRight, TrendingUp, Package, DollarSign, Phone, Mail, Award, Hash, Search, QrCode, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { Header } from '@/components/layout/Header';
import { Card, StatCard } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { Badge, getStatusBadgeVariant, getStatusLabel } from '@/components/ui/Badge';
import { CourierBadge } from '@/components/couriers/CourierBadge';
// import { StayQRDisplay } from '@/components/admin/StayQRDisplay';
const StayQRDisplay = lazy(() => import('@/components/admin/StayQRDisplay').then(m => ({ default: m.StayQRDisplay })));
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeader,
  TableCell,
  TableEmpty,
} from '@/components/ui/Table';

// Stores
import { useCourierStore } from '@/stores/useCourierStore';
import { useOrderStore } from '@/stores/useOrderStore';
import { useUserStore } from '@/stores/useUserStore';
import { useAuth } from '@/context/AuthContext';
import { Courier, Order } from '@/types';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { calcCourierEarning, calcAdminEarning } from '@/lib/calcEarning';
import { getUnpaidOrdersByCourier, getOrdersForWeek } from '@/lib/orderCache';

export function Couriers() {
  const { addCourier, updateCourier } = useCourierStore();
  const { users } = useUserStore();
  const couriers = users.filter(u => u.role === 'courier') as Courier[];
  const { orders, activeOrdersByCourier, getOrdersByCourier, settleOrder, fetchInitialOrders } = useOrderStore();
  const { commission_rate, commission_threshold, commission_type } = useSettingsStore();
  const earningSettings = { commission_rate, commission_threshold, commission_type };
  const { user } = useAuth();
  const isFinance = user?.role === 'finance' || user?.role === 'owner';

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isPerformanceModalOpen, setIsPerformanceModalOpen] = useState(false);
  const [showSettleConfirm, setShowSettleConfirm] = useState(false);
  const [showCourierPassword, setShowCourierPassword] = useState(false);
  const [selectedCourier, setSelectedCourier] = useState<Courier | null>(null);
  const [courierUnpaidOrders, setCourierUnpaidOrders] = useState<Order[]>([]);
  const [allUnpaidCounts, setAllUnpaidCounts] = useState<Record<string, number>>({})
  const [weekOrders, setWeekOrders] = useState<Order[]>([])
  const [searchQuery, setSearchQuery] = useState('');
  const [showQRModal, setShowQRModal] = useState(false);

  const filteredCouriers = useMemo(() => {
    return couriers.filter(c => 
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      c.phone?.includes(searchQuery)
    );
  }, [couriers, searchQuery]);

  useEffect(() => {
    const loadWeek = async () => {
      const dbOrders = await getOrdersForWeek()
      setWeekOrders(dbOrders)
    }
    loadWeek()
    window.addEventListener('indexeddb-synced', loadWeek)
    return () => window.removeEventListener('indexeddb-synced', loadWeek)
  }, [])
  useEffect(() => {
    fetchInitialOrders();
  }, [fetchInitialOrders]);

  const allOrders = useMemo(() => {
    const map = new Map<string, Order>()
    weekOrders.forEach(o => map.set(o.id, o))
    orders.forEach(o => map.set(o.id, o))
    activeOrdersByCourier.forEach(o => map.set(o.id, o))
    return Array.from(map.values())
  }, [weekOrders, orders, activeOrdersByCourier])

  useEffect(() => {
    if (couriers.length === 0) return
    const loadAll = async () => {
      const result: Record<string, number> = {}
      for (const c of couriers) {
        const unpaidDB = await getUnpaidOrdersByCourier(c.id)
        const unpaidZustand = allOrders.filter(o =>
          o.courier_id === c.id &&
          o.status === 'delivered' &&
          o.payment_status === 'unpaid'
        )
        const map = new Map<string, Order>()
        unpaidDB.forEach(o => map.set(o.id, o))
        unpaidZustand.forEach(o => map.set(o.id, o))
        result[c.id] = map.size
      }
      setAllUnpaidCounts(result)
    }
    loadAll()
  }, [couriers.length, orders])


  const courierUnpaidCount = (courierId: string) => {
    return allUnpaidCounts[courierId] ?? 0
  }

  useEffect(() => {
    if (!selectedCourier) {
      setCourierUnpaidOrders([])
      return
    }
    getUnpaidOrdersByCourier(selectedCourier.id).then(setCourierUnpaidOrders)
  }, [selectedCourier?.id])

  // Form state
  const [newCourier, setNewCourier] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    vehicle_type: 'motorcycle' as Courier['vehicle_type'],
    plate_number: '',
  });

  const activeCouriersCount = couriers.filter((c: Courier) => c.is_active).length;
  const onlineCouriersCount = couriers.filter((c: Courier) => c.is_active && c.is_online).length;

  // Calculate from actual order data instead of stale courier fields
  const totalDeliveries = allOrders.filter(o => o.status === 'delivered').length;
  const totalEarnings = allOrders
    .filter(o => o.status === 'delivered')
    .reduce((sum, o) => sum + calcAdminEarning(o, earningSettings), 0);

  const handleAddCourier = () => {
    const courierData: Courier = {
      id: crypto.randomUUID(),
      name: newCourier.name,
      email: newCourier.email,
      role: 'courier',
      phone: newCourier.phone,
      is_active: true,
      is_online: false,
      vehicle_type: newCourier.vehicle_type,
      plate_number: newCourier.plate_number,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (newCourier.password.length < 8) {
      alert('Password must be at least 8 characters long');
      return;
    }

    addCourier(courierData, newCourier.password);
    setIsAddModalOpen(false);
    setShowCourierPassword(false);
    setNewCourier({
      name: '',
      email: '',
      password: '',
      phone: '',
      vehicle_type: 'motorcycle',
      plate_number: ''
    });
  };

  const handleToggleSuspend = async (courier: Courier) => {
    const { setCourierOffline, setCourierOnline } = useCourierStore.getState();

    if (courier.is_active) {
      // Suspend: keluarkan dari antrian
      // Gunakan alasan khusus suspend
      await setCourierOffline(courier.id, 'suspended');
      await updateCourier(courier.id, { is_active: false });
    } else {
      // Un-suspend: aktifkan + set ON langsung
      await updateCourier(courier.id, { is_active: true });
      await setCourierOnline(courier.id, 'on');
      // 'on' bukan 'off' — kurir langsung siap terima order
    }
  };

  const getCourierStats = (courierId: string) => {
    // Safety check for getOrdersByCourier
    if (!getOrdersByCourier) return null;

    const courierOrders = getOrdersByCourier(courierId) || [];
    const completed = courierOrders.filter(o => o.status === 'delivered');
    const earnings = completed.reduce((sum, o) => sum + calcCourierEarning(o, earningSettings), 0);

    // Calculate avg delivery time based on actual timestamps
    const completedWithTimes = completed.filter(o => o.actual_delivery_time && o.created_at);
    const avgTime = completedWithTimes.length > 0
      ? completedWithTimes.reduce((sum, o) => {
          const start = new Date(o.created_at).getTime();
          const end = new Date(o.actual_delivery_time!).getTime();
          return sum + (end - start) / (1000 * 60); // minutes
        }, 0) / completedWithTimes.length
      : 0;

    return {
      total_orders: courierOrders.length,
      completed_orders: completed.length,
      total_earnings: earnings,
      average_delivery_time: Math.round(avgTime),
      recent_orders: courierOrders.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 5)
    };
  };

  const selectedCourierStats = useMemo(() => {
    if (!selectedCourier) return null;
    try {
      return getCourierStats(selectedCourier.id);
    } catch (error) {
      console.error("Error calculating stats:", error);
      return {
        total_orders: 0,
        completed_orders: 0,
        total_earnings: 0,
        average_delivery_time: 0,
        recent_orders: []
      };
    }
  }, [selectedCourier, couriers, getOrdersByCourier]);


  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="min-h-screen">
      <Header
        title="Couriers"
        subtitle={`${couriers.length} registered`}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" leftIcon={<QrCode className="h-4 w-4" />} onClick={() => setShowQRModal(true)}>
              QR Stay
            </Button>
            <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setIsAddModalOpen(true)}>
              Add Courier
            </Button>
          </div>
        }
      />

      <div className="p-4 lg:p-8 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-3 lg:gap-6">
          <StatCard
            title="Total Couriers"
            value={couriers.length}
            icon={<Package className="h-6 w-6" />}
          />
          <StatCard
            title="Active Couriers"
            value={activeCouriersCount}
            icon={<ToggleRight className="h-6 w-6" />}
            subtitle={`${onlineCouriersCount} online now`}
          />
          <StatCard
            title="Deliveries (7 Hari)"
            value={totalDeliveries}
            icon={<TrendingUp className="h-6 w-6" />}
          />
          {isFinance && (
            <StatCard
              title="Potensi Setoran (7 Hari)"
              value={formatCurrency(totalEarnings)}
              icon={<DollarSign className="h-6 w-6" />}
            />
          )}
        </div>

        {/* Search Bar */}
        <div className="max-w-md">
          <Input
            placeholder="Search name or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftIcon={<Search className="h-4 w-4 text-gray-400" />}
            className="bg-white"
          />
        </div>

        {/* Couriers Table */}
        <Card padding="none">
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader>Name</TableHeader>
                <TableHeader>Status</TableHeader>
                <TableHeader>Active</TableHeader>
                <TableHeader>Completed (7H)</TableHeader>
                {isFinance && (
                  <>
                    <TableHeader>Setoran Admin (20%)</TableHeader>
                    <TableHeader>Hak Kurir (80%)</TableHeader>
                  </>
                )}
                <TableHeader>Action</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredCouriers.length === 0 ? (
                <TableEmpty 
                  colSpan={isFinance ? 7 : 5} 
                  message={searchQuery ? `No results found for "${searchQuery}"` : "No couriers registered yet. Please click 'Add Courier' to onboard a new team member."} 
                />
              ) : (
                filteredCouriers.map((courier: Courier) => (
                  <TableRow
                    key={courier.id}
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => { setSelectedCourier(courier); setIsPerformanceModalOpen(true); }}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-teal-100 rounded-full flex items-center justify-center text-teal-600 font-bold text-xs">
                          {courier.name.charAt(0)}
                        </div>
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900">{courier.name}</span>
                            <CourierBadge type={courier.vehicle_type} showLabel={false} className="border-none bg-transparent p-0" />
                          </div>
                          <span className="text-xs text-gray-500 hidden lg:inline">{courier.email}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <Badge variant={courier.is_active ? 'success' : 'danger'}>
                          {courier.is_active ? 'Active' : 'Suspended'}
                        </Badge>
                        {courier.is_active && (() => {
                          const status = (courier as any).courier_status ?? (courier.is_online ? 'on' : 'off')
                          const waitingOrder = activeOrdersByCourier.find(o => 
                            o.courier_id === courier.id && 
                            o.is_waiting === true &&
                            !['cancelled', 'delivered'].includes(o.status)
                          );
                          return (
                            <>
                              {status === 'on' && <span className="text-xs text-green-600 font-semibold">{'\u{1F680}'} ON</span>}
                              {status === 'stay' && <span className="text-xs text-blue-600 font-semibold">{'\u{1F3E0}'} STAY</span>}
                              {status !== 'on' && status !== 'stay' && (
                                <span className="text-xs text-red-500 font-semibold">
                                  {'\u{1F534}'} OFF{(courier as any).off_reason ? ` • ${(courier as any).off_reason}` : ''}
                                </span>
                              )}
                              {waitingOrder && (
                                <span className="text-xs text-yellow-600 font-semibold">
                                  📝 PENDING — {waitingOrder.order_number}
                                </span>
                              )}
                            </>
                          )
                        })()}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="info">
                        {allOrders.filter(o =>
                          o.courier_id === courier.id &&
                          !['delivered', 'cancelled'].includes(o.status)
                        ).length}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {allOrders.filter(o =>
                        o.courier_id === courier.id &&
                        o.status === 'delivered'
                      ).length}
                    </TableCell>
                    {isFinance && (
                      <>
                        <TableCell>
                          {formatCurrency(
                            allOrders
                              .filter(o => o.courier_id === courier.id && o.status === 'delivered')
                              .reduce((sum, o) => sum + calcAdminEarning(o, earningSettings), 0)
                          )}
                        </TableCell>
                        <TableCell>
                          {formatCurrency(
                            allOrders
                              .filter(o => o.courier_id === courier.id && o.status === 'delivered')
                              .reduce((sum, o) => sum + calcCourierEarning(o, earningSettings), 0)
                          )}
                          {courierUnpaidCount(courier.id) > 0 && (
                            <span className="ml-2 px-2 py-1 bg-orange-100 text-orange-700 text-xs rounded-full font-medium">
                              ⚠️ {courierUnpaidCount(courier.id)} belum setor
                            </span>
                          )}
                        </TableCell>
                      </>
                    )}
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={(e) => {
                        e.stopPropagation();
                        setSelectedCourier(courier);
                        setIsPerformanceModalOpen(true);
                      }}>
                        <Eye className="w-4 h-4 text-gray-500" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </div>

      {/* Add Courier Modal */}
      <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="Add New Courier" size="md">
        <div className="space-y-4">
          <Input
            label="Full Name"
            value={newCourier.name}
            onChange={(e) => setNewCourier({ ...newCourier, name: e.target.value })}
            placeholder="Enter full name"
          />
          <Input
            label="Email"
            type="email"
            value={newCourier.email}
            onChange={(e) => setNewCourier({ ...newCourier, email: e.target.value })}
            placeholder="courier@example.com"
          />
          <div>
            <label htmlFor="courier-password" theme-color="teal" className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <div className="relative">
            <input
              id="courier-password"
              type={showCourierPassword ? 'text' : 'password'}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              value={newCourier.password}
              onChange={(e) => setNewCourier({ ...newCourier, password: e.target.value })}
              placeholder="Min 8 characters"
            />
            <button
              type="button"
              onClick={() => setShowCourierPassword(!showCourierPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showCourierPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
            </div>
          </div>
          <Input
            label="Phone Number"
            value={newCourier.phone}
            onChange={(e) => setNewCourier({ ...newCourier, phone: e.target.value })}
            placeholder="+628..."
          />
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Jenis Kendaraan"
              value={newCourier.vehicle_type}
              onChange={(e) => setNewCourier({ ...newCourier, vehicle_type: e.target.value as Courier['vehicle_type'] })}
              options={[
                { value: 'motorcycle', label: 'Motor' },
                { value: 'car', label: 'Mobil' },
                { value: 'bicycle', label: 'Sepeda' },
                { value: 'van', label: 'Van/Pick Up' },
              ]}
            />
            <Input
              label="Plate Number"
              value={newCourier.plate_number}
              onChange={(e) => setNewCourier({ ...newCourier, plate_number: e.target.value })}
              placeholder="B 1234 XYZ"
            />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={() => { setIsAddModalOpen(false); setShowCourierPassword(false); }}>
              Cancel
            </Button>
            <Button
              onClick={handleAddCourier}
              disabled={!newCourier.name || !newCourier.email || newCourier.password.length < 8}
            >
              Add Courier
            </Button>
          </div>
        </div>
      </Modal>

      {/* Performance & Detail Modal */}
      <Modal
        isOpen={isPerformanceModalOpen}
        onClose={() => setIsPerformanceModalOpen(false)}
        title={selectedCourier ? `Courier Details: ${selectedCourier.name}` : 'Details'}
        size="lg"
      >
        {selectedCourier && selectedCourierStats ? (
          <div className="space-y-6">

            {/* Header / Actions */}
            <div className="flex justify-between items-center bg-gray-50 p-4 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-teal-600 text-white rounded-full flex items-center justify-center text-xl font-bold">
                  {selectedCourier.name.charAt(0)}
                </div>
                <div>
                  <h4 className="font-bold text-gray-900">{selectedCourier.name}</h4>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
                    <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {selectedCourier.email}</span>
                    <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {selectedCourier.phone}</span>
                    <CourierBadge type={selectedCourier.vehicle_type} />
                    {selectedCourier.plate_number && (
                      <span className="flex items-center gap-1 uppercase"><Hash className="w-3 h-3" /> {selectedCourier.plate_number}</span>
                    )}
                  </div>
                </div>
              </div>
              <div>
                {selectedCourier.is_active ? (
                  <Button
                    variant="danger"
                    size="sm"
                    leftIcon={<ToggleRight className="w-4 h-4" />}
                    onClick={() => { handleToggleSuspend(selectedCourier); setIsPerformanceModalOpen(false); }}
                  >
                    Suspend Account
                  </Button>
                ) : (
                  <Button
                    variant="primary" // Re-using primary for positive action (custom styling below)
                    className="bg-green-600 hover:bg-green-700 text-white"
                    size="sm"
                    leftIcon={<ToggleLeft className="w-4 h-4" />}
                    onClick={() => { handleToggleSuspend(selectedCourier); setIsPerformanceModalOpen(false); }}
                  >
                    Activate Account
                  </Button>
                )}
              </div>
            </div>

            {/* Performance Stats */}
            <div className="mb-6">
              <h4 className="text-sm font-medium text-gray-600 flex items-center gap-2 mb-3">
                <Award className="w-4 h-4" /> Performance Metrics
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-xl p-3.5">
                  <p className="text-xs text-gray-500 font-medium mb-1">Total Orders</p>
                  <p className="text-xl font-semibold text-gray-900 leading-none">{selectedCourierStats.total_orders}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3.5">
                  <p className="text-xs text-gray-500 font-medium mb-1">Completed</p>
                  <p className="text-xl font-semibold text-gray-900 leading-none">{selectedCourierStats.completed_orders}</p>
                </div>
                {isFinance && (
                  <div className="bg-gray-50 rounded-xl p-3.5">
                    <p className="text-xs text-gray-500 font-medium mb-1">Earnings</p>
                    <p className="text-lg font-semibold text-gray-900 leading-none truncate" title={formatCurrency(selectedCourierStats.total_earnings)}>
                      {formatCurrency(selectedCourierStats.total_earnings)}
                    </p>
                  </div>
                )}
                <div className="bg-gray-50 rounded-xl p-3.5">
                  <p className="text-xs text-gray-500 font-medium mb-1">Avg Time</p>
                  <p className="text-xl font-semibold text-gray-900 leading-none">
                    {selectedCourierStats.average_delivery_time}<span className="text-sm font-normal text-gray-500 ml-1">min</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Tagihan Setoran (Terproteksi RBAC) */}
            {isFinance && (() => {
              const unpaidOrders = courierUnpaidOrders
              if (!unpaidOrders || unpaidOrders.length === 0) return null;
              
              const unpaidTotalFee = unpaidOrders.reduce(
                (sum, o) => sum + o.total_fee, 0
              );
              const unpaidPlatformFee = unpaidOrders.reduce(
                (sum, o) => sum + calcAdminEarning(o, earningSettings), 0
              );

              return (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <h4 className="font-semibold flex items-center gap-2 text-orange-800 mb-3">
                    💰 Tagihan Setoran
                  </h4>
                  <div className="space-y-1 text-sm text-orange-700 mb-4">
                    <p>{unpaidOrders.length} order belum disetor</p>
                    <p>Total ongkir: {formatCurrency(unpaidTotalFee)}</p>
                    <p className="font-bold">
                      Harus disetor ({100 - commission_rate}%): {formatCurrency(unpaidPlatformFee)}
                    </p>
                  </div>
                  <button
                    onClick={() => setShowSettleConfirm(true)}
                    className="w-full py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-semibold transition-colors"
                  >
                    Konfirmasi Setor Semua — {formatCurrency(unpaidPlatformFee)}
                  </button>
                </div>
              );
            })()}

            {/* Recent History */}
            <div>
              <h4 className="font-semibold mb-3">Recent Delivery History</h4>
              <div className="space-y-2 max-h-48 overflow-y-auto border rounded-lg p-2">
                {selectedCourierStats.recent_orders?.length === 0 ? (
                  <p className="text-center text-gray-400 py-4 text-sm">No delivery history yet.</p>
                ) : (
                  selectedCourierStats.recent_orders?.map((order) => (
                    <div key={order.id} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded border-b last:border-0 border-gray-100">
                      <div>
                        <p className="font-medium text-sm text-teal-600">{order.order_number}</p>
                        <p className="text-xs text-gray-500">{format(new Date(order.created_at), 'MMM dd, HH:mm')}</p>
                      </div>
                      <div className="text-right">
                        <Badge variant={getStatusBadgeVariant(order.status)} size="sm">{getStatusLabel(order.status)}</Badge>
                        <p className="text-xs font-medium mt-1">{formatCurrency(order.total_fee || 0)}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t">
              <Button variant="outline" onClick={() => setIsPerformanceModalOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <p>Loading details...</p>
            {/* Fallback if stats fail to load, though we have try-catch now */}
          </div>
        )}
      </Modal>

      {/* Konfirmasi Dialog */}
      {showSettleConfirm && selectedCourier && (() => {
        const unpaidOrders = courierUnpaidOrders
        const unpaidPlatformFee = unpaidOrders.reduce(
          (sum, o) => sum + calcAdminEarning(o, earningSettings), 0
        );

        return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4">
              <h3 className="font-bold text-lg mb-2">Konfirmasi Setoran</h3>
              <p className="text-gray-600 mb-4">
                Terima setoran {formatCurrency(unpaidPlatformFee)} dari {selectedCourier.name}?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowSettleConfirm(false)}
                  className="flex-1 py-2 border rounded-lg"
                >
                  Batal
                </button>
                <button
                  onClick={async () => {
                    await Promise.all(
                      unpaidOrders.map(async o => {
                        if (!user) throw new Error('Anda harus login untuk melakukan konfirmasi setoran');
                        await settleOrder(o.id, user.id, user.name);
                      })
                    )
                    setCourierUnpaidOrders([])
                    setAllUnpaidCounts(prev => ({
                      ...prev,
                      [selectedCourier.id]: 0
                    }))
                    setShowSettleConfirm(false);
                  }}
                  className="flex-1 py-2 bg-green-500 text-white rounded-lg font-semibold"
                >
                  Konfirmasi
                </button>
              </div>
            </div>
          </div>
        );
      })()}
      {/* QR Stay Verification Modal */}
      <Modal isOpen={showQRModal} onClose={() => setShowQRModal(false)} title="QR Stay Verification" size="lg">
        <Suspense fallback={<div className="flex items-center justify-center p-12"><RefreshCw className="w-8 h-8 animate-spin text-teal-600" /></div>}>
          <StayQRDisplay />
        </Suspense>
      </Modal>
    </div>
  );
}
