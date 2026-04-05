import React from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Badge, getStatusBadgeVariant, getStatusLabel } from '@/components/ui/Badge';
import { Printer } from 'lucide-react';
import { formatCurrency } from '@/utils/formatter';
import { formatWIB } from '@/utils/date';
import { Order, User } from '@/types';

interface OrderDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
  isOpsAdmin: boolean;
  assignCourierId: string;
  setAssignCourierId: (id: string) => void;
  availableCouriers: User[];
  handleAssign: () => Promise<void>;
  courierWaitingOrder: (cid: string) => Order | undefined;
  handlePrintInvoice: (order: Order) => void;
  getCourierName: (cid: string | null) => string;
  onEdit?: () => void;
}

export const OrderDetailsModal: React.FC<OrderDetailsModalProps> = ({
  isOpen,
  onClose,
  order,
  isOpsAdmin,
  assignCourierId,
  setAssignCourierId,
  availableCouriers,
  handleAssign,
  courierWaitingOrder,
  handlePrintInvoice,
  getCourierName,
  onEdit
}) => {
  if (!order) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="📦 Detail Pesanan" size="lg">
      <div className="space-y-4">
        {/* Header Section */}
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-lg font-bold text-gray-900">{order.order_number}</h3>
            <p className="text-sm text-gray-500">
              Dibuat pada {formatWIB(order.created_at)}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Badge variant={getStatusBadgeVariant(order.status)}>
              {getStatusLabel(order.status)}
            </Badge>
            {order.status === 'delivered' && (
              <Button 
                variant="outline" 
                size="sm" 
                className="flex items-center gap-2"
                onClick={() => handlePrintInvoice(order)}
              >
                <Printer className="w-4 h-4" />
                Print Invoice
              </Button>
            )}
          </div>
        </div>

        {/* Content Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Customer Info */}
          <div className="space-y-3">
            <h4 className="font-semibold text-gray-700 border-b pb-1">Informasi Customer</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Nama:</span>
                <span className="font-medium">{order.customer_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Telepon:</span>
                <span className="font-medium">{order.customer_phone}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-gray-500">Alamat:</span>
                <span className="font-medium mt-1">{order.customer_address}</span>
              </div>
            </div>
          </div>

          {/* Logistics Info */}
          <div className="space-y-3">
            <h4 className="font-semibold text-gray-700 border-b pb-1">Logistik & Pembayaran</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Kurir:</span>
                <span className="font-medium">{getCourierName(order.courier_id || null) || 'Belum Ditugaskan'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Ongkir:</span>
                <span className="font-medium text-teal-600">{formatCurrency(order.total_fee)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Status Bayar:</span>
                <Badge variant={order.payment_status === 'paid' ? 'success' : 'warning'}>
                  {order.payment_status === 'paid' ? 'Sudah Setor' : 'Belum Setor'}
                </Badge>
              </div>
            </div>
          </div>
        </div>

        {/* Order Items */}
        {((order.items && order.items.length > 0) || order.item_name) && (
          <div className="space-y-3 pt-2">
            <h4 className="font-semibold text-gray-700 border-b pb-1">Daftar Belanja</h4>
            <div className="bg-gray-50 rounded-lg p-3 space-y-2">
              {order.items && order.items.length > 0 ? (
                order.items.map((item, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span>{item.nama}</span>
                    <span className="font-medium">{formatCurrency(item.harga)}</span>
                  </div>
                ))
              ) : (
                <div className="flex justify-between text-sm">
                  <span>{order.item_name}</span>
                  <span className="font-medium">{order.item_price ? formatCurrency(order.item_price) : '-'}</span>
                </div>
              )}
              {order.items && order.items.length > 0 && (
                <div className="flex justify-between border-t pt-2 mt-2 font-bold text-gray-900 text-sm">
                  <span>Total Belanja</span>
                  <span>{formatCurrency(order.items.reduce((sum, item) => sum + item.harga, 0))}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Assign Section (Only for Pending & OpsAdmin) */}
        {order.status === 'pending' && isOpsAdmin && (
          <div className="bg-teal-50 rounded-lg p-4 border border-teal-100 space-y-3">
            <h4 className="text-sm font-bold text-teal-900">Tugaskan Kurir</h4>
            <div className="flex gap-3">
              <div className="flex-1">
                <Select
                  placeholder="Pilih Kurir..."
                  value={assignCourierId}
                  onChange={e => setAssignCourierId(e.target.value)}
                  options={availableCouriers.map(c => {
                    const waiting = courierWaitingOrder(c.id);
                    return {
                      value: c.id,
                      label: waiting ? `${c.name} 📝 PENDING — ${waiting.order_number}` : `${c.name} (Online)`
                    };
                  })}
                />
              </div>
              <Button 
                className="bg-teal-600 hover:bg-teal-700 text-white px-8"
                onClick={handleAssign}
                disabled={!assignCourierId}
              >
                Tugaskan
              </Button>
            </div>
            <p className="text-[10px] text-teal-600">
              * Kurir diurutkan berdasarkan antrian FIFO. Antrian akan berputar otomatis setelah tugas diberikan.
            </p>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex justify-end pt-4 border-t gap-3">
          <Button variant="outline" onClick={onClose}>
            Tutup
          </Button>
          {(isOpsAdmin || order.payment_status !== 'paid') && onEdit && (
            <Button 
              className="bg-teal-600 hover:bg-teal-700 text-white"
              onClick={() => {
                onClose();
                onEdit();
              }}
            >
              Edit Pesanan
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
};
