import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Truck, User, Eye, EyeOff, Loader2, Mail, Lock,
  Package, Crown, DollarSign
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { useUserStore } from '@/stores/useUserStore';
import type { User as UserType, UserRole } from '@/types';
import { useSessionStore } from '@/stores/useSessionStore';
import { requestFCMPermission } from '@/lib/fcm';
import { auth, db } from '@/lib/firebase';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';

type RoleType = UserRole | null;

interface RoleOption {
  id: UserRole;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  hoverColor: string;
  iconBg: string;
  iconColor: string;
  headerBg: string;
}

const roleOptions: RoleOption[] = [
  {
    id: 'admin_kurir',
    label: 'Admin Kurir',
    description: 'Kelola order & assign kurir',
    icon: Package,
    color: 'indigo',
    hoverColor: 'hover:border-indigo-500 hover:bg-indigo-50',
    iconBg: 'bg-indigo-100 group-hover:bg-indigo-200',
    iconColor: 'text-indigo-600',
    headerBg: 'bg-indigo-600',
  },
  {
    id: 'owner',
    label: 'Owner',
    description: 'Pantau bisnis secara keseluruhan',
    icon: Crown,
    color: 'emerald',
    hoverColor: 'hover:border-emerald-500 hover:bg-emerald-50',
    iconBg: 'bg-emerald-100 group-hover:bg-emerald-200',
    iconColor: 'text-emerald-600',
    headerBg: 'bg-emerald-600',
  },
  {
    id: 'finance',
    label: 'Keuangan',
    description: 'Setoran, penagihan & analisa fiskal',
    icon: DollarSign,
    color: 'amber',
    hoverColor: 'hover:border-amber-500 hover:bg-amber-50',
    iconBg: 'bg-amber-100 group-hover:bg-amber-200',
    iconColor: 'text-amber-600',
    headerBg: 'bg-amber-600',
  },
  {
    id: 'courier',
    label: 'Kurir',
    description: 'Lihat order & update status pengiriman',
    icon: User,
    color: 'green',
    hoverColor: 'hover:border-green-500 hover:bg-green-50',
    iconBg: 'bg-green-100 group-hover:bg-green-200',
    iconColor: 'text-green-600',
    headerBg: 'bg-green-600',
  },
];

function getRoleOption(role: RoleType): RoleOption | undefined {
  return roleOptions.find(r => r.id === role);
}

