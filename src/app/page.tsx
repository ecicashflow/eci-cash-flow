'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import {
  LayoutDashboard, Building2, ArrowDownCircle, ArrowUpCircle,
  FileText, Settings, AlertTriangle,
  ChevronRight, RefreshCw, Menu, CalendarRange
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import DashboardView from '@/components/cashflow/DashboardView';
import BankAccountsView from '@/components/cashflow/BankAccountsView';
import ReceiptsView from '@/components/cashflow/ReceiptsView';
import ExpensesView from '@/components/cashflow/ExpensesView';
import ReportsView from '@/components/cashflow/ReportsView';
import SettingsView from '@/components/cashflow/SettingsView';

type TabId = 'dashboard' | 'bank-accounts' | 'receipts' | 'expenses' | 'reports' | 'settings';

const NAV_ITEMS: { id: TabId; label: string; icon: React.ElementType; section?: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, section: 'overview' },
  { id: 'bank-accounts', label: 'Bank Accounts', icon: Building2, section: 'data' },
  { id: 'receipts', label: 'Receipts', icon: ArrowDownCircle, section: 'data' },
  { id: 'expenses', label: 'Expenses', icon: ArrowUpCircle, section: 'data' },
  { id: 'reports', label: 'Reports', icon: FileText, section: 'output' },
  { id: 'settings', label: 'Settings', icon: Settings, section: 'config' },
];

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [fyYear, setFyYear] = useState('2026');
  const [appName, setAppName] = useState('ECI Cash Flow');
  const [appLogoUrl, setAppLogoUrl] = useState('/eci-logo.png');

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/dashboard?year=${fyYear}`);
      if (!res.ok) throw new Error('Failed');
      setDashboardData(await res.json());
    } catch (err) {
      console.error('Dashboard fetch failed:', err);
    } finally {
      setLoading(false);
    }
  }, [fyYear]);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  const deficitCount = dashboardData?.warnings?.negativeMonths?.length || 0;
  const companyName = dashboardData?.settings?.company_name || 'ECI';
  const fyEnd = String(parseInt(fyYear) + 1);

  useEffect(() => {
    if (dashboardData?.settings) {
      const newAppName = dashboardData.settings.app_name || 'ECI Cash Flow';
      const newLogoUrl = dashboardData.settings.app_logo_url || '/eci-logo.png';
      setAppName(newAppName);
      setAppLogoUrl(newLogoUrl);
      // Update browser tab title dynamically
      const tabLabel = NAV_ITEMS.find(n => n.id === activeTab)?.label;
      document.title = `${tabLabel ? tabLabel + ' · ' : ''}${newAppName} - ${dashboardData.settings.company_name || 'ECI'} Office Cash Flow Management`;
    }
  }, [dashboardData?.settings, activeTab]);

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-60' : 'w-14'} transition-all duration-300 bg-[var(--sidebar)] text-[var(--sidebar-foreground)] flex flex-col fixed h-full z-30`}>
        <div className="flex items-center gap-2.5 px-3 py-4 border-b border-[var(--sidebar-border)]">
          <div className="w-8 h-8 rounded-xl bg-[var(--sidebar-primary)] flex items-center justify-center flex-shrink-0 overflow-hidden">
            <Image src={appLogoUrl} alt={`${appName} Logo`} width={32} height={32} className="w-full h-full object-cover rounded-xl" unoptimized />
          </div>
          {sidebarOpen && (
            <div className="animate-fade-in min-w-0">
              <h1 className="text-sm font-bold tracking-tight truncate">{appName}</h1>
              <p className="text-[10px] opacity-50">FY {fyYear}-{fyEnd}</p>
            </div>
          )}
        </div>

        <nav className="flex-1 py-2 px-1.5 space-y-0.5">
          {NAV_ITEMS.map((item, idx) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            const showDivider = idx === 1 || idx === 4;
            return (
              <React.Fragment key={item.id}>
                {showDivider && <div className="my-2 border-t border-[var(--sidebar-border)]/40" />}
                <button
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-all text-[13px] font-medium ${
                    isActive
                      ? 'bg-[var(--sidebar-accent)] text-[var(--sidebar-accent-foreground)]'
                      : 'text-[var(--sidebar-foreground)] opacity-60 hover:opacity-100 hover:bg-[var(--sidebar-accent)]/50'
                  }`}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  {sidebarOpen && <span className="animate-fade-in truncate">{item.label}</span>}
                  {item.id === 'dashboard' && deficitCount > 0 && sidebarOpen && (
                    <Badge variant="destructive" className="ml-auto text-[9px] px-1.5 py-0 h-4 min-w-[18px] text-center">
                      {deficitCount}
                    </Badge>
                  )}
                </button>
              </React.Fragment>
            );
          })}
        </nav>

        <div className="px-1.5 py-2 border-t border-[var(--sidebar-border)]">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="w-full flex items-center justify-center px-2 py-1.5 rounded-lg text-[var(--sidebar-foreground)] opacity-50 hover:opacity-100 hover:bg-[var(--sidebar-accent)]/50 transition-all"
          >
            {sidebarOpen ? <ChevronRight className="w-3.5 h-3.5 rotate-180" /> : <Menu className="w-3.5 h-3.5" />}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className={`flex-1 ${sidebarOpen ? 'ml-60' : 'ml-14'} transition-all duration-300 flex flex-col min-h-screen`}>
        <header className="sticky top-0 z-20 bg-background/90 backdrop-blur-md border-b">
          <div className="flex items-center justify-between px-5 py-2.5">
            <div className="flex items-center gap-4">
              <div>
                <h2 className="text-base font-semibold">{NAV_ITEMS.find(n => n.id === activeTab)?.label}</h2>
                {dashboardData && (
                  <p className="text-[11px] text-muted-foreground">
                    {companyName} Cash Flow &middot; {fyYear}-{fyEnd}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <CalendarRange className="w-3.5 h-3.5 text-muted-foreground" />
                <Select value={fyYear} onValueChange={setFyYear}>
                  <SelectTrigger className="w-[110px] h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2024">FY 2024-25</SelectItem>
                    <SelectItem value="2025">FY 2025-26</SelectItem>
                    <SelectItem value="2026">FY 2026-27</SelectItem>
                    <SelectItem value="2027">FY 2027-28</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {deficitCount > 0 && activeTab !== 'dashboard' && (
                <Badge variant="destructive" className="text-[10px] gap-1 px-2">
                  <AlertTriangle className="w-3 h-3" />
                  {deficitCount} deficit
                </Badge>
              )}
              <Button variant="outline" size="sm" onClick={fetchDashboard} className="h-7 text-xs">
                <RefreshCw className={`w-3 h-3 mr-1 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>
        </header>

        <div className="flex-1 p-5">
          {loading && !dashboardData ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <RefreshCw className="w-7 h-7 animate-spin mx-auto text-primary mb-2" />
                <p className="text-muted-foreground text-sm">Loading {appName.toLowerCase()} data...</p>
              </div>
            </div>
          ) : (
            <>
              {activeTab === 'dashboard' && dashboardData && (
                <DashboardView data={dashboardData} onRefresh={fetchDashboard} />
              )}
              {activeTab === 'bank-accounts' && (
                <BankAccountsView onRefresh={fetchDashboard} />
              )}
              {activeTab === 'receipts' && (
                <ReceiptsView onRefresh={fetchDashboard} />
              )}
              {activeTab === 'expenses' && (
                <ExpensesView onRefresh={fetchDashboard} />
              )}
              {activeTab === 'reports' && dashboardData && (
                <ReportsView data={dashboardData} />
              )}
              {activeTab === 'settings' && (
                <SettingsView onRefresh={fetchDashboard} />
              )}
            </>
          )}
        </div>

        <footer className="border-t px-5 py-2.5 text-center text-[10px] text-muted-foreground">
          {appName} &middot; {companyName} Office Cash Flow Management &middot; FY {fyYear}-{fyEnd}
        </footer>
      </main>
    </div>
  );
}
