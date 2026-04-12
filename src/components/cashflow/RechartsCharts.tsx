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
            <defs>
              <linearGradient id="receiptsGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#059669" stopOpacity={1} />
                <stop offset="100%" stopColor="#059669" stopOpacity={0.75} />
              </linearGradient>
              <linearGradient id="expensesGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#e11d48" stopOpacity={1} />
                <stop offset="100%" stopColor="#e11d48" stopOpacity={0.75} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 6" stroke="var(--border)" vertical={false} opacity={0.5} />
            <XAxis dataKey="short" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} tickFormatter={formatCompact} axisLine={false} tickLine={false} width={55} />
            <ReTooltip
              formatter={currencyFormatter}
              contentStyle={{
                ...tooltipStyle,
                borderRadius: 10,
                border: '1px solid var(--border)',
                boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
                fontSize: 12,
                fontWeight: 500,
                padding: '10px 14px',
              }}
              cursor={{ fill: 'var(--muted)', opacity: 0.3 }}
            />
            <Legend
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: 11, paddingTop: 8, fontWeight: 500 }}
            />
            <ReferenceLine y={0} stroke="var(--muted-foreground)" opacity={0.4} />
            <Bar dataKey="Receipts" fill="url(#receiptsGrad)" radius={[5, 5, 0, 0]} maxBarSize={28} />
            <Bar dataKey="Expenses" fill="url(#expensesGrad)" radius={[5, 5, 0, 0]} maxBarSize={28} />
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
              <stop offset="0%" stopColor="#4f46e5" stopOpacity={0.28} />
              <stop offset="50%" stopColor="#4f46e5" stopOpacity={0.10} />
              <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 6" stroke="var(--border)" vertical={false} opacity={0.5} />
          <XAxis dataKey="short" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} tickFormatter={formatCompact} axisLine={false} tickLine={false} width={55} />
          <ReTooltip
            formatter={currencyFormatter}
            contentStyle={{
              ...tooltipStyle,
              borderRadius: 10,
              border: '1px solid var(--border)',
              boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
              fontSize: 12,
              fontWeight: 500,
              padding: '10px 14px',
            }}
          />
          <ReferenceLine y={0} stroke="#e11d48" strokeDasharray="6 3" strokeWidth={1.5}
            label={{ value: 'Break-even', position: 'right', fill: '#e11d48', fontSize: 9, fontWeight: 500 }} />
          <Area type="monotone" dataKey="Balance" stroke="#4f46e5" strokeWidth={2.5}
            fill="url(#balGrad)"
            dot={{ r: 3.5, fill: '#fff', stroke: '#4f46e5', strokeWidth: 2 }}
            activeDot={{ r: 6, stroke: '#4f46e5', strokeWidth: 2.5, fill: '#fff' }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
