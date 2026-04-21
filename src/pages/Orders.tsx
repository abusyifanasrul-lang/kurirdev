import { useState, useMemo, useEffect, useRef } from 'react';
import { Plus, Download } from 'lucide-react';
import { formatLocal, getLocalNow } from '@/utils/date';
import { toPng } from 'html-to-image';

import {
  getCachedOrdersByRange,
  cacheOrdersByDate,
  getOrdersByDateRange,
  getUnpaidOrdersByCourier
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
import { CourierBadge } from '@/components/couriers/CourierBadge';
import { Pagination } from '@/components/ui/Pagination';

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

import { Capacitor } from '@capacitor/core'
import { Filesystem, Directory } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'

// Stores & Types
import { useOrderStore, type OrderState } from '@/stores/useOrderStore';
import { useCourierStore } from '@/stores/useCourierStore';
import { useUserStore } from '@/stores/useUserStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useCustomerStore } from '@/stores/useCustomerStore';
import { InvoiceTemplate } from '@/components/orders/InvoiceTemplate';
import { shareInvoiceNative } from '@/lib/invoiceUtils';
import { useToastStore } from '@/stores/useToastStore';
import { useAuth } from '@/context/AuthContext';
import type { Order, Customer } from '@/types';
import { calcAdminEarning } from '@/lib/calcEarning';

type SortField = 'order_number' | 'customer_name' | 'status' | 'courier_id' | 'payment_status' | 'total_fee' | 'created_at';
type SortOrder = 'asc' | 'desc';

export function Orders() {
  const orders = useOrderStore((state: OrderState) => state.orders);
  const activeOrdersByCourier = useOrderStore((state: OrderState) => state.activeOrdersByCourier);
  const fetchInitialOrders = useOrderStore((state: OrderState) => state.fetchInitialOrders);
  const fetchOrdersByDateRange = useOrderStore((state: OrderState) => state.fetchOrdersByDateRange);
  const addOrder = useOrderStore((state: OrderState) => state.addOrder);
  const assignCourier = useOrderStore((state: OrderState) => state.assignCourier);
  const cancelOrder = useOrderStore((state: OrderState) => state.cancelOrder);
  const updateOrder = useOrderStore((state: OrderState) => state.updateOrder);
  const settleOrder = useOrderStore((state: OrderState) => state.settleOrder);
  const { rotateQueue } = useCourierStore();
  const { users } = useUserStore();
  const { user } = useAuth();
  const { commission_rate, commission_threshold, commission_type, courier_instructions } = useSettingsStore();
  const { customers, upsertCustomer, addAddress, updateAddress, deleteAddress, findByPhone } = useCustomerStore();

  const isOpsAdmin = user?.role === 'admin_kurir' || user?.role === 'admin';
  const isFinance = user?.role === 'finance' || user?.role === 'admin';

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

  const getCourierName = (courierId?: string | null) => {
    if (!courierId) return '';
    const courier = users.find(u => u.id === courierId);
    return courier ? courier.name : '── Kurir Terhapus ──';
  };

  const getUserName = (userId?: string | null) => {
    if (!userId) return 'Unknown';
    const u = users.find(x => x.id === userId);
    return u ? u.name : 'User Terhapus';
  };

  const renderCourierCell = (courierId?: string) => {
    if (!courierId) return <span className="text-gray-400 italic">Unassigned</span>;
    const courier = users.find(u => u.id === courierId);
    if (!courier) return <span className="text-gray-400">── Kurir Terhapus ──</span>;
    return (
      <div className="flex items-center gap-2">
        <span>{courier.name}</span>
        <CourierBadge type={courier.vehicle_type} showLabel={false} className="border-none bg-transparent p-0" />
      </div>
    );
  };


  const allOrders = useMemo(() => {
    // Gabungkan: IndexedDB (pekan ini) +
    // Zustand (aktif)
    const map = new Map<string, Order>()

    // IndexedDB data (pekan ini, final)
    localDBOrders.forEach(o =>
      map.set(o.id, o)
    )

    // Zustand data (history, realtime updates)
    orders.forEach(o => map.set(o.id, o))
    
    // Zustand data (active, realtime updates)
    activeOrdersByCourier.forEach(o => map.set(o.id, o))

    // Cache data (dari filter tanggal manual)
    if (cacheStatus === 'loaded' &&
        cachedOrders.length > 0) {
      cachedOrders.forEach(o =>
        map.set(o.id, o)
      )
    }

    return Array.from(map.values())
  }, [orders, activeOrdersByCourier, localDBOrders,
      cachedOrders, cacheStatus])

  const calcPlatformFee = (order: Order) => {
    return calcAdminEarning(order, { commission_rate, commission_threshold, commission_type })
  }

  const [searchQuery, setSearchQuery] = useState('');
  const [searchCategory, setSearchCategory] = useState('all');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 40;
  
  const now = getLocalNow();
  const oneMonthAgo = new Date(now);
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

  const [dateFilter, setDateFilter] = useState({ 
    start: formatLocal(oneMonthAgo, 'yyyy-MM-dd'), 
    end: formatLocal(now, 'yyyy-MM-dd') 
  });

  const [sortConfig, setSortConfig] = useState<{ field: SortField; order: SortOrder }>({
    field: 'created_at',
    order: 'desc',
  });

  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [formError, setFormError] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [inlineEditAddrId, setInlineEditAddrId] = useState<string | null>(null);
  const [inlineEditValue, setInlineEditValue] = useState('');
  const [inlineNewAddr, setInlineNewAddr] = useState('');
  const [inlineAddingNew, setInlineAddingNew] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const invoiceRef = useRef<HTMLDivElement>(null);
  const [isGeneratingInvoice, setIsGeneratingInvoice] = useState(false);

  const filteredOrders = useMemo(() => {
    return allOrders
      .filter(order => {
        const matchesStatus = !statusFilter || order.status === statusFilter;

        // Gunakan date string WIB untuk perbandingan
        const orderLocalDate = (order as any)._date || formatLocal(order.created_at, 'yyyy-MM-dd');

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
            matchesSearch = order.customer_phone.toLowerCase().includes(searchQuery);
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

  const totalPages = Math.ceil(filteredOrders.length / ITEMS_PER_PAGE);
  const paginatedOrders = filteredOrders.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, searchCategory, statusFilter, dateFilter]);



  const availableCouriers = users
    .filter(u => u.role === 'courier' && u.is_active === true && u.is_online === true)
    .sort((a, b) => ((a as any).queue_position ?? 999) - ((b as any).queue_position ?? 999));

  const courierWaitingOrder = (courierId: string) =>
    activeOrdersByCourier.find(o => 
      o.courier_id === courierId && 
      o.is_waiting === true &&
      !['cancelled', 'delivered'].includes(o.status)
    );

  useEffect(() => {
    // 1. Initial Load from IndexedDB (Matching Default Filter)
    const loadInitialOrders = async () => {
      const start = formatLocal(oneMonthAgo, 'yyyy-MM-dd')
      const end = formatLocal(now, 'yyyy-MM-dd')
      const initialOrders = await getOrdersByDateRange(start, end)
      setLocalDBOrders(initialOrders)
    }
    loadInitialOrders()

    // 2. Initial Fetch to Zustand
    fetchInitialOrders()

    // Listen for manual syncs or background updates
    window.addEventListener('indexeddb-synced', loadInitialOrders)

    return () => {
      window.removeEventListener('indexeddb-synced', loadInitialOrders)
    }
  }, [fetchInitialOrders])

  // Create Order Form State
  const [newOrder, setNewOrder] = useState<Partial<Order>>({
    customer_name: '',
    customer_phone: '',
    customer_address: '',
    total_fee: 0,
    titik: 0,
    estimated_delivery_time: formatLocal(getLocalNow(), "yyyy-MM-dd'T'HH:mm"),
    items: [],
    notes: '',
  });

  const resetCreateOrderForm = () => {
    setNewOrder({
      customer_name: '',
      customer_phone: '',
      customer_address: '',
      total_fee: 0,
      titik: 0,
      estimated_delivery_time: formatLocal(getLocalNow(), "yyyy-MM-dd'T'HH:mm"),
      items: [],
      notes: '',
    });
    setSelectedCustomer(null);
    setFormError('');
    setInlineEditAddrId(null);
    setInlineAddingNew(false);
  };

  // Inline Address Editing State (for AddOrderModal)
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
        customer_id: customerId || null,
        customer_address_id: activeAddressId || null,
        total_fee: newOrder.total_fee || 0,
        titik: newOrder.titik ?? 0,
        status: 'pending',
        payment_status: newOrder.payment_status || 'unpaid',
        created_at: getLocalNow().toISOString(),
        updated_at: getLocalNow().toISOString(),
        created_by: user?.id || null,
        creator_name: user?.name || 'Admin',
      };

      await addOrder(orderData);
      setIsCreateModalOpen(false);
      resetCreateOrderForm();
    } catch (error) {
      setFormError('Gagal membuat order. Cek koneksi internet.');
    } finally {
      setIsCreating(false);
    }
  };



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
        await assignCourier(selectedOrder.id, courier.id, courier.name, user?.id || '', user?.name || 'Admin');
        await rotateQueue(courier.id);

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
      'Status', 'Kurir (Snapshot)', 'Ongkir',
      'Titik', 'Total Biaya Beban', 'Total Ongkir',
      'Nama Barang', 'Total Belanja', 'Total Dibayar Customer',
      'Status Bayar', 'Dibuat Oleh', 'Ditugaskan Oleh', 'Diverifikasi Oleh',
      'Jenis Cancel', 'Alasan Cancel', 'Dibatalkan Oleh',
      'Waktu Selesai', 'Waktu Cancel'
    ];

    const rows = filteredOrders.map(o => {
      const totalBiayaTitik = o.total_biaya_titik ?? 0;
      const totalBiayaBeban = o.total_biaya_beban ?? 0;
      const totalOngkir = (o.total_fee || 0) + totalBiayaTitik + totalBiayaBeban;

      const namaBarang = o.items && (o.items as any[]).length > 0
        ? (o.items as any[]).map((i: any) => `${i.nama} (Rp ${i.harga.toLocaleString('id-ID')})`).join(' | ')
        : o.item_name || '';
      const totalBelanja = o.items && (o.items as any[]).length > 0
        ? (o.items as any[]).reduce((s: number, i: any) => s + i.harga, 0)
        : (o.item_price ?? 0);
      const totalDibayar = totalOngkir + totalBelanja;

      const cancelTypeLabel =
        o.cancel_reason_type === 'customer' ? 'Dibatalkan customer' :
        o.cancel_reason_type === 'item_unavailable' ? 'Barang tidak tersedia' :
        o.cancel_reason_type === 'other' ? 'Lainnya' : '';

      return [
        q(o.order_number),
        q(formatLocal(o.created_at, 'dd/MM/yyyy HH:mm')),
        q(o.customer_name),
        q(o.customer_phone),
        q(o.customer_address),
        q(getStatusLabel(o.status)),
        q(o.courier_name || getCourierName(o.courier_id) || 'Belum Assign'),
        o.total_fee || 0,
        o.titik ?? 0,
        totalBiayaBeban,
        totalOngkir,
        q(namaBarang),
        totalBelanja > 0 ? totalBelanja : '',
        totalBelanja > 0 ? totalDibayar : totalOngkir,
        q(o.payment_status === 'paid' ? 'Sudah Setor' : 'Belum Setor'),
        q(o.creator_name || '-'),
        q(o.assigner_name || '-'),
        q(o.payment_confirmed_by_name || '-'),
        q(cancelTypeLabel),
        q(o.cancellation_reason || ''),
        q(o.canceller_name || '-'),
        q(o.actual_delivery_time ? formatLocal(o.actual_delivery_time, 'dd/MM/yyyy HH:mm') : ''),
        q(o.cancelled_at ? formatLocal(o.cancelled_at, 'dd/MM/yyyy HH:mm') : ''),
      ];
    });

    const BOM = '\uFEFF';
    const csvContent = BOM + [headers.join(DELIM), ...rows.map(r => r.join(DELIM))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `orders_export_${formatLocal(getLocalNow(), 'yyyyMMdd_HHmm')}.csv`;
    link.click();
  };

  const handlePrintInvoice = async (order: Order) => {
    if (!invoiceRef.current || isGeneratingInvoice) return;
    
    setIsGeneratingInvoice(true);
    const toastActions = {
      addToast: useToastStore.getState().addToast,
      removeToast: useToastStore.getState().removeToast,
      updateToast: useToastStore.getState().updateToast
    };

    await shareInvoiceNative(order, invoiceRef.current, toastActions);
    setIsGeneratingInvoice(false);
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

    const today = formatLocal(getLocalNow(), 'yyyy-MM-dd');
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
              <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => { resetCreateOrderForm(); setIsCreateModalOpen(true); }}>
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
            orders={paginatedOrders}
            onSelect={(order) => { setSelectedOrder(order); setIsOrderModalOpen(true); }}
            onSort={handleSort}
            sortField={sortConfig.field}
            sortOrder={sortConfig.order}
            getCourierName={renderCourierCell}
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
            orders={paginatedOrders}
            onSelect={(order) => { setSelectedOrder(order); setIsOrderModalOpen(true); }}
          />

          <Pagination 
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            totalItems={filteredOrders.length}
            itemsPerPage={ITEMS_PER_PAGE}
            className="mt-6"
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
        getCourierName={getCourierName}
        customers={customers}
        updateAddress={updateAddress}
        deleteAddress={deleteAddress}
        addAddress={addAddress}
        courierInstructions={courier_instructions}
        getUserName={getUserName}
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
        settleOrder={settleOrder}
        userId={user?.id || ''}
        userName={user?.name || ''}
        getInitialOrders={() => {
          const start = formatLocal(oneMonthAgo, 'yyyy-MM-dd')
          const end = formatLocal(now, 'yyyy-MM-dd')
          return getOrdersByDateRange(start, end)
        }}
        setLocalDBOrders={setLocalDBOrders}
        calcPlatformFee={calcPlatformFee}
      />

      {/* Hidden container for centralized html2canvas capture */}
      {selectedOrder && (
        <InvoiceTemplate order={selectedOrder} invoiceRef={invoiceRef} />
      )}
    </div>
  );
}
