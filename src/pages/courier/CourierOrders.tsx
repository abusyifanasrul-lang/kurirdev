import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, Clock, ChevronRight, Search, MapPin } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { Badge, getStatusBadgeVariant, getStatusLabel } from '@/components/ui/Badge';
import { useOrderStore } from '@/stores/useOrderStore';
import { formatCurrency } from '@/utils/formatter';
import { cn } from '@/utils/cn';

export function CourierOrders() {
  const navigate = useNavigate();
  const { activeOrdersByCourier, isLoading } = useOrderStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<string>('all');

  const myOrders = [...activeOrdersByCourier].sort((a, b) => {
    // Prioritize orders that are in waiting/pending state
    if (a.is_waiting !== b.is_waiting) {
      return a.is_waiting ? -1 : 1;
    }
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  if (isLoading && myOrders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-10 h-10 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mb-4" />
        <p className="text-gray-500 font-medium tracking-tight">Memuat pesanan aktif...</p>
      </div>
    );
  }

  const filteredOrders = myOrders.filter((order) => {
    const matchesSearch =
      !searchQuery ||
      order.order_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.customer_name.toLowerCase().includes(searchQuery.toLowerCase());

    let matchesFilter = true;
    if (activeFilter !== 'all') {
      matchesFilter = order.status === activeFilter;
    } else {
      matchesFilter = true;
    }

    return matchesSearch && matchesFilter;
  });

  const filters = [
    { key: 'all', label: 'Aktif' },
    { key: 'assigned', label: 'Order Diterima' },
    { key: 'picked_up', label: 'GAS — Penjual' },
    { key: 'in_transit', label: 'GAS — Customer' },
  ];

  return (
    <div className="space-y-4">
      <div className="relative group px-1">
        <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 group-focus-within:text-emerald-500 transition-colors" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Cari nomor pesanan atau nama..."
          className="w-full pl-11 pr-4 py-3.5 bg-white border border-gray-100 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500/50 text-sm font-bold shadow-sm transition-all placeholder:text-gray-400 placeholder:font-medium"
        />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-4 no-scrollbar -mx-4 px-5">
        {filters.map((filter) => (
          <button
            key={filter.key}
            onClick={() => setActiveFilter(filter.key)}
            className={cn(
              "px-5 py-2.5 rounded-2xl text-[11px] font-black whitespace-nowrap transition-all uppercase tracking-wider border active:scale-95",
              activeFilter === filter.key
                ? "bg-emerald-600 text-white border-emerald-600 shadow-lg shadow-emerald-100"
                : "bg-white text-gray-400 border-gray-100/70 hover:border-emerald-200"
            )}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {filteredOrders.length === 0 ? (
        <div className="bg-white rounded-[2.5rem] p-12 shadow-sm border border-gray-100 text-center">
          <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-5 border border-gray-100">
            <Package className="h-10 w-10 text-gray-200" />
          </div>
          <p className="text-sm font-black text-gray-400 uppercase tracking-tight">KOSONG</p>
          <p className="text-[11px] text-gray-400 mt-1 font-medium">Tidak ada pesanan ditemukan</p>
        </div>
      ) : (
        <div className="space-y-4 pt-2">
          {filteredOrders.map((order: any) => (
            <button
              key={order.id}
              onClick={() => navigate(`/courier/orders/${order.id}`)}
              className="group w-full bg-white rounded-3xl p-5 shadow-sm border border-gray-100 text-left hover:border-emerald-400 hover:shadow-xl hover:shadow-emerald-50 transition-all active:scale-[0.98]"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-[10px] font-bold bg-gray-900 text-white px-2.5 py-0.5 rounded-lg tabular-nums">
                      #{order.order_number}
                    </span>
                    <Badge variant={getStatusBadgeVariant(order.status)} className="font-black text-[9px] uppercase tracking-widest h-5 whitespace-nowrap">
                      {getStatusLabel(order.status, 'courier')}
                    </Badge>
                    {order.is_waiting && (
                      <Badge variant="warning" className="font-black text-[9px] uppercase tracking-widest h-5 border-none bg-amber-400 text-amber-950 shadow-sm">
                        Pending
                      </Badge>
                    )}
                  </div>
                  <p className="text-lg font-black text-gray-900 mb-1 tracking-tight">{order.customer_name}</p>
                  <p className="text-xs font-medium text-gray-500 line-clamp-1 flex items-center gap-1.5">
                    <MapPin className="h-3 w-3 shrink-0" />
                    {order.customer_address}
                  </p>
                  
                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-50">
                    <div className="flex items-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-wider">
                      <Clock className="h-3 w-3" />
                      {order.created_at ? format(parseISO(order.created_at), 'HH:mm') : '-'}
                    </div>
                    <div className="bg-emerald-50 px-4 py-1.5 rounded-xl border border-emerald-100 shadow-sm shadow-emerald-50">
                      <p className="text-sm font-black text-emerald-600 tabular-nums">
                        {formatCurrency(order.total_fee || 0)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
