import { useMemo, useState, useRef, useEffect } from 'react';
import { ArrowLeft, Package, Clock, CheckCircle, XCircle, Search } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { format, isToday, isYesterday, parseISO } from 'date-fns';
import { Badge } from '@/components/ui/Badge';
import { useOrderStore } from '@/stores/useOrderStore';
import { useAuth } from '@/context/AuthContext';
import { useCourierStore } from '@/stores/useCourierStore';
import html2canvas from 'html2canvas';
import { X } from 'lucide-react';
import { Order } from '@/types';

type StatusFilter = 'all' | 'delivered' | 'cancelled' | 'in_transit' | 'picked_up' | 'assigned';

const statusConfig: Record<string, { color: string; bg: string; icon: typeof CheckCircle; label: string }> = {
  delivered: { color: 'text-green-600', bg: 'bg-green-50', icon: CheckCircle, label: 'Delivered' },
  cancelled: { color: 'text-red-600', bg: 'bg-red-50', icon: XCircle, label: 'Cancelled' },
  in_transit: { color: 'text-blue-600', bg: 'bg-blue-50', icon: Package, label: 'In Transit' },
  picked_up: { color: 'text-orange-600', bg: 'bg-orange-50', icon: Package, label: 'Picked Up' },
  assigned: { color: 'text-indigo-600', bg: 'bg-indigo-50', icon: Clock, label: 'Assigned' },
  pending: { color: 'text-gray-600', bg: 'bg-gray-50', icon: Clock, label: 'Pending' },
};

