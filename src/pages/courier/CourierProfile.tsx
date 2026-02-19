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
  Shield,
  Bell,
  HelpCircle
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { useAuth } from '@/context/AuthContext';
import { useUserStore } from '@/stores/useUserStore';
import { useSessionStore } from '@/stores/useSessionStore';

export function CourierProfile() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
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
    // 1. Validasi Password Baru & Konfirmasi
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setMessage({ type: 'error', text: 'Password tidak cocok' });
      return;
    }

    if (passwordForm.newPassword.length < 8) {
      setMessage({ type: 'error', text: 'Password minimal 8 karakter' });
      return;
    }

    // 2. Validasi Password Saat Ini
    if (user?.password !== passwordForm.currentPassword) {
      setMessage({ type: 'error', text: 'Password saat ini salah' });
      return;
    }

    setIsLoading(true);
    // Simulasi delay sedikit untuk UX
    await new Promise(resolve => setTimeout(resolve, 1000));

    if (user?.id) {
      // 3. Update useUserStore - Simpan ke localStorage (Permanen)
      updatePersistentUser(user.id, { password: passwordForm.newPassword });

      // 4. Update useSessionStore - Update sesi tab aktif
      updateSessionUser({ password: passwordForm.newPassword });

      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setIsChangePasswordOpen(false);
      setMessage({ type: 'success', text: 'Password berhasil diperbarui!' });
    }

    setIsLoading(false);
    setTimeout(() => setMessage(null), 3000);
  };

  const menuItems = [
    {
      icon: Bell,
      label: 'Notifikasi',
      description: 'Kelola notifikasi push',
      onClick: () => { },
    },
    {
      icon: Shield,
      label: 'Privasi & Keamanan',
      description: 'Pengaturan keamanan akun',
      onClick: () => { },
    },
    {
      icon: HelpCircle,
      label: 'Bantuan & Dukungan',
      description: 'Dapatkan bantuan atau laporkan masalah',
      onClick: () => { },
    },
  ];

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

        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
            <Mail className="h-5 w-5 text-gray-400" />
            <div>
              <p className="text-xs text-gray-500">Email</p>
              <p className="text-sm font-medium text-gray-900">{user?.email || '-'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
            <Phone className="h-5 w-5 text-gray-400" />
            <div>
              <p className="text-xs text-gray-500">Telepon</p>
              <p className="text-sm font-medium text-gray-900">{user?.phone || '-'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Ganti Password */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
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
              <p className="text-sm text-gray-500">Perbarui password kamu</p>
            </div>
          </div>
          <ChevronRight className={cn(
            "h-5 w-5 text-gray-400 transition-transform",
            isChangePasswordOpen && "rotate-90"
          )} />
        </button>

        {isChangePasswordOpen && (
          <div className="p-4 border-t border-gray-100 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
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
                  "w-full px-4 py-3 border rounded-xl focus:ring-2",
                  message?.text === 'Password saat ini salah'
                    ? "border-red-500 focus:ring-red-200"
                    : "border-gray-300 focus:ring-green-500"
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
              <label className="block text-sm font-medium text-gray-700 mb-1">
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
                  "w-full px-4 py-3 border rounded-xl focus:ring-2",
                  message?.text === 'Password minimal 8 karakter'
                    ? "border-red-500 focus:ring-red-200"
                    : "border-gray-300 focus:ring-green-500"
                )}
                placeholder="Masukkan password baru"
              />
              <p className="text-xs text-gray-500 mt-1">Minimal 8 karakter</p>
              {message?.text === 'Password minimal 8 karakter' && (
                <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {message.text}
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
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
                  "w-full px-4 py-3 border rounded-xl focus:ring-2",
                  message?.text === 'Password tidak cocok'
                    ? "border-red-500 focus:ring-red-200"
                    : "border-gray-300 focus:ring-green-500"
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
                "w-full py-3 bg-green-600 text-white font-medium rounded-xl transition-colors",
                isLoading ? "opacity-70 cursor-not-allowed" : "hover:bg-green-700"
              )}
            >
              {isLoading ? 'Memperbarui...' : 'Perbarui Password'}
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

      {/* Menu Items */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {menuItems.map((item, index) => (
          <button
            key={item.label}
            onClick={item.onClick}
            className={cn(
              "w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors",
              index < menuItems.length - 1 && "border-b border-gray-100"
            )}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center">
                <item.icon className="h-5 w-5 text-gray-600" />
              </div>
              <div className="text-left">
                <p className="font-medium text-gray-900">{item.label}</p>
                <p className="text-sm text-gray-500">{item.description}</p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-gray-400" />
          </button>
        ))}
      </div>

      {/* Logout Button */}
      <button
        onClick={handleLogout}
        className="w-full flex items-center justify-center gap-2 p-4 bg-red-50 text-red-600 font-medium rounded-2xl hover:bg-red-100 transition-colors"
      >
        <LogOut className="h-5 w-5" />
        Keluar
      </button>

      {/* App Version */}
      <p className="text-center text-sm text-gray-400">
        DeliveryPro Courier v1.0.0
      </p>
    </div>
  );
}
