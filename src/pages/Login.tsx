import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Truck, Eye, EyeOff, Loader2, Mail, Lock
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { useUserStore } from '@/stores/useUserStore';
import type { User as UserType, UserRole } from '@/types';
import { useSessionStore } from '@/stores/useSessionStore';
import { requestFCMPermission } from '@/lib/fcm';
import { supabase } from '@/lib/supabaseClient';

export function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useUserStore();
  const { login: sessionLogin } = useSessionStore();

  useEffect(() => {
    // Clean up old role-aware keys
    ['admin', 'admin_kurir', 'finance', 'owner', 'courier'].forEach(r => {
      localStorage.removeItem(`lastLoginEmail_${r}`);
    });

    // Load generic saved email
    const saved = localStorage.getItem('lastLoginEmail');
    if (saved) {
      setEmail(saved);
      setRememberMe(true);
    }
  }, []);

  const getRedirectPath = (role: UserRole): string => {
    if (role === 'courier') return '/courier';
    if (role === 'finance') return '/admin/finance';
    if (role === 'owner') return '/admin/overview';
    if (role === 'admin') return '/admin/diagnostics';
    return '/admin/dashboard'; // admin_kurir
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    setIsLoading(true);
    setError('');

    try {
      // 1. Sign in with Supabase Auth
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase().trim(),
        password,
      });

      if (authError || !data.user) {
        throw new Error(authError?.message || 'Login failed.');
      }

      const supabaseUser = data.user;

      // 2. Fetch user data from Supabase profiles
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', supabaseUser.id)
        .single() as { data: any, error: any };

      if (profileError || !profile) {
        throw new Error('Data pengguna tidak ditemukan di database.');
      }

      if (profile.is_active === false) {
        throw new Error('Akun Anda telah dinonaktifkan. Silakan hubungi admin.');
      }

      const userData: UserType = {
          id: profile.id,
          name: profile.name,
          email: supabaseUser.email || '',
          role: profile.role as UserRole,
          phone: profile.phone || undefined,
          is_active: profile.is_active ?? true,
          fcm_token: profile.fcm_token || undefined,
          is_online: profile.is_online,
          created_at: profile.created_at || new Date().toISOString(),
          updated_at: profile.updated_at || new Date().toISOString(),
          total_deliveries_alltime: profile.total_deliveries_alltime,
          total_earnings_alltime: profile.total_earnings_alltime,
          unpaid_count: profile.unpaid_count,
          unpaid_amount: profile.unpaid_amount,
      };

      // 3. Establish Session (Zustand)
      sessionLogin(userData);

      // 4. Remember Me logic
      if (rememberMe) {
        localStorage.setItem('lastLoginEmail', email);
      } else {
        localStorage.removeItem('lastLoginEmail');
      }

      // 5. Request FCM permission for couriers
      if (userData.role === 'courier') {
        requestFCMPermission(userData.id);
      }

      // 6. Navigate based on role automatically
      navigate(getRedirectPath(userData.role));

    } catch (err: any) {
      console.error('Login error:', err);
      if (err.message?.includes('Invalid login') || err.message?.includes('credentials')) {
        setError('Email atau password salah.');
      } else {
        setError(err.message || 'Login gagal. Silakan coba lagi.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-900 via-cyan-900 to-emerald-900 flex items-center justify-center p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-teal-500/10 rounded-full" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-cyan-500/10 rounded-full" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white rounded-2xl shadow-xl mb-4">
            <Truck className="h-10 w-10 text-teal-600" />
          </div>
          <h1 className="text-3xl font-bold text-white">KurirDev</h1>
          <p className="text-teal-200 mt-2">Sistem Manajemen Pengiriman</p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div className="px-8 py-6 bg-teal-600 text-center">
            <h2 className="text-2xl font-bold text-white mb-1">
              Selamat Datang
            </h2>
            <p className="text-teal-100 text-sm">
              Silakan login untuk masuk ke dasbor Anda
            </p>
          </div>

          <form onSubmit={handleLogin} className="p-8 space-y-5">
            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-colors"
                  placeholder="Masukkan email Anda"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-12 pr-12 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-colors"
                  placeholder="Masukkan password Anda"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center"
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                  ) : (
                    <Eye className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 text-teal-600 border-gray-300 rounded focus:ring-teal-500"
                />
                <span className="text-sm text-gray-600">Ingat saya</span>
              </label>
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className={cn(
                "w-full py-3 px-4 rounded-xl font-medium text-white transition-all duration-200 flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700",
                isLoading && 'opacity-70 cursor-not-allowed'
              )}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Masuk...
                </>
              ) : (
                'Masuk'
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-teal-200 text-sm mt-8">
          KurirDev v1.0
        </p>
      </div>
    </div>
  );
}
