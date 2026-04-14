'use client';

import React, { Suspense, lazy } from 'react';
import {
  TrendingUp, TrendingDown, AlertTriangle, Building2, Wallet,
  ArrowDownCircle, ArrowUpCircle, ShieldAlert, Info
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { formatPKRFull, formatCompact, formatPKR, formatMillions, MONTH_NAMES } from '@/lib/format';

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
    green: {
      text: 'text-emerald-700',
      gradient: 'bg-gradient-to-br from-emerald-50/90 via-white to-emerald-50/40',
      ring: 'ring-emerald-200/70',
      icon: 'bg-gradient-to-br from-emerald-100 to-emerald-200/60 text-emerald-600 shadow-sm shadow-emerald-200/50',
    },
    red: {
      text: 'text-red-700',
      gradient: 'bg-gradient-to-br from-red-50/90 via-white to-red-50/40',
      ring: 'ring-red-200/70',
      icon: 'bg-gradient-to-br from-red-100 to-red-200/60 text-red-600 shadow-sm shadow-red-200/50',
    },
    amber: {
      text: 'text-amber-700',
      gradient: 'bg-gradient-to-br from-amber-50/90 via-white to-amber-50/40',
      ring: 'ring-amber-200/70',
      icon: 'bg-gradient-to-br from-amber-100 to-amber-200/60 text-amber-600 shadow-sm shadow-amber-200/50',
    },
    blue: {
      text: 'text-indigo-700',
      gradient: 'bg-gradient-to-br from-indigo-50/90 via-white to-indigo-50/40',
      ring: 'ring-indigo-200/70',
      icon: 'bg-gradient-to-br from-indigo-100 to-indigo-200/60 text-indigo-600 shadow-sm shadow-indigo-200/50',
    },
  }[accent];
  const valueColor = isNeg ? 'text-red-700' : palette.text;

  return (
    <TooltipProvider>
      <Card className={`ring-1 ${palette.ring} ${palette.gradient} border-0 shadow-md hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5`}>
        <CardContent className="p-5">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 truncate">
                {title}
                {tooltip && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="w-3 h-3 inline ml-1 text-slate-400 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs max-w-[200px]">{tooltip}</TooltipContent>
                  </Tooltip>
                )}
              </p>
            </div>
            <div className={`p-2.5 rounded-xl ${palette.icon}`}>
              <Icon className="w-4 h-4" />
            </div>
          </div>
          <p className={`text-[1.65rem] font-extrabold tracking-tight leading-tight ${valueColor}`}>
            {formatPKRFull(value)}
          </p>
          <div className="flex items-center gap-2 mt-1.5">
            <p className="text-[11px] text-slate-400 font-medium">{formatMillions(value)}</p>
            {delta && <span className="text-[10px] text-slate-400 font-medium">· {delta}</span>}
          </div>
          {subtitle && <p className="text-[10px] text-slate-400 mt-1">{subtitle}</p>}
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}

