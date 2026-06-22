'use client';

import React from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface SentimentData {
  positive: number;
  negative: number;
  neutral: number;
  mixed: number;
}

interface SentimentPieChartProps {
  data: SentimentData;
}

export default function SentimentPieChart({ data }: SentimentPieChartProps) {
  const chartData = [
    { name: 'Positive', value: data.positive, color: '#10B981' },
    { name: 'Negative', value: data.negative, color: '#EF4444' },
    { name: 'Neutral', value: data.neutral, color: '#6B7280' },
    { name: 'Mixed', value: data.mixed, color: '#F59E0B' },
  ].filter((item) => item.value > 0);

  const total = chartData.reduce((acc, item) => acc + item.value, 0);

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
        No sentiment data available
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
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
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
