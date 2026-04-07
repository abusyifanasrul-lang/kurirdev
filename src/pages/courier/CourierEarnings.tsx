import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { ArrowLeft, TrendingUp, DollarSign, Package, Calendar, Search, X, CheckCircle, XCircle, Clock } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { format, parseISO, startOfDay, subDays, startOfWeek, isWithinInterval, endOfDay, isToday, isYesterday } from 'date-fns';
import { useAuth } from '@/context/AuthContext';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { calcCourierEarning } from '@/lib/calcEarning';
import { getOrdersByCourierFromLocal } from '@/lib/orderCache';
import { Order } from '@/types';
import { useOrderStore } from '@/stores/useOrderStore';

type Period = 'daily' | 'weekly';
type Tab = 'summary' | 'history';
type StatusFilter = 'all' | 'delivered' | 'cancelled';

const statusConfig: Record<string, { color: string; bg: string; icon: typeof CheckCircle; label: string }> = {
  delivered: { color: 'text-teal-600', bg: 'bg-teal-50', icon: CheckCircle, label: '✅ CEKLIS — Terkirim' },
  cancelled: { color: 'text-red-600', bg: 'bg-red-50', icon: XCircle, label: '❌ CANCEL — Dibatalkan' },
  in_transit: { color: 'text-emerald-600', bg: 'bg-emerald-50', icon: Package, label: 'GAS — Customer' },
  picked_up: { color: 'text-orange-600', bg: 'bg-orange-50', icon: Package, label: 'GAS — Penjual' },
  assigned: { color: 'text-teal-700', bg: 'bg-teal-50', icon: Clock, label: 'Order Diterima' },
  pending: { color: 'text-gray-600', bg: 'bg-gray-50', icon: Clock, label: 'Menunggu Kurir' },
};

