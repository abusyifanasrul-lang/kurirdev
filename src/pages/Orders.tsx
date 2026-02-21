import { useState, useMemo, useEffect } from 'react';
import { Plus, Download, Search, User, MapPin, Truck, Bell, ArrowUpDown, ChevronUp, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';
import { requestNotificationPermission, sendMockNotification } from '@/utils/notification';
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

// Stores & Types
import { useOrderStore } from '@/stores/useOrderStore';
import { useCourierStore } from '@/stores/useCourierStore';
import { useUserStore } from '@/stores/useUserStore';
import { useAuth } from '@/context/AuthContext';
import type { Order, CreateOrderPayload, PaymentStatus } from '@/types';

const statusOptions = [
  { value: '', label: 'All Status' },
  { value: 'pending', label: 'Pending' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'picked_up', label: 'Picked Up' },
  { value: 'in_transit', label: 'In Transit' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
];

const searchCategories = [
  { value: 'all', label: 'All Fields' },
  { value: 'order_number', label: 'Order ID' },
  { value: 'customer_name', label: 'Customer' },
  { value: 'customer_phone', label: 'Phone' },
  { value: 'courier_name', label: 'Courier' },
  { value: 'customer_address', label: 'Address' },
];

type SortField = 'order_number' | 'customer_name' | 'status' | 'courier_name' | 'payment_status' | 'total_fee' | 'created_at';
type SortOrder = 'asc' | 'desc';

export function Orders() {
  const { orders, addOrder, assignCourier, cancelOrder, generateOrderId, updateOrder } = useOrderStore();
  const { getAvailableCouriers, rotateQueue } = useCourierStore();
  const { users } = useUserStore();
  const { user } = useAuth(); // Current admin user

  const getCourierName = (courierId?: string) => {
    if (!courierId) return null;
    const courier = users.find(u => u.id === courierId);
    return courier?.name || null;
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [searchCategory, setSearchCategory] = useState('all');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [dateFilter, setDateFilter] = useState({ start: '', end: '' });
  const [sortConfig, setSortConfig] = useState<{ field: SortField; order: SortOrder }>({
    field: 'created_at',
    order: 'desc',
  });

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);

  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [assignCourierId, setAssignCourierId] = useState<string>('');

  // Form State
  const [newOrder, setNewOrder] = useState<CreateOrderPayload>({
    customer_name: '',
    customer_phone: '',
    customer_address: '',
    total_fee: 15000,
    payment_status: 'unpaid',
    estimated_delivery_time: '',
  });

  // Edit Form State
  const [editForm, setEditForm] = useState<{
    customer_name: string;
    customer_phone: string;
    customer_address: string;
    total_fee: number;
    payment_status: PaymentStatus;
  }>({
    customer_name: '',
    customer_phone: '',
    customer_address: '',
    total_fee: 0,
    payment_status: 'unpaid',
  });

  const [cancelReason, setCancelReason] = useState('');

  // Derived State
  const filteredOrders = useMemo(() => {
    return orders
      .filter((order) => {
        const matchesStatus = !statusFilter || order.status === statusFilter;

        const orderDate = new Date(order.created_at);
        const start = dateFilter.start ? new Date(dateFilter.start) : null;
        const end = dateFilter.end ? new Date(dateFilter.end) : null;
        if (end) end.setHours(23, 59, 59); // inclusive end date

        const matchesDateStart = !start || orderDate >= start;
        const matchesDateEnd = !end || orderDate <= end;

        // Advanced Search Logic
        const q = searchQuery.toLowerCase();
        let matchesSearch = !searchQuery;

        if (searchQuery) {
          if (searchCategory === 'all') {
            matchesSearch =
              order.order_number.toLowerCase().includes(q) ||
              order.customer_name.toLowerCase().includes(q) ||
              order.customer_phone.includes(searchQuery) ||
              (getCourierName(order.courier_id)?.toLowerCase().includes(q) || false) ||
              order.customer_address.toLowerCase().includes(q);
          } else if (searchCategory === 'order_number') {
            matchesSearch = order.order_number.toLowerCase().includes(q);
          } else if (searchCategory === 'customer_name') {
            matchesSearch = order.customer_name.toLowerCase().includes(q);
          } else if (searchCategory === 'customer_phone') {
            matchesSearch = order.customer_phone.includes(searchQuery);
          } else if (searchCategory === 'courier_name') {
            matchesSearch = getCourierName(order.courier_id)?.toLowerCase().includes(q) || false;
          } else if (searchCategory === 'customer_address') {
            matchesSearch = order.customer_address.toLowerCase().includes(q);
          }
        }

        return matchesStatus && matchesDateStart && matchesDateEnd && matchesSearch;
      })
      .sort((a, b) => {
        const field = sortConfig.field;
        const order = sortConfig.order;

        let aValue: any = a[field] || '';
        let bValue: any = b[field] || '';

        if (typeof aValue === 'string') aValue = aValue.toLowerCase();
        if (typeof bValue === 'string') bValue = bValue.toLowerCase();

        if (aValue < bValue) return order === 'asc' ? -1 : 1;
        if (aValue > bValue) return order === 'asc' ? 1 : -1;
        return 0;
      });
  }, [orders, searchQuery, searchCategory, statusFilter, dateFilter, sortConfig]);

  const handleSort = (field: SortField) => {
    setSortConfig(prev => ({
      field,
      order: prev.field === field && prev.order === 'asc' ? 'desc' : 'asc',
    }));
  };

  const getSortIcon = (field: SortField) => {
    if (sortConfig.field !== field) return <ArrowUpDown className="h-3 w-3 ml-1 text-gray-400" />;
    return sortConfig.order === 'asc' ?
      <ChevronUp className="h-3 w-3 ml-1 text-indigo-600" /> :
      <ChevronDown className="h-3 w-3 ml-1 text-indigo-600" />;
  };

  const availableCouriers = useMemo(() => getAvailableCouriers(), [getAvailableCouriers]);

  // Sync edit form when order selected
  useEffect(() => {
    if (selectedOrder) {
      setEditForm({
        customer_name: selectedOrder.customer_name,
        customer_phone: selectedOrder.customer_phone,
        customer_address: selectedOrder.customer_address,
        total_fee: selectedOrder.total_fee,
        payment_status: selectedOrder.payment_status,
      });
    }
  }, [selectedOrder]);

  // Handlers
  const handleCreateOrder = () => {
    const orderData: Order = {
      id: Date.now(),
      order_number: generateOrderId(),
      ...newOrder,
      total_fee: newOrder.total_fee || 15000,
      status: 'pending',
      payment_status: newOrder.payment_status || 'unpaid',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      created_by: user?.id || 1,
    };

    addOrder(orderData);
    setIsCreateModalOpen(false);
    setNewOrder({
      customer_name: '',
      customer_phone: '',
      customer_address: '',
      total_fee: 15000,
      estimated_delivery_time: '',
    });
  };

  const handleAssign = () => {
    if (!selectedOrder || !assignCourierId) return;

    const courier = availableCouriers.find(c => c.id === assignCourierId);
    if (courier) {
      assignCourier(selectedOrder.id, courier.id, courier.name, user?.id || "1", user?.name || 'Admin');
      rotateQueue(courier.id); // Validating FIFO logic
      setIsDetailModalOpen(false);
      setAssignCourierId('');
    }
  };

  const handleCancel = () => {
    if (!selectedOrder) return;
    cancelOrder(selectedOrder.id, cancelReason, user?.id || 1, user?.name || 'Admin');
    setIsCancelModalOpen(false);
    setIsDetailModalOpen(false);
    setCancelReason('');
  };

  const handleSaveChanges = () => {
    if (!selectedOrder) return;
    updateOrder(selectedOrder.id, editForm);
    setSelectedOrder({ ...selectedOrder, ...editForm });
  };

  const handleExportCSV = () => {
    const headers = ['Order ID', 'Date', 'Customer', 'Phone', 'Address', 'Status', 'Courier', 'Fee'];
    const rows = filteredOrders.map(o => [
      o.order_number,
      format(new Date(o.created_at), 'yyyy-MM-dd HH:mm'),
      `"${o.customer_name}"`, // Quote to handle commas
      o.customer_phone,
      `"${o.customer_address}"`,
      o.status,
      getCourierName(o.courier_id) || 'Unassigned',
      o.total_fee
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `orders_export_${format(new Date(), 'yyyyMMdd')}.csv`;
    link.click();
  };

  const formatCurrency = (val: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val);

  return (
    <div className="min-h-screen">
      <Header
        title="Orders"
        subtitle={`${filteredOrders.length} records found`}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" leftIcon={<Bell className="h-4 w-4" />} onClick={async () => {
              const granted = await requestNotificationPermission();
              if (granted) {
                sendMockNotification('Test Notification', 'This is a test notification with sound and vibration!', { orderId: 123 });
              }
            }}>
              Test Notify
            </Button>
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
        <Card className="mb-6">
          <div className="flex flex-col lg:flex-row flex-wrap gap-4">
            <div className="flex-1 min-w-[300px] flex gap-2">
              <div className="w-40">
                <Select
                  options={searchCategories}
                  value={searchCategory}
                  onChange={(e) => setSearchCategory(e.target.value)}
                />
              </div>
              <div className="flex-1">
                <Input
                  placeholder="Search orders..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  leftIcon={<Search className="h-4 w-4" />}
                />
              </div>
            </div>
            <div className="w-full lg:w-48">
              <Select
                options={statusOptions}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                placeholder="All Status"
              />
            </div>
            <div className="flex gap-2 w-full lg:w-auto">
              <Input type="date" value={dateFilter.start} onChange={(e) => setDateFilter({ ...dateFilter, start: e.target.value })} />
              <Input type="date" value={dateFilter.end} onChange={(e) => setDateFilter({ ...dateFilter, end: e.target.value })} />
            </div>
          </div>
        </Card>

        {/* Orders Table */}
        <Card padding="none" className="hidden lg:block">
          <Table>
            <TableHead>
              <TableRow>
                <TableHeader
                  className="cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => handleSort('order_number')}
                >
                  <div className="flex items-center">Order # {getSortIcon('order_number')}</div>
                </TableHeader>
                <TableHeader
                  className="cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => handleSort('customer_name')}
                >
                  <div className="flex items-center">Customer {getSortIcon('customer_name')}</div>
                </TableHeader>
                <TableHeader
                  className="cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => handleSort('status')}
                >
                  <div className="flex items-center">Status {getSortIcon('status')}</div>
                </TableHeader>
                <TableHeader
                  className="cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => handleSort('courier_name')}
                >
                  <div className="flex items-center">Courier {getSortIcon('courier_name')}</div>
                </TableHeader>
                <TableHeader
                  className="cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => handleSort('payment_status')}
                >
                  <div className="flex items-center">Setoran {getSortIcon('payment_status')}</div>
                </TableHeader>
                <TableHeader
                  className="cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => handleSort('total_fee')}
                >
                  <div className="flex items-center">Fee {getSortIcon('total_fee')}</div>
                </TableHeader>
                <TableHeader
                  className="cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => handleSort('created_at')}
                >
                  <div className="flex items-center">Created {getSortIcon('created_at')}</div>
                </TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredOrders.length === 0 ? (
                <TableEmpty colSpan={6} message="No orders found" />
              ) : (
                filteredOrders.map((order) => (
                  <TableRow
                    key={order.id}
                    className="cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => { setSelectedOrder(order); setIsDetailModalOpen(true); }}
                  >
                    <TableCell className="font-medium text-indigo-600">{order.order_number}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium text-gray-900">{order.customer_name}</span>
                        <span className="text-xs text-gray-500">{order.customer_phone}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(order.status)}>{getStatusLabel(order.status)}</Badge>
                    </TableCell>
                    <TableCell>{getCourierName(order.courier_id) || <span className="text-gray-400 italic">Unassigned</span>}</TableCell>
                    <TableCell>
                      {order.status === 'delivered' ? (
                        order.payment_status === 'paid' ? (
                          <Badge variant="success">Sudah Setor</Badge>
                        ) : (
                          <Button
                            size="sm"
                            className="bg-orange-500 hover:bg-orange-600 text-white h-7 px-2 text-[10px]"
                            onClick={(e) => {
                              e.stopPropagation();
                              updateOrder(order.id, { payment_status: 'paid' });
                            }}
                          >
                            Konfirmasi Setor
                          </Button>
                        )
                      ) : (
                        <Badge variant="default" className="text-gray-400 border-gray-200">Belum Setor</Badge>
                      )}
                    </TableCell>
                    <TableCell>{formatCurrency(order.total_fee)}</TableCell>
                    <TableCell className="text-gray-500">{format(new Date(order.created_at), 'dd MMM HH:mm')}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>

        {/* Mobile List Info */}
        <div className="lg:hidden space-y-3">
          {filteredOrders.map(order => (
            <Card key={order.id} padding="sm" onClick={() => { setSelectedOrder(order); setIsDetailModalOpen(true); }}>
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="font-bold text-indigo-600">{order.order_number}</p>
                  <p className="text-sm font-medium">{order.customer_name}</p>
                </div>
                <Badge variant={getStatusBadgeVariant(order.status)}>{getStatusLabel(order.status)}</Badge>
              </div>
              <div className="text-sm text-gray-500 flex justify-between">
                <span>{formatCurrency(order.total_fee)}</span>
                <span>{format(new Date(order.created_at), 'dd MMM')}</span>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* CREATE ORDER MODAL */}
      <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} title="New Order" size="lg">
        <div className="space-y-4">
          <Input label="Customer Name" value={newOrder.customer_name} onChange={e => setNewOrder({ ...newOrder, customer_name: e.target.value })} />
          <Input label="Phone Number" value={newOrder.customer_phone} onChange={e => setNewOrder({ ...newOrder, customer_phone: e.target.value })} />
          <Textarea label="Address" value={newOrder.customer_address} onChange={e => setNewOrder({ ...newOrder, customer_address: e.target.value })} />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Fee (IDR)"
              type="text"
              value={newOrder.total_fee ? `Rp ${newOrder.total_fee.toLocaleString('id-ID')}` : ''}
              onChange={e => {
                const numericValue = Number(e.target.value.replace(/[^0-9]/g, ''));
                setNewOrder({ ...newOrder, total_fee: numericValue });
              }}
              placeholder="Rp 0"
            />
            <Input
              label="Estimated Delivery Time"
              type="datetime-local"
              value={newOrder.estimated_delivery_time}
              onChange={e => setNewOrder({ ...newOrder, estimated_delivery_time: e.target.value })}
            />

          </div>
          <Select
            label="Payment Status"
            value={newOrder.payment_status}
            onChange={e => setNewOrder({ ...newOrder, payment_status: e.target.value as any })}
            options={[
              { value: 'unpaid', label: 'Belum Setor' },
              { value: 'paid', label: 'Sudah Setor' }
            ]}
          />
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setIsCreateModalOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateOrder}>Create Order</Button>
          </div>
        </div>
      </Modal>

      {/* DETAIL / ASSIGN MODAL */}
      <Modal isOpen={isDetailModalOpen} onClose={() => setIsDetailModalOpen(false)} title="Order Details" size="lg">
        {selectedOrder && (
          <div className="space-y-6">
            {/* Header Info */}
            <div className="flex justify-between items-start bg-gray-50 p-4 rounded-lg">
              <div>
                <h3 className="text-xl font-bold text-gray-900">{selectedOrder.order_number}</h3>
                <p className="text-sm text-gray-500">Created {format(new Date(selectedOrder.created_at), 'PPp')}</p>
              </div>
              <Badge variant={getStatusBadgeVariant(selectedOrder.status)} size="md">{getStatusLabel(selectedOrder.status)}</Badge>
            </div>

            {/* Customer Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="space-y-3">
                  <h4 className="font-semibold flex items-center gap-2"><User className="w-4 h-4" /> Customer</h4>
                  {selectedOrder.status === 'pending' ? (
                    <div className="space-y-2">
                      <Input
                        label="Name"
                        value={editForm.customer_name}
                        onChange={e => setEditForm(prev => ({ ...prev, customer_name: e.target.value }))}
                      />
                      <Input
                        label="Phone"
                        value={editForm.customer_phone}
                        onChange={e => setEditForm(prev => ({ ...prev, customer_phone: e.target.value }))}
                      />
                    </div>
                  ) : (
                    <div className="pl-6 text-sm space-y-1">
                      <p><span className="text-gray-500 block">Name:</span> {selectedOrder.customer_name}</p>
                      <p><span className="text-gray-500 block">Phone:</span> {selectedOrder.customer_phone}</p>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <h4 className="font-semibold flex items-center gap-2 text-sm text-gray-700">Payment</h4>
                  {selectedOrder.status === 'pending' ? (
                    <div>
                      <Input
                        label="Total Fee"
                        value={editForm.total_fee ? `Rp ${editForm.total_fee.toLocaleString('id-ID')}` : ''}
                        onChange={e => {
                          const val = Number(e.target.value.replace(/[^0-9]/g, ''));
                          setEditForm(prev => ({ ...prev, total_fee: val }));
                        }}

                      />
                      <Select
                        label="Payment Status"
                        value={editForm.payment_status}
                        onChange={e => setEditForm(prev => ({ ...prev, payment_status: e.target.value as any }))}
                        options={[
                          { value: 'unpaid', label: 'Belum Setor' },
                          { value: 'paid', label: 'Sudah Setor' }
                        ]}
                      />
                      <div className="flex justify-end pt-2">
                        <Button size="sm" variant="secondary" onClick={handleSaveChanges}>Save Changes</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="pl-6 text-sm space-y-1">
                      <p><span className="text-gray-500 block">Total Fee:</span> {formatCurrency(selectedOrder.total_fee)}</p>
                      <p><span className="text-gray-500 block">Status:</span>
                        <Badge variant={selectedOrder.payment_status === 'paid' ? 'success' : 'warning'} size="sm">
                          {selectedOrder.payment_status === 'paid' ? 'SUDAH SETOR' : 'BELUM SETOR'}
                        </Badge>
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="font-semibold flex items-center gap-2"><MapPin className="w-4 h-4" /> Delivery</h4>
                {selectedOrder.status === 'pending' ? (
                  <Textarea
                    label="Address"
                    value={editForm.customer_address}
                    onChange={e => setEditForm(prev => ({ ...prev, customer_address: e.target.value }))}
                    rows={4}
                  />
                ) : (
                  <div className="pl-6 text-sm space-y-1">
                    <p className="whitespace-pre-wrap">{selectedOrder.customer_address}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Courier Assignment Section */}
            <div className="border-t pt-4">
              <h4 className="font-semibold flex items-center gap-2 mb-3"><Truck className="w-4 h-4" /> Courier Assignment</h4>
              {selectedOrder.status === 'pending' ? (
                <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100">
                  <label className="block text-sm font-medium text-indigo-900 mb-2">Assign to Available Courier (FIFO)</label>
                  <div className="flex gap-2">
                    <Select
                      className="flex-1"
                      placeholder="Select Courier..."
                      value={assignCourierId}
                      onChange={e => setAssignCourierId(e.target.value)}
                      options={availableCouriers.map(c => ({
                        value: c.id,
                        label: `${c.name} (${c.is_online ? 'Online' : 'Offline'})` // Queue position implicit by order
                      }))}
                    />
                    <Button disabled={!assignCourierId} onClick={handleAssign}>Assign</Button>
                  </div>
                  <p className="text-xs text-indigo-600 mt-2">
                    * Recommended: <strong>{availableCouriers[0]?.name || 'None available'}</strong> (First in Queue)
                  </p>
                </div>
              ) : (
                <div className="pl-6 text-sm">
                  <p><span className="text-gray-500">Assigned To:</span> {getCourierName(selectedOrder.courier_id)}</p>
                  {selectedOrder.assigned_at && <p><span className="text-gray-500">Time:</span> {format(new Date(selectedOrder.assigned_at), 'PPp')}</p>}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex justify-between items-center pt-4 border-t">
              <Button
                variant="ghost"
                className="text-red-500 hover:text-red-700 hover:bg-red-50"
                onClick={() => setIsCancelModalOpen(true)}
                disabled={['delivered', 'cancelled'].includes(selectedOrder.status)}
              >
                Cancel Order
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setIsDetailModalOpen(false)}>Close</Button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Cancel Confirmation */}
      <Modal isOpen={isCancelModalOpen} onClose={() => setIsCancelModalOpen(false)} title="Cancel Order">
        <div className="space-y-4">
          <p className="text-gray-600">Are you sure you want to cancel <strong>{selectedOrder?.order_number}</strong>?</p>
          <Textarea placeholder="Reason for cancellation..." value={cancelReason} onChange={e => setCancelReason(e.target.value)} />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsCancelModalOpen(false)}>Back</Button>
            <Button variant="danger" disabled={!cancelReason} onClick={handleCancel}>Confirm Cancel</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
