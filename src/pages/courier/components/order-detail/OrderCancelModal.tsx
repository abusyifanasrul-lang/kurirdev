import React from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { cn } from '@/utils/cn';

interface OrderCancelModalProps {
  showCancelModal: boolean;
  setShowCancelModal: (v: boolean) => void;
  cancelReasonType: 'customer' | 'item_unavailable' | 'other' | '';
  setCancelReasonType: (v: 'customer' | 'item_unavailable' | 'other' | '') => void;
  cancelReasonText: string;
  setCancelReasonText: (v: string) => void;
  handleConfirmCancel: () => void;
}

export const OrderCancelModal: React.FC<OrderCancelModalProps> = ({
  showCancelModal,
  setShowCancelModal,
  cancelReasonType,
  setCancelReasonType,
  cancelReasonText,
  setCancelReasonText,
  handleConfirmCancel
}) => {
  if (!showCancelModal) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-black text-gray-900 uppercase">Batalkan Pesanan?</h3>
            <button 
              onClick={() => setShowCancelModal(false)}
              className="p-2 -mr-2 text-gray-400 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 text-center">Pilih Alasan Pembatalan:</p>
            
            <button
              onClick={() => setCancelReasonType('customer')}
              className={cn(
                "w-full p-4 rounded-2xl text-left border-2 transition-all font-bold text-sm",
                cancelReasonType === 'customer' 
                  ? "border-emerald-600 bg-emerald-50 text-emerald-700" 
                  : "border-gray-100 bg-gray-50 text-gray-600"
              )}
            >
              Dibatalkan oleh customer
            </button>
            <button
              onClick={() => setCancelReasonType('item_unavailable')}
              className={cn(
                "w-full p-4 rounded-2xl text-left border-2 transition-all font-bold text-sm",
                cancelReasonType === 'item_unavailable' 
                  ? "border-emerald-600 bg-emerald-50 text-emerald-700" 
                  : "border-gray-100 bg-gray-50 text-gray-600"
              )}
            >
              Barang tidak tersedia / habis
            </button>
            <button
              onClick={() => setCancelReasonType('other')}
              className={cn(
                "w-full p-4 rounded-2xl text-left border-2 transition-all font-bold text-sm",
                cancelReasonType === 'other' 
                  ? "border-emerald-600 bg-emerald-50 text-emerald-700" 
                  : "border-gray-100 bg-gray-50 text-gray-600"
              )}
            >
              Lainnya...
            </button>

            {cancelReasonType === 'other' && (
              <textarea
                className="w-full mt-2 p-4 bg-gray-50 rounded-2xl border-none text-sm font-medium focus:ring-2 focus:ring-emerald-500 h-24"
                placeholder="Tuliskan alasannya di sini..."
                value={cancelReasonText}
                onChange={(e) => setCancelReasonText(e.target.value)}
              />
            )}
            
            <div className="flex items-start gap-3 p-4 bg-amber-50 rounded-2xl mt-4 border border-amber-100">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
              <p className="text-[10px] font-bold text-amber-700 uppercase leading-relaxed tracking-wider">Tindakan ini tidak dapat dibatalkan. Pesanan akan hilang dari daftar aktif anda.</p>
            </div>
            
            <button
              onClick={handleConfirmCancel}
              disabled={!cancelReasonType}
              className={cn(
                "w-full mt-6 py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all shadow-lg active:scale-95",
                cancelReasonType 
                  ? "bg-red-600 text-white shadow-red-200" 
                  : "bg-gray-200 text-gray-400 cursor-not-allowed shadow-none"
              )}
            >
              YA, BATALKAN SEKARANG
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
