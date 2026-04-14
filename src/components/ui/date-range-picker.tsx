'use client';

import React, { useState } from 'react';
import { CalendarRange } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';

interface DateRangePickerProps {
  startDate: Date;
  endDate: Date;
  onChange: (start: Date, end: Date) => void;
  /** If true, shows calendar icon only on small screens */
  compactOnMobile?: boolean;
  className?: string;
}

const PRESETS = [
  { key: 'fy-2026', label: 'FY 2026-27' },
  { key: 'fy-2025', label: 'FY 2025-26' },
  { key: 'current-fy', label: 'Current FY' },
  { key: 'this-month', label: 'This Month' },
  { key: 'last-3-months', label: '3 Months' },
  { key: 'last-6-months', label: '6 Months' },
  { key: 'ytd', label: 'Year to Date' },
] as const;

function formatDateStr(d: Date): string {
  return d.toISOString().split('T')[0];
}

function formatDisplayDate(d: Date): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[d.getMonth()]} ${d.getFullYear()}`;
}

function applyPreset(preset: string): { start: Date; end: Date } {
  const now = new Date();
  const currentFYStart = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;

  switch (preset) {
    case 'current-fy':
      return { start: new Date(currentFYStart, 3, 1), end: new Date(currentFYStart + 1, 2, 31) };
    case 'fy-2026':
      return { start: new Date(2026, 3, 1), end: new Date(2027, 2, 31) };
    case 'fy-2025':
      return { start: new Date(2025, 3, 1), end: new Date(2026, 2, 31) };
    case 'this-month':
      return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: new Date(now.getFullYear(), now.getMonth() + 1, 0) };
    case 'last-3-months':
      return { start: new Date(now.getFullYear(), now.getMonth() - 2, 1), end: new Date(now.getFullYear(), now.getMonth() + 1, 0) };
    case 'last-6-months':
      return { start: new Date(now.getFullYear(), now.getMonth() - 5, 1), end: new Date(now.getFullYear(), now.getMonth() + 1, 0) };
    case 'ytd':
      return { start: new Date(now.getFullYear(), 0, 1), end: now };
    default:
      return { start: new Date(currentFYStart, 3, 1), end: new Date(currentFYStart + 1, 2, 31) };
  }
}

export function getActivePresetLabel(startDate: Date, endDate: Date): string | null {
  const now = new Date();
  const currentFYStart = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;

  const checks: { key: string; start: Date; end: Date }[] = [
    { key: 'fy-2026', start: new Date(2026, 3, 1), end: new Date(2027, 2, 31) },
    { key: 'fy-2025', start: new Date(2025, 3, 1), end: new Date(2026, 2, 31) },
    { key: 'current-fy', start: new Date(currentFYStart, 3, 1), end: new Date(currentFYStart + 1, 2, 31) },
    { key: 'this-month', start: new Date(now.getFullYear(), now.getMonth(), 1), end: new Date(now.getFullYear(), now.getMonth() + 1, 0) },
    { key: 'last-3-months', start: new Date(now.getFullYear(), now.getMonth() - 2, 1), end: new Date(now.getFullYear(), now.getMonth() + 1, 0) },
    { key: 'last-6-months', start: new Date(now.getFullYear(), now.getMonth() - 5, 1), end: new Date(now.getFullYear(), now.getMonth() + 1, 0) },
    { key: 'ytd', start: new Date(now.getFullYear(), 0, 1), end: now },
  ];

  for (const c of checks) {
    if (
      formatDateStr(startDate) === formatDateStr(c.start) &&
      formatDateStr(endDate) === formatDateStr(c.end)
    ) {
      return PRESETS.find(p => p.key === c.key)?.label || null;
    }
  }
  return null;
}

export { formatDateStr, formatDisplayDate, applyPreset, PRESETS };

export default function DateRangePicker({ startDate, endDate, onChange, compactOnMobile, className }: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [tempStart, setTempStart] = useState(startDate);
  const [tempEnd, setTempEnd] = useState(endDate);

  const handleOpen = (isOpen: boolean) => {
    if (isOpen) {
      setTempStart(startDate);
      setTempEnd(endDate);
    }
    setOpen(isOpen);
  };

  const handlePreset = (key: string) => {
    const { start, end } = applyPreset(key);
    setTempStart(start);
    setTempEnd(end);
    onChange(start, end);
    setOpen(false);
  };

  const handleApply = () => {
    onChange(tempStart, tempEnd);
    setOpen(false);
  };

  const activePreset = getActivePresetLabel(startDate, endDate);

  return (
    <Popover open={open} onOpenChange={handleOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={`h-8 text-xs gap-2 rounded-lg border-border/80 hover:border-primary/30 hover:bg-primary/[0.04] transition-all duration-200 shadow-sm ${className || ''}`}
        >
          <CalendarRange className="w-3.5 h-3.5 text-primary/70 flex-shrink-0" />
          <span className={`${compactOnMobile ? 'hidden md:inline' : ''} max-w-[200px] truncate font-medium`}>
            {activePreset || `${formatDisplayDate(startDate)} — ${formatDisplayDate(endDate)}`}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 rounded-xl border-border/60 shadow-xl" align="end">
        <div className="p-4 space-y-4">
          {/* Quick presets */}
          <div className="space-y-2.5">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Quick Select</p>
            <div className="flex flex-wrap gap-1.5">
              {PRESETS.map(p => (
                <Button
                  key={p.key}
                  variant="outline"
                  size="sm"
                  className="h-7 text-[10px] px-2.5 rounded-lg font-medium border-border/70 hover:border-primary/30 hover:bg-primary/[0.04] hover:text-primary transition-all duration-200"
                  onClick={() => handlePreset(p.key)}
                >
                  {p.label}
                </Button>
              ))}
            </div>
          </div>
          {/* Custom date range */}
          <div className="border-t border-border/50 pt-4 space-y-3">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Custom Range</p>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <label className="text-[10px] text-muted-foreground font-medium mb-1 block">From</label>
                <input
                  type="date"
                  value={formatDateStr(tempStart)}
                  onChange={e => {
                    const d = new Date(e.target.value);
                    if (!isNaN(d.getTime())) setTempStart(d);
                  }}
                  className="w-full border border-border/70 rounded-lg px-2.5 py-1.5 text-xs focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all duration-200"
                />
              </div>
              <span className="text-muted-foreground/50 text-xs mt-5">→</span>
              <div className="flex-1">
                <label className="text-[10px] text-muted-foreground font-medium mb-1 block">To</label>
                <input
                  type="date"
                  value={formatDateStr(tempEnd)}
                  onChange={e => {
                    const d = new Date(e.target.value);
                    if (!isNaN(d.getTime())) setTempEnd(d);
                  }}
                  className="w-full border border-border/70 rounded-lg px-2.5 py-1.5 text-xs focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all duration-200"
                />
              </div>
            </div>
            <Button
              size="sm"
              className="w-full h-8 text-xs rounded-lg font-medium shadow-sm"
              onClick={handleApply}
            >
              Apply Range
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
