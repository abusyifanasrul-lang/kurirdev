import React from 'react';
import { X, Loader2, MapPin } from 'lucide-react';
import { cn } from '@/utils/cn';

interface OrderMapPanelProps {
  show: boolean;
  origin: { latitude: number; longitude: number } | null;
  destination: string;
  onClose: () => void;
  isLoading?: boolean;
  error?: string | null;
}

export const OrderMapPanel: React.FC<OrderMapPanelProps> = ({
  show,
  origin,
  destination,
  onClose,
  isLoading = false,
  error = null,
}) => {
  // Construct Google Maps Embed URL
  const mapUrl = React.useMemo(() => {
    if (!origin) return '';
    const encodedDest = encodeURIComponent(destination);
    return `https://maps.google.com/maps?saddr=${origin.latitude},${origin.longitude}&daddr=${encodedDest}&output=embed`;
  }, [origin, destination]);

  if (!show) return null;

  return (
    <div className="flex-1 min-h-0 relative bg-gray-50 flex flex-col overflow-hidden">
      {/* Map Container */}
      <div className="flex-1 min-h-0 relative">
        {error ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-red-50">
            <MapPin className="h-8 w-8 text-red-400 mb-2" />
            <p className="text-sm font-medium text-red-900 leading-snug">{error}</p>
          </div>
        ) : isLoading || !origin ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-100/80 backdrop-blur-sm z-20">
            <Loader2 className="h-8 w-8 text-emerald-600 animate-spin mb-3" />
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest animate-pulse">
              Menghubungkan GPS...
            </p>
          </div>
        ) : (
          <iframe
            title="Delivery Map"
            width="100%"
            height="100%"
            loading="lazy"
            src={mapUrl}
            className="border-0 w-full h-full"
            allowFullScreen
          />
        )}

        {/* Floating Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 z-30 p-3 bg-white/90 backdrop-blur-md rounded-2xl shadow-xl border border-white/50 active:scale-90 transition-all hover:bg-white"
        >
          <X className="h-6 w-6 text-gray-900" />
        </button>

        {/* GPS Pulse Info (Bottom Left) */}
        {!error && !isLoading && origin && (
          <div className="absolute bottom-4 left-4 z-30 pointer-events-none">
            <div className="bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/50 shadow-lg flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
              <span className="text-[9px] font-bold text-gray-600 uppercase tracking-wider">Live Position Active</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
