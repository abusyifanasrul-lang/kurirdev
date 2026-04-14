import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Settings, MapPin, Clock } from 'lucide-react';

interface GeneralOpsTabProps {
  operational_area: string;
  operational_timezone: string;
  onSaveSettings: (data: { operational_area: string, operational_timezone: string }) => void;
}

export function GeneralOpsTab({
  operational_area,
  operational_timezone,
  onSaveSettings,
}: GeneralOpsTabProps) {
  const [form, setForm] = useState({
    operational_area,
    operational_timezone: operational_timezone || 'Asia/Jakarta',
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
          
          <div className="space-y-6">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* Section 1: Navigasi & Lokasi */}
            <div className="bg-emerald-50/50 border border-emerald-100 p-5 rounded-2xl relative overflow-hidden group">
              <div className="absolute -right-4 -top-4 opacity-5 group-hover:scale-110 transition-transform duration-500 pointer-events-none">
                <MapPin className="h-24 w-24" />
              </div>
              
              <h4 className="text-sm font-bold text-emerald-800 mb-4 flex items-center gap-2">
                <div className="bg-emerald-100 p-1.5 rounded-lg">
                  <MapPin className="h-4 w-4" />
                </div>
                Navigasi & Lokasi
              </h4>
              
              <div className="space-y-4">
                <Input
                  label="Area Operasional Utama"
                  helperText="Kota atau wilayah default untuk pencarian alamat Google Maps."
                  type="text"
                  value={form.operational_area}
                  onChange={e => setForm({ ...form, operational_area: e.target.value })}
                  placeholder="Contoh: Sengkang, Wajo"
                  className="text-lg font-semibold bg-white"
                />
                
                <div className="bg-white/60 border border-emerald-100/50 p-3 rounded-xl">
                  <p className="text-[11px] text-emerald-700 leading-relaxed">
                    <span className="font-bold underline">Contoh:</span> Jika kurir mencari "Jl. Mawar 34" dan area ini diset ke "Sengkang, Wajo", Google Maps akan otomatis mencari lokasi tersebut di wilayah Anda, bukan di kota lain yang memiliki nama jalan serupa.
                  </p>
                </div>
              </div>
            </div>

            {/* Section 2: Zona Waktu */}
            <div className="bg-blue-50/50 border border-blue-100 p-5 rounded-2xl relative overflow-hidden group">
              <div className="absolute -right-4 -top-4 opacity-5 group-hover:scale-110 transition-transform duration-500 pointer-events-none">
                <Clock className="h-24 w-24 text-blue-600" />
              </div>

              <h4 className="text-sm font-bold text-blue-800 mb-4 flex items-center gap-2">
                <div className="bg-blue-100 p-1.5 rounded-lg">
                  <Clock className="h-4 w-4" />
                </div>
                Waktu & Standar Laporan
              </h4>

              <div className="relative">
                <label className="block text-xs font-bold text-blue-900/60 uppercase tracking-widest mb-2 px-1">
                  Zona Waktu Operasional
                </label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 p-1.5 bg-blue-100/50 rounded-lg">
                    <Clock className="h-4 w-4 text-blue-600" />
                  </div>
                  <select
                    className="w-full pl-12 pr-10 py-3.5 bg-white border border-blue-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all appearance-none text-gray-900 font-semibold shadow-sm"
                    value={form.operational_timezone}
                    onChange={(e) => setForm({ ...form, operational_timezone: e.target.value })}
                  >
                    <option value="Asia/Jakarta">WIB (Asia/Jakarta)</option>
                    <option value="Asia/Makassar">WITA (Asia/Makassar)</option>
                    <option value="Asia/Jayapura">WIT (Asia/Jayapura)</option>
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none border-l border-blue-100 pl-3">
                    <Settings className="h-4 w-4 text-blue-300" />
                  </div>
                </div>
                <div className="mt-3 flex gap-2 px-1">
                  <div className="h-1.5 w-1.5 rounded-full bg-blue-400 mt-1.5 shrink-0" />
                  <p className="text-[11px] text-blue-700 leading-relaxed">
                    Sistem akan menggunakan zona waktu ini sebagai standar pergantian hari (00:00) pada seluruh Laporan Keuangan, Statistik Dashboard, dan Analitik.
                  </p>
                </div>
              </div>
            </div>
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
