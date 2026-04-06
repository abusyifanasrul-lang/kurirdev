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
import { Order, User, Customer, CourierInstruction } from '@/types';


interface OrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
  // Permissions
  isOpsAdmin: boolean;
  // Actions
  handleSaveChanges: (updatedOrder: Partial<Order>, items: any[]) => Promise<void>;
  handleAssign: (courierId: string, notes?: string) => Promise<void>;
  handlePrintInvoice: (order: Order) => void;
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
  courierInstructions: CourierInstruction[];
}

export const OrderModal: React.FC<OrderModalProps> = ({
  isOpen,
  onClose,
  order,
  isOpsAdmin,
  handleSaveChanges,
  handleAssign,
  handlePrintInvoice,
  handleCancel,
  availableCouriers,
  courierWaitingOrder,
  getCourierName,
  customers,
  updateAddress,
  deleteAddress,
  addAddress,
  courierInstructions
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [assignCourierId, setAssignCourierId] = useState('');
  const [assignmentMode, setAssignmentMode] = useState<'fifo' | 'manual'>('fifo');
  const [instructions, setInstructions] = useState<string>('');
  
  // Edit States
  const [editForm, setEditForm] = useState<Partial<Order>>({});
  const [editItems, setEditItems] = useState<any[]>([]);
  const [editItemNama, setEditItemNama] = useState('');
  const [editItemHarga, setEditItemHarga] = useState('');
  const [inlineAddingItem, setInlineAddingItem] = useState(false);
  
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
      setInstructions(order.notes || '');
      
      // If order already has a courier, set to manual and select them
      if (order.courier_id) {
        setAssignmentMode('manual');
        setAssignCourierId(order.courier_id);
      } else {
        setAssignmentMode('fifo');
        setAssignCourierId('');
      }
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

            <div className="grid grid-cols-1 gap-4">
              <Input
                label="Ongkos Kirim"
                value={editForm.total_fee ? `Rp ${editForm.total_fee.toLocaleString('id-ID')}` : ''}
                onChange={e => {
                  const val = Number(e.target.value.replace(/[^0-9]/g, ''));
                  setEditForm(prev => ({ ...prev, total_fee: val }));
                }}
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

              <div className="space-y-1.5 overflow-y-auto px-1">
                {editItems.map((item, i) => (
                  <div key={i} className="flex items-center justify-between px-3 py-1.5 rounded-lg border border-gray-200 hover:border-teal-300 transition-colors bg-white group">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-teal-400" />
                      <span className="text-xs font-medium text-gray-700">{item.nama}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-gray-900">{formatCurrency(item.harga)}</span>
                      <button 
                        type="button"
                        onClick={() => setEditItems(editItems.filter((_, idx) => idx !== i))} 
                        className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}

                {/* Inline Tambah Item */}
                {inlineAddingItem ? (
                  <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg border border-dashed border-teal-400 bg-teal-50 animate-in fade-in zoom-in-95 duration-150">
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-teal-100 text-teal-600 flex-shrink-0 uppercase">Baru</span>
                    <input
                      className="flex-1 text-xs border-0 bg-transparent outline-none focus:outline-none text-gray-800 min-w-0"
                      placeholder="Nama barang..."
                      value={editItemNama}
                      autoFocus
                      onChange={e => setEditItemNama(e.target.value)}
                    />
                    <input
                      type="text"
                      className="w-16 text-xs border-0 bg-transparent outline-none focus:outline-none text-gray-800 border-l border-teal-200 pl-2"
                      placeholder="Harga"
                      value={editItemHarga ? `Rp ${Number(editItemHarga.toString().replace(/[^0-9]/g, '')).toLocaleString('id-ID')}` : ''}
                      onChange={e => {
                        const raw = e.target.value.replace(/[^0-9]/g, '');
                        setEditItemHarga(raw);
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          if (!editItemNama || !editItemHarga) return;
                          setEditItems([...editItems, { nama: editItemNama, harga: Number(editItemHarga) }]);
                          setEditItemNama('');
                          setEditItemHarga('');
                          setInlineAddingItem(false);
                        } else if (e.key === 'Escape') setInlineAddingItem(false);
                      }}
                    />
                    <div className="flex items-center gap-1.5 flex-shrink-0 pl-1 border-l border-teal-200">
                      <button 
                        type="button"
                        onClick={() => {
                          if (!editItemNama || !editItemHarga) return;
                          setEditItems([...editItems, { nama: editItemNama, harga: Number(editItemHarga) }]);
                          setEditItemNama('');
                          setEditItemHarga('');
                          setInlineAddingItem(false);
                        }}
                        className="text-green-600 hover:text-green-700"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button type="button" onClick={() => { setInlineAddingItem(false); setEditItemNama(''); setEditItemHarga(''); }} className="text-gray-400 hover:text-gray-600">
                        <XCircle className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setInlineAddingItem(true)}
                    className="text-xs text-teal-600 font-medium hover:text-teal-700 flex items-center gap-1.5 mt-1 px-1 transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Tambah Item Baru
                  </button>
                )}
              </div>

              {editItems.length > 0 && (
                <div className="flex justify-between px-3 py-2 font-bold text-gray-900 bg-teal-50 rounded-lg mt-2 border border-teal-100/50">
                  <span className="text-xs uppercase tracking-tighter text-teal-600">Total Belanja</span>
                  <span className="text-sm">{formatCurrency(editItems.reduce((sum, item) => sum + item.harga, 0))}</span>
                </div>
              )}

              </div>

            {/* Inline Edit Controls */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <Button 
                variant="ghost"
                className="text-gray-500 hover:bg-gray-50 font-bold px-6 border border-gray-200"
                onClick={() => setIsEditing(false)}
              >
                Batal
              </Button>
              <Button 
                variant="secondary"
                className="bg-teal-50 text-teal-600 hover:bg-teal-100 font-bold px-6 border border-teal-200"
                onClick={handleSave}
              >
                Simpan Perubahan
              </Button>
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
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-teal-600 font-medium">Ongkos Kirim</span>
                      <span className="text-lg font-black text-teal-700">{formatCurrency(order.total_fee || 0)}</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs text-gray-400">Petugas Pengiriman</p>
                    <div className="flex items-center gap-2 bg-white border border-gray-100 p-2.5 rounded-xl shadow-sm">
                      <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center text-teal-600 font-bold text-xs">
                        {(getCourierName(order.courier_id || null) || '?').charAt(0)}
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

            {/* Inline Action Controls */}
            {isOpsAdmin && order.status === 'pending' && (
              <div className="flex items-center justify-end gap-3 px-2 pt-2 pb-2">
                <Button 
                  variant="ghost"
                  className="bg-teal-50 text-teal-600 hover:bg-teal-100 font-bold px-6 border border-teal-200 shadow-sm"
                  onClick={() => setIsEditing(true)}
                >
                  Edit Pesanan
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Assignment Section (Standardized logic) */}
        {order.status === 'pending' && isOpsAdmin && !isEditing && (
          <div className="bg-teal-50 rounded-2xl p-5 border border-teal-100 space-y-4">
            <div className="flex items-center justify-between border-b border-teal-100/50 pb-3">
              <h4 className="text-sm font-bold text-teal-900 flex items-center gap-2">
                <UserIcon className="w-4 h-4" /> Tugaskan Kurir
              </h4>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setAssignmentMode('fifo')}
                className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                  assignmentMode === 'fifo'
                    ? 'bg-white border-teal-500 ring-2 ring-teal-500/20 shadow-sm'
                    : 'bg-white/50 border-gray-200 hover:border-teal-200'
                }`}
              >
                <div className="flex flex-col items-start gap-1">
                  <span className={`text-xs font-bold ${assignmentMode === 'fifo' ? 'text-teal-700' : 'text-gray-500'}`}>
                    Pilih dari Antrian (FIFO)
                  </span>
                  {assignmentMode === 'fifo' && availableCouriers.length > 0 && (
                    <span className="text-[10px] text-teal-600 font-medium">
                      🎯 {availableCouriers[0].name}
                    </span>
                  )}
                </div>
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                  assignmentMode === 'fifo' ? 'border-teal-500' : 'border-gray-300'
                }`}>
                  {assignmentMode === 'fifo' && <div className="w-2 h-2 rounded-full bg-teal-500" />}
                </div>
              </button>

              <button
                onClick={() => setAssignmentMode('manual')}
                className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                  assignmentMode === 'manual'
                    ? 'bg-white border-teal-500 ring-2 ring-teal-500/20 shadow-sm'
                    : 'bg-white/50 border-gray-200 hover:border-teal-200'
                }`}
              >
                <div className="flex flex-col items-start gap-1">
                  <span className={`text-xs font-bold ${assignmentMode === 'manual' ? 'text-teal-700' : 'text-gray-500'}`}>
                    Pilih Kurir Manual
                  </span>
                </div>
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                  assignmentMode === 'manual' ? 'border-teal-500' : 'border-gray-300'
                }`}>
                  {assignmentMode === 'manual' && <div className="w-2 h-2 rounded-full bg-teal-500" />}
                </div>
              </button>
            </div>
            
            {assignmentMode === 'manual' && (
              <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                <Select
                  placeholder="Pilih Kurir..."
                  value={assignCourierId}
                  onChange={e => setAssignCourierId(e.target.value)}
                  className="bg-white border-teal-200"
                  options={availableCouriers.map(c => {
                    const waiting = courierWaitingOrder(c.id);
                    return {
                      value: c.id,
                      label: waiting ? `${c.name} 📝 PENDING — ${waiting.order_number}` : `${c.name} (Online)`
                    };
                  })}
                />
              </div>
            )}

            <div className="space-y-1.5 pt-1">
              <Select
                label="Instruksi untuk Kurir"
                value={isEditing ? (editForm.notes || '') : (instructions || '')}
                onChange={e => {
                  if (isEditing) {
                    setEditForm(prev => ({ ...prev, notes: e.target.value }));
                  } else {
                    setInstructions(e.target.value);
                  }
                }}
                className="bg-white border-teal-200"
                options={courierInstructions.map(i => ({ value: i.label, label: `${i.icon} ${i.label}` }))}
                placeholder="— Tidak ada instruksi —"
              />
              {(isEditing ? editForm.notes : instructions) && (() => {
                const noteValue = isEditing ? editForm.notes : instructions;
                const match = courierInstructions.find(i => i.label === noteValue);
                if (!match) return null;
                return (
                  <div className="flex items-center gap-2 text-[11px] text-teal-700 bg-white/80 p-2.5 rounded-xl border border-teal-100 shadow-sm">
                    <span className="text-base">{match.icon}</span>
                    <span className="font-medium italic leading-relaxed">{match.instruction}</span>
                  </div>
                );
              })()}
            </div>
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
          </div>

          <div className="flex items-center gap-3 ml-auto">
            <Button variant="outline" onClick={onModalClose} className="rounded-xl px-6">
              Tutup
            </Button>
            
            {isOpsAdmin && order.status === 'pending' && !isEditing && (
              <Button 
                className="bg-teal-600 hover:bg-teal-700 text-white rounded-xl shadow-lg shadow-teal-100 px-10 font-bold"
                onClick={() => {
                  const finalCourierId = assignmentMode === 'fifo' ? availableCouriers[0]?.id : assignCourierId;
                  if (!finalCourierId) {
                    alert('Silakan pilih kurir terlebih dahulu.');
                    return;
                  }
                  handleAssign(finalCourierId, instructions || undefined);
                }}
                disabled={assignmentMode === 'manual' && !assignCourierId}
              >
                Tugaskan
              </Button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};
