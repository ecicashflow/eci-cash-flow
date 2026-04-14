import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const startDate = sp.get('startDate');
    const endDate = sp.get('endDate');

    if (!startDate || !endDate) {
      return NextResponse.json({ error: 'startDate and endDate query params are required' }, { status: 400 });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return NextResponse.json({ error: 'Invalid date format for startDate or endDate' }, { status: 400 });
    }

    // Fetch all budgets within the date range (by month/year)
    const budgets = await db.budget.findMany({
      where: {
        OR: [
          {
            AND: [{ year: { gte: start.getFullYear() } }, { year: { lte: end.getFullYear() } }],
          },
        ],
      },
    });

    // Filter budgets to only those whose month/year fall within the range
    const filteredBudgets = budgets.filter((b) => {
      const budgetDate = new Date(b.year, b.month - 1, 1);
      return budgetDate >= start && budgetDate <= end;
    });

    // Fetch all expenses within the date range
    const expenses = await db.expense.findMany({
      where: {
        date: { gte: start, lte: end },
      },
    });

    // Group budgets by category
    const budgetByCategory: Record<string, number> = {};
    for (const b of filteredBudgets) {
      const key = b.category.toLowerCase();
      budgetByCategory[key] = (budgetByCategory[key] || 0) + b.budgetedAmt;
    }

    // Group actual expenses by category
    const actualByCategory: Record<string, number> = {};
    for (const e of expenses) {
      const key = e.category.toLowerCase();
      actualByCategory[key] = (actualByCategory[key] || 0) + e.amount;
    }

    // Merge all categories
    const allCategories = new Set([...Object.keys(budgetByCategory), ...Object.keys(actualByCategory)]);

    const summary = Array.from(allCategories).map((cat) => {
      const budgeted = budgetByCategory[cat] || 0;
      const actual = actualByCategory[cat] || 0;
      const variance = budgeted - actual;
      const variancePct = budgeted > 0 ? (variance / budgeted) * 100 : 0;

      return {
        category: cat,
        budgeted: Math.round(budgeted * 100) / 100,
        actual: Math.round(actual * 100) / 100,
        variance: Math.round(variance * 100) / 100,
        variancePct: Math.round(variancePct * 100) / 100,
      };
    });

    // Sort alphabetically by category
    summary.sort((a, b) => a.category.localeCompare(b.category));

    return NextResponse.json(summary);
  } catch (error) {
    console.error('Budget summary GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch budget summary' }, { status: 500 });
  }
}
