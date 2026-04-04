import { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { useSEO } from '@/hooks/useSEO';
import { ArrowLeft, Package, Clock, CheckCircle, XCircle, Search } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { format, isToday, isYesterday, parseISO } from 'date-fns';
import { Badge } from '@/components/ui/Badge';
import { useAuth } from '@/context/AuthContext';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { calcCourierEarning } from '@/lib/calcEarning';
import { getOrdersByCourierFromLocal } from '@/lib/orderCache';
import { X } from 'lucide-react';
import { Order } from '@/types';

type StatusFilter = 'all' | 'delivered' | 'cancelled';

const statusConfig: Record<string, { color: string; bg: string; icon: typeof CheckCircle; label: string }> = {
  delivered: { color: 'text-teal-600', bg: 'bg-teal-50', icon: CheckCircle, label: '✅ CEKLIS — Terkirim' },
  cancelled: { color: 'text-red-600', bg: 'bg-red-50', icon: XCircle, label: '❌ CANCEL — Dibatalkan' },
  in_transit: { color: 'text-emerald-600', bg: 'bg-emerald-50', icon: Package, label: 'GAS — Customer' },
  picked_up: { color: 'text-orange-600', bg: 'bg-orange-50', icon: Package, label: 'GAS — Penjual' },
  assigned: { color: 'text-teal-700', bg: 'bg-teal-50', icon: Clock, label: 'Order Diterima' },
  pending: { color: 'text-gray-600', bg: 'bg-gray-50', icon: Clock, label: 'Menunggu Kurir' },
};

export function CourierHistory() {
  useSEO({
    title: 'Order History',
    description: 'Track your past deliveries, historical earnings, and synchronization logs.'
  });
  const navigate = useNavigate();
  const location = useLocation();
  const highlightOrderId = (location.state as any)?.highlightOrderId;

  useEffect(() => {
    if (!highlightOrderId) return;
    const el = document.getElementById(`order-${highlightOrderId}`);
    if (!el) return;
    setTimeout(() => {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-2', 'ring-yellow-400', 'ring-offset-2');
      setTimeout(() => el.classList.remove('ring-2', 'ring-yellow-400', 'ring-offset-2'), 2000);
    }, 300);
  }, [highlightOrderId]);

  const { user } = useAuth();

  const { commission_rate, commission_threshold } = useSettingsStore()
  const earningSettings = { commission_rate, commission_threshold }

  // State lokal — diisi dari IndexedDB
  const [courierOrders, setCourierOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const invoiceRef = useRef<HTMLDivElement>(null);

  // Fungsi load data dari IndexedDB
  const loadFromLocalDB = useCallback(async () => {
    if (!user?.id) return;
    try {
      const orders = await getOrdersByCourierFromLocal(user.id);
      setCourierOrders(orders);
    } catch (err) {
      console.error('Load from local DB error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  // Load saat mount
  useEffect(() => {
    loadFromLocalDB();
  }, [loadFromLocalDB]);

  // Refresh otomatis saat sync selesai
  useEffect(() => {
    const handler = () => loadFromLocalDB();
    window.addEventListener('indexeddb-synced', handler);
    return () => window.removeEventListener('indexeddb-synced', handler);
  }, [loadFromLocalDB]);

  const handleBagikanInvoice = async () => {
    if (!invoiceRef.current) return;
    const { default: html2canvas } = await import('html2canvas')
    const canvas = await html2canvas(invoiceRef.current, { scale: 2, useCORS: true });
    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `Invoice-${selectedOrder?.order_number}.png`;
    link.href = dataUrl;
    link.click();
  };

  // Group orders by date
  const groupedOrders = useMemo(() => {
    const groups: Record<string, typeof courierOrders> = {};
    courierOrders.forEach((order) => {
      const date = format(parseISO(order.created_at), 'yyyy-MM-dd');
      if (!groups[date]) groups[date] = [];
      groups[date].push(order);
    });
    return groups;
  }, [courierOrders]);

  const getDateLabel = (dateStr: string) => {
    const date = parseISO(dateStr);
    if (isToday(date)) return 'Hari Ini';
    if (isYesterday(date)) return 'Kemarin';
    return format(date, 'dd MMMM yyyy');
  };

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val);

  const totalEarnings = useMemo(() => {
    return courierOrders
      .filter((o) => o.status === 'delivered')
      .reduce((sum, o) => sum + calcCourierEarning(o, earningSettings), 0);
  }, [courierOrders, user]);

  if (isLoading && courierOrders.length === 0) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Memuat riwayat...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="flex items-center gap-3 p-4">
          <button onClick={() => navigate('/courier')} className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-gray-900">Riwayat Pengiriman</h1>
            <p className="text-xs text-gray-500">
              {courierOrders.length} riwayat • {formatCurrency(totalEarnings)} total pendapatan
            </p>
          </div>
        </div>

        {/* Search & Filter */}
        <div className="px-4 pb-3 flex gap-2">
          <div className="flex-1 relative">
            <label htmlFor="order-search" className="sr-only">Cari pesanan</label>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              id="order-search"
              type="text"
              placeholder="Cari pesanan..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <label htmlFor="status-filter" className="sr-only">Filter status</label>
          <select
            id="status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            <option value="all">Semua</option>
            <option value="delivered">✅ CEKLIS — Terkirim</option>
            <option value="cancelled">❌ CANCEL — Dibatalkan</option>
          </select>
        </div>
      </div>

      {/* Order List */}
      <div className="p-4 space-y-4">
        {Object.keys(groupedOrders).length === 0 ? (
          <div className="text-center py-16">
            <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">Belum ada riwayat pengiriman</p>
            <p className="text-sm text-gray-400 mt-1">Pesanan yang dikirim akan muncul di sini</p>
          </div>
        ) : (
          Object.entries(groupedOrders).map(([date, dateOrders]) => (
            <div key={date}>
              <h3 className="text-sm font-semibold text-gray-500 mb-2 px-1">{getDateLabel(date)}</h3>
              <div className="space-y-2">
                {dateOrders.map((order) => {
                  const config = statusConfig[order.status] || statusConfig.pending;
                  const StatusIcon = config.icon;
                  const courierEarning = order.status === 'delivered' ? calcCourierEarning(order, earningSettings) : 0;

                  return (
                    <div
                      key={order.id}
                      id={`order-${order.id}`}
                      onClick={() => order.status === 'delivered' ? setSelectedOrder(order) : navigate(`/courier/orders/${order.id}`)}
                      className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 cursor-pointer hover:shadow-md transition-all duration-300"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-semibold text-gray-900 text-sm">{order.order_number}</p>
                          <p className="text-xs text-gray-500">{format(parseISO(order.created_at), 'HH:mm')}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.bg} ${config.color}`}>
                            <StatusIcon className="w-3 h-3" />
                            {config.label}
                          </div>
                          {order.status === 'delivered' && (
                            <Badge variant={order.payment_status === 'paid' ? 'success' : 'warning'} size="sm">
                              {order.payment_status === 'paid' ? 'Sudah Setor' : 'Belum Setor'}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm text-gray-700">{order.customer_name}</p>
                        <p className="text-xs text-gray-500 line-clamp-1">{order.customer_address}</p>
                      </div>
                      <div className="flex justify-between items-center mt-3 pt-2 border-t border-gray-50">
                        <span className="text-xs text-gray-500">Total Fee: {formatCurrency(order.total_fee)}</span>
                        {courierEarning > 0 && (
                          <span className="text-sm font-semibold text-teal-600">+{formatCurrency(courierEarning)}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal Invoice */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-xl">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <h3 className="font-bold text-gray-900 text-sm">Invoice {selectedOrder.order_number}</h3>
              <button onClick={() => setSelectedOrder(null)} className="p-1 hover:bg-gray-100 rounded-full">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <div className="p-4 max-h-[60vh] overflow-y-auto">
              {/* Preview Invoice */}
              <div className="text-xs space-y-0 text-gray-700">
                <div className="text-center pb-3 border-b-2 border-gray-900 mb-3">
                  <p className="font-extrabold text-teal-700 text-lg">🛵 KurirDev</p>
                  <p className="text-gray-500 text-[10px] tracking-widest uppercase">Invoice Pengiriman</p>
                  <p className="font-bold text-gray-900 text-sm mt-2">{selectedOrder.order_number}</p>
                  <p className="text-gray-500 mt-0.5">{format(parseISO(selectedOrder.created_at), 'dd MMM yyyy, HH:mm')}</p>
                  <p className="text-gray-500">Kurir: {user?.name}</p>
                </div>
                <div className="pb-3 border-b border-dashed border-gray-300 mb-3">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">Kepada</p>
                  <p className="font-bold text-gray-900">{selectedOrder.customer_name}</p>
                  <p className="text-gray-500 mt-0.5">{selectedOrder.customer_address}</p>
                  <p className="text-gray-500">{selectedOrder.customer_phone}</p>
                </div>
                {(selectedOrder.items && selectedOrder.items.length > 0) && (
                  <div className="pb-3 border-b border-dashed border-gray-300 mb-3">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">Daftar Belanja</p>
                    {selectedOrder.items.map((item, i) => (
                      <div key={i} className="flex justify-between py-0.5">
                        <span className="text-gray-700">{item.nama}</span>
                        <span className="font-semibold text-gray-900">Rp {item.harga.toLocaleString('id-ID')}</span>
                      </div>
                    ))}
                    <div className="flex justify-between pt-1.5 mt-1 border-t border-gray-200 font-bold">
                      <span className="text-gray-700">Total Belanja</span>
                      <span className="text-gray-900">Rp {selectedOrder.items.reduce((s, i) => s + i.harga, 0).toLocaleString('id-ID')}</span>
                    </div>
                  </div>
                )}
                {(!selectedOrder.items || selectedOrder.items.length === 0) && selectedOrder.item_name && (
                  <div className="pb-3 border-b border-dashed border-gray-300 mb-3">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">Barang</p>
                    <div className="flex justify-between">
                      <span className="text-gray-700">{selectedOrder.item_name}</span>
                      {(selectedOrder.item_price ?? 0) > 0 && <span className="font-semibold text-gray-900">Rp {(selectedOrder.item_price ?? 0).toLocaleString('id-ID')}</span>}
                    </div>
                  </div>
                )}
                <div className="pb-3 mb-3">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">Biaya Pengiriman</p>
                  <div className="flex justify-between py-0.5">
                    <span className="text-gray-500">Ongkir</span>
                    <span>Rp {(selectedOrder.total_fee || 0).toLocaleString('id-ID')}</span>
                  </div>
                  {(selectedOrder.titik ?? 0) > 0 && Array.from({ length: selectedOrder.titik! }).map((_, i) => (
                    <div key={i} className="flex justify-between py-0.5 pl-2">
                      <span className="text-gray-400">• Titik {i + 1}</span>
                      <span>Rp 3.000</span>
                    </div>
                  ))}
                  {(selectedOrder.beban ?? []).map((b, i) => (
                    <div key={i} className="flex justify-between py-0.5 pl-2">
                      <span className="text-gray-400">• {b.nama}</span>
                      <span>Rp {b.biaya.toLocaleString('id-ID')}</span>
                    </div>
                  ))}
                  <div className="flex justify-between pt-1.5 mt-1 border-t border-gray-200 font-bold text-sm">
                    <span>Total Ongkir</span>
                    <span>Rp {((selectedOrder.total_fee || 0) + (selectedOrder.total_biaya_titik ?? 0) + (selectedOrder.total_biaya_beban ?? 0)).toLocaleString('id-ID')}</span>
                  </div>
                </div>
                {(selectedOrder.items && selectedOrder.items.length > 0) && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    <div className="flex justify-between font-extrabold text-sm text-amber-800">
                      <span>TOTAL DIBAYAR</span>
                      <span>Rp {((selectedOrder.total_fee || 0) + (selectedOrder.total_biaya_titik ?? 0) + (selectedOrder.total_biaya_beban ?? 0) + selectedOrder.items.reduce((s, i) => s + i.harga, 0)).toLocaleString('id-ID')}</span>
                    </div>
                    <p className="text-[9px] text-amber-600 mt-1">Ongkir + Total Belanja</p>
                  </div>
                )}
                {(!selectedOrder.items || selectedOrder.items.length === 0) && (selectedOrder.item_price ?? 0) > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    <div className="flex justify-between font-extrabold text-sm text-amber-800">
                      <span>TOTAL DIBAYAR</span>
                      <span>Rp {((selectedOrder.total_fee || 0) + (selectedOrder.total_biaya_titik ?? 0) + (selectedOrder.total_biaya_beban ?? 0) + (selectedOrder.item_price ?? 0)).toLocaleString('id-ID')}</span>
                    </div>
                    <p className="text-[9px] text-amber-600 mt-1">Ongkir + Harga Barang</p>
                  </div>
                )}
                <div className="text-center text-gray-400 text-[10px] pt-3 mt-2 border-t border-dashed border-gray-200">
                  Terima kasih telah menggunakan layanan KurirDev 🙏
                </div>
              </div>
            </div>
            <div className="px-4 py-3 border-t">
              <button
                onClick={handleBagikanInvoice}
                className="w-full py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2"
              >
                📸 Bagikan Invoice ke Customer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invoice tersembunyi untuk di-capture */}
      {selectedOrder && (
        <div style={{ position: 'fixed', left: '-9999px', top: '0' }}>
          <div ref={invoiceRef} style={{ background: '#ffffff', padding: '24px', width: '320px', fontFamily: 'Arial, sans-serif', fontSize: '12px', color: '#111827' }}>

            {/* Header */}
            <div style={{ textAlign: 'center', paddingBottom: '12px', borderBottom: '2px solid #111827', marginBottom: '14px' }}>
              <div style={{ fontSize: '20px', fontWeight: '800', color: '#0f766e' }}>🛵 KurirDev</div>
              <div style={{ fontSize: '10px', color: '#6b7280', letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: '2px' }}>Invoice Pengiriman</div>
              <div style={{ fontSize: '14px', fontWeight: '700', color: '#111827', marginTop: '10px' }}>{selectedOrder.order_number}</div>
              <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>{format(parseISO(selectedOrder.created_at), 'dd MMM yyyy, HH:mm')}</div>
              <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '1px' }}>Kurir: {user?.name}</div>
            </div>

            {/* Kepada */}
            <div style={{ paddingBottom: '12px', borderBottom: '1px dashed #d1d5db', marginBottom: '14px' }}>
              <div style={{ fontSize: '9px', fontWeight: '700', letterSpacing: '0.1em', color: '#6b7280', textTransform: 'uppercase', marginBottom: '6px' }}>Kepada</div>
              <div style={{ fontWeight: '700', fontSize: '13px', color: '#111827' }}>{selectedOrder.customer_name}</div>
              <div style={{ color: '#4b5563', marginTop: '2px', lineHeight: '1.5' }}>{selectedOrder.customer_address}</div>
              <div style={{ color: '#4b5563', marginTop: '2px' }}>{selectedOrder.customer_phone}</div>
            </div>

            {/* Daftar Belanja — format baru */}
            {(selectedOrder.items && selectedOrder.items.length > 0) && (
              <div style={{ paddingBottom: '12px', borderBottom: '1px dashed #d1d5db', marginBottom: '14px' }}>
                <div style={{ fontSize: '9px', fontWeight: '700', letterSpacing: '0.1em', color: '#6b7280', textTransform: 'uppercase', marginBottom: '8px' }}>Daftar Belanja</div>
                {selectedOrder.items.map((item, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ color: '#374151', flex: 1, paddingRight: '8px' }}>{item.nama}</span>
                    <span style={{ color: '#111827', fontWeight: '600', whiteSpace: 'nowrap' }}>Rp {item.harga.toLocaleString('id-ID')}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '6px', marginTop: '6px', borderTop: '1px solid #e5e7eb', fontWeight: '700' }}>
                  <span style={{ color: '#374151' }}>Total Belanja</span>
                  <span style={{ color: '#111827' }}>Rp {selectedOrder.items.reduce((s, i) => s + i.harga, 0).toLocaleString('id-ID')}</span>
                </div>
              </div>
            )}

            {/* Barang — format lama (fallback) */}
            {(!selectedOrder.items || selectedOrder.items.length === 0) && selectedOrder.item_name && (
              <div style={{ paddingBottom: '12px', borderBottom: '1px dashed #d1d5db', marginBottom: '14px' }}>
                <div style={{ fontSize: '9px', fontWeight: '700', letterSpacing: '0.1em', color: '#6b7280', textTransform: 'uppercase', marginBottom: '6px' }}>Barang</div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#374151' }}>{selectedOrder.item_name}</span>
                  {(selectedOrder.item_price ?? 0) > 0 && (
                    <span style={{ fontWeight: '600', color: '#111827' }}>Rp {(selectedOrder.item_price ?? 0).toLocaleString('id-ID')}</span>
                  )}
                </div>
              </div>
            )}

            {/* Biaya Pengiriman */}
            <div style={{ marginBottom: '14px' }}>
              <div style={{ fontSize: '9px', fontWeight: '700', letterSpacing: '0.1em', color: '#6b7280', textTransform: 'uppercase', marginBottom: '8px' }}>Biaya Pengiriman</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ color: '#374151' }}>Ongkir</span>
                <span>Rp {(selectedOrder.total_fee || 0).toLocaleString('id-ID')}</span>
              </div>
              {(selectedOrder.titik ?? 0) > 0 && Array.from({ length: selectedOrder.titik! }).map((_, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', paddingLeft: '8px' }}>
                  <span style={{ color: '#9ca3af' }}>• Titik {i + 1}</span>
                  <span>Rp 3.000</span>
                </div>
              ))}
              {(selectedOrder.beban ?? []).map((b, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', paddingLeft: '8px' }}>
                  <span style={{ color: '#9ca3af' }}>• {b.nama}</span>
                  <span>Rp {b.biaya.toLocaleString('id-ID')}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '6px', marginTop: '6px', borderTop: '1px solid #e5e7eb', fontWeight: '700', fontSize: '13px' }}>
                <span>Total Ongkir</span>
                <span>Rp {((selectedOrder.total_fee || 0) + (selectedOrder.total_biaya_titik ?? 0) + (selectedOrder.total_biaya_beban ?? 0)).toLocaleString('id-ID')}</span>
              </div>
            </div>

            {/* Total Dibayar */}
            {(selectedOrder.items && selectedOrder.items.length > 0) && (
              <div style={{ background: '#fef3c7', borderRadius: '8px', padding: '10px 12px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '800', fontSize: '14px', color: '#92400e' }}>
                  <span>TOTAL DIBAYAR</span>
                  <span>Rp {((selectedOrder.total_fee || 0) + (selectedOrder.total_biaya_titik ?? 0) + (selectedOrder.total_biaya_beban ?? 0) + selectedOrder.items.reduce((s, i) => s + i.harga, 0)).toLocaleString('id-ID')}</span>
                </div>
                <div style={{ fontSize: '9px', color: '#b45309', marginTop: '3px' }}>Ongkir + Total Belanja</div>
              </div>
            )}
            {(!selectedOrder.items || selectedOrder.items.length === 0) && (selectedOrder.item_price ?? 0) > 0 && (
              <div style={{ background: '#fef3c7', borderRadius: '8px', padding: '10px 12px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '800', fontSize: '14px', color: '#92400e' }}>
                  <span>TOTAL DIBAYAR</span>
                  <span>Rp {((selectedOrder.total_fee || 0) + (selectedOrder.total_biaya_titik ?? 0) + (selectedOrder.total_biaya_beban ?? 0) + (selectedOrder.item_price ?? 0)).toLocaleString('id-ID')}</span>
                </div>
                <div style={{ fontSize: '9px', color: '#b45309', marginTop: '3px' }}>Ongkir + Harga Barang</div>
              </div>
            )}

            {/* Footer */}
            <div style={{ textAlign: 'center', fontSize: '11px', color: '#9ca3af', borderTop: '1px dashed #e5e7eb', paddingTop: '12px' }}>
              Terima kasih telah menggunakan layanan KurirDev 🙏
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
