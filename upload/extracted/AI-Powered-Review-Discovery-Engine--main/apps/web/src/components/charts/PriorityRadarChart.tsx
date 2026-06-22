'use client';

import React from 'react';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';

interface PriorityData {
  critical: number;
  high: number;
  medium: number;
  low: number;
}

interface PriorityRadarChartProps {
  data: PriorityData;
}

export default function PriorityRadarChart({ data }: PriorityRadarChartProps) {
  const chartData = [
    { subject: 'Critical', value: data.critical },
    { subject: 'High', value: data.high },
    { subject: 'Medium', value: data.medium },
    { subject: 'Low', value: data.low },
  ];

  const total = Object.values(data).reduce((acc, val) => acc + val, 0);

  if (total === 0) {
    return (
      <div className="h-[280px] flex items-center justify-center text-content-tertiary border border-border bg-surface-secondary rounded-xl italic text-sm">
        No priority data available
      </div>
    );
  }

  return (
    <div className="w-full h-[280px] flex items-center justify-center">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="75%" data={chartData}>
          <PolarGrid stroke="#E2E8F0" />
          <PolarAngleAxis dataKey="subject" stroke="#94A3B8" fontSize={11} />
          <PolarRadiusAxis
            angle={45}
            stroke="#E2E8F0"
            fontSize={10}
            tick={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#0F172A',
              border: 'none',
              borderRadius: '8px',
              color: '#FFFFFF',
              fontSize: '12px',
            }}
          />
          <Radar
            name="Issues Count"
            dataKey="value"
            stroke="#3B82F6"
            fill="#3B82F6"
            fillOpacity={0.15}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
