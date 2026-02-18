// Install Prompt Component untuk Instant Delivery App
import React, { useEffect } from 'react';
import { X, Download, Smartphone } from 'lucide-react';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';

interface InstallBannerProps {
  className?: string;
}

export function InstallBanner({ className = '' }: InstallBannerProps) {
  const { isInstallable, install, dismiss } = useInstallPrompt();
  const [isVisible, setIsVisible] = React.useState(false);

  useEffect(() => {
    // Show banner after 3 seconds if installable
    if (isInstallable) {
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [isInstallable]);

  const handleInstall = async () => {
    const success = await install();
    if (success) {
      setIsVisible(false);
      console.log('[InstallBanner] App installed successfully');
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
    dismiss();
  };

  if (!isVisible || !isInstallable) {
    return null;
  }

  return (
    <div className={`fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:w-96 ${className}`}>
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl shadow-2xl p-4 text-white">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3 flex-1">
            <div className="bg-white/20 p-2 rounded-lg">
              <Smartphone className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-sm">Install DeliveryPro</h3>
              <p className="text-xs text-white/80 mt-1">
                Get instant access to orders & faster delivery updates
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2 ml-2">
            <button
              onClick={handleInstall}
              className="bg-white text-blue-600 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-blue-50 transition-colors flex items-center space-x-1"
            >
              <Download className="w-3 h-3" />
              <span>Install</span>
            </button>
            
            <button
              onClick={handleDismiss}
              className="text-white/60 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        
        {/* Benefits */}
        <div className="mt-3 pt-3 border-t border-white/20">
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="text-center">
              <div className="font-medium">⚡ Instant</div>
              <div className="text-white/70">Load in 2s</div>
            </div>
            <div className="text-center">
              <div className="font-medium">📱 Offline</div>
              <div className="text-white/70">Works offline</div>
            </div>
            <div className="text-center">
              <div className="font-medium">🔔 Real-time</div>
              <div className="text-white/70">Live updates</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Floating Install Button untuk Mobile
export function FloatingInstallButton() {
  const { isInstallable, install } = useInstallPrompt();
  const [showButton, setShowButton] = React.useState(false);

  useEffect(() => {
    if (isInstallable) {
      const timer = setTimeout(() => setShowButton(true), 5000);
      return () => clearTimeout(timer);
    }
  }, [isInstallable]);

  const handleInstall = async () => {
    const success = await install();
    if (success) {
      setShowButton(false);
    }
  };

  if (!showButton || !isInstallable) {
    return null;
  }

  return (
    <button
      onClick={handleInstall}
      className="fixed bottom-20 right-4 z-40 bg-blue-600 text-white p-4 rounded-full shadow-lg hover:bg-blue-700 transition-all transform hover:scale-110 md:hidden"
      title="Install DeliveryPro App"
    >
      <Download className="w-5 h-5" />
      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center animate-pulse">
        !
      </span>
    </button>
  );
}