export function CourierEarnings() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { commission_rate, commission_threshold } = useSettingsStore();
  const earningSettings = { commission_rate, commission_threshold };
  const { isFetchingActiveOrders: isSyncing } = useOrderStore();

  const [activeTab, setActiveTab] = useState<Tab>((location.state as any)?.activeTab || 'summary');
  const [period, setPeriod] = useState<Period>('daily');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [courierOrders, setCourierOrders] = useState<Order[]>([]);
  const [RechartsLib, setRechartsLib] = useState<any>(null);
  const invoiceRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    import('recharts').then(m => setRechartsLib(m));
  }, []);

  const loadFromLocalDB = useCallback(async () => {
    if (!user?.id) return;
    try {
      const orders = await getOrdersByCourierFromLocal(user.id);
      setCourierOrders(orders);
    } catch (err) {
      console.error('CourierEarnings load error:', err);
    }
  }, [user?.id]);

  useEffect(() => { loadFromLocalDB(); }, [loadFromLocalDB]);

  useEffect(() => {
    const handler = () => loadFromLocalDB();
    window.addEventListener('indexeddb-synced', handler);
    return () => window.removeEventListener('indexeddb-synced', handler);
  }, [loadFromLocalDB]);

  // Handle Highlight from Dashboard if any
  useEffect(() => {
    const highlightOrderId = (location.state as any)?.highlightOrderId;
    if (!highlightOrderId || activeTab !== 'history') return;
    
    const el = document.getElementById(`order-${highlightOrderId}`);
    if (!el) return;
    
    setTimeout(() => {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-2', 'ring-yellow-400', 'ring-offset-2');
      setTimeout(() => el.classList.remove('ring-2', 'ring-yellow-400', 'ring-offset-2'), 2000);
    }, 300);
  }, [location.state, activeTab]);

  const handleBagikanInvoice = async () => {
    if (!invoiceRef.current) return;
    const { default: html2canvas } = await import('html2canvas');
    const canvas = await html2canvas(invoiceRef.current, { 
      scale: 2, 
      useCORS: true,
      onclone: (clonedDoc) => {
        clonedDoc.querySelectorAll('*').forEach((el) => {
          const s = (el as HTMLElement).style;
          ['color', 'backgroundColor', 'borderColor', 'borderTopColor', 'borderRightColor', 'borderBottomColor', 'borderLeftColor'].forEach((prop) => {
            const val = (s as any)[prop];
            if (typeof val === 'string' && val.includes('oklch')) {
              (s as any)[prop] = prop === 'color' ? 'inherit' : 'transparent';
            }
          });
        });
      }
    });
    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `Invoice-${selectedOrder?.order_number}.png`;
    link.href = dataUrl;
    link.click();
  };

  // 7-day limit for history tab
  const historyPeriodStart = useMemo(() => startOfDay(subDays(new Date(), 6)), []);
  const historyPeriodEnd = useMemo(() => endOfDay(new Date()), []);

  // Delivered orders for chart & stats
  const deliveredOrders = useMemo(() => {
    return courierOrders.filter((o) => o.status === 'delivered');
  }, [courierOrders]);

  // Filtered orders for History Tab (7 days limit + search + status)
  const filteredOrders = useMemo(() => {
    return courierOrders.filter((order) => {
      const orderDate = parseISO(order.created_at);
      const isWithinLast7Days = isWithinInterval(orderDate, { start: historyPeriodStart, end: historyPeriodEnd });
      
      if (!isWithinLast7Days) return false;

      const matchesSearch = searchQuery === '' || 
        order.order_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.customer_name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [courierOrders, searchQuery, statusFilter, historyPeriodStart, historyPeriodEnd]);

  const groupedOrders = useMemo(() => {
    const groups: Record<string, typeof courierOrders> = {};
    filteredOrders.forEach((order) => {
      const date = format(parseISO(order.created_at), 'yyyy-MM-dd');
      if (!groups[date]) groups[date] = [];
      groups[date].push(order);
    });
    return groups;
  }, [filteredOrders]);

  const getDateLabel = (dateStr: string) => {
    const date = parseISO(dateStr);
    if (isToday(date)) return 'Hari Ini';
    if (isYesterday(date)) return 'Kemarin';
    return format(date, 'dd MMMM yyyy');
  };

  const todayStats = useMemo(() => {
    const today = startOfDay(new Date());
    const todayEnd = endOfDay(new Date());
    const todayOrders = deliveredOrders.filter((o) => {
      const deliveryDate = o.actual_delivery_time ? parseISO(o.actual_delivery_time) : parseISO(o.created_at);
      return isWithinInterval(deliveryDate, { start: today, end: todayEnd });
    });
    return {
      orders: todayOrders.length,
      earnings: todayOrders.reduce((sum, o) => sum + calcCourierEarning(o, earningSettings), 0),
    };
  }, [deliveredOrders, earningSettings]);

  const last7DaysStats = useMemo(() => {
    const sevenDaysOrders = deliveredOrders.filter((o) => {
      const deliveryDate = o.actual_delivery_time ? parseISO(o.actual_delivery_time) : parseISO(o.created_at);
      return isWithinInterval(deliveryDate, { start: historyPeriodStart, end: historyPeriodEnd });
    });
    return {
      orders: sevenDaysOrders.length,
      earnings: sevenDaysOrders.reduce((sum, o) => sum + calcCourierEarning(o, earningSettings), 0),
    };
  }, [deliveredOrders, earningSettings, historyPeriodStart, historyPeriodEnd]);

  const chartData = useMemo(() => {
    const now = new Date();
    if (period === 'daily') {
      const days = Array.from({ length: 7 }, (_, i) => {
        const date = subDays(now, 6 - i);
        const dayStart = startOfDay(date);
        const dayEnd = endOfDay(date);
        const dayOrders = deliveredOrders.filter((o) => {
          const deliveryDate = o.actual_delivery_time ? parseISO(o.actual_delivery_time) : parseISO(o.created_at);
          return isWithinInterval(deliveryDate, { start: dayStart, end: dayEnd });
        });
        return {
          label: format(date, 'dd/MM'),
          earnings: dayOrders.reduce((sum, o) => sum + calcCourierEarning(o, earningSettings), 0),
        };
      });
      return days;
    }
    if (period === 'weekly') {
      const weeks = Array.from({ length: 4 }, (_, i) => {
        const weekStart = startOfWeek(subDays(now, (3 - i) * 7), { weekStartsOn: 1 });
        const weekEnd = endOfDay(subDays(startOfWeek(subDays(now, (2 - i) * 7), { weekStartsOn: 1 }), 1));
        const weekOrders = deliveredOrders.filter((o) => {
          const deliveryDate = o.actual_delivery_time ? parseISO(o.actual_delivery_time) : parseISO(o.created_at);
          return deliveryDate >= weekStart && deliveryDate <= weekEnd;
        });
        return {
          label: `W${i + 1}`,
          earnings: weekOrders.reduce((sum, o) => sum + calcCourierEarning(o, earningSettings), 0),
        };
      });
      return weeks;
    }
    return [];
  }, [deliveredOrders, period, earningSettings]);

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val);

  const formatChartCurrency = (val: number) => {
    if (val >= 1000000) return `${(val / 1000000).toFixed(1)}jt`;
    if (val >= 1000) return `${(val / 1000).toFixed(0)}rb`;
    return val.toString();
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="bg-indigo-600 text-white sticky top-0 z-20 shadow-md">
        <div className="flex items-center gap-4 p-4 pb-2">
          <button onClick={() => navigate('/courier')} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-xl font-bold">Pendapatan & Riwayat</h1>
            {isSyncing && (
              <div className="flex items-center gap-1.5 text-[10px] text-indigo-100 animate-pulse mt-0.5 font-medium">
                <Clock className="w-3 h-3" />
                <span>Mensinkronkan data 7-hari...</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex px-4 gap-4">
          <button 
            onClick={() => setActiveTab('summary')}
            className={`pb-3 text-sm font-bold transition-all relative ${activeTab === 'summary' ? 'text-white' : 'text-indigo-100/60'}`}
          >
            Ringkasan
            {activeTab === 'summary' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-white rounded-full" />}
          </button>
          <button 
            onClick={() => setActiveTab('history')}
            className={`pb-3 text-sm font-bold transition-all relative ${activeTab === 'history' ? 'text-white' : 'text-indigo-100/60'}`}
          >
            Riwayat
            {activeTab === 'history' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-white rounded-full" />}
          </button>
        </div>
      </div>

      {activeTab === 'summary' ? (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="grid grid-cols-2 gap-4 p-4">
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <div className="flex items-center gap-2 mb-1 text-gray-500">
                <DollarSign className="w-4 h-4" />
                <span className="text-[10px] uppercase font-bold tracking-wider">Hari Ini</span>
              </div>
              <p className="text-xl font-bold text-gray-900">{formatCurrency(todayStats.earnings)}</p>
              <div className="mt-1">
                <span className="text-[11px] text-indigo-600 font-semibold">{todayStats.orders} Pesanan</span>
              </div>
            </div>
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <div className="flex items-center gap-2 mb-1 text-gray-500">
                <TrendingUp className="w-4 h-4" />
                <span className="text-[10px] uppercase font-bold tracking-wider">7 Hari</span>
              </div>
              <p className="text-xl font-bold text-gray-900">{formatCurrency(last7DaysStats.earnings)}</p>
              <div className="mt-1">
                <span className="text-[11px] text-emerald-600 font-semibold">{last7DaysStats.orders} Pesanan</span>
              </div>
            </div>
          </div>

          <div className="px-4 mb-6">
            <div className="flex bg-gray-200 rounded-xl p-1 gap-1">
              {(['daily', 'weekly'] as Period[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${period === p ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500'}`}
                >
                  {p === 'daily' ? 'Harian' : 'Mingguan'}
                </button>
              ))}
            </div>
          </div>

          <div className="px-4">
            <div className="bg-white rounded-[2rem] border border-gray-100 p-6 shadow-xl shadow-gray-200/50">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-indigo-600" />
                  Grafik Performa
                </h3>
                <div className="px-3 py-1 bg-indigo-50 rounded-full text-[9px] font-bold text-indigo-600 uppercase tracking-widest">
                  Auto-Update
                </div>
              </div>
              {chartData.every((d) => d.earnings === 0) ? (
                <div className="text-center py-16">
                  <Package className="w-16 h-16 text-gray-100 mx-auto mb-4" />
                  <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Belum ada aktivitas data</p>
                </div>
              ) : RechartsLib ? (
                <RechartsLib.ResponsiveContainer width="100%" height={240}>
                  <RechartsLib.BarChart data={chartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                    <RechartsLib.CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <RechartsLib.XAxis dataKey="label" tick={{ fontSize: 9, fontWeight: '800', fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <RechartsLib.YAxis tick={{ fontSize: 9, fontWeight: '800', fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={formatChartCurrency} />
                    <RechartsLib.Tooltip
                      cursor={{ fill: '#f1f5f9', radius: 8 }}
                      contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '12px' }}
                      itemStyle={{ fontSize: '10px', fontWeight: '900', textTransform: 'uppercase', color: '#0d9488' }}
                      labelStyle={{ fontSize: '9px', fontWeight: 'bold', color: '#94a3b8', marginBottom: '4px' }}
                      formatter={(value: number | undefined) => [formatCurrency(value ?? 0), 'Ringkasan']}
                    />
                    <RechartsLib.Bar dataKey="earnings" fill="url(#colorEarning)" radius={[6, 6, 0, 0]} />
                    <defs>
                      <linearGradient id="colorEarning" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#4f46e5" stopOpacity={1}/>
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0.8}/>
                      </linearGradient>
                    </defs>
                  </RechartsLib.BarChart>
                </RechartsLib.ResponsiveContainer>
              ) : (
                <div className="h-[240px] bg-gray-50 rounded-3xl animate-pulse" />
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="bg-white/80 backdrop-blur-md border-b p-4 space-y-4 sticky top-[110px] z-10 shadow-sm border-gray-100">
            <div className="flex gap-2">
              <div className="flex-1 relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-indigo-600 transition-colors" />
                <input
                  type="text"
                  placeholder="Order # atau Customer..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 text-xs bg-gray-100 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 font-medium placeholder:text-gray-400"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                className="px-4 py-3 text-xs bg-gray-100 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 font-bold uppercase"
              >
                <option value="all">SEMUA</option>
                <option value="delivered">TERKIRIM</option>
                <option value="cancelled">BATAL</option>
              </select>
            </div>
            <div className="flex items-center justify-between px-1">
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Data 7 Hari Terakhir</p>
              <div className="bg-indigo-50 px-2 py-0.5 rounded text-[9px] font-bold text-indigo-600 uppercase">Live</div>
            </div>
          </div>

          <div className="p-4 space-y-6">
            {Object.keys(groupedOrders).length === 0 ? (
              <div className="text-center py-24">
                <div className="w-20 h-20 bg-gray-100 rounded-[2.5rem] flex items-center justify-center mx-auto mb-4 border-4 border-dashed border-gray-200">
                  <Package className="w-8 h-8 text-gray-300" />
                </div>
                <p className="text-sm font-black text-gray-800 uppercase tracking-widest">Data Kosong</p>
                <p className="text-[10px] text-gray-400 mt-2 font-medium">Tidak ada riwayat pengiriman ditemukan</p>
              </div>
            ) : (
              Object.entries(groupedOrders).map(([date, dateOrders]) => (
                <div key={date}>
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                    {getDateLabel(date)}
                  </h3>
                  <div className="space-y-3">
                    {dateOrders.map((order) => {
                      const config = statusConfig[order.status] || statusConfig.pending;
                      const courierEarning = order.status === 'delivered' ? calcCourierEarning(order, earningSettings) : 0;

                      return (
                        <div
                          key={order.id}
                          id={`order-${order.id}`}
                          onClick={() => order.status === 'delivered' ? setSelectedOrder(order) : navigate(`/courier/orders/${order.id}`)}
                          className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 cursor-pointer active:scale-[0.98] transition-all"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <p className="font-bold text-gray-900 text-sm">{order.order_number}</p>
                              <p className="text-[10px] text-gray-500 flex items-center gap-1 mt-0.5">
                                <Clock className="w-3 h-3" />
                                {format(parseISO(order.created_at), 'HH:mm')}
                              </p>
                            </div>
                            <div className={`px-2 py-0.5 rounded text-[10px] font-bold ${config.bg} ${config.color}`}>
                              {config.label.split(' — ')[1] || config.label}
                            </div>
                          </div>
                          
                          <div className="mb-3">
                            <p className="text-xs font-medium text-gray-800 truncate">{order.customer_name}</p>
                            <p className="text-[10px] text-gray-500 line-clamp-1">{order.customer_address}</p>
                          </div>

                          <div className="flex justify-between items-center pt-3 border-t border-gray-50">
                            <div className="text-[10px] text-gray-500">
                              Fee: <span className="font-bold text-gray-900">{formatCurrency(order.total_fee)}</span>
                            </div>
                            {courierEarning > 0 && (
                              <div className="text-sm font-bold text-indigo-600">
                                +{formatCurrency(courierEarning)}
                              </div>
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
        </div>
      )}

      {selectedOrder && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="font-bold text-gray-900">Invoice Digital</h2>
              <button onClick={() => setSelectedOrder(null)} className="p-1 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="p-6 bg-gray-50 max-h-[70vh] overflow-y-auto">
              <div 
                ref={invoiceRef}
                className="bg-white p-6 shadow-sm border border-gray-100 relative"
                style={{ fontFamily: "'Courier New', Courier, monospace" }}
              >
                <div className="absolute top-0 left-0 right-0 h-1 flex justify-center gap-1 -translate-y-1/2">
                   {[...Array(20)].map((_, i) => <div key={i} className="w-2 h-1 bg-gray-50 rounded-full" />)}
                </div>

                <div className="text-center mb-6">
                  <h3 className="font-bold text-lg text-gray-900 leading-none">KURIRDEV</h3>
                  <p className="text-[10px] text-gray-500 mt-1 uppercase tracking-widest font-sans">Official Logistik Receipt</p>
                  <div className="w-12 h-0.5 bg-gray-900 mx-auto mt-2" />
                </div>

                <div className="space-y-3 text-xs">
                  <div className="flex justify-between border-b border-dashed pb-2">
                    <span className="text-gray-500 uppercase">No. Order</span>
                    <span className="font-bold">{selectedOrder.order_number}</span>
                  </div>
                  <div className="flex justify-between border-b border-dashed pb-2">
                    <span className="text-gray-500 uppercase">Waktu</span>
                    <span className="font-bold">{format(parseISO(selectedOrder.created_at), 'dd MMM, HH:mm')}</span>
                  </div>
                  <div className="flex justify-between border-b border-dashed pb-2">
                    <span className="text-gray-500 uppercase">Status</span>
                    <span className="font-bold text-green-600">DELIVERED</span>
                  </div>

                  <div className="pt-2">
                    <span className="text-gray-500 uppercase text-[9px] block mb-1">Customer Details</span>
                    <p className="font-bold text-[11px] leading-tight break-words">{selectedOrder.customer_name}</p>
                    <p className="text-gray-600 text-[10px] leading-tight mt-1">{selectedOrder.customer_address}</p>
                  </div>

                  <div className="pt-4 space-y-1 mt-4 border-t-2 border-gray-900">
                    <div className="flex justify-between text-[11px]">
                      <span>Ongkir Kurir</span>
                      <span>{formatCurrency(selectedOrder.total_fee)}</span>
                    </div>
                    {((selectedOrder.total_biaya_titik || 0) + (selectedOrder.total_biaya_beban || 0)) > 0 && (
                      <div className="flex justify-between text-[11px]">
                        <span>Tambahan Logistik</span>
                        <span>{formatCurrency((selectedOrder.total_biaya_titik || 0) + (selectedOrder.total_biaya_beban || 0))}</span>
                      </div>
                    )}
                    {(selectedOrder.item_price ?? 0) > 0 && (
                      <div className="flex justify-between text-[11px]">
                        <span>Harga Barang</span>
                        <span>{formatCurrency(selectedOrder.item_price ?? 0)}</span>
                      </div>
                    )}

                    <div className="bg-amber-50 rounded-lg p-3 mt-4 border border-amber-100">
                      <div className="flex justify-between font-bold text-sm text-amber-900">
                        <span>TOTAL DITERIMA</span>
                        <span>{formatCurrency(
                          (selectedOrder.total_fee || 0) + 
                          (selectedOrder.total_biaya_titik ?? 0) + 
                          (selectedOrder.total_biaya_beban ?? 0) + 
                          (selectedOrder.item_price ?? 0)
                        )}</span>
                      </div>
                      <p className="text-[9px] text-amber-700 mt-1 uppercase font-sans tracking-wider">Tunai Ke Kurir</p>
                    </div>
                  </div>
                </div>

                <div className="mt-8 pt-4 border-t border-dashed text-center">
                  <p className="text-[10px] text-gray-400 font-sans italic">Terima kasih telah mempercayai KurirDev 🙏</p>
                </div>
              </div>
            </div>

            <div className="p-4 bg-white border-t flex flex-col gap-2">
              <button
                onClick={handleBagikanInvoice}
                className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 active:scale-95 transition-all"
              >
                Simpan Invoice (PNG)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
