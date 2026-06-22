'use client';

import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

interface ThemeItem {
  name: string;
  count: number;
}

interface ThemeBarChartProps {
  data: ThemeItem[];
}

export default function ThemeBarChart({ data }: ThemeBarChartProps) {
  const sortedData = [...data].sort((a, b) => b.count - a.count).slice(0, 8);

  if (sortedData.length === 0) {
    return (
      <div className="h-[280px] flex items-center justify-center text-content-tertiary border border-border bg-surface-secondary rounded-xl italic text-sm">
        No theme data available
      </div>
    );
  }

  const getColor = () => {
    return '#14B8A6'; // brand-500
  };

  return (
    <div className="w-full h-[280px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={sortedData}
          layout="vertical"
          margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#F1F5F9"
            horizontal={false}
            vertical={true}
          />
          <XAxis type="number" stroke="#94A3B8" fontSize={11} axisLine={false} tickLine={false} />
          <YAxis
            dataKey="name"
            type="category"
            stroke="#94A3B8"
            fontSize={11}
            axisLine={false}
            tickLine={false}
            width={90}
            tickFormatter={(val) => (val.length > 14 ? `${val.substring(0, 12)}...` : val)}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#0F172A',
              border: 'none',
              borderRadius: '8px',
              color: '#FFFFFF',
              fontSize: '12px',
            }}
            cursor={{ fill: 'rgba(0, 0, 0, 0.02)' }}
          />
          <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={14}>
            {sortedData.map((_entry, index) => (
              <Cell key={`cell-${index}`} fill={getColor()} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
