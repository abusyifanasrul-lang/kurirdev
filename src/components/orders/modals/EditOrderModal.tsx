import React from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { Textarea } from '@/components/ui/Textarea';
import { Pencil, Trash2, Check, XCircle, Plus, Printer } from 'lucide-react';
import { format } from 'date-fns';
import { Customer, Order, Courier, User } from '@/types/index';
import { getStatusBadgeVariant, getStatusLabel } from '@/components/ui/Badge';
import { formatCurrency } from '@/utils/formatter';

const DEFAULT_COURIER_INSTRUCTIONS = [
  { label: 'Ketemu Penjual, Titip Bayar', icon: '💰', instruction: 'Bertemu penjual, bayarkan pesanan sesuai total belanja.' },
  { label: 'Ketemu Penjual, Ambil Saja', icon: '📦', instruction: 'Ambil barang yang sudah dibayar/siap.' },
  { label: 'Belanja Dulu (Talangi)', icon: '🛒', instruction: 'Beli barang sesuai daftar, talangi uangnya.' },
  { label: 'Ambil & Kirim Dokumen', icon: '📄', instruction: 'Pastikan dokumen aman dan tidak tertekuk.' }
];

interface EditOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
  setSelectedOrder: (order: Order | null) => void;
  isOpsAdmin: boolean;
  isFinance: boolean;
  editForm: Partial<Order>;
  setEditForm: React.Dispatch<React.SetStateAction<Partial<Order>>>;
  handleSaveChanges: () => Promise<void>;
  editItems: any[];
  setEditItems: (items: any[]) => void;
  editItemNama: string;
  setEditItemNama: (val: string) => void;
  editItemHarga: string;
  setEditItemHarga: (val: string) => void;
  editSelectedCustomer: Customer | null;
  setEditSelectedCustomer: (customer: Customer | null) => void;
  editInlineAddrId: string | null;
  setEditInlineAddrId: (id: string | null) => void;
  editInlineAddrValue: string;
  setEditInlineAddrValue: (val: string) => void;
  editInlineAddingNew: boolean;
  setEditInlineAddingNew: (val: boolean) => void;
  assignCourierId: string;
  setAssignCourierId: (id: string) => void;
  availableCouriers: Courier[];
  handleAssign: () => Promise<void>;
  courierWaitingOrder: (cid: string) => Order | undefined;
  courier_instructions: any[];
  setIsCancelModalOpen: (val: boolean) => void;
  updateOrder: (id: string, data: any) => Promise<void>;
  updateOrderStatus: (orderId: string, status: any, userId: string, userName: string) => Promise<void>;
  handlePrintInvoice: (order: Order) => void;
  getCourierName: (cid: string | null) => string;
  user: User | null;
  updateAddress: (cid: string, aid: string, data: any) => Promise<void>;
  deleteAddress: (cid: string, aid: string) => Promise<void>;
  addAddress: (cid: string, data: any) => Promise<void>;
}

