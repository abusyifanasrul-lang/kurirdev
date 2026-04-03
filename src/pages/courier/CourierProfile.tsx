import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Mail,
  Phone,
  Lock,
  LogOut,
  ChevronRight,
  CheckCircle,
  AlertCircle,
  Bell,
  User as UserIcon,
  Truck,
  Hash
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { useAuth } from '@/context/AuthContext';
import { useUserStore } from '@/stores/useUserStore';
import { useSessionStore } from '@/stores/useSessionStore';
import { useCourierStore } from '@/stores/useCourierStore';
import { supabase } from '@/lib/supabaseClient';

export function CourierProfile() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { couriers } = useCourierStore();
  const { users } = useUserStore();
  const { user: currentUser } = useSessionStore();

  // Real-time suspended check from useUserStore
  const liveUser = users.find((u: any) => u.id === currentUser?.id);
  const isSuspended = liveUser?.is_active === false;

  const courierData = useMemo(() =>
    couriers.find(c => c.id === user?.id),
    [couriers, user?.id]
  );

  const [notifPermission, setNotifPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );

  const handleRequestNotifPermission = async () => {
    if (typeof Notification === 'undefined') return;
    const result = await Notification.requestPermission();
    setNotifPermission(result);
  };

  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    newPassword: '',
    confirmPassword: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleChangePassword = async () => {
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setMessage({ type: 'error', text: 'Password tidak cocok' });
      return;
    }

    if (passwordForm.newPassword.length < 8) {
      setMessage({ type: 'error', text: 'Password minimal 8 karakter' });
      return;
    }

    setIsLoading(true);
    
    const { error } = await supabase.auth.updateUser({
      password: passwordForm.newPassword
    });

    if (error) {
      setMessage({ type: 'error', text: `Gagal memperbarui password: ${error.message}` });
    } else {
      setPasswordForm({ newPassword: '', confirmPassword: '' });
      setIsChangePasswordOpen(false);
      setMessage({ type: 'success', text: 'Password berhasil diperbarui!' });
    }

    setIsLoading(false);
    setTimeout(() => setMessage(null), 5000);
  };

  return (
    <div className="space-y-4">
      {/* Profile Card */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
            <span className="text-3xl font-bold text-green-600">
              {user?.name?.charAt(0) || 'C'}
            </span>
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">{user?.name || 'Kurir'}</h2>
            <p className="text-sm text-gray-500">Kurir</p>
            <div className="flex items-center gap-1 mt-1">
              <span className={`w-2 h-2 rounded-full ${isSuspended ? 'bg-red-500' : 'bg-green-500'}`} />
              <span className={`text-xs ${isSuspended ? 'text-red-600' : 'text-green-600'}`}>
                {isSuspended ? 'Disuspend' : 'Aktif'}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3">
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
            <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-sm">
              <UserIcon className="h-5 w-5 text-gray-400" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider font-semibold text-gray-400">Nama Lengkap</p>
              <p className="text-sm font-medium text-gray-900">{user?.name || '-'}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
            <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-sm">
              <Mail className="h-5 w-5 text-gray-400" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider font-semibold text-gray-400">Email</p>
              <p className="text-sm font-medium text-gray-900">{user?.email || '-'}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
            <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-sm">
              <Phone className="h-5 w-5 text-gray-400" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider font-semibold text-gray-400">Nomor HP</p>
              <p className="text-sm font-medium text-gray-900">{user?.phone || '-'}</p>
            </div>
          </div>

          {courierData?.vehicle_type && (
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
              <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-sm">
                <Truck className="h-5 w-5 text-gray-400" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider font-semibold text-gray-400">Tipe Kendaraan</p>
                <p className="text-sm font-medium text-gray-900 capitalize">{courierData.vehicle_type}</p>
              </div>
            </div>
          )}

          {courierData?.plate_number && (
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
              <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-sm">
                <Hash className="h-5 w-5 text-gray-400" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider font-semibold text-gray-400">Plat Nomor</p>
                <p className="text-sm font-medium text-gray-900">{courierData.plate_number}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Menu Sections */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden divide-y divide-gray-100">
        {/* Ganti Password */}
        <div className="flex flex-col">
          <button
            onClick={() => !isSuspended && setIsChangePasswordOpen(!isChangePasswordOpen)}
            disabled={isSuspended}
            className={cn(
              "w-full flex items-center justify-between p-4 transition-colors",
              isSuspended ? "opacity-50 cursor-not-allowed" : "hover:bg-gray-50"
            )}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center">
                <Lock className="h-5 w-5 text-green-600" />
              </div>
              <div className="text-left">
                <p className="font-medium text-gray-900">Ganti Password</p>
                <p className="text-sm text-gray-500">
                  {isSuspended ? "Akun sedang disuspend" : "Perbarui password akun kamu"}
                </p>
              </div>
            </div>
            <ChevronRight className={cn(
              "h-5 w-4 text-gray-400 transition-transform",
              isChangePasswordOpen && "rotate-90"
            )} />
          </button>

          {isSuspended && (
            <div className="p-4 bg-red-50 border border-red-200 text-center">
              <p className="text-red-600 font-medium">
                Akun Anda sedang disuspend.
              </p>
              <p className="text-red-400 text-sm mt-1">
                Hubungi admin untuk informasi lebih lanjut.
              </p>
            </div>
          )}

          {isChangePasswordOpen && !isSuspended && (
            <div className="p-4 bg-gray-50/50 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                  Password Baru
                </label>
                <input
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={(e) => {
                    setPasswordForm({ ...passwordForm, newPassword: e.target.value });
                    if (message?.text === 'Password minimal 8 karakter') setMessage(null);
                  }}
                  className={cn(
                    "w-full px-4 py-3 bg-white border rounded-xl focus:ring-2 transition-all",
                    message?.text === 'Password minimal 8 karakter'
                      ? "border-red-500 focus:ring-red-200"
                      : "border-gray-200 focus:ring-green-500"
                  )}
                  placeholder="Masukkan password baru"
                />
                <p className="text-[10px] text-gray-400 mt-1">Minimal 8 karakter</p>
                {message?.text === 'Password minimal 8 karakter' && (
                  <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {message.text}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                  Konfirmasi Password Baru
                </label>
                <input
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={(e) => {
                    setPasswordForm({ ...passwordForm, confirmPassword: e.target.value });
                    if (message?.text === 'Password tidak cocok') setMessage(null);
                  }}
                  className={cn(
                    "w-full px-4 py-3 bg-white border rounded-xl focus:ring-2 transition-all",
                    message?.text === 'Password tidak cocok'
                      ? "border-red-500 focus:ring-red-200"
                      : "border-gray-200 focus:ring-green-500"
                  )}
                  placeholder="Konfirmasi password baru"
                />
                {message?.text === 'Password tidak cocok' && (
                  <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {message.text}
                  </p>
                )}
              </div>
              <button
                onClick={handleChangePassword}
                disabled={isLoading || !passwordForm.newPassword || !passwordForm.confirmPassword}
                className={cn(
                  "w-full py-3 bg-green-600 text-white font-bold rounded-xl shadow-lg shadow-green-200 transition-all active:scale-95",
                  isLoading ? "opacity-70 cursor-not-allowed" : "hover:bg-green-700"
                )}
              >
                {isLoading ? 'Memperbarui...' : 'Simpan Password Baru'}
              </button>

              {message?.type === 'success' && (
                <div className="flex items-center gap-2 px-4 py-3 bg-green-50 border border-green-200 text-green-700 text-sm font-medium rounded-xl">
                  <CheckCircle className="h-4 w-4 flex-shrink-0" />
                  {message.text}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Notifikasi Push — Status */}
        <div className="flex flex-col">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                notifPermission === 'granted' ? 'bg-green-50' :
                notifPermission === 'denied' ? 'bg-red-50' : 'bg-yellow-50'
              }`}>
                <Bell className={`h-5 w-5 ${
                  notifPermission === 'granted' ? 'text-green-600' :
                  notifPermission === 'denied' ? 'text-red-500' : 'text-yellow-500'
                }`} />
              </div>
              <div className="text-left">
                <p className="font-medium text-gray-900">Notifikasi Order</p>
                <p className={`text-sm font-medium ${
                  notifPermission === 'granted' ? 'text-green-600' :
                  notifPermission === 'denied' ? 'text-red-500' : 'text-yellow-500'
                }`}>
                  {notifPermission === 'granted' ? '✅ Diizinkan' :
                   notifPermission === 'denied' ? '❌ Diblokir' : '⚠️ Belum diizinkan'}
                </p>
              </div>
            </div>
            {notifPermission === 'default' && (
              <button
                onClick={handleRequestNotifPermission}
                className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-full hover:bg-indigo-100"
              >
                Izinkan
              </button>
            )}
          </div>

          {/* Warning jika diblokir */}
          {notifPermission === 'denied' && (
            <div className="mx-4 mb-4 p-3 bg-red-50 border border-red-200 rounded-xl space-y-2">
              <p className="text-sm font-semibold text-red-700">
                ⚠️ Notifikasi order diblokir!
              </p>
              <p className="text-xs text-red-600">
                Kamu tidak akan mendapat notifikasi saat ada order baru. Aktifkan notifikasi dengan langkah berikut:
              </p>
              <div className="text-xs text-red-700 space-y-1 bg-white rounded-lg p-2 border border-red-100">
                <p className="font-semibold mb-1">Di Chrome Android:</p>
                <p>1. Ketuk ikon 🔒 di address bar browser</p>
                <p>2. Ketuk "Izin situs"</p>
                <p>3. Aktifkan <span className="font-semibold">Notifikasi</span></p>
                <p className="font-semibold mt-2 mb-1">Atau via Pengaturan HP:</p>
                <p>1. Buka <span className="font-semibold">Pengaturan</span> HP</p>
                <p>2. Cari & ketuk <span className="font-semibold">Aplikasi → Chrome</span></p>
                <p>3. Ketuk <span className="font-semibold">Notifikasi</span> → Aktifkan</p>
              </div>
              <p className="text-xs text-red-500 italic">
                Setelah mengaktifkan, muat ulang halaman ini.
              </p>
            </div>
          )}

          {/* Info jika belum diputuskan */}
          {notifPermission === 'default' && (
            <div className="mx-4 mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-xl">
              <p className="text-xs text-yellow-700">
                Izinkan notifikasi agar kamu bisa menerima order baru secara real-time.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Logout Button */}
      <button
        onClick={handleLogout}
        className="w-full flex items-center justify-center gap-2 p-4 bg-red-50 text-red-600 font-bold rounded-2xl hover:bg-red-100 transition-all active:scale-95 border border-red-100"
      >
        <LogOut className="h-5 w-5" />
        Keluar
      </button>

      {/* App Version */}
      <p className="text-center text-[10px] uppercase tracking-widest text-gray-400 font-bold">
        Kurir System v1.1.0
      </p>
    </div>
  );
}
