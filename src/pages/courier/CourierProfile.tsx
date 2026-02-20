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

export function CourierProfile() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { updateUser: updatePersistentUser } = useUserStore();
  const { updateUser: updateSessionUser } = useSessionStore();
  const { couriers } = useCourierStore();

  const courierData = useMemo(() =>
    couriers.find(c => c.id === user?.id),
    [couriers, user?.id]
  );

  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
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

    if (user?.password !== passwordForm.currentPassword) {
      setMessage({ type: 'error', text: 'Password saat ini salah' });
      return;
    }

    setIsLoading(true);
    await new Promise(resolve => setTimeout(resolve, 1000));

    if (user?.id) {
      updatePersistentUser(user.id, { password: passwordForm.newPassword });
      updateSessionUser({ password: passwordForm.newPassword });

      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
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
              <span className="w-2 h-2 bg-green-500 rounded-full" />
              <span className="text-xs text-green-600">Aktif</span>
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
            onClick={() => setIsChangePasswordOpen(!isChangePasswordOpen)}
            className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center">
                <Lock className="h-5 w-5 text-green-600" />
              </div>
              <div className="text-left">
                <p className="font-medium text-gray-900">Ganti Password</p>
                <p className="text-sm text-gray-500">Perbarui password akun kamu</p>
              </div>
            </div>
            <ChevronRight className={cn(
              "h-5 w-5 text-gray-400 transition-transform",
              isChangePasswordOpen && "rotate-90"
            )} />
          </button>

          {isChangePasswordOpen && (
            <div className="p-4 bg-gray-50/50 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                  Password Saat Ini
                </label>
                <input
                  type="password"
                  value={passwordForm.currentPassword}
                  onChange={(e) => {
                    setPasswordForm({ ...passwordForm, currentPassword: e.target.value });
                    if (message?.text === 'Password saat ini salah') setMessage(null);
                  }}
                  className={cn(
                    "w-full px-4 py-3 bg-white border rounded-xl focus:ring-2 transition-all",
                    message?.text === 'Password saat ini salah'
                      ? "border-red-500 focus:ring-red-200"
                      : "border-gray-200 focus:ring-green-500"
                  )}
                  placeholder="Masukkan password saat ini"
                />
                {message?.text === 'Password saat ini salah' && (
                  <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {message.text}
                  </p>
                )}
              </div>
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
                disabled={isLoading || !passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword}
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

        {/* Notifikasi Push Placeholder */}
        <div className="flex items-center justify-between p-4 opacity-50 cursor-not-allowed grayscale">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center">
              <Bell className="h-5 w-5 text-gray-400" />
            </div>
            <div className="text-left">
              <p className="font-medium text-gray-900">Notifikasi Push</p>
              <p className="text-sm text-gray-500">Segera hadir</p>
            </div>
          </div>
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
