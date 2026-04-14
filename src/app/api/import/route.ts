import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

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

/**
 * Resolve a month name (full or short) to month number 1-12.
 */
function resolveMonth(name: string): number {
  const n = name.trim().toLowerCase();
  for (let i = 0; i < 12; i++) {
    if (MONTH_FULL[i].toLowerCase() === n || MONTH_SHORT[i].toLowerCase() === n) return i + 1;
  }
  return 0;
}

/**
 * Parse the period string from Row 2.
 * Supports flexible formats:
 *   "April, 2026 - March, 2027"
 *   "June, 2026 - May, 2027"
 *   "Apr 2026 - Mar 2027"
 *   etc.
 */
function parsePeriod(periodStr: string): { startMonth: number; startYear: number; endMonth: number; endYear: number } {
  // Try pattern: "MonthName, YYYY - MonthName, YYYY" or "MonthName YYYY - MonthName YYYY"
  const match = periodStr.match(/(\w+)\s*,?\s*(\d{4})\s*[-–]\s*(\w+)\s*,?\s*(\d{4})/i);
  if (match) {
    const startMonth = resolveMonth(match[1]);
    const startYear = parseInt(match[2], 10);
    const endMonth = resolveMonth(match[3]);
    const endYear = parseInt(match[4], 10);
    if (startMonth && endMonth) return { startMonth, startYear, endMonth, endYear };
  }

  // Fallback: try to find a 4-digit year and assume standard FY (Apr-Mar)
  const yearMatch = periodStr.match(/(\d{4})/);
  if (yearMatch) {
    const startYear = parseInt(yearMatch[1], 10);
    return { startMonth: 4, startYear, endMonth: 3, endYear: startYear + 1 };
  }

  // Ultimate fallback: current financial year
  const now = new Date();
  const currentYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return { startMonth: 4, startYear: currentYear, endMonth: 3, endYear: currentYear + 1 };
}

/**
 * Build the array of {month, year} for each month in the range.
 */
