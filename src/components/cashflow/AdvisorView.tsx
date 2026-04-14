'use client';

import React, { useState, Suspense } from 'react';
import {
  ShieldAlert, AlertTriangle, CheckCircle, Info, Lightbulb,
  Clock, TrendingDown, TrendingUp, Users, CalendarClock,
  ChevronDown, ChevronUp, X, Sparkles, ArrowRight,
  Banknote, BarChart3, CircleDot, Zap
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { formatPKR, formatPKRFull, formatCompact } from '@/lib/format';

interface AdvisorViewProps {
  data: any;
  startDate: string;
  endDate: string;
  onRefresh: () => void;
}

/* ─── Type → icon / color mapping ─── */
const TYPE_CONFIG: Record<string, { icon: React.ElementType; border: string; bg: string; iconBg: string; iconColor: string; badge: string; badgeText: string }> = {
  critical: {
    icon: ShieldAlert,
    border: 'border-l-red-500',
    bg: 'bg-gradient-to-r from-red-50/70 via-white to-red-50/30',
    iconBg: 'bg-gradient-to-br from-red-100 to-red-200/60',
    iconColor: 'text-red-600',
    badge: 'bg-red-100/80 text-red-700 border-red-200/70',
    badgeText: 'text-red-700',
  },
  warning: {
    icon: AlertTriangle,
    border: 'border-l-amber-500',
    bg: 'bg-gradient-to-r from-amber-50/70 via-white to-amber-50/30',
    iconBg: 'bg-gradient-to-br from-amber-100 to-amber-200/60',
    iconColor: 'text-amber-600',
    badge: 'bg-amber-100/80 text-amber-700 border-amber-200/70',
    badgeText: 'text-amber-700',
  },
  actionable: {
    icon: Zap,
    border: 'border-l-orange-500',
    bg: 'bg-gradient-to-r from-orange-50/70 via-white to-orange-50/30',
    iconBg: 'bg-gradient-to-br from-orange-100 to-orange-200/60',
    iconColor: 'text-orange-600',
    badge: 'bg-orange-100/80 text-orange-700 border-orange-200/70',
    badgeText: 'text-orange-700',
  },
  suggestion: {
    icon: Lightbulb,
    border: 'border-l-purple-500',
    bg: 'bg-gradient-to-r from-purple-50/70 via-white to-purple-50/30',
    iconBg: 'bg-gradient-to-br from-purple-100 to-purple-200/60',
    iconColor: 'text-purple-600',
    badge: 'bg-purple-100/80 text-purple-700 border-purple-200/70',
    badgeText: 'text-purple-700',
  },
  success: {
    icon: CheckCircle,
    border: 'border-l-emerald-500',
    bg: 'bg-gradient-to-r from-emerald-50/70 via-white to-emerald-50/30',
    iconBg: 'bg-gradient-to-br from-emerald-100 to-emerald-200/60',
    iconColor: 'text-emerald-600',
    badge: 'bg-emerald-100/80 text-emerald-700 border-emerald-200/70',
    badgeText: 'text-emerald-700',
  },
  info: {
    icon: Info,
    border: 'border-l-sky-500',
    bg: 'bg-gradient-to-r from-sky-50/70 via-white to-sky-50/30',
    iconBg: 'bg-gradient-to-br from-sky-100 to-sky-200/60',
    iconColor: 'text-sky-600',
    badge: 'bg-sky-100/80 text-sky-700 border-sky-200/70',
    badgeText: 'text-sky-700',
  },
};

/* ─── Priority badge helper ─── */
function PriorityBadge({ priority }: { priority: number }) {
  const config = priority <= 1
    ? { label: 'Critical', cls: 'bg-red-100/80 text-red-700 border-red-200/70' }
    : priority <= 2
    ? { label: 'High', cls: 'bg-orange-100/80 text-orange-700 border-orange-200/70' }
    : priority <= 3
    ? { label: 'Medium', cls: 'bg-amber-100/80 text-amber-700 border-amber-200/70' }
    : { label: 'Low', cls: 'bg-slate-100/80 text-slate-600 border-slate-200/70' };
  return (
    <Badge className={`text-[9px] px-2 py-0.5 font-semibold shadow-sm ${config.cls}`}>
      {config.label}
    </Badge>
  );
}

/* ─── Recommendation Card ─── */
function RecommendationCard({ rec }: { rec: any }) {
  const [expanded, setExpanded] = useState(false);
  const [checkedItems, setCheckedItems] = useState<Record<number, boolean>>({});
  const type = rec.type === 'actionable' ? 'actionable' : rec.type;
  const cfg = TYPE_CONFIG[type] || TYPE_CONFIG.info;
  const Icon = cfg.icon;

  return (
    <div
      className={`border-l-4 ${cfg.border} ${cfg.bg} rounded-xl ring-1 ring-slate-200/60 shadow-sm hover:shadow-md transition-all duration-300`}
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-xl ${cfg.iconBg} shadow-sm flex-shrink-0 mt-0.5`}>
            <Icon className={`w-4 h-4 ${cfg.iconColor}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h4 className="text-sm font-bold text-slate-800 tracking-tight leading-tight">{rec.title}</h4>
              <PriorityBadge priority={rec.priority} />
            </div>
            <p className="text-[11px] text-slate-500 font-medium leading-relaxed">{rec.message}</p>

            {rec.actions && rec.actions.length > 0 && (
              <div className="mt-2.5">
                <button
                  onClick={() => setExpanded(!expanded)}
                  className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 hover:text-slate-700 transition-colors duration-200"
                >
                  {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  {expanded ? 'Hide' : 'Show'} {rec.actions.length} action{rec.actions.length > 1 ? 's' : ''}
                </button>
                {expanded && (
                  <div className="mt-2 space-y-1.5 animate-fade-in">
                    {rec.actions.map((action: string, i: number) => (
                      <label
                        key={i}
                        className="flex items-start gap-2.5 cursor-pointer group p-2 rounded-lg hover:bg-white/60 transition-colors duration-150"
                      >
                        <Checkbox
                          checked={!!checkedItems[i]}
                          onCheckedChange={(checked) =>
                            setCheckedItems(prev => ({ ...prev, [i]: !!checked }))
                          }
                          className="mt-0.5"
                        />
                        <span className={`text-[11px] leading-relaxed transition-colors duration-200 ${checkedItems[i] ? 'text-slate-400 line-through' : 'text-slate-600 group-hover:text-slate-800'}`}>
                          {action}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Urgency Badge ─── */
function UrgencyBadge({ urgency }: { urgency: string }) {
  const config: Record<string, { label: string; cls: string }> = {
    critical: { label: 'Critical', cls: 'bg-red-100/80 text-red-700 border-red-200/70' },
    high: { label: 'High', cls: 'bg-orange-100/80 text-orange-700 border-orange-200/70' },
    medium: { label: 'Medium', cls: 'bg-amber-100/80 text-amber-700 border-amber-200/70' },
    low: { label: 'Low', cls: 'bg-slate-100/80 text-slate-600 border-slate-200/70' },
  };
  const c = config[urgency] || config.low;
  return <Badge className={`text-[9px] px-2 py-0.5 font-semibold shadow-sm ${c.cls}`}>{c.label}</Badge>;
}

/* ─── Main AdvisorView ─── */
export default function AdvisorView({ data, startDate, endDate, onRefresh }: AdvisorViewProps) {
  const [scenarioSortAsc, setScenarioSortAsc] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Defensive defaults
  const overallHealth = data?.overallHealth ?? 'HEALTHY';
  const cashRunwayMonths = data?.cashRunwayMonths ?? 0;
  const currentBalance = data?.currentBalance ?? 0;
  const forecastClosing = data?.forecastClosing ?? 0;
  const avgMonthlyExpenses = data?.avgMonthlyExpenses ?? 0;
  const totalDeficitMonths = data?.totalDeficitMonths ?? 0;
  const totalLowCashMonths = data?.totalLowCashMonths ?? 0;
  const recommendations = data?.recommendations ?? [];
  const paymentScenarios = data?.paymentScenarios ?? [];
  const expensePostponement = data?.expensePostponement ?? [];
  const clientFollowUps = data?.clientFollowUps ?? [];
  const monthlyInsights = data?.monthlyInsights ?? [];

  const sortedScenarios = [...paymentScenarios].sort((a, b) =>
    scenarioSortAsc ? a.amount - b.amount : b.amount - a.amount
  );

  const handleRefresh = async () => {
    setIsRefreshing(true);
    onRefresh();
    setTimeout(() => setIsRefreshing(false), 1500);
  };

  // Health config
  const healthConfig: Record<string, { icon: React.ElementType; gradient: string; ring: string; iconBg: string; iconColor: string; label: string; sublabel: string; shadow: string }> = {
    CRITICAL: {
      icon: ShieldAlert,
      gradient: 'bg-gradient-to-r from-red-600 via-rose-600 to-red-700',
      ring: 'ring-red-400/40',
      iconBg: 'bg-white/20',
      iconColor: 'text-white',
      label: 'CRITICAL',
      sublabel: 'Immediate action required',
      shadow: 'shadow-lg shadow-red-500/20',
    },
    WARNING: {
      icon: AlertTriangle,
      gradient: 'bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600',
      ring: 'ring-amber-400/40',
      iconBg: 'bg-white/20',
      iconColor: 'text-white',
      label: 'WARNING',
      sublabel: 'Attention needed',
      shadow: 'shadow-lg shadow-amber-500/20',
    },
    HEALTHY: {
      icon: CheckCircle,
      gradient: 'bg-gradient-to-r from-emerald-600 via-green-600 to-emerald-700',
      ring: 'ring-emerald-400/40',
      iconBg: 'bg-white/20',
      iconColor: 'text-white',
      label: 'HEALTHY',
      sublabel: 'Cash flow is stable',
      shadow: 'shadow-lg shadow-emerald-500/20',
    },
  };

  const health = healthConfig[overallHealth] || healthConfig.HEALTHY;
  const HealthIcon = health.icon;

  // Runway percentage (max 12 months = 100%)
  const runwayPct = Math.min((cashRunwayMonths / 12) * 100, 100);
  const runwayColor = cashRunwayMonths >= 6 ? 'from-emerald-400 to-emerald-600' : cashRunwayMonths >= 3 ? 'from-amber-400 to-amber-600' : 'from-red-400 to-red-600';

  // Status indicator for monthly insights
  const statusConfig: Record<string, { label: string; cls: string; dot: string }> = {
    critical: { label: 'Deficit', cls: 'bg-red-100/80 text-red-700 border-red-200/70', dot: 'bg-red-500' },
    warning: { label: 'Warning', cls: 'bg-amber-100/80 text-amber-700 border-amber-200/70', dot: 'bg-amber-500' },
    healthy: { label: 'Healthy', cls: 'bg-emerald-100/80 text-emerald-700 border-emerald-200/70', dot: 'bg-emerald-500' },
  };

  return (
    <div className="space-y-7">
      {/* ─── Generate Insights Button ─── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-violet-100 to-purple-200/60 shadow-sm shadow-purple-200/40">
            <Sparkles className="w-4 h-4 text-violet-600" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-800 tracking-tight">Smart Advisor</h2>
            <p className="text-[11px] text-slate-400 font-medium">AI-powered cash flow insights & recommendations</p>
          </div>
        </div>
        <Button
          onClick={handleRefresh}
          disabled={isRefreshing}
          size="sm"
          className="h-8 text-xs gap-1.5 rounded-lg font-medium shadow-sm"
        >
          {isRefreshing ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5" />
              Generate Insights
            </>
          )}
        </Button>
      </div>

      {/* ═══ a) Overall Health Banner ═══ */}
      <div
        className={`relative overflow-hidden rounded-2xl ${health.gradient} ${health.shadow} ring-1 ${health.ring}`}
      >
        {/* Decorative pattern */}
        <div className="absolute inset-0 opacity-[0.07]">
          <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-white" />
          <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full bg-white" />
          <div className="absolute top-1/2 right-1/4 w-20 h-20 rounded-full bg-white" />
        </div>

        <div className="relative px-6 py-6">
          <div className="flex items-center gap-4">
            <div className={`p-3.5 rounded-2xl ${health.iconBg} backdrop-blur-sm`}>
              <HealthIcon className={`w-7 h-7 ${health.iconColor}`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-1.5">
                <h2 className="text-xl font-extrabold text-white tracking-tight">{health.label}</h2>
                <span className="text-[11px] font-medium text-white/70">{health.sublabel}</span>
              </div>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-white/70" />
                  <span className="text-[11px] text-white/90 font-semibold">
                    {cashRunwayMonths} month{cashRunwayMonths !== 1 ? 's' : ''} runway
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Banknote className="w-3.5 h-3.5 text-white/70" />
                  <span className="text-[11px] text-white/90 font-semibold">
                    Balance: {formatPKRFull(currentBalance)}
                  </span>
                </div>
                {totalDeficitMonths > 0 && (
                  <div className="flex items-center gap-1.5">
                    <TrendingDown className="w-3.5 h-3.5 text-red-200" />
                    <span className="text-[11px] text-red-100 font-semibold">
                      {totalDeficitMonths} deficit month{totalDeficitMonths !== 1 ? 's' : ''}
                    </span>
                  </div>
                )}
                {totalLowCashMonths > 0 && (
                  <div className="flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-200" />
                    <span className="text-[11px] text-amber-100 font-semibold">
                      {totalLowCashMonths} low-cash month{totalLowCashMonths !== 1 ? 's' : ''}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ b) Cash Runway Card ═══ */}
      <Card className="shadow-md border-slate-200/60 hover:shadow-lg transition-shadow duration-300">
        <CardHeader className="pb-2 px-6 pt-5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-gradient-to-br from-sky-100 to-blue-200/60 shadow-sm shadow-sky-200/40">
              <Clock className="w-4 h-4 text-sky-600" />
            </div>
            <div>
              <CardTitle className="text-sm font-bold text-slate-800 tracking-tight">Cash Runway</CardTitle>
              <CardDescription className="text-[11px] text-slate-400 font-medium">
                How long current balance can sustain operations
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-6 pb-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Runway display */}
            <div className="md:col-span-2">
              <div className="flex items-end gap-2 mb-3">
                <span className="text-3xl font-extrabold text-slate-800 tracking-tight">{cashRunwayMonths}</span>
                <span className="text-sm font-semibold text-slate-400 mb-1">of 12 months</span>
                <div className="ml-auto flex items-center gap-1.5">
                  <span className="text-[10px] text-slate-400 font-medium">Avg. monthly burn: {formatPKRFull(avgMonthlyExpenses)}</span>
                </div>
              </div>
              <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full bg-gradient-to-r ${runwayColor} transition-all duration-700 ease-out`}
                  style={{ width: `${runwayPct}%` }}
                />
              </div>
              {/* Month markers */}
              <div className="flex justify-between mt-1.5 px-0.5">
                {[0, 3, 6, 9, 12].map(m => (
                  <span key={m} className="text-[9px] text-slate-300 font-medium">{m}m</span>
                ))}
              </div>
            </div>
            {/* Stats */}
            <div className="space-y-2.5">
              <div className="bg-gradient-to-br from-slate-50 to-white rounded-xl p-3.5 ring-1 ring-slate-200/60 shadow-sm">
                <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Current Balance</p>
                <p className={`text-base font-extrabold tracking-tight mt-0.5 ${currentBalance >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                  {formatPKRFull(currentBalance)}
                </p>
              </div>
              <div className="bg-gradient-to-br from-slate-50 to-white rounded-xl p-3.5 ring-1 ring-slate-200/60 shadow-sm">
                <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Forecast Close</p>
                <p className={`text-base font-extrabold tracking-tight mt-0.5 ${forecastClosing >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                  {formatPKRFull(forecastClosing)}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ═══ c) Smart Recommendations ═══ */}
      {recommendations.length > 0 && (
        <div>
          <div className="flex items-center gap-2.5 mb-4">
            <div className="p-2 rounded-xl bg-gradient-to-br from-amber-100 to-orange-200/60 shadow-sm shadow-amber-200/40">
              <Lightbulb className="w-4 h-4 text-amber-600" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800 tracking-tight">Smart Recommendations</h3>
              <p className="text-[11px] text-slate-400 font-medium">{recommendations.length} actionable insight{recommendations.length !== 1 ? 's' : ''} for your cash flow</p>
            </div>
          </div>
          <div className="space-y-3">
            {recommendations.map((rec: any, i: number) => (
              <div key={i} className="animate-fade-in" style={{ animationDelay: `${i * 80}ms`, animationFillMode: 'both' }}>
                <RecommendationCard rec={rec} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ d) Payment Scenarios Table ═══ */}
      {sortedScenarios.length > 0 && (
        <Card className="shadow-md border-slate-200/60 hover:shadow-lg transition-shadow duration-300">
          <CardHeader className="pb-2 px-6 pt-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-100 to-green-200/60 shadow-sm shadow-emerald-200/40">
                  <ArrowRight className="w-4 h-4 text-emerald-600" />
                </div>
                <div>
                  <CardTitle className="text-sm font-bold text-slate-800 tracking-tight">Payment Scenarios</CardTitle>
                  <CardDescription className="text-[11px] text-slate-400 font-medium">
                    Impact if each expected payment is received
                  </CardDescription>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setScenarioSortAsc(!scenarioSortAsc)}
                className="h-7 text-[10px] gap-1 rounded-lg font-medium"
              >
                <BarChart3 className="w-3 h-3" />
                {scenarioSortAsc ? 'Amount ↑' : 'Amount ↓'}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="px-6 pb-5">
            <div className="overflow-x-auto custom-scrollbar rounded-xl ring-1 ring-slate-200/70">
              <table className="w-full text-[11px] border-collapse">
                <thead>
                  <tr className="bg-gradient-to-r from-slate-50 to-slate-100/80 border-b border-slate-200/60">
                    <th className="text-left p-3 font-bold text-slate-600">Client</th>
                    <th className="text-right p-3 font-bold text-slate-600">Amount</th>
                    <th className="text-left p-3 font-bold text-slate-600">Month</th>
                    <th className="text-right p-3 font-bold text-slate-600">Current Balance</th>
                    <th className="text-right p-3 font-bold text-emerald-700">If Received</th>
                    <th className="text-center p-3 font-bold text-slate-600">Months Covered</th>
                    <th className="text-center p-3 font-bold text-slate-600 w-16">Priority</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedScenarios.map((s: any, i: number) => (
                    <tr
                      key={i}
                      className={`border-b border-slate-100/80 transition-colors duration-150 ${
                        s.improvesDeficit
                          ? 'bg-emerald-50/50 hover:bg-emerald-50/80'
                          : i % 2 === 0 ? 'bg-white hover:bg-slate-50/60' : 'bg-slate-50/40 hover:bg-slate-100/50'
                      }`}
                    >
                      <td className="p-3 font-semibold text-slate-700 max-w-[180px] truncate">{s.client}</td>
                      <td className="text-right p-3 font-mono tabular-nums text-slate-800 font-bold">{formatPKR(s.amount)}</td>
                      <td className="p-3 text-slate-600 font-medium">{s.expectedMonth}</td>
                      <td className={`text-right p-3 font-mono tabular-nums font-medium ${s.currentMonthBalance < 0 ? 'text-red-700' : 'text-slate-600'}`}>
                        {formatPKR(s.currentMonthBalance)}
                      </td>
                      <td className="text-right p-3 font-mono tabular-nums text-emerald-700 font-bold">
                        {formatPKR(s.ifReceived)}
                        {s.improvesDeficit && (
                          <span className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" title="Eliminates deficit" />
                        )}
                      </td>
                      <td className="text-center p-3">
                        <Badge className={`text-[9px] px-2 py-0.5 font-semibold shadow-sm ${
                          s.monthsCovered >= 3 ? 'bg-emerald-100/80 text-emerald-700 border-emerald-200/70' :
                          s.monthsCovered >= 1 ? 'bg-sky-100/80 text-sky-700 border-sky-200/70' :
                          'bg-slate-100/80 text-slate-600 border-slate-200/70'
                        }`}>
                          {s.monthsCovered}m
                        </Badge>
                      </td>
                      <td className="text-center p-3">
                        <Badge className={`text-[9px] px-2 py-0.5 font-semibold shadow-sm ${
                          s.priority === 'high' ? 'bg-red-100/80 text-red-700 border-red-200/70' :
                          s.priority === 'medium' ? 'bg-amber-100/80 text-amber-700 border-amber-200/70' :
                          'bg-slate-100/80 text-slate-600 border-slate-200/70'
                        }`}>
                          {s.priority}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {sortedScenarios.some((s: any) => s.improvesDeficit) && (
              <div className="flex items-center gap-2 mt-3 px-1">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-[10px] text-slate-400 font-medium">Highlighted rows show payments that would eliminate deficit months</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ═══ e) Client Follow-ups ═══ */}
      {clientFollowUps.length > 0 && (
        <Card className="shadow-md border-slate-200/60 hover:shadow-lg transition-shadow duration-300">
          <CardHeader className="pb-2 px-6 pt-5">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-gradient-to-br from-orange-100 to-red-200/60 shadow-sm shadow-orange-200/40">
                <Users className="w-4 h-4 text-orange-600" />
              </div>
              <div>
                <CardTitle className="text-sm font-bold text-slate-800 tracking-tight">Client Follow-ups</CardTitle>
                <CardDescription className="text-[11px] text-slate-400 font-medium">
                  {clientFollowUps.length} client{clientFollowUps.length !== 1 ? 's' : ''} requiring attention, sorted by urgency
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-6 pb-5">
            <div className="space-y-2.5 max-h-96 overflow-y-auto custom-scrollbar pr-1">
              {clientFollowUps.map((c: any, i: number) => (
                <div
                  key={i}
                  className="flex items-center gap-3 p-3.5 rounded-xl ring-1 ring-slate-200/60 bg-white/70 hover:shadow-md transition-all duration-200 hover:-translate-y-0.5"
                >
                  <div className={`flex-shrink-0 p-2 rounded-lg ${
                    c.urgency === 'critical' ? 'bg-red-100/80' : c.urgency === 'high' ? 'bg-orange-100/80' : 'bg-amber-100/80'
                  }`}>
                    {c.urgency === 'critical' ? (
                      <ShieldAlert className="w-3.5 h-3.5 text-red-600" />
                    ) : c.urgency === 'high' ? (
                      <AlertTriangle className="w-3.5 h-3.5 text-orange-600" />
                    ) : (
                      <CalendarClock className="w-3.5 h-3.5 text-amber-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-bold text-slate-800 truncate">{c.client}</p>
                      <UrgencyBadge urgency={c.urgency} />
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-[10px] text-slate-400 font-medium">
                        Expected: <span className="text-slate-600 font-semibold">{formatPKR(c.totalExpected)}</span>
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">
                        Pending: <span className="text-red-600 font-semibold">{formatPKR(c.pendingAmount)}</span>
                      </span>
                    </div>
                    {c.overdueMonths.length > 0 && (
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        <span className="text-[9px] text-slate-400 font-medium">Overdue:</span>
                        {c.overdueMonths.map((m: string, j: number) => (
                          <Badge key={j} className="text-[8px] px-1.5 py-0 bg-red-50 text-red-600 border-red-200/60 font-mono">
                            {m}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={`text-sm font-bold font-mono tabular-nums ${c.pendingAmount > 500000 ? 'text-red-700' : 'text-slate-700'}`}>
                      {formatPKR(c.pendingAmount)}
                    </p>
                    <p className="text-[9px] text-slate-400 font-medium mt-0.5">{c.overdueMonths.length} overdue</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ═══ f) Expense Postponement ═══ */}
      {expensePostponement.length > 0 && (
        <Card className="ring-1 ring-orange-200/70 bg-gradient-to-br from-orange-50/50 via-white to-amber-50/30 shadow-md hover:shadow-lg transition-shadow duration-300">
          <CardHeader className="pb-2 px-6 pt-5">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-gradient-to-br from-orange-100 to-amber-200/60 shadow-sm shadow-orange-200/40">
                <CalendarClock className="w-4 h-4 text-orange-600" />
              </div>
              <div>
                <CardTitle className="text-sm font-bold text-slate-800 tracking-tight">Expense Postponement</CardTitle>
                <CardDescription className="text-[11px] text-orange-600/80 font-medium">
                  Suggested deferrals to improve cash position
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-6 pb-5">
            <div className="overflow-x-auto custom-scrollbar rounded-xl ring-1 ring-slate-200/70">
              <table className="w-full text-[11px] border-collapse">
                <thead>
                  <tr className="bg-gradient-to-r from-slate-50 to-slate-100/80 border-b border-slate-200/60">
                    <th className="text-left p-3 font-bold text-slate-600">Month</th>
                    <th className="text-left p-3 font-bold text-slate-600">Category</th>
                    <th className="text-left p-3 font-bold text-slate-600">Project</th>
                    <th className="text-right p-3 font-bold text-red-700">Amount</th>
                    <th className="text-right p-3 font-bold text-emerald-700">New Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {expensePostponement.map((e: any, i: number) => (
                    <tr
                      key={i}
                      className={`border-b border-slate-100/80 transition-colors duration-150 ${
                        i % 2 === 0 ? 'bg-white/80 hover:bg-emerald-50/40' : 'bg-slate-50/40 hover:bg-emerald-50/40'
                      }`}
                    >
                      <td className="p-3 font-semibold text-slate-700">{e.month}</td>
                      <td className="p-3 text-slate-600 font-medium">{e.category}</td>
                      <td className="p-3 text-slate-500 font-medium max-w-[150px] truncate">{e.project}</td>
                      <td className="text-right p-3 font-mono tabular-nums text-red-700 font-medium">{formatPKR(e.amount)}</td>
                      <td className={`text-right p-3 font-mono tabular-nums font-bold ${e.newBalance >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                        {formatPKR(e.newBalance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gradient-to-r from-orange-50 to-amber-50/50 font-bold text-[11px] border-t-2 border-orange-200/50">
                    <td colSpan={3} className="p-3 text-orange-800">Total Deferral Opportunity</td>
                    <td className="text-right p-3 font-mono tabular-nums text-red-700">
                      {formatPKR(expensePostponement.reduce((s: number, e: any) => s + e.amount, 0))}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ═══ g) Monthly Insights Grid ═══ */}
      {monthlyInsights.length > 0 && (
        <div>
          <div className="flex items-center gap-2.5 mb-4">
            <div className="p-2 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200/60 shadow-sm shadow-slate-200/40">
              <CircleDot className="w-4 h-4 text-slate-600" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800 tracking-tight">Monthly Insights</h3>
              <p className="text-[11px] text-slate-400 font-medium">{monthlyInsights.length} months analyzed</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {monthlyInsights.map((mi: any, i: number) => {
              const st = statusConfig[mi.status] || statusConfig.healthy;
              return (
                <div
                  key={i}
                  className="bg-gradient-to-br from-white to-slate-50/50 rounded-xl p-4 ring-1 ring-slate-200/60 shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5"
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  <div className="flex items-center justify-between mb-2.5">
                    <p className="text-xs font-bold text-slate-800">{mi.month}</p>
                    <div className="flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                      <Badge className={`text-[8px] px-1.5 py-0 font-semibold ${st.cls}`}>{st.label}</Badge>
                    </div>
                  </div>
                  <ul className="space-y-1">
                    {mi.insights.slice(0, 4).map((insight: string, j: number) => (
                      <li key={j} className="text-[10px] text-slate-500 font-medium leading-relaxed flex items-start gap-1.5">
                        <span className="mt-1.5 w-1 h-1 rounded-full bg-slate-300 flex-shrink-0" />
                        {insight}
                      </li>
                    ))}
                  </ul>
                  <div className="flex items-center gap-3 mt-2.5 pt-2.5 border-t border-slate-100">
                    <span className="text-[9px] text-slate-400 font-medium">{mi.receiptCount} receipt{mi.receiptCount !== 1 ? 's' : ''}</span>
                    <span className="text-[9px] text-slate-400 font-medium">{mi.expenseCount} expense{mi.expenseCount !== 1 ? 's' : ''}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