function ChartFallback() {
  return (
    <div className="h-[320px] flex items-center justify-center bg-slate-50/50 rounded-lg">
      <div className="text-center">
        <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
        <p className="text-xs text-slate-400">Loading chart...</p>
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
    <div className="space-y-7">
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
        <div className="flex items-center gap-3 px-5 py-3.5 rounded-xl bg-gradient-to-r from-red-50 via-rose-50 to-orange-50/80 ring-1 ring-red-200/70 shadow-sm animate-fade-in">
          <div className="p-2 rounded-lg bg-red-100/80">
            <ShieldAlert className="w-5 h-5 text-red-600 flex-shrink-0" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-red-900">
              {warnings.negativeMonths.length} of 12 months forecast deficit
            </p>
            <p className="text-xs text-red-600/90 font-medium">
              Total funding gap: <span className="font-bold">{formatPKRFull(warnings.fundingGapTotal)}</span>
              {warnings.lowCashMonths.length > 0 && (
                <> &middot; {warnings.lowCashMonths.length} low-cash month{warnings.lowCashMonths.length > 1 ? 's' : ''}</>
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {warnings.negativeMonths.slice(0, 6).map((m: any, i: number) => (
              <Badge key={i} variant="destructive" className="text-[10px] px-2 py-0.5 font-mono shadow-sm">
                {m.label}
              </Badge>
            ))}
            {warnings.negativeMonths.length > 6 && (
              <Badge variant="destructive" className="text-[10px] px-2 py-0.5 shadow-sm">+{warnings.negativeMonths.length - 6}</Badge>
            )}
          </div>
        </div>
      )}

      {/* Charts - lazy loaded */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card className="shadow-md border-slate-200/60 hover:shadow-lg transition-shadow duration-300">
          <CardHeader className="pb-2 px-6 pt-5">
            <CardTitle className="text-sm font-bold text-slate-800 tracking-tight">Monthly Receipts vs Expenses</CardTitle>
            <CardDescription className="text-[11px] text-slate-400 font-medium">Receipts vs Expenses &middot; grouped by month</CardDescription>
          </CardHeader>
          <CardContent className="px-6 pb-5">
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

        <Card className="shadow-md border-slate-200/60 hover:shadow-lg transition-shadow duration-300">
          <CardHeader className="pb-2 px-6 pt-5">
            <CardTitle className="text-sm font-bold text-slate-800 tracking-tight">Forecast Balance Trend</CardTitle>
            <CardDescription className="text-[11px] text-slate-400 font-medium">Running balance with carry-forward &middot; zero-line = break-even</CardDescription>
          </CardHeader>
          <CardContent className="px-6 pb-5">
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
        <Card className="ring-1 ring-orange-200/70 bg-gradient-to-br from-orange-50/70 via-white to-amber-50/50 shadow-md hover:shadow-lg transition-shadow duration-300">
          <CardHeader className="pb-2 px-6 pt-5">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-gradient-to-br from-orange-100 to-amber-100 shadow-sm shadow-orange-200/40">
                <TrendingDown className="w-4 h-4 text-orange-600" />
              </div>
              <div>
                <CardTitle className="text-sm font-bold text-orange-900 tracking-tight">Shortfall Recovery Plan</CardTitle>
                <CardDescription className="text-[11px] text-orange-600/80 font-medium mt-0.5">
                  Margin target: {shortfallAnalysis.profitMarginPct * 100}% &middot; Operational margin: {shortfallAnalysis.operationalMarginPct * 100}%
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-6 pb-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Total Deficit (Q85)', value: shortfallAnalysis.totalDeficit, color: 'text-red-700' },
                { label: 'Additional Business (Q86)', value: shortfallAnalysis.additionalBusinessRequired, color: 'text-orange-700' },
                { label: 'Est. Profit Margin (Q87)', value: shortfallAnalysis.profitMargin, color: 'text-amber-700' },
                { label: 'Net After Recovery (Q88)', value: shortfallAnalysis.netBalanceAfterRecovery, color: shortfallAnalysis.netBalanceAfterRecovery >= 0 ? 'text-emerald-700' : 'text-red-700' },
              ].map((item, i) => (
                <div key={i} className="bg-white/70 backdrop-blur-sm rounded-xl p-3.5 ring-1 ring-orange-100/80 shadow-sm">
                  <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">{item.label}</p>
                  <p className={`text-lg font-extrabold tracking-tight mt-1 ${item.color}`}>{formatPKRFull(item.value)}</p>
                  <p className="text-[10px] text-slate-400 font-medium mt-0.5">{formatMillions(item.value)}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Audit-Friendly Monthly Summary */}
      <Card className="shadow-md border-slate-200/60">
        <CardHeader className="pb-2 px-6 pt-5">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-bold text-slate-800 tracking-tight">Cash Flow Audit Trail</CardTitle>
              <CardDescription className="text-[11px] text-slate-400 font-medium mt-0.5">
                Opening + Receipts − Expenses = Closing &middot; Each month&apos;s opening = previous closing
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Badge className="text-[9px] bg-red-50 text-red-700 border-red-200/80 shadow-sm font-semibold px-2 py-0.5">Deficit</Badge>
              <Badge className="text-[9px] bg-amber-50 text-amber-700 border-amber-200/80 shadow-sm font-semibold px-2 py-0.5">Low</Badge>
              <Badge className="text-[9px] bg-emerald-50 text-emerald-700 border-emerald-200/80 shadow-sm font-semibold px-2 py-0.5">Healthy</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-6 pb-5">
          <div className="overflow-x-auto custom-scrollbar rounded-xl ring-1 ring-slate-200/70">
            <table className="w-full text-[11px] border-collapse">
              <thead>
                <tr className="bg-gradient-to-r from-slate-50 to-slate-100/80 border-b border-slate-200/60">
                  <th className="text-left p-3 font-bold text-slate-600 w-20">Month</th>
                  <th className="text-right p-3 font-bold text-slate-600">Opening</th>
                  <th className="text-right p-3 font-bold text-emerald-700">+ Receipts</th>
                  <th className="text-right p-3 font-bold text-red-700">− Expenses</th>
                  <th className="text-center p-3 font-bold text-slate-300">=</th>
                  <th className="text-right p-3 font-bold text-slate-600">Net Flow</th>
                  <th className="text-right p-3 font-bold text-slate-600">Closing</th>
                  <th className="text-right p-3 font-bold text-slate-500">Ops Cost</th>
                  <th className="text-center p-3 font-bold text-slate-600 w-16">Status</th>
                </tr>
              </thead>
              <tbody>
                <tr className="bg-indigo-50/40 border-b border-slate-200/40">
                  <td colSpan={9} className="p-2.5 text-[10px] font-semibold text-slate-600">
                    Current Bank Balance (Q4): <span className={currentBalance >= 0 ? 'text-emerald-700 font-bold' : 'text-red-700 font-bold'}>{formatPKRFull(currentBalance)}</span>
                    &nbsp;&middot;&nbsp; Carry-forward starts here
                  </td>
                </tr>
                {monthlyData.map((m: any, i: number) => (
                  <tr key={i} className={`border-b border-slate-100/80 transition-colors duration-150 ${m.warningFlag ? 'bg-red-50/50' : m.closingBalance < 500000 ? 'bg-amber-50/30' : i % 2 === 0 ? 'bg-white' : 'bg-slate-50/40 hover:bg-slate-100/50'}`}>
                    <td className="p-3 font-semibold text-slate-700">{m.monthLabel}</td>
                    <td className={`text-right p-3 font-mono tabular-nums ${m.openingBalance < 0 ? 'text-red-700 font-semibold' : 'text-slate-700'}`}>
                      {formatPKR(m.openingBalance)}
                    </td>
                    <td className="text-right p-3 font-mono tabular-nums text-emerald-700 font-medium">{formatPKR(m.totalReceipts)}</td>
                    <td className="text-right p-3 font-mono tabular-nums text-red-700 font-medium">{formatPKR(m.totalExpenses)}</td>
                    <td className="text-center p-3 text-slate-300 font-bold">=</td>
                    <td className={`text-right p-3 font-mono tabular-nums font-semibold ${m.netCashFlow < 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                      {m.netCashFlow >= 0 ? '+' : ''}{formatPKR(m.netCashFlow)}
                    </td>
                    <td className={`text-right p-3 font-mono tabular-nums font-bold ${m.closingBalance < 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                      {formatPKR(m.closingBalance)}
                    </td>
                    <td className="text-right p-3 font-mono tabular-nums text-slate-400">{formatPKR(m.totalOperationalExpenses)}</td>
                    <td className="text-center p-3">
                      {m.warningFlag ? (
                        <Badge variant="destructive" className="text-[9px] px-2 py-0.5 shadow-sm font-semibold">Deficit</Badge>
                      ) : m.closingBalance < 500000 ? (
                        <Badge className="text-[9px] px-2 py-0.5 bg-amber-50 text-amber-800 border-amber-200/80 shadow-sm font-semibold">Low</Badge>
                      ) : (
                        <Badge className="text-[9px] px-2 py-0.5 bg-emerald-50 text-emerald-800 border-emerald-200/80 shadow-sm font-semibold">OK</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gradient-to-r from-slate-100 to-slate-50 font-bold text-[11px] border-t-2 border-slate-200">
                  <td className="p-3 text-slate-700">TOTAL</td>
                  <td></td>
                  <td className="text-right p-3 font-mono tabular-nums text-emerald-700">{formatPKR(monthlyData.reduce((s: number, m: any) => s + m.totalReceipts, 0))}</td>
                  <td className="text-right p-3 font-mono tabular-nums text-red-700">{formatPKR(monthlyData.reduce((s: number, m: any) => s + m.totalExpenses, 0))}</td>
                  <td></td>
                  <td className={`text-right p-3 font-mono tabular-nums ${netCashFlow >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{formatPKR(netCashFlow)}</td>
                  <td className={`text-right p-3 font-mono tabular-nums ${forecastClosingBalance >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{formatPKR(forecastClosingBalance)}</td>
                  <td className="text-right p-3 font-mono tabular-nums text-slate-500">{formatPKR(monthlyData.reduce((s: number, m: any) => s + m.totalOperationalExpenses, 0))}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Bank Accounts + Top Categories side by side */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card className="shadow-md border-slate-200/60">
          <CardHeader className="pb-2 px-6 pt-5">
            <CardTitle className="text-sm font-bold text-slate-800 tracking-tight">Bank Accounts</CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-5">
            <div className="space-y-3">
              {bankAccounts.map((acc: any, i: number) => (
                <div key={i} className={`flex items-center justify-between p-3.5 rounded-xl ring-1 shadow-sm hover:shadow-md transition-all duration-200 ${acc.currentBalance >= 0 ? 'ring-emerald-200/60 bg-gradient-to-r from-emerald-50/50 to-white' : 'ring-red-200/60 bg-gradient-to-r from-red-50/50 to-white'}`}>
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl shadow-sm ${acc.currentBalance >= 0 ? 'bg-gradient-to-br from-emerald-100 to-emerald-200/50' : 'bg-gradient-to-br from-red-100 to-red-200/50'}`}>
                      <Building2 className={`w-4 h-4 ${acc.currentBalance >= 0 ? 'text-emerald-600' : 'text-red-600'}`} />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-800">{acc.bankName}</p>
                      <p className="text-[10px] text-slate-400 font-medium">{acc.accountName}</p>
                    </div>
                  </div>
                  <p className={`text-sm font-bold font-mono tabular-nums ${acc.currentBalance >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                    {formatPKRFull(acc.currentBalance)}
                  </p>
                </div>
              ))}
              <div className="flex items-center justify-between pt-3 border-t border-slate-200/60">
                <p className="text-xs font-bold text-slate-700">Consolidated</p>
                <p className={`text-sm font-extrabold font-mono tabular-nums ${currentBalance >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                  {formatPKRFull(currentBalance)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-md border-slate-200/60">
          <CardHeader className="pb-2 px-6 pt-5">
            <CardTitle className="text-sm font-bold text-slate-800 tracking-tight">Expense Breakdown</CardTitle>
            <CardDescription className="text-[11px] text-slate-400 font-medium mt-0.5">Top categories by total spend</CardDescription>
          </CardHeader>
          <CardContent className="px-6 pb-5">
            <div className="space-y-3 max-h-[340px] overflow-y-auto custom-scrollbar pr-1">
              {categoryBreakdown.slice(0, 12).map((cat: any, i: number) => {
                const maxAmount = categoryBreakdown[0]?.totalAmount || 1;
                const pct = (cat.totalAmount / maxAmount) * 100;
                return (
                  <div key={i} className="group">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px] font-semibold text-slate-700 truncate max-w-[200px]" title={cat.category}>{cat.category}</span>
                      <span className="text-[11px] font-bold font-mono tabular-nums text-slate-500">{formatPKR(cat.totalAmount)}</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-indigo-400 via-indigo-500 to-violet-500 transition-all duration-300 group-hover:from-indigo-500 group-hover:via-indigo-600 group-hover:to-violet-600"
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
      <Card className="shadow-md border-slate-200/60">
        <CardHeader className="pb-2 px-6 pt-5">
          <CardTitle className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Formula Reference: Excel → System</CardTitle>
        </CardHeader>
        <CardContent className="px-6 pb-5">
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
              <div key={i} className="bg-gradient-to-br from-slate-50 to-slate-100/60 rounded-xl p-3 ring-1 ring-slate-200/50 shadow-sm">
                <p className="text-[10px] font-mono font-extrabold text-indigo-600">{cell}</p>
                <p className="text-[9px] font-mono text-slate-400 truncate mt-0.5" title={formula}>{formula}</p>
                <p className="text-[10px] mt-1 text-slate-600 font-medium">{desc}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ───── Cash Flow Trend Analysis ───── */}
      <CashFlowTrends monthlyData={monthlyData} currentBalance={currentBalance} />
    </div>
  );
}

function CashFlowTrends({ monthlyData, currentBalance }: { monthlyData: any[]; currentBalance: number }) {
  const len = monthlyData.length;

  // Compute 3-month receipt trend
  const last3Receipts = monthlyData.slice(-3);
  const prev3Receipts = monthlyData.slice(-6, -3);
  const avgLast3Receipts = last3Receipts.length > 0 ? last3Receipts.reduce((s, m) => s + m.totalReceipts, 0) / last3Receipts.length : 0;
  const avgPrev3Receipts = prev3Receipts.length > 0 ? prev3Receipts.reduce((s, m) => s + m.totalReceipts, 0) / prev3Receipts.length : 0;
  const receiptTrendPct = avgPrev3Receipts !== 0 ? ((avgLast3Receipts - avgPrev3Receipts) / avgPrev3Receipts) * 100 : 0;

  // Compute 3-month expense trend
  const avgLast3Expenses = last3Receipts.length > 0 ? last3Receipts.reduce((s, m) => s + m.totalExpenses, 0) / last3Receipts.length : 0;
  const avgPrev3Expenses = prev3Receipts.length > 0 ? prev3Receipts.reduce((s, m) => s + m.totalExpenses, 0) / prev3Receipts.length : 0;
  const expenseTrendPct = avgPrev3Expenses !== 0 ? ((avgLast3Expenses - avgPrev3Expenses) / avgPrev3Expenses) * 100 : 0;

  // Cash burn rate & runway
  const totalExpenses = monthlyData.reduce((s, m) => s + m.totalExpenses, 0);
  const avgMonthlyBurn = len > 0 ? totalExpenses / len : 0;
  const monthlyNetFlows = monthlyData.map(m => m.netCashFlow);
  const avgMonthlyNet = len > 0 ? monthlyNetFlows.reduce((s, v) => s + v, 0) / len : 0;
  const monthsRunway = avgMonthlyNet < 0 && currentBalance > 0 ? Math.floor(currentBalance / Math.abs(avgMonthlyNet)) : avgMonthlyNet >= 0 ? Infinity : 0;

  if (len < 2) return null;

  const trends = [
    {
      title: '3-Month Receipt Trend',
      value: avgLast3Receipts,
      trend: receiptTrendPct,
      positive: receiptTrendPct >= 0,
      subtitle: `Avg: ${formatPKRFull(avgLast3Receipts)}/mo`,
      tooltip: 'Compares average receipts of last 3 months vs previous 3 months',
      accent: receiptTrendPct >= 0 ? 'green' as const : 'red' as const,
    },
    {
      title: '3-Month Expense Trend',
      value: avgLast3Expenses,
      trend: expenseTrendPct,
      positive: expenseTrendPct <= 0, // lower expenses = good
      subtitle: `Avg: ${formatPKRFull(avgLast3Expenses)}/mo`,
      tooltip: 'Compares average expenses of last 3 months vs previous 3 months (lower is better)',
      accent: expenseTrendPct <= 0 ? 'green' as const : 'amber' as const,
    },
    {
      title: 'Cash Burn Rate',
      value: avgMonthlyBurn,
      trend: null,
      positive: avgMonthlyNet >= 0,
      subtitle: avgMonthlyNet >= 0
        ? `Net positive — no runway concern`
        : `~${monthsRunway} month${monthsRunway !== 1 ? 's' : ''} of runway remaining`,
      tooltip: 'Average monthly expenses and estimated runway at current burn rate',
      accent: avgMonthlyNet >= 0 ? 'green' as const : 'red' as const,
    },
  ];

  return (
    <div>
      <div className="flex items-center gap-2.5 mb-4">
        <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-100 to-indigo-200/60 shadow-sm shadow-indigo-200/50">
          <TrendingUp className="w-4 h-4 text-indigo-600" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-slate-800 tracking-tight">Cash Flow Trends</h3>
          <p className="text-[11px] text-slate-400 font-medium mt-0.5">Period-over-period comparison based on selected range</p>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {trends.map((t, i) => {
          const isNeg = t.value < 0;
          const palette = {
            green: {
              gradient: 'bg-gradient-to-br from-emerald-50/90 via-white to-emerald-50/40',
              ring: 'ring-emerald-200/70',
              icon: 'bg-gradient-to-br from-emerald-100 to-emerald-200/60 text-emerald-600 shadow-sm shadow-emerald-200/50',
            },
            red: {
              gradient: 'bg-gradient-to-br from-red-50/90 via-white to-red-50/40',
              ring: 'ring-red-200/70',
              icon: 'bg-gradient-to-br from-red-100 to-red-200/60 text-red-600 shadow-sm shadow-red-200/50',
            },
            amber: {
              gradient: 'bg-gradient-to-br from-amber-50/90 via-white to-amber-50/40',
              ring: 'ring-amber-200/70',
              icon: 'bg-gradient-to-br from-amber-100 to-amber-200/60 text-amber-600 shadow-sm shadow-amber-200/50',
            },
          }[t.accent];
          return (
            <TooltipProvider key={i}>
              <Card className={`ring-1 ${palette.ring} ${palette.gradient} border-0 shadow-md hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5`}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 truncate">
                        {t.title}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="w-3 h-3 inline ml-1 text-slate-400 cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs max-w-[220px]">{t.tooltip}</TooltipContent>
                        </Tooltip>
                      </p>
                    </div>
                    <div className={`p-2.5 rounded-xl ${palette.icon}`}>
                      {t.positive ? (
                        <TrendingUp className="w-4 h-4" />
                      ) : (
                        <TrendingDown className="w-4 h-4" />
                      )}
                    </div>
                  </div>
                  <p className={`text-[1.3rem] font-extrabold tracking-tight leading-tight ${isNeg ? 'text-red-700' : t.accent === 'green' ? 'text-emerald-700' : t.accent === 'red' ? 'text-red-700' : 'text-amber-700'}`}>
                    {formatPKRFull(t.value)}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    {t.trend !== null && (
                      <span className={`inline-flex items-center gap-1 text-[11px] font-bold ${t.positive ? 'text-emerald-600' : 'text-red-600'}`}>
                        {t.positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        {t.trend >= 0 ? '+' : ''}{t.trend.toFixed(1)}%
                      </span>
                    )}
                    <p className="text-[10px] text-slate-400 font-medium">{t.subtitle}</p>
                  </div>
                </CardContent>
              </Card>
            </TooltipProvider>
          );
        })}
      </div>
    </div>
  );
}
