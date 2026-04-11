import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const where: any = {};
    if (sp.get('month')) where.month = parseInt(sp.get('month')!);
    if (sp.get('year')) where.year = parseInt(sp.get('year')!);
    if (sp.get('status')) where.status = sp.get('status');
    if (sp.get('client')) where.clientProject = { contains: sp.get('client')!, mode: 'insensitive' };
    if (sp.get('search')) {
      where.OR = [
        { clientProject: { contains: sp.get('search')!, mode: 'insensitive' } },
        { description: { contains: sp.get('search')!, mode: 'insensitive' } },
        { notes: { contains: sp.get('search')!, mode: 'insensitive' } },
      ];
    }
    const receipts = await db.receipt.findMany({ where, orderBy: [{ year: 'asc' }, { month: 'asc' }, { date: 'asc' }] });
    return NextResponse.json(receipts);
  } catch (error) {
    console.error('Receipts GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch receipts' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { date, month, year, clientProject, description, amount, status, notes } = body;

    // Validation
    const errors: string[] = [];
    if (!date) errors.push('Date is required');
    if (!month || typeof month !== 'number' || month < 1 || month > 12) errors.push('Valid month (1-12) is required');
    if (!year || typeof year !== 'number' || year < 2000 || year > 2100) errors.push('Valid year is required');
    if (!clientProject || typeof clientProject !== 'string' || clientProject.trim().length === 0) errors.push('Client/Project is required');
    if (amount === undefined || amount === null || typeof amount !== 'number' || amount <= 0 || isNaN(amount)) errors.push('Amount must be a positive number');
    if (status && !['Expected', 'Confirmed', 'Received'].includes(status)) errors.push('Status must be Expected, Confirmed, or Received');

    if (errors.length > 0) {
      return NextResponse.json({ error: errors.join('; ') }, { status: 400 });
    }

    // Parse and validate date
    const parsedDate = new Date(date);
    if (isNaN(parsedDate.getTime())) {
      return NextResponse.json({ error: 'Invalid date format' }, { status: 400 });
    }

    const receipt = await db.receipt.create({
      data: {
        date: parsedDate, month, year,
        clientProject: clientProject.trim(),
        description: (description || '').trim(),
        amount,
        status: status || 'Expected',
        notes: (notes || '').trim(),
      },
    });
    return NextResponse.json(receipt, { status: 201 });
  } catch (error) {
    console.error('Receipts POST error:', error);
    return NextResponse.json({ error: 'Failed to create receipt' }, { status: 500 });
  }
}
