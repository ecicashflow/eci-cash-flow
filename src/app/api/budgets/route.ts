import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const where: any = {};

    if (sp.get('month')) {
      const month = parseInt(sp.get('month')!);
      if (month < 1 || month > 12) {
        return NextResponse.json({ error: 'Month must be between 1 and 12' }, { status: 400 });
      }
      where.month = month;
    }
    if (sp.get('year')) {
      const year = parseInt(sp.get('year')!);
      if (year < 2000 || year > 2100) {
        return NextResponse.json({ error: 'Valid year is required' }, { status: 400 });
      }
      where.year = year;
    }
    if (sp.get('category')) {
      where.category = { contains: sp.get('category')!, mode: 'insensitive' };
    }

    const budgets = await db.budget.findMany({
      where,
      orderBy: [{ year: 'asc' }, { month: 'asc' }, { category: 'asc' }],
    });
    return NextResponse.json(budgets);
  } catch (error) {
    console.error('Budgets GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch budgets' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { category, month, year, budgetedAmt, notes } = body;

    const errors: string[] = [];
    if (!category || typeof category !== 'string' || category.trim().length === 0) {
      errors.push('Category is required');
    }
    if (!month || typeof month !== 'number' || month < 1 || month > 12) {
      errors.push('Valid month (1-12) is required');
    }
    if (!year || typeof year !== 'number' || year < 2000 || year > 2100) {
      errors.push('Valid year is required');
    }
    if (budgetedAmt === undefined || budgetedAmt === null || typeof budgetedAmt !== 'number' || isNaN(budgetedAmt)) {
      errors.push('Budgeted amount is required and must be a number');
    }

    if (errors.length > 0) {
      return NextResponse.json({ error: errors.join('; ') }, { status: 400 });
    }

    const budget = await db.budget.create({
      data: {
        category: category.trim(),
        month,
        year,
        budgetedAmt,
        notes: (notes || '').trim(),
      },
    });
    return NextResponse.json(budget, { status: 201 });
  } catch (error) {
    console.error('Budgets POST error:', error);
    return NextResponse.json({ error: 'Failed to create budget' }, { status: 500 });
  }
}
