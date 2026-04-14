'use client';

import React, { useState, useCallback, useEffect, useRef, Suspense, lazy } from 'react';
import {
  Plus, X, Calculator, RotateCcw, ArrowRightLeft,
  TrendingUp, TrendingDown, Wallet, ShieldAlert, CheckCircle,
  ArrowDownCircle, ArrowUpCircle, Clock, BarChart3,
  AlertTriangle, Lightbulb, Loader2, Sparkles
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { formatPKR, formatPKRFull, formatCompact, MONTH_NAMES } from '@/lib/format';

// Lazy-load recharts to prevent SSR/hydration crashes
const LazyRecharts = lazy(() => import('@/components/cashflow/RechartsCharts'));

interface WhatIfViewProps {
  data: any;
  startDate: string;
  endDate: string;
}

interface Scenario {
  id: string;
  type: string;
  label: string;
  month: number;
  year: number;
  amount: number;
  description: string;
  adjustment?: string;
}

const SCENARIO_TYPES = [
  { value: 'add_receipt', label: 'Add Receipt', icon: ArrowDownCircle, color: 'text-emerald-600', iconBg: 'bg-emerald-100/80' },
  { value: 'remove_expense', label: 'Remove Expense', icon: X, color: 'text-emerald-600', iconBg: 'bg-emerald-100/80' },
  { value: 'delay_expense', label: 'Delay Expense', icon: Clock, color: 'text-amber-600', iconBg: 'bg-amber-100/80' },
  { value: 'increase_receipt', label: 'Increase Receipt', icon: TrendingUp, color: 'text-emerald-600', iconBg: 'bg-emerald-100/80' },
  { value: 'decrease_expense', label: 'Decrease Expense', icon: TrendingDown, color: 'text-emerald-600', iconBg: 'bg-emerald-100/80' },
];

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

/* ─── KPI comparison card ─── */
function KpiCompare({ label, original, modified }: { label: string; original: number; modified: number }) {
  const diff = modified - original;
  const isImproved = diff > 0;
  const isWorse = diff < 0;
  const isNeg = modified < 0;

  return (
    <div className="bg-gradient-to-br from-white to-slate-50/50 rounded-xl p-4 ring-1 ring-slate-200/60 shadow-sm">
      <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-3">{label}</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-[9px] text-slate-400 font-medium mb-0.5">Original</p>
          <p className={`text-sm font-bold font-mono tabular-nums ${original < 0 ? 'text-red-700' : 'text-slate-700'}`}>
            {formatPKR(original)}
          </p>
        </div>
        <div>
          <p className="text-[9px] text-slate-400 font-medium mb-0.5">Modified</p>
          <p className={`text-sm font-bold font-mono tabular-nums ${isNeg ? 'text-red-700' : isImproved ? 'text-emerald-700' : 'text-slate-700'}`}>
            {formatPKR(modified)}
          </p>
        </div>
      </div>
      {diff !== 0 && (
        <div className={`mt-2 pt-2 border-t border-slate-100 flex items-center gap-1.5`}>
          {isImproved ? (
            <TrendingUp className="w-3 h-3 text-emerald-600" />
          ) : isWorse ? (
            <TrendingDown className="w-3 h-3 text-red-600" />
          ) : null}
          <span className={`text-[10px] font-semibold ${isImproved ? 'text-emerald-700' : isWorse ? 'text-red-700' : 'text-slate-500'}`}>
            {isImproved ? '+' : ''}{formatPKR(diff)}
          </span>
        </div>
      )}
    </div>
  );
}

export default function WhatIfView({ data, startDate, endDate }: WhatIfViewProps) {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [scenarioType, setScenarioType] = useState('add_receipt');
  const [scenarioMonth, setScenarioMonth] = useState('4');
  const [scenarioYear, setScenarioYear] = useState(endDate ? new Date(endDate).getFullYear() : new Date().getFullYear());
  const [scenarioAmount, setScenarioAmount] = useState('');
  const [scenarioDescription, setScenarioDescription] = useState('');

  const [results, setResults] = useState<any>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoLoading, setAutoLoading] = useState(false);
  const [aiScenarioCount, setAiScenarioCount] = useState(0);
  const hasAutoLoaded = useRef(false);

  // Available months derived from date range
  const startYear = startDate ? new Date(startDate).getFullYear() : 2026;
  const endYear = endDate ? new Date(endDate).getFullYear() : 2027;
  const availableYears = Array.from({ length: endYear - startYear + 1 }, (_, i) => startYear + i);

  // Detect if a scenario was AI-generated
  const isAIGenerated = (id: string) => id.startsWith('ai-');

  const addScenario = useCallback(() => {
    const amount = parseFloat(scenarioAmount);
    if (!amount || amount <= 0) return;

    const monthNum = parseInt(scenarioMonth);
    const typeConfig = SCENARIO_TYPES.find(t => t.value === scenarioType);
    if (!typeConfig) return;

    const newScenario: Scenario = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type: scenarioType,
      label: typeConfig.label,
      month: monthNum,
      year: scenarioYear,
      amount,
      description: scenarioDescription.trim(),
      adjustment: scenarioType === 'increase_receipt' ? 'increase_receipt' : scenarioType === 'decrease_expense' ? 'decrease_expense' : undefined,
    };

    setScenarios(prev => [...prev, newScenario]);
    setScenarioAmount('');
    setScenarioDescription('');
    // Clear results when scenario changes
    setResults(null);
  }, [scenarioType, scenarioMonth, scenarioYear, scenarioAmount, scenarioDescription]);

  const removeScenario = useCallback((id: string) => {
    setScenarios(prev => prev.filter(s => s.id !== id));
    setResults(null);
  }, []);

  const resetScenarios = useCallback(() => {
    setScenarios([]);
    setResults(null);
    setError(null);
  }, []);

  const generateAutoScenarios = useCallback(async () => {
    setAutoLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/what-if/auto-scenarios?startDate=${startDate}&endDate=${endDate}`);
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const data = await res.json();
      if (data.scenarios && data.scenarios.length > 0) {
        const newScenarios: Scenario[] = data.scenarios.map((s: any) => ({
          id: s.id || `auto-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          type: s.type === 'decrease_expense' ? 'decrease_expense' : s.type,
          label: s.label,
          month: s.month,
          year: s.year,
          amount: s.amount,
          description: s.description || '',
          adjustment: s.adjustment,
        }));
        setScenarios(newScenarios);
        setAiScenarioCount(data.summary?.aiGeneratedCount || 0);
        // Auto-calculate impact immediately with these AI-generated scenarios
        const apiScenarios = newScenarios.map(s => ({
          type: s.type === 'increase_receipt' || s.type === 'decrease_expense' ? 'change_amount' : s.type,
          month: s.month,
          year: s.year,
          amount: s.amount,
          description: s.description,
          adjustment: s.type === 'increase_receipt' ? 'increase_receipt' : s.type === 'decrease_expense' ? 'decrease_expense' : undefined,
        }));
        // Trigger auto-calculation
        try {
          const calcRes = await fetch('/api/what-if', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ startDate, endDate, scenarios: apiScenarios }),
          });
          if (calcRes.ok) {
            const calcData = await calcRes.json();
            setResults(calcData);
          }
        } catch {
          // Auto-calculation failed — scenarios are still added, user can calculate manually
        }
      } else {
        setError('No auto-scenarios could be generated. Add data first.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to generate AI scenarios');
    } finally {
      setAutoLoading(false);
    }
  }, [startDate, endDate]);

  // Auto-generate scenarios on mount (only once, when dates are available)
  useEffect(() => {
    if (startDate && endDate && !hasAutoLoaded.current) {
      hasAutoLoaded.current = true;
      generateAutoScenarios();
    }
  }, [startDate, endDate, generateAutoScenarios]);

  // Debounced calculate
  const calculateImpact = useCallback(async () => {
    if (scenarios.length === 0) {
      setError('Add at least one scenario first');
      return;
    }

    setIsCalculating(true);
    setError(null);

    try {
      // Map scenarios to API format
      const apiScenarios = scenarios.map(s => ({
        type: s.type === 'increase_receipt' || s.type === 'decrease_expense' ? 'change_amount' : s.type,
        month: s.month,
        year: s.year,
        amount: s.amount,
        description: s.description,
        adjustment: s.type === 'increase_receipt' ? 'increase_receipt' : s.type === 'decrease_expense' ? 'decrease_expense' : undefined,
      }));

      const res = await fetch('/api/what-if', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate,
          endDate,
          scenarios: apiScenarios,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Server returned ${res.status}`);
      }

      const data = await res.json();
      setResults(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to calculate what-if scenario');
    } finally {
      setIsCalculating(false);
    }
  }, [scenarios, startDate, endDate]);

  // Chart data for comparison
  const comparisonChartData = results ? results.original.monthlyData.map((m: any, i: number) => {
    const mod = results.modified.monthlyData[i];
    return {
      name: m.monthLabel,
      short: MONTH_NAMES[m.month - 1],
      Original: Math.round(m.closingBalance),
      Modified: Math.round(mod.closingBalance),
    };
  }) : [];

  const tooltipStyle = { fontSize: 11, borderRadius: 8, border: '1px solid var(--border)' };
  const currencyFormatter = (v: number) => formatPKRFull(v);

  return (
    <div className="space-y-7">
      {/* ─── Header ─── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-cyan-100 to-blue-200/60 shadow-sm shadow-cyan-200/40">
            <ArrowRightLeft className="w-4 h-4 text-cyan-600" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-800 tracking-tight">What-If Scenario Builder</h2>
            <p className="text-[11px] text-slate-400 font-medium">Model the impact of changes to your cash flow forecast</p>
          </div>
        </div>
        {scenarios.length > 0 && (
          <Button variant="outline" size="sm" onClick={resetScenarios} className="h-8 text-xs gap-1.5 rounded-lg font-medium">
            <RotateCcw className="w-3.5 h-3.5" />
            Reset All
          </Button>
        )}
      </div>

      {/* ═══ a) Scenario Builder ═══ */}
      <Card className="shadow-md border-slate-200/60 hover:shadow-lg transition-shadow duration-300">
        <CardHeader className="pb-2 px-6 pt-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-gradient-to-br from-violet-100 to-purple-200/60 shadow-sm shadow-violet-200/40">
                <Lightbulb className="w-4 h-4 text-violet-600" />
              </div>
              <div>
                <CardTitle className="text-sm font-bold text-slate-800 tracking-tight">Scenario Builder</CardTitle>
                <CardDescription className="text-[11px] text-slate-400 font-medium">
                  Add hypothetical changes or let AI auto-generate scenarios
                </CardDescription>
              </div>
            </div>
            <Button
              onClick={generateAutoScenarios}
              disabled={autoLoading}
              size="sm"
              variant="outline"
              className="h-8 text-xs gap-1.5 rounded-lg font-medium border-violet-200/60 text-violet-700 hover:bg-violet-50"
            >
              {autoLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              AI Auto-Generate
            </Button>
          </div>
        </CardHeader>
        <CardContent className="px-6 pb-5">
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-5">
            {/* Type */}
            <div className="md:col-span-2">
              <Label className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-1.5 block">
                Change Type
              </Label>
              <Select value={scenarioType} onValueChange={setScenarioType}>
                <SelectTrigger className="w-full h-9 text-xs rounded-lg">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {SCENARIO_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value} className="text-xs">
                      <span className="flex items-center gap-2">
                        <t.icon className={`w-3.5 h-3.5 ${t.color}`} />
                        {t.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Month / Year */}
            <div>
              <Label className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-1.5 block">
                Month
              </Label>
              <Select value={scenarioMonth} onValueChange={setScenarioMonth}>
                <SelectTrigger className="w-full h-9 text-xs rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTH_NAMES.map((name, i) => (
                    <SelectItem key={i + 1} value={String(i + 1)} className="text-xs">
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-1.5 block">
                Year
              </Label>
              <Select value={String(scenarioYear)} onValueChange={(v) => setScenarioYear(parseInt(v))}>
                <SelectTrigger className="w-full h-9 text-xs rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableYears.map(y => (
                    <SelectItem key={y} value={String(y)} className="text-xs">
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Amount */}
            <div>
              <Label className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-1.5 block">
                Amount (Rs.)
              </Label>
              <Input
                type="number"
                placeholder="0"
                value={scenarioAmount}
                onChange={e => setScenarioAmount(e.target.value)}
                className="h-9 text-xs rounded-lg font-mono"
                min="0"
              />
            </div>

            {/* Add button */}
            <div className="flex items-end">
              <Button
                onClick={addScenario}
                disabled={!scenarioAmount || parseFloat(scenarioAmount) <= 0}
                size="sm"
                className="w-full h-9 text-xs gap-1.5 rounded-lg font-medium"
              >
                <Plus className="w-3.5 h-3.5" />
                Add
              </Button>
            </div>
          </div>

          {/* Description */}
          <div className="mb-4">
            <Label className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-1.5 block">
              Description (optional)
            </Label>
            <Input
              placeholder="e.g., Expected payment from Acme Corp..."
              value={scenarioDescription}
              onChange={e => setScenarioDescription(e.target.value)}
              className="h-9 text-xs rounded-lg max-w-lg"
            />
          </div>

          {/* Scenario List */}
          {scenarios.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">
                  {scenarios.length} Scenario{scenarios.length !== 1 ? 's' : ''} ({aiScenarioCount > 0 ? `${aiScenarioCount} AI + ${scenarios.length - aiScenarioCount} rule-based` : 'auto-generated'})
                </p>
                <p className="text-[10px] text-slate-400 font-medium">
                  Total impact: {formatPKR(scenarios.reduce((sum, s) => {
                    if (s.type === 'remove_expense' || s.type === 'decrease_expense') return sum + s.amount;
                    return sum;
                  }, 0))} saved
                </p>
              </div>
              <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-1.5 pr-1">
                {scenarios.map((s) => {
                  const typeConfig = SCENARIO_TYPES.find(t => t.value === s.type);
                  const Icon = typeConfig?.icon || Plus;
                  return (
                    <div
                      key={s.id}
                      className="flex items-center gap-3 px-3.5 py-2.5 rounded-lg ring-1 ring-slate-200/60 bg-white/70 hover:shadow-sm transition-all duration-200 group"
                    >
                      <div className={`p-1.5 rounded-md ${typeConfig?.iconBg || 'bg-slate-100'}`}>
                        <Icon className={`w-3.5 h-3.5 ${typeConfig?.color || 'text-slate-600'}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-semibold text-slate-700">{typeConfig?.label}</span>
                          {isAIGenerated(s.id) && (
                            <Badge className="text-[8px] px-1.5 py-0 bg-violet-100/80 text-violet-600 border-violet-200/60 font-medium gap-0.5">
                              <Sparkles className="w-2.5 h-2.5" /> AI
                            </Badge>
                          )}
                          <Badge className="text-[8px] px-1.5 py-0 bg-slate-100/80 text-slate-500 border-slate-200/60 font-medium">
                            {MONTH_NAMES[s.month - 1]} {s.year}
                          </Badge>
                        </div>
                        {s.description && (
                          <p className="text-[10px] text-slate-400 font-medium truncate">{s.description}</p>
                        )}
                      </div>
                      <span className="text-xs font-bold font-mono tabular-nums text-emerald-700">
                        {s.type === 'remove_expense' || s.type === 'decrease_expense' ? '+' : ''}{formatPKR(s.amount)}
                      </span>
                      <button
                        onClick={() => removeScenario(s.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded-md hover:bg-red-50 text-slate-400 hover:text-red-600 transition-all duration-200"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>

              <Separator className="my-3" />

              {/* Calculate Button */}
              <Button
                onClick={calculateImpact}
                disabled={isCalculating || scenarios.length === 0}
                size="sm"
                className="h-9 text-xs gap-2 rounded-lg font-semibold shadow-sm"
              >
                {isCalculating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Calculating...
                  </>
                ) : (
                  <>
                    <Calculator className="w-4 h-4" />
                    Calculate Impact
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mt-4 flex items-center gap-2.5 px-4 py-3 rounded-xl bg-red-50 ring-1 ring-red-200/70">
              <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
              <p className="text-xs text-red-700 font-medium">{error}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ═══ b) Results — Comparison Dashboard ═══ */}
      {results && (
        <>
          {/* Impact Summary Banner */}
          <div className={`rounded-2xl p-5 ring-1 ${
            results.impact.netChange >= 0
              ? 'bg-gradient-to-r from-emerald-50/80 via-white to-emerald-50/40 ring-emerald-200/70 shadow-md shadow-emerald-100/30'
              : 'bg-gradient-to-r from-red-50/80 via-white to-red-50/40 ring-red-200/70 shadow-md shadow-red-100/30'
          }`}>
            <div className="flex items-center gap-3 mb-4">
              <div className={`p-2.5 rounded-xl ${
                results.impact.netChange >= 0
                  ? 'bg-gradient-to-br from-emerald-100 to-emerald-200/60'
                  : 'bg-gradient-to-br from-red-100 to-red-200/60'
              }`}>
                {results.impact.netChange >= 0 ? (
                  <TrendingUp className="w-5 h-5 text-emerald-600" />
                ) : (
                  <TrendingDown className="w-5 h-5 text-red-600" />
                )}
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800 tracking-tight">Impact Summary</h3>
                <p className="text-[11px] text-slate-400 font-medium">Net effect of {scenarios.length} scenario{scenarios.length !== 1 ? 's' : ''}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white/70 backdrop-blur-sm rounded-xl p-4 ring-1 ring-slate-200/50 shadow-sm">
                <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Net Change in Forecast</p>
                <p className={`text-xl font-extrabold tracking-tight mt-1 ${results.impact.netChange >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                  {results.impact.netChange >= 0 ? '+' : ''}{formatPKRFull(results.impact.netChange)}
                </p>
                <p className="text-[10px] text-slate-400 font-medium mt-0.5">Closing balance difference</p>
              </div>
              <div className="bg-white/70 backdrop-blur-sm rounded-xl p-4 ring-1 ring-slate-200/50 shadow-sm">
                <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Deficit Reduction</p>
                <p className={`text-xl font-extrabold tracking-tight mt-1 ${results.impact.deficitReduction > 0 ? 'text-emerald-700' : 'text-slate-500'}`}>
                  {results.impact.deficitReduction > 0 ? '' : ''}{formatPKRFull(results.impact.deficitReduction)}
                </p>
                <p className="text-[10px] text-slate-400 font-medium mt-0.5">Total deficit reduction across months</p>
              </div>
              <div className="bg-white/70 backdrop-blur-sm rounded-xl p-4 ring-1 ring-slate-200/50 shadow-sm">
                <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Months Improved</p>
                <p className={`text-xl font-extrabold tracking-tight mt-1 ${results.impact.monthsImproved > 0 ? 'text-emerald-700' : 'text-slate-500'}`}>
                  {results.impact.monthsImproved}
                </p>
                <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                  Deficit → Surplus conversion{results.impact.monthsImproved === 1 ? '' : 's'}
                </p>
              </div>
            </div>
          </div>

          {/* Side-by-Side KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <KpiCompare
              label="Forecast Closing Balance"
              original={results.original.forecastClosing}
              modified={results.modified.forecastClosing}
            />
            <KpiCompare
              label="Deficit Months"
              original={results.original.deficitMonths}
              modified={results.modified.deficitMonths}
            />
            <KpiCompare
              label="Total Deficit Amount"
              original={results.original.totalDeficit}
              modified={results.modified.totalDeficit}
            />
          </div>

          {/* ═══ c) Visual Comparison Chart ═══ */}
          <Card className="shadow-md border-slate-200/60 hover:shadow-lg transition-shadow duration-300">
            <CardHeader className="pb-2 px-6 pt-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-100 to-violet-200/60 shadow-sm shadow-indigo-200/40">
                    <BarChart3 className="w-4 h-4 text-indigo-600" />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-bold text-slate-800 tracking-tight">Balance Comparison</CardTitle>
                    <CardDescription className="text-[11px] text-slate-400 font-medium">
                      Original vs Modified closing balances per month
                    </CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-2 rounded-sm bg-slate-400" />
                    <span className="text-[10px] text-slate-500 font-medium">Original</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-2 rounded-sm bg-emerald-500" />
                    <span className="text-[10px] text-slate-500 font-medium">Modified</span>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-6 pb-5">
              <Suspense fallback={<ChartFallback />}>
                <LazyRecharts
                  type="comparison"
                  data={comparisonChartData}
                  tooltipStyle={tooltipStyle}
                  currencyFormatter={currencyFormatter}
                />
              </Suspense>
            </CardContent>
          </Card>

          {/* ═══ d) Month-by-Month Comparison Table ═══ */}
          <Card className="shadow-md border-slate-200/60 hover:shadow-lg transition-shadow duration-300">
            <CardHeader className="pb-2 px-6 pt-5">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200/60 shadow-sm shadow-slate-200/40">
                  <Wallet className="w-4 h-4 text-slate-600" />
                </div>
                <div>
                  <CardTitle className="text-sm font-bold text-slate-800 tracking-tight">Month-by-Month Comparison</CardTitle>
                  <CardDescription className="text-[11px] text-slate-400 font-medium">
                    Detailed forecast comparison with color-coded differences
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-6 pb-5">
              <div className="overflow-x-auto custom-scrollbar rounded-xl ring-1 ring-slate-200/70">
                <table className="w-full text-[11px] border-collapse">
                  <thead>
                    <tr className="bg-gradient-to-r from-slate-50 to-slate-100/80 border-b border-slate-200/60">
                      <th className="text-left p-3 font-bold text-slate-600 w-24">Month</th>
                      <th className="text-right p-3 font-bold text-slate-600">Original Opening</th>
                      <th className="text-right p-3 font-bold text-emerald-700">Original Receipts</th>
                      <th className="text-right p-3 font-bold text-red-700">Original Expenses</th>
                      <th className="text-right p-3 font-bold text-slate-600">Original Closing</th>
                      <th className="text-center p-3 font-bold text-slate-300 w-6">→</th>
                      <th className="text-right p-3 font-bold text-emerald-700">Modified Receipts</th>
                      <th className="text-right p-3 font-bold text-red-700">Modified Expenses</th>
                      <th className="text-right p-3 font-bold text-slate-600">Modified Closing</th>
                      <th className="text-right p-3 font-bold text-slate-600">Difference</th>
                      <th className="text-center p-3 font-bold text-slate-600 w-16">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.original.monthlyData.map((orig: any, i: number) => {
                      const mod = results.modified.monthlyData[i];
                      const diff = mod.closingBalance - orig.closingBalance;
                      const isImproved = diff > 0;
                      const isRecovered = orig.isDeficit && !mod.isDeficit;

                      return (
                        <tr
                          key={i}
                          className={`border-b border-slate-100/80 transition-colors duration-150 ${
                            isRecovered
                              ? 'bg-emerald-50/50'
                              : diff !== 0
                              ? 'bg-sky-50/30'
                              : i % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'
                          }`}
                        >
                          <td className="p-3 font-semibold text-slate-700">{orig.monthLabel}</td>
                          <td className="text-right p-3 font-mono tabular-nums text-slate-600">{formatPKR(orig.openingBalance)}</td>
                          <td className="text-right p-3 font-mono tabular-nums text-emerald-700">{formatPKR(orig.totalReceipts)}</td>
                          <td className="text-right p-3 font-mono tabular-nums text-red-700">{formatPKR(orig.totalExpenses)}</td>
                          <td className={`text-right p-3 font-mono tabular-nums font-semibold ${orig.closingBalance < 0 ? 'text-red-700' : 'text-slate-700'}`}>
                            {formatPKR(orig.closingBalance)}
                          </td>
                          <td className="text-center p-3 text-slate-300 font-bold">→</td>
                          <td className={`text-right p-3 font-mono tabular-nums font-medium ${mod.totalReceipts !== orig.totalReceipts ? 'text-emerald-700' : 'text-slate-400'}`}>
                            {formatPKR(mod.totalReceipts)}
                            {mod.totalReceipts !== orig.totalReceipts && (
                              <span className="ml-1 text-[8px] text-emerald-500">▲</span>
                            )}
                          </td>
                          <td className={`text-right p-3 font-mono tabular-nums font-medium ${mod.totalExpenses !== orig.totalExpenses ? 'text-red-700' : 'text-slate-400'}`}>
                            {formatPKR(mod.totalExpenses)}
                            {mod.totalExpenses !== orig.totalExpenses && (
                              <span className="ml-1 text-[8px] text-red-500">▼</span>
                            )}
                          </td>
                          <td className={`text-right p-3 font-mono tabular-nums font-bold ${mod.closingBalance < 0 ? 'text-red-700' : isRecovered ? 'text-emerald-700' : 'text-slate-700'}`}>
                            {formatPKR(mod.closingBalance)}
                          </td>
                          <td className={`text-right p-3 font-mono tabular-nums font-semibold ${
                            diff > 0 ? 'text-emerald-700' : diff < 0 ? 'text-red-700' : 'text-slate-400'
                          }`}>
                            {diff >= 0 ? '+' : ''}{formatPKR(diff)}
                          </td>
                          <td className="text-center p-3">
                            {isRecovered ? (
                              <Badge className="text-[8px] px-2 py-0 bg-emerald-100/80 text-emerald-700 border-emerald-200/70 shadow-sm font-bold">
                                Recovered
                              </Badge>
                            ) : diff > 0 ? (
                              <Badge className="text-[8px] px-2 py-0 bg-sky-100/80 text-sky-700 border-sky-200/70 shadow-sm font-semibold">
                                Improved
                              </Badge>
                            ) : diff < 0 ? (
                              <Badge className="text-[8px] px-2 py-0 bg-red-100/80 text-red-700 border-red-200/70 shadow-sm font-semibold">
                                Worsened
                              </Badge>
                            ) : (
                              <Badge className="text-[8px] px-2 py-0 bg-slate-100/80 text-slate-500 border-slate-200/70 shadow-sm font-semibold">
                                Unchanged
                              </Badge>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gradient-to-r from-slate-100 to-slate-50 font-bold text-[11px] border-t-2 border-slate-200">
                      <td className="p-3 text-slate-700">TOTAL</td>
                      <td colSpan={3}></td>
                      <td className={`text-right p-3 font-mono tabular-nums ${results.original.forecastClosing >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                        {formatPKR(results.original.forecastClosing)}
                      </td>
                      <td></td>
                      <td colSpan={2}></td>
                      <td className={`text-right p-3 font-mono tabular-nums ${results.modified.forecastClosing >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                        {formatPKR(results.modified.forecastClosing)}
                      </td>
                      <td className={`text-right p-3 font-mono tabular-nums ${results.impact.netChange >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                        {results.impact.netChange >= 0 ? '+' : ''}{formatPKR(results.impact.netChange)}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Empty state when no results */}
      {!results && scenarios.length === 0 && !autoLoading && (
        <div className="flex items-center justify-center h-48">
          <div className="text-center max-w-sm">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-50 to-blue-50 flex items-center justify-center mx-auto mb-4 shadow-sm">
              <ArrowRightLeft className="w-7 h-7 text-cyan-500/60" />
            </div>
            <h3 className="text-sm font-semibold text-slate-700 mb-1.5 tracking-tight">Generating AI Scenarios...</h3>
            <p className="text-xs text-slate-400 font-medium leading-relaxed">
              AI is analyzing your cash flow data to generate smart scenarios. Results will appear automatically. You can also add custom scenarios above or click "AI Auto-Generate" to refresh.
            </p>
          </div>
        </div>
      )}

      {/* Loading state for auto-generate + auto-calculate */}
      {!results && autoLoading && (
        <div className="flex items-center justify-center h-48">
          <div className="text-center max-w-sm">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-50 to-purple-50 flex items-center justify-center mx-auto mb-4 shadow-sm">
              <Loader2 className="w-7 h-7 text-violet-500 animate-spin" />
            </div>
            <h3 className="text-sm font-semibold text-slate-700 mb-1.5 tracking-tight">AI is Working...</h3>
            <p className="text-xs text-slate-400 font-medium leading-relaxed">
              Generating scenarios and calculating their impact on your cash flow forecast automatically.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
