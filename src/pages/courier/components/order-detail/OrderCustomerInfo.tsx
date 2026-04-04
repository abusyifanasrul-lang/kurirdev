import React from 'react';
import { Phone, MapPin, MessageCircle, Pencil, Trash2, Check, X, Plus } from 'lucide-react';
import { Order } from '@/types';

interface OrderCustomerInfoProps {
  order: Order;
  isLocked: boolean;
  editCustomer: boolean;
  setEditCustomer: (v: boolean) => void;
  editName: string;
  setEditName: (v: string) => void;
  editPhone: string;
  setEditPhone: (v: string) => void;
  editAddress: string;
  setEditAddress: (v: string) => void;
  handleSimpanCustomer: () => void;
  
  // Inline Address Picker props
  courierAddrCustomer: any;
  courierInlineEditId: string | null;
  setCourierInlineEditId: (v: string | null) => void;
  courierInlineEditValue: string;
  setCourierInlineEditValue: (v: string) => void;
  courierInlineAddingNew: boolean;
  setCourierInlineAddingNew: (v: boolean) => void;
  courierInlineNewValue: string;
  setCourierInlineNewValue: (v: string) => void;
  
  // Handlers from parent
  onUpdateAddress: (id: string, addr: string) => void;
  onDeleteAddress: (id: string) => void;
  onAddNewAddress: (phone: string, addr: string) => void;
  onSetAppliedAddress: (addr: string) => void;
}

export const OrderCustomerInfo: React.FC<OrderCustomerInfoProps> = ({
  order,
  isLocked,
  editCustomer,
  setEditCustomer,
  editName,
  setEditName,
  editPhone,
  setEditPhone,
  editAddress,
  setEditAddress,
  handleSimpanCustomer,
  courierAddrCustomer,
  courierInlineEditId,
  setCourierInlineEditId,
  courierInlineEditValue,
  setCourierInlineEditValue,
  courierInlineAddingNew,
  setCourierInlineAddingNew,
  courierInlineNewValue,
  setCourierInlineNewValue,
  onUpdateAddress,
  onDeleteAddress,
  onAddNewAddress,
  onSetAppliedAddress
}) => {
  const waLink = `https://wa.me/62${order.customer_phone?.replace(/^0/, '')}`;

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Customer Info</h2>
        {!isLocked && (
          <button 
            onClick={() => setEditCustomer(!editCustomer)}
            className="text-emerald-600 text-xs font-bold hover:underline"
          >
            {editCustomer ? 'BATAL' : 'UBAH DATA'}
          </button>
        )}
      </div>

      {editCustomer ? (
        <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase">Nama</label>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-emerald-500"
              placeholder="Nama Customer..."
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase">No. HP</label>
            <input
              type="tel"
              value={editPhone}
              onChange={(e) => setEditPhone(e.target.value)}
              className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-emerald-500"
              placeholder="CONTOH: 08123456789"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase">Alamat Sekarang</label>
            <textarea
              value={editAddress}
              onChange={(e) => setEditAddress(e.target.value)}
              className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-emerald-500 h-20"
              placeholder="Alamat Pengantaran..."
            />
          </div>

          {/* Inline Address Picker for Courier */}
          {courierAddrCustomer && (
            <div className="mt-4 p-3 bg-gray-50 rounded-xl border border-dashed border-gray-200">
              <p className="text-[10px] font-bold text-gray-400 uppercase mb-2">Riwayat Alamat Pelanggan ini:</p>
              <div className="space-y-2">
                {courierAddrCustomer.addresses.map((a: any) => (
                  <div key={a.id} className="flex flex-col gap-1 p-2 bg-white rounded-lg shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-emerald-600 uppercase">{a.label}</span>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => {
                            setCourierInlineEditId(a.id);
                            setCourierInlineEditValue(a.address);
                          }}
                          className="text-gray-400 hover:text-emerald-600 transition-colors"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button 
                          onClick={() => onDeleteAddress(a.id)}
                          className="text-gray-400 hover:text-red-600 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    
                    {courierInlineEditId === a.id ? (
                      <div className="flex gap-2 mt-1">
                        <input
                          autoFocus
                          className="flex-1 text-xs border border-emerald-200 rounded px-2 py-1 focus:ring-1 focus:ring-emerald-500 outline-none"
                          value={courierInlineEditValue}
                          onChange={(e) => setCourierInlineEditValue(e.target.value)}
                        />
                        <button 
                          onClick={() => {
                            onUpdateAddress(a.id, courierInlineEditValue);
                            setCourierInlineEditId(null);
                          }}
                          className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                        <button 
                          onClick={() => setCourierInlineEditId(null)}
                          className="p-1 text-gray-400 hover:bg-gray-100 rounded"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <p className="text-xs text-gray-600 leading-snug">{a.address}</p>
                    )}
                    
                    <button 
                      onClick={() => onSetAppliedAddress(a.address)}
                      className="mt-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md self-start hover:bg-emerald-100"
                    >
                      GUNAKAN ALAMAT INI
                    </button>
                  </div>
                ))}
                
                {courierInlineAddingNew ? (
                  <div className="p-2 bg-white rounded-lg shadow-sm border border-emerald-200 animate-in fade-in slide-in-from-top-1 duration-200">
                    <p className="text-[10px] font-bold text-emerald-600 uppercase mb-1">Tambah Alamat Baru:</p>
                    <div className="flex gap-2">
                      <input
                        autoFocus
                        className="flex-1 text-xs border border-emerald-200 rounded px-2 py-1 focus:ring-1 focus:ring-emerald-500 outline-none"
                        placeholder="Ketik alamat baru..."
                        value={courierInlineNewValue}
                        onChange={(e) => setCourierInlineNewValue(e.target.value)}
                      />
                      <button 
                        onClick={() => {
                          onAddNewAddress(order.customer_phone || '', courierInlineNewValue);
                          setCourierInlineAddingNew(false);
                          setCourierInlineNewValue('');
                        }}
                        className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                      <button 
                        onClick={() => setCourierInlineAddingNew(false)}
                        className="p-1 text-gray-400 hover:bg-gray-100 rounded"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <button 
                    onClick={() => setCourierInlineAddingNew(true)}
                    className="w-full py-2 border-2 border-dashed border-emerald-200 rounded-xl text-emerald-600 text-[10px] font-bold hover:bg-emerald-50 transition-colors flex items-center justify-center gap-2"
                  >
                    <Plus className="h-3.5 w-3.5" /> TAMBAH ALAMAT BARU
                  </button>
                )}
              </div>
            </div>
          )}

          <button
            onClick={handleSimpanCustomer}
            className="w-full bg-emerald-600 text-white rounded-xl py-3 text-sm font-bold shadow-lg shadow-emerald-200"
          >
            SIMPAN PERUBAHAN
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-start gap-4">
            <div className="h-10 w-10 min-w-[40px] bg-emerald-50 rounded-xl flex items-center justify-center">
              <Phone className="h-5 w-5 text-emerald-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-900 truncate">{order.customer_name}</p>
              <p className="text-xs text-gray-500">{order.customer_phone}</p>
            </div>
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-100 active:scale-95 transition-all"
            >
              <MessageCircle className="h-4 w-4" /> WhatsApp
            </a>
          </div>

          <div className="flex items-start gap-4">
            <div className="h-10 w-10 min-w-[40px] bg-emerald-50 rounded-xl flex items-center justify-center">
              <MapPin className="h-5 w-5 text-emerald-600" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-gray-600 leading-snug">{order.customer_address}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
