'use client';

import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip, Legend,
  ResponsiveContainer, ReferenceLine, Area, AreaChart,
} from 'recharts';
import { formatCompact } from '@/lib/format';

interface RechartsChartsProps {
  type: 'bar' | 'area';
  data: any[];
  tooltipStyle: React.CSSProperties;
  currencyFormatter: (v: number) => string;
}

export default function RechartsCharts({ type, data, tooltipStyle, currencyFormatter }: RechartsChartsProps) {
  if (type === 'bar') {
    return (
      <div className="h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="short" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10 }} tickFormatter={formatCompact} axisLine={false} tickLine={false} width={55} />
            <ReTooltip formatter={currencyFormatter} contentStyle={tooltipStyle} />
            <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
            <ReferenceLine y={0} stroke="var(--muted-foreground)" />
            <Bar dataKey="Receipts" fill="#16a34a" radius={[3, 3, 0, 0]} maxBarSize={28} />
            <Bar dataKey="Expenses" fill="#ef4444" radius={[3, 3, 0, 0]} maxBarSize={28} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  // Area chart
  return (
    <div className="h-[320px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="balGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="short" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 10 }} tickFormatter={formatCompact} axisLine={false} tickLine={false} width={55} />
          <ReTooltip formatter={currencyFormatter} contentStyle={tooltipStyle} />
          <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="6 3" strokeWidth={1.5}
            label={{ value: 'Break-even', position: 'right', fill: '#ef4444', fontSize: 9 }} />
          <Area type="monotone" dataKey="Balance" stroke="#3b82f6" strokeWidth={2.5}
            fill="url(#balGrad)" dot={{ r: 3, fill: '#3b82f6', strokeWidth: 0 }}
            activeDot={{ r: 5, stroke: '#3b82f6', strokeWidth: 2, fill: '#fff' }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
