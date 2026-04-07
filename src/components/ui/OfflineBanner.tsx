import React, { useState, useEffect } from 'react';
import { WifiOff, Wifi, AlertTriangle } from 'lucide-react';

import { useNetworkStatus } from '@/hooks/useNetworkStatus';

export const OfflineBanner: React.FC = () => {
  const isOnline = useNetworkStatus();
  const [isVisible, setIsVisible] = useState(!navigator.onLine);

  useEffect(() => {
    if (isOnline) {
      // Keep showing the "reconnecting" state briefly for UX before hiding
      const timer = setTimeout(() => {
        setIsVisible(false);
      }, 3000);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(true);
    }
  }, [isOnline]);

  if (!isVisible) return null;

  return (
    <div 
      className={`fixed top-0 left-0 right-0 z-[9999] flex items-center justify-center p-2 text-sm font-medium transition-all duration-500 ${
        isOnline 
          ? 'bg-emerald-600 text-white shadow-lg' 
          : 'bg-amber-500 text-black shadow-lg'
      }`}
      role="alert"
      aria-live="assertive"
    >
      <div className="flex items-center gap-2">
        {isOnline ? (
          <>
            <Wifi className="w-4 h-4 animate-pulse" />
            <span>Koneksi Kembali Terhubung! Mensinkronisasi data...</span>
          </>
        ) : (
          <>
            <WifiOff className="w-4 h-4" />
            <span>Mode Offline Aktif - Menggunakan Data Lokal</span>
            <AlertTriangle className="w-4 h-4 ml-2 animate-bounce" />
          </>
        )}
      </div>
    </div>
  );
};
