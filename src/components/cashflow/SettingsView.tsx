'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Save, Tag, FolderOpen, Sliders } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';

interface Category { id: string; name: string; type: string; active: boolean; isOperational: boolean }
interface ProjectClient { id: string; name: string; code: string; active: boolean }

export default function SettingsView({ onRefresh }: { onRefresh: () => void }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [catDialog, setCatDialog] = useState(false);
  const [catEditing, setCatEditing] = useState<Category | null>(null);
  const [catForm, setCatForm] = useState({ name: '', type: 'expense', isOperational: false, active: true });

  const [projects, setProjects] = useState<ProjectClient[]>([]);
  const [projDialog, setProjDialog] = useState(false);
  const [projEditing, setProjEditing] = useState<ProjectClient | null>(null);
  const [projForm, setProjForm] = useState({ name: '', code: '', active: true });

  const [settingsForm, setSettingsForm] = useState<Record<string, string>>({});

  const reloadCategories = async () => {
    try { setCategories(await (await fetch('/api/categories')).json()); } catch { toast.error('Failed to load categories'); }
  };
  const reloadProjects = async () => {
    try { setProjects(await (await fetch('/api/projects')).json()); } catch { toast.error('Failed to load projects'); }
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        const [catRes, projRes, setRes] = await Promise.all([
          fetch('/api/categories'), fetch('/api/projects'), fetch('/api/settings'),
        ]);
        setCategories(await catRes.json());
        setProjects(await projRes.json());
        const setData = await setRes.json();
        setSettingsForm(setData);
      } catch { toast.error('Failed to load settings'); }
    };
    loadData();
  }, []);

  const openCreateCat = () => { setCatEditing(null); setCatForm({ name: '', type: 'expense', isOperational: false, active: true }); setCatDialog(true); };
  const openEditCat = (c: Category) => { setCatEditing(c); setCatForm({ name: c.name, type: c.type, isOperational: c.isOperational, active: c.active }); setCatDialog(true); };

  const saveCat = async () => {
    if (!catForm.name.trim()) { toast.error('Name is required'); return; }
    try {
      if (catEditing) {
        await fetch(`/api/categories/${catEditing.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(catForm) });
        toast.success('Category updated');
      } else {
        await fetch('/api/categories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(catForm) });
        toast.success('Category created');
      }
      setCatDialog(false); reloadCategories();
    } catch { toast.error('Failed to save category'); }
  };

  const deleteCat = async (id: string) => {
    if (!confirm('Delete this category?')) return;
    try { await fetch(`/api/categories/${id}`, { method: 'DELETE' }); toast.success('Deleted'); reloadCategories(); } catch { toast.error('Failed to delete'); }
  };

  const openCreateProj = () => { setProjEditing(null); setProjForm({ name: '', code: '', active: true }); setProjDialog(true); };
  const openEditProj = (p: ProjectClient) => { setProjEditing(p); setProjForm({ name: p.name, code: p.code, active: p.active }); setProjDialog(true); };

  const saveProj = async () => {
    if (!projForm.name.trim()) { toast.error('Name is required'); return; }
    try {
      if (projEditing) {
        await fetch(`/api/projects/${projEditing.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(projForm) });
        toast.success('Project updated');
      } else {
        await fetch('/api/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(projForm) });
        toast.success('Project created');
      }
      setProjDialog(false); reloadProjects(); onRefresh();
    } catch { toast.error('Failed to save project'); }
  };

  const deleteProj = async (id: string) => {
    if (!confirm('Delete this project?')) return;
    try { await fetch(`/api/projects/${id}`, { method: 'DELETE' }); toast.success('Deleted'); reloadProjects(); } catch { toast.error('Failed to delete'); }
  };

  const saveSettings = async () => {
    try {
      const updates = Object.entries(settingsForm).map(([key, value]) => ({ key, value }));
      await fetch('/api/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updates) });
      toast.success('Settings saved'); onRefresh();
    } catch { toast.error('Failed to save settings'); }
  };

  const expenseCategories = categories.filter(c => c.type === 'expense');
  const receiptCategories = categories.filter(c => c.type === 'receipt');

  return (
    <div className="space-y-5">
      <Tabs defaultValue="categories">
        <TabsList>
          <TabsTrigger value="categories"><Tag className="w-4 h-4 mr-1" />Categories</TabsTrigger>
          <TabsTrigger value="projects"><FolderOpen className="w-4 h-4 mr-1" />Projects</TabsTrigger>
          <TabsTrigger value="settings"><Sliders className="w-4 h-4 mr-1" />Config</TabsTrigger>
        </TabsList>

        <TabsContent value="categories" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xs font-semibold">Expense Categories ({expenseCategories.length})</CardTitle>
                  <Button size="sm" variant="outline" onClick={openCreateCat} className="h-7 text-[11px]"><Plus className="w-3 h-3 mr-1" />Add</Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="max-h-80 overflow-y-auto custom-scrollbar">
                  <Table>
                    <TableHeader><TableRow><TableHead className="text-[11px]">Name</TableHead><TableHead className="text-center text-[11px]">Type</TableHead><TableHead className="text-right text-[11px]">Actions</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {expenseCategories.map(c => (
                        <TableRow key={c.id}>
                          <TableCell className="text-[11px] font-medium">{c.name}</TableCell>
                          <TableCell className="text-center"><Badge className={`text-[9px] ${c.isOperational ? 'bg-orange-100 text-orange-800' : 'bg-slate-100 text-slate-700'}`}>{c.isOperational ? 'Ops' : 'Project'}</Badge></TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm" onClick={() => openEditCat(c)} className="h-6 w-6 p-0"><Pencil className="w-3 h-3" /></Button>
                            <Button variant="ghost" size="sm" onClick={() => deleteCat(c.id)} className="h-6 w-6 p-0 text-red-500"><Trash2 className="w-3 h-3" /></Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
            <Card className="shadow-sm">
              <CardHeader className="pb-2"><CardTitle className="text-xs font-semibold">Receipt Categories ({receiptCategories.length})</CardTitle></CardHeader>
              <CardContent className="p-0">
                <div className="max-h-80 overflow-y-auto custom-scrollbar">
                  <Table>
                    <TableHeader><TableRow><TableHead className="text-[11px]">Name</TableHead><TableHead className="text-right text-[11px]">Actions</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {receiptCategories.map(c => (
                        <TableRow key={c.id}>
                          <TableCell className="text-[11px] font-medium">{c.name}</TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm" onClick={() => openEditCat(c)} className="h-6 w-6 p-0"><Pencil className="w-3 h-3" /></Button>
                            <Button variant="ghost" size="sm" onClick={() => deleteCat(c.id)} className="h-6 w-6 p-0 text-red-500"><Trash2 className="w-3 h-3" /></Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="projects" className="space-y-4">
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-semibold">Projects & Clients ({projects.length})</CardTitle>
                <Button size="sm" variant="outline" onClick={openCreateProj} className="h-7 text-[11px]"><Plus className="w-3 h-3 mr-1" />Add</Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-80 overflow-y-auto custom-scrollbar">
                <Table>
                  <TableHeader><TableRow><TableHead className="text-[11px]">Code</TableHead><TableHead className="text-[11px]">Name</TableHead><TableHead className="text-center text-[11px]">Status</TableHead><TableHead className="text-right text-[11px]">Actions</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {projects.map(p => (
                      <TableRow key={p.id}>
                        <TableCell className="text-[11px] font-mono">{p.code || '—'}</TableCell>
                        <TableCell className="text-[11px] font-medium">{p.name}</TableCell>
                        <TableCell className="text-center"><Badge className={`text-[9px] ${p.active ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'}`}>{p.active ? 'Active' : 'Inactive'}</Badge></TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" onClick={() => openEditProj(p)} className="h-6 w-6 p-0"><Pencil className="w-3 h-3" /></Button>
                          <Button variant="ghost" size="sm" onClick={() => deleteProj(p.id)} className="h-6 w-6 p-0 text-red-500"><Trash2 className="w-3 h-3" /></Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold">System Configuration</CardTitle>
              <CardDescription className="text-[11px]">Financial year, thresholds, and margin settings</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-3">
                  <div><Label className="text-xs">Company Name</Label><Input value={settingsForm.company_name || ''} onChange={e => setSettingsForm({ ...settingsForm, company_name: e.target.value })} className="h-8 text-xs" /></div>
                  <div><Label className="text-xs">Financial Year Start</Label><Input type="date" value={settingsForm.financial_year_start || ''} onChange={e => setSettingsForm({ ...settingsForm, financial_year_start: e.target.value })} className="h-8 text-xs" /></div>
                  <div><Label className="text-xs">Financial Year End</Label><Input type="date" value={settingsForm.financial_year_end || ''} onChange={e => setSettingsForm({ ...settingsForm, financial_year_end: e.target.value })} className="h-8 text-xs" /></div>
                </div>
                <div className="space-y-3">
                  <div><Label className="text-xs">Warning Threshold Balance (Rs.)</Label><Input type="number" value={settingsForm.warning_threshold_balance || ''} onChange={e => setSettingsForm({ ...settingsForm, warning_threshold_balance: e.target.value })} className="h-8 text-xs" /><p className="text-[10px] text-muted-foreground mt-0.5">Months below this flagged "Low Cash"</p></div>
                  <div><Label className="text-xs">Profit Margin %</Label><Input type="number" value={settingsForm.profit_margin_pct || ''} onChange={e => setSettingsForm({ ...settingsForm, profit_margin_pct: e.target.value })} className="h-8 text-xs" /><p className="text-[10px] text-muted-foreground mt-0.5">Q86: Additional Business = Deficit / Margin%</p></div>
                  <div><Label className="text-xs">Operational Margin %</Label><Input type="number" value={settingsForm.operational_margin_pct || ''} onChange={e => setSettingsForm({ ...settingsForm, operational_margin_pct: e.target.value })} className="h-8 text-xs" /><p className="text-[10px] text-muted-foreground mt-0.5">Q87: Profit = Business × Margin%</p></div>
                </div>
              </div>
              <div className="mt-5"><Button onClick={saveSettings} className="h-8 text-xs"><Save className="w-3.5 h-3.5 mr-1" /> Save Settings</Button></div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={catDialog} onOpenChange={setCatDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="text-sm">{catEditing ? 'Edit Category' : 'Add Category'}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-3">
            <div><Label className="text-xs">Name *</Label><Input value={catForm.name} onChange={e => setCatForm({ ...catForm, name: e.target.value })} className="h-8 text-xs" /></div>
            <div><Label className="text-xs">Type</Label><select className="w-full border rounded-md px-3 py-1.5 text-xs h-8" value={catForm.type} onChange={e => setCatForm({ ...catForm, type: e.target.value })}><option value="expense">Expense</option><option value="receipt">Receipt</option></select></div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2"><Checkbox checked={catForm.isOperational} onCheckedChange={v => setCatForm({ ...catForm, isOperational: !!v })} /><Label className="text-xs">Operational</Label></div>
              <div className="flex items-center gap-2"><Switch checked={catForm.active} onCheckedChange={v => setCatForm({ ...catForm, active: v })} /><Label className="text-xs">Active</Label></div>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setCatDialog(false)} className="h-8 text-xs">Cancel</Button><Button onClick={saveCat} className="h-8 text-xs">{catEditing ? 'Update' : 'Create'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={projDialog} onOpenChange={setProjDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="text-sm">{projEditing ? 'Edit Project' : 'Add Project'}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-3">
            <div><Label className="text-xs">Name *</Label><Input value={projForm.name} onChange={e => setProjForm({ ...projForm, name: e.target.value })} className="h-8 text-xs" /></div>
            <div><Label className="text-xs">Code</Label><Input value={projForm.code} onChange={e => setProjForm({ ...projForm, code: e.target.value })} className="h-8 text-xs" placeholder="e.g. PSDF-MS" /></div>
            <div className="flex items-center gap-2"><Switch checked={projForm.active} onCheckedChange={v => setProjForm({ ...projForm, active: v })} /><Label className="text-xs">Active</Label></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setProjDialog(false)} className="h-8 text-xs">Cancel</Button><Button onClick={saveProj} className="h-8 text-xs">{projEditing ? 'Update' : 'Create'}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
