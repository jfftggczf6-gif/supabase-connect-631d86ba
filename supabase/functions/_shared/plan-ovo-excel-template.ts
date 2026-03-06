import JSZip from "https://esm.sh/jszip@3.10.1";

// ===== XML HELPERS (duplicated from framework-excel-template.ts to avoid circular imports) =====

function escapeXml(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function setCellInXml(
  sheetXml: string,
  cellRef: string,
  value: string | number | null | undefined
): string {
  if (value === null || value === undefined || value === '') return sheetXml;

  const safeVal = String(value);
  const row = cellRef.match(/\d+/)?.[0] ?? '1';

  const isNum =
    typeof value === 'number' ||
    (typeof value === 'string' &&
      !isNaN(Number(value)) &&
      value.trim() !== '' &&
      !value.includes('%') &&
      !value.includes('/') &&
      !value.includes(' ') &&
      !value.includes('→'));

  const newCell = isNum
    ? `<c r="${cellRef}"><v>${value}</v></c>`
    : `<c r="${cellRef}" t="inlineStr"><is><t>${escapeXml(safeVal)}</t></is></c>`;

  // 1. Replace existing cell
  const existingCellRegex = new RegExp(
    `<c\\s+r="${cellRef}"(?:\\s[^>]*?)?>(?:(?!</c>).)*</c>`,
    's'
  );
  if (existingCellRegex.test(sheetXml)) {
    return sheetXml.replace(existingCellRegex, newCell);
  }

  // 2. Insert into existing row
  const rowRegex = new RegExp(`(<row[^>]*\\br="${row}"[^>]*>)(.*?)(</row>)`, 's');
  if (rowRegex.test(sheetXml)) {
    return sheetXml.replace(rowRegex, (_, open, content, close) => {
      return `${open}${content}${newCell}${close}`;
    });
  }

  // 3. Create row
  return sheetXml.replace('</sheetData>', `<row r="${row}">${newCell}</row></sheetData>`);
}

// ===== CELL MAPPING CONSTANTS =====
// Based on parsed template: InputsData is sheet3.xml
// VALUE column = I, Product names in G, filter in H
// Staff: category G, department H, social security I
// Loans: interest H, period I
// Simulation: worst G, typical H, best I

const TEMPLATE_FILE = 'PlanFinancierOVO-Template-v0210-EMPTY.xlsm';
const INPUTS_SHEET = 'xl/worksheets/sheet3.xml';
const README_SHEET = 'xl/worksheets/sheet1.xml';

// Row mappings for InputsData sheet
const ROWS = {
  company: 5,
  country: 6,
  currency: 8,
  exchangeRate: 9,
  conversionDate: 10,
  vat: 12,
  inflation: 14,
  taxRegime1: 17,
  taxRegime2: 18,
  taxRegime3: 19,
  taxRegime4: 20,
  taxRegime5: 21,
  yearMinus2: 24,
  yearMinus1: 25,
  currentYear: 26,
  currentYearH1: 27,
  currentYearH2: 28,
  year2: 29,
  year3: 30,
  year4: 31,
  year5: 32,
  year6: 33,
  productStart: 36, // PRODUCT 01 at row 36, up to PRODUCT 20 at row 55
  serviceStart: 58, // SERVICE 01 at row 58, up to SERVICE 10 at row 67
  range1: 70,
  range2: 71,
  range3: 72,
  channel1: 75,
  channel2: 76,
  staffStart: 113, // STAFF_CAT01 at row 113, up to STAFF_CAT10 at row 122
  loanOvo: 125,
  loanFamily: 126,
  loanBank: 127,
  simulationStart: 130, // REVENUE PRODUCTS at 130, then COGS PRODUCTS, etc.
};

// ===== MAIN EXPORT =====

export async function fillPlanOvoExcelTemplate(
  data: any,
  enterpriseName: string,
  supabase: any
): Promise<Uint8Array> {
  console.log('[plan-ovo-excel] Starting template fill...');

  // Download template from Storage
  const { data: fileData, error } = await supabase.storage
    .from('templates')
    .download(TEMPLATE_FILE);

  if (error || !fileData) {
    throw new Error(`Template OVO introuvable dans Storage: ${error?.message ?? 'fichier absent'}`);
  }

  const buffer = await fileData.arrayBuffer();
  const zip = await JSZip.loadAsync(buffer);

  // Helper shortcuts
  const setVal = (xml: string, ref: string, val: any): string => {
    if (val === null || val === undefined || val === '') return xml;
    return setCellInXml(xml, ref, val);
  };

  const setNum = (xml: string, ref: string, val: any): string => {
    if (val === null || val === undefined) return xml;
    const n = typeof val === 'number' ? val : parseFloat(String(val).replace(/[%\s,]/g, ''));
    if (isNaN(n)) return xml;
    return setCellInXml(xml, ref, n);
  };

  // ── ReadMe sheet: Set language to French ──
  let readme = await zip.file(README_SHEET)?.async('string') ?? '';
  readme = setVal(readme, 'L3', 'French');
  zip.file(README_SHEET, readme);
  console.log('[plan-ovo-excel] ReadMe language set to French');

  // ── InputsData sheet ──
  let s3 = await zip.file(INPUTS_SHEET)?.async('string') ?? '';
  if (!s3 || s3.length < 100) {
    // Try other sheet files
    for (const i of [4, 5, 2]) {
      const alt = await zip.file(`xl/worksheets/sheet${i}.xml`)?.async('string') ?? '';
      if (alt.includes('COMPANY') || alt.includes('ENTREPRISE') || alt.includes('InputsData')) {
        s3 = alt;
        console.log(`[plan-ovo-excel] Found InputsData in sheet${i}.xml`);
        break;
      }
    }
  }

  // === Section 1: Country Related ===
  s3 = setVal(s3, `I${ROWS.company}`, data.company || enterpriseName);
  s3 = setVal(s3, `I${ROWS.country}`, data.country || "Côte d'Ivoire");
  s3 = setVal(s3, `I${ROWS.currency}`, data.currency || 'XOF');
  s3 = setNum(s3, `I${ROWS.exchangeRate}`, data.exchange_rate_eur || 655.957);
  s3 = setVal(s3, `I${ROWS.conversionDate}`, new Date().toLocaleDateString('en-US'));
  s3 = setNum(s3, `I${ROWS.vat}`, data.vat || 0.18);
  s3 = setNum(s3, `I${ROWS.inflation}`, data.annual_inflation || 0.03);

  // Tax regimes
  s3 = setNum(s3, `I${ROWS.taxRegime1}`, data.tax_regime_1 || 0.04);
  s3 = setNum(s3, `I${ROWS.taxRegime2}`, data.tax_regime_2 || 0.25);
  if (data.tax_regime_3) s3 = setNum(s3, `I${ROWS.taxRegime3}`, data.tax_regime_3);
  if (data.tax_regime_4) s3 = setNum(s3, `I${ROWS.taxRegime4}`, data.tax_regime_4);
  if (data.tax_regime_5) s3 = setNum(s3, `I${ROWS.taxRegime5}`, data.tax_regime_5);

  console.log('[plan-ovo-excel] Section 1 (Country) filled');

  // === Section 2: Year Related ===
  const years = data.years || {};
  s3 = setNum(s3, `I${ROWS.yearMinus2}`, years.year_minus_2 || data.base_year || 2023);
  s3 = setNum(s3, `I${ROWS.yearMinus1}`, years.year_minus_1 || (years.year_minus_2 || 2023) + 1);
  s3 = setNum(s3, `I${ROWS.currentYear}`, years.current_year || (years.year_minus_2 || 2023) + 2);
  if (years.current_year) {
    s3 = setNum(s3, `I${ROWS.currentYearH1}`, years.current_year);
    s3 = setNum(s3, `I${ROWS.currentYearH2}`, years.current_year);
  }
  s3 = setNum(s3, `I${ROWS.year2}`, years.year2 || (years.year_minus_2 || 2023) + 3);
  s3 = setNum(s3, `I${ROWS.year3}`, years.year3 || (years.year_minus_2 || 2023) + 4);
  s3 = setNum(s3, `I${ROWS.year4}`, years.year4 || (years.year_minus_2 || 2023) + 5);
  s3 = setNum(s3, `I${ROWS.year5}`, years.year5 || (years.year_minus_2 || 2023) + 6);
  s3 = setNum(s3, `I${ROWS.year6}`, years.year6 || (years.year_minus_2 || 2023) + 7);

  console.log('[plan-ovo-excel] Section 2 (Years) filled');

  // === Section 3: Products ===
  const products = data.products || [];
  for (let i = 0; i < Math.min(products.length, 20); i++) {
    const row = ROWS.productStart + i;
    const p = products[i];
    s3 = setVal(s3, `G${row}`, p.name || p.label || `Produit ${i + 1}`);
    s3 = setNum(s3, `H${row}`, p.filter !== undefined ? p.filter : 1);
    if (p.description) s3 = setVal(s3, `I${row}`, p.description);
  }
  // Set remaining products to filter 0
  for (let i = products.length; i < 20; i++) {
    const row = ROWS.productStart + i;
    s3 = setNum(s3, `H${row}`, 0);
  }

  // === Section 3: Services ===
  const services = data.services || [];
  for (let i = 0; i < Math.min(services.length, 10); i++) {
    const row = ROWS.serviceStart + i;
    const s = services[i];
    s3 = setVal(s3, `G${row}`, s.name || s.label || `Service ${i + 1}`);
    s3 = setNum(s3, `H${row}`, s.filter !== undefined ? s.filter : 1);
    if (s.description) s3 = setVal(s3, `I${row}`, s.description);
  }
  // Set remaining services to filter 0
  for (let i = services.length; i < 10; i++) {
    const row = ROWS.serviceStart + i;
    s3 = setNum(s3, `H${row}`, 0);
  }

  console.log('[plan-ovo-excel] Section 3 (Products/Services) filled');

  // === Section 4: Ranges and Distribution Channels ===
  s3 = setVal(s3, `I${ROWS.range1}`, data.ranges?.[0] || 'Entry level');
  s3 = setVal(s3, `I${ROWS.range2}`, data.ranges?.[1] || 'Advanced level');
  s3 = setVal(s3, `I${ROWS.range3}`, data.ranges?.[2] || 'Professional level');
  s3 = setVal(s3, `I${ROWS.channel1}`, data.channels?.[0] || 'Business to Business');
  s3 = setVal(s3, `I${ROWS.channel2}`, data.channels?.[1] || 'Business to Consumer');

  console.log('[plan-ovo-excel] Section 4 (Ranges/Channels) filled');

  // === Section 5: Staff ===
  const staff = data.staff || [];
  for (let i = 0; i < Math.min(staff.length, 10); i++) {
    const row = ROWS.staffStart + i;
    const st = staff[i];
    s3 = setVal(s3, `G${row}`, st.label || st.category || `Catégorie ${i + 1}`);
    s3 = setVal(s3, `H${row}`, st.department || '');
    s3 = setNum(s3, `I${row}`, st.social_security_rate || 0.1645);
  }

  console.log('[plan-ovo-excel] Section 5 (Staff) filled');

  // === Section 6: Loans ===
  const loans = data.loans || {};
  if (loans.ovo) {
    s3 = setVal(s3, `H${ROWS.loanOvo}`, typeof loans.ovo.rate === 'number' ? `${Math.round(loans.ovo.rate * 100)}%` : (loans.ovo.rate || '7%'));
    s3 = setVal(s3, `I${ROWS.loanOvo}`, typeof loans.ovo.term_years === 'number' ? `${loans.ovo.term_years} YEARS` : (loans.ovo.term || '5 YEARS'));
  }
  if (loans.family) {
    s3 = setVal(s3, `H${ROWS.loanFamily}`, typeof loans.family.rate === 'number' ? `${Math.round(loans.family.rate * 100)}%` : (loans.family.rate || '10%'));
    s3 = setVal(s3, `I${ROWS.loanFamily}`, typeof loans.family.term_years === 'number' ? `${loans.family.term_years} YEARS` : (loans.family.term || '3 YEARS'));
  }
  if (loans.bank) {
    s3 = setVal(s3, `H${ROWS.loanBank}`, typeof loans.bank.rate === 'number' ? `${Math.round(loans.bank.rate * 100)}%` : (loans.bank.rate || '20%'));
    s3 = setVal(s3, `I${ROWS.loanBank}`, typeof loans.bank.term_years === 'number' ? `${loans.bank.term_years} YEARS` : (loans.bank.term || '2 YEARS'));
  }

  console.log('[plan-ovo-excel] Section 6 (Loans) filled');

  // === Section 7: Simulation ===
  const sim = data.simulation || {};
  const simRows = [
    { row: ROWS.simulationStart, key: 'revenue_products' },
    { row: ROWS.simulationStart + 1, key: 'cogs_products' },
    { row: ROWS.simulationStart + 2, key: 'revenue_services' },
    { row: ROWS.simulationStart + 3, key: 'cogs_services' },
    { row: ROWS.simulationStart + 4, key: 'marketing_cost' },
    { row: ROWS.simulationStart + 5, key: 'staff_salaries' },
    { row: ROWS.simulationStart + 6, key: 'taxes_duties_staff' },
    { row: ROWS.simulationStart + 7, key: 'office_costs' },
    { row: ROWS.simulationStart + 8, key: 'other_expenses' },
    { row: ROWS.simulationStart + 9, key: 'travel_transportation' },
    { row: ROWS.simulationStart + 10, key: 'insurance' },
    { row: ROWS.simulationStart + 11, key: 'maintenance' },
    { row: ROWS.simulationStart + 12, key: 'third_parties' },
  ];

  for (const { row, key } of simRows) {
    const worst = sim.worst_case?.[key];
    const typical = sim.typical_case?.[key];
    const best = sim.best_case?.[key];
    if (worst !== undefined) s3 = setNum(s3, `G${row}`, worst);
    if (typical !== undefined) s3 = setNum(s3, `H${row}`, typical);
    if (best !== undefined) s3 = setNum(s3, `I${row}`, best);
  }

  console.log('[plan-ovo-excel] Section 7 (Simulation) filled');

  zip.file(INPUTS_SHEET, s3);

  // Generate output
  const output = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
  console.log(`[plan-ovo-excel] Template filled successfully (${output.length} bytes)`);

  return output;
}

// ===== HTML REPORT GENERATOR =====

function fmtFCFA(n: any): string {
  if (n == null || n === '' || isNaN(Number(n))) return '—';
  return new Intl.NumberFormat('fr-FR').format(Math.round(Number(n))) + ' FCFA';
}

function fmtPct(n: any): string {
  if (n == null || n === '' || isNaN(Number(n))) return '—';
  const val = Number(n);
  return (val > 1 ? val : val * 100).toFixed(1) + '%';
}

export function generatePlanOvoHTML(data: any, enterpriseName: string): string {
  const yearKeys = ['year_minus_2', 'year_minus_1', 'current_year', 'year2', 'year3', 'year4', 'year5', 'year6'];
  const years = data.years || {};
  const yearLabels = yearKeys.map(k => years[k] || k);

  const rev = data.revenue || {};
  const cogs = data.cogs || {};
  const gp = data.gross_profit || {};
  const gpPct = data.gross_margin_pct || {};
  const ebitda = data.ebitda || {};
  const netProfit = data.net_profit || {};
  const cashflow = data.cashflow || {};

  // Summary table rows
  const summaryRows = [
    { label: 'Chiffre d\'Affaires', values: yearKeys.map(k => fmtFCFA(rev[k])), cls: 'font-weight:700' },
    { label: 'Coûts des Ventes (COGS)', values: yearKeys.map(k => fmtFCFA(cogs[k])), cls: 'color:#ef4444' },
    { label: 'Marge Brute', values: yearKeys.map(k => fmtFCFA(gp[k])), cls: 'font-weight:600' },
    { label: 'Marge Brute %', values: yearKeys.map(k => fmtPct(gpPct[k])), cls: 'color:#22d3ee' },
    { label: 'EBITDA', values: yearKeys.map(k => fmtFCFA(ebitda[k])), cls: 'font-weight:700;color:#22d3ee' },
    { label: 'Résultat Net', values: yearKeys.map(k => fmtFCFA(netProfit[k])), cls: 'font-weight:700' },
  ];

  // Staff table
  const staffRows = (data.staff || []).map((s: any) =>
    `<tr><td>${s.label || s.category || ''}</td><td>${s.department || ''}</td><td style="text-align:right">${fmtPct(s.social_security_rate)}</td></tr>`
  ).join('');

  // CAPEX table
  const capexRows = (data.capex || []).map((c: any) =>
    `<tr><td>${c.label || ''}</td><td style="text-align:center">${c.acquisition_year || ''}</td><td style="text-align:right">${fmtFCFA(c.acquisition_value)}</td><td style="text-align:right">${fmtPct(c.amortisation_rate_pct)}</td></tr>`
  ).join('');

  // Key assumptions
  const assumptions = (data.key_assumptions || []).map((a: string) => `<li>${a}</li>`).join('');

  // Break-even
  const breakEven = data.break_even_year || '—';

  // Chart data
  const chartRevenue = yearKeys.map(k => rev[k] || 0);
  const chartEbitda = yearKeys.map(k => ebitda[k] || 0);
  const chartNetProfit = yearKeys.map(k => netProfit[k] || 0);
  const chartCashflow = yearKeys.map(k => cashflow[k] || 0);

  // OPEX breakdown
  const opex = data.opex || {};
  const opexCategories = [
    { key: 'staff_salaries', label: 'Salaires Personnel' },
    { key: 'marketing', label: 'Marketing' },
    { key: 'office_costs', label: 'Frais de Bureau' },
    { key: 'travel', label: 'Déplacements' },
    { key: 'insurance', label: 'Assurances' },
    { key: 'maintenance', label: 'Entretien' },
    { key: 'third_parties', label: 'Tierces Parties' },
    { key: 'other', label: 'Autres Charges' },
  ];

  const opexRows = opexCategories
    .filter(c => opex[c.key])
    .map(c => `<tr><td>${c.label}</td>${yearKeys.map(k => `<td style="text-align:right">${fmtFCFA(opex[c.key]?.[k])}</td>`).join('')}</tr>`)
    .join('');

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Plan Financier OVO - ${enterpriseName} | ESONO</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"><\/script>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Segoe UI',system-ui,sans-serif;background:#0f172a;color:#e2e8f0;line-height:1.6}
.page{max-width:1100px;margin:0 auto;padding:32px 24px}
.hero{background:linear-gradient(135deg,#1e293b 0%,#0f172a 50%,#1e293b 100%);border:1px solid #334155;padding:48px 40px;border-radius:16px;margin-bottom:32px;position:relative}
.hero h1{font-size:32px;font-weight:800;color:#22d3ee;letter-spacing:-0.5px}
.hero .sub{color:#94a3b8;font-size:14px;margin-top:6px}
.hero .company{font-size:18px;font-weight:600;color:#f1f5f9;margin-top:4px}
.card{background:#1e293b;border-radius:12px;padding:28px;margin-bottom:20px;border:1px solid #334155}
.card h2{font-size:18px;font-weight:700;color:#22d3ee;margin-bottom:16px;padding-bottom:8px;border-bottom:1px solid #334155}
table{width:100%;border-collapse:collapse;font-size:13px;margin:12px 0}
table th{text-align:left;padding:10px 12px;background:#0f172a;border-bottom:2px solid #334155;font-weight:600;color:#94a3b8;font-size:11px;text-transform:uppercase;letter-spacing:.5px}
table td{padding:9px 12px;border-bottom:1px solid #1e293b}
table tr:hover td{background:#0f172a}
.amount{text-align:right;font-variant-numeric:tabular-nums}
.grid-2{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.grid-3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px}
.metric{padding:16px;background:#0f172a;border-radius:10px;border:1px solid #334155}
.metric .val{font-size:22px;font-weight:800;color:#22d3ee}.metric .lbl{font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.5px}
.break-even{background:linear-gradient(135deg,#064e3b,#065f46);border:1px solid #10b981;border-radius:10px;padding:20px;text-align:center}
.break-even .year{font-size:36px;font-weight:900;color:#10b981}
.chart-container{position:relative;height:350px;margin:16px 0}
ul{padding-left:18px}li{font-size:13px;margin-bottom:5px;color:#94a3b8}
.footer{text-align:center;margin-top:40px;padding:20px;font-size:11px;color:#475569;border-top:1px solid #334155}
@media print{body{background:#fff;color:#1e293b}.card{background:#f8fafc;border-color:#e2e8f0}.card h2{color:#1a2744}}
</style>
</head>
<body>
<div class="page">

<div class="hero">
  <h1>📊 PLAN FINANCIER OVO</h1>
  <p class="company">${enterpriseName}</p>
  <p class="sub">${data.country || "Côte d'Ivoire"} • ${data.currency || 'XOF'} (FCFA) • Généré le ${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
  <p class="sub">ESONO — Investment Readiness Platform</p>
</div>

<!-- Break-even highlight -->
<div class="grid-3" style="margin-bottom:20px">
  <div class="break-even">
    <div class="lbl" style="color:#6ee7b7;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Seuil de Rentabilité</div>
    <div class="year">${breakEven}</div>
  </div>
  <div class="metric" style="text-align:center">
    <div class="lbl">Besoin de Financement</div>
    <div class="val">${fmtFCFA(data.funding_need)}</div>
  </div>
  <div class="metric" style="text-align:center">
    <div class="lbl">Taux de Change EUR</div>
    <div class="val" style="font-size:18px">${data.exchange_rate_eur || 655.957}</div>
  </div>
</div>

<!-- Summary Table -->
<div class="card">
  <h2>📈 Tableau Récapitulatif — Projections 5 Ans</h2>
  <div style="overflow-x:auto">
  <table>
    <tr><th>Indicateur</th>${yearLabels.map(y => `<th style="text-align:right">${y}</th>`).join('')}</tr>
    ${summaryRows.map(r => `<tr style="${r.cls}"><td>${r.label}</td>${r.values.map(v => `<td style="text-align:right">${v}</td>`).join('')}</tr>`).join('')}
  </table>
  </div>
</div>

<!-- Charts -->
<div class="grid-2">
  <div class="card">
    <h2>📊 CA vs EBITDA</h2>
    <div class="chart-container"><canvas id="barChart"></canvas></div>
  </div>
  <div class="card">
    <h2>📉 Résultat Net & Cashflow</h2>
    <div class="chart-container"><canvas id="lineChart"></canvas></div>
  </div>
</div>

<!-- OPEX Breakdown -->
${opexRows ? `<div class="card">
  <h2>💰 Dépenses Opérationnelles</h2>
  <div style="overflow-x:auto">
  <table>
    <tr><th>Catégorie</th>${yearLabels.map(y => `<th style="text-align:right">${y}</th>`).join('')}</tr>
    ${opexRows}
  </table>
  </div>
</div>` : ''}

<!-- Staff -->
${staffRows ? `<div class="card">
  <h2>👥 Effectifs</h2>
  <table>
    <tr><th>Catégorie</th><th>Département</th><th style="text-align:right">Cotisations Sociales</th></tr>
    ${staffRows}
  </table>
</div>` : ''}

<!-- CAPEX -->
${capexRows ? `<div class="card">
  <h2>🏗️ Investissements (CAPEX)</h2>
  <table>
    <tr><th>Description</th><th style="text-align:center">Année</th><th style="text-align:right">Valeur</th><th style="text-align:right">Amortissement</th></tr>
    ${capexRows}
  </table>
</div>` : ''}

<!-- Key Assumptions -->
${assumptions ? `<div class="card">
  <h2>📋 Hypothèses Clés</h2>
  <ul>${assumptions}</ul>
</div>` : ''}

<div class="footer">ESONO Investment Readiness Platform © ${new Date().getFullYear()} — Plan Financier OVO — Confidentiel</div>
</div>

<script>
const labels = ${JSON.stringify(yearLabels)};
const barCtx = document.getElementById('barChart');
if (barCtx) {
  new Chart(barCtx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Chiffre d\\'Affaires', data: ${JSON.stringify(chartRevenue)}, backgroundColor: 'rgba(34,211,238,0.7)', borderRadius: 4 },
        { label: 'EBITDA', data: ${JSON.stringify(chartEbitda)}, backgroundColor: 'rgba(16,185,129,0.7)', borderRadius: 4 }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#94a3b8' } } },
      scales: {
        x: { ticks: { color: '#94a3b8' }, grid: { color: '#1e293b' } },
        y: { ticks: { color: '#94a3b8', callback: v => (v/1000000).toFixed(0)+'M' }, grid: { color: '#1e293b' } }
      }
    }
  });
}

const lineCtx = document.getElementById('lineChart');
if (lineCtx) {
  new Chart(lineCtx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'Résultat Net', data: ${JSON.stringify(chartNetProfit)}, borderColor: '#22d3ee', backgroundColor: 'rgba(34,211,238,0.1)', fill: true, tension: 0.3 },
        { label: 'Cashflow', data: ${JSON.stringify(chartCashflow)}, borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.1)', fill: true, tension: 0.3 }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#94a3b8' } } },
      scales: {
        x: { ticks: { color: '#94a3b8' }, grid: { color: '#1e293b' } },
        y: { ticks: { color: '#94a3b8', callback: v => (v/1000000).toFixed(0)+'M' }, grid: { color: '#1e293b' } }
      }
    }
  });
}
<\/script>
</body>
</html>`;
}
