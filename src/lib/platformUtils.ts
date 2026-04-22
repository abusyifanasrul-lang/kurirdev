import { Capacitor } from '@capacitor/core';

export const getPlatformInfo = () => {
  const isNative = Capacitor.isNativePlatform();
  const isPWA = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
  const isWeb = !isNative;
  
  return {
    isNative, // APK/IPA
    isPWA,    // Installed as PWA
    isWeb,    // Regular browser or PWA
    platform: isNative ? 'native' : (isPWA ? 'pwa' : 'web')
  };
};

export const isMobile = () => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};
