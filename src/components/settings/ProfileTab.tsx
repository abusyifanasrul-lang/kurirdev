import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import type { User as UserType } from '@/types';
import { RefreshCw, BellRing, Database } from 'lucide-react';

interface ProfileTabProps {
  user: UserType | null;
  onUpdate: (updates: any) => Promise<void>;
  onRefreshPush: () => Promise<void>;
  onResync?: () => Promise<void>;
  cacheMeta?: any;
  isSyncing?: boolean;
  syncMessage?: string;
  isLoading: boolean;
  isRefreshingPush: boolean;
}

export function ProfileTab({
  user,
  onUpdate,
  onRefreshPush,
  onResync,
  cacheMeta,
  isSyncing,
  syncMessage,
  isLoading,
  isRefreshingPush,
}: ProfileTabProps) {
  const [form, setForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
  });

  const handleSubmit = async () => {
    await onUpdate(form);
  };

  return (
    <div className="space-y-6">
      <Card>
        <h3 className="text-lg font-semibold text-gray-900 mb-6">Profile Information</h3>
        <div className="space-y-4 max-w-md">
          <Input
            label="Full Name"
            value={form.name}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, name: e.target.value })}
          />
          <Input
            label="Email Address"
            type="email"
            value={form.email}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, email: e.target.value })}
          />
          <Input
            label="Phone Number"
            value={form.phone}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, phone: e.target.value })}
            placeholder="+628..."
          />
          <div className="pt-4 flex flex-col gap-3">
            <Button onClick={handleSubmit} isLoading={isLoading}>
              Save Changes
            </Button>
            
            {user?.role === 'courier' && (
              <div className="pt-4 border-t border-gray-100 mt-2">
                <p className="text-xs text-gray-500 mb-2 font-medium">
                  Bermasalah dengan notifikasi?
                </p>
                <Button 
                  variant="secondary" 
                  size="sm" 
                  className="w-full sm:w-auto"
                  leftIcon={<BellRing className="h-4 w-4" />}
                  onClick={onRefreshPush}
                  isLoading={isRefreshingPush}
                >
                  Refresh Push Notification
                </Button>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Sync Maintenance Section */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Database className="h-5 w-5 text-indigo-600" />
          <h3 className="text-lg font-semibold text-gray-900">Data & Sinkronisasi</h3>
        </div>
        <p className="text-sm text-gray-500 mb-6">
          Kelola data lokal di perangkat Anda untuk memastikan informasi tetap akurat.
        </p>

        <div className="space-y-6 max-w-md">
          {cacheMeta && (
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-indigo-50/50 p-3 rounded-xl border border-indigo-100/50">
                <p className="text-[10px] uppercase tracking-wider font-bold text-indigo-400 mb-1">Total Record</p>
                <p className="text-xl font-bold text-indigo-700">{cacheMeta.total_records}</p>
                <p className="text-[10px] text-indigo-500 mt-1">Orders ter-cache</p>
              </div>
              <div className="bg-emerald-50/50 p-3 rounded-xl border border-emerald-100/50">
                <p className="text-[10px] uppercase tracking-wider font-bold text-emerald-400 mb-1">Status Sync</p>
                <div className="flex items-center gap-1.5 mt-1">
                  <div className={`w-2 h-2 rounded-full ${cacheMeta.sync_completed ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                  <p className="text-sm font-bold text-emerald-700">
                    {cacheMeta.sync_completed ? 'Aktif' : 'Parsial'}
                  </p>
                </div>
                <p className="text-[10px] text-emerald-600 mt-0.5">Real-time Ready</p>
              </div>
            </div>
          )}

          <div className="space-y-3">
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full bg-white hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all font-semibold"
              leftIcon={<RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />}
              onClick={onResync}
              disabled={isSyncing}
            >
              {isSyncing ? syncMessage : 'Reset & Sinkronisasi Ulang'}
            </Button>
            <p className="text-[11px] text-gray-400 leading-relaxed px-1">
              <strong>Catatan:</strong> Tombol ini akan menghapus semua foto/data lokal dan mengunduh ulang informasi terbaru dari server. Gunakan hanya jika Anda menemukan perbedaan data.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
