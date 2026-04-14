import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const startStr = sp.get('startDate');
    const endStr = sp.get('endDate');
    if (!startStr || !endStr) return NextResponse.json({ error: 'Dates required' }, { status: 400 });

    const startDate = new Date(startStr);
    const endDate = new Date(endStr);

    const rangeMonths: { month: number; year: number }[] = [];
    const cur = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    const end = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
    while (cur <= end) {
      rangeMonths.push({ month: cur.getMonth() + 1, year: cur.getFullYear() });
      cur.setMonth(cur.getMonth() + 1);
    }
    const rangeYears = Array.from(new Set(rangeMonths.map(m => m.year)));

    const [bankAccounts, receipts, expenses, settings] = await Promise.all([
      db.bankAccount.findMany({ where: { active: true } }),
      db.receipt.findMany({ where: { year: { in: rangeYears } } }),
      db.expense.findMany({ where: { year: { in: rangeYears } } }),
      db.setting.findMany(),
    ]);

    const settingsMap: Record<string, string> = {};
    for (const s of settings) settingsMap[s.key] = s.value;
    const companyName = settingsMap.company_name || 'ECI';

    const currentBalance = bankAccounts.reduce((s, a) => s + a.currentBalance, 0);
    const rangeKeys = new Set(rangeMonths.map(m => `${m.month}-${m.year}`));

    const receiptMap = new Map<string, number>();
    const expenseMap = new Map<string, number>();
    const expectedByClient = new Map<string, { total: number; months: { month: number; year: number; amount: number }[] }>();
    const expenseByCategory = new Map<string, { total: number; monthly: Map<string, number> }>();

    for (const r of receipts) {
      const key = `${r.month}-${r.year}`;
      if (!rangeKeys.has(key)) continue;
      receiptMap.set(key, (receiptMap.get(key) || 0) + r.amount);
      if (r.status === 'Expected') {
        const existing = expectedByClient.get(r.clientProject) || { total: 0, months: [] };
        existing.total += r.amount;
        existing.months.push({ month: r.month, year: r.year, amount: r.amount });
        expectedByClient.set(r.clientProject, existing);
      }
    }

    for (const e of expenses) {
      const key = `${e.month}-${e.year}`;
      if (!rangeKeys.has(key)) continue;
      expenseMap.set(key, (expenseMap.get(key) || 0) + e.amount);
      const catKey = e.category;
      if (!expenseByCategory.has(catKey)) expenseByCategory.set(catKey, { total: 0, monthly: new Map() });
      const catData = expenseByCategory.get(catKey)!;
      catData.total += e.amount;
      catData.monthly.set(key, (catData.monthly.get(key) || 0) + e.amount);
    }

    // Build original cash flow
    let running = currentBalance;
    const originalMonthly: { month: number; year: number; closingBalance: number; isDeficit: boolean; totalReceipts: number; totalExpenses: number }[] = [];
    for (const { month, year } of rangeMonths) {
      const key = `${month}-${year}`;
      const r = receiptMap.get(key) || 0;
      const e = expenseMap.get(key) || 0;
      running = running + r - e;
      originalMonthly.push({ month, year, closingBalance: running, isDeficit: running < 0, totalReceipts: r, totalExpenses: e });
    }

    const deficitMonths = originalMonthly.filter(m => m.isDeficit);
    const totalPending = Array.from(expectedByClient.values()).reduce((s, c) => s + c.total, 0);
    const totalDeficit = deficitMonths.reduce((s, m) => s + Math.abs(m.closingBalance), 0);
    const totalRangeReceipts = Array.from(receiptMap.values()).reduce((s, v) => s + v, 0);
    const totalRangeExpenses = Array.from(expenseMap.values()).reduce((s, v) => s + v, 0);

    // Opex breakdown
    const opexByMonth = new Map<string, number>();
    const allInRangeExpenses = expenses.filter(e => rangeKeys.has(`${e.month}-${e.year}`) && e.isOperational);
    for (const e of allInRangeExpenses) {
      const key = `${e.month}-${e.year}`;
      opexByMonth.set(key, (opexByMonth.get(key) || 0) + e.amount);
    }
    const totalOpex = Array.from(opexByMonth.values()).reduce((s, v) => s + v, 0);

    // ─── Rule-based scenarios (fast, always available) ───
    const ruleBasedScenarios: { id: string; type: string; label: string; month: number; year: number; amount: number; description: string; adjustment?: string; expectedImpact: string; confidence: 'high' | 'medium' | 'low' }[] = [];
    let idx = 0;
    const now = new Date();

    // Scenario 1: Collect ALL pending receivables now
    if (totalPending > 0) {
      const nextMonth = rangeMonths.find(m => m.year >= now.getFullYear() && m.month >= now.getMonth() + 1) || rangeMonths[0];
      ruleBasedScenarios.push({
        id: `auto-${idx++}`,
        type: 'add_receipt',
        label: 'Collect All Pending Receivables',
        month: nextMonth.month,
        year: nextMonth.year,
        amount: totalPending,
        description: `Collect PKR ${totalPending.toLocaleString()} from ${expectedByClient.size} pending client(s) — moves all expected receipts to next month`,
        expectedImpact: `Adds PKR ${totalPending.toLocaleString()} to ${MONTH_NAMES[nextMonth.month - 1]} ${nextMonth.year}, potentially eliminating ${deficitMonths.length} deficit month(s)`,
        confidence: 'medium',
      });
    }

    // Scenario 2: Reduce operational costs by 15%
    if (totalOpex > 0) {
      const reduction15 = Math.round(totalOpex * 0.15);
      const firstDeficit = deficitMonths[0];
      const targetMonth = firstDeficit || rangeMonths[0];
      ruleBasedScenarios.push({
        id: `auto-${idx++}`,
        type: 'change_amount',
        label: 'Reduce Operational Costs by 15%',
        month: targetMonth.month,
        year: targetMonth.year,
        amount: reduction15,
        description: `Cut PKR ${reduction15.toLocaleString()} from operational expenses (15% of total PKR ${totalOpex.toLocaleString()})`,
        adjustment: 'decrease_expense',
        expectedImpact: `Saves PKR ${reduction15.toLocaleString()}, extends cash runway`,
        confidence: 'medium',
      });
    }

    // Scenario 3: Delay operational expenses for deficit months
    if (deficitMonths.length > 0) {
      for (const dm of deficitMonths.slice(0, 2)) {
        const key = `${dm.month}-${dm.year}`;
        const opex = opexByMonth.get(key) || 0;
        if (opex > 0) {
          ruleBasedScenarios.push({
            id: `auto-${idx++}`,
            type: 'delay_expense',
            label: `Delay OpEx in ${MONTH_NAMES[dm.month - 1]} ${dm.year}`,
            month: dm.month,
            year: dm.year,
            amount: opex,
            description: `Defer PKR ${opex.toLocaleString()} operational expenses from ${MONTH_NAMES[dm.month - 1]} ${dm.year} to the following month`,
            expectedImpact: `Could recover ${MONTH_NAMES[dm.month - 1]} ${dm.year} from deficit`,
            confidence: 'medium',
          });
        }
      }
    }

    // Scenario 4: Emergency credit line
    if (totalDeficit > 0) {
      const firstDeficit = deficitMonths[0] || rangeMonths[0];
      ruleBasedScenarios.push({
        id: `auto-${idx++}`,
        type: 'add_receipt',
        label: 'Emergency Credit Line',
        month: firstDeficit.month,
        year: firstDeficit.year,
        amount: totalDeficit,
        description: `Obtain bridge financing of PKR ${totalDeficit.toLocaleString()} to cover all ${deficitMonths.length} deficit month(s)`,
        expectedImpact: `Eliminates all deficit months`,
        confidence: 'low',
      });
    }

    // Scenario 5: Collect top pending client
    const topClient = Array.from(expectedByClient.entries()).sort((a, b) => b[1].total - a[1].total)[0];
    if (topClient && topClient[1].total > 0) {
      const nextMonth = rangeMonths.find(m => m.year >= now.getFullYear() && m.month >= now.getMonth() + 1) || rangeMonths[0];
      ruleBasedScenarios.push({
        id: `auto-${idx++}`,
        type: 'add_receipt',
        label: `Collect from ${topClient[0]}`,
        month: nextMonth.month,
        year: nextMonth.year,
        amount: topClient[1].total,
        description: `Expedite payment of PKR ${topClient[1].total.toLocaleString()} from ${topClient[0]}`,
        expectedImpact: `Single largest receivable collection`,
        confidence: 'high',
      });
    }

    // ─── AI-Enhanced Scenarios using LLM ───
    let aiScenarios: typeof ruleBasedScenarios = [];
    try {
      const aiContext = {
        companyName,
        currentBalance,
        totalPending,
        totalDeficit,
        deficitMonthsCount: deficitMonths.length,
        deficitMonths: deficitMonths.map(m => ({ month: MONTH_NAMES[m.month - 1], year: m.year, closingBalance: m.closingBalance, gap: Math.abs(m.closingBalance) })),
        totalRangeReceipts,
        totalRangeExpenses,
        totalOpex,
        cashRunwayMonths: totalRangeExpenses > 0 ? Math.floor(currentBalance / (totalRangeExpenses / rangeMonths.length)) : 999,
        topPendingClients: Array.from(expectedByClient.entries())
          .sort((a, b) => b[1].total - a[1].total)
          .slice(0, 5)
          .map(([client, data]) => ({ client, total: data.total, months: data.months.length })),
        topExpenseCategories: Array.from(expenseByCategory.entries())
          .sort((a, b) => b[1].total - a[1].total)
          .slice(0, 5)
          .map(([cat, data]) => ({ category: cat, total: data.total })),
        monthlyCashFlow: originalMonthly.map(m => ({
          month: MONTH_NAMES[m.month - 1],
          year: m.year,
          receipts: m.totalReceipts,
          expenses: m.totalExpenses,
          closing: m.closingBalance,
          isDeficit: m.isDeficit,
        })),
        existingScenarios: ruleBasedScenarios.map(s => ({ label: s.label, amount: s.amount, type: s.type })),
      };

      const zai = await ZAI.create();
      const completion = await zai.chat.completions.create({
        model: 'default',
        messages: [
          {
            role: 'system',
            content: `You are a senior financial strategist for ${companyName}, a Pakistani development consultancy. Analyze the cash flow data and suggest 3 additional smart what-if scenarios that are NOT already covered by the existing scenarios.

Your scenarios should be:
- Specific to the actual data (reference actual client names, amounts, months)
- Actionable and realistic for a consultancy firm
- Different from existing scenarios already listed
- Focus on high-impact changes

Return ONLY a valid JSON array (no markdown, no code fences) of scenario objects with these exact fields:
- "label": string (short title, max 50 chars)
- "type": one of "add_receipt", "remove_expense", "delay_expense", "decrease_expense"
- "month": number (1-12)
- "year": number
- "amount": number (positive integer, PKR)
- "description": string (1-2 sentences explaining the scenario)
- "adjustment": optional string ("decrease_expense" if type is decrease_expense)
- "expectedImpact": string (brief impact description)

Example: [{"label":"Negotiate 10% salary deferment","type":"decrease_expense","month":7,"year":2026,"amount":250000,"description":"Defer 10% of salaries for July","adjustment":"decrease_expense","expectedImpact":"Saves PKR 250,000"}]

IMPORTANT: Return ONLY the JSON array, nothing else.`,
          },
          {
            role: 'user',
            content: JSON.stringify(aiContext, null, 2),
          },
        ],
        max_tokens: 1500,
        temperature: 0.7,
      });

      const aiContent = completion.choices?.[0]?.message?.content || '';
      // Parse AI response - extract JSON from potential markdown code fences
      const jsonMatch = aiContent.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsed)) {
          aiScenarios = parsed
            .filter((s: any) => s.label && s.type && s.month && s.year && s.amount > 0)
            .map((s: any, i: number) => ({
              id: `ai-${Date.now()}-${i}`,
              type: s.type || 'add_receipt',
              label: String(s.label).slice(0, 60),
              month: parseInt(s.month) || 1,
              year: parseInt(s.year) || new Date().getFullYear(),
              amount: Math.round(Number(s.amount)) || 0,
              description: String(s.description || ''),
              adjustment: s.type === 'decrease_expense' ? 'decrease_expense' : s.type === 'increase_receipt' ? 'increase_receipt' : undefined,
              expectedImpact: String(s.expectedImpact || ''),
              confidence: 'medium' as const,
            }))
            .filter((s: any) => s.amount > 0)
            .slice(0, 3);
        }
      }
    } catch (aiError) {
      console.error('AI scenario generation failed, using rule-based only:', aiError);
    }

    // Combine: rule-based first, then AI-enhanced (dedup by label similarity)
    const allScenarios = [...ruleBasedScenarios];
    const existingLabels = new Set(ruleBasedScenarios.map(s => s.label.toLowerCase()));
    for (const ai of aiScenarios) {
      if (!existingLabels.has(ai.label.toLowerCase())) {
        allScenarios.push(ai);
        existingLabels.add(ai.label.toLowerCase());
      }
    }

    return NextResponse.json({
      scenarios: allScenarios.slice(0, 8),
      summary: {
        currentBalance,
        totalPending,
        totalDeficit,
        deficitMonthsCount: deficitMonths.length,
        scenarioCount: allScenarios.length,
        aiGeneratedCount: aiScenarios.length,
        ruleBasedCount: ruleBasedScenarios.length,
      },
    });
  } catch (error) {
    console.error('Auto-scenarios error:', error);
    return NextResponse.json({ error: 'Failed to generate auto scenarios' }, { status: 500 });
  }
}
