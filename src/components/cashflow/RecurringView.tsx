'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Pencil, Trash2, Search, RefreshCw, Repeat, Zap, ToggleLeft, ToggleRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
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

interface RecurringExpense {
  id: string;
  title: string;
  category: string;
  amount: number;
  frequency: string;
  nextDate: string;
  project: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

const emptyForm = {
  title: '', category: '', amount: 0, frequency: 'Monthly',
  nextDate: '', project: '', active: true,
};

export default function RecurringView({ onRefresh }: { onRefresh: () => void }) {
  const [recurring, setRecurring] = useState<RecurringExpense[]>([]);
  const [categories, setCategories] = useState<{ name: string }[]>([]);
  const [projects, setProjects] = useState<{ name: string }[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<RecurringExpense | null>(null);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const load = async () => {
    try {
      const params = new URLSearchParams();
      if (searchTerm) params.set('search', searchTerm);
      const res = await fetch(`/api/recurring?${params.toString()}`);
      if (!res.ok) throw new Error();
      setRecurring(await res.json());
    } catch { toast.error('Failed to load recurring expenses'); }
  };

  const loadMeta = async () => {
    try {
      const [catRes, projRes] = await Promise.all([
        fetch('/api/categories?type=expense'),
        fetch('/api/projects'),
      ]);
      setCategories(await catRes.json());
      setProjects(await projRes.json());
    } catch {}
  };

  useEffect(() => { load(); }, [searchTerm]);
  useEffect(() => { loadMeta(); }, []);

  const activeItems = recurring.filter(r => r.active);
  const totalMonthly = activeItems.reduce((s, r) => {
    switch (r.frequency) {
      case 'Monthly': return s + r.amount;
      case 'Quarterly': return s + r.amount / 3;
      case 'Yearly': return s + r.amount / 12;
      default: return s + r.amount;
    }
  }, 0);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm, nextDate: new Date().toISOString().split('T')[0] });
    setErrors({});
    setDialogOpen(true);
  };

  const openEdit = (r: RecurringExpense) => {
    setEditing(r);
    setForm({
      title: r.title, category: r.category, amount: r.amount, frequency: r.frequency,
      nextDate: r.nextDate ? new Date(r.nextDate).toISOString().split('T')[0] : '',
      project: r.project, active: r.active,
    });
    setErrors({});
    setDialogOpen(true);
  };

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!form.title.trim()) e.title = 'Title is required';
    if (!form.amount || form.amount <= 0) e.amount = 'Amount must be positive';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const url = editing ? `/api/recurring/${editing.id}` : '/api/recurring';
      const method = editing ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d.error || 'Failed to save'); return; }
      toast.success(editing ? 'Recurring expense updated' : 'Recurring expense created');
      setDialogOpen(false); load(); onRefresh();
    } catch { toast.error('Failed to save recurring expense'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this recurring expense? This cannot be undone.')) return;
    try {
      const res = await fetch(`/api/recurring/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      toast.success('Recurring expense deleted'); load(); onRefresh();
    } catch { toast.error('Failed to delete recurring expense'); }
  };

  const handleToggleActive = async (item: RecurringExpense) => {
    try {
      const res = await fetch(`/api/recurring/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...item, active: !item.active }),
      });
      if (!res.ok) throw new Error();
      toast.success(item.active ? 'Deactivated' : 'Activated');
      load(); onRefresh();
    } catch { toast.error('Failed to toggle status'); }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await fetch('/api/recurring/generate', { method: 'POST' });
      if (!res.ok) throw new Error();
      const data = await res.json();
      toast.success(`Generated ${data.count || 0} expense(s) from recurring items`);
      load(); onRefresh();
    } catch { toast.error('Failed to generate expenses'); }
    finally { setGenerating(false); }
  };

  const frequencyColor = (f: string) => {
    switch (f) {
      case 'Monthly': return 'bg-blue-50 text-blue-800 border-blue-200/80';
      case 'Quarterly': return 'bg-amber-50 text-amber-800 border-amber-200/80';
      case 'Yearly': return 'bg-violet-50 text-violet-800 border-violet-200/80';
      default: return 'bg-slate-50 text-slate-700 border-slate-200/80';
    }
  };

  const isDueSoon = (nextDate: string) => {
    if (!nextDate) return false;
    const now = new Date();
    const next = new Date(nextDate);
    const diff = (next.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    return diff <= 7 && diff >= 0;
  };

  const isPastDue = (nextDate: string) => {
    if (!nextDate) return false;
    return new Date(nextDate) < new Date();
  };

  return (
    <div className="space-y-5">
      {/* Summary Card */}
      <Card className="shadow-md border-slate-200/60 bg-gradient-to-br from-orange-50/90 via-white to-amber-50/40 ring-1 ring-orange-200/70">
        <CardContent className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex gap-6">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Est. Monthly Cost</p>
                <p className="text-2xl font-extrabold tracking-tight text-orange-700 mt-0.5">{formatPKRFull(totalMonthly)}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 font-medium">Active Items</p>
                <p className="text-base font-bold text-amber-600 tabular-nums">{activeItems.length}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 font-medium">Inactive</p>
                <p className="text-base font-bold text-slate-500 tabular-nums">{recurring.length - activeItems.length}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={handleGenerate} disabled={generating} variant="outline" size="sm" className="gap-1.5 rounded-lg shadow-sm font-medium border-orange-200/80 text-orange-700 hover:bg-orange-50">
                <RefreshCw className={`w-3.5 h-3.5 ${generating ? 'animate-spin' : ''}`} />
                {generating ? 'Generating...' : 'Generate Expenses'}
              </Button>
              <Button onClick={openCreate} size="sm" className="gap-1.5 rounded-lg shadow-sm font-medium"><Plus className="w-4 h-4" /> Add Recurring</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex flex-wrap gap-2.5 items-center">
        <div className="flex items-center gap-2 flex-1 min-w-[200px] max-w-xs">
          <Search className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
          <Input placeholder="Search recurring expenses..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="h-8 text-xs rounded-lg border-border/70" />
        </div>
        {searchTerm && (
          <Button variant="ghost" size="sm" className="h-7 text-[11px] rounded-lg" onClick={() => setSearchTerm('')}>Clear</Button>
        )}
      </div>

      {/* Table */}
      <Card className="shadow-md border-slate-200/60">
        <CardContent className="p-0">
          <div className="max-h-[560px] overflow-y-auto custom-scrollbar">
            <Table>
              <TableHeader>
                <TableRow className="bg-gradient-to-r from-slate-50 to-slate-100/80 border-b border-slate-200/60">
                  <TableHead className="text-[11px] font-bold text-slate-600 px-5 py-3">Title</TableHead>
                  <TableHead className="text-[11px] font-bold text-slate-600 py-3">Category</TableHead>
                  <TableHead className="text-right text-[11px] font-bold text-slate-600 py-3">Amount</TableHead>
                  <TableHead className="text-center text-[11px] font-bold text-slate-600 py-3">Frequency</TableHead>
                  <TableHead className="text-[11px] font-bold text-slate-600 py-3">Next Date</TableHead>
                  <TableHead className="text-[11px] font-bold text-slate-600 py-3">Project</TableHead>
                  <TableHead className="text-center text-[11px] font-bold text-slate-600 py-3">Active</TableHead>
                  <TableHead className="text-right text-[11px] font-bold text-slate-600 px-5 py-3 w-20">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recurring.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center text-xs text-slate-400 py-12 font-medium">No recurring expenses found</TableCell></TableRow>
                ) : recurring.map(r => {
                  const dueSoon = isDueSoon(r.nextDate);
                  const pastDue = isPastDue(r.nextDate);
                  return (
                    <TableRow key={r.id} className={`border-b border-slate-100/80 transition-colors duration-150 ${!r.active ? 'opacity-50' : pastDue && r.active ? 'bg-red-50/40' : 'hover:bg-slate-50/60'}`}>
                      <TableCell className="text-[11px] font-semibold text-slate-800 px-5">
                        <div className="flex items-center gap-2">
                          <div className={`p-1.5 rounded-lg ${!r.active ? 'bg-slate-50' : pastDue ? 'bg-red-50' : 'bg-orange-50'}`}>
                            <Repeat className={`w-3.5 h-3.5 ${!r.active ? 'text-slate-400' : pastDue ? 'text-red-500' : 'text-orange-500'}`} />
                          </div>
                          {r.title}
                        </div>
                      </TableCell>
                      <TableCell className="text-[11px] text-slate-700 max-w-[140px] truncate">{r.category || '—'}</TableCell>
                      <TableCell className="text-right text-[11px] font-bold font-mono tabular-nums text-orange-700">{formatPKR(r.amount)}</TableCell>
                      <TableCell className="text-center">
                        <Badge className={`text-[9px] shadow-sm font-semibold px-2.5 py-0.5 rounded-md ${frequencyColor(r.frequency)}`}>{r.frequency}</Badge>
                      </TableCell>
                      <TableCell className="text-[11px]">
                        {r.nextDate ? (
                          <span className={pastDue && r.active ? 'text-red-600 font-semibold' : dueSoon ? 'text-amber-600 font-semibold' : 'text-slate-600'}>
                            {new Date(r.nextDate).toLocaleDateString()}
                            {pastDue && r.active && ' ⚠'}
                          </span>
                        ) : '—'}
                      </TableCell>
                      <TableCell className="text-[11px] text-slate-400 max-w-[100px] truncate">{r.project || '—'}</TableCell>
                      <TableCell className="text-center">
                        <button onClick={() => handleToggleActive(r)} className="flex items-center justify-center mx-auto">
                          {r.active ? (
                            <ToggleRight className="w-6 h-6 text-emerald-500 hover:text-emerald-600 transition-colors" />
                          ) : (
                            <ToggleLeft className="w-6 h-6 text-slate-400 hover:text-slate-500 transition-colors" />
                          )}
                        </button>
                      </TableCell>
                      <TableCell className="text-right px-5">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(r)} className="h-7 w-7 p-0 rounded-lg hover:bg-indigo-50"><Pencil className="w-3 h-3 text-slate-500" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(r.id)} className="h-7 w-7 p-0 rounded-lg hover:bg-red-50 text-red-500 hover:text-red-700"><Trash2 className="w-3 h-3" /></Button>
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
          <DialogHeader><DialogTitle className="text-sm font-bold tracking-tight">{editing ? 'Edit Recurring Expense' : 'New Recurring Expense'}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-3">
            <div>
              <Label className="text-xs font-semibold text-slate-700">Title *</Label>
              <Input value={form.title} onChange={e => { setForm({ ...form, title: e.target.value }); if (errors.title) setErrors({ ...errors, title: '' }); }} className={`h-8 text-xs rounded-lg mt-1 ${errors.title ? 'ring-2 ring-red-400' : ''}`} placeholder="e.g. Office Rent" />
              {errors.title && <p className="text-[10px] text-red-600 mt-0.5">{errors.title}</p>}
            </div>
            <div>
              <Label className="text-xs font-semibold text-slate-700">Category</Label>
              <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
                <SelectTrigger className="h-8 text-xs rounded-lg mt-1"><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__custom__">— Type custom below —</SelectItem>
                  {categories.map(c => <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input className="mt-1 h-7 text-[11px] rounded-lg" placeholder="Or type custom category" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs font-semibold text-slate-700">Amount (Rs.) *</Label>
                <Input type="number" value={form.amount || ''} onChange={e => { setForm({ ...form, amount: parseFloat(e.target.value) || 0 }); if (errors.amount) setErrors({ ...errors, amount: '' }); }} className={`h-8 text-xs font-mono rounded-lg mt-1 ${errors.amount ? 'ring-2 ring-red-400' : ''}`} placeholder="0" />
                {errors.amount && <p className="text-[10px] text-red-600 mt-0.5">{errors.amount}</p>}
              </div>
              <div>
                <Label className="text-xs font-semibold text-slate-700">Frequency</Label>
                <Select value={form.frequency} onValueChange={v => setForm({ ...form, frequency: v })}>
                  <SelectTrigger className="h-8 text-xs rounded-lg mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Monthly">Monthly</SelectItem>
                    <SelectItem value="Quarterly">Quarterly</SelectItem>
                    <SelectItem value="Yearly">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs font-semibold text-slate-700">Next Date</Label>
              <Input type="date" value={form.nextDate} onChange={e => setForm({ ...form, nextDate: e.target.value })} className="h-8 text-xs rounded-lg mt-1" />
            </div>
            <div>
              <Label className="text-xs font-semibold text-slate-700">Project</Label>
              <Select value={form.project || '__none__'} onValueChange={v => setForm({ ...form, project: v === '__none__' ? '' : v })}>
                <SelectTrigger className="h-8 text-xs rounded-lg mt-1"><SelectValue placeholder="Select project" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {projects.map(p => <SelectItem key={p.name} value={p.name}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input className="mt-1 h-7 text-[11px] rounded-lg" placeholder="Or type custom project" value={form.project} onChange={e => setForm({ ...form, project: e.target.value })} />
            </div>
            <div className="flex items-center gap-2 pt-1">
              <Switch checked={form.active} onCheckedChange={v => setForm({ ...form, active: v })} />
              <Label className="text-xs font-medium text-slate-600">Active</Label>
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
