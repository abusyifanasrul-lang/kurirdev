import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { Home, Package, History, DollarSign, User, LogOut } from 'lucide-react';
import { cn } from '@/utils/cn';

export function CourierLayout() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
    localStorage.removeItem('user_role');
    navigate('/');
  };

  const navItems = [
    { path: '/courier', icon: Home, label: 'Home', end: true },
    { path: '/courier/orders', icon: Package, label: 'Orders' },
    { path: '/courier/history', icon: History, label: 'History' },
    { path: '/courier/earnings', icon: DollarSign, label: 'Earnings' },
    { path: '/courier/profile', icon: User, label: 'Profile' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <header className="bg-green-600 text-white px-4 py-4 sticky top-0 z-40">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
              <span className="text-lg font-bold">{user.name?.charAt(0) || 'C'}</span>
            </div>
            <div>
              <p className="font-semibold">{user.name || 'Courier'}</p>
              <p className="text-xs text-green-100">Courier App</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-4 py-6">
        <Outlet />
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-2 py-2 z-50">
        <div className="flex items-center justify-around">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors min-w-[60px]',
                  isActive
                    ? 'text-green-600 bg-green-50'
                    : 'text-gray-500 hover:text-gray-700'
                )
              }
            >
              <item.icon className="h-5 w-5" />
              <span className="text-xs font-medium">{item.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
