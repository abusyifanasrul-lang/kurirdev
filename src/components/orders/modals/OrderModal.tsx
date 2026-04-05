import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge, getStatusBadgeVariant, getStatusLabel } from '@/components/ui/Badge';
import { Textarea } from '@/components/ui/Textarea';
import { 
  Printer, 
  Pencil, 
  Trash2, 
  Check, 
  XCircle, 
  Plus,
  ShoppingBag,
  User as UserIcon,
  MapPin,
  CreditCard,
  ClipboardList
} from 'lucide-react';
import { formatCurrency } from '@/utils/formatter';
import { formatWIB } from '@/utils/date';
import { Order, User, Customer } from '@/types';

const DEFAULT_COURIER_INSTRUCTIONS = [
  { label: 'Ketemu Penjual, Titip Bayar', icon: '💰', instruction: 'Bertemu penjual, bayarkan pesanan sesuai total belanja.' },
  { label: 'Ketemu Penjual, Ambil Saja', icon: '📦', instruction: 'Ambil barang yang sudah dibayar/siap.' },
  { label: 'Belanja Dulu (Talangi)', icon: '🛒', instruction: 'Beli barang sesuai daftar, talangi uangnya.' },
  { label: 'Ambil & Kirim Dokumen', icon: '📄', instruction: 'Pastikan dokumen aman dan tidak tertekuk.' }
];

interface OrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
  user: User | null;
  // Permissions
  isOpsAdmin: boolean;
  isFinance: boolean;
  // Actions
  handleSaveChanges: (updatedOrder: Partial<Order>, items: any[]) => Promise<void>;
  handleAssign: (courierId: string, notes?: string) => Promise<void>;
  handlePrintInvoice: (order: Order) => void;
  updateOrder?: (id: string, data: any) => Promise<void>;
  updateOrderStatus?: (orderId: string, status: any, userId: string, userName: string) => Promise<void>;
  handleCancel?: () => void;
  // Helpers/Data
  availableCouriers: User[];
  courierWaitingOrder: (cid: string) => Order | undefined;
  getCourierName: (cid: string | null) => string;
  // Address Management
  customers: Customer[];
  updateAddress: (customerId: string, addressId: string, data: any) => Promise<void>;
  deleteAddress: (customerId: string, addressId: string) => Promise<void>;
  addAddress: (customerId: string, data: any) => Promise<void>;
}

