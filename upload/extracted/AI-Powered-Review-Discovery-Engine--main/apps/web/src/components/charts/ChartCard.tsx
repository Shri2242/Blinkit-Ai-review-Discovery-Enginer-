'use client';

import type { ReactNode } from 'react';

interface ChartCardProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}

export default function ChartCard({
  title,
  subtitle,
  children,
  action,
  className = '',
}: ChartCardProps) {
  return (
    <div className={`card p-5 ${className}`}>
      <div className="flex items-start justify-between mb-5">
        <div>
          <h3 className="text-heading-sm text-content-primary font-display">{title}</h3>
          {subtitle && <p className="text-body-sm text-content-tertiary mt-0.5">{subtitle}</p>}
        </div>
        {action && <div>{action}</div>}
      </div>
      {children}
    </div>
  );
}
