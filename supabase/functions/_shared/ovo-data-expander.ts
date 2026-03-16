/**
 * OVO Data Expander — expands condensed AI JSON into full per_year format
 * for Excel cell injection. Extracted from generate-ovo-plan.
 */

// ── Common volume helper (Fix #1) ──
// deno-lint-ignore no-explicit-any
export function getTotalVolume(yr: any): number {
  return (yr.volume_q1 || yr.volume_h1 || 0)
       + (yr.volume_q2 || yr.volume_h2 || 0)
       + (yr.volume_q3 || 0)
       + (yr.volume_q4 || 0);
}

// deno-lint-ignore no-explicit-any
function getWeightedPrice(yr: any): number {
  return yr.unit_price_r1 || yr.unit_price_r2 || yr.unit_price_r3 || 0;
}

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

/**
 * Scale product-level cogs_r1/r2/r3 so that Excel gross margin matches Framework "Marge Brute".
 * Called after scaleToFrameworkTargets (volumes already aligned with Framework revenue).
 */
// deno-lint-ignore no-explicit-any
export function scaleCOGSToFramework(json: Record<string, any>, frameworkData?: Record<string, any>): void {
  const fw = frameworkData as any;
  if (!fw?.projection_5ans?.lignes || !Array.isArray(fw.projection_5ans.lignes)) return;

  const lignes = fw.projection_5ans.lignes;
  const findLigne = (...patterns: string[]) =>
    lignes.find((l: any) => {
      const lb = (l.poste || l.libelle || '').toLowerCase();
      return patterns.some(p => lb.includes(p)) && !lb.includes('%') && !lb.includes('(%)');
    });

  const caLine = findLigne('ca total', 'chiffre', 'revenue', 'ca ');
  const mbLine = findLigne('marge brute', 'gross margin', 'gross profit');
  if (!caLine) return;
  if (!mbLine) {
    console.warn('[scaleCOGS] Marge Brute line not found in Framework — skipping COGS scaling');
    return;
  }
  const mbLabel = (mbLine.poste || mbLine.libelle || '').toLowerCase();
  if (mbLabel.includes('ebitda') || mbLabel.includes('exploitation')) {
    console.warn('[scaleCOGS] Found EBITDA line instead of Marge Brute — skipping COGS scaling');
    return;
  }

  const yearLabelToFwKey: Record<string, string> = {
    "YEAR2": "an1", "YEAR3": "an2", "YEAR4": "an3", "YEAR5": "an4", "YEAR6": "an5",
  };

  const allItems = [
    ...(Array.isArray(json.products) ? json.products.filter((p: any) => p.active !== false) : []),
    ...(Array.isArray(json.services) ? json.services.filter((s: any) => s.active !== false) : []),
  ];

  for (const [yearLabel, fwKey] of Object.entries(yearLabelToFwKey)) {
    const fwRevenue = typeof caLine[fwKey] === 'number' ? caLine[fwKey] : parseFcfaValue(String(caLine[fwKey] || ''));
    const fwMarge = typeof mbLine[fwKey] === 'number' ? mbLine[fwKey] : parseFcfaValue(String(mbLine[fwKey] || ''));
    if (fwRevenue <= 0 || fwMarge < 0) continue;

    const targetCogsRate = (fwRevenue - fwMarge) / fwRevenue;

    // Fix #1: use getTotalVolume helper consistently
    let excelRevenue = 0;
    let excelCOGS = 0;
    for (const item of allItems) {
      if (!item.per_year || !Array.isArray(item.per_year)) continue;
      const yr = item.per_year.find((y: any) => y.year === yearLabel);
      if (!yr) continue;
      const price = getWeightedPrice(yr);
      const cogs = yr.cogs_r1 || yr.cogs_r2 || yr.cogs_r3 || 0;
      const vol = getTotalVolume(yr);
      excelRevenue += vol * price;
      excelCOGS += vol * cogs;
    }

    if (excelRevenue <= 0 || excelCOGS <= 0) continue;

    const currentCogsRate = excelCOGS / excelRevenue;
    const cogsScalingRatio = targetCogsRate / currentCogsRate;
    const ecart = Math.abs(cogsScalingRatio - 1);
    if (ecart <= 0.05) continue;

    console.log(`[scaleCOGS] ${yearLabel}: currentCOGS%=${(currentCogsRate*100).toFixed(1)}%, targetCOGS%=${(targetCogsRate*100).toFixed(1)}%, ratio=${cogsScalingRatio.toFixed(3)}`);

    for (const item of allItems) {
      if (!item.per_year || !Array.isArray(item.per_year)) continue;
      const yr = item.per_year.find((y: any) => y.year === yearLabel);
      if (!yr) continue;
      for (const cogsKey of ['cogs_r1', 'cogs_r2', 'cogs_r3'] as const) {
        if (yr[cogsKey]) yr[cogsKey] = Math.round(yr[cogsKey] * cogsScalingRatio / 1000) * 1000;
      }
    }
  }
}

