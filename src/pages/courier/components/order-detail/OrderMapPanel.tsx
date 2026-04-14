import React from 'react';
import { MapPin, Navigation, X, Loader2 } from 'lucide-react';
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
  // Format: https://maps.google.com/maps?saddr={lat},{lng}&daddr={alamat}&output=embed
  const mapUrl = React.useMemo(() => {
    if (!origin) return '';
    const encodedDest = encodeURIComponent(destination);
    return `https://maps.google.com/maps?saddr=${origin.latitude},${origin.longitude}&daddr=${encodedDest}&output=embed`;
  }, [origin, destination]);

  return (
    <div 
      className={cn(
        "overflow-hidden transition-all duration-500 ease-in-out bg-gray-50",
        show ? "max-h-[450px] opacity-100 border-b border-gray-200" : "max-h-0 opacity-0 border-none"
      )}
    >
      <div className="p-4 space-y-3">
        {/* Panel Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-emerald-100 p-1.5 rounded-lg">
              <Navigation className="h-4 w-4 text-emerald-600" />
            </div>
            <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">Navigasi Real-time</h3>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <X className="h-4 w-4 text-gray-400" />
          </button>
        </div>

        {/* Map Container */}
        <div className="relative aspect-video w-full bg-gray-200 rounded-2xl overflow-hidden shadow-inner border border-gray-100">
          {error ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-red-50">
              <MapPin className="h-8 w-8 text-red-400 mb-2" />
              <p className="text-sm font-medium text-red-900 leading-snug">{error}</p>
              <p className="text-[10px] text-red-600 mt-1">Gagal memuat rute navigasi.</p>
            </div>
          ) : isLoading || !origin ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-100/80 backdrop-blur-sm">
              <Loader2 className="h-8 w-8 text-emerald-600 animate-spin mb-3" />
              <p className="text-xs font-bold text-gray-500 uppercase tracking-widest animate-pulse">Mencari Koordinat GPS...</p>
            </div>
          ) : (
            <iframe
              title="Delivery Map"
              width="100%"
              height="100%"
              loading="lazy"
              src={mapUrl}
              className="border-0 grayscale-[20%] contrast-[1.1] brightness-[1.02]"
              allowFullScreen
            />
          )}
          
          {/* Destination Brief Bubble */}
          {show && !error && (
            <div className="absolute top-3 left-3 right-12 z-10">
              <div className="bg-white/90 backdrop-blur-md px-3 py-2 rounded-xl border border-white/50 shadow-lg flex items-start gap-2 max-w-[90%]">
                <MapPin className="h-3.5 w-3.5 text-red-500 shrink-0 mt-0.5" />
                <p className="text-[10px] font-bold text-gray-800 line-clamp-2 leading-tight uppercase">
                  {destination}
                </p>
              </div>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-2 px-1">
          <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <p className="text-[9px] font-medium text-gray-500 italic">
            Titik biru (GPS) akan bergerak sesuai posisi Anda di jalan.
          </p>
        </div>
      </div>
    </div>
  );
};