export const EditOrderModal: React.FC<EditOrderModalProps> = ({
  isOpen,
  onClose,
  order: selectedOrder,
  setSelectedOrder,
  isOpsAdmin,
  isFinance,
  editForm,
  setEditForm,
  handleSaveChanges,
  editItems,
  setEditItems,
  editItemNama,
  setEditItemNama,
  editItemHarga,
  setEditItemHarga,
  editSelectedCustomer,
  setEditSelectedCustomer,
  editInlineAddrId,
  setEditInlineAddrId,
  editInlineAddrValue,
  setEditInlineAddrValue,
  editInlineAddingNew,
  setEditInlineAddingNew,
  assignCourierId,
  setAssignCourierId,
  availableCouriers,
  handleAssign,
  courierWaitingOrder,
  courier_instructions: prop_courier_instructions,
  setIsCancelModalOpen,
  updateOrder,
  updateOrderStatus,
  handlePrintInvoice,
  getCourierName,
  user,
  updateAddress,
  deleteAddress,
  addAddress
}) => {
  if (!selectedOrder) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="📦 Detail Pesanan" size="md">
      <div className="space-y-3">
        {/* Header - compact */}
        <div className="flex justify-between items-center bg-gray-50 px-3 py-2 rounded-lg">
          <div className="flex items-center gap-3">
            <div>
              <span className="text-base font-bold text-gray-900">{selectedOrder.order_number}</span>
              <span className="text-xs text-gray-400 ml-2">
                {format(new Date(selectedOrder.created_at), 'dd MMM yy, HH:mm')}
              </span>
            </div>
            {handlePrintInvoice && selectedOrder.status === 'delivered' && (
              <button 
                onClick={() => handlePrintInvoice(selectedOrder)}
                className="p-1.5 text-gray-400 hover:text-teal-600 hover:bg-teal-50 rounded-md transition-colors"
                title="Print Invoice"
              >
                <Printer className="w-4 h-4" />
              </button>
            )}
          </div>
          <Badge variant={getStatusBadgeVariant(selectedOrder.status)} size="sm">
            {getStatusLabel(selectedOrder.status)}
          </Badge>
        </div>

        {/* Customer + Payment — form if pending AND ops admin, otherwise read-only */}
        {selectedOrder.status === 'pending' && isOpsAdmin ? (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <Input
                label="Name"
                value={editForm.customer_name}
                onChange={e => setEditForm(prev => ({ ...prev, customer_name: e.target.value }))}
              />
              <Input
                label="Phone"
                value={editForm.customer_phone}
                onChange={e => setEditForm(prev => ({ ...prev, customer_phone: e.target.value }))}
              />
            </div>
            
            {/* Address Selection */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700">Alamat</label>
              {editSelectedCustomer && editSelectedCustomer.addresses.map((addr) => (
                <div
                  key={addr.id}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded-lg border transition-colors ${
                    editInlineAddrId === addr.id 
                      ? 'border-teal-400 bg-teal-50' 
                      : editForm.customer_address === addr.address 
                      ? 'border-teal-300 bg-teal-50/40' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <button type="button" onClick={() => {
                    if (editInlineAddrId !== addr.id)
                      setEditForm(prev => ({ ...prev, customer_address: addr.address }))
                  }} className="flex-shrink-0">
                    <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${
                      editForm.customer_address === addr.address && editInlineAddrId !== addr.id
                        ? 'border-teal-500' : 'border-gray-300'
                    }`}>
                      {editForm.customer_address === addr.address && editInlineAddrId !== addr.id && (
                        <div className="w-1.5 h-1.5 rounded-full bg-teal-500" />
                      )}
                    </div>
                  </button>
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded flex-shrink-0 ${
                    addr.is_default ? 'bg-teal-100 text-teal-600' : 'bg-gray-100 text-gray-500'
                  }`}>{addr.label}</span>

                  {editInlineAddrId === addr.id ? (
                    <>
                      <input
                        className="flex-1 text-sm border-0 bg-transparent outline-none min-w-0 text-gray-800"
                        value={editInlineAddrValue}
                        autoFocus
                        onChange={e => setEditInlineAddrValue(e.target.value)}
                        onKeyDown={async (e) => {
                          if (e.key === 'Enter') {
                            await updateAddress(editSelectedCustomer.id, addr.id, { address: editInlineAddrValue })
                            const updated = { ...editSelectedCustomer, addresses: editSelectedCustomer.addresses.map(a => a.id === addr.id ? { ...a, address: editInlineAddrValue } : a) }
                            setEditSelectedCustomer(updated)
                            if (editForm.customer_address === addr.address) setEditForm(prev => ({ ...prev, customer_address: editInlineAddrValue }))
                            setEditInlineAddrId(null)
                          } else if (e.key === 'Escape') setEditInlineAddrId(null)
                        }}
                      />
                      <button type="button" onClick={async () => {
                        await updateAddress(editSelectedCustomer.id, addr.id, { address: editInlineAddrValue })
                        const updated = { ...editSelectedCustomer, addresses: editSelectedCustomer.addresses.map(a => a.id === addr.id ? { ...a, address: editInlineAddrValue } : a) }
                        setEditSelectedCustomer(updated)
                        if (editForm.customer_address === addr.address) setEditForm(prev => ({ ...prev, customer_address: editInlineAddrValue }))
                        setEditInlineAddrId(null)
                      }} className="flex-shrink-0 text-green-600 hover:text-green-700"><Check className="w-3.5 h-3.5" /></button>
                      <button type="button" onClick={() => setEditInlineAddrId(null)} className="flex-shrink-0 text-gray-400 hover:text-gray-600"><XCircle className="w-3.5 h-3.5" /></button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 text-sm text-gray-700 truncate">{addr.address}</span>
                      <button type="button" onClick={() => { setEditInlineAddrId(addr.id); setEditInlineAddrValue(addr.address) }} className="flex-shrink-0 text-gray-400 hover:text-teal-600"><Pencil className="w-3 h-3" /></button>
                      <button type="button" onClick={async () => {
                        await deleteAddress(editSelectedCustomer.id, addr.id)
                        const updated = { ...editSelectedCustomer, addresses: editSelectedCustomer.addresses.filter(a => a.id !== addr.id) }
                        setEditSelectedCustomer(updated)
                        if (editForm.customer_address === addr.address) {
                          const next = updated.addresses[0]
                          setEditForm(prev => ({ ...prev, customer_address: next ? next.address : '' }))
                        }
                      }} className="flex-shrink-0 text-gray-400 hover:text-red-500"><Trash2 className="w-3 h-3" /></button>
                    </>
                  )}
                </div>
              ))}

              {editSelectedCustomer && editInlineAddingNew ? (
                 <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg border border-dashed border-teal-400 bg-teal-50">
                   <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-teal-100 text-teal-600 flex-shrink-0">Baru</span>
                   <input
                     className="flex-1 text-sm border-0 bg-transparent outline-none min-w-0 text-gray-800"
                     placeholder="Ketik alamat baru..."
                     autoFocus
                     value={editInlineAddrValue}
                     onChange={e => setEditInlineAddrValue(e.target.value)}
                     onKeyDown={async (e) => {
                       if (e.key === 'Enter' && editInlineAddrValue.trim()) {
                         const newA = { label: `Alamat ${editSelectedCustomer.addresses.length + 1}`, address: editInlineAddrValue.trim(), is_default: editSelectedCustomer.addresses.length === 0, notes: '' }
                         await addAddress(editSelectedCustomer.id, newA)
                         setEditSelectedCustomer({ ...editSelectedCustomer, addresses: [...editSelectedCustomer.addresses, { ...newA, id: 'temp' }] })
                         setEditForm(prev => ({ ...prev, customer_address: editInlineAddrValue.trim() }))
                         setEditInlineAddrValue('')
                         setEditInlineAddingNew(false)
                       } else if (e.key === 'Escape') { setEditInlineAddrValue(''); setEditInlineAddingNew(false) }
                     }}
                   />
                   <button type="button" onClick={async () => {
                     if (!editInlineAddrValue.trim()) return
                     const newA = { label: `Alamat ${editSelectedCustomer.addresses.length + 1}`, address: editInlineAddrValue.trim(), is_default: editSelectedCustomer.addresses.length === 0, notes: '' }
                     await addAddress(editSelectedCustomer.id, newA)
                     setEditSelectedCustomer({ ...editSelectedCustomer, addresses: [...editSelectedCustomer.addresses, { ...newA, id: 'temp' }] })
                     setEditForm(prev => ({ ...prev, customer_address: editInlineAddrValue.trim() }))
                     setEditInlineAddingNew(false)
                   }} className="flex-shrink-0 text-green-600 hover:text-green-700"><Check className="w-3.5 h-3.5" /></button>
                   <button type="button" onClick={() => { setEditInlineAddrValue(''); setEditInlineAddingNew(false) }} className="flex-shrink-0 text-gray-400 hover:text-gray-600"><XCircle className="w-3.5 h-3.5" /></button>
                 </div>
              ) : editSelectedCustomer && (
                <button type="button" onClick={() => { setEditInlineAddingNew(true); setEditInlineAddrValue('') }}
                        className="text-xs text-teal-600 font-medium hover:text-teal-700 flex items-center gap-1">
                  <Plus className="w-3 h-3" /> Tambah Alamat Baru
                </button>
              )}

              {!editSelectedCustomer && (
                <Textarea
                  value={editForm.customer_address}
                  onChange={e => setEditForm(prev => ({ ...prev, customer_address: e.target.value }))}
                  rows={2}
                />
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Input
                label="Ongkir"
                value={editForm.total_fee ? `Rp ${editForm.total_fee.toLocaleString('id-ID')}` : ''}
                onChange={e => {
                  const val = Number(e.target.value.replace(/[^0-9]/g, ''));
                  setEditForm(prev => ({ ...prev, total_fee: val }));
                }}
              />
              <Select
                label="Setoran"
                value={editForm.payment_status}
                onChange={e => setEditForm(prev => ({ ...prev, payment_status: e.target.value as any }))}
                options={[
                  { value: 'unpaid', label: 'Belum Setor' },
                  { value: 'paid', label: 'Sudah Setor' }
                ]}
              />
            </div>

            {/* Daftar Belanja */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700">Daftar Belanja (opsional)</p>
              {editItems.map((item, i) => (
                <div key={i} className="flex items-center justify-between text-sm bg-gray-50 px-3 py-2 rounded-lg">
                  <span>{item.nama}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500">Rp {item.harga.toLocaleString('id-ID')}</span>
                    <button type="button" onClick={() => setEditItems(editItems.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-600 text-xs">✕</button>
                  </div>
                </div>
              ))}
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Nama barang"
                  value={editItemNama}
                  onChange={e => setEditItemNama(e.target.value)}
                  className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
                <input
                  type="number"
                  placeholder="Harga"
                  value={editItemHarga}
                  onChange={e => setEditItemHarga(e.target.value)}
                  className="w-28 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!editItemNama || !editItemHarga) return;
                    setEditItems([...editItems, { nama: editItemNama, harga: Number(editItemHarga) }]);
                    setEditItemNama(''); setEditItemHarga('');
                  }}
                  className="px-3 py-2 bg-teal-600 text-white text-sm rounded-lg hover:bg-teal-700"
                >+</button>
              </div>
            </div>
            <div className="flex justify-end">
              <Button size="sm" variant="secondary" onClick={handleSaveChanges}>Simpan Perubahan</Button>
            </div>
          </div>
        ) : (
          <div className="text-sm space-y-1.5">
            <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
              <span className="text-gray-400">Customer</span>
              <span className="font-medium text-gray-900">{selectedOrder.customer_name}</span>
              <span className="text-gray-400">Phone</span>
              <span>{selectedOrder.customer_phone}</span>
              <span className="text-gray-400">Address</span>
              <span className="whitespace-pre-wrap">{selectedOrder.customer_address}</span>
              <span className="text-gray-400">Fee</span>
              <span className="font-medium">{formatCurrency(selectedOrder.total_fee)}</span>
              
              {((selectedOrder.items && selectedOrder.items.length > 0) || selectedOrder.item_name) && (
                <>
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide mt-1">Daftar Barang</span>
                  {(selectedOrder.items && selectedOrder.items.length > 0) ? (
                    <div className="space-y-0.5">
                      {selectedOrder.items.map((item, i) => (
                        <div key={i} className="flex justify-between text-sm">
                          <span className="text-gray-800">{item.nama}</span>
                          <span className="text-gray-600 font-medium">Rp {item.harga.toLocaleString('id-ID')}</span>
                        </div>
                      ))}
                      <div className="flex justify-between text-sm font-semibold border-t border-gray-100 pt-1 mt-1">
                        <span className="text-gray-700">Total Belanja</span>
                        <span className="text-gray-800">Rp {selectedOrder.items.reduce((s, i) => s + i.harga, 0).toLocaleString('id-ID')}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-800">{selectedOrder.item_name || '-'}</span>
                      <span className="text-gray-600 font-medium">{selectedOrder.item_price ? `Rp ${selectedOrder.item_price.toLocaleString('id-ID')}` : '-'}</span>
                    </div>
                  )}
                </>
              )}
              <span className="text-gray-400">Setoran</span>
              <span>
                <Badge variant={selectedOrder.payment_status === 'paid' ? 'success' : 'warning'} size="sm">
                  {selectedOrder.payment_status === 'paid' ? 'Sudah Setor' : 'Belum Setor'}
                </Badge>
                {isFinance && selectedOrder.payment_status !== 'paid' && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="ml-2 h-7 py-0 text-teal-600"
                    onClick={() => updateOrder(selectedOrder.id, { payment_status: 'paid' })}
                  >
                    Mark as Paid
                  </Button>
                )}
              </span>
            </div>
          </div>
        )}

        {/* Courier Assignment */}
        <div className="border-t pt-2">
          {selectedOrder.status === 'pending' && isOpsAdmin ? (
            <div className="bg-teal-50 rounded-lg p-4 border border-teal-100 space-y-3">
              <h4 className="text-sm font-bold text-teal-900">Tugaskan Kurir</h4>
              <div className="flex gap-2">
                <Select
                  className="flex-1"
                  placeholder="Pilih Kurir..."
                  value={assignCourierId}
                  onChange={e => setAssignCourierId(e.target.value)}
                  options={availableCouriers.map(c => {
                    const waiting = courierWaitingOrder(c.id);
                    return {
                      value: c.id,
                      label: waiting ? `${c.name} 📝 PENDING — ${waiting.order_number}` : `${c.name} (Online)`
                    };
                  })}
                />
                <Button 
                  className="bg-teal-600 hover:bg-teal-700 text-white px-8"
                  onClick={handleAssign}
                  disabled={!assignCourierId}
                >
                  Tugaskan
                </Button>
              </div>
              
              <div className="mt-2 space-y-1">
                <Select
                  label="Instruksi untuk Kurir"
                  value={selectedOrder.notes || ''}
                  onChange={e => setSelectedOrder({ ...selectedOrder, notes: e.target.value })}
                  options={(prop_courier_instructions || DEFAULT_COURIER_INSTRUCTIONS).map((i: any) => ({ value: i.label, label: `${i.icon} ${i.label}` }))}
                  placeholder="— Tidak ada instruksi khusus —"
                />
                {selectedOrder.notes && (() => {
                  const match = (prop_courier_instructions || DEFAULT_COURIER_INSTRUCTIONS).find((i: any) => i.label === selectedOrder.notes)
                  if (!match) return null
                  return (
                    <div className="flex items-center gap-1.5 text-xs text-teal-600 mt-1">
                      <span>{match.icon}</span>
                      <span>{match.instruction}</span>
                    </div>
                  )
                })()}
              </div>
              <p className="text-[10px] text-teal-600">
                * Kurir diurutkan berdasarkan antrian FIFO. Antrian akan berputar otomatis setelah tugas diberikan.
              </p>
            </div>
          ) : (
            <div className="text-sm grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
              <span className="text-gray-400">Kurir</span>
              <span className="font-medium">{getCourierName(selectedOrder.courier_id || null) || 'Belum Ditugaskan'}</span>
              {selectedOrder.assigned_at && (
                <>
                  <span className="text-gray-400">Ditugaskan</span>
                  <span>{format(new Date(selectedOrder.assigned_at), 'dd MMM yy, HH:mm')}</span>
                </>
              )}
            </div>
          )}
        </div>

        {/* Action Buttons (Cancel, SuperAdmin Force) */}
        <div className="flex justify-between items-center pt-2 border-t">
          <div className="flex gap-2">
            {isOpsAdmin && (
              <Button
                variant="ghost"
                size="sm"
                className="text-red-500 hover:text-red-700 hover:bg-red-50"
                onClick={() => setIsCancelModalOpen(true)}
                disabled={['delivered', 'cancelled'].includes(selectedOrder.status)}
              >
                Batalkan Pesanan
              </Button>
            )}
            {user?.role === 'admin' && (
              <Button
                variant="ghost"
                size="sm"
                className="text-teal-600 hover:text-teal-800 hover:bg-teal-50 flex items-center gap-1"
                onClick={async () => {
                  const tgt = window.prompt(`Force Update Code:`, selectedOrder.status);
                  if (tgt && user) {
                    await updateOrderStatus(selectedOrder.id, tgt, user.id, user.name || 'Admin');
                  }
                }}
              >
                Force Update
              </Button>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={onClose}>Tutup</Button>
        </div>
      </div>
    </Modal>
  );
};
