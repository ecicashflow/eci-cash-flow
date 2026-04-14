import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const startStr = sp.get('startDate');
    const endStr = sp.get('endDate');
    if (!startStr || !endStr) return NextResponse.json({ error: 'Dates required' }, { status: 400 });

    const startDate = new Date(startStr);
    const endDate = new Date(endStr);

    const rangeMonths: { month: number; year: number }[] = [];
    const cur = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    const end = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
    while (cur <= end) {
      rangeMonths.push({ month: cur.getMonth() + 1, year: cur.getFullYear() });
      cur.setMonth(cur.getMonth() + 1);
    }
    const rangeYears = Array.from(new Set(rangeMonths.map(m => m.year)));

    const [bankAccounts, receipts, expenses] = await Promise.all([
      db.bankAccount.findMany({ where: { active: true } }),
      db.receipt.findMany({ where: { year: { in: rangeYears } } }),
      db.expense.findMany({ where: { year: { in: rangeYears } } }),
    ]);

    const currentBalance = bankAccounts.reduce((s, a) => s + a.currentBalance, 0);
    const rangeKeys = new Set(rangeMonths.map(m => `${m.month}-${m.year}`));

    const receiptMap = new Map<string, number>();
    const expenseMap = new Map<string, number>();
    const expectedByClient = new Map<string, { total: number; months: { month: number; year: number; amount: number }[] }>();

    for (const r of receipts) {
      const key = `${r.month}-${r.year}`;
      if (!rangeKeys.has(key)) continue;
      receiptMap.set(key, (receiptMap.get(key) || 0) + r.amount);
      if (r.status === 'Expected') {
        const existing = expectedByClient.get(r.clientProject) || { total: 0, months: [] };
        existing.total += r.amount;
        existing.months.push({ month: r.month, year: r.year, amount: r.amount });
        expectedByClient.set(r.clientProject, existing);
      }
    }

    for (const e of expenses) {
      const key = `${e.month}-${e.year}`;
      if (!rangeKeys.has(key)) continue;
      expenseMap.set(key, (expenseMap.get(key) || 0) + e.amount);
    }

    // Build original cash flow
    let running = currentBalance;
    const originalMonthly: { month: number; year: number; closingBalance: number; isDeficit: boolean }[] = [];
    for (const { month, year } of rangeMonths) {
      const key = `${month}-${year}`;
      const r = receiptMap.get(key) || 0;
      const e = expenseMap.get(key) || 0;
      running = running + r - e;
      originalMonthly.push({ month, year, closingBalance: running, isDeficit: running < 0 });
    }

    const deficitMonths = originalMonthly.filter(m => m.isDeficit);
    const scenarios: { id: string; type: string; label: string; month: number; year: number; amount: number; description: string; adjustment?: string; expectedImpact: string }[] = [];
    let idx = 0;

    // Scenario 1: Collect ALL pending receivables now
    const totalPending = Array.from(expectedByClient.values()).reduce((s, c) => s + c.total, 0);
    if (totalPending > 0) {
      const now = new Date();
      const nextMonth = rangeMonths.find(m => m.year >= now.getFullYear() && m.month >= now.getMonth() + 1) || rangeMonths[0];
      scenarios.push({
        id: `auto-${idx++}`,
        type: 'add_receipt',
        label: 'Collect All Pending Receivables',
        month: nextMonth.month,
        year: nextMonth.year,
        amount: totalPending,
        description: `Collect PKR ${totalPending.toLocaleString()} from ${expectedByClient.size} pending client(s) — moves all expected receipts to next month`,
        expectedImpact: `Adds PKR ${totalPending.toLocaleString()} to ${MONTH_NAMES[nextMonth.month - 1]} ${nextMonth.year}, potentially eliminating ${deficitMonths.length} deficit month(s)`,
      });
    }

    // Scenario 2: Reduce top operational expenses by 15%
    const opexByMonth = new Map<string, number>();
    const allInRangeExpenses = expenses.filter(e => rangeKeys.has(`${e.month}-${e.year}`) && e.isOperational);
    for (const e of allInRangeExpenses) {
      const key = `${e.month}-${e.year}`;
      opexByMonth.set(key, (opexByMonth.get(key) || 0) + e.amount);
    }
    let totalOpex = Array.from(opexByMonth.values()).reduce((s, v) => s + v, 0);
    if (totalOpex > 0) {
      const reduction15 = Math.round(totalOpex * 0.15);
      const avgOpexMonthly = Math.round(totalOpex / Math.max(opexByMonth.size, 1));
      const firstDeficit = deficitMonths[0];
      const targetMonth = firstDeficit || rangeMonths[0];
      scenarios.push({
        id: `auto-${idx++}`,
        type: 'decrease_expense',
        label: 'Reduce Operational Costs by 15%',
        month: targetMonth.month,
        year: targetMonth.year,
        amount: reduction15,
        description: `Cut PKR ${reduction15.toLocaleString()} from operational expenses (15% of total PKR ${totalOpex.toLocaleString()})`,
        adjustment: 'decrease_expense',
        expectedImpact: `Saves PKR ${reduction15.toLocaleString()}, extends cash runway`,
      });
    }

    // Scenario 3: Delay all operational expenses by 1 month for each deficit month
    if (deficitMonths.length > 0) {
      for (const dm of deficitMonths.slice(0, 2)) {
        const key = `${dm.month}-${dm.year}`;
        const opex = opexByMonth.get(key) || 0;
        if (opex > 0) {
          scenarios.push({
            id: `auto-${idx++}`,
            type: 'delay_expense',
            label: `Delay OpEx in ${MONTH_NAMES[dm.month - 1]} ${dm.year}`,
            month: dm.month,
            year: dm.year,
            amount: opex,
            description: `Defer PKR ${opex.toLocaleString()} operational expenses from ${MONTH_NAMES[dm.month - 1]} ${dm.year} to the following month`,
            expectedImpact: `Could recover ${MONTH_NAMES[dm.month - 1]} ${dm.year} from deficit`,
          });
        }
      }
    }

    // Scenario 4: Secure emergency line of credit to cover total deficit
    const totalDeficit = deficitMonths.reduce((s, m) => s + Math.abs(m.closingBalance), 0);
    if (totalDeficit > 0) {
      const firstDeficit = deficitMonths[0] || rangeMonths[0];
      scenarios.push({
        id: `auto-${idx++}`,
        type: 'add_receipt',
        label: 'Emergency Credit Line',
        month: firstDeficit.month,
        year: firstDeficit.year,
        amount: totalDeficit,
        description: `Obtain bridge financing of PKR ${totalDeficit.toLocaleString()} to cover all ${deficitMonths.length} deficit month(s)`,
        expectedImpact: `Eliminates all deficit months, closing at PKR ${(originalMonthly[originalMonthly.length - 1]?.closingBalance + totalDeficit || 0).toLocaleString()}`,
      });
    }

    // Scenario 5: Collect top pending client
    const topClient = Array.from(expectedByClient.entries()).sort((a, b) => b[1].total - a[1].total)[0];
    if (topClient && topClient[1].total > 0) {
      const now = new Date();
      const nextMonth = rangeMonths.find(m => m.year >= now.getFullYear() && m.month >= now.getMonth() + 1) || rangeMonths[0];
      scenarios.push({
        id: `auto-${idx++}`,
        type: 'add_receipt',
        label: `Collect from ${topClient[0]}`,
        month: nextMonth.month,
        year: nextMonth.year,
        amount: topClient[1].total,
        description: `Expedite payment of PKR ${topClient[1].total.toLocaleString()} from ${topClient[0]}`,
        expectedImpact: `Single largest receivable collection — PKR ${topClient[1].total.toLocaleString()} immediate inflow`,
      });
    }

    return NextResponse.json({
      scenarios: scenarios.slice(0, 6),
      summary: {
        currentBalance,
        totalPending,
        totalDeficit,
        deficitMonthsCount: deficitMonths.length,
        scenarioCount: scenarios.length,
      },
    });
  } catch (error) {
    console.error('Auto-scenarios error:', error);
    return NextResponse.json({ error: 'Failed to generate auto scenarios' }, { status: 500 });
  }
}
