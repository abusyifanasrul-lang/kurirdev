import { useState, useEffect } from 'react';
import {
  Truck, Eye, EyeOff, Loader2, Mail, Lock
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { supabase } from '@/lib/supabaseClient';

export function Login() {
  // const navigate = useNavigate(); // Remove if not used, but actually we might need it later? No, App.tsx handles it.

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // const { login: sessionLogin } = useSessionStore(); // No longer needed here

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

  // Removed redundant helper functions

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    setError('');
    
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Format email tidak valid.');
      return;
    }

    setIsLoading(true);

    try {
      // 1. Sign in with Supabase Auth
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase().trim(),
        password,
      });

      if (authError || !data.user) {
        throw new Error(authError?.message || 'Login failed.');
      }

      // 2. Remember Me logic
      if (rememberMe) {
        localStorage.setItem('lastLoginEmail', email);
      } else {
        localStorage.removeItem('lastLoginEmail');
      }

      // Note: We don't fetch profile or navigate manually here.
      // AuthContext.tsx listens for SIGNED_IN, fetches the profile, 
      // and App.tsx redirects the user based on the new session state.

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
    <div className="min-h-screen bg-gradient-to-br from-emerald-900 via-teal-900 to-cyan-900 flex items-center justify-center p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-emerald-500/10 rounded-full" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-cyan-500/10 rounded-full" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8 flex flex-col items-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white rounded-3xl shadow-2xl shadow-emerald-900/20 mb-4 transform hover:rotate-3 transition-transform">
            <Truck className="h-10 w-10 text-emerald-600" />
          </div>
          <h1 className="text-4xl font-black text-white tracking-tight">KurirDev</h1>
          <p className="text-emerald-200 mt-2 font-medium">Sistem Manajemen Pengiriman</p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-[2rem] shadow-2xl overflow-hidden border border-white/20">
          <div className="px-8 py-8 bg-emerald-600 text-center relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16" />
            <h2 className="text-2xl font-bold text-white mb-1 relative z-10">
              Selamat Datang
            </h2>
            <p className="text-emerald-100 text-sm relative z-10 font-medium">
              Silakan login untuk masuk ke dasbor Anda
            </p>
          </div>

          <form onSubmit={handleLogin} className="p-8 space-y-6">
            {error && (
              <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-sm font-medium animate-in fade-in zoom-in duration-300">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700 ml-1">
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
                  className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl focus-ring focus:border-emerald-600 focus:bg-white transition-all text-gray-900 placeholder:text-gray-400 min-h-[48px]"
                  placeholder="Masukkan email Anda"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700 ml-1">
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
                  className="w-full pl-12 pr-12 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl focus-ring focus:border-emerald-600 focus:bg-white transition-all text-gray-900 placeholder:text-gray-400 min-h-[48px]"
                  placeholder="Masukkan password Anda"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center touch-target"
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5 text-gray-400 hover:text-emerald-600 transition-colors" />
                  ) : (
                    <Eye className="h-5 w-5 text-gray-400 hover:text-emerald-600 transition-colors" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between ml-1">
              <label className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-5 h-5 text-emerald-600 border-gray-300 rounded-lg focus-ring"
                />
                <span className="text-sm text-gray-600 font-medium group-hover:text-gray-900 transition-colors">Ingat saya</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className={cn(
                "w-full py-4 px-6 rounded-2xl font-bold text-white transition-all duration-300 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-200 active:scale-[0.98] min-h-[52px]",
                isLoading ? 'opacity-70 cursor-not-allowed' : 'hover:shadow-emerald-300/50'
              )}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Memproses...
                </>
              ) : (
                'Masuk Sekarang'
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
