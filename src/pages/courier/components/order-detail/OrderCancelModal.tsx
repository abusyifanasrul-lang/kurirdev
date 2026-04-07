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
      <div className="bg-white rounded-[2rem] w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
        <div className="p-5 flex flex-col h-full overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-black text-gray-900 uppercase leading-none">Batalkan Pesanan?</h3>
            <button 
              onClick={() => setShowCancelModal(false)}
              className="p-2 -mr-2 text-gray-400 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="overflow-y-auto pr-1 -mr-1 space-y-2.5">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center mb-1">Pilih Alasan Pembatalan:</p>
            
            <div className="grid grid-cols-1 gap-2">
              <button
                onClick={() => setCancelReasonType('customer')}
                className={cn(
                  "w-full p-3.5 rounded-2xl text-left border-2 transition-all font-bold text-xs uppercase tracking-tight",
                  cancelReasonType === 'customer' 
                    ? "border-emerald-600 bg-emerald-50 text-emerald-700 shadow-md shadow-emerald-100" 
                    : "border-gray-100 bg-gray-50 text-gray-600"
                )}
              >
                Dibatalkan oleh customer
              </button>
              <button
                onClick={() => setCancelReasonType('item_unavailable')}
                className={cn(
                  "w-full p-3.5 rounded-2xl text-left border-2 transition-all font-bold text-xs uppercase tracking-tight",
                  cancelReasonType === 'item_unavailable' 
                    ? "border-emerald-600 bg-emerald-50 text-emerald-700 shadow-md shadow-emerald-100" 
                    : "border-gray-100 bg-gray-50 text-gray-600"
                )}
              >
                Barang tidak tersedia / habis
              </button>
              <button
                onClick={() => setCancelReasonType('other')}
                className={cn(
                  "w-full p-3.5 rounded-2xl text-left border-2 transition-all font-bold text-xs uppercase tracking-tight",
                  cancelReasonType === 'other' 
                    ? "border-emerald-600 bg-emerald-50 text-emerald-700 shadow-md shadow-emerald-100" 
                    : "border-gray-100 bg-gray-50 text-gray-600"
                )}
              >
                Lainnya...
              </button>
            </div>

            {cancelReasonType === 'other' && (
              <textarea
                className="w-full mt-1 p-4 bg-gray-50 rounded-2xl border-none text-xs font-medium focus:ring-2 focus:ring-emerald-500 h-20 shadow-inner"
                placeholder="Tuliskan alasannya di sini..."
                value={cancelReasonText}
                onChange={(e) => setCancelReasonText(e.target.value)}
              />
            )}
            
            <div className="flex items-start gap-2.5 p-3.5 bg-amber-50 rounded-2xl border border-amber-100 mt-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-[9px] font-bold text-amber-700 uppercase leading-relaxed tracking-wider">Tindakan ini tidak dapat dibatalkan. Pesanan akan hilang dari daftar aktif anda.</p>
            </div>
          </div>

          <button
            onClick={handleConfirmCancel}
            disabled={!cancelReasonType}
            className={cn(
              "w-full mt-5 py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all shadow-xl active:scale-[0.98] border-b-4",
              cancelReasonType 
                ? "bg-red-600 text-white shadow-red-200 border-red-800" 
                : "bg-gray-200 text-gray-400 cursor-not-allowed shadow-none border-gray-300"
            )}
          >
            YA, BATALKAN SEKARANG
          </button>
        </div>
      </div>
    </div>

  );
};