export function CourierHistory() {
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
  const { orders } = useOrderStore();
  const { couriers } = useCourierStore();

  const currentCourier = useMemo(() => couriers.find(c => c.id === user?.id), [couriers, user?.id]);
  const COMMISSION_RATE = (currentCourier?.commission_rate ?? 80) / 100;

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const invoiceRef = useRef<HTMLDivElement>(null);

  const handleBagikanInvoice = async () => {
    if (!invoiceRef.current) return;
    const canvas = await html2canvas(invoiceRef.current, { scale: 2, useCORS: true });
    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `Invoice-${selectedOrder?.order_number}.png`;
    link.href = dataUrl;
    link.click();
  };

  // Filter orders assigned to this courier
  const courierOrders = useMemo(() => {
    if (!user) return [];

    return orders
      .filter((order) => {
        // Only orders assigned to this courier
        const isMyCourier = order.courier_id === user.id;
        if (!isMyCourier) return false;

        // Apply status filter
        if (statusFilter !== 'all' && order.status !== statusFilter) return false;

        // Apply search filter
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          return (
            order.order_number.toLowerCase().includes(q) ||
            order.customer_name.toLowerCase().includes(q) ||
            order.customer_address.toLowerCase().includes(q)
          );
        }

        return true;
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [orders, user, statusFilter, searchQuery]);

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
    const courier = couriers.find(c => c.id === user?.id);
    const rate = (courier?.commission_rate ?? 80) / 100;
    return courierOrders
      .filter((o) => o.status === 'delivered')
      .reduce((sum, o) => sum + (o.total_fee || 0) * rate + (o.total_biaya_titik ?? 0) + (o.total_biaya_beban ?? 0), 0);
  }, [courierOrders, couriers, user]);

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
              {courierOrders.length} pesanan • {formatCurrency(totalEarnings)} total pendapatan
            </p>
          </div>
        </div>

        {/* Search & Filter */}
        <div className="px-4 pb-3 flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Cari pesanan..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">Semua</option>
            <option value="delivered">Delivered</option>
            <option value="cancelled">Cancelled</option>
            <option value="in_transit">In Transit</option>
            <option value="picked_up">Picked Up</option>
            <option value="assigned">Assigned</option>
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
                  const courierEarning = order.status === 'delivered'
                    ? (order.total_fee || 0) * COMMISSION_RATE + (order.total_biaya_titik ?? 0) + (order.total_biaya_beban ?? 0)
                    : 0;

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
                          <span className="text-sm font-semibold text-green-600">+{formatCurrency(courierEarning)}</span>
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
              <div className="text-xs space-y-3 text-gray-700">
                <div className="text-center">
                  <p className="font-bold text-indigo-700 text-base">🛵 KurirDev</p>
                  <p className="text-gray-500">Invoice Pengiriman</p>
                </div>
                <div className="space-y-1">
                  <p><span className="font-medium">No. Order</span> : {selectedOrder.order_number}</p>
                  <p><span className="font-medium">Tanggal</span> : {format(parseISO(selectedOrder.created_at), 'dd MMM yyyy, HH:mm')}</p>
                  <p><span className="font-medium">Kurir</span> : {user?.name}</p>
                </div>
                <div className="border-t border-b border-gray-200 py-2 space-y-1">
                  <p className="font-semibold">PENERIMA</p>
                  <p>{selectedOrder.customer_name}</p>
                  <p className="text-gray-500">{selectedOrder.customer_address}</p>
                  <p className="text-gray-500">{selectedOrder.customer_phone}</p>
                </div>
                <div className="space-y-1.5">
                  <p className="font-semibold">RINCIAN BIAYA</p>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Ongkir</span>
                    <span>Rp {(selectedOrder.total_fee || 0).toLocaleString('id-ID')}</span>
                  </div>
                  {(selectedOrder.titik ?? 0) > 0 && (
                    <div>
                      <p className="text-gray-500 font-medium">Titik Tambahan</p>
                      {Array.from({ length: selectedOrder.titik! }).map((_, i) => (
                        <div key={i} className="flex justify-between pl-2">
                          <span className="text-gray-400">• Titik {i + 1}</span>
                          <span>Rp 3.000</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {(selectedOrder.beban ?? []).length > 0 && (
                    <div>
                      <p className="text-gray-500 font-medium">Beban Tambahan</p>
                      {selectedOrder.beban!.map((b, i) => (
                        <div key={i} className="flex justify-between pl-2">
                          <span className="text-gray-400">• {b.nama}</span>
                          <span>Rp {b.biaya.toLocaleString('id-ID')}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="border-t border-gray-300 pt-2 flex justify-between font-bold text-sm">
                    <span>TOTAL</span>
                    <span>Rp {((selectedOrder.total_fee || 0) + (selectedOrder.total_biaya_titik ?? 0) + (selectedOrder.total_biaya_beban ?? 0)).toLocaleString('id-ID')}</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="px-4 py-3 border-t">
              <button
                onClick={handleBagikanInvoice}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2"
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
          <div ref={invoiceRef} style={{ background: '#ffffff', padding: '24px', width: '320px', fontFamily: 'sans-serif', fontSize: '12px', color: '#111827' }}>
            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
              <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#4338ca' }}>🛵 KurirDev</div>
              <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>Invoice Pengiriman</div>
            </div>
            <div style={{ marginBottom: '12px', lineHeight: '1.6' }}>
              <div><span style={{ fontWeight: '600' }}>No. Order</span> : {selectedOrder.order_number}</div>
              <div><span style={{ fontWeight: '600' }}>Tanggal</span> : {format(parseISO(selectedOrder.created_at), 'dd MMM yyyy, HH:mm')}</div>
              <div><span style={{ fontWeight: '600' }}>Kurir</span> : {user?.name}</div>
            </div>
            <div style={{ borderTop: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb', padding: '10px 0', marginBottom: '12px', lineHeight: '1.6' }}>
              <div style={{ fontWeight: '600', marginBottom: '6px' }}>PENERIMA</div>
              <div>{selectedOrder.customer_name}</div>
              <div style={{ color: '#6b7280' }}>{selectedOrder.customer_address}</div>
              <div style={{ color: '#6b7280' }}>{selectedOrder.customer_phone}</div>
            </div>
            <div style={{ marginBottom: '12px', lineHeight: '1.8' }}>
              <div style={{ fontWeight: '600', marginBottom: '6px' }}>RINCIAN BIAYA</div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#6b7280' }}>Ongkir</span>
                <span>Rp {(selectedOrder.total_fee || 0).toLocaleString('id-ID')}</span>
              </div>
              {(selectedOrder.titik ?? 0) > 0 && (
                <div>
                  <div style={{ color: '#6b7280', fontWeight: '500', marginTop: '6px' }}>Titik Tambahan</div>
                  {Array.from({ length: selectedOrder.titik! }).map((_, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: '8px' }}>
                      <span style={{ color: '#9ca3af' }}>• Titik {i + 1}</span>
                      <span>Rp 3.000</span>
                    </div>
                  ))}
                </div>
              )}
              {(selectedOrder.beban ?? []).length > 0 && (
                <div>
                  <div style={{ color: '#6b7280', fontWeight: '500', marginTop: '6px' }}>Beban Tambahan</div>
                  {selectedOrder.beban!.map((b, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: '8px' }}>
                      <span style={{ color: '#9ca3af' }}>• {b.nama}</span>
                      <span>Rp {b.biaya.toLocaleString('id-ID')}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={{ borderTop: '2px solid #111827', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '13px' }}>
              <span>TOTAL</span>
              <span>Rp {((selectedOrder.total_fee || 0) + (selectedOrder.total_biaya_titik ?? 0) + (selectedOrder.total_biaya_beban ?? 0)).toLocaleString('id-ID')}</span>
            </div>
            <div style={{ textAlign: 'center', fontSize: '11px', color: '#9ca3af', marginTop: '16px' }}>
              Terima kasih telah menggunakan layanan KurirDev 🙏
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
