import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Settings, MapPin } from 'lucide-react';

interface GeneralOpsTabProps {
  operational_area: string;
  onSaveSettings: (data: { operational_area: string }) => void;
}

export function GeneralOpsTab({
  operational_area,
  onSaveSettings,
}: GeneralOpsTabProps) {
  const [form, setForm] = useState({
    operational_area,
  });

  const handleSave = () => {
    onSaveSettings(form);
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <Card>
        <div className="p-2">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-emerald-50 p-2.5 rounded-xl text-emerald-600">
              <Settings className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 font-display">Pengaturan Umum</h3>
              <p className="text-sm text-gray-500">Konfigurasi operasional dasar sistem kurir.</p>
            </div>
          </div>
          
          <div className="space-y-6 max-w-lg">
            <div className="bg-emerald-50 border border-emerald-100 p-5 rounded-2xl relative overflow-hidden group">
              <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:scale-110 transition-transform duration-500">
                <MapPin className="h-24 w-24" />
              </div>
              
              <h4 className="text-sm font-bold text-emerald-800 mb-3 flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Navigasi & Lokasi
              </h4>
              
              <Input
                label="Area Operasional Utama"
                helperText="Kota atau wilayah default untuk pencarian alamat Google Maps jika alamat konsumen tidak lengkap."
                type="text"
                value={form.operational_area}
                onChange={e => setForm({ operational_area: e.target.value })}
                placeholder="Contoh: Sengkang, Wajo"
                className="text-lg font-semibold bg-white"
              />
              
              <p className="mt-4 text-[11px] text-emerald-600 leading-relaxed italic">
                * Misalnya jika kurir mengklik navigasi ke "Jl. Mawar 34" dan area operasional adalah "Sengkang, Wajo", maka Google Maps akan otomatis mencari lokasi tersebut di Sengkang, bukan di kota lain.
              </p>
            </div>

            <div className="pt-4">
              <Button onClick={handleSave} className="w-full lg:w-auto px-10 bg-emerald-600 hover:bg-emerald-700 transition-colors shadow-md shadow-emerald-100">
                Simpan Perubahan
              </Button>
            </div>
          </div>
        </div>
      </Card>

      <div className="bg-gray-50 border border-gray-100 p-4 rounded-2xl flex gap-3 text-gray-600">
        <div className="bg-white p-1.5 rounded-lg border border-gray-200">
          <Settings className="h-4 w-4 text-gray-400" />
        </div>
        <div>
          <h4 className="text-sm font-bold text-gray-800">Tips Operasional</h4>
          <p className="text-xs mt-1 leading-relaxed">
            Gunakan format "Kota, Kabupaten" untuk akurasi terbaik pada perangkat Android dan iOS.
          </p>
        </div>
      </div>
    </div>
  );
}
