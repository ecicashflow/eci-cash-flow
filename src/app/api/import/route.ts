import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

// Operational expense categories - exact match (including common Excel variants)
const OPERATIONAL_CATEGORIES = new Set([
  'Markup',
  'Directors Life Insurance',
  'Electricity',
  'Freight Expenses',
  'Generator - Maintenance & Fuel',
  'Newspaper & Periodical',
  'Office Refreshment /Janitorial',
  'TMS Monthly Cost',
  'Chat GBT/Adobe and TMS',
  'Chat GBT/Adobee and TMS',
  'Zoom and Google Drive',
  'Rent Exp',
  'Rent Exp ',
  'Petty Cash',
  'Salaries and Staff Transportation and Management Allowances',
  'Bonus/Staff Benefits',
  'Medical Exp',
  'EOBI',
  'Equipment Maintenance',
  'Repair & Maintenance',
  'Stationery & Printing Exp',
  'Charity',
  'Charity ',
  'Misc. Exp',
  'Web Developing, Hosting and Subscription',
  'Web Developing Hosting and Subscription',
  'Water Charges',
  'Warer Charges',
  'Telephone and Internet',
]);

// Month columns: D=Apr through O=Mar (0-based indices 3 through 14)
const MONTH_COL_INDICES = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
const MONTH_NUMBERS = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3];

/**
 * Parse the financial year period string from Row 2.
 * E.g., "April, 2026 - March, 2027" => { startYear: 2026, startMonth: 4, endYear: 2027, endMonth: 3 }
 */
function parsePeriod(periodStr: string): { startYear: number; startMonth: number; endYear: number; endMonth: number } {
  // Try pattern: "April, 2026 - March, 2027" or similar
  const match = periodStr.match(/(\w+)\s*,?\s*(\d{4})\s*[-–]\s*(\w+)\s*,?\s*(\d{4})/i);
  if (match) {
    const startYear = parseInt(match[2], 10);
    const endYear = parseInt(match[4], 10);
    return { startYear, startMonth: 4, endYear, endMonth: 3 };
  }

  // Fallback: try to find a 4-digit year
  const yearMatch = periodStr.match(/(\d{4})/);
  if (yearMatch) {
    const startYear = parseInt(yearMatch[1], 10);
    return { startYear, startMonth: 4, endYear: startYear + 1, endMonth: 3 };
  }

  // Ultimate fallback: current year
  const now = new Date();
  const currentYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return { startYear: currentYear, startMonth: 4, endYear: currentYear + 1, endMonth: 3 };
}

/**
 * Build the array of {month, year} for the 12 months of the financial year.
 */
function buildFinancialYearMonths(startYear: number): Array<{ month: number; year: number }> {
  return MONTH_NUMBERS.map((m, i) => {
    // Months Apr(4)-Dec(12) belong to startYear, Jan(1)-Mar(3) belong to startYear+1
    const year = i < 9 ? startYear : startYear + 1;
    return { month: m, year };
  });
}

/**
 * Get a numeric value from a cell, handling '-' and other non-numeric values.
 */
