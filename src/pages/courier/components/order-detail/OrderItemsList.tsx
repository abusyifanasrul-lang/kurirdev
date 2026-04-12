import React from 'react';
import { Package, Plus, X } from 'lucide-react';
import { Order } from '@/types';

interface OrderItemsListProps {
  order: Order;
  isLocked: boolean;
  showItemForm: boolean;
  setShowItemForm: (v: boolean) => void;
  itemList: { nama: string; harga: number }[];
  namaItem: string;
  setNamaItem: (v: string) => void;
  hargaItem: string;
  setHargaItem: (v: string) => void;
  handleTambahItem: () => void;
  handleHapusItem: (i: number) => void;
  handleSimpanItems: () => void;
  formatRupiah: (v: string) => string;
}

export const OrderItemsList: React.FC<OrderItemsListProps> = ({
  order,
  isLocked,
  showItemForm,
  setShowItemForm,
  itemList,
  namaItem,
  setNamaItem,
  hargaItem,
  setHargaItem,
  handleTambahItem,
  handleHapusItem,
  handleSimpanItems,
  formatRupiah
}) => {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xs font-bold text-gray-600 uppercase tracking-mobile">Items / Orderan</h2>
        {!isLocked && (
          <button 
            onClick={() => setShowItemForm(!showItemForm)}
            className="text-emerald-600 text-xs font-bold hover:underline"
          >
            {showItemForm ? 'BATAL' : 'UBAH ITEM'}
          </button>
        )}
      </div>

      {showItemForm ? (
        <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="space-y-3">
            {itemList.map((item: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                <div>
                  <p className="text-sm font-semibold text-gray-900 leading-snug">{item.nama}</p>
                  <p className="text-xs font-medium text-gray-600">Rp {item.harga.toLocaleString('id-ID')}</p>
                </div>
                <button onClick={() => handleHapusItem(idx)} className="p-1.5 text-gray-400 hover:text-red-500">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2 p-3 bg-emerald-50 rounded-xl border border-emerald-100">
            <input
              type="text"
              placeholder="Nama barang..."
              value={namaItem}
              onChange={(e) => setNamaItem(e.target.value)}
              className="col-span-2 bg-white border-none rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500"
            />
            <input
              type="text"
              inputMode="numeric"
              placeholder="Harga..."
              value={hargaItem}
              onChange={(e) => setHargaItem(formatRupiah(e.target.value))}
              className="bg-white border-none rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-emerald-500"
            />
            <button
              onClick={handleTambahItem}
              className="bg-emerald-600 text-white rounded-lg py-2 text-xs font-bold flex items-center justify-center gap-1"
            >
              <Plus className="h-3.5 w-3.5" /> TAMBAH
            </button>
          </div>

          <button
            onClick={handleSimpanItems}
            className="w-full bg-emerald-600 text-white rounded-xl py-3 text-sm font-bold shadow-lg shadow-emerald-200"
          >
            SIMPAN PERUBAHAN
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {order.items && order.items.length > 0 ? (
            (order.items as any[]).map((item: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-transparent hover:border-emerald-100 transition-all">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 bg-white rounded-lg border border-gray-100 flex items-center justify-center shadow-sm">
                    <Package className="h-4 w-4 text-emerald-600" />
                  </div>
                  <p className="text-sm font-semibold text-gray-900 leading-snug">{item.nama}</p>
                </div>
                <p className="text-sm font-bold text-emerald-600 font-mono">
                  Rp {item.harga.toLocaleString('id-ID')}
                </p>
              </div>
            ))
          ) : (
            <div className="text-center py-6 border-2 border-dashed border-gray-100 rounded-2xl">
              <Package className="h-8 w-8 text-gray-200 mx-auto mb-2" />
              <p className="text-xs font-bold text-gray-500 uppercase tracking-mobile">Belum ada item terdaftar</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
