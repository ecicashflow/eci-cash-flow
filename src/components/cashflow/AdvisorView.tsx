'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldAlert, AlertTriangle, CheckCircle, Info, Lightbulb,
  Clock, TrendingDown, TrendingUp, Users, CalendarClock,
  ChevronDown, ChevronUp, Sparkles, ArrowRight, Zap,
  Banknote, BarChart3, CircleDot, Target, FileSpreadsheet,
  Repeat, Globe, Brain, Activity, DollarSign, PieChart,
  AlertOctagon, Rocket, Timer, Flame, Snowflake
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { formatPKR, formatPKRFull, formatCompact } from '@/lib/format';

interface AdvisorViewProps {
  startDate: string;
  endDate: string;
  onRefresh: () => void;
}

/* ─── Severity Colors ─── */
const SEV: Record<string, { bg: string; text: string; border: string; icon: string; dot: string }> = {
  critical: { bg: 'bg-red-50/80', text: 'text-red-700', border: 'border-red-300/60', icon: 'text-red-600', dot: 'bg-red-500' },
  high: { bg: 'bg-orange-50/80', text: 'text-orange-700', border: 'border-orange-300/60', icon: 'text-orange-600', dot: 'bg-orange-500' },
  medium: { bg: 'bg-amber-50/80', text: 'text-amber-700', border: 'border-amber-300/60', icon: 'text-amber-600', dot: 'bg-amber-500' },
  low: { bg: 'bg-sky-50/80', text: 'text-sky-700', border: 'border-sky-300/60', icon: 'text-sky-600', dot: 'bg-sky-500' },
};

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  'on-track': { bg: 'bg-emerald-100/80 text-emerald-700', text: 'text-emerald-600' },
  'at-risk': { bg: 'bg-amber-100/80 text-amber-700', text: 'text-amber-600' },
  'behind': { bg: 'bg-red-100/80 text-red-700', text: 'text-red-600' },
  'overspent': { bg: 'bg-red-100/80 text-red-700', text: 'text-red-600' },
  'caution': { bg: 'bg-amber-100/80 text-amber-700', text: 'text-amber-600' },
};

const EFFORT_COLORS: Record<string, string> = {
  low: 'bg-emerald-100/80 text-emerald-700 border-emerald-200/60',
  medium: 'bg-amber-100/80 text-amber-700 border-amber-200/60',
  high: 'bg-red-100/80 text-red-700 border-red-200/60',
};

/* ─── Stat Card Mini ─── */
function StatMini({ label, value, sub, color = 'text-slate-800' }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="bg-gradient-to-br from-slate-50 to-white rounded-xl p-3.5 ring-1 ring-slate-200/60 shadow-sm">
      <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">{label}</p>
      <p className={`text-sm font-extrabold tracking-tight mt-0.5 ${color}`}>{value}</p>
      {sub && <p className="text-[9px] text-slate-400 font-medium mt-0.5">{sub}</p>}
    </div>
  );
}

