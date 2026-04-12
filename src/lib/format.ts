export function formatPKR(amount: number): string {
  const rounded = Math.round(amount);
  const absAmount = Math.abs(rounded);
  const formatted = absAmount.toLocaleString('en-PK', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  if (rounded < 0) return `(${formatted})`;
  return formatted;
}

export function formatPKRFull(amount: number): string {
  const prefix = 'Rs. ';
  const rounded = Math.round(amount);
  const absAmount = Math.abs(rounded);
  const formatted = absAmount.toLocaleString('en-PK', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  if (rounded < 0) return `${prefix}(${formatted})`;
  return `${prefix}${formatted}`;
}

export function formatCompact(amount: number): string {
  const rounded = Math.round(amount);
  const absAmount = Math.abs(rounded);
  if (absAmount >= 1000000) {
    const val = absAmount / 1000000;
    const display = val % 1 === 0 ? val.toFixed(0) : val.toFixed(2).replace(/\.?0+$/, '');
    return rounded < 0 ? `(${display}M)` : `${display}M`;
  }
  if (absAmount >= 1000) {
    const val = absAmount / 1000;
    const display = val % 1 === 0 ? val.toFixed(0) : val.toFixed(1);
    return rounded < 0 ? `(${display}K)` : `${display}K`;
  }
  return formatPKR(rounded);
}

export function formatMillions(amount: number): string {
  const rounded = Math.round(amount);
  const absAmount = Math.abs(rounded);
  const val = absAmount / 1000000;
  const display = val % 1 === 0 ? val.toFixed(0) : val.toFixed(2).replace(/\.?0+$/, '');
  if (rounded < 0) return `(${display} M)`;
  return `${display} M`;
}

export const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const MONTH_FULL_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** Ordered financial year months: Apr(4) → Mar(3) */
export function getFYMonths(startYear: number): { month: number; year: number; label: string; shortLabel: string }[] {
  return [
    { month: 4, year: startYear }, { month: 5, year: startYear }, { month: 6, year: startYear },
    { month: 7, year: startYear }, { month: 8, year: startYear }, { month: 9, year: startYear },
    { month: 10, year: startYear }, { month: 11, year: startYear }, { month: 12, year: startYear },
    { month: 1, year: startYear + 1 }, { month: 2, year: startYear + 1 }, { month: 3, year: startYear + 1 },
  ].map(({ month, year }) => ({
    month, year,
    label: `${MONTH_NAMES[month - 1]} ${year}`,
    shortLabel: `${MONTH_NAMES[month - 1]}'${String(year).slice(2)}`,
  }));
}

/** Parse "4-2026" format */
export function parseMonthKey(key: string): { month: number; year: number } {
  const [m, y] = key.split('-').map(Number);
  return { month: m, year: y };
}

/** FY-aware sort comparator for month keys like "4-2026" */
export function fySortKey(key: string): number {
  const { month, year } = parseMonthKey(key);
  return month >= 4 ? year * 100 + month : (year - 1) * 100 + month + 100;
}
