'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Pencil, Trash2, Search, ArrowUpCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
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
import { formatPKR, formatPKRFull, MONTH_NAMES, MONTH_FULL_NAMES, parseMonthKey, fySortKey } from '@/lib/format';

interface Expense {
  id: string; date: string; month: number; year: number;
  category: string; description: string; amount: number;
  project: string; status: string; notes: string; isOperational: boolean;
}

interface CategoryItem { name: string; isOperational: boolean }

const emptyForm = { date: '', month: 4, year: 2026, category: '', description: '', amount: 0, project: '', status: 'Expected', notes: '', isOperational: false };

export default function ExpensesView({ onRefresh }: { onRefresh: () => void }) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [projects, setProjects] = useState<{ name: string }[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMonth, setFilterMonth] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const load = async () => {
    try {
      const params = new URLSearchParams();
      if (filterStatus !== 'all') params.set('status', filterStatus);
      if (filterCategory !== 'all') params.set('category', filterCategory);
      if (filterType === 'operational') params.set('isOperational', 'true');
      else if (filterType === 'project') params.set('isOperational', 'false');
      if (searchTerm) params.set('search', searchTerm);
      const res = await fetch(`/api/expenses?${params.toString()}`);
      if (!res.ok) throw new Error();
      setExpenses(await res.json());
    } catch { toast.error('Failed to load expenses'); }
  };

  const loadMeta = async () => {
    try {
      const [catRes, projRes] = await Promise.all([fetch('/api/categories?type=expense'), fetch('/api/projects')]);
      setCategories(await catRes.json());
      setProjects(await projRes.json());
    } catch {}
  };

  useEffect(() => { load(); }, [filterStatus, filterCategory, filterType, searchTerm]);
  useEffect(() => { loadMeta(); }, []);

  const filtered = useMemo(() => {
    if (filterMonth === 'all') return expenses;
    const { month, year } = parseMonthKey(filterMonth);
    return expenses.filter(e => e.month === month && e.year === year);
  }, [expenses, filterMonth]);

  const totalAmount = filtered.reduce((s, e) => s + e.amount, 0);
  const totalOps = filtered.filter(e => e.isOperational).reduce((s, e) => s + e.amount, 0);
  const totalProj = filtered.filter(e => !e.isOperational).reduce((s, e) => s + e.amount, 0);

  const openCreate = () => { setEditing(null); setForm({ ...emptyForm, date: new Date().toISOString().split('T')[0] }); setErrors({}); setDialogOpen(true); };

  const openEdit = (e: Expense) => {
    setEditing(e);
    setForm({ date: new Date(e.date).toISOString().split('T')[0], month: e.month, year: e.year, category: e.category, description: e.description, amount: e.amount, project: e.project, status: e.status, notes: e.notes, isOperational: e.isOperational });
    setErrors({}); setDialogOpen(true);
  };

  const handleDateChange = (d: string) => {
    if (!d) return;
    const dt = new Date(d);
    if (!isNaN(dt.getTime())) setForm({ ...form, date: d, month: dt.getMonth() + 1, year: dt.getFullYear() });
  };

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!form.date) e.date = 'Date is required';
    if (!form.category.trim()) e.category = 'Category is required';
    if (!form.description.trim()) e.description = 'Description is required';
    if (!form.amount || form.amount <= 0) e.amount = 'Amount must be positive';
    setErrors(e); return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const url = editing ? `/api/expenses/${editing.id}` : '/api/expenses';
      const method = editing ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d.error || 'Failed to save'); return; }
      toast.success(editing ? 'Expense updated' : 'Expense created');
      setDialogOpen(false); load(); onRefresh();
    } catch { toast.error('Failed to save expense'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this expense? This cannot be undone.')) return;
    try {
      const res = await fetch(`/api/expenses/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      toast.success('Expense deleted'); load(); onRefresh();
    } catch { toast.error('Failed to delete'); }
  };

  const statusColor = (s: string) => s === 'Paid' ? 'bg-emerald-100 text-emerald-800' : s === 'Approved' ? 'bg-sky-100 text-sky-800' : 'bg-amber-100 text-amber-800';

  const uniqueMonths = useMemo(() => {
    const set = new Set<string>();
    expenses.forEach(e => set.add(`${e.month}-${e.year}`));
    return Array.from(set).sort((a, b) => fySortKey(a) - fySortKey(b));
  }, [expenses]);

  const hasFilters = filterMonth !== 'all' || filterStatus !== 'all' || filterCategory !== 'all' || filterType !== 'all' || searchTerm;

  return (
    <div className="space-y-5">
      <Card className="shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex gap-6">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Total Expenses</p>
                <p className="text-2xl font-bold text-red-700">{formatPKRFull(totalAmount)}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Operational</p>
                <p className="text-base font-semibold text-orange-600">{formatPKRFull(totalOps)}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Project-Based</p>
                <p className="text-base font-semibold text-red-600">{formatPKRFull(totalProj)}</p>
              </div>
            </div>
            <Button onClick={openCreate} size="sm"><Plus className="w-4 h-4 mr-1.5" /> Add Expense</Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2.5 items-center">
        <div className="flex items-center gap-2 flex-1 min-w-[200px] max-w-xs">
          <Search className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
          <Input placeholder="Search expenses..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="h-8 text-xs" />
        </div>
        <Select value={filterMonth} onValueChange={setFilterMonth}>
          <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="All Months" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Months</SelectItem>
            {uniqueMonths.map(mk => { const { month: m, year: y } = parseMonthKey(mk); return <SelectItem key={mk} value={mk}>{MONTH_NAMES[m - 1]} {y}</SelectItem>; })}
          </SelectContent>
        </Select>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-44 h-8 text-xs"><SelectValue placeholder="All Categories" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map(c => <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-28 h-8 text-xs"><SelectValue placeholder="All Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="Expected">Expected</SelectItem>
            <SelectItem value="Approved">Approved</SelectItem>
            <SelectItem value="Paid">Paid</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-28 h-8 text-xs"><SelectValue placeholder="All Types" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="operational">Operational</SelectItem>
            <SelectItem value="project">Project</SelectItem>
          </SelectContent>
        </Select>
        {hasFilters && <Button variant="ghost" size="sm" className="h-7 text-[11px]" onClick={() => { setFilterMonth('all'); setFilterStatus('all'); setFilterCategory('all'); setFilterType('all'); setSearchTerm(''); }}>Clear</Button>}
      </div>

      <Card className="shadow-sm">
        <CardContent className="p-0">
          <div className="max-h-[560px] overflow-y-auto custom-scrollbar">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="text-[11px]">Date</TableHead>
                  <TableHead className="text-[11px]">Month</TableHead>
                  <TableHead className="text-[11px]">Category</TableHead>
                  <TableHead className="text-[11px]">Description</TableHead>
                  <TableHead className="text-right text-[11px]">Amount</TableHead>
                  <TableHead className="text-[11px]">Project</TableHead>
                  <TableHead className="text-center text-[11px]">Type</TableHead>
                  <TableHead className="text-center text-[11px]">Status</TableHead>
                  <TableHead className="text-right text-[11px] w-20">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="text-center text-xs text-muted-foreground py-8">No expenses found</TableCell></TableRow>
                ) : filtered.map(e => (
                  <TableRow key={e.id} className={`transition-colors ${e.isOperational ? 'bg-orange-50/30' : 'hover:bg-muted/20'}`}>
                    <TableCell className="text-[11px] font-mono">{new Date(e.date).toLocaleDateString()}</TableCell>
                    <TableCell className="text-[11px]">{MONTH_NAMES[e.month - 1]} {e.year}</TableCell>
                    <TableCell className="text-[11px] font-medium max-w-[160px] truncate" title={e.category}>{e.category}</TableCell>
                    <TableCell className="text-[11px] text-muted-foreground max-w-[120px] truncate">{e.description}</TableCell>
                    <TableCell className="text-right text-[11px] font-semibold font-mono text-red-700">{formatPKR(e.amount)}</TableCell>
                    <TableCell className="text-[11px] text-muted-foreground max-w-[100px] truncate">{e.project || '—'}</TableCell>
                    <TableCell className="text-center">
                      <Badge className={`text-[9px] ${e.isOperational ? 'bg-orange-100 text-orange-800' : 'bg-slate-100 text-slate-700'}`}>
                        {e.isOperational ? 'Ops' : 'Project'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge className={`text-[9px] ${statusColor(e.status)}`}>{e.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(e)} className="h-7 w-7 p-0"><Pencil className="w-3 h-3" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(e.id)} className="h-7 w-7 p-0 text-red-500 hover:text-red-700"><Trash2 className="w-3 h-3" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="text-sm">{editing ? 'Edit Expense' : 'New Expense'}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-3">
            <div>
              <Label className="text-xs">Date *</Label>
              <Input type="date" value={form.date} onChange={e => handleDateChange(e.target.value)} className={`h-8 text-xs ${errors.date ? 'ring-2 ring-red-400' : ''}`} />
              {errors.date && <p className="text-[10px] text-red-600 mt-0.5">{errors.date}</p>}
            </div>
            <p className="text-[10px] text-muted-foreground -mt-1">Month/year auto-filled from date.</p>
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">Month</Label>
                <Select value={String(form.month)} onValueChange={v => setForm({ ...form, month: parseInt(v) })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{MONTH_FULL_NAMES.map((n, i) => <SelectItem key={i} value={String(i + 1)}>{n}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Year</Label><Input type="number" value={form.year} onChange={e => setForm({ ...form, year: parseInt(e.target.value) || 2026 })} className="h-8 text-xs" /></div>
            </div>
            <div>
              <Label className="text-xs">Category *</Label>
              <Select value={form.category} onValueChange={v => {
                const cat = categories.find(c => c.name === v);
                setForm({ ...form, category: v, isOperational: cat?.isOperational || false });
                if (errors.category) setErrors({ ...errors, category: '' });
              }}>
                <SelectTrigger className={`h-8 text-xs ${errors.category ? 'ring-2 ring-red-400' : ''}`}><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__custom__">— Type custom below —</SelectItem>
                  {categories.map(c => <SelectItem key={c.name} value={c.name}>{c.name}{c.isOperational ? ' ⚙' : ''}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input className="mt-1 h-7 text-[11px]" placeholder="Or type custom category" value={form.category} onChange={e => { setForm({ ...form, category: e.target.value }); if (errors.category) setErrors({ ...errors, category: '' }); }} />
              {errors.category && <p className="text-[10px] text-red-600 mt-0.5">{errors.category}</p>}
            </div>
            <div>
              <Label className="text-xs">Description *</Label>
              <Input value={form.description} onChange={e => { setForm({ ...form, description: e.target.value }); if (errors.description) setErrors({ ...errors, description: '' }); }} className={`h-8 text-xs ${errors.description ? 'ring-2 ring-red-400' : ''}`} />
              {errors.description && <p className="text-[10px] text-red-600 mt-0.5">{errors.description}</p>}
            </div>
            <div>
              <Label className="text-xs">Amount (Rs.) *</Label>
              <Input type="number" value={form.amount || ''} onChange={e => { setForm({ ...form, amount: parseFloat(e.target.value) || 0 }); if (errors.amount) setErrors({ ...errors, amount: '' }); }} className={`h-8 text-xs font-mono ${errors.amount ? 'ring-2 ring-red-400' : ''}`} placeholder="0" />
              {errors.amount && <p className="text-[10px] text-red-600 mt-0.5">{errors.amount}</p>}
            </div>
            <div>
              <Label className="text-xs">Project (optional)</Label>
              <Select value={form.project || '__none__'} onValueChange={v => setForm({ ...form, project: v === '__none__' ? '' : v })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select project" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {projects.map(p => <SelectItem key={p.name} value={p.name}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input className="mt-1 h-7 text-[11px]" placeholder="Or type custom project" value={form.project} onChange={e => setForm({ ...form, project: e.target.value })} />
            </div>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <Label className="text-xs">Status</Label>
                <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Expected">Expected</SelectItem>
                    <SelectItem value="Approved">Approved</SelectItem>
                    <SelectItem value="Paid">Paid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2 pt-4">
                <Checkbox checked={form.isOperational} onCheckedChange={v => setForm({ ...form, isOperational: !!v })} />
                <Label className="text-xs">Operational</Label>
              </div>
            </div>
            <div><Label className="text-xs">Notes</Label><Input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className="h-8 text-xs" placeholder="Optional" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="h-8 text-xs">Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="h-8 text-xs">{saving ? 'Saving...' : editing ? 'Update' : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
