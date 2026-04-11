import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  try {
    const settings = await db.setting.findMany();
    const obj: Record<string, string> = {};
    for (const s of settings) obj[s.key] = s.value;
    return NextResponse.json(obj);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    // body is array of { key, value }
    const updates = Array.isArray(body) ? body : [body];
    for (const item of updates) {
      if (item.key && item.value !== undefined) {
        await db.setting.upsert({
          where: { key: item.key },
          update: { value: String(item.value) },
          create: { key: item.key, value: String(item.value) },
        });
      }
    }
    const settings = await db.setting.findMany();
    const obj: Record<string, string> = {};
    for (const s of settings) obj[s.key] = s.value;
    return NextResponse.json(obj);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}
