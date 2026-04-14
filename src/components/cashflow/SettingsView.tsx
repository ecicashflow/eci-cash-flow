'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Plus, Pencil, Trash2, Save, Tag, FolderOpen, Sliders, Palette, Upload, X, ImagePlus, FileSpreadsheet, AlertCircle, CheckCircle2, Download } from 'lucide-react';
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
import { MONTH_NAMES } from '@/lib/format';

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
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Excel import state
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<any[]>([]);
  const [importDragOver, setImportDragOver] = useState(false);
  const importFileRef = useRef<HTMLInputElement>(null);

  // Template date range state - default Apr 2026 to Mar 2027
  const [templateStartMonth, setTemplateStartMonth] = useState(4);
  const [templateStartYear, setTemplateStartYear] = useState(2026);
  const [templateEndMonth, setTemplateEndMonth] = useState(3);
  const [templateEndYear, setTemplateEndYear] = useState(2027);

  const reloadCategories = async () => {
    try {
      const res = await fetch('/api/categories');
      if (!res.ok) return;
      setCategories(await res.json());
    } catch { toast.error('Failed to load categories'); }
  };
  const reloadProjects = async () => {
    try {
      const res = await fetch('/api/projects');
      if (!res.ok) return;
      setProjects(await res.json());
    } catch { toast.error('Failed to load projects'); }
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        const [catRes, projRes, setRes] = await Promise.all([
          fetch('/api/categories'), fetch('/api/projects'), fetch('/api/settings'),
        ]);
        if (!catRes.ok || !projRes.ok || !setRes.ok) {
          toast.error('Failed to load settings');
          return;
        }
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

  const handleLogoUpload = async (file: File) => {
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Invalid file type. Allowed: PNG, JPG, SVG, WebP, GIF');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('File too large. Maximum size: 2MB');
      return;
    }

    setUploadingLogo(true);
    try {
      const formData = new FormData();
      formData.append('logo', file);
      const res = await fetch('/api/settings/upload-logo', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.success) {
        setSettingsForm(prev => ({ ...prev, app_logo_url: data.logoUrl }));
        toast.success('Logo uploaded! Click Save Branding to apply.');
      } else {
        toast.error(data.error || 'Upload failed');
      }
    } catch {
      toast.error('Failed to upload logo');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleLogoUpload(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleLogoUpload(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const removeLogo = () => {
    setSettingsForm(prev => ({ ...prev, app_logo_url: '' }));
  };

  const handleExcelImport = async (file: File) => {
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      toast.error('Invalid file type. Only .xlsx and .xls files are accepted.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File too large. Maximum size: 10MB');
      return;
    }

    setImporting(true);
    setImportResult(null);
    setImportError(null);
    setValidationErrors([]);

    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/import', { method: 'POST', body: formData });
      const data = await res.json();

      if (data.success) {
        setImportResult(data);
        if (data.warnings && data.warnings.length > 0) {
          toast.warning(`${data.warnings.length} warning(s)`, { description: data.warnings.join('. ') });
        }
        toast.success(`Excel imported successfully! ${data.receipts} receipts, ${data.expenses} expenses, ${data.bankAccounts} bank accounts`);
        reloadCategories();
        reloadProjects();
        onRefresh();
      } else if (data.validationErrors) {
        setImportError(`Found ${data.errorCount} error(s) in your Excel file`);
        setValidationErrors(data.validationErrors);
        toast.error(`Found ${data.errorCount} validation error(s)`);
      } else {
        setImportError(data.error || 'Import failed');
        toast.error(data.error || 'Import failed');
      }
    } catch (err: any) {
      const msg = err?.message || 'Failed to import Excel file';
      setImportError(msg);
      toast.error(msg);
    } finally {
      setImporting(false);
    }
  };

  const handleImportFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleExcelImport(file);
    // Reset input so same file can be re-uploaded
    e.target.value = '';
  };

  const handleImportDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setImportDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleExcelImport(file);
  };

  const handleImportDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setImportDragOver(true);
  };

  const handleImportDragLeave = () => {
    setImportDragOver(false);
  };

  const expenseCategories = categories.filter(c => c.type === 'expense');
  const receiptCategories = categories.filter(c => c.type === 'receipt');

  const appName = settingsForm.app_name || 'ECI Cash Flow';
  const companyName = settingsForm.company_name || 'ECI';
  const logoUrl = settingsForm.app_logo_url || '';

  return (
    <div className="space-y-5">
      <Tabs defaultValue="branding">
        <TabsList className="bg-slate-100/60 rounded-lg">
          <TabsTrigger value="branding" className="rounded-md text-xs font-medium data-[state=active]:shadow-sm"><Palette className="w-4 h-4 mr-1" />Branding</TabsTrigger>
          <TabsTrigger value="import" className="rounded-md text-xs font-medium data-[state=active]:shadow-sm"><FileSpreadsheet className="w-4 h-4 mr-1" />Import</TabsTrigger>
          <TabsTrigger value="categories" className="rounded-md text-xs font-medium data-[state=active]:shadow-sm"><Tag className="w-4 h-4 mr-1" />Categories</TabsTrigger>
          <TabsTrigger value="projects" className="rounded-md text-xs font-medium data-[state=active]:shadow-sm"><FolderOpen className="w-4 h-4 mr-1" />Projects</TabsTrigger>
          <TabsTrigger value="settings" className="rounded-md text-xs font-medium data-[state=active]:shadow-sm"><Sliders className="w-4 h-4 mr-1" />Config</TabsTrigger>
        </TabsList>

        <TabsContent value="branding" className="space-y-4">
          {/* App Name & Company */}
          <Card className="shadow-md border-slate-200/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-bold flex items-center gap-2 tracking-tight text-slate-800">
                <span className="w-5 h-5 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 shadow-sm">
                  <Palette className="w-3 h-3" />
                </span>
                Application Identity
              </CardTitle>
              <CardDescription className="text-[11px] text-slate-400 font-medium">Customize the application name and company identity displayed across the system</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs font-semibold text-slate-700">Application Name</Label>
                    <Input
                      value={settingsForm.app_name || ''}
                      onChange={e => setSettingsForm({ ...settingsForm, app_name: e.target.value })}
                      className="h-9 text-xs rounded-lg mt-1"
                      placeholder="ECI Cash Flow"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">Displayed in sidebar, header, footer, and browser tab title</p>
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-slate-700">Company Name</Label>
                    <Input
                      value={settingsForm.company_name || ''}
                      onChange={e => setSettingsForm({ ...settingsForm, company_name: e.target.value })}
                      className="h-9 text-xs rounded-lg mt-1"
                      placeholder="ECI"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">Used in reports and header subtitle</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <Label className="text-xs font-medium">Live Preview</Label>
                  <div className="border rounded-xl p-4 bg-gradient-to-r from-muted/40 to-muted/20 space-y-3">
                    {/* Sidebar preview */}
                    <div className="bg-[#1e1b4b] rounded-lg p-3 flex items-center gap-2.5 shadow-sm">
                      <div className="w-8 h-8 rounded-lg bg-[var(--sidebar-primary)] flex items-center justify-center overflow-hidden flex-shrink-0">
                        {logoUrl ? (
                          <img src={logoUrl} alt="Logo" className="w-full h-full object-cover rounded-lg" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        ) : (
                          <span className="text-[var(--sidebar-primary-foreground)] text-xs font-bold">{appName.charAt(0)}</span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-white text-[11px] font-bold truncate">{appName}</p>
                        <p className="text-white/40 text-[8px]">Office Cash Flow Management</p>
                      </div>
                    </div>
                    {/* Footer preview */}
                    <div className="border rounded-md px-3 py-1.5 bg-background">
                      <p className="text-[9px] text-muted-foreground truncate">
                        {appName} &middot; {companyName} Office Cash Flow Management
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Logo Upload */}
          <Card className="shadow-md border-slate-200/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-bold flex items-center gap-2 tracking-tight text-slate-800">
                <span className="w-5 h-5 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 shadow-sm">
                  <ImagePlus className="w-3 h-3" />
                </span>
                Application Logo
              </CardTitle>
              <CardDescription className="text-[11px] text-slate-400 font-medium">Upload or link a logo image. The logo appears in the sidebar and browser tab.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-3">
                  {/* Upload area */}
                  <div
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                      dragOver
                        ? 'border-primary bg-primary/5 scale-[1.01]'
                        : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30'
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/svg+xml,image/webp,image/gif"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    <div className="flex flex-col items-center gap-2">
                      {uploadingLogo ? (
                        <>
                          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                          <p className="text-xs text-muted-foreground">Uploading...</p>
                        </>
                      ) : (
                        <>
                          <Upload className="w-8 h-8 text-muted-foreground/50" />
                          <p className="text-xs font-medium">Click to upload or drag & drop</p>
                          <p className="text-[10px] text-muted-foreground">PNG, JPG, SVG, WebP, GIF (max 2MB)</p>
                        </>
                      )}
                    </div>
                  </div>

                  {/* OR manual URL input */}
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t" /></div>
                    <div className="relative flex justify-center text-[10px]"><span className="bg-card px-2 text-muted-foreground">or enter URL manually</span></div>
                  </div>
                  <div>
                    <div className="flex gap-2">
                      <Input
                        value={settingsForm.app_logo_url || ''}
                        onChange={e => setSettingsForm({ ...settingsForm, app_logo_url: e.target.value })}
                        className="h-9 text-xs flex-1"
                        placeholder="/eci-logo.png or https://..."
                      />
                      {logoUrl && (
                        <Button variant="ghost" size="sm" onClick={removeLogo} className="h-9 px-2 text-red-500 hover:text-red-600">
                          <X className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">Relative path from /public folder or full URL</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <Label className="text-xs font-medium">Logo Preview</Label>
                  <div className="border rounded-xl p-5 bg-muted/20 flex flex-col items-center gap-4">
                    {/* Large preview */}
                    <div className="w-20 h-20 rounded-2xl bg-[var(--sidebar-primary)] flex items-center justify-center overflow-hidden shadow-lg">
                      {logoUrl ? (
                        <img src={logoUrl} alt="Logo preview" className="w-full h-full object-cover rounded-2xl" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      ) : (
                        <span className="text-[var(--sidebar-primary-foreground)] text-2xl font-bold">{appName.charAt(0)}</span>
                      )}
                    </div>
                    {/* Small preview (sidebar size) */}
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-[var(--sidebar-primary)] flex items-center justify-center overflow-hidden">
                        {logoUrl ? (
                          <img src={logoUrl} alt="Logo small" className="w-full h-full object-cover rounded-lg" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        ) : (
                          <span className="text-[var(--sidebar-primary-foreground)] text-xs font-bold">{appName.charAt(0)}</span>
                        )}
                      </div>
                      <span className="text-xs font-semibold">{appName}</span>
                    </div>
                    {/* Favicon preview */}
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded bg-[var(--sidebar-primary)] flex items-center justify-center overflow-hidden">
                        {logoUrl ? (
                          <img src={logoUrl} alt="Logo favicon" className="w-full h-full object-cover rounded" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        ) : (
                          <span className="text-[var(--sidebar-primary-foreground)] text-[6px] font-bold">{appName.charAt(0)}</span>
                        )}
                      </div>
                      <span className="text-[10px] text-muted-foreground">Browser tab icon</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Save Branding Button */}
          <div className="flex items-center gap-3">
            <Button onClick={saveSettings} className="h-9 text-xs rounded-lg shadow-sm font-medium"><Save className="w-3.5 h-3.5 mr-1.5" /> Save Branding Changes</Button>
            <p className="text-[10px] text-slate-400 font-medium">Changes will apply immediately after saving</p>
          </div>
        </TabsContent>

        <TabsContent value="import" className="space-y-4">
          {/* Download Template */}
          <Card className="shadow-md ring-1 ring-emerald-200/70 bg-gradient-to-br from-emerald-50/90 via-white to-teal-50/40">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold flex items-center gap-2">
                <span className="w-5 h-5 rounded-md bg-emerald-100 flex items-center justify-center text-emerald-700">
                  <Download className="w-3 h-3" />
                </span>
                Download Excel Template
              </CardTitle>
              <CardDescription className="text-[11px]">
                Choose any custom date range for your template. The Excel columns will be generated for the exact months you select — e.g., June 2026 to May 2027, April 2026 to March 2027, or any range you need.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {/* Date range selector */}
                <div className="flex flex-wrap items-end gap-3">
                  <div>
                    <Label className="text-[11px] font-medium text-emerald-800">Start Month</Label>
                    <select
                      value={templateStartMonth}
                      onChange={e => setTemplateStartMonth(parseInt(e.target.value))}
                      className="h-8 text-xs border border-emerald-300 rounded-md px-2 bg-white"
                    >
                      {MONTH_NAMES.map((m, i) => (
                        <option key={i} value={i + 1}>{m}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label className="text-[11px] font-medium text-emerald-800">Start Year</Label>
                    <select
                      value={templateStartYear}
                      onChange={e => setTemplateStartYear(parseInt(e.target.value))}
                      className="h-8 text-xs border border-emerald-300 rounded-md px-2 bg-white"
                    >
                      {[2024, 2025, 2026, 2027, 2028, 2029, 2030].map(y => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                  <span className="text-muted-foreground text-sm pb-1">→</span>
                  <div>
                    <Label className="text-[11px] font-medium text-emerald-800">End Month</Label>
                    <select
                      value={templateEndMonth}
                      onChange={e => setTemplateEndMonth(parseInt(e.target.value))}
                      className="h-8 text-xs border border-emerald-300 rounded-md px-2 bg-white"
                    >
                      {MONTH_NAMES.map((m, i) => (
                        <option key={i} value={i + 1}>{m}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label className="text-[11px] font-medium text-emerald-800">End Year</Label>
                    <select
                      value={templateEndYear}
                      onChange={e => setTemplateEndYear(parseInt(e.target.value))}
                      className="h-8 text-xs border border-emerald-300 rounded-md px-2 bg-white"
                    >
                      {[2025, 2026, 2027, 2028, 2029, 2030, 2031].map(y => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs gap-1.5 border-emerald-400 text-emerald-700 hover:bg-emerald-100 bg-emerald-50"
                    onClick={() => {
                      const a = document.createElement('a');
                      a.href = `/api/settings/download-template?startMonth=${templateStartMonth}&startYear=${templateStartYear}&endMonth=${templateEndMonth}&endYear=${templateEndYear}`;
                      a.download = `ECI-CashFlow-Template-${MONTH_NAMES[templateStartMonth - 1]}${templateStartYear}-${MONTH_NAMES[templateEndMonth - 1]}${templateEndYear}.xlsx`;
                      a.click();
                      toast.success(`Template downloaded for ${MONTH_NAMES[templateStartMonth - 1]} ${templateStartYear} - ${MONTH_NAMES[templateEndMonth - 1]} ${templateEndYear}`);
                    }}
                  >
                    <Download className="w-3.5 h-3.5" /> Download Template
                  </Button>
                </div>

                {/* Quick presets */}
                <div className="flex flex-wrap gap-1.5">
                  <p className="text-[10px] text-emerald-600 font-medium self-center mr-1">Quick:</p>
                  {[
                    { label: 'FY 2026-27', sm: 4, sy: 2026, em: 3, ey: 2027 },
                    { label: 'FY 2025-26', sm: 4, sy: 2025, em: 3, ey: 2026 },
                    { label: 'Jun 26 - May 27', sm: 6, sy: 2026, em: 5, ey: 2027 },
                    { label: 'Calendar 2026', sm: 1, sy: 2026, em: 12, ey: 2026 },
                    { label: 'Calendar 2027', sm: 1, sy: 2027, em: 12, ey: 2027 },
                  ].map(p => (
                    <Button
                      key={p.label}
                      variant="ghost"
                      size="sm"
                      className="h-6 text-[10px] px-2 text-emerald-700 hover:bg-emerald-100"
                      onClick={() => {
                        setTemplateStartMonth(p.sm);
                        setTemplateStartYear(p.sy);
                        setTemplateEndMonth(p.em);
                        setTemplateEndYear(p.ey);
                      }}
                    >
                      {p.label}
                    </Button>
                  ))}
                </div>

                <p className="text-[10px] text-emerald-600">
                  Selected range: <span className="font-semibold">{MONTH_NAMES[templateStartMonth - 1]} {templateStartYear}</span> to <span className="font-semibold">{MONTH_NAMES[templateEndMonth - 1]} {templateEndYear}</span> ({(() => {
                    let count = 0;
                    let m = templateStartMonth; let y = templateStartYear;
                    while (count < 36) {
                      count++;
                      if (m === templateEndMonth && y === templateEndYear) break;
                      m++; if (m > 12) { m = 1; y++; }
                    }
                    return count;
                  })()} months)
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-md border-slate-200/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-bold flex items-center gap-2 tracking-tight text-slate-800">
                <span className="w-5 h-5 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 shadow-sm">
                  <FileSpreadsheet className="w-3 h-3" />
                </span>
                Import from Excel
              </CardTitle>
              <CardDescription className="text-[11px]">
                Upload your ECI Cash Flow Excel file (.xlsx). All receipts, expenses, bank balances, projects, and categories will be auto-created from the file.
                This will replace all existing data.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Upload area */}
                <div
                  onDrop={handleImportDrop}
                  onDragOver={handleImportDragOver}
                  onDragLeave={handleImportDragLeave}
                  onClick={() => importFileRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                    importDragOver
                      ? 'border-primary bg-primary/5 scale-[1.01]'
                      : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30'
                  } ${importing ? 'pointer-events-none opacity-60' : ''}`}
                >
                  <input
                    ref={importFileRef}
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleImportFileChange}
                    className="hidden"
                  />
                  <div className="flex flex-col items-center gap-3">
                    {importing ? (
                      <>
                        <div className="w-10 h-10 border-3 border-primary border-t-transparent rounded-full animate-spin" />
                        <p className="text-sm font-medium text-primary">Importing data...</p>
                        <p className="text-[11px] text-muted-foreground">Parsing Excel file and updating database</p>
                      </>
                    ) : (
                      <>
                        <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center">
                          <FileSpreadsheet className="w-6 h-6 text-emerald-600" />
                        </div>
                        <p className="text-sm font-medium">Click to upload or drag & drop your Excel file</p>
                        <p className="text-[11px] text-muted-foreground">Accepts .xlsx and .xls files (max 10MB)</p>
                      </>
                    )}
                  </div>
                </div>

                {/* Import result */}
                {importResult && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <p className="text-sm font-semibold text-emerald-800">Import Successful!</p>
                    </div>
                    <p className="text-[11px] text-emerald-700">Period: {importResult.financialYear} ({importResult.periodMonths || 12} months)</p>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-2">
                      {[
                        { label: 'Bank Accounts', value: importResult.bankAccounts },
                        { label: 'Receipts', value: importResult.receipts },
                        { label: 'Expenses', value: importResult.expenses },
                        { label: 'Categories', value: importResult.categories },
                        { label: 'Projects', value: importResult.projects },
                      ].map((item, i) => (
                        <div key={i} className="bg-white/60 rounded-lg p-2.5 ring-1 ring-emerald-100">
                          <p className="text-[9px] text-muted-foreground uppercase font-medium">{item.label}</p>
                          <p className="text-lg font-bold text-emerald-800">{item.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Import error */}
                {importError && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-red-600" />
                      <p className="text-sm font-semibold text-red-800">Import Failed</p>
                    </div>
                    <p className="text-[11px] text-red-700">{importError}</p>
                    {validationErrors.length > 0 && (
                      <div className="mt-3 p-4 rounded-xl bg-red-100/50 ring-1 ring-red-200/70 max-h-80 overflow-y-auto">
                        <p className="text-xs font-bold text-red-700 mb-2">Validation Errors ({validationErrors.length}):</p>
                        <div className="space-y-2">
                          {validationErrors.map((err: any, i: number) => (
                            <div key={i} className="rounded-lg bg-white/70 ring-1 ring-red-200/50 p-2.5">
                              <div className="flex items-center gap-2 flex-wrap">
                                {err.row > 0 && (
                                  <span className="font-mono bg-red-100 text-red-700 px-1.5 py-0.5 rounded text-[10px] font-bold">Row {err.row}</span>
                                )}
                                {err.column && (
                                  <span className="font-mono bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded text-[10px] font-bold">Col {err.column}</span>
                                )}
                                <span className="text-[11px] text-red-700 font-medium">{err.error}</span>
                              </div>
                              {err.value && (
                                <p className="text-[10px] text-red-500 mt-1 ml-1">Found: "{err.value}"</p>
                              )}
                              {err.suggestion && (
                                <p className="text-[10px] text-emerald-700 mt-1 ml-1 font-medium">Fix: {err.suggestion}</p>
                              )}
                            </div>
                          ))}
                        </div>
                        <p className="text-[10px] text-red-500 mt-3 font-medium">Fix these errors in your Excel file and re-import.</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Format info - comprehensive */}
                <Card className="bg-muted/30 border-dashed">
                  <CardContent className="p-4">
                    <p className="text-[11px] font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Expected Excel Format</p>
                    <div className="space-y-4">
                      {/* Structure overview */}
                      <div>
                        <p className="text-[11px] font-semibold mb-1.5">Sheet Structure (Flexible Range)</p>
                        <div className="overflow-x-auto custom-scrollbar rounded-md ring-1 ring-border">
                          <table className="w-full text-[10px] border-collapse">
                            <thead>
                              <tr className="bg-muted/60">
                                <th className="text-left p-1.5 font-semibold w-16">Row</th>
                                <th className="text-left p-1.5 font-semibold">Column A</th>
                                <th className="text-left p-1.5 font-semibold">Column C</th>
                                <th className="text-left p-1.5 font-semibold">Month Columns</th>
                                <th className="text-left p-1.5 font-semibold">Last Column</th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr className="border-b"><td className="p-1.5 font-mono">1</td><td className="p-1.5">Title</td><td className="p-1.5 font-medium">"ECI - Cash Flow Statement"</td><td className="p-1.5">—</td><td className="p-1.5">—</td></tr>
                              <tr className="border-b"><td className="p-1.5 font-mono">2</td><td className="p-1.5">Period</td><td className="p-1.5 font-medium">"June, 2026 - May, 2027" (any range)</td><td className="p-1.5">—</td><td className="p-1.5">—</td></tr>
                              <tr className="border-b bg-blue-50/40"><td className="p-1.5 font-mono">4-6</td><td className="p-1.5">Bank</td><td className="p-1.5 font-medium">"Bank Name # Account# (Branch)"</td><td className="p-1.5">—</td><td className="p-1.5">Current Balance</td></tr>
                              <tr className="border-b bg-emerald-50/40"><td className="p-1.5 font-mono">Varies</td><td className="p-1.5">Receipts</td><td className="p-1.5 font-medium">Client / Project name</td><td className="p-1.5">Monthly amounts (auto-detected from header)</td><td className="p-1.5">Remarks</td></tr>
                              <tr className="border-b bg-red-50/40"><td className="p-1.5 font-mono">Varies</td><td className="p-1.5">Expenses</td><td className="p-1.5 font-medium">Expense category name</td><td className="p-1.5">Monthly amounts (auto-detected from header)</td><td className="p-1.5">Remarks</td></tr>
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Auto-creation info */}
                      <div>
                        <p className="text-[11px] font-semibold mb-1.5">Auto-Created on Import</p>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <div className="bg-emerald-50/60 rounded-lg p-2 ring-1 ring-emerald-100">
                            <p className="text-[10px] font-semibold text-emerald-800">Projects</p>
                            <p className="text-[9px] text-emerald-700">Receipt client names become projects with auto-generated codes</p>
                          </div>
                          <div className="bg-amber-50/60 rounded-lg p-2 ring-1 ring-amber-100">
                            <p className="text-[10px] font-semibold text-amber-800">Categories</p>
                            <p className="text-[9px] text-amber-700">Expense heads + receipt clients become categories (auto-tagged operational)</p>
                          </div>
                          <div className="bg-sky-50/60 rounded-lg p-2 ring-1 ring-sky-100">
                            <p className="text-[10px] font-semibold text-sky-800">Links</p>
                            <p className="text-[9px] text-sky-700">Project expenses auto-linked to matching receipt clients</p>
                          </div>
                        </div>
                      </div>

                      {/* Tips */}
                      <div>
                        <p className="text-[11px] font-semibold mb-1.5">Tips</p>
                        <ul className="text-[10px] text-muted-foreground space-y-1 list-disc pl-4">
                          <li>The period in Row 2 can be ANY custom range — e.g., &quot;June, 2026 - May, 2027&quot; or &quot;April, 2026 - March, 2027&quot;</li>
                          <li>Month columns are auto-detected from the header row — they match the period you specify</li>
                          <li>Add a new row in the receipts section to auto-create a new project/client</li>
                          <li>Add a new row in the expenses section to auto-create a new expense category</li>
                          <li>Operational expenses are auto-detected (Electricity, Salaries, Rent, etc.)</li>
                          <li>Use &quot;-&quot; or leave blank for zero-amount months</li>
                          <li>Bank format: &quot;Bank Name # AccountNumber (Branch)&quot;</li>
                          <li>All amounts are rounded to whole numbers (no decimals)</li>
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="categories" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <Card className="shadow-md border-slate-200/60">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xs font-bold tracking-tight text-slate-800">Expense Categories ({expenseCategories.length})</CardTitle>
                  <Button size="sm" variant="outline" onClick={openCreateCat} className="h-7 text-[11px] rounded-lg font-medium shadow-sm"><Plus className="w-3 h-3 mr-1" />Add</Button>
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
            <Card className="shadow-md border-slate-200/60">
              <CardHeader className="pb-2"><CardTitle className="text-xs font-bold tracking-tight text-slate-800">Receipt Categories ({receiptCategories.length})</CardTitle></CardHeader>
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
          <Card className="shadow-md border-slate-200/60">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-bold tracking-tight text-slate-800">Projects & Clients ({projects.length})</CardTitle>
                <Button size="sm" variant="outline" onClick={openCreateProj} className="h-7 text-[11px] rounded-lg font-medium shadow-sm"><Plus className="w-3 h-3 mr-1" />Add</Button>
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
          <Card className="shadow-md border-slate-200/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-bold tracking-tight text-slate-800">System Configuration</CardTitle>
              <CardDescription className="text-[11px] text-slate-400 font-medium">Financial year, thresholds, and margin settings</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-3">
                  <div><Label className="text-xs">Financial Year Start</Label><Input type="date" value={settingsForm.financial_year_start || ''} onChange={e => setSettingsForm({ ...settingsForm, financial_year_start: e.target.value })} className="h-8 text-xs" /></div>
                  <div><Label className="text-xs">Financial Year End</Label><Input type="date" value={settingsForm.financial_year_end || ''} onChange={e => setSettingsForm({ ...settingsForm, financial_year_end: e.target.value })} className="h-8 text-xs" /></div>
                </div>
                <div className="space-y-3">
                  <div><Label className="text-xs">Warning Threshold Balance (Rs.)</Label><Input type="number" value={settingsForm.warning_threshold_balance || ''} onChange={e => setSettingsForm({ ...settingsForm, warning_threshold_balance: e.target.value })} className="h-8 text-xs" /><p className="text-[10px] text-muted-foreground mt-0.5">Months below this flagged &quot;Low Cash&quot;</p></div>
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
