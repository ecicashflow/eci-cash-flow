import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const where: any = {};

    if (sp.get('active') !== null) {
      const val = sp.get('active');
      if (val === 'true') where.active = true;
      else if (val === 'false') where.active = false;
    }
    if (sp.get('category')) {
      where.category = { contains: sp.get('category')!, mode: 'insensitive' };
    }
    if (sp.get('frequency')) {
      where.frequency = sp.get('frequency');
    }
    if (sp.get('search')) {
      where.OR = [
        { title: { contains: sp.get('search')!, mode: 'insensitive' } },
        { category: { contains: sp.get('search')!, mode: 'insensitive' } },
        { notes: { contains: sp.get('search')!, mode: 'insensitive' } },
      ];
    }

    const recurring = await db.recurringExpense.findMany({
      where,
      orderBy: { nextDate: 'asc' },
    });
    return NextResponse.json(recurring);
  } catch (error) {
    console.error('Recurring GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch recurring expenses' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, category, amount, frequency, isOperational, project, nextDate, notes } = body;

    const errors: string[] = [];
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      errors.push('Title is required');
    }
    if (!category || typeof category !== 'string' || category.trim().length === 0) {
      errors.push('Category is required');
    }
    if (amount === undefined || amount === null || typeof amount !== 'number' || amount <= 0 || isNaN(amount)) {
      errors.push('Amount must be a positive number');
    }
    if (frequency && !['monthly', 'quarterly', 'yearly'].includes(frequency)) {
      errors.push('Frequency must be monthly, quarterly, or yearly');
    }
    if (!nextDate) {
      errors.push('Next date is required');
    } else {
      const parsedDate = new Date(nextDate);
      if (isNaN(parsedDate.getTime())) {
        errors.push('Invalid next date format');
      }
    }

    if (errors.length > 0) {
      return NextResponse.json({ error: errors.join('; ') }, { status: 400 });
    }

    const parsedNextDate = new Date(nextDate);

    const recurring = await db.recurringExpense.create({
      data: {
        title: title.trim(),
        category: category.trim(),
        amount,
        frequency: frequency || 'monthly',
        isOperational: isOperational || false,
        project: (project || '').trim(),
        nextDate: parsedNextDate,
        notes: (notes || '').trim(),
        active: true,
      },
    });
    return NextResponse.json(recurring, { status: 201 });
  } catch (error) {
    console.error('Recurring POST error:', error);
    return NextResponse.json({ error: 'Failed to create recurring expense' }, { status: 500 });
  }
}