export function Login() {
  const navigate = useNavigate();

  const [selectedRole, setSelectedRole] = useState<RoleType>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [showForgotInfo, setShowForgotInfo] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRoleSelect = (role: RoleType) => {
    setSelectedRole(role);
    setError('');

    // Load saved email for selected role
    const saved = localStorage.getItem(`lastLoginEmail_${role}`);
    if (saved) {
      setEmail(saved);
      setRememberMe(true);
    } else {
      setEmail('');
      setRememberMe(false);
    }
  };

  useUserStore();
  const { login: sessionLogin } = useSessionStore();

  // Clean up old non-role-aware key
  useEffect(() => {
    localStorage.removeItem('lastLoginEmail');
  }, []);

  const getRedirectPath = (role: UserRole): string => {
    if (role === 'courier') return '/courier';
    if (role === 'finance') return '/admin/finance';
    if (role === 'owner') return '/admin/overview';
    return '/admin/dashboard'; // admin_kurir, admin
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRole) {
      setError('Pilih role terlebih dahulu');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // 1. Sign in with Firebase Auth
      const userCredential = await signInWithEmailAndPassword(auth, email.toLowerCase().trim(), password);
      const firebaseUser = userCredential.user;

      // 2. Double check role in Firestore
      const q = query(
        collection(db, 'users'),
        where('email', '==', firebaseUser.email),
        limit(1)
      );
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        throw new Error('User data not found in database.');
      }

      const userData = querySnapshot.docs[0].data() as UserType;

      // 3. Validate Role Choice
      const isRoleValid = (selectedRole === 'admin_kurir') 
        ? (userData.role === 'admin_kurir' || userData.role === 'admin')
        : (userData.role === selectedRole);

      if (!isRoleValid) {
        await signOut(auth);
        setError(`Email ini tidak terdaftar sebagai ${getRoleOption(selectedRole)?.label}.`);
        return;
      }

      // 4. Establish Session (Zustand)
      sessionLogin(userData);

      // 5. Remember Me logic
      if (rememberMe) {
        localStorage.setItem(`lastLoginEmail_${selectedRole}`, email);
      } else {
        localStorage.removeItem(`lastLoginEmail_${selectedRole}`);
      }

      // 6. Request FCM permission for couriers
      if (selectedRole === 'courier') {
        requestFCMPermission(userData.id);
      }

      // 7. Navigate based on role
      navigate(getRedirectPath(userData.role));

    } catch (err: any) {
      console.error('Login error:', err);
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('Email atau password salah.');
      } else {
        setError(err.message || 'Login gagal. Silakan coba lagi.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToRoleSelection = () => {
    setSelectedRole(null);
    setEmail('');
    setPassword('');
    setError('');
  };

  const currentRole = getRoleOption(selectedRole);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-indigo-800 flex items-center justify-center p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500/10 rounded-full" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-indigo-500/10 rounded-full" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white rounded-2xl shadow-xl mb-4">
            <Truck className="h-10 w-10 text-indigo-600" />
          </div>
          <h1 className="text-3xl font-bold text-white">KurirDev</h1>
          <p className="text-indigo-200 mt-2">Sistem Manajemen Pengiriman</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Role Selection View */}
          {!selectedRole && (
            <div className="p-8">
              <h2 className="text-2xl font-bold text-gray-900 text-center mb-2">
                Selamat Datang
              </h2>
              <p className="text-gray-500 text-center mb-8">
                Pilih role Anda untuk melanjutkan
              </p>

              <div className="space-y-3">
                {roleOptions.map((role) => (
                  <button
                    key={role.id}
                    onClick={() => handleRoleSelect(role.id)}
                    className={cn(
                      "w-full p-4 border-2 border-gray-200 rounded-xl transition-all duration-200 group text-left",
                      role.hoverColor
                    )}
                  >
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        "w-12 h-12 rounded-xl flex items-center justify-center transition-colors",
                        role.iconBg
                      )}>
                        <role.icon className={cn("h-6 w-6", role.iconColor)} />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900">{role.label}</h3>
                        <p className="text-xs text-gray-500">{role.description}</p>
                      </div>
                      <div className="w-5 h-5 border-2 border-gray-300 rounded-full group-hover:border-current transition-colors" />
                    </div>
                  </button>
                ))}
              </div>

              {/* Demo credentials info */}
              <div className="mt-6 p-4 bg-gray-50 rounded-xl">
                <p className="text-xs text-gray-500 text-center mb-3 font-medium">Demo Credentials</p>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="text-center p-2 bg-white rounded-lg">
                    <p className="font-medium text-indigo-600">Admin Kurir</p>
                    <p className="text-gray-400 mt-1">admin@delivery.com</p>
                    <p className="text-gray-400">admin123</p>
                  </div>
                  <div className="text-center p-2 bg-white rounded-lg">
                    <p className="font-medium text-emerald-600">Owner</p>
                    <p className="text-gray-400 mt-1">owner@delivery.com</p>
                    <p className="text-gray-400">owner123</p>
                  </div>
                  <div className="text-center p-2 bg-white rounded-lg">
                    <p className="font-medium text-amber-600">Keuangan</p>
                    <p className="text-gray-400 mt-1">finance@delivery.com</p>
                    <p className="text-gray-400">finance123</p>
                  </div>
                  <div className="text-center p-2 bg-white rounded-lg">
                    <p className="font-medium text-green-600">Kurir</p>
                    <p className="text-gray-400 mt-1">siti@courier.com</p>
                    <p className="text-gray-400">courier123</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Login Form View */}
          {selectedRole && currentRole && (
            <div>
              {/* Header with selected role */}
              <div className={cn("px-8 py-6", currentRole.headerBg)}>
                <button
                  onClick={handleBackToRoleSelection}
                  className="text-white/80 hover:text-white text-sm mb-4 flex items-center gap-1"
                >
                  Kembali
                </button>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                    <currentRole.icon className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">
                      Login {currentRole.label}
                    </h2>
                    <p className="text-white/80 text-sm">
                      {currentRole.description}
                    </p>
                  </div>
                </div>
              </div>

              {/* Form */}
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
                      className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
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
                      className="w-full pl-12 pr-12 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
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
                      className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                    />
                    <span className="text-sm text-gray-600">Ingat saya</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowForgotInfo(!showForgotInfo)}
                    className="text-sm text-indigo-600 hover:underline"
                  >
                    Lupa password?
                  </button>
                </div>
                {showForgotInfo && (
                  <p className="text-xs text-gray-500 text-center mt-1">
                    Hubungi admin untuk mereset password Anda.
                  </p>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className={cn(
                    "w-full py-3 px-4 rounded-xl font-medium text-white transition-all duration-200 flex items-center justify-center gap-2",
                    currentRole.headerBg,
                    "hover:opacity-90",
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
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-indigo-200 text-sm mt-8">
          KurirDev v1.0
        </p>
      </div>
    </div>
  );
}
