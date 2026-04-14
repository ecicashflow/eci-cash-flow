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

    const rangeMonths = getMonthsInRange(startDate, endDate);
    const rangeYears = Array.from(new Set(rangeMonths.map(m => m.year)));

    // Fetch all data
    const [settings, bankAccounts, receipts, expenses] = await Promise.all([
      db.setting.findMany(),
      db.bankAccount.findMany({ where: { active: true } }),
      db.receipt.findMany({ where: { year: { in: rangeYears } } }),
      db.expense.findMany({ where: { year: { in: rangeYears } } }),
    ]);

    const settingsMap: Record<string, string> = {};
    for (const s of settings) settingsMap[s.key] = s.value;
    const warningThreshold = parseFloat(settingsMap.warning_threshold_balance || '500000');

    const currentBalance = bankAccounts.reduce((sum, a) => sum + a.currentBalance, 0);

    // Group by month
    const receiptByMonth = new Map<string, { total: number; items: any[] }>();
    const expenseByMonth = new Map<string, { total: number; operational: number; items: any[] }>();

    for (const r of receipts) {
      const key = `${r.month}-${r.year}`;
      const existing = receiptByMonth.get(key) || { total: 0, items: [] };
      existing.total += r.amount;
      existing.items.push(r);
      receiptByMonth.set(key, existing);
    }

    for (const e of expenses) {
      const key = `${e.month}-${e.year}`;
      const existing = expenseByMonth.get(key) || { total: 0, operational: 0, items: [] };
      existing.total += e.amount;
      if (e.isOperational) existing.operational += e.amount;
      existing.items.push(e);
      expenseByMonth.set(key, existing);
    }

    // Build monthly data with running balance
    const monthlyData: any[] = [];
    let runningBalance = currentBalance;

    for (const { month, year } of rangeMonths) {
      const key = `${month}-${year}`;
      const rcpt = receiptByMonth.get(key);
      const exp = expenseByMonth.get(key);
      const monthReceipts = rcpt?.total || 0;
      const monthExpenses = exp?.total || 0;
      const monthOps = exp?.operational || 0;
      const closing = runningBalance + monthReceipts - monthExpenses;

      monthlyData.push({
        month, year,
        monthLabel: `${MONTH_NAMES[month - 1]} ${year}`,
        openingBalance: runningBalance,
        totalReceipts: monthReceipts,
        totalExpenses: monthExpenses,
        operationalExpenses: monthOps,
        netCashFlow: monthReceipts - monthExpenses,
        closingBalance: closing,
        isDeficit: closing < 0,
        isLowCash: closing >= 0 && closing < warningThreshold,
        receiptItems: rcpt?.items || [],
        expenseItems: exp?.items || [],
      });
      runningBalance = closing;
    }

    const forecastClosing = monthlyData.length > 0 ? monthlyData[monthlyData.length - 1].closingBalance : currentBalance;

    // ─── 1. Overall Health ───
    const deficitMonths = monthlyData.filter(m => m.isDeficit);
    const lowCashMonths = monthlyData.filter(m => m.isLowCash);
    let overallHealth: 'CRITICAL' | 'WARNING' | 'HEALTHY' = 'HEALTHY';
    if (deficitMonths.length > 0) overallHealth = 'CRITICAL';
    else if (lowCashMonths.length > 0 || currentBalance < warningThreshold) overallHealth = 'WARNING';

    // ─── 2. Cash Runway ───
    const avgMonthlyExpenses = monthlyData.length > 0
      ? monthlyData.reduce((s, m) => s + m.totalExpenses, 0) / monthlyData.length
      : 0;
    const cashRunwayMonths = avgMonthlyExpenses > 0 ? Math.floor(currentBalance / avgMonthlyExpenses) : 999;

    // ─── 3. Payment Scenarios ───
    const paymentScenarios: any[] = [];
    const expectedReceipts = receipts.filter(r => r.status === 'Expected');
    const avgMonthlyExpenseAmt = avgMonthlyExpenses;

    for (const receipt of expectedReceipts) {
      const key = `${receipt.month}-${receipt.year}`;
      const monthData = monthlyData.find(m => `${m.month}-${m.year}` === key);
      if (!monthData) continue;

      const monthsCovered = avgMonthlyExpenseAmt > 0 ? Math.round(receipt.amount / avgMonthlyExpenseAmt * 10) / 10 : 0;
      const newBalance = monthData.closingBalance + receipt.amount;
      const improvesDeficit = monthData.isDeficit && newBalance >= 0;

      paymentScenarios.push({
        client: receipt.clientProject,
        amount: receipt.amount,
        expectedMonth: `${MONTH_NAMES[receipt.month - 1]} ${receipt.year}`,
        currentMonthBalance: monthData.closingBalance,
        ifReceived: newBalance,
        monthsCovered,
        improvesDeficit,
        priority: receipt.amount > 1000000 ? 'high' : receipt.amount > 500000 ? 'medium' : 'low',
      });
    }
    paymentScenarios.sort((a, b) => b.amount - a.amount);

    // ─── 4. Expense Postponement Recommendations ───
    const expensePostponement: any[] = [];
    for (const md of monthlyData) {
      if (!md.isDeficit && !md.isLowCash) continue;
      const deficitAmount = md.isDeficit ? Math.abs(md.closingBalance) : warningThreshold - md.closingBalance;
      const nonOperationalExpenses = md.expenseItems.filter((e: any) => !e.isOperational && e.status === 'Expected');
      const projectExpenses = nonOperationalExpenses.sort((a: any, b: any) => b.amount - a.amount);

      for (const exp of projectExpenses.slice(0, 5)) {
        expensePostponement.push({
          month: md.monthLabel,
          category: exp.category,
          project: exp.project || 'General',
          amount: exp.amount,
          deficitReduction: Math.min(exp.amount, deficitAmount),
          newBalance: md.closingBalance + exp.amount,
        });
      }
    }

    // ─── 5. Client Follow-ups ───
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    const clientFollowUps: any[] = [];
    const clientMap = new Map<string, { totalExpected: number; overdueMonths: string[]; totalPaid: number }>();

    for (const r of expectedReceipts) {
      const existing = clientMap.get(r.clientProject) || { totalExpected: 0, overdueMonths: [], totalPaid: 0 };
      existing.totalExpected += r.amount;
      if (r.year < currentYear || (r.year === currentYear && r.month < currentMonth)) {
        existing.overdueMonths.push(`${MONTH_NAMES[r.month - 1]} ${r.year}`);
      }
      clientMap.set(r.clientProject, existing);
    }

    for (const r of receipts.filter(r => r.status === 'Received' || r.status === 'Confirmed')) {
      const existing = clientMap.get(r.clientProject);
      if (existing) existing.totalPaid += r.amount;
    }

    for (const [client, info] of clientMap) {
      if (info.overdueMonths.length > 0 || info.totalExpected > 1000000) {
        clientFollowUps.push({
          client,
          totalExpected: info.totalExpected,
          totalPaid: info.totalPaid,
          pendingAmount: info.totalExpected - info.totalPaid,
          overdueMonths: info.overdueMonths,
          urgency: info.overdueMonths.length >= 3 ? 'critical' : info.overdueMonths.length >= 1 ? 'high' : 'medium',
        });
      }
    }
    clientFollowUps.sort((a, b) => b.pendingAmount - a.pendingAmount);

    // ─── 6. Recommendations ───
    const recommendations: any[] = [];

    if (overallHealth === 'CRITICAL') {
      recommendations.push({
        type: 'critical', priority: 1,
        title: 'Cash Flow is CRITICAL',
        message: `${deficitMonths.length} month(s) forecast negative balance. Immediate action required.`,
        actions: [
          `Follow up urgently with ${clientFollowUps[0]?.client || 'top clients'} for pending payments`,
          `Consider postponing non-essential project expenses`,
          `Explore short-term financing options to cover ${deficitMonths.reduce((s, m) => s + Math.abs(m.closingBalance), 0).toLocaleString()} funding gap`,
        ],
      });
    }

    if (paymentScenarios.length > 0 && paymentScenarios[0].improvesDeficit) {
      recommendations.push({
        type: 'actionable', priority: 2,
        title: `Receive ${paymentScenarios[0].client} Payment to Cover Deficit`,
        message: `If Rs. ${paymentScenarios[0].amount.toLocaleString()} is received from ${paymentScenarios[0].client}, balance improves to Rs. ${paymentScenarios[0].ifReceived.toLocaleString()} for ${paymentScenarios[0].expectedMonth}.`,
        actions: [`Contact ${paymentScenarios[0].client} immediately`, `Send invoice reminder`, `Negotiate partial payment if full amount is delayed`],
      });
    }

    if (expensePostponement.length > 0) {
      const topPostpone = expensePostponement[0];
      recommendations.push({
        type: 'suggestion', priority: 3,
        title: 'Postpone Non-Essential Expenses',
        message: `Postponing "${topPostpone.category}" (Rs. ${topPostpone.amount.toLocaleString()}) in ${topPostpone.month} would improve balance to Rs. ${topPostpone.newBalance.toLocaleString()}.`,
        actions: [`Defer ${topPostpone.category} expense`, `Negotiate extended payment terms with vendor`],
      });
    }

    if (cashRunwayMonths < 3) {
      recommendations.push({
        type: 'warning', priority: 2,
        title: `Low Cash Runway: ${cashRunwayMonths} Month(s)`,
        message: `Current balance of Rs. ${currentBalance.toLocaleString()} can only sustain ${cashRunwayMonths} month(s) at average monthly expense of Rs. ${Math.round(avgMonthlyExpenses).toLocaleString()}.`,
        actions: [`Accelerate receivable collection`, `Reduce discretionary spending`, `Consider bridge financing`],
      });
    }

    if (clientFollowUps.length > 0) {
      recommendations.push({
        type: 'info', priority: 4,
        title: `${clientFollowUps.length} Client(s) Need Follow-up`,
        message: `Total pending: Rs. ${clientFollowUps.reduce((s, c) => s + c.pendingAmount, 0).toLocaleString()}`,
        actions: clientFollowUps.slice(0, 3).map(c => `Follow up with ${c.client} (${c.overdueMonths.length} overdue)`),
      });
    }

    if (overallHealth === 'HEALTHY') {
      const surplusMonths = monthlyData.filter(m => m.closingBalance > warningThreshold * 2);
      if (surplusMonths.length > 6) {
        recommendations.push({
          type: 'success', priority: 5,
          title: 'Strong Cash Position',
          message: `Cash flow is healthy with ${surplusMonths.length} of ${monthlyData.length} months showing strong surplus. Consider investing excess cash.`,
          actions: [`Explore short-term investment options`, `Consider early payment discounts from vendors`, `Build emergency reserve fund`],
        });
      }
    }

    // ─── 7. Monthly Insights ───
    const monthlyInsights = monthlyData.map(m => {
      const insights: string[] = [];
      if (m.isDeficit) insights.push(`Deficit of Rs. ${Math.abs(m.closingBalance).toLocaleString()}`);
      if (m.isLowCash) insights.push(`Low cash warning`);
      if (m.totalReceipts > 0 && m.totalExpenses > 0) {
        const ratio = ((m.totalReceipts / m.totalExpenses) * 100).toFixed(0);
        insights.push(`Receipt/Expense ratio: ${ratio}%`);
      }
      if (m.totalReceipts === 0 && m.totalExpenses > 0) insights.push('No receipts expected');
      const opsPct = m.totalExpenses > 0 ? ((m.operationalExpenses / m.totalExpenses) * 100).toFixed(0) : '0';
      insights.push(`Operational costs: ${opsPct}% of total expenses`);

      return {
        month: m.monthLabel,
        status: m.isDeficit ? 'critical' : m.isLowCash ? 'warning' : 'healthy',
        insights,
        receiptCount: m.receiptItems.length,
        expenseCount: m.expenseItems.length,
      };
    });

    return NextResponse.json({
      status: 'success',
      overallHealth,
      cashRunwayMonths,
      currentBalance,
      forecastClosing,
      avgMonthlyExpenses: Math.round(avgMonthlyExpenses),
      totalDeficitMonths: deficitMonths.length,
      totalLowCashMonths: lowCashMonths.length,
      recommendations,
      paymentScenarios: paymentScenarios.slice(0, 20),
      expensePostponement: expensePostponement.slice(0, 15),
      clientFollowUps,
      monthlyInsights,
    });
  } catch (error) {
    console.error('Advisor API error:', error);
    return NextResponse.json({ error: 'Failed to generate advisor analysis' }, { status: 500 });
  }
}
