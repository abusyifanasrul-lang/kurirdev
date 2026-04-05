import { useState, useMemo, useEffect } from 'react';
import { Plus, Download } from 'lucide-react';
import { formatWIB, getWIBNow } from '@/utils/date';

import {
  getCachedOrdersByRange,
  cacheOrdersByDate,
  getOrdersForWeek,
  getUnpaidOrdersByCourier,
  markAsPaidInLocalDB,
  getOrdersByDateRange
} from '@/lib/orderCache';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/Button';
import { getStatusLabel } from '@/components/ui/Badge';
import { lazy, Suspense } from 'react';

// Lazy-loaded Components
const OrderFilters = lazy(() => import('@/components/orders/OrderFilters').then(m => ({ default: m.OrderFilters })));
const OrderTable = lazy(() => import('@/components/orders/OrderTable').then(m => ({ default: m.OrderTable })));
const OrderListMobile = lazy(() => import('@/components/orders/OrderListMobile').then(m => ({ default: m.OrderListMobile })));

import { AddOrderModal } from '@/components/orders/modals/AddOrderModal';
import { OrderModal } from '@/components/orders/modals/OrderModal';
import { BulkSettleModal } from '@/components/orders/modals/BulkSettleModal';
import { CancelOrderModal } from '@/components/orders/modals/CancelOrderModal';

function OrdersLoading() {
  return (
    <div className="flex flex-col items-center justify-center py-20 animate-in fade-in duration-700">
      <div className="relative">
        <div className="w-12 h-12 border-4 border-teal-100 border-t-teal-600 rounded-full animate-spin" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-2 h-2 bg-teal-600 rounded-full animate-pulse" />
        </div>
      </div>
      <p className="mt-4 text-sm text-gray-400 font-medium tracking-wide">Menyiapkan daftar pesanan...</p>
    </div>
  );
}

// Stores & Types
import { useOrderStore } from '@/stores/useOrderStore';
import { useCourierStore } from '@/stores/useCourierStore';
import { useUserStore } from '@/stores/useUserStore';
import { useNotificationStore } from '@/stores/useNotificationStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useCustomerStore } from '@/stores/useCustomerStore';
import { useAuth } from '@/context/AuthContext';
import type { Order, Customer } from '@/types';

type SortField = 'order_number' | 'customer_name' | 'status' | 'courier_id' | 'payment_status' | 'total_fee' | 'created_at';
type SortOrder = 'asc' | 'desc';

