import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const type = sp.get('type') || 'all';
    const format = sp.get('format') || 'csv';
    const year = sp.get('year');

    // ─── PDF Export ───
    if (format === 'pdf') {
      return generatePDFReport(year);
    }

    // ─── CSV Export ───
    let csvContent = '';

    if (type === 'receipts' || type === 'all') {
      const where: any = {};
      if (year) where.year = parseInt(year);
      const receipts = await db.receipt.findMany({ where, orderBy: [{ year: 'asc' }, { month: 'asc' }] });
      csvContent += 'RECEIPTS\n';
      csvContent += 'Date,Month,Year,Client/Project,Description,Amount,Status,Notes\n';
      for (const r of receipts) {
        const date = new Date(r.date).toISOString().split('T')[0];
        csvContent += `${date},${MONTH_NAMES[r.month - 1]},${r.year},"${r.clientProject}","${r.description}",${r.amount},${r.status},"${r.notes}"\n`;
      }
      csvContent += '\n';
    }

    if (type === 'expenses' || type === 'all') {
      const where: any = {};
      if (year) where.year = parseInt(year);
      const expenses = await db.expense.findMany({ where, orderBy: [{ year: 'asc' }, { month: 'asc' }] });
      csvContent += 'EXPENSES\n';
      csvContent += 'Date,Month,Year,Category,Description,Amount,Project,Status,Operational,Notes\n';
      for (const e of expenses) {
        const date = new Date(e.date).toISOString().split('T')[0];
        csvContent += `${date},${MONTH_NAMES[e.month - 1]},${e.year},"${e.category}","${e.description}",${e.amount},"${e.project}",${e.status},${e.isOperational},"${e.notes}"\n`;
      }
    }

    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename=cash-flow-export-${type}.csv`,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to export data' }, { status: 500 });
  }
}

async function generatePDFReport(year: string | null) {
  // Fetch settings
  const settingsArr = await db.setting.findMany();
  const settingsMap: Record<string, string> = {};
  for (const s of settingsArr) settingsMap[s.key] = s.value;

  const companyName = settingsMap.company_name || 'ECI';
  const appName = settingsMap.app_name || 'ECI Cash Flow';

  // Fetch bank accounts for current balance
  const bankAccounts = await db.bankAccount.findMany({ where: { active: true } });
  const currentBalance = bankAccounts.reduce((sum, a) => sum + a.currentBalance, 0);

  // Determine year range
  const filterYear = year ? parseInt(year) : new Date().getFullYear();
  const rangeYears = [filterYear, filterYear + 1];

  // Fetch receipt and expense data
  const [receiptSums, expenseSums, opsSums] = await Promise.all([
    db.receipt.groupBy({ by: ['month', 'year'], _sum: { amount: true }, where: { year: { in: rangeYears } } }),
    db.expense.groupBy({ by: ['month', 'year'], _sum: { amount: true }, where: { year: { in: rangeYears } } }),
    db.expense.groupBy({ by: ['month', 'year'], _sum: { amount: true }, where: { year: { in: rangeYears }, isOperational: true } }),
  ]);

  const receiptMap = new Map<string, number>();
  for (const r of receiptSums) receiptMap.set(`${r.month}-${r.year}`, r._sum.amount || 0);
  const expenseMap = new Map<string, number>();
  for (const e of expenseSums) expenseMap.set(`${e.month}-${e.year}`, e._sum.amount || 0);
  const opsMap = new Map<string, number>();
  for (const e of opsSums) opsMap.set(`${e.month}-${e.year}`, e._sum.amount || 0);

  // Build FY months (Apr -> Mar)
  const fyMonths = [];
  for (let i = 0; i < 12; i++) {
    const m = ((4 + i - 1) % 12) + 1;
    const y = m >= 4 ? filterYear : filterYear + 1;
    fyMonths.push({ month: m, year: y });
  }

  const profitMarginPct = parseFloat(settingsMap.profit_margin_pct || '12') / 100;

  // Build monthly table rows
  let runningBalance = currentBalance;
  const rows: string[] = [];
  let totalReceipts = 0;
  let totalExpenses = 0;

  for (const { month, year: yr } of fyMonths) {
    const key = `${month}-${yr}`;
    const receipts = receiptMap.get(key) || 0;
    const expenses = expenseMap.get(key) || 0;
    const ops = opsMap.get(key) || 0;
    const net = receipts - expenses;
    const opening = runningBalance;
    const closing = opening + net;
    const status = closing < 0 ? 'DEFICIT' : 'OK';

    totalReceipts += receipts;
    totalExpenses += expenses;

    rows.push(`
      <tr class="${closing < 0 ? 'row-deficit' : ''}">
        <td>${MONTH_NAMES[month - 1]} ${yr}</td>
        <td class="num">${formatNum(opening)}</td>
        <td class="num green">${formatNum(receipts)}</td>
        <td class="num red">${formatNum(expenses)}</td>
        <td class="num">${formatNum(ops)}</td>
        <td class="num ${net >= 0 ? 'green' : 'red'}">${formatNum(net)}</td>
        <td class="num ${closing < 0 ? 'red' : 'green'}">${formatNum(closing)}</td>
        <td class="center"><span class="badge ${status === 'DEFICIT' ? 'badge-red' : 'badge-green'}">${status}</span></td>
      </tr>
    `);

    runningBalance = closing;
  }

  const forecastClosing = currentBalance + totalReceipts - totalExpenses;
  const totalDeficit = forecastClosing < 0 ? Math.abs(forecastClosing) : 0;
  const additionalBusiness = forecastClosing < 0 ? totalDeficit / profitMarginPct : 0;

  const shortfallSection = totalDeficit > 0 ? `
    <div class="shortfall-section">
      <h2>Shortfall Analysis</h2>
      <div class="shortfall-grid">
        <div class="shortfall-card red">
          <span class="label">Total Deficit</span>
          <span class="value">${formatNum(totalDeficit)}</span>
        </div>
        <div class="shortfall-card amber">
          <span class="label">Additional Business Required</span>
          <span class="value">${formatNum(additionalBusiness)}</span>
        </div>
        <div class="shortfall-card">
          <span class="label">Profit Margin Target</span>
          <span class="value">${(profitMarginPct * 100).toFixed(0)}%</span>
        </div>
        <div class="shortfall-card ${forecastClosing >= 0 ? 'green' : 'red'}">
          <span class="label">Forecast Closing Balance</span>
          <span class="value">${formatNum(forecastClosing)}</span>
        </div>
      </div>
    </div>
  ` : '';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${appName} - Cash Flow Report</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    @page { 
      size: landscape; 
      margin: 15mm; 
    }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1e293b; padding: 15mm; font-size: 12px; line-height: 1.5; }
    .header { text-align: center; margin-bottom: 32px; padding-bottom: 20px; border-bottom: 2px solid #e2e8f0; }
    .header h1 { font-size: 22px; font-weight: 800; color: #0f172a; margin-bottom: 4px; }
    .header p { font-size: 13px; color: #64748b; }
    .meta { display: flex; justify-content: space-between; margin-bottom: 24px; font-size: 11px; color: #94a3b8; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 10px; }
    th { background: #f1f5f9; padding: 8px 6px; text-align: right; font-size: 10px; font-weight: 700; color: #475569; border-bottom: 2px solid #cbd5e1; }
    th:first-child, th:nth-child(8) { text-align: left; }
    td { padding: 6px; border-bottom: 1px solid #f1f5f9; font-size: 10px; }
    .num { text-align: right; font-variant-numeric: tabular-nums; font-family: 'SF Mono', 'Cascadia Code', monospace; }
    .center { text-align: center; }
    .green { color: #059669; font-weight: 600; }
    .red { color: #dc2626; font-weight: 600; }
    .row-deficit { background: #fef2f2; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 9px; font-weight: 700; }
    .badge-green { background: #ecfdf5; color: #059669; border: 1px solid #a7f3d0; }
    .badge-red { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; }
    .totals-row { background: #f8fafc; font-weight: 700; }
    .balance-info { background: #eff6ff; padding: 10px 14px; border-radius: 6px; margin-bottom: 20px; font-size: 12px; font-weight: 600; }
    .balance-info span { color: ${currentBalance >= 0 ? '#059669' : '#dc2626'}; font-weight: 800; }
    .shortfall-section { margin-top: 24px; }
    .shortfall-section h2 { font-size: 16px; font-weight: 700; margin-bottom: 12px; color: #c2410c; }
    .shortfall-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
    .shortfall-card { background: #fffbeb; padding: 14px; border-radius: 8px; border: 1px solid #fde68a; }
    .shortfall-card.red { background: #fef2f2; border-color: #fecaca; }
    .shortfall-card.green { background: #ecfdf5; border-color: #a7f3d0; }
    .shortfall-card .label { display: block; font-size: 10px; color: #64748b; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
    .shortfall-card .value { display: block; font-size: 16px; font-weight: 800; color: #0f172a; }
    .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 10px; color: #94a3b8; }
    @media print {
      @page {
        size: landscape;
        margin: 15mm;
      }
      body { 
        padding: 15mm; 
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .no-print { display: none !important; }
      table { page-break-inside: avoid; }
      .shortfall-grid { grid-template-columns: repeat(4, 1fr); }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${companyName} - Cash Flow Report</h1>
    <p>${appName} &middot; Generated on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
  </div>

  <div class="meta">
    <span>Financial Year: Apr ${filterYear} - Mar ${filterYear + 1}</span>
    <span>Profit Margin Target: ${(profitMarginPct * 100).toFixed(0)}%</span>
  </div>

  <div class="balance-info">
    Current Bank Balance: <span>${formatNum(currentBalance)}</span>
  </div>

  <table>
    <thead>
      <tr>
        <th>Month</th>
        <th>Opening</th>
        <th>Receipts</th>
        <th>Expenses</th>
        <th>Ops Cost</th>
        <th>Net Flow</th>
        <th>Closing</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>
      ${rows.join('')}
    </tbody>
    <tfoot>
      <tr class="totals-row">
        <td>TOTAL</td>
        <td></td>
        <td class="num green">${formatNum(totalReceipts)}</td>
        <td class="num red">${formatNum(totalExpenses)}</td>
        <td></td>
        <td class="num ${totalReceipts - totalExpenses >= 0 ? 'green' : 'red'}">${formatNum(totalReceipts - totalExpenses)}</td>
        <td class="num ${forecastClosing >= 0 ? 'green' : 'red'}">${formatNum(forecastClosing)}</td>
        <td></td>
      </tr>
    </tfoot>
  </table>

  ${shortfallSection}

  <div class="footer">
    ${companyName} &middot; ${appName} &middot; Confidential — For Internal Use Only
  </div>
</body>
</html>`;

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html',
      'Content-Disposition': `attachment; filename="cash-flow-report-FY${filterYear}-${filterYear + 1}-landscape.html"`,
    },
  });
}

function formatNum(n: number): string {
  return new Intl.NumberFormat('en-PK', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(n));
}