export const OrderModal: React.FC<OrderModalProps> = ({
  isOpen,
  onClose,
  order,
  user,
  isOpsAdmin,
  isFinance,
  handleSaveChanges,
  handleAssign,
  handlePrintInvoice,
  updateOrder,
  updateOrderStatus,
  handleCancel,
  availableCouriers,
  courierWaitingOrder,
  getCourierName,
  customers,
  updateAddress,
  deleteAddress,
  addAddress
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [assignCourierId, setAssignCourierId] = useState('');
  
  // Edit States
  const [editForm, setEditForm] = useState<Partial<Order>>({});
  const [editItems, setEditItems] = useState<any[]>([]);
  const [editItemNama, setEditItemNama] = useState('');
  const [editItemHarga, setEditItemHarga] = useState('');
  
  // Address Edit States
  const [inlineAddrId, setInlineAddrId] = useState<string | null>(null);
  const [inlineAddrValue, setInlineAddrValue] = useState('');
  const [inlineAddingNew, setInlineAddingNew] = useState(false);

  // Sync edit states when editing starts or order changes
  useEffect(() => {
    if (order) {
      setEditForm({
        customer_name: order.customer_name,
        customer_phone: order.customer_phone,
        customer_address: order.customer_address,
        total_fee: order.total_fee,
        payment_status: order.payment_status,
        notes: order.notes
      });
      setEditItems(order.items || (order.item_name ? [{ nama: order.item_name, harga: order.item_price || 0 }] : []));
      setAssignCourierId(order.courier_id || '');
    }
  }, [order, isEditing]);

  if (!order) return null;

  const currentCustomer = customers.find(c => c.phone === order.customer_phone) || null;

  const handleSave = async () => {
    await handleSaveChanges(editForm, editItems);
    setIsEditing(false);
  };

  const onModalClose = () => {
    setIsEditing(false);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onModalClose} title="📦 Detail Pesanan" size="lg">
      <div className="space-y-4">
        {/* Header Section */}
        <div className="flex justify-between items-start bg-gray-50 p-4 rounded-xl">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-bold text-gray-900">{order.order_number}</h3>
              {order.status === 'delivered' && (
                <button 
                  onClick={() => handlePrintInvoice(order)}
                  className="p-1.5 text-gray-400 hover:text-teal-600 hover:bg-teal-50 rounded-md transition-colors"
                  title="Print Invoice"
                >
                  <Printer className="w-4 h-4" />
                </button>
              )}
            </div>
            <p className="text-sm text-gray-500">
              Dibuat pada {formatWIB(order.created_at)}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Badge variant={getStatusBadgeVariant(order.status)} className="px-3 py-1 text-sm">
              {getStatusLabel(order.status)}
            </Badge>
          </div>
        </div>

        {/* Edit Form or Details View */}
        {isEditing ? (
          <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Nama Customer"
                value={editForm.customer_name}
                onChange={e => setEditForm(prev => ({ ...prev, customer_name: e.target.value }))}
              />
              <Input
                label="No. Telepon"
                value={editForm.customer_phone}
                onChange={e => setEditForm(prev => ({ ...prev, customer_phone: e.target.value }))}
              />
            </div>

            {/* Address Selection */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Alamat Pengiriman</label>
              {currentCustomer ? (
                <div className="space-y-2">
                  {currentCustomer.addresses.map((addr) => (
                    <div
                      key={addr.id}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all ${
                        inlineAddrId === addr.id 
                          ? 'border-teal-400 bg-teal-50 ring-2 ring-teal-100' 
                          : editForm.customer_address === addr.address 
                          ? 'border-teal-300 bg-teal-50/50' 
                          : 'border-gray-200 hover:border-gray-300 bg-white'
                      }`}
                    >
                      <button 
                        type="button" 
                        onClick={() => {
                          if (inlineAddrId !== addr.id) {
                            setEditForm(prev => ({ ...prev, customer_address: addr.address }));
                          }
                        }} 
                        className="flex-shrink-0"
                      >
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                          editForm.customer_address === addr.address && inlineAddrId !== addr.id
                            ? 'border-teal-500' : 'border-gray-300'
                        }`}>
                          {editForm.customer_address === addr.address && inlineAddrId !== addr.id && (
                            <div className="w-2 h-2 rounded-full bg-teal-500" />
                          )}
                        </div>
                      </button>

                      <Badge variant={addr.is_default ? 'success' : 'secondary'} size="sm" className="flex-shrink-0">
                        {addr.label}
                      </Badge>

                      {inlineAddrId === addr.id ? (
                        <>
                          <input
                            className="flex-1 text-sm border-0 bg-transparent outline-none min-w-0 text-gray-800 font-medium"
                            value={inlineAddrValue}
                            autoFocus
                            onChange={e => setInlineAddrValue(e.target.value)}
                            onKeyDown={async (e) => {
                              if (e.key === 'Enter') {
                                await updateAddress(currentCustomer.id, addr.id, { address: inlineAddrValue });
                                if (editForm.customer_address === addr.address) {
                                  setEditForm(prev => ({ ...prev, customer_address: inlineAddrValue }));
                                }
                                setInlineAddrId(null);
                              } else if (e.key === 'Escape') setInlineAddrId(null);
                            }}
                          />
                          <div className="flex items-center gap-1">
                            <button 
                              type="button" 
                              onClick={async () => {
                                await updateAddress(currentCustomer.id, addr.id, { address: inlineAddrValue });
                                if (editForm.customer_address === addr.address) {
                                  setEditForm(prev => ({ ...prev, customer_address: inlineAddrValue }));
                                }
                                setInlineAddrId(null);
                              }} 
                              className="p-1 text-green-600 hover:bg-green-100 rounded-md"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button 
                              type="button" 
                              onClick={() => setInlineAddrId(null)} 
                              className="p-1 text-gray-400 hover:bg-gray-100 rounded-md"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          </div>
                        </>
                      ) : (
                        <>
                          <span className="flex-1 text-sm text-gray-700 truncate">{addr.address}</span>
                          <div className="flex items-center gap-1">
                            <button 
                              type="button" 
                              onClick={() => { setInlineAddrId(addr.id); setInlineAddrValue(addr.address) }} 
                              className="p-1 text-gray-400 hover:text-teal-600 hover:bg-teal-50 rounded-md"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button 
                              type="button" 
                              onClick={async () => {
                                if (confirm('Hapus alamat ini?')) {
                                  await deleteAddress(currentCustomer.id, addr.id);
                                }
                              }} 
                              className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}

                  {inlineAddingNew ? (
                    <div className="flex items-center gap-3 px-3 py-2 border-2 border-dashed border-teal-300 rounded-xl bg-teal-50/30">
                      <Badge variant="secondary" size="sm" className="bg-white">Baru</Badge>
                      <input
                        className="flex-1 text-sm border-0 bg-transparent outline-none min-w-0 text-gray-800 placeholder:text-gray-400 font-medium"
                        placeholder="Ketik alamat baru..."
                        autoFocus
                        value={inlineAddrValue}
                        onChange={e => setInlineAddrValue(e.target.value)}
                        onKeyDown={async (e) => {
                          if (e.key === 'Enter' && inlineAddrValue.trim()) {
                            const newA = { 
                              label: `Alamat ${currentCustomer.addresses.length + 1}`, 
                              address: inlineAddrValue.trim(), 
                              is_default: currentCustomer.addresses.length === 0 
                            };
                            await addAddress(currentCustomer.id, newA);
                            setEditForm(prev => ({ ...prev, customer_address: inlineAddrValue.trim() }));
                            setInlineAddrValue('');
                            setInlineAddingNew(false);
                          } else if (e.key === 'Escape') { 
                            setInlineAddrValue(''); 
                            setInlineAddingNew(false); 
                          }
                        }}
                      />
                      <div className="flex items-center gap-1">
                        <button 
                          type="button" 
                          onClick={async () => {
                            if (!inlineAddrValue.trim()) return;
                            const newA = { 
                              label: `Alamat ${currentCustomer.addresses.length + 1}`, 
                              address: inlineAddrValue.trim(), 
                              is_default: currentCustomer.addresses.length === 0 
                            };
                            await addAddress(currentCustomer.id, newA);
                            setEditForm(prev => ({ ...prev, customer_address: inlineAddrValue.trim() }));
                            setInlineAddingNew(false);
                          }} 
                          className="p-1 text-green-600 hover:bg-green-100 rounded-md"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button 
                          type="button" 
                          onClick={() => { setInlineAddrValue(''); setInlineAddingNew(false) }} 
                          className="p-1 text-gray-400 hover:bg-gray-100 rounded-md"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button 
                      type="button" 
                      onClick={() => { setInlineAddingNew(true); setInlineAddrValue('') }}
                      className="w-full py-2 border-2 border-dashed border-gray-200 rounded-xl text-xs text-gray-500 font-medium hover:border-teal-300 hover:text-teal-600 hover:bg-teal-50/30 transition-all flex items-center justify-center gap-2"
                    >
                      <Plus className="w-4 h-4" /> Tambah Alamat Baru
                    </button>
                  )}
                </div>
              ) : (
                <Textarea
                  value={editForm.customer_address}
                  onChange={e => setEditForm(prev => ({ ...prev, customer_address: e.target.value }))}
                  rows={2}
                  className="rounded-xl"
                />
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Ongkos Kirim"
                value={editForm.total_fee ? `Rp ${editForm.total_fee.toLocaleString('id-ID')}` : ''}
                onChange={e => {
                  const val = Number(e.target.value.replace(/[^0-9]/g, ''));
                  setEditForm(prev => ({ ...prev, total_fee: val }));
                }}
              />
              <Select
                label="Status Setoran"
                value={editForm.payment_status}
                onChange={e => setEditForm(prev => ({ ...prev, payment_status: e.target.value as any }))}
                options={[
                  { value: 'unpaid', label: 'Belum Setor' },
                  { value: 'paid', label: 'Sudah Setor' }
                ]}
              />
            </div>

            {/* Order Items Edit */}
            <div className="space-y-3 bg-gray-50 p-4 rounded-xl border border-gray-100">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4" /> Daftar Belanja
                </h4>
                <Badge variant="secondary" className="bg-white">
                  {editItems.length} Item
                </Badge>
              </div>

              {editItems.length > 0 && (
                <div className="space-y-2">
                  {editItems.map((item, i) => (
                    <div key={i} className="flex items-center justify-between text-sm bg-white px-3 py-2.5 rounded-lg border border-gray-100 shadow-sm">
                      <span className="font-medium text-gray-700">{item.nama}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-teal-600 font-bold">{formatCurrency(item.harga)}</span>
                        <button 
                          type="button" 
                          onClick={() => setEditItems(editItems.filter((_, idx) => idx !== i))} 
                          className="p-1 text-red-300 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                  <div className="flex justify-between p-2 font-bold text-gray-900 bg-teal-50 rounded-lg">
                    <span>Total Belanja</span>
                    <span>{formatCurrency(editItems.reduce((sum, item) => sum + item.harga, 0))}</span>
                  </div>
                </div>
              )}

              <div className="flex gap-2 bg-white p-2 rounded-lg border border-gray-200">
                <input
                  type="text"
                  placeholder="Nama barang..."
                  value={editItemNama}
                  onChange={e => setEditItemNama(e.target.value)}
                  className="flex-1 text-sm border-0 focus:ring-0 px-2"
                />
                <input
                  type="number"
                  placeholder="Harga"
                  value={editItemHarga}
                  onChange={e => setEditItemHarga(e.target.value)}
                  className="w-24 text-sm border-0 border-l border-gray-100 focus:ring-0 px-2"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!editItemNama || !editItemHarga) return;
                    setEditItems([...editItems, { nama: editItemNama, harga: Number(editItemHarga) }]);
                    setEditItemNama(''); 
                    setEditItemHarga('');
                  }}
                  className="p-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Read-only View (Detailed) */
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Main Info Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 px-2">
              {/* Customer Column */}
              <div className="space-y-4">
                <h4 className="flex items-center gap-2 text-sm font-bold text-gray-400 uppercase tracking-wider">
                  <UserIcon className="w-4 h-4" /> Pelanggan
                </h4>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-gray-400">Nama Penerima</p>
                    <p className="font-bold text-gray-900 leading-tight">{order.customer_name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Nomor WhatsApp</p>
                    <p className="font-medium text-gray-700">{order.customer_phone}</p>
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <MapPin className="w-3.5 h-3.5 text-gray-400" />
                      <p className="text-xs text-gray-400">Alamat Pengiriman</p>
                    </div>
                    <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-xl border border-gray-100 italic leading-relaxed">
                      "{order.customer_address}"
                    </p>
                  </div>
                </div>
              </div>

              {/* Logistics Column */}
              <div className="space-y-4">
                <h4 className="flex items-center gap-2 text-sm font-bold text-gray-400 uppercase tracking-wider">
                  <CreditCard className="w-4 h-4" /> Logistics & Billing
                </h4>
                <div className="space-y-4">
                  <div className="bg-teal-50 p-4 rounded-2xl border border-teal-100/50">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs text-teal-600 font-medium">Ongkos Kirim</span>
                      <span className="text-lg font-black text-teal-700">{formatCurrency(order.total_fee)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-teal-600 font-medium">Status Setoran</span>
                        <Badge variant={order.payment_status === 'paid' ? 'success' : 'warning'}>
                          {order.payment_status === 'paid' ? 'Selesai' : 'Tertunda'}
                        </Badge>
                      </div>
                      {isFinance && order.payment_status !== 'paid' && updateOrder && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-7 py-0 text-teal-600 font-bold hover:bg-teal-100"
                          onClick={() => updateOrder(order.id, { payment_status: 'paid' })}
                        >
                          Mark as Paid
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs text-gray-400">Petugas Pengiriman</p>
                    <div className="flex items-center gap-2 bg-white border border-gray-100 p-2.5 rounded-xl shadow-sm">
                      <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center text-teal-600 font-bold text-xs">
                        {getCourierName(order.courier_id || null).charAt(0)}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-bold text-gray-900">{getCourierName(order.courier_id || null) || 'Belum Ditentukan'}</p>
                        {order.assigned_at && (
                          <p className="text-[10px] text-gray-400">Ditugaskan pada {formatWIB(order.assigned_at)}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Order Items View */}
            {((order.items && order.items.length > 0) || order.item_name) && (
              <div className="space-y-3 px-2 pt-2">
                <h4 className="flex items-center gap-2 text-sm font-bold text-gray-400 uppercase tracking-wider">
                  <ClipboardList className="w-4 h-4" /> Detail Belanja
                </h4>
                <div className="bg-gray-50 border border-gray-100 rounded-2xl overflow-hidden">
                  <div className="p-4 space-y-2.5">
                    {order.items && order.items.length > 0 ? (
                      order.items.map((item, i) => (
                        <div key={i} className="flex justify-between text-sm items-center">
                          <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-teal-400" />
                            <span className="text-gray-700">{item.nama}</span>
                          </div>
                          <span className="font-bold text-gray-900">{formatCurrency(item.harga)}</span>
                        </div>
                      ))
                    ) : (
                      <div className="flex justify-between text-sm items-center">
                        <div className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-teal-400" />
                          <span className="text-gray-700">{order.item_name}</span>
                        </div>
                        <span className="font-bold text-gray-900">{order.item_price ? formatCurrency(order.item_price) : '-'}</span>
                      </div>
                    )}
                  </div>
                  {order.items && order.items.length > 0 && (
                    <div className="bg-white border-t border-gray-100 p-4 flex justify-between items-center">
                      <span className="text-sm font-bold text-gray-500">Total Belanja</span>
                      <span className="text-lg font-black text-gray-900">
                        {formatCurrency(order.items.reduce((sum, item) => sum + item.harga, 0))}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Assignment Section (Standardized logic) */}
        {order.status === 'pending' && isOpsAdmin && (
          <div className="bg-amber-50 rounded-2xl p-5 border border-amber-100 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-amber-900 flex items-center gap-2">
                <UserIcon className="w-4 h-4" /> Langkah 2: Tugaskan Kurir
              </h4>
              <Badge variant="secondary" className="bg-white text-amber-600 border-amber-200">
                Pilih dari Antrian
              </Badge>
            </div>
            
            <div className="flex flex-col md:flex-row gap-3">
              <div className="flex-1">
                <Select
                  placeholder="Pilih Kurir..."
                  value={assignCourierId}
                  onChange={e => setAssignCourierId(e.target.value)}
                  className="bg-white"
                  options={availableCouriers.map(c => {
                    const waiting = courierWaitingOrder(c.id);
                    return {
                      value: c.id,
                      label: waiting ? `${c.name} 📝 PENDING — ${waiting.order_number}` : `${c.name} (Online)`
                    };
                  })}
                />
              </div>
              <Button 
                className="bg-amber-600 hover:bg-amber-700 text-white shadow-lg shadow-amber-200 disabled:bg-gray-300 disabled:shadow-none transition-all px-8 rounded-xl font-bold"
                onClick={() => handleAssign(assignCourierId, isEditing ? editForm.notes : order.notes || undefined)}
                disabled={!assignCourierId}
              >
                Konfirmasi Penugasan
              </Button>
            </div>

            <div className="space-y-1 mt-2">
              <Select
                label="Instruksi Khusus untuk Kurir"
                value={isEditing ? (editForm.notes || '') : (order.notes || '')}
                onChange={e => {
                  if (isEditing) {
                    setEditForm(prev => ({ ...prev, notes: e.target.value }));
                  } else if (updateOrder) {
                    updateOrder(order.id, { notes: e.target.value });
                  }
                }}
                className="bg-white"
                options={DEFAULT_COURIER_INSTRUCTIONS.map(i => ({ value: i.label, label: `${i.icon} ${i.label}` }))}
                placeholder="— Tidak ada instruksi —"
              />
              {(isEditing ? editForm.notes : order.notes) && (() => {
                const noteValue = isEditing ? editForm.notes : order.notes;
                const match = DEFAULT_COURIER_INSTRUCTIONS.find(i => i.label === noteValue);
                if (!match) return null;
                return (
                  <div className="flex items-center gap-1.5 text-[11px] text-amber-700 bg-white/50 p-2 rounded-lg border border-amber-100">
                    <span className="text-sm">{match.icon}</span>
                    <span className="font-medium italic leading-none">{match.instruction}</span>
                  </div>
                );
              })()}
            </div>

            <p className="text-[10px] text-amber-600 text-center font-medium">
               🚀 Pastikan instruksi sudah sesuai sebelum menekan tombol konfirmasi.
            </p>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex flex-col md:flex-row justify-between items-center pt-4 border-t gap-3">
          <div className="flex items-center gap-2">
            {isOpsAdmin && ['pending', 'assigned', 'on_stay', 'picked_up'].includes(order.status) && (
              <Button 
                variant="ghost" 
                className="text-red-500 hover:text-red-600 hover:bg-red-50 font-bold"
                onClick={handleCancel}
              >
                Batalkan Pesanan
              </Button>
            )}
            
            {user?.role === 'admin' && updateOrderStatus && (
              <Button
                variant="ghost"
                className="text-teal-600 hover:bg-teal-50 font-bold"
                onClick={async () => {
                  const tgt = window.prompt(`Force Update Status Code:`, order.status);
                  if (tgt && user) {
                    await updateOrderStatus(order.id, tgt, user.id, user.name || 'Admin');
                  }
                }}
              >
                Force Update
              </Button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={onModalClose} className="rounded-xl px-6">
              Tutup
            </Button>
            
            {isOpsAdmin && order.status === 'pending' && (
              isEditing ? (
                <Button 
                  className="bg-teal-600 hover:bg-teal-700 text-white rounded-xl shadow-lg shadow-teal-100 px-8 font-bold"
                  onClick={handleSave}
                >
                  Simpan Perubahan
                </Button>
              ) : (
                <Button 
                  className="bg-teal-600 hover:bg-teal-700 text-white rounded-xl shadow-lg shadow-teal-100 px-8 font-bold"
                  onClick={() => setIsEditing(true)}
                >
                  Edit Pesanan
                </Button>
              )
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};