/* ─── Collapsible Section ─── */
function Section({ icon: Icon, title, desc, children, defaultOpen = false, accent = 'from-slate-100 to-slate-200/60', accentShadow = 'shadow-slate-200/40' }: {
  icon: React.ElementType; title: string; desc: string; children: React.ReactNode; defaultOpen?: boolean;
  accent?: string; accentShadow?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card className="shadow-md border-slate-200/60 hover:shadow-lg transition-shadow duration-300">
      <CardHeader className="pb-2 px-6 pt-5 cursor-pointer select-none" onClick={() => setOpen(!open)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-xl bg-gradient-to-br ${accent} shadow-sm ${accentShadow}`}>
              <Icon className="w-4 h-4 text-slate-700" />
            </div>
            <div>
              <CardTitle className="text-sm font-bold text-slate-800 tracking-tight">{title}</CardTitle>
              <CardDescription className="text-[11px] text-slate-400 font-medium">{desc}</CardDescription>
            </div>
          </div>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
            {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
        </div>
      </CardHeader>
      {open && <CardContent className="px-6 pb-5">{children}</CardContent>}
    </Card>
  );
}

/* ─── Main AdvisorView ─── */
export default function AdvisorView({ startDate, endDate, onRefresh }: AdvisorViewProps) {
  const [advisorData, setAdvisorData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAdvisor = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/advisor?startDate=${startDate}&endDate=${endDate}`);
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const data = await res.json();
      setAdvisorData(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load advisor analysis');
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => { fetchAdvisor(); }, [fetchAdvisor]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-14 h-14 rounded-2xl bg-violet-100/80 flex items-center justify-center mx-auto mb-4">
            <Brain className="w-7 h-7 text-violet-600 animate-pulse" />
          </div>
          <p className="text-sm font-medium text-slate-600">Analyzing your complete portal...</p>
          <p className="text-xs text-slate-400 mt-1">Gathering data from all modules</p>
        </div>
      </div>
    );
  }

  if (error || !advisorData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center max-w-md">
          <ShieldAlert className="w-10 h-10 text-red-500 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-700">{error || 'No advisor data available'}</p>
          <Button onClick={fetchAdvisor} variant="outline" size="sm" className="mt-4 gap-1.5">
            <Activity className="w-3.5 h-3.5" /> Retry
          </Button>
        </div>
      </div>
    );
  }

  const d = advisorData;
  // Score is the PRIMARY and ONLY source of truth for health status.
  // We NEVER use the API's overallHealth string — it could be stale or contradictory.
  const score = typeof d.healthScore === 'number' ? Math.max(0, Math.min(100, Math.round(d.healthScore))) : 0;
  // Derive health strictly from score thresholds:
  //   score < 40  →  CRITICAL  (red)
  //   score < 70  →  WARNING   (amber/orange)
  //   score >= 70 →  HEALTHY   (green)
  let health: 'CRITICAL' | 'WARNING' | 'HEALTHY';
  if (score < 40) health = 'CRITICAL';
  else if (score < 70) health = 'WARNING';
  else health = 'HEALTHY';

  const healthConfig = {
    CRITICAL: { gradient: 'bg-gradient-to-r from-red-600 via-rose-600 to-red-700', shadow: 'shadow-lg shadow-red-500/20', icon: ShieldAlert, label: 'CRITICAL', sub: 'Immediate action required — cash flow at risk' },
    WARNING: { gradient: 'bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600', shadow: 'shadow-lg shadow-amber-500/20', icon: AlertTriangle, label: 'WARNING', sub: 'Attention needed — review cash flow' },
    HEALTHY: { gradient: 'bg-gradient-to-r from-emerald-600 via-green-600 to-emerald-700', shadow: 'shadow-lg shadow-emerald-500/20', icon: CheckCircle, label: 'HEALTHY', sub: 'Cash flow is stable' },
  } as const;
  // Always derive from score — never fall back to HEALTHY
  const hc = healthConfig[health];
  const HIcon = hc.icon;
  const cp = d.cashPosition || {};
  const ra = d.receivableAnalysis || {};
  const ea = d.expenseAnalysis || {};
  const ba = d.budgetAdherence || {};
  const ih = d.invoiceHealth || {};
  const gp = d.goalProgress || [];
  const ri = d.recurringImpact || {};
  const ts = d.trendSignals || {};
  const rm = d.riskMatrix || [];
  const ap = d.actionPlan || [];
  const mdd = d.monthlyDeepDive || [];

  return (
    <div className="space-y-6">
      {/* ─── Header ─── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-violet-100 to-purple-200/60 shadow-sm">
            <Brain className="w-4 h-4 text-violet-600" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-800 tracking-tight">AI Advisor — Full Portal Analysis</h2>
            <p className="text-[11px] text-slate-400 font-medium">Intelligence from {Object.keys(d).filter(k => d[k] !== null && d[k] !== undefined && typeof d[k] !== 'string' && !Array.isArray(d[k])).length} modules</p>
          </div>
        </div>
        <Button onClick={() => { fetchAdvisor(); onRefresh(); }} size="sm" className="h-8 text-xs gap-1.5 rounded-lg font-medium shadow-sm">
          <Sparkles className="w-3.5 h-3.5" /> Re-Analyze
        </Button>
      </div>

      {/* ═══ 1. HEALTH BANNER ═══ */}
      <div className={`relative overflow-hidden rounded-2xl ${hc.gradient} ${hc.shadow}`}>
        <div className="absolute inset-0 opacity-[0.07]">
          <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-white" />
          <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full bg-white" />
        </div>
        <div className="relative px-6 py-5">
          <div className="flex items-center gap-4">
            <div className="p-3.5 rounded-2xl bg-white/20 backdrop-blur-sm">
              <HIcon className="w-7 h-7 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-1">
                <h2 className="text-xl font-extrabold text-white">{hc.label}</h2>
                <span className="text-[11px] text-white/70 font-medium">{hc.sub}</span>
                <Badge className="text-[10px] font-bold px-2 py-0.5 bg-white/20 text-white border-0">{score}/100</Badge>
              </div>
              <div className="flex flex-wrap gap-x-5 gap-y-1">
                <span className="text-[11px] text-white/80 font-medium flex items-center gap-1.5">
                  <Banknote className="w-3 h-3" /> {formatPKRFull(cp.currentBalance || 0)}
                </span>
                <span className="text-[11px] text-white/80 font-medium flex items-center gap-1.5">
                  <Clock className="w-3 h-3" /> {cp.runwayMonths || 0}m runway
                </span>
                <span className="text-[11px] text-white/80 font-medium flex items-center gap-1.5">
                  {health === 'CRITICAL' || health === 'WARNING' ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />} Daily burn: {formatPKRFull(cp.dailyBurnRate || 0)}
                </span>
                {(cp.forecastClosing || 0) < 0 && (
                  <span className="text-[11px] text-red-200 font-medium flex items-center gap-1.5">
                    <TrendingDown className="w-3 h-3" /> Forecast: {formatPKRFull(cp.forecastClosing)}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ 2. EXECUTIVE SUMMARY (AI) ═══ */}
      {d.executiveSummary && (
        <Card className="shadow-md border-violet-200/60 bg-gradient-to-br from-violet-50/50 via-white to-purple-50/30">
          <CardHeader className="pb-2 px-6 pt-5">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-gradient-to-br from-violet-100 to-purple-200/60 shadow-sm">
                <Sparkles className="w-4 h-4 text-violet-600" />
              </div>
              <div>
                <CardTitle className="text-sm font-bold text-slate-800 tracking-tight">AI Executive Summary</CardTitle>
                <CardDescription className="text-[11px] text-slate-400 font-medium">Powered by AI — analysis of your complete portal</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-6 pb-5">
            <div className="prose prose-sm max-w-none text-[12px] text-slate-700 leading-relaxed whitespace-pre-wrap">
              {d.executiveSummary}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ═══ 3. CASH POSITION ═══ */}
      <Section icon={Banknote} title="Cash Position" desc="Current balance, runway, burn rate" defaultOpen={true} accent="from-emerald-100 to-green-200/60" accentShadow="shadow-emerald-200/40">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatMini label="Current Balance" value={formatPKRFull(cp.currentBalance || 0)} color={cp.currentBalance >= 0 ? 'text-emerald-700' : 'text-red-700'} />
          <StatMini label="Forecast Close" value={formatPKRFull(cp.forecastClosing || 0)} color={(cp.forecastClosing || 0) >= 0 ? 'text-emerald-700' : 'text-red-700'} />
          <StatMini label="Runway" value={`${cp.runwayMonths || 0} months`} sub="at avg monthly burn" />
          <StatMini label="Daily Burn" value={formatPKRFull(cp.dailyBurnRate || 0)} />
          <StatMini label="Working Capital" value={`${cp.workingCapitalRatio || 0}x`} sub="ratio vs 3m expenses" />
          <StatMini label="Net Cash Flow" value={formatPKRFull(cp.netCashFlow || 0)} color={(cp.netCashFlow || 0) >= 0 ? 'text-emerald-700' : 'text-red-700'} />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <StatMini label="Total Receipts" value={formatPKRFull(cp.totalRangeReceipts || 0)} sub="in selected period" />
          <StatMini label="Total Expenses" value={formatPKRFull(cp.totalRangeExpenses || 0)} sub="in selected period" />
        </div>
      </Section>

      {/* ═══ 4. RECEIVABLE ANALYSIS ═══ */}
      <Section icon={ArrowRight} title="Receivable Analysis" desc="Collections, aging, client follow-ups" defaultOpen={true} accent="from-orange-100 to-amber-200/60" accentShadow="shadow-orange-200/40">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <StatMini label="Collection Rate" value={`${ra.collectionRate || 0}%`} color={ra.collectionRate >= 80 ? 'text-emerald-700' : ra.collectionRate >= 50 ? 'text-amber-600' : 'text-red-600'} />
          <StatMini label="Pending" value={formatPKRFull(ra.totalExpected || 0)} />
          <StatMini label="Received" value={formatPKRFull(ra.totalReceived || 0)} color="text-emerald-700" />
          <StatMini label="Avg Collection" value={`${ra.averageCollectionPeriodDays || 0} days`} />
        </div>
        {/* Aging */}
        <div className="mb-4">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Receivables Aging</p>
          <div className="grid grid-cols-4 gap-2">
            {Object.entries(ra.agingBuckets || {}).map(([range, amt]: [string, number]) => {
              const total = Object.values(ra.agingBuckets || {}).reduce((s: number, v: any) => s + v, 0);
              const pct = total > 0 ? (amt / total) * 100 : 0;
              const color = range === '90+' ? 'from-red-400 to-red-500' : range === '61-90' ? 'from-orange-400 to-orange-500' : range === '31-60' ? 'from-amber-400 to-amber-500' : 'from-sky-400 to-sky-500';
              return (
                <div key={range} className="bg-slate-50 rounded-xl p-3 ring-1 ring-slate-200/60">
                  <p className="text-[10px] text-slate-500 font-medium">{range} days</p>
                  <p className="text-xs font-bold text-slate-800 mt-1">{formatPKRFull(amt)}</p>
                  <div className="h-1.5 bg-slate-200 rounded-full mt-2 overflow-hidden">
                    <div className={`h-full rounded-full bg-gradient-to-r ${color}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        {/* Top Clients */}
        {(ra.topPendingClients || []).length > 0 && (
          <div>
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Top Pending Clients</p>
            <div className="space-y-2">
              {(ra.topPendingClients || []).slice(0, 5).map((c: any, i: number) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-xl ring-1 ring-slate-200/60 bg-white/70 hover:shadow-sm transition-all">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-800 truncate">{c.client}</p>
                    {c.overdueMonths?.length > 0 && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className="text-[9px] text-red-500 font-medium">{c.overdueMonths.length} overdue</span>
                        {c.overdueMonths.slice(0, 2).map((m: string, j: number) => (
                          <Badge key={j} className="text-[8px] px-1 py-0 bg-red-50 text-red-600">{m}</Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <p className="text-sm font-bold text-red-700 font-mono">{formatPKR(c.pending)}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </Section>

      {/* ═══ 5. EXPENSE ANALYSIS ═══ */}
      <Section icon={BarChart3} title="Expense Analysis" desc="OPEX, project costs, anomalies" accent="from-rose-100 to-red-200/60" accentShadow="shadow-rose-200/40">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <StatMini label="Total Expenses" value={formatPKRFull(ea.totalExpenses || 0)} />
          <StatMini label="Operational" value={formatPKRFull(ea.totalOpex || 0)} sub={`${ea.opexPctOfTotal || 0}% of total`} />
          <StatMini label="Project Costs" value={formatPKRFull(ea.totalProjectCosts || 0)} />
          <StatMini label="Op Efficiency" value={`${((ea.operationalEfficiencyRatio || 0) * 100).toFixed(1)}%`} sub="OPEX / Revenue" />
        </div>
        {/* Trend */}
        <div className="flex items-center gap-2 mb-4 p-3 rounded-xl bg-slate-50 ring-1 ring-slate-200/60">
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Expense Trend:</span>
          {ea.expenseTrend === 'increasing' && <Badge className="bg-red-100/80 text-red-700 text-[10px]"><Flame className="w-3 h-3 mr-1" />Increasing</Badge>}
          {ea.expenseTrend === 'decreasing' && <Badge className="bg-emerald-100/80 text-emerald-700 text-[10px]"><Snowflake className="w-3 h-3 mr-1" />Decreasing</Badge>}
          {ea.expenseTrend === 'stable' && <Badge className="bg-sky-100/80 text-sky-700 text-[10px]"><Activity className="w-3 h-3 mr-1" />Stable</Badge>}
        </div>
        {/* Top Categories */}
        <div className="mb-4">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Top Spending Categories</p>
          {(ea.topCategories || []).slice(0, 7).map((c: any, i: number) => {
            const maxAmt = (ea.topCategories?.[0]?.amount || 1);
            return (
              <div key={i} className="flex items-center gap-3 mb-2">
                <span className="text-[11px] text-slate-600 font-medium w-32 truncate">{c.category}</span>
                <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-rose-400 to-red-500" style={{ width: `${(c.amount / maxAmt) * 100}%` }} />
                </div>
                <span className="text-[11px] font-bold text-slate-800 font-mono w-24 text-right">{formatPKR(c.amount)}</span>
              </div>
            );
          })}
        </div>
        {/* Anomalies */}
        {(ea.costAnomalies || []).length > 0 && (
          <div>
            <p className="text-[10px] font-semibold text-red-600 uppercase tracking-wider mb-2 flex items-center gap-1"><AlertOctagon className="w-3 h-3" /> Cost Anomalies</p>
            <div className="space-y-1.5">
              {(ea.costAnomalies || []).map((a: any, i: number) => (
                <div key={i} className="flex items-center gap-3 text-[11px] p-2 rounded-lg bg-red-50/50 ring-1 ring-red-200/40">
                  <span className="font-semibold text-slate-700">{a.month}</span>
                  <span className="text-red-600 font-bold">+{a.spikePct}%</span>
                  <span className="text-slate-500">vs avg of {formatPKRFull(a.average)}</span>
                  <span className="ml-auto font-bold text-slate-800">{formatPKRFull(a.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Section>

      {/* ═══ 6. BUDGET ADHERENCE ═══ */}
      <Section icon={Target} title="Budget Adherence" desc="Budget vs actual per category" accent="from-blue-100 to-indigo-200/60" accentShadow="shadow-blue-200/40">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <StatMini label="Overall Adherence" value={`${ba.overallAdherencePct || 0}%`} color={ba.overallAdherencePct >= 90 ? 'text-emerald-700' : ba.overallAdherencePct >= 70 ? 'text-amber-600' : 'text-red-600'} />
          <StatMini label="On Track" value={`${ba.onTrackCount || 0}`} color="text-emerald-700" />
          <StatMini label="Overspent" value={`${ba.overspentCount || 0}`} color="text-red-700" />
          <StatMini label="Caution" value={`${ba.cautionCount || 0}`} color="text-amber-600" />
        </div>
        <div className="space-y-2">
          {(ba.categories || []).map((b: any, i: number) => {
            const sc = STATUS_COLORS[b.status] || STATUS_COLORS['caution'];
            const pct = b.budgeted > 0 ? Math.min((b.actual / b.budgeted) * 100, 150) : 0;
            return (
              <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl ring-1 ring-slate-200/60 bg-white/70">
                <span className="text-[11px] font-semibold text-slate-700 w-28 truncate capitalize">{b.category}</span>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[9px] text-slate-400">{formatPKRFull(b.actual)} / {formatPKRFull(b.budgeted)}</span>
                    <span className={`text-[9px] font-bold ${b.variancePct >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{b.variancePct >= 0 ? '+' : ''}{b.variancePct}%</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${pct > 100 ? 'bg-red-400' : pct > 80 ? 'bg-amber-400' : 'bg-emerald-400'}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                  </div>
                </div>
                <Badge className={`text-[9px] px-1.5 py-0 ${sc.bg} border-0`}>{b.status}</Badge>
              </div>
            );
          })}
        </div>
        {(ba.mostOverspent || ba.mostUnderSpent) && (
          <div className="flex gap-3 mt-3">
            {ba.mostOverspent && (
              <div className="flex-1 p-3 rounded-xl bg-red-50/50 ring-1 ring-red-200/40">
                <p className="text-[9px] text-red-600 font-semibold uppercase">Most Overspent</p>
                <p className="text-[11px] font-bold text-slate-800 mt-0.5 capitalize">{ba.mostOverspent.category}</p>
                <p className="text-[10px] text-red-600">{ba.mostOverspent.variancePct}%</p>
              </div>
            )}
            {ba.mostUnderSpent && (
              <div className="flex-1 p-3 rounded-xl bg-emerald-50/50 ring-1 ring-emerald-200/40">
                <p className="text-[9px] text-emerald-600 font-semibold uppercase">Most Under-Spent</p>
                <p className="text-[11px] font-bold text-slate-800 mt-0.5 capitalize">{ba.mostUnderSpent.category}</p>
                <p className="text-[10px] text-emerald-600">+{ba.mostUnderSpent.variancePct}%</p>
              </div>
            )}
          </div>
        )}
      </Section>

      {/* ═══ 7. INVOICE HEALTH ═══ */}
      <Section icon={FileSpreadsheet} title="Invoice Health" desc="Outstanding, overdue, collections forecast" accent="from-cyan-100 to-teal-200/60" accentShadow="shadow-cyan-200/40">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <StatMini label="Outstanding" value={formatPKRFull(ih.totalOutstanding || 0)} />
          <StatMini label="Overdue" value={formatPKRFull(ih.totalOverdue || 0)} color="text-red-700" />
          <StatMini label="Cash Tied Up" value={formatPKRFull(ih.cashTiedUp || 0)} color="text-amber-600" />
          <StatMini label="Avg Days to Pay" value={`${ih.avgDaysToPay || 0}d`} />
        </div>
        <div className="mb-3">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Projected Collections</p>
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-emerald-50/50 rounded-xl p-3 ring-1 ring-emerald-200/40 text-center">
              <p className="text-[9px] text-emerald-600 font-semibold">Next 30 Days</p>
              <p className="text-sm font-extrabold text-emerald-700 mt-1">{formatPKR(ih.projectedCollectionsNext30Days || 0)}</p>
            </div>
            <div className="bg-sky-50/50 rounded-xl p-3 ring-1 ring-sky-200/40 text-center">
              <p className="text-[9px] text-sky-600 font-semibold">Next 60 Days</p>
              <p className="text-sm font-extrabold text-sky-700 mt-1">{formatPKR(ih.projectedCollectionsNext60Days || 0)}</p>
            </div>
            <div className="bg-purple-50/50 rounded-xl p-3 ring-1 ring-purple-200/40 text-center">
              <p className="text-[9px] text-purple-600 font-semibold">Next 90 Days</p>
              <p className="text-sm font-extrabold text-purple-700 mt-1">{formatPKR(ih.projectedCollectionsNext90Days || 0)}</p>
            </div>
          </div>
        </div>
      </Section>

      {/* ═══ 8. GOAL PROGRESS ═══ */}
      <Section icon={Target} title="Goal Progress" desc="Track financial goals and targets" accent="from-teal-100 to-cyan-200/60" accentShadow="shadow-teal-200/40">
        {gp.length === 0 ? (
          <p className="text-xs text-slate-400 py-4 text-center">No active goals set. Go to Goals tab to create targets.</p>
        ) : (
          <div className="space-y-3">
            {gp.map((g: any, i: number) => {
              const sc = STATUS_COLORS[g.status] || STATUS_COLORS['behind'];
              return (
                <div key={i} className="p-3.5 rounded-xl ring-1 ring-slate-200/60 bg-white/70">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-xs font-bold text-slate-800">{g.title}</p>
                      <p className="text-[9px] text-slate-400 mt-0.5">
                        {g.targetType} — Target: {g.targetDate} — {g.daysRemaining}d remaining
                        {g.isOverdue && <span className="text-red-600 font-semibold ml-1">OVERDUE</span>}
                      </p>
                    </div>
                    <Badge className={`text-[9px] px-1.5 py-0 ${sc.bg} border-0`}>{g.status}</Badge>
                  </div>
                  <div className="flex items-center gap-3">
                    <Progress value={Math.min(g.progress ?? 0, 100)} className="h-2 flex-1" />
                    <span className="text-[10px] font-bold text-slate-700 w-10 text-right">{(g.progress ?? 0).toFixed(0)}%</span>
                  </div>
                  <div className="flex justify-between mt-1.5 text-[9px] text-slate-400">
                    <span>Current: {formatPKRFull(g.currentAmount ?? 0)}</span>
                    <span>Target: {formatPKRFull(g.targetAmount ?? 0)}</span>
                    <span>Need: {formatPKRFull(g.requiredMonthlyContribution ?? 0)}/mo</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      {/* ═══ 9. RECURRING IMPACT ═══ */}
      <Section icon={Repeat} title="Recurring Expense Impact" desc="Fixed monthly commitments" accent="from-fuchsia-100 to-pink-200/60" accentShadow="shadow-fuchsia-200/40">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <StatMini label="Monthly Recurring" value={formatPKRFull(ri.totalMonthlyRecurring || 0)} />
          <StatMini label="Yearly Recurring" value={formatPKRFull(ri.totalYearlyRecurring || 0)} />
          <StatMini label="% of Avg Expenses" value={`${ri.recurringPctOfAvgExpenses || 0}%`} color={ri.recurringPctOfAvgExpenses > 70 ? 'text-red-600' : 'text-slate-800'} />
          <StatMini label="6-Month Projection" value={formatPKRFull(ri.projectedRecurring6Months || 0)} />
        </div>
        {(ri.largestItems || []).length > 0 && (
          <div>
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Top Recurring Items</p>
            <div className="space-y-1.5">
              {(ri.largestItems || []).map((item: any, i: number) => (
                <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-slate-50 ring-1 ring-slate-200/50">
                  <span className="text-[11px] font-medium text-slate-700 flex-1">{item.title}</span>
                  <Badge className="text-[8px] px-1.5 py-0 bg-slate-100 text-slate-600">{item.frequency}</Badge>
                  <span className="text-[11px] font-bold text-slate-800 font-mono">{formatPKR(item.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Section>

      {/* ═══ 10. TREND SIGNALS ═══ */}
      <Section icon={Activity} title="Trend Signals" desc="3-month and 6-month movement patterns" accent="from-indigo-100 to-violet-200/60" accentShadow="shadow-indigo-200/40">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div className="bg-slate-50 rounded-xl p-3 ring-1 ring-slate-200/60">
            <p className="text-[9px] text-slate-500 font-semibold">3M Receipt Trend</p>
            <p className={`text-sm font-extrabold ${(ts.threeMonth?.receiptTrendPct || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {(ts.threeMonth?.receiptTrendPct || 0) >= 0 ? '+' : ''}{ts.threeMonth?.receiptTrendPct || 0}%
            </p>
          </div>
          <div className="bg-slate-50 rounded-xl p-3 ring-1 ring-slate-200/60">
            <p className="text-[9px] text-slate-500 font-semibold">3M Expense Trend</p>
            <p className={`text-sm font-extrabold ${(ts.threeMonth?.expenseTrendPct || 0) >= 0 ? 'text-red-600' : 'text-emerald-600'}`}>
              {(ts.threeMonth?.expenseTrendPct || 0) >= 0 ? '+' : ''}{ts.threeMonth?.expenseTrendPct || 0}%
            </p>
          </div>
          <div className="bg-slate-50 rounded-xl p-3 ring-1 ring-slate-200/60">
            <p className="text-[9px] text-slate-500 font-semibold">Burn Trajectory</p>
            <Badge className={`text-[10px] mt-1 ${ts.burnTrajectory === 'accelerating' ? 'bg-red-100/80 text-red-700' : ts.burnTrajectory === 'decelerating' ? 'bg-emerald-100/80 text-emerald-700' : 'bg-sky-100/80 text-sky-700'}`}>
              {ts.burnTrajectory || 'stable'}
            </Badge>
          </div>
          <div className="bg-slate-50 rounded-xl p-3 ring-1 ring-slate-200/60">
            <p className="text-[9px] text-slate-500 font-semibold">Best Month</p>
            <p className="text-[11px] font-bold text-emerald-600">{ts.bestMonth?.month || 'N/A'}</p>
            <p className="text-[9px] text-slate-400">{formatPKRFull(ts.bestMonth?.netCashFlow || 0)}</p>
          </div>
        </div>
        {/* Seasonal */}
        {(ts.seasonalPatterns || []).length > 0 && (
          <div>
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Seasonal Patterns</p>
            <div className="grid grid-cols-4 gap-2">
              {(ts.seasonalPatterns || []).map((q: any, i: number) => (
                <div key={i} className="bg-gradient-to-br from-slate-50 to-white rounded-xl p-3 ring-1 ring-slate-200/60 text-center">
                  <p className="text-[11px] font-bold text-slate-700">{q.quarter}</p>
                  <p className="text-[9px] text-emerald-600 mt-1">In: {formatPKR(q.avgReceipts)}</p>
                  <p className="text-[9px] text-red-500">Out: {formatPKR(q.avgExpenses)}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </Section>

      {/* ═══ 11. RISK MATRIX ═══ */}
      <Section icon={AlertOctagon} title="Risk Matrix" desc={`${rm.length} identified risk(s)`} defaultOpen={rm.length > 0} accent="from-red-100 to-rose-200/60" accentShadow="shadow-red-200/40">
        {rm.length === 0 ? (
          <div className="text-center py-4">
            <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
            <p className="text-xs text-slate-500 font-medium">No significant risks detected</p>
          </div>
        ) : (
          <div className="space-y-3">
            {rm.map((r: any, i: number) => {
              const sv = SEV[r.severity] || SEV.medium;
              return (
                <div key={i} className={`rounded-xl ring-1 ${sv.border} ${sv.bg} p-4`}>
                  <div className="flex items-start gap-3">
                    <div className={`p-1.5 rounded-lg bg-white/80 shadow-sm flex-shrink-0`}>
                      {r.severity === 'critical' ? <ShieldAlert className={`w-4 h-4 ${sv.icon}`} /> :
                       r.severity === 'high' ? <AlertTriangle className={`w-4 h-4 ${sv.icon}`} /> :
                       <Info className={`w-4 h-4 ${sv.icon}`} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-xs font-bold text-slate-800">{r.title}</h4>
                        <Badge className={`text-[9px] px-1.5 py-0 ${sv.bg} ${sv.text} border ${sv.border} font-semibold`}>{r.severity}</Badge>
                        <Badge className="text-[9px] px-1.5 py-0 bg-slate-100 text-slate-600">Impact: {formatPKRFull(r.impact)}</Badge>
                        <Badge className="text-[9px] px-1.5 py-0 bg-white/80 text-slate-500">Prob: {r.probability}</Badge>
                      </div>
                      <p className="text-[11px] text-slate-600 mt-1">{r.description}</p>
                      <div className="mt-2">
                        <p className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Mitigation Steps</p>
                        <ul className="space-y-0.5">
                          {(r.mitigationSteps || []).map((step: string, j: number) => (
                            <li key={j} className="text-[10px] text-slate-600 flex items-start gap-1.5">
                              <span className="mt-1.5 w-1 h-1 rounded-full bg-slate-400 flex-shrink-0" />
                              {step}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      {/* ═══ 12. ACTION PLAN ═══ */}
      <Section icon={Rocket} title="Action Plan" desc={`${ap.length} prioritized action(s)`} defaultOpen={ap.length > 0} accent="from-amber-100 to-orange-200/60" accentShadow="shadow-amber-200/40">
        {ap.length === 0 ? (
          <div className="text-center py-4">
            <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
            <p className="text-xs text-slate-500 font-medium">Everything looks good! No actions needed right now.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {ap.map((a: any, i: number) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl ring-1 ring-slate-200/60 bg-white/70 hover:shadow-sm transition-all">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-[11px] font-extrabold ${i < 2 ? 'bg-red-100 text-red-700' : i < 4 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                  #{a.priority}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-800">{a.title}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-1">{a.description}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Badge className={`text-[9px] px-1.5 py-0 ${EFFORT_COLORS[a.effort || 'medium']}`}>{a.effort}</Badge>
                  <Badge className="text-[9px] px-1.5 py-0 bg-slate-100 text-slate-600 flex items-center gap-1">
                    <Timer className="w-2.5 h-2.5" /> {a.deadline}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* ═══ 13. MONTHLY DEEP DIVE ═══ */}
      <Section icon={CalendarClock} title="Monthly Deep Dive" desc={`${mdd.length} months analyzed in detail`} accent="from-slate-100 to-slate-200/60" accentShadow="shadow-slate-200/40">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {mdd.map((m: any, i: number) => (
            <div key={i} className={`rounded-xl p-4 ring-1 shadow-sm ${m.status === 'critical' ? 'ring-red-200/60 bg-red-50/30' : m.status === 'warning' ? 'ring-amber-200/60 bg-amber-50/30' : 'ring-slate-200/60 bg-white/70'}`}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold text-slate-800">{m.month}</p>
                <Badge className={`text-[8px] px-1.5 py-0 ${m.status === 'critical' ? 'bg-red-100 text-red-700' : m.status === 'warning' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>{m.status}</Badge>
              </div>
              <div className="space-y-1 text-[10px] text-slate-600">
                <div className="flex justify-between"><span>Opening</span><span className="font-mono font-medium">{formatPKR(m.openingBalance || 0)}</span></div>
                <div className="flex justify-between"><span>Receipts</span><span className="font-mono font-medium text-emerald-600">+{formatPKR(m.totalReceipts || 0)}</span></div>
                <div className="flex justify-between"><span>Expenses</span><span className="font-mono font-medium text-red-600">-{formatPKR(m.totalExpenses || 0)}</span></div>
                <div className="flex justify-between border-t border-slate-100 pt-1"><span className="font-semibold">Closing</span><span className={`font-mono font-bold ${(m.closingBalance || 0) >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{formatPKR(m.closingBalance || 0)}</span></div>
              </div>
              {(m.receiptSources?.length > 0 || m.topExpenseCategories?.length > 0) && (
                <div className="mt-2 pt-2 border-t border-slate-100 space-y-1">
                  {m.receiptSources?.slice(0, 2).map((s: any, j: number) => (
                    <p key={j} className="text-[9px] text-slate-400 truncate">+ {formatPKR(s.amount)} — {s.source}</p>
                  ))}
                  {m.recommendations?.length > 0 && (
                    <p className="text-[9px] text-violet-600 font-medium mt-1">{m.recommendations[0]}</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}
