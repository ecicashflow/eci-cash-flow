'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Pencil, Trash2, Search, ArrowDownCircle, ChevronDown } from 'lucide-react';
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
import { formatPKR, formatPKRFull, MONTH_NAMES, MONTH_FULL_NAMES, getFYMonths, parseMonthKey, fySortKey } from '@/lib/format';

interface Receipt {
  id: string; date: string; month: number; year: number;
  clientProject: string; description: string; amount: number;
  status: string; notes: string;
}

const emptyForm = { date: '', month: 4, year: 2026, clientProject: '', description: '', amount: 0, status: 'Expected', notes: '' };

export default function ReceiptsView({ onRefresh }: { onRefresh: () => void }) {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [projects, setProjects] = useState<{ name: string }[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Receipt | null>(null);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMonth, setFilterMonth] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const load = async () => {
    try {
      const params = new URLSearchParams();
      if (filterStatus !== 'all') params.set('status', filterStatus);
      if (searchTerm) params.set('search', searchTerm);
      const res = await fetch(`/api/receipts?${params.toString()}`);
      if (!res.ok) throw new Error();
      setReceipts(await res.json());
    } catch { toast.error('Failed to load receipts'); }
  };

  const loadProjects = async () => {
    try { setProjects(await (await fetch('/api/projects')).json()); } catch {}
  };

  useEffect(() => { load(); }, [filterStatus, searchTerm]);
  useEffect(() => { loadProjects(); }, []);

  const filteredReceipts = useMemo(() => {
    if (filterMonth === 'all') return receipts;
    const { month, year } = parseMonthKey(filterMonth);
    return receipts.filter(r => r.month === month && r.year === year);
  }, [receipts, filterMonth]);

  const totalAmount = filteredReceipts.reduce((s, r) => s + r.amount, 0);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm, date: new Date().toISOString().split('T')[0] });
    setErrors({});
    setDialogOpen(true);
  };

  const openEdit = (r: Receipt) => {
    setEditing(r);
    setForm({
      date: new Date(r.date).toISOString().split('T')[0], month: r.month, year: r.year,
      clientProject: r.clientProject, description: r.description, amount: r.amount, status: r.status, notes: r.notes,
    });
    setErrors({});
    setDialogOpen(true);
  };

  const handleDateChange = (dateStr: string) => {
    if (!dateStr) return;
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      setForm({ ...form, date: dateStr, month: d.getMonth() + 1, year: d.getFullYear() });
      if (errors.date) setErrors({ ...errors, date: '' });
    }
  };

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!form.date) e.date = 'Date is required';
    if (!form.clientProject.trim()) e.clientProject = 'Client/Project is required';
    if (!form.amount || form.amount <= 0) e.amount = 'Amount must be positive';
    if (form.month < 1 || form.month > 12) e.month = 'Invalid month';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const url = editing ? `/api/receipts/${editing.id}` : '/api/receipts';
      const method = editing ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || 'Failed to save receipt');
        return;
      }
      toast.success(editing ? 'Receipt updated' : 'Receipt created');
      setDialogOpen(false);
      load();
      onRefresh();
    } catch { toast.error('Failed to save receipt'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this receipt? This cannot be undone.')) return;
    try {
      const res = await fetch(`/api/receipts/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      toast.success('Receipt deleted');
      load();
      onRefresh();
    } catch { toast.error('Failed to delete receipt'); }
  };

  const statusColor = (s: string) => s === 'Received' ? 'bg-emerald-100 text-emerald-800' : s === 'Confirmed' ? 'bg-sky-100 text-sky-800' : 'bg-amber-100 text-amber-800';

  const uniqueMonths = useMemo(() => {
    const set = new Set<string>();
    receipts.forEach(r => set.add(`${r.month}-${r.year}`));
    return Array.from(set).sort((a, b) => fySortKey(a) - fySortKey(b));
  }, [receipts]);

  return (
    <div className="space-y-5">
      {/* Summary + Actions */}
      <Card className="shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Total Receipts</p>
              <p className="text-2xl font-bold text-emerald-700">{formatPKRFull(totalAmount)}</p>
              <p className="text-[11px] text-muted-foreground">{filteredReceipts.length} entries</p>
            </div>
            <Button onClick={openCreate} size="sm">
              <Plus className="w-4 h-4 mr-1.5" /> Add Receipt
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex flex-wrap gap-2.5 items-center">
        <div className="flex items-center gap-2 flex-1 min-w-[200px] max-w-xs">
          <Search className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
          <Input placeholder="Search receipts..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="h-8 text-xs" />
        </div>
        <Select value={filterMonth} onValueChange={setFilterMonth}>
          <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="All Months" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Months</SelectItem>
            {uniqueMonths.map(mk => {
              const { month: m, year: y } = parseMonthKey(mk);
              return <SelectItem key={mk} value={mk}>{MONTH_NAMES[m - 1]} {y}</SelectItem>;
            })}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-32 h-8 text-xs"><SelectValue placeholder="All Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="Expected">Expected</SelectItem>
            <SelectItem value="Confirmed">Confirmed</SelectItem>
            <SelectItem value="Received">Received</SelectItem>
          </SelectContent>
        </Select>
        {(filterMonth !== 'all' || filterStatus !== 'all' || searchTerm) && (
          <Button variant="ghost" size="sm" className="h-7 text-[11px]" onClick={() => { setFilterMonth('all'); setFilterStatus('all'); setSearchTerm(''); }}>
            Clear filters
          </Button>
        )}
      </div>

      {/* Table */}
      <Card className="shadow-sm">
        <CardContent className="p-0">
          <div className="max-h-[560px] overflow-y-auto custom-scrollbar">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="text-[11px]">Date</TableHead>
                  <TableHead className="text-[11px]">Month</TableHead>
                  <TableHead className="text-[11px]">Client / Project</TableHead>
                  <TableHead className="text-[11px]">Description</TableHead>
                  <TableHead className="text-right text-[11px]">Amount</TableHead>
                  <TableHead className="text-center text-[11px]">Status</TableHead>
                  <TableHead className="text-right text-[11px] w-20">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredReceipts.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center text-xs text-muted-foreground py-8">No receipts found</TableCell></TableRow>
                ) : filteredReceipts.map(r => (
                  <TableRow key={r.id} className="hover:bg-muted/20 transition-colors">
                    <TableCell className="text-[11px] font-mono">{new Date(r.date).toLocaleDateString()}</TableCell>
                    <TableCell className="text-[11px]">{MONTH_NAMES[r.month - 1]} {r.year}</TableCell>
                    <TableCell className="text-[11px] font-medium max-w-[200px] truncate" title={r.clientProject}>{r.clientProject}</TableCell>
                    <TableCell className="text-[11px] text-muted-foreground max-w-[150px] truncate">{r.description}</TableCell>
                    <TableCell className="text-right text-[11px] font-semibold font-mono text-emerald-700">{formatPKR(r.amount)}</TableCell>
                    <TableCell className="text-center">
                      <Badge className={`text-[9px] ${statusColor(r.status)}`}>{r.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(r)} className="h-7 w-7 p-0"><Pencil className="w-3 h-3" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(r.id)} className="h-7 w-7 p-0 text-red-500 hover:text-red-700"><Trash2 className="w-3 h-3" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">{editing ? 'Edit Receipt' : 'New Receipt'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-3">
            <div>
              <Label className="text-xs">Date *</Label>
              <Input type="date" value={form.date} onChange={e => handleDateChange(e.target.value)} className={`h-8 text-xs ${errors.date ? 'ring-2 ring-red-400' : ''}`} />
              {errors.date && <p className="text-[10px] text-red-600 mt-0.5">{errors.date}</p>}
            </div>
            <p className="text-[10px] text-muted-foreground -mt-1">Month & year auto-filled from date. Override below if needed.</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Month</Label>
                <Select value={String(form.month)} onValueChange={v => setForm({ ...form, month: parseInt(v) })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MONTH_FULL_NAMES.map((name, i) => <SelectItem key={i} value={String(i + 1)}>{name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Year</Label>
                <Input type="number" value={form.year} onChange={e => setForm({ ...form, year: parseInt(e.target.value) || 2026 })} className="h-8 text-xs" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Client / Project *</Label>
              <Select value={form.clientProject} onValueChange={v => { setForm({ ...form, clientProject: v }); if (errors.clientProject) setErrors({ ...errors, clientProject: '' }); }}>
                <SelectTrigger className={`h-8 text-xs ${errors.clientProject ? 'ring-2 ring-red-400' : ''}`}><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  {projects.map(p => <SelectItem key={p.name} value={p.name}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input className="mt-1 h-7 text-[11px]" placeholder="Or type custom name" value={form.clientProject} onChange={e => { setForm({ ...form, clientProject: e.target.value }); if (errors.clientProject) setErrors({ ...errors, clientProject: '' }); }} />
              {errors.clientProject && <p className="text-[10px] text-red-600 mt-0.5">{errors.clientProject}</p>}
            </div>
            <div>
              <Label className="text-xs">Amount (Rs.) *</Label>
              <Input type="number" value={form.amount || ''} onChange={e => { setForm({ ...form, amount: parseFloat(e.target.value) || 0 }); if (errors.amount) setErrors({ ...errors, amount: '' }); }} className={`h-8 text-xs font-mono ${errors.amount ? 'ring-2 ring-red-400' : ''}`} placeholder="0" />
              {errors.amount && <p className="text-[10px] text-red-600 mt-0.5">{errors.amount}</p>}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Status</Label>
                <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Expected">Expected</SelectItem>
                    <SelectItem value="Confirmed">Confirmed</SelectItem>
                    <SelectItem value="Received">Received</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Notes</Label>
                <Input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="h-8 text-xs" placeholder="Optional" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="h-8 text-xs">Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="h-8 text-xs">
              {saving ? 'Saving...' : editing ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
