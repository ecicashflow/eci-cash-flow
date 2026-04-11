'use client';

import React, { Suspense, lazy } from 'react';
import {
  TrendingUp, TrendingDown, AlertTriangle, Building2, Wallet,
  ArrowDownCircle, ArrowUpCircle, ShieldAlert, Info
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { formatPKRFull, formatCompact, formatPKR, formatLakhs, MONTH_NAMES } from '@/lib/format';

// Lazy-load recharts to prevent SSR/hydration crashes
const LazyRecharts = lazy(() => import('@/components/cashflow/RechartsCharts'));

interface DashboardViewProps {
  data: any;
  onRefresh: () => void;
}

function KpiCard({ title, value, icon: Icon, subtitle, tooltip, delta, accent }: {
  title: string; value: number; icon: React.ElementType; subtitle?: string;
  tooltip?: string; delta?: string; accent: 'green' | 'red' | 'amber' | 'blue';
}) {
  const isNeg = value < 0;
  const palette = {
    green: { text: 'text-emerald-700', bg: 'bg-emerald-50', ring: 'ring-emerald-200', icon: 'bg-emerald-100 text-emerald-600' },
    red: { text: 'text-red-700', bg: 'bg-red-50', ring: 'ring-red-200', icon: 'bg-red-100 text-red-600' },
    amber: { text: 'text-amber-700', bg: 'bg-amber-50', ring: 'ring-amber-200', icon: 'bg-amber-100 text-amber-600' },
    blue: { text: 'text-blue-700', bg: 'bg-blue-50', ring: 'ring-blue-200', icon: 'bg-blue-100 text-blue-600' },
  }[accent];
  const valueColor = isNeg ? 'text-red-700' : palette.text;

  return (
    <TooltipProvider>
      <Card className={`ring-1 ${palette.ring} ${palette.bg} border-0 shadow-sm hover:shadow-md transition-shadow`}>
        <CardContent className="p-5">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground truncate">
                {title}
                {tooltip && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="w-3 h-3 inline ml-1 text-muted-foreground/60 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs max-w-[200px]">{tooltip}</TooltipContent>
                  </Tooltip>
                )}
              </p>
            </div>
            <div className={`p-2 rounded-xl ${palette.icon}`}>
              <Icon className="w-4 h-4" />
            </div>
          </div>
          <p className={`text-2xl font-bold tracking-tight ${valueColor}`}>
            {formatPKRFull(value)}
          </p>
          <div className="flex items-center gap-2 mt-1.5">
            <p className="text-[11px] text-muted-foreground">{formatLakhs(value)}</p>
            {delta && <span className="text-[10px] text-muted-foreground">· {delta}</span>}
          </div>
          {subtitle && <p className="text-[10px] text-muted-foreground mt-1">{subtitle}</p>}
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}

function ChartFallback() {
  return (
    <div className="h-[320px] flex items-center justify-center bg-muted/20 rounded-lg">
      <div className="text-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
        <p className="text-xs text-muted-foreground">Loading chart...</p>
      </div>
    </div>
  );
}

export default function DashboardView({ data }: DashboardViewProps) {
  // Defensive: ensure all expected data fields exist with defaults
  const currentBalance = data?.currentBalance ?? 0;
  const totalExpectedReceipts = data?.totalExpectedReceipts ?? 0;
  const totalExpectedExpenses = data?.totalExpectedExpenses ?? 0;
  const netCashFlow = data?.netCashFlow ?? 0;
  const forecastClosingBalance = data?.forecastClosingBalance ?? 0;
  const monthlyData = data?.monthlyData ?? [];
  const warnings = data?.warnings ?? { negativeMonths: [], lowCashMonths: [], fundingGapTotal: 0 };
  const bankAccounts = data?.bankAccounts ?? [];
  const shortfallAnalysis = data?.shortfallAnalysis ?? { totalDeficit: 0, additionalBusinessRequired: 0, profitMargin: 0, netBalanceAfterRecovery: 0, profitMarginPct: 0, operationalMarginPct: 0 };
  const categoryBreakdown = data?.categoryBreakdown ?? [];

  const receiptPct = totalExpectedReceipts > 0
    ? ((netCashFlow / totalExpectedReceipts) * 100).toFixed(1) : '0';

  const kpis = [
    {
      title: 'Bank Balance', value: currentBalance, icon: Building2, accent: currentBalance >= 0 ? 'green' : 'red' as const,
      subtitle: `${bankAccounts.length} account(s)`, tooltip: 'Sum of all active bank account balances (=Q4)',
    },
    {
      title: 'Expected Receipts', value: totalExpectedReceipts, icon: ArrowDownCircle, accent: 'green' as const,
      subtitle: `${monthlyData.filter((m: any) => m.totalReceipts > 0).length} active months`, tooltip: 'Sum of all receipt amounts across FY',
    },
    {
      title: 'Expected Expenses', value: totalExpectedExpenses, icon: ArrowUpCircle, accent: 'red' as const,
      subtitle: `Ops: ${formatCompact(monthlyData.reduce((s: number, m: any) => s + m.totalOperationalExpenses, 0))}`, tooltip: 'Sum of all expense amounts across FY',
    },
    {
      title: 'Net Cash Flow', value: netCashFlow, icon: netCashFlow >= 0 ? TrendingUp : TrendingDown, accent: netCashFlow >= 0 ? 'green' : 'red' as const,
      delta: `${receiptPct}% margin`, tooltip: 'Receipts − Expenses',
    },
    {
      title: 'Forecast Closing', value: forecastClosingBalance, icon: Wallet, accent: forecastClosingBalance >= 0 ? 'green' : 'red' as const,
      subtitle: `End of FY balance`, tooltip: '= Q4 + Total Receipts − Total Expenses (=Q83)',
    },
  ];

  // Chart data
  const barChartData = monthlyData.map((m: any) => ({
    name: m.monthLabel,
    short: MONTH_NAMES[m.month - 1],
    Receipts: Math.round(m.totalReceipts),
    Expenses: Math.round(m.totalExpenses),
    Net: Math.round(m.netCashFlow),
  }));

  const areaChartData = monthlyData.map((m: any) => ({
    name: m.monthLabel,
    short: MONTH_NAMES[m.month - 1],
    Balance: Math.round(m.closingBalance),
  }));

  const tooltipStyle = { fontSize: 11, borderRadius: 8, border: '1px solid var(--border)' };
  const currencyFormatter = (v: number) => formatPKRFull(v);

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {kpis.map((kpi, i) => (
          <div key={i} className="animate-fade-in" style={{ animationDelay: `${i * 60}ms`, animationFillMode: 'both' }}>
            <KpiCard {...kpi} />
          </div>
        ))}
      </div>

      {/* Alert Strip */}
      {warnings.negativeMonths.length > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gradient-to-r from-red-50 to-orange-50 ring-1 ring-red-200 animate-fade-in">
          <ShieldAlert className="w-5 h-5 text-red-600 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-red-800">
              {warnings.negativeMonths.length} of 12 months forecast deficit
            </p>
            <p className="text-xs text-red-600">
              Total funding gap: <span className="font-semibold">{formatPKRFull(warnings.fundingGapTotal)}</span>
              {warnings.lowCashMonths.length > 0 && (
                <> &middot; {warnings.lowCashMonths.length} low-cash month{warnings.lowCashMonths.length > 1 ? 's' : ''}</>
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {warnings.negativeMonths.slice(0, 6).map((m: any, i: number) => (
              <Badge key={i} variant="destructive" className="text-[10px] px-1.5 py-0 font-mono">
                {m.label}
              </Badge>
            ))}
            {warnings.negativeMonths.length > 6 && (
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0">+{warnings.negativeMonths.length - 6}</Badge>
            )}
          </div>
        </div>
      )}

      {/* Charts - lazy loaded */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Monthly Receipts vs Expenses</CardTitle>
            <CardDescription className="text-[11px] text-muted-foreground">Receipts vs Expenses &middot; grouped by month</CardDescription>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<ChartFallback />}>
              <LazyRecharts
                type="bar"
                data={barChartData}
                tooltipStyle={tooltipStyle}
                currencyFormatter={currencyFormatter}
              />
            </Suspense>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Forecast Balance Trend</CardTitle>
            <CardDescription className="text-[11px] text-muted-foreground">Running balance with carry-forward &middot; zero-line = break-even</CardDescription>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<ChartFallback />}>
              <LazyRecharts
                type="area"
                data={areaChartData}
                tooltipStyle={tooltipStyle}
                currencyFormatter={currencyFormatter}
              />
            </Suspense>
          </CardContent>
        </Card>
      </div>

      {/* Shortfall Analysis */}
      {shortfallAnalysis.totalDeficit > 0 && (
        <Card className="ring-1 ring-orange-200 bg-gradient-to-r from-orange-50/80 to-amber-50/60 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-orange-600" />
              <CardTitle className="text-sm font-semibold text-orange-800">Shortfall Recovery Plan</CardTitle>
            </div>
            <CardDescription className="text-[11px] text-orange-600">
              Margin target: {shortfallAnalysis.profitMarginPct * 100}% &middot; Operational margin: {shortfallAnalysis.operationalMarginPct * 100}%
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Total Deficit (Q85)', value: shortfallAnalysis.totalDeficit, color: 'text-red-700' },
                { label: 'Additional Business (Q86)', value: shortfallAnalysis.additionalBusinessRequired, color: 'text-orange-700' },
                { label: 'Est. Profit Margin (Q87)', value: shortfallAnalysis.profitMargin, color: 'text-amber-700' },
                { label: 'Net After Recovery (Q88)', value: shortfallAnalysis.netBalanceAfterRecovery, color: shortfallAnalysis.netBalanceAfterRecovery >= 0 ? 'text-emerald-700' : 'text-red-700' },
              ].map((item, i) => (
                <div key={i} className="bg-white/60 rounded-lg p-3 ring-1 ring-orange-100">
                  <p className="text-[10px] text-muted-foreground font-medium">{item.label}</p>
                  <p className={`text-lg font-bold ${item.color}`}>{formatPKRFull(item.value)}</p>
                  <p className="text-[10px] text-muted-foreground">{formatLakhs(item.value)}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Audit-Friendly Monthly Summary */}
      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold">Cash Flow Audit Trail</CardTitle>
              <CardDescription className="text-[11px] text-muted-foreground">
                Opening + Receipts − Expenses = Closing &middot; Each month&apos;s opening = previous closing
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Badge className="text-[9px] bg-red-100 text-red-700 border-red-200">Deficit</Badge>
              <Badge className="text-[9px] bg-amber-100 text-amber-700 border-amber-200">Low</Badge>
              <Badge className="text-[9px] bg-emerald-100 text-emerald-700 border-emerald-200">Healthy</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto custom-scrollbar rounded-lg ring-1 ring-border">
            <table className="w-full text-[11px] border-collapse">
              <thead>
                <tr className="bg-muted/60 text-muted-foreground">
                  <th className="text-left p-2.5 font-semibold w-20">Month</th>
                  <th className="text-right p-2.5 font-semibold">Opening</th>
                  <th className="text-right p-2.5 font-semibold text-emerald-700">+ Receipts</th>
                  <th className="text-right p-2.5 font-semibold text-red-700">− Expenses</th>
                  <th className="text-center p-2.5 font-semibold text-muted-foreground/60">=</th>
                  <th className="text-right p-2.5 font-semibold">Net Flow</th>
                  <th className="text-right p-2.5 font-semibold">Closing</th>
                  <th className="text-right p-2.5 font-semibold text-muted-foreground">Ops Cost</th>
                  <th className="text-center p-2.5 font-semibold w-16">Status</th>
                </tr>
              </thead>
              <tbody>
                <tr className="bg-muted/30 border-b">
                  <td colSpan={9} className="p-2 text-[10px] font-medium">
                    Current Bank Balance (Q4): <span className={currentBalance >= 0 ? 'text-emerald-700 font-semibold' : 'text-red-700 font-semibold'}>{formatPKRFull(currentBalance)}</span>
                    &nbsp;&middot;&nbsp; Carry-forward starts here
                  </td>
                </tr>
                {monthlyData.map((m: any, i: number) => (
                  <tr key={i} className={`border-b transition-colors ${m.warningFlag ? 'bg-red-50/60' : m.closingBalance < 500000 ? 'bg-amber-50/40' : 'hover:bg-muted/20'}`}>
                    <td className="p-2.5 font-medium">{m.monthLabel}</td>
                    <td className={`text-right p-2.5 font-mono ${m.openingBalance < 0 ? 'text-red-700' : 'text-foreground'}`}>
                      {formatPKR(m.openingBalance)}
                    </td>
                    <td className="text-right p-2.5 font-mono text-emerald-700">{formatPKR(m.totalReceipts)}</td>
                    <td className="text-right p-2.5 font-mono text-red-700">{formatPKR(m.totalExpenses)}</td>
                    <td className="text-center p-2.5 text-muted-foreground/40 font-bold">=</td>
                    <td className={`text-right p-2.5 font-mono ${m.netCashFlow < 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                      {m.netCashFlow >= 0 ? '+' : ''}{formatPKR(m.netCashFlow)}
                    </td>
                    <td className={`text-right p-2.5 font-mono font-bold ${m.closingBalance < 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                      {formatPKR(m.closingBalance)}
                    </td>
                    <td className="text-right p-2.5 font-mono text-muted-foreground">{formatPKR(m.totalOperationalExpenses)}</td>
                    <td className="text-center p-2.5">
                      {m.warningFlag ? (
                        <Badge variant="destructive" className="text-[9px] px-1.5 py-0">Deficit</Badge>
                      ) : m.closingBalance < 500000 ? (
                        <Badge className="text-[9px] px-1.5 py-0 bg-amber-100 text-amber-800 border-amber-300">Low</Badge>
                      ) : (
                        <Badge className="text-[9px] px-1.5 py-0 bg-emerald-100 text-emerald-800 border-emerald-300">OK</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-muted/40 font-bold text-[11px]">
                  <td className="p-2.5">TOTAL</td>
                  <td></td>
                  <td className="text-right p-2.5 font-mono text-emerald-700">{formatPKR(monthlyData.reduce((s: number, m: any) => s + m.totalReceipts, 0))}</td>
                  <td className="text-right p-2.5 font-mono text-red-700">{formatPKR(monthlyData.reduce((s: number, m: any) => s + m.totalExpenses, 0))}</td>
                  <td></td>
                  <td className={`text-right p-2.5 font-mono ${netCashFlow >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{formatPKR(netCashFlow)}</td>
                  <td className={`text-right p-2.5 font-mono ${forecastClosingBalance >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{formatPKR(forecastClosingBalance)}</td>
                  <td className="text-right p-2.5 font-mono text-muted-foreground">{formatPKR(monthlyData.reduce((s: number, m: any) => s + m.totalOperationalExpenses, 0))}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Bank Accounts + Top Categories side by side */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Bank Accounts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {bankAccounts.map((acc: any, i: number) => (
                <div key={i} className={`flex items-center justify-between p-3 rounded-lg ring-1 ${acc.currentBalance >= 0 ? 'ring-emerald-200 bg-emerald-50/50' : 'ring-red-200 bg-red-50/50'}`}>
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${acc.currentBalance >= 0 ? 'bg-emerald-100' : 'bg-red-100'}`}>
                      <Building2 className={`w-4 h-4 ${acc.currentBalance >= 0 ? 'text-emerald-600' : 'text-red-600'}`} />
                    </div>
                    <div>
                      <p className="text-xs font-semibold">{acc.bankName}</p>
                      <p className="text-[10px] text-muted-foreground">{acc.accountName}</p>
                    </div>
                  </div>
                  <p className={`text-sm font-bold font-mono ${acc.currentBalance >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                    {formatPKRFull(acc.currentBalance)}
                  </p>
                </div>
              ))}
              <div className="flex items-center justify-between pt-2 border-t">
                <p className="text-xs font-semibold">Consolidated</p>
                <p className={`text-sm font-bold font-mono ${currentBalance >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                  {formatPKRFull(currentBalance)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Expense Breakdown</CardTitle>
            <CardDescription className="text-[11px] text-muted-foreground">Top categories by total spend</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2.5 max-h-[340px] overflow-y-auto custom-scrollbar pr-1">
              {categoryBreakdown.slice(0, 12).map((cat: any, i: number) => {
                const maxAmount = categoryBreakdown[0]?.totalAmount || 1;
                const pct = (cat.totalAmount / maxAmount) * 100;
                return (
                  <div key={i} className="group">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-medium truncate max-w-[200px]" title={cat.category}>{cat.category}</span>
                      <span className="text-[11px] font-semibold font-mono text-muted-foreground">{formatPKR(cat.totalAmount)}</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-red-400 to-orange-400 transition-all group-hover:from-red-500 group-hover:to-orange-500"
                        style={{ width: `${Math.max(pct, 2)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Excel Formula Reference */}
      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Formula Reference: Excel → System</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {[
              ['Q4', '=SUM(O6:O8)', 'Bank Balance'],
              ['D10', '=Q4', 'Opening (Apr)'],
              ['E10', '=D83', 'Opening (May+)'],
              ['D37', '=SUM(D13:D36)', 'Monthly Receipts'],
              ['D81', '=SUM(D42:D79)', 'Monthly Expenses'],
              ['D83', '=D10+D37-D81', 'Forecast Balance'],
              ['Q83', '=Q4+Q9-Q39', 'Overall Forecast'],
              ['Q85', '=ABS(Q83)', 'Total Deficit'],
              ['Q86', '=IF(Q83<0,ABS(Q85)/12%,0)', 'Business Required'],
              ['Q87', '=Q86*9%', 'Profit Margin'],
              ['Q88', '=Q87+Q83', 'Net After Recovery'],
              ['D89', '=SUM(D56:D79)', 'Operational Costs'],
            ].map(([cell, formula, desc], i) => (
              <div key={i} className="bg-muted/40 rounded-lg p-2.5">
                <p className="text-[10px] font-mono font-bold text-primary">{cell}</p>
                <p className="text-[9px] font-mono text-muted-foreground truncate" title={formula}>{formula}</p>
                <p className="text-[10px] mt-0.5">{desc}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
