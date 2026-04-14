'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Pencil, Trash2, Search, FileText, CheckCircle, Clock, AlertTriangle, XCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { formatPKR, formatPKRFull } from '@/lib/format';

interface Invoice {
  id: string;
  invoiceNumber: string;
  client: string;
  description: string;
  amount: number;
  dueDate: string;
  status: string;
  paidDate: string;
  paidAmount: number;
  createdAt: string;
  updatedAt: string;
}

interface InvoiceSummary {
  totalOutstanding: number;
  totalOverdue: number;
  totalPaid: number;
  avgDaysToPay: number;
}

const emptyForm = {
  invoiceNumber: '', client: '', description: '', amount: 0,
  dueDate: '', status: 'Pending', paidDate: '', paidAmount: 0,
};

export default function InvoicesView({ onRefresh }: { onRefresh: () => void }) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [summary, setSummary] = useState<InvoiceSummary>({ totalOutstanding: 0, totalOverdue: 0, totalPaid: 0, avgDaysToPay: 0 });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [markPaidDialogOpen, setMarkPaidDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Invoice | null>(null);
  const [markPaidInvoice, setMarkPaidInvoice] = useState<Invoice | null>(null);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [markPaidAmount, setMarkPaidAmount] = useState(0);

  const load = async () => {
    try {
      const params = new URLSearchParams();
      if (filterStatus !== 'all') params.set('status', filterStatus);
      if (searchTerm) params.set('search', searchTerm);
      const res = await fetch(`/api/invoices?${params.toString()}`);
      if (!res.ok) throw new Error();
      setInvoices(await res.json());
    } catch { toast.error('Failed to load invoices'); }
  };

  const loadSummary = async () => {
    try {
      const res = await fetch('/api/invoices/summary');
      if (!res.ok) throw new Error();
      setSummary(await res.json());
    } catch {}
  };

  useEffect(() => { load(); loadSummary(); }, [filterStatus, searchTerm]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm, invoiceNumber: `INV-${String(Date.now()).slice(-6)}` });
    setErrors({});
    setDialogOpen(true);
  };

  const openEdit = (inv: Invoice) => {
    setEditing(inv);
    setForm({
      invoiceNumber: inv.invoiceNumber, client: inv.client, description: inv.description,
      amount: inv.amount, dueDate: inv.dueDate ? new Date(inv.dueDate).toISOString().split('T')[0] : '',
      status: inv.status, paidDate: inv.paidDate ? new Date(inv.paidDate).toISOString().split('T')[0] : '',
      paidAmount: inv.paidAmount,
    });
    setErrors({});
    setDialogOpen(true);
  };

  const openMarkPaid = (inv: Invoice) => {
    setMarkPaidInvoice(inv);
    setMarkPaidAmount(inv.amount);
    setMarkPaidDialogOpen(true);
  };

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!form.invoiceNumber.trim()) e.invoiceNumber = 'Invoice number is required';
    if (!form.client.trim()) e.client = 'Client is required';
    if (!form.amount || form.amount <= 0) e.amount = 'Amount must be positive';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const url = editing ? `/api/invoices/${editing.id}` : '/api/invoices';
      const method = editing ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d.error || 'Failed to save'); return; }
      toast.success(editing ? 'Invoice updated' : 'Invoice created');
      setDialogOpen(false); load(); loadSummary(); onRefresh();
    } catch { toast.error('Failed to save invoice'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this invoice? This cannot be undone.')) return;
    try {
      const res = await fetch(`/api/invoices/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      toast.success('Invoice deleted'); load(); loadSummary(); onRefresh();
    } catch { toast.error('Failed to delete invoice'); }
  };

  const handleMarkPaid = async () => {
    if (!markPaidInvoice) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/invoices/${markPaidInvoice.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...markPaidInvoice,
          status: 'Paid',
          paidDate: new Date().toISOString().split('T')[0],
          paidAmount: markPaidAmount,
        }),
      });
      if (!res.ok) throw new Error();
      toast.success('Invoice marked as paid');
      setMarkPaidDialogOpen(false); load(); loadSummary(); onRefresh();
    } catch { toast.error('Failed to mark as paid'); }
    finally { setSaving(false); }
  };

  const isOverdue = (inv: Invoice) => {
    if (inv.status === 'Paid' || inv.status === 'Cancelled') return false;
    if (!inv.dueDate) return false;
    return new Date(inv.dueDate) < new Date();
  };

  const statusColor = (s: string) => {
    switch (s) {
      case 'Pending': return 'bg-blue-50 text-blue-800 border-blue-200/80';
      case 'Sent': return 'bg-amber-50 text-amber-800 border-amber-200/80';
      case 'Paid': return 'bg-emerald-50 text-emerald-800 border-emerald-200/80';
      case 'Overdue': return 'bg-red-50 text-red-800 border-red-200/80';
      case 'Cancelled': return 'bg-slate-50 text-slate-600 border-slate-200/80';
      default: return 'bg-slate-50 text-slate-700 border-slate-200/80';
    }
  };

  const statusIcon = (s: string) => {
    switch (s) {
      case 'Paid': return <CheckCircle className="w-3 h-3 text-emerald-500" />;
      case 'Overdue': return <AlertTriangle className="w-3 h-3 text-red-500" />;
      case 'Cancelled': return <XCircle className="w-3 h-3 text-slate-400" />;
      default: return <Clock className="w-3 h-3 text-amber-500" />;
    }
  };

  const hasFilters = filterStatus !== 'all' || searchTerm;

  return (
    <div className="space-y-5">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="shadow-md border-slate-200/60 bg-gradient-to-br from-blue-50/90 via-white to-blue-50/40 ring-1 ring-blue-200/70">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="p-1.5 rounded-lg bg-blue-100/80"><FileText className="w-3.5 h-3.5 text-blue-600" /></div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Outstanding</p>
            </div>
            <p className="text-xl font-extrabold tracking-tight text-blue-700">{formatPKRFull(summary.totalOutstanding)}</p>
          </CardContent>
        </Card>
        <Card className="shadow-md border-slate-200/60 bg-gradient-to-br from-red-50/90 via-white to-red-50/40 ring-1 ring-red-200/70">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="p-1.5 rounded-lg bg-red-100/80"><AlertTriangle className="w-3.5 h-3.5 text-red-600" /></div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Overdue</p>
            </div>
            <p className="text-xl font-extrabold tracking-tight text-red-700">{formatPKRFull(summary.totalOverdue)}</p>
          </CardContent>
        </Card>
        <Card className="shadow-md border-slate-200/60 bg-gradient-to-br from-emerald-50/90 via-white to-emerald-50/40 ring-1 ring-emerald-200/70">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="p-1.5 rounded-lg bg-emerald-100/80"><CheckCircle className="w-3.5 h-3.5 text-emerald-600" /></div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Paid</p>
            </div>
            <p className="text-xl font-extrabold tracking-tight text-emerald-700">{formatPKRFull(summary.totalPaid)}</p>
          </CardContent>
        </Card>
        <Card className="shadow-md border-slate-200/60 bg-gradient-to-br from-violet-50/90 via-white to-violet-50/40 ring-1 ring-violet-200/70">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="p-1.5 rounded-lg bg-violet-100/80"><Clock className="w-3.5 h-3.5 text-violet-600" /></div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Avg Days to Pay</p>
            </div>
            <p className="text-xl font-extrabold tracking-tight text-violet-700">{summary.avgDaysToPay > 0 ? `${summary.avgDaysToPay}d` : '—'}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2.5 items-center">
        <div className="flex items-center gap-2 flex-1 min-w-[200px] max-w-xs">
          <Search className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
          <Input placeholder="Search by client or invoice #..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="h-8 text-xs rounded-lg border-border/70" />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-32 h-8 text-xs rounded-lg border-border/70"><SelectValue placeholder="All Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="Pending">Pending</SelectItem>
            <SelectItem value="Sent">Sent</SelectItem>
            <SelectItem value="Paid">Paid</SelectItem>
            <SelectItem value="Overdue">Overdue</SelectItem>
            <SelectItem value="Cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={openCreate} size="sm" className="gap-1.5 rounded-lg shadow-sm font-medium"><Plus className="w-4 h-4" /> New Invoice</Button>
        {hasFilters && (
          <Button variant="ghost" size="sm" className="h-7 text-[11px] rounded-lg" onClick={() => { setFilterStatus('all'); setSearchTerm(''); }}>Clear</Button>
        )}
      </div>

      {/* Table */}
      <Card className="shadow-md border-slate-200/60">
        <CardContent className="p-0">
          <div className="max-h-[560px] overflow-y-auto custom-scrollbar">
            <Table>
              <TableHeader>
                <TableRow className="bg-gradient-to-r from-slate-50 to-slate-100/80 border-b border-slate-200/60">
                  <TableHead className="text-[11px] font-bold text-slate-600 px-5 py-3">Invoice #</TableHead>
                  <TableHead className="text-[11px] font-bold text-slate-600 py-3">Client</TableHead>
                  <TableHead className="text-[11px] font-bold text-slate-600 py-3">Description</TableHead>
                  <TableHead className="text-right text-[11px] font-bold text-slate-600 py-3">Amount</TableHead>
                  <TableHead className="text-[11px] font-bold text-slate-600 py-3">Due Date</TableHead>
                  <TableHead className="text-center text-[11px] font-bold text-slate-600 py-3">Status</TableHead>
                  <TableHead className="text-[11px] font-bold text-slate-600 py-3">Paid Date</TableHead>
                  <TableHead className="text-right text-[11px] font-bold text-slate-600 py-3">Paid Amt</TableHead>
                  <TableHead className="text-right text-[11px] font-bold text-slate-600 px-5 py-3 w-24">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="text-center text-xs text-slate-400 py-12 font-medium">No invoices found</TableCell></TableRow>
                ) : invoices.map(inv => {
                  const overdue = isOverdue(inv);
                  return (
                    <TableRow key={inv.id} className={`border-b border-slate-100/80 transition-colors duration-150 ${overdue ? 'bg-red-50/40' : 'hover:bg-slate-50/60'}`}>
                      <TableCell className="text-[11px] font-semibold text-slate-800 font-mono px-5">
                        <div className="flex items-center gap-2">
                          <FileText className={`w-3 h-3 flex-shrink-0 ${overdue ? 'text-red-400' : 'text-slate-400'}`} />
                          {inv.invoiceNumber}
                        </div>
                      </TableCell>
                      <TableCell className="text-[11px] font-semibold text-slate-700 max-w-[140px] truncate" title={inv.client}>{inv.client}</TableCell>
                      <TableCell className="text-[11px] text-slate-400 max-w-[150px] truncate" title={inv.description}>{inv.description || '—'}</TableCell>
                      <TableCell className="text-right text-[11px] font-bold font-mono tabular-nums text-slate-700">{formatPKR(inv.amount)}</TableCell>
                      <TableCell className="text-[11px] text-slate-600">
                        {inv.dueDate ? (
                          <span className={overdue ? 'text-red-600 font-semibold' : ''}>
                            {new Date(inv.dueDate).toLocaleDateString()}
                            {overdue && ' ⚠'}
                          </span>
                        ) : '—'}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className={`text-[9px] shadow-sm font-semibold px-2.5 py-0.5 rounded-md ${statusColor(inv.status)}`}>
                          {statusIcon(inv.status)}
                          <span className="ml-1">{inv.status}</span>
                        </Badge>
                      </TableCell>
                      <TableCell className="text-[11px] text-slate-400">{inv.paidDate ? new Date(inv.paidDate).toLocaleDateString() : '—'}</TableCell>
                      <TableCell className="text-right text-[11px] font-mono tabular-nums text-emerald-600 font-semibold">{inv.paidAmount > 0 ? formatPKR(inv.paidAmount) : '—'}</TableCell>
                      <TableCell className="text-right px-5">
                        <div className="flex items-center justify-end gap-0.5">
                          {inv.status !== 'Paid' && inv.status !== 'Cancelled' && (
                            <Button variant="ghost" size="sm" onClick={() => openMarkPaid(inv)} className="h-7 w-7 p-0 rounded-lg hover:bg-emerald-50" title="Mark as Paid">
                              <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                            </Button>
                          )}
                          <Button variant="ghost" size="sm" onClick={() => openEdit(inv)} className="h-7 w-7 p-0 rounded-lg hover:bg-indigo-50"><Pencil className="w-3 h-3 text-slate-500" /></Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(inv.id)} className="h-7 w-7 p-0 rounded-lg hover:bg-red-50 text-red-500 hover:text-red-700"><Trash2 className="w-3 h-3" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md rounded-xl">
          <DialogHeader><DialogTitle className="text-sm font-bold tracking-tight">{editing ? 'Edit Invoice' : 'New Invoice'}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-3">
            <div>
              <Label className="text-xs font-semibold text-slate-700">Invoice Number *</Label>
              <Input value={form.invoiceNumber} onChange={e => { setForm({ ...form, invoiceNumber: e.target.value }); if (errors.invoiceNumber) setErrors({ ...errors, invoiceNumber: '' }); }} className={`h-8 text-xs font-mono rounded-lg mt-1 ${errors.invoiceNumber ? 'ring-2 ring-red-400' : ''}`} placeholder="INV-001" />
              {errors.invoiceNumber && <p className="text-[10px] text-red-600 mt-0.5">{errors.invoiceNumber}</p>}
            </div>
            <div>
              <Label className="text-xs font-semibold text-slate-700">Client *</Label>
              <Input value={form.client} onChange={e => { setForm({ ...form, client: e.target.value }); if (errors.client) setErrors({ ...errors, client: '' }); }} className={`h-8 text-xs rounded-lg mt-1 ${errors.client ? 'ring-2 ring-red-400' : ''}`} placeholder="Client name" />
              {errors.client && <p className="text-[10px] text-red-600 mt-0.5">{errors.client}</p>}
            </div>
            <div>
              <Label className="text-xs font-semibold text-slate-700">Description</Label>
              <Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="h-8 text-xs rounded-lg mt-1" placeholder="Optional" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs font-semibold text-slate-700">Amount (Rs.) *</Label>
                <Input type="number" value={form.amount || ''} onChange={e => { setForm({ ...form, amount: parseFloat(e.target.value) || 0 }); if (errors.amount) setErrors({ ...errors, amount: '' }); }} className={`h-8 text-xs font-mono rounded-lg mt-1 ${errors.amount ? 'ring-2 ring-red-400' : ''}`} placeholder="0" />
                {errors.amount && <p className="text-[10px] text-red-600 mt-0.5">{errors.amount}</p>}
              </div>
              <div>
                <Label className="text-xs font-semibold text-slate-700">Due Date</Label>
                <Input type="date" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} className="h-8 text-xs rounded-lg mt-1" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs font-semibold text-slate-700">Status</Label>
                <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                  <SelectTrigger className="h-8 text-xs rounded-lg mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Pending">Pending</SelectItem>
                    <SelectItem value="Sent">Sent</SelectItem>
                    <SelectItem value="Paid">Paid</SelectItem>
                    <SelectItem value="Overdue">Overdue</SelectItem>
                    <SelectItem value="Cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-semibold text-slate-700">Paid Date</Label>
                <Input type="date" value={form.paidDate} onChange={e => setForm({ ...form, paidDate: e.target.value })} className="h-8 text-xs rounded-lg mt-1" />
              </div>
            </div>
            <div>
              <Label className="text-xs font-semibold text-slate-700">Paid Amount (Rs.)</Label>
              <Input type="number" value={form.paidAmount || ''} onChange={e => setForm({ ...form, paidAmount: parseFloat(e.target.value) || 0 })} className="h-8 text-xs font-mono rounded-lg mt-1" placeholder="0" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="h-8 text-xs rounded-lg">Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="h-8 text-xs rounded-lg font-medium shadow-sm">{saving ? 'Saving...' : editing ? 'Update' : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mark as Paid Dialog */}
      <Dialog open={markPaidDialogOpen} onOpenChange={setMarkPaidDialogOpen}>
        <DialogContent className="max-w-sm rounded-xl">
          <DialogHeader><DialogTitle className="text-sm font-bold tracking-tight">Mark as Paid</DialogTitle></DialogHeader>
          <div className="space-y-3 py-3">
            <p className="text-xs text-slate-600">Confirm payment for <span className="font-bold">{markPaidInvoice?.invoiceNumber}</span> — <span className="font-semibold">{markPaidInvoice?.client}</span></p>
            <div>
              <Label className="text-xs font-semibold text-slate-700">Payment Amount (Rs.)</Label>
              <Input type="number" value={markPaidAmount || ''} onChange={e => setMarkPaidAmount(parseFloat(e.target.value) || 0)} className="h-8 text-xs font-mono rounded-lg mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMarkPaidDialogOpen(false)} className="h-8 text-xs rounded-lg">Cancel</Button>
            <Button onClick={handleMarkPaid} disabled={saving} className="h-8 text-xs rounded-lg font-medium shadow-sm bg-emerald-600 hover:bg-emerald-700">{saving ? 'Saving...' : 'Confirm Payment'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
