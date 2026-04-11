'use client';

import React, { useState } from 'react';
import { Download, FileText, FileSpreadsheet, Printer } from 'lucide-react';
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

  const handleExportCSV = async (type: string) => {
    setExporting(true);
    try {
      const res = await fetch(`/api/reports/export?type=${type}&format=csv&year=2026`);
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

  const handlePrint = () => {
    window.print();
  };

  const { monthlyData, currentBalance, shortfallAnalysis } = data;

  return (
    <div className="space-y-6">
      {/* Export Actions */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold">Export Reports</h3>
              <p className="text-xs text-muted-foreground">Download cash flow data in various formats</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => handleExportCSV('all')} disabled={exporting}>
                <FileSpreadsheet className="w-4 h-4 mr-1.5" /> All Data (CSV)
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleExportCSV('receipts')} disabled={exporting}>
                <Download className="w-4 h-4 mr-1.5" /> Receipts (CSV)
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleExportCSV('expenses')} disabled={exporting}>
                <Download className="w-4 h-4 mr-1.5" /> Expenses (CSV)
              </Button>
              <Button variant="outline" size="sm" onClick={handlePrint}>
                <Printer className="w-4 h-4 mr-1.5" /> Print
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Monthly Cash Flow Report */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">ECI - Cash Flow Statement</CardTitle>
          <CardDescription>April 2026 - March 2027 | Monthly Forecast Report</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-xs border-collapse print:text-[10px]">
              <thead>
                <tr className="border-b-2 border-foreground">
                  <th className="text-left p-2 font-bold" rowSpan={2}>Month</th>
                  <th className="text-right p-2 font-bold" rowSpan={2}>Opening Balance</th>
                  <th className="text-center p-2 font-bold bg-emerald-50" colSpan={2}>Receipts</th>
                  <th className="text-center p-2 font-bold bg-red-50" colSpan={2}>Expenses</th>
                  <th className="text-right p-2 font-bold" rowSpan={2}>Net Cash Flow</th>
                  <th className="text-right p-2 font-bold" rowSpan={2}>Closing Balance</th>
                  <th className="text-center p-2 font-bold" rowSpan={2}>Status</th>
                </tr>
                <tr className="border-b-2 border-foreground">
                  <th className="text-right p-2 font-semibold bg-emerald-50">Project</th>
                  <th className="text-right p-2 font-semibold bg-emerald-50">Total</th>
                  <th className="text-right p-2 font-semibold bg-red-50">Operational</th>
                  <th className="text-right p-2 font-semibold bg-red-50">Total</th>
                </tr>
              </thead>
              <tbody>
                {monthlyData.map((m: any, i: number) => (
                  <React.Fragment key={i}>
                    {i === 0 && (
                      <tr className="border-b bg-muted/30">
                        <td colSpan={9} className="p-2 font-semibold text-xs">
                          Current Bank Balance: <span className={currentBalance >= 0 ? 'text-emerald-600' : 'text-red-600'}>{formatPKRFull(currentBalance)}</span>
                        </td>
                      </tr>
                    )}
                    <tr className={`border-b ${m.warningFlag ? 'bg-red-50/50' : 'hover:bg-muted/30'}`}>
                      <td className="p-2 font-medium">{m.monthLabel}</td>
                      <td className={`text-right p-2 ${m.openingBalance < 0 ? 'text-red-600 font-semibold' : ''}`}>
                        {formatPKR(m.openingBalance)}
                      </td>
                      <td className="text-right p-2 text-emerald-700">
                        {formatPKR(m.totalReceipts - (m.totalReceipts * 0.1))}
                      </td>
                      <td className="text-right p-2 font-semibold text-emerald-600">
                        {formatPKR(m.totalReceipts)}
                      </td>
                      <td className="text-right p-2 text-orange-600">
                        {formatPKR(m.totalOperationalExpenses)}
                      </td>
                      <td className="text-right p-2 font-semibold text-red-600">
                        {formatPKR(m.totalExpenses)}
                      </td>
                      <td className={`text-right p-2 ${m.netCashFlow < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                        {formatPKR(m.netCashFlow)}
                      </td>
                      <td className={`text-right p-2 font-bold ${m.closingBalance < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                        {formatPKR(m.closingBalance)}
                      </td>
                      <td className="text-center p-2">
                        {m.warningFlag ? (
                          <Badge variant="destructive" className="text-[9px] px-1">DEFICIT</Badge>
                        ) : (
                          <Badge className="text-[9px] px-1 bg-emerald-100 text-emerald-800">OK</Badge>
                        )}
                      </td>
                    </tr>
                  </React.Fragment>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-foreground font-bold">
                  <td className="p-2">TOTAL</td>
                  <td className="p-2"></td>
                  <td className="p-2"></td>
                  <td className="text-right p-2 text-emerald-600">
                    {formatPKR(monthlyData.reduce((s: number, m: any) => s + m.totalReceipts, 0))}
                  </td>
                  <td className="text-right p-2 text-orange-600">
                    {formatPKR(monthlyData.reduce((s: number, m: any) => s + m.totalOperationalExpenses, 0))}
                  </td>
                  <td className="text-right p-2 text-red-600">
                    {formatPKR(monthlyData.reduce((s: number, m: any) => s + m.totalExpenses, 0))}
                  </td>
                  <td className={`text-right p-2 ${data.netCashFlow >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {formatPKR(data.netCashFlow)}
                  </td>
                  <td className={`text-right p-2 ${data.forecastClosingBalance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
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
        <Card className="border-orange-200">
          <CardHeader>
            <CardTitle className="text-base text-orange-700">Shortfall Analysis Report</CardTitle>
            <CardDescription>Based on {shortfallAnalysis.profitMarginPct * 100}% margin target</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="p-4 rounded-lg bg-red-50 border border-red-200">
                <p className="text-xs text-red-600 mb-1">Total Deficit (Q85)</p>
                <p className="text-xl font-bold text-red-700">{formatPKRFull(shortfallAnalysis.totalDeficit)}</p>
                <p className="text-[10px] text-red-500 mt-1">= ABS(Q83)</p>
              </div>
              <div className="p-4 rounded-lg bg-orange-50 border border-orange-200">
                <p className="text-xs text-orange-600 mb-1">Additional Business Required (Q86)</p>
                <p className="text-xl font-bold text-orange-700">{formatPKRFull(shortfallAnalysis.additionalBusinessRequired)}</p>
                <p className="text-[10px] text-orange-500 mt-1">= IF(Q83&lt;0, ABS(Q85)/{shortfallAnalysis.profitMarginPct * 100}%, 0)</p>
              </div>
              <div className="p-4 rounded-lg bg-amber-50 border border-amber-200">
                <p className="text-xs text-amber-600 mb-1">Estimated Profit Margin (Q87)</p>
                <p className="text-xl font-bold text-amber-700">{formatPKRFull(shortfallAnalysis.profitMargin)}</p>
                <p className="text-[10px] text-amber-500 mt-1">= Q86 × {shortfallAnalysis.operationalMarginPct * 100}%</p>
              </div>
              <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200">
                <p className="text-xs text-emerald-600 mb-1">Net Balance After Recovery (Q88)</p>
                <p className={`text-xl font-bold ${shortfallAnalysis.netBalanceAfterRecovery >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                  {formatPKRFull(shortfallAnalysis.netBalanceAfterRecovery)}
                </p>
                <p className="text-[10px] text-emerald-500 mt-1">= Q87 + Q83</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Excel Logic Mapping */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Formula Reference: Excel → System Mapping</CardTitle>
          <CardDescription>How the new system replicates the original Excel calculation logic</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b-2">
                  <th className="text-left p-2 font-bold">Excel Cell</th>
                  <th className="text-left p-2 font-bold">Excel Formula</th>
                  <th className="text-left p-2 font-bold">System Logic</th>
                  <th className="text-left p-2 font-bold">Description</th>
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
                  <tr key={i} className="border-b hover:bg-muted/30">
                    <td className="p-2 font-mono font-bold text-primary">{cell}</td>
                    <td className="p-2 font-mono text-muted-foreground">{formula}</td>
                    <td className="p-2">{logic}</td>
                    <td className="p-2 text-muted-foreground">{desc}</td>
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
