import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';

// ─── Helpers ───────────────────────────────────────────────────────────────────
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function rnd(v: number): number {
  return Math.round(v * 100) / 100;
}

function fmtMonth(month: number, year: number): string {
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

function daysBetween(a: Date, b: Date): number {
  return Math.ceil((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

function getMonthsInRange(startDate: Date, endDate: Date): { month: number; year: number }[] {
  const months: { month: number; year: number }[] = [];
  const cur = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  const end = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
  while (cur <= end) {
    months.push({ month: cur.getMonth() + 1, year: cur.getFullYear() });
    cur.setMonth(cur.getMonth() + 1);
  }
  return months;
}

// ─── GET Handler ───────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const startDateStr = sp.get('startDate');
    const endDateStr = sp.get('endDate');

    if (!startDateStr || !endDateStr) {
      return NextResponse.json({ error: 'startDate and endDate are required' }, { status: 400 });
    }

    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || startDate > endDate) {
      return NextResponse.json({ error: 'Invalid date range' }, { status: 400 });
    }

    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    const rangeMonths = getMonthsInRange(startDate, endDate);
    const rangeMonthKeys = new Set(rangeMonths.map(m => `${m.month}-${m.year}`));
    const rangeYears = Array.from(new Set(rangeMonths.map(m => m.year)));

    // ─── PHASE 1: Parallel Data Fetch ──────────────────────────────────────────
    const [
      settings,
      bankAccounts,
      allReceipts,
      allExpenses,
      allBudgets,
      allGoals,
      allInvoices,
      allRecurring,
      allCategories,
      allAlerts,
      projectClients,
    ] = await Promise.all([
      db.setting.findMany(),
      db.bankAccount.findMany({ where: { active: true } }),
      db.receipt.findMany({ where: { year: { in: rangeYears } } }),
      db.expense.findMany({ where: { year: { in: rangeYears } } }),
      db.budget.findMany({
        where: { year: { in: rangeYears } },
      }),
      db.goal.findMany(),
      db.invoice.findMany(),
      db.recurringExpense.findMany({ where: { active: true } }),
      db.category.findMany({ where: { active: true } }),
      db.cashFlowAlert.findMany({ where: { isRead: false } }),
      db.projectClient.findMany({ where: { active: true } }),
    ]);

    // Settings map
    const settingsMap: Record<string, string> = {};
    for (const s of settings) settingsMap[s.key] = s.value;
    const warningThreshold = parseFloat(settingsMap.warning_threshold_balance || '500000');
    const companyName = settingsMap.company_name || 'ECI';
    const profitMarginPct = parseFloat(settingsMap.profit_margin_pct || '12') / 100;

    // Current balance
    const currentBalance = rnd(bankAccounts.reduce((s, a) => s + a.currentBalance, 0));

    // ─── Filter data to date range ─────────────────────────────────────────────
    const receiptsInRange = allReceipts.filter(r => rangeMonthKeys.has(`${r.month}-${r.year}`));
    const expensesInRange = allExpenses.filter(e => rangeMonthKeys.has(`${e.month}-${e.year}`));
    const budgetsInRange = allBudgets.filter(b => rangeMonthKeys.has(`${b.month}-${b.year}`));

    // ─── Aggregate helpers ─────────────────────────────────────────────────────
    // Receipts grouped by month
    const receiptsByMonth = new Map<string, typeof receiptsInRange>();
    for (const r of receiptsInRange) {
      const key = `${r.month}-${r.year}`;
      if (!receiptsByMonth.has(key)) receiptsByMonth.set(key, []);
      receiptsByMonth.get(key)!.push(r);
    }

    // Expenses grouped by month
    const expensesByMonth = new Map<string, typeof expensesInRange>();
    for (const e of expensesInRange) {
      const key = `${e.month}-${e.year}`;
      if (!expensesByMonth.has(key)) expensesByMonth.set(key, []);
      expensesByMonth.get(key)!.push(e);
    }

    // Budgets grouped by category (summed across months)
    const budgetsByCategory = new Map<string, number>();
    for (const b of budgetsInRange) {
      const cat = b.category.toLowerCase();
      budgetsByCategory.set(cat, rnd((budgetsByCategory.get(cat) || 0) + b.budgetedAmt));
    }

    // Actual expenses by category
    const actualByCategory = new Map<string, number>();
    for (const e of expensesInRange) {
      const cat = e.category.toLowerCase();
      actualByCategory.set(cat, rnd((actualByCategory.get(cat) || 0) + e.amount));
    }

    // ─── Monthly cash flow with running balance ────────────────────────────────
    type MonthlyRow = {
      month: number; year: number; monthLabel: string;
      openingBalance: number; totalReceipts: number; totalExpenses: number;
      netCashFlow: number; closingBalance: number;
      operationalExpenses: number; projectExpenses: number;
      receiptItems: typeof receiptsInRange;
      expenseItems: typeof expensesInRange;
      isDeficit: boolean; isLowCash: boolean;
    };

    const monthlyData: MonthlyRow[] = [];
    let runningBalance = currentBalance;

    for (const { month, year } of rangeMonths) {
      const key = `${month}-${year}`;
      const rItems = receiptsByMonth.get(key) || [];
      const eItems = expensesByMonth.get(key) || [];
      const totalR = rnd(rItems.reduce((s, r) => s + r.amount, 0));
      const totalE = rnd(eItems.reduce((s, e) => s + e.amount, 0));
      const opsE = rnd(eItems.filter(e => e.isOperational).reduce((s, e) => s + e.amount, 0));
      const projE = rnd(totalE - opsE);
      const closing = rnd(runningBalance + totalR - totalE);

      monthlyData.push({
        month, year,
        monthLabel: fmtMonth(month, year),
        openingBalance: rnd(runningBalance),
        totalReceipts: totalR,
        totalExpenses: totalE,
        netCashFlow: rnd(totalR - totalE),
        closingBalance: closing,
        operationalExpenses: opsE,
        projectExpenses: projE,
        receiptItems: rItems,
        expenseItems: eItems,
        isDeficit: closing < 0,
        isLowCash: closing >= 0 && closing < warningThreshold,
      });
      runningBalance = closing;
    }

    const forecastClosing = monthlyData.length > 0 ? monthlyData[monthlyData.length - 1].closingBalance : currentBalance;
    const totalRangeReceipts = rnd(monthlyData.reduce((s, m) => s + m.totalReceipts, 0));
    const totalRangeExpenses = rnd(monthlyData.reduce((s, m) => s + m.totalExpenses, 0));
    const totalRangeNet = rnd(totalRangeReceipts - totalRangeExpenses);
    const avgMonthlyExpenses = monthlyData.length > 0 ? rnd(totalRangeExpenses / monthlyData.length) : 0;
    const avgMonthlyReceipts = monthlyData.length > 0 ? rnd(totalRangeReceipts / monthlyData.length) : 0;
    const dailyBurnRate = rnd(avgMonthlyExpenses / 30);

    // ─── (a) Overall Health ────────────────────────────────────────────────────
    const deficitMonths = monthlyData.filter(m => m.isDeficit);
    const lowCashMonths = monthlyData.filter(m => m.isLowCash);

    // Score calculation (0-100)
    let healthScore = 100;
    healthScore -= deficitMonths.length * 25;
    healthScore -= lowCashMonths.length * 10;
    if (currentBalance < warningThreshold) healthScore -= 15;
    if (currentBalance < 0) healthScore -= 20;

    // Budget adherence bonus/penalty
    let budgetAdherencePct = 100;
    const allBudgetCats = new Set([...budgetsByCategory.keys(), ...actualByCategory.keys()]);
    const budgetStatuses: { category: string; budgeted: number; actual: number; variance: number; variancePct: number; status: string }[] = [];
    for (const cat of allBudgetCats) {
      const budgeted = budgetsByCategory.get(cat) || 0;
      const actual = actualByCategory.get(cat) || 0;
      const variance = rnd(budgeted - actual);
      const variancePct = budgeted > 0 ? rnd((variance / budgeted) * 100) : 0;
      const status = variancePct <= -10 ? 'overspent' : variancePct <= 0 ? 'caution' : 'on-track';
      budgetStatuses.push({ category: cat, budgeted, actual, variance, variancePct, status });
    }
    const overspentCount = budgetStatuses.filter(b => b.status === 'overspent').length;
    healthScore -= overspentCount * 5;

    // Invoice overdue penalty
    const overdueInvoices = allInvoices.filter(inv => inv.status === 'Overdue');
    healthScore -= Math.min(overdueInvoices.length * 3, 20);

    // Goals overdue penalty
    const overdueGoals = allGoals.filter(g => g.status === 'active' && new Date(g.targetDate) < now);
    healthScore -= Math.min(overdueGoals.length * 5, 15);

    // No data penalty - if there are no receipts AND no expenses in range, the health is unknown/critical
    if (receiptsInRange.length === 0 && expensesInRange.length === 0) {
      healthScore = Math.min(healthScore, 5); // No data = CRITICAL (unknown)
    }
    // Very low receipts vs expenses ratio penalty
    if (totalRangeReceipts > 0 && totalRangeExpenses > 0 && (totalRangeReceipts / totalRangeExpenses) < 0.5) {
      healthScore -= 20;
    }

    // Final clamp AFTER all deductions to ensure score stays in 0-100 range
    healthScore = Math.max(0, Math.min(100, healthScore));

    let overallHealth: 'CRITICAL' | 'WARNING' | 'HEALTHY';
    if (healthScore < 40) overallHealth = 'CRITICAL';
    else if (healthScore < 70) overallHealth = 'WARNING';
    else overallHealth = 'HEALTHY';

    // ─── (b) Executive Summary (LLM) ──────────────────────────────────────────
    const keyMetrics = {
      companyName,
      period: `${fmtMonth(rangeMonths[0]?.month || 4, rangeMonths[0]?.year || 2025)} to ${fmtMonth(rangeMonths[rangeMonths.length - 1]?.month || 3, rangeMonths[rangeMonths.length - 1]?.year || 2026)}`,
      overallHealth,
      healthScore,
      currentBalancePKR: currentBalance,
      forecastClosingPKR: forecastClosing,
      totalReceiptsPKR: totalRangeReceipts,
      totalExpensesPKR: totalRangeExpenses,
      netCashFlowPKR: totalRangeNet,
      avgMonthlyReceiptsPKR: avgMonthlyReceipts,
      avgMonthlyExpensesPKR: avgMonthlyExpenses,
      cashRunwayMonths: avgMonthlyExpenses > 0 ? Math.floor(currentBalance / avgMonthlyExpenses) : 999,
      deficitMonthsCount: deficitMonths.length,
      lowCashMonthsCount: lowCashMonths.length,
      totalOutstandingInvoicesPKR: rnd(allInvoices.filter(i => i.status !== 'Paid' && i.status !== 'Cancelled').reduce((s, i) => s + i.amount, 0)),
      overdueInvoicesCount: overdueInvoices.length,
      overdueInvoicesPKR: rnd(overdueInvoices.reduce((s, i) => s + i.amount, 0)),
      pendingReceiptsPKR: rnd(receiptsInRange.filter(r => r.status === 'Expected').reduce((s, r) => s + r.amount, 0)),
      activeGoalsCount: allGoals.filter(g => g.status === 'active').length,
      overdueGoalsCount: overdueGoals.length,
      budgetsOverspentCount: overspentCount,
      budgetAdherencePct: budgetAdherencePct,
      topExpenseCategories: budgetStatuses.sort((a, b) => b.actual - a.actual).slice(0, 5).map(b => ({ category: b.category, amount: b.actual })),
      topPendingClients: getTopPendingClients(receiptsInRange, currentMonth, currentYear).slice(0, 5),
      unreadAlerts: allAlerts.length,
    };

    let executiveSummary = '';
    try {
      const zai = await ZAI.create();
      const completion = await zai.chat.completions.create({
        model: 'default',
        messages: [
          {
            role: 'system',
            content: `You are a senior financial advisor for a Pakistani development consultancy (ECI). Analyze the cash flow data and provide a clear, actionable executive summary in English.

CRITICAL RULES:
- If overallHealth is "CRITICAL" (score < 40), you MUST start with "Financial Health: CRITICAL" and emphasize urgency. NEVER say "healthy" or "stable" when the health is CRITICAL or WARNING.
- If overallHealth is "WARNING" (score < 70), use cautionary language. Do NOT describe the situation as healthy.
- If overallHealth is "HEALTHY" (score >= 70), you may describe the cash flow positively.
- Always be specific with amounts (in PKR), months, and client names.
- Use professional but accessible language. Format with line breaks for readability.
- Write 2-3 paragraphs covering: overall financial health assessment, key risks, and top 3-5 actionable recommendations.
- Use bullet points for recommendations.`,
          },
          {
            role: 'user',
            content: `Here is the cash flow data for ${keyMetrics.companyName}:\n${JSON.stringify(keyMetrics, null, 2)}`,
          },
        ],
        max_tokens: 1000,
        temperature: 0.7,
      });
      executiveSummary = completion.choices?.[0]?.message?.content || '';
    } catch (llmError) {
      console.error('LLM fallback:', llmError);
      // Fallback summary
      executiveSummary = generateFallbackSummary(keyMetrics);
    }

    // ─── (c) Cash Position ────────────────────────────────────────────────────
    const cashRunwayMonths = avgMonthlyExpenses > 0 ? Math.floor(currentBalance / avgMonthlyExpenses) : 999;
    const currentLiabilities = rnd(totalRangeExpenses / (monthlyData.length || 1) * 3); // proxy: 3 months of expenses
    const workingCapitalRatio = currentLiabilities > 0 ? rnd(currentBalance / currentLiabilities) : 999;

    const cashPosition = {
      currentBalance,
      forecastClosing,
      runwayMonths: cashRunwayMonths,
      dailyBurnRate,
      workingCapitalRatio: rnd(workingCapitalRatio),
      totalRangeReceipts,
      totalRangeExpenses,
      netCashFlow: totalRangeNet,
    };

    // ─── (d) Receivable Analysis ──────────────────────────────────────────────
    const expectedReceipts = receiptsInRange.filter(r => r.status === 'Expected');
    const receivedReceipts = receiptsInRange.filter(r => r.status === 'Received' || r.status === 'Confirmed');
    const totalExpected = rnd(expectedReceipts.reduce((s, r) => s + r.amount, 0));
    const totalReceived = rnd(receivedReceipts.reduce((s, r) => s + r.amount, 0));
    const collectionRate = totalExpected + totalReceived > 0 ? rnd((totalReceived / (totalExpected + totalReceived)) * 100) : 100;

    // Overdue receivables by client with aging
    function getTopPendingClients(receipts: typeof receiptsInRange, cm: number, cy: number) {
      const clientMap = new Map<string, { totalPending: number; totalReceived: number; monthsOverdue: string[] }>();
      for (const r of receipts) {
        if (r.status !== 'Expected') continue;
        const existing = clientMap.get(r.clientProject) || { totalPending: 0, totalReceived: 0, monthsOverdue: [] };
        existing.totalPending += r.amount;
        if (r.year < cy || (r.year === cy && r.month < cm)) {
          existing.monthsOverdue.push(fmtMonth(r.month, r.year));
        }
        clientMap.set(r.clientProject, existing);
      }
      for (const r of receipts.filter(r => r.status === 'Received' || r.status === 'Confirmed')) {
        const existing = clientMap.get(r.clientProject);
        if (existing) existing.totalReceived += r.amount;
      }
      return Array.from(clientMap.entries())
        .map(([client, info]) => ({ client, pending: rnd(info.totalPending), received: rnd(info.totalReceived), overdueMonths: info.monthsOverdue }))
        .sort((a, b) => b.pending - a.pending);
    }

    // Aging buckets
    const agingBuckets = { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 };
    for (const r of expectedReceipts) {
      const receiptDate = new Date(r.year, r.month - 1, 15);
      const daysOverdue = daysBetween(receiptDate, now);
      if (daysOverdue <= 0) continue;
      if (daysOverdue <= 30) agingBuckets['0-30'] += r.amount;
      else if (daysOverdue <= 60) agingBuckets['31-60'] += r.amount;
      else if (daysOverdue <= 90) agingBuckets['61-90'] += r.amount;
      else agingBuckets['90+'] += r.amount;
    }
    for (const key of Object.keys(agingBuckets)) {
      agingBuckets[key as keyof typeof agingBuckets] = rnd(agingBuckets[key as keyof typeof agingBuckets]);
    }

    const topPendingClients = getTopPendingClients(receiptsInRange, currentMonth, currentYear).slice(0, 5);
    const avgCollectionPeriod = receivedReceipts.length > 0 ? 30 : 45; // estimated

    const receivableAnalysis = {
      totalExpected,
      totalReceived,
      collectionRate,
      overdueReceivables: rnd(totalExpected),
      agingBuckets,
      topPendingClients,
      averageCollectionPeriodDays: avgCollectionPeriod,
      expectedCount: expectedReceipts.length,
      receivedCount: receivedReceipts.length,
    };

    // ─── (e) Expense Analysis ─────────────────────────────────────────────────
    const totalOpex = rnd(expensesInRange.filter(e => e.isOperational).reduce((s, e) => s + e.amount, 0));
    const totalProjectCosts = rnd(totalRangeExpenses - totalOpex);

    // Top spending categories
    const categorySpend = new Map<string, number>();
    for (const e of expensesInRange) {
      categorySpend.set(e.category, rnd((categorySpend.get(e.category) || 0) + e.amount));
    }
    const topCategories = Array.from(categorySpend.entries())
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10);

    // Month-over-month expense trend
    let expenseTrend: 'increasing' | 'decreasing' | 'stable' = 'stable';
    if (monthlyData.length >= 3) {
      const last3Avg = monthlyData.slice(-3).reduce((s, m) => s + m.totalExpenses, 0) / 3;
      const prev3Avg = monthlyData.slice(-6, -3).length > 0
        ? monthlyData.slice(-6, -3).reduce((s, m) => s + m.totalExpenses, 0) / 3
        : last3Avg;
      const changePct = prev3Avg > 0 ? (last3Avg - prev3Avg) / prev3Avg : 0;
      if (changePct > 0.1) expenseTrend = 'increasing';
      else if (changePct < -0.1) expenseTrend = 'decreasing';
    }

    // Operational efficiency ratio (opex / revenue)
    const opEfficiencyRatio = totalRangeReceipts > 0 ? rnd(totalOpex / totalRangeReceipts) : 0;

    // Cost anomalies (months where spending spiked >30% above average)
    const costAnomalies: { month: string; amount: number; average: number; spikePct: number }[] = [];
    for (const m of monthlyData) {
      if (m.totalExpenses > 0 && avgMonthlyExpenses > 0) {
        const spikePct = rnd(((m.totalExpenses - avgMonthlyExpenses) / avgMonthlyExpenses) * 100);
        if (spikePct > 30) {
          costAnomalies.push({
            month: m.monthLabel,
            amount: m.totalExpenses,
            average: avgMonthlyExpenses,
            spikePct,
          });
        }
      }
    }

    const expenseAnalysis = {
      totalOpex,
      totalProjectCosts,
      opexPctOfTotal: totalRangeExpenses > 0 ? rnd((totalOpex / totalRangeExpenses) * 100) : 0,
      topCategories,
      expenseTrend,
      operationalEfficiencyRatio: opEfficiencyRatio,
      costAnomalies,
      totalExpenses: totalRangeExpenses,
      avgMonthlyExpenses,
    };

    // ─── (f) Budget Adherence ─────────────────────────────────────────────────
    // (already computed budgetStatuses above, compute overall)
    const onTrackBudgets = budgetStatuses.filter(b => b.status === 'on-track');
    const overspentBudgets = budgetStatuses.filter(b => b.status === 'overspent');
    const totalBudgeted = rnd(Array.from(budgetsByCategory.values()).reduce((s, v) => s + v, 0));
    const totalActual = rnd(Array.from(actualByCategory.values()).reduce((s, v) => s + v, 0));
    budgetAdherencePct = totalBudgeted > 0 ? rnd((totalBudgeted / Math.max(totalBudgeted, totalActual)) * 100) : 100;
    const mostOverspent = [...budgetStatuses].sort((a, b) => a.variancePct - b.variancePct)[0] || null;
    const mostUnderSpent = [...budgetStatuses].sort((a, b) => b.variancePct - a.variancePct)[0] || null;

    const budgetAdherence = {
      categories: budgetStatuses.sort((a, b) => a.variancePct - b.variancePct),
      overallAdherencePct: budgetAdherencePct,
      onTrackCount: onTrackBudgets.length,
      overspentCount: overspentBudgets.length,
      cautionCount: budgetStatuses.length - onTrackBudgets.length - overspentBudgets.length,
      totalBudgeted,
      totalActual,
      mostOverspent: mostOverspent ? { category: mostOverspent.category, variancePct: mostOverspent.variancePct, amount: mostOverspent.actual } : null,
      mostUnderSpent: mostUnderSpent ? { category: mostUnderSpent.category, variancePct: mostUnderSpent.variancePct, amount: mostUnderSpent.actual } : null,
    };

    // ─── (g) Invoice Health ───────────────────────────────────────────────────
    let invTotalOutstanding = 0;
    let invTotalOverdue = 0;
    let invOverdueCount = 0;
    const daysToPayList: number[] = [];
    const invoiceAging = { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 };

    for (const inv of allInvoices) {
      if (inv.status === 'Paid') {
        if (inv.paidDate) {
          const diff = daysBetween(inv.createdAt, inv.paidDate);
          if (diff >= 0) daysToPayList.push(diff);
        }
      } else if (inv.status === 'Cancelled') {
        continue;
      } else {
        const isOverdue = inv.dueDate < now;
        if (isOverdue) {
          invTotalOverdue += inv.amount;
          invOverdueCount++;
          const days = daysBetween(inv.dueDate, now);
          if (days <= 30) invoiceAging['0-30'] += inv.amount;
          else if (days <= 60) invoiceAging['31-60'] += inv.amount;
          else if (days <= 90) invoiceAging['61-90'] += inv.amount;
          else invoiceAging['90+'] += inv.amount;
        } else {
          invTotalOutstanding += inv.amount;
        }
      }
    }

    const avgDaysToPay = daysToPayList.length > 0
      ? rnd(daysToPayList.reduce((s, d) => s + d, 0) / daysToPayList.length)
      : 0;

    const cashTiedUp = rnd(invTotalOutstanding + invTotalOverdue);

    // Projected collections based on due dates
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysFromNow = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
    const ninetyDaysFromNow = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

    let projected30 = 0;
    let projected60 = 0;
    let projected90 = 0;

    for (const inv of allInvoices) {
      if (inv.status === 'Paid' || inv.status === 'Cancelled') continue;
      if (inv.dueDate <= thirtyDaysFromNow) projected30 += inv.amount;
      if (inv.dueDate <= sixtyDaysFromNow) projected60 += inv.amount;
      if (inv.dueDate <= ninetyDaysFromNow) projected90 += inv.amount;
    }

    for (const key of Object.keys(invoiceAging)) {
      invoiceAging[key as keyof typeof invoiceAging] = rnd(invoiceAging[key as keyof typeof invoiceAging]);
    }

    const invoiceHealth = {
      totalOutstanding: rnd(invTotalOutstanding),
      totalOverdue: rnd(invTotalOverdue),
      overdueCount: invOverdueCount,
      avgDaysToPay,
      agingBreakdown: invoiceAging,
      cashTiedUp,
      projectedCollectionsNext30Days: rnd(projected30),
      projectedCollectionsNext60Days: rnd(projected60),
      projectedCollectionsNext90Days: rnd(projected90),
      totalInvoices: allInvoices.length,
    };

    // ─── (h) Goal Progress ────────────────────────────────────────────────────
    const activeGoals = allGoals.filter(g => g.status === 'active');
    const achievedGoals = allGoals.filter(g => g.status === 'achieved');

    const goalProgress = activeGoals.map(g => {
      const progress = g.targetAmount > 0 ? rnd((g.currentAmount / g.targetAmount) * 100) : 100;
      const daysRemaining = Math.max(0, daysBetween(now, new Date(g.targetDate)));
      const isOverdue = new Date(g.targetDate) < now;
      const monthsRemaining = Math.max(1, Math.ceil(daysRemaining / 30));
      const remaining = rnd(g.targetAmount - g.currentAmount);
      const requiredMonthly = monthsRemaining > 0 ? rnd(remaining / monthsRemaining) : remaining;

      let status: 'on-track' | 'at-risk' | 'behind';
      if (isOverdue) status = 'behind';
      else if (progress >= (100 - (monthsRemaining * 8.33))) status = 'on-track';
      else if (progress >= (100 - (monthsRemaining * 8.33 * 2))) status = 'at-risk';
      else status = 'behind';

      return {
        id: g.id,
        title: g.title,
        targetType: g.targetType,
        progress,
        daysRemaining,
        isOverdue,
        status,
        targetAmount: rnd(g.targetAmount),
        currentAmount: rnd(g.currentAmount),
        remaining,
        requiredMonthlyContribution: requiredMonthly,
        targetDate: g.targetDate.toISOString().split('T')[0],
      };
    }).sort((a, b) => a.progress - b.progress);

    // ─── (i) Recurring Impact ─────────────────────────────────────────────────
    const monthlyRecurring: { title: string; category: string; amount: number; frequency: string; isOperational: boolean; project: string }[] = [];
    let totalMonthlyRecurring = 0;
    let totalYearlyRecurring = 0;

    for (const r of allRecurring) {
      let monthlyEquiv = 0;
      if (r.frequency === 'monthly') monthlyEquiv = r.amount;
      else if (r.frequency === 'quarterly') monthlyEquiv = r.amount / 3;
      else if (r.frequency === 'yearly') monthlyEquiv = r.amount / 12;

      totalMonthlyRecurring += monthlyEquiv;
      totalYearlyRecurring += monthlyEquiv * 12;

      monthlyRecurring.push({
        title: r.title,
        category: r.category,
        amount: rnd(r.amount),
        frequency: r.frequency,
        isOperational: r.isOperational,
        project: r.project,
      });
    }

    monthlyRecurring.sort((a, b) => b.amount - a.amount);
    const recurringPctOfExpenses = avgMonthlyExpenses > 0 ? rnd((totalMonthlyRecurring / avgMonthlyExpenses) * 100) : 0;
    const projectedRecurring6Months = rnd(totalMonthlyRecurring * 6);

    const recurringImpact = {
      items: monthlyRecurring,
      totalMonthlyRecurring: rnd(totalMonthlyRecurring),
      totalYearlyRecurring: rnd(totalYearlyRecurring),
      recurringPctOfAvgExpenses: recurringPctOfExpenses,
      largestItems: monthlyRecurring.slice(0, 5),
      projectedRecurring6Months,
      activeCount: allRecurring.length,
    };

    // ─── (j) Trend Signals ────────────────────────────────────────────────────
    // 3-month trend
    const last3 = monthlyData.slice(-3);
    const prev3 = monthlyData.slice(-6, -3);
    const avgLast3R = last3.length > 0 ? last3.reduce((s, m) => s + m.totalReceipts, 0) / last3.length : 0;
    const avgPrev3R = prev3.length > 0 ? prev3.reduce((s, m) => s + m.totalReceipts, 0) / prev3.length : 0;
    const receiptTrend3Pct = avgPrev3R > 0 ? rnd(((avgLast3R - avgPrev3R) / avgPrev3R) * 100) : 0;

    const avgLast3E = last3.length > 0 ? last3.reduce((s, m) => s + m.totalExpenses, 0) / last3.length : 0;
    const avgPrev3E = prev3.length > 0 ? prev3.reduce((s, m) => s + m.totalExpenses, 0) / prev3.length : 0;
    const expenseTrend3Pct = avgPrev3E > 0 ? rnd(((avgLast3E - avgPrev3E) / avgPrev3E) * 100) : 0;

    // 6-month trend
    const last6 = monthlyData.slice(-6);
    const prev6 = monthlyData.slice(-12, -6);
    const avgLast6R = last6.length > 0 ? last6.reduce((s, m) => s + m.totalReceipts, 0) / last6.length : 0;
    const avgPrev6R = prev6.length > 0 ? prev6.reduce((s, m) => s + m.totalReceipts, 0) / prev6.length : 0;
    const receiptTrend6Pct = avgPrev6R > 0 ? rnd(((avgLast6R - avgPrev6R) / avgPrev6R) * 100) : 0;

    const avgLast6E = last6.length > 0 ? last6.reduce((s, m) => s + m.totalExpenses, 0) / last6.length : 0;
    const avgPrev6E = prev6.length > 0 ? prev6.reduce((s, m) => s + m.totalExpenses, 0) / prev6.length : 0;
    const expenseTrend6Pct = avgPrev6E > 0 ? rnd(((avgLast6E - avgPrev6E) / avgPrev6E) * 100) : 0;

    // Best / worst months
    const sortedByNet = [...monthlyData].sort((a, b) => b.netCashFlow - a.netCashFlow);
    const bestMonth = sortedByNet[0] || null;
    const worstMonth = sortedByNet[sortedByNet.length - 1] || null;

    // Cash burn trajectory
    let burnTrajectory: 'accelerating' | 'stable' | 'decelerating' = 'stable';
    if (monthlyData.length >= 4) {
      const recentBurn = monthlyData.slice(-2).reduce((s, m) => s + m.totalExpenses, 0) / 2;
      const earlierBurn = monthlyData.slice(-4, -2).length > 0
        ? monthlyData.slice(-4, -2).reduce((s, m) => s + m.totalExpenses, 0) / 2
        : recentBurn;
      const burnChange = earlierBurn > 0 ? (recentBurn - earlierBurn) / earlierBurn : 0;
      if (burnChange > 0.1) burnTrajectory = 'accelerating';
      else if (burnChange < -0.1) burnTrajectory = 'decelerating';
    }

    // Seasonal patterns
    const seasonalPatterns: { quarter: string; avgReceipts: number; avgExpenses: number }[] = [];
    const quarterMap = new Map<string, { receipts: number[]; expenses: number[] }>();
    for (const m of monthlyData) {
      const q = m.month >= 1 && m.month <= 3 ? 'Q1' : m.month <= 6 ? 'Q2' : m.month <= 9 ? 'Q3' : 'Q4';
      const existing = quarterMap.get(q) || { receipts: [], expenses: [] };
      existing.receipts.push(m.totalReceipts);
      existing.expenses.push(m.totalExpenses);
      quarterMap.set(q, existing);
    }
    for (const [quarter, data] of quarterMap) {
      seasonalPatterns.push({
        quarter,
        avgReceipts: rnd(data.receipts.reduce((s, v) => s + v, 0) / data.receipts.length),
        avgExpenses: rnd(data.expenses.reduce((s, v) => s + v, 0) / data.expenses.length),
      });
    }

    const trendSignals = {
      threeMonth: {
        receiptTrendPct: receiptTrend3Pct,
        expenseTrendPct: expenseTrend3Pct,
        avgReceipts: rnd(avgLast3R),
        avgExpenses: rnd(avgLast3E),
      },
      sixMonth: {
        receiptTrendPct: receiptTrend6Pct,
        expenseTrendPct: expenseTrend6Pct,
        avgReceipts: rnd(avgLast6R),
        avgExpenses: rnd(avgLast6E),
      },
      bestMonth: bestMonth ? { month: bestMonth.monthLabel, netCashFlow: bestMonth.netCashFlow } : null,
      worstMonth: worstMonth ? { month: worstMonth.monthLabel, netCashFlow: worstMonth.netCashFlow } : null,
      burnTrajectory,
      seasonalPatterns,
    };

    // ─── (k) Risk Matrix ──────────────────────────────────────────────────────
    const riskMatrix: {
      category: string;
      severity: 'critical' | 'high' | 'medium' | 'low';
      title: string;
      description: string;
      impact: number;
      probability: 'high' | 'medium' | 'low';
      mitigationSteps: string[];
    }[] = [];

    // Receivable risks
    if (totalExpected > 500000) {
      riskMatrix.push({
        category: 'receivable',
        severity: totalExpected > 2000000 ? 'critical' : totalExpected > 1000000 ? 'high' : 'medium',
        title: `${topPendingClients[0]?.client || 'Multiple clients'} - Large Pending Receivables`,
        description: `PKR ${totalExpected.toLocaleString()} in expected receipts that have not been received.`,
        impact: totalExpected,
        probability: topPendingClients[0]?.overdueMonths.length > 0 ? 'high' : 'medium',
        mitigationSteps: [
          `Send payment reminders to ${topPendingClients.slice(0, 3).map(c => c.client).join(', ')}`,
          'Offer early payment discounts (2-5%)',
          'Escalate to senior management at client organizations',
          'Consider milestone-based invoicing for future projects',
        ],
      });
    }

    // Aging risk
    if (agingBuckets['90+'] > 0) {
      riskMatrix.push({
        category: 'receivable',
        severity: 'critical',
        title: 'Very Old Receivables (90+ days)',
        description: `PKR ${agingBuckets['90+'].toLocaleString()} in receivables overdue by more than 90 days.`,
        impact: agingBuckets['90+'],
        probability: 'high',
        mitigationSteps: [
          'Immediately contact clients for all 90+ day receivables',
          'Consider engaging a debt recovery service',
          'Provision for potential bad debts in financial planning',
          'Review credit terms for these clients',
        ],
      });
    }

    // Expense risks
    if (costAnomalies.length > 0) {
      riskMatrix.push({
        category: 'expense',
        severity: 'high',
        title: 'Unusual Expense Spikes Detected',
        description: `${costAnomalies.length} month(s) showed spending >30% above average.`,
        impact: costAnomalies.reduce((s, a) => s + a.amount, 0),
        probability: 'medium',
        mitigationSteps: [
          `Review expenses in ${costAnomalies.map(a => a.month).join(', ')}`,
          'Identify one-time vs recurring anomalous costs',
          'Implement pre-approval for expenses above PKR 500,000',
          'Compare vendor pricing with market rates',
        ],
      });
    }

    // Budget risks
    if (overspentBudgets.length > 0) {
      riskMatrix.push({
        category: 'budget',
        severity: overspentBudgets.length >= 3 ? 'high' : 'medium',
        title: `${overspentBudgets.length} Budget Category(s) Overspent`,
        description: `Budget categories ${overspentBudgets.map(b => b.category).join(', ')} exceeded limits.`,
        impact: rnd(overspentBudgets.reduce((s, b) => s + Math.abs(b.variance), 0)),
        probability: 'high',
        mitigationSteps: [
          `Review and adjust budgets for ${overspentBudgets.slice(0, 3).map(b => b.category).join(', ')}`,
          'Implement monthly budget review meetings',
          'Set up automated alerts at 80% budget utilization',
          'Consider reallocating funds from under-spent categories',
        ],
      });
    }

    // Timing risks (deficit months)
    if (deficitMonths.length > 0) {
      riskMatrix.push({
        category: 'timing',
        severity: 'critical',
        title: `${deficitMonths.length} Month(s) Forecast Negative Balance`,
        description: `Cash deficit expected in ${deficitMonths.map(m => m.monthLabel).join(', ')}.`,
        impact: rnd(deficitMonths.reduce((s, m) => s + Math.abs(m.closingBalance), 0)),
        probability: 'high',
        mitigationSteps: [
          'Accelerate collection of pending receivables',
          'Negotiate extended payment terms with vendors',
          'Consider bridge financing or overdraft facility',
          'Postpone non-essential project expenses',
          `Explore emergency credit line of PKR ${deficitMonths.reduce((s, m) => s + Math.abs(m.closingBalance), 0).toLocaleString()}`,
        ],
      });
    }

    // Concentration risk
    const clientReceipts = new Map<string, number>();
    for (const r of receiptsInRange) {
      clientReceipts.set(r.clientProject, (clientReceipts.get(r.clientProject) || 0) + r.amount);
    }
    const totalAllReceipts = Array.from(clientReceipts.values()).reduce((s, v) => s + v, 0);
    const topClient = Array.from(clientReceipts.entries()).sort((a, b) => b[1] - a[1])[0];
    if (topClient && totalAllReceipts > 0 && (topClient[1] / totalAllReceipts) > 0.4) {
      riskMatrix.push({
        category: 'concentration',
        severity: 'medium',
        title: `Client Concentration Risk: ${topClient[0]}`,
        description: `${topClient[0]} accounts for ${rnd((topClient[1] / totalAllReceipts) * 100)}% of total receipts (PKR ${topClient[1].toLocaleString()}).`,
        impact: topClient[1],
        probability: 'medium',
        mitigationSteps: [
          'Diversify client portfolio to reduce dependency',
          'Develop contingency plans for delayed payments from this client',
          'Strengthen relationships with secondary clients',
          'Explore new business development opportunities',
        ],
      });
    }

    // Low cash runway
    if (cashRunwayMonths < 3 && cashRunwayMonths >= 0) {
      riskMatrix.push({
        category: 'timing',
        severity: cashRunwayMonths < 1 ? 'critical' : 'high',
        title: `Low Cash Runway: ${cashRunwayMonths} Month(s)`,
        description: `Current balance can only sustain operations for ${cashRunwayMonths} month(s).`,
        impact: currentBalance,
        probability: 'high',
        mitigationSteps: [
          'Immediately prioritize receivable collection',
          'Defer all non-critical expenditures',
          'Negotiate emergency credit facility with bank',
          'Consider salary deferment or partial payments (last resort)',
        ],
      });
    }

    riskMatrix.sort((a, b) => {
      const sevOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return sevOrder[a.severity] - sevOrder[b.severity];
    });

    // ─── (l) Action Plan ──────────────────────────────────────────────────────
    const actionPlan: {
      priority: number;
      category: string;
      title: string;
      description: string;
      impact: number;
      effort: 'low' | 'medium' | 'high';
      deadline: string;
      status: 'pending' | 'in-progress' | 'completed';
    }[] = [];

    let actionIdx = 1;

    // Critical: collect overdue receivables
    if (topPendingClients.length > 0 && topPendingClients[0].pending > 0) {
      actionPlan.push({
        priority: actionIdx++,
        category: 'receivable',
        title: `Collect PKR ${topPendingClients[0].pending.toLocaleString()} from ${topPendingClients[0].client}`,
        description: `${topPendingClients[0].client} has the largest pending amount. ${topPendingClients[0].overdueMonths.length > 0 ? `Overdue since ${topPendingClients[0].overdueMonths[0]}.` : ''}`,
        impact: topPendingClients[0].pending,
        effort: 'medium',
        deadline: 'This week',
        status: 'pending',
      });
    }

    // Address deficit months
    if (deficitMonths.length > 0) {
      const gapTotal = rnd(deficitMonths.reduce((s, m) => s + Math.abs(m.closingBalance), 0));
      actionPlan.push({
        priority: actionIdx++,
        category: 'timing',
        title: `Close Cash Gap of PKR ${gapTotal.toLocaleString()}`,
        description: `${deficitMonths.length} month(s) show negative balance. Bridge the gap through accelerated collections and expense management.`,
        impact: gapTotal,
        effort: 'high',
        deadline: 'Within 30 days',
        status: 'pending',
      });
    }

    // Budget corrections
    if (overspentBudgets.length > 0) {
      actionPlan.push({
        priority: actionIdx++,
        category: 'budget',
        title: `Review ${overspentBudgets.length} Overspent Budget Categories`,
        description: `Categories ${overspentBudgets.map(b => b.category).join(', ')} exceeded budget limits. Review and reallocate.`,
        impact: rnd(overspentBudgets.reduce((s, b) => s + Math.abs(b.variance), 0)),
        effort: 'medium',
        deadline: 'Within 2 weeks',
        status: 'pending',
      });
    }

    // Invoice follow-ups
    if (invOverdueCount > 0) {
      actionPlan.push({
        priority: actionIdx++,
        category: 'receivable',
        title: `Follow up on ${invOverdueCount} Overdue Invoice(s)`,
        description: `PKR ${invTotalOverdue.toLocaleString()} tied up in overdue invoices. Average payment cycle is ${avgDaysToPay} days.`,
        impact: rnd(invTotalOverdue),
        effort: 'low',
        deadline: 'This week',
        status: 'pending',
      });
    }

    // Cost anomaly review
    if (costAnomalies.length > 0) {
      actionPlan.push({
        priority: actionIdx++,
        category: 'expense',
        title: 'Review Expense Anomalies',
        description: `${costAnomalies.length} month(s) had spending spikes above 30% of average. Investigate root causes.`,
        impact: rnd(costAnomalies.reduce((s, a) => s + a.amount - a.average, 0)),
        effort: 'medium',
        deadline: 'Within 2 weeks',
        status: 'pending',
      });
    }

    // Goal catch-up
    if (overdueGoals.length > 0) {
      actionPlan.push({
        priority: actionIdx++,
        category: 'goal',
        title: `Address ${overdueGoals.length} Overdue Goal(s)`,
        description: `Financial goals past their target dates need reassessment or accelerated contributions.`,
        impact: rnd(overdueGoals.reduce((s, g) => s + (g.targetAmount - g.currentAmount), 0)),
        effort: 'medium',
        deadline: 'Within 30 days',
        status: 'pending',
      });
    }

    // Client diversification
    if (topClient && totalAllReceipts > 0 && (topClient[1] / totalAllReceipts) > 0.4) {
      actionPlan.push({
        priority: actionIdx++,
        category: 'concentration',
        title: 'Diversify Client Portfolio',
        description: `Reduce dependency on ${topClient[0]} which accounts for ${rnd((topClient[1] / totalAllReceipts) * 100)}% of revenue.`,
        impact: topClient[1],
        effort: 'high',
        deadline: 'Within 90 days',
        status: 'pending',
      });
    }

    // Recurring expense optimization
    if (recurringPctOfExpenses > 60) {
      actionPlan.push({
        priority: actionIdx++,
        category: 'expense',
        title: 'Optimize Recurring Expenses',
        description: `Recurring expenses are ${recurringPctOfExpenses}% of average monthly spend. Review subscriptions and contracts for savings.`,
        impact: rnd(totalMonthlyRecurring * 0.1), // assume 10% savings potential
        effort: 'low',
        deadline: 'Within 30 days',
        status: 'pending',
      });
    }

    // Working capital optimization
    if (workingCapitalRatio < 1) {
      actionPlan.push({
        priority: actionIdx++,
        category: 'timing',
        title: 'Improve Working Capital Position',
        description: `Working capital ratio is ${workingCapitalRatio}. Negotiate better payment terms with vendors and accelerate receivables.`,
        impact: rnd(Math.abs(1 - workingCapitalRatio) * currentLiabilities),
        effort: 'high',
        deadline: 'Within 60 days',
        status: 'pending',
      });
    }

    actionPlan.sort((a, b) => a.priority - b.priority);

    // ─── (m) Monthly Deep Dive ────────────────────────────────────────────────
    const monthlyDeepDive = monthlyData.map(m => {
      // Receipt sources for this month
      const receiptSources = new Map<string, number>();
      for (const r of m.receiptItems) {
        receiptSources.set(r.clientProject, (receiptSources.get(r.clientProject) || 0) + r.amount);
      }
      const receiptBreakdown = Array.from(receiptSources.entries())
        .map(([source, amount]) => ({ source, amount: rnd(amount) }))
        .sort((a, b) => b.amount - a.amount);

      // Expense categories for this month
      const expenseCats = new Map<string, number>();
      for (const e of m.expenseItems) {
        expenseCats.set(e.category, (expenseCats.get(e.category) || 0) + e.amount);
      }
      const expenseBreakdown = Array.from(expenseCats.entries())
        .map(([category, amount]) => ({ category, amount: rnd(amount) }))
        .sort((a, b) => b.amount - a.amount);

      // Key events
      const keyEvents: string[] = [];
      if (m.isDeficit) keyEvents.push(`Cash deficit of PKR ${Math.abs(m.closingBalance).toLocaleString()}`);
      if (m.isLowCash) keyEvents.push(`Low cash warning (below PKR ${warningThreshold.toLocaleString()})`);
      if (m.totalReceipts === 0 && m.totalExpenses > 0) keyEvents.push('No receipts recorded — all outflow');
      if (m.netCashFlow > 0 && m.netCashFlow > avgMonthlyExpenses * 2) keyEvents.push(`Strong surplus month: PKR ${m.netCashFlow.toLocaleString()}`);
      const opPct = m.totalExpenses > 0 ? rnd((m.operationalExpenses / m.totalExpenses) * 100) : 0;
      if (opPct > 70) keyEvents.push(`High operational cost ratio: ${opPct}%`);
      const expectedReceiptsThisMonth = m.receiptItems.filter(r => r.status === 'Expected');
      if (expectedReceiptsThisMonth.length > 0) keyEvents.push(`${expectedReceiptsThisMonth.length} receipt(s) still expected`);

      // Month-specific recommendations
      const recommendations: string[] = [];
      if (m.isDeficit) {
        recommendations.push('Urgently accelerate receivable collection for this month');
        recommendations.push('Consider postponing non-essential project expenses');
        recommendations.push('Explore short-term bridge financing');
      }
      if (m.isLowCash && !m.isDeficit) {
        recommendations.push('Monitor cash position closely');
        recommendations.push('Follow up on pending receipts');
      }
      if (opPct > 60) {
        recommendations.push('Review operational costs for optimization opportunities');
      }
      if (m.totalReceipts > m.totalExpenses * 1.5) {
        recommendations.push('Consider investing surplus cash in short-term instruments');
        recommendations.push('Prepay high-interest obligations if beneficial');
      }
      if (expectedReceiptsThisMonth.length > 0) {
        recommendations.push(`Follow up with ${new Set(expectedReceiptsThisMonth.map(r => r.clientProject)).size} client(s) for pending payments`);
      }

      return {
        month: m.monthLabel,
        openingBalance: m.openingBalance,
        closingBalance: m.closingBalance,
        netCashFlow: m.netCashFlow,
        totalReceipts: m.totalReceipts,
        totalExpenses: m.totalExpenses,
        operationalPct: opPct,
        status: m.isDeficit ? 'critical' : m.isLowCash ? 'warning' : 'healthy',
        receiptSources: receiptBreakdown,
        expenseCategories: expenseBreakdown,
        keyEvents,
        recommendations,
      };
    });

    // ─── Response ─────────────────────────────────────────────────────────────
    return NextResponse.json({
      status: 'success',
      overallHealth,
      healthScore,
      executiveSummary,
      cashPosition,
      receivableAnalysis,
      expenseAnalysis,
      budgetAdherence,
      invoiceHealth,
      goalProgress,
      recurringImpact,
      trendSignals,
      riskMatrix,
      actionPlan,
      monthlyDeepDive,
    });
  } catch (error) {
    console.error('Advisor API error:', error);
    return NextResponse.json({ error: 'Failed to generate advisor analysis' }, { status: 500 });
  }
}

