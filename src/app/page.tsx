'use client';

import React, { useState, useEffect, useCallback, Component } from 'react';
import Image from 'next/image';
import {
  LayoutDashboard, Building2, ArrowDownCircle, ArrowUpCircle,
  FileText, Settings, AlertTriangle,
  ChevronRight, RefreshCw, Menu, CalendarRange, ChevronLeft, Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
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
          <div className="text-center max-w-md bg-card/80 backdrop-blur-sm border border-border/60 rounded-2xl p-8 shadow-lg shadow-destructive/5">
            <div className="w-14 h-14 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-7 h-7 text-destructive" />
            </div>
            <h3 className="text-lg font-semibold mb-1.5 tracking-tight">Something went wrong</h3>
            <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
              {this.state.error?.message || 'An unexpected error occurred while rendering this view.'}
            </p>
            <Button onClick={() => { this.setState({ hasError: false, error: null }); this.props.onRetry(); }} variant="outline" size="sm" className="gap-1.5 rounded-lg">
              <RefreshCw className="w-3.5 h-3.5" />
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

const NAV_ITEMS: { id: TabId; label: string; icon: React.ElementType; section: string; sectionLabel: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, section: 'overview', sectionLabel: 'Overview' },
  { id: 'bank-accounts', label: 'Bank Accounts', icon: Building2, section: 'data', sectionLabel: 'Data Management' },
  { id: 'receipts', label: 'Receipts', icon: ArrowDownCircle, section: 'data', sectionLabel: '' },
  { id: 'expenses', label: 'Expenses', icon: ArrowUpCircle, section: 'data', sectionLabel: '' },
  { id: 'reports', label: 'Reports', icon: FileText, section: 'output', sectionLabel: 'Output' },
  { id: 'settings', label: 'Settings', icon: Settings, section: 'config', sectionLabel: 'Configuration' },
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
        <div className="flex items-center justify-center h-72">
          <div className="text-center">
            <div className="w-14 h-14 rounded-2xl bg-primary/8 flex items-center justify-center mx-auto mb-4">
              <RefreshCw className="w-7 h-7 animate-spin text-primary" />
            </div>
            <p className="text-sm font-medium text-foreground/80">Loading {appName.toLowerCase()} data...</p>
            <p className="text-xs text-muted-foreground mt-1.5">Connecting to database...</p>
          </div>
        </div>
      );
    }

    // State 2: Fetch error with no data
    if (fetchError && !dashboardData) {
      return (
        <div className="flex items-center justify-center h-72">
          <div className="text-center max-w-md bg-card/80 backdrop-blur-sm border border-border/60 rounded-2xl p-8 shadow-lg shadow-destructive/5">
            <div className="w-14 h-14 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-7 h-7 text-destructive" />
            </div>
            <h3 className="text-lg font-semibold mb-1.5 tracking-tight">Failed to Load Data</h3>
            <p className="text-sm text-muted-foreground mb-5 leading-relaxed">{fetchError}</p>
            <Button onClick={fetchDashboard} variant="outline" size="sm" className="gap-1.5 rounded-lg">
              <RefreshCw className="w-3.5 h-3.5" />
              Retry
            </Button>
          </div>
        </div>
      );
    }

    // State 3: No data and no error and not loading
    if (!dashboardData) {
      return (
        <div className="flex items-center justify-center h-72">
          <div className="text-center max-w-md bg-card/80 backdrop-blur-sm border border-border/60 rounded-2xl p-8 shadow-lg shadow-amber-500/5">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-7 h-7 text-amber-500" />
            </div>
            <h3 className="text-lg font-semibold mb-1.5 tracking-tight">No Data Available</h3>
            <p className="text-sm text-muted-foreground mb-5 leading-relaxed">Dashboard data could not be loaded. Click retry to try again.</p>
            <Button onClick={fetchDashboard} variant="outline" size="sm" className="gap-1.5 rounded-lg">
              <RefreshCw className="w-3.5 h-3.5" />
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
      {/* ───── Premium Sidebar ───── */}
      <TooltipProvider delayDuration={0}>
        <aside
          className={`${sidebarOpen ? 'w-[260px]' : 'w-[72px]'} transition-all duration-300 cubic-bezier(0.4, 0, 0.2, 1) flex flex-col fixed h-full z-30`}
          style={{
            background: 'linear-gradient(180deg, oklch(0.19 0.058 265) 0%, oklch(0.12 0.055 265) 60%, oklch(0.10 0.05 265) 100%)',
            boxShadow: '3px 0 24px -4px oklch(0.10 0.05 265 / 0.6), 1px 0 8px -2px oklch(0 0 0 / 0.15)',
          }}
        >
          {/* Logo / Brand Area */}
          <div className="relative px-4 pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden relative" style={{ background: 'linear-gradient(135deg, oklch(0.50 0.18 265), oklch(0.35 0.14 250))', boxShadow: '0 4px 12px -2px oklch(0.35 0.14 265 / 0.5)' }}>
                <Image src={appLogoUrl} alt={`${appName} Logo`} width={32} height={32} className="w-8 h-8 object-cover rounded-lg" unoptimized />
              </div>
              {sidebarOpen && (
                <div className="animate-fade-in min-w-0">
                  <h1 className="text-[13px] font-bold tracking-tight text-white/95 truncate leading-tight">{appName}</h1>
                  <div className="flex items-center gap-1.5 mt-1">
                    <Sparkles className="w-2.5 h-2.5 text-oklch(0.65 0.16 160)" style={{ color: 'oklch(0.65 0.16 160)' }} />
                    <p className="text-[9.5px] text-white/30 font-medium truncate">{companyName} Office</p>
                  </div>
                </div>
              )}
            </div>
            {/* Subtle bottom glow separator */}
            <div className="absolute bottom-0 left-4 right-4 h-px" style={{ background: 'linear-gradient(90deg, transparent, oklch(0.40 0.12 265 / 0.3), transparent)' }} />
          </div>

          {/* Navigation */}
          <nav className="flex-1 py-2 px-2.5 overflow-y-auto custom-scrollbar-sidebar">
            {NAV_ITEMS.map((item, idx) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              const showSectionLabel = sidebarOpen && item.sectionLabel;

              return (
                <React.Fragment key={item.id}>
                  {/* Section Label */}
                  {showSectionLabel && (
                    <div className="flex items-center gap-2 px-3 pt-5 pb-1.5 first:pt-2">
                      <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-white/20">{item.sectionLabel}</span>
                      <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, oklch(0.30 0.04 265 / 0.4), transparent)' }} />
                    </div>
                  )}
                  {/* Collapsed section dot indicator */}
                  {!sidebarOpen && item.sectionLabel && idx > 0 && (
                    <div className="flex justify-center py-2">
                      <div className="w-1 h-1 rounded-full bg-white/10" />
                    </div>
                  )}
                  {/* Nav Item with Tooltip when collapsed */}
                  {sidebarOpen ? (
                    <button
                      onClick={() => setActiveTab(item.id)}
                      className={`group w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl transition-all duration-200 text-[12.5px] font-medium relative mb-0.5 ${
                        isActive
                          ? 'text-white'
                          : 'text-white/40 hover:text-white/80'
                      }`}
                      style={isActive ? {
                        background: 'linear-gradient(135deg, oklch(0.28 0.06 265 / 0.8), oklch(0.22 0.05 265 / 0.6))',
                        boxShadow: '0 2px 8px -2px oklch(0.30 0.06 265 / 0.4), inset 0 1px 0 oklch(1 0 0 / 0.06)',
                      } : {}}
                    >
                      {/* Left accent bar for active state */}
                      {isActive && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full" style={{ background: 'linear-gradient(180deg, oklch(0.70 0.18 265), oklch(0.55 0.16 160))', boxShadow: '0 0 8px oklch(0.65 0.18 265 / 0.5)' }} />
                      )}
                      {/* Icon container */}
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-all duration-200 ${
                        isActive
                          ? 'bg-white/[0.12]'
                          : 'bg-transparent group-hover:bg-white/[0.06]'
                      }`}>
                        <Icon className={`w-[15px] h-[15px] flex-shrink-0 transition-colors duration-200 ${isActive ? 'text-white' : 'text-white/35 group-hover:text-white/65'}`} />
                      </div>
                      <span className="truncate">{item.label}</span>
                      {item.id === 'dashboard' && deficitCount > 0 && (
                        <Badge className="ml-auto text-[9px] px-1.5 py-0 h-[17px] min-w-[17px] text-center rounded-md font-semibold border-0" style={{ background: 'oklch(0.55 0.20 20)', color: 'oklch(0.97 0.01 50)' }}>
                          {deficitCount}
                        </Badge>
                      )}
                    </button>
                  ) : (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => setActiveTab(item.id)}
                          className={`group w-full flex items-center justify-center py-2.5 rounded-xl transition-all duration-200 relative mb-0.5 ${
                            isActive
                              ? 'text-white'
                              : 'text-white/40 hover:text-white/80'
                          }`}
                          style={isActive ? {
                            background: 'linear-gradient(135deg, oklch(0.28 0.06 265 / 0.8), oklch(0.22 0.05 265 / 0.6))',
                            boxShadow: '0 2px 8px -2px oklch(0.30 0.06 265 / 0.4), inset 0 1px 0 oklch(1 0 0 / 0.06)',
                          } : {}}
                        >
                          {isActive && (
                            <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full" style={{ background: 'linear-gradient(180deg, oklch(0.70 0.18 265), oklch(0.55 0.16 160))', boxShadow: '0 0 8px oklch(0.65 0.18 265 / 0.5)' }} />
                          )}
                          <div className={`w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200 ${
                            isActive
                              ? 'bg-white/[0.12]'
                              : 'bg-transparent group-hover:bg-white/[0.06]'
                          }`}>
                            <Icon className={`w-[17px] h-[17px] transition-colors duration-200 ${isActive ? 'text-white' : 'text-white/35 group-hover:text-white/65'}`} />
                          </div>
                          {item.id === 'dashboard' && deficitCount > 0 && (
                            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full" style={{ background: 'oklch(0.55 0.20 20)', boxShadow: '0 0 6px oklch(0.55 0.20 20 / 0.6)' }} />
                          )}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="right" sideOffset={8} className="bg-oklch(0.22 0.06 265) text-white border-0 text-[11px] font-medium px-3 py-1.5 rounded-lg shadow-xl" style={{ background: 'oklch(0.22 0.06 265)' }}>
                        {item.label}
                        {item.id === 'dashboard' && deficitCount > 0 && ` (${deficitCount} deficit)`}
                      </TooltipContent>
                    </Tooltip>
                  )}
                </React.Fragment>
              );
            })}
          </nav>

          {/* Bottom Section: Company info + Collapse Toggle */}
          <div className="relative">
            {/* Top glow separator */}
            <div className="absolute top-0 left-4 right-4 h-px" style={{ background: 'linear-gradient(90deg, transparent, oklch(0.40 0.12 265 / 0.3), transparent)' }} />
            
            {/* Company Info (visible when expanded) */}
            {sidebarOpen && (
              <div className="px-4 pt-3 pb-2 animate-fade-in">
                <div className="flex items-center gap-2.5 px-2 py-2 rounded-xl" style={{ background: 'oklch(0.16 0.04 265 / 0.5)' }}>
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg, oklch(0.40 0.12 160), oklch(0.30 0.10 250))' }}>
                    <Building2 className="w-3.5 h-3.5 text-white/90" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10.5px] font-semibold text-white/70 truncate leading-tight">{companyName}</p>
                    <p className="text-[8.5px] text-white/25 font-medium mt-0.5 truncate">{rangeLabel}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Collapse Toggle */}
            <div className="px-2.5 py-2.5">
              {sidebarOpen ? (
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-white/25 hover:text-white/60 hover:bg-white/[0.04] transition-all duration-200 group"
                >
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center group-hover:bg-white/[0.06] transition-all duration-200">
                    <ChevronLeft className="w-4 h-4" />
                  </div>
                  <span className="text-[11px] font-medium">Collapse</span>
                </button>
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setSidebarOpen(true)}
                      className="w-full flex items-center justify-center p-2.5 rounded-xl text-white/25 hover:text-white/60 hover:bg-white/[0.04] transition-all duration-200"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" sideOffset={8} className="bg-oklch(0.22 0.06 265) text-white border-0 text-[11px] font-medium px-3 py-1.5 rounded-lg shadow-xl" style={{ background: 'oklch(0.22 0.06 265)' }}>
                    Expand sidebar
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>
        </aside>
      </TooltipProvider>

      {/* ───── Main Content ───── */}
      <main className={`flex-1 ${sidebarOpen ? 'ml-[260px]' : 'ml-[72px]'} transition-all duration-300 cubic-bezier(0.4, 0, 0.2, 1) flex flex-col min-h-screen`}>
        {/* Header */}
        <header className="sticky top-0 z-20 bg-background/80 backdrop-blur-xl border-b border-border/60" style={{ boxShadow: '0 1px 8px -2px oklch(0.14 0.06 265 / 0.06)' }}>
          <div className="flex items-center justify-between px-6 py-3">
            <div className="flex items-center gap-4">
              <div>
                <h2 className="text-[15px] font-semibold tracking-tight">{NAV_ITEMS.find(n => n.id === activeTab)?.label}</h2>
                {dashboardData && (
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {companyName} Cash Flow &middot; {rangeLabel}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              {/* Date Range Picker */}
              <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 text-xs gap-2 rounded-lg border-border/80 hover:border-primary/30 hover:bg-primary/[0.04] transition-all duration-200 shadow-sm">
                    <CalendarRange className="w-3.5 h-3.5 text-primary/70" />
                    <span className="max-w-[200px] truncate font-medium">{formatDisplayDate(startDate)} — {formatDisplayDate(endDate)}</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 rounded-xl border-border/60 shadow-xl" align="end">
                  <div className="p-4 space-y-4">
                    {/* Quick presets */}
                    <div className="space-y-2.5">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Quick Select</p>
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
                            className="h-7 text-[10px] px-2.5 rounded-lg font-medium border-border/70 hover:border-primary/30 hover:bg-primary/[0.04] hover:text-primary transition-all duration-200"
                            onClick={() => { applyPreset(p.key); setCalendarOpen(false); }}
                          >
                            {p.label}
                          </Button>
                        ))}
                      </div>
                    </div>
                    {/* Custom date range */}
                    <div className="border-t border-border/50 pt-4 space-y-3">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Custom Range</p>
                      <div className="flex items-center gap-3">
                        <div className="flex-1">
                          <label className="text-[10px] text-muted-foreground font-medium mb-1 block">From</label>
                          <input
                            type="date"
                            value={formatDateStr(startDate)}
                            onChange={e => {
                              const d = new Date(e.target.value);
                              if (!isNaN(d.getTime())) setStartDate(d);
                            }}
                            className="w-full border border-border/70 rounded-lg px-2.5 py-1.5 text-xs focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all duration-200"
                          />
                        </div>
                        <span className="text-muted-foreground/50 text-xs mt-5">→</span>
                        <div className="flex-1">
                          <label className="text-[10px] text-muted-foreground font-medium mb-1 block">To</label>
                          <input
                            type="date"
                            value={formatDateStr(endDate)}
                            onChange={e => {
                              const d = new Date(e.target.value);
                              if (!isNaN(d.getTime())) setEndDate(d);
                            }}
                            className="w-full border border-border/70 rounded-lg px-2.5 py-1.5 text-xs focus:border-primary/40 focus:ring-2 focus:ring-primary/10 transition-all duration-200"
                          />
                        </div>
                      </div>
                      <Button
                        size="sm"
                        className="w-full h-8 text-xs rounded-lg font-medium shadow-sm"
                        onClick={() => { setCalendarOpen(false); }}
                      >
                        Apply Range
                      </Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>

              {deficitCount > 0 && activeTab !== 'dashboard' && (
                <Badge variant="destructive" className="text-[10px] gap-1 px-2.5 py-0.5 rounded-lg font-medium shadow-sm shadow-destructive/10">
                  <AlertTriangle className="w-3 h-3" />
                  {deficitCount} deficit
                </Badge>
              )}
              <Button variant="outline" size="sm" onClick={fetchDashboard} className="h-8 text-xs gap-1.5 rounded-lg border-border/80 hover:border-primary/30 hover:bg-primary/[0.04] transition-all duration-200 shadow-sm">
                <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 p-6">
          {renderContent()}
        </div>

        {/* Footer */}
        <footer className="border-t border-border/40 bg-background/50 px-6 py-3 text-center">
          <p className="text-[10px] text-muted-foreground/60 font-medium tracking-wide">
            {appName} &middot; {companyName} Office Cash Flow Management &middot; {rangeLabel}
          </p>
        </footer>
      </main>
    </div>
  );
}
