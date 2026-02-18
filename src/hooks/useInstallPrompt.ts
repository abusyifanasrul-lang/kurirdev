// Install Prompt Hook untuk Instant Delivery App Adoption
import { useState, useEffect } from 'react';

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<InstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [installDismissed, setInstallDismissed] = useState(false);

  useEffect(() => {
    // Check if already installed
    const checkInstalled = () => {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
      const isInWebAppiOS = (window.navigator as any).standalone === true;
      setIsInstalled(isStandalone || isInWebAppiOS);
    };

    // Listen for beforeinstallprompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as InstallPromptEvent);
      setIsInstallable(true);
      
      console.log('[InstallPrompt] App can be installed');
    };

    // Listen for app installed
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
      
      console.log('[InstallPrompt] App installed successfully');
      
      // Track installation
      if ('gtag' in window) {
        (window as any).gtag('event', 'pwa_installed', {
          event_category: 'PWA',
          event_label: 'delivery_app'
        });
      }
    };

    // Check if install prompt was dismissed before
    const dismissed = localStorage.getItem('install-prompt-dismissed');
    if (dismissed) {
      setInstallDismissed(true);
    }

    checkInstalled();
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const install = async () => {
    if (!deferredPrompt || !isInstallable) {
      return false;
    }

    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      console.log('[InstallPrompt] User choice:', outcome);
      
      setDeferredPrompt(null);
      setIsInstallable(false);
      
      return outcome === 'accepted';
    } catch (error) {
      console.error('[InstallPrompt] Install failed:', error);
      return false;
    }
  };

  const dismiss = () => {
    setInstallDismissed(true);
    setIsInstallable(false);
    setDeferredPrompt(null);
    localStorage.setItem('install-prompt-dismissed', 'true');
    
    console.log('[InstallPrompt] Install prompt dismissed');
  };

  const reset = () => {
    localStorage.removeItem('install-prompt-dismissed');
    setInstallDismissed(false);
  };

  return {
    isInstallable: isInstallable && !installDismissed && !isInstalled,
    isInstalled,
    canInstall: !!deferredPrompt,
    install,
    dismiss,
    reset
  };
}
