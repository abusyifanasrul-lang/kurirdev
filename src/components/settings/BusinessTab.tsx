import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Percent, Wallet, Calculator, Shield, Info, Clock } from 'lucide-react';
import { formatCurrency } from '@/utils/formatter';
import { calcCourierEarning, calcAdminEarning } from '@/lib/calcEarning';
import type { User as UserType, Order } from '@/types';

interface BusinessTabProps {
  commission_rate: number;
  commission_threshold: number;
  commission_type: 'percentage' | 'flat';
  onSaveSettings: (data: { 
    commission_rate: number; 
    commission_threshold: number; 
    commission_type: 'percentage' | 'flat';
    fine_late_minor_amount?: number;
    fine_late_major_minutes?: number;
    fine_late_major_amount?: number;
    fine_alpha_amount?: number;
  }) => Promise<void>;
  fine_late_minor_amount?: number;
  fine_late_major_minutes?: number;
  fine_late_major_amount?: number;
  fine_alpha_amount?: number;
  // Props kept for compatibility
  onResync?: () => Promise<void>;
  cacheMeta?: any;
  isSyncing?: boolean;
  syncMessage?: string;
  user?: UserType | null;
  users?: UserType[];
  getOrphanedOrdersLocal?: (activeIds: string[]) => Promise<Order[]>;
}

