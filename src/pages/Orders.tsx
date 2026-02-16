import { useState, useEffect, useMemo } from 'react';
import { Plus, Download, Eye, UserPlus, XCircle, Search } from 'lucide-react';
import { format } from 'date-fns';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Textarea';
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
import { mockOrders, mockCouriers, mockStatusHistory } from '@/services/mockData';
import type { Order, OrderStatus, CreateOrderPayload } from '@/types';

const statusOptions = [
  { value: '', label: 'All Status' },
  { value: 'pending', label: 'Pending' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'picked_up', label: 'Picked Up' },
  { value: 'in_transit', label: 'In Transit' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
];

export function Orders() {
  const [orders, setOrders] = useState<Order[]>(mockOrders);
  const [isConnected, setIsConnected] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [dateFilter, setDateFilter] = useState({ start: '', end: '' });

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // Form state
  const [newOrder, setNewOrder] = useState<CreateOrderPayload>({
    customer_name: '',
    customer_phone: '',
    customer_address: '',
    total_fee: 8000,
    estimated_delivery_time: '',
  });
  const [selectedCourierId, setSelectedCourierId] = useState<string>('');
  const [cancelReason, setCancelReason] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Polling simulation
  useEffect(() => {
    const interval = setInterval(() => {
      setLastUpdated(new Date());
      setIsConnected(true);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Filter orders
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const matchesSearch =
        !searchQuery ||
        order.order_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.customer_phone.includes(searchQuery);

      const matchesStatus = !statusFilter || order.status === statusFilter;

      const orderDate = new Date(order.created_at);
      const matchesDateStart = !dateFilter.start || orderDate >= new Date(dateFilter.start);
      const matchesDateEnd = !dateFilter.end || orderDate <= new Date(dateFilter.end);

      return matchesSearch && matchesStatus && matchesDateStart && matchesDateEnd;
    });
  }, [orders, searchQuery, statusFilter, dateFilter]);

  const handleRefresh = () => {
    setLastUpdated(new Date());
  };

  const handleCreateOrder = async () => {
    setIsLoading(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const newOrderData: Order = {
      id: orders.length + 1,
      order_number: `ORD-${format(new Date(), 'yyyyMMdd')}-${String(orders.length + 1).padStart(4, '0')}`,
      ...newOrder,
      customer_phone: newOrder.customer_phone,
      customer_address: newOrder.customer_address,
      status: 'pending',
      total_fee: newOrder.total_fee || 8000,
      payment_status: 'unpaid',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      created_by: 1,
    };

    setOrders([newOrderData, ...orders]);
    setIsCreateModalOpen(false);
    setNewOrder({
      customer_name: '',
      customer_phone: '',
      customer_address: '',
      total_fee: 8000,
      estimated_delivery_time: '',
    });
    setIsLoading(false);
  };

  const handleAssignCourier = async () => {
    if (!selectedOrder || !selectedCourierId) return;

    setIsLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const courier = mockCouriers.find((c) => c.id === parseInt(selectedCourierId));
    const updatedOrders = orders.map((o) =>
      o.id === selectedOrder.id
        ? {
            ...o,
            status: 'assigned' as OrderStatus,
            courier_id: parseInt(selectedCourierId),
            courier_name: courier?.name,
            assigned_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }
        : o
    );

    setOrders(updatedOrders);
    setIsAssignModalOpen(false);
    setSelectedCourierId('');
    setIsLoading(false);
  };

  const handleCancelOrder = async () => {
    if (!selectedOrder) return;

    setIsLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const updatedOrders = orders.map((o) =>
      o.id === selectedOrder.id
        ? {
            ...o,
            status: 'cancelled' as OrderStatus,
            cancelled_at: new Date().toISOString(),
            cancellation_reason: cancelReason,
            updated_at: new Date().toISOString(),
          }
        : o
    );

    setOrders(updatedOrders);
    setIsCancelModalOpen(false);
    setCancelReason('');
    setIsLoading(false);
  };

  const handleExportCSV = () => {
    const headers = ['Order #', 'Customer', 'Phone', 'Address', 'Status', 'Courier', 'Total Fee', 'Created At'];
    const rows = filteredOrders.map((o) => [
      o.order_number,
      o.customer_name,
      o.customer_phone,
      o.customer_address,
      o.status,
      o.courier_name || '',
      o.total_fee,
      format(new Date(o.created_at), 'yyyy-MM-dd HH:mm'),
    ]);

    const csvContent = [headers, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `orders-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const onlineCouriers = mockCouriers.filter((c) => c.is_active && c.is_online);

  return (
    <div className="min-h-screen">
      <Header
        title="Orders"
        subtitle={`${filteredOrders.length} orders • Last updated: ${format(lastUpdated, 'HH:mm:ss')}`}
        isConnected={isConnected}
        onRefresh={handleRefresh}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" leftIcon={<Download className="h-4 w-4" />} onClick={handleExportCSV}>
              Export CSV
            </Button>
            <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setIsCreateModalOpen(true)}>
              New Order
            </Button>
          </div>
        }
      />

      <div className="p-4 lg:p-8">
        {/* Filters */}
        <Card className="mb-4 lg:mb-6">
          <div className="flex flex-col lg:flex-row flex-wrap gap-3 lg:gap-4">
            <div className="flex-1 w-full lg:w-auto lg:min-w-[200px]">
              <Input
                placeholder="Search orders..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                leftIcon={<Search className="h-4 w-4" />}
              />
            </div>
            <div className="w-full lg:w-48">
              <Select
                options={statusOptions}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                placeholder="Filter by status"
              />
            </div>
            <div className="grid grid-cols-2 gap-3 w-full lg:w-auto lg:flex lg:gap-4">
              <div className="w-full lg:w-40">
                <Input
                  type="date"
                  label="From"
                  value={dateFilter.start}
                  onChange={(e) => setDateFilter({ ...dateFilter, start: e.target.value })}
                />
              </div>
              <div className="w-full lg:w-40">
                <Input
                  type="date"
                  label="To"
                  value={dateFilter.end}
                  onChange={(e) => setDateFilter({ ...dateFilter, end: e.target.value })}
                />
              </div>
            </div>
          </div>
        </Card>

        {/* Orders Table - Desktop */}
        <Card padding="none" className="hidden lg:block">
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader>Order #</TableHeader>
                <TableHeader>Customer</TableHeader>
                <TableHeader>Phone</TableHeader>
                <TableHeader>Status</TableHeader>
                <TableHeader>Courier</TableHeader>
                <TableHeader>Total Fee</TableHeader>
                <TableHeader>Created At</TableHeader>
                <TableHeader>Actions</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredOrders.length === 0 ? (
                <TableEmpty colSpan={8} message="No orders found" />
              ) : (
                filteredOrders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium text-indigo-600">{order.order_number}</TableCell>
                    <TableCell>{order.customer_name}</TableCell>
                    <TableCell>{order.customer_phone}</TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(order.status)}>{getStatusLabel(order.status)}</Badge>
                    </TableCell>
                    <TableCell>{order.courier_name || '-'}</TableCell>
                    <TableCell>{formatCurrency(order.total_fee)}</TableCell>
                    <TableCell>{format(new Date(order.created_at), 'MMM dd, HH:mm')}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            setSelectedOrder(order);
                            setIsDetailModalOpen(true);
                          }}
                          className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                          title="View Details"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        {order.status === 'pending' && (
                          <button
                            onClick={() => {
                              setSelectedOrder(order);
                              setIsAssignModalOpen(true);
                            }}
                            className="p-1.5 text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                            title="Assign Courier"
                          >
                            <UserPlus className="h-4 w-4" />
                          </button>
                        )}
                        {order.status !== 'delivered' && order.status !== 'cancelled' && (
                          <button
                            onClick={() => {
                              setSelectedOrder(order);
                              setIsCancelModalOpen(true);
                            }}
                            className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"
                            title="Cancel Order"
                          >
                            <XCircle className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>

        {/* Orders Cards - Mobile */}
        <div className="lg:hidden space-y-3">
          {filteredOrders.length === 0 ? (
            <Card className="text-center py-8">
              <p className="text-gray-500">No orders found</p>
            </Card>
          ) : (
            filteredOrders.map((order) => (
              <Card key={order.id} padding="sm" className="space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-indigo-600">{order.order_number}</p>
                    <p className="text-sm font-medium text-gray-900 mt-0.5">{order.customer_name}</p>
                  </div>
                  <Badge variant={getStatusBadgeVariant(order.status)}>
                    {getStatusLabel(order.status)}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-gray-500">Phone</p>
                    <p className="font-medium">{order.customer_phone}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Courier</p>
                    <p className="font-medium">{order.courier_name || '-'}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Total Fee</p>
                    <p className="font-medium">{formatCurrency(order.total_fee)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Created</p>
                    <p className="font-medium">{format(new Date(order.created_at), 'MMM dd, HH:mm')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                  <button
                    onClick={() => {
                      setSelectedOrder(order);
                      setIsDetailModalOpen(true);
                    }}
                    className="flex-1 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                  >
                    View Details
                  </button>
                  {order.status === 'pending' && (
                    <button
                      onClick={() => {
                        setSelectedOrder(order);
                        setIsAssignModalOpen(true);
                      }}
                      className="flex-1 px-3 py-2 text-sm font-medium text-blue-700 bg-blue-100 hover:bg-blue-200 rounded-lg transition-colors"
                    >
                      Assign
                    </button>
                  )}
                  {order.status !== 'delivered' && order.status !== 'cancelled' && (
                    <button
                      onClick={() => {
                        setSelectedOrder(order);
                        setIsCancelModalOpen(true);
                      }}
                      className="px-3 py-2 text-sm font-medium text-red-700 bg-red-100 hover:bg-red-200 rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* Create Order Modal */}
      <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} title="Create New Order" size="lg">
        <div className="space-y-4">
          <Input
            label="Customer Name"
            value={newOrder.customer_name}
            onChange={(e) => setNewOrder({ ...newOrder, customer_name: e.target.value })}
            placeholder="Enter customer name"
          />
          <Input
            label="Customer Phone"
            value={newOrder.customer_phone}
            onChange={(e) => setNewOrder({ ...newOrder, customer_phone: e.target.value })}
            placeholder="+62812345678"
          />
          <Textarea
            label="Delivery Address"
            value={newOrder.customer_address}
            onChange={(e) => setNewOrder({ ...newOrder, customer_address: e.target.value })}
            placeholder="Enter full delivery address"
            rows={3}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Total Fee (IDR)"
              type="number"
              value={newOrder.total_fee}
              onChange={(e) => setNewOrder({ ...newOrder, total_fee: parseInt(e.target.value) || 0 })}
            />
            <Input
              label="Estimated Delivery"
              type="datetime-local"
              value={newOrder.estimated_delivery_time}
              onChange={(e) => setNewOrder({ ...newOrder, estimated_delivery_time: e.target.value })}
            />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={() => setIsCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateOrder} isLoading={isLoading}>
              Create Order
            </Button>
          </div>
        </div>
      </Modal>

      {/* Order Detail Modal */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        title={`Order ${selectedOrder?.order_number}`}
        size="lg"
      >
        {selectedOrder && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Customer Name</p>
                <p className="font-medium">{selectedOrder.customer_name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Phone</p>
                <p className="font-medium">{selectedOrder.customer_phone}</p>
              </div>
              <div className="col-span-2">
                <p className="text-sm text-gray-500">Address</p>
                <p className="font-medium">{selectedOrder.customer_address}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Status</p>
                <Badge variant={getStatusBadgeVariant(selectedOrder.status)} size="md">
                  {getStatusLabel(selectedOrder.status)}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Fee</p>
                <p className="font-medium">{formatCurrency(selectedOrder.total_fee)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Courier</p>
                <p className="font-medium">{selectedOrder.courier_name || 'Not assigned'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Created At</p>
                <p className="font-medium">{format(new Date(selectedOrder.created_at), 'PPp')}</p>
              </div>
            </div>

            {/* Status Timeline */}
            <div>
              <h4 className="font-medium mb-3">Status History</h4>
              <div className="space-y-3">
                {mockStatusHistory.map((history) => (
                  <div key={history.id} className="flex items-start gap-3">
                    <div className="w-2 h-2 mt-2 rounded-full bg-indigo-600" />
                    <div>
                      <p className="font-medium">{getStatusLabel(history.status)}</p>
                      <p className="text-sm text-gray-500">
                        {history.changed_by_name} • {format(new Date(history.changed_at), 'PPp')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              {selectedOrder.status === 'pending' && (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setIsDetailModalOpen(false);
                    setIsAssignModalOpen(true);
                  }}
                >
                  Assign Courier
                </Button>
              )}
              {selectedOrder.status !== 'delivered' && selectedOrder.status !== 'cancelled' && (
                <Button
                  variant="danger"
                  onClick={() => {
                    setIsDetailModalOpen(false);
                    setIsCancelModalOpen(true);
                  }}
                >
                  Cancel Order
                </Button>
              )}
              <Button variant="outline" onClick={() => setIsDetailModalOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Assign Courier Modal */}
      <Modal isOpen={isAssignModalOpen} onClose={() => setIsAssignModalOpen(false)} title="Assign Courier">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Select a courier to assign to order <strong>{selectedOrder?.order_number}</strong>
          </p>
          <Select
            label="Select Courier"
            options={onlineCouriers.map((c) => ({ value: c.id, label: `${c.name} (${c.active_orders_count} active)` }))}
            value={selectedCourierId}
            onChange={(e) => setSelectedCourierId(e.target.value)}
            placeholder="Choose a courier"
          />
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={() => setIsAssignModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAssignCourier} isLoading={isLoading} disabled={!selectedCourierId}>
              Assign Courier
            </Button>
          </div>
        </div>
      </Modal>

      {/* Cancel Order Modal */}
      <Modal isOpen={isCancelModalOpen} onClose={() => setIsCancelModalOpen(false)} title="Cancel Order">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Are you sure you want to cancel order <strong>{selectedOrder?.order_number}</strong>?
          </p>
          <Textarea
            label="Cancellation Reason"
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="Enter reason for cancellation"
            rows={3}
          />
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={() => setIsCancelModalOpen(false)}>
              Go Back
            </Button>
            <Button variant="danger" onClick={handleCancelOrder} isLoading={isLoading}>
              Cancel Order
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
