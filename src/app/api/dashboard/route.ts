import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Financial year months in order: Apr -> Mar
function getFYMonths(startYear: number) {
  return [
    { month: 4, year: startYear },
    { month: 5, year: startYear },
    { month: 6, year: startYear },
    { month: 7, year: startYear },
    { month: 8, year: startYear },
    { month: 9, year: startYear },
    { month: 10, year: startYear },
    { month: 11, year: startYear },
    { month: 12, year: startYear },
    { month: 1, year: startYear + 1 },
    { month: 2, year: startYear + 1 },
    { month: 3, year: startYear + 1 },
  ];
}

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const fyStart = parseInt(sp.get('year') || '2026');
    const warningThreshold = parseFloat(sp.get('threshold') || '500000');

    if (isNaN(fyStart) || fyStart < 2000 || fyStart > 2100) {
      return NextResponse.json({ error: 'Invalid year parameter' }, { status: 400 });
    }

    const fyMonths = getFYMonths(fyStart);
    const fyYearSet = new Set(fyMonths.map(m => m.year));
    const fyYears = Array.from(fyYearSet);

    // Batch 1: Core data (settings + bank accounts)
    const [settings, bankAccounts] = await Promise.all([
      db.setting.findMany(),
      db.bankAccount.findMany({ where: { active: true }, select: { id: true, bankName: true, accountName: true, currentBalance: true } }),
    ]);

    // Build settings map
    const settingsMap: Record<string, string> = {};
    for (const s of settings) settingsMap[s.key] = s.value;
    const profitMarginPct = parseFloat(settingsMap.profit_margin_pct || '12') / 100;
    const operationalMarginPct = parseFloat(settingsMap.operational_margin_pct || '9') / 100;

    // Current balance from bank accounts
    const currentBalance = bankAccounts.reduce((sum, a) => sum + a.currentBalance, 0);

    // Batch 2: Receipt aggregations
    const [receiptSums, receiptCounts, receiptProjects, allReceiptYears] = await Promise.all([
      db.receipt.groupBy({ by: ['month', 'year'], _sum: { amount: true }, where: { year: { in: fyYears } } }),
      db.receipt.groupBy({ by: ['month', 'year'], _count: true, where: { year: { in: fyYears } } }),
      db.receipt.groupBy({ by: ['clientProject'], _sum: { amount: true }, where: { year: { in: fyYears } } }),
      db.receipt.findMany({ select: { year: true }, distinct: ['year'] }),
    ]);

    // Batch 3: Expense aggregations
    const [expenseSums, operationalSums, expenseCounts, expenseCategories, expenseProjects, allExpenseYears] = await Promise.all([
      db.expense.groupBy({ by: ['month', 'year'], _sum: { amount: true }, where: { year: { in: fyYears } } }),
      db.expense.groupBy({ by: ['month', 'year'], _sum: { amount: true }, where: { year: { in: fyYears }, isOperational: true } }),
      db.expense.groupBy({ by: ['month', 'year'], _count: true, where: { year: { in: fyYears } } }),
      db.expense.groupBy({ by: ['category', 'isOperational'], _sum: { amount: true }, where: { year: { in: fyYears } } }),
      db.expense.groupBy({ by: ['project'], _sum: { amount: true }, where: { year: { in: fyYears }, project: { not: '' } } }),
      db.expense.findMany({ select: { year: true }, distinct: ['year'] }),
    ]);

    // Build lookup maps from grouped data
    const receiptSumMap = new Map<string, number>();
    for (const r of receiptSums) receiptSumMap.set(`${r.month}-${r.year}`, r._sum.amount || 0);

    const expenseSumMap = new Map<string, number>();
    for (const e of expenseSums) expenseSumMap.set(`${e.month}-${e.year}`, e._sum.amount || 0);

    const opsSumMap = new Map<string, number>();
    for (const e of operationalSums) opsSumMap.set(`${e.month}-${e.year}`, e._sum.amount || 0);

    const receiptCountMap = new Map<string, number>();
    for (const r of receiptCounts) receiptCountMap.set(`${r.month}-${r.year}`, r._count);

    const expenseCountMap = new Map<string, number>();
    for (const e of expenseCounts) expenseCountMap.set(`${e.month}-${e.year}`, e._count);

    // Calculate monthly data - CORE EXCEL LOGIC
    const monthlyData = [];
    let runningBalance = currentBalance;

    for (const { month, year } of fyMonths) {
      const key = `${month}-${year}`;
      const monthReceipts = receiptSumMap.get(key) || 0;
      const monthExpenses = expenseSumMap.get(key) || 0;
      const monthOperational = opsSumMap.get(key) || 0;
      const receiptCount = receiptCountMap.get(key) || 0;
      const expenseCount = expenseCountMap.get(key) || 0;

      const netCashFlow = monthReceipts - monthExpenses;
      const openingBalance = runningBalance;
      const closingBalance = openingBalance + monthReceipts - monthExpenses;

      monthlyData.push({
        month,
        year,
        monthLabel: `${MONTH_NAMES[month - 1]} ${year}`,
        totalReceipts: monthReceipts,
        totalExpenses: monthExpenses,
        netCashFlow,
        openingBalance,
        closingBalance,
        totalOperationalExpenses: monthOperational,
        receiptCount,
        expenseCount,
        warningFlag: closingBalance < 0,
        fundingGap: closingBalance < 0 ? Math.abs(closingBalance) : 0,
      });

      runningBalance = closingBalance;
    }

    // FY totals
    const fyTotalReceipts = monthlyData.reduce((sum, m) => sum + m.totalReceipts, 0);
    const fyTotalExpenses = monthlyData.reduce((sum, m) => sum + m.totalExpenses, 0);
    const netCashFlow = fyTotalReceipts - fyTotalExpenses;
    const forecastClosingBalance = currentBalance + netCashFlow;

    // Warnings
    const negativeMonths = monthlyData.filter(m => m.closingBalance < 0);
    const lowCashMonths = monthlyData.filter(m => m.closingBalance >= 0 && m.closingBalance < warningThreshold);
    const fundingGapTotal = negativeMonths.reduce((sum, m) => sum + m.fundingGap, 0);

    // Shortfall Analysis
    const totalDeficit = forecastClosingBalance < 0 ? Math.abs(forecastClosingBalance) : 0;
    const additionalBusinessRequired = forecastClosingBalance < 0 ? totalDeficit / profitMarginPct : 0;
    const profitMargin = additionalBusinessRequired * operationalMarginPct;
    const netBalanceAfterRecovery = profitMargin + forecastClosingBalance;

    // Category breakdown
    const categoryBreakdown = expenseCategories
      .map(e => ({ category: e.category, totalAmount: e._sum.amount || 0, isOperational: e.isOperational }))
      .filter(e => e.totalAmount > 0)
      .sort((a, b) => b.totalAmount - a.totalAmount);

    // Project breakdown
    const projectReceiptMap = new Map<string, number>();
    for (const r of receiptProjects) projectReceiptMap.set(r.clientProject, r._sum.amount || 0);
    const projectExpenseMap = new Map<string, number>();
    for (const e of expenseProjects) projectExpenseMap.set(e.project, e._sum.amount || 0);
    const allProjectKeys = new Set([...projectReceiptMap.keys(), ...projectExpenseMap.keys()]);
    const projectBreakdown = Array.from(allProjectKeys).map(project => ({
      project,
      totalReceipts: projectReceiptMap.get(project) || 0,
      totalExpenses: projectExpenseMap.get(project) || 0,
      netFlow: (projectReceiptMap.get(project) || 0) - (projectExpenseMap.get(project) || 0),
    })).sort((a, b) => b.totalReceipts - a.totalReceipts);

    // Available FY years
    const allYears = new Set([
      ...allReceiptYears.map(r => r.year),
      ...allExpenseYears.map(e => e.year),
      fyStart,
    ]);
    const availableFYs = Array.from(allYears).sort().map(y => String(y));

    return NextResponse.json({
      currentBalance,
      totalExpectedReceipts: fyTotalReceipts,
      totalExpectedExpenses: fyTotalExpenses,
      netCashFlow,
      forecastClosingBalance,
      monthlyData,
      warnings: {
        negativeMonths: negativeMonths.map(m => ({ month: m.month, year: m.year, label: m.monthLabel, closingBalance: m.closingBalance, fundingGap: m.fundingGap })),
        lowCashMonths: lowCashMonths.map(m => ({ month: m.month, year: m.year, label: m.monthLabel, closingBalance: m.closingBalance })),
        fundingGapTotal,
      },
      bankAccounts,
      shortfallAnalysis: {
        totalDeficit,
        additionalBusinessRequired,
        profitMargin,
        netBalanceAfterRecovery,
        profitMarginPct,
        operationalMarginPct,
      },
      categoryBreakdown,
      projectBreakdown,
      settings: settingsMap,
      availableFYs,
      fyYear: fyStart,
    });
  } catch (error) {
    console.error('Dashboard API error:', error);
    return NextResponse.json({ error: 'Failed to fetch dashboard data' }, { status: 500 });
  }
}
