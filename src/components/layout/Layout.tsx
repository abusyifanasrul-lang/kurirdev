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
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useRealtimeHealth } from '@/hooks/useRealtimeHealth';

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
    { path: '/admin/customers', label: 'Customers', icon: BookUser },
    { path: '/admin/notifications', label: 'Notifikasi', icon: Bell },
    { path: '/admin/settings', label: 'Settings', icon: Settings },
  ],
  // Owner: Business Pilot - analytics & financial insight, no operational menus
  owner: [
    { path: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard, end: true },
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
    { path: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard, end: true },
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

  const isOnline = useNetworkStatus();
  const { overall } = useRealtimeHealth();
  const isHealthy = isOnline && overall === 'healthy';
  const isOffline = !isOnline || overall === 'disconnected';

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



        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="KurirMe" className="h-7 w-auto object-contain" />
          <div 
            className={cn(
              "w-2 h-2 rounded-full shadow-sm transition-all duration-500",
              isOffline ? "bg-red-500" : isHealthy ? "bg-emerald-400 animate-pulse" : "bg-amber-400"
            )} 
            title={isOffline ? "Offline" : isHealthy ? "LIVE" : "Syncing..."}
          />
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
          'fixed top-0 left-0 h-screen bg-brand-dark text-white flex flex-col z-50 transition-transform duration-300 ease-in-out shadow-xl',
          'w-72 lg:w-64',
          isMobile
            ? isSidebarOpen
              ? 'translate-x-0'
              : '-translate-x-full'
            : 'translate-x-0'
        )}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 shrink-0">
              <img src="/logomini.png" alt="KurirMe Mini" className="w-full h-full object-contain rounded-xl shadow-md" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-lg tracking-wide text-white">
                  Kurir<span className="text-[#00B1C3]">Me</span>
                </h1>
                <div 
                  className={cn(
                    "w-2 h-2 rounded-full shadow-sm transition-all duration-500",
                    isOffline ? "bg-red-500" : isHealthy ? "bg-emerald-400 animate-pulse" : "bg-amber-400"
                  )} 
                  title={isOffline ? "Offline" : isHealthy ? "LIVE" : "Syncing..."}
                />
              </div>
              <div className="flex items-center gap-2">
                <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", roleBadgeColor)}>
                  {roleLabel}
                </span>
                <span className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">
                  {isOffline ? 'Offline' : isHealthy ? 'Live' : 'Syncing...'}
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
                  'flex items-center justify-between px-4 py-3 rounded-2xl text-sm font-medium transition-all duration-200 group',
                  isActive
                    ? 'bg-brand-cyan text-white shadow-md'
                    : 'text-brand-surface/70 hover:bg-white/10 hover:text-white'
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
        <div className="p-4 border-t border-white/10">
          <div className="flex items-center gap-3 px-4 py-3 bg-white/5 rounded-2xl">
            <div className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center font-semibold text-white shadow-sm",
              user?.role === 'admin' ? 'bg-brand-cyan' :
              user?.role === 'finance' ? 'bg-brand-teal' :
              user?.role === 'owner' ? 'bg-brand-dark border-2 border-brand-cyan' :
              'bg-brand-cyan'
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
            className="flex items-center justify-center gap-3 w-full px-4 py-3 mt-3 rounded-xl text-sm font-medium text-brand-surface/70 hover:bg-white/10 hover:text-white transition-all duration-200"
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
