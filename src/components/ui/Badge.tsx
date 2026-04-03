import { cn } from '@/utils/cn';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'secondary';
  size?: 'sm' | 'md';
  className?: string;
}

export function Badge({ children, variant = 'default', size = 'sm', className }: BadgeProps) {
  const variants = {
    default: 'bg-gray-100 text-gray-800',
    success: 'bg-green-100 text-green-800',
    warning: 'bg-yellow-100 text-yellow-800',
    danger: 'bg-red-100 text-red-800',
    info: 'bg-blue-100 text-blue-800',
    secondary: 'bg-cyan-100 text-cyan-800',
  };

  const sizes = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center font-medium rounded-full',
        variants[variant],
        sizes[size],
        className
      )}
    >
      {children}
    </span>
  );
}

// Helper function to get badge variant based on order status
export function getStatusBadgeVariant(status: string): BadgeProps['variant'] {
  const statusVariants: Record<string, BadgeProps['variant']> = {
    pending: 'warning',
    assigned: 'info',
    picked_up: 'secondary',
    in_transit: 'info',
    delivered: 'success',
    cancelled: 'danger',
  };
  return statusVariants[status] || 'default';
}

export function getStatusLabel(status: string, context?: 'admin' | 'courier'): string {
  const adminLabels: Record<string, string> = {
    pending: '⏳ Menunggu Kurir',
    assigned: '📲 Kurir Ditugaskan',
    picked_up: '🛵 GAS — Menuju Penjual',
    in_transit: '🛵 GAS — Menuju Customer',
    delivered: '✅ CEKLIS — Terkirim',
    cancelled: '❌ CANCEL — Dibatalkan',
  };
  const courierLabels: Record<string, string> = {
    ...adminLabels,
    assigned: '📲 Order Diterima',
  };
  const labels = context === 'courier' ? courierLabels : adminLabels;
  return labels[status] || status;
}
