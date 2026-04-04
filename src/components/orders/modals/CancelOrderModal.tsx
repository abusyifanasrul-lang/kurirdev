import React from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { Order } from '@/types/index';

interface CancelOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
  cancelReason: string;
  setCancelReason: (reason: string) => void;
  handleCancel: () => Promise<void>;
  isProcessing?: boolean;
}

export const CancelOrderModal: React.FC<CancelOrderModalProps> = ({
  isOpen,
  onClose,
  order,
  cancelReason,
  setCancelReason,
  handleCancel,
  isProcessing = false
}) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Cancel Order">
      <div className="space-y-4">
        <p className="text-gray-600">
          Are you sure you want to cancel <strong>{order?.order_number}</strong>?
        </p>
        <Textarea 
          placeholder="Reason for cancellation..." 
          value={cancelReason} 
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setCancelReason(e.target.value)} 
          rows={3}
        />
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Back</Button>
          <Button 
            variant="danger" 
            disabled={!cancelReason || isProcessing} 
            isLoading={isProcessing}
            onClick={handleCancel}
          >
            Confirm Cancel
          </Button>
        </div>
      </div>
    </Modal>
  );
};