function buildMonthRange(startMonth: number, startYear: number, endMonth: number, endYear: number): Array<{ month: number; year: number }> {
  const months: Array<{ month: number; year: number }> = [];
  let m = startMonth;
  let y = startYear;
  let limit = 36;
  while (limit-- > 0) {
    months.push({ month: m, year: y });
    if (m === endMonth && y === endYear) break;
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return months;
}

/**
 * Detect the month columns from a header row.
 * Reads the header row, looks at each column value, and tries to match it to a month name.
 * Returns an array of { colIndex, month, year } for each detected month column.
 */
function detectMonthColumns(headerRow: unknown[], periodMonths: Array<{ month: number; year: number }>): Array<{ colIndex: number; month: number; year: number }> {
  const result: Array<{ colIndex: number; month: number; year: number }> = [];

  // First, try to match month names in the header row against the period months
  let monthIdx = 0;
  for (let colIdx = 3; colIdx < headerRow.length && monthIdx < periodMonths.length; colIdx++) {
    const cellVal = getStringValue(headerRow[colIdx]).trim();
    const resolvedM = resolveMonth(cellVal);
    if (resolvedM && resolvedM === periodMonths[monthIdx].month) {
      result.push({ colIndex: colIdx, month: periodMonths[monthIdx].month, year: periodMonths[monthIdx].year });
      monthIdx++;
    } else if (cellVal === '' || cellVal === '-') {
      // skip empty columns
      continue;
    } else {
      // Not a month name - might be "Total/Remarks" or similar, stop
      break;
    }
  }

  // If we detected some months, return them
  if (result.length > 0) return result;

  // Fallback: assume columns D onwards map to period months in order (standard Apr→Mar format)
  for (let i = 0; i < periodMonths.length; i++) {
    result.push({ colIndex: 3 + i, month: periodMonths[i].month, year: periodMonths[i].year });
  }
  return result;
}

/**
 * Get a numeric value from a cell, handling '-' and other non-numeric values.
 * Rounds to nearest integer.
 */
function getNumericValue(cell: unknown): number {
  if (cell === undefined || cell === null || cell === '') return 0;
  if (typeof cell === 'number') return Math.round(cell);
  if (typeof cell === 'string') {
    if (cell.trim() === '-' || cell.trim() === '') return 0;
    const parsed = parseFloat(cell.replace(/,/g, ''));
    return isNaN(parsed) ? 0 : Math.round(parsed);
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
 */
function parseBankAccountDetails(detail: string): { bankName: string; accountNumber: string; accountName: string } {
  let bankName = '';
  let accountNumber = '';
  let accountName = '';

  const hashMatch = detail.match(/#\s*([\d\-]+)/);
  if (hashMatch) {
    accountNumber = hashMatch[1];
    bankName = detail.substring(0, detail.indexOf('#')).trim();
    const parenMatch = detail.match(/\(([^)]+)\)/);
    if (parenMatch) {
      accountName = parenMatch[1].trim();
    }
  } else {
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

/**
 * Generate a short code from a project/client name.
 */
function generateProjectCode(name: string): string {
  const cleaned = name.replace(/\b(and|the|of|for|in|&)\b/gi, '').trim();
  const dashMatch = cleaned.match(/^([A-Z]+)\s*[-–]\s*(.+)/);
  if (dashMatch) {
    const prefix = dashMatch[1];
    const suffix = dashMatch[2];
    const suffixParts = suffix.split(/\s+/).filter(p => p.length > 0);
    const suffixCode = suffixParts.map(p => p.charAt(0).toUpperCase()).join('');
    return `${prefix}-${suffixCode}`;
  }
  const words = cleaned.split(/\s+/).filter(w => w.length > 0);
  if (words.length <= 2) {
    return words.map(w => w.substring(0, 3).toUpperCase()).join('');
  }
  return words.map(w => w.charAt(0).toUpperCase()).join('').substring(0, 8);
}

/**
 * Match an expense category name to a project name from receipt clients.
 */
function matchExpenseToProject(categoryName: string, receiptClientNames: Set<string>): string {
  if (receiptClientNames.has(categoryName)) return categoryName;
  const normalize = (s: string) => s.replace(/[-()]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
  const normalizedCategory = normalize(categoryName);
  for (const clientName of receiptClientNames) {
    if (normalize(clientName) === normalizedCategory) return clientName;
  }
  for (const clientName of receiptClientNames) {
    const nc = normalize(clientName);
    if (normalizedCategory.includes(nc) || nc.includes(normalizedCategory)) return clientName;
  }
  return '';
}

/**
 * Find a section start row by looking for a header row containing the section marker text.
 */
function findSectionHeader(rows: unknown[][], marker: string): number {
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    const cellC = getStringValue(row[2]).toUpperCase();
    const cellA = getStringValue(row[0]).toUpperCase();
    if (cellC.includes(marker) || cellA.includes(marker)) return i;
  }
  return -1;
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

    // 3. Parse period from Row 2 (index 1) - FLEXIBLE range
    const periodStr = getStringValue(rows[1]?.[0]);
    const { startMonth, startYear, endMonth, endYear } = parsePeriod(periodStr);
    const periodMonths = buildMonthRange(startMonth, startYear, endMonth, endYear);

    // 4. Detect month columns from the header row (row index 3, which is row 4 in Excel)
    // Try multiple header rows to find the one with month names
    let monthColumns: Array<{ colIndex: number; month: number; year: number }> = [];
    for (let headerRowIdx = 3; headerRowIdx <= 12; headerRowIdx++) {
      const headerRow = rows[headerRowIdx];
      if (!headerRow) continue;
      const detected = detectMonthColumns(headerRow, periodMonths);
      if (detected.length > 0) {
        monthColumns = detected;
        break;
      }
    }

    if (monthColumns.length === 0) {
      return NextResponse.json(
        { error: 'Could not detect month columns in the Excel file. Ensure the header row contains month names (Apr, May, Jun, etc.).' },
        { status: 400 }
      );
    }

    // 5. Find section headers early for validation
    const bankHeaderIdx = findSectionHeader(rows, 'BANK ACCOUNTS');
    const receiptHeaderIdx = findSectionHeader(rows, 'EXPECTED RECEIPTS');
    const expenseHeaderIdx = findSectionHeader(rows, 'EXPECTED EXPENSES');

    // ─── VALIDATION: Check for errors before importing ───
    const validationErrors: { row: number; column: string; error: string; value: string; suggestion: string }[] = [];

    // Check if bank section exists
    if (bankHeaderIdx < 0) {
      validationErrors.push({
        row: 0,
        column: 'C',
        error: 'Missing "BANK ACCOUNTS" section',
        value: '',
        suggestion: 'Add a row with "BANK ACCOUNTS" in Column C after the period row',
      });
    }

    // Check if receipts section exists
    if (receiptHeaderIdx < 0) {
      validationErrors.push({
        row: 0,
        column: 'C',
        error: 'Missing "EXPECTED RECEIPTS" section',
        value: '',
        suggestion: 'Add a row with "EXPECTED RECEIPTS" in Column C',
      });
    }

    // Check if expenses section exists
    if (expenseHeaderIdx < 0) {
      validationErrors.push({
        row: 0,
        column: 'C',
        error: 'Missing "EXPECTED EXPENSES" section',
        value: '',
        suggestion: 'Add a row with "EXPECTED EXPENSES" in Column C',
      });
    }

    // Check month column data for non-numeric values
    let dataRowStart = Math.max(bankHeaderIdx + 1, 0);
    for (let rowIdx = dataRowStart; rowIdx < rows.length; rowIdx++) {
      const row = rows[rowIdx];
      if (!row) continue;
      const colC = getStringValue(row[2]);
      if (!colC || colC === '-') continue;
      // Skip header/total rows
      if (colC.toLowerCase().includes('total') || colC.toLowerCase().includes('opening') || colC.toLowerCase().includes('forecast')) continue;

      for (const mc of monthColumns) {
        const cellVal = row[mc.colIndex];
        const cellStr = getStringValue(cellVal);
        if (cellStr && cellStr !== '' && cellStr !== '-') {
          const numVal = getNumericValue(cellVal);
          if (numVal === 0 && cellStr !== '0' && cellStr !== '0.00') {
            validationErrors.push({
              row: rowIdx + 1,
              column: `${MONTH_FULL[mc.month - 1]} ${mc.year}`,
              error: 'Non-numeric value in data cell',
              value: cellStr,
              suggestion: `Row ${rowIdx + 1}, ${colC}: Replace "${cellStr}" with a number like 500000`,
            });
          }
        }
      }
    }

    // ─── ENHANCED VALIDATION: Detailed row/column-level checks ───
    // Helper: convert column index to Excel column letter
    function colLetter(idx: number): string {
      let s = '';
      let n = idx;
      while (n >= 0) {
        s = String.fromCharCode(65 + (n % 26)) + s;
        n = Math.floor(n / 26) - 1;
      }
      return s;
    }

    // Check 1: Validate that month columns contain numeric data in receipt/expense rows
    if (receiptHeaderIdx >= 0) {
      for (let rowIdx = receiptHeaderIdx + 1; rowIdx < rows.length; rowIdx++) {
        const row = rows[rowIdx];
        if (!row) continue;
        const clientName = getStringValue(row[2]);
        if (!clientName || clientName === '-' || clientName.toLowerCase().includes('total') || clientName.toLowerCase().includes('expected expenses')) break;

        // Check for missing/empty category name (Column C)
        if (clientName.trim() === '') {
          validationErrors.push({
            row: rowIdx + 1,
            column: 'C',
            error: 'Missing client/project name in receipt row',
            value: '',
            suggestion: `Row ${rowIdx + 1}: Enter a client or project name in Column C`,
          });
        }

        for (const mc of monthColumns) {
          const cellVal = row[mc.colIndex];
          const cellStr = getStringValue(cellVal);
          if (cellStr && cellStr !== '' && cellStr !== '-') {
            // Check for negative amounts
            const numVal = getNumericValue(cellVal);
            if (typeof cellVal === 'string' && cellVal.trim().startsWith('-') && numVal !== 0) {
              validationErrors.push({
                row: rowIdx + 1,
                column: colLetter(mc.colIndex),
                error: 'Negative amount in receipt row (receipts should not be negative)',
                value: cellStr,
                suggestion: `Row ${rowIdx + 1}, Column ${colLetter(mc.colIndex)} (${MONTH_FULL[mc.month - 1]} ${mc.year}): Negative receipt amount "${cellStr}" for "${clientName}". Verify the amount is correct.`,
              });
            }
          }
        }
      }
    }

    if (expenseHeaderIdx >= 0) {
      for (let rowIdx = expenseHeaderIdx + 1; rowIdx < rows.length; rowIdx++) {
        const row = rows[rowIdx];
        if (!row) continue;
        const categoryName = getStringValue(row[2]);
        if (!categoryName || categoryName === '-' || categoryName.toLowerCase().includes('total') || categoryName.toLowerCase().includes('forecast')) break;
        if (categoryName.toLowerCase().includes('total')) continue;

        // Check for missing/empty category name (Column C)
        if (categoryName.trim() === '') {
          validationErrors.push({
            row: rowIdx + 1,
            column: 'C',
            error: 'Missing expense category name',
            value: '',
            suggestion: `Row ${rowIdx + 1}: Enter an expense category name in Column C`,
          });
        }

        for (const mc of monthColumns) {
          const cellVal = row[mc.colIndex];
          const cellStr = getStringValue(cellVal);
          if (cellStr && cellStr !== '' && cellStr !== '-') {
            // Check for negative amounts in expense rows
            const numVal = getNumericValue(cellVal);
            if (typeof cellVal === 'string' && cellVal.trim().startsWith('-') && numVal !== 0) {
              validationErrors.push({
                row: rowIdx + 1,
                column: colLetter(mc.colIndex),
                error: 'Negative amount in expense row (expenses should be positive values)',
                value: cellStr,
                suggestion: `Row ${rowIdx + 1}, Column ${colLetter(mc.colIndex)} (${MONTH_FULL[mc.month - 1]} ${mc.year}): Negative expense amount "${cellStr}" for "${categoryName}". Use positive values for expenses.`,
              });
            }
          }
        }
      }
    }

    // Check 2: Validate bank account section has at least one account with a valid balance
    if (bankHeaderIdx >= 0) {
      let bankAccountsFound = 0;
      let bankWithZeroBalance = 0;
      for (let rowIdx = bankHeaderIdx + 1; rowIdx <= bankHeaderIdx + 5 && rowIdx < rows.length; rowIdx++) {
        const row = rows[rowIdx];
        if (!row) continue;
        const detail = getStringValue(row[2]);
        if (!detail || detail === '-' || detail === '') continue;
        if (detail.toLowerCase().includes('opening')) break;

        const lastMonthCol = monthColumns.length > 0 ? monthColumns[monthColumns.length - 1].colIndex : 14;
        const balanceCol = lastMonthCol + 1;
        const balanceFromRemarks = getNumericValue(row[balanceCol]);
        const balanceFromLastMonth = getNumericValue(row[lastMonthCol]);
        const balance = balanceFromRemarks > 0 ? balanceFromRemarks : balanceFromLastMonth;

        bankAccountsFound++;
        if (balance === 0) {
          bankWithZeroBalance++;
          validationErrors.push({
            row: rowIdx + 1,
            column: colLetter(balanceFromRemarks > 0 ? balanceCol : lastMonthCol),
            error: 'Bank account has zero balance — verify the balance column',
            value: detail,
            suggestion: `Row ${rowIdx + 1}: Bank account "${detail}" has no balance. Ensure the balance is in Column ${colLetter(balanceFromRemarks > 0 ? balanceCol : lastMonthCol)}.`,
          });
        }
      }
      if (bankAccountsFound === 0) {
        validationErrors.push({
          row: bankHeaderIdx + 2,
          column: 'C',
          error: 'No bank account entries found in BANK ACCOUNTS section',
          value: '',
          suggestion: `After the "BANK ACCOUNTS" header (Row ${bankHeaderIdx + 1}), add bank account entries in Column C with their balances.`,
        });
      }
    }

    // Check 3: Validate month columns have at least some numeric data
    for (const mc of monthColumns) {
      let hasAnyData = false;
      let hasAnyNumeric = false;
      for (let rowIdx = Math.max(receiptHeaderIdx + 1, expenseHeaderIdx + 1, bankHeaderIdx + 1); rowIdx < rows.length; rowIdx++) {
        const row = rows[rowIdx];
        if (!row) continue;
        const cellVal = row[mc.colIndex];
        const cellStr = getStringValue(cellVal);
        if (cellStr && cellStr !== '' && cellStr !== '-') {
          hasAnyData = true;
          const numVal = getNumericValue(cellVal);
          if (numVal !== 0 || cellStr === '0' || cellStr === '0.00') {
            hasAnyNumeric = true;
          }
        }
      }
      if (hasAnyData && !hasAnyNumeric) {
        validationErrors.push({
          row: 0,
          column: colLetter(mc.colIndex),
          error: `Column ${colLetter(mc.colIndex)} (${MONTH_FULL[mc.month - 1]} ${mc.year}) contains data but no valid numeric values`,
          value: '',
          suggestion: `Column ${colLetter(mc.colIndex)} should contain numeric amounts. Check that cells contain numbers, not text.`,
        });
      }
    }

    // If there are validation errors, return them WITHOUT importing
    if (validationErrors.length > 0) {
      return NextResponse.json({
        success: false,
        validationErrors,
        errorCount: validationErrors.length,
        message: `Found ${validationErrors.length} error(s) in your Excel file. Please fix them and try again.`,
      }, { status: 422 });
    }

    // 6. Clear all existing data
    await db.receipt.deleteMany({});
    await db.expense.deleteMany({});
    await db.bankAccount.deleteMany({});
    await db.category.deleteMany({});
    await db.projectClient.deleteMany({});

    // 7. Extract and insert bank accounts
    const bankAccountData: Array<{
      bankName: string;
      accountName: string;
      accountNumber: string;
      currentBalance: number;
    }> = [];

    if (bankHeaderIdx >= 0) {
      // Read bank account rows (typically 3 rows after the header)
      for (let rowIdx = bankHeaderIdx + 1; rowIdx <= bankHeaderIdx + 5 && rowIdx < rows.length; rowIdx++) {
        const row = rows[rowIdx];
        if (!row) continue;

        const detail = getStringValue(row[2]); // Column C
        if (!detail || detail === '-' || detail === '') continue;

        // Stop if we hit the opening balance row
        if (detail.toLowerCase().includes('opening')) break;

        // The balance is in the last month column, or fallback to the last data column
        let balance = 0;
        // Try to get balance from the last month column (or from column O for standard 12-month)
        const lastMonthCol = monthColumns.length > 0 ? monthColumns[monthColumns.length - 1].colIndex : 14;
        // Also check if there's a "Total/Remarks" column after the months
        const balanceCol = lastMonthCol + 1;
        // Try the column after months first (Total/Remarks), then the last month column
        const balanceFromRemarks = getNumericValue(row[balanceCol]);
        if (balanceFromRemarks > 0) {
          balance = balanceFromRemarks;
        } else {
          // Sum all month columns for bank balance, or use the last column value
          balance = getNumericValue(row[lastMonthCol]);
        }

        const parsed = parseBankAccountDetails(detail);
        if (parsed.bankName) {
          bankAccountData.push({
            bankName: parsed.bankName,
            accountName: parsed.accountName || parsed.bankName,
            accountNumber: parsed.accountNumber || '',
            currentBalance: balance,
          });
        }
      }
    }

    let bankAccountsCount = 0;
    if (bankAccountData.length > 0) {
      const result = await db.bankAccount.createMany({ data: bankAccountData });
      bankAccountsCount = result.count;
    }

    // 7. Extract and insert receipts
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

    if (receiptHeaderIdx >= 0) {
      for (let rowIdx = receiptHeaderIdx + 1; rowIdx < rows.length; rowIdx++) {
        const row = rows[rowIdx];
        if (!row) continue;

        const clientName = getStringValue(row[2]);
        // Stop at total row or next section
        if (!clientName || clientName === '-' || clientName.toLowerCase().includes('total expected') || clientName.toLowerCase().includes('expected expenses')) break;

        receiptClientNames.add(clientName);

        // Find remarks column - it's after the last month column
        const lastMonthCol = monthColumns.length > 0 ? monthColumns[monthColumns.length - 1].colIndex : 14;
        const remarksCol = lastMonthCol + 1;
        const remarks = getStringValue(row[remarksCol]);

        for (const mc of monthColumns) {
          const amount = getNumericValue(row[mc.colIndex]);
          if (amount > 0) {
            const date = new Date(mc.year, mc.month - 1, 1);
            receiptData.push({
              date,
              month: mc.month,
              year: mc.year,
              clientProject: clientName,
              description: '',
              amount,
              status: 'Expected',
              notes: remarks || '',
            });
          }
        }
      }
    }

    let receiptsCount = 0;
    if (receiptData.length > 0) {
      const result = await db.receipt.createMany({ data: receiptData });
      receiptsCount = result.count;
    }

    // 8. Extract and insert expenses
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

    if (expenseHeaderIdx >= 0) {
      for (let rowIdx = expenseHeaderIdx + 1; rowIdx < rows.length; rowIdx++) {
        const row = rows[rowIdx];
        if (!row) continue;

        const categoryName = getStringValue(row[2]);
        // Stop at total row or forecast balance
        if (!categoryName || categoryName === '-' || categoryName.toLowerCase().includes('total expected') || categoryName.toLowerCase().includes('forecast')) break;

        // Skip total/summary rows
        if (categoryName.toLowerCase().includes('total')) continue;

        const cleanCategoryName = categoryName.trim();
        expenseCategoryNames.add(cleanCategoryName);

        const isOperational = OPERATIONAL_CATEGORIES.has(cleanCategoryName) || OPERATIONAL_CATEGORIES.has(categoryName);

        const lastMonthCol = monthColumns.length > 0 ? monthColumns[monthColumns.length - 1].colIndex : 14;
        const remarksCol = lastMonthCol + 1;
        const remarks = getStringValue(row[remarksCol]);

        // Auto-match project from receipt clients for project-based expenses
        const matchedProject = !isOperational ? matchExpenseToProject(cleanCategoryName, receiptClientNames) : '';

        for (const mc of monthColumns) {
          const amount = getNumericValue(row[mc.colIndex]);
          if (amount > 0) {
            const date = new Date(mc.year, mc.month - 1, 1);
            expenseData.push({
              date,
              month: mc.month,
              year: mc.year,
              category: cleanCategoryName,
              description: cleanCategoryName,
              amount,
              project: matchedProject,
              status: 'Expected',
              notes: remarks || '',
              isOperational,
            });
          }
        }
      }
    }

    let expensesCount = 0;
    if (expenseData.length > 0) {
      const result = await db.expense.createMany({ data: expenseData });
      expensesCount = result.count;
    }

    // 9. Auto-generate categories
    const categoryData: Array<{
      name: string;
      type: string;
      active: boolean;
      isOperational: boolean;
    }> = [];

    for (const catName of expenseCategoryNames) {
      categoryData.push({
        name: catName,
        type: 'expense',
        active: true,
        isOperational: OPERATIONAL_CATEGORIES.has(catName),
      });
    }

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
      const result = await db.category.createMany({ data: categoryData });
      categoriesCount = result.count;
    }

    // 10. Auto-generate project clients
    const projectClientData: Array<{
      name: string;
      code: string;
      active: boolean;
    }> = [];

    for (const clientName of receiptClientNames) {
      projectClientData.push({
        name: clientName,
        code: generateProjectCode(clientName),
        active: true,
      });
    }

    let projectsCount = 0;
    if (projectClientData.length > 0) {
      const result = await db.projectClient.createMany({ data: projectClientData });
      projectsCount = result.count;
    }

    // 11. Update settings with the parsed date range
    const fyStartStr = `${startYear}-${String(startMonth).padStart(2, '0')}-01`;
    // End date: last day of endMonth
    const endDay = new Date(endYear, endMonth, 0).getDate();
    const fyEndStr = `${endYear}-${String(endMonth).padStart(2, '0')}-${endDay}`;

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

    const periodLabel = `${MONTH_FULL[startMonth - 1]}, ${startYear} - ${MONTH_FULL[endMonth - 1]}, ${endYear}`;
    await db.setting.upsert({
      where: { key: 'financial_year_label' },
      update: { value: periodLabel },
      create: { key: 'financial_year_label', value: periodLabel },
    });

    await db.setting.upsert({
      where: { key: 'last_import_date' },
      update: { value: new Date().toISOString() },
      create: { key: 'last_import_date', value: new Date().toISOString() },
    });

    // 12. Return JSON summary with warnings
    const warnings: string[] = [];
    if (bankAccountsCount === 0) warnings.push('No bank accounts detected — set up bank accounts in Settings');
    if (receiptsCount === 0) warnings.push('No receipts detected — add expected receipt data');
    if (expensesCount === 0) warnings.push('No expenses detected — add expected expense data');

    return NextResponse.json({
      success: true,
      bankAccounts: bankAccountsCount,
      receipts: receiptsCount,
      expenses: expensesCount,
      categories: categoriesCount,
      projects: projectsCount,
      financialYear: periodLabel,
      periodMonths: periodMonths.length,
      warnings,
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
