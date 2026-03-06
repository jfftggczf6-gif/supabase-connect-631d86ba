

## Diagnostic

After comparing the empty template, the filled output, and the actual AI data, here's what I found:

**What works (Sheets 1-7):** Most data IS being filled correctly. The cell reference mapping is accurate for sheets 1 through 7. The filled Excel shows enterprise name, CA, margins, EBITDA, activities, ratios, projections, scenarios, and sensibility analysis.

**What's broken:**

1. **Sheet 8 (Synthèse Exécutive) is almost entirely empty** — This sheet has a free-form "slide deck" layout, not a standard table. The current code targets cells B7, B9, B12, B18, B21, B28, B31, B34 which don't match the actual XML row structure of this sheet. The template has titles like "Ce que montrent les chiffres", "Forces", "Faiblesses" in specific rows that differ from the assumed mapping.

2. **Missing An2 for Trésorerie Cumulée** — The AI data literally lacks `an2` for this projection line. The code should interpolate missing values.

3. **Several data fields available but not mapped:**
   - Sector (B6 on sheet 1)
   - Ratios historiques (sheet 1 & 4 have N-2, N-1 columns that could be filled from `ratios_historiques`)
   - Scenario hypotheses rows 7-10 on sheet 7 (Croissance CAGR, Marge brute, Charges fixes/CA, Investissements)
   - Verdict/analysis text fields across sheets
   - More BFR data and solvabilité ratios

4. **Alertes and croisements BMC** — Rich data available but not mapped to any sheet

## Plan

**File: `supabase/functions/_shared/framework-excel-template.ts`** — Complete rewrite of the filling logic:

1. **Fix Sheet 8 cell references** — Parse the actual XML to find correct row numbers for the Synthèse Exécutive layout. Map "Ce que montrent les chiffres" → resume_chiffres, "Forces" → forces, "Faiblesses" → faiblesses, activity analysis, plan d'action, impact, and besoins financiers to the correct rows.

2. **Add interpolation for missing projection values** — When `an2` is missing, calculate `(an1 + an3) / 2` as fallback.

3. **Add missing data mappings:**
   - Sheet 1: sector in B6, ratios_historiques data for N-2/N-1 columns (cols B, C)
   - Sheet 3: verdict_indicateurs text
   - Sheet 4: more solvabilité ratios, BFR verdict text
   - Sheet 5: activity-level growth rates from projection data
   - Sheet 6: add marge nette row (row 24)
   - Sheet 7: fill hypothesis rows (7-10) with scenario data, fill all Central column values

4. **Add a `findRowByLabel` helper** — Instead of hardcoding row numbers for Sheet 8, scan the XML for text content matching section labels to find the correct row dynamically. This makes the code resilient to template structure changes.

5. **Add comprehensive error logging** — Log which cells were filled vs skipped for debugging.

No changes to `generate-framework/index.ts` or `download-deliverable/index.ts` — the pipeline is already correct.

