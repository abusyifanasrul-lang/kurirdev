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
    <div className="flex-1 h-full min-h-0 relative bg-gray-50 flex flex-col overflow-hidden">
      {/* Map Container */}
      <div className="flex-1 h-full min-h-0 relative">
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
            className="border-0 w-full h-full block leading-none"
            allowFullScreen
          />
        )}


        {/* Minimalist Floating Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-3 right-3 z-20 p-2 bg-white/60 backdrop-blur-md rounded-full shadow-sm border border-white/20 active:scale-90 transition-all hover:bg-white"
        >
          <X className="h-4 w-4 text-gray-900" />
        </button>

        {/* GPS Pulse Info (Bottom Left) - More Minimalist */}
        {!error && !isLoading && origin && (
          <div className="absolute bottom-3 left-3 z-20 pointer-events-none">
            <div className="bg-white/40 backdrop-blur-sm px-2.5 py-1 rounded-full border border-white/20 shadow-sm flex items-center gap-1.5">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[8px] font-bold text-gray-700 uppercase tracking-wider">Live Active</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
