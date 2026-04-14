import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/alerts - List alerts
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const unreadOnly = sp.get('unread') === 'true';
    const limit = parseInt(sp.get('limit') || '50');

    const alerts = await db.cashFlowAlert.findMany({
      where: unreadOnly ? { isRead: false } : undefined,
      orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
      take: limit,
    });

    const unreadCount = await db.cashFlowAlert.count({ where: { isRead: false } });

    return NextResponse.json({ alerts, unreadCount });
  } catch (error) {
    console.error('Alerts list error:', error);
    return NextResponse.json({ error: 'Failed to fetch alerts' }, { status: 500 });
  }
}

// POST /api/alerts - Create alert
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, title, message, severity, month, year, relatedData } = body;

    if (!type || !title || !message) {
      return NextResponse.json({ error: 'type, title, and message are required' }, { status: 400 });
    }

    const alert = await db.cashFlowAlert.create({
      data: {
        type: type || 'info',
        title: title.trim(),
        message: message.trim(),
        severity: severity || 0,
        month: month ?? null,
        year: year ?? null,
        relatedData: relatedData ? JSON.stringify(relatedData) : '',
      },
    });

    return NextResponse.json({ alert }, { status: 201 });
  } catch (error) {
    console.error('Alert create error:', error);
    return NextResponse.json({ error: 'Failed to create alert' }, { status: 500 });
  }
}
