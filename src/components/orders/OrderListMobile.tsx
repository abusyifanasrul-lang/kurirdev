import { format } from 'date-fns';
import { Card } from '@/components/ui/Card';
import { Badge, getStatusBadgeVariant, getStatusLabel } from '@/components/ui/Badge';
import type { Order } from '@/types';

interface OrderListMobileProps {
  orders: Order[];
  onSelect: (order: Order) => void;
}

export function OrderListMobile({ orders, onSelect }: OrderListMobileProps) {
  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('id-ID', { 
      style: 'currency', 
      currency: 'IDR', 
      minimumFractionDigits: 0 
    }).format(val);

  return (
    <div className="lg:hidden space-y-3">
      {orders.map((order) => (
        <Card 
          key={order.id} 
          padding="sm" 
          onClick={() => onSelect(order)}
          className="active:scale-[0.98] transition-transform"
        >
          <div className="flex justify-between items-start mb-2">
            <div>
              <p className="font-bold text-indigo-600">{order.order_number}</p>
              <p className="text-sm font-medium text-gray-900">{order.customer_name}</p>
            </div>
            <Badge variant={getStatusBadgeVariant(order.status)}>
              {getStatusLabel(order.status)}
            </Badge>
          </div>
          <div className="text-sm text-gray-500 flex justify-between mt-2">
            <span className="font-medium text-gray-700">{formatCurrency(order.total_fee || 0)}</span>
            <span>{format(new Date(order.created_at), 'dd MMM HH:mm')}</span>
          </div>
        </Card>
      ))}
    </div>
  );
}
