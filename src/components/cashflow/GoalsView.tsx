'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Pencil, Trash2, Search, Target, CheckCircle2, Clock, Calendar, DollarSign } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { formatPKR, formatPKRFull, formatCompact } from '@/lib/format';

interface Goal {
  id: string;
  title: string;
  description: string;
  targetType: string;
  targetAmount: number;
  currentAmount: number;
  targetDate: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

const emptyForm = {
  title: '', description: '', targetType: 'Amount', targetAmount: 0,
  currentAmount: 0, targetDate: '', status: 'Active',
};

export default function GoalsView({ onRefresh }: { onRefresh: () => void }) {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Goal | null>(null);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const load = async () => {
    try {
      const params = new URLSearchParams();
      if (filterStatus !== 'all') params.set('status', filterStatus);
      if (searchTerm) params.set('search', searchTerm);
      const res = await fetch(`/api/goals?${params.toString()}`);
      if (!res.ok) throw new Error();
      setGoals(await res.json());
    } catch { toast.error('Failed to load goals'); }
  };

  useEffect(() => { load(); }, [filterStatus, searchTerm]);

  const summary = useMemo(() => {
    const totalGoals = goals.length;
    const achieved = goals.filter(g => g.status === 'Achieved').length;
    const active = goals.filter(g => g.status === 'Active').length;
    const totalTarget = goals.reduce((s, g) => s + g.targetAmount, 0);
    return { totalGoals, achieved, active, totalTarget };
  }, [goals]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm });
    setErrors({});
    setDialogOpen(true);
  };

  const openEdit = (g: Goal) => {
    setEditing(g);
    setForm({
      title: g.title, description: g.description, targetType: g.targetType,
      targetAmount: g.targetAmount, currentAmount: g.currentAmount,
      targetDate: g.targetDate ? new Date(g.targetDate).toISOString().split('T')[0] : '', status: g.status,
    });
    setErrors({});
    setDialogOpen(true);
  };

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!form.title.trim()) e.title = 'Title is required';
    if (!form.targetAmount || form.targetAmount <= 0) e.targetAmount = 'Target amount must be positive';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const url = editing ? `/api/goals/${editing.id}` : '/api/goals';
      const method = editing ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error(d.error || 'Failed to save'); return; }
      toast.success(editing ? 'Goal updated' : 'Goal created');
      setDialogOpen(false); load(); onRefresh();
    } catch { toast.error('Failed to save goal'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this goal? This cannot be undone.')) return;
    try {
      const res = await fetch(`/api/goals/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      toast.success('Goal deleted'); load(); onRefresh();
    } catch { toast.error('Failed to delete goal'); }
  };

  const statusColor = (s: string) => {
    switch (s) {
      case 'Achieved': return 'bg-emerald-50 text-emerald-800 border-emerald-200/80';
      case 'Active': return 'bg-sky-50 text-sky-800 border-sky-200/80';
      case 'Abandoned': return 'bg-slate-50 text-slate-600 border-slate-200/80';
      default: return 'bg-amber-50 text-amber-800 border-amber-200/80';
    }
  };

  const getDaysRemaining = (targetDate: string): number | null => {
    if (!targetDate) return null;
    const now = new Date();
    const target = new Date(targetDate);
    const diff = target.getTime() - now.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  const hasFilters = filterStatus !== 'all' || searchTerm;

  return (
    <div className="space-y-5">
      {/* Summary Card */}
      <Card className="shadow-md border-slate-200/60 bg-gradient-to-br from-teal-50/90 via-white to-cyan-50/40 ring-1 ring-teal-200/70">
        <CardContent className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex gap-6">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Total Goals</p>
                <p className="text-2xl font-extrabold tracking-tight text-teal-700 mt-0.5">{summary.totalGoals}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 font-medium">Achieved</p>
                <p className="text-base font-bold text-emerald-600 tabular-nums">{summary.achieved}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 font-medium">Active</p>
                <p className="text-base font-bold text-sky-600 tabular-nums">{summary.active}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 font-medium">Total Target</p>
                <p className="text-base font-bold text-teal-700 tabular-nums">{formatPKRFull(summary.totalTarget)}</p>
              </div>
            </div>
            <Button onClick={openCreate} size="sm" className="gap-1.5 rounded-lg shadow-sm font-medium"><Plus className="w-4 h-4" /> Add Goal</Button>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex flex-wrap gap-2.5 items-center">
        <div className="flex items-center gap-2 flex-1 min-w-[200px] max-w-xs">
          <Search className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
          <Input placeholder="Search goals..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="h-8 text-xs rounded-lg border-border/70" />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-32 h-8 text-xs rounded-lg border-border/70"><SelectValue placeholder="All Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="Active">Active</SelectItem>
            <SelectItem value="Achieved">Achieved</SelectItem>
            <SelectItem value="Abandoned">Abandoned</SelectItem>
          </SelectContent>
        </Select>
        {hasFilters && (
          <Button variant="ghost" size="sm" className="h-7 text-[11px] rounded-lg" onClick={() => { setFilterStatus('all'); setSearchTerm(''); }}>Clear</Button>
        )}
      </div>

      {/* Goal Cards Grid */}
      {goals.length === 0 ? (
        <Card className="shadow-md border-slate-200/60">
          <CardContent className="py-16 text-center">
            <Target className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-400">No goals found</p>
            <p className="text-xs text-slate-300 mt-1">Create your first financial goal to get started</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {goals.map(goal => {
            const progress = goal.targetAmount > 0 ? Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100)) : 0;
            const days = getDaysRemaining(goal.targetDate);
            const isOverdue = days !== null && days < 0 && goal.status !== 'Achieved';
            const isCompleted = goal.status === 'Achieved';

            return (
              <Card key={goal.id} className={`shadow-md border-slate-200/60 transition-all duration-200 hover:shadow-lg ${isOverdue ? 'ring-1 ring-red-200/70' : 'hover:ring-1 hover:ring-slate-200'}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`p-2 rounded-lg flex-shrink-0 ${isCompleted ? 'bg-emerald-50' : isOverdue ? 'bg-red-50' : 'bg-teal-50'}`}>
                        <Target className={`w-4 h-4 ${isCompleted ? 'text-emerald-500' : isOverdue ? 'text-red-500' : 'text-teal-500'}`} />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-[12px] font-bold text-slate-800 truncate">{goal.title}</h3>
                        {goal.description && <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-2">{goal.description}</p>}
                      </div>
                    </div>
                    <Badge className={`text-[9px] shadow-sm font-semibold px-2 py-0.5 rounded-md flex-shrink-0 ${statusColor(goal.status)}`}>{goal.status}</Badge>
                  </div>

                  {/* Progress */}
                  <div className="mb-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px] font-semibold text-slate-600">{formatPKR(goal.currentAmount)} <span className="text-slate-300">/</span> {formatPKR(goal.targetAmount)}</span>
                      <span className={`text-[11px] font-bold tabular-nums ${progress >= 100 ? 'text-emerald-600' : progress >= 50 ? 'text-teal-600' : 'text-amber-600'}`}>{progress}%</span>
                    </div>
                    <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${progress >= 100 ? 'bg-gradient-to-r from-emerald-400 to-emerald-500' : progress >= 50 ? 'bg-gradient-to-r from-teal-400 to-teal-500' : 'bg-gradient-to-r from-amber-400 to-amber-500'}`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  {/* Footer info */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {goal.targetDate && (
                        <div className="flex items-center gap-1 text-[10px] text-slate-400">
                          <Calendar className="w-3 h-3" />
                          {new Date(goal.targetDate).toLocaleDateString()}
                        </div>
                      )}
                      {days !== null && !isCompleted && (
                        <span className={`text-[10px] font-semibold ${isOverdue ? 'text-red-500' : days <= 30 ? 'text-amber-500' : 'text-slate-400'}`}>
                          {isOverdue ? `${Math.abs(days)}d overdue` : `${days}d left`}
                        </span>
                      )}
                      {isCompleted && (
                        <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-500">
                          <CheckCircle2 className="w-3 h-3" /> Done
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-0.5">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(goal)} className="h-6 w-6 p-0 rounded-md hover:bg-indigo-50"><Pencil className="w-3 h-3 text-slate-400" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(goal.id)} className="h-6 w-6 p-0 rounded-md hover:bg-red-50 text-red-400 hover:text-red-600"><Trash2 className="w-3 h-3" /></Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md rounded-xl">
          <DialogHeader><DialogTitle className="text-sm font-bold tracking-tight">{editing ? 'Edit Goal' : 'New Goal'}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-3">
            <div>
              <Label className="text-xs font-semibold text-slate-700">Title *</Label>
              <Input value={form.title} onChange={e => { setForm({ ...form, title: e.target.value }); if (errors.title) setErrors({ ...errors, title: '' }); }} className={`h-8 text-xs rounded-lg mt-1 ${errors.title ? 'ring-2 ring-red-400' : ''}`} placeholder="e.g. Emergency Fund" />
              {errors.title && <p className="text-[10px] text-red-600 mt-0.5">{errors.title}</p>}
            </div>
            <div>
              <Label className="text-xs font-semibold text-slate-700">Description</Label>
              <Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="h-8 text-xs rounded-lg mt-1" placeholder="Optional details" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs font-semibold text-slate-700">Target Type</Label>
                <Select value={form.targetType} onValueChange={v => setForm({ ...form, targetType: v })}>
                  <SelectTrigger className="h-8 text-xs rounded-lg mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Amount">Amount</SelectItem>
                    <SelectItem value="Savings">Savings</SelectItem>
                    <SelectItem value="Milestone">Milestone</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-semibold text-slate-700">Status</Label>
                <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                  <SelectTrigger className="h-8 text-xs rounded-lg mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Achieved">Achieved</SelectItem>
                    <SelectItem value="Abandoned">Abandoned</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs font-semibold text-slate-700">Target Amount (Rs.) *</Label>
              <Input type="number" value={form.targetAmount || ''} onChange={e => { setForm({ ...form, targetAmount: parseFloat(e.target.value) || 0 }); if (errors.targetAmount) setErrors({ ...errors, targetAmount: '' }); }} className={`h-8 text-xs font-mono rounded-lg mt-1 ${errors.targetAmount ? 'ring-2 ring-red-400' : ''}`} placeholder="0" />
              {errors.targetAmount && <p className="text-[10px] text-red-600 mt-0.5">{errors.targetAmount}</p>}
            </div>
            <div>
              <Label className="text-xs font-semibold text-slate-700">Current Amount (Rs.)</Label>
              <Input type="number" value={form.currentAmount || ''} onChange={e => setForm({ ...form, currentAmount: parseFloat(e.target.value) || 0 })} className="h-8 text-xs font-mono rounded-lg mt-1" placeholder="0" />
            </div>
            <div>
              <Label className="text-xs font-semibold text-slate-700">Target Date</Label>
              <Input type="date" value={form.targetDate} onChange={e => setForm({ ...form, targetDate: e.target.value })} className="h-8 text-xs rounded-lg mt-1" />
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
