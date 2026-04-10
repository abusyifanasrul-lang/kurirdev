import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { ArrowLeft, TrendingUp, DollarSign, Package, Calendar, Search, X, CheckCircle, XCircle, Clock } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { cn } from '@/utils/cn';
import { format, parseISO, startOfDay, subDays, startOfWeek, isWithinInterval, endOfDay, isToday, isYesterday } from 'date-fns';
import { useAuth } from '@/context/AuthContext';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { calcCourierEarning } from '@/lib/calcEarning';
import { getOrdersByCourierFromLocal } from '@/lib/orderCache';
import { Order } from '@/types';
import { Badge } from '@/components/ui/Badge';
import { useOrderStore } from '@/stores/useOrderStore';
import { formatCurrency, formatShortCurrency } from '@/utils/formatter';

type Period = 'daily' | 'weekly';
type Tab = 'summary' | 'history';
type StatusFilter = 'all' | 'delivered' | 'cancelled';

const statusConfig: Record<string, { color: string; bg: string; icon: typeof CheckCircle; label: string }> = {
  delivered: { color: 'text-emerald-600', bg: 'bg-emerald-50', icon: CheckCircle, label: '✅ CEKLIS — Terkirim' },
  cancelled: { color: 'text-red-600', bg: 'bg-red-50', icon: XCircle, label: '❌ CANCEL — Dibatalkan' },
  in_transit: { color: 'text-emerald-600', bg: 'bg-emerald-50', icon: Package, label: 'GAS — Customer' },
  picked_up: { color: 'text-orange-600', bg: 'bg-orange-50', icon: Package, label: 'GAS — Penjual' },
  assigned: { color: 'text-emerald-700', bg: 'bg-emerald-50', icon: Clock, label: 'Order Diterima' },
  pending: { color: 'text-gray-600', bg: 'bg-gray-50', icon: Clock, label: 'Menunggu Kurir' },
};

