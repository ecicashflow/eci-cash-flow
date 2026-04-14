import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function POST() {
  try {
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    // Find all active recurring expenses whose nextDate falls within or before the current month
    const dueExpenses = await db.recurringExpense.findMany({
      where: {
        active: true,
        nextDate: {
          lte: currentMonthEnd,
        },
      },
    });

    if (dueExpenses.length === 0) {
      return NextResponse.json({ generated: 0, message: 'No recurring expenses are due this month' });
    }

    let generatedCount = 0;

    for (const recurring of dueExpenses) {
      const nextDate = new Date(recurring.nextDate);

      // Calculate the expense date as the recurring nextDate (or today if it's past)
      const expenseDate = nextDate <= now ? now : nextDate;

      // Create an actual expense record
      await db.expense.create({
        data: {
          date: expenseDate,
          month: expenseDate.getMonth() + 1,
          year: expenseDate.getFullYear(),
          category: recurring.category,
          description: `[Recurring] ${recurring.title}`,
          amount: recurring.amount,
          project: recurring.project || '',
          status: 'Expected',
          notes: `Auto-generated from recurring expense. ${recurring.notes || ''}`.trim(),
          isOperational: recurring.isOperational,
        },
      });

      // Advance the nextDate based on frequency
      let newNextDate: Date;
      switch (recurring.frequency) {
        case 'quarterly':
          newNextDate = new Date(nextDate.getFullYear(), nextDate.getMonth() + 3, nextDate.getDate());
          break;
        case 'yearly':
          newNextDate = new Date(nextDate.getFullYear() + 1, nextDate.getMonth(), nextDate.getDate());
          break;
        case 'monthly':
        default:
          newNextDate = new Date(nextDate.getFullYear(), nextDate.getMonth() + 1, nextDate.getDate());
          break;
      }

      await db.recurringExpense.update({
        where: { id: recurring.id },
        data: { nextDate: newNextDate },
      });

      generatedCount++;
    }

    return NextResponse.json({
      generated: generatedCount,
      message: `Generated ${generatedCount} expense(s) from recurring templates`,
    });
  } catch (error) {
    console.error('Recurring generate POST error:', error);
    return NextResponse.json({ error: 'Failed to generate recurring expenses' }, { status: 500 });
  }
}
