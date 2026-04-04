import { useState, useEffect } from 'react';
import { Check, X, AlertCircle, Clock, User, Phone, MapPin, ChevronRight } from 'lucide-react';
import { useCustomerStore } from '@/stores/useCustomerStore';
import { useAuth } from '@/context/AuthContext';
import { CustomerChangeRequest } from '@/types';
import { format, parseISO } from 'date-fns';
import { cn } from '@/utils/cn';

export function CustomerApprovalTab() {
  const { fetchPendingRequests, approveRequest, rejectRequest } = useCustomerStore();
  const { user } = useAuth();
  const [requests, setRequests] = useState<CustomerChangeRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [showRejectModal, setShowRejectModal] = useState<string | null>(null);
  const [rejectNotes, setRejectNotes] = useState('');

  const loadRequests = async () => {
    setIsLoading(true);
    try {
      const data = await fetchPendingRequests();
      setRequests(data);
    } catch (err) {
      console.error('Failed to fetch requests:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, []);

  const handleApprove = async (id: string) => {
    if (!user) return;
    setProcessingId(id);
    try {
      await approveRequest(id, user.id);
      setRequests(prev => prev.filter(r => r.id !== id));
    } catch (err) {
      console.error('Approve failed:', err);
      alert('Gagal menyetujui perubahan.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async () => {
    if (!user || !showRejectModal) return;
    setProcessingId(showRejectModal);
    try {
      await rejectRequest(showRejectModal, user.id, rejectNotes);
      setRequests(prev => prev.filter(r => r.id !== showRejectModal));
      setShowRejectModal(null);
      setRejectNotes('');
    } catch (err) {
      console.error('Reject failed:', err);
      alert('Gagal menolak perubahan.');
    } finally {
      setProcessingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-500">
        <Clock className="h-8 w-8 animate-spin mb-4 text-teal-500" />
        <p className="text-sm">Memuat daftar permintaan...</p>
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-500 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
        <Check className="h-12 w-12 mb-4 text-gray-300" />
        <h3 className="font-semibold text-gray-900">Semua Beres!</h3>
        <p className="text-sm text-center max-w-xs mt-1">
          Tidak ada permintaan perubahan data customer yang perlu ditinjau saat ini.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <AlertCircle className="h-4 w-4 text-amber-500" />
        <p className="text-xs text-amber-700 font-medium">
          Terdapat {requests.length} permintaan perubahan data dari kurir yang memerlukan persetujuan.
        </p>
      </div>

      <div className="grid gap-4">
        {requests.map((req) => (
          <div key={req.id} className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden flex flex-col">
            {/* Header */}
            <div className="bg-gray-50/50 px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-teal-100 rounded-full flex items-center justify-center text-teal-600">
                  <User className="h-4 w-4" />
                </div>
                <div>
                    <h4 className="font-bold text-sm text-gray-900">{req.customer_name || 'Customer'}</h4>
                    <p className="text-[10px] text-gray-500">
                        Diminta oleh <span className="font-semibold text-gray-700">{req.requester_name || 'Kurir'}</span> • {format(parseISO(req.created_at), 'dd MMM, HH:mm')}
                    </p>
                </div>
              </div>
              <div className="px-2 py-1 bg-amber-100 text-amber-700 text-[10px] font-bold rounded-lg uppercase tracking-wider">
                Pending
              </div>
            </div>

            {/* Comparison */}
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-6 bg-white relative">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 hidden md:block z-10">
                    <div className="w-8 h-8 bg-white border border-gray-200 rounded-full flex items-center justify-center shadow-sm">
                        <ChevronRight className="h-4 w-4 text-gray-400" />
                    </div>
                </div>

                {/* Old Data */}
                <div className="space-y-3 opacity-60">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-50 pb-1">Data Sekarang</p>
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-xs text-gray-600">
                            <User className="h-3 w-3" />
                            <span>{req.old_data.name}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-600">
                            <Phone className="h-3 w-3" />
                            <span>{req.old_data.phone}</span>
                        </div>
                        <div className="flex items-start gap-2 text-xs text-gray-600">
                            <MapPin className="h-3 w-3 mt-0.5" />
                            <span className="line-clamp-2">{req.old_data.addresses?.[0]?.address || '-'}</span>
                        </div>
                    </div>
                </div>

                {/* New Data */}
                <div className="space-y-3 pt-4 md:pt-0 border-t md:border-t-0 border-gray-50">
                    <p className="text-[10px] font-bold text-teal-500 uppercase tracking-widest border-b border-teal-50 pb-1">Usulan Perubahan</p>
                    <div className="space-y-2">
                        <div className={cn("flex items-center gap-2 text-xs font-medium", req.requested_data.name !== req.old_data.name ? "text-teal-700" : "text-gray-600")}>
                            <User className="h-3 w-3" />
                            <span>{req.requested_data.name}</span>
                            {req.requested_data.name !== req.old_data.name && <span className="text-[9px] bg-teal-100 text-teal-600 px-1 rounded ml-1">Baru</span>}
                        </div>
                        <div className={cn("flex items-center gap-2 text-xs font-medium", req.requested_data.phone !== req.old_data.phone ? "text-teal-700" : "text-gray-600")}>
                            <Phone className="h-3 w-3" />
                            <span>{req.requested_data.phone}</span>
                            {req.requested_data.phone !== req.old_data.phone && <span className="text-[9px] bg-teal-100 text-teal-600 px-1 rounded ml-1">Baru</span>}
                        </div>
                        <div className={cn("flex items-start gap-2 text-xs font-medium", req.requested_data.addresses?.[0]?.address !== req.old_data.addresses?.[0]?.address ? "text-teal-700" : "text-gray-600")}>
                            <MapPin className="h-3 w-3 mt-0.5" />
                            <span className="line-clamp-2">{req.requested_data.addresses?.[0]?.address || '-'}</span>
                            {req.requested_data.addresses?.[0]?.address !== req.old_data.addresses?.[0]?.address && <span className="text-[9px] bg-teal-100 text-teal-600 px-1 rounded ml-1 mt-0.5">Baru</span>}
                        </div>
                    </div>
                </div>
            </div>

            {/* Actions */}
            <div className="p-4 border-t border-gray-100 bg-gray-50/30 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowRejectModal(req.id)}
                disabled={!!processingId}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
              >
                <X className="h-4 w-4" /> Tolak
              </button>
              <button
                onClick={() => handleApprove(req.id)}
                disabled={!!processingId}
                className={cn(
                  "flex items-center gap-2 px-6 py-2 text-sm font-bold text-white rounded-xl transition-all shadow-sm",
                  processingId === req.id ? "bg-teal-400" : "bg-teal-600 hover:bg-teal-700 active:scale-95"
                )}
              >
                {processingId === req.id ? (
                  <Clock className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                Setujui & Perbarui
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-sm rounded-[2rem] p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Tolak Perubahan?</h3>
            <p className="text-sm text-gray-500 mb-4">Berikan alasan mengapa perubahan ini ditolak agar kurir memahaminya.</p>
            
            <textarea
              className="w-full border border-gray-200 rounded-2xl p-4 text-sm focus:ring-2 focus:ring-teal-500 outline-none min-h-[100px] mb-6"
              placeholder="Contoh: Alamat tidak sesuai koordinat..."
              value={rejectNotes}
              onChange={(e) => setRejectNotes(e.target.value)}
            />

            <div className="flex gap-3">
              <button
                onClick={() => { setShowRejectModal(null); setRejectNotes(''); }}
                className="flex-1 py-3 text-sm font-bold text-gray-500 hover:bg-gray-100 rounded-2xl transition-all"
              >
                Batal
              </button>
              <button
                onClick={handleReject}
                disabled={!rejectNotes.trim() || !!processingId}
                className="flex-1 py-3 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-2xl transition-all shadow-lg active:scale-95 disabled:opacity-50"
              >
                Konfirmasi Tolak
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
