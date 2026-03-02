import { useState, useMemo, useEffect } from 'react';
import { Plus, Download, Search, Bell, ArrowUpDown, ChevronUp, ChevronDown, Printer } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { requestNotificationPermission, sendMockNotification } from '@/utils/notification';
import { sendPushNotification } from '@/services/notificationService';
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

type SortField = 'order_number' | 'customer_name' | 'status' | 'courier_id' | 'payment_status' | 'total_fee' | 'created_at';
type SortOrder = 'asc' | 'desc';

export function Orders() {
  const { orders, addOrder, assignCourier, cancelOrder, generateOrderId, updateOrder } = useOrderStore();
  const { rotateQueue } = useCourierStore();
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
    total_fee: 0,
    payment_status: 'unpaid',
    estimated_delivery_time: '',
    items: [] as { nama: string; harga: number }[],
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
  const [nameSuggestions, setNameSuggestions] = useState<Array<{ name: string, phone: string, address: string }>>([])
  const [showSuggestions, setShowSuggestions] = useState(false)

  const handleCustomerNameChange = (value: string) => {
    setNewOrder({ ...newOrder, customer_name: value })
    if (value.length >= 2) {
      const unique = new Map()
      orders
        .filter(o => o.customer_name.toLowerCase().includes(value.toLowerCase()))
        .forEach(o => {
          if (!unique.has(o.customer_name)) {
            unique.set(o.customer_name, {
              name: o.customer_name,
              phone: o.customer_phone,
              address: o.customer_address
            })
          }
        })
      setNameSuggestions(Array.from(unique.values()).slice(0, 5))
      setShowSuggestions(true)
    } else {
      setShowSuggestions(false)
    }
  }

  const handleSelectCustomer = (customer: { name: string, phone: string, address: string }) => {
    setNewOrder({ ...newOrder, customer_name: customer.name, customer_phone: customer.phone, customer_address: customer.address })
    setShowSuggestions(false)
  }

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

        let aValue: any = field === 'courier_id' ? getCourierName(a[field]) || '' : a[field] || '';
        let bValue: any = field === 'courier_id' ? getCourierName(b[field]) || '' : b[field] || '';

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

  const availableCouriers = users.filter(u =>
    u.role === 'courier' && u.is_active === true && u.is_online === true
  );

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
      id: crypto.randomUUID(),
      order_number: generateOrderId(),
      ...newOrder,
      total_fee: newOrder.total_fee || 0,
      status: 'pending',
      payment_status: newOrder.payment_status || 'unpaid',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      created_by: user?.id || "1",
    };

    addOrder(orderData);
    setIsCreateModalOpen(false);
    setNewOrder({
      customer_name: '',
      customer_phone: '',
      customer_address: '',
      total_fee: 0,
      estimated_delivery_time: '',
      items: [],
    });
  };

  const handleAssign = () => {
    if (!selectedOrder || !assignCourierId) return;

    const courier = availableCouriers.find(c => c.id === assignCourierId);
    if (courier) {
      assignCourier(selectedOrder.id, courier.id, courier.name, user?.id || "1", user?.name || 'Admin');
      rotateQueue(courier.id); // Validating FIFO logic

      // Send push notification to courier (non-blocking)
      const courierData = users.find(u => u.id === courier.id);
      if (courierData?.fcm_token) {
        sendPushNotification({
          token: courierData.fcm_token,
          title: 'Order Baru 🚀',
          body: `Order ${selectedOrder.order_number} - ${selectedOrder.customer_name} telah di-assign ke kamu`,
          data: { orderId: selectedOrder.id, type: 'order_assigned' }
        }).catch(console.error);
      }

      setIsDetailModalOpen(false);
      setAssignCourierId('');
    }
  };

  const handleCancel = () => {
    if (!selectedOrder) return;
    cancelOrder(selectedOrder.id, cancelReason, user?.id || "1", user?.name || 'Admin');
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

  const handlePrintInvoice = (order: Order) => {
    const titik = order.titik ?? 0;
    const beban = order.beban ?? [];
    const totalBiayaTitik = order.total_biaya_titik ?? 0;
    const totalBiayaBeban = order.total_biaya_beban ?? 0;
    const totalOngkir = (order.total_fee || 0) + totalBiayaTitik + totalBiayaBeban;
        const courierName = getCourierName(order.courier_id) || '-';

    const totalBelanja = (order.items && order.items.length > 0)
    ? order.items.reduce((s, i) => s + i.harga, 0)
    : (order.item_price ?? 0);

  const keteranganSection = (order.items && order.items.length > 0)
    ? `<div class="section">
        <div class="section-label">Daftar Belanja</div>
        ${order.items.map(item => `
          <div class="row">
            <span>${item.nama}</span>
            <span style="font-weight:600;">Rp ${item.harga.toLocaleString('id-ID')}</span>
          </div>
        `).join('')}
        <div class="row bold">
          <span>Total Belanja</span>
          <span>Rp ${totalBelanja.toLocaleString('id-ID')}</span>
        </div>
      </div>`
    : order.item_name
    ? `<div class="section">
        <div class="section-label">Barang</div>
        <div class="row">
          <span>${order.item_name}</span>
          ${order.item_price ? `<span style="font-weight:600;">Rp ${order.item_price.toLocaleString('id-ID')}</span>` : ''}
        </div>
      </div>`
    : '';

    const titikRows = titik > 0
      ? `<div style="padding:2px 0 2px 12px;color:#6b7280;font-size:12px;display:flex;justify-content:space-between;">
          <span>Titik Tambahan (${titik}x)</span><span>Rp ${totalBiayaTitik.toLocaleString('id-ID')}</span>
         </div>`
      : '';

    const bebanRows = beban.map(b =>
      `<div style="padding:2px 0 2px 12px;color:#6b7280;font-size:12px;display:flex;justify-content:space-between;">
        <span>• ${b.nama}</span><span>Rp ${b.biaya.toLocaleString('id-ID')}</span>
       </div>`
    ).join('');

    const printWindow = window.open('', '_blank', 'width=420,height=700');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>Invoice ${order.order_number}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; background: #fff; color: #111; }
          .invoice { width: 360px; margin: 0 auto; padding: 24px; }
          .header { text-align: center; padding-bottom: 12px; border-bottom: 2px solid #111; margin-bottom: 14px; }
          .brand { font-size: 22px; font-weight: 800; color: #4338ca; }
          .brand-sub { font-size: 10px; color: #6b7280; letter-spacing: 0.1em; text-transform: uppercase; margin-top: 2px; }
          .order-number { font-size: 15px; font-weight: 700; margin-top: 10px; }
          .order-meta { font-size: 11px; color: #6b7280; margin-top: 2px; }
          .section { margin-bottom: 14px; padding-bottom: 12px; border-bottom: 1px dashed #d1d5db; }
          .section-label { font-size: 9px; font-weight: 700; letter-spacing: 0.1em; color: #6b7280; text-transform: uppercase; margin-bottom: 8px; }
          .row { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px; color: #374151; }
          .row.sub { padding-left: 10px; color: #9ca3af; }
          .row.bold { font-weight: 700; font-size: 13px; color: #111; padding-top: 6px; margin-top: 4px; border-top: 1px solid #e5e7eb; margin-bottom: 0; }
          .total-box { background: #fef3c7; border-radius: 8px; padding: 10px 12px; margin-bottom: 16px; }
          .total-box .total-row { display: flex; justify-content: space-between; font-size: 15px; font-weight: 800; color: #92400e; }
          .total-box .total-sub { font-size: 9px; color: #b45309; margin-top: 3px; }
          .footer { text-align: center; font-size: 11px; color: #9ca3af; padding-top: 12px; border-top: 1px dashed #e5e7eb; }
          @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
        </style>
      </head>
      <body>
        <div class="invoice">

          <div class="header">
            <div class="brand">🛵 KurirDev</div>
            <div class="brand-sub">Invoice Pengiriman</div>
            <div class="order-number">${order.order_number}</div>
            <div class="order-meta">${format(parseISO(order.created_at), 'dd MMM yyyy, HH:mm')}</div>
            <div class="order-meta">Kurir: ${courierName}</div>
          </div>

          <div class="section">
            <div class="section-label">Kepada</div>
            <div style="font-weight:700;font-size:13px;margin-bottom:4px;">${order.customer_name}</div>
            <div style="color:#4b5563;font-size:12px;margin-bottom:2px;">${order.customer_address}</div>
            <div style="color:#4b5563;font-size:12px;">${order.customer_phone}</div>
          </div>

          ${keteranganSection}

          <div class="section">
            <div class="section-label">Biaya Pengiriman</div>
            <div class="row"><span>Ongkir</span><span>Rp ${(order.total_fee || 0).toLocaleString('id-ID')}</span></div>
            ${titikRows}
            ${bebanRows}
            <div class="row bold"><span>Total Ongkir</span><span>Rp ${totalOngkir.toLocaleString('id-ID')}</span></div>
          </div>

          ${totalBelanja > 0
            ? `<div class="total-box">
                <div class="total-row">
                  <span>TOTAL DIBAYAR</span>
                  <span>Rp ${(totalOngkir + totalBelanja).toLocaleString('id-ID')}</span>
                </div>
                <div class="total-sub">Ongkir + ${order.items && order.items.length > 0 ? 'Total Belanja' : 'Harga Barang'}</div>
              </div>`
            : ''
          }

          <div class="footer">Terima kasih telah menggunakan layanan KurirDev 🙏</div>

        </div>
        <script>window.onload = () => { window.print(); window.onafterprint = () => window.close(); }<\/script>
      </body>
      </html>
    `);
    printWindow.document.close();
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
                  onClick={() => handleSort('courier_id')}
                >
                  <div className="flex items-center">Courier {getSortIcon('courier_id')}</div>
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
          <div className="relative">
            <Input label="Customer Name" value={newOrder.customer_name} onChange={e => handleCustomerNameChange(e.target.value)} />
            {showSuggestions && nameSuggestions.length > 0 && (
              <div className="absolute z-50 w-full bg-white border border-gray-200 rounded-lg shadow-lg mt-1">
                {nameSuggestions.map((c, i) => (
                  <button key={i} type="button" onClick={() => handleSelectCustomer(c)}
                    className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b last:border-0">
                    <p className="font-medium text-gray-900">{c.name}</p>
                    <p className="text-sm text-gray-500">{c.phone}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
          <Input label="Phone Number" value={newOrder.customer_phone} onChange={e => setNewOrder({ ...newOrder, customer_phone: e.target.value })} />
          <Textarea label="Address" value={newOrder.customer_address} onChange={e => setNewOrder({ ...newOrder, customer_address: e.target.value })} />
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700">Daftar Barang (opsional)</p>
            {(newOrder.items || []).length > 0 && (
              <div className="space-y-1">
                {(newOrder.items || []).map((item, i) => (
                  <div key={i} className="flex items-center justify-between bg-gray-50 px-3 py-1.5 rounded-lg text-sm">
                    <span className="text-gray-800">{item.nama}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-600">Rp {item.harga.toLocaleString('id-ID')}</span>
                      <button
                        type="button"
                        onClick={() => setNewOrder({ ...newOrder, items: (newOrder.items || []).filter((_, idx) => idx !== i) })}
                        className="text-gray-400 hover:text-red-500"
                      >✕</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Nama barang"
                id="new_item_nama"
                className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400"
              />
              <input
                type="text"
                inputMode="numeric"
                placeholder="Harga (Rp)"
                id="new_item_harga"
                className="w-32 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400"
              />
              <button
                type="button"
                onClick={() => {
                  const namaEl = document.getElementById('new_item_nama') as HTMLInputElement;
                  const hargaEl = document.getElementById('new_item_harga') as HTMLInputElement;
                  const nama = namaEl?.value.trim();
                  const harga = Number((hargaEl?.value || '').replace(/[^0-9]/g, ''));
                  if (!nama) return;
                  setNewOrder({ ...newOrder, items: [...(newOrder.items || []), { nama, harga }] });
                  if (namaEl) namaEl.value = '';
                  if (hargaEl) hargaEl.value = '';
                }}
                className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg font-medium"
              >+ Tambah</button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Fee Ongkir"
              type="text"
              value={newOrder.total_fee !== undefined ? `Rp ${newOrder.total_fee.toLocaleString('id-ID')}` : ''}
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
      <Modal isOpen={isDetailModalOpen} onClose={() => setIsDetailModalOpen(false)} title="Order Details" size="md">
        {selectedOrder && (
          <div className="space-y-3">
            {/* Header - compact */}
            <div className="flex justify-between items-center bg-gray-50 px-3 py-2 rounded-lg">
              <div>
                <span className="text-base font-bold text-gray-900">{selectedOrder.order_number}</span>
                <span className="text-xs text-gray-400 ml-2">{format(new Date(selectedOrder.created_at), 'dd MMM yy, HH:mm')}</span>
              </div>
              <Badge variant={getStatusBadgeVariant(selectedOrder.status)} size="sm">{getStatusLabel(selectedOrder.status)}</Badge>
            </div>

            {/* Customer + Payment — compact info */}
            {selectedOrder.status === 'pending' ? (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
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
                <Textarea
                  label="Address"
                  value={editForm.customer_address}
                  onChange={e => setEditForm(prev => ({ ...prev, customer_address: e.target.value }))}
                  rows={2}
                />
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    label="Fee"
                    value={editForm.total_fee ? `Rp ${editForm.total_fee.toLocaleString('id-ID')}` : ''}
                    onChange={e => {
                      const val = Number(e.target.value.replace(/[^0-9]/g, ''));
                      setEditForm(prev => ({ ...prev, total_fee: val }));
                    }}
                  />
                  <Select
                    label="Setoran"
                    value={editForm.payment_status}
                    onChange={e => setEditForm(prev => ({ ...prev, payment_status: e.target.value as any }))}
                    options={[
                      { value: 'unpaid', label: 'Belum Setor' },
                      { value: 'paid', label: 'Sudah Setor' }
                    ]}
                  />
                </div>
                <div className="flex justify-end">
                  <Button size="sm" variant="secondary" onClick={handleSaveChanges}>Save Changes</Button>
                </div>
              </div>
            ) : (
              <div className="text-sm space-y-1.5">
                <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                  <span className="text-gray-400">Customer</span>
                  <span className="font-medium text-gray-900">{selectedOrder.customer_name}</span>
                  <span className="text-gray-400">Phone</span>
                  <span>{selectedOrder.customer_phone}</span>
                  <span className="text-gray-400">Address</span>
                  <span className="whitespace-pre-wrap">{selectedOrder.customer_address}</span>
                  <span className="text-gray-400">Fee</span>
                  <span className="font-medium">{formatCurrency(selectedOrder.total_fee)}</span>
                  {((selectedOrder.items && selectedOrder.items.length > 0) || selectedOrder.item_name) && (
                    <>
                      <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Daftar Barang</span>
                      {(selectedOrder.items && selectedOrder.items.length > 0) ? (
                        <div className="space-y-0.5">
                          {selectedOrder.items.map((item, i) => (
                            <div key={i} className="flex justify-between text-sm">
                              <span className="text-gray-800">{item.nama}</span>
                              <span className="text-gray-600 font-medium">Rp {item.harga.toLocaleString('id-ID')}</span>
                            </div>
                          ))}
                          <div className="flex justify-between text-sm font-semibold border-t border-gray-100 pt-1 mt-1">
                            <span className="text-gray-700">Total Belanja</span>
                            <span className="text-gray-800">Rp {selectedOrder.items.reduce((s, i) => s + i.harga, 0).toLocaleString('id-ID')}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-800">{selectedOrder.item_name || '-'}</span>
                          <span className="text-gray-600 font-medium">{selectedOrder.item_price ? `Rp ${selectedOrder.item_price.toLocaleString('id-ID')}` : '-'}</span>
                        </div>
                      )}
                    </>
                  )}
                  <span className="text-gray-400">Setoran</span>
                  <span>
                    <Badge variant={selectedOrder.payment_status === 'paid' ? 'success' : 'warning'} size="sm">
                      {selectedOrder.payment_status === 'paid' ? 'Sudah Setor' : 'Belum Setor'}
                    </Badge>
                  </span>
                </div>
              </div>
            )}

            {/* Courier Assignment — compact */}
            <div className="border-t pt-2">
              {selectedOrder.status === 'pending' ? (
                <div className="bg-indigo-50 px-3 py-2 rounded-lg border border-indigo-100">
                  <label className="block text-xs font-medium text-indigo-900 mb-1.5">Assign Courier (FIFO)</label>
                  <div className="flex gap-2">
                    <Select
                      className="flex-1"
                      placeholder="Select Courier..."
                      value={assignCourierId}
                      onChange={e => setAssignCourierId(e.target.value)}
                      options={availableCouriers.map(c => ({
                        value: c.id,
                        label: `${c.name} (${c.is_online ? 'Online' : 'Offline'})`
                      }))}
                    />
                    <Button disabled={!assignCourierId} onClick={handleAssign}>Assign</Button>
                  </div>
                  {availableCouriers[0] && (
                    <p className="text-xs text-indigo-600 mt-1">
                      Recommended: <strong>{availableCouriers[0].name}</strong>
                    </p>
                  )}
                </div>
              ) : (
                <div className="text-sm grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                  <span className="text-gray-400">Courier</span>
                  <span className="font-medium">{getCourierName(selectedOrder.courier_id)}</span>
                  {selectedOrder.assigned_at && (
                    <>
                      <span className="text-gray-400">Assigned</span>
                      <span>{format(new Date(selectedOrder.assigned_at), 'dd MMM yy, HH:mm')}</span>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Rincian Biaya Tambahan */}
            {selectedOrder.status !== 'pending' && ((selectedOrder.titik ?? 0) > 0 || (selectedOrder.beban ?? []).length > 0) && (
              <div className="border-t pt-2 text-sm space-y-1">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Rincian Biaya</p>
                <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                  <span className="text-gray-400">Ongkir</span>
                  <span>{formatCurrency(selectedOrder.total_fee)}</span>
                  {(selectedOrder.titik ?? 0) > 0 && (
                    <>
                      <span className="text-gray-400">Titik ({selectedOrder.titik}x)</span>
                      <span>{formatCurrency(selectedOrder.total_biaya_titik ?? 0)}</span>
                    </>
                  )}
                  {(selectedOrder.beban ?? []).map((b, i) => (
                    <>
                      <span key={`beban-name-${i}`} className="text-gray-400 pl-2">• {b.nama}</span>
                      <span key={`beban-val-${i}`}>{formatCurrency(b.biaya)}</span>
                    </>
                  ))}
                  <span className="text-gray-700 font-semibold border-t pt-1 mt-0.5">Total Ongkir</span>
                  <span className="font-semibold text-gray-900 border-t pt-1 mt-0.5">
                    {formatCurrency(
                      (selectedOrder.total_fee || 0) +
                      (selectedOrder.total_biaya_titik ?? 0) +
                      (selectedOrder.total_biaya_beban ?? 0)
                    )}
                  </span>
                  {((selectedOrder.items && selectedOrder.items.length > 0) || (selectedOrder.item_price ?? 0) > 0) && (
                    <>
                      <span className="text-amber-800 font-bold border-t pt-1 mt-0.5">Total Dibayar Customer</span>
                      <span className="font-bold text-amber-800 border-t pt-1 mt-0.5">
                        {formatCurrency(
                          (selectedOrder.total_fee || 0) +
                          (selectedOrder.total_biaya_titik ?? 0) +
                          (selectedOrder.total_biaya_beban ?? 0) +
                          ((selectedOrder.items && selectedOrder.items.length > 0)
                            ? selectedOrder.items.reduce((s, i) => s + i.harga, 0)
                            : (selectedOrder.item_price ?? 0))
                        )}
                      </span>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Actions — compact */}
            <div className="flex justify-between items-center pt-2 border-t">
              <Button
                variant="ghost"
                size="sm"
                className="text-red-500 hover:text-red-700 hover:bg-red-50"
                onClick={() => setIsCancelModalOpen(true)}
                disabled={['delivered', 'cancelled'].includes(selectedOrder.status)}
              >
                Cancel Order
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<Printer className="h-3.5 w-3.5" />}
                  onClick={() => handlePrintInvoice(selectedOrder)}
                >
                  Print Invoice
                </Button>
                <Button variant="outline" size="sm" onClick={() => setIsDetailModalOpen(false)}>
                  Close
                </Button>
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
