import React from 'react';
import { Plus, X, Pencil, Check, Trash2 } from 'lucide-react';
import { Order } from '@/types';

interface OrderPricingSummaryProps {
  order: Order;
  isLocked: boolean;
  titik: number;
  beban: { nama: string; biaya: number }[];
  totalBiayaTitik: number;
  totalBiayaBeban: number;
  totalOngkir: number;
  editOngkir: boolean;
  setEditOngkir: (v: boolean) => void;
  ongkirValue: string;
  setOngkirValue: (v: string) => void;
  showBebanForm: boolean;
  setShowBebanForm: (v: boolean) => void;
  namaBeban: string;
  setNamaBeban: (v: string) => void;
  biayaBeban: string;
  setBiayaBeban: (v: string) => void;
  handleTambahTitik: () => void;
  handleHapusTitik: () => void;
  handleTambahBeban: () => void;
  handleHapusBeban: (i: number) => void;
  handleSimpanOngkir: () => void;
  formatRupiah: (v: string) => string;
}

export const OrderPricingSummary: React.FC<OrderPricingSummaryProps> = ({
  order,
  isLocked,
  titik,
  beban,
  totalBiayaTitik,
  totalBiayaBeban,
  totalOngkir,
  editOngkir,
  setEditOngkir,
  ongkirValue,
  setOngkirValue,
  showBebanForm,
  setShowBebanForm,
  namaBeban,
  setNamaBeban,
  biayaBeban,
  setBiayaBeban,
  handleTambahTitik,
  handleHapusTitik,
  handleTambahBeban,
  handleHapusBeban,
  handleSimpanOngkir,
  formatRupiah
}) => {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-6">
      <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Ringkasan Biaya</h2>
      
      <div className="space-y-3">
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">Ongkir Utama</span>
            {!isLocked && (
              <button onClick={() => setEditOngkir(!editOngkir)} className="p-1 text-emerald-600">
                <Pencil className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          {editOngkir ? (
            <div className="flex gap-2">
              <input
                type="text"
                className="w-24 text-right text-sm font-bold border rounded px-2 py-1"
                value={ongkirValue}
                onChange={(e) => setOngkirValue(formatRupiah(e.target.value))}
              />
              <button onClick={handleSimpanOngkir} className="text-emerald-600"><Check className="h-4 w-4" /></button>
            </div>
          ) : (
            <span className="text-sm font-bold text-gray-900">Rp {(order.total_fee || 0).toLocaleString('id-ID')}</span>
          )}
        </div>

        <div className="flex items-center justify-between p-3 bg-emerald-50/50 rounded-xl border border-emerald-50">
          <div>
            <p className="text-sm font-medium text-emerald-900">Biaya Titik ({titik} lokasi)</p>
            <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-tight">+ Rp {totalBiayaTitik.toLocaleString('id-ID')}</p>
          </div>
          {!isLocked && (
            <div className="flex items-center gap-1">
              <button onClick={handleHapusTitik} className="p-2 bg-white rounded-lg border border-emerald-100"><X className="h-4 w-4 text-emerald-600" /></button>
              <button onClick={handleTambahTitik} className="p-2 bg-emerald-600 rounded-lg shadow-sm active:scale-95 transition-all"><Plus className="h-4 w-4 text-white" /></button>
            </div>
          )}
        </div>

        <div className="p-3 bg-amber-50/50 rounded-xl border border-amber-100">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-sm font-medium text-amber-900">Biaya Beban/Lainnya</p>
              <p className="text-[10px] text-amber-600 font-bold uppercase tracking-tight">+ Rp {totalBiayaBeban.toLocaleString('id-ID')}</p>
            </div>
            {!isLocked && (
              <button onClick={() => setShowBebanForm(!showBebanForm)} className="p-2 bg-white rounded-lg border border-amber-100"><Plus className="h-4 w-4 text-amber-600" /></button>
            )}
          </div>

          <div className="space-y-1.5">
            {beban.map((b, idx) => (
              <div key={idx} className="flex items-center justify-between py-1 border-t border-amber-100/50">
                <span className="text-xs text-amber-800">{b.nama}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-amber-900">Rp {b.biaya.toLocaleString('id-ID')}</span>
                  {!isLocked && (
                    <button onClick={() => handleHapusBeban(idx)} className="text-amber-400 hover:text-red-500"><Trash2 className="h-3 w-3" /></button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {!isLocked && showBebanForm && (
            <div className="mt-3 p-3 bg-white rounded-xl border border-amber-200 animate-in fade-in zoom-in-95">
              <input
                type="text"
                placeholder="Nama beban..."
                className="w-full text-xs mb-2 border rounded-lg px-3 py-2"
                value={namaBeban}
                onChange={(e) => setNamaBeban(e.target.value)}
              />
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Rp..."
                  className="w-full text-xs border rounded-lg px-3 py-2"
                  value={biayaBeban}
                  onChange={(e) => setBiayaBeban(formatRupiah(e.target.value))}
                />
                <button
                  onClick={handleTambahBeban}
                  className="bg-amber-600 text-white rounded-lg px-4 text-xs font-bold"
                >
                  OK
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between p-4 bg-emerald-600 rounded-2xl shadow-lg shadow-emerald-100">
          <span className="text-sm font-bold text-emerald-50 uppercase tracking-wider">Total Akhir Ongkir</span>
          <span className="text-xl font-black text-white font-mono">Rp {totalOngkir.toLocaleString('id-ID')}</span>
        </div>
      </div>
    </div>
  );
};
