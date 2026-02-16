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

export function CourierProfile() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
    localStorage.removeItem('user_role');
    navigate('/');
  };

  const handleChangePassword = async () => {
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match!' });
      return;
    }

    if (passwordForm.newPassword.length < 8) {
      setMessage({ type: 'error', text: 'Password must be at least 8 characters!' });
      return;
    }

    setIsLoading(true);
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    setIsChangePasswordOpen(false);
    setMessage({ type: 'success', text: 'Password changed successfully!' });
    setIsLoading(false);

    setTimeout(() => setMessage(null), 3000);
  };

  const menuItems = [
    {
      icon: Bell,
      label: 'Notifications',
      description: 'Manage push notifications',
      onClick: () => {},
    },
    {
      icon: Shield,
      label: 'Privacy & Security',
      description: 'Account security settings',
      onClick: () => {},
    },
    {
      icon: HelpCircle,
      label: 'Help & Support',
      description: 'Get help or report issues',
      onClick: () => {},
    },
  ];

  return (
    <div className="space-y-4">
      {/* Message */}
      {message && (
        <div
          className={cn(
            "p-4 rounded-xl flex items-center gap-3",
            message.type === 'success'
              ? 'bg-green-50 border border-green-200 text-green-700'
              : 'bg-red-50 border border-red-200 text-red-700'
          )}
        >
          {message.type === 'success' ? (
            <CheckCircle className="h-5 w-5 flex-shrink-0" />
          ) : (
            <AlertCircle className="h-5 w-5 flex-shrink-0" />
          )}
          {message.text}
        </div>
      )}

      {/* Profile Card */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
            <span className="text-3xl font-bold text-green-600">
              {user.name?.charAt(0) || 'C'}
            </span>
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">{user.name || 'Courier'}</h2>
            <p className="text-sm text-gray-500">Courier</p>
            <div className="flex items-center gap-1 mt-1">
              <span className="w-2 h-2 bg-green-500 rounded-full" />
              <span className="text-xs text-green-600">Active</span>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
            <Mail className="h-5 w-5 text-gray-400" />
            <div>
              <p className="text-xs text-gray-500">Email</p>
              <p className="text-sm font-medium text-gray-900">{user.email || 'courier@delivery.com'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
            <Phone className="h-5 w-5 text-gray-400" />
            <div>
              <p className="text-xs text-gray-500">Phone</p>
              <p className="text-sm font-medium text-gray-900">{user.phone || '+62812345678'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Change Password */}
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
              <p className="font-medium text-gray-900">Change Password</p>
              <p className="text-sm text-gray-500">Update your password</p>
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
                Current Password
              </label>
              <input
                type="password"
                value={passwordForm.currentPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500"
                placeholder="Enter current password"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                New Password
              </label>
              <input
                type="password"
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500"
                placeholder="Enter new password"
              />
              <p className="text-xs text-gray-500 mt-1">Min 8 characters</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Confirm New Password
              </label>
              <input
                type="password"
                value={passwordForm.confirmPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500"
                placeholder="Confirm new password"
              />
            </div>
            <button
              onClick={handleChangePassword}
              disabled={isLoading || !passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword}
              className={cn(
                "w-full py-3 bg-green-600 text-white font-medium rounded-xl transition-colors",
                isLoading ? "opacity-70 cursor-not-allowed" : "hover:bg-green-700"
              )}
            >
              {isLoading ? 'Updating...' : 'Update Password'}
            </button>
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
        Sign Out
      </button>

      {/* App Version */}
      <p className="text-center text-sm text-gray-400">
        DeliveryPro Courier v1.0.0
      </p>
    </div>
  );
}
