import { db } from '../src/lib/db';

async function seed() {
  console.log('🌱 Seeding database...');

  // Seed Bank Accounts from Excel
  await db.bankAccount.createMany({
    data: [
      { bankName: 'Bank Al Falah', accountName: 'G-11 Markaz', accountNumber: '0234-1004781004', currentBalance: 5264.73, active: true },
      { bankName: 'FINCA', accountName: 'Operational', accountNumber: '', currentBalance: 2259.93, active: true },
      { bankName: 'Askari Bank', accountName: 'RF', accountNumber: '', currentBalance: -14408928.34, active: true },
    ],
  });

  // Seed Categories from Excel expense heads
  const categories = [
    { name: 'BSR - Rise Digital (US Apparel & Textiles, Unit # 2)', type: 'expense', isOperational: false },
    { name: 'Care International (Phase-I)', type: 'expense', isOperational: false },
    { name: 'CWSA', type: 'expense', isOperational: false },
    { name: 'GIZ - Migration', type: 'expense', isOperational: false },
    { name: 'GIZ - TVET', type: 'expense', isOperational: false },
    { name: 'Pehal Pakistan', type: 'expense', isOperational: false },
    { name: 'PSDF - Mobilization Services', type: 'expense', isOperational: false },
    { name: 'PSDF - Online Training Delivery and Mentorship', type: 'expense', isOperational: false },
    { name: 'PSDF - Online Training Delivery and Mentorship - Additional 150', type: 'expense', isOperational: false },
    { name: 'PSDF - SDR Lahore & Faisalabad', type: 'expense', isOperational: false },
    { name: 'PSDF - SDR Northern Belt', type: 'expense', isOperational: false },
    { name: 'ST&IT', type: 'expense', isOperational: false },
    { name: 'Bid Securities for PSDF', type: 'expense', isOperational: false },
    { name: 'Director Loan (Dividend/Advance)', type: 'expense', isOperational: false },
    { name: 'Markup', type: 'expense', isOperational: true },
    { name: 'Directors Life Insurance', type: 'expense', isOperational: true },
    { name: 'Electricity', type: 'expense', isOperational: true },
    { name: 'Freight Expenses', type: 'expense', isOperational: true },
    { name: 'Generator - Maintenance & Fuel', type: 'expense', isOperational: true },
    { name: 'Newspaper & Periodical', type: 'expense', isOperational: true },
    { name: 'Office Refreshment /Janitorial', type: 'expense', isOperational: true },
    { name: 'TMS Monthly Cost', type: 'expense', isOperational: true },
    { name: 'Chat GBT/Adobe and TMS', type: 'expense', isOperational: true },
    { name: 'Zoom and Google Drive', type: 'expense', isOperational: true },
    { name: 'Rent Exp', type: 'expense', isOperational: true },
    { name: 'Petty Cash', type: 'expense', isOperational: true },
    { name: 'Salaries and Staff Transportation and Management Allowances', type: 'expense', isOperational: true },
    { name: 'Bonus/Staff Benefits', type: 'expense', isOperational: true },
    { name: 'Medical Exp', type: 'expense', isOperational: true },
    { name: 'EOBI', type: 'expense', isOperational: true },
    { name: 'Equipment Maintenance', type: 'expense', isOperational: true },
    { name: 'Repair & Maintenance', type: 'expense', isOperational: true },
    { name: 'Stationery & Printing Exp', type: 'expense', isOperational: true },
    { name: 'Charity', type: 'expense', isOperational: true },
    { name: 'Misc. Exp', type: 'expense', isOperational: true },
    { name: 'Web Developing, Hosting and Subscription', type: 'expense', isOperational: true },
    { name: 'Water Charges', type: 'expense', isOperational: true },
    { name: 'Telephone and Internet', type: 'expense', isOperational: true },
  ];

  // Also add receipt-type categories
  categories.push(
    { name: 'Bid Securities', type: 'receipt', isOperational: false },
    { name: 'Project Receipts', type: 'receipt', isOperational: false },
    { name: 'Other Receipts', type: 'receipt', isOperational: false },
  );

  await db.category.createMany({ data: categories });

  // Seed Projects/Clients from Excel
  const projects = [
    { name: 'Bid Securities', code: 'BS', active: true },
    { name: 'BSR - Rise Digital - Interloop, Lahore', code: 'BSR-RD', active: true },
    { name: 'BSR - Rise Digital (US Apparel & Textiles, Unit # 2)', code: 'BSR-UA', active: true },
    { name: 'Care International - Ext', code: 'CI-Ext', active: true },
    { name: 'Care International (Phase-I)', code: 'CI-P1', active: true },
    { name: 'Pehal Pakistan', code: 'PP', active: true },
    { name: 'CWSA', code: 'CWSA', active: true },
    { name: 'GBRSP', code: 'GBRSP', active: true },
    { name: 'GIZ - Migration', code: 'GIZ-M', active: true },
    { name: 'GIZ - TVET', code: 'GIZ-T', active: true },
    { name: 'IRC - L2E', code: 'IRC-L2E', active: true },
    { name: 'KPITB', code: 'KPITB', active: true },
    { name: 'Nutrition International (MNHN & MMS)', code: 'NI', active: true },
    { name: 'PSDF - Mobilization Services', code: 'PSDF-MS', active: true },
    { name: 'PSDF - SDR Lahore & Faisalabad', code: 'PSDF-SDR-LF', active: true },
    { name: 'PSDF - SDR Northern Belt', code: 'PSDF-SDR-NB', active: true },
    { name: 'PSDF (Online Training Delivery and Mentorship)', code: 'PSDF-OTD', active: true },
    { name: 'PSDF (Online Training Delivery and Mentorship) - Additional 150', code: 'PSDF-OTD-150', active: true },
    { name: 'Rozan', code: 'RZN', active: true },
    { name: 'SMEDA - Training, Handholding & Mentoring', code: 'SMEDA', active: true },
    { name: 'ST&IT Package-01', code: 'STIT-P01', active: true },
    { name: 'ST&IT Package-07', code: 'STIT-P07', active: true },
    { name: 'WWF - CSA', code: 'WWF-CSA', active: true },
    { name: 'WWF - Gender Responsive', code: 'WWF-GR', active: true },
  ];
  await db.projectClient.createMany({ data: projects });

  // Seed Receipts from Excel (monthly amounts per client)
  // Format: [client, Apr, May, Jun, Jul, Aug, Sep, Oct, Nov, Dec, Jan, Feb, Mar]
  const receiptsData: [string, ...number[]][] = [
    ['Bid Securities', 860193, 198900, 0, 1698828, 0, 0, 0, 0, 0, 0, 0, 0],
    ['BSR - Rise Digital - Interloop, Lahore', 825000, 0, 825000, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ['BSR - Rise Digital (US Apparel & Textiles, Unit # 2)', 0, 0, 825000, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ['Care International - Ext', 2534795, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ['Care International (Phase-I)', 0, 2692774, 3077456, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ['Pehal Pakistan', 312000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ['CWSA', 600000, 400000, 300000, 0, 300000, 400000, 0, 0, 0, 0, 0, 0],
    ['GBRSP', 0, 149760, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ['GIZ - Migration', 2288000, 0, 0, 10753596.24, 0, 0, 0, 0, 0, 0, 0, 0],
    ['GIZ - TVET', 0, 1517758, 0, 2069670, 0, 3311472, 0, 2759560, 0, 0, 0, 0],
    ['IRC - L2E', 3739302, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ['KPITB', 0, 1698828, 4247110, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ['Nutrition International (MNHN & MMS)', 0, 1350000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ['PSDF - Mobilization Services', 0, 0, 0, 0, 0, 0, 4834800, 0, 0, 0, 0, 0],
    ['PSDF - SDR Lahore & Faisalabad', 0, 0, 0, 2969600, 2969600, 2969600, 2969600, 2969600, 0, 0, 0, 14848000],
    ['PSDF - SDR Northern Belt', 0, 0, 0, 1397800, 1397800, 1397800, 1397800, 1397800, 1397800, 0, 0, 8386800],
    ['PSDF (Online Training Delivery and Mentorship)', 918720, 0, 2143680, 2143680, 2143680, 2143680, 2143680, 3674880, 3062400, 0, 0, 0],
    ['PSDF (Online Training Delivery and Mentorship) - Additional 150', 0, 0, 1148400, 1148400, 1148400, 1148400, 1148400, 1148400, 0, 0, 0, 0],
    ['Rozan', 0, 25000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ['SMEDA - Training, Handholding & Mentoring', 1874686, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ['ST&IT Package-01', 208448.1, 312672.15, 1563360.75, 0, 1563360.75, 1563360.75, 0, 1563360.75, 0, 0, 1563360.75, 0],
    ['ST&IT Package-07', 349255.2, 523882.8, 2619414, 0, 0, 0, 0, 2619414, 0, 2619414, 0, 0],
    ['WWF - CSA', 1362750, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ['WWF - Gender Responsive', 1984762, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  ];

  const months = [
    { month: 4, year: 2026 },
    { month: 5, year: 2026 },
    { month: 6, year: 2026 },
    { month: 7, year: 2026 },
    { month: 8, year: 2026 },
    { month: 9, year: 2026 },
    { month: 10, year: 2026 },
    { month: 11, year: 2026 },
    { month: 12, year: 2026 },
    { month: 1, year: 2027 },
    { month: 2, year: 2027 },
    { month: 3, year: 2027 },
  ];

  const receiptRecords = [];
  for (const row of receiptsData) {
    const [client, ...amounts] = row;
    for (let i = 0; i < amounts.length; i++) {
      if (amounts[i] > 0) {
        const { month, year } = months[i];
        const day = Math.floor(Math.random() * 25) + 1;
        receiptRecords.push({
          date: new Date(year, month - 1, day),
          month,
          year,
          clientProject: client,
          description: `Receipt from ${client}`,
          amount: amounts[i],
          status: 'Expected',
          notes: 'Invoiced / to be raised',
        });
      }
    }
  }
  await db.receipt.createMany({ data: receiptRecords });

  // Seed Expenses from Excel
  // Format: [category, isOperational, project, Apr, May, Jun, Jul, Aug, Sep, Oct, Nov, Dec, Jan, Feb, Mar]
  const expensesData: [string, boolean, string, ...number[]][] = [
    ['BSR - Rise Digital (US Apparel & Textiles, Unit # 2)', false, 'BSR - Rise Digital (US Apparel & Textiles, Unit # 2)', 110000, 110000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ['Care International (Phase-I)', false, 'Care International (Phase-I)', 1886400, 2336400, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ['CWSA', false, 'CWSA', 300000, 200000, 150000, 0, 150000, 200000, 0, 0, 0, 0, 0, 0],
    ['GIZ - Migration', false, 'GIZ - Migration', 1800000, 350000, 7773596.24, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ['GIZ - TVET', false, 'GIZ - TVET', 510000, 620000, 380000, 620000, 380000, 620000, 0, 0, 0, 0, 0, 0],
    ['Pehal Pakistan', false, 'Pehal Pakistan', 100000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ['PSDF - Mobilization Services', false, 'PSDF - Mobilization Services', 0, 120000, 120000, 120000, 120000, 120000, 120000, 742400, 0, 0, 0, 0],
    ['PSDF - Online Training Delivery and Mentorship', false, 'PSDF (Online Training Delivery and Mentorship)', 930920, 1055920, 1055920, 1055920, 1055920, 1055920, 1438720, 979360, 0, 0, 0, 0],
    ['PSDF - Online Training Delivery and Mentorship - Additional 150', false, 'PSDF (Online Training Delivery and Mentorship) - Additional 150', 0, 527100, 527100, 527100, 527100, 527100, 527100, 0, 0, 0, 0, 0],
    ['PSDF - SDR Lahore & Faisalabad', false, 'PSDF - SDR Lahore & Faisalabad', 0, 300000, 1440000, 2182400, 2182400, 2182400, 2182400, 280000, 280000, 280000, 280000, 3712000],
    ['PSDF - SDR Northern Belt', false, 'PSDF - SDR Northern Belt', 0, 300000, 740000, 1089450, 1089450, 1089450, 1089450, 1089450, 140000, 140000, 140000, 2096700],
    ['ST&IT', false, 'ST&IT Package-01', 938016, 350000, 2509664.85, 450000, 938016.45, 938016.45, 450000, 2509664.85, 450000, 2509664.85, 450000, 450000],
    ['Bid Securities for PSDF', false, '', 2420176, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ['Director Loan (Dividend/Advance)', false, '', 0, 5150000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ['Markup', true, '', 135000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ['Directors Life Insurance', true, '', 0, 0, 0, 0, 0, 0, 127238, 0, 0, 0, 0, 0],
    ['Electricity', true, '', 55000, 55000, 85000, 100000, 125000, 125000, 125000, 125000, 125000, 125000, 125000, 125000],
    ['Freight Expenses', true, '', 10000, 10000, 10000, 10000, 10000, 10000, 10000, 10000, 10000, 10000, 10000, 10000],
    ['Generator - Maintenance & Fuel', true, '', 15000, 15000, 15000, 15000, 15000, 15000, 15000, 15000, 15000, 15000, 15000, 15000],
    ['Newspaper & Periodical', true, '', 1500, 1500, 1500, 1500, 1500, 1500, 1500, 1500, 1500, 1500, 1500, 1500],
    ['Office Refreshment /Janitorial', true, '', 80000, 80000, 80000, 80000, 80000, 80000, 80000, 80000, 80000, 80000, 80000, 80000],
    ['TMS Monthly Cost', true, '', 30000, 30000, 30000, 30000, 30000, 30000, 30000, 30000, 30000, 30000, 30000, 30000],
    ['Chat GBT/Adobe and TMS', true, '', 17700, 17700, 17700, 17700, 17700, 17700, 17700, 17700, 17700, 17700, 17700, 17700],
    ['Zoom and Google Drive', true, '', 8500, 15000, 15000, 15000, 15000, 15000, 15000, 15000, 15000, 15000, 15000, 15000],
    ['Rent Exp', true, '', 1061070, 0, 0, 1061070, 0, 0, 1061070, 0, 1061070, 0, 0, 0],
    ['Petty Cash', true, '', 100000, 100000, 100000, 100000, 100000, 100000, 100000, 100000, 100000, 100000, 100000, 100000],
    ['Salaries and Staff Transportation and Management Allowances', true, '', 0, 3579160.09, 3579160.09, 3579160.09, 3579160.09, 3579160.09, 3579160.09, 3579160.09, 3579160.09, 3579160.09, 3579160.09, 3579160.09],
    ['Bonus/Staff Benefits', true, '', 0, 1614005, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ['Medical Exp', true, '', 120000, 120000, 120000, 120000, 120000, 120000, 120000, 120000, 120000, 120000, 120000, 120000],
    ['EOBI', true, '', 22866, 22866, 22866, 22866, 22866, 22866, 22866, 22866, 22866, 22866, 22866, 22866],
    ['Equipment Maintenance', true, '', 15000, 15000, 15000, 15000, 15000, 15000, 15000, 15000, 15000, 15000, 15000, 15000],
    ['Repair & Maintenance', true, '', 25000, 25000, 25000, 25000, 25000, 25000, 25000, 25000, 25000, 25000, 25000, 25000],
    ['Stationery & Printing Exp', true, '', 25000, 25000, 25000, 25000, 25000, 25000, 25000, 25000, 25000, 25000, 25000, 25000],
    ['Charity', true, '', 50000, 50000, 50000, 50000, 50000, 50000, 50000, 50000, 50000, 50000, 50000, 50000],
    ['Misc. Exp', true, '', 799782, 15000, 15000, 15000, 15000, 15000, 15000, 15000, 15000, 15000, 15000, 15000],
    ['Web Developing, Hosting and Subscription', true, '', 15000, 15000, 15000, 15000, 15000, 15000, 15000, 15000, 15000, 15000, 15000, 15000],
    ['Water Charges', true, '', 4830, 4830, 4830, 4830, 4830, 4830, 4830, 4830, 4830, 4830, 4830, 4830],
    ['Telephone and Internet', true, '', 12980, 22155, 22155, 22155, 22155, 22155, 22155, 22155, 22155, 22155, 22155, 22155],
  ];

  const expenseRecords = [];
  for (const row of expensesData) {
    const [category, isOperational, project, ...amounts] = row;
    for (let i = 0; i < amounts.length; i++) {
      if (amounts[i] > 0) {
        const { month, year } = months[i];
        const day = Math.floor(Math.random() * 25) + 1;
        expenseRecords.push({
          date: new Date(year, month - 1, day),
          month,
          year,
          category,
          description: `${category} - ${month}/${year}`,
          amount: amounts[i],
          project,
          status: 'Expected',
          notes: '',
          isOperational,
        });
      }
    }
  }
  await db.expense.createMany({ data: expenseRecords });

  // Seed Settings
  await db.setting.createMany({
    data: [
      { key: 'financial_year_start', value: '2026-04-01' },
      { key: 'financial_year_end', value: '2027-03-31' },
      { key: 'warning_threshold_balance', value: '500000' },
      { key: 'profit_margin_pct', value: '12' },
      { key: 'operational_margin_pct', value: '9' },
      { key: 'company_name', value: 'ECI' },
    ],
  });

  console.log('✅ Seed completed successfully!');
  console.log(`  Bank Accounts: 3`);
  console.log(`  Receipts: ${receiptRecords.length}`);
  console.log(`  Expenses: ${expenseRecords.length}`);
  console.log(`  Categories: ${categories.length}`);
  console.log(`  Projects/Clients: ${projects.length}`);
}

seed()
  .catch(console.error)
  .finally(() => db.$disconnect());
