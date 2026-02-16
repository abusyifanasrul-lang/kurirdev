import { useState } from 'react';
import { Bell, Search, RefreshCw, Wifi, WifiOff, Menu } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

interface HeaderProps {
  title: string;
  subtitle?: string;
  isConnected?: boolean;
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
  isConnected = true,
  onRefresh,
  showSearch = false,
  searchValue = '',
  onSearchChange,
  searchPlaceholder = 'Search...',
  actions,
  onMenuClick,
}: HeaderProps) {
  const [notificationCount] = useState(3);

  return (
    <header className="bg-white border-b border-gray-200 px-4 lg:px-8 py-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {/* Mobile menu button - hidden, now handled in Layout */}
          {onMenuClick && (
            <button
              onClick={onMenuClick}
              className="lg:hidden p-2 -ml-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Menu className="h-5 w-5 text-gray-600" />
            </button>
          )}
          <div>
            <h1 className="text-xl lg:text-2xl font-bold text-gray-900">{title}</h1>
            {subtitle && <p className="text-xs lg:text-sm text-gray-500 mt-0.5">{subtitle}</p>}
          </div>
        </div>

        <div className="flex items-center gap-2 lg:gap-4">
          {/* Connection status - hide on mobile */}
          <div
            className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${
              isConnected ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
            }`}
          >
            {isConnected ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
            <span className="hidden md:inline">{isConnected ? 'Connected' : 'Disconnected'}</span>
          </div>

          {/* Search - hidden on mobile by default */}
          {showSearch && onSearchChange && (
            <div className="hidden lg:block w-64">
              <Input
                placeholder={searchPlaceholder}
                value={searchValue}
                onChange={(e) => onSearchChange(e.target.value)}
                leftIcon={<Search className="h-4 w-4" />}
              />
            </div>
          )}

          {/* Refresh button */}
          {onRefresh && (
            <Button variant="ghost" size="sm" onClick={onRefresh} className="p-2">
              <RefreshCw className="h-4 w-4" />
            </Button>
          )}

          {/* Notifications */}
          <button className="relative p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            <Bell className="h-5 w-5" />
            {notificationCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                {notificationCount}
              </span>
            )}
          </button>

          {/* Custom actions - wrap on mobile */}
          <div className="hidden sm:flex items-center gap-2">
            {actions}
          </div>
        </div>
      </div>

      {/* Mobile actions row */}
      {actions && (
        <div className="sm:hidden flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
          {actions}
        </div>
      )}

      {/* Mobile search row */}
      {showSearch && onSearchChange && (
        <div className="lg:hidden mt-3 pt-3 border-t border-gray-100">
          <Input
            placeholder={searchPlaceholder}
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            leftIcon={<Search className="h-4 w-4" />}
          />
        </div>
      )}
    </header>
  );
}
