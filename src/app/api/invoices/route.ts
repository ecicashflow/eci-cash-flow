import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const where: any = {};

    if (sp.get('status')) {
      where.status = sp.get('status');
    }
    if (sp.get('clientProject')) {
      where.clientProject = { contains: sp.get('clientProject')!, mode: 'insensitive' };
    }
    if (sp.get('search')) {
      where.OR = [
        { invoiceNumber: { contains: sp.get('search')!, mode: 'insensitive' } },
        { clientProject: { contains: sp.get('search')!, mode: 'insensitive' } },
        { description: { contains: sp.get('search')!, mode: 'insensitive' } },
        { notes: { contains: sp.get('search')!, mode: 'insensitive' } },
      ];
    }

    const invoices = await db.invoice.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    // Annotate overdue status for invoices that are Pending or Sent but past their due date
    const now = new Date();
    const annotatedInvoices = invoices.map((inv) => {
      const isOverdue =
        inv.status !== 'Paid' &&
        inv.status !== 'Cancelled' &&
        inv.dueDate < now;

      return {
        ...inv,
        isOverdue,
      };
    });

    return NextResponse.json(annotatedInvoices);
  } catch (error) {
    console.error('Invoices GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch invoices' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { invoiceNumber, clientProject, description, amount, dueDate, status, paidDate, paidAmount, notes } = body;

    const errors: string[] = [];
    if (!invoiceNumber || typeof invoiceNumber !== 'string' || invoiceNumber.trim().length === 0) {
      errors.push('Invoice number is required');
    }
    if (!clientProject || typeof clientProject !== 'string' || clientProject.trim().length === 0) {
      errors.push('Client/project is required');
    }
    if (amount === undefined || amount === null || typeof amount !== 'number' || amount <= 0 || isNaN(amount)) {
      errors.push('Amount must be a positive number');
    }
    if (!dueDate) {
      errors.push('Due date is required');
    } else {
      const parsedDate = new Date(dueDate);
      if (isNaN(parsedDate.getTime())) {
        errors.push('Invalid due date format');
      }
    }
    if (status && !['Pending', 'Sent', 'Paid', 'Overdue', 'Cancelled'].includes(status)) {
      errors.push('Status must be Pending, Sent, Paid, Overdue, or Cancelled');
    }
    if (paidDate) {
      const parsedPaidDate = new Date(paidDate);
      if (isNaN(parsedPaidDate.getTime())) {
        errors.push('Invalid paid date format');
      }
    }
    if (paidAmount !== undefined && (typeof paidAmount !== 'number' || isNaN(paidAmount) || paidAmount < 0)) {
      errors.push('Paid amount must be a non-negative number');
    }

    if (errors.length > 0) {
      return NextResponse.json({ error: errors.join('; ') }, { status: 400 });
    }

    const invoice = await db.invoice.create({
      data: {
        invoiceNumber: invoiceNumber.trim(),
        clientProject: clientProject.trim(),
        description: (description || '').trim(),
        amount,
        dueDate: new Date(dueDate),
        status: status || 'Pending',
        paidDate: paidDate ? new Date(paidDate) : null,
        paidAmount: paidAmount || 0,
        notes: (notes || '').trim(),
      },
    });
    return NextResponse.json(invoice, { status: 201 });
  } catch (error) {
    console.error('Invoices POST error:', error);
    return NextResponse.json({ error: 'Failed to create invoice' }, { status: 500 });
  }
}
