import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const invoices = await db.invoice.findMany();
    const now = new Date();

    let totalOutstanding = 0;
    let totalOverdue = 0;
    let totalPaid = 0;
    let overdueCount = 0;
    const daysToPayList: number[] = [];

    for (const inv of invoices) {
      if (inv.status === 'Paid') {
        totalPaid += inv.paidAmount || inv.amount;
        // Calculate days to pay from creation to paidDate
        if (inv.paidDate) {
          const diffMs = inv.paidDate.getTime() - inv.createdAt.getTime();
          const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
          if (diffDays >= 0) {
            daysToPayList.push(diffDays);
          }
        }
      } else if (inv.status === 'Cancelled') {
        continue;
      } else {
        // Pending, Sent, or Overdue
        const isOverdue = inv.dueDate < now;
        if (isOverdue) {
          totalOverdue += inv.amount;
          overdueCount++;
        } else {
          totalOutstanding += inv.amount;
        }
      }
    }

    const avgDaysToPay =
      daysToPayList.length > 0
        ? Math.round((daysToPayList.reduce((sum, d) => sum + d, 0) / daysToPayList.length) * 100) / 100
        : 0;

    return NextResponse.json({
      totalOutstanding: Math.round(totalOutstanding * 100) / 100,
      totalOverdue: Math.round(totalOverdue * 100) / 100,
      totalPaid: Math.round(totalPaid * 100) / 100,
      overdueCount,
      avgDaysToPay,
    });
  } catch (error) {
    console.error('Invoice summary GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch invoice summary' }, { status: 500 });
  }
}
