'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Pencil, Trash2, Search, Wallet, TrendingDown, TrendingUp, AlertTriangle } from 'lucide-react';
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
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { formatPKR, formatPKRFull, MONTH_NAMES, MONTH_FULL_NAMES } from '@/lib/format';

interface Budget {
  id: string;
  category: string;
  month: number;
  year: number;
  amount: number;
}

interface BudgetRow extends Budget {
  actual: number;
  variance: number;
  variancePct: number;
}

interface BudgetSummary {
  totalBudgeted: number;
  totalActual: number;
  totalVariance: number;
}

const emptyForm = { category: '', month: new Date().getMonth() + 1, year: new Date().getFullYear(), amount: 0 };

export default function BudgetView({ onRefresh }: { onRefresh: () => void }) {
  const [budgets, setBudgets] = useState<BudgetRow[]>([]);
  const [summary, setSummary] = useState<BudgetSummary>({ totalBudgeted: 0, totalActual: 0, totalVariance: 0 });
  const [categories, setCategories] = useState<{ name: string }[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Budget | null>(null);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMonth, setFilterMonth] = useState(`${new Date().getMonth() + 1}-${new Date().getFullYear()}`);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const load = async () => {
    try {
      const params = new URLSearchParams();
      if (filterMonth !== 'all') params.set('month', filterMonth);
      const res = await fetch(`/api/budgets?${params.toString()}`);
      if (!res.ok) throw new Error();
      setBudgets(await res.json());
    } catch { toast.error('Failed to load budgets'); }
  };

  const loadSummary = async () => {
    try {
      const params = new URLSearchParams();
      if (filterMonth !== 'all') params.set('month', filterMonth);
      const res = await fetch(`/api/budgets/summary?${params.toString()}`);
      if (!res.ok) throw new Error();
      setSummary(await res.json());
    } catch {}
  };

  const loadCategories = async () => {
    try { setCategories(await (await fetch('/api/categories?type=expense')).json()); } catch {}
  };

  useEffect(() => { load(); loadSummary(); }, [filterMonth]);
  useEffect(() => { loadCategories(); }, []);

  const filtered = useMemo(() => {
    if (!searchTerm) return budgets;
    return budgets.filter(b => b.category.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [budgets, searchTerm]);

  const adherencePct = summary.totalBudgeted > 0
    ? Math.min(100, Math.round((summary.totalActual / summary.totalBudgeted) * 100))
    : 0;

  const openCreate = () => {
    setEditing(null);
    if (filterMonth !== 'all') {
      const [m, y] = filterMonth.split('-').map(Number);
      setForm({ category: '', month: m, year: y, amount: 0 });
    } else {
      setForm({ ...emptyForm });
    }
    setErrors({});
    setDialogOpen(true);
  };

  const openEdit = (b: BudgetRow) => {
    setEditing(b);
    setForm({ category: b.category, month: b.month, year: b.year, amount: b.amount });
    setErrors({});
    setDialogOpen(true);
  };

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!form.category.trim()) e.category = 'Category is required';
    if (!form.amount || form.amount <= 0) e.amount = 'Amount must be positive';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const url = editing ? `/api/budgets/${editing.id}` : '/api/budgets';
      const method = editing ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d.error || 'Failed to save'); return; }
      toast.success(editing ? 'Budget updated' : 'Budget created');
      setDialogOpen(false); load(); loadSummary(); onRefresh();
    } catch { toast.error('Failed to save budget'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this budget? This cannot be undone.')) return;
    try {
      const res = await fetch(`/api/budgets/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      toast.success('Budget deleted'); load(); loadSummary(); onRefresh();
    } catch { toast.error('Failed to delete budget'); }
  };

  const varianceColor = (v: number) => v < 0 ? 'text-red-600' : 'text-emerald-600';
  const varianceBg = (v: number) => v < 0 ? 'bg-red-50' : 'bg-emerald-50';

  const hasFilters = filterMonth !== 'all' || searchTerm;

  return (
    <div className="space-y-5">
      {/* Summary Card */}
      <Card className="shadow-md border-slate-200/60 bg-gradient-to-br from-violet-50/90 via-white to-purple-50/40 ring-1 ring-violet-200/70">
        <CardContent className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex gap-6">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Total Budgeted</p>
                <p className="text-2xl font-extrabold tracking-tight text-violet-700 mt-0.5">{formatPKRFull(summary.totalBudgeted)}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 font-medium">Total Actual</p>
                <p className="text-base font-bold text-slate-700 tabular-nums">{formatPKRFull(summary.totalActual)}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 font-medium">Variance</p>
                <p className={`text-base font-bold tabular-nums ${varianceColor(summary.totalVariance)}`}>{formatPKRFull(summary.totalVariance)}</p>
              </div>
            </div>
            <Button onClick={openCreate} size="sm" className="gap-1.5 rounded-lg shadow-sm font-medium"><Plus className="w-4 h-4" /> Add Budget</Button>
          </div>
          {/* Overall adherence bar */}
          <div className="mt-4">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Budget Adherence</span>
              <span className={`text-[11px] font-bold tabular-nums ${adherencePct > 100 ? 'text-red-600' : adherencePct > 85 ? 'text-emerald-600' : 'text-amber-600'}`}>{adherencePct}%</span>
            </div>
            <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${adherencePct > 100 ? 'bg-gradient-to-r from-red-400 to-red-500' : adherencePct > 85 ? 'bg-gradient-to-r from-emerald-400 to-emerald-500' : 'bg-gradient-to-r from-amber-400 to-amber-500'}`}
                style={{ width: `${Math.min(adherencePct, 100)}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex flex-wrap gap-2.5 items-center">
        <div className="flex items-center gap-2 flex-1 min-w-[200px] max-w-xs">
          <Search className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
          <Input placeholder="Search categories..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="h-8 text-xs rounded-lg border-border/70" />
        </div>
        <Select value={filterMonth} onValueChange={setFilterMonth}>
          <SelectTrigger className="w-40 h-8 text-xs rounded-lg border-border/70"><SelectValue placeholder="All Months" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Months</SelectItem>
            {Array.from({ length: 12 }, (_, i) => {
              const month = i + 1;
              const label = `${MONTH_NAMES[i]} ${new Date().getFullYear()}`;
              return <SelectItem key={month} value={`${month}-${new Date().getFullYear()}`}>{label}</SelectItem>;
            })}
          </SelectContent>
        </Select>
        {hasFilters && (
          <Button variant="ghost" size="sm" className="h-7 text-[11px] rounded-lg" onClick={() => { setFilterMonth('all'); setSearchTerm(''); }}>Clear</Button>
        )}
      </div>

      {/* Budget vs Actual Table */}
      <Card className="shadow-md border-slate-200/60">
        <CardContent className="p-0">
          <div className="max-h-[560px] overflow-y-auto custom-scrollbar">
            <Table>
              <TableHeader>
                <TableRow className="bg-gradient-to-r from-slate-50 to-slate-100/80 border-b border-slate-200/60">
                  <TableHead className="text-[11px] font-bold text-slate-600 px-5 py-3">Category</TableHead>
                  <TableHead className="text-right text-[11px] font-bold text-slate-600 py-3">Budgeted</TableHead>
                  <TableHead className="text-right text-[11px] font-bold text-slate-600 py-3">Actual</TableHead>
                  <TableHead className="text-right text-[11px] font-bold text-slate-600 py-3">Variance</TableHead>
                  <TableHead className="text-right text-[11px] font-bold text-slate-600 py-3">Var %</TableHead>
                  <TableHead className="text-left text-[11px] font-bold text-slate-600 py-3 min-w-[140px]">Adherence</TableHead>
                  <TableHead className="text-right text-[11px] font-bold text-slate-600 px-5 py-3 w-20">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center text-xs text-slate-400 py-12 font-medium">No budgets found</TableCell></TableRow>
                ) : filtered.map(b => {
                  const pct = b.amount > 0 ? Math.min(100, Math.round((b.actual / b.amount) * 100)) : 0;
                  const over = b.actual > b.amount;
                  return (
                    <TableRow key={b.id} className="border-b border-slate-100/80 hover:bg-slate-50/60 transition-colors duration-150">
                      <TableCell className="text-[11px] font-semibold text-slate-800 px-5">
                        <div className="flex items-center gap-2">
                          <div className={`p-1.5 rounded-lg ${over ? 'bg-red-50' : 'bg-emerald-50'}`}>
                            <Wallet className={`w-3.5 h-3.5 ${over ? 'text-red-500' : 'text-emerald-500'}`} />
                          </div>
                          {b.category}
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-[11px] font-bold font-mono tabular-nums text-violet-700">{formatPKR(b.amount)}</TableCell>
                      <TableCell className="text-right text-[11px] font-bold font-mono tabular-nums text-slate-700">{formatPKR(b.actual)}</TableCell>
                      <TableCell className={`text-right text-[11px] font-bold font-mono tabular-nums ${varianceColor(b.variance)}`}>
                        <span className="flex items-center justify-end gap-1">
                          {b.variance < 0 ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
                          {formatPKR(Math.abs(b.variance))}
                        </span>
                      </TableCell>
                      <TableCell className={`text-right text-[11px] font-bold font-mono tabular-nums ${varianceColor(b.variance)}`}>
                        {b.variancePct.toFixed(1)}%
                      </TableCell>
                      <TableCell className="py-2">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${over ? 'bg-gradient-to-r from-red-400 to-red-500' : pct > 85 ? 'bg-gradient-to-r from-emerald-400 to-emerald-500' : 'bg-gradient-to-r from-amber-400 to-amber-500'}`}
                              style={{ width: `${Math.min(pct, 100)}%` }}
                            />
                          </div>
                          <span className={`text-[10px] font-bold tabular-nums ${over ? 'text-red-600' : 'text-emerald-600'}`}>{pct}%</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right px-5">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(b)} className="h-7 w-7 p-0 rounded-lg hover:bg-indigo-50"><Pencil className="w-3 h-3 text-slate-500" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(b.id)} className="h-7 w-7 p-0 rounded-lg hover:bg-red-50 text-red-500 hover:text-red-700"><Trash2 className="w-3 h-3" /></Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md rounded-xl">
          <DialogHeader><DialogTitle className="text-sm font-bold tracking-tight">{editing ? 'Edit Budget' : 'New Budget'}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-3">
            <div>
              <Label className="text-xs font-semibold text-slate-700">Category *</Label>
              <Select value={form.category} onValueChange={v => { setForm({ ...form, category: v }); if (errors.category) setErrors({ ...errors, category: '' }); }}>
                <SelectTrigger className={`h-8 text-xs rounded-lg mt-1 ${errors.category ? 'ring-2 ring-red-400' : ''}`}><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__custom__">— Type custom below —</SelectItem>
                  {categories.map(c => <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input className="mt-1 h-7 text-[11px] rounded-lg" placeholder="Or type custom category" value={form.category} onChange={e => { setForm({ ...form, category: e.target.value }); if (errors.category) setErrors({ ...errors, category: '' }); }} />
              {errors.category && <p className="text-[10px] text-red-600 mt-0.5">{errors.category}</p>}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs font-semibold text-slate-700">Month *</Label>
                <Select value={String(form.month)} onValueChange={v => setForm({ ...form, month: parseInt(v) })}>
                  <SelectTrigger className="h-8 text-xs rounded-lg mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{MONTH_FULL_NAMES.map((n, i) => <SelectItem key={i} value={String(i + 1)}>{n}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-semibold text-slate-700">Year *</Label>
                <Input type="number" value={form.year} onChange={e => setForm({ ...form, year: parseInt(e.target.value) || new Date().getFullYear() })} className="h-8 text-xs rounded-lg mt-1" />
              </div>
            </div>
            <div>
              <Label className="text-xs font-semibold text-slate-700">Budget Amount (Rs.) *</Label>
              <Input type="number" value={form.amount || ''} onChange={e => { setForm({ ...form, amount: parseFloat(e.target.value) || 0 }); if (errors.amount) setErrors({ ...errors, amount: '' }); }} className={`h-8 text-xs font-mono rounded-lg mt-1 ${errors.amount ? 'ring-2 ring-red-400' : ''}`} placeholder="0" />
              {errors.amount && <p className="text-[10px] text-red-600 mt-0.5">{errors.amount}</p>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="h-8 text-xs rounded-lg">Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="h-8 text-xs rounded-lg font-medium shadow-sm">{saving ? 'Saving...' : editing ? 'Update' : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
