/**
 * OVO Data Expander — expands condensed AI JSON into full per_year format
 * for Excel cell injection. Extracted from generate-ovo-plan.
 */

// deno-lint-ignore no-explicit-any
export function expandCondensedData(json: Record<string, any>): void {
  if (Array.isArray(json.products)) {
    json.products = json.products.map((p: any) => expandProductOrService(p));
  }
  if (Array.isArray(json.services)) {
    json.services = json.services.map((s: any) => expandProductOrService(s));
  }
  if (Array.isArray(json.staff)) {
    json.staff = json.staff.map((c: any) => expandStaffCategory(c));
  }
  if (json.opex && typeof json.opex === 'object') {
    json.opex = expandOpex(json.opex);
  }
  console.log(`[expand] Products: ${(json.products||[]).filter((p:any)=>p.per_year?.length).length} expanded, Staff: ${(json.staff||[]).filter((s:any)=>s.per_year?.length).length} expanded`);
}

// deno-lint-ignore no-explicit-any
export function validateAndFillVolumes(json: Record<string, any>): void {
  const validate = (items: any[]) => {
    if (!Array.isArray(items)) return;
    for (const item of items) {
      if (!item?.active || !item.per_year || !Array.isArray(item.per_year)) continue;
      const g = item.growth_rate || 0.15;
      item.per_year = repairPerYearVolumes(item.per_year, g);
    }
  };
  validate(json.products || []);
  validate(json.services || []);
}

