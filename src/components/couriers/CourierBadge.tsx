import React from 'react';
import { getVehicleIcon, getVehicleLabel } from '@/utils/courier';
import type { Courier } from '@/types';
import { cn } from '@/utils/cn';

interface CourierBadgeProps {
  type?: Courier['vehicle_type'];
  className?: string;
  showLabel?: boolean;
}

export const CourierBadge: React.FC<CourierBadgeProps> = ({ 
  type, 
  className, 
  showLabel = true 
}) => {
  const Icon = getVehicleIcon(type);
  const label = getVehicleLabel(type);

  return (
    <div className={cn(
      "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-medium border transition-colors",
      type ? "bg-gray-100 text-gray-600 border-gray-200" : "bg-orange-50 text-orange-600 border-orange-100",
      className
    )}>
      <Icon className="w-3 h-3" />
      {showLabel && (type ? label : 'Belum Diatur')}
    </div>
  );
};
