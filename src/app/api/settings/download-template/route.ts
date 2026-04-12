import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/**
 * Build an array of {month, year, label} for each month in the range [startMonth/startYear .. endMonth/endYear].
 */
function buildMonthRange(startMonth: number, startYear: number, endMonth: number, endYear: number): Array<{ month: number; year: number; label: string }> {
  const months: Array<{ month: number; year: number; label: string }> = [];
  let m = startMonth;
  let y = startYear;

  // Safety: limit to 36 months
  let limit = 36;
  while (limit-- > 0) {
    months.push({ month: m, year: y, label: MONTH_SHORT[m - 1] });
    if (m === endMonth && y === endYear) break;
    m++;
    if (m > 12) { m = 1; y++; }
  }

  return months;
}

/**
 * Generate and download an Excel template matching the ECI Cash Flow import format.
 * Supports any custom date range (e.g., June 2026 - May 2027, April 2026 - March 2027, etc.)
 */
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;

    // Parse start month/year - default to April 2026
    const startMonth = parseInt(sp.get('startMonth') || '4');
    const startYear = parseInt(sp.get('startYear') || '2026');

    // Parse end month/year - default to March of next year
    const endMonth = parseInt(sp.get('endMonth') || '3');
    const endYear = parseInt(sp.get('endYear') || String(startYear + 1));

    // Validate
    if (startMonth < 1 || startMonth > 12 || endMonth < 1 || endMonth > 12) {
      return NextResponse.json({ error: 'Invalid month. Must be 1-12.' }, { status: 400 });
    }

    const monthRange = buildMonthRange(startMonth, startYear, endMonth, endYear);
    const numMonths = monthRange.length;

    if (numMonths < 1 || numMonths > 36) {
      return NextResponse.json({ error: 'Date range must be between 1 and 36 months.' }, { status: 400 });
    }

    const wb = XLSX.utils.book_new();
    const data: (string | number)[][] = [];

    // Helper: create an empty row with columns A, B, C, [numMonths empty], lastCol
    const emptyDataRow = (colC: string, lastCol = ''): (string | number)[] => {
      const row: (string | number)[] = ['', '', colC];
      for (let i = 0; i < numMonths; i++) row.push('');
      row.push(lastCol);
      return row;
    };

    // Row 1: Title
    data.push(['ECI - Cash Flow Statement']);

    // Row 2: Period - fully flexible format
    const periodLabel = `${MONTH_FULL[startMonth - 1]}, ${startYear} - ${MONTH_FULL[endMonth - 1]}, ${endYear}`;
    data.push([periodLabel]);

    // Row 3: Blank
    data.push(['']);

    // Row 4: Headers for bank section - dynamic month columns
    const bankHeader: (string | number)[] = ['', '', 'Bank Accounts'];
    for (const m of monthRange) bankHeader.push(m.label);
    bankHeader.push('Total/Remarks');
    data.push(bankHeader);

    // Rows 5-7: Bank account examples
    data.push(emptyDataRow('Bank Al Falah # 0123-4567890123 (G-11 Markaz)', 'Current Balance'));
    data.push(emptyDataRow('FINCA (Operational)', 'Current Balance'));
    data.push(emptyDataRow('Askari Bank (RF)', 'Current Balance'));

    // Row 8-9: Blank
    data.push(['']);
    data.push(['']);

    // Row 10: Opening balance row
    data.push(emptyDataRow('Opening Balance'));

    // Row 11: Blank
    data.push(['']);

    // Row 12: Receipts header - dynamic month columns
    const receiptHeader: (string | number)[] = ['', '', 'EXPECTED RECEIPTS'];
    for (const m of monthRange) receiptHeader.push(m.label);
    receiptHeader.push('Remarks');
    data.push(receiptHeader);

    // Example receipt rows
    const exampleReceipts = [
      'Bid Securities',
      'BSR - Rise Digital - Interloop, Lahore',
      'BSR - Rise Digital (US Apparel & Textiles, Unit # 2)',
      'Care International - Ext',
      'Care International (Phase-I)',
      'Pehal Pakistan',
      'CWSA',
      'GBRSP',
      'GIZ - Migration',
      'GIZ - TVET',
      'IRC - L2E',
      'KPITB',
      'Nutrition International (MNHN & MMS)',
      'PSDF - Mobilization Services',
      'PSDF - SDR Lahore & Faisalabad',
      'PSDF - SDR Northern Belt',
      'PSDF (Online Training Delivery and Mentorship)',
      'PSDF (Online Training Delivery and Mentorship) - Additional 150',
      'Rozan',
      'SMEDA - Training, Handholding & Mentoring',
      'ST&IT Package-01',
      'ST&IT Package-07',
      'WWF - CSA',
      'WWF - Gender Responsive',
    ];

    for (const clientName of exampleReceipts) {
      data.push(emptyDataRow(clientName));
    }

    // Total receipts row
    data.push(emptyDataRow('Total Expected Receipts'));

    // Blank rows
    data.push(['']);
    data.push(['']);
    data.push(['']);

    // Expense header - dynamic month columns
    const expenseHeader: (string | number)[] = ['', '', 'EXPECTED EXPENSES'];
    for (const m of monthRange) expenseHeader.push(m.label);
    expenseHeader.push('Remarks');
    data.push(expenseHeader);

    // Project-based expenses
    const projectExpenses = [
      'BSR - Rise Digital (US Apparel & Textiles, Unit # 2)',
      'Care International (Phase-I)',
      'CWSA',
      'GIZ - Migration',
      'GIZ - TVET',
      'Pehal Pakistan',
      'PSDF - Mobilization Services',
      'PSDF - Online Training Delivery and Mentorship',
      'PSDF - Online Training Delivery and Mentorship - Additional 150',
      'PSDF - SDR Lahore & Faisalabad',
      'PSDF - SDR Northern Belt',
      'ST&IT',
      'Bid Securities for PSDF',
      'Director Loan (Dividend/Advance)',
    ];

    for (const cat of projectExpenses) {
      data.push(emptyDataRow(cat));
    }

    // Operational expenses
    const operationalExpenses = [
      'Markup',
      'Directors Life Insurance',
      'Electricity',
      'Freight Expenses',
      'Generator - Maintenance & Fuel',
      'Newspaper & Periodical',
      'Office Refreshment /Janitorial',
      'TMS Monthly Cost',
      'Chat GBT/Adobe and TMS',
      'Zoom and Google Drive',
      'Rent Exp',
      'Petty Cash',
      'Salaries and Staff Transportation and Management Allowances',
      'Bonus/Staff Benefits',
      'Medical Exp',
      'EOBI',
      'Equipment Maintenance',
      'Repair & Maintenance',
      'Stationery & Printing Exp',
      'Charity',
      'Misc. Exp',
      'Web Developing, Hosting and Subscription',
      'Water Charges',
      'Telephone and Internet',
    ];

    for (const cat of operationalExpenses) {
      data.push(emptyDataRow(cat));
    }

    // Total expense row
    data.push(emptyDataRow('Total Expected Expenses'));

    // Blank rows
    data.push(['']);
    data.push(['']);

    // Forecast balance row
    data.push(emptyDataRow('Forecast Balance'));

    const ws = XLSX.utils.aoa_to_sheet(data);

    // Set column widths dynamically
    const colWidths = [
      { wch: 4 },  // A
      { wch: 4 },  // B
      { wch: 50 }, // C - Description
    ];
    for (let i = 0; i < numMonths; i++) colWidths.push({ wch: 14 });
    colWidths.push({ wch: 20 }); // Last col - Remarks/Total
    ws['!cols'] = colWidths;

    XLSX.utils.book_append_sheet(wb, ws, 'Cash Flow');

    // Generate buffer
    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });

    const filenameLabel = `${MONTH_SHORT[startMonth - 1]}${startYear}-${MONTH_SHORT[endMonth - 1]}${endYear}`;
    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="ECI-CashFlow-Template-${filenameLabel}.xlsx"`,
      },
    });
  } catch (error) {
    console.error('Template generation error:', error);
    return NextResponse.json({ error: 'Failed to generate template' }, { status: 500 });
  }
}
