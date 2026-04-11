import React from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { AlertTriangle, Info, AlertCircle, HelpCircle } from 'lucide-react';
import { cn } from '@/utils/cn';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info' | 'primary';
  isLoading?: boolean;
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'primary',
  isLoading = false,
}: ConfirmModalProps) {
  const icons = {
    danger: <AlertCircle className="h-6 w-6 text-red-600" />,
    warning: <AlertTriangle className="h-6 w-6 text-amber-600" />,
    info: <Info className="h-6 w-6 text-blue-600" />,
    primary: <HelpCircle className="h-6 w-6 text-teal-600" />,
  };

  const colors = {
    danger: 'bg-red-50 border-red-100',
    warning: 'bg-amber-50 border-amber-100',
    info: 'bg-blue-50 border-blue-100',
    primary: 'bg-teal-50 border-teal-100',
  };

  const buttonColors = {
    danger: 'bg-red-600 hover:bg-red-700 text-white',
    warning: 'bg-amber-600 hover:bg-amber-700 text-white',
    info: 'bg-blue-600 hover:bg-blue-700 text-white',
    primary: 'bg-teal-600 hover:bg-teal-700 text-white',
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm" showClose={false}>
      <div className="flex flex-col items-center text-center py-2">
        {/* Icon Header */}
        <div className={cn(
          "w-14 h-14 rounded-full flex items-center justify-center mb-4 border-4",
          colors[variant]
        )}>
          {icons[variant]}
        </div>

        <h3 className="text-xl font-bold text-gray-900 mb-2">{title}</h3>
        <p className="text-sm text-gray-500 mb-8 whitespace-pre-wrap leading-relaxed">
          {message}
        </p>

        <div className="flex gap-3 w-full">
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1"
            disabled={isLoading}
          >
            {cancelText}
          </Button>
          <Button
            onClick={onConfirm}
            isLoading={isLoading}
            className={cn("flex-1", buttonColors[variant])}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
