import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const active = req.nextUrl.searchParams.get('active');
    const where: any = {};
    if (active === 'true') where.active = true;
    const accounts = await db.bankAccount.findMany({ where, orderBy: { bankName: 'asc' } });
    return NextResponse.json(accounts);
  } catch (error) {
    console.error('BankAccounts GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch bank accounts' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { bankName, accountName, accountNumber, currentBalance, active } = body;

    // Validation
    const errors: string[] = [];
    if (!bankName || typeof bankName !== 'string' || bankName.trim().length === 0) errors.push('Bank name is required');
    if (!accountName || typeof accountName !== 'string' || accountName.trim().length === 0) errors.push('Account name is required');
    if (currentBalance === undefined || currentBalance === null || typeof currentBalance !== 'number' || isNaN(currentBalance)) errors.push('Current balance must be a valid number');

    if (errors.length > 0) {
      return NextResponse.json({ error: errors.join('; ') }, { status: 400 });
    }

    const account = await db.bankAccount.create({
      data: {
        bankName: bankName.trim(),
        accountName: accountName.trim(),
        accountNumber: (accountNumber || '').trim(),
        currentBalance,
        active: active !== false,
      },
    });
    return NextResponse.json(account, { status: 201 });
  } catch (error) {
    console.error('BankAccounts POST error:', error);
    return NextResponse.json({ error: 'Failed to create bank account' }, { status: 500 });
  }
}
