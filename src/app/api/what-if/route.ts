import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { startDate: startStr, endDate: endStr, scenarios = [] } = body;

    if (!startStr || !endStr) {
      return NextResponse.json({ error: 'startDate and endDate are required' }, { status: 400 });
    }

    const startDate = new Date(startStr);
    const endDate = new Date(endStr);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return NextResponse.json({ error: 'Invalid date range' }, { status: 400 });
    }

    const rangeMonths = getMonthsInRange(startDate, endDate);
    const rangeYears = Array.from(new Set(rangeMonths.map(m => m.year)));

    // Fetch base data
    const [bankAccounts, receipts, expenses] = await Promise.all([
      db.bankAccount.findMany({ where: { active: true } }),
      db.receipt.findMany({ where: { year: { in: rangeYears } } }),
      db.expense.findMany({ where: { year: { in: rangeYears } } }),
    ]);

    const currentBalance = bankAccounts.reduce((sum, a) => sum + a.currentBalance, 0);

    // Group by month
    const receiptMap = new Map<string, number>();
    const expenseMap = new Map<string, number>();

    for (const r of receipts) {
      const key = `${r.month}-${r.year}`;
      receiptMap.set(key, (receiptMap.get(key) || 0) + r.amount);
    }
    for (const e of expenses) {
      const key = `${e.month}-${e.year}`;
      expenseMap.set(key, (expenseMap.get(key) || 0) + e.amount);
    }

    // Build original monthly data
    function buildMonthlyData(receiptMods: Map<string, number>, expenseMods: Map<string, number>) {
      const data: any[] = [];
      let running = currentBalance;

      for (const { month, year } of rangeMonths) {
        const key = `${month}-${year}`;
        const baseReceipts = receiptMap.get(key) || 0;
        const baseExpenses = expenseMap.get(key) || 0;
        const modReceipts = receiptMods.get(key) || 0;
        const modExpenses = expenseMods.get(key) || 0;

        const totalReceipts = baseReceipts + modReceipts;
        const totalExpenses = baseExpenses + modExpenses;
        const closing = running + totalReceipts - totalExpenses;

        data.push({
          month, year,
          monthLabel: `${MONTH_NAMES[month - 1]} ${year}`,
          openingBalance: running,
          totalReceipts,
          totalExpenses,
          netCashFlow: totalReceipts - totalExpenses,
          closingBalance: closing,
          isDeficit: closing < 0,
        });
        running = closing;
      }
      return data;
    }

    // Original (no scenarios)
    const originalData = buildMonthlyData(new Map(), new Map());

    // Apply scenarios
    const receiptMods = new Map<string, number>();
    const expenseMods = new Map<string, number>();

    for (const scenario of scenarios) {
      const key = `${scenario.month}-${scenario.year}`;
      if (scenario.type === 'add_receipt') {
        receiptMods.set(key, (receiptMods.get(key) || 0) + (scenario.amount || 0));
      } else if (scenario.type === 'remove_expense') {
        expenseMods.set(key, (expenseMods.get(key) || 0) - (scenario.amount || 0));
      } else if (scenario.type === 'delay_expense') {
        // Move expense to next month
        const currentIdx = rangeMonths.findIndex(m => `${m.month}-${m.year}` === key);
        if (currentIdx >= 0 && currentIdx < rangeMonths.length - 1) {
          expenseMods.set(key, (expenseMods.get(key) || 0) - (scenario.amount || 0));
          const nextMonth = rangeMonths[currentIdx + 1];
          const nextKey = `${nextMonth.month}-${nextMonth.year}`;
          expenseMods.set(nextKey, (expenseMods.get(nextKey) || 0) + (scenario.amount || 0));
        }
      } else if (scenario.type === 'change_amount') {
        // Generic adjustment
        if (scenario.adjustment === 'increase_receipt') {
          receiptMods.set(key, (receiptMods.get(key) || 0) + (scenario.amount || 0));
        } else if (scenario.adjustment === 'decrease_expense') {
          expenseMods.set(key, (expenseMods.get(key) || 0) - (scenario.amount || 0));
        }
      }
    }

    const modifiedData = buildMonthlyData(receiptMods, expenseMods);

    const originalForecast = originalData.length > 0 ? originalData[originalData.length - 1].closingBalance : currentBalance;
    const modifiedForecast = modifiedData.length > 0 ? modifiedData[modifiedData.length - 1].closingBalance : currentBalance;

    const originalDeficitTotal = originalData.filter(m => m.closingBalance < 0).reduce((s, m) => s + Math.abs(m.closingBalance), 0);
    const modifiedDeficitTotal = modifiedData.filter(m => m.closingBalance < 0).reduce((s, m) => s + Math.abs(m.closingBalance), 0);

    return NextResponse.json({
      original: {
        monthlyData: originalData,
        forecastClosing: originalForecast,
        deficitMonths: originalData.filter(m => m.isDeficit).length,
        totalDeficit: originalDeficitTotal,
      },
      modified: {
        monthlyData: modifiedData,
        forecastClosing: modifiedForecast,
        deficitMonths: modifiedData.filter(m => m.isDeficit).length,
        totalDeficit: modifiedDeficitTotal,
      },
      impact: {
        netChange: modifiedForecast - originalForecast,
        deficitReduction: originalDeficitTotal - modifiedDeficitTotal,
        monthsImproved: originalData.filter((m, i) => m.isDeficit && !modifiedData[i].isDeficit).length,
      },
      appliedScenarios: scenarios,
    });
  } catch (error) {
    console.error('What-if API error:', error);
    return NextResponse.json({ error: 'Failed to calculate what-if scenario' }, { status: 500 });
  }
}
