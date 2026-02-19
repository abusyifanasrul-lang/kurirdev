import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Truck, User, Users, Eye, EyeOff, Loader2, Mail, Lock } from 'lucide-react';
import { cn } from '@/utils/cn';
import { useUserStore } from '@/stores/useUserStore';
import type { User as UserType } from '@/types';
import { useSessionStore } from '@/stores/useSessionStore';

type RoleType = 'admin' | 'courier' | null;

export function Login() {
  const navigate = useNavigate();

  const [selectedRole, setSelectedRole] = useState<RoleType>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRoleSelect = (role: RoleType) => {
    setSelectedRole(role);
    setError('');
    // Pre-fill demo credentials
    if (role === 'admin') {
      setEmail('admin@delivery.com');
      setPassword('admin123');
    } else if (role === 'courier') {
      setEmail('siti@courier.com');
      setPassword('courier123');
    }
  };

  const { users } = useUserStore();
  const { login: sessionLogin } = useSessionStore();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRole) {
      setError('Please select a role first');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));

      const foundUser = users.find((u: UserType) =>
        u.email.toLowerCase().trim() === email.toLowerCase().trim() &&
        u.role === selectedRole
      );

      // 2. Validate Password (Strict matching only)
      const isValidPassword = foundUser && foundUser.password === password;

      if (foundUser && isValidPassword) {
        // 3. Establish Session (sessionStorage)
        sessionLogin(foundUser);

        // Navigate based on role
        if (selectedRole === 'admin') {
          navigate('/admin');
        } else {
          navigate('/courier');
        }
      } else {
        if (!foundUser) {
          setError(`User with this email not found as ${selectedRole}.`);
        } else {
          setError('Invalid password.');
        }
      }
    } catch (err) {
      console.error(err);
      setError('Login failed. Please try again.');
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-indigo-800 flex items-center justify-center p-4">
      {/* Background decoration - simplified for performance */}
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
          <h1 className="text-3xl font-bold text-white">DeliveryPro</h1>
          <p className="text-indigo-200 mt-2">Delivery Management System</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Role Selection View */}
          {!selectedRole && (
            <div className="p-8">
              <h2 className="text-2xl font-bold text-gray-900 text-center mb-2">
                Welcome Back
              </h2>
              <p className="text-gray-500 text-center mb-8">
                Select your role to continue
              </p>

              <div className="space-y-4">
                {/* Admin Role Card */}
                <button
                  onClick={() => handleRoleSelect('admin')}
                  className="w-full p-6 border-2 border-gray-200 rounded-xl hover:border-indigo-500 hover:bg-indigo-50 transition-all duration-200 group text-left"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-indigo-100 rounded-xl flex items-center justify-center group-hover:bg-indigo-200 transition-colors">
                      <Users className="h-7 w-7 text-indigo-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg text-gray-900">Admin</h3>
                      <p className="text-sm text-gray-500">
                        Manage orders, couriers & reports
                      </p>
                    </div>
                    <div className="w-6 h-6 border-2 border-gray-300 rounded-full group-hover:border-indigo-500 transition-colors" />
                  </div>
                </button>

                {/* Courier Role Card */}
                <button
                  onClick={() => handleRoleSelect('courier')}
                  className="w-full p-6 border-2 border-gray-200 rounded-xl hover:border-green-500 hover:bg-green-50 transition-all duration-200 group text-left"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-green-100 rounded-xl flex items-center justify-center group-hover:bg-green-200 transition-colors">
                      <User className="h-7 w-7 text-green-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg text-gray-900">Courier</h3>
                      <p className="text-sm text-gray-500">
                        View orders & update delivery status
                      </p>
                    </div>
                    <div className="w-6 h-6 border-2 border-gray-300 rounded-full group-hover:border-green-500 transition-colors" />
                  </div>
                </button>
              </div>

              {/* Demo credentials info */}
              <div className="mt-8 p-4 bg-gray-50 rounded-xl">
                <p className="text-xs text-gray-500 text-center mb-2">Demo Credentials</p>
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div className="text-center">
                    <p className="font-medium text-gray-700">Admin</p>
                    <p className="text-gray-500">admin@delivery.com</p>
                    <p className="text-gray-500">admin123</p>
                  </div>
                  <div className="text-center">
                    <p className="font-medium text-gray-700">Courier</p>
                    <p className="text-gray-500">siti@courier.com</p>
                    <p className="text-gray-500">courier123</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Login Form View */}
          {selectedRole && (
            <div>
              {/* Header with selected role */}
              <div className={cn(
                "px-8 py-6",
                selectedRole === 'admin' ? 'bg-indigo-600' : 'bg-green-600'
              )}>
                <button
                  onClick={handleBackToRoleSelection}
                  className="text-white/80 hover:text-white text-sm mb-4 flex items-center gap-1"
                >
                  ← Change role
                </button>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                    {selectedRole === 'admin' ? (
                      <Users className="h-6 w-6 text-white" />
                    ) : (
                      <User className="h-6 w-6 text-white" />
                    )}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white capitalize">
                      {selectedRole} Login
                    </h2>
                    <p className="text-white/80 text-sm">
                      {selectedRole === 'admin'
                        ? 'Access to admin dashboard'
                        : 'Access to courier app'}
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
                    Email Address
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
                      placeholder="Enter your email"
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
                      placeholder="Enter your password"
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
                    <span className="text-sm text-gray-600">Remember me</span>
                  </label>
                  <a href="#" className="text-sm text-indigo-600 hover:text-indigo-800">
                    Forgot password?
                  </a>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className={cn(
                    "w-full py-3 px-4 rounded-xl font-medium text-white transition-all duration-200 flex items-center justify-center gap-2",
                    selectedRole === 'admin'
                      ? 'bg-indigo-600 hover:bg-indigo-700'
                      : 'bg-green-600 hover:bg-green-700',
                    isLoading && 'opacity-70 cursor-not-allowed'
                  )}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    'Sign In'
                  )}
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-indigo-200 text-sm mt-8">
          © 2024 DeliveryPro. All rights reserved.
        </p>
      </div>
    </div>
  );
}
