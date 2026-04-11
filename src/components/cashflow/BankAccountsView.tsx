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
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Consolidated Bank Balance</p>
              <p className={`text-3xl font-bold ${totalBalance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {formatPKRFull(totalBalance)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">{accounts.length} Account{accounts.length !== 1 ? 's' : ''}</Badge>
              <Button onClick={openCreate} size="sm">
                <Plus className="w-4 h-4 mr-1.5" /> Add Account
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Accounts Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Bank</TableHead>
                <TableHead>Account Name</TableHead>
                <TableHead>Account No.</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map(acc => (
                <TableRow key={acc.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-muted-foreground" />
                      {acc.bankName}
                    </div>
                  </TableCell>
                  <TableCell>{acc.accountName}</TableCell>
                  <TableCell className="text-muted-foreground">{acc.accountNumber || '—'}</TableCell>
                  <TableCell className={`text-right font-semibold ${acc.currentBalance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {formatPKRFull(acc.currentBalance)}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge className={acc.active ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'}>
                      {acc.active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(acc)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(acc.id)} className="text-red-600 hover:text-red-700">
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Bank Account' : 'Add Bank Account'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Bank Name *</Label>
              <Input value={form.bankName} onChange={e => setForm({ ...form, bankName: e.target.value })} placeholder="e.g. Bank Al Falah" />
            </div>
            <div>
              <Label>Account Name *</Label>
              <Input value={form.accountName} onChange={e => setForm({ ...form, accountName: e.target.value })} placeholder="e.g. G-11 Markaz" />
            </div>
            <div>
              <Label>Account Number</Label>
              <Input value={form.accountNumber} onChange={e => setForm({ ...form, accountNumber: e.target.value })} placeholder="Optional" />
            </div>
            <div>
              <Label>Current Balance</Label>
              <Input type="number" value={form.currentBalance} onChange={e => setForm({ ...form, currentBalance: parseFloat(e.target.value) || 0 })} />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.active} onCheckedChange={v => setForm({ ...form, active: v })} />
              <Label>Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>{editing ? 'Update' : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
