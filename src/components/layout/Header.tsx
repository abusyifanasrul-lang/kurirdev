import { Bell, Search, RefreshCw, Menu } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAuth } from '@/context/AuthContext';
import { useNotificationStore } from '@/stores/useNotificationStore';
import { useNavigate } from 'react-router-dom';
import { BasecampIndicator } from './BasecampIndicator';

interface HeaderProps {
  title: string;
  subtitle?: string;
  onRefresh?: () => void;
  showSearch?: boolean;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  actions?: React.ReactNode;
  onMenuClick?: () => void;
}

export function Header({
  title,
  subtitle,
  onRefresh,
  showSearch = false,
  searchValue = '',
  onSearchChange,
  searchPlaceholder = 'Search...',
  actions,
  onMenuClick,
}: HeaderProps) {
  const { user } = useAuth();
  const { notifications } = useNotificationStore();
  const navigate = useNavigate();

  // Calculate unread for THIS user
  const userUnreadCount = notifications.filter(n => n.user_id === user?.id && !n.is_read).length;

  return (
    <header className="bg-white border-b border-gray-200 px-4 lg:px-8 py-4">
      <div className="flex items-center justify-between gap-4">
        {/* Title Section */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {onMenuClick && (
            <button
              onClick={onMenuClick}
              className="lg:hidden p-2 -ml-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
            >
              <Menu className="h-5 w-5 text-gray-600" />
            </button>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="text-xl lg:text-2xl font-bold text-gray-900 truncate">{title}</h1>
            {subtitle && <p className="text-xs lg:text-sm font-medium text-gray-600 mt-0.5 truncate">{subtitle}</p>}
          </div>
          
          {/* Basecamp Indicator - Mobile Only */}
          <div className="lg:hidden flex-shrink-0">
            <BasecampIndicator />
          </div>
        </div>

        {/* Actions Section */}
        <div className="flex items-center gap-2 lg:gap-4">
          {showSearch && onSearchChange && (
            <div className="hidden lg:block w-64">
              <Input
                placeholder={searchPlaceholder}
                value={searchValue}
                onChange={(e) => onSearchChange(e.target.value)}
                leftIcon={<Search className="h-4 w-4" />}
                aria-label="Cari data"
              />
            </div>
          )}

          {onRefresh && (
            <Button variant="ghost" size="sm" onClick={onRefresh} className="p-2">
              <RefreshCw className="h-4 w-4" />
            </Button>
          )}

          <button
            className="relative p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            onClick={() => navigate('/admin/notifications')}
          >
            <Bell className="h-5 w-5" />
            {userUnreadCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                {userUnreadCount}
              </span>
            )}
          </button>

          <div className="hidden sm:flex items-center gap-2">
            {actions}
          </div>
        </div>
      </div>

      {actions && (
        <div className="sm:hidden flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
          {actions}
        </div>
      )}

      {showSearch && onSearchChange && (
        <div className="lg:hidden mt-3 pt-3 border-t border-gray-100">
          <Input
            placeholder={searchPlaceholder}
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            leftIcon={<Search className="h-4 w-4" />}
            aria-label="Cari data"
          />
        </div>
      )}
    </header>
  );
}