export function Orders() {
  const { orders, fetchInitialOrders, subscribeOrders, fetchOrdersByDateRange, addOrder, assignCourier, cancelOrder, updateOrder } = useOrderStore();
  const { rotateQueue } = useCourierStore();
  const { users } = useUserStore();
  const { addNotification } = useNotificationStore();
  const { user } = useAuth(); // Current admin user
  const { commission_rate, commission_threshold, courier_instructions } = useSettingsStore();

  const isOpsAdmin = user?.role === 'admin_kurir' || user?.role === 'admin';
  const isFinance = user?.role === 'finance' || user?.role === 'admin' || user?.role === 'owner';

  // Cache State
  const [cacheStatus, setCacheStatus] = useState<'idle' | 'checking' | 'missing' | 'loading' | 'loaded'>('idle')
  const [missingDates, setMissingDates] = useState<string[]>([])
  const [cachedOrders, setCachedOrders] = useState<Order[]>([])

  // Bulk Settlement State
  const [showBulkSettle, setShowBulkSettle] = useState(false)
  const [bulkSettleCourierName, setBulkSettleCourierName] = useState<string>('')
  const [bulkUnpaidOrders, setBulkUnpaidOrders] = useState<Order[]>([])

  // Local DB State for weekly orders
  const [localDBOrders, setLocalDBOrders] = useState<Order[]>([])

  const getCourierName = (courierId?: string) => {
    if (!courierId) return null;
    const courier = users.find(u => u.id === courierId);
    if (!courier) return '── Kurir Terhapus ──';
    return courier.name;
  };


  const allOrders = useMemo(() => {
    // Gabungkan: IndexedDB (pekan ini) +
    // Zustand (aktif)
    const map = new Map<string, Order>()

    // IndexedDB data (pekan ini, final)
    localDBOrders.forEach(o =>
      map.set(o.id, o)
    )

    // Zustand data (aktif, realtime)
    // Override IndexedDB jika ada update
    orders.forEach(o => map.set(o.id, o))

    // Cache data (dari filter tanggal manual)
    if (cacheStatus === 'loaded' &&
        cachedOrders.length > 0) {
      cachedOrders.forEach(o =>
        map.set(o.id, o)
      )
    }

    return Array.from(map.values())
  }, [orders, localDBOrders,
      cachedOrders, cacheStatus])

  const calcPlatformFee = (order: Order) => {
    const rate = order.applied_commission_rate ?? commission_rate
    const threshold = order.applied_commission_threshold ?? commission_threshold
    if (order.total_fee <= threshold) return 0
    return order.total_fee * (1 - rate / 100)
  }

  const [searchQuery, setSearchQuery] = useState('');
  const [searchCategory, setSearchCategory] = useState('all');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [dateFilter, setDateFilter] = useState({ start: '', end: '' });

  const [sortConfig, setSortConfig] = useState<{ field: SortField; order: SortOrder }>({
    field: 'created_at',
    order: 'desc',
  });

  const filteredOrders = useMemo(() => {
    return allOrders
      .filter(order => {
        const matchesStatus = !statusFilter || order.status === statusFilter;

        // Gunakan date string WIB untuk perbandingan
        const orderLocalDate = (order as any)._date || formatWIB(order.created_at, 'yyyy-MM-dd');

        const matchesDateStart = !dateFilter.start ||
          orderLocalDate >= dateFilter.start
        const matchesDateEnd = !dateFilter.end ||
          orderLocalDate <= dateFilter.end

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
  }, [allOrders, searchQuery, searchCategory, statusFilter, dateFilter, sortConfig]);

  const handleSort = (field: SortField) => {
    setSortConfig(prev => ({
      field,
      order: prev.field === field && prev.order === 'asc' ? 'desc' : 'asc',
    }));
  };



  const availableCouriers = users
    .filter(u => u.role === 'courier' && u.is_active === true && u.is_online === true)
    .sort((a, b) => ((a as any).queue_position ?? 999) - ((b as any).queue_position ?? 999));

  const courierWaitingOrder = (courierId: string) =>
    allOrders.find(o => o.courier_id === courierId && o.is_waiting === true);

  useEffect(() => {
    // 1. Load from IndexedDB (Pekan ini)
    const loadWeekOrders = async () => {
      const weekOrders = await getOrdersForWeek()
      setLocalDBOrders(weekOrders)
    }
    loadWeekOrders()

    // 2. Initial Fetch to Zustand (Aktif)
    fetchInitialOrders()

    // Listen jika IndexedDB baru diisi
    window.addEventListener('indexeddb-synced', loadWeekOrders)

    return () => {
      window.removeEventListener('indexeddb-synced', loadWeekOrders)
    }
  }, [fetchInitialOrders])

  // Modal States
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  // Create Order Form State
  const [isCreating, setIsCreating] = useState(false);
  const [formError, setFormError] = useState('');
  const [newOrder, setNewOrder] = useState<Partial<Order>>({
    customer_name: '',
    customer_phone: '',
    customer_address: '',
    total_fee: 0,
    estimated_delivery_time: '',
    items: [],
    notes: '',
  });

  const { customers, upsertCustomer, addAddress, updateAddress, deleteAddress, findByPhone } = useCustomerStore();
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  // Inline Address Editing State (for AddOrderModal)
  const [inlineEditAddrId, setInlineEditAddrId] = useState<string | null>(null);
  const [inlineEditValue, setInlineEditValue] = useState('');
  const [inlineAddingNew, setInlineAddingNew] = useState(false);
  const [inlineNewAddr, setInlineNewAddr] = useState('');

  // Handlers
  const handleCreateOrder = async () => {
    const missing = [];
    if (!newOrder.customer_name?.trim())
      missing.push('Nama customer');
    if (!newOrder.customer_phone?.trim())
      missing.push('Nomor telepon');
    if (!newOrder.customer_address?.trim())
      missing.push('Alamat');
    if (missing.length > 0) {
      setFormError(`Wajib diisi: ${missing.join(', ')}`);
      return;
    }
    setFormError('');
    if (isCreating) return;
    setIsCreating(true);
    try {
      // Upsert Customer logic local state & storage
      let customerId = selectedCustomer?.id;
      const existingCustomer = findByPhone(newOrder.customer_phone || '');

      if (existingCustomer) {
        customerId = existingCustomer.id;
        const existingAddress = existingCustomer.addresses.find(a => a.address === newOrder.customer_address);
        if (!existingAddress) {
          await addAddress(customerId, {
            label: `Alamat ${existingCustomer.addresses.length + 1}`,
            address: newOrder.customer_address || '',
            is_default: existingCustomer.addresses.length === 0,
            notes: ''
          });
        }
      } else {
        const newCustomer = await upsertCustomer({
          name: newOrder.customer_name || '',
          phone: newOrder.customer_phone || '',
          addresses: [{
            id: crypto.randomUUID(),
            label: 'Alamat Utama',
            address: newOrder.customer_address || '',
            is_default: true,
            notes: ''
          }]
        });
        customerId = newCustomer.id;
      }

      // Re-fetch customer to get exact address ID if newly added
      let activeAddressId = '';
      const latestCustomer = useCustomerStore.getState().findByPhone(newOrder.customer_phone || '');
      if (latestCustomer) {
        const matchingAddr = latestCustomer.addresses.find(a => a.address === newOrder.customer_address);
        if (matchingAddr) {
          activeAddressId = matchingAddr.id;
        }
      }

      const orderData: any = {
        ...newOrder,
        customer_id: customerId,
        customer_address_id: activeAddressId,
        total_fee: newOrder.total_fee || 0,
        status: 'pending',
        payment_status: newOrder.payment_status || 'unpaid',
        created_at: getWIBNow().toISOString(),
        updated_at: getWIBNow().toISOString(),
        created_by: user?.id || "1",
      };

      await addOrder(orderData);
      setIsCreateModalOpen(false);
      setFormError('');
      setNewOrder({
        customer_name: '',
        customer_phone: '',
        customer_address: '',
        total_fee: 0,
        estimated_delivery_time: '',
        items: [],
        notes: '',
      });
    } catch (error) {
      setFormError('Gagal membuat order. Cek koneksi internet.');
    } finally {
      setIsCreating(false);
    }
  };

  const [isAssigning, setIsAssigning] = useState(false);

  const handleAssign = async (courierId: string, instructions?: string) => {
    if (!selectedOrder || !courierId || isAssigning) return;

    const courier = availableCouriers.find(c => c.id === courierId);
    if (courier) {
      setIsAssigning(true);
      try {
        // 1. Simpan instruksi (notes) ke order jika ada perubahan
        if (instructions !== undefined && instructions !== selectedOrder.notes) {
          await updateOrder(selectedOrder.id, { notes: instructions });
        }

        // 2. Lakukan assignment
        await assignCourier(selectedOrder.id, courier.id, courier.name, user?.id || "1", user?.name || 'Admin');
        await rotateQueue(courier.id);

        // 3. Persiapkan dan kirim notifikasi
        const finalNotes = (instructions || selectedOrder.notes || '').toLowerCase().trim();
        const selectedInstruction = courier_instructions.find(
          instruction => instruction.label.toLowerCase() === finalNotes
        );
        const emoji = selectedInstruction ? (selectedInstruction.icon || '📋') : '';
        const instruksi = selectedInstruction
          ? `${emoji} ${selectedInstruction.instruction}`
          : finalNotes
          ? `📋 ${finalNotes}`
          : 'Segera proses!';

        const customerName = selectedOrder.customer_name || 'Customer';
        const notifTitle = `🛵 Order Baru — ${selectedOrder.order_number}`;
        const notifBody = `${customerName} • ${instruksi}`;

        await addNotification({
          user_id: courier.id,
          user_name: courier.name,
          title: notifTitle,
          message: notifBody,
          data: { orderId: selectedOrder.id, type: 'order_assigned' },
        });

        setIsOrderModalOpen(false);
      } catch (error) {
        console.error("Assignment failed:", error);
      } finally {
        setIsAssigning(false);
      }
    }
  };

  const handleCancel = async () => {
    if (!selectedOrder) return;
    await cancelOrder(selectedOrder.id, cancelReason, user?.id || '', user?.name || 'Admin', 'admin');
    setIsCancelModalOpen(false);
    setIsOrderModalOpen(false);
    setCancelReason('');
  };

  const handleSaveChanges = async (updatedOrder: Partial<Order>, items: any[]) => {
    if (!selectedOrder) return;
    await updateOrder(selectedOrder.id, {
      ...updatedOrder,
      items: items
    });
    setSelectedOrder({
      ...selectedOrder,
      ...updatedOrder,
      items: items
    });
  };

  const handleExportCSV = () => {
    const DELIM = ';';
    const q = (val: any) => `"${String(val ?? '').replace(/"/g, '""')}"`;

    const headers = [
      'Order ID', 'Tanggal', 'Customer', 'Telepon', 'Alamat',
      'Status', 'Kurir', 'Ongkir',
      'Titik', 'Total Biaya Beban', 'Total Ongkir',
      'Nama Barang', 'Total Belanja', 'Total Dibayar Customer',
      'Status Bayar', 'Instruksi Admin',
      'Jenis Cancel', 'Alasan Cancel',
      'Waktu Selesai', 'Waktu Cancel'
    ];

    const rows = filteredOrders.map(o => {
      const totalBiayaTitik = o.total_biaya_titik ?? 0;
      const totalBiayaBeban = o.total_biaya_beban ?? 0;
      const totalOngkir = (o.total_fee || 0) + totalBiayaTitik + totalBiayaBeban;

      const namaBarang = o.items && o.items.length > 0
        ? o.items.map(i => `${i.nama} (Rp ${i.harga.toLocaleString('id-ID')})`).join(' | ')
        : o.item_name || '';
      const totalBelanja = o.items && o.items.length > 0
        ? o.items.reduce((s, i) => s + i.harga, 0)
        : (o.item_price ?? 0);
      const totalDibayar = totalOngkir + totalBelanja;

      const cancelTypeLabel =
        o.cancel_reason_type === 'customer' ? 'Dibatalkan customer' :
        o.cancel_reason_type === 'item_unavailable' ? 'Barang tidak tersedia' :
        o.cancel_reason_type === 'other' ? 'Lainnya' : '';

      return [
        q(o.order_number),
        q(formatWIB(o.created_at, 'dd/MM/yyyy HH:mm')),
        q(o.customer_name),
        q(o.customer_phone),
        q(o.customer_address),
        q(getStatusLabel(o.status)),
        q(getCourierName(o.courier_id) || 'Belum Assign'),
        o.total_fee || 0,
        o.titik ?? 0,
        totalBiayaBeban,
        totalOngkir,
        q(namaBarang),
        totalBelanja > 0 ? totalBelanja : '',
        totalBelanja > 0 ? totalDibayar : totalOngkir,
        q(o.payment_status === 'paid' ? 'Sudah Setor' : 'Belum Setor'),
        q(o.notes || ''),
        q(cancelTypeLabel),
        q(o.cancellation_reason || ''),
        q(o.actual_delivery_time ? formatWIB(o.actual_delivery_time, 'dd/MM/yyyy HH:mm') : ''),
        q(o.cancelled_at ? formatWIB(o.cancelled_at, 'dd/MM/yyyy HH:mm') : ''),
      ];
    });

    const BOM = '\uFEFF';
    const csvContent = BOM + [headers.join(DELIM), ...rows.map(r => r.join(DELIM))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `orders_export_${formatWIB(getWIBNow(), 'yyyyMMdd_HHmm')}.csv`;
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
          .brand { font-size: 22px; font-weight: 800; color: #0d9488; }
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
            <div class="order-meta">${formatWIB(order.created_at, 'dd MMM yyyy, HH:mm')}</div>
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

  const handleDateFilterChange = async (
    start: string, end: string
  ) => {
    setDateFilter({ start, end })

    if (!start && !end) {
      setCacheStatus('idle')
      setCachedOrders([])
      return
    }

    const today = formatWIB(getWIBNow(), 'yyyy-MM-dd');
    if (start === today || !start) {
      setCacheStatus('idle')
      setCachedOrders([])
      return
    }

    setCacheStatus('checking')
    try {
      const results = await getOrdersByDateRange(
        start, end || start
      )

      if (results.length > 0) {
        setCachedOrders(results as Order[])
        setCacheStatus('loaded')
      } else {
        setMissingDates([start])
        setCacheStatus('missing')
      }
    } catch (error) {
      console.error('Filter error:', error)
      setCacheStatus('missing')
    }
  }

  const handleFetchAndCache = async () => {
    setCacheStatus('loading')
    try {
      const start = new Date(dateFilter.start)
      const end = new Date(dateFilter.end)

      // Fetch dari Supabase
      await fetchOrdersByDateRange(start, end)

      // Ambil data terbaru langsung dari store
      // (bukan dari historicalOrders state
      // yang belum re-render)
      const freshOrders = useOrderStore
        .getState().historicalOrders

      // Simpan ke cache per tanggal
      for (const date of missingDates) {
        const dayOrders = freshOrders
          .filter(o =>
            o.created_at.startsWith(date)
          )
        await cacheOrdersByDate(date, dayOrders)
      }

      // Baca dari cache untuk konfirmasi
      const { orders: cached } =
        await getCachedOrdersByRange(
          dateFilter.start,
          dateFilter.end
        )
      setCachedOrders(cached)
      setCacheStatus('loaded')

    } catch (error) {
      console.error('Cache error:', error)
      setCacheStatus('missing')
    }
  }

  return (
    <div className="min-h-screen">
      <Header
        title="Orders"
        subtitle="Kelola semua pesanan"
        actions={
          <div className="flex gap-2">
            {isFinance && (
              <Button variant="outline" leftIcon={<Download className="h-4 w-4" />} onClick={handleExportCSV}>
                Export CSV
              </Button>
            )}
            {isOpsAdmin && (
              <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setIsCreateModalOpen(true)}>
                New Order
              </Button>
            )}
          </div>
        }
      />

      <div className="p-4 lg:p-8">
        {/* Records Count */}
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm text-gray-500">
            Menampilkan{' '}
            <span className="font-semibold text-gray-900">
              {filteredOrders.length}
            </span>
            {' '}order
            {filteredOrders.length !== allOrders.length && (
              <span className="text-gray-400">
                {' '}dari {allOrders.length} total
              </span>
            )}
          </p>
        </div>

        {/* Filters */}
        <Suspense fallback={<div className="h-32 bg-gray-50/50 animate-pulse rounded-xl mb-6" />}>
          <OrderFilters 
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            searchCategory={searchCategory}
            setSearchCategory={setSearchCategory}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            dateFilter={dateFilter}
            handleDateFilterChange={handleDateFilterChange}
          />
        </Suspense>

        {/* Cache Status UI */}
        {cacheStatus === 'missing' && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl">📦</span>
              <div className="flex-1">
                <p className="font-medium text-amber-800 text-sm">
                  Data belum tersimpan lokal
                </p>
                <p className="text-amber-700 text-xs mt-1">
                  {missingDates.length} hari belum di-cache
                </p>
                <p className="text-amber-600 text-xs mt-1">
                  Setelah diambil, data tersimpan permanen di perangkat ini.
                </p>
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <button
                onClick={handleFetchAndCache}
                className="flex-1 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 transition"
              >
                Ambil Data dari Server
              </button>
              <button
                onClick={() => {
                  setDateFilter({ start: '', end: '' })
                  setCacheStatus('idle')
                  setCachedOrders([])
                }}
                className="px-4 py-2 border border-amber-300 text-amber-700 text-sm rounded-lg"
              >
                Batal
              </button>
            </div>
          </div>
        )}

        {cacheStatus === 'loading' && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4 flex items-center gap-3">
            <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-blue-700 text-sm">
              Mengambil data dari server...
            </p>
          </div>
        )}

        {cacheStatus === 'loaded' && (
          <div className="flex items-center gap-2 text-xs text-gray-400 mb-3">
            <span>📦</span>
            <span>
              Data dari cache lokal ({cachedOrders.length} order)
            </span>
          </div>
        )}

        {/* Orders List (Desktop & Mobile) */}
        <Suspense fallback={<OrdersLoading />}>
          <OrderTable 
            orders={filteredOrders}
            onSelect={(order) => { setSelectedOrder(order); setIsOrderModalOpen(true); }}
            onSort={handleSort}
            sortField={sortConfig.field}
            sortOrder={sortConfig.order}
            getCourierName={getCourierName}
            isFinance={isFinance}
            onBulkSettle={async (order) => {
              const courierName = users.find(u => u.id === order.courier_id)?.name || 'Kurir'
              setBulkSettleCourierName(courierName)
              const unpaid = await getUnpaidOrdersByCourier(order.courier_id || '')
              setBulkUnpaidOrders(unpaid)
              setShowBulkSettle(true)
            }}
          />

          <OrderListMobile 
            orders={filteredOrders}
            onSelect={(order) => { setSelectedOrder(order); setIsOrderModalOpen(true); }}
          />
        </Suspense>
      </div>

      <AddOrderModal
        isOpen={isCreateModalOpen}
        onClose={() => { setIsCreateModalOpen(false); setFormError(''); setIsCreating(false); }}
        newOrder={newOrder}
        setNewOrder={setNewOrder}
        handleCreateOrder={handleCreateOrder}
        isCreating={isCreating}
        setIsCreating={setIsCreating}
        formError={formError}
        setFormError={setFormError}
        customers={customers}
        selectedCustomer={selectedCustomer}
        setSelectedCustomer={setSelectedCustomer}
        inlineEditAddrId={inlineEditAddrId}
        setInlineEditAddrId={setInlineEditAddrId}
        inlineEditValue={inlineEditValue}
        setInlineEditValue={setInlineEditValue}
        inlineAddingNew={inlineAddingNew}
        setInlineAddingNew={setInlineAddingNew}
        inlineNewAddr={inlineNewAddr}
        setInlineNewAddr={setInlineNewAddr}
        addAddress={addAddress}
        updateAddress={updateAddress}
        deleteAddress={deleteAddress}
      />

      <OrderModal
        isOpen={isOrderModalOpen}
        onClose={() => setIsOrderModalOpen(false)}
        order={selectedOrder}
        isOpsAdmin={isOpsAdmin}
        handleSaveChanges={handleSaveChanges}
        handleAssign={handleAssign}
        handlePrintInvoice={handlePrintInvoice}
        handleCancel={() => setIsCancelModalOpen(true)}
        availableCouriers={availableCouriers as any}
        courierWaitingOrder={courierWaitingOrder}
        getCourierName={getCourierName as any}
        customers={customers}
        updateAddress={updateAddress}
        deleteAddress={deleteAddress}
        addAddress={addAddress}
        courierInstructions={courier_instructions}
      />
      <CancelOrderModal
        isOpen={isCancelModalOpen}
        onClose={() => setIsCancelModalOpen(false)}
        order={selectedOrder}
        cancelReason={cancelReason}
        setCancelReason={setCancelReason}
        handleCancel={handleCancel}
      />

      <BulkSettleModal
        isOpen={showBulkSettle}
        onClose={() => setShowBulkSettle(false)}
        courierName={bulkSettleCourierName}
        unpaidOrders={bulkUnpaidOrders}
        updateOrder={updateOrder}
        markAsPaidInLocalDB={markAsPaidInLocalDB}
        getOrdersForWeek={getOrdersForWeek}
        setLocalDBOrders={setLocalDBOrders}
        calcPlatformFee={calcPlatformFee}
      />
    </div>
  );
}