// deno-lint-ignore no-explicit-any
export function scaleToFrameworkTargets(json: Record<string, any>, frameworkData?: Record<string, any>, planOvoData?: Record<string, any>): void {
  const targets: Record<string, number> = {};
  const yearLabelToJsonKey: Record<string, string> = {
    "YEAR-2": "year_minus_2", "YEAR-1": "year_minus_1", "CURRENT YEAR": "current_year",
    "YEAR2": "year2", "YEAR3": "year3", "YEAR4": "year4", "YEAR5": "year5", "YEAR6": "year6",
  };

  // PRIMARY: Framework targets (source of truth for YEAR2-YEAR6)
  const fw = frameworkData as any;
  if (fw?.projection_5ans?.lignes && Array.isArray(fw.projection_5ans.lignes)) {
    const caLine = fw.projection_5ans.lignes.find((l: any) => {
      const lb = (l.poste || l.libelle || '').toLowerCase();
      return lb.includes("ca total") || lb.includes("chiffre") || lb.includes("revenue");
    });
    if (caLine) {
      const fwMapping: Record<string, string> = {
        "YEAR2": "an1", "YEAR3": "an2", "YEAR4": "an3", "YEAR5": "an4", "YEAR6": "an5",
      };
      for (const [yearLabel, fwKey] of Object.entries(fwMapping)) {
        const raw = caLine[fwKey];
        const val = typeof raw === 'number' ? raw : parseFcfaValue(String(raw || ''));
        if (val > 0) targets[yearLabel] = val;
      }
    }
  }

  // FALLBACK: planOvoData.revenue only for years NOT covered by Framework (YEAR-2, YEAR-1, CURRENT YEAR)
  const poRevenue = (planOvoData as any)?.revenue;
  if (poRevenue && typeof poRevenue === 'object') {
    for (const [yearLabel, jsonKey] of Object.entries(yearLabelToJsonKey)) {
      if (!targets[yearLabel]) {
        const val = Number(poRevenue[jsonKey]);
        if (val > 0) targets[yearLabel] = val;
      }
    }
  }

  if (Object.keys(targets).length === 0) {
    console.log("[scaleToFramework] No targets found, skipping scaling");
    return;
  }

  console.log("[scaleToFramework] Targets:", JSON.stringify(targets));

  const yearLabels = ["YEAR-2", "YEAR-1", "CURRENT YEAR", "YEAR2", "YEAR3", "YEAR4", "YEAR5", "YEAR6"];
  const allItems = [
    ...(Array.isArray(json.products) ? json.products.filter((p: any) => p.active !== false) : []),
    ...(Array.isArray(json.services) ? json.services.filter((s: any) => s.active !== false) : []),
  ];

  for (const yearLabel of yearLabels) {
    const target = targets[yearLabel];
    if (!target || target <= 0) continue;

    let revenueExcel = 0;
    for (const item of allItems) {
      if (!item.per_year || !Array.isArray(item.per_year)) continue;
      const yr = item.per_year.find((y: any) => y.year === yearLabel);
      if (!yr) continue;
      const price = yr.unit_price_r1 || yr.unit_price_r2 || yr.unit_price_r3 || 0;
      const totalVol = (yr.volume_q1 || yr.volume_h1 || 0) + (yr.volume_q2 || yr.volume_h2 || 0) + (yr.volume_q3 || 0) + (yr.volume_q4 || 0);
      revenueExcel += totalVol * price;
    }

    if (revenueExcel <= 0) continue;

    const ecart = Math.abs(revenueExcel - target) / target;
    if (ecart <= 0.05) continue;

    const ratio = target / revenueExcel;
    console.log(`[scaleToFramework] ${yearLabel}: Excel=${Math.round(revenueExcel)}, Target=${target}, Ratio=${ratio.toFixed(3)}, Ecart=${(ecart*100).toFixed(1)}%`);

    for (const item of allItems) {
      if (!item.per_year || !Array.isArray(item.per_year)) continue;
      const yr = item.per_year.find((y: any) => y.year === yearLabel);
      if (!yr) continue;
      yr.volume_q1 = Math.round((yr.volume_q1 || yr.volume_h1 || 0) * ratio);
      yr.volume_q2 = Math.round((yr.volume_q2 || yr.volume_h2 || 0) * ratio);
      yr.volume_q3 = Math.round((yr.volume_q3 || 0) * ratio);
      yr.volume_q4 = Math.round((yr.volume_q4 || 0) * ratio);
      delete yr.volume_h1;
      delete yr.volume_h2;
    }
  }

  // ── Post-scaling verification loop (max 2 passes) ──
  for (let pass = 0; pass < 2; pass++) {
    let needsRepass = false;
    for (const yearLabel of yearLabels) {
      const target = targets[yearLabel];
      if (!target || target <= 0) continue;

      let revenueActual = 0;
      for (const item of allItems) {
        if (!item.per_year || !Array.isArray(item.per_year)) continue;
        const yr = item.per_year.find((y: any) => y.year === yearLabel);
        if (!yr) continue;
        const price = yr.unit_price_r1 || yr.unit_price_r2 || yr.unit_price_r3 || 0;
        const totalVol = (yr.volume_q1 || 0) + (yr.volume_q2 || 0) + (yr.volume_q3 || 0) + (yr.volume_q4 || 0);
        revenueActual += totalVol * price;
      }

      if (revenueActual <= 0) continue;
      const ecart = Math.abs(revenueActual - target) / target;
      if (ecart <= 0.03) continue;

      needsRepass = true;
      const correctionRatio = target / revenueActual;
      console.log(`[scaleVerify] Pass ${pass + 1}, ${yearLabel}: actual=${Math.round(revenueActual)}, target=${target}, correction=${correctionRatio.toFixed(4)}, ecart=${(ecart * 100).toFixed(1)}%`);

      for (const item of allItems) {
        if (!item.per_year || !Array.isArray(item.per_year)) continue;
        const yr = item.per_year.find((y: any) => y.year === yearLabel);
        if (!yr) continue;
        yr.volume_q1 = Math.round((yr.volume_q1 || 0) * correctionRatio);
        yr.volume_q2 = Math.round((yr.volume_q2 || 0) * correctionRatio);
        yr.volume_q3 = Math.round((yr.volume_q3 || 0) * correctionRatio);
        yr.volume_q4 = Math.round((yr.volume_q4 || 0) * correctionRatio);
      }
    }
    if (!needsRepass) {
      console.log(`[scaleVerify] Pass ${pass + 1}: all years within 3% tolerance`);
      break;
    }
  }
}

