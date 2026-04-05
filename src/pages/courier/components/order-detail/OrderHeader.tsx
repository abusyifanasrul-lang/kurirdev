import React from 'react';
import { ArrowLeft, Printer } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Order } from '@/types';

interface OrderHeaderProps {
  order: Order;
  onBagikanInvoice: () => void;
}

export const OrderHeader: React.FC<OrderHeaderProps> = ({
  order,
  onBagikanInvoice
}) => {
  const navigate = useNavigate();

  const getStatusDisplay = () => {
    if (order.is_waiting) return { label: 'Sedang Menunggu', emoji: '🕒', color: 'bg-amber-100 text-amber-700' };
    
    switch (order.status) {
      case 'assigned': return { label: 'Pesanan Diterima', emoji: '📋', color: 'bg-blue-100 text-blue-700' };
      case 'picked_up': return { label: 'Menuju Penjual', emoji: '🛵', color: 'bg-emerald-100 text-emerald-700' };
      case 'in_transit': return { label: 'Menuju Customer', emoji: '🚚', color: 'bg-emerald-100 text-emerald-700' };
      case 'delivered': return { label: 'Pesanan Terkirim', emoji: '✅', color: 'bg-green-100 text-green-700' };
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
          <h1 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none">
            {order.order_number}
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-sm font-black text-gray-900 leading-none">
              {status.emoji} {status.label.toUpperCase()}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onBagikanInvoice}
          className="p-3 rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-all active:scale-90 flex items-center justify-center"
          title="Download/Print Invoice"
        >
          <Printer className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
};


