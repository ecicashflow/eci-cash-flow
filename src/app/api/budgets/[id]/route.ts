import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const budget = await db.budget.findUnique({ where: { id } });
    if (!budget) {
      return NextResponse.json({ error: 'Budget not found' }, { status: 404 });
    }
    return NextResponse.json(budget);
  } catch (error) {
    console.error('Budget GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch budget' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();

    const existing = await db.budget.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Budget not found' }, { status: 404 });
    }

    if (body.budgetedAmt !== undefined && (typeof body.budgetedAmt !== 'number' || isNaN(body.budgetedAmt))) {
      return NextResponse.json({ error: 'Budgeted amount must be a number' }, { status: 400 });
    }
    if (body.month !== undefined && (typeof body.month !== 'number' || body.month < 1 || body.month > 12)) {
      return NextResponse.json({ error: 'Month must be between 1 and 12' }, { status: 400 });
    }
    if (body.year !== undefined && (typeof body.year !== 'number' || body.year < 2000 || body.year > 2100)) {
      return NextResponse.json({ error: 'Valid year is required' }, { status: 400 });
    }
    if (body.category !== undefined && (typeof body.category !== 'string' || body.category.trim().length === 0)) {
      return NextResponse.json({ error: 'Category cannot be empty' }, { status: 400 });
    }

    const data: any = { ...body };
    if (body.category) data.category = body.category.trim();
    if (body.notes !== undefined) data.notes = body.notes.trim();

    const budget = await db.budget.update({ where: { id }, data });
    return NextResponse.json(budget);
  } catch (error) {
    console.error('Budget PUT error:', error);
    return NextResponse.json({ error: 'Failed to update budget' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const existing = await db.budget.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Budget not found' }, { status: 404 });
    }

    await db.budget.delete({ where: { id } });
    return NextResponse.json({ success: true, message: 'Budget deleted' });
  } catch (error) {
    console.error('Budget DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete budget' }, { status: 500 });
  }
}
