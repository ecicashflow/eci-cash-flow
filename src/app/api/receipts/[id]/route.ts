import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const receipt = await db.receipt.findUnique({ where: { id } });
    if (!receipt) return NextResponse.json({ error: 'Receipt not found' }, { status: 404 });
    return NextResponse.json(receipt);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch receipt' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();

    const existing = await db.receipt.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Receipt not found' }, { status: 404 });

    // Validate
    if (body.amount !== undefined && (typeof body.amount !== 'number' || body.amount <= 0 || isNaN(body.amount))) {
      return NextResponse.json({ error: 'Amount must be a positive number' }, { status: 400 });
    }
    if (body.month !== undefined && (typeof body.month !== 'number' || body.month < 1 || body.month > 12)) {
      return NextResponse.json({ error: 'Month must be between 1 and 12' }, { status: 400 });
    }
    if (body.clientProject !== undefined && (typeof body.clientProject !== 'string' || body.clientProject.trim().length === 0)) {
      return NextResponse.json({ error: 'Client/Project cannot be empty' }, { status: 400 });
    }
    if (body.status && !['Expected', 'Confirmed', 'Received'].includes(body.status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    // Clean data
    const data: any = { ...body };
    if (body.date) data.date = new Date(body.date);
    if (body.clientProject) data.clientProject = body.clientProject.trim();
    if (body.description !== undefined) data.description = body.description.trim();
    if (body.notes !== undefined) data.notes = body.notes.trim();

    const receipt = await db.receipt.update({ where: { id }, data });
    return NextResponse.json(receipt);
  } catch (error) {
    console.error('Receipts PUT error:', error);
    return NextResponse.json({ error: 'Failed to update receipt' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const existing = await db.receipt.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Receipt not found' }, { status: 404 });

    await db.receipt.delete({ where: { id } });
    return NextResponse.json({ success: true, message: 'Receipt deleted' });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete receipt' }, { status: 500 });
  }
}
