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

    // Validate FY year
    if (isNaN(fyStart) || fyStart < 2000 || fyStart > 2100) {
      return NextResponse.json({ error: 'Invalid year parameter' }, { status: 400 });
    }

    // Get settings with fallbacks
    const settings = await db.setting.findMany();
    const settingsMap: Record<string, string> = {};
    for (const s of settings) settingsMap[s.key] = s.value;
    const profitMarginPct = parseFloat(settingsMap.profit_margin_pct || '12') / 100;
    const operationalMarginPct = parseFloat(settingsMap.operational_margin_pct || '9') / 100;

    // Get bank accounts (only active)
    const bankAccounts = await db.bankAccount.findMany({ where: { active: true } });
    const currentBalance = bankAccounts.reduce((sum, a) => sum + a.currentBalance, 0);

    // Get all receipts and expenses
    const fyMonths = getFYMonths(fyStart);
    const fyYearSet = new Set(fyMonths.map(m => m.year));
    const allReceipts = await db.receipt.findMany();
    const allExpenses = await db.expense.findMany();

    // Filter to FY only for monthly calculations
    const fyReceipts = allReceipts.filter(r => fyYearSet.has(r.year));
    const fyExpenses = allExpenses.filter(e => fyYearSet.has(e.year));

    // Calculate monthly data - THIS IS THE CORE EXCEL LOGIC
    const monthlyData = [];
    let runningBalance = currentBalance;

    for (const { month, year } of fyMonths) {
      const monthReceipts = fyReceipts
        .filter(r => r.month === month && r.year === year)
        .reduce((sum, r) => sum + r.amount, 0);

      const monthExpenses = fyExpenses
        .filter(e => e.month === month && e.year === year)
        .reduce((sum, e) => sum + e.amount, 0);

      const monthOperational = fyExpenses
        .filter(e => e.month === month && e.year === year && e.isOperational)
        .reduce((sum, e) => sum + e.amount, 0);

      // Count transactions for audit
      const receiptCount = fyReceipts.filter(r => r.month === month && r.year === year).length;
      const expenseCount = fyExpenses.filter(e => e.month === month && e.year === year).length;

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
    const fyTotalReceipts = fyReceipts.reduce((sum, r) => sum + r.amount, 0);
    const fyTotalExpenses = fyExpenses.reduce((sum, e) => sum + e.amount, 0);
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
    const categoryMap = new Map<string, { amount: number; isOperational: boolean }>();
    for (const e of fyExpenses) {
      const existing = categoryMap.get(e.category) || { amount: 0, isOperational: e.isOperational };
      categoryMap.set(e.category, { amount: existing.amount + e.amount, isOperational: existing.isOperational });
    }
    const categoryBreakdown = Array.from(categoryMap.entries())
      .map(([category, data]) => ({ category, totalAmount: data.amount, isOperational: data.isOperational }))
      .sort((a, b) => b.totalAmount - a.totalAmount);

    // Project breakdown
    const projectReceiptMap = new Map<string, number>();
    for (const r of fyReceipts) {
      projectReceiptMap.set(r.clientProject, (projectReceiptMap.get(r.clientProject) || 0) + r.amount);
    }
    const projectExpenseMap = new Map<string, number>();
    for (const e of fyExpenses) {
      if (e.project) {
        projectExpenseMap.set(e.project, (projectExpenseMap.get(e.project) || 0) + e.amount);
      }
    }
    const allProjects = new Set([...projectReceiptMap.keys(), ...projectExpenseMap.keys()]);
    const projectBreakdown = Array.from(allProjects).map(project => ({
      project,
      totalReceipts: projectReceiptMap.get(project) || 0,
      totalExpenses: projectExpenseMap.get(project) || 0,
      netFlow: (projectReceiptMap.get(project) || 0) - (projectExpenseMap.get(project) || 0),
    })).sort((a, b) => b.totalReceipts - a.totalReceipts);

    // Available FY years for selector
    const receiptYears = new Set(allReceipts.map(r => r.year));
    const expenseYears = new Set(allExpenses.map(e => e.year));
    const allYears = new Set([...receiptYears, ...expenseYears, fyStart]);
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
      bankAccounts: bankAccounts.map(a => ({ id: a.id, bankName: a.bankName, accountName: a.accountName, currentBalance: a.currentBalance })),
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
