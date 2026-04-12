import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Order } from '@/types/index';

import { formatCurrency } from '@/utils/formatter';

interface BulkSettleModalProps {
  isOpen: boolean;
  onClose: () => void;
  courierName: string;
  unpaidOrders: Order[];
  settleOrder: (orderId: string, userId: string, userName: string) => Promise<void>;
  userId: string;
  userName: string;
  getInitialOrders: () => Promise<Order[]>;
  setLocalDBOrders: (orders: Order[]) => void;
  calcPlatformFee: (order: Order) => number;
}

export const BulkSettleModal: React.FC<BulkSettleModalProps> = ({
  isOpen,
  onClose,
  courierName,
  unpaidOrders,
  settleOrder,
  userId,
  userName,
  getInitialOrders,
  setLocalDBOrders,
  calcPlatformFee
}) => {
  const [isProcessing, setIsProcessing] = useState(false);

  const totalPlatformFee = unpaidOrders.reduce((sum, o) => sum + calcPlatformFee(o), 0);

  const handleBulkSettle = async () => {
    if (unpaidOrders.length === 0) return;
    setIsProcessing(true);
    try {
      for (const order of unpaidOrders) {
        // 1. Update Supabase with tracking
        await settleOrder(order.id, userId, userName);
      }
      // 3. Refresh LocalDB state
      const updated = await getInitialOrders();
      setLocalDBOrders(updated);
      onClose();
    } catch (error) {
      console.error('Bulk settle error:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="💰 Konfirmasi Setoran" size="sm">
      <div className="space-y-4">
        <p className="text-sm text-gray-500">
          Kurir: <span className="font-semibold text-gray-900">{courierName}</span>
        </p>

        {/* List order belum disetor */}
        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
          {unpaidOrders.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">
              Tidak ada order belum disetor
            </p>
          ) : (
            unpaidOrders.map(o => (
              <div key={o.id} className="flex justify-between items-center text-sm bg-gray-50 px-3 py-2 rounded-lg">
                <span className="font-medium">{o.order_number}</span>
                <div className="text-right">
                  <p className="text-gray-500 text-[10px]">
                    Ongkir: {formatCurrency(o.total_fee)}
                  </p>
                  <p className="font-semibold text-orange-600">
                    Setor: {formatCurrency(calcPlatformFee(o))}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Total */}
        {unpaidOrders.length > 0 && (
          <div className="border-t pt-3">
            <div className="flex justify-between items-center font-bold">
              <span className="text-gray-700">Total Disetor</span>
              <span className="text-xl text-orange-600">
                {formatCurrency(totalPlatformFee)}
              </span>
            </div>
            <p className="text-[10px] text-gray-400 mt-1">
              {unpaidOrders.length} order · Menggunakan rate saat pengiriman
            </p>
          </div>
        )}

        {/* Buttons */}
        <div className="flex gap-3 pt-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Batal
          </Button>
          <Button 
            className="flex-1 bg-orange-600 hover:bg-orange-700 text-white" 
            disabled={unpaidOrders.length === 0 || isProcessing}
            isLoading={isProcessing}
            onClick={handleBulkSettle}
          >
            Konfirmasi Setor Semua
          </Button>
        </div>
      </div>
    </Modal>
  );
};
