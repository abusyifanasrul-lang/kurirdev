import { useState, useEffect } from 'react';
import { Database, RefreshCw, Trash2, CheckCircle2, AlertCircle, Clock, Shield, Zap } from 'lucide-react';
import { useCustomerStore } from '@/stores/useCustomerStore';
import { useUserStore } from '@/stores/useUserStore';
import { useOrderStore } from '@/stores/useOrderStore';
import { localDB } from '@/lib/orderCache';
import type { User as UserType, Order } from '@/types';

interface StorageTabProps {
  onResync: () => void;
  isSyncing: boolean;
  syncMessage: string;
  user: UserType | null;
  users: UserType[];
  getOrphanedOrdersLocal: (activeIds: string[]) => Promise<Order[]>;
}

export function StorageTab({ 
  onResync, 
  isSyncing, 
  syncMessage,
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
  
  const [localSyncing, setLocalSyncing] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState('');

  const refreshStats = async () => {
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
  };

  useEffect(() => {
    refreshStats();
  }, []);

  const handleManualSync = async (type: 'customers' | 'profiles' | 'orders') => {
    setLocalSyncing(type);
    try {
      if (type === 'customers') {
        await useCustomerStore.getState().syncFromServer();
      } else if (type === 'profiles') {
        await useUserStore.getState().syncFromServer();
      } else if (type === 'orders') {
        await useOrderStore.getState().fetchInitialOrders();
      }
      setSuccessMsg(`${type.charAt(0).toUpperCase() + type.slice(1)} synced successfully!`);
      await refreshStats();
      setTimeout(() => setSuccessMsg(''), 3000);
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
      if (window.confirm(`⚠️ Ditemukan ${orphans.length} order yatim! Apa Anda ingin melihat detailnya di halaman Penagihan? (Dikelompokkan di "Kurir Terhapus")`)) {
        window.location.href = '/finance/penagihan';
      }
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

        {successMsg && (
          <div className="mb-6 p-3 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-xl flex items-center gap-2 text-sm">
            <CheckCircle2 className="h-4 w-4" />
            {successMsg}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Orders Stat */}
          <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
            <div className="flex justify-between items-start mb-2">
              <span className="text-sm font-medium text-gray-600">Cached Orders</span>
              <span className="bg-white px-2 py-0.5 rounded text-xs font-bold text-teal-600 border border-teal-100">
                {stats.orders}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-gray-400 mb-3">
              <Clock className="h-3 w-3" />
              Last sync: {stats.lastSync !== 'Never' ? new Date(stats.lastSync).toLocaleString() : 'Never'}
            </div>
            <button
              onClick={() => handleManualSync('orders')}
              disabled={!!localSyncing}
              className="w-full py-2 bg-white border border-gray-200 rounded-lg text-xs font-bold text-gray-700 hover:bg-gray-50 transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <RefreshCw className={`h-3 w-3 ${localSyncing === 'orders' ? 'animate-spin' : ''}`} />
              Fetch Latest
            </button>
          </div>

          {/* Customers Stat */}
          <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
            <div className="flex justify-between items-start mb-2">
              <span className="text-sm font-medium text-gray-600">Cached Customers</span>
              <span className="bg-white px-2 py-0.5 rounded text-xs font-bold text-teal-600 border border-teal-100">
                {stats.customers}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-gray-400 mb-3">
              <Clock className="h-3 w-3" />
              Last sync: {stats.lastCustomerSync !== 'Never' ? new Date(stats.lastCustomerSync).toLocaleString() : 'Never'}
            </div>
            <button
              onClick={() => handleManualSync('customers')}
              disabled={!!localSyncing}
              className="w-full py-2 bg-white border border-gray-200 rounded-lg text-xs font-bold text-gray-700 hover:bg-gray-50 transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <RefreshCw className={`h-3 w-3 ${localSyncing === 'customers' ? 'animate-spin' : ''}`} />
              Sync Customers
            </button>
          </div>

          {/* Profiles Stat */}
          <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
            <div className="flex justify-between items-start mb-2">
              <span className="text-sm font-medium text-gray-600">User Profiles</span>
              <span className="bg-white px-2 py-0.5 rounded text-xs font-bold text-teal-600 border border-teal-100">
                {stats.profiles}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-gray-400 mb-3">
              <Clock className="h-3 w-3" />
              Last sync: {stats.lastProfileSync !== 'Never' ? new Date(stats.lastProfileSync).toLocaleString() : 'Never'}
            </div>
            <button
              onClick={() => handleManualSync('profiles')}
              disabled={!!localSyncing}
              className="w-full py-2 bg-white border border-gray-200 rounded-lg text-xs font-bold text-gray-700 hover:bg-gray-50 transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <RefreshCw className={`h-3 w-3 ${localSyncing === 'profiles' ? 'animate-spin' : ''}`} />
              Sync Profiles
            </button>
          </div>

          {/* Reset All */}
          <div className="p-4 bg-red-50 rounded-xl border border-red-100 flex flex-col justify-between">
            <div>
              <span className="text-sm font-bold text-red-700 block mb-1">Reset All Cache</span>
              <p className="text-[10px] text-red-600 mb-3 leading-relaxed">
                Clears all local data and refreshes from server. Use this if you see data inconsistencies.
              </p>
            </div>
            <button
              onClick={onResync}
              disabled={isSyncing}
              className="w-full py-2 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSyncing ? (
                <>
                  <RefreshCw className="h-3 w-3 animate-spin" />
                  {syncMessage || 'Resetting...'}
                </>
              ) : (
                <>
                  <Trash2 className="h-3 w-3" />
                  Reset & Sync All
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Info Box */}
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
        <div className="bg-rose-50 p-6 rounded-2xl border border-rose-100 shadow-sm mt-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-rose-100 p-2.5 rounded-xl text-rose-600">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">Super Admin Maintenance</h3>
              <p className="text-sm text-gray-500">Powerful tools to maintain database integrity.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-white rounded-xl border border-rose-100 space-y-3">
              <h4 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                <Shield className="h-4 w-4 text-rose-500" />
                Data Integrity
              </h4>
              <p className="text-xs text-gray-500">Scan for orders assigned to deleted or invalid courier IDs.</p>
              <button
                onClick={handleScanOrphans}
                className="w-full py-2 bg-rose-600 text-white rounded-lg text-xs font-bold hover:bg-rose-700 transition shadow-sm"
              >
                Scan Orphaned Orders
              </button>
            </div>

            <div className="p-4 bg-white rounded-xl border border-rose-100 space-y-3">
              <h4 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                <Trash2 className="h-4 w-4 text-rose-500" />
                Database Cleanup
              </h4>
              <p className="text-xs text-gray-500">Remove incomplete or temporary "dummy" orders from the server.</p>
              <button
                onClick={async () => {
                  const { cleanupDummyOrders } = await import('@/scripts/cleanupOrders');
                  await cleanupDummyOrders();
                  alert('Cleanup selesai!');
                }}
                className="w-full py-2 border border-rose-200 text-rose-700 rounded-lg text-xs font-bold hover:bg-rose-50 transition"
              >
                Cleanup Dummy Orders
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