export function BusinessTab(props: BusinessTabProps) {
  const {
    commission_rate: initialRate,
    commission_threshold: initialThreshold,
    commission_type: initialType,
    onSaveSettings,
  } = props;
  const [form, setForm] = useState({
    commission_rate: initialRate,
    commission_threshold: initialThreshold,
    commission_type: initialType || 'percentage',
    fine_late_minor_amount: props.fine_late_minor_amount ?? 1000,
    fine_late_major_minutes: props.fine_late_major_minutes ?? 60,
    fine_late_major_amount: props.fine_late_major_amount ?? 30000,
    fine_alpha_amount: props.fine_alpha_amount ?? 50000,
  });

  const [simOngkir, setSimOngkir] = useState<number>(15000);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSaveSettings(form);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="border-none shadow-sm bg-white overflow-hidden">
        {/* Header & Segmented Control */}
        <div className="p-5 border-b border-gray-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Komisi & Bagi Hasil</h2>
            <p className="text-xs text-gray-500">Atur porsi pendapatan antara kurir dan sistem.</p>
          </div>
          
          <div className="bg-gray-100 p-1 rounded-xl flex w-fit h-fit self-start sm:self-center">
            <button
              onClick={() => setForm(prev => ({ ...prev, commission_type: 'percentage' }))}
              className={`flex items-center gap-2 px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
                form.commission_type === 'percentage' 
                ? 'bg-white text-teal-700 shadow-sm' 
                : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Percent className="w-3.5 h-3.5" />
              Persentase
            </button>
            <button
              onClick={() => setForm(prev => ({ ...prev, commission_type: 'flat' }))}
              className={`flex items-center gap-2 px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
                form.commission_type === 'flat' 
                ? 'bg-white text-teal-700 shadow-sm' 
                : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Wallet className="w-3.5 h-3.5" />
              Sesuai Ribuan
            </button>
          </div>
        </div>

        <div className="p-5 lg:p-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Configuration Column */}
            <div className="lg:col-span-7 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-4">
                  <Input
                    label="Ambang Batas Gratis"
                    type="text"
                    value={form.commission_threshold !== undefined ? `Rp ${form.commission_threshold.toLocaleString('id-ID')}` : ''}
                    onChange={e => {
                      const val = Number(e.target.value.replace(/[^0-9]/g, ''));
                      setForm(prev => ({ ...prev, commission_threshold: val }));
                    }}
                    className="text-base font-bold bg-gray-50 border-gray-100 h-11"
                  />
                  <p className="text-[10px] text-gray-400 leading-relaxed italic">
                    Ongkir &le; Batas Gratis tidak akan dikenakan porsi admin (Kurir mendapatkan 100%).
                  </p>
                </div>

                {form.commission_type === 'percentage' ? (
                  <div className="space-y-4">
                    <Input
                      label="Bagian Kurir (%)"
                      type="number"
                      value={form.commission_rate}
                      onChange={e => setForm(prev => ({ ...prev, commission_rate: Number(e.target.value) }))}
                      min={0}
                      max={100}
                      className="text-base font-bold bg-gray-50 border-gray-100 h-11"
                    />
                    <div className="px-3 py-2 bg-teal-50 border border-teal-100 rounded-lg flex items-center justify-between">
                      <span className="text-[10px] font-bold text-teal-600 uppercase">Admin:</span>
                      <span className="text-xs font-black text-teal-900">{100 - form.commission_rate}%</span>
                    </div>
                  </div>
                ) : (
                  <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 h-fit mt-6">
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                      <Info className="w-3 h-3 text-teal-600" />
                      Aturan Potongan
                    </p>
                    <div className="space-y-1.5">
                      <div className="text-[11px] text-gray-600 flex justify-between">
                        <span>Contoh 15.000</span>
                        <span className="font-bold text-teal-600">&rarr; Potong 1.000</span>
                      </div>
                      <div className="text-[11px] text-gray-600 flex justify-between">
                        <span>Contoh 23.000</span>
                        <span className="font-bold text-teal-600">&rarr; Potong 2.000</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-gray-50">
                <Button 
                  onClick={handleSave} 
                  disabled={isSaving}
                  className="w-full sm:w-auto h-11 px-8 text-sm shadow-md active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  {isSaving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Menyimpan...
                    </>
                  ) : (
                    'Simpan Pengaturan'
                  )}
                </Button>
              </div>
            </div>

            {/* Compact Simulator Column */}
            <div className="lg:col-span-5">
              <div className="bg-gray-50/50 border border-gray-100 rounded-2xl p-5 space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <Calculator className="w-4 h-4 text-teal-600" />
                  <h4 className="text-xs font-black text-gray-700 uppercase tracking-wider">Simulator Instan</h4>
                </div>
                
                <div className="space-y-3">
                  <div className="relative">
                    <input 
                      type="text"
                      value={simOngkir !== undefined ? `Rp ${simOngkir.toLocaleString('id-ID')}` : ''}
                      onChange={(e) => {
                        const val = Number(e.target.value.replace(/[^0-9]/g, ''));
                        setSimOngkir(val);
                      }}
                      placeholder="Rp 0"
                      className="w-full bg-white border border-gray-100 rounded-xl py-2.5 pl-4 pr-4 text-lg font-bold focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
                    />
                    <label className="absolute -top-2 left-3 bg-white px-1.5 text-[9px] font-black text-gray-400 uppercase tracking-wider border border-gray-50">SIMULASI ONGKIR</label>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1 p-3 bg-white border border-gray-100 rounded-xl">
                      <span className="text-[9px] font-black text-gray-400 uppercase">KURIR</span>
                      <span className="text-base font-black text-gray-900 leading-none">
                        {formatCurrency(calcCourierEarning({ total_fee: simOngkir } as any, form as any))}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1 p-3 bg-white border border-orange-100 rounded-xl">
                      <span className="text-[9px] font-black text-orange-400 uppercase">ADMIN</span>
                      <span className="text-base font-black text-orange-600 leading-none">
                        {formatCurrency(calcAdminEarning({ total_fee: simOngkir } as any, form as any))}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-2 pt-2 border-t border-gray-100">
                  <Shield className="w-3.5 h-3.5 text-teal-600 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-gray-500 leading-relaxed font-medium">
                    Kalkulasi di atas bersifat <strong>prediktif</strong> berdasarkan model yang dipilih saat ini.
                  </p>
                </div>
              </div>
            </div>

          </div>
        </div>
      </Card>

      <Card className="border-none shadow-sm bg-white overflow-hidden mt-6">
        <div className="p-5 border-b border-gray-50">
          <h2 className="text-lg font-bold text-gray-900">Denda & Penalti</h2>
          <p className="text-xs text-gray-500">Atur besaran denda untuk keterlambatan dan ketidakhadiran.</p>
        </div>
        
        <div className="p-5 lg:p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-amber-500" />
              Keterlambatan (Late)
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Denda Per Order (Minor)"
                type="text"
                value={`Rp ${form.fine_late_minor_amount.toLocaleString('id-ID')}`}
                onChange={e => {
                  const val = Number(e.target.value.replace(/[^0-9]/g, ''));
                  setForm(prev => ({ ...prev, fine_late_minor_amount: val }));
                }}
                className="text-sm font-bold bg-gray-50"
                helperText="Dipotong dari setiap order jika status terlambat aktif."
              />
              <Input
                label="Ambang Batas Major (Menit)"
                type="number"
                value={form.fine_late_major_minutes}
                onChange={e => setForm(prev => ({ ...prev, fine_late_major_minutes: Number(e.target.value) }))}
                className="text-sm font-bold bg-gray-50"
                helperText="Menit keterlambatan untuk denda besar."
              />
            </div>
            <Input
              label="Denda Sekali Potong (Major)"
              type="text"
              value={`Rp ${form.fine_late_major_amount.toLocaleString('id-ID')}`}
              onChange={e => {
                const val = Number(e.target.value.replace(/[^0-9]/g, ''));
                setForm(prev => ({ ...prev, fine_late_major_amount: val }));
              }}
              className="text-sm font-bold bg-gray-50"
              helperText="Denda flat jika terlambat melebihi ambang batas major."
            />
          </div>

          <div className="space-y-4">
            <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2">
              <Shield className="w-3.5 h-3.5 text-rose-500" />
              Absensi & Alpha
            </h4>
            <Input
              label="Denda Alpha / Tanpa Izin"
              type="text"
              value={`Rp ${form.fine_alpha_amount.toLocaleString('id-ID')}`}
              onChange={e => {
                const val = Number(e.target.value.replace(/[^0-9]/g, ''));
                setForm(prev => ({ ...prev, fine_alpha_amount: val }));
              }}
              className="text-sm font-bold bg-gray-50"
              helperText="Dikenakan saat kurir tidak masuk tanpa keterangan."
            />
          </div>
        </div>

        <div className="px-5 pb-6">
          <Button 
            onClick={handleSave} 
            disabled={isSaving}
            className="w-full sm:w-auto h-10 px-8 text-sm shadow-md"
          >
            {isSaving ? 'Menyimpan...' : 'Simpan Denda'}
          </Button>
        </div>
      </Card>
    </div>
  );
}
