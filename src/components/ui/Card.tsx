import React from 'react';
import { cn } from '@/utils/cn';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export function Card({ children, className, padding = 'md' }: CardProps) {
  const paddings = {
    none: '',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
  };

  return (
    <div className={cn('bg-white rounded-xl shadow-sm border border-gray-200', paddings[padding], className)}>
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
}

export function StatCard({ title, value, icon, trend, subtitle, className }: StatCardProps) {
  return (
    <Card className={cn('', className)}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="mt-2 text-3xl font-semibold text-gray-900">{value}</p>
          {trend && (
            <p className={cn('mt-2 text-sm flex items-center', trend.isPositive ? 'text-green-600' : 'text-red-600')}>
              {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}%
              <span className="text-gray-500 ml-1">vs last period</span>
            </p>
          )}
          {subtitle && <p className="mt-2 text-sm text-gray-500">{subtitle}</p>}
        </div>
        {icon && (
          <div className="p-3 bg-indigo-50 rounded-lg text-indigo-600">
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
}
