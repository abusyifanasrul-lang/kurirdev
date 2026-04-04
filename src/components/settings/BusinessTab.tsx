import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Shield } from 'lucide-react';
import type { User as UserType, Order } from '@/types';

interface BusinessTabProps {
  commission_rate: number;
  commission_threshold: number;
  onSaveSettings: (data: { commission_rate: number; commission_threshold: number }) => void;
  // Props moved to StorageTab but kept in interface for compatibility if needed (or cleaned up)
  onResync?: () => Promise<void>;
  cacheMeta?: any;
  isSyncing?: boolean;
  syncMessage?: string;
  user?: UserType | null;
  users?: UserType[];
  getOrphanedOrdersLocal?: (activeIds: string[]) => Promise<Order[]>;
}

export function BusinessTab({
  commission_rate,
  commission_threshold,
  onSaveSettings,
}: BusinessTabProps) {
  const [form, setForm] = useState({
    commission_rate,
    commission_threshold,
  });

  const handleSave = () => {
    onSaveSettings(form);
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <Card>
        <div className="p-2">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-teal-50 p-2.5 rounded-xl text-teal-600">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">Konfigurasi Keuangan</h3>
              <p className="text-sm text-gray-500">Atur persentase bagi hasil dan ambang batas potongan admin.</p>
            </div>
          </div>
          
          <div className="space-y-6 max-w-lg">
            <Input
              label="Komisi Kurir (%)"
              helperText="Persentase dari total ongkir yang diterima oleh kurir. Contoh: 80% berarti Kurir Rp12.000 & Admin Rp3.000 dari total Rp15.000."
              type="number"
              value={form.commission_rate}
              onChange={e => setForm(prev => ({ ...prev, commission_rate: Number(e.target.value) }))}
              min={0}
              max={100}
              className="text-lg font-semibold"
            />
            
            <Input
              label="Ambang Batas Potongan (Rp)"
              helperText="Ongkir di bawah atau sama dengan nilai ini TIDAK akan dipotong admin (Kurir 100%)."
              type="number"
              value={form.commission_threshold}
              onChange={e => setForm(prev => ({ ...prev, commission_threshold: Number(e.target.value) }))}
              min={0}
              className="text-lg font-semibold"
            />

            <div className="bg-teal-50 border border-teal-100 p-5 rounded-2xl">
              <h4 className="text-sm font-bold text-teal-800 mb-3 flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Simulasi Bagi Hasil
              </h4>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-teal-600">Ongkir Standar (Rp15.000):</span>
                  <div className="text-right">
                    <p className="font-bold text-teal-900">Kurir: Rp {Math.round(15000 * form.commission_rate / 100).toLocaleString('id-ID')}</p>
                    <p className="text-[10px] text-teal-600">Admin: Rp {Math.round(15000 * (100 - form.commission_rate) / 100).toLocaleString('id-ID')}</p>
                  </div>
                </div>
                <div className="border-t border-teal-100 pt-2 flex justify-between items-center">
                  <span className="text-teal-600">Ongkir Kecil (≤ Rp{form.commission_threshold.toLocaleString('id-ID')}):</span>
                  <div className="text-right">
                    <p className="font-bold text-teal-900 text-base">Kurir: 100%</p>
                    <p className="text-[10px] text-teal-600 underline">Tanpa Potongan Admin</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4">
              <Button onClick={handleSave} className="w-full lg:w-auto px-10">
                Simpan Pengaturan
              </Button>
            </div>
          </div>
        </div>
      </Card>

      <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl flex gap-3 text-emerald-800">
        <Shield className="h-5 w-5 shrink-0 mt-0.5" />
        <div>
          <h4 className="text-sm font-bold">Keamanan Finansial</h4>
          <p className="text-xs mt-1 leading-relaxed">
            Perubahan pada pengaturan ini akan berdampak langsung pada perhitungan pendapatan kurir untuk order baru. 
            Order yang sudah selesai tidak akan terpengaruh secara retroaktif.
          </p>
        </div>
      </div>
    </div>
  );
}
