import React from 'react';
import { ArrowLeft, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Order } from '@/types';
import { cn } from '@/utils/cn';

interface OrderHeaderProps {
  order: Order;
  isUpdating: boolean;
  onUpdateStatus: () => void;
  onBagikanInvoice: () => void;
  getNextStatusButton: () => { label: string; color: string } | null;
  isSuspended: boolean;
}

export const OrderHeader: React.FC<OrderHeaderProps> = ({
  order,
  isUpdating,
  onUpdateStatus,
  onBagikanInvoice,
  getNextStatusButton,
  isSuspended
}) => {
  const navigate = useNavigate();
  const nextBtn = getNextStatusButton();
  const isLocked = order.status === 'delivered' || isSuspended;

  return (
    <div className="sticky top-0 z-30 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between shadow-sm">
      <div className="flex items-center gap-3">
        <button 
          onClick={() => navigate('/courier/orders')}
          className="p-2 -ml-2 rounded-full hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft className="h-6 w-6 text-gray-700" />
        </button>
        <div>
          <h1 className="text-lg font-bold text-gray-900 leading-tight">
            {order.order_number}
          </h1>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={cn(
              "text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded-md",
              order.status === 'delivered' ? "bg-green-100 text-green-700" : "bg-emerald-100 text-emerald-700"
            )}>
              {order.status.replace('_', ' ')}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onBagikanInvoice}
          className="p-2 rounded-xl bg-gray-50 text-gray-600 border border-gray-100 hover:bg-gray-100 transition-all active:scale-95"
          title="Download Invoice"
        >
          <FileText className="h-5 w-5" />
        </button>

        {nextBtn && !isLocked && (
          <button
            onClick={onUpdateStatus}
            disabled={isUpdating}
            className={cn(
              "px-4 py-2 rounded-xl text-white font-bold text-sm shadow-lg shadow-emerald-200/50 transition-all active:scale-95 flex items-center gap-2",
              nextBtn.color,
              isUpdating && "opacity-70 cursor-not-allowed scale-95"
            )}
          >
            {isUpdating ? (
              <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              nextBtn.label.split(' ')[1] // Get text after emoji
            )}
          </button>
        )}
      </div>
    </div>
  );
};
