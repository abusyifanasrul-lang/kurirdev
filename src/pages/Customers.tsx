import React, { useState, useEffect } from 'react';
import { useCustomerStore } from '@/stores/useCustomerStore';
import { localDB } from '@/lib/orderCache';
import { useAuth } from '@/context/AuthContext';
import { useToastStore } from '@/stores/useToastStore';
import { Users, Check, X, Clock, Phone, MapPin, Plus, Trash2, Edit2, Save, Package, Calendar, AlertCircle, Search } from 'lucide-react';
import { Customer } from '@/types';
import { Modal } from '@/components/ui/Modal';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/Button';
import { Card, StatCard } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { Pagination } from '@/components/ui/Pagination';

export const Customers: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 25;
  
  const { 
    customers, 
    changeRequests, 
    fetchPendingRequests, 
    isLoaded, 
    loadFromLocal, 
    syncFromServer,
    subscribeToRequests,
    subscribeToCustomers,
    upsertCustomer // Added
  } = useCustomerStore();

  useEffect(() => {
    if (!isLoaded) loadFromLocal();
    syncFromServer();
    fetchPendingRequests();

    // Subscribe to real-time updates
    const unsubRequests = subscribeToRequests();
    const unsubCustomers = subscribeToCustomers();

    return () => {
      unsubRequests();
      unsubCustomers();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded]); 
  // Stabilized dependencies to prevent re-subscribing on every state update

  const pendingRequests = changeRequests.filter(r => r.status === 'pending');
  
  // Group pending requests by customer ID for badges
  const requestsByCustomer = pendingRequests.reduce((acc, req) => {
    acc[req.customer_id] = (acc[req.customer_id] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.phone.includes(searchQuery)
  ).sort((a, b) => {
    // Priority: Customers with pending requests first, then by order count
    const aHasPending = requestsByCustomer[a.id] ? 1 : 0;
    const bHasPending = requestsByCustomer[b.id] ? 1 : 0;
    if (aHasPending !== bHasPending) return bHasPending - aHasPending;
    return (b.order_count || 0) - (a.order_count || 0);
  });

  const totalPages = Math.ceil(filteredCustomers.length / ITEMS_PER_PAGE);
  const paginatedCustomers = filteredCustomers.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Reset to page 1 when search query changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);


  return (
    <div className="min-h-screen">
      <Header 
        title="Manajemen Pelanggan"
        subtitle="Kelola master data pelanggan dan persetujuan perubahan alamat."
        actions={
          <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setIsAddModalOpen(true)}>
            Add Customer
          </Button>
        }
      />

      <div className="p-4 md:p-8 max-w-[1600px] mx-auto space-y-6 animate-in fade-in duration-300">
        
        {/* Search Bar */}
        <div className="max-w-md">
          <Input
            placeholder="Cari nama atau no. telepon..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftIcon={<Search className="h-4 w-4 text-gray-400" />}
            className="bg-white"
          />
        </div>

        <div className="bg-white rounded-3xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[600px]">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-widest pl-6">Pelanggan</th>
                    <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-widest">Kontak</th>
                    <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-widest text-center">Total Order</th>
                    <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-widest text-center">Jml Alamat</th>
                    <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-widest text-right pr-6">Bergabung</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {paginatedCustomers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-12 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <span className="text-3xl">🔍</span>
                          <p className="text-gray-500 font-medium">Tidak ada data pelanggan.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedCustomers.map(customer => (
                      <tr 
                        key={customer.id} 
                        onClick={() => { setSelectedCustomerId(customer.id); setIsModalOpen(true); }}
                        className="hover:bg-emerald-50/30 transition-colors cursor-pointer group"
                      >
                        <td className="p-4 pl-6">
                          <div className="flex items-center gap-2">
                             <p className="text-sm font-bold text-gray-900">{customer.name}</p>
                             {requestsByCustomer[customer.id] > 0 && (
                               <div className="flex items-center gap-1 bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full ring-1 ring-amber-200">
                                 <AlertCircle className="h-3 w-3" />
                                 <span className="text-[10px] font-black">{requestsByCustomer[customer.id]}</span>
                               </div>
                             )}
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2 text-sm text-gray-600 font-medium">
                            <Phone className="h-3 w-3 text-emerald-500" />
                            {customer.phone}
                          </div>
                        </td>
                        <td className="p-4 text-center">
                          <span className="inline-flex items-center justify-center bg-gray-100 px-3 py-1 rounded-full text-xs font-bold text-gray-700">
                            {customer.order_count || 0}
                          </span>
                        </td>
                        <td className="p-4 text-center">
                          <span className="inline-flex items-center justify-center bg-emerald-50 px-3 py-1 rounded-full text-xs font-bold text-emerald-700 border border-emerald-100">
                            {customer.addresses.length}
                          </span>
                        </td>
                        <td className="p-4 text-right pr-6 text-sm text-gray-500 font-medium">
                          {new Date(customer.created_at).toLocaleDateString('id-ID')}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            
            <div className="border-t border-gray-100 bg-gray-50/30">
              <Pagination 
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
                totalItems={filteredCustomers.length}
                itemsPerPage={ITEMS_PER_PAGE}
              />
            </div>
          </div>
      </div>

      {isAddModalOpen && (
        <AddCustomerModal 
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          onAdd={async (data) => {
            const newCustomer: Customer = {
              id: crypto.randomUUID(),
              name: data.name!,
              phone: data.phone!,
              addresses: [],
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              order_count: 0
            };
            await upsertCustomer(newCustomer);
          }}
        />
      )}

      {isModalOpen && selectedCustomerId && (
        <DetailModal 
          isOpen={isModalOpen}
          onClose={() => { setIsModalOpen(false); setSelectedCustomerId(null); }}
          customer={customers.find(c => c.id === selectedCustomerId)!}
        />
      )}
    </div>
  );
};

const AddCustomerModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onAdd: (customer: Partial<Customer>) => Promise<void>;
}> = ({ isOpen, onClose, onAdd }) => {
  const [formData, setFormData] = useState({ name: '', phone: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { addToast } = useToastStore();

  const handleSubmit = async () => {
    if (!formData.name || !formData.phone) return;
    setIsSubmitting(true);
    try {
      await onAdd(formData);
      addToast('Pelanggan berhasil ditambahkan', 'success');
      onClose();
      setFormData({ name: '', phone: '' });
    } catch (err: any) {
      addToast(err.message || 'Gagal menambahkan aktifkan', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Tambah Pelanggan Baru">
       <div className="space-y-4">
          <Input 
            label="Nama Lengkap"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            placeholder="Masukkan nama pelanggan..."
          />
          <Input 
            label="Nomor Telepon"
            value={formData.phone}
            onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
            placeholder="Contoh: 08123456789..."
          />
          <div className="pt-2">
            <Button 
                onClick={handleSubmit} 
                className="w-full" 
                isLoading={isSubmitting}
                disabled={!formData.name || !formData.phone}
            >
              TAMBAH PELANGGAN
            </Button>
          </div>
       </div>
    </Modal>
  );
};



interface DetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer;
}

const DetailModal: React.FC<DetailModalProps> = ({ isOpen, onClose, customer }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({ name: customer.name, phone: customer.phone });
  const [newAddress, setNewAddress] = useState({ label: '', address: '' });
  const [isAddingAddress, setIsAddingAddress] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [editAddressData, setEditAddressData] = useState({ label: '', address: '' });
  
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectNotes, setRejectNotes] = useState<Record<string, string>>({});
  const [editedAddresses, setEditedAddresses] = useState<Record<string, string>>({});

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    variant: 'danger' | 'warning' | 'info' | 'primary';
    onConfirm: () => void | Promise<void>;
  }>({
    isOpen: false,
    title: '',
    message: '',
    variant: 'primary',
    onConfirm: () => {},
  });

  const showConfirm = (
    title: string,
    message: string,
    onConfirm: () => void | Promise<void>,
    variant: 'danger' | 'warning' | 'info' | 'primary' = 'primary'
  ) => {
    setConfirmModal({ isOpen: true, title, message, onConfirm, variant });
  };

  const closeConfirm = () => setConfirmModal(prev => ({ ...prev, isOpen: false }));

  const { upsertCustomer, addAddress, updateAddress, deleteAddress, changeRequests, approveRequest, rejectRequest } = useCustomerStore();
  const { user } = useAuth();
  const { addToast } = useToastStore();
  const canApprove = user?.role === 'admin' || user?.role === 'admin_kurir';

  const customerPendingRequests = changeRequests.filter(r => r.status === 'pending' && r.customer_id === customer.id);

  const [localStats, setLocalStats] = useState({ 
    total: 0, 
    cancelled: 0, 
    spent: 0, 
    isLoading: true 
  });

  // Calculate stats from local IndexedDB cache (last 30 days)
  useEffect(() => {
    const fetchStats = async () => {
      setLocalStats(prev => ({ ...prev, isLoading: true }));
      try {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        // Fetch all orders for this customer from local cache
        const orders = await localDB.orders
          .where('customer_id')
          .equals(customer.id)
          .toArray();

        // Filter for last 30 days
        const last30Days = orders.filter(o => new Date(o.created_at) >= thirtyDaysAgo);

        const stats = {
          total: last30Days.length,
          cancelled: last30Days.filter(o => o.status === 'cancelled').length,
          spent: last30Days
            .filter(o => o.status === 'delivered')
            .reduce((sum, o) => sum + (o.total_fee || 0), 0),
          isLoading: false
        };

        setLocalStats(stats);
      } catch (err) {
        console.error('Failed to fetch local stats:', err);
        setLocalStats(prev => ({ ...prev, isLoading: false }));
      }
    };

    if (customer.id) fetchStats();
  }, [customer.id]);

  // Sync form data if customer prop changes
  useEffect(() => {
    setFormData({ name: customer.name, phone: customer.phone });
  }, [customer.id, customer.name, customer.phone]);

  const handleUpdateInfo = async () => {
    try {
      await upsertCustomer({
        ...customer,
        name: formData.name,
        phone: formData.phone
      });
      addToast('Informasi pelanggan berhasil diperbarui', 'success');
      setIsEditing(false);
    } catch (err: any) {
      addToast(err.message || 'Gagal memperbarui informasi', 'error');
    }
  };

  const handleAddAddress = async () => {
    if (!newAddress.label || !newAddress.address) {
      addToast('Label dan alamat wajib diisi', 'error');
      return;
    }
    try {
      await addAddress(customer.id, {
        label: newAddress.label,
        address: newAddress.address,
        is_default: customer.addresses.length === 0
      });
      addToast('Alamat berhasil ditambahkan', 'success');
      setNewAddress({ label: '', address: '' });
      setIsAddingAddress(false);
    } catch (err: any) {
      addToast(err.message || 'Gagal menambahkan alamat', 'error');
    }
  };

  const handleDeleteAddress = async (addrId: string) => {
    showConfirm(
      'Hapus Alamat',
      'Yakin ingin menghapus alamat ini? Tindakan ini tidak dapat dibatalkan.',
      async () => {
        try {
          await deleteAddress(customer.id, addrId);
          addToast('Alamat berhasil dihapus', 'success');
        } catch (err: any) {
          addToast(err.message || 'Gagal menghapus alamat', 'error');
        }
        closeConfirm();
      },
      'danger'
    );
  };

  const handleUpdateAddress = async (addrId: string) => {
    try {
      await updateAddress(customer.id, addrId, editAddressData);
      addToast('Alamat berhasil diperbarui', 'success');
      setEditingAddressId(null);
    } catch (err: any) {
      addToast(err.message || 'Gagal memperbarui alamat', 'error');
    }
  };

  const handleApprove = async (reqId: string, modifiedAddress?: string) => {
    showConfirm(
      'Setujui Perubahan',
      'Yakin ingin menyetujui perubahan data alamat ini?',
      async () => {
        try {
          if (user) await approveRequest(reqId, user.id, modifiedAddress);
          addToast('Perubahan berhasil disetujui', 'success');
          setEditedAddresses(prev => { const next = { ...prev }; delete next[reqId]; return next; });
        } catch (err: any) {
          addToast(err.message || 'Gagal menyetujui perubahan', 'error');
        }
        closeConfirm();
      },
      'primary'
    );
  };

  const handleReject = async (reqId: string) => {
    const notes = rejectNotes[reqId] || '';
    if (!notes) {
      addToast('Mohon isi alasan penolakan terlebih dahulu', 'error');
      return;
    }
    showConfirm(
      'Tolak Perubahan',
      'Yakin ingin menolak perubahan data ini?',
      async () => {
        try {
          if (user) await rejectRequest(reqId, user.id, notes);
          addToast('Perubahan berhasil ditolak', 'success');
          setRejectNotes(prev => ({ ...prev, [reqId]: '' }));
          setRejectingId(null);
        } catch (err: any) {
          addToast(err.message || 'Gagal menolak perubahan', 'error');
        }
        closeConfirm();
      },
      'danger'
    );
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Detail Pelanggan" size="lg">
      <div className="space-y-6">
        {/* Pending Approvals Section */}
        {canApprove && customerPendingRequests.length > 0 && (
          <section className="bg-amber-50 p-5 rounded-2xl border-2 border-amber-200 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-2 mb-4">
              <div className="bg-amber-100 p-1.5 rounded-lg">
                <AlertCircle className="h-4 w-4 text-amber-600" />
              </div>
              <h4 className="text-xs font-black text-amber-700 uppercase tracking-widest">
                Menunggu Persetujuan ({customerPendingRequests.length})
              </h4>
            </div>
            
            <div className="space-y-4">
              {customerPendingRequests.map(req => {
                const isAddingAddress = req.change_type === 'address_add';
                const isEditingAddress = req.change_type === 'address_edit';
                const isDeletingAddress = req.change_type === 'address_delete';

                return (
                  <div key={req.id} className="bg-white rounded-xl p-4 border border-amber-100 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                        {isAddingAddress ? 'Penambahan Alamat' : isEditingAddress ? 'Perubahan Alamat' : 'Penghapusan Alamat'}
                      </p>
                      <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100">
                        Oleh: {req.requester_name}
                      </span>
                    </div>

                    <div className="mb-4">
                      {isAddingAddress && req.new_address && (
                        <div className="space-y-2">
                           <label className="text-[9px] font-black text-gray-400 uppercase">Alamat Baru</label>
                           <textarea
                            value={editedAddresses[req.id] !== undefined ? editedAddresses[req.id] : req.new_address.address}
                            onChange={(e) => setEditedAddresses(prev => ({ ...prev, [req.id]: e.target.value }))}
                            className="w-full bg-amber-50/30 text-emerald-900 p-3 rounded-xl border border-amber-100 text-sm font-medium focus:ring-2 focus:ring-amber-500 outline-none"
                            rows={2}
                          />
                        </div>
                      )}

                      {isEditingAddress && (
                        <div className="grid grid-cols-1 gap-3">
                          <div className="opacity-50 line-through">
                             <label className="text-[9px] font-black text-gray-400 uppercase">Alamat Lama</label>
                             <p className="text-xs p-2 bg-gray-50 rounded-lg">{req.old_data.addresses?.find(a => a.id === req.affected_address_id)?.address}</p>
                          </div>
                          <div>
                             <label className="text-[9px] font-black text-amber-600 uppercase">Perubahan</label>
                             <textarea
                               value={editedAddresses[req.id] !== undefined 
                                 ? editedAddresses[req.id] 
                                 : (req.requested_data.addresses?.find(a => a.id === req.affected_address_id)?.address || '')}
                               onChange={(e) => setEditedAddresses(prev => ({ ...prev, [req.id]: e.target.value }))}
                               className="w-full bg-white text-emerald-900 p-3 rounded-xl border border-emerald-200 text-sm font-medium focus:ring-2 focus:ring-emerald-500 outline-none mt-1 shadow-sm"
                               rows={2}
                             />
                          </div>
                        </div>
                      )}

                      {isDeletingAddress && (
                        <div className="bg-red-50 text-red-700 p-3 rounded-xl border border-red-100 text-xs font-semibold line-through">
                          {req.old_data.addresses?.find(a => a.id === req.affected_address_id)?.address}
                        </div>
                      )}
                    </div>

                    {rejectingId === req.id ? (
                      <div className="animate-in slide-in-from-top-1">
                        <textarea 
                          placeholder="Alasan penolakan..." 
                          value={rejectNotes[req.id] || ''}
                          onChange={(e) => setRejectNotes(prev => ({ ...prev, [req.id]: e.target.value }))}
                          className="w-full text-xs px-3 py-2 border border-red-100 rounded-xl focus:ring-2 focus:ring-red-500 outline-none mb-2 bg-red-50/30"
                          rows={2}
                        />
                        <div className="flex gap-2">
                          <button onClick={() => handleReject(req.id)} className="flex-1 bg-red-600 text-white font-black text-[10px] py-2 rounded-lg">KONFIRMASI TOLAK</button>
                          <button onClick={() => setRejectingId(null)} className="flex-1 bg-gray-100 text-gray-600 font-black text-[10px] py-2 rounded-lg">BATAL</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <button 
                          onClick={() => handleApprove(req.id, editedAddresses[req.id])}
                          className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] py-2.5 rounded-xl flex items-center justify-center gap-2"
                        >
                          <Check className="h-3.5 w-3.5" /> SETUJUI
                        </button>
                        <button 
                          onClick={() => setRejectingId(req.id)}
                          className="flex-1 bg-white hover:bg-red-50 text-red-600 border border-red-100 font-black text-[10px] py-2.5 rounded-xl flex items-center justify-center gap-2"
                        >
                          <X className="h-3.5 w-3.5" /> TOLAK
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Basic Info Section */}
        <section className="bg-gray-50 p-5 rounded-2xl border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
              <Users className="h-4 w-4" /> Informasi Utama
            </h4>
            {!isEditing ? (
              <button 
                onClick={() => setIsEditing(true)}
                className="text-emerald-600 hover:text-emerald-700 text-xs font-bold flex items-center gap-1"
              >
                <Edit2 className="h-3.5 w-3.5" /> EDIT
              </button>
            ) : (
              <div className="flex gap-2">
                 <button 
                  onClick={handleUpdateInfo}
                  className="bg-emerald-600 text-white px-3 py-1 rounded-lg text-xs font-bold hover:bg-emerald-700 transition-colors flex items-center gap-1"
                >
                  <Save className="h-3.5 w-3.5" /> SIMPAN
                </button>
                <button 
                  onClick={() => { setIsEditing(false); setFormData({ name: customer.name, phone: customer.phone }); }}
                  className="bg-gray-200 text-gray-600 px-3 py-1 rounded-lg text-xs font-bold hover:bg-gray-300 transition-colors"
                >
                  BATAL
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest pl-1">Nama Lengkap</label>
              {isEditing ? (
                <input 
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full bg-white border border-emerald-200 rounded-xl px-3 py-2 text-sm font-bold text-gray-900 focus:ring-2 focus:ring-emerald-500 outline-none mt-1 shadow-sm"
                />
              ) : (
                <p className="text-sm font-bold text-gray-900 mt-1 bg-white p-2.5 rounded-xl border border-transparent">{customer.name}</p>
              )}
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest pl-1">No. Telepon</label>
              {isEditing ? (
                <input 
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  className="w-full bg-white border border-emerald-200 rounded-xl px-3 py-2 text-sm font-bold text-gray-900 focus:ring-2 focus:ring-emerald-500 outline-none mt-1 shadow-sm"
                />
              ) : (
                <p className="text-sm font-bold text-gray-900 mt-1 bg-white p-2.5 rounded-xl border border-transparent">{customer.phone}</p>
              )}
            </div>
          </div>
        </section>

        {/* Order Stats Section */}
        <section className="px-1">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
              <Package className="h-4 w-4" /> Statistik 30 Hari Terakhir
            </h4>
            {localStats.isLoading && (
              <div className="animate-spin h-3.5 w-3.5 border-2 border-emerald-500 border-t-transparent rounded-full" />
            )}
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white p-3 rounded-2xl border border-gray-100 flex flex-col items-center justify-center text-center">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Total Order</span>
              <span className="text-xl font-black text-emerald-600">{localStats.total}</span>
            </div>
            <div className="bg-white p-3 rounded-2xl border border-gray-100 flex flex-col items-center justify-center text-center">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 text-gray-400">Batal</span>
              <span className="text-sm font-black text-red-600">{localStats.cancelled}</span>
            </div>
            <div className="bg-white p-3 rounded-2xl border border-gray-100 flex flex-col items-center justify-center text-center">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 text-gray-400">Total Spent</span>
              <span className="text-xs font-black text-gray-900 leading-tight">
                Rp {localStats.spent.toLocaleString('id-ID')}
              </span>
            </div>
          </div>
          <div className="mt-3 px-1 flex items-center justify-between">
            <div className="flex items-center gap-1.5 overflow-hidden">
               <Calendar className="h-3 w-3 text-gray-400 flex-shrink-0" />
               <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tight truncate">
                 Member Sejak {new Date(customer.created_at).toLocaleDateString('id-ID', { year: 'numeric', month: 'short' })}
               </span>
            </div>
            {customer.last_order_at && (
              <div className="flex items-center gap-1.5 overflow-hidden ml-2">
                <Clock className="h-3 w-3 text-gray-400 flex-shrink-0" />
                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tight truncate">
                  Terakhir {new Date(customer.last_order_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                </span>
              </div>
            )}
          </div>
        </section>

        {/* Addresses Section */}
        <section>
          <div className="flex items-center justify-between mb-4 px-1">
            <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
              <MapPin className="h-4 w-4" /> Daftar Alamat ({customer.addresses.length})
            </h4>
            <button 
              onClick={() => setIsAddingAddress(true)}
              className="bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-xl text-xs font-bold hover:bg-emerald-100 transition-all flex items-center gap-1 border border-emerald-100"
            >
              <Plus className="h-3.5 w-3.5" /> TAMBAH
            </button>
          </div>

          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
            {isAddingAddress && (
              <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-200 animate-in slide-in-from-top-2 duration-200">
                <div className="flex justify-between items-center mb-3">
                  <h5 className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">Alamat Baru</h5>
                  <button onClick={() => setIsAddingAddress(false)} className="text-gray-400 hover:text-gray-600">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="space-y-3">
                  <input 
                    placeholder="Nama Alamat (misal: Rumah, Kantor)"
                    value={newAddress.label}
                    onChange={(e) => setNewAddress(prev => ({ ...prev, label: e.target.value }))}
                    className="w-full text-xs p-2.5 border border-emerald-100 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <textarea 
                    placeholder="Alamat Lengkap..."
                    value={newAddress.address}
                    onChange={(e) => setNewAddress(prev => ({ ...prev, address: e.target.value }))}
                    className="w-full text-xs p-2.5 border border-emerald-100 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
                    rows={2}
                  />
                  <button 
                    onClick={handleAddAddress}
                    className="w-full bg-emerald-600 text-white font-black text-[10px] py-2.5 rounded-xl hover:bg-emerald-700 transition-colors uppercase tracking-widest"
                  >
                    Simpan Alamat Baru
                  </button>
                </div>
              </div>
            )}

            {customer.addresses.map((addr) => (
              <div key={addr.id} className="group bg-white p-4 rounded-2xl border border-gray-100 hover:border-emerald-200 hover:shadow-sm transition-all relative">
                {editingAddressId === addr.id ? (
                  <div className="space-y-3">
                    <input 
                      value={editAddressData.label}
                      onChange={(e) => setEditAddressData(prev => ({ ...prev, label: e.target.value }))}
                      className="w-full text-xs p-2.5 border border-emerald-100 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
                    />
                    <textarea 
                      value={editAddressData.address}
                      onChange={(e) => setEditAddressData(prev => ({ ...prev, address: e.target.value }))}
                      className="w-full text-xs p-2.5 border border-emerald-100 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
                      rows={2}
                    />
                    <div className="flex gap-2">
                       <button 
                        onClick={() => handleUpdateAddress(addr.id)}
                        className="flex-1 bg-emerald-600 text-white font-bold text-[10px] py-2 rounded-lg hover:bg-emerald-700"
                      >
                        SIMPAN
                      </button>
                      <button 
                        onClick={() => setEditingAddressId(null)}
                        className="flex-1 bg-gray-100 text-gray-600 font-bold text-[10px] py-2 rounded-lg hover:bg-gray-200"
                      >
                        BATAL
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-black bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-lg border border-emerald-100/50 uppercase tracking-widest">
                        {addr.label}
                      </span>
                      <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => {
                            setEditingAddressId(addr.id);
                            setEditAddressData({ label: addr.label, address: addr.address });
                          }}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit Alamat"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button 
                          onClick={() => handleDeleteAddress(addr.id)}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Hapus Alamat"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-gray-600 font-semibold leading-relaxed">
                      {addr.address}
                    </p>
                  </>
                )}
              </div>
            ))}

            {customer.addresses.length === 0 && !isAddingAddress && (
              <div className="text-center py-8 bg-gray-50 border-2 border-dashed border-gray-100 rounded-3xl">
                <p className="text-xs font-bold text-gray-400">Belum ada alamat tersimpan</p>
              </div>
            )}
          </div>
        </section>
      </div>

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        variant={confirmModal.variant}
        onConfirm={confirmModal.onConfirm}
        onClose={closeConfirm}
      />
    </Modal>
  );
};
