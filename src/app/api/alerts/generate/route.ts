import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export async function POST() {
  try {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    const [settings, bankAccounts] = await Promise.all([
      db.setting.findMany(),
      db.bankAccount.findMany({ where: { active: true } }),
    ]);

    const settingsMap: Record<string, string> = {};
    for (const s of settings) settingsMap[s.key] = s.value;
    const warningThreshold = parseFloat(settingsMap.warning_threshold_balance || '500000');
    const currentBalance = bankAccounts.reduce((sum, a) => sum + a.currentBalance, 0);

    const alertsToCreate: { type: string; title: string; message: string; severity: number; relatedData: string }[] = [];

    // 1. Balance below threshold
    if (currentBalance < warningThreshold) {
      alertsToCreate.push({
        type: 'critical',
        title: 'Balance Below Warning Threshold',
        message: `Current balance Rs. ${Math.round(currentBalance).toLocaleString()} is below the warning threshold of Rs. ${warningThreshold.toLocaleString()}.`,
        severity: 4,
        relatedData: JSON.stringify({ balance: currentBalance, threshold: warningThreshold }),
      });
    }

    // 2. Negative balance
    if (currentBalance < 0) {
      alertsToCreate.push({
        type: 'critical',
        title: 'Negative Bank Balance',
        message: `Bank balance is Rs. ${Math.round(currentBalance).toLocaleString()}. Immediate attention required.`,
        severity: 5,
        relatedData: JSON.stringify({ balance: currentBalance }),
      });
    }

    // 3. Overdue expected receipts
    const overdueReceipts = await db.receipt.findMany({
      where: {
        status: 'Expected',
        OR: [
          { year: { lt: currentYear } },
          { year: currentYear, month: { lt: currentMonth } },
        ],
      },
    });

    if (overdueReceipts.length > 0) {
      const totalOverdue = overdueReceipts.reduce((s, r) => s + r.amount, 0);
      const clientBreakdown: Record<string, number> = {};
      for (const r of overdueReceipts) {
        clientBreakdown[r.clientProject] = (clientBreakdown[r.clientProject] || 0) + r.amount;
      }

      alertsToCreate.push({
        type: 'warning',
        title: `${overdueReceipts.length} Overdue Receipt(s) - Rs. ${Math.round(totalOverdue).toLocaleString()}`,
        message: `Expected receipts from past months have not been received. Top clients: ${Object.entries(clientBreakdown).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${k} (Rs. ${v.toLocaleString()})`).join(', ')}.`,
        severity: 3,
        relatedData: JSON.stringify({ count: overdueReceipts.length, total: totalOverdue, clients: clientBreakdown }),
      });
    }

    // 4. Large receipt received (recent)
    const recentReceipts = await db.receipt.findMany({
      where: {
        status: 'Received',
        OR: [
          { year: currentYear, month: currentMonth },
          { year: currentMonth > 1 ? currentYear : currentYear - 1, month: currentMonth > 1 ? currentMonth - 1 : 12 },
        ],
      },
    });

    const largeReceipts = recentReceipts.filter(r => r.amount >= 1000000);
    for (const r of largeReceipts) {
      alertsToCreate.push({
        type: 'success',
        title: `Large Receipt: Rs. ${Math.round(r.amount).toLocaleString()} from ${r.clientProject}`,
        message: `Receipt of Rs. ${Math.round(r.amount).toLocaleString()} received from ${r.clientProject} in ${MONTH_NAMES[r.month - 1]} ${r.year}.`,
        severity: 1,
        relatedData: JSON.stringify({ receiptId: r.id, amount: r.amount, client: r.clientProject }),
      });
    }

    // 5. High monthly expenses warning
    const thisMonthExpenses = await db.expense.findMany({
      where: { year: currentYear, month: currentMonth },
    });
    const thisMonthTotal = thisMonthExpenses.reduce((s, e) => s + e.amount, 0);
    const lastMonthExpenses = await db.expense.findMany({
      where: {
        OR: [
          { year: currentYear, month: currentMonth - 1 > 0 ? currentMonth - 1 : 12 },
          ...(currentMonth === 1 ? [{ year: currentYear - 1, month: 12 }] : []),
        ],
      },
    });
    const lastMonthTotal = lastMonthExpenses.reduce((s, e) => s + e.amount, 0);

    if (lastMonthTotal > 0 && thisMonthTotal > lastMonthTotal * 1.5) {
      alertsToCreate.push({
        type: 'warning',
        title: 'Expense Spike Detected',
        message: `This month's expenses (Rs. ${Math.round(thisMonthTotal).toLocaleString()}) are ${(thisMonthTotal / lastMonthTotal * 100).toFixed(0)}% higher than last month (Rs. ${Math.round(lastMonthTotal).toLocaleString()}).`,
        severity: 2,
        relatedData: JSON.stringify({ thisMonth: thisMonthTotal, lastMonth: lastMonthTotal, pctIncrease: (thisMonthTotal / lastMonthTotal - 1) * 100 }),
      });
    }

    // Create alerts (avoid duplicates by checking recent same-title alerts)
    let created = 0;
    for (const alertData of alertsToCreate) {
      const recentDuplicate = await db.cashFlowAlert.findFirst({
        where: {
          title: alertData.title,
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
      });
      if (!recentDuplicate) {
        await db.cashFlowAlert.create({ data: alertData });
        created++;
      }
    }

    return NextResponse.json({
      success: true,
      analyzed: alertsToCreate.length,
      created,
      message: `Generated ${created} new alert(s) from ${alertsToCreate.length} analysis points.`,
    });
  } catch (error) {
    console.error('Alert generation error:', error);
    return NextResponse.json({ error: 'Failed to generate alerts' }, { status: 500 });
  }
}
