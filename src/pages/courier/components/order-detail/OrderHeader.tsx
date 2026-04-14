import React, { useMemo, useState } from 'react';
import { Printer, ChevronDown, ChevronRight } from 'lucide-react';
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
  const [isMinimized, setIsMinimized] = useState(false);
  const { courier_instructions } = useSettingsStore();

  const instructionData = useMemo(() => {
    if (!order.notes) return null;
    // Find matching preset, but we compare with .instruction as that is what's saved in order.notes
    const match = courier_instructions.find(i => i.instruction === order.notes || i.label === order.notes);
    
    return {
      text: order.notes,
      icon: match?.icon || 'ℹ️',
      isAdminInstruction: !!match || (order.assigner_name && order.notes)
    };
  }, [order.notes, courier_instructions, order.assigner_name]);

  const getStatusDisplay = () => {
    if (order.status === 'cancelled') return { label: 'Dibatalkan', emoji: '❌', color: 'bg-red-100 text-red-700' };
    if (order.is_waiting) return { label: 'Sedang Menunggu', emoji: '🕒', color: 'bg-amber-100 text-amber-700' };
    
    switch (order.status) {
      case 'assigned': return { label: 'Pesanan Diterima', emoji: '📋', color: 'bg-blue-100 text-blue-700' };
      case 'picked_up': return { label: 'Menuju Penjual', emoji: '🛵', color: 'bg-emerald-100 text-emerald-700' };
      case 'in_transit': return { label: 'Menuju Customer', emoji: '🚚', color: 'bg-emerald-100 text-emerald-700' };
      case 'delivered': return { label: 'Pesanan Terkirim', emoji: '✅🖨️', color: 'bg-emerald-100 text-emerald-700' };

      default: return { label: order.status.replace('_', ' '), emoji: '📦', color: 'bg-gray-100 text-gray-700' };
    }
  };

  const status = getStatusDisplay();

  return (
    <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between gap-3 shadow-sm flex-shrink-0 z-50">
      <div className="flex-1 min-w-0">
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
          
          {instructionData && (
            <div className="mt-2.5 animate-in fade-in slide-in-from-top-1 duration-300">
              <button
                onClick={() => setIsMinimized(!isMinimized)}
                className={cn(
                  "flex flex-col gap-1 p-2 w-full text-left transition-all duration-300 rounded-xl border shadow-sm active:scale-[0.98]",
                  isMinimized 
                    ? "bg-gray-50 border-gray-200" 
                    : "bg-emerald-50/80 border-emerald-100 animate-instruction-pulse"
                )}
              >
                {isMinimized ? (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 overflow-hidden">
                      <span className="text-sm leading-none flex-shrink-0">{instructionData.icon}</span>
                      <span className="text-[11px] font-semibold text-gray-500 truncate leading-none">
                        Instr: {instructionData.text}
                      </span>
                    </div>
                    <ChevronRight className="h-3 w-3 text-gray-400 flex-shrink-0 ml-1" />
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm leading-none">{instructionData.icon}</span>
                        <span className="text-[13px] font-bold text-emerald-800 leading-snug">
                          {instructionData.text}
                        </span>
                      </div>
                      <ChevronDown className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0 ml-1" />
                    </div>
                    {order.assigner_name && (
                      <div className="flex items-center gap-1.5 ml-0.5">
                        <div className="h-2 w-0.5 bg-emerald-300 rounded-full" />
                        <span className="text-[10px] text-emerald-600/70 font-medium italic">
                          Instruksi dari Admin: <span className="font-bold text-emerald-600 uppercase">{order.assigner_name}</span>
                        </span>
                      </div>
                    )}
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>


      <div className="flex items-center gap-2 flex-shrink-0">
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