// deno-lint-ignore no-explicit-any
export function normalizeRangeData(json: Record<string, any>): void {
  const normalize = (items: any[]) => {
    if (!Array.isArray(items)) return;
    for (const item of items) {
      if (!item?.active || !item.per_year) continue;
      const rf = item.range_flags || [1, 0, 0];
      if (rf[0] === 0 && (rf[2] === 1 || rf[1] === 1)) {
        const srcRange = rf[2] === 1 ? 'r3' : 'r2';
        console.log(`[normalize] "${item.name}": shifting ${srcRange} → r1`);
        item.range_flags = [1, 0, 0];
        for (const yr of item.per_year) {
          if (srcRange === 'r3') {
            yr.unit_price_r1 = yr.unit_price_r3 || yr.unit_price_r1 || 0;
            yr.cogs_r1 = yr.cogs_r3 || yr.cogs_r1 || 0;
            yr.mix_r1 = yr.mix_r3 || yr.mix_r1 || 1.0;
            yr.mix_r1_ch1 = yr.mix_r3_ch1 || yr.mix_r1_ch1 || 0;
            yr.mix_r1_ch2 = yr.mix_r3_ch2 || yr.mix_r1_ch2 || 1.0;
            yr.unit_price_r3 = 0; yr.cogs_r3 = 0; yr.mix_r3 = 0;
            yr.mix_r3_ch1 = 0; yr.mix_r3_ch2 = 0;
          } else {
            yr.unit_price_r1 = yr.unit_price_r2 || yr.unit_price_r1 || 0;
            yr.cogs_r1 = yr.cogs_r2 || yr.cogs_r1 || 0;
            yr.mix_r1 = yr.mix_r2 || yr.mix_r1 || 1.0;
            yr.mix_r1_ch1 = yr.mix_r2_ch1 || yr.mix_r1_ch1 || 0;
            yr.mix_r1_ch2 = yr.mix_r2_ch2 || yr.mix_r1_ch2 || 1.0;
            yr.unit_price_r2 = 0; yr.cogs_r2 = 0; yr.mix_r2 = 0;
            yr.mix_r2_ch1 = 0; yr.mix_r2_ch2 = 0;
          }
        }
      }
    }
  };
  normalize(json.products || []);
  normalize(json.services || []);
}

// ── Internal helpers ──

function parseFcfaValue(raw: string): number {
  if (!raw) return 0;
  const cleaned = raw.replace(/[^\d.,MmKk]/g, '').trim();
  if (cleaned.toLowerCase().endsWith('m')) return parseFloat(cleaned.slice(0, -1)) * 1_000_000;
  if (cleaned.toLowerCase().endsWith('k')) return parseFloat(cleaned.slice(0, -1)) * 1_000;
  return parseFloat(cleaned.replace(/[.,]/g, '')) || 0;
}

