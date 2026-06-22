'use client';

import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

import { formatDate } from '@/lib/utils';

interface TrendItem {
  date: string;
  positive: number;
  negative: number;
  neutral: number;
  mixed: number;
}

interface SentimentTrendLineProps {
  data: TrendItem[];
}

export default function SentimentTrendLine({ data }: SentimentTrendLineProps) {
  if (data.length === 0) {
    return (
      <div className="h-[280px] flex items-center justify-center text-content-tertiary border border-border bg-surface-secondary rounded-xl italic text-sm">
        No sentiment trend data available
      </div>
    );
  }

  const formatTickDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="w-full h-[280px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
          <defs>
            <linearGradient id="colorPos" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorNeg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#EF4444" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorNeu" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#6B7280" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#6B7280" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorMix" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#F59E0B" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
          <XAxis
            dataKey="date"
            stroke="#94A3B8"
            fontSize={11}
            tickFormatter={formatTickDate}
            axisLine={false}
            tickLine={false}
            dy={8}
          />
          <YAxis stroke="#94A3B8" fontSize={11} axisLine={false} tickLine={false} dx={-8} />
          <Tooltip
            contentStyle={{
              backgroundColor: '#0F172A',
              border: '1px solid #1E293B',
              borderRadius: '8px',
              color: '#FFFFFF',
              fontSize: '12px',
            }}
            labelFormatter={(label) => {
              try {
                return formatDate(new Date(label));
              } catch {
                return label;
              }
            }}
          />
          <Legend
            verticalAlign="top"
            height={36}
            iconType="circle"
            formatter={(value) => (
              <span className="text-content-secondary text-xs font-semibold capitalize">
                {value}
              </span>
            )}
          />
          <Area
            type="monotone"
            dataKey="positive"
            name="Positive"
            stroke="#10B981"
            strokeWidth={2.5}
            fillOpacity={1}
            fill="url(#colorPos)"
          />
          <Area
            type="monotone"
            dataKey="negative"
            name="Negative"
            stroke="#EF4444"
            strokeWidth={2.5}
            fillOpacity={1}
            fill="url(#colorNeg)"
          />
          <Area
            type="monotone"
            dataKey="neutral"
            name="Neutral"
            stroke="#6B7280"
            strokeWidth={2.5}
            fillOpacity={1}
            fill="url(#colorNeu)"
          />
          <Area
            type="monotone"
            dataKey="mixed"
            name="Mixed"
            stroke="#F59E0B"
            strokeWidth={2.5}
            fillOpacity={1}
            fill="url(#colorMix)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
