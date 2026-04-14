import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const invoice = await db.invoice.findUnique({ where: { id } });
    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    const now = new Date();
    const isOverdue =
      invoice.status !== 'Paid' &&
      invoice.status !== 'Cancelled' &&
      invoice.dueDate < now;

    return NextResponse.json({ ...invoice, isOverdue });
  } catch (error) {
    console.error('Invoice GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch invoice' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();

    const existing = await db.invoice.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    if (body.amount !== undefined && (typeof body.amount !== 'number' || body.amount <= 0 || isNaN(body.amount))) {
      return NextResponse.json({ error: 'Amount must be a positive number' }, { status: 400 });
    }
    if (body.paidAmount !== undefined && (typeof body.paidAmount !== 'number' || isNaN(body.paidAmount) || body.paidAmount < 0)) {
      return NextResponse.json({ error: 'Paid amount must be a non-negative number' }, { status: 400 });
    }
    if (body.status && !['Pending', 'Sent', 'Paid', 'Overdue', 'Cancelled'].includes(body.status)) {
      return NextResponse.json({ error: 'Status must be Pending, Sent, Paid, Overdue, or Cancelled' }, { status: 400 });
    }
    if (body.invoiceNumber !== undefined && (typeof body.invoiceNumber !== 'string' || body.invoiceNumber.trim().length === 0)) {
      return NextResponse.json({ error: 'Invoice number cannot be empty' }, { status: 400 });
    }
    if (body.clientProject !== undefined && (typeof body.clientProject !== 'string' || body.clientProject.trim().length === 0)) {
      return NextResponse.json({ error: 'Client/project cannot be empty' }, { status: 400 });
    }
    if (body.dueDate) {
      const parsedDate = new Date(body.dueDate);
      if (isNaN(parsedDate.getTime())) {
        return NextResponse.json({ error: 'Invalid due date format' }, { status: 400 });
      }
    }
    if (body.paidDate) {
      const parsedPaidDate = new Date(body.paidDate);
      if (isNaN(parsedPaidDate.getTime())) {
        return NextResponse.json({ error: 'Invalid paid date format' }, { status: 400 });
      }
    }

    const data: any = { ...body };
    if (body.invoiceNumber) data.invoiceNumber = body.invoiceNumber.trim();
    if (body.clientProject) data.clientProject = body.clientProject.trim();
    if (body.description !== undefined) data.description = body.description.trim();
    if (body.notes !== undefined) data.notes = body.notes.trim();
    if (body.dueDate) data.dueDate = new Date(body.dueDate);
    if (body.paidDate) data.paidDate = new Date(body.paidDate);

    const invoice = await db.invoice.update({ where: { id }, data });
    return NextResponse.json(invoice);
  } catch (error) {
    console.error('Invoice PUT error:', error);
    return NextResponse.json({ error: 'Failed to update invoice' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const existing = await db.invoice.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    await db.invoice.delete({ where: { id } });
    return NextResponse.json({ success: true, message: 'Invoice deleted' });
  } catch (error) {
    console.error('Invoice DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete invoice' }, { status: 500 });
  }
}
