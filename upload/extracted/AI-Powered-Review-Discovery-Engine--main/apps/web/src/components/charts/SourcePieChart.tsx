'use client';

import React from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface SourceItem {
  source: string;
  count: number;
}

interface SourcePieChartProps {
  data: SourceItem[];
}

export default function SourcePieChart({ data }: SourcePieChartProps) {
  const chartData = data
    .filter((item) => item.count > 0)
    .map((item) => ({
      name:
        item.source === 'app_store' || item.source === 'appstore'
          ? 'App Store'
          : item.source === 'google_play' || item.source === 'playstore'
            ? 'Google Play'
            : item.source,
      value: item.count,
    }));

  const total = chartData.reduce((acc, item) => acc + item.value, 0);
  const colors = ['#14B8A6', '#3B82F6', '#F59E0B', '#EF4444'];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const customTooltipFormatter = (value: any) => {
    const numValue = typeof value === 'number' ? value : Number(value) || 0;
    if (total === 0) return '0%';
    const pct = ((numValue / total) * 100).toFixed(1);
    return `${numValue} reviews (${pct}%)`;
  };

  if (total === 0) {
    return (
      <div className="h-[280px] flex items-center justify-center text-content-tertiary border border-border bg-surface-secondary rounded-xl italic text-sm">
        No source data available
      </div>
    );
  }

  return (
    <div className="w-full h-[280px]">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="45%"
            innerRadius={60}
            outerRadius={85}
            paddingAngle={4}
            dataKey="value"
          >
            {chartData.map((_entry, index) => (
              <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={customTooltipFormatter}
            contentStyle={{
              backgroundColor: '#0F172A',
              border: 'none',
              borderRadius: '8px',
              color: '#FFFFFF',
              fontSize: '12px',
            }}
          />
          <Legend
            verticalAlign="bottom"
            height={36}
            iconType="circle"
            formatter={(value) => (
              <span className="text-content-secondary text-xs font-semibold">{value}</span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
