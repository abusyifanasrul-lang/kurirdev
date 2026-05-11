import { useState, useEffect } from 'react';
import { Bell, MapPin, Camera, CheckCircle, X } from 'lucide-react';
import { cn } from '@/utils/cn';
import { usePermissions } from '@/hooks/usePermissions';

interface PermissionOnboardingProps {
  onComplete: () => void;
}

type OnboardingStep = 'notification' | 'location' | 'camera' | 'complete';

export function PermissionOnboarding({ onComplete }: PermissionOnboardingProps) {
  const { permissions, requestNotification, requestBackgroundLocation, requestCamera, checkPermissions } = usePermissions();
  const [currentStep, setCurrentStep] = useState<OnboardingStep>('notification');
  const [isRequesting, setIsRequesting] = useState(false);

  // Re-check permissions when returning from settings
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkPermissions();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [checkPermissions]);

  const handleRequestNotification = async () => {
    setIsRequesting(true);
    await requestNotification();
    setIsRequesting(false);
    setCurrentStep('location');
  };

  const handleRequestLocation = async () => {
    setIsRequesting(true);
    await requestBackgroundLocation();
    setIsRequesting(false);
    setCurrentStep('camera');
  };

  const handleRequestCamera = async () => {
    setIsRequesting(true);
    await requestCamera();
    setIsRequesting(false);
    setCurrentStep('complete');
  };

  // Notification Step
  if (currentStep === 'notification') {
    const isGranted = permissions.notification === 'granted';

    return (
      <div className="fixed inset-0 bg-white z-[200] flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Progress Dots */}
          <div className="flex items-center justify-center gap-2">
            <div className="w-2 h-2 rounded-full bg-gray-900"></div>
            <div className="w-2 h-2 rounded-full bg-gray-200"></div>
            <div className="w-2 h-2 rounded-full bg-gray-200"></div>
          </div>

          {/* Icon & Title */}
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto border border-gray-200">
              <Bell className="h-8 w-8 text-gray-700" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Notifikasi</h1>
              {isGranted && (
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-700 text-sm font-semibold rounded-full border border-emerald-200">
                  <CheckCircle className="h-4 w-4" />
                  Diizinkan
                </div>
              )}
              {!isGranted && (
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-100 text-gray-600 text-sm font-semibold rounded-full border border-gray-200">
                  <span className="text-xs">⚠️</span>
                  Belum diizinkan
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            {!isGranted && (
              <button
                onClick={handleRequestNotification}
                disabled={isRequesting}
                className="w-full py-3.5 bg-gray-900 text-white font-semibold rounded-xl active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {isRequesting ? 'Meminta izin...' : 'Izinkan'}
              </button>
            )}
            <button
              onClick={() => setCurrentStep('location')}
              className="w-full py-3.5 bg-gray-100 text-gray-700 font-semibold rounded-xl active:scale-[0.98] transition-all"
            >
              {isGranted ? 'Lanjutkan' : 'Lewati'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Location Step
  if (currentStep === 'location') {
    const isGranted = permissions.location === 'granted';

    return (
      <div className="fixed inset-0 bg-white z-[200] flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Progress Dots */}
          <div className="flex items-center justify-center gap-2">
            <div className="w-2 h-2 rounded-full bg-gray-200"></div>
            <div className="w-2 h-2 rounded-full bg-gray-900"></div>
            <div className="w-2 h-2 rounded-full bg-gray-200"></div>
          </div>

          {/* Icon & Title */}
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto border border-gray-200">
              <MapPin className="h-8 w-8 text-gray-700" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Lokasi</h1>
              {isGranted && (
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-700 text-sm font-semibold rounded-full border border-emerald-200">
                  <CheckCircle className="h-4 w-4" />
                  Diizinkan
                </div>
              )}
              {!isGranted && (
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-100 text-gray-600 text-sm font-semibold rounded-full border border-gray-200">
                  <span className="text-xs">⚠️</span>
                  Belum diizinkan
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            {!isGranted && (
              <button
                onClick={handleRequestLocation}
                disabled={isRequesting}
                className="w-full py-3.5 bg-gray-900 text-white font-semibold rounded-xl active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {isRequesting ? 'Meminta izin...' : 'Izinkan'}
              </button>
            )}
            <button
              onClick={() => setCurrentStep('camera')}
              className="w-full py-3.5 bg-gray-100 text-gray-700 font-semibold rounded-xl active:scale-[0.98] transition-all"
            >
              {isGranted ? 'Lanjutkan' : 'Lewati'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Camera Step
  if (currentStep === 'camera') {
    const isGranted = permissions.camera === 'granted';

    return (
      <div className="fixed inset-0 bg-white z-[200] flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Progress Dots */}
          <div className="flex items-center justify-center gap-2">
            <div className="w-2 h-2 rounded-full bg-gray-200"></div>
            <div className="w-2 h-2 rounded-full bg-gray-200"></div>
            <div className="w-2 h-2 rounded-full bg-gray-900"></div>
          </div>

          {/* Icon & Title */}
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto border border-gray-200">
              <Camera className="h-8 w-8 text-gray-700" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Kamera</h1>
              {isGranted && (
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-700 text-sm font-semibold rounded-full border border-emerald-200">
                  <CheckCircle className="h-4 w-4" />
                  Diizinkan
                </div>
              )}
              {!isGranted && (
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-100 text-gray-600 text-sm font-semibold rounded-full border border-gray-200">
                  <span className="text-xs">⚠️</span>
                  Belum diizinkan
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            {!isGranted && (
              <button
                onClick={handleRequestCamera}
                disabled={isRequesting}
                className="w-full py-3.5 bg-gray-900 text-white font-semibold rounded-xl active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {isRequesting ? 'Meminta izin...' : 'Izinkan'}
              </button>
            )}
            <button
              onClick={() => setCurrentStep('complete')}
              className="w-full py-3.5 bg-gray-100 text-gray-700 font-semibold rounded-xl active:scale-[0.98] transition-all"
            >
              {isGranted ? 'Lanjutkan' : 'Lewati'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Complete Step
  if (currentStep === 'complete') {
    return (
      <div className="fixed inset-0 bg-white z-[200] flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-8 animate-in fade-in zoom-in-95 duration-500">
          {/* Icon */}
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto border border-emerald-200">
              <CheckCircle className="h-8 w-8 text-emerald-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Siap</h1>
            </div>
          </div>

          {/* Permission Summary */}
          <div className="space-y-2">
            <div className={cn(
              "flex items-center gap-3 p-3 rounded-xl border",
              permissions.notification === 'granted' 
                ? "bg-emerald-50 border-emerald-200" 
                : "bg-gray-50 border-gray-200"
            )}>
              <Bell className={cn(
                "h-5 w-5",
                permissions.notification === 'granted' ? "text-emerald-600" : "text-gray-400"
              )} />
              <span className="text-sm font-semibold text-gray-900 flex-1">Notifikasi</span>
              {permissions.notification === 'granted' ? (
                <CheckCircle className="h-5 w-5 text-emerald-600" />
              ) : (
                <X className="h-5 w-5 text-gray-400" />
              )}
            </div>

            <div className={cn(
              "flex items-center gap-3 p-3 rounded-xl border",
              permissions.location === 'granted' 
                ? "bg-emerald-50 border-emerald-200" 
                : "bg-gray-50 border-gray-200"
            )}>
              <MapPin className={cn(
                "h-5 w-5",
                permissions.location === 'granted' ? "text-emerald-600" : "text-gray-400"
              )} />
              <span className="text-sm font-semibold text-gray-900 flex-1">Lokasi</span>
              {permissions.location === 'granted' ? (
                <CheckCircle className="h-5 w-5 text-emerald-600" />
              ) : (
                <X className="h-5 w-5 text-gray-400" />
              )}
            </div>

            <div className={cn(
              "flex items-center gap-3 p-3 rounded-xl border",
              permissions.camera === 'granted' 
                ? "bg-emerald-50 border-emerald-200" 
                : "bg-gray-50 border-gray-200"
            )}>
              <Camera className={cn(
                "h-5 w-5",
                permissions.camera === 'granted' ? "text-emerald-600" : "text-gray-400"
              )} />
              <span className="text-sm font-semibold text-gray-900 flex-1">Kamera</span>
              {permissions.camera === 'granted' ? (
                <CheckCircle className="h-5 w-5 text-emerald-600" />
              ) : (
                <X className="h-5 w-5 text-gray-400" />
              )}
            </div>
          </div>

          {/* Action */}
          <button
            onClick={onComplete}
            className="w-full py-3.5 bg-gray-900 text-white font-semibold rounded-xl active:scale-[0.98] transition-all"
          >
            Mulai
          </button>
        </div>
      </div>
    );
  }

  return null;
}
