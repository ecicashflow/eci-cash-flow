import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Generate months between two dates (inclusive)
function getMonthsInRange(startDate: Date, endDate: Date) {
  const months: { month: number; year: number }[] = [];
  const current = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  const end = new Date(endDate.getFullYear(), endDate.getMonth(), 1);

  while (current <= end) {
    months.push({ month: current.getMonth() + 1, year: current.getFullYear() });
    current.setMonth(current.getMonth() + 1);
  }
  return months;
}

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const startDateStr = sp.get('startDate');
    const endDateStr = sp.get('endDate');

    // Determine date range
    let rangeMonths: { month: number; year: number }[];

    if (startDateStr && endDateStr) {
      const startDate = new Date(startDateStr);
      const endDate = new Date(endDateStr);
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || startDate > endDate) {
        return NextResponse.json({ error: 'Invalid date range' }, { status: 400 });
      }
      rangeMonths = getMonthsInRange(startDate, endDate);
    } else {
      // Default: current FY
      const now = new Date();
      const fyStart = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
      rangeMonths = [
        { month: 4, year: fyStart }, { month: 5, year: fyStart }, { month: 6, year: fyStart },
        { month: 7, year: fyStart }, { month: 8, year: fyStart }, { month: 9, year: fyStart },
        { month: 10, year: fyStart }, { month: 11, year: fyStart }, { month: 12, year: fyStart },
        { month: 1, year: fyStart + 1 }, { month: 2, year: fyStart + 1 }, { month: 3, year: fyStart + 1 },
      ];
    }

    const rangeYears = Array.from(new Set(rangeMonths.map(m => m.year)));
    const rangeMonthKeys = new Set(rangeMonths.map(m => `${m.month}-${m.year}`));

    // Fetch data
    const [settings, bankAccounts] = await Promise.all([
      db.setting.findMany(),
      db.bankAccount.findMany({ where: { active: true }, select: { currentBalance: true } }),
    ]);

    const settingsMap: Record<string, string> = {};
    for (const s of settings) settingsMap[s.key] = s.value;

    const currentBalance = bankAccounts.reduce((sum, a) => sum + a.currentBalance, 0);

    // Fetch aggregated data
    const [receiptSums, expenseSums] = await Promise.all([
      db.receipt.groupBy({ by: ['month', 'year'], _sum: { amount: true }, where: { year: { in: rangeYears } } }),
      db.expense.groupBy({ by: ['month', 'year'], _sum: { amount: true }, where: { year: { in: rangeYears } } }),
    ]);

    const receiptMap = new Map<string, number>();
    for (const r of receiptSums) receiptMap.set(`${r.month}-${r.year}`, r._sum.amount || 0);
    const expenseMap = new Map<string, number>();
    for (const e of expenseSums) expenseMap.set(`${e.month}-${e.year}`, e._sum.amount || 0);

    // Build monthly data array
    const monthlyData = rangeMonths.map(({ month, year }) => {
      const key = `${month}-${year}`;
      const receipts = receiptMap.get(key) || 0;
      const expenses = expenseMap.get(key) || 0;
      return {
        month,
        year,
        monthLabel: `${MONTH_NAMES[month - 1]} ${year}`,
        totalReceipts: receipts,
        totalExpenses: expenses,
        netCashFlow: receipts - expenses,
      };
    });

    // ─── 3-Month Trends ───
    const last3 = monthlyData.slice(-3);
    const prev3 = monthlyData.slice(-6, -3);

    const avgLast3Receipts = last3.length > 0 ? last3.reduce((s, m) => s + m.totalReceipts, 0) / last3.length : 0;
    const avgPrev3Receipts = prev3.length > 0 ? prev3.reduce((s, m) => s + m.totalReceipts, 0) / prev3.length : 0;
    const receiptTrend3MonthPct = avgPrev3Receipts !== 0 ? ((avgLast3Receipts - avgPrev3Receipts) / avgPrev3Receipts) * 100 : 0;

    const avgLast3Expenses = last3.length > 0 ? last3.reduce((s, m) => s + m.totalExpenses, 0) / last3.length : 0;
    const avgPrev3Expenses = prev3.length > 0 ? prev3.reduce((s, m) => s + m.totalExpenses, 0) / prev3.length : 0;
    const expenseTrend3MonthPct = avgPrev3Expenses !== 0 ? ((avgLast3Expenses - avgPrev3Expenses) / avgPrev3Expenses) * 100 : 0;

    // ─── 6-Month Trends ───
    const last6 = monthlyData.slice(-6);
    const prev6 = monthlyData.slice(-12, -6);

    const avgLast6Receipts = last6.length > 0 ? last6.reduce((s, m) => s + m.totalReceipts, 0) / last6.length : 0;
    const avgPrev6Receipts = prev6.length > 0 ? prev6.reduce((s, m) => s + m.totalReceipts, 0) / prev6.length : 0;
    const receiptTrend6MonthPct = avgPrev6Receipts !== 0 ? ((avgLast6Receipts - avgPrev6Receipts) / avgPrev6Receipts) * 100 : 0;

    const avgLast6Expenses = last6.length > 0 ? last6.reduce((s, m) => s + m.totalExpenses, 0) / last6.length : 0;
    const avgPrev6Expenses = prev6.length > 0 ? prev6.reduce((s, m) => s + m.totalExpenses, 0) / prev6.length : 0;
    const expenseTrend6MonthPct = avgPrev6Expenses !== 0 ? ((avgLast6Expenses - avgPrev6Expenses) / avgPrev6Expenses) * 100 : 0;

    // ─── Cash Burn Rate ───
    const totalExpenses = monthlyData.reduce((s, m) => s + m.totalExpenses, 0);
    const avgMonthlyBurn = monthlyData.length > 0 ? totalExpenses / monthlyData.length : 0;
    const avgMonthlyNet = monthlyData.length > 0 ? monthlyData.reduce((s, m) => s + m.netCashFlow, 0) / monthlyData.length : 0;
    const monthsRunway = avgMonthlyNet < 0 && currentBalance > 0
      ? Math.floor(currentBalance / Math.abs(avgMonthlyNet))
      : avgMonthlyNet >= 0 ? -1 : 0; // -1 = no concern

    // ─── Best / Worst Months ───
    const sortedByNet = [...monthlyData].sort((a, b) => b.netCashFlow - a.netCashFlow);
    const bestMonth = sortedByNet[0] || null;
    const worstMonth = sortedByNet[sortedByNet.length - 1] || null;

    // ─── Month-over-Month Changes ───
    const momChanges = monthlyData.map((m, i) => {
      if (i === 0) return null;
      const prev = monthlyData[i - 1];
      const receiptChange = prev.totalReceipts !== 0 ? ((m.totalReceipts - prev.totalReceipts) / prev.totalReceipts) * 100 : 0;
      const expenseChange = prev.totalExpenses !== 0 ? ((m.totalExpenses - prev.totalExpenses) / prev.totalExpenses) * 100 : 0;
      return {
        month: m.monthLabel,
        receiptChange: Math.round(receiptChange * 10) / 10,
        expenseChange: Math.round(expenseChange * 10) / 10,
        netChange: m.netCashFlow - prev.netCashFlow,
      };
    }).filter(Boolean);

    return NextResponse.json({
      threeMonthReceiptTrend: {
        currentAvg: avgLast3Receipts,
        previousAvg: avgPrev3Receipts,
        percentageChange: Math.round(receiptTrend3MonthPct * 10) / 10,
        direction: receiptTrend3MonthPct >= 0 ? 'up' : 'down',
      },
      threeMonthExpenseTrend: {
        currentAvg: avgLast3Expenses,
        previousAvg: avgPrev3Expenses,
        percentageChange: Math.round(expenseTrend3MonthPct * 10) / 10,
        direction: expenseTrend3MonthPct >= 0 ? 'up' : 'down',
      },
      sixMonthReceiptTrend: {
        currentAvg: avgLast6Receipts,
        previousAvg: avgPrev6Receipts,
        percentageChange: Math.round(receiptTrend6MonthPct * 10) / 10,
        direction: receiptTrend6MonthPct >= 0 ? 'up' : 'down',
      },
      sixMonthExpenseTrend: {
        currentAvg: avgLast6Expenses,
        previousAvg: avgPrev6Expenses,
        percentageChange: Math.round(expenseTrend6MonthPct * 10) / 10,
        direction: expenseTrend6MonthPct >= 0 ? 'up' : 'down',
      },
      cashBurnRate: {
        averageMonthlyExpenses: avgMonthlyBurn,
        averageMonthlyNetFlow: avgMonthlyNet,
        monthsOfRunway: monthsRunway,
        currentBalance,
      },
      bestMonth: bestMonth ? {
        month: bestMonth.monthLabel,
        netCashFlow: bestMonth.netCashFlow,
        receipts: bestMonth.totalReceipts,
        expenses: bestMonth.totalExpenses,
      } : null,
      worstMonth: worstMonth ? {
        month: worstMonth.monthLabel,
        netCashFlow: worstMonth.netCashFlow,
        receipts: worstMonth.totalReceipts,
        expenses: worstMonth.totalExpenses,
      } : null,
      monthOverMonthChanges: momChanges,
      settings: settingsMap,
    });
  } catch (error) {
    console.error('Trends API error:', error);
    return NextResponse.json({ error: 'Failed to fetch trend data' }, { status: 500 });
  }
}