// deno-lint-ignore no-explicit-any
function expandProductOrService(p: any): any {
  const yearLabels = ["YEAR-2","YEAR-1","CURRENT YEAR","YEAR2","YEAR3","YEAR4","YEAR5","YEAR6"];

  if (p.per_year && Array.isArray(p.per_year) && p.per_year.length >= 8) {
    return { ...p, per_year: repairPerYearVolumes(p.per_year, p.growth_rate || 0.15) };
  }

  if (p.per_year && Array.isArray(p.per_year) && p.per_year.length >= 4 && p.per_year.length < 8) {
    console.log(`[expand] Product "${p.name}": partial per_year (${p.per_year.length}/8), extrapolating...`);
    const existing = p.per_year;
    const g = p.growth_rate || 0.15;
    const pg = p.price_growth || 0.03;
    while (existing.length < 8) {
      const idx = existing.length;
      const prevEntry = existing[existing.length - 1];
    const totalVol = (prevEntry.volume_q1 || prevEntry.volume_h1 || 0) + (prevEntry.volume_q2 || prevEntry.volume_h2 || 0) + (prevEntry.volume_q3 || 0) + (prevEntry.volume_q4 || 0);
      const newVol = Math.round(totalVol * (1 + g));
      const newEntry = { ...prevEntry };
      newEntry.year = yearLabels[idx];
      const q1 = Math.round(newVol * 0.22);
      const q2 = Math.round(newVol * 0.25);
      const q3 = Math.round(newVol * 0.27);
      newEntry.volume_q1 = q1;
      newEntry.volume_q2 = q2;
      newEntry.volume_q3 = q3;
      newEntry.volume_q4 = newVol - q1 - q2 - q3;
      delete newEntry.volume_h1;
      delete newEntry.volume_h2;
      for (const k of ['unit_price_r1', 'unit_price_r2', 'unit_price_r3']) {
        if (newEntry[k]) newEntry[k] = Math.round(newEntry[k] * (1 + pg) / 1000) * 1000;
      }
      for (const k of ['cogs_r1', 'cogs_r2', 'cogs_r3']) {
        if (newEntry[k]) newEntry[k] = Math.round(newEntry[k] * (1 + pg) / 1000) * 1000;
      }
      existing.push(newEntry);
    }
    return { ...p, per_year: repairPerYearVolumes(existing, g) };
  }

  if (!p.active) {
    return { ...p, per_year: yearLabels.map(y => ({
      year: y, unit_price_r1:0, unit_price_r2:0, unit_price_r3:0,
      mix_r1:0, mix_r2:0, mix_r3:0, cogs_r1:0, cogs_r2:0, cogs_r3:0,
      mix_r1_ch1:0, mix_r2_ch1:0, mix_r3_ch1:0,
      mix_r1_ch2:0, mix_r2_ch2:0, mix_r3_ch2:0,
      volume_q1:0, volume_q2:0, volume_q3:0, volume_q4:0,
    }))};
  }

  const priceCY = p.price_cy || 0;
  const cogsRate = p.cogs_rate || 0.35;
  const volYM2 = p.volume_ym2 || 0;
  const volYM1 = p.volume_ym1 || 0;
  const volCY = p.volume_cy || 0;
  const g = p.growth_rate || 0.15;
  const pg = p.price_growth || 0.03;
  const rf = p.range_flags || [1, 0, 0];
  const cf = p.channel_flags || [0, 1];

  const yearConfigs = [
    { year: "YEAR-2", volume: volYM2, pMul: 1/((1+pg)*(1+pg)) },
    { year: "YEAR-1", volume: volYM1, pMul: 1/(1+pg) },
    { year: "CURRENT YEAR", volume: volCY, pMul: 1 },
    { year: "YEAR2", volume: Math.round(volCY*(1+g)), pMul: 1+pg },
    { year: "YEAR3", volume: Math.round(volCY*Math.pow(1+g,2)), pMul: Math.pow(1+pg,2) },
    { year: "YEAR4", volume: Math.round(volCY*Math.pow(1+g,3)), pMul: Math.pow(1+pg,3) },
    { year: "YEAR5", volume: Math.round(volCY*Math.pow(1+g,4)), pMul: Math.pow(1+pg,4) },
    { year: "YEAR6", volume: Math.round(volCY*Math.pow(1+g,5)), pMul: Math.pow(1+pg,5) },
  ];

  const totalCh = (cf[0]||0) + (cf[1]||0) || 1;
  const mixCh1 = (cf[0]||0) / totalCh;
  const mixCh2 = (cf[1]||0) / totalCh;

  const per_year = yearConfigs.map(yc => {
    const price = Math.round(priceCY * yc.pMul / 1000) * 1000;
    const cogs = Math.round(price * cogsRate / 1000) * 1000;
    const vol_q1 = Math.round(yc.volume * 0.22);
    const vol_q2 = Math.round(yc.volume * 0.25);
    const vol_q3 = Math.round(yc.volume * 0.27);
    const vol_q4 = yc.volume - vol_q1 - vol_q2 - vol_q3;

    return {
      year: yc.year,
      unit_price_r1: rf[0] ? price : 0, unit_price_r2: rf[1] ? price : 0, unit_price_r3: rf[2] ? price : 0,
      mix_r1: rf[0] ? 1.0 : 0, mix_r2: rf[1] ? 1.0 : 0, mix_r3: rf[2] ? 1.0 : 0,
      cogs_r1: rf[0] ? cogs : 0, cogs_r2: rf[1] ? cogs : 0, cogs_r3: rf[2] ? cogs : 0,
      mix_r1_ch1: rf[0] ? mixCh1 : 0, mix_r2_ch1: rf[1] ? mixCh1 : 0, mix_r3_ch1: rf[2] ? mixCh1 : 0,
      mix_r1_ch2: rf[0] ? mixCh2 : 0, mix_r2_ch2: rf[1] ? mixCh2 : 0, mix_r3_ch2: rf[2] ? mixCh2 : 0,
      volume_q1: vol_q1, volume_q2: vol_q2, volume_q3: vol_q3, volume_q4: vol_q4,
    };
  });

  return { ...p, per_year };
}

