import { Bike, Car, Truck, User } from 'lucide-react';
import type { Courier } from '@/types';

export const getVehicleIcon = (type?: Courier['vehicle_type']) => {
  switch (type) {
    case 'motorcycle':
      return Bike;
    case 'car':
      return Car;
    case 'bicycle':
      return Bike;
    case 'van':
      return Truck;
    default:
      return User;
  }
};

export const getVehicleEmoji = (type?: Courier['vehicle_type']) => {
  switch (type) {
    case 'motorcycle':
      return '🛵';
    case 'car':
      return '🚗';
    case 'bicycle':
      return '🚲';
    case 'van':
      return '🚚';
    default:
      return '👤';
  }
};

export const getVehicleLabel = (type?: Courier['vehicle_type']) => {
  switch (type) {
    case 'motorcycle':
      return 'Motor';
    case 'car':
      return 'Mobil';
    case 'bicycle':
      return 'Sepeda';
    case 'van':
      return 'Van/Pick Up';
    default:
      return 'Lainnya';
  }
};
