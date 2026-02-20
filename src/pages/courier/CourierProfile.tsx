import { useState } from 'react';
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
  Truck,
  Hash,
  Percent
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { useAuth } from '@/context/AuthContext';
import { useUserStore } from '@/stores/useUserStore';
import { useSessionStore } from '@/stores/useSessionStore';
import type { Courier } from '@/types';

export function CourierProfile() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const courier = user as Courier;
  const { updateUser: updatePersistentUser } = useUserStore();
  const { updateUser: updateSessionUser } = useSessionStore();

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
    <div className="space-y-4 max-w-md mx-auto pb-8">
      {/* Profile Card */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
            <span className="text-2xl font-bold text-green-600">
              {user?.name?.charAt(0) || 'C'}
            </span>
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">{user?.name || 'Kurir'}</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="px-2 py-0.5 bg-green-50 text-green-600 text-[10px] font-bold uppercase rounded-full border border-green-100 flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                Aktif
              </span>
              <span className="text-xs text-gray-400 font-medium">Mitra Kurir</span>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-3 p-3 bg-gray-50/50 rounded-xl border border-gray-100">
            <Mail className="h-4 w-4 text-gray-400" />
            <div className="flex-1">
              <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400">Email</p>
              <p className="text-sm font-medium text-gray-900 leading-tight">{user?.email || '-'}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 bg-gray-50/50 rounded-xl border border-gray-100">
            <Phone className="h-4 w-4 text-gray-400" />
            <div className="flex-1">
              <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400">Nomor HP</p>
              <p className="text-sm font-medium text-gray-900 leading-tight">{user?.phone || '-'}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {courier?.vehicle_type && (
              <div className="flex items-center gap-3 p-3 bg-gray-50/50 rounded-xl border border-gray-100">
                <Truck className="h-4 w-4 text-gray-400" />
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400 truncate">Kendaraan</p>
                  <p className="text-sm font-medium text-gray-900 leading-tight capitalize">{courier.vehicle_type}</p>
                </div>
              </div>
            )}
            {courier?.plate_number && (
              <div className="flex items-center gap-3 p-3 bg-gray-50/50 rounded-xl border border-gray-100">
                <Hash className="h-4 w-4 text-gray-400" />
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400 truncate">Plat Nomor</p>
                  <p className="text-sm font-medium text-gray-900 leading-tight uppercase">{courier.plate_number}</p>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 p-3 bg-green-50/30 rounded-xl border border-green-100/50">
            <Percent className="h-4 w-4 text-green-600" />
            <div className="flex-1">
              <p className="text-[10px] uppercase tracking-wider font-bold text-green-600/70">Commission Rate</p>
              <p className="text-sm font-bold text-green-700 leading-tight">
                {courier?.commission_rate ?? 80}% <span className="text-[10px] font-normal text-green-600/60 ml-1">Penghasilan Anda</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Menu Sections */}
      <div className="space-y-3">
        {/* Profile Settings */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {/* Ganti Password */}
          <button
            onClick={() => setIsChangePasswordOpen(!isChangePasswordOpen)}
            className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center">
                <Lock className="h-5 w-5 text-gray-600" />
              </div>
              <div className="text-left">
                <p className="font-medium text-gray-900">Ganti Password</p>
                <p className="text-xs text-gray-500">Perbarui password akun Anda</p>
              </div>
            </div>
            <ChevronRight className={cn(
              "h-5 w-5 text-gray-400 transition-transform",
              isChangePasswordOpen && "rotate-90"
            )} />
          </button>

          {isChangePasswordOpen && (
            <div className="p-4 bg-gray-50/50 border-t border-gray-100 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 ml-1">
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
                      : "border-gray-200 focus:ring-green-500/20 focus:border-green-500"
                  )}
                  placeholder="Password lama"
                />
                {message?.text === 'Password saat ini salah' && (
                  <p className="text-xs text-red-600 mt-1.5 ml-1 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {message.text}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 ml-1">
                    Password Baru
                  </label>
                  <input
                    type="password"
                    value={passwordForm.newPassword}
                    onChange={(e) => {
                      setPasswordForm({ ...passwordForm, newPassword: e.target.value });
                    }}
                    className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all"
                    placeholder="Minimal 8 karakter"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 ml-1">
                    Konfirmasi Password Baru
                  </label>
                  <input
                    type="password"
                    value={passwordForm.confirmPassword}
                    onChange={(e) => {
                      setPasswordForm({ ...passwordForm, confirmPassword: e.target.value });
                    }}
                    className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all"
                    placeholder="Ulangi password baru"
                  />
                </div>
              </div>

              {message?.type === 'error' && message.text !== 'Password saat ini salah' && (
                <p className="text-xs text-red-600 ml-1 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {message.text}
                </p>
              )}

              <button
                onClick={handleChangePassword}
                disabled={isLoading || !passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword}
                className={cn(
                  "w-full py-3 bg-green-600 text-white font-bold rounded-xl shadow-lg shadow-green-600/20 transition-all",
                  isLoading ? "opacity-70 cursor-not-allowed" : "hover:bg-green-700 active:scale-[0.98]"
                )}
              >
                {isLoading ? 'Memperbarui...' : 'Simpan Password Baru'}
              </button>
            </div>
          )}

          <div className="border-t border-gray-100">
            {/* Notifikasi Push Placeholder */}
            <div className="w-full flex items-center justify-between p-4 opacity-50 cursor-not-allowed">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center">
                  <Bell className="h-5 w-5 text-gray-400" />
                </div>
                <div className="text-left">
                  <p className="font-medium text-gray-900">Notifikasi Push</p>
                  <p className="text-xs text-gray-500">Segera hadir</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 p-4 bg-red-50 text-red-600 font-bold rounded-2xl hover:bg-red-100 transition-all active:scale-[0.98] border border-red-100"
        >
          <LogOut className="h-5 w-5" />
          Keluar dari Akun
        </button>
      </div>

      {/* App Version */}
      <div className="pt-4 text-center">
        <p className="text-[10px] font-bold text-gray-300 uppercase tracking-[0.2em]">
          KurirDev Mobile v1.0.0
        </p>
      </div>

      {/* Persistence Success Message */}
      {message?.type === 'success' && (
        <div className="fixed bottom-24 left-4 right-4 animate-in fade-in slide-in-from-bottom-4">
          <div className="flex items-center gap-2 px-4 py-3 bg-green-600 text-white text-sm font-bold rounded-xl shadow-xl">
            <CheckCircle className="h-5 w-5 flex-shrink-0" />
            {message.text}
          </div>
        </div>
      )}
    </div>
  );
}
