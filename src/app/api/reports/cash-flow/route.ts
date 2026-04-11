import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const fyStart = parseInt(sp.get('year') || '2026');

    const receipts = await db.receipt.findMany();
    const expenses = await db.expense.findMany();
    const bankAccounts = await db.bankAccount.findMany({ where: { active: true } });
    const currentBalance = bankAccounts.reduce((sum, a) => sum + a.currentBalance, 0);

    const fyMonths = [
      { month: 4, year: fyStart }, { month: 5, year: fyStart }, { month: 6, year: fyStart },
      { month: 7, year: fyStart }, { month: 8, year: fyStart }, { month: 9, year: fyStart },
      { month: 10, year: fyStart }, { month: 11, year: fyStart }, { month: 12, year: fyStart },
      { month: 1, year: fyStart + 1 }, { month: 2, year: fyStart + 1 }, { month: 3, year: fyStart + 1 },
    ];

    const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthlyData = [];
    let runningBalance = currentBalance;

    for (const { month, year } of fyMonths) {
      const mr = receipts.filter(r => r.month === month && r.year === year).reduce((s, r) => s + r.amount, 0);
      const me = expenses.filter(e => e.month === month && e.year === year).reduce((s, e) => s + e.amount, 0);
      const mo = expenses.filter(e => e.month === month && e.year === year && e.isOperational).reduce((s, e) => s + e.amount, 0);
      const opening = runningBalance;
      const closing = opening + mr - me;
      monthlyData.push({ month, year, label: `${MONTH_NAMES[month - 1]} ${year}`, openingBalance: opening, totalReceipts: mr, totalExpenses: me, netCashFlow: mr - me, closingBalance: closing, operationalExpenses: mo, isDeficit: closing < 0 });
      runningBalance = closing;
    }

    return NextResponse.json({ currentBalance, monthlyData });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 });
  }
}
