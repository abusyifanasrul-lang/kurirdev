import { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  Users,
  FileText,
  Bell,
  Settings,
  LogOut,
  Truck,
  Menu,
  X,
  ChevronRight,
  DollarSign,
  TrendingUp,
  BarChart3,
  ShieldAlert,
  BookUser,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { useAuth } from '@/context/AuthContext';
import { getRoleLabel, getRoleBadgeColor } from '@/types';

interface NavItem {
  path: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  end?: boolean;
}

// Navigation per role
const roleNavItems: Record<string, NavItem[]> = {
  admin_kurir: [
    { path: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { path: '/admin/orders', label: 'Orders', icon: Package },
    { path: '/admin/couriers', label: 'Couriers', icon: Users },
    { path: '/admin/notifications', label: 'Notifikasi', icon: Bell },
    { path: '/admin/settings', label: 'Settings', icon: Settings },
  ],
  // Owner: Business Pilot - analytics & financial insight, no operational menus
  owner: [
    { path: '/admin/overview', label: 'Overview', icon: BarChart3, end: true },
    { path: '/admin/finance', label: 'Keuangan', icon: DollarSign },
    { path: '/admin/reports', label: 'Reports', icon: FileText },
    { path: '/admin/settings', label: 'Settings', icon: Settings },
  ],
  finance: [
    { path: '/admin/finance', label: 'Dashboard', icon: DollarSign, end: true },
    { path: '/admin/finance/penagihan', label: 'Penagihan', icon: TrendingUp },
    { path: '/admin/finance/analisa', label: 'Analisa', icon: BarChart3 },
    { path: '/admin/orders', label: 'Orders', icon: Package },
    { path: '/admin/reports', label: 'Reports', icon: FileText },
    { path: '/admin/settings', label: 'Settings', icon: Settings },
  ],
  // Super Admin (admin): God View - full access + exclusive Diagnostics
  admin: [
    { path: '/admin/dashboard', label: 'Command Center', icon: LayoutDashboard, end: true },
    { path: '/admin/orders', label: 'Orders', icon: Package },
    { path: '/admin/couriers', label: 'Couriers', icon: Users },
    { path: '/admin/customers', label: 'Customers', icon: BookUser },
    { path: '/admin/finance', label: 'Keuangan', icon: DollarSign },
    { path: '/admin/reports', label: 'Reports', icon: FileText },
    { path: '/admin/notifications', label: 'Notifikasi', icon: Bell },
    { path: '/admin/settings', label: 'Settings', icon: Settings },
    { path: '/admin/diagnostics', label: 'Diagnostics', icon: ShieldAlert },
  ],
};

export function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Get nav items for current role
  const navItems = user ? (roleNavItems[user.role] || roleNavItems.admin_kurir) : roleNavItems.admin_kurir;

  // Check screen size
  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth < 1024);
      if (window.innerWidth >= 1024) {
        setIsSidebarOpen(false);
      }
    };

    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    if (isMobile) {
      setIsSidebarOpen(false);
    }
  }, [location.pathname, isMobile]);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  // Get current page title
  const getCurrentPageTitle = () => {
    const currentItem = navItems.find((item) => {
      if (item.end) {
        return location.pathname === item.path;
      }
      return location.pathname.startsWith(item.path);
    });
    return currentItem?.label || 'Dashboard';
  };

  const roleLabel = user ? getRoleLabel(user.role) : '';
  const roleBadgeColor = user ? getRoleBadgeColor(user.role) : '';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-gray-900 text-white flex items-center justify-between px-4 z-50 shadow-lg">
        <button
          onClick={toggleSidebar}
          className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
          aria-label="Toggle menu"
        >
          <Menu className="h-6 w-6" />
        </button>

        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-teal-600 rounded-lg">
            <Truck className="h-5 w-5" />
          </div>
          <span className="font-bold">KurirDev</span>
        </div>

        <div className="flex items-center gap-2">
          <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", roleBadgeColor)}>
            {roleLabel}
          </span>
        </div>
      </header>

      {/* Overlay for mobile */}
      {isSidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-50"
          onClick={() => setIsSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-0 left-0 h-screen bg-gray-900 text-white flex flex-col z-50 transition-transform duration-300 ease-in-out',
          'w-72 lg:w-64',
          isMobile
            ? isSidebarOpen
              ? 'translate-x-0'
              : '-translate-x-full'
            : 'translate-x-0'
        )}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-teal-600 rounded-lg">
              <Truck className="h-6 w-6" />
            </div>
            <div>
              <h1 className="font-bold text-lg">KurirDev</h1>
              <div className="flex items-center gap-2">
                <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", roleBadgeColor)}>
                  {roleLabel}
                </span>
              </div>
            </div>
          </div>
          {/* Close button for mobile */}
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="lg:hidden p-2 hover:bg-gray-800 rounded-lg transition-colors"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'flex items-center justify-between px-4 py-3 rounded-lg text-sm font-medium transition-colors group',
                  isActive
                    ? 'bg-teal-600 text-white'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                )
              }
            >
              <div className="flex items-center gap-3">
                <item.icon className="h-5 w-5" />
                {item.label}
              </div>
              <ChevronRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
            </NavLink>
          ))}
        </nav>

        {/* User section */}
        <div className="p-4 border-t border-gray-800">
          <div className="flex items-center gap-3 px-4 py-3">
            <div className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center font-semibold",
              user?.role === 'admin' ? 'bg-teal-600' :
              user?.role === 'finance' ? 'bg-amber-600' :
              user?.role === 'owner' ? 'bg-emerald-600' :
              'bg-cyan-600'
            )}>
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

      {/* Main Content */}
      <main
        className={cn(
          'min-h-screen transition-all duration-300',
          'pt-16 lg:pt-0',
          'lg:ml-64'
        )}
      >
        {/* Breadcrumb / Page indicator for mobile */}
        <div className="lg:hidden bg-white border-b border-gray-200 px-4 py-3">
          <p className="text-xs text-gray-400">{roleLabel}</p>
          <h2 className="font-semibold text-gray-900">{getCurrentPageTitle()}</h2>
        </div>

        <Outlet />
      </main>
    </div>
  );
}
