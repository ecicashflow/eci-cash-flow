export function formatPKR(amount: number): string {
  const absAmount = Math.abs(amount);
  const formatted = absAmount.toLocaleString('en-PK', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  if (amount < 0) return `(${formatted})`;
  return formatted;
}

export function formatPKRFull(amount: number): string {
  const prefix = 'Rs. ';
  const absAmount = Math.abs(amount);
  const formatted = absAmount.toLocaleString('en-PK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  if (amount < 0) return `${prefix}(${formatted})`;
  return `${prefix}${formatted}`;
}

export function formatCompact(amount: number): string {
  const absAmount = Math.abs(amount);
  if (absAmount >= 10000000) {
    const val = Math.abs(amount) / 10000000;
    return amount < 0 ? `(${val.toFixed(1)}M)` : `${val.toFixed(1)}M`;
  }
  if (absAmount >= 100000) {
    const val = Math.abs(amount) / 100000;
    return amount < 0 ? `(${val.toFixed(1)}L)` : `${val.toFixed(1)}L`;
  }
  if (absAmount >= 1000) {
    const val = Math.abs(amount) / 1000;
    return amount < 0 ? `(${val.toFixed(1)}K)` : `${val.toFixed(1)}K`;
  }
  return formatPKR(amount);
}

export function formatLakhs(amount: number): string {
  const absAmount = Math.abs(amount);
  const val = absAmount / 100000;
  if (amount < 0) return `(${val.toFixed(2)} L)`;
  return `${val.toFixed(2)} L`;
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
