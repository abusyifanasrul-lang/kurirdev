import { useState, useEffect, useCallback } from 'react';
import {
  ShieldAlert, Activity, Database, RefreshCw, Terminal,
  AlertTriangle, CheckCircle, XCircle, Search, Eye,
  Zap, Clock, Users, Package, Trash2, RotateCcw,
} from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useOrderStore } from '@/stores/useOrderStore';
import { useUserStore } from '@/stores/useUserStore';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import {
  clearAllCache, getCacheMeta, checkIntegrity, DBMeta
} from '@/lib/orderCache';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import type { OrderStatus } from '@/types';

const ORDER_STATUSES: OrderStatus[] = [
  'pending', 'assigned', 'picked_up', 'in_transit', 'delivered', 'cancelled',
];

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Pending',
  assigned: 'Assigned',
  picked_up: 'Picked Up',
  in_transit: 'In Transit',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

type PanelTab = 'health' | 'inspector' | 'force' | 'audit' | 'cache';

// ---

export function SystemDiagnostics() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { orders } = useOrderStore();
  const { users } = useUserStore();

  const [activeTab, setActiveTab] = useState<PanelTab>('health');

  // ── System Health ────────────────────────────────────────
  const [supabaseOk, setSupabaseOk] = useState<boolean | null>(null);
  const [integrity, setIntegrity] = useState<{ ok: boolean; localCount: number; metaCount: number } | null>(null);
  const [swVersion, setSWVersion] = useState<string>('-');
  const [cacheMeta, setCacheMeta] = useState<DBMeta>(getCacheMeta);

  const checkSystemHealth = useCallback(async () => {
    // Supabase ping
    try {
      const { error } = await supabase.from('settings').select('id').eq('id', 'global').single();
      if (error) throw error;
      setSupabaseOk(true);
    } catch {
      setSupabaseOk(false);
    }

    // IndexedDB integrity
    const result = await checkIntegrity();
    setIntegrity(result);

    // Refresh cache meta
    setCacheMeta(getCacheMeta());

    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      setSWVersion(reg ? 'Active' : 'No SW');
    } else {
      setSWVersion('Not Supported');
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'health') checkSystemHealth();
  }, [activeTab, checkSystemHealth]);

  // ── Data Inspector ───────────────────────────────────────
  const [inspectType, setInspectType] = useState<'order' | 'user' | 'customer' | 'log'>('order');
  const [inspectId, setInspectId] = useState('');
  const [inspectResult, setInspectResult] = useState<object | null>(null);
  const [inspectError, setInspectError] = useState('');

  const handleInspect = async () => {
    const searchId = inspectId.trim();
    if (!searchId) {
      setInspectError('Please enter a Record ID or reference.');
      return;
    }
    setInspectResult(null);
    setInspectError('');
    try {
      let collectionName = '';
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(searchId);
      let query = supabase.from('' as any).select('*');
      
      switch (inspectType) {
        case 'order':
          collectionName = 'orders';
          query = supabase.from('orders').select('*');
          if (isUUID) {
            query = query.eq('id', searchId);
          } else {
            query = query.eq('order_number', searchId);
          }
          break;
        case 'user':
          collectionName = 'profiles';
          query = supabase.from('profiles').select('*');
          if (isUUID) {
            query = query.eq('id', searchId);
          } else if (searchId.includes('@')) {
            query = query.eq('email', searchId);
          } else {
            query = query.eq('phone', searchId);
          }
          break;
        case 'customer':
          collectionName = 'customers';
          query = supabase.from('customers').select('*');
          if (isUUID) {
            query = query.eq('id', searchId);
          } else {
            query = query.eq('phone', searchId);
          }
          break;
        case 'log':
          collectionName = 'tracking_logs';
          query = supabase.from('tracking_logs').select('*').eq('id', searchId);
          break;
      }
      
      const { data, error } = await query.maybeSingle();
      
      if (error || !data) {
        setInspectError(`Record "${searchId}" not found in ${collectionName}.`);
      } else {
        setInspectResult(data);
      }
    } catch (e: any) {
      setInspectError(e.message || 'Failed to fetch record.');
    }
  };

  // ── Force Update ─────────────────────────────────────────
  const [forceOrderId, setForceOrderId] = useState('');
  const [forceStatus, setForceStatus] = useState<OrderStatus>('pending');
  const [forceLoading, setForceLoading] = useState(false);
  const [forceMsg, setForceMsg] = useState('');

  const handleForceUpdate = async () => {
    if (!forceOrderId.trim()) { setForceMsg('❌ Order ID wajib diisi.'); return; }
    const confirm = window.confirm(
      `⚠️ Force update order "${forceOrderId}" → "${STATUS_LABELS[forceStatus]}"?\n\nAksi ini tidak bisa dibatalkan.`
    );
    if (!confirm) return;

    setForceLoading(true);
    setForceMsg('');
    try {
      const updateData: any = {
        status: forceStatus,
        updated_at: new Date().toISOString(),
      };

      // Auto-timestamp for specific statuses
      if (forceStatus === 'delivered') {
        updateData.actual_delivery_time = new Date().toISOString();
      } else if (forceStatus === 'picked_up') {
        updateData.actual_pickup_time = new Date().toISOString();
      } else if (forceStatus === 'assigned') {
        updateData.assigned_at = new Date().toISOString();
      } else if (forceStatus === 'cancelled') {
        updateData.cancelled_at = new Date().toISOString();
      }

      const { error } = await (supabase.from('orders') as any).update(updateData).eq('id', forceOrderId.trim());
      
      if (error) throw error;
      setForceMsg(`✅ Status order berhasil diubah → ${STATUS_LABELS[forceStatus]}`);
      
      // Refresh local stats if possible
      checkSystemHealth();
    } catch (e: any) {
      setForceMsg(`❌ Gagal: ${e.message}`);
    } finally {
      setForceLoading(false);
    }
  };

  // ── Audit Trail ──────────────────────────────────────────
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  const loadAuditLogs = useCallback(async () => {
    setAuditLoading(true);
    try {
      const { data, error } = await supabase
        .from('tracking_logs')
        .select('*')
        .order('changed_at', { ascending: false })
        .limit(20);
        
      if (error) throw error;
      setAuditLogs(data || []);
    } catch (e) {
      console.error('Audit load error:', e);
    } finally {
      setAuditLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'audit') loadAuditLogs();
  }, [activeTab, loadAuditLogs]);

  // ── Cache Manager ────────────────────────────────────────
  const [cacheResetting, setCacheResetting] = useState(false);

  const handleResetCache = async () => {
    const confirm = window.confirm(
      'Reset semua data lokal (IndexedDB)? Anda akan di-logout otomatis.'
    );
    if (!confirm) return;
    setCacheResetting(true);
    try {
      await clearAllCache();
      await logout();
      navigate('/');
    } catch (e) {
      console.error(e);
      setCacheResetting(false);
    }
  };

  // ── Tabs Config ──────────────────────────────────────────
  const tabs: { id: PanelTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'health', label: 'System Health', icon: Activity },
    { id: 'inspector', label: 'Data Inspector', icon: Eye },
    { id: 'force', label: 'Force Actions', icon: Zap },
    { id: 'audit', label: 'Audit Trail', icon: Terminal },
    { id: 'cache', label: 'Cache Manager', icon: Database },
  ];

  return (
    <div className="min-h-screen">
      <Header
        title="🛡️ System Diagnostics"
        subtitle="Super Admin God View — intercept, inspect, and fix"
      />

      <div className="p-4 lg:p-8 space-y-6">
        {/* Identity Banner */}
        <div className="flex items-center gap-3 p-4 bg-teal-50 border border-teal-200 rounded-xl">
          <ShieldAlert className="h-6 w-6 text-teal-700 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-teal-900">
              Logged in as Super Admin: {user?.name} ({user?.email})
            </p>
            <p className="text-xs text-teal-600 mt-0.5">
              Semua aksi di halaman ini dicatat dan tidak dapat dibatalkan.
            </p>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {(() => {
            const bgMap: Record<string, string> = {
              teal: 'bg-teal-100',
              blue: 'bg-blue-100',
              emerald: 'bg-emerald-100',
              amber: 'bg-amber-100',
            };
            const textMap: Record<string, string> = {
              teal: 'text-teal-600',
              blue: 'text-blue-600',
              emerald: 'text-emerald-600',
              amber: 'text-amber-600',
            };

            return [
              { label: 'Total Orders (Live)', value: orders.length, icon: Package, color: 'teal' },
              { label: 'Total Users', value: users.length, icon: Users, color: 'blue' },
              { label: 'IndexedDB Records', value: cacheMeta.total_records, icon: Database, color: 'emerald' },
              { label: 'Pending Orders', value: orders.filter(o => o.status === 'pending').length, icon: Clock, color: 'amber' },
            ].map(stat => (
              <Card key={stat.label} className="flex items-center gap-4 p-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${bgMap[stat.color]}`}>
                  <stat.icon className={`h-5 w-5 ${textMap[stat.color]}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                  <p className="text-xs text-gray-500">{stat.label}</p>
                </div>
              </Card>
            ));
          })()}
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 border-b border-gray-200 overflow-x-auto pb-0">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-teal-600 text-teal-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── HEALTH ──────────────────────────────────── */}
        {activeTab === 'health' && (
          <Card>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">System Health Check</h3>
              <Button size="sm" variant="outline" onClick={checkSystemHealth} leftIcon={<RefreshCw className="h-4 w-4" />}>
                Refresh
              </Button>
            </div>
            <div className="space-y-4">
              {[
                {
                  label: 'Supabase Connection',
                  status: supabaseOk,
                  ok: 'Connected (Read/Write OK)',
                  fail: 'Cannot reach Supabase',
                  pending: 'Checking...',
                },
                {
                  label: 'IndexedDB Integrity',
                  status: integrity ? integrity.ok : null,
                  ok: `OK — ${integrity?.localCount ?? 0} records`,
                  fail: `MISMATCH — Local: ${integrity?.localCount ?? 0}, Meta: ${integrity?.metaCount ?? 0}`,
                  pending: 'Checking...',
                },
                {
                  label: 'Last Full Sync',
                  status: (user?.id && cacheMeta.users?.[user.id]?.sync_completed) || cacheMeta.sync_completed ? true : false,
                  ok: (user?.id && cacheMeta.users?.[user.id]?.last_sync) 
                    ? `Completed at ${format(new Date(cacheMeta.users[user.id].last_sync), 'dd MMM yyyy HH:mm')}`
                    : cacheMeta.last_sync
                    ? `Completed at ${format(new Date(cacheMeta.last_sync), 'dd MMM yyyy HH:mm')}`
                    : 'Sync Completed',
                  fail: 'Never synced on this device',
                  pending: 'Checking...',
                },
                {
                  label: 'Service Worker',
                  status: swVersion === 'Active' ? true : swVersion === '-' ? null : false,
                  ok: 'Active — PWA Offline Ready',
                  fail: swVersion,
                  pending: 'Checking...',
                },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
                  <div className="flex items-center gap-3">
                    {item.status === null ? (
                      <RefreshCw className="h-5 w-5 text-gray-400 animate-spin" />
                    ) : item.status ? (
                      <CheckCircle className="h-5 w-5 text-emerald-500" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-500" />
                    )}
                    <span className="font-medium text-gray-800 text-sm">{item.label}</span>
                  </div>
                  <span className={`text-sm ${item.status ? 'text-emerald-600' : item.status === null ? 'text-gray-400' : 'text-red-600'}`}>
                    {item.status === null ? item.pending : item.status ? item.ok : item.fail}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* ── DATA INSPECTOR ──────────────────────────── */}
        {activeTab === 'inspector' && (
          <Card>
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Supabase Record Inspector</h3>
            <div className="flex gap-3 mb-6 flex-wrap">
              <div className="flex gap-2">
                {(['order', 'user', 'customer', 'log'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => { setInspectType(t); setInspectResult(null); setInspectError(''); }}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${inspectType === t ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                  >
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>
              <div className="flex gap-2 flex-1 min-w-0">
                <input
                  type="text"
                  value={inspectId}
                  onChange={e => setInspectId(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleInspect()}
                  placeholder={
                    inspectType === 'order' ? "Enter Order ID or Number (YYMMDD-XXXX)..." :
                    inspectType === 'user' ? "Enter User ID, Email, or Phone..." :
                    inspectType === 'customer' ? "Enter Customer ID or Phone..." :
                    "Enter Record ID (UUID)..."
                  }
                  aria-label={`Record reference to inspect (${inspectType})`}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 font-mono"
                />
                <Button onClick={handleInspect} leftIcon={<Search className="h-4 w-4" />}>
                  Inspect
                </Button>
              </div>
            </div>
            {inspectError && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                <AlertTriangle className="h-4 w-4 inline mr-2" />{inspectError}
              </div>
            )}
            {inspectResult && (
              <div className="bg-gray-900 rounded-xl p-5 overflow-auto max-h-96">
                <pre className="text-green-400 text-xs font-mono leading-relaxed">
                  {JSON.stringify(inspectResult, null, 2)}
                </pre>
              </div>
            )}
            {!inspectResult && !inspectError && (
              <div className="text-center py-16 text-gray-400">
                <Eye className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Masukkan ID record untuk melihat raw data Supabase</p>
              </div>
            )}
          </Card>
        )}

        {/* ── FORCE ACTIONS ────────────────────────────── */}
        {activeTab === 'force' && (
          <div className="space-y-6">
            <Card>
              <div className="flex items-center gap-3 mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
                <p className="text-sm text-amber-800 font-medium">
                  Force Actions mengubah data Supabase secara langsung. Gunakan hanya saat diperlukan untuk memperbaiki order yang tersangkut.
                </p>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Force Update Order Status</h3>
              <div className="space-y-4 max-w-md">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Order ID</label>
                  <input
                    type="text"
                    value={forceOrderId}
                    onChange={e => setForceOrderId(e.target.value)}
                    placeholder="Paste order document ID..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Target Status</label>
                  <select
                    value={forceStatus}
                    onChange={e => setForceStatus(e.target.value as OrderStatus)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500"
                  >
                    {ORDER_STATUSES.map(s => (
                      <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                    ))}
                  </select>
                </div>
                {forceMsg && (
                  <div className={`p-3 rounded-lg text-sm ${forceMsg.startsWith('✅') ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
                    {forceMsg}
                  </div>
                )}
                <Button
                  onClick={handleForceUpdate}
                  isLoading={forceLoading}
                  disabled={!forceOrderId}
                  className="bg-amber-600 hover:bg-amber-700 text-white"
                  leftIcon={<Zap className="h-4 w-4" />}
                >
                  Force Update Status
                </Button>
              </div>
            </Card>

            {/* Super Admin Cleanup */}
            <Card>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">🧹 Database Cleanup Tools</h3>
              <p className="text-sm text-gray-500 mb-4">
                Bersihkan order dummy yang tidak lengkap (tanpa ongkir) dari sesi testing.
              </p>
              <Button
                variant="outline"
                className="border-red-200 text-red-600 hover:bg-red-50"
                onClick={async () => {
                  if (!window.confirm('Bersihkan order dummy (tanpa ongkir) yang lama?')) return;
                  const { cleanupDummyOrders } = await import('@/scripts/cleanupOrders');
                  const result = await cleanupDummyOrders();
                  alert(`✅ Cleanup selesai!\n- Delivered: ${result.delivered}\n- Cancelled: ${result.cancelled}\n- Total: ${result.count}`);
                  checkSystemHealth();
                }}
                leftIcon={<Trash2 className="h-4 w-4" />}
              >
                Cleanup Dummy Orders
              </Button>
            </Card>
          </div>
        )}

        {/* ── AUDIT TRAIL ──────────────────────────────── */}
        {activeTab === 'audit' && (
          <Card>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Audit Trail (Tracking Logs)</h3>
              <Button size="sm" variant="outline" onClick={loadAuditLogs} isLoading={auditLoading} leftIcon={<RefreshCw className="h-4 w-4" />}>
                Refresh
              </Button>
            </div>
            {auditLoading ? (
              <div className="text-center py-12 text-gray-400">
                <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-3" />
                <p className="text-sm">Loading audit logs from Supabase...</p>
              </div>
            ) : auditLogs.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <Terminal className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Tidak ada tracking log ditemukan.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {auditLogs.map(log => (
                  <div key={log.id} className="flex items-start gap-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
                    <div className="w-2 h-2 rounded-full bg-teal-500 mt-2 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {log.changed_by_name || log.changed_by || '?'} → <span className="font-bold">{log.status?.toUpperCase()}</span>
                        </p>
                        <span className="text-xs text-gray-400 shrink-0">
                          {log.changed_at ? format(new Date(log.changed_at), 'dd/MM HH:mm') : '-'}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5 font-mono">
                        Order: {log.order_id || '-'}
                        {log.notes && ` • ${log.notes}`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {/* ── CACHE MANAGER ────────────────────────────── */}
        {activeTab === 'cache' && (
          <Card>
            <h3 className="text-lg font-semibold text-gray-900 mb-6">IndexedDB Cache Manager</h3>
            <div className="space-y-4">
              {[
                { label: 'Total Cached Records', value: `${cacheMeta.total_records} orders` },
                { label: 'Sync Completed', value: cacheMeta.sync_completed ? '✅ Yes' : '❌ No' },
                { label: 'Last Full Sync', value: cacheMeta.last_sync ? format(new Date(cacheMeta.last_sync), 'dd MMM yyyy HH:mm') : 'Never' },
                { label: 'Last Delta Sync', value: cacheMeta.last_delta_sync ? format(new Date(cacheMeta.last_delta_sync), 'dd MMM yyyy HH:mm') : 'Never' },
              ].map(item => (
                <div key={item.label} className="flex justify-between items-center p-4 bg-gray-50 rounded-xl border border-gray-100">
                  <span className="text-sm text-gray-600">{item.label}</span>
                  <span className="text-sm font-semibold text-gray-900">{item.value}</span>
                </div>
              ))}
            </div>
            <div className="mt-6 pt-6 border-t border-gray-200">
              <p className="text-sm text-gray-500 mb-4">
                Reset cache akan menghapus semua data IndexedDB dan me-logout sesi saat ini.
                User perlu login ulang untuk memulai fresh sync.
              </p>
              <Button
                onClick={handleResetCache}
                isLoading={cacheResetting}
                className="bg-red-600 hover:bg-red-700 text-white"
                leftIcon={<RotateCcw className="h-4 w-4" />}
              >
                Reset & Resync All Cache
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