// deno-lint-ignore no-explicit-any
function repairPerYearVolumes(perYear: any[], growthRate: number): any[] {
  if (!perYear || perYear.length < 3) return perYear;
  const cyEntry = perYear.find((e: any) => e.year === "CURRENT YEAR") || perYear[2];
  const cyVolume = (cyEntry?.volume_q1 || cyEntry?.volume_h1 || 0) + (cyEntry?.volume_q2 || cyEntry?.volume_h2 || 0) + (cyEntry?.volume_q3 || 0) + (cyEntry?.volume_q4 || 0);
  if (cyVolume === 0) return perYear;

  const g = growthRate || 0.15;
  let lastKnownVolume = cyVolume;

  for (let i = 3; i < perYear.length && i < 8; i++) {
    const entry = perYear[i];
    const vol = (entry.volume_q1 || entry.volume_h1 || 0) + (entry.volume_q2 || entry.volume_h2 || 0) + (entry.volume_q3 || 0) + (entry.volume_q4 || 0);
    if (vol > 0) {
      lastKnownVolume = vol;
    } else {
      const newVol = Math.round(lastKnownVolume * (1 + g));
      const q1 = Math.round(newVol * 0.22);
      const q2 = Math.round(newVol * 0.25);
      const q3 = Math.round(newVol * 0.27);
      entry.volume_q1 = q1;
      entry.volume_q2 = q2;
      entry.volume_q3 = q3;
      entry.volume_q4 = newVol - q1 - q2 - q3;
      delete entry.volume_h1;
      delete entry.volume_h2;
      lastKnownVolume = newVol;
    }
  }
  return perYear;
}

// deno-lint-ignore no-explicit-any
function expandStaffCategory(cat: any): any {
  if (cat.per_year && Array.isArray(cat.per_year) && cat.per_year.length >= 4) return cat;

  const hc = cat.headcount_by_year || [0,0,0,0,0,0,0,0];
  const salaryCY = cat.monthly_salary_cy || 0;
  const sg = cat.salary_growth || 0.05;
  const allowCY = cat.annual_allowances_cy || 0;

  const yearLabels = ["YEAR-2","YEAR-1","CURRENT YEAR","YEAR2","YEAR3","YEAR4","YEAR5","YEAR6"];
  const salaryMults = [
    1/((1+sg)*(1+sg)), 1/(1+sg), 1,
    1+sg, Math.pow(1+sg,2), Math.pow(1+sg,3), Math.pow(1+sg,4), Math.pow(1+sg,5),
  ];

  const per_year = yearLabels.map((year, i) => ({
    year,
    headcount: hc[i] || 0,
    gross_monthly_salary_per_person: Math.round(salaryCY * salaryMults[i] / 1000) * 1000,
    annual_allowances_per_person: Math.round(allowCY * salaryMults[i] / 1000) * 1000,
  }));

  return { ...cat, per_year };
}