export function CourierEarnings() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { commission_rate, commission_threshold } = useSettingsStore();
  const earningSettings = { commission_rate, commission_threshold };
  const { isSyncing } = useOrderStore();

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

  return (
    <div className="bg-gray-50 pb-20">
      <div className="bg-white border-b border-gray-100 sticky top-0 z-20 shadow-sm">
        <div className="flex items-center gap-3 p-4">
          <button onClick={() => navigate('/courier')} className="p-2 -ml-2 rounded-full hover:bg-gray-100 transition-colors">
            <ArrowLeft className="w-6 h-6 text-gray-700" />
          </button>
          <div className="flex-1">
            <h1 className="text-[10px] font-bold text-gray-400 uppercase tracking-mobile leading-none">
              Pendapatan & Riwayat
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm font-bold text-gray-900 leading-none">
                PERFORMA KURIR
              </span>
            </div>
            {isSyncing && (
              <div className="flex items-center gap-1.5 text-[9px] text-emerald-600 font-bold animate-pulse mt-1.5">
                <Clock className="w-3 h-3" />
                <span>SYNCING DATA...</span>
              </div>
            )}
          </div>
        </div>

        <div className="px-4 pb-4">
          <div className="flex bg-gray-100/80 backdrop-blur-sm rounded-2xl p-1.5 gap-1.5 border border-gray-200/50 shadow-inner">
            <button 
              onClick={() => setActiveTab('summary')}
              className={cn(
                "flex-1 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 active:scale-95",
                activeTab === 'summary' 
                  ? "bg-emerald-600 text-white shadow-lg shadow-emerald-200 ring-1 ring-emerald-500/20" 
                  : "text-gray-400 hover:text-gray-600"
              )}
            >
              <TrendingUp className={cn("w-4 h-4", activeTab === 'summary' ? "text-white" : "text-gray-300")} />
              <span>Ringkasan</span>
            </button>
            <button 
              onClick={() => setActiveTab('history')}
              className={cn(
                "flex-1 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 active:scale-95",
                activeTab === 'history' 
                  ? "bg-emerald-600 text-white shadow-lg shadow-emerald-200 ring-1 ring-emerald-500/20" 
                  : "text-gray-400 hover:text-gray-600"
              )}
            >
              <Clock className={cn("w-4 h-4", activeTab === 'history' ? "text-white" : "text-gray-300")} />
              <span>Riwayat</span>
            </button>
          </div>
        </div>
      </div>

      {activeTab === 'summary' ? (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="grid grid-cols-2 gap-4 p-4">
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 relative overflow-hidden active:scale-[0.98] transition-all">
              <div className="absolute top-0 right-0 p-4 opacity-5">
                <DollarSign className="w-12 h-12" />
              </div>
              <div className="flex items-center gap-2 mb-2 text-gray-400">
                <span className="text-[9px] uppercase font-bold tracking-mobile">Hari Ini</span>
              </div>
              <p className="text-xl font-bold text-gray-900 tracking-tight">{formatCurrency(todayStats.earnings)}</p>
              <div className="mt-2 flex items-center gap-1">
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                <span className="text-[10px] text-emerald-600 font-bold">{todayStats.orders} Pesanan</span>
              </div>
            </div>
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 relative overflow-hidden active:scale-[0.98] transition-all">
              <div className="absolute top-0 right-0 p-4 opacity-5">
                <TrendingUp className="w-12 h-12" />
              </div>
              <div className="flex items-center gap-2 mb-2 text-gray-400">
                <span className="text-[9px] uppercase font-bold tracking-mobile">7 Hari</span>
              </div>
              <p className="text-xl font-bold text-gray-900 tracking-tight">{formatCurrency(last7DaysStats.earnings)}</p>
              <div className="mt-2 flex items-center gap-1">
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                <span className="text-[10px] text-emerald-600 font-bold">{last7DaysStats.orders} Pesanan</span>
              </div>
            </div>
          </div>

          <div className="px-4 mb-6">
            <div className="flex bg-gray-200/50 backdrop-blur rounded-2xl p-1.5 gap-1.5">
              {(['daily', 'weekly'] as Period[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`flex-1 py-2 text-[10px] uppercase font-bold tracking-mobile rounded-xl transition-all ${period === p ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  {p === 'daily' ? 'Harian' : 'Mingguan'}
                </button>
              ))}
            </div>
          </div>

          <div className="px-4">
            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-mobile flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-emerald-600" />
                  Grafik Performa
                </h3>
                <div className="px-3 py-1 bg-emerald-50 rounded-full text-[9px] font-bold text-emerald-600 uppercase tracking-mobile">
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
                    <RechartsLib.XAxis dataKey="label" tick={{ fontSize: 9, fontWeight: '700', fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <RechartsLib.YAxis tick={{ fontSize: 9, fontWeight: '700', fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={formatShortCurrency} />
                    <RechartsLib.Tooltip
                      cursor={{ fill: '#f1f5f9', radius: 8 }}
                      contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '12px' }}
                      itemStyle={{ fontSize: '10px', fontWeight: '800', textTransform: 'uppercase', color: '#059669' }}
                      labelStyle={{ fontSize: '9px', fontWeight: 'bold', color: '#94a3b8', marginBottom: '4px' }}
                      formatter={(value: number | undefined) => [formatCurrency(value ?? 0), 'Ringkasan']}
                    />
                    <RechartsLib.Bar dataKey="earnings" fill="#059669" radius={[4, 4, 0, 0]} />
                  </RechartsLib.BarChart>
                </RechartsLib.ResponsiveContainer>
              ) : (
                <div className="h-[240px] bg-gray-50 rounded-2xl animate-pulse" />
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="bg-white/80 backdrop-blur-md border-b p-4 space-y-4 sticky top-[100px] z-10 shadow-sm border-gray-100">
            <div className="flex gap-2">
              <div className="flex-1 relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-emerald-600 transition-colors" />
                <input
                  type="text"
                  placeholder="Order # atau Customer..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 text-xs bg-gray-100 border-none rounded-2xl focus:ring-2 focus:ring-emerald-500 font-bold placeholder:text-gray-400 placeholder:font-normal"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                className="px-4 py-3 text-[10px] bg-gray-100 border-none rounded-2xl focus:ring-2 focus:ring-emerald-500 font-bold uppercase tracking-mobile"
              >
                <option value="all">SEMUA</option>
                <option value="delivered">TERKIRIM</option>
                <option value="cancelled">BATAL</option>
              </select>
            </div>
            <div className="flex items-center justify-between px-1">
              <p className="text-[9px] text-gray-400 font-bold uppercase tracking-mobile">Data 7 Hari Terakhir</p>
              <div className="bg-emerald-50 px-2 py-0.5 rounded text-[9px] font-bold text-emerald-600 uppercase">Live</div>
            </div>
          </div>

          <div className="p-4 space-y-6">
            {Object.keys(groupedOrders).length === 0 ? (
              <div className="text-center py-24">
                <div className="w-20 h-20 bg-gray-100 rounded-3xl flex items-center justify-center mx-auto mb-4 border-4 border-dashed border-gray-200">
                  <Package className="w-8 h-8 text-gray-300" />
                </div>
                <p className="text-sm font-black text-gray-800 uppercase tracking-widest">Data Kosong</p>
                <p className="text-[10px] text-gray-400 mt-2 font-medium">Tidak ada riwayat pengiriman ditemukan</p>
              </div>
            ) : (
              Object.entries(groupedOrders).map(([date, dateOrders]) => (
                <div key={date}>
                  <h3 className="text-[10px] font-bold uppercase tracking-mobile text-emerald-600 mb-4 ml-1 flex items-center gap-3">
                    {getDateLabel(date)}
                    <div className="flex-1 h-[1px] bg-emerald-100/50" />
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
                          className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 cursor-pointer active:scale-[0.98] transition-all"
                        >
                          <div className="flex items-start justify-between mb-4">
                            <div className="min-w-0">
                              <p className="font-bold text-gray-900 text-sm tracking-tight truncate">{order.order_number}</p>
                              <div className="flex items-center gap-1.5 mt-0.5 text-gray-400">
                                <Clock className="w-3 h-3" />
                                <p className="text-[10px] font-semibold uppercase tracking-mobile">{format(parseISO(order.created_at), 'HH:mm')}</p>
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-mobile ${config.bg} ${config.color} border border-current/10 shadow-sm`}>
                                {config.label.split(' — ')[1] || config.label}
                              </div>
                              {order.status === 'delivered' && (
                                <div className={order.payment_status === 'paid' ? 'text-emerald-600' : 'text-orange-500'}>
                                  <Badge variant={order.payment_status === 'paid' ? 'success' : 'warning'} size="sm">
                                    {order.payment_status === 'paid' ? 'Paid — Checked' : 'Unpaid — Action Req.'}
                                  </Badge>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="space-y-1 bg-gray-50/50 p-3 rounded-2xl border border-gray-100/50">
                            <p className="text-xs font-bold text-gray-800 uppercase tracking-tight line-clamp-1">{order.customer_name}</p>
                            <p className="text-[11px] text-gray-500 leading-relaxed line-clamp-2">{order.customer_address}</p>
                          </div>
                          <div className="flex justify-between items-end mt-4 pt-4 border-t border-gray-50">
                            <div className="flex flex-col">
                              <span className="text-[9px] text-gray-400 font-bold uppercase tracking-mobile mb-1">Standard Fee</span>
                              <span className="text-xs font-bold text-gray-900">{formatCurrency(order.total_fee)}</span>
                            </div>
                            {courierEarning > 0 && (
                              <div className="text-right flex flex-col items-end">
                                <span className="text-[9px] text-emerald-500 font-bold uppercase tracking-mobile mb-1">Earning Net</span>
                                <span className="text-lg font-bold text-emerald-600 tracking-tight">{formatCurrency(courierEarning)}</span>
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

      {/* Standard Modal Invoice */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center z-50 px-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-900">Detail Invoice</h3>
              <button onClick={() => setSelectedOrder(null)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="p-6 max-h-[60vh] overflow-y-auto">
              <div className="bg-white p-4 border border-gray-200 rounded-xl">
                {/* Header */}
                <div style={{ textAlign: 'center', paddingBottom: '12px', borderBottom: '2px solid #111827', marginBottom: '14px' }}>
                  <div style={{ fontSize: '18px', fontWeight: '700', color: '#047857' }}>🛵 KurirDev</div>
                  <div style={{ fontSize: '9px', color: '#6b7280', letterSpacing: '0.05em', textTransform: 'uppercase', marginTop: '2px', fontWeight: '700' }}>Invoice Pengiriman</div>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: '#111827', marginTop: '10px' }}>{selectedOrder.order_number}</div>
                  <div style={{ fontSize: '10px', color: '#6b7280', marginTop: '2px' }}>{selectedOrder.created_at ? new Date(selectedOrder.created_at).toLocaleString('id-ID', {day:'2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute:'2-digit'}) : new Date().toLocaleString('id-ID')}</div>
                </div>

                {/* Kepada */}
                <div style={{ paddingBottom: '12px', borderBottom: '1px dashed #d1d5db', marginBottom: '14px' }}>
                  <div style={{ fontSize: '8px', fontWeight: '700', letterSpacing: '0.05em', color: '#6b7280', textTransform: 'uppercase', marginBottom: '6px' }}>Kepada</div>
                  <div style={{ fontWeight: '700', fontSize: '12px', color: '#111827' }}>{selectedOrder.customer_name}</div>
                  <div style={{ color: '#4b5563', marginTop: '2px', fontSize: '11px', lineHeight: '1.4' }}>{selectedOrder.customer_address}</div>
                  <div style={{ color: '#4b5563', marginTop: '2px', fontSize: '11px' }}>{selectedOrder.customer_phone}</div>
                </div>

                {/* Daftar Belanja */}
                {(selectedOrder.items && selectedOrder.items.length > 0) && (
                  <div style={{ paddingBottom: '12px', borderBottom: '1px dashed #d1d5db', marginBottom: '14px' }}>
                    <div style={{ fontSize: '8px', fontWeight: '700', letterSpacing: '0.05em', color: '#6b7280', textTransform: 'uppercase', marginBottom: '8px' }}>Daftar Belanja</div>
                    {selectedOrder.items.map((item, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '11px' }}>
                        <span style={{ color: '#374151', flex: 1, paddingRight: '8px' }}>{item.nama}</span>
                        <span style={{ color: '#111827', fontWeight: '600' }}>Rp {item.harga.toLocaleString('id-ID')}</span>
                      </div>
                    ))}
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '6px', marginTop: '6px', borderTop: '1px solid #e5e7eb', fontWeight: '700', fontSize: '11px' }}>
                      <span style={{ color: '#374151' }}>Total Belanja</span>
                      <span style={{ color: '#111827' }}>Rp {selectedOrder.items.reduce((s, i) => s + i.harga, 0).toLocaleString('id-ID')}</span>
                    </div>
                  </div>
                )}

                {/* Biaya Pengiriman */}
                <div style={{ marginBottom: '14px' }}>
                  <div style={{ fontSize: '8px', fontWeight: '700', letterSpacing: '0.05em', color: '#6b7280', textTransform: 'uppercase', marginBottom: '8px' }}>Biaya Pengiriman</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '11px' }}>
                    <span style={{ color: '#374151' }}>Ongkir</span>
                    <span>Rp {(selectedOrder.total_fee || 0).toLocaleString('id-ID')}</span>
                  </div>
                  {(selectedOrder.titik ?? 0) > 0 && Array.from({ length: selectedOrder.titik! }).map((_, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', paddingLeft: '8px', fontSize: '10px' }}>
                      <span style={{ color: '#9ca3af' }}>• Titik {i + 1}</span>
                      <span>Rp 3.000</span>
                    </div>
                  ))}
                  {(selectedOrder.beban ?? []).map((b, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', paddingLeft: '8px', fontSize: '10px' }}>
                      <span style={{ color: '#9ca3af' }}>• {b.nama}</span>
                      <span>Rp {b.biaya.toLocaleString('id-ID')}</span>
                    </div>
                  ))}
                </div>

                {/* Total Dibayar */}
                <div style={{ background: '#fef3c7', borderRadius: '8px', padding: '10px 12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '800', fontSize: '13px', color: '#92400e' }}>
                    <span>TOTAL DIBAYAR</span>
                    <span>Rp {(
                      (selectedOrder.total_fee || 0) + 
                      (selectedOrder.total_biaya_titik ?? 0) + 
                      (selectedOrder.total_biaya_beban ?? 0) + 
                      (selectedOrder.items?.reduce((s, i) => s + i.harga, 0) || (selectedOrder.item_price ?? 0))
                    ).toLocaleString('id-ID')}</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="p-6 pt-0">
              <button
                onClick={handleBagikanInvoice}
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold text-xs uppercase tracking-mobile active:scale-[0.98] transition-all shadow-lg shadow-emerald-100"
              >
                CETAK / UNDUH INVOICE PNG
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden container for html2canvas consistency */}
      {selectedOrder && (
        <div className="absolute opacity-0 pointer-events-none appearance-none h-0 overflow-hidden" aria-hidden="true" style={{ top: '-4000px', width: '500px' }}>
          <div ref={invoiceRef} style={{ background: '#ffffff', padding: '24px', width: '320px', fontFamily: 'Arial, sans-serif', fontSize: '12px', color: '#111827' }}>
            {/* Header */}
            <div style={{ textAlign: 'center', paddingBottom: '12px', borderBottom: '2px solid #111827', marginBottom: '14px' }}>
              <div style={{ fontSize: '20px', fontWeight: '700', color: '#047857' }}>🛵 KurirDev</div>
              <div style={{ fontSize: '10px', color: '#6b7280', letterSpacing: '0.05em', textTransform: 'uppercase', marginTop: '2px', fontWeight: '700' }}>Invoice Pengiriman</div>
              <div style={{ fontSize: '14px', fontWeight: '700', color: '#111827', marginTop: '10px' }}>{selectedOrder.order_number}</div>
              <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>{selectedOrder.created_at ? new Date(selectedOrder.created_at).toLocaleString('id-ID', {day:'2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute:'2-digit'}) : new Date().toLocaleString('id-ID')}</div>
              <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '1px' }}>Kurir: {user?.name}</div>
            </div>

            {/* Kepada */}
            <div style={{ paddingBottom: '12px', borderBottom: '1px dashed #d1d5db', marginBottom: '14px' }}>
              <div style={{ fontSize: '9px', fontWeight: '700', letterSpacing: '0.1em', color: '#6b7280', textTransform: 'uppercase', marginBottom: '6px' }}>Kepada</div>
              <div style={{ fontWeight: '700', fontSize: '13px', color: '#111827' }}>{selectedOrder.customer_name}</div>
              <div style={{ color: '#4b5563', marginTop: '2px', lineHeight: '1.5' }}>{selectedOrder.customer_address}</div>
              <div style={{ color: '#4b5563', marginTop: '2px' }}>{selectedOrder.customer_phone}</div>
            </div>

            {/* Daftar Belanja */}
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

            {/* fallback barang */}
            {(!selectedOrder.items || selectedOrder.items.length === 0) && selectedOrder.item_name && (
              <div style={{ paddingBottom: '12px', borderBottom: '1px dashed #d1d5db', marginBottom: '14px' }}>
                <div style={{ fontSize: '9px', fontWeight: '700', letterSpacing: '0.1em', color: '#6b7280', textTransform: 'uppercase', marginBottom: '6px' }}>Barang</div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#374151' }}>{selectedOrder.item_name}</span>
                  {((selectedOrder.item_price ?? 0) > 0) && (
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
            </div>

            {/* Total Dibayar */}
            <div style={{ background: '#fef3c7', borderRadius: '8px', padding: '10px 12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '800', fontSize: '14px', color: '#92400e' }}>
                <span>TOTAL DIBAYAR</span>
                <span>Rp {(
                  (selectedOrder.total_fee || 0) + 
                  (selectedOrder.total_biaya_titik ?? 0) + 
                  (selectedOrder.total_biaya_beban ?? 0) + 
                  (selectedOrder.items?.reduce((s, i) => s + i.harga, 0) || (selectedOrder.item_price ?? 0))
                ).toLocaleString('id-ID')}</span>
              </div>
              <div style={{ fontSize: '9px', color: '#b45309', margin: '3px 0 0 0' }}>Ongkir + Total Belanja/Barang</div>
            </div>
            
            <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: '10px', paddingTop: '12px', marginTop: '8px', borderTop: '1px dashed #e5e7eb' }}>
              Terima kasih telah menggunakan layanan KurirDev 🙏
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
