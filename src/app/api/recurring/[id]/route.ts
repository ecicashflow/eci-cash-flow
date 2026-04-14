import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const recurring = await db.recurringExpense.findUnique({ where: { id } });
    if (!recurring) {
      return NextResponse.json({ error: 'Recurring expense not found' }, { status: 404 });
    }
    return NextResponse.json(recurring);
  } catch (error) {
    console.error('Recurring GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch recurring expense' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();

    const existing = await db.recurringExpense.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Recurring expense not found' }, { status: 404 });
    }

    if (body.amount !== undefined && (typeof body.amount !== 'number' || body.amount <= 0 || isNaN(body.amount))) {
      return NextResponse.json({ error: 'Amount must be a positive number' }, { status: 400 });
    }
    if (body.frequency && !['monthly', 'quarterly', 'yearly'].includes(body.frequency)) {
      return NextResponse.json({ error: 'Frequency must be monthly, quarterly, or yearly' }, { status: 400 });
    }
    if (body.title !== undefined && (typeof body.title !== 'string' || body.title.trim().length === 0)) {
      return NextResponse.json({ error: 'Title cannot be empty' }, { status: 400 });
    }
    if (body.category !== undefined && (typeof body.category !== 'string' || body.category.trim().length === 0)) {
      return NextResponse.json({ error: 'Category cannot be empty' }, { status: 400 });
    }
    if (body.nextDate) {
      const parsedDate = new Date(body.nextDate);
      if (isNaN(parsedDate.getTime())) {
        return NextResponse.json({ error: 'Invalid next date format' }, { status: 400 });
      }
    }

    const data: any = { ...body };
    if (body.title) data.title = body.title.trim();
    if (body.category) data.category = body.category.trim();
    if (body.project !== undefined) data.project = body.project.trim();
    if (body.notes !== undefined) data.notes = body.notes.trim();
    if (body.nextDate) data.nextDate = new Date(body.nextDate);

    const recurring = await db.recurringExpense.update({ where: { id }, data });
    return NextResponse.json(recurring);
  } catch (error) {
    console.error('Recurring PUT error:', error);
    return NextResponse.json({ error: 'Failed to update recurring expense' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const existing = await db.recurringExpense.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Recurring expense not found' }, { status: 404 });
    }

    await db.recurringExpense.delete({ where: { id } });
    return NextResponse.json({ success: true, message: 'Recurring expense deleted' });
  } catch (error) {
    console.error('Recurring DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete recurring expense' }, { status: 500 });
  }
}
