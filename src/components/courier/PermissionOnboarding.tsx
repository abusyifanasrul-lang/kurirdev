import { useState } from 'react';
import { Bell, MapPin, Camera, CheckCircle, AlertCircle, Settings } from 'lucide-react';
import { cn } from '@/utils/cn';
import { usePermissions, PermissionStatus } from '@/hooks/usePermissions';

interface PermissionOnboardingProps {
  onComplete: () => void;
}

interface PermissionItem {
  key: 'notification' | 'location' | 'camera';
  icon: typeof Bell;
  title: string;
  description: string;
  color: string;
}

const PERMISSIONS: PermissionItem[] = [
  {
    key: 'notification',
    icon: Bell,
    title: 'Notifikasi',
    description: 'Terima pemberitahuan order baru secara real-time',
    color: 'blue',
  },
  {
    key: 'location',
    icon: MapPin,
    title: 'Lokasi',
    description: 'Monitoring lokasi untuk fitur STAY di basecamp',
    color: 'emerald',
  },
  {
    key: 'camera',
    icon: Camera,
    title: 'Kamera',
    description: 'Scan QR code untuk aktivasi STAY',
    color: 'purple',
  },
];

export function PermissionOnboarding({ onComplete }: PermissionOnboardingProps) {
  const { permissions, requestAll, openSettings } = usePermissions();
  const [isRequesting, setIsRequesting] = useState(false);
  const [showSkipConfirm, setShowSkipConfirm] = useState(false);

  const allGranted = Object.values(permissions).every(p => p === 'granted');
  const anyDenied = Object.values(permissions).some(p => p === 'denied');

  const handleRequestAll = async () => {
    setIsRequesting(true);
    await requestAll();
    setIsRequesting(false);
  };

  const handleContinue = () => {
    if (allGranted || anyDenied) {
      onComplete();
    } else {
      setShowSkipConfirm(true);
    }
  };

  const getStatusColor = (status: PermissionStatus) => {
    switch (status) {
      case 'granted': return 'text-emerald-600 bg-emerald-50 border-emerald-200';
      case 'denied': return 'text-red-600 bg-red-50 border-red-200';
      default: return 'text-gray-400 bg-gray-50 border-gray-200';
    }
  };

  const getStatusIcon = (status: PermissionStatus) => {
    switch (status) {
      case 'granted': return <CheckCircle className="h-4 w-4" />;
      case 'denied': return <AlertCircle className="h-4 w-4" />;
      default: return <span className="text-xs">?</span>;
    }
  };

  const getStatusText = (status: PermissionStatus) => {
    switch (status) {
      case 'granted': return 'Diizinkan';
      case 'denied': return 'Ditolak';
      default: return 'Belum diatur';
    }
  };

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-emerald-50 via-white to-blue-50 z-[200] flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="w-20 h-20 bg-emerald-100 rounded-3xl flex items-center justify-center mx-auto border-4 border-white shadow-xl">
            <Settings className="h-10 w-10 text-emerald-600" />
          </div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">
            Izin Aplikasi
          </h1>
          <p className="text-sm text-gray-600 font-medium">
            Untuk pengalaman terbaik, aplikasi memerlukan beberapa izin berikut:
          </p>
        </div>

        {/* Permission Cards */}
        <div className="space-y-3">
          {PERMISSIONS.map((perm) => {
            const Icon = perm.icon;
            const status = permissions[perm.key];
            
            return (
              <div
                key={perm.key}
                className={cn(
                  "bg-white rounded-2xl p-4 border-2 transition-all",
                  status === 'granted' ? 'border-emerald-200 shadow-emerald-100' :
                  status === 'denied' ? 'border-red-200 shadow-red-100' :
                  'border-gray-200 shadow-sm'
                )}
              >
                <div className="flex items-start gap-4">
                  <div className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0",
                    perm.color === 'blue' ? 'bg-blue-100' :
                    perm.color === 'emerald' ? 'bg-emerald-100' :
                    'bg-purple-100'
                  )}>
                    <Icon className={cn(
                      "h-6 w-6",
                      perm.color === 'blue' ? 'text-blue-600' :
                      perm.color === 'emerald' ? 'text-emerald-600' :
                      'text-purple-600'
                    )} />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <h3 className="font-bold text-gray-900">{perm.title}</h3>
                      <span className={cn(
                        "flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold border",
                        getStatusColor(status)
                      )}>
                        {getStatusIcon(status)}
                        {getStatusText(status)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 leading-relaxed">
                      {perm.description}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Warning if any denied */}
        {anyDenied && (
          <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-4 space-y-3">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-bold text-red-900 mb-1">
                  Beberapa izin ditolak
                </p>
                <p className="text-xs text-red-700 leading-relaxed">
                  Aplikasi tidak akan berfungsi optimal. Buka pengaturan untuk mengaktifkan izin yang ditolak.
                </p>
              </div>
            </div>
            <button
              onClick={openSettings}
              className="w-full py-3 bg-red-600 text-white font-bold rounded-xl active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <Settings className="h-4 w-4" />
              Buka Pengaturan
            </button>
          </div>
        )}

        {/* Actions */}
        <div className="space-y-3">
          {!allGranted && !anyDenied && (
            <button
              onClick={handleRequestAll}
              disabled={isRequesting}
              className="w-full py-4 bg-emerald-600 text-white font-bold rounded-2xl shadow-xl shadow-emerald-200 active:scale-95 transition-all disabled:opacity-50"
            >
              {isRequesting ? 'Meminta Izin...' : 'Izinkan Semua'}
            </button>
          )}

          <button
            onClick={handleContinue}
            className={cn(
              "w-full py-4 font-bold rounded-2xl transition-all active:scale-95",
              allGranted || anyDenied
                ? "bg-emerald-600 text-white shadow-xl shadow-emerald-200"
                : "bg-gray-100 text-gray-600"
            )}
          >
            {allGranted ? 'Lanjutkan' : anyDenied ? 'Lewati untuk Sekarang' : 'Lewati'}
          </button>
        </div>

        {/* Skip Confirmation Modal */}
        {showSkipConfirm && (
          <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-6 z-10">
            <div className="bg-white rounded-3xl p-6 max-w-sm w-full space-y-4 animate-in zoom-in-95 duration-200">
              <div className="text-center">
                <div className="w-14 h-14 bg-yellow-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <AlertCircle className="h-7 w-7 text-yellow-600" />
                </div>
                <h3 className="font-black text-lg text-gray-900 mb-2">
                  Yakin ingin melewati?
                </h3>
                <p className="text-sm text-gray-600">
                  Beberapa fitur mungkin tidak berfungsi dengan baik tanpa izin yang diperlukan.
                </p>
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setShowSkipConfirm(false)}
                  className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl active:scale-95 transition-all"
                >
                  Kembali
                </button>
                <button
                  onClick={() => {
                    setShowSkipConfirm(false);
                    onComplete();
                  }}
                  className="flex-1 py-3 bg-emerald-600 text-white font-bold rounded-xl active:scale-95 transition-all"
                >
                  Lewati
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
