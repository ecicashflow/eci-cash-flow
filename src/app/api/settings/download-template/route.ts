import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

/**
 * Generate and download an Excel template matching the ECI Cash Flow import format.
 * This template shows the exact structure users need to follow for importing data.
 */
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const startYear = parseInt(sp.get('startYear') || '2026');

    const wb = XLSX.utils.book_new();

    // Create the Cash Flow sheet
    const data: (string | number)[][] = [];

    // Row 1: Title
    data.push(['ECI - Cash Flow Statement']);

    // Row 2: Period
    data.push([`April, ${startYear} - March, ${startYear + 1}`]);

    // Row 3: Blank
    data.push(['']);

    // Row 4: Headers for bank section
    data.push(['', '', 'Bank Accounts', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Total/Remarks']);

    // Rows 5-7: Bank account examples (rows 6-8 in Excel)
    data.push(['', '', 'Bank Al Falah # 0123-4567890123 (G-11 Markaz)', '', '', '', '', '', '', '', '', '', '', '', '', 'Current Balance']);
    data.push(['', '', 'FINCA (Operational)', '', '', '', '', '', '', '', '', '', '', '', '', 'Current Balance']);
    data.push(['', '', 'Askari Bank (RF)', '', '', '', '', '', '', '', '', '', '', '', '', 'Current Balance']);

    // Row 8: Blank
    data.push(['']);

    // Row 9: Blank
    data.push(['']);

    // Row 10: Opening balance row
    data.push(['', '', 'Opening Balance', '', '', '', '', '', '', '', '', '', '', '', '', '']);

    // Row 11: Blank
    data.push(['']);

    // Row 12: Receipts header
    data.push(['', '', 'EXPECTED RECEIPTS', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Remarks']);

    // Rows 13-36: Example receipt rows
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
      const row: (string | number)[] = ['', '', clientName];
      for (let i = 0; i < 12; i++) row.push('');
      row.push('');
      data.push(row);
    }

    // Total receipts row
    data.push(['', '', 'Total Expected Receipts', '', '', '', '', '', '', '', '', '', '', '', '', '']);

    // Blank rows
    data.push(['']);
    data.push(['']);
    data.push(['']);

    // Expense header
    data.push(['', '', 'EXPECTED EXPENSES', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Remarks']);

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
      const row: (string | number)[] = ['', '', cat];
      for (let i = 0; i < 12; i++) row.push('');
      row.push('');
      data.push(row);
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
      const row: (string | number)[] = ['', '', cat];
      for (let i = 0; i < 12; i++) row.push('');
      row.push('');
      data.push(row);
    }

    // Total expense row
    data.push(['', '', 'Total Expected Expenses', '', '', '', '', '', '', '', '', '', '', '', '', '']);

    // Blank rows
    data.push(['']);
    data.push(['']);

    // Forecast balance row
    data.push(['', '', 'Forecast Balance', '', '', '', '', '', '', '', '', '', '', '', '', '']);

    const ws = XLSX.utils.aoa_to_sheet(data);

    // Set column widths
    ws['!cols'] = [
      { wch: 4 },  // A
      { wch: 4 },  // B
      { wch: 50 }, // C - Description
      { wch: 14 }, // D - Apr
      { wch: 14 }, // E - May
      { wch: 14 }, // F - Jun
      { wch: 14 }, // G - Jul
      { wch: 14 }, // H - Aug
      { wch: 14 }, // I - Sep
      { wch: 14 }, // J - Oct
      { wch: 14 }, // K - Nov
      { wch: 14 }, // L - Dec
      { wch: 14 }, // M - Jan
      { wch: 14 }, // N - Feb
      { wch: 14 }, // O - Mar
      { wch: 20 }, // P - Remarks
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Cash Flow');

    // Generate buffer
    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });

    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="ECI-CashFlow-Template-FY${startYear}.xlsx"`,
      },
    });
  } catch (error) {
    console.error('Template generation error:', error);
    return NextResponse.json({ error: 'Failed to generate template' }, { status: 500 });
  }
}
