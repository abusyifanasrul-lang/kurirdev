import React from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/utils/cn';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  onClick?: () => void;
}

export function Card({ children, className, padding = 'md', onClick }: CardProps) {
  const paddings = {
    none: '',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
  };

  return (
    <div
      className={cn(
        'bg-white rounded-xl shadow-sm border border-gray-200',
        paddings[padding],
        onClick && 'cursor-pointer hover:shadow-md transition-shadow',
        className
      )}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  subtitle?: string;
  className?: string;
  to?: string; // Add link support
  onClick?: () => void;
}

export function StatCard({ title, value, icon, trend, subtitle, className, to, onClick }: StatCardProps) {
  const Content = (
    <Card className={cn('h-full', className)} padding="sm" onClick={onClick}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs lg:text-sm font-medium text-gray-500 truncate">{title}</p>
          <p className="mt-1 lg:mt-2 text-xl lg:text-3xl font-semibold text-gray-900 break-words leading-tight">{value}</p>
          {trend && (
            <p className={cn('mt-1 lg:mt-2 text-xs lg:text-sm flex items-center', trend.isPositive ? 'text-green-600' : 'text-red-600')}>
              {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}%
              <span className="text-gray-500 ml-1 hidden lg:inline">vs last period</span>
            </p>
          )}
          {subtitle && <p className="mt-1 lg:mt-2 text-xs lg:text-sm text-gray-500 truncate">{subtitle}</p>}
        </div>
        {icon && (
          <div className="p-2 lg:p-3 bg-indigo-50 rounded-lg text-indigo-600 flex-shrink-0">
            <div className="h-4 w-4 lg:h-6 lg:w-6 [&>svg]:h-full [&>svg]:w-full">
              {icon}
            </div>
          </div>
        )}
      </div>
    </Card>
  );

  if (to) {
    return <Link to={to} className="block h-full">{Content}</Link>;
  }

  return Content;
}
