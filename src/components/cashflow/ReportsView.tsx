'use client';

import React, { useState } from 'react';
import { Download, FileText, FileSpreadsheet, Printer, FileDown, Table2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { formatPKR, formatPKRFull, formatCompact, MONTH_NAMES } from '@/lib/format';

interface ReportsViewProps {
  data: any;
}

export default function ReportsView({ data }: ReportsViewProps) {
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExportCSV = async (type: string) => {
    setExporting(true);
    try {
      const fyYear = data?.fyYear || new Date().getFullYear();
      const res = await fetch(`/api/reports/export?type=${type}&format=csv&year=${fyYear}`);
      if (!res.ok) {
        setError('Export failed. Please try again.');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cash-flow-${type}-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      console.error('Export failed');
    } finally {
      setExporting(false);
    }
  };

  const handleExportPDF = async () => {
    setExporting(true);
    try {
      const fyYear = data?.fyYear || new Date().getFullYear();
      const res = await fetch(`/api/reports/export?type=all&format=pdf&year=${fyYear}`);
      if (!res.ok) {
        setError('Export failed. Please try again.');
        return;
      }
      const html = await res.text();
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cash-flow-report-${new Date().toISOString().split('T')[0]}.html`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      console.error('PDF export failed');
    } finally {
      setExporting(false);
    }
  };

  const handleExportXLSX = async (type: string) => {
    setExporting(true);
    try {
      const fyYear = data?.fyYear || new Date().getFullYear();
      const res = await fetch(`/api/reports/export?type=${type}&format=xlsx&year=${fyYear}`);
      if (!res.ok) {
        setError('Export failed. Please try again.');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cash-flow-${type}-FY${fyYear}-landscape.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      console.error('XLSX export failed');
    } finally {
      setExporting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Loading reports...</p>
        </div>
      </div>
    );
  }

  const { monthlyData, currentBalance, shortfallAnalysis } = data;

  return (
    <div className="space-y-6">
      {/* Export Actions */}
      <Card className="shadow-md border-slate-200/60">
        <CardContent className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-800 tracking-tight">Export Reports</h3>
              <p className="text-xs text-slate-400 font-medium mt-0.5">Download cash flow data in various formats</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => handleExportCSV('all')} disabled={exporting} className="gap-1.5 rounded-lg shadow-sm font-medium">
                <FileSpreadsheet className="w-4 h-4" /> All Data (CSV)
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleExportCSV('receipts')} disabled={exporting} className="gap-1.5 rounded-lg shadow-sm font-medium">
                <Download className="w-4 h-4" /> Receipts (CSV)
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleExportCSV('expenses')} disabled={exporting} className="gap-1.5 rounded-lg shadow-sm font-medium">
                <Download className="w-4 h-4" /> Expenses (CSV)
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleExportXLSX('all')} disabled={exporting} className="gap-1.5 rounded-lg shadow-sm font-medium">
                <Table2 className="w-4 h-4" /> Excel (Landscape)
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportPDF} disabled={exporting} className="gap-1.5 rounded-lg shadow-sm font-medium">
                <FileDown className="w-4 h-4" /> PDF Report
              </Button>
              <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1.5 rounded-lg shadow-sm font-medium">
                <Printer className="w-4 h-4" /> Print
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Monthly Cash Flow Report */}
      <Card className="shadow-md border-slate-200/60">
        <CardHeader className="px-6 pt-5 pb-2">
          <CardTitle className="text-base font-bold text-slate-800 tracking-tight">{data?.settings?.app_name || data?.settings?.company_name || 'ECI'} - Cash Flow Statement</CardTitle>
          <CardDescription className="text-[11px] text-slate-400 font-medium mt-0.5">{data?.rangeLabel || 'Monthly Forecast Report'} | Monthly Forecast Report</CardDescription>
        </CardHeader>
        <CardContent className="px-6 pb-5">
          <div className="overflow-x-auto custom-scrollbar rounded-xl ring-1 ring-slate-200/70">
            <table className="w-full text-xs border-collapse print:text-[10px]">
              <thead>
                <tr className="border-b-2 border-slate-200 bg-gradient-to-r from-slate-50 to-slate-100/80">
                  <th className="text-left p-3 font-bold text-slate-600" rowSpan={2}>Month</th>
                  <th className="text-right p-3 font-bold text-slate-600" rowSpan={2}>Opening Balance</th>
                  <th className="text-center p-3 font-bold text-emerald-700 bg-emerald-50/50" colSpan={2}>Receipts</th>
                  <th className="text-center p-3 font-bold text-red-700 bg-red-50/50" colSpan={2}>Expenses</th>
                  <th className="text-right p-3 font-bold text-slate-600" rowSpan={2}>Net Cash Flow</th>
                  <th className="text-right p-3 font-bold text-slate-600" rowSpan={2}>Closing Balance</th>
                  <th className="text-center p-3 font-bold text-slate-600" rowSpan={2}>Status</th>
                </tr>
                <tr className="border-b-2 border-slate-200 bg-gradient-to-r from-slate-50 to-slate-100/80">
                  <th className="text-right p-3 font-semibold text-emerald-700 bg-emerald-50/50">Project</th>
                  <th className="text-right p-3 font-semibold text-emerald-700 bg-emerald-50/50">Total</th>
                  <th className="text-right p-3 font-semibold text-red-700 bg-red-50/50">Operational</th>
                  <th className="text-right p-3 font-semibold text-red-700 bg-red-50/50">Total</th>
                </tr>
              </thead>
              <tbody>
                {monthlyData.map((m: any, i: number) => (
                  <React.Fragment key={i}>
                    {i === 0 && (
                      <tr className="border-b border-slate-200/40 bg-indigo-50/40">
                        <td colSpan={9} className="p-3 font-semibold text-xs text-slate-600">
                          Current Bank Balance: <span className={currentBalance >= 0 ? 'text-emerald-700 font-bold' : 'text-red-700 font-bold'}>{formatPKRFull(currentBalance)}</span>
                        </td>
                      </tr>
                    )}
                    <tr className={`border-b border-slate-100/80 transition-colors duration-150 ${m.warningFlag ? 'bg-red-50/40' : 'hover:bg-slate-50/50'}`}>
                      <td className="p-3 font-semibold text-slate-700">{m.monthLabel}</td>
                      <td className={`text-right p-3 font-mono tabular-nums ${m.openingBalance < 0 ? 'text-red-700 font-semibold' : 'text-slate-700'}`}>
                        {formatPKR(m.openingBalance)}
                      </td>
                      <td className="text-right p-3 text-emerald-700 font-mono tabular-nums">
                        {formatPKR(m.totalReceipts - (m.totalReceipts * (data?.settings?.profit_margin_pct ? parseFloat(data.settings.profit_margin_pct) / 100 : 0)))}
                      </td>
                      <td className="text-right p-3 font-bold text-emerald-700 font-mono tabular-nums">
                        {formatPKR(m.totalReceipts)}
                      </td>
                      <td className="text-right p-3 text-orange-600 font-mono tabular-nums">
                        {formatPKR(m.totalOperationalExpenses)}
                      </td>
                      <td className="text-right p-3 font-bold text-red-600 font-mono tabular-nums">
                        {formatPKR(m.totalExpenses)}
                      </td>
                      <td className={`text-right p-3 font-semibold font-mono tabular-nums ${m.netCashFlow < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                        {formatPKR(m.netCashFlow)}
                      </td>
                      <td className={`text-right p-3 font-bold font-mono tabular-nums ${m.closingBalance < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                        {formatPKR(m.closingBalance)}
                      </td>
                      <td className="text-center p-3">
                        {m.warningFlag ? (
                          <Badge variant="destructive" className="text-[9px] px-2 py-0.5 shadow-sm font-semibold rounded-md">DEFICIT</Badge>
                        ) : (
                          <Badge className="text-[9px] px-2 py-0.5 shadow-sm font-semibold rounded-md bg-emerald-50 text-emerald-800 border-emerald-200/80">OK</Badge>
                        )}
                      </td>
                    </tr>
                  </React.Fragment>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200 font-bold text-xs bg-gradient-to-r from-slate-100 to-slate-50">
                  <td className="p-3 text-slate-700">TOTAL</td>
                  <td className="p-3"></td>
                  <td className="p-3"></td>
                  <td className="text-right p-3 text-emerald-700 font-mono tabular-nums">
                    {formatPKR(monthlyData.reduce((s: number, m: any) => s + m.totalReceipts, 0))}
                  </td>
                  <td className="text-right p-3 text-orange-600 font-mono tabular-nums">
                    {formatPKR(monthlyData.reduce((s: number, m: any) => s + m.totalOperationalExpenses, 0))}
                  </td>
                  <td className="text-right p-3 text-red-600 font-mono tabular-nums">
                    {formatPKR(monthlyData.reduce((s: number, m: any) => s + m.totalExpenses, 0))}
                  </td>
                  <td className={`text-right p-3 font-mono tabular-nums ${data.netCashFlow >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {formatPKR(data.netCashFlow)}
                  </td>
                  <td className={`text-right p-3 font-mono tabular-nums ${data.forecastClosingBalance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {formatPKR(data.forecastClosingBalance)}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Shortfall Analysis Report */}
      {shortfallAnalysis.totalDeficit > 0 && (
        <Card className="shadow-md border-orange-200/60 bg-gradient-to-br from-orange-50/70 via-white to-amber-50/50 ring-1 ring-orange-200/70">
          <CardHeader className="px-6 pt-5 pb-2">
            <CardTitle className="text-base font-bold text-orange-900 tracking-tight">Shortfall Analysis Report</CardTitle>
            <CardDescription className="text-[11px] text-orange-600/80 font-medium mt-0.5">Based on {shortfallAnalysis.profitMarginPct * 100}% margin target</CardDescription>
          </CardHeader>
          <CardContent className="px-6 pb-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-4 rounded-xl bg-white/70 backdrop-blur-sm border border-red-200/80 shadow-sm">
                <p className="text-xs text-red-600 font-semibold mb-1">Total Deficit (Q85)</p>
                <p className="text-xl font-extrabold tracking-tight text-red-700">{formatPKRFull(shortfallAnalysis.totalDeficit)}</p>
                <p className="text-[10px] text-slate-400 mt-1">= ABS(Q83)</p>
              </div>
              <div className="p-4 rounded-xl bg-white/70 backdrop-blur-sm border border-orange-200/80 shadow-sm">
                <p className="text-xs text-orange-600 font-semibold mb-1">Additional Business Required (Q86)</p>
                <p className="text-xl font-extrabold tracking-tight text-orange-700">{formatPKRFull(shortfallAnalysis.additionalBusinessRequired)}</p>
                <p className="text-[10px] text-slate-400 mt-1">= IF(Q83&lt;0, ABS(Q85)/{shortfallAnalysis.profitMarginPct * 100}%, 0)</p>
              </div>
              <div className="p-4 rounded-xl bg-white/70 backdrop-blur-sm border border-amber-200/80 shadow-sm">
                <p className="text-xs text-amber-600 font-semibold mb-1">Estimated Profit Margin (Q87)</p>
                <p className="text-xl font-extrabold tracking-tight text-amber-700">{formatPKRFull(shortfallAnalysis.profitMargin)}</p>
                <p className="text-[10px] text-slate-400 mt-1">= Q86 × {shortfallAnalysis.operationalMarginPct * 100}%</p>
              </div>
              <div className="p-4 rounded-xl bg-white/70 backdrop-blur-sm border border-emerald-200/80 shadow-sm">
                <p className="text-xs text-emerald-600 font-semibold mb-1">Net Balance After Recovery (Q88)</p>
                <p className={`text-xl font-extrabold tracking-tight ${shortfallAnalysis.netBalanceAfterRecovery >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                  {formatPKRFull(shortfallAnalysis.netBalanceAfterRecovery)}
                </p>
                <p className="text-[10px] text-slate-400 mt-1">= Q87 + Q83</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Excel Logic Mapping */}
      <Card className="shadow-md border-slate-200/60">
        <CardHeader className="px-6 pt-5 pb-2">
          <CardTitle className="text-base font-bold text-slate-800 tracking-tight">Formula Reference: Excel → System Mapping</CardTitle>
          <CardDescription className="text-[11px] text-slate-400 font-medium mt-0.5">How the new system replicates the original Excel calculation logic</CardDescription>
        </CardHeader>
        <CardContent className="px-6 pb-5">
          <div className="overflow-x-auto custom-scrollbar rounded-xl ring-1 ring-slate-200/70">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b-2 border-slate-200 bg-gradient-to-r from-slate-50 to-slate-100/80">
                  <th className="text-left p-3 font-bold text-slate-600">Excel Cell</th>
                  <th className="text-left p-3 font-bold text-slate-600">Excel Formula</th>
                  <th className="text-left p-3 font-bold text-slate-600">System Logic</th>
                  <th className="text-left p-3 font-bold text-slate-600">Description</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['Q4', '=SUM(O6:O8)', 'Sum of all bank account balances', 'Current bank balance'],
                  ['D10', '=Q4', 'First month opening = current balance', 'Balance carry-forward for April'],
                  ['E10', '=D83', 'Next month opening = prev closing', 'Balance carry-forward (May onwards)'],
                  ['D37', '=SUM(D13:D36)', 'Sum of month receipts', 'Total expected receipts per month'],
                  ['D81', '=SUM(D42:D79)', 'Sum of month expenses', 'Total expected expenses per month'],
                  ['D83', '=D10+D37-D81', 'Opening + Receipts - Expenses', 'Forecast bank balance'],
                  ['Q83', '=Q4+Q9-Q39', 'Current + Total Receipts - Total Expenses', 'Overall forecast'],
                  ['Q85', '=ABS(Q83)', 'Absolute value of forecast', 'Total deficit amount'],
                  ['Q86', '=IF(Q83<0,ABS(Q85)/12%,0)', 'If deficit, divide by margin %', 'Additional business required'],
                  ['Q87', '=Q86*9%', 'Additional business × 9%', 'Profit margin estimate'],
                  ['Q88', '=Q87+Q83', 'Profit margin + forecast', 'Net balance after recovery'],
                  ['D89', '=SUM(D56:D79)', 'Sum of operational expenses', 'Monthly operational costs'],
                ].map(([cell, formula, logic, desc], i) => (
                  <tr key={i} className="border-b border-slate-100/80 hover:bg-slate-50/50 transition-colors duration-150">
                    <td className="p-3 font-mono font-extrabold text-indigo-600">{cell}</td>
                    <td className="p-3 font-mono text-slate-400">{formula}</td>
                    <td className="p-3 text-slate-700">{logic}</td>
                    <td className="p-3 text-slate-400">{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
