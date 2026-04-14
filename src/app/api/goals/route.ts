import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const where: any = {};

    if (sp.get('status')) {
      where.status = sp.get('status');
    }
    if (sp.get('targetType')) {
      where.targetType = sp.get('targetType');
    }
    if (sp.get('search')) {
      where.OR = [
        { title: { contains: sp.get('search')!, mode: 'insensitive' } },
        { description: { contains: sp.get('search')!, mode: 'insensitive' } },
      ];
    }

    const goals = await db.goal.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(goals);
  } catch (error) {
    console.error('Goals GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch goals' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, description, targetType, targetAmount, currentAmount, targetDate, status } = body;

    const errors: string[] = [];
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      errors.push('Title is required');
    }
    if (targetAmount === undefined || targetAmount === null || typeof targetAmount !== 'number' || targetAmount <= 0 || isNaN(targetAmount)) {
      errors.push('Target amount must be a positive number');
    }
    if (targetType && !['balance', 'reserve', 'savings'].includes(targetType)) {
      errors.push('Target type must be balance, reserve, or savings');
    }
    if (status && !['active', 'achieved', 'abandoned'].includes(status)) {
      errors.push('Status must be active, achieved, or abandoned');
    }
    if (!targetDate) {
      errors.push('Target date is required');
    } else {
      const parsedDate = new Date(targetDate);
      if (isNaN(parsedDate.getTime())) {
        errors.push('Invalid target date format');
      }
    }

    if (errors.length > 0) {
      return NextResponse.json({ error: errors.join('; ') }, { status: 400 });
    }

    const goal = await db.goal.create({
      data: {
        title: title.trim(),
        description: (description || '').trim(),
        targetType: targetType || 'balance',
        targetAmount,
        currentAmount: currentAmount || 0,
        targetDate: new Date(targetDate),
        status: status || 'active',
      },
    });
    return NextResponse.json(goal, { status: 201 });
  } catch (error) {
    console.error('Goals POST error:', error);
    return NextResponse.json({ error: 'Failed to create goal' }, { status: 500 });
  }
}
