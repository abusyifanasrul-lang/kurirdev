import { useState, useEffect } from 'react';
import { Bell, MapPin, Camera, CheckCircle, AlertCircle, ArrowRight, Clock } from 'lucide-react';
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
  const [showLocationWarning, setShowLocationWarning] = useState(false);

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
    const granted = await requestBackgroundLocation();
    setIsRequesting(false);
    
    if (granted) {
      // Show brief warning about "Allow all the time"
      setShowLocationWarning(true);
      setTimeout(() => {
        setShowLocationWarning(false);
        setCurrentStep('camera');
      }, 2500);
    }
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
      <div className="fixed inset-0 bg-gradient-to-br from-blue-50 via-white to-indigo-50 z-[200] flex items-center justify-center p-6">
        <div className="w-full max-w-md space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Progress Dots */}
          <div className="flex items-center justify-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-600"></div>
            <div className="w-2 h-2 rounded-full bg-gray-300"></div>
            <div className="w-2 h-2 rounded-full bg-gray-300"></div>
          </div>

          {/* Icon & Title */}
          <div className="text-center space-y-4">
            <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-blue-600 rounded-3xl flex items-center justify-center mx-auto shadow-2xl shadow-blue-200">
              <Bell className="h-12 w-12 text-white" />
            </div>
            <div>
              <div className="inline-block px-3 py-1 bg-blue-100 text-blue-700 text-xs font-bold rounded-full mb-2">
                Langkah 1 dari 3
              </div>
              <h1 className="text-3xl font-black text-gray-900 mb-2">
                Notifikasi Order
              </h1>
              <p className="text-gray-600 leading-relaxed">
                Terima pemberitahuan order baru secara real-time
              </p>
            </div>
          </div>

          {/* Status */}
          {isGranted && (
            <div className="bg-emerald-50 border-2 border-emerald-200 rounded-2xl p-4 flex items-center gap-3">
              <CheckCircle className="h-6 w-6 text-emerald-600 flex-shrink-0" />
              <div>
                <p className="text-sm font-bold text-emerald-900">Sudah diizinkan</p>
                <p className="text-xs text-emerald-700">Anda akan menerima notifikasi</p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="space-y-3">
            {!isGranted && (
              <button
                onClick={handleRequestNotification}
                disabled={isRequesting}
                className="w-full py-4 bg-blue-600 text-white font-bold rounded-2xl shadow-lg active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isRequesting ? 'Meminta Izin...' : 'Izinkan Notifikasi'}
                {!isRequesting && <ArrowRight className="h-5 w-5" />}
              </button>
            )}

            <button
              onClick={() => setCurrentStep('location')}
              className="w-full py-4 bg-gray-100 text-gray-700 font-bold rounded-2xl active:scale-95 transition-all"
            >
              {isGranted ? 'Lanjutkan' : 'Lewati'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Location Step (CRITICAL - with "Allow all the time" emphasis)
  if (currentStep === 'location') {
    const isGranted = permissions.location === 'granted';
    const isDenied = permissions.location === 'denied';

    return (
      <div className="fixed inset-0 bg-gradient-to-br from-amber-50 via-orange-50 to-red-50 z-[200] flex items-center justify-center p-6">
        <div className="w-full max-w-md space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Progress Dots */}
          <div className="flex items-center justify-center gap-2">
            <div className="w-2 h-2 rounded-full bg-gray-400"></div>
            <div className="w-3 h-3 rounded-full bg-amber-600"></div>
            <div className="w-2 h-2 rounded-full bg-gray-300"></div>
          </div>

          {/* Icon & Title */}
          <div className="text-center space-y-4">
            <div className="relative w-24 h-24 bg-gradient-to-br from-amber-500 to-orange-600 rounded-3xl flex items-center justify-center mx-auto shadow-2xl shadow-amber-200">
              <MapPin className="h-12 w-12 text-white" />
              <div className="absolute -top-2 -right-2 w-9 h-9 bg-red-500 rounded-full flex items-center justify-center border-4 border-white shadow-lg animate-pulse">
                <span className="text-white text-sm font-black">!</span>
              </div>
            </div>
            <div>
              <div className="inline-block px-3 py-1 bg-amber-100 text-amber-800 text-xs font-black rounded-full mb-2">
                Langkah 2 dari 3 • PENTING
              </div>
              <h1 className="text-3xl font-black text-gray-900 mb-2">
                Lokasi Background
              </h1>
              <p className="text-gray-600 leading-relaxed">
                Untuk monitoring STAY di basecamp
              </p>
            </div>
          </div>

          {/* CRITICAL: "Allow all the time" Warning */}
          <div className="bg-gradient-to-br from-amber-100 to-orange-100 border-3 border-amber-400 rounded-2xl p-5 space-y-4 shadow-lg">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center flex-shrink-0">
                <Clock className="h-6 w-6 text-white" />
              </div>
              <div className="flex-1">
                <p className="text-base font-black text-amber-900 mb-2">
                  Pilih "Izinkan sepanjang waktu"
                </p>
                <p className="text-sm text-amber-800 leading-relaxed mb-3">
                  Saat dialog muncul, pastikan pilih <span className="font-black bg-amber-200 px-1 rounded">"Izinkan sepanjang waktu"</span> atau <span className="font-black bg-amber-200 px-1 rounded">"Allow all the time"</span>
                </p>
              </div>
            </div>

            {/* Visual Guide */}
            <div className="bg-white rounded-xl p-4 space-y-2 border-2 border-amber-300">
              <div className="flex items-center gap-3 p-2 bg-emerald-50 rounded-lg border-2 border-emerald-400">
                <CheckCircle className="h-5 w-5 text-emerald-600 flex-shrink-0" />
                <span className="text-sm font-black text-emerald-800">Izinkan sepanjang waktu ✓</span>
              </div>
              <div className="flex items-center gap-3 p-2 bg-red-50 rounded-lg border-2 border-red-400 opacity-60">
                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
                <span className="text-sm font-bold text-red-800 line-through">Hanya saat menggunakan aplikasi ✗</span>
              </div>
            </div>
          </div>

          {/* Status */}
          {isGranted && (
            <div className="bg-emerald-50 border-2 border-emerald-200 rounded-2xl p-4 flex items-center gap-3">
              <CheckCircle className="h-6 w-6 text-emerald-600 flex-shrink-0" />
              <div>
                <p className="text-sm font-bold text-emerald-900">Sudah diizinkan</p>
                <p className="text-xs text-emerald-700">STAY monitoring aktif</p>
              </div>
            </div>
          )}

          {isDenied && (
            <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-4 flex items-center gap-3">
              <AlertCircle className="h-6 w-6 text-red-600 flex-shrink-0" />
              <div>
                <p className="text-sm font-bold text-red-900">Izin ditolak</p>
                <p className="text-xs text-red-700">STAY tidak akan berfungsi</p>
              </div>
            </div>
          )}

          {/* Warning Overlay */}
          {showLocationWarning && (
            <div className="fixed inset-0 bg-amber-600/95 backdrop-blur-sm flex items-center justify-center p-6 z-10 animate-in fade-in duration-300">
              <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center space-y-4 animate-in zoom-in-95 duration-300">
                <div className="w-20 h-20 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto">
                  <Clock className="h-10 w-10 text-amber-600" />
                </div>
                <div>
                  <h3 className="font-black text-xl text-gray-900 mb-2">
                    Pastikan "Sepanjang Waktu"
                  </h3>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    Jika memilih "Hanya saat menggunakan aplikasi", STAY monitoring tidak akan berfungsi
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="space-y-3">
            {!isGranted && (
              <button
                onClick={handleRequestLocation}
                disabled={isRequesting}
                className="w-full py-4 bg-gradient-to-r from-amber-600 to-orange-600 text-white font-bold rounded-2xl shadow-lg active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isRequesting ? 'Meminta Izin...' : 'Izinkan Lokasi'}
                {!isRequesting && <ArrowRight className="h-5 w-5" />}
              </button>
            )}

            {isGranted && (
              <button
                onClick={() => setCurrentStep('camera')}
                className="w-full py-4 bg-emerald-600 text-white font-bold rounded-2xl shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                Lanjutkan
                <ArrowRight className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Camera Step
  if (currentStep === 'camera') {
    const isGranted = permissions.camera === 'granted';

    return (
      <div className="fixed inset-0 bg-gradient-to-br from-purple-50 via-white to-pink-50 z-[200] flex items-center justify-center p-6">
        <div className="w-full max-w-md space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Progress Dots */}
          <div className="flex items-center justify-center gap-2">
            <div className="w-2 h-2 rounded-full bg-gray-400"></div>
            <div className="w-2 h-2 rounded-full bg-gray-400"></div>
            <div className="w-3 h-3 rounded-full bg-purple-600"></div>
          </div>

          {/* Icon & Title */}
          <div className="text-center space-y-4">
            <div className="w-24 h-24 bg-gradient-to-br from-purple-500 to-pink-600 rounded-3xl flex items-center justify-center mx-auto shadow-2xl shadow-purple-200">
              <Camera className="h-12 w-12 text-white" />
            </div>
            <div>
              <div className="inline-block px-3 py-1 bg-purple-100 text-purple-700 text-xs font-bold rounded-full mb-2">
                Langkah 3 dari 3
              </div>
              <h1 className="text-3xl font-black text-gray-900 mb-2">
                Kamera
              </h1>
              <p className="text-gray-600 leading-relaxed">
                Scan QR code untuk aktivasi STAY
              </p>
            </div>
          </div>

          {/* Status */}
          {isGranted && (
            <div className="bg-emerald-50 border-2 border-emerald-200 rounded-2xl p-4 flex items-center gap-3">
              <CheckCircle className="h-6 w-6 text-emerald-600 flex-shrink-0" />
              <div>
                <p className="text-sm font-bold text-emerald-900">Sudah diizinkan</p>
                <p className="text-xs text-emerald-700">Siap scan QR code</p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="space-y-3">
            {!isGranted && (
              <button
                onClick={handleRequestCamera}
                disabled={isRequesting}
                className="w-full py-4 bg-purple-600 text-white font-bold rounded-2xl shadow-lg active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isRequesting ? 'Meminta Izin...' : 'Izinkan Kamera'}
                {!isRequesting && <ArrowRight className="h-5 w-5" />}
              </button>
            )}

            <button
              onClick={() => setCurrentStep('complete')}
              className="w-full py-4 bg-gray-100 text-gray-700 font-bold rounded-2xl active:scale-95 transition-all"
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
    const allGranted = Object.values(permissions).every(p => p === 'granted');
    const locationGranted = permissions.location === 'granted';

    return (
      <div className="fixed inset-0 bg-gradient-to-br from-emerald-50 via-white to-blue-50 z-[200] flex items-center justify-center p-6">
        <div className="w-full max-w-md space-y-6 animate-in fade-in zoom-in-95 duration-500">
          {/* Icon */}
          <div className="text-center space-y-4">
            <div className={cn(
              "w-24 h-24 rounded-3xl flex items-center justify-center mx-auto shadow-2xl",
              allGranted ? "bg-gradient-to-br from-emerald-500 to-green-600" : "bg-gradient-to-br from-gray-400 to-gray-500"
            )}>
              <CheckCircle className="h-12 w-12 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-gray-900 mb-2">
                {allGranted ? 'Semua Siap!' : 'Setup Selesai'}
              </h1>
              <p className="text-gray-600 leading-relaxed">
                {allGranted 
                  ? 'Semua izin telah diberikan. Anda siap menggunakan aplikasi!'
                  : 'Anda dapat melanjutkan, namun beberapa fitur mungkin terbatas'
                }
              </p>
            </div>
          </div>

          {/* Permission Summary */}
          <div className="space-y-2">
            <div className={cn(
              "flex items-center gap-3 p-3 rounded-xl border-2",
              permissions.notification === 'granted' 
                ? "bg-emerald-50 border-emerald-200" 
                : "bg-gray-50 border-gray-200"
            )}>
              <Bell className={cn(
                "h-5 w-5",
                permissions.notification === 'granted' ? "text-emerald-600" : "text-gray-400"
              )} />
              <span className="text-sm font-bold text-gray-900 flex-1">Notifikasi</span>
              {permissions.notification === 'granted' ? (
                <CheckCircle className="h-5 w-5 text-emerald-600" />
              ) : (
                <AlertCircle className="h-5 w-5 text-gray-400" />
              )}
            </div>

            <div className={cn(
              "flex items-center gap-3 p-3 rounded-xl border-2",
              locationGranted 
                ? "bg-emerald-50 border-emerald-200" 
                : "bg-red-50 border-red-200"
            )}>
              <MapPin className={cn(
                "h-5 w-5",
                locationGranted ? "text-emerald-600" : "text-red-600"
              )} />
              <span className="text-sm font-bold text-gray-900 flex-1">Lokasi</span>
              {locationGranted ? (
                <CheckCircle className="h-5 w-5 text-emerald-600" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-600" />
              )}
            </div>

            <div className={cn(
              "flex items-center gap-3 p-3 rounded-xl border-2",
              permissions.camera === 'granted' 
                ? "bg-emerald-50 border-emerald-200" 
                : "bg-gray-50 border-gray-200"
            )}>
              <Camera className={cn(
                "h-5 w-5",
                permissions.camera === 'granted' ? "text-emerald-600" : "text-gray-400"
              )} />
              <span className="text-sm font-bold text-gray-900 flex-1">Kamera</span>
              {permissions.camera === 'granted' ? (
                <CheckCircle className="h-5 w-5 text-emerald-600" />
              ) : (
                <AlertCircle className="h-5 w-5 text-gray-400" />
              )}
            </div>
          </div>

          {/* Warning if location not granted */}
          {!locationGranted && (
            <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-amber-900 mb-1">
                    Lokasi belum diizinkan
                  </p>
                  <p className="text-xs text-amber-800 leading-relaxed">
                    Fitur STAY monitoring tidak akan berfungsi. Anda dapat mengaktifkannya nanti di pengaturan.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Action */}
          <button
            onClick={onComplete}
            className={cn(
              "w-full py-4 font-bold rounded-2xl shadow-lg active:scale-95 transition-all text-white",
              allGranted 
                ? "bg-gradient-to-r from-emerald-600 to-green-600" 
                : "bg-gradient-to-r from-gray-600 to-gray-700"
            )}
          >
            Mulai Menggunakan Aplikasi
          </button>
        </div>
      </div>
    );
  }

  return null;
}
