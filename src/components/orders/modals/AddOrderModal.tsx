import React from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Search, Plus, Pencil, Trash2, Check, XCircle } from 'lucide-react';
import { Customer, Order } from '@/types/index';

interface AddOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  newOrder: Partial<Order>;
  setNewOrder: (order: Partial<Order>) => void;
  isCreating: boolean;
  setIsCreating: (val: boolean) => void;
  formError: string;
  setFormError: (val: string) => void;
  handleCreateOrder: () => Promise<void>;
  customers: Customer[];
  selectedCustomer: Customer | null;
  setSelectedCustomer: (customer: Customer | null) => void;
  // Address states
  inlineEditAddrId: string | null;
  setInlineEditAddrId: (id: string | null) => void;
  inlineEditValue: string;
  setInlineEditValue: (val: string) => void;
  inlineAddingNew: boolean;
  setInlineAddingNew: (val: boolean) => void;
  inlineNewAddr: string;
  setInlineNewAddr: (val: string) => void;
  // Address utils
  addAddress: (cid: string, addr: any) => Promise<void>;
  updateAddress: (cid: string, aid: string, data: any) => Promise<void>;
  deleteAddress: (cid: string, aid: string) => Promise<void>;
}

export const AddOrderModal: React.FC<AddOrderModalProps> = ({
  isOpen,
  onClose,
  newOrder,
  setNewOrder,
  isCreating,
  setIsCreating,
  formError,
  setFormError,
  handleCreateOrder,
  customers,
  selectedCustomer,
  setSelectedCustomer,
  inlineEditAddrId,
  setInlineEditAddrId,
  inlineEditValue,
  setInlineEditValue,
  inlineAddingNew,
  setInlineAddingNew,
  inlineNewAddr,
  setInlineNewAddr,
  addAddress,
  updateAddress,
  deleteAddress
}) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create New Order" size="md">
      <div className="space-y-4">
        {/* Customer Selection */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700">Customer</p>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search customer by name or phone..."
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-teal-400"
              value={selectedCustomer ? `${selectedCustomer.name} (${selectedCustomer.phone})` : newOrder.customer_name}
              onChange={e => {
                const val = e.target.value
                if (selectedCustomer) {
                  setSelectedCustomer(null)
                  setNewOrder({ ...newOrder, customer_name: '', customer_phone: '', customer_address: '' })
                } else {
                  setNewOrder({ ...newOrder, customer_name: val })
                }
              }}
            />
          </div>

          {!selectedCustomer && newOrder.customer_name && (
            <div className="border border-gray-100 rounded-lg max-h-40 overflow-y-auto shadow-sm bg-white divide-y divide-gray-50">
              {customers
                .filter(c => 
                  c.name.toLowerCase().includes(newOrder.customer_name?.toLowerCase() || '') ||
                  c.phone.includes(newOrder.customer_name || '')
                )
                .slice(0, 5)
                .map(c => (
                  <button
                    key={c.id}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors flex justify-between items-center group"
                    onClick={() => {
                      setSelectedCustomer(c)
                      setNewOrder({ 
                        ...newOrder, 
                        customer_name: c.name, 
                        customer_phone: c.phone,
                        customer_address: c.addresses.find(a => a.is_default)?.address || c.addresses[0]?.address || ''
                      })
                    }}
                  >
                    <div>
                      <span className="font-medium text-gray-900 group-hover:text-teal-700">{c.name}</span>
                      <span className="text-gray-400 ml-2 text-xs">{c.phone}</span>
                    </div>
                    <Plus className="w-3.5 h-3.5 text-gray-300 group-hover:text-teal-500" />
                  </button>
                ))}
            </div>
          )}
        </div>

        {/* Dynamic Fields for New Customer */}
        {!selectedCustomer && (
          <Input
            label="Phone"
            placeholder="0812..."
            value={newOrder.customer_phone}
            onChange={e => setNewOrder({ ...newOrder, customer_phone: e.target.value })}
          />
        )}

        {/* Address Selection / Input */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700">Address</p>
          {selectedCustomer && selectedCustomer.addresses.map((addr) => (
            <div
              key={addr.id}
              className={`flex items-center gap-2 px-2 py-1.5 rounded-lg border transition-colors ${
                inlineEditAddrId === addr.id 
                  ? 'border-teal-400 bg-teal-50' 
                  : newOrder.customer_address === addr.address 
                  ? 'border-teal-300 bg-teal-50/40' 
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <button
                type="button"
                onClick={() => {
                  if (inlineEditAddrId !== addr.id)
                    setNewOrder({ ...newOrder, customer_address: addr.address })
                }}
                className="flex-shrink-0"
              >
                <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${
                  newOrder.customer_address === addr.address && inlineEditAddrId !== addr.id
                    ? 'border-teal-500' : 'border-gray-300'
                }`}>
                  {newOrder.customer_address === addr.address && inlineEditAddrId !== addr.id && (
                    <div className="w-1.5 h-1.5 rounded-full bg-teal-500" />
                  )}
                </div>
              </button>
              
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded flex-shrink-0 ${
                addr.is_default ? 'bg-teal-100 text-teal-600' : 'bg-gray-100 text-gray-500'
              }`}>
                {addr.label}
              </span>

              {inlineEditAddrId === addr.id ? (
                <>
                  <input
                    className="flex-1 text-sm border-0 bg-transparent outline-none focus:outline-none text-gray-800 min-w-0"
                    value={inlineEditValue}
                    autoFocus
                    onChange={e => setInlineEditValue(e.target.value)}
                    onKeyDown={async (e) => {
                      if (e.key === 'Enter') {
                        await updateAddress(selectedCustomer.id, addr.id, { address: inlineEditValue })
                        const updated = { ...selectedCustomer, addresses: selectedCustomer.addresses.map(a => a.id === addr.id ? { ...a, address: inlineEditValue } : a) }
                        setSelectedCustomer(updated)
                        if (newOrder.customer_address === addr.address) setNewOrder({ ...newOrder, customer_address: inlineEditValue })
                        setInlineEditAddrId(null)
                      } else if (e.key === 'Escape') setInlineEditAddrId(null)
                    }}
                  />
                  <button type="button" onClick={async () => {
                    await updateAddress(selectedCustomer.id, addr.id, { address: inlineEditValue })
                    const updated = { ...selectedCustomer, addresses: selectedCustomer.addresses.map(a => a.id === addr.id ? { ...a, address: inlineEditValue } : a) }
                    setSelectedCustomer(updated)
                    if (newOrder.customer_address === addr.address) setNewOrder({ ...newOrder, customer_address: inlineEditValue })
                    setInlineEditAddrId(null)
                  }} className="flex-shrink-0 text-green-600 hover:text-green-700">
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button type="button" onClick={() => setInlineEditAddrId(null)} className="flex-shrink-0 text-gray-400 hover:text-gray-600">
                    <XCircle className="w-3.5 h-3.5" />
                  </button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm text-gray-700 truncate">{addr.address}</span>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setInlineEditAddrId(addr.id); setInlineEditValue(addr.address) }}
                    className="flex-shrink-0 text-gray-400 hover:text-teal-600 transition-colors"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={async (e) => {
                      e.stopPropagation()
                      await deleteAddress(selectedCustomer.id, addr.id)
                      const updated = { ...selectedCustomer, addresses: selectedCustomer.addresses.filter(a => a.id !== addr.id) }
                      setSelectedCustomer(updated)
                      if (newOrder.customer_address === addr.address) {
                        const next = updated.addresses[0]
                        setNewOrder({ ...newOrder, customer_address: next ? next.address : '' })
                      }
                    }}
                    className="flex-shrink-0 text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </>
              )}
            </div>
          ))}

          {/* Inline tambah alamat baru */}
          {selectedCustomer && (
            inlineAddingNew ? (
              <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg border border-dashed border-teal-400 bg-teal-50">
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-teal-100 text-teal-600 flex-shrink-0">Baru</span>
                <input
                  className="flex-1 text-sm border-0 bg-transparent outline-none focus:outline-none text-gray-800 min-w-0"
                  placeholder="Ketik alamat baru..."
                  value={inlineNewAddr}
                  autoFocus
                  onChange={e => setInlineNewAddr(e.target.value)}
                  onKeyDown={async (e) => {
                    if (e.key === 'Enter' && inlineNewAddr.trim()) {
                      const newAddrObj = { label: `Alamat ${selectedCustomer.addresses.length + 1}`, address: inlineNewAddr.trim(), is_default: selectedCustomer.addresses.length === 0, notes: '' }
                      await addAddress(selectedCustomer.id, newAddrObj)
                      const withNew = { ...selectedCustomer, addresses: [...selectedCustomer.addresses, { ...newAddrObj, id: 'temp' }] }
                      setSelectedCustomer(withNew)
                      setNewOrder({ ...newOrder, customer_address: inlineNewAddr.trim() })
                      setInlineNewAddr('')
                      setInlineAddingNew(false)
                    } else if (e.key === 'Escape') {
                      setInlineNewAddr(''); setInlineAddingNew(false)
                    }
                  }}
                />
                <button type="button" onClick={async () => {
                  if (!inlineNewAddr.trim()) return
                  const newAddrObj = { label: `Alamat ${selectedCustomer.addresses.length + 1}`, address: inlineNewAddr.trim(), is_default: selectedCustomer.addresses.length === 0, notes: '' }
                  await addAddress(selectedCustomer.id, newAddrObj)
                  const withNew = { ...selectedCustomer, addresses: [...selectedCustomer.addresses, { ...newAddrObj, id: 'temp' }] }
                  setSelectedCustomer(withNew)
                  setNewOrder({ ...newOrder, customer_address: inlineNewAddr.trim() })
                  setInlineNewAddr(''); setInlineAddingNew(false)
                }} className="flex-shrink-0 text-green-600 hover:text-green-700">
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button type="button" onClick={() => { setInlineNewAddr(''); setInlineAddingNew(false) }} className="flex-shrink-0 text-gray-400 hover:text-gray-600">
                  <XCircle className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setInlineAddingNew(true)}
                className="text-xs text-teal-600 font-medium hover:text-teal-700 flex items-center gap-1 mt-0.5"
              >
                <Plus className="w-3 h-3" />
                Tambah Alamat Baru
              </button>
            )
          )}

          {!selectedCustomer && (
            <Textarea
              placeholder="Masukkan alamat lengkap..."
              value={newOrder.customer_address}
              onChange={e => setNewOrder({ ...newOrder, customer_address: e.target.value })}
            />
          )}
        </div>

        {/* Order Items */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700">Daftar Barang (opsional)</p>
          {(newOrder.items || []).length > 0 && (
            <div className="space-y-1">
              {(newOrder.items || []).map((item, i) => (
                <div key={i} className="flex items-center justify-between bg-gray-50 px-3 py-1.5 rounded-lg text-sm">
                  <span className="text-gray-800">{item.nama}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-600">Rp {item.harga.toLocaleString('id-ID')}</span>
                    <button
                      type="button"
                      onClick={() => setNewOrder({ ...newOrder, items: (newOrder.items || []).filter((_, idx) => idx !== i) })}
                      className="text-gray-400 hover:text-red-500"
                    >✕</button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Nama barang"
              id="new_item_nama"
              className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-teal-400"
            />
            <input
              type="text"
              inputMode="numeric"
              placeholder="Harga (Rp)"
              id="new_item_harga"
              className="w-32 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-teal-400"
              onChange={e => {
                const val = e.target.value.replace(/[^0-9]/g, '');
                if (val) e.target.value = Number(val).toLocaleString('id-ID');
              }}
            />
            <button
              type="button"
              onClick={() => {
                const namaEl = document.getElementById('new_item_nama') as HTMLInputElement;
                const hargaEl = document.getElementById('new_item_harga') as HTMLInputElement;
                const nama = namaEl?.value.trim();
                const harga = Number((hargaEl?.value || '').replace(/[^0-9]/g, ''));
                if (!nama) return;
                setNewOrder({ ...newOrder, items: [...(newOrder.items || []), { nama, harga }] });
                if (namaEl) namaEl.value = '';
                if (hargaEl) hargaEl.value = '';
              }}
              className="px-3 py-1.5 text-sm bg-teal-600 text-white rounded-lg font-medium"
            >+ Tambah</button>
          </div>
        </div>

        {/* Fees and Delivery Time */}
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Fee Ongkir"
            type="text"
            value={newOrder.total_fee !== undefined ? `Rp ${newOrder.total_fee.toLocaleString('id-ID')}` : ''}
            onChange={e => {
              const numericValue = Number(e.target.value.replace(/[^0-9]/g, ''));
              setNewOrder({ ...newOrder, total_fee: numericValue });
            }}
            placeholder="Rp 0"
          />
          <Input
            label="Estimated Delivery Time"
            type="datetime-local"
            value={newOrder.estimated_delivery_time}
            onChange={e => setNewOrder({ ...newOrder, estimated_delivery_time: e.target.value })}
          />
        </div>

        <Select
          label="Payment Status"
          value={newOrder.payment_status}
          onChange={e => setNewOrder({ ...newOrder, payment_status: e.target.value as any })}
          options={[
            { value: 'unpaid', label: 'Belum Setor' },
            { value: 'paid', label: 'Sudah Setor' }
          ]}
        />

        {formError && <p className="text-sm text-red-500 mb-2">{formError}</p>}

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={() => { onClose(); setFormError(''); setIsCreating(false); }}>Cancel</Button>
          <Button onClick={handleCreateOrder} disabled={isCreating} isLoading={isCreating}>
            {isCreating ? 'Menyimpan...' : 'Create Order'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
