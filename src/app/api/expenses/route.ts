import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const where: any = {};
    if (sp.get('month')) where.month = parseInt(sp.get('month')!);
    if (sp.get('year')) where.year = parseInt(sp.get('year')!);
    if (sp.get('status')) where.status = sp.get('status');
    if (sp.get('category')) where.category = { contains: sp.get('category')!, mode: 'insensitive' };
    if (sp.get('project')) where.project = { contains: sp.get('project')!, mode: 'insensitive' };
    if (sp.get('isOperational') !== null) {
      const val = sp.get('isOperational');
      if (val === 'true') where.isOperational = true;
      else if (val === 'false') where.isOperational = false;
    }
    if (sp.get('search')) {
      where.OR = [
        { category: { contains: sp.get('search')!, mode: 'insensitive' } },
        { description: { contains: sp.get('search')!, mode: 'insensitive' } },
        { project: { contains: sp.get('search')!, mode: 'insensitive' } },
        { notes: { contains: sp.get('search')!, mode: 'insensitive' } },
      ];
    }
    const expenses = await db.expense.findMany({ where, orderBy: [{ year: 'asc' }, { month: 'asc' }, { date: 'asc' }] });
    return NextResponse.json(expenses);
  } catch (error) {
    console.error('Expenses GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch expenses' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { date, month, year, category, description, amount, project, status, notes, isOperational } = body;

    const errors: string[] = [];
    if (!date) errors.push('Date is required');
    if (!month || typeof month !== 'number' || month < 1 || month > 12) errors.push('Valid month (1-12) is required');
    if (!year || typeof year !== 'number' || year < 2000 || year > 2100) errors.push('Valid year is required');
    if (!category || typeof category !== 'string' || category.trim().length === 0) errors.push('Category is required');
    if (!description || typeof description !== 'string' || description.trim().length === 0) errors.push('Description is required');
    if (amount === undefined || amount === null || typeof amount !== 'number' || amount <= 0 || isNaN(amount)) errors.push('Amount must be a positive number');
    if (status && !['Expected', 'Approved', 'Paid'].includes(status)) errors.push('Status must be Expected, Approved, or Paid');

    if (errors.length > 0) {
      return NextResponse.json({ error: errors.join('; ') }, { status: 400 });
    }

    const parsedDate = new Date(date);
    if (isNaN(parsedDate.getTime())) {
      return NextResponse.json({ error: 'Invalid date format' }, { status: 400 });
    }

    const expense = await db.expense.create({
      data: {
        date: parsedDate, month, year,
        category: category.trim(),
        description: description.trim(),
        amount,
        project: (project || '').trim(),
        status: status || 'Expected',
        notes: (notes || '').trim(),
        isOperational: isOperational || false,
      },
    });
    return NextResponse.json(expense, { status: 201 });
  } catch (error) {
    console.error('Expenses POST error:', error);
    return NextResponse.json({ error: 'Failed to create expense' }, { status: 500 });
  }
}