// deno-lint-ignore no-explicit-any
export function scaleToFrameworkTargets(json: Record<string, any>, frameworkData?: Record<string, any>, planOvoData?: Record<string, any>, inputsData?: Record<string, any>): void {
  const targets: Record<string, number> = {};
  const yearLabels = ["YEAR-2", "YEAR-1", "CURRENT YEAR", "YEAR2", "YEAR3", "YEAR4", "YEAR5", "YEAR6"];

  // Framework is the source of truth for projection years (YEAR2-YEAR6)
  const fw = frameworkData as any;
  if (fw?.projection_5ans?.lignes && Array.isArray(fw.projection_5ans.lignes)) {
    const caLine = fw.projection_5ans.lignes.find((l: any) => {
      const lb = (l.poste || l.libelle || '').toLowerCase();
      return lb.includes("ca total") || lb.includes("chiffre") || lb.includes("revenue") || lb.includes("ventes") || lb.includes("recettes") || lb.includes("turnover") || lb.includes("total revenus");
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

  // plan_ovo revenue used only as fallback for historical years not covered by Framework
  const poRevenue = (planOvoData as any)?.revenue;
  if (poRevenue && typeof poRevenue === 'object') {
    const historicalKeys: Array<[string, string]> = [
      ["YEAR-2", "year_minus_2"], ["YEAR-1", "year_minus_1"], ["CURRENT YEAR", "current_year"],
    ];
    for (const [yearLabel, jsonKey] of historicalKeys) {
      if (!targets[yearLabel]) {
        const val = Number(poRevenue[jsonKey]);
        if (val > 0) targets[yearLabel] = val;
      }
    }
  }

  // Fix #3: Derive historical targets from Inputs data when available
  const inp = inputsData as any;
  if (inp) {
    const inputCA = Number(inp?.compte_resultat?.chiffre_affaires || inp?.compte_resultat?.ca || inp?.revenue || 0);
    if (inputCA > 0 && !targets["CURRENT YEAR"]) {
      targets["CURRENT YEAR"] = inputCA;
      console.log(`[scaleToFramework] Injected CURRENT YEAR target from Inputs: ${inputCA}`);
    }
    // Derive YEAR-1 and YEAR-2 from CY using inverse growth if not already set
    const avgGrowth = 0.15; // reasonable default
    if (inputCA > 0) {
      if (!targets["YEAR-1"]) {
        targets["YEAR-1"] = Math.round(inputCA / (1 + avgGrowth));
        console.log(`[scaleToFramework] Derived YEAR-1 target: ${targets["YEAR-1"]}`);
      }
      if (!targets["YEAR-2"]) {
        targets["YEAR-2"] = Math.round(inputCA / Math.pow(1 + avgGrowth, 2));
        console.log(`[scaleToFramework] Derived YEAR-2 target: ${targets["YEAR-2"]}`);
      }
    }
  }

  if (Object.keys(targets).length === 0) {
    console.log("[scaleToFramework] No targets found, skipping scaling");
    return;
  }

  console.log("[scaleToFramework] Targets:", JSON.stringify(targets));

  const allItems = [
    ...(Array.isArray(json.products) ? json.products.filter((p: any) => p.active !== false) : []),
    ...(Array.isArray(json.services) ? json.services.filter((s: any) => s.active !== false) : []),
  ];

  for (const yearLabel of yearLabels) {
    const target = targets[yearLabel];
    if (!target || target <= 0) continue;

    // Fix #1: use getTotalVolume consistently
    let revenueExcel = 0;
    for (const item of allItems) {
      if (!item.per_year || !Array.isArray(item.per_year)) continue;
      const yr = item.per_year.find((y: any) => y.year === yearLabel);
      if (!yr) continue;
      const price = getWeightedPrice(yr);
      const totalVol = getTotalVolume(yr);
      revenueExcel += totalVol * price;
    }

    // Per-item price recovery: fix zero-price items even when total revenueExcel > 0.
    // Handles the case where some products have valid prices but others have price=0
    // (e.g. Products 01/02 price=0, Product 03 price=2000 → revenueExcel > 0 but
    // Products 01/02 still need prices derived from the remaining target budget).
    {
      const zeroPriceItems: Array<{ yr: any }> = [];
      let revenueFromPriced = 0;
      let zeroPriceVolume = 0;

      for (const item of allItems) {
        if (!item.per_year || !Array.isArray(item.per_year)) continue;
        const yr = item.per_year.find((y: any) => y.year === yearLabel);
        if (!yr) continue;
        const price = getWeightedPrice(yr);
        const vol = getTotalVolume(yr);
        if (price === 0 && vol > 0) {
          zeroPriceItems.push({ yr });
          zeroPriceVolume += vol;
        } else if (price > 0) {
          revenueFromPriced += vol * price;
        }
      }

      if (zeroPriceItems.length > 0 && zeroPriceVolume > 0) {
        const remainingTarget = Math.max(0, target - revenueFromPriced);
        if (remainingTarget > 0) {
          const derivedPrice = Math.round(remainingTarget / zeroPriceVolume / 500) * 500 || 500;
          console.warn(`[scaleToFramework] ${yearLabel}: ${zeroPriceItems.length} zero-price item(s), deriving price=${derivedPrice} from remaining=${remainingTarget} / vol=${zeroPriceVolume}`);
          for (const { yr: zyr } of zeroPriceItems) {
            if (!zyr.unit_price_r1 && !zyr.unit_price_r2 && !zyr.unit_price_r3) {
              zyr.unit_price_r1 = derivedPrice;
              zyr.mix_r1 = 1.0; zyr.mix_r2 = 0; zyr.mix_r3 = 0;
              zyr.cogs_r1 = Math.round(derivedPrice * 0.35 / 500) * 500;
            }
          }
          // Recompute revenueExcel after price fix
          revenueExcel = 0;
          for (const item of allItems) {
            if (!item.per_year || !Array.isArray(item.per_year)) continue;
            const yr = item.per_year.find((y: any) => y.year === yearLabel);
            if (!yr) continue;
            revenueExcel += getTotalVolume(yr) * getWeightedPrice(yr);
          }
        }
      }
    }

    if (revenueExcel <= 0) {
      // Fallback: ALL items have price=0 — derive one average price across all volumes
      let totalVolume = 0;
      for (const item of allItems) {
        if (!item.per_year || !Array.isArray(item.per_year)) continue;
        const yr = item.per_year.find((y: any) => y.year === yearLabel);
        if (!yr) continue;
        totalVolume += getTotalVolume(yr);
      }
      if (totalVolume > 0) {
        const derivedPrice = Math.round(target / totalVolume / 500) * 500 || 500;
        console.warn(`[scaleToFramework] ${yearLabel}: all prices=0, deriving from target=${target} / vol=${totalVolume} → ${derivedPrice} FCFA/unit`);
        for (const item of allItems) {
          if (!item.per_year || !Array.isArray(item.per_year)) continue;
          const yr = item.per_year.find((y: any) => y.year === yearLabel);
          if (!yr) continue;
          if (!yr.unit_price_r1 && !yr.unit_price_r2 && !yr.unit_price_r3) {
            yr.unit_price_r1 = derivedPrice;
            yr.mix_r1 = 1.0;
            yr.mix_r2 = 0;
            yr.mix_r3 = 0;
            yr.cogs_r1 = Math.round(derivedPrice * 0.35 / 500) * 500;
          }
        }
      }
      continue;
    }

    const ecart = Math.abs(revenueExcel - target) / target;
    if (ecart <= 0.05) continue;

    const ratio = target / revenueExcel;
    console.log(`[scaleToFramework] ${yearLabel}: Excel=${Math.round(revenueExcel)}, Target=${target}, Ratio=${ratio.toFixed(3)}, Ecart=${(ecart*100).toFixed(1)}%`);

    // Proportional scaling of all items
    for (const item of allItems) {
      if (!item.per_year || !Array.isArray(item.per_year)) continue;
      const yr = item.per_year.find((y: any) => y.year === yearLabel);
      if (!yr) continue;
      yr.volume_h1 = Math.round((yr.volume_h1 || 0) * ratio);
      yr.volume_h2 = Math.round((yr.volume_h2 || 0) * ratio);
      yr.volume_q3 = Math.round((yr.volume_q3 || 0) * ratio);
      yr.volume_q4 = Math.round((yr.volume_q4 || 0) * ratio);
    }

    // Fix #2: Residual adjustment — recompute Excel revenue after scaling and fix rounding gap
    let postScaleRevenue = 0;
    let biggestItem: any = null;
    let biggestItemRevenue = 0;
    for (const item of allItems) {
      if (!item.per_year || !Array.isArray(item.per_year)) continue;
      const yr = item.per_year.find((y: any) => y.year === yearLabel);
      if (!yr) continue;
      const price = getWeightedPrice(yr);
      const vol = getTotalVolume(yr);
      const itemRev = vol * price;
      postScaleRevenue += itemRev;
      if (itemRev > biggestItemRevenue) {
        biggestItemRevenue = itemRev;
        biggestItem = yr;
      }
    }

    const residual = target - postScaleRevenue;
    if (biggestItem && Math.abs(residual) > 1 && getWeightedPrice(biggestItem) > 0) {
      const price = getWeightedPrice(biggestItem);
      const volumeAdjust = Math.round(residual / price);
      if (volumeAdjust !== 0) {
        // Add residual to h1 (largest quarter proxy)
        biggestItem.volume_h1 = (biggestItem.volume_h1 || 0) + volumeAdjust;
        console.log(`[scaleToFramework] ${yearLabel}: residual adjustment: ${volumeAdjust} units added to largest item (gap=${Math.round(residual)} FCFA)`);
      }
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

// ── Mapping between plan_ovo OPEX category names and Excel JSON keys ──
const OPEX_NAME_MAP: Record<string, string> = {
  staff_salaries: "__staff__", // handled separately by alignStaffToTarget
  office_costs: "office",
  marketing: "marketing",
  travel: "travel",
  insurance: "insurance",
  maintenance: "maintenance",
  third_parties: "third_parties",
  other: "other",
  taxes_on_staff: "taxes_on_staff",
};

// Year keys in plan_ovo opex objects → array index in Excel sub-category arrays (10 elements: O→X)
const OPEX_YEAR_KEYS = ["year_minus_2", "year_minus_1", "h1", "h2", "current_year", "year2", "year3", "year4", "year5", "year6"];

/**
 * Scale OPEX sub-categories to align with plan_ovo aggregate OPEX (Fix #4).
 * Now uses a mapping table to match plan_ovo names → Excel JSON keys.
 */
// deno-lint-ignore no-explicit-any
export function alignOpexToPlanOvo(json: Record<string, any>, planOvoData?: Record<string, any>): void {
  const po = planOvoData as any;
  if (!po?.opex || typeof po.opex !== 'object') return;
  if (!json.opex || typeof json.opex !== 'object') return;

  for (const [poCategory, poVal] of Object.entries(po.opex)) {
    if (!poVal || typeof poVal !== 'object') continue;
    const poObj = poVal as any;

    const excelKey = OPEX_NAME_MAP[poCategory] || poCategory;
    if (excelKey === "__staff__") continue; // staff handled by alignStaffToTarget

    const excelCat = json.opex[excelKey];
    if (!excelCat || typeof excelCat !== 'object') {
      console.log(`[alignOpex] No Excel category for plan_ovo "${poCategory}" (mapped→"${excelKey}"), skipping`);
      continue;
    }

    // Try per-year scaling first (more precise), fallback to CY ratio
    const hasPerYear = OPEX_YEAR_KEYS.some(k => poObj[k] != null && Number(poObj[k]) > 0);

    if (hasPerYear) {
      // Scale each year independently
      const subEntries = Object.entries(excelCat);
      for (let yi = 0; yi < 10; yi++) {
        const yearKey = OPEX_YEAR_KEYS[yi];
        const target = Number(poObj[yearKey] || 0);
        if (target <= 0) continue;

        // Fix #1: current_year (index 4) is always 0 in Excel — actual CY lives in H1 (idx 2) + H2 (idx 3)
        if (yearKey === "current_year") {
          let h1Total = 0, h2Total = 0;
          for (const [, subVals] of subEntries) {
            if (Array.isArray(subVals) && subVals.length > 3) {
              h1Total += (subVals[2] || 0);
              h2Total += (subVals[3] || 0);
            }
          }
          const currentTotal = h1Total + h2Total;
          if (currentTotal <= 0) {
            console.log(`[alignOpex] ${excelKey}[current_year]: no existing H1/H2 data, distributing target=${target} as H1=45%/H2=55%`);
            const firstSub = subEntries[0];
            if (firstSub && Array.isArray(firstSub[1]) && firstSub[1].length > 3) {
              json.opex[excelKey][firstSub[0]][2] = Math.round(target * 0.45 / 1000) * 1000;
              json.opex[excelKey][firstSub[0]][3] = Math.round(target * 0.55 / 1000) * 1000;
            }
          } else {
            const ratio = target / currentTotal;
            if (Math.abs(ratio - 1) <= 0.10) continue;
            console.log(`[alignOpex] ${excelKey}[current_year→H1+H2]: current=${currentTotal}, target=${target}, ratio=${ratio.toFixed(3)}`);
            for (const [subKey, subVals] of subEntries) {
              if (Array.isArray(subVals) && subVals.length > 3) {
                json.opex[excelKey][subKey][2] = Math.round((subVals[2] || 0) * ratio / 1000) * 1000;
                json.opex[excelKey][subKey][3] = Math.round((subVals[3] || 0) * ratio / 1000) * 1000;
              }
            }
          }
          continue;
        }

        let currentTotal = 0;
        for (const [, subVals] of subEntries) {
          if (Array.isArray(subVals) && subVals.length > yi) {
            currentTotal += (subVals[yi] || 0);
          }
        }
        if (currentTotal <= 0) continue;

        const ratio = target / currentTotal;
        if (Math.abs(ratio - 1) <= 0.10) continue;

        console.log(`[alignOpex] ${excelKey}[${yearKey}]: current=${currentTotal}, target=${target}, ratio=${ratio.toFixed(3)}`);
        for (const [subKey, subVals] of subEntries) {
          if (Array.isArray(subVals) && subVals.length > yi) {
            json.opex[excelKey][subKey][yi] = Math.round((subVals[yi] || 0) * ratio / 1000) * 1000;
          }
        }
      }
    } else {
      // Fallback: CY-based ratio (original behavior)
      const poCY = poObj.total_cy || poObj.current_year || 0;
      if (poCY <= 0) continue;

      let currentCY = 0;
      const subEntries = Object.entries(excelCat);
      for (const [, subVals] of subEntries) {
        if (Array.isArray(subVals) && subVals.length >= 5) {
          currentCY += (subVals[2] || 0) + (subVals[3] || 0);
        }
      }
      if (currentCY <= 0) continue;

      const opexRatio = poCY / currentCY;
      if (Math.abs(opexRatio - 1) <= 0.10) continue;

      console.log(`[alignOpex] ${excelKey}: currentCY=${currentCY}, targetCY=${poCY}, ratio=${opexRatio.toFixed(3)}`);
      for (const [subKey, subVals] of subEntries) {
        if (Array.isArray(subVals)) {
          json.opex[excelKey][subKey] = subVals.map((v: number) => Math.round((v || 0) * opexRatio / 1000) * 1000);
        }
      }
    }
  }
}

/**
 * Align staff costs (salaries) to plan_ovo staff_salaries targets.
 * Adjusts gross_monthly_salary_per_person proportionally when Excel staff costs diverge > 10%.
 */
// deno-lint-ignore no-explicit-any
export function alignStaffToTarget(json: Record<string, any>, planOvoData?: Record<string, any>): void {
  const po = planOvoData as any;
  if (!po?.opex?.staff_salaries || typeof po.opex.staff_salaries !== 'object') return;
  if (!Array.isArray(json.staff) || json.staff.length === 0) return;

  const staffTarget = po.opex.staff_salaries;
  const yearLabels = ["YEAR-2", "YEAR-1", "CURRENT YEAR", "YEAR2", "YEAR3", "YEAR4", "YEAR5", "YEAR6"];
  const targetKeys = ["year_minus_2", "year_minus_1", "current_year", "year2", "year3", "year4", "year5", "year6"];

  for (let yi = 0; yi < yearLabels.length; yi++) {
    const target = Number(staffTarget[targetKeys[yi]] || 0);
    if (target <= 0) continue;

    // Calculate current Excel staff cost for this year
    let excelStaffCost = 0;
    for (const cat of json.staff) {
      if (!cat.per_year || !Array.isArray(cat.per_year)) continue;
      const yr = cat.per_year.find((y: any) => y.year === yearLabels[yi]);
      if (!yr) continue;
      const hc = yr.headcount || 0;
      const salary = yr.gross_monthly_salary_per_person || 0;
      const allowances = yr.annual_allowances_per_person || 0;
      const socialRate = cat.social_security_rate || 0.1645;
      // Annual staff cost = headcount × (salary × 12 + allowances) × (1 + socialRate)
      excelStaffCost += hc * (salary * 12 + allowances) * (1 + socialRate);
    }

    if (excelStaffCost <= 0) continue;
    const ratio = target / excelStaffCost;
    if (Math.abs(ratio - 1) <= 0.10) continue;

    console.log(`[alignStaff] ${yearLabels[yi]}: excelStaff=${Math.round(excelStaffCost)}, target=${target}, ratio=${ratio.toFixed(3)}`);

    // Adjust salaries proportionally (keep headcount unchanged)
    for (const cat of json.staff) {
      if (!cat.per_year || !Array.isArray(cat.per_year)) continue;
      const yr = cat.per_year.find((y: any) => y.year === yearLabels[yi]);
      if (!yr) continue;
      yr.gross_monthly_salary_per_person = Math.round((yr.gross_monthly_salary_per_person || 0) * ratio / 1000) * 1000;
      yr.annual_allowances_per_person = Math.round((yr.annual_allowances_per_person || 0) * ratio / 1000) * 1000;
    }
  }
}

/**
 * Align total OPEX (non-staff + staff) with Framework-implied OPEX.
 * Framework OPEX = Marge Brute - EBITDA. If Excel total OPEX diverges > 5%,
 * scale non-staff OPEX sub-categories proportionally.
 */
// deno-lint-ignore no-explicit-any
export function alignTotalOpexToFramework(json: Record<string, any>, frameworkData?: Record<string, any>): void {
  const fw = frameworkData as any;
  if (!fw?.projection_5ans?.lignes || !Array.isArray(fw.projection_5ans.lignes)) return;
  if (!json.opex || typeof json.opex !== 'object') return;

  const lignes = fw.projection_5ans.lignes;
  const findLigne = (...patterns: string[]) =>
    lignes.find((l: any) => {
      const lb = (l.poste || l.libelle || '').toLowerCase();
      return patterns.some(p => lb.includes(p)) && !lb.includes('%') && !lb.includes('(%)');
    });

  const mbLine = findLigne('marge brute', 'gross margin', 'gross profit');
  const ebitdaLine = findLigne('ebitda', 'ebe', 'résultat exploitation', 'excédent brut');
  if (!mbLine || !ebitdaLine) {
    console.log('[alignTotalOpex] Marge Brute or EBITDA line not found in Framework — skipping');
    return;
  }

  const fwMap: Record<string, string> = { "YEAR2": "an1", "YEAR3": "an2", "YEAR4": "an3", "YEAR5": "an4", "YEAR6": "an5" };
  // Excel OPEX array index: YEAR2→5, YEAR3→6, YEAR4→7, YEAR5→8, YEAR6→9
  // CURRENT_YEAR is special: uses H1 (idx 2) + H2 (idx 3) combined
  const yearToIdx: Record<string, number> = { "YEAR2": 5, "YEAR3": 6, "YEAR4": 7, "YEAR5": 8, "YEAR6": 9 };

  const opexCategories = Object.keys(json.opex); // marketing, office, travel, etc.

  for (const [yearLabel, fwKey] of Object.entries(fwMap)) {
    const mb = typeof mbLine[fwKey] === 'number' ? mbLine[fwKey] : parseFcfaValue(String(mbLine[fwKey] || ''));
    const ebitda = typeof ebitdaLine[fwKey] === 'number' ? ebitdaLine[fwKey] : parseFcfaValue(String(ebitdaLine[fwKey] || ''));
    if (mb <= 0) continue;

    const targetOpex = mb - ebitda;
    if (targetOpex <= 0) continue;

    const idx = yearToIdx[yearLabel];

    // Sum all Excel OPEX for this year index
    let excelOpex = 0;
    for (const catKey of opexCategories) {
      const cat = json.opex[catKey];
      if (!cat || typeof cat !== 'object') continue;
      for (const [, subVals] of Object.entries(cat)) {
        if (Array.isArray(subVals) && subVals.length > idx) {
          excelOpex += ((subVals as number[])[idx] || 0);
        }
      }
    }

    // Add staff costs
    let staffCost = 0;
    if (Array.isArray(json.staff)) {
      for (const cat of json.staff) {
        if (!cat.per_year || !Array.isArray(cat.per_year)) continue;
        const yr = cat.per_year.find((y: any) => y.year === yearLabel);
        if (!yr) continue;
        const hc = yr.headcount || 0;
        const salary = yr.gross_monthly_salary_per_person || 0;
        const allowances = yr.annual_allowances_per_person || 0;
        const socialRate = cat.social_security_rate || 0.1645;
        staffCost += hc * (salary * 12 + allowances) * (1 + socialRate);
      }
    }

    const totalExcelOpex = excelOpex + staffCost;
    if (totalExcelOpex <= 0) continue;

    const ecart = Math.abs(totalExcelOpex - targetOpex) / targetOpex;
    if (ecart <= 0.05) continue;

    console.log(`[alignTotalOpex] ${yearLabel}: excelOpex=${Math.round(totalExcelOpex)} (nonStaff=${Math.round(excelOpex)}, staff=${Math.round(staffCost)}), target=${targetOpex}, écart=${(ecart*100).toFixed(1)}%`);

    // Scale non-staff OPEX to bridge the gap (keep staff stable since already aligned)
    const nonStaffTarget = targetOpex - staffCost;
    if (nonStaffTarget <= 0 || excelOpex <= 0) continue;

    const nonStaffRatio = nonStaffTarget / excelOpex;
    for (const catKey of opexCategories) {
      const cat = json.opex[catKey];
      if (!cat || typeof cat !== 'object') continue;
      for (const [subKey, subVals] of Object.entries(cat)) {
        if (Array.isArray(subVals) && subVals.length > idx) {
          (json.opex[catKey][subKey] as number[])[idx] = Math.round(((subVals as number[])[idx] || 0) * nonStaffRatio / 1000) * 1000;
        }
      }
    }
  }
}

/**
 * Post-build revenue verification (Fix #5).
 * Returns computed Excel revenues per year for comparison with Framework targets.
 */
// deno-lint-ignore no-explicit-any
export function verifyExcelRevenue(json: Record<string, any>, frameworkData?: Record<string, any>): { verified: boolean; gaps: Record<string, { excel: number; target: number; ecart: number }> } {
  const gaps: Record<string, { excel: number; target: number; ecart: number }> = {};
  let verified = true;

  const fw = frameworkData as any;
  if (!fw?.projection_5ans?.lignes) return { verified: true, gaps };

  const caLine = fw.projection_5ans.lignes.find((l: any) => {
    const lb = (l.poste || l.libelle || '').toLowerCase();
    return lb.includes("ca total") || lb.includes("chiffre") || lb.includes("revenue") || lb.includes("ventes") || lb.includes("total revenus");
  });
  if (!caLine) return { verified: true, gaps };

  const fwMap: Record<string, string> = { "YEAR2": "an1", "YEAR3": "an2", "YEAR4": "an3", "YEAR5": "an4", "YEAR6": "an5" };
  const allItems = [
    ...(Array.isArray(json.products) ? json.products.filter((p: any) => p.active !== false) : []),
    ...(Array.isArray(json.services) ? json.services.filter((s: any) => s.active !== false) : []),
  ];

  for (const [yearLabel, fwKey] of Object.entries(fwMap)) {
    const raw = caLine[fwKey];
    const target = typeof raw === 'number' ? raw : parseFcfaValue(String(raw || ''));
    if (target <= 0) continue;

    let excelRev = 0;
    for (const item of allItems) {
      const yr = item.per_year?.find((y: any) => y.year === yearLabel);
      if (!yr) continue;
      excelRev += getTotalVolume(yr) * getWeightedPrice(yr);
    }

    const ecart = excelRev > 0 ? Math.abs(excelRev - target) / target : 1;
    if (ecart > 0.05) {
      gaps[yearLabel] = { excel: Math.round(excelRev), target, ecart: Math.round(ecart * 100) };
      verified = false;
      if (ecart > 0.10) {
        console.error(`[verifyRevenue] CRITICAL: ${yearLabel} Excel=${Math.round(excelRev)} vs Target=${target}, écart=${(ecart*100).toFixed(1)}%`);
      } else {
        console.warn(`[verifyRevenue] WARNING: ${yearLabel} Excel=${Math.round(excelRev)} vs Target=${target}, écart=${(ecart*100).toFixed(1)}%`);
      }
    }
  }

  return { verified, gaps };
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
      const totalVol = getTotalVolume(prevEntry);
      const newVol = Math.round(totalVol * (1 + g));
      const newEntry = { ...prevEntry };
      newEntry.year = yearLabels[idx];
      const nq1 = Math.round(newVol * 0.22);
      const nq2 = Math.round(newVol * 0.25);
      const nq3 = Math.round(newVol * 0.27);
      newEntry.volume_h1 = nq1;
      newEntry.volume_h2 = nq2;
      newEntry.volume_q3 = nq3;
      newEntry.volume_q4 = newVol - nq1 - nq2 - nq3;
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
    const q1 = Math.round(yc.volume * 0.22);
    const q2 = Math.round(yc.volume * 0.25);
    const q3 = Math.round(yc.volume * 0.27);
    const q4 = yc.volume - q1 - q2 - q3;

    return {
      year: yc.year,
      unit_price_r1: rf[0] ? price : 0, unit_price_r2: rf[1] ? price : 0, unit_price_r3: rf[2] ? price : 0,
      mix_r1: rf[0] ? 1.0 : 0, mix_r2: rf[1] ? 1.0 : 0, mix_r3: rf[2] ? 1.0 : 0,
      cogs_r1: rf[0] ? cogs : 0, cogs_r2: rf[1] ? cogs : 0, cogs_r3: rf[2] ? cogs : 0,
      mix_r1_ch1: rf[0] ? mixCh1 : 0, mix_r2_ch1: rf[1] ? mixCh1 : 0, mix_r3_ch1: rf[2] ? mixCh1 : 0,
      mix_r1_ch2: rf[0] ? mixCh2 : 0, mix_r2_ch2: rf[1] ? mixCh2 : 0, mix_r3_ch2: rf[2] ? mixCh2 : 0,
      volume_h1: q1, volume_h2: q2, volume_q3: q3, volume_q4: q4,
    };
  });

  return { ...p, per_year };
}

// deno-lint-ignore no-explicit-any
function repairPerYearVolumes(perYear: any[], growthRate: number): any[] {
  if (!perYear || perYear.length < 3) return perYear;
  const cyEntry = perYear.find((e: any) => e.year === "CURRENT YEAR") || perYear[2];
  const cyVolume = getTotalVolume(cyEntry);
  if (cyVolume === 0) return perYear;

  const g = growthRate || 0.15;
  let lastKnownVolume = cyVolume;

  for (let i = 3; i < perYear.length && i < 8; i++) {
    const entry = perYear[i];
    const vol = getTotalVolume(entry);
    if (vol > 0) {
      lastKnownVolume = vol;
    } else {
      const newVol = Math.round(lastKnownVolume * (1 + g));
      const q1 = Math.round(newVol * 0.22);
      const q2 = Math.round(newVol * 0.25);
      const q3 = Math.round(newVol * 0.27);
      entry.volume_h1 = q1;
      entry.volume_h2 = q2;
      entry.volume_q3 = q3;
      entry.volume_q4 = newVol - q1 - q2 - q3;
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