function getNumericValue(cell: unknown): number {
  if (cell === undefined || cell === null || cell === '') return 0;
  if (typeof cell === 'number') return cell;
  if (typeof cell === 'string') {
    if (cell.trim() === '-' || cell.trim() === '') return 0;
    const parsed = parseFloat(cell.replace(/,/g, ''));
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

/**
 * Get a string value from a cell.
 */
function getStringValue(cell: unknown): string {
  if (cell === undefined || cell === null) return '';
  return String(cell).trim();
}

/**
 * Parse bank account details from column C string.
 * E.g., "Bank Al Falah # 0234-1004781004 (G-11 Markaz)"
 * => { bankName: "Bank Al Falah", accountNumber: "0234-1004781004", accountName: "G-11 Markaz" }
 */
function parseBankAccountDetails(detail: string): { bankName: string; accountNumber: string; accountName: string } {
  let bankName = '';
  let accountNumber = '';
  let accountName = '';

  // Try to extract account number after '#'
  const hashMatch = detail.match(/#\s*([\d\-]+)/);
  if (hashMatch) {
    accountNumber = hashMatch[1];
    // Bank name is everything before the #
    bankName = detail.substring(0, detail.indexOf('#')).trim();
    // Account name is in parentheses after the account number
    const parenMatch = detail.match(/\(([^)]+)\)/);
    if (parenMatch) {
      accountName = parenMatch[1].trim();
    }
  } else {
    // No account number found - try parentheses for account name
    const parenMatch = detail.match(/\(([^)]+)\)/);
    if (parenMatch) {
      accountName = parenMatch[1].trim();
      bankName = detail.substring(0, detail.indexOf('(')).trim();
    } else {
      bankName = detail.trim();
    }
  }

  return { bankName, accountNumber, accountName };
}

export async function POST(req: NextRequest) {
  try {
    // 1. Read the file from FormData
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      return NextResponse.json({ error: 'Invalid file type. Only .xlsx and .xls files are accepted.' }, { status: 400 });
    }

    const fileBuffer = await file.arrayBuffer();

    // 2. Parse with XLSX
    const workbook = XLSX.read(fileBuffer, { type: 'array' });

    // Find the Cash Flow sheet
    const sheetName = workbook.SheetNames.find(
      (name) => name.toLowerCase().includes('cash flow')
    );
    if (!sheetName) {
      return NextResponse.json(
        { error: 'Could not find "Cash Flow" sheet in the workbook. Available sheets: ' + workbook.SheetNames.join(', ') },
        { status: 400 }
      );
    }

    const sheet = workbook.Sheets[sheetName];
    // Convert to array of arrays (header:1 gives rows as arrays)
    const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    // Validate title in Row 1 (index 0)
    const titleRow = rows[0];
    const title = getStringValue(titleRow?.[0]);
    if (!title.toLowerCase().includes('eci') && !title.toLowerCase().includes('cash flow')) {
      return NextResponse.json(
        { error: 'Invalid Excel format. Row 1 should contain "ECI - Cash Flow Statement" title.' },
        { status: 400 }
      );
    }

    // 3. Parse period from Row 2 (index 1)
    const periodStr = getStringValue(rows[1]?.[0]);
    const { startYear } = parsePeriod(periodStr);
    const fyMonths = buildFinancialYearMonths(startYear);

    // 3. Clear all existing data (in order due to potential dependencies)
    await db.receipt.deleteMany({});
    await db.expense.deleteMany({});
    await db.bankAccount.deleteMany({});
    await db.category.deleteMany({});
    await db.projectClient.deleteMany({});

    // 4. Extract and insert bank accounts (rows 6-8, 0-based indices 5-7)
    const bankAccountData: Array<{
      bankName: string;
      accountName: string;
      accountNumber: string;
      currentBalance: number;
    }> = [];

    for (let rowIdx = 5; rowIdx <= 7; rowIdx++) {
      const row = rows[rowIdx];
      if (!row) continue;

      const detail = getStringValue(row[2]); // Column C
      if (!detail || detail === '-') continue;

      const balance = getNumericValue(row[14]); // Column O
      const parsed = parseBankAccountDetails(detail);

      // Only add if we have a meaningful bank name
      if (parsed.bankName) {
        bankAccountData.push({
          bankName: parsed.bankName,
          accountName: parsed.accountName || parsed.bankName,
          accountNumber: parsed.accountNumber || '',
          currentBalance: balance,
        });
      }
    }

    let bankAccountsCount = 0;
    if (bankAccountData.length > 0) {
      const result = await db.bankAccount.createMany({
        data: bankAccountData,
      });
      bankAccountsCount = result.count;
    }

    // 5. Extract and insert receipts (rows 13-36, 0-based indices 12-35)
    const receiptData: Array<{
      date: Date;
      month: number;
      year: number;
      clientProject: string;
      description: string;
      amount: number;
      status: string;
      notes: string;
    }> = [];

    const receiptClientNames: Set<string> = new Set();

    for (let rowIdx = 12; rowIdx <= 35; rowIdx++) {
      const row = rows[rowIdx];
      if (!row) continue;

      const clientName = getStringValue(row[2]); // Column C
      if (!clientName || clientName === '-') continue;

      // Track unique client names
      receiptClientNames.add(clientName);

      const remarks = getStringValue(row[16]); // Column Q

      // Iterate over each month column
      for (let m = 0; m < 12; m++) {
        const colIdx = MONTH_COL_INDICES[m];
        const amount = getNumericValue(row[colIdx]);

        if (amount > 0) {
          const { month, year } = fyMonths[m];
          // Create date as the 1st of the month
          const date = new Date(year, month - 1, 1);

          receiptData.push({
            date,
            month,
            year,
            clientProject: clientName,
            description: '',
            amount,
            status: 'Expected',
            notes: remarks || '',
          });
        }
      }
    }

    let receiptsCount = 0;
    if (receiptData.length > 0) {
      const result = await db.receipt.createMany({
        data: receiptData,
      });
      receiptsCount = result.count;
    }

    // 6. Extract and insert expenses (rows 42-79, 0-based indices 41-78)
    const expenseData: Array<{
      date: Date;
      month: number;
      year: number;
      category: string;
      description: string;
      amount: number;
      project: string;
      status: string;
      notes: string;
      isOperational: boolean;
    }> = [];

    const expenseCategoryNames: Set<string> = new Set();

    for (let rowIdx = 41; rowIdx <= 78; rowIdx++) {
      const row = rows[rowIdx];
      if (!row) continue;

      const categoryName = getStringValue(row[2]); // Column C
      if (!categoryName || categoryName === '-') continue;

      // Skip total/summary rows
      if (categoryName.toLowerCase().includes('total') || categoryName.toLowerCase().includes('expected')) {
        continue;
      }

      // Clean up trailing whitespace from category name
      const cleanCategoryName = categoryName.trim();

      // Track unique category names
      expenseCategoryNames.add(cleanCategoryName);

      const isOperational = OPERATIONAL_CATEGORIES.has(cleanCategoryName) || OPERATIONAL_CATEGORIES.has(categoryName);
      const remarks = getStringValue(row[16]); // Column Q

      // Iterate over each month column
      for (let m = 0; m < 12; m++) {
        const colIdx = MONTH_COL_INDICES[m];
        const amount = getNumericValue(row[colIdx]);

        if (amount > 0) {
          const { month, year } = fyMonths[m];
          // Create date as the 1st of the month
          const date = new Date(year, month - 1, 1);

          expenseData.push({
            date,
            month,
            year,
            category: cleanCategoryName,
            description: cleanCategoryName,
            amount,
            project: '',
            status: 'Expected',
            notes: remarks || '',
            isOperational,
          });
        }
      }
    }

    let expensesCount = 0;
    if (expenseData.length > 0) {
      const result = await db.expense.createMany({
        data: expenseData,
      });
      expensesCount = result.count;
    }

    // 7. Auto-generate categories from expense heads and receipt clients
    const categoryData: Array<{
      name: string;
      type: string;
      active: boolean;
      isOperational: boolean;
    }> = [];

    // Add expense categories
    for (const catName of expenseCategoryNames) {
      categoryData.push({
        name: catName,
        type: 'expense',
        active: true,
        isOperational: OPERATIONAL_CATEGORIES.has(catName),
      });
    }

    // Add receipt categories (client projects)
    for (const clientName of receiptClientNames) {
      categoryData.push({
        name: clientName,
        type: 'receipt',
        active: true,
        isOperational: false,
      });
    }

    let categoriesCount = 0;
    if (categoryData.length > 0) {
      const result = await db.category.createMany({
        data: categoryData,
      });
      categoriesCount = result.count;
    }

    // 8. Auto-generate project clients from receipt clients
    const projectClientData: Array<{
      name: string;
      code: string;
      active: boolean;
    }> = [];

    for (const clientName of receiptClientNames) {
      projectClientData.push({
        name: clientName,
        code: '',
        active: true,
      });
    }

    let projectsCount = 0;
    if (projectClientData.length > 0) {
      const result = await db.projectClient.createMany({
        data: projectClientData,
      });
      projectsCount = result.count;
    }

    // 9. Update settings (financial_year_start, financial_year_end)
    const fyStartStr = `${startYear}-04-01`;
    const fyEndStr = `${startYear + 1}-03-31`;

    await db.setting.upsert({
      where: { key: 'financial_year_start' },
      update: { value: fyStartStr },
      create: { key: 'financial_year_start', value: fyStartStr },
    });

    await db.setting.upsert({
      where: { key: 'financial_year_end' },
      update: { value: fyEndStr },
      create: { key: 'financial_year_end', value: fyEndStr },
    });

    await db.setting.upsert({
      where: { key: 'financial_year_label' },
      update: { value: `April, ${startYear} - March, ${startYear + 1}` },
      create: { key: 'financial_year_label', value: `April, ${startYear} - March, ${startYear + 1}` },
    });

    await db.setting.upsert({
      where: { key: 'last_import_date' },
      update: { value: new Date().toISOString() },
      create: { key: 'last_import_date', value: new Date().toISOString() },
    });

    // 10. Return JSON summary
    return NextResponse.json({
      success: true,
      bankAccounts: bankAccountsCount,
      receipts: receiptsCount,
      expenses: expensesCount,
      categories: categoriesCount,
      projects: projectsCount,
      financialYear: `April, ${startYear} - March, ${startYear + 1}`,
    });
  } catch (error) {
    console.error('Import API error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json(
      { error: 'Import failed: ' + errorMessage },
      { status: 500 }
    );
  }
}
