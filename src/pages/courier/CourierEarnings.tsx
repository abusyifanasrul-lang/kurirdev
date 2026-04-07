import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { ArrowLeft, TrendingUp, DollarSign, Package, Calendar, Search, X, CheckCircle, XCircle, Clock } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { format, parseISO, startOfDay, subDays, startOfWeek, isWithinInterval, endOfDay, isToday, isYesterday } from 'date-fns';
import { useAuth } from '@/context/AuthContext';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { calcCourierEarning } from '@/lib/calcEarning';
import { getOrdersByCourierFromLocal } from '@/lib/orderCache';
import { Order } from '@/types';
import { Badge } from '@/components/ui/Badge';
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
      <div className="bg-gradient-to-r from-teal-600 to-emerald-600 text-white sticky top-0 z-20 shadow-md">
        <div className="flex items-center gap-3 p-4">
          <button onClick={() => navigate('/courier')} className="p-2 hover:bg-white/10 rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-black tracking-tight">Pendapatan & Riwayat</h1>
            <p className="text-[10px] text-teal-100 uppercase tracking-widest font-bold">Courier Performance Hub</p>
            {isSyncing && (
              <div className="flex items-center gap-1.5 text-[9px] text-white/80 animate-pulse mt-1">
                <Clock className="w-3 h-3" />
                <span>Syncing data...</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex px-4 pb-0.5 mt-2 gap-6">
          <button 
            onClick={() => setActiveTab('summary')}
            className={`pb-3 text-sm font-bold uppercase tracking-wider transition-all relative ${activeTab === 'summary' ? 'text-white' : 'text-teal-100/40'}`}
          >
            Ringkasan
            {activeTab === 'summary' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-white rounded-full animate-in slide-in-from-left-2" />}
          </button>
          <button 
            onClick={() => setActiveTab('history')}
            className={`pb-3 text-sm font-bold uppercase tracking-wider transition-all relative ${activeTab === 'history' ? 'text-white' : 'text-teal-100/40'}`}
          >
            Riwayat
            {activeTab === 'history' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-white rounded-full animate-in slide-in-from-right-2" />}
          </button>
        </div>
      </div>

      {activeTab === 'summary' ? (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="grid grid-cols-2 gap-4 p-4">
            <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 relative overflow-hidden group active:scale-[0.98] transition-all">
              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <DollarSign className="w-12 h-12" />
              </div>
              <div className="flex items-center gap-2 mb-2 text-gray-400">
                <span className="text-[9px] uppercase font-black tracking-widest">Hari Ini</span>
              </div>
              <p className="text-xl font-black text-gray-900 tracking-tight">{formatCurrency(todayStats.earnings)}</p>
              <div className="mt-2 flex items-center gap-1">
                <div className="w-1.5 h-1.5 bg-teal-500 rounded-full animate-pulse" />
                <span className="text-[10px] text-teal-600 font-black">{todayStats.orders} Pesanan</span>
              </div>
            </div>
            <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 relative overflow-hidden group active:scale-[0.98] transition-all">
              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <TrendingUp className="w-12 h-12" />
              </div>
              <div className="flex items-center gap-2 mb-2 text-gray-400">
                <span className="text-[9px] uppercase font-black tracking-widest">7 Hari</span>
              </div>
              <p className="text-xl font-black text-gray-900 tracking-tight">{formatCurrency(last7DaysStats.earnings)}</p>
              <div className="mt-2 flex items-center gap-1">
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                <span className="text-[10px] text-emerald-600 font-black">{last7DaysStats.orders} Pesanan</span>
              </div>
            </div>
          </div>

          <div className="px-4 mb-6">
            <div className="flex bg-gray-200/50 backdrop-blur rounded-2xl p-1.5 gap-1.5">
              {(['daily', 'weekly'] as Period[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`flex-1 py-2 text-[10px] uppercase font-black tracking-widest rounded-xl transition-all ${period === p ? 'bg-white text-teal-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  {p === 'daily' ? 'Harian' : 'Mingguan'}
                </button>
              ))}
            </div>
          </div>

          <div className="px-4">
            <div className="bg-white rounded-[2rem] border border-gray-100 p-6 shadow-xl shadow-gray-200/50">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-teal-600" />
                  Grafik Performa
                </h3>
                <div className="px-3 py-1 bg-teal-50 rounded-full text-[9px] font-black text-teal-600 uppercase tracking-widest">
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
                        <stop offset="5%" stopColor="#0d9488" stopOpacity={1}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.8}/>
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
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-teal-600 transition-colors" />
                <input
                  type="text"
                  placeholder="Order # atau Customer..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 text-xs bg-gray-100 border-none rounded-2xl focus:ring-2 focus:ring-teal-500 font-bold placeholder:text-gray-400 placeholder:font-normal"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                className="px-4 py-3 text-[10px] bg-gray-100 border-none rounded-2xl focus:ring-2 focus:ring-teal-500 font-black uppercase tracking-widest"
              >
                <option value="all">SEMUA</option>
                <option value="delivered">TERKIRIM</option>
                <option value="cancelled">BATAL</option>
              </select>
            </div>
            <div className="flex items-center justify-between px-1">
              <p className="text-[9px] text-gray-400 font-black uppercase tracking-[0.2em]">Data 7 Hari Terakhir</p>
              <div className="bg-teal-50 px-2 py-0.5 rounded text-[9px] font-black text-teal-600 uppercase">Live</div>
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
                  <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-teal-600 mb-4 ml-1 flex items-center gap-3">
                    {getDateLabel(date)}
                    <div className="flex-1 h-[1px] bg-teal-100/50" />
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
                          className="bg-white rounded-[2rem] p-5 shadow-sm border border-gray-100 cursor-pointer active:scale-[0.98] transition-all hover:shadow-xl hover:shadow-teal-900/5"
                        >
                          <div className="flex items-start justify-between mb-4">
                            <div className="min-w-0">
                              <p className="font-black text-gray-900 text-sm tracking-tight truncate">{order.order_number}</p>
                              <div className="flex items-center gap-1.5 mt-0.5 text-gray-400">
                                <Clock className="w-3 h-3" />
                                <p className="text-[10px] font-bold uppercase tracking-widest">{format(parseISO(order.created_at), 'HH:mm')}</p>
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              <div className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-tighter ${config.bg} ${config.color} border shadow-sm`}>
                                {config.label.split(' — ')[1] || config.label}
                              </div>
                              {order.status === 'delivered' && (
                                <div className={order.payment_status === 'paid' ? 'text-teal-600' : 'text-orange-500'}>
                                  <Badge variant={order.payment_status === 'paid' ? 'success' : 'warning'} size="sm">
                                    {order.payment_status === 'paid' ? 'Paid — Checked' : 'Unpaid — Action Req.'}
                                  </Badge>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="space-y-1 bg-gray-50/50 p-3 rounded-2xl border border-gray-100/50">
                            <p className="text-xs font-black text-gray-800 uppercase tracking-tight line-clamp-1">{order.customer_name}</p>
                            <p className="text-[10px] text-gray-500 leading-relaxed line-clamp-2">{order.customer_address}</p>
                          </div>
                          <div className="flex justify-between items-end mt-4 pt-4 border-t border-gray-50">
                            <div className="flex flex-col">
                              <span className="text-[8px] text-gray-400 font-black uppercase tracking-[0.2em] mb-1">Standard Fee</span>
                              <span className="text-xs font-bold text-gray-900 font-mono italic">{formatCurrency(order.total_fee)}</span>
                            </div>
                            {courierEarning > 0 && (
                              <div className="text-right flex flex-col items-end">
                                <span className="text-[8px] text-teal-500 font-black uppercase tracking-[0.2em] mb-1">Earning Net</span>
                                <span className="text-lg font-black text-teal-600 tracking-tighter">{formatCurrency(courierEarning)}</span>
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

      {/* Modern Glassmorphism Modal Invoice */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-teal-950/40 backdrop-blur-md flex items-center justify-center z-50 px-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-[2.5rem] w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300 border border-white/20">
            <div className="flex items-center justify-between px-8 py-6 border-b border-gray-50">
              <div>
                <h3 className="font-black text-gray-900 text-lg tracking-tight">Digital Receipt</h3>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">Payment Verified</p>
              </div>
              <button onClick={() => setSelectedOrder(null)} className="p-3 bg-gray-50 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-2xl transition-all active:scale-95">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-8 max-h-[60vh] overflow-y-auto custom-scrollbar">
              <div className="text-xs space-y-0 text-gray-700">
                <div className="text-center pb-8 border-b-2 border-gray-900 mb-8">
                  <p className="font-black text-teal-700 text-4xl tracking-tighter italic">Kurir<span className="text-gray-900">Dev</span></p>
                  <p className="text-gray-400 text-[10px] font-black tracking-[0.5em] uppercase mt-2 opacity-50">Official Receipt</p>
                  <div className="bg-teal-50 rounded-[1.5rem] py-4 mt-6 border border-teal-100 shadow-inner">
                    <p className="font-black text-teal-900 text-base font-mono">{selectedOrder.order_number}</p>
                    <p className="text-[10px] text-teal-600 font-bold mt-1 uppercase tracking-widest">{format(parseISO(selectedOrder.created_at), 'dd MMM yyyy, HH:mm')}</p>
                  </div>
                </div>
                
                <div className="pb-6 border-b border-gray-100 mb-6">
                  <p className="text-[9px] font-black uppercase tracking-widest text-teal-600 mb-3">Customer Information</p>
                  <p className="font-black text-gray-900 text-base tracking-tight">{selectedOrder.customer_name}</p>
                  <p className="text-gray-500 mt-2 leading-relaxed text-[11px] font-medium italic">"{selectedOrder.customer_address}"</p>
                  <div className="mt-3 flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full" />
                    <p className="text-teal-700 font-black font-mono text-[11px]">{selectedOrder.customer_phone}</p>
                  </div>
                </div>

                {(selectedOrder.items && selectedOrder.items.length > 0) && (
                  <div className="pb-6 border-b border-gray-100 mb-6 font-medium">
                    <p className="text-[9px] font-black uppercase tracking-widest text-teal-600 mb-4">Itemized Breakdown</p>
                    {selectedOrder.items.map((item, i) => (
                      <div key={i} className="flex justify-between py-1.5 hover:bg-gray-50/50 px-2 rounded-lg transition-colors">
                        <span className="text-gray-600 font-bold">{item.nama}</span>
                        <span className="font-black text-gray-900 font-mono">Rp {item.harga.toLocaleString('id-ID')}</span>
                      </div>
                    ))}
                    <div className="flex justify-between pt-4 mt-2 border-t border-gray-100 font-black text-gray-400 text-[10px] px-2 italic uppercase">
                      <span>Shopping Subtotal</span>
                      <span className="font-mono">Rp {selectedOrder.items.reduce((s, i) => s + i.harga, 0).toLocaleString('id-ID')}</span>
                    </div>
                  </div>
                )}

                {(!selectedOrder.items || selectedOrder.items.length === 0) && selectedOrder.item_name && (
                  <div className="pb-6 border-b border-gray-100 mb-6">
                    <p className="text-[9px] font-black uppercase tracking-widest text-teal-600 mb-3">Item Details</p>
                    <div className="flex justify-between font-black p-3 bg-gray-50 rounded-2xl border border-gray-100">
                      <span className="text-gray-700 text-[11px] uppercase">{selectedOrder.item_name}</span>
                      {(selectedOrder.item_price ?? 0) > 0 && <span className="text-gray-900 font-mono">Rp {(selectedOrder.item_price ?? 0).toLocaleString('id-ID')}</span>}
                    </div>
                  </div>
                )}

                <div className="pb-6 mb-4">
                  <p className="text-[9px] font-black uppercase tracking-widest text-teal-600 mb-4">Service & Logistics</p>
                  <div className="flex justify-between py-1.5 px-2">
                    <span className="text-gray-500 font-bold uppercase text-[10px]">Deliery Base</span>
                    <span className="font-mono font-black">Rp {(selectedOrder.total_fee || 0).toLocaleString('id-ID')}</span>
                  </div>
                  {(selectedOrder.titik ?? 0) > 0 && Array.from({ length: selectedOrder.titik! }).map((_, i) => (
                    <div key={i} className="flex justify-between py-1 px-2 text-gray-400 italic">
                      <span className="text-[10px]">Extra Point {i + 1}</span>
                      <span className="font-mono text-[10px]">Rp 3.000</span>
                    </div>
                  ))}
                  {(selectedOrder.beban ?? []).map((b, i) => (
                    <div key={i} className="flex justify-between py-1 px-2 text-gray-400 italic">
                      <span className="text-[10px]">{b.nama}</span>
                      <span className="font-mono text-[10px]">Rp {b.biaya.toLocaleString('id-ID')}</span>
                    </div>
                  ))}
                  <div className="flex justify-between pt-4 mt-2 border-t border-gray-100 font-black text-teal-900 text-[11px] px-2 uppercase tracking-wide">
                    <span>Total Logistics</span>
                    <span className="font-mono">Rp {((selectedOrder.total_fee || 0) + (selectedOrder.total_biaya_titik ?? 0) + (selectedOrder.total_biaya_beban ?? 0)).toLocaleString('id-ID')}</span>
                  </div>
                </div>

                <div className="bg-gray-900 text-white rounded-[2rem] p-6 shadow-2xl relative overflow-hidden">
                  <div className="absolute -top-10 -right-10 w-32 h-32 bg-teal-500/20 rounded-full blur-3xl" />
                  <div className="flex justify-between font-black text-2xl tracking-tighter relative z-10">
                    <span className="italic">NET TOTAL</span>
                    <span className="font-mono text-teal-400">Rp {(
                      (selectedOrder.total_fee || 0) + 
                      (selectedOrder.total_biaya_titik ?? 0) + 
                      (selectedOrder.total_biaya_beban ?? 0) + 
                      (selectedOrder.items?.reduce((s, i) => s + i.harga, 0) || (selectedOrder.item_price ?? 0))
                    ).toLocaleString('id-ID')}</span>
                  </div>
                  <p className="text-[9px] text-teal-400 mt-2 uppercase font-black tracking-[0.3em] opacity-80 relative z-10">Amount Due for Transfer</p>
                </div>
                
                <div className="text-center text-gray-300 text-[8px] pt-8 mt-6 border-t border-dashed border-gray-100 uppercase font-black tracking-[0.2em]">
                  KurirDev Logistics System • V2.0 • Build-2025
                </div>
              </div>
            </div>
            <div className="p-8 pt-0">
              <button
                onClick={handleBagikanInvoice}
                className="w-full py-5 bg-teal-600 hover:bg-teal-700 text-white rounded-[1.5rem] font-black text-sm flex items-center justify-center gap-3 shadow-2xl shadow-teal-500/30 active:scale-[0.98] transition-all transform uppercase tracking-widest"
              >
                📥 Save Image Invoice
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden high-res capture container */}
      {selectedOrder && (
        <div style={{ position: 'fixed', left: '-9999px', top: '0' }}>
          <div ref={invoiceRef} style={{ background: '#ffffff', padding: '60px', width: '500px', fontFamily: 'system-ui, sans-serif', color: '#111827' }}>
            <div style={{ textAlign: 'center', paddingBottom: '30px', borderBottom: '4px solid #111827', marginBottom: '32px' }}>
              <div style={{ fontSize: '48px', fontWeight: '900', color: '#0f766e', letterSpacing: '-0.07em', fontStyle: 'italic' }}>Kurir<span style={{color:'#111827'}}>Dev</span></div>
              <div style={{ fontSize: '13px', color: '#94a3b8', letterSpacing: '0.4em', textTransform: 'uppercase', marginTop: '8px', fontWeight: '900' }}>Official Service Receipt</div>
              <div style={{ background: '#f8fafc', padding: '24px', borderRadius: '24px', marginTop: '30px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '24px', fontWeight: '900', color: '#111827', fontFamily: 'monospace' }}>{selectedOrder.order_number}</div>
                <div style={{ fontSize: '14px', color: '#64748b', marginTop: '8px', fontWeight: '700', textTransform: 'uppercase' }}>{format(parseISO(selectedOrder.created_at), 'dd MMMM yyyy, HH:mm')}</div>
              </div>
            </div>
            <div style={{ paddingBottom: '30px', borderBottom: '2px dashed #e2e8f0', marginBottom: '32px' }}>
              <div style={{ fontSize: '12px', fontWeight: '900', letterSpacing: '0.2em', color: '#cbd5e1', textTransform: 'uppercase', marginBottom: '12px' }}>Recipient Info</div>
              <div style={{ fontWeight: '900', fontSize: '22px', color: '#111827', letterSpacing: '-0.03em' }}>{selectedOrder.customer_name}</div>
              <div style={{ color: '#64748b', marginTop: '8px', lineHeight: '1.6', fontSize: '16px', fontWeight: '500' }}>{selectedOrder.customer_address}</div>
              <div style={{ color: '#0d9488', marginTop: '10px', fontWeight: '900', fontSize: '16px', fontFamily: 'monospace' }}>{selectedOrder.customer_phone}</div>
            </div>
            <div style={{ marginBottom: '40px' }}>
              <div style={{ fontSize: '12px', fontWeight: '900', letterSpacing: '0.2em', color: '#cbd5e1', textTransform: 'uppercase', marginBottom: '16px' }}>Fee Breakdown</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', fontSize: '18px', fontWeight: '700', color: '#475569' }}>
                <span>Delivery Base Fee</span>
                <span style={{fontFamily:'monospace'}}>Rp {(selectedOrder.total_fee || 0).toLocaleString('id-ID')}</span>
              </div>
              {((selectedOrder.total_biaya_titik || 0) + (selectedOrder.total_biaya_beban || 0)) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', fontSize: '18px', fontWeight: '700', color: '#475569' }}>
                  <span>Extra Logistic Fees</span>
                  <span style={{fontFamily:'monospace'}}>Rp {((selectedOrder.total_biaya_titik || 0) + (selectedOrder.total_biaya_beban || 0)).toLocaleString('id-ID')}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', fontSize: '18px', fontWeight: '700', color: '#475569' }}>
                <span>Goods/Shopping Cost</span>
                <span style={{fontFamily:'monospace'}}>Rp {(selectedOrder.items?.reduce((s, i) => s + i.harga, 0) || (selectedOrder.item_price ?? 0)).toLocaleString('id-ID')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '24px', marginTop: '24px', borderTop: '4px solid #111827', fontWeight: '900', fontSize: '32px' }}>
                <span style={{ color: '#111827', letterSpacing: '-0.05em' }}>TOTAL COST</span>
                <span style={{ color: '#0d9488', fontFamily: 'monospace' }}>Rp {(
                  (selectedOrder.total_fee || 0) + 
                  (selectedOrder.total_biaya_titik ?? 0) + 
                  (selectedOrder.total_biaya_beban ?? 0) + 
                  (selectedOrder.items?.reduce((s, i) => s + i.harga, 0) || (selectedOrder.item_price ?? 0))
                ).toLocaleString('id-ID')}</span>
              </div>
            </div>
            <div style={{ textAlign: 'center', fontSize: '14px', color: '#94a3b8', borderTop: '2px dashed #f1f5f9', paddingTop: '30px', fontStyle: 'italic', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Thank you for trusting KurirDev Logistics.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
