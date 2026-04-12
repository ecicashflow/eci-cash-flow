'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Building2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { formatPKRFull } from '@/lib/format';

interface BankAccount {
  id: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
  currentBalance: number;
  active: boolean;
}

export default function BankAccountsView({ onRefresh }: { onRefresh: () => void }) {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<BankAccount | null>(null);
  const [form, setForm] = useState({ bankName: '', accountName: '', accountNumber: '', currentBalance: 0, active: true });

  const fetchAccounts = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/bank-accounts');
      const data = await res.json();
      setAccounts(data);
    } catch (err) {
      toast.error('Failed to load bank accounts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAccounts(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ bankName: '', accountName: '', accountNumber: '', currentBalance: 0, active: true });
    setDialogOpen(true);
  };

  const openEdit = (acc: BankAccount) => {
    setEditing(acc);
    setForm({ bankName: acc.bankName, accountName: acc.accountName, accountNumber: acc.accountNumber, currentBalance: acc.currentBalance, active: acc.active });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.bankName || !form.accountName) {
      toast.error('Bank name and account name are required');
      return;
    }
    try {
      if (editing) {
        const res = await fetch(`/api/bank-accounts/${editing.id}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
        });
        if (!res.ok) throw new Error();
        toast.success('Bank account updated');
      } else {
        const res = await fetch('/api/bank-accounts', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
        });
        if (!res.ok) throw new Error();
        toast.success('Bank account created');
      }
      setDialogOpen(false);
      fetchAccounts();
      onRefresh();
    } catch {
      toast.error('Failed to save bank account');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this bank account?')) return;
    try {
      await fetch(`/api/bank-accounts/${id}`, { method: 'DELETE' });
      toast.success('Bank account deleted');
      fetchAccounts();
      onRefresh();
    } catch {
      toast.error('Failed to delete bank account');
    }
  };

  const totalBalance = accounts.reduce((sum, a) => sum + a.currentBalance, 0);

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <Card className="shadow-md border-slate-200/60 bg-gradient-to-br from-indigo-50/90 via-white to-indigo-50/40 ring-1 ring-indigo-200/70">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Consolidated Bank Balance</p>
              <p className={`text-3xl font-extrabold tracking-tight mt-1 ${totalBalance >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                {formatPKRFull(totalBalance)}
              </p>
              <p className="text-[11px] text-slate-400 font-medium mt-0.5">{accounts.length} account{accounts.length !== 1 ? 's' : ''}</p>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="rounded-lg shadow-sm font-semibold border-slate-200/80">{accounts.length} Account{accounts.length !== 1 ? 's' : ''}</Badge>
              <Button onClick={openCreate} size="sm" className="gap-1.5 rounded-lg shadow-sm font-medium">
                <Plus className="w-4 h-4" /> Add Account
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Accounts Table */}
      <Card className="shadow-md border-slate-200/60">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-gradient-to-r from-slate-50 to-slate-100/80 border-b border-slate-200/60">
                <TableHead className="text-[11px] font-bold text-slate-600 px-5 py-3">Bank</TableHead>
                <TableHead className="text-[11px] font-bold text-slate-600 py-3">Account Name</TableHead>
                <TableHead className="text-[11px] font-bold text-slate-600 py-3">Account No.</TableHead>
                <TableHead className="text-right text-[11px] font-bold text-slate-600 py-3">Balance</TableHead>
                <TableHead className="text-center text-[11px] font-bold text-slate-600 py-3">Status</TableHead>
                <TableHead className="text-right text-[11px] font-bold text-slate-600 px-5 py-3">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map(acc => (
                <TableRow key={acc.id} className="border-b border-slate-100/80 hover:bg-slate-50/60 transition-colors duration-150">
                  <TableCell className="font-semibold text-slate-800 px-5">
                    <div className="flex items-center gap-2.5">
                      <div className={`p-1.5 rounded-lg ${acc.currentBalance >= 0 ? 'bg-emerald-50' : 'bg-red-50'}`}>
                        <Building2 className={`w-3.5 h-3.5 ${acc.currentBalance >= 0 ? 'text-emerald-600' : 'text-red-600'}`} />
                      </div>
                      {acc.bankName}
                    </div>
                  </TableCell>
                  <TableCell className="text-slate-600">{acc.accountName}</TableCell>
                  <TableCell className="text-slate-400 font-mono text-[11px]">{acc.accountNumber || '—'}</TableCell>
                  <TableCell className={`text-right font-bold font-mono tabular-nums ${acc.currentBalance >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                    {formatPKRFull(acc.currentBalance)}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge className={`shadow-sm font-semibold px-2.5 py-0.5 rounded-md ${acc.active ? 'bg-emerald-50 text-emerald-800 border-emerald-200/80' : 'bg-slate-50 text-slate-600 border-slate-200/80'}`}>
                      {acc.active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right px-5">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(acc)} className="h-7 w-7 p-0 rounded-lg hover:bg-indigo-50">
                      <Pencil className="w-3.5 h-3.5 text-slate-500" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(acc.id)} className="h-7 w-7 p-0 rounded-lg hover:bg-red-50 text-red-500 hover:text-red-700">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold tracking-tight">{editing ? 'Edit Bank Account' : 'Add Bank Account'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label className="text-xs font-semibold text-slate-700">Bank Name *</Label>
              <Input value={form.bankName} onChange={e => setForm({ ...form, bankName: e.target.value })} placeholder="e.g. Bank Al Falah" className="h-9 text-xs rounded-lg mt-1" />
            </div>
            <div>
              <Label className="text-xs font-semibold text-slate-700">Account Name *</Label>
              <Input value={form.accountName} onChange={e => setForm({ ...form, accountName: e.target.value })} placeholder="e.g. G-11 Markaz" className="h-9 text-xs rounded-lg mt-1" />
            </div>
            <div>
              <Label className="text-xs font-semibold text-slate-700">Account Number</Label>
              <Input value={form.accountNumber} onChange={e => setForm({ ...form, accountNumber: e.target.value })} placeholder="Optional" className="h-9 text-xs rounded-lg mt-1" />
            </div>
            <div>
              <Label className="text-xs font-semibold text-slate-700">Current Balance</Label>
              <Input type="number" value={form.currentBalance} onChange={e => setForm({ ...form, currentBalance: parseFloat(e.target.value) || 0 })} className="h-9 text-xs rounded-lg font-mono mt-1" />
            </div>
            <div className="flex items-center gap-2 pt-1">
              <Switch checked={form.active} onCheckedChange={v => setForm({ ...form, active: v })} />
              <Label className="text-xs font-medium text-slate-600">Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="h-9 text-xs rounded-lg">Cancel</Button>
            <Button onClick={handleSave} className="h-9 text-xs rounded-lg font-medium shadow-sm">{editing ? 'Update' : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
