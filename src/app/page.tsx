'use client';

import React, { useState, useEffect, useCallback, Component } from 'react';
import Image from 'next/image';
import {
  LayoutDashboard, Building2, ArrowDownCircle, ArrowUpCircle,
  FileText, Settings, AlertTriangle,
  ChevronRight, RefreshCw, Menu, CalendarRange
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import DashboardView from '@/components/cashflow/DashboardView';
import BankAccountsView from '@/components/cashflow/BankAccountsView';
import ReceiptsView from '@/components/cashflow/ReceiptsView';
import ExpensesView from '@/components/cashflow/ExpensesView';
import ReportsView from '@/components/cashflow/ReportsView';
import SettingsView from '@/components/cashflow/SettingsView';

// Error boundary to catch runtime errors in view components
class ViewErrorBoundary extends Component<{ children: React.ReactNode; onRetry: () => void }, { hasError: boolean; error: any }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }
  componentDidCatch(error: any, info: any) {
    console.error('View render error:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="text-center max-w-md">
            <AlertTriangle className="w-10 h-10 mx-auto text-destructive mb-3" />
            <h3 className="text-lg font-semibold mb-1">Something went wrong</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {this.state.error?.message || 'An unexpected error occurred while rendering this view.'}
            </p>
            <Button onClick={() => { this.setState({ hasError: false, error: null }); this.props.onRetry(); }} variant="outline" size="sm">
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              Retry
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

type TabId = 'dashboard' | 'bank-accounts' | 'receipts' | 'expenses' | 'reports' | 'settings';

const NAV_ITEMS: { id: TabId; label: string; icon: React.ElementType; section?: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, section: 'overview' },
  { id: 'bank-accounts', label: 'Bank Accounts', icon: Building2, section: 'data' },
  { id: 'receipts', label: 'Receipts', icon: ArrowDownCircle, section: 'data' },
  { id: 'expenses', label: 'Expenses', icon: ArrowUpCircle, section: 'data' },
  { id: 'reports', label: 'Reports', icon: FileText, section: 'output' },
  { id: 'settings', label: 'Settings', icon: Settings, section: 'config' },
];

function formatDateStr(d: Date): string {
  return d.toISOString().split('T')[0];
}

function formatDisplayDate(d: Date): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[d.getMonth()]} ${d.getFullYear()}`;
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [appName, setAppName] = useState('ECI Cash Flow');
  const [appLogoUrl, setAppLogoUrl] = useState('/eci-logo.png');

  // Date range state - default to FY 2026-27 (Apr 2026 to Mar 2027)
  const [startDate, setStartDate] = useState<Date>(new Date(2026, 3, 1)); // Apr 1, 2026
  const [endDate, setEndDate] = useState<Date>(new Date(2027, 2, 31)); // Mar 31, 2027
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [selectingStart, setSelectingStart] = useState(true);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const params = new URLSearchParams({
        startDate: formatDateStr(startDate),
        endDate: formatDateStr(endDate),
      });
      const res = await fetch(`/api/dashboard?${params.toString()}`, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const data = await res.json();
      setDashboardData(data);
    } catch (err: any) {
      console.error('Dashboard fetch failed:', err);
      if (err.name === 'AbortError') {
        setFetchError('Request timed out. The server may be waking up — please try again.');
      } else {
        setFetchError(err?.message || 'Failed to load dashboard data');
      }
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  const deficitCount = dashboardData?.warnings?.negativeMonths?.length || 0;
  const companyName = dashboardData?.settings?.company_name || 'ECI';
  const rangeLabel = dashboardData?.rangeLabel || `${formatDisplayDate(startDate)} - ${formatDisplayDate(endDate)}`;

  useEffect(() => {
    if (dashboardData?.settings) {
      const newAppName = dashboardData.settings.app_name || 'ECI Cash Flow';
      const newLogoUrl = dashboardData.settings.app_logo_url || '/eci-logo.png';
      setAppName(newAppName);
      setAppLogoUrl(newLogoUrl);
      const tabLabel = NAV_ITEMS.find(n => n.id === activeTab)?.label;
      document.title = `${tabLabel ? tabLabel + ' · ' : ''}${newAppName} - ${dashboardData.settings.company_name || 'ECI'} Office Cash Flow Management`;
    }
  }, [dashboardData?.settings, activeTab]);

  // Quick date range presets
  const applyPreset = (preset: string) => {
    const now = new Date();
    const currentFYStart = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    switch (preset) {
      case 'current-fy':
        setStartDate(new Date(currentFYStart, 3, 1));
        setEndDate(new Date(currentFYStart + 1, 2, 31));
        break;
      case 'fy-2026':
        setStartDate(new Date(2026, 3, 1));
        setEndDate(new Date(2027, 2, 31));
        break;
      case 'fy-2025':
        setStartDate(new Date(2025, 3, 1));
        setEndDate(new Date(2026, 2, 31));
        break;
      case 'this-month':
        setStartDate(new Date(now.getFullYear(), now.getMonth(), 1));
        setEndDate(new Date(now.getFullYear(), now.getMonth() + 1, 0));
        break;
      case 'last-3-months':
        setStartDate(new Date(now.getFullYear(), now.getMonth() - 2, 1));
        setEndDate(new Date(now.getFullYear(), now.getMonth() + 1, 0));
        break;
      case 'last-6-months':
        setStartDate(new Date(now.getFullYear(), now.getMonth() - 5, 1));
        setEndDate(new Date(now.getFullYear(), now.getMonth() + 1, 0));
        break;
      case 'ytd':
        setStartDate(new Date(now.getFullYear(), 0, 1));
        setEndDate(now);
        break;
    }
  };

  // Render main content - NEVER leave blank
  const renderContent = () => {
    // State 1: Initial loading (no previous data)
    if (loading && !dashboardData && !fetchError) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <RefreshCw className="w-7 h-7 animate-spin mx-auto text-primary mb-2" />
            <p className="text-muted-foreground text-sm">Loading {appName.toLowerCase()} data...</p>
            <p className="text-[10px] text-muted-foreground mt-1">Connecting to database...</p>
          </div>
        </div>
      );
    }

    // State 2: Fetch error with no data
    if (fetchError && !dashboardData) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="text-center max-w-md">
            <AlertTriangle className="w-10 h-10 mx-auto text-destructive mb-3" />
            <h3 className="text-lg font-semibold mb-1">Failed to Load Data</h3>
            <p className="text-sm text-muted-foreground mb-4">{fetchError}</p>
            <Button onClick={fetchDashboard} variant="outline" size="sm">
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              Retry
            </Button>
          </div>
        </div>
      );
    }

    // State 3: No data and no error and not loading
    if (!dashboardData) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="text-center max-w-md">
            <AlertTriangle className="w-10 h-10 mx-auto text-amber-500 mb-3" />
            <h3 className="text-lg font-semibold mb-1">No Data Available</h3>
            <p className="text-sm text-muted-foreground mb-4">Dashboard data could not be loaded. Click retry to try again.</p>
            <Button onClick={fetchDashboard} variant="outline" size="sm">
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              Retry
            </Button>
          </div>
        </div>
      );
    }

    // State 4: Data available - render views
    return (
      <ViewErrorBoundary onRetry={fetchDashboard}>
        {activeTab === 'dashboard' && (
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
        {activeTab === 'reports' && (
          <ReportsView data={dashboardData} />
        )}
        {activeTab === 'settings' && (
          <SettingsView onRefresh={fetchDashboard} />
        )}
      </ViewErrorBoundary>
    );
  };

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
              <p className="text-[10px] opacity-50">{rangeLabel}</p>
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
                    {companyName} Cash Flow &middot; {rangeLabel}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Date Range Picker */}
              <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5">
                    <CalendarRange className="w-3.5 h-3.5" />
                    <span className="max-w-[200px] truncate">{formatDisplayDate(startDate)} — {formatDisplayDate(endDate)}</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <div className="p-3 space-y-3">
                    {/* Quick presets */}
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Quick Select</p>
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          { key: 'fy-2026', label: 'FY 2026-27' },
                          { key: 'fy-2025', label: 'FY 2025-26' },
                          { key: 'current-fy', label: 'Current FY' },
                          { key: 'this-month', label: 'This Month' },
                          { key: 'last-3-months', label: '3 Months' },
                          { key: 'last-6-months', label: '6 Months' },
                          { key: 'ytd', label: 'Year to Date' },
                        ].map(p => (
                          <Button
                            key={p.key}
                            variant="outline"
                            size="sm"
                            className="h-6 text-[10px] px-2"
                            onClick={() => { applyPreset(p.key); setCalendarOpen(false); }}
                          >
                            {p.label}
                          </Button>
                        ))}
                      </div>
                    </div>
                    {/* Custom date range */}
                    <div className="border-t pt-3 space-y-2">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Custom Range</p>
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <label className="text-[9px] text-muted-foreground">From</label>
                          <input
                            type="date"
                            value={formatDateStr(startDate)}
                            onChange={e => {
                              const d = new Date(e.target.value);
                              if (!isNaN(d.getTime())) setStartDate(d);
                            }}
                            className="w-full border rounded px-2 py-1 text-xs"
                          />
                        </div>
                        <span className="text-muted-foreground text-xs mt-3">→</span>
                        <div className="flex-1">
                          <label className="text-[9px] text-muted-foreground">To</label>
                          <input
                            type="date"
                            value={formatDateStr(endDate)}
                            onChange={e => {
                              const d = new Date(e.target.value);
                              if (!isNaN(d.getTime())) setEndDate(d);
                            }}
                            className="w-full border rounded px-2 py-1 text-xs"
                          />
                        </div>
                      </div>
                      <Button
                        size="sm"
                        className="w-full h-7 text-xs"
                        onClick={() => { setCalendarOpen(false); }}
                      >
                        Apply Range
                      </Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>

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
          {renderContent()}
        </div>

        <footer className="border-t px-5 py-2.5 text-center text-[10px] text-muted-foreground mt-auto">
          {appName} &middot; {companyName} Office Cash Flow Management &middot; {rangeLabel}
        </footer>
      </main>
    </div>
  );
}
