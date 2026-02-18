import { useState, useMemo } from 'react';
import { Plus, Eye, ToggleLeft, ToggleRight, TrendingUp, Package, DollarSign, Phone, Mail, Award } from 'lucide-react';
import { format } from 'date-fns';
import { Header } from '@/components/layout/Header';
import { Card, StatCard } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Badge, getStatusBadgeVariant, getStatusLabel } from '@/components/ui/Badge';
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
import type { Courier } from '@/types';

export function Couriers() {
  const { couriers, addCourier, suspendCourier } = useCourierStore();
  const { orders, getCourierStats } = useOrderStore(); // To calculate real-time stats

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isPerformanceModalOpen, setIsPerformanceModalOpen] = useState(false);
  const [selectedCourier, setSelectedCourier] = useState<Courier | null>(null);

  // Form state
  const [newCourier, setNewCourier] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    commission_rate: 80,
  });

  const activeCouriersCount = couriers.filter((c) => c.is_active).length;
  const onlineCouriersCount = couriers.filter((c) => c.is_active && c.is_online).length;

  // Calculate from actual order data instead of stale courier fields
  const totalDeliveries = orders.filter(o => o.status === 'delivered').length;
  const totalEarnings = orders
    .filter(o => o.status === 'delivered')
    .reduce((sum, o) => sum + (o.total_fee || 0), 0);

  const handleAddCourier = () => {
    const courierData: Courier = {
      id: Date.now(),
      name: newCourier.name,
      email: newCourier.email,
      password: newCourier.password,
      role: 'courier',
      phone: newCourier.phone,
      is_active: true,
      is_online: false,
      commission_rate: newCourier.commission_rate,
      active_orders_count: 0,
      total_completed: 0,
      total_earnings: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    addCourier(courierData);
    setIsAddModalOpen(false);
    setNewCourier({ name: '', email: '', password: '', phone: '', commission_rate: 80 });
  };

  const handleToggleSuspend = (courier: Courier) => {
    // If currently active (is_active=true), we want to suspend (isSuspended=true)
    const shouldSuspend = courier.is_active;
    suspendCourier(courier.id, shouldSuspend);
  };

  const selectedCourierStats = useMemo(() => {
    if (!selectedCourier) return null;
    return getCourierStats(selectedCourier.id);
  }, [selectedCourier, orders, getCourierStats]);


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
          <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setIsAddModalOpen(true)}>
            Add Courier
          </Button>
        }
      />

      <div className="p-4 lg:p-8 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-6">
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
            title="Total Deliveries"
            value={totalDeliveries}
            icon={<TrendingUp className="h-6 w-6" />}
          />
          <StatCard
            title="Total Earnings"
            value={formatCurrency(totalEarnings)}
            icon={<DollarSign className="h-6 w-6" />}
          />
        </div>

        {/* Couriers Table */}
        <Card padding="none">
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader>Name</TableHeader>
                <TableHeader>Status</TableHeader>
                <TableHeader>Completed</TableHeader>
                <TableHeader>Earnings</TableHeader>
                <TableHeader>Action</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {couriers.length === 0 ? (
                <TableEmpty colSpan={5} message="No couriers found" />
              ) : (
                couriers.map((courier) => (
                  <TableRow
                    key={courier.id}
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => { setSelectedCourier(courier); setIsPerformanceModalOpen(true); }}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold text-xs">
                          {courier.name.charAt(0)}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-medium text-gray-900">{courier.name}</span>
                          <span className="text-xs text-gray-500 hidden lg:inline">{courier.email}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge variant={courier.is_active ? 'success' : 'danger'}>
                          {courier.is_active ? 'Active' : 'Suspended'}
                        </Badge>
                        {courier.is_active && courier.is_online && (
                          <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                            Online
                          </span>
                        )}
                        {courier.is_active && !courier.is_online && (
                          <span className="text-xs text-gray-400">Offline</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{getCourierStats(courier.id).completed_orders}</TableCell>
                    <TableCell>{formatCurrency(getCourierStats(courier.id).total_earnings)}</TableCell>
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
          <Input
            label="Password"
            type="password"
            value={newCourier.password}
            onChange={(e) => setNewCourier({ ...newCourier, password: e.target.value })}
            placeholder="Min 8 characters"
          />
          <Input
            label="Phone Number"
            value={newCourier.phone}
            onChange={(e) => setNewCourier({ ...newCourier, phone: e.target.value })}
            placeholder="+628..."
          />
          <Input
            label="Commission Rate (%)"
            type="number"
            value={newCourier.commission_rate}
            onChange={(e) => setNewCourier({ ...newCourier, commission_rate: Number(e.target.value) })}
            placeholder="80"
            min={0}
            max={100}
          />
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={() => setIsAddModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAddCourier}
              disabled={!newCourier.name || !newCourier.email || !newCourier.password}
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
                <div className="w-12 h-12 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xl font-bold">
                  {selectedCourier.name.charAt(0)}
                </div>
                <div>
                  <h4 className="font-bold text-gray-900">{selectedCourier.name}</h4>
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {selectedCourier.email}</span>
                    <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {selectedCourier.phone}</span>
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
            <h4 className="font-semibold flex items-center gap-2"><Award className="w-4 h-4 text-yellow-500" /> Performance Metrics</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white border rounded-lg p-3 text-center shadow-sm">
                <p className="text-2xl font-bold text-indigo-600">{selectedCourierStats.total_orders}</p>
                <p className="text-xs text-gray-500 uppercase font-semibold">Total Orders</p>
              </div>
              <div className="bg-white border rounded-lg p-3 text-center shadow-sm">
                <p className="text-2xl font-bold text-green-600">{selectedCourierStats.completed_orders}</p>
                <p className="text-xs text-gray-500 uppercase font-semibold">Completed</p>
              </div>
              <div className="bg-white border rounded-lg p-3 text-center shadow-sm">
                <p className="text-xl font-bold text-gray-900">{formatCurrency(selectedCourierStats.total_earnings)}</p>
                <p className="text-xs text-gray-500 uppercase font-semibold">History Earnings</p>
              </div>
              <div className="bg-white border rounded-lg p-3 text-center shadow-sm">
                <p className="text-xl font-bold text-purple-600">{selectedCourierStats.average_delivery_time}m</p>
                <p className="text-xs text-gray-500 uppercase font-semibold">Avg Time</p>
              </div>
            </div>

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
                        <p className="font-medium text-sm text-indigo-600">{order.order_number}</p>
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
    </div>
  );
}
