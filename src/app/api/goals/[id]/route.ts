import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const goal = await db.goal.findUnique({ where: { id } });
    if (!goal) {
      return NextResponse.json({ error: 'Goal not found' }, { status: 404 });
    }
    return NextResponse.json(goal);
  } catch (error) {
    console.error('Goal GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch goal' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();

    const existing = await db.goal.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Goal not found' }, { status: 404 });
    }

    if (body.targetAmount !== undefined && (typeof body.targetAmount !== 'number' || body.targetAmount <= 0 || isNaN(body.targetAmount))) {
      return NextResponse.json({ error: 'Target amount must be a positive number' }, { status: 400 });
    }
    if (body.currentAmount !== undefined && (typeof body.currentAmount !== 'number' || isNaN(body.currentAmount) || body.currentAmount < 0)) {
      return NextResponse.json({ error: 'Current amount must be a non-negative number' }, { status: 400 });
    }
    if (body.targetType && !['balance', 'reserve', 'savings'].includes(body.targetType)) {
      return NextResponse.json({ error: 'Target type must be balance, reserve, or savings' }, { status: 400 });
    }
    if (body.status && !['active', 'achieved', 'abandoned'].includes(body.status)) {
      return NextResponse.json({ error: 'Status must be active, achieved, or abandoned' }, { status: 400 });
    }
    if (body.title !== undefined && (typeof body.title !== 'string' || body.title.trim().length === 0)) {
      return NextResponse.json({ error: 'Title cannot be empty' }, { status: 400 });
    }
    if (body.targetDate) {
      const parsedDate = new Date(body.targetDate);
      if (isNaN(parsedDate.getTime())) {
        return NextResponse.json({ error: 'Invalid target date format' }, { status: 400 });
      }
    }

    const data: any = { ...body };
    if (body.title) data.title = body.title.trim();
    if (body.description !== undefined) data.description = body.description.trim();
    if (body.targetDate) data.targetDate = new Date(body.targetDate);

    const goal = await db.goal.update({ where: { id }, data });
    return NextResponse.json(goal);
  } catch (error) {
    console.error('Goal PUT error:', error);
    return NextResponse.json({ error: 'Failed to update goal' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const existing = await db.goal.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Goal not found' }, { status: 404 });
    }

    await db.goal.delete({ where: { id } });
    return NextResponse.json({ success: true, message: 'Goal deleted' });
  } catch (error) {
    console.error('Goal DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete goal' }, { status: 500 });
  }
}
