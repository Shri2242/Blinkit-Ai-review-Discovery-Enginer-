'use client';

import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { ReactNode } from 'react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  icon: ReactNode;
  color?: 'brand' | 'green' | 'red' | 'amber' | 'blue';
}

const colorMap = {
  brand: {
    bg: 'bg-brand-50',
    icon: 'bg-brand-500 text-white',
    accent: 'text-brand-600',
  },
  green: {
    bg: 'bg-sentiment-positive-bg',
    icon: 'bg-sentiment-positive text-white',
    accent: 'text-sentiment-positive',
  },
  red: {
    bg: 'bg-sentiment-negative-bg',
    icon: 'bg-sentiment-negative text-white',
    accent: 'text-sentiment-negative',
  },
  amber: {
    bg: 'bg-sentiment-mixed-bg',
    icon: 'bg-sentiment-mixed text-white',
    accent: 'text-sentiment-mixed',
  },
  blue: {
    bg: 'bg-priority-medium-bg',
    icon: 'bg-priority-medium text-white',
    accent: 'text-priority-medium',
  },
};

export default function StatCard({
  title,
  value,
  subtitle,
  trend,
  trendValue,
  icon,
  color = 'brand',
}: StatCardProps) {
  const colors = colorMap[color];

  return (
    <div className="card group p-5 hover:-translate-y-0.5 transition-all duration-200">
      <div className="flex items-start justify-between mb-4">
        <div className={`flex items-center justify-center w-10 h-10 rounded-xl ${colors.icon}`}>
          {icon}
        </div>
        {trend && trendValue && (
          <div
            className={`
              flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium
              ${
                trend === 'up'
                  ? 'bg-sentiment-positive-bg text-sentiment-positive'
                  : trend === 'down'
                    ? 'bg-sentiment-negative-bg text-sentiment-negative'
                    : 'bg-surface-tertiary text-content-tertiary'
              }
            `}
          >
            {trend === 'up' ? (
              <TrendingUp className="w-3 h-3" />
            ) : trend === 'down' ? (
              <TrendingDown className="w-3 h-3" />
            ) : (
              <Minus className="w-3 h-3" />
            )}
            {trendValue}
          </div>
        )}
      </div>

      <div>
        <p className="text-label-md text-content-tertiary uppercase tracking-wider mb-1">{title}</p>
        <p className="text-display-sm font-display text-content-primary">
          {typeof value === 'number' ? value.toLocaleString() : value}
        </p>
        {subtitle && <p className="text-body-sm text-content-tertiary mt-1">{subtitle}</p>}
      </div>
    </div>
  );
}
