import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, DollarSign, CheckCircle, Clock, WifiOff, ChevronRight, AlertTriangle } from 'lucide-react';
import { format, parseISO, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { cn } from '@/utils/cn';
import { Badge, getStatusBadgeVariant, getStatusLabel } from '@/components/ui/Badge';
import { useOrderStore } from '@/stores/useOrderStore';
import { useCourierStore } from '@/stores/useCourierStore';
import { useAuth } from '@/context/AuthContext';
import { useSessionStore } from '@/stores/useSessionStore';
import { useUserStore } from '@/stores/useUserStore';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { calcCourierEarning, calcAdminEarning } from '@/lib/calcEarning';
import { getUnpaidOrdersByCourier, getOrdersByCourierFromLocal } from '@/lib/orderCache';
import { Order } from '@/types';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { formatCurrency, formatShortCurrency } from '@/utils/formatter';

export function CourierDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { activeOrdersByCourier } = useOrderStore();

  const { setCourierOffline, setCourierOnline } = useCourierStore();
  const { users, subscribeProfile } = useUserStore();
  const { user: currentUser } = useSessionStore();
  const { commission_rate, commission_threshold } = useSettingsStore();

  const liveUser = users.find(u => u.id === currentUser?.id);
  const isSuspended = liveUser?.is_active === false;
  const isOnline = liveUser?.is_online ?? false;
  const isNetworkOnline = useNetworkStatus();

  const [showOffModal, setShowOffModal] = useState(false);
  const [selectedOffReason, setSelectedOffReason] = useState('');
  const [customOffReason, setCustomOffReason] = useState('');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const courierStatus = (liveUser as any)?.courier_status ?? (isOnline ? 'on' : 'off');

  useEffect(() => {
    if (!user?.id) return;
    const unsubscribe = subscribeProfile(user.id);
    return () => unsubscribe();
  }, [user?.id, subscribeProfile]);

  const OFF_REASONS = [
    { value: 'Makan', label: '🍽️ Makan' },
    { value: 'BAB/BAK', label: '🚽 BAB/BAK' },
    { value: 'Isi Bensin', label: '⛽ Isi Bensin' },
    { value: 'Masalah Kendaraan', label: '🔧 Masalah Kendaraan' },
    { value: 'Lainnya', label: '📝 Lainnya' },
  ];

  const activeOrders = [...activeOrdersByCourier].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  const [todayStats, setTodayStats] = useState({ count: 0, earnings: 0 });
  const [unpaidStats, setUnpaidStats] = useState({ count: 0, earnings: 0 });
  const [isStatsLoading, setIsStatsLoading] = useState(true);

  // Load all dashboard stats in one efficient pass
  const loadDashboardStats = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      const stats = await import('@/lib/orderCache');
      
      // 1. Today's Stats (Delivered only)
      const today = await stats.getCourierTodayStats(user.id, { commission_rate, commission_threshold });
      setTodayStats(today);

      // 2. Unpaid Warnings (Optimized)
      const unpaid = await stats.getUnpaidOrdersByCourier(user.id);
      const unpaidEarnings = unpaid.reduce((sum, o) => {
        const rate = o.applied_commission_rate ?? commission_rate
        const threshold = o.applied_commission_threshold ?? commission_threshold
        return sum + calcAdminEarning(o, { commission_rate: rate, commission_threshold: threshold })
      }, 0);
      
      setUnpaidStats({ count: unpaid.length, earnings: unpaidEarnings });
      setIsStatsLoading(false);
    } catch (err) {
      console.error('Failed to load dashboard stats:', err);
    }
  }, [user?.id, commission_rate, commission_threshold]);

  // Initial load
  useEffect(() => {
    loadDashboardStats();
  }, [loadDashboardStats]);

  // Debounced listener for sync events
  useEffect(() => {
    let timeoutId: any = null;
    const handler = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        loadDashboardStats();
      }, 1000); // Wait 1s after last sync event before refreshing stats
    };

    window.addEventListener('indexeddb-synced', handler);
    return () => {
      window.removeEventListener('indexeddb-synced', handler);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [loadDashboardStats]);

  const handleSetOn = async () => {
    if (!user?.id || isSuspended || isUpdatingStatus) return;
    setIsUpdatingStatus(true);
    try {
      await setCourierOnline(user.id, 'on');
      useSessionStore.getState().updateUser({ is_online: true, courier_status: 'on' as any });
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleSetStay = async () => {
    if (!user?.id || isSuspended || isUpdatingStatus) return;
    setIsUpdatingStatus(true);
    try {
      await setCourierOnline(user.id, 'stay');
      useSessionStore.getState().updateUser({ is_online: true, courier_status: 'stay' as any });
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleConfirmOff = async () => {
    if (!user?.id || isUpdatingStatus) return;
    const reason = selectedOffReason === 'Lainnya' ? customOffReason : selectedOffReason;
    if (!reason) return;
    
    setIsUpdatingStatus(true);
    try {
      await setCourierOffline(user.id, reason);
      useSessionStore.getState().updateUser({ is_online: false, courier_status: 'off' as any, off_reason: reason });
      setShowOffModal(false);
      setSelectedOffReason('');
      setCustomOffReason('');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  return (
    <div className="space-y-6 p-1">

      {/* Unpaid Warning Card — If any */}
      {!isStatsLoading && unpaidStats.count > 0 && (
        <div
          onClick={() => navigate('/courier/earnings', { state: { activeTab: 'history' } })}
          className="flex items-center justify-between gap-3 bg-orange-50 border border-orange-200 rounded-3xl px-5 py-4 cursor-pointer active:scale-[0.98] transition-all shadow-sm"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-orange-100 flex items-center justify-center flex-shrink-0 border border-orange-200">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-black text-orange-900 leading-tight mb-0.5">
                {unpaidStats.count} Pesanan
              </p>
              <p className="text-[11px] font-bold text-orange-600 uppercase tracking-tight">
                {formatCurrency(unpaidStats.earnings)} Belum Disetor
              </p>
            </div>
          </div>
          <div className="p-2 rounded-xl bg-orange-100 text-[10px] font-black text-orange-700 flex items-center gap-1 uppercase tracking-wider">
            Lihat <ChevronRight className="h-3 w-3" />
          </div>
        </div>
      )}

      {/* Status Toggle — ON / STAY / OFF */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-5">
          <p className="text-[10px] uppercase font-black text-gray-400 tracking-[0.2em]">Status Operasional</p>
          {courierStatus === 'off' && (liveUser as any)?.off_reason && (
            <Badge variant="secondary" className="text-[10px] border-red-100 text-red-600 font-black bg-red-50/50 uppercase tracking-tighter">
              HALT: {(liveUser as any).off_reason}
            </Badge>
          )}
        </div>

        {isSuspended ? (
          <div className="p-4 rounded-2xl bg-red-50 border border-red-100 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            <p className="text-xs text-red-600 font-black uppercase tracking-tight">Akun Terblokir — Hubungi Admin</p>
          </div>
        ) : (
          <div className="flex gap-2.5">
            <button
              onClick={handleSetOn}
              disabled={isSuspended || isUpdatingStatus}
              className={cn(
                "flex-1 flex flex-col items-center gap-1.5 py-4 rounded-2xl text-[10px] font-black border transition-all active:scale-95 uppercase tracking-widest",
                courierStatus === 'on'
                  ? "bg-emerald-600 text-white border-emerald-600 shadow-xl shadow-emerald-100"
                  : "bg-gray-50 text-gray-400 border-gray-100 hover:border-emerald-200"
              )}
            >
              <span className="text-lg mb-0.5">{isUpdatingStatus && courierStatus !== 'on' ? "..." : "⚡"}</span>
              {courierStatus === 'on' ? "Aktif" : "Bekerja"}
            </button>
            <button
              onClick={handleSetStay}
              disabled={isSuspended || isUpdatingStatus}
              className={cn(
                "flex-1 flex flex-col items-center gap-1.5 py-4 rounded-2xl text-[10px] font-black border transition-all active:scale-95 uppercase tracking-widest",
                courierStatus === 'stay'
                  ? "bg-blue-600 text-white border-blue-600 shadow-xl shadow-blue-100"
                  : "bg-gray-50 text-gray-400 border-gray-100 hover:border-blue-200"
              )}
            >
              <span className="text-lg mb-0.5">{isUpdatingStatus && courierStatus !== 'stay' ? "..." : "🏠"}</span>
              STAY
            </button>
            <button
              onClick={() => setShowOffModal(true)}
              disabled={isSuspended || isUpdatingStatus}
              className={cn(
                "flex-1 flex flex-col items-center gap-1.5 py-4 rounded-2xl text-[10px] font-black border transition-all active:scale-95 uppercase tracking-widest",
                courierStatus === 'off'
                  ? "bg-red-600 text-white border-red-600 shadow-xl shadow-red-100"
                  : "bg-gray-50 text-gray-400 border-gray-100 hover:border-red-200"
              )}
            >
              <span className="text-lg mb-0.5">{isUpdatingStatus && courierStatus !== 'off' ? "..." : "🛑"}</span>
              OFF
            </button>
          </div>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Setoran', val: formatShortCurrency(todayStats.earnings), icon: DollarSign, color: 'emerald' },
          { label: 'Selesai', val: todayStats.count, icon: CheckCircle, color: 'blue' },
          { label: 'Jalan', val: activeOrders.length, icon: Clock, color: 'orange' }
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-3xl p-4 shadow-sm border border-gray-100/50 text-center flex flex-col items-center justify-between min-h-[115px]">
            <div className={cn(
              "w-11 h-11 rounded-2xl flex items-center justify-center mb-2 border",
              stat.color === 'emerald' ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
              stat.color === 'blue' ? "bg-blue-50 text-blue-600 border-blue-100" :
              "bg-orange-50 text-orange-600 border-orange-100"
            )}>
              <stat.icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-base font-black text-gray-900 leading-tight tracking-tight">{stat.val}</p>
              <p className="text-[9px] uppercase font-black text-gray-400 tracking-widest mt-0.5">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Active Orders Section */}
      <div className="pt-2">
        <div className="flex items-center justify-between mb-4 px-1">
          <h2 className="text-xs font-black text-gray-900 uppercase tracking-[0.2em]">Pesanan Aktif</h2>
          <Badge variant="secondary" className="bg-gray-100 text-gray-500 font-black text-[10px] rounded-lg px-2">
            {activeOrders.length}
          </Badge>
        </div>

        {activeOrders.length === 0 ? (
          <div className="bg-white rounded-[2.5rem] p-12 shadow-sm border border-gray-100 text-center">
            <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-5 border border-gray-100">
              <Package className="h-10 w-10 text-gray-200" />
            </div>
            <p className="text-sm font-black text-gray-400 uppercase tracking-tight">KOSONG</p>
            <p className="text-[11px] text-gray-400 mt-1 font-medium">Belum ada pesanan masuk</p>
          </div>
        ) : (
          <div className="space-y-3.5">
            {activeOrders.map((order: Order) => (
              <button
                key={order.id}
                onClick={() => navigate(`/courier/orders/${order.id}`)}
                className="group w-full bg-white rounded-3xl p-5 shadow-sm border border-gray-100/70 text-left hover:border-emerald-400 hover:shadow-xl hover:shadow-emerald-50 transition-all active:scale-[0.98]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-[10px] font-black bg-gray-900 text-white px-2.5 py-0.5 rounded-lg tracking-tighter">
                        #{order.order_number}
                      </span>
                      <Badge variant={getStatusBadgeVariant(order.status)} className="font-black text-[9px] uppercase tracking-widest h-5">
                        {getStatusLabel(order.status, 'courier')}
                      </Badge>
                    </div>
                    <p className="text-lg font-black text-gray-900 mb-1 tracking-tight">{order.customer_name}</p>
                    <div className="flex items-center gap-2 mb-4">
                      <Badge variant="secondary" className="text-[10px] border-emerald-100 text-emerald-600 font-bold bg-emerald-50/50 lowercase">
                        {order.customer_address}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center justify-between mt-2 pt-4 border-t border-gray-50">
                      <div className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-wider">
                        <Clock className="h-3 w-3" />
                        {order.created_at ? format(parseISO(order.created_at), 'MMM dd, HH:mm') : '-'}
                      </div>
                      <div className="bg-emerald-50 px-4 py-1.5 rounded-xl border border-emerald-100 shadow-sm shadow-emerald-50">
                        <p className="text-sm font-black text-emerald-600">
                          {formatCurrency(order.total_fee || 0)}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="w-11 h-11 rounded-2xl bg-gray-50 flex items-center justify-center text-gray-400 border border-gray-100 flex-shrink-0 mt-3 transition-all group-hover:bg-emerald-50 group-hover:text-emerald-700 group-hover:border-emerald-100 group-hover:scale-110">
                    <ChevronRight className="h-6 w-6" />
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Modal Alasan OFF */}
      {showOffModal && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-xl flex items-center justify-center z-[100] px-5 animate-in fade-in duration-300">
          <div className="bg-white rounded-[2.5rem] p-7 w-full max-w-sm space-y-6 animate-in zoom-in-95 duration-300 border border-white/20 shadow-2xl">
            <div className="text-center">
              <div className="w-14 h-14 bg-red-50 text-red-500 rounded-3xl flex items-center justify-center mx-auto mb-4 border border-red-100">
                <Clock className="h-7 w-7" />
              </div>
              <h3 className="font-black text-xl text-gray-900 tracking-tight">Istirahat Sejenak?</h3>
              <p className="text-xs text-gray-500 font-medium mt-1">Pilih alasan kamu ingin offline.</p>
            </div>
            
            <div className="grid grid-cols-1 gap-2.5">
              {OFF_REASONS.map(r => (
                <button
                  key={r.value}
                  onClick={() => setSelectedOffReason(r.value)}
                  className={cn(
                    "w-full text-left px-5 py-4 rounded-2xl border text-xs font-black transition-all uppercase tracking-wider",
                    selectedOffReason === r.value
                      ? "bg-red-600 border-red-600 text-white shadow-lg shadow-red-100"
                      : "bg-gray-50 border-gray-100 text-gray-500 hover:bg-gray-100"
                  )}
                >
                  {r.label}
                </button>
              ))}
            </div>

            {selectedOffReason === 'Lainnya' && (
              <input
                type="text"
                placeholder="Tulis alasan lainnya..."
                value={customOffReason}
                onChange={e => setCustomOffReason(e.target.value)}
                className="w-full border-2 border-gray-100 bg-gray-50 rounded-2xl px-5 py-4 text-xs font-black uppercase tracking-tight focus:outline-none focus:border-red-400 transition-all placeholder:text-gray-300"
              />
            )}

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => { setShowOffModal(false); setSelectedOffReason(''); setCustomOffReason(''); }}
                className="flex-1 py-4 bg-gray-100 rounded-2xl text-[10px] font-black text-gray-500 active:scale-95 transition-all uppercase tracking-widest"
              >
                Kembali
              </button>
              <button
                onClick={handleConfirmOff}
                disabled={!selectedOffReason || (selectedOffReason === 'Lainnya' && !customOffReason)}
                className="flex-1 py-4 bg-red-600 text-white rounded-2xl text-[10px] font-black shadow-xl shadow-red-100 active:scale-95 transition-all disabled:opacity-50 uppercase tracking-widest"
              >
                Konfirmasi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
