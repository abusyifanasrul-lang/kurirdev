import { ArrowUpDown, ChevronUp, ChevronDown } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge, getStatusBadgeVariant, getStatusLabel } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeader,
  TableCell,
  TableEmpty,
} from '@/components/ui/Table';
import type { Order } from '@/types';

interface OrderTableProps {
  orders: Order[];
  onSelect: (order: Order) => void;
  onSort: (field: any) => void;
  sortField: string;
  sortOrder: 'asc' | 'desc';
  getCourierName: (id?: string) => React.ReactNode;
  isFinance: boolean;
  onBulkSettle: (order: Order) => void;
}

export function OrderTable({
  orders,
  onSelect,
  onSort,
  sortField,
  sortOrder,
  getCourierName,
  isFinance,
  onBulkSettle,
}: OrderTableProps) {
  const getSortIcon = (field: string) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 ml-1 text-gray-400" />;
    return sortOrder === 'asc' ? 
      <ChevronUp className="h-3 w-3 ml-1 text-teal-600" /> : 
      <ChevronDown className="h-3 w-3 ml-1 text-teal-600" />;
  };

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('id-ID', { 
      style: 'currency', 
      currency: 'IDR', 
      minimumFractionDigits: 0 
    }).format(val);

  return (
    <Card padding="none" className="hidden lg:block">
      <Table>
        <TableHead>
          <TableRow>
            {[
              { id: 'order_number', label: 'Order #' },
              { id: 'customer_name', label: 'Customer' },
              { id: 'status', label: 'Status' },
              { id: 'courier_id', label: 'Courier' },
              ...(isFinance ? [{ id: 'payment_status', label: 'Setoran' }] : []),
              { id: 'total_fee', label: 'Fee' },
              { id: 'created_at', label: 'Created' },
            ].map((col) => (
              <TableHeader
                key={col.id}
                className="cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={() => onSort(col.id)}
              >
                <div className="flex items-center">
                  {col.label} {getSortIcon(col.id)}
                </div>
              </TableHeader>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {orders.length === 0 ? (
            <TableEmpty colSpan={isFinance ? 7 : 6} message="No orders found" />
          ) : (
            orders.map((order) => (
              <TableRow
                key={order.id}
                className="cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => onSelect(order)}
              >
                <TableCell className="font-medium text-teal-600">{order.order_number}</TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium text-gray-900">{order.customer_name}</span>
                    <span className="text-xs text-gray-500">{order.customer_phone}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={getStatusBadgeVariant(order.status)}>
                    {getStatusLabel(order.status)}
                  </Badge>
                </TableCell>
                <TableCell>
                  {getCourierName(order.courier_id) || (
                    <span className="text-gray-400 italic">Unassigned</span>
                  )}
                </TableCell>
                {isFinance && (
                  <TableCell>
                    {order.status === 'delivered' ? (
                      order.payment_status === 'paid' ? (
                        <Badge variant="success">Sudah Setor</Badge>
                      ) : (
                        <Button
                          size="sm"
                          className="bg-orange-500 hover:bg-orange-600 text-white h-7 px-2 text-[10px]"
                          onClick={(e) => {
                            e.stopPropagation();
                            onBulkSettle(order);
                          }}
                        >
                          Konfirmasi Setoran
                        </Button>
                      )
                    ) : (
                      <span className="text-gray-400">─</span>
                    )}
                  </TableCell>
                )}
                <TableCell>{formatCurrency(order.total_fee || 0)}</TableCell>
                <TableCell className="text-gray-500 text-xs">
                  {new Date(order.created_at).toLocaleString('id-ID', {
                    day: '2-digit',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </Card>
  );
}
