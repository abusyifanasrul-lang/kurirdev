import { useState } from 'react';
import { Plus, Eye, ToggleLeft, ToggleRight, TrendingUp, Package, DollarSign, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { Header } from '@/components/layout/Header';
import { Card, StatCard } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeader,
  TableCell,
  TableEmpty,
} from '@/components/ui/Table';
import { mockCouriers, mockCourierPerformance } from '@/services/mockData';
import type { Courier } from '@/types';

export function Couriers() {
  const [couriers, setCouriers] = useState<Courier[]>(mockCouriers);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isPerformanceModalOpen, setIsPerformanceModalOpen] = useState(false);
  const [selectedCourier, setSelectedCourier] = useState<Courier | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Form state
  const [newCourier, setNewCourier] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
  });

  const handleAddCourier = async () => {
    setIsLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const courierData: Courier = {
      id: couriers.length + 10,
      name: newCourier.name,
      email: newCourier.email,
      role: 'courier',
      phone: newCourier.phone,
      is_active: true,
      is_online: false,
      active_orders_count: 0,
      total_completed: 0,
      total_earnings: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setCouriers([...couriers, courierData]);
    setIsAddModalOpen(false);
    setNewCourier({ name: '', email: '', password: '', phone: '' });
    setIsLoading(false);
  };

  const handleToggleStatus = async (courier: Courier) => {
    setIsLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 500));

    const updatedCouriers = couriers.map((c) =>
      c.id === courier.id ? { ...c, is_active: !c.is_active, updated_at: new Date().toISOString() } : c
    );

    setCouriers(updatedCouriers);
    setIsLoading(false);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const activeCouriers = couriers.filter((c) => c.is_active);
  const onlineCouriers = couriers.filter((c) => c.is_online);
  const totalEarnings = couriers.reduce((sum, c) => sum + (c.total_earnings || 0), 0);

  return (
    <div className="min-h-screen">
      <Header
        title="Couriers"
        subtitle={`${couriers.length} total couriers`}
        actions={
          <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setIsAddModalOpen(true)}>
            Add Courier
          </Button>
        }
      />

      <div className="p-8 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <StatCard
            title="Total Couriers"
            value={couriers.length}
            icon={<Package className="h-6 w-6" />}
          />
          <StatCard
            title="Active Couriers"
            value={activeCouriers.length}
            icon={<ToggleRight className="h-6 w-6" />}
            subtitle={`${onlineCouriers.length} online now`}
          />
          <StatCard
            title="Total Deliveries"
            value={couriers.reduce((sum, c) => sum + (c.total_completed || 0), 0)}
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
                <TableHeader>Email</TableHeader>
                <TableHeader>Phone</TableHeader>
                <TableHeader>Status</TableHeader>
                <TableHeader>Active Orders</TableHeader>
                <TableHeader>Completed</TableHeader>
                <TableHeader>Earnings</TableHeader>
                <TableHeader>Actions</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {couriers.length === 0 ? (
                <TableEmpty colSpan={8} message="No couriers found" />
              ) : (
                couriers.map((courier) => (
                  <TableRow key={courier.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-medium">
                          {courier.name.charAt(0)}
                        </div>
                        <span className="font-medium">{courier.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>{courier.email}</TableCell>
                    <TableCell>{courier.phone || '-'}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge variant={courier.is_active ? 'success' : 'danger'}>
                          {courier.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                        {courier.is_online && (
                          <span className="flex items-center gap-1 text-xs text-green-600">
                            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                            Online
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{courier.active_orders_count || 0}</TableCell>
                    <TableCell>{courier.total_completed || 0}</TableCell>
                    <TableCell>{formatCurrency(courier.total_earnings || 0)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            setSelectedCourier(courier);
                            setIsPerformanceModalOpen(true);
                          }}
                          className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                          title="View Performance"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleToggleStatus(courier)}
                          className={`p-1.5 rounded ${
                            courier.is_active
                              ? 'text-red-400 hover:text-red-600 hover:bg-red-50'
                              : 'text-green-400 hover:text-green-600 hover:bg-green-50'
                          }`}
                          title={courier.is_active ? 'Deactivate' : 'Activate'}
                        >
                          {courier.is_active ? (
                            <ToggleRight className="h-4 w-4" />
                          ) : (
                            <ToggleLeft className="h-4 w-4" />
                          )}
                        </button>
                      </div>
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
            placeholder="Enter courier's full name"
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
            helperText="Must contain at least 1 uppercase letter and 1 number"
          />
          <Input
            label="Phone Number"
            value={newCourier.phone}
            onChange={(e) => setNewCourier({ ...newCourier, phone: e.target.value })}
            placeholder="+62812345678"
          />
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={() => setIsAddModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAddCourier}
              isLoading={isLoading}
              disabled={!newCourier.name || !newCourier.email || !newCourier.password}
            >
              Add Courier
            </Button>
          </div>
        </div>
      </Modal>

      {/* Performance Modal */}
      <Modal
        isOpen={isPerformanceModalOpen}
        onClose={() => setIsPerformanceModalOpen(false)}
        title={`${selectedCourier?.name}'s Performance`}
        size="lg"
      >
        {selectedCourier && (
          <div className="space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <Package className="h-6 w-6 text-indigo-600 mx-auto mb-2" />
                <p className="text-2xl font-bold">{mockCourierPerformance.total_orders}</p>
                <p className="text-sm text-gray-500">Total Orders</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <TrendingUp className="h-6 w-6 text-green-600 mx-auto mb-2" />
                <p className="text-2xl font-bold">{mockCourierPerformance.completed_orders}</p>
                <p className="text-sm text-gray-500">Completed</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <DollarSign className="h-6 w-6 text-yellow-600 mx-auto mb-2" />
                <p className="text-2xl font-bold">{formatCurrency(mockCourierPerformance.total_earnings)}</p>
                <p className="text-sm text-gray-500">Total Earnings</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <Clock className="h-6 w-6 text-purple-600 mx-auto mb-2" />
                <p className="text-2xl font-bold">{mockCourierPerformance.average_delivery_time}m</p>
                <p className="text-sm text-gray-500">Avg. Delivery</p>
              </div>
            </div>

            {/* Recent Orders */}
            <div>
              <h4 className="font-medium mb-3">Recent Orders</h4>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {mockCourierPerformance.recent_orders.slice(0, 5).map((order) => (
                  <div key={order.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-sm">{order.order_number}</p>
                      <p className="text-xs text-gray-500">{order.customer_name}</p>
                    </div>
                    <div className="text-right">
                      <Badge
                        variant={
                          order.status === 'delivered'
                            ? 'success'
                            : order.status === 'cancelled'
                            ? 'danger'
                            : 'default'
                        }
                      >
                        {order.status}
                      </Badge>
                      <p className="text-xs text-gray-500 mt-1">
                        {format(new Date(order.created_at), 'MMM dd, yyyy')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t">
              <Button variant="outline" onClick={() => setIsPerformanceModalOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
