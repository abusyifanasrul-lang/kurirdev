import { useState, useEffect } from 'react';
import { Database, RefreshCw, Trash2, CheckCircle2, AlertCircle, Clock, Shield, Zap, Cloud, Info, X, ShieldAlert, Loader2, ArrowRight } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useCustomerStore } from '@/stores/useCustomerStore';
import { useUserStore } from '@/stores/useUserStore';
import { useOrderStore } from '@/stores/useOrderStore';
import { localDB } from '@/lib/orderCache';
import { getCleanupStats, cleanupDummyOrders, type CleanupResult } from '@/scripts/cleanupOrders';
import type { User as UserType, Order } from '@/types';

interface StorageTabProps {
  onResync: () => void;
  isSyncing: boolean;
  syncMessage: string;
  cacheMeta?: any;
  user: UserType | null;
  users: UserType[];
  getOrphanedOrdersLocal: (activeIds: string[]) => Promise<Order[]>;
}

export function StorageTab({ 
  onResync, 
  isSyncing, 
  syncMessage,
  cacheMeta,
  user,
  users,
  getOrphanedOrdersLocal
}: StorageTabProps) {
  const [stats, setStats] = useState({
    orders: 0,
    customers: 0,
    profiles: 0,
    notifications: 0,
    lastSync: '',
    lastCustomerSync: '',
    lastProfileSync: ''
  });

  const [cloudStats, setCloudStats] = useState({
    orders: 0,
    customers: 0,
    profiles: 0
  });
  
  const [syncResult, setSyncResult] = useState<{
    type: string;
    before: number;
    after: number;
    added: number;
  } | null>(null);
  
  const [localSyncing, setLocalSyncing] = useState<string | null>(null);

  // Maintenance Modal State
  const [maintModal, setMaintModal] = useState<{
    isOpen: boolean;
    phase: 'analyzing' | 'confirm' | 'executing' | 'success';
    stats: CleanupResult | null;
    challenge: string;
  }>({
    isOpen: false,
    phase: 'analyzing',
    stats: null,
    challenge: ''
  });

  const refreshStats = async () => {
    // Local counts
    const oCount = await localDB.orders.count();
    const cCount = await localDB.customers.count();
    const pCount = await localDB.profiles.count();
    const nCount = await localDB.notifications.count();
    
    const metaRaw = localStorage.getItem('kurirdev_db_meta');
    const meta = metaRaw ? JSON.parse(metaRaw) : {};

    setStats({
      orders: oCount,
      customers: cCount,
      profiles: pCount,
      notifications: nCount,
      lastSync: meta.last_sync || 'Never',
      lastCustomerSync: meta.last_customer_sync || 'Never',
      lastProfileSync: meta.last_profile_sync || 'Never'
    });

    // Cloud counts (Silent fetch)
    try {
      const [remoteOrders, remoteCustomers, remoteProfiles] = await Promise.all([
        supabase.from('orders').select('*', { count: 'exact', head: true }),
        supabase.from('customers').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('*', { count: 'exact', head: true })
      ]);

      setCloudStats({
        orders: remoteOrders.count || 0,
        customers: remoteCustomers.count || 0,
        profiles: remoteProfiles.count || 0
      });
    } catch (err) {
      console.warn('Failed to fetch cloud stats:', err);
    }
  };

  useEffect(() => {
    refreshStats();
  }, []);

  const handleManualSync = async (type: 'customers' | 'profiles' | 'orders') => {
    setLocalSyncing(type);
    
    // Capture before count
    const beforeCount = type === 'customers' ? await localDB.customers.count() :
                        type === 'profiles' ? await localDB.profiles.count() :
                        await localDB.orders.count();

    try {
      if (type === 'customers') {
        await useCustomerStore.getState().syncFromServer();
      } else if (type === 'profiles') {
        await useUserStore.getState().syncFromServer();
      } else if (type === 'orders') {
        await useOrderStore.getState().fetchInitialOrders();
      }
      
      // Capture after count
      const afterCount = type === 'customers' ? await localDB.customers.count() :
                        type === 'profiles' ? await localDB.profiles.count() :
                        await localDB.orders.count();
      
      const diff = afterCount - beforeCount;

      setSyncResult({
        type: type.charAt(0).toUpperCase() + type.slice(1),
        before: beforeCount,
        after: afterCount,
        added: diff
      });
      
      await refreshStats();
      setTimeout(() => setSyncResult(null), 5000);
    } catch (err) {
      console.error(`Manual sync failed for ${type}:`, err);
    } finally {
      setLocalSyncing(null);
    }
  };

  const handleScanOrphans = async () => {
    const activeIds = users.filter(u => u.role === 'courier').map(u => u.id);
    const orphans = await getOrphanedOrdersLocal(activeIds);
    if (orphans.length === 0) {
      alert('✅ Tidak ditemukan order yatim. Semua data sinkron!');
    } else {
      if (window.confirm(`⚠️ Ditemukan ${orphans.length} order yatim!\n\nTindakan ini akan memindai database lokal untuk mencari order yang tidak memiliki pemilik (kurir sudah dihapus).\n\nApa Anda ingin melihat detailnya di halaman Penagihan?`)) {
        window.location.href = '/finance/penagihan';
      }
    }
  };

  const startCleanupFlow = async () => {
    setMaintModal({ isOpen: true, phase: 'analyzing', stats: null, challenge: '' });
    
    try {
      // Step 1: Analyze impact
      const stats = await getCleanupStats(60); // 60 min buffer
      setMaintModal(prev => ({ ...prev, phase: 'confirm', stats }));
    } catch (err) {
      console.error('Analysis failed:', err);
      setMaintModal(prev => ({ ...prev, isOpen: false }));
      alert('Gagal menganalisis database.');
    }
  };

  const executeCleanup = async () => {
    if (maintModal.challenge.toLowerCase() !== 'saya mengerti') return;
    
    setMaintModal(prev => ({ ...prev, phase: 'executing' }));
    
    try {
      const result = await cleanupDummyOrders({ safetyBufferMinutes: 60 });
      setMaintModal(prev => ({ ...prev, phase: 'success', stats: result }));
      await refreshStats();
    } catch (err) {
      console.error('Cleanup failed:', err);
      alert('Cleanup gagal dieksekusi.');
      setMaintModal(prev => ({ ...prev, isOpen: false }));
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Sync Status Card */}
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-teal-50 p-2.5 rounded-xl text-teal-600">
            <Database className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">Storage & Mirroring</h3>
            <p className="text-sm text-gray-500">Manage your local data mirror for offline use.</p>
          </div>
        </div>


        {syncResult && (
          <div className="mb-6 p-4 bg-teal-50 border border-teal-100 rounded-2xl shadow-sm animate-in slide-in-from-top-4 duration-300 ring-4 ring-teal-500/5">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-teal-800 font-bold">
                <Info className="h-4 w-4" />
                <span>Ringkasan Sinkronisasi: {syncResult.type}</span>
              </div>
              <button onClick={() => setSyncResult(null)} className="text-teal-500 hover:text-teal-700">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white/60 p-2 rounded-xl border border-teal-100">
                <p className="text-[10px] text-teal-600 font-bold uppercase tracking-wider mb-0.5">Lokal Lama</p>
                <p className="text-lg font-black text-teal-900">{syncResult.before}</p>
              </div>
              <div className="bg-white/60 p-2 rounded-xl border border-teal-100">
                <p className="text-[10px] text-teal-600 font-bold uppercase tracking-wider mb-0.5">Lokal Baru</p>
                <p className="text-lg font-black text-teal-900">{syncResult.after}</p>
              </div>
              <div className="bg-teal-600 p-2 rounded-xl border border-teal-500 shadow-inner">
                <p className="text-[10px] text-white/80 font-bold uppercase tracking-wider mb-0.5">Tersaring</p>
                <p className="text-lg font-black text-white">{syncResult.added > 0 ? `+${syncResult.added}` : syncResult.added}</p>
              </div>
            </div>
            <p className="mt-2.5 text-[10px] text-teal-700 leading-relaxed font-medium">
               {syncResult.added > 0 
                 ? `Terdapat ${syncResult.added} record baru yang berhasil diunduh dan dipasang ke penyimpanan lokal.`
                 : `Tidak ada record baru yang ditemukan. Penyimpanan lokal Anda sudah mutakhir.`}
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 flex flex-col justify-between h-full group">
            <div>
              <div className="flex justify-between items-start mb-2">
                <span className="text-sm font-semibold text-gray-700">Cached Orders</span>
                <div className="flex flex-col items-end gap-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-400">Total:</span>
                    <span className="bg-white px-2 py-0.5 rounded-lg text-xs font-bold text-teal-600 border border-teal-100 shadow-sm min-w-[32px] text-center">
                      {stats.orders}
                    </span>
                  </div>
                  {cloudStats.orders > stats.orders && (
                    <div className="flex items-center gap-1 text-[9px] text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded-md border border-amber-100 animate-pulse">
                      <Cloud className="h-2.5 w-2.5" />
                      Gap: {cloudStats.orders - stats.orders}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-gray-400 mb-4">
                <Clock className="h-3 w-3" />
                Updated: {stats.lastSync !== 'Never' ? new Date(stats.lastSync).toLocaleString() : 'Never'}
              </div>
            </div>
            <button
              onClick={() => handleManualSync('orders')}
              disabled={!!localSyncing}
              className={`w-full py-2 bg-white border rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm
                ${cloudStats.orders > stats.orders 
                  ? 'border-amber-200 text-amber-700 hover:bg-amber-50 hover:border-amber-300 ring-2 ring-amber-500/10' 
                  : 'border-gray-200 text-gray-700 hover:bg-teal-50 hover:text-teal-700 hover:border-teal-200'}`}
            >
              <RefreshCw className={`h-3 w-3 ${localSyncing === 'orders' ? 'animate-spin' : ''}`} />
              {cloudStats.orders > stats.orders ? 'Sync Data Baru' : 'Fetch Latest'}
            </button>
          </div>

          {/* Customers Stat */}
          <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 flex flex-col justify-between h-full group">
            <div>
              <div className="flex justify-between items-start mb-2">
                <span className="text-sm font-semibold text-gray-700">Cached Customers</span>
                <div className="flex flex-col items-end gap-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-400">Total:</span>
                    <span className="bg-white px-2 py-0.5 rounded-lg text-xs font-bold text-teal-600 border border-teal-100 shadow-sm min-w-[32px] text-center">
                      {stats.customers}
                    </span>
                  </div>
                  {cloudStats.customers > stats.customers && (
                    <div className="flex items-center gap-1 text-[9px] text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded-md border border-amber-100 animate-pulse">
                      <Cloud className="h-2.5 w-2.5" />
                      Gap: {cloudStats.customers - stats.customers}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-gray-400 mb-4">
                <Clock className="h-3 w-3" />
                Updated: {stats.lastCustomerSync !== 'Never' ? new Date(stats.lastCustomerSync).toLocaleString() : 'Never'}
              </div>
            </div>
            <button
              onClick={() => handleManualSync('customers')}
              disabled={!!localSyncing}
              className={`w-full py-2 bg-white border rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm
                ${cloudStats.customers > stats.customers 
                  ? 'border-amber-200 text-amber-700 hover:bg-amber-50 hover:border-amber-300 ring-2 ring-amber-500/10' 
                  : 'border-gray-200 text-gray-700 hover:bg-teal-50 hover:text-teal-700 hover:border-teal-200'}`}
            >
              <RefreshCw className={`h-3 w-3 ${localSyncing === 'customers' ? 'animate-spin' : ''}`} />
              {cloudStats.customers > stats.customers ? 'Sync Data Baru' : 'Sync Base'}
            </button>
          </div>

          {/* Profiles Stat */}
          <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 flex flex-col justify-between h-full group">
            <div>
              <div className="flex justify-between items-start mb-2">
                <span className="text-sm font-semibold text-gray-700">User Profiles</span>
                <div className="flex flex-col items-end gap-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-400">Total:</span>
                    <span className="bg-white px-2 py-0.5 rounded-lg text-xs font-bold text-teal-600 border border-teal-100 shadow-sm min-w-[32px] text-center">
                      {stats.profiles}
                    </span>
                  </div>
                  {cloudStats.profiles > stats.profiles && (
                    <div className="flex items-center gap-1 text-[9px] text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded-md border border-amber-100 animate-pulse">
                      <Cloud className="h-2.5 w-2.5" />
                      Gap: {cloudStats.profiles - stats.profiles}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-gray-400 mb-4">
                <Clock className="h-3 w-3" />
                Updated: {stats.lastProfileSync !== 'Never' ? new Date(stats.lastProfileSync).toLocaleString() : 'Never'}
              </div>
            </div>
            <button
              onClick={() => handleManualSync('profiles')}
              disabled={!!localSyncing}
              className={`w-full py-2 bg-white border rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm
                ${cloudStats.profiles > stats.profiles 
                  ? 'border-amber-200 text-amber-700 hover:bg-amber-50 hover:border-amber-300 ring-2 ring-amber-500/10' 
                  : 'border-gray-200 text-gray-700 hover:bg-teal-50 hover:text-teal-700 hover:border-teal-200'}`}
            >
              <RefreshCw className={`h-3 w-3 ${localSyncing === 'profiles' ? 'animate-spin' : ''}`} />
              {cloudStats.profiles > stats.profiles ? 'Sync Data Baru' : 'Sync Profiles'}
            </button>
          </div>

        </div>
      </div>

      {/* Panel 2: Data & Sinkronisasi */}
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-rose-50 p-2.5 rounded-xl text-rose-600">
            <RefreshCw className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">Data & Sinkronisasi</h3>
            <p className="text-sm text-gray-500">Peliharaan dan status data real-time Anda.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Total Record Card */}
          {cacheMeta && (
            <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 flex flex-col justify-between h-full">
              <div>
                <div className="flex justify-between items-start mb-2">
                  <span className="text-sm font-semibold text-gray-700">Total Record</span>
                  <span className="bg-white px-2 py-0.5 rounded-lg text-xs font-bold text-gray-600 border border-gray-100 shadow-sm">
                    {cacheMeta.total_records}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-gray-400 mb-1 leading-relaxed">
                  <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                  Seluruh data order telah tersimpan di penyimpanan lokal perangkat ini.
                </div>
              </div>
              <div className="mt-4 text-[10px] text-teal-600 font-bold uppercase tracking-wider">
                Full Database Mirror
              </div>
            </div>
          )}

          {/* Sync Status Card */}
          {cacheMeta && (
            <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100/50 flex flex-col justify-between h-full">
              <div>
                <div className="flex justify-between items-start mb-2">
                  <span className="text-sm font-semibold text-emerald-800">Status Sinkronisasi</span>
                  <div className={`w-2.5 h-2.5 rounded-full mt-1 ${cacheMeta.sync_completed ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                </div>
                <div className="flex flex-col gap-1">
                  <p className="text-xl font-bold text-emerald-950">
                    {cacheMeta.sync_completed ? 'Terhubung' : 'Terbatas'}
                  </p>
                  <p className="text-[10px] text-emerald-600 font-medium leading-relaxed">
                    Aplikasi siap digunakan {cacheMeta.sync_completed ? 'dalam mode offline penuh.' : 'namun perlu sinkronisasi manual.'}
                  </p>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-emerald-100/50 flex items-center gap-2">
                <div className="h-1 flex-1 bg-emerald-100 rounded-full overflow-hidden">
                   <div className={`h-full ${cacheMeta.sync_completed ? 'w-full' : 'w-1/2'} bg-emerald-500`} />
                </div>
                <span className="text-[10px] font-bold text-emerald-700 uppercase">{cacheMeta.sync_completed ? '100%' : '50%'}</span>
              </div>
            </div>
          )}

          {/* Reset & Resync Card */}
          <div className="p-4 bg-rose-50/50 rounded-2xl border border-rose-100/50 flex flex-col justify-between h-full">
            <div>
              <div className="flex justify-between items-start mb-2">
                <span className="text-sm font-bold text-rose-800">Data & Sinkronisasi</span>
                <Trash2 className="h-4 w-4 text-rose-500" />
              </div>
              <p className="text-[10px] text-rose-600 mb-4 leading-relaxed font-medium">
                Pembersihan total cache lokal dan unduh ulang semua data dari pusat.
              </p>
            </div>
            <button
              onClick={onResync}
              disabled={isSyncing}
              className="w-full py-2.5 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700 hover:shadow-lg hover:shadow-rose-100 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSyncing ? (
                <>
                  <RefreshCw className="h-3 w-3 animate-spin" />
                  {syncMessage || 'Resetting...'}
                </>
              ) : (
                <>
                  <Database className="h-3 w-3" />
                  Reset & Sync Semua
                </>
              )}
            </button>
          </div>
        </div>
      </div>
      <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex gap-3 text-amber-800">
        <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
        <div>
          <h4 className="text-sm font-bold">Privacy & Auto-pruning</h4>
          <p className="text-xs mt-1 leading-relaxed">
            Data mirroring stores orders on this device for 90 days. Older orders are automatically pruned to save space. 
            All data is encrypted and tied to your current session.
          </p>
        </div>
      </div>

      {/* Super Admin Section */}
      {user?.role === 'admin' && (
        <div className="bg-rose-50/30 p-6 rounded-2xl border-2 border-rose-100 shadow-sm mt-8 relative overflow-hidden">
          {/* Danger Zone Watermark */}
          <div className="absolute top-0 right-0 p-4 opacity-[0.03] pointer-events-none">
            <ShieldAlert className="h-32 w-32 -rotate-12" />
          </div>

          <div className="flex items-center gap-3 mb-6 relative">
            <div className="bg-rose-600 p-2.5 rounded-xl text-white shadow-lg shadow-rose-200">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-rose-900">Danger Zone</h3>
                <span className="px-2 py-0.5 bg-rose-600 text-white text-[10px] font-black rounded uppercase tracking-widest">Admin Only</span>
              </div>
              <p className="text-sm text-rose-700/70 font-medium">Tools pemeliharaan dengan risiko tinggi terhadap data online.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative">
            <div className="p-5 bg-white rounded-2xl border border-rose-100 space-y-3 shadow-sm hover:shadow-md transition-shadow">
              <h4 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                <Shield className="h-4 w-4 text-rose-500" />
                Integritas Order Yatim
              </h4>
              <p className="text-xs text-gray-500 leading-relaxed">
                Memindai order yang terikat pada kurir yang sudah dihapus. Data ini biasanya muncul akibat sinkronisasi yang tidak sempurna.
              </p>
              <button
                onClick={handleScanOrphans}
                className="w-full py-2.5 bg-rose-100 text-rose-700 rounded-xl text-xs font-bold hover:bg-rose-600 hover:text-white transition-all transform active:scale-95"
              >
                Scan Orphaned Orders
              </button>
            </div>

            <div className="p-5 bg-white rounded-2xl border border-rose-100 space-y-3 shadow-sm hover:shadow-md transition-shadow">
              <h4 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                <Trash2 className="h-4 w-4 text-rose-600" />
                Pembersihan Dummy
              </h4>
              <p className="text-xs text-gray-500 leading-relaxed">
                Menutup/membatalkan order yang "stale" (terhenti di tengah jalan) untuk membersihkan database.
              </p>
              <button
                onClick={startCleanupFlow}
                className="w-full py-2.5 bg-white border-2 border-rose-600 text-rose-600 rounded-xl text-xs font-black hover:bg-rose-600 hover:text-white transition-all transform active:scale-95 flex items-center justify-center gap-2"
              >
                <Zap className="h-3.3 w-3.3" />
                Cleanup Dummy Orders
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Maintenance Modal Overlay */}
      {maintModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-8 duration-300">
            {/* Modal Header */}
            <div className="bg-rose-600 p-6 text-white relative">
              <div className="flex items-center gap-3">
                <div className="bg-white/20 p-2 rounded-xl">
                  {maintModal.phase === 'analyzing' ? <Loader2 className="h-6 w-6 animate-spin" /> : 
                   maintModal.phase === 'success' ? <CheckCircle2 className="h-6 w-6" /> : 
                   <ShieldAlert className="h-6 w-6" />}
                </div>
                <div>
                  <h3 className="text-xl font-black">Database Maintenance</h3>
                  <p className="text-sm text-rose-100 font-medium">
                    {maintModal.phase === 'analyzing' ? 'Menganalisis Database...' :
                     maintModal.phase === 'confirm' ? 'Konfirmasi Tindakan' :
                     maintModal.phase === 'executing' ? 'Mengeksekusi Cleanup...' :
                     'Cleanup Berhasil'}
                  </p>
                </div>
              </div>
              {maintModal.phase !== 'executing' && (
                <button 
                  onClick={() => setMaintModal(prev => ({ ...prev, isOpen: false }))}
                  className="absolute top-6 right-6 p-1 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>

            {/* Modal Body */}
            <div className="p-6">
              {maintModal.phase === 'analyzing' && (
                <div className="py-8 text-center space-y-4">
                  <Loader2 className="h-12 w-12 text-rose-600 animate-spin mx-auto" />
                  <p className="text-gray-600 font-medium font-inter">Mohon tunggu, kami sedang memetakan order yang terdampak...</p>
                </div>
              )}

              {maintModal.phase === 'confirm' && maintModal.stats && (
                <div className="space-y-6">
                  <div className="bg-rose-50 border border-rose-100 p-4 rounded-2xl space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-rose-700 uppercase tracking-wider">Estimasi Dampak</span>
                      <span className="bg-rose-600 text-white text-[10px] font-black px-2 py-0.5 rounded">LIVE DATA</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center p-3 bg-white rounded-xl border border-rose-100 shadow-sm">
                        <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">To be Delivered</p>
                        <p className="text-2xl font-black text-emerald-600">{maintModal.stats.delivered}</p>
                      </div>
                      <div className="text-center p-3 bg-white rounded-xl border border-rose-100 shadow-sm">
                        <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">To be Cancelled</p>
                        <p className="text-2xl font-black text-rose-600">{maintModal.stats.cancelled}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 pt-2 border-t border-rose-100/50">
                      <Info className="h-3 w-3 text-rose-400 shrink-0" />
                      <p className="text-[10px] text-rose-600/80 font-medium leading-tight">
                        Order dengan tagihan &gt; 0 akan diselesaikan (Delivered), sisanya akan dibatalkan.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-2xl">
                      <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-black text-amber-900 mb-1 leading-normal uppercase">Peringatan Keras</p>
                        <p className="text-[11px] text-amber-800 leading-relaxed font-medium">
                          Tindakan ini bersifat permanen. Order yang dalam proses (aktif) <span className="underline decoration-2">mungkin ikut terdampak</span> jika tidak memiliki aktivitas dalam 60 menit terakhir.
                        </p>
                      </div>
                    </div>

                    <div className="pt-2">
                      <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-2 px-1">Verifikasi Admin</label>
                      <input 
                        type="text"
                        placeholder='Ketik "saya mengerti" untuk konfirmasi'
                        value={maintModal.challenge}
                        onChange={(e) => setMaintModal(prev => ({ ...prev, challenge: e.target.value }))}
                        className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-xl focus:border-rose-500 focus:ring-0 text-sm font-medium transition-all"
                      />
                    </div>
                  </div>

                  <button
                    onClick={executeCleanup}
                    disabled={maintModal.challenge.toLowerCase() !== 'saya mengerti'}
                    className="w-full py-4 bg-rose-600 text-white rounded-2xl font-black text-sm shadow-xl shadow-rose-200 hover:bg-rose-700 disabled:opacity-30 disabled:grayscale transition-all flex items-center justify-center gap-2 group"
                  >
                    Eksekusi Cleanup Sekarang
                    <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>
              )}

              {maintModal.phase === 'executing' && (
                <div className="py-12 text-center space-y-6">
                  <div className="relative inline-block">
                    <Loader2 className="h-16 w-16 text-rose-600 animate-spin mx-auto" />
                    <Zap className="h-6 w-6 text-rose-600 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
                  </div>
                  <div className="space-y-2">
                    <p className="text-lg font-black text-gray-900 tracking-tight">Sedang Menanam Ulang Database...</p>
                    <p className="text-sm text-gray-500 font-medium px-8 leading-relaxed">Mohon jangan menutup jendela ini hingga proses sinkronisasi server selesai.</p>
                  </div>
                </div>
              )}

              {maintModal.phase === 'success' && maintModal.stats && (
                <div className="space-y-6 animate-in zoom-in-95 duration-500">
                  <div className="bg-emerald-50 border border-emerald-100 p-6 rounded-3xl text-center space-y-4">
                    <div className="w-16 h-16 bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto shadow-lg shadow-emerald-100">
                      <CheckCircle2 className="h-8 w-8" />
                    </div>
                    <div>
                      <h4 className="text-xl font-black text-emerald-900">Operasi Berhasil</h4>
                      <p className="text-sm text-emerald-700/70 font-medium">Database telah dibersihkan dan dioptimasi.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                      <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">Total Cleanup</p>
                      <p className="text-2xl font-black text-gray-900">{maintModal.stats.count}</p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                      <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">Status Server</p>
                      <p className="text-xs font-black text-emerald-600 flex items-center gap-1">
                        <Zap className="h-3 w-3" /> OPTIMIZED
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => setMaintModal(prev => ({ ...prev, isOpen: false }))}
                    className="w-full py-4 bg-gray-900 text-white rounded-2xl font-black text-sm hover:bg-black transition-colors"
                  >
                    Tutup Panel Maintenance
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
