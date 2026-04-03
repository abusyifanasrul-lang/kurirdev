import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { RefreshCw, Shield } from 'lucide-react';
import type { User as UserType, Order } from '@/types';

interface BusinessTabProps {
  commission_rate: number;
  commission_threshold: number;
  onSaveSettings: (data: { commission_rate: number; commission_threshold: number }) => void;
  onResync: () => Promise<void>;
  cacheMeta: {
    last_sync?: string;
    total_records: number;
    sync_completed?: boolean;
    last_delta_sync?: string;
  } | null;
  isSyncing: boolean;
  syncMessage: string;
  user: UserType | null;
  users: UserType[];
  getOrphanedOrdersLocal: (activeIds: string[]) => Promise<Order[]>;
}

export function BusinessTab({
  commission_rate,
  commission_threshold,
  onSaveSettings,
  onResync,
  cacheMeta,
  isSyncing,
  syncMessage,
  user,
  users,
  getOrphanedOrdersLocal,
}: BusinessTabProps) {
  const [form, setForm] = useState({
    commission_rate,
    commission_threshold,
  });

  const handleSave = () => {
    onSaveSettings(form);
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
    <Card>
      <h3 className="text-lg font-semibold text-gray-900 mb-6">Business Settings</h3>
      <p className="text-sm text-gray-500 mb-6">Konfigurasi komisi dan threshold ongkir</p>
      <div className="space-y-4 max-w-md">
          <Input
            label="Commission Rate (%)"
            helperText="Persentase ongkir yang diterima kurir. Sisanya masuk ke admin. Contoh: 80 → kurir dapat 80%, admin dapat 20%"
            type="number"
            value={form.commission_rate}
            onChange={e => setForm(prev => ({ ...prev, commission_rate: Number(e.target.value) }))}
            min={0}
            max={100}
          />
          <Input
            label="Minimum Threshold (Rp)"
            helperText="Ongkir di bawah atau sama dengan nilai ini → kurir dapat 100%, admin tidak dapat potongan. Contoh: 5000 → ongkir ≤ Rp 5.000 tidak dipotong"
            type="number"
            value={form.commission_threshold}
            onChange={e => setForm(prev => ({ ...prev, commission_threshold: Number(e.target.value) }))}
            min={0}
          />
        <div className="pt-4">
          <p className="text-xs text-gray-500 mb-4">
            Preview: Ongkir Rp 15.000 → kurir dapat Rp {Math.round(15000 * form.commission_rate / 100).toLocaleString('id-ID')}, admin dapat Rp {Math.round(15000 * (100 - form.commission_rate) / 100).toLocaleString('id-ID')}
          </p>
          <Button onClick={handleSave}>
            Simpan Pengaturan
          </Button>
        </div>

        {/* Cache Sync Section */}
        <div className="pt-6 border-t mt-6">
          <h4 className="text-sm font-medium text-gray-900 mb-2">⚙️ Local Cache</h4>
          {cacheMeta && (
            <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 mb-4">
              <div className="grid grid-cols-2 gap-y-2 text-xs">
                <span className="text-gray-500">Record Terdeteksi:</span>
                <span className="font-medium text-gray-700">{cacheMeta.total_records} order</span>
                <span className="text-gray-500">Status Sync:</span>
                <span className={`font-medium ${cacheMeta.sync_completed ? 'text-teal-600' : 'text-amber-600'}`}>
                  {cacheMeta.sync_completed ? 'Terverifikasi' : 'Parsial'}
                </span>
                <span className="text-gray-500">Sync Terakhir:</span>
                <span className="font-medium text-gray-700">{cacheMeta.last_sync || 'N/A'}</span>
              </div>
            </div>
          )}
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full"
            leftIcon={<RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />}
            onClick={onResync}
            disabled={isSyncing}
          >
            {isSyncing ? syncMessage : 'Reset & Re-sync Cache'}
          </Button>
          <p className="text-[10px] text-gray-400 mt-2">
            Gunakan jika data di perangkat ini tidak akurat atau stale.
          </p>
        </div>

        {/* Super Admin Cleanup Section */}
        {user?.role === 'admin' && (
          <div className="pt-6 border-t mt-6">
            <h4 className="text-sm font-medium text-gray-900 mb-4">🔧 Super Admin Tools</h4>
            <div className="space-y-4">
              <div>
                <p className="text-xs text-gray-500 mb-2">
                  Bersihkan order dummy yang tidak lengkap (tanpa ongkir)
                </p>
                <button
                  onClick={async () => {
                    const { cleanupDummyOrders } = await import('@/scripts/cleanupOrders');
                    await cleanupDummyOrders();
                    alert('Cleanup selesai!');
                  }}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 transition-colors"
                >
                  🧹 Cleanup Dummy Orders
                </button>
              </div>

              <hr className="border-gray-100" />

              <div>
                <h5 className="text-xs font-semibold text-gray-700 mb-1 uppercase tracking-wider">
                  💾 Data Integrity
                </h5>
                <p className="text-xs text-gray-500 mb-3">
                  Deteksi order yang kehilangan referensi kurir (yatim).
                </p>
                <button
                  onClick={handleScanOrphans}
                  className="w-full px-4 py-2 bg-teal-600 text-white rounded-lg text-sm hover:bg-teal-700 transition-all flex items-center justify-center gap-2"
                >
                  <Shield className="w-4 h-4" />
                  Scan Orphaned Orders
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
