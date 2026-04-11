import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const where: any = {};
    if (sp.get('type')) where.type = sp.get('type');
    if (sp.get('active')) where.active = sp.get('active') === 'true';
    const categories = await db.category.findMany({ where, orderBy: { name: 'asc' } });
    return NextResponse.json(categories);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, type, isOperational } = body;
    if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 });
    const category = await db.category.create({
      data: { name, type: type || 'expense', isOperational: isOperational || false, active: true },
    });
    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create category' }, { status: 500 });
  }
}
