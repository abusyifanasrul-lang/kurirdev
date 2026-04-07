import React, { useMemo } from 'react';
import { ArrowLeft, Printer } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/utils/cn';
import { Order } from '@/types';
import { useSettingsStore } from '@/stores/useSettingsStore';

interface OrderHeaderProps {
  order: Order;
  onBagikanInvoice: () => void;
  isGeneratingInvoice?: boolean;
}

export const OrderHeader: React.FC<OrderHeaderProps> = ({
  order,
  onBagikanInvoice,
  isGeneratingInvoice = false
}) => {
  const navigate = useNavigate();
  const { courier_instructions } = useSettingsStore();

  const instruction = useMemo(() => {
    if (!order.notes) return null;
    return courier_instructions.find(i => i.label === order.notes) || null;
  }, [order.notes, courier_instructions]);

  const getStatusDisplay = () => {
    if (order.is_waiting) return { label: 'Sedang Menunggu', emoji: '🕒', color: 'bg-amber-100 text-amber-700' };
    
    switch (order.status) {
      case 'assigned': return { label: 'Pesanan Diterima', emoji: '📋', color: 'bg-blue-100 text-blue-700' };
      case 'picked_up': return { label: 'Menuju Penjual', emoji: '🛵', color: 'bg-emerald-100 text-emerald-700' };
      case 'in_transit': return { label: 'Menuju Customer', emoji: '🚚', color: 'bg-emerald-100 text-emerald-700' };
      case 'delivered': return { label: 'Pesanan Terkirim', emoji: '✅🖨️', color: 'bg-emerald-100 text-emerald-700' };
      case 'cancelled': return { label: 'Dibatalkan', emoji: '❌', color: 'bg-red-100 text-red-700' };
      default: return { label: order.status.replace('_', ' '), emoji: '📦', color: 'bg-gray-100 text-gray-700' };
    }
  };

  const status = getStatusDisplay();

  return (
    <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between shadow-sm flex-shrink-0 z-50">
      <div className="flex items-center gap-3">
        <button 
          onClick={() => navigate('/courier/orders')}
          className="p-2 -ml-2 rounded-full hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft className="h-6 w-6 text-gray-700" />
        </button>
        <div>
          <h1 className="text-[10px] font-bold text-gray-400 uppercase tracking-mobile leading-tight">
            ID: {order.order_number}
          </h1>
          <div className="flex items-center gap-2 mt-1">
            {order.status === 'delivered' ? (
              <button 
                onClick={onBagikanInvoice}
                disabled={isGeneratingInvoice}
                className={cn(
                  "flex items-center gap-2 px-2 py-1 rounded-lg transition-all active:scale-95 bg-emerald-50 border border-emerald-200 shadow-sm",
                  isGeneratingInvoice ? "opacity-50 animate-pulse" : "hover:bg-emerald-100"
                )}
                title="Klik untuk Unduh Invoice"
              >
                <span className="text-sm font-bold text-emerald-700 leading-none flex items-center gap-1.5">
                  {status.emoji} {status.label.toUpperCase()}
                  <span className="text-[10px] bg-emerald-600 text-white px-1.5 py-0.5 rounded-md font-bold animate-bounce shadow-sm ml-1">PRINT 🖨️</span>
                </span>
              </button>
            ) : (
              <span className="text-sm font-bold text-gray-900 leading-snug tracking-tight">
                {status.emoji} {status.label.toUpperCase()}
              </span>
            )}
          </div>
          {instruction && (
            <div className="flex items-center gap-1.5 mt-2 px-2 py-1 bg-emerald-50 border border-emerald-100 rounded-lg animate-in fade-in slide-in-from-top-1 duration-300">
              <span className="text-sm leading-none">{instruction.icon}</span>
              <span className="text-xs font-semibold text-emerald-700 leading-snug italic">
                {instruction.instruction}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onBagikanInvoice}
          disabled={isGeneratingInvoice}
          className={cn(
            "p-3 rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-all active:scale-90 flex items-center justify-center",
            isGeneratingInvoice && "opacity-70 scale-95"
          )}
          title="Download/Print Invoice"
        >
          {isGeneratingInvoice ? (
            <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Printer className="h-5 w-5" />
          )}
        </button>
      </div>
    </div>
  );
};