const OPEX_SPLITS: Record<string, Record<string, number>> = {
  marketing: { research: 0.15, purchase_studies: 0.05, receptions: 0.20, documentation: 0.10, advertising: 0.50 },
  taxes_on_staff: { salaries_tax: 0.70, apprenticeship: 0.10, training: 0.15, other: 0.05 },
  office: { rent: 0.35, internet: 0.12, telecom: 0.10, supplies: 0.10, fuel: 0.08, water: 0.05, electricity: 0.15, cleaning: 0.05 },
  other: { health: 0.50, directors: 0.30, donations: 0.20 },
  insurance: { building: 0.30, company: 0.70 },
  maintenance: { movable: 0.60, other: 0.40 },
  third_parties: { legal: 0.25, accounting: 0.30, transport: 0.20, commissions: 0.15, delivery: 0.10 },
};

// deno-lint-ignore no-explicit-any
function expandOpex(opex: any): any {
  const result: any = {};
  for (const [category, catData] of Object.entries(opex)) {
    if (category === 'travel') {
      result.travel = expandTravelOpex(catData);
      continue;
    }
    if (catData && typeof catData === 'object' && !Array.isArray(catData)) {
      const vals = Object.values(catData as Record<string, unknown>);
      if (vals.length > 0 && Array.isArray(vals[0])) {
        result[category] = catData;
        continue;
      }
    }
    const cd = catData as any;
    if (!cd || typeof cd !== 'object' || cd.total_cy === undefined) {
      result[category] = catData;
      continue;
    }
    const totalCY = cd.total_cy || 0;
    const growth = cd.growth || 0.05;
    const splits = cd.split || OPEX_SPLITS[category] || {};
    const expanded: Record<string, number[]> = {};
    for (const [subKey, ratio] of Object.entries(splits)) {
      const subCY = Math.round(totalCY * (ratio as number) / 1000) * 1000;
      expanded[subKey] = buildOpexTimeSeries(subCY, growth);
    }
    result[category] = expanded;
  }
  return result;
}

// deno-lint-ignore no-explicit-any
function expandTravelOpex(travel: any): any {
  if (!travel || typeof travel !== 'object') return travel;
  if (Array.isArray(travel.nb_travellers)) return travel;
  const nbCY = travel.nb_travellers_cy || 0;
  const avgCY = travel.avg_cost_cy || 0;
  const growth = travel.growth || 0.05;
  return {
    nb_travellers: buildOpexTimeSeriesInt(nbCY, growth),
    avg_cost: buildOpexTimeSeries(avgCY, growth),
  };
}

function buildOpexTimeSeries(valueCY: number, growth: number): number[] {
  const ym2 = Math.round(valueCY / Math.pow(1+growth, 2) / 1000) * 1000;
  const ym1 = Math.round(valueCY / (1+growth) / 1000) * 1000;
  const h1 = Math.round(valueCY * 0.45 / 1000) * 1000;
  const h2 = Math.round(valueCY * 0.55 / 1000) * 1000;
  const cy = 0;
  const vals = [ym2, ym1, h1, h2, cy];
  for (let i = 1; i <= 5; i++) {
    vals.push(Math.round(valueCY * Math.pow(1+growth, i) / 1000) * 1000);
  }
  return vals;
}

function buildOpexTimeSeriesInt(valueCY: number, growth: number): number[] {
  const ym2 = Math.round(valueCY / Math.pow(1+growth, 2));
  const ym1 = Math.round(valueCY / (1+growth));
  const h1 = Math.round(valueCY * 0.5);
  const h2 = Math.round(valueCY * 0.5);
  const cy = 0;
  const vals = [ym2, ym1, h1, h2, cy];
  for (let i = 1; i <= 5; i++) {
    vals.push(Math.round(valueCY * Math.pow(1+growth, i)));
  }
  return vals;
}
