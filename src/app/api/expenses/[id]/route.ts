import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const expense = await db.expense.findUnique({ where: { id } });
    if (!expense) return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
    return NextResponse.json(expense);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch expense' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();

    const existing = await db.expense.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Expense not found' }, { status: 404 });

    if (body.amount !== undefined && (typeof body.amount !== 'number' || body.amount <= 0 || isNaN(body.amount))) {
      return NextResponse.json({ error: 'Amount must be a positive number' }, { status: 400 });
    }
    if (body.month !== undefined && (typeof body.month !== 'number' || body.month < 1 || body.month > 12)) {
      return NextResponse.json({ error: 'Month must be between 1 and 12' }, { status: 400 });
    }
    if (body.category !== undefined && (typeof body.category !== 'string' || body.category.trim().length === 0)) {
      return NextResponse.json({ error: 'Category cannot be empty' }, { status: 400 });
    }
    if (body.description !== undefined && (typeof body.description !== 'string' || body.description.trim().length === 0)) {
      return NextResponse.json({ error: 'Description cannot be empty' }, { status: 400 });
    }
    if (body.status && !['Expected', 'Approved', 'Paid'].includes(body.status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const data: any = { ...body };
    if (body.date) data.date = new Date(body.date);
    if (body.category) data.category = body.category.trim();
    if (body.description) data.description = body.description.trim();
    if (body.project !== undefined) data.project = body.project.trim();
    if (body.notes !== undefined) data.notes = body.notes.trim();

    const expense = await db.expense.update({ where: { id }, data });
    return NextResponse.json(expense);
  } catch (error) {
    console.error('Expenses PUT error:', error);
    return NextResponse.json({ error: 'Failed to update expense' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const existing = await db.expense.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Expense not found' }, { status: 404 });

    await db.expense.delete({ where: { id } });
    return NextResponse.json({ success: true, message: 'Expense deleted' });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete expense' }, { status: 500 });
  }
}
