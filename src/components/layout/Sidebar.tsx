import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  Users,
  FileText,
  Bell,
  Settings,
  LogOut,
  Truck,
  DollarSign,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { useAuth } from '@/context/AuthContext';

interface NavItem {
  path: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  end?: boolean;
}

const adminNavItems: NavItem[] = [
  { path: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { path: '/admin/orders', label: 'Orders', icon: Package },
  { path: '/admin/couriers', label: 'Couriers', icon: Users },
  { path: '/admin/shifts', label: 'Shifts', icon: Truck },
  { path: '/admin/attendance', label: 'Attendance', icon: Bell },
];

const financeNavItems: NavItem[] = [
  { path: '/admin/finance', label: 'Finance', icon: DollarSign },
  { path: '/admin/reports', label: 'Reports', icon: FileText },
];

const systemNavItems: NavItem[] = [
  { path: '/admin/settings', label: 'Settings', icon: Settings },
];

export function Sidebar() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const allNavItems = [
    ...adminNavItems,
    ...financeNavItems,
    ...systemNavItems,
  ].filter(item => {
    if (user?.role === 'finance') {
      return item.path.includes('finance') || item.path.includes('reports') || item.path.includes('settings');
    }
    return true;
  });

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-gray-900 text-white flex flex-col">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-800">
        <div className="p-2 bg-teal-600 rounded-lg shadow-lg shadow-teal-900/20">
          <Truck className="h-6 w-6" />
        </div>
        <div>
          <h1 className="font-bold text-lg tracking-tight">KurirMe</h1>
          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Admin Dashboard</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto scrollbar-hide">
        <div className="space-y-6">
          {/* Main Section */}
          <div className="space-y-1">
            <p className="px-4 text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Utama</p>
            {adminNavItems.filter(item => user?.role !== 'finance').map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 group',
                    isActive
                      ? 'bg-teal-600 text-white shadow-lg shadow-teal-900/40'
                      : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                  )
                }
              >
                <item.icon className={cn("h-4 w-4 transition-transform group-hover:scale-110")} />
                {item.label}
              </NavLink>
            ))}
          </div>

          {/* Finance Section */}
          <div className="space-y-1">
            <p className="px-4 text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Keuangan</p>
            {financeNavItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 group',
                    isActive
                      ? 'bg-teal-600 text-white shadow-lg shadow-teal-900/40'
                      : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                  )
                }
              >
                <item.icon className={cn("h-4 w-4 transition-transform group-hover:scale-110")} />
                {item.label}
              </NavLink>
            ))}
          </div>

          {/* System Section */}
          <div className="space-y-1">
            <p className="px-4 text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Sistem</p>
            {systemNavItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 group',
                    isActive
                      ? 'bg-teal-600 text-white shadow-lg shadow-teal-900/40'
                      : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                  )
                }
              >
                <item.icon className={cn("h-4 w-4 transition-transform group-hover:scale-110")} />
                {item.label}
              </NavLink>
            ))}
          </div>
        </div>
      </nav>

      {/* User section */}
      <div className="p-4 border-t border-gray-800">
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="w-10 h-10 bg-teal-600 rounded-full flex items-center justify-center font-semibold">
            {user?.name?.charAt(0).toUpperCase() || 'A'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user?.name || 'Admin User'}</p>
            <p className="text-xs text-gray-400 truncate">{user?.email || 'admin@delivery.com'}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-4 py-3 mt-2 rounded-lg text-sm font-medium text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
        >
          <LogOut className="h-5 w-5" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
