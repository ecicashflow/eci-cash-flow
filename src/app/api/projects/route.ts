import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  try {
    const projects = await db.projectClient.findMany({ where: { active: true }, orderBy: { name: 'asc' } });
    return NextResponse.json(projects);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, code } = body;
    if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 });
    const project = await db.projectClient.create({
      data: { name, code: code || '', active: true },
    });
    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 });
  }
}
