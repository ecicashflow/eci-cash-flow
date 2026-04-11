import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const type = sp.get('type') || 'all';
    const format = sp.get('format') || 'csv';
    const year = sp.get('year');

    let csvContent = '';
    const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

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
