import React from 'react';
import { Phone, MapPin, MessageCircle, Pencil, Trash2, Check, X, Plus, Navigation } from 'lucide-react';
import { Order, CustomerChangeRequest } from '@/types';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { useCustomerStore } from '@/stores/useCustomerStore';
import { Clock } from 'lucide-react';

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
  const { operational_area } = useSettingsStore();
  const { changeRequests } = useCustomerStore();
  const waLink = `https://wa.me/62${order.customer_phone?.replace(/^0/, '')}`;

  const pendingRequests = changeRequests.filter((r: CustomerChangeRequest) => 
    r.order_id === order.id && r.status === 'pending'
  );
  const pendingAddRequests = pendingRequests.filter((r: CustomerChangeRequest) => r.change_type === 'address_add');

  const handleOpenMaps = () => {
    const address = order.customer_address || '';
    if (!address) return;

    // Smart completion: append operational area if address is short or missing city context
    const needsCompletion = 
      address.length < 25 || 
      !operational_area.split(',').some(part => address.toLowerCase().includes(part.trim().toLowerCase()));
    
    const query = needsCompletion ? `${address}, ${operational_area}` : address;
    const encodedQuery = encodeURIComponent(query);
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodedQuery}`, '_blank');
  };

  return (
    <div className="bg-white rounded-3xl px-4 py-6 shadow-sm border border-gray-100 mb-6 font-mobile relative overflow-hidden">
      <div className="flex items-center justify-between mb-5 px-1">
        <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Customer Info</h2>
        {!isLocked && !editCustomer && (
          <button 
            onClick={() => setEditCustomer(true)}
            className="text-emerald-700 text-[10px] font-black hover:bg-emerald-50 px-4 py-2 rounded-xl transition-all border border-emerald-100 shadow-sm uppercase tracking-widest active:scale-95"
          >
            UBAH DATA
          </button>
        )}
      </div>

      {editCustomer ? (
        <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">Nama</label>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full bg-gray-50 border-gray-100 rounded-xl px-4 py-3 text-sm font-semibold focus:ring-2 focus:ring-emerald-500 transition-all border"
              placeholder="Nama Customer..."
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-1">No. HP</label>
            <input
              type="tel"
              value={editPhone}
              onChange={(e) => setEditPhone(e.target.value)}
              className="w-full bg-gray-50 border-gray-100 rounded-xl px-4 py-3 text-sm font-semibold focus:ring-2 focus:ring-emerald-500 transition-all border"
              placeholder="CONTOH: 08123456789"
            />
          </div>

          {/* Inline Address Picker for Courier */}
          {courierAddrCustomer && (
            <div className="mt-4 p-4 bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
              <p className="text-[10px] font-bold text-gray-400 uppercase mb-3 flex items-center gap-1.5">
                <MapPin className="h-3 w-3" />
                Riwayat Alamat Pelanggan ini:
              </p>
              <div className="space-y-2.5">
                {courierAddrCustomer.addresses.map((a: any) => {
                  const pendingEdit = pendingRequests.find((r: CustomerChangeRequest) => r.change_type === 'address_edit' && r.affected_address_id === a.id);
                  const pendingDelete = pendingRequests.find((r: CustomerChangeRequest) => r.change_type === 'address_delete' && r.affected_address_id === a.id);
                  const isPending = !!pendingEdit || !!pendingDelete;
                  const isApplied = editAddress === a.address;

                  return (
                  <div key={a.id} className={`flex flex-col gap-1.5 p-3.5 bg-white rounded-xl shadow-sm border ${isApplied ? 'border-emerald-500 ring-1 ring-emerald-500 bg-emerald-50/10' : (isPending ? 'border-amber-200 bg-amber-50/30' : 'border-gray-100')} group transition-all relative overflow-hidden`}>
                    {isApplied && (
                      <div className="absolute top-0 right-0 bg-emerald-500 text-white px-2 py-1 rounded-bl-lg animate-in slide-in-from-top-full duration-300">
                        <Check className="h-3 w-3" />
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">{a.label || 'ALAMAT'}</span>
                        {pendingEdit && <span className="text-[9px] font-bold text-amber-600 bg-amber-100 px-2 py-0.5 rounded-md flex items-center gap-1"><Clock className="w-3 h-3"/> MENUNGGU UBAH</span>}
                        {pendingDelete && <span className="text-[9px] font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-md flex items-center gap-1"><Clock className="w-3 h-3"/> MENUNGGU HAPUS</span>}
                      </div>
                      <div className="flex items-center gap-0.5 -mr-2">
                        <button 
                          onClick={() => {
                            setCourierInlineEditId(a.id);
                            setCourierInlineEditValue(a.address);
                          }}
                          className="text-gray-400 hover:text-emerald-600 transition-colors h-11 w-11 flex items-center justify-center shrink-0 active:scale-90"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button 
                          onClick={() => onDeleteAddress(a.id)}
                          className="text-gray-400 hover:text-red-600 transition-colors h-11 w-11 flex items-center justify-center shrink-0 active:scale-90"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    
                    {courierInlineEditId === a.id ? (
                      <div className="flex items-center gap-1.5 mt-1 overflow-hidden">
                        <input
                          autoFocus
                          className="flex-1 min-w-0 text-xs border border-emerald-200 rounded-lg px-2.5 py-2.5 focus:ring-1 focus:ring-emerald-500 outline-none font-bold placeholder:font-normal"
                          value={courierInlineEditValue}
                          onChange={(e) => setCourierInlineEditValue(e.target.value)}
                        />
                        <button 
                          onClick={() => {
                            onUpdateAddress(a.id, courierInlineEditValue);
                            setCourierInlineEditId(null);
                          }}
                          className="h-11 w-11 flex items-center justify-center text-emerald-600 hover:bg-emerald-50 rounded-lg shrink-0 active:scale-90"
                        >
                          <Check className="h-5 w-5" />
                        </button>
                        <button 
                          onClick={() => setCourierInlineEditId(null)}
                          className="h-11 w-11 flex items-center justify-center text-gray-400 hover:bg-gray-100 rounded-lg shrink-0 active:scale-90"
                        >
                          <X className="h-5 w-5" />
                        </button>
                      </div>
                    ) : (
                      <p className={`text-xs leading-relaxed pr-8 ${pendingDelete ? 'text-gray-400 line-through' : 'text-gray-600'}`}>
                        {pendingEdit ? pendingEdit.new_address : a.address}
                      </p>
                    )}
                    
                    <button 
                      onClick={() => onSetAppliedAddress(a.address)}
                      className="mt-2 text-[10px] font-black text-emerald-700 bg-emerald-50 px-4 py-2.5 rounded-xl self-start hover:bg-emerald-600 hover:text-white transition-all shadow-sm shadow-emerald-50 active:scale-95 border border-emerald-100 uppercase tracking-widest"
                    >
                      GUNAKAN ALAMAT INI
                    </button>
                  </div>
                  );
                })}
                
                {/* Render Pending Add Requests */}
                {pendingAddRequests.map((r: CustomerChangeRequest) => {
                  const isApplied = editAddress === r.new_address?.address;
                  return (
                  <div key={r.id} className={`flex flex-col gap-1 p-3 bg-white rounded-xl shadow-sm border ${isApplied ? 'border-emerald-500 ring-1 ring-emerald-500 bg-emerald-50/10' : 'border-amber-200 bg-amber-50/30'} group transition-all relative overflow-hidden`}>
                    {isApplied && (
                      <div className="absolute top-0 right-0 bg-emerald-500 text-white px-2 py-1 rounded-bl-lg animate-in slide-in-from-top-full duration-300">
                        <Check className="h-3 w-3" />
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">ALAMAT BARU</span>
                        <span className="text-[9px] font-bold text-amber-600 bg-amber-100 px-2 py-0.5 rounded-md flex items-center gap-1"><Clock className="w-3 h-3"/> MENUNGGU ACC</span>
                      </div>
                    </div>
                    <p className="text-xs text-gray-600 leading-relaxed mt-1">{r.new_address?.address}</p>
                    <button 
                      onClick={() => r.new_address?.address && onSetAppliedAddress(r.new_address.address)}
                      className="mt-2 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg self-start hover:bg-emerald-600 hover:text-white transition-all shadow-sm shadow-emerald-50"
                    >
                      GUNAKAN ALAMAT INI
                    </button>
                  </div>
                  );
                })}
                
                {courierInlineAddingNew ? (
                  <div className="p-3.5 bg-white rounded-xl shadow-sm border border-emerald-200 animate-in fade-in slide-in-from-top-1 duration-200">
                    <p className="text-[10px] font-bold text-emerald-600 uppercase mb-2">Tambah Alamat Baru:</p>
                    <div className="flex items-center gap-1.5 overflow-hidden">
                      <input
                        autoFocus
                        className="flex-1 min-w-0 text-xs border border-emerald-200 rounded-lg px-3 py-3 focus:ring-1 focus:ring-emerald-500 outline-none font-bold placeholder:font-normal"
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
                        className="h-11 w-11 flex items-center justify-center text-emerald-600 hover:bg-emerald-50 rounded-lg shrink-0 active:scale-90"
                      >
                        <Check className="h-5 w-5" />
                      </button>
                      <button 
                        onClick={() => setCourierInlineAddingNew(false)}
                        className="h-11 w-11 flex items-center justify-center text-gray-400 hover:bg-gray-100 rounded-lg shrink-0 active:scale-90"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <button 
                    onClick={() => setCourierInlineAddingNew(true)}
                    className="w-full py-3 border-2 border-dashed border-emerald-200 rounded-2xl text-emerald-600 text-[10px] font-bold hover:bg-emerald-50 transition-all flex items-center justify-center gap-2 group"
                  >
                    <Plus className="h-3.5 w-3.5 group-hover:rotate-90 transition-transform" /> TAMBAH ALAMAT BARU
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="flex gap-3 mt-8">
            <button
              onClick={() => setEditCustomer(false)}
              className="flex-1 bg-gray-100 text-gray-600 rounded-2xl py-4.5 text-xs font-black active:scale-[0.98] transition-all hover:bg-gray-200 uppercase tracking-widest"
            >
              BATAL
            </button>
            <button
              onClick={handleSimpanCustomer}
              className="flex-[2] bg-emerald-600 text-white rounded-2xl py-4.5 text-xs font-black shadow-xl shadow-emerald-200 active:scale-[0.98] transition-all hover:bg-emerald-700 uppercase tracking-widest"
            >
              SIMPAN
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 min-w-[48px] bg-emerald-50 rounded-2xl flex items-center justify-center border border-emerald-100 shadow-sm shadow-emerald-50">
              <Phone className="h-5 w-5 text-emerald-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-base font-black text-gray-900 tracking-tight truncate">{order.customer_name}</p>
              <p className="text-[11px] font-bold text-gray-500 tracking-wider mt-0.5">{order.customer_phone}</p>
            </div>
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-3 bg-emerald-600 text-white rounded-2xl text-[10px] font-black flex items-center gap-2 shadow-xl shadow-emerald-100 active:scale-90 transition-all hover:bg-emerald-700 uppercase tracking-widest"
            >
              <MessageCircle className="h-4 w-4" /> WA
            </a>
          </div>

          <div className="flex items-center gap-4">
            <div className="h-12 w-12 min-w-[48px] bg-blue-50 rounded-2xl flex items-center justify-center border border-blue-100 shadow-sm shadow-blue-50">
              <MapPin className="h-5 w-5 text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-xs text-gray-700 leading-tight font-black line-clamp-2">{order.customer_address}</p>
                {pendingRequests.length > 0 && (
                  <span className="shrink-0 text-[8px] font-black bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-md flex items-center gap-0.5 border border-amber-200 animate-pulse">
                    <Clock className="w-2.5 h-2.5" />
                    REQ
                  </span>
                )}
              </div>
              {/* Optional: Sync suggestion if order snapshot is outdated compared to customer record */}
              {courierAddrCustomer && !pendingRequests.length && !isLocked && 
               !courierAddrCustomer.addresses.some((a: any) => a.address === order.customer_address) && (
                 <p className="text-[9px] text-amber-600 font-bold mt-1 flex items-center gap-1">
                   🚨 Alamat profil berbeda dengan order ini
                 </p>
               )
              }
            </div>
            <button
              onClick={handleOpenMaps}
              className="px-4 py-3 bg-emerald-600 text-white rounded-2xl text-[10px] font-black flex items-center gap-2 shadow-xl shadow-emerald-100 active:scale-90 transition-all hover:bg-emerald-700 uppercase tracking-widest flex-shrink-0"
            >
              <Navigation className="h-4 w-4" /> Maps
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
