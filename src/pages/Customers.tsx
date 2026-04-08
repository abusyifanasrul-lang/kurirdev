import React, { useState, useEffect } from 'react';
import { useCustomerStore } from '@/stores/useCustomerStore';
import { useAuth } from '@/context/AuthContext';
import { useToastStore } from '@/stores/useToastStore';
import { Users, Check, X, Clock, MapPin, Search, Phone } from 'lucide-react';
import { CustomerChangeRequest } from '@/types';

export const Customers: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'master' | 'approvals'>('master');
  const [searchQuery, setSearchQuery] = useState('');
  const [rejectNotes, setRejectNotes] = useState<Record<string, string>>({});
  
  const { customers, changeRequests, fetchPendingRequests, approveRequest, rejectRequest, isLoaded, loadFromLocal, syncFromServer } = useCustomerStore();
  const { user } = useAuth();
  const { addToast } = useToastStore();

  useEffect(() => {
    if (!isLoaded) loadFromLocal();
    syncFromServer();
    fetchPendingRequests();
  }, [isLoaded, loadFromLocal, syncFromServer, fetchPendingRequests]);

  const pendingRequests = changeRequests.filter(r => r.status === 'pending');
  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.phone.includes(searchQuery)
  ).sort((a, b) => (b.order_count || 0) - (a.order_count || 0));

  const handleApprove = async (reqId: string) => {
    if (!window.confirm('Yakin ingin menyetujui perubahan data ini?')) return;
    try {
      if (user) await approveRequest(reqId, user.id);
      addToast('Perubahan berhasil disetujui', 'success');
    } catch (err: any) {
      addToast(err.message || 'Gagal menyetujui perubahan', 'error');
    }
  };

  const handleReject = async (reqId: string) => {
    const notes = rejectNotes[reqId] || '';
    if (!notes) {
      addToast('Mohon isi alasan penolakan terlebih dahulu', 'error');
      return;
    }
    if (!window.confirm('Yakin ingin menolak perubahan data ini?')) return;
    try {
      if (user) await rejectRequest(reqId, user.id, notes);
      addToast('Perubahan berhasil ditolak', 'success');
      setRejectNotes(prev => ({ ...prev, [reqId]: '' }));
    } catch (err: any) {
      addToast(err.message || 'Gagal menolak perubahan', 'error');
    }
  };

  const renderApprovalCard = (req: CustomerChangeRequest) => {
    const isAddingAddress = req.change_type === 'address_add';
    const isEditingAddress = req.change_type === 'address_edit';
    const isDeletingAddress = req.change_type === 'address_delete';

    return (
      <div key={req.id} className="bg-white rounded-2xl p-5 border border-amber-200 shadow-sm relative overflow-hidden">
        {/* Ribbon */}
        <div className="absolute top-0 right-0 bg-amber-100 text-amber-700 text-[10px] font-black px-4 py-1.5 rounded-bl-xl tracking-wider uppercase">
          Perlu Approval
        </div>

        <div className="flex items-start gap-4 mb-4">
          <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center border-2 border-white shadow-sm shrink-0">
            <Clock className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-900">{req.customer_name}</h3>
            <p className="text-xs text-gray-500 mt-0.5">Diajukan oleh: <span className="font-semibold text-gray-700">{req.requester_name}</span></p>
          </div>
        </div>

        <div className="bg-gray-50 rounded-xl p-4 mb-4 border border-gray-100">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
            {isAddingAddress ? 'Penambahan Alamat Baru' : isEditingAddress ? 'Perubahan Alamat' : isDeletingAddress ? 'Penghapusan Alamat' : 'Perubahan Data'}
          </p>
          
          {isAddingAddress && req.new_address && (
            <div className="flex items-start gap-2 bg-emerald-50 text-emerald-700 p-3 rounded-lg border border-emerald-100 mt-2">
              <MapPin className="h-4 w-4 shrink-0 mt-0.5" />
              <p className="text-sm font-medium">{req.new_address.address}</p>
            </div>
          )}

          {isEditingAddress && (
            <div className="space-y-2">
              <div className="text-xs text-gray-500 line-through p-2 bg-gray-100 rounded-lg">
                {req.old_data.addresses?.find(a => a.id === req.affected_address_id)?.address || 'Alamat Lama Tidak Ditemukan'}
              </div>
              <div className="text-sm font-medium text-emerald-700 p-2 bg-emerald-50 rounded-lg border border-emerald-100">
                {req.requested_data.addresses?.find(a => a.id === req.affected_address_id)?.address || 'Data Baru Kosong'}
              </div>
            </div>
          )}

          {isDeletingAddress && (
            <div className="flex items-start gap-2 bg-red-50 text-red-700 p-3 rounded-lg border border-red-100 mt-2">
              <TrashIcon className="h-4 w-4 shrink-0 mt-0.5" />
              <p className="text-sm font-medium line-through">{req.old_data.addresses?.find(a => a.id === req.affected_address_id)?.address}</p>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <input 
            type="text" 
            placeholder="Catatan penolakan (opsional jika setuju, wajib jika tolak)..." 
            value={rejectNotes[req.id] || ''}
            onChange={(e) => setRejectNotes(prev => ({ ...prev, [req.id]: e.target.value }))}
            className="w-full text-sm px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
          />
          <div className="flex gap-2">
            <button 
              onClick={() => handleApprove(req.id)}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-3 rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm"
            >
              <Check className="h-4 w-4" /> SETUJUI
            </button>
            <button 
              onClick={() => handleReject(req.id)}
              className="flex-1 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 font-bold text-xs py-3 rounded-xl flex items-center justify-center gap-2 transition-all"
            >
              <X className="h-4 w-4" /> TOLAK
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-3">
            <Users className="h-8 w-8 text-emerald-600" />
            Manajemen Pelanggan
          </h1>
          <p className="text-gray-500 font-medium mt-1">
            Kelola master data pelanggan dan persetujuan perubahan alamat.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 p-1 bg-gray-100 rounded-2xl w-fit">
        <button
          onClick={() => setActiveTab('master')}
          className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${
            activeTab === 'master' 
              ? 'bg-white text-emerald-700 shadow-sm' 
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Master Data
        </button>
        <button
          onClick={() => setActiveTab('approvals')}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${
            activeTab === 'approvals' 
              ? 'bg-white text-amber-700 shadow-sm' 
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Persetujuan 
          {pendingRequests.length > 0 && (
            <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full text-[10px] font-black">
              {pendingRequests.length}
            </span>
          )}
        </button>
      </div>

      {/* Content */}
      {activeTab === 'master' && (
        <div className="space-y-4 animate-in fade-in duration-300">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Cari nama atau no. telepon pelanggan..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-white border border-gray-200 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-emerald-500 outline-none shadow-sm"
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
                <tbody className="divide-y divide-gray-100">
                  {filteredCustomers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-gray-500 text-sm font-medium">
                        Tidak ada pelanggan ditemukan
                      </td>
                    </tr>
                  ) : (
                    filteredCustomers.map(customer => (
                      <tr key={customer.id} className="hover:bg-emerald-50/30 transition-colors">
                        <td className="p-4 pl-6">
                          <p className="text-sm font-bold text-gray-900">{customer.name}</p>
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
          </div>
        </div>
      )}

      {activeTab === 'approvals' && (
        <div className="animate-in fade-in duration-300">
          {pendingRequests.length === 0 ? (
            <div className="bg-white border border-gray-200 border-dashed rounded-3xl p-12 flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                <Check className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Semua Bersih!</h3>
              <p className="text-gray-500 font-medium mt-1">Tidak ada pengajuan perubahan alamat yang menunggu.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {pendingRequests.map(renderApprovalCard)}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Quick helper
const TrashIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M3 6h18"></path>
    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
  </svg>
);