// ─── Fallback Summary Generator ───────────────────────────────────────────────
function generateFallbackSummary(metrics: Record<string, unknown>): string {
  const m = metrics as {
    companyName: string;
    period: string;
    overallHealth: string;
    healthScore: number;
    currentBalancePKR: number;
    forecastClosingPKR: number;
    totalReceiptsPKR: number;
    totalExpensesPKR: number;
    netCashFlowPKR: number;
    cashRunwayMonths: number;
    deficitMonthsCount: number;
    overdueInvoicesCount: number;
    overdueInvoicesPKR: number;
    pendingReceiptsPKR: number;
    overdueGoalsCount: number;
    budgetsOverspentCount: number;
  };

  const lines: string[] = [];

  lines.push(
    `Financial Health: ${m.overallHealth} (Score: ${m.healthScore}/100)`
  );
  lines.push('');

  lines.push(
    `For ${m.period}, ${m.companyName} has a current bank balance of PKR ${m.currentBalancePKR.toLocaleString()} with a forecast closing balance of PKR ${m.forecastClosingPKR.toLocaleString()}. ` +
    `Total receipts of PKR ${m.totalReceiptsPKR.toLocaleString()} against expenses of PKR ${m.totalExpensesPKR.toLocaleString()} result in a net cash flow of PKR ${m.netCashFlowPKR.toLocaleString()}. ` +
    `Cash runway stands at ${m.cashRunwayMonths} month(s).`
  );
  lines.push('');

  const issues: string[] = [];
  if (m.deficitMonthsCount > 0) issues.push(`${m.deficitMonthsCount} deficit month(s) forecast`);
  if (m.overdueInvoicesCount > 0) issues.push(`${m.overdueInvoicesCount} overdue invoice(s) totaling PKR ${m.overdueInvoicesPKR.toLocaleString()}`);
  if (m.pendingReceiptsPKR > 0) issues.push(`PKR ${m.pendingReceiptsPKR.toLocaleString()} in pending receivables`);
  if (m.overdueGoalsCount > 0) issues.push(`${m.overdueGoalsCount} overdue goal(s)`);
  if (m.budgetsOverspentCount > 0) issues.push(`${m.budgetsOverspentCount} overspent budget categories`);

  if (issues.length > 0) {
    lines.push('Key Concerns:');
    for (const issue of issues) lines.push(`  - ${issue}`);
    lines.push('');
  }

  lines.push('Recommended Actions:');
  lines.push('  - Prioritize collection of overdue receivables and pending invoices');
  lines.push('  - Review and optimize operational expenses');
  lines.push('  - Monitor cash runway and maintain minimum balance thresholds');
  if (m.deficitMonthsCount > 0) {
    lines.push('  - Take immediate action to address forecast cash deficits');
  }
  if (m.budgetsOverspentCount > 0) {
    lines.push('  - Realign spending with budget limits');
  }

  return lines.join('\n');
}
