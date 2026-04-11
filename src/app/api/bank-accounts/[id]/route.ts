import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const account = await db.bankAccount.findUnique({ where: { id } });
    if (!account) return NextResponse.json({ error: 'Bank account not found' }, { status: 404 });
    return NextResponse.json(account);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch bank account' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();

    // Verify exists
    const existing = await db.bankAccount.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Bank account not found' }, { status: 404 });

    // Validate fields if provided
    if (body.bankName !== undefined && (typeof body.bankName !== 'string' || body.bankName.trim().length === 0)) {
      return NextResponse.json({ error: 'Bank name cannot be empty' }, { status: 400 });
    }
    if (body.accountName !== undefined && (typeof body.accountName !== 'string' || body.accountName.trim().length === 0)) {
      return NextResponse.json({ error: 'Account name cannot be empty' }, { status: 400 });
    }
    if (body.currentBalance !== undefined && (typeof body.currentBalance !== 'number' || isNaN(body.currentBalance))) {
      return NextResponse.json({ error: 'Current balance must be a valid number' }, { status: 400 });
    }

    // Clean data
    const data: any = {};
    if (body.bankName) data.bankName = body.bankName.trim();
    if (body.accountName) data.accountName = body.accountName.trim();
    if (body.accountNumber !== undefined) data.accountNumber = body.accountNumber.trim();
    if (body.currentBalance !== undefined) data.currentBalance = body.currentBalance;
    if (body.active !== undefined) data.active = body.active;

    const account = await db.bankAccount.update({ where: { id }, data });
    return NextResponse.json(account);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update bank account' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const existing = await db.bankAccount.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Bank account not found' }, { status: 404 });

    await db.bankAccount.delete({ where: { id } });
    return NextResponse.json({ success: true, message: 'Bank account deleted' });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete bank account' }, { status: 500 });
  }
}
