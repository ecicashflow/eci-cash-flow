import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

// PUT - Mark as read | DELETE - Remove alert
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();

    const alert = await db.cashFlowAlert.findUnique({ where: { id } });
    if (!alert) {
      return NextResponse.json({ error: 'Alert not found' }, { status: 404 });
    }

    const updated = await db.cashFlowAlert.update({
      where: { id },
      data: { isRead: body.isRead !== undefined ? body.isRead : true },
    });

    return NextResponse.json({ alert: updated });
  } catch (error) {
    console.error('Alert update error:', error);
    return NextResponse.json({ error: 'Failed to update alert' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await db.cashFlowAlert.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Alert delete error:', error);
    return NextResponse.json({ error: 'Failed to delete alert' }, { status: 500 });
  }
}
