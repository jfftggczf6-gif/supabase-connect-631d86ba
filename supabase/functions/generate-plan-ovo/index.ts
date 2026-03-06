import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, errorResponse, jsonResponse, verifyAndGetContext, saveDeliverable } from "../_shared/helpers.ts";
import { fillPlanOvoExcelTemplate, generatePlanOvoHTML } from "../_shared/plan-ovo-excel-template.ts";

// ===== STEP 2: Claude Prompt for structured 5-year financial plan =====

const SYSTEM_PROMPT = `You are a senior financial modeler specialized in African SMEs (focus: Côte d'Ivoire, West Africa). Based on the historical data provided, generate a realistic 5-year financial plan as a strict JSON object. Apply these parameters: Currency XOF (FCFA), VAT 18%, Corporate Tax 25% (or 4% if revenue below 200M FCFA), Social charges 25% of gross salary, realistic SME growth rate 15-30%/year max unless justified by strong historical data. Return ONLY the following JSON with no markdown, no backticks, no text before or after:

{
  "company": "string",
  "country": "string",
  "currency": "XOF",
  "exchange_rate_eur": 655.957,
  "base_year": 2023,
  "vat": 0.18,
  "annual_inflation": 0.03,
  "tax_regime_1": 0.04,
  "tax_regime_2": 0.25,
  "years": { "year_minus_2": 2022, "year_minus_1": 2023, "current_year": 2024, "year2": 2025, "year3": 2026, "year4": 2027, "year5": 2028, "year6": 2029 },
  "products": [{ "name": "string", "filter": 1, "range": "Entry level", "channel": "B2B" }],
  "services": [{ "name": "string", "filter": 1, "range": "Entry level", "channel": "B2B" }],
  "revenue": { "year_minus_2": 0, "year_minus_1": 0, "current_year": 0, "year2": 0, "year3": 0, "year4": 0, "year5": 0, "year6": 0 },
  "cogs": { "year_minus_2": 0, "year_minus_1": 0, "current_year": 0, "year2": 0, "year3": 0, "year4": 0, "year5": 0, "year6": 0 },
  "gross_profit": { "year_minus_2": 0, "year_minus_1": 0, "current_year": 0, "year2": 0, "year3": 0, "year4": 0, "year5": 0, "year6": 0 },
  "gross_margin_pct": { "year_minus_2": 0, "year_minus_1": 0, "current_year": 0, "year2": 0, "year3": 0, "year4": 0, "year5": 0, "year6": 0 },
  "staff": [{ "category": "STAFF_CAT01", "label": "string", "department": "string", "social_security_rate": 0.1645 }],
  "opex": {
    "staff_salaries": { "year_minus_2": 0, "year_minus_1": 0, "current_year": 0, "year2": 0, "year3": 0, "year4": 0, "year5": 0, "year6": 0 },
    "marketing": { "year_minus_2": 0, "year_minus_1": 0, "current_year": 0, "year2": 0, "year3": 0, "year4": 0, "year5": 0, "year6": 0 },
    "office_costs": { "year_minus_2": 0, "year_minus_1": 0, "current_year": 0, "year2": 0, "year3": 0, "year4": 0, "year5": 0, "year6": 0 },
    "travel": { "year_minus_2": 0, "year_minus_1": 0, "current_year": 0, "year2": 0, "year3": 0, "year4": 0, "year5": 0, "year6": 0 },
    "insurance": { "year_minus_2": 0, "year_minus_1": 0, "current_year": 0, "year2": 0, "year3": 0, "year4": 0, "year5": 0, "year6": 0 },
    "maintenance": { "year_minus_2": 0, "year_minus_1": 0, "current_year": 0, "year2": 0, "year3": 0, "year4": 0, "year5": 0, "year6": 0 },
    "third_parties": { "year_minus_2": 0, "year_minus_1": 0, "current_year": 0, "year2": 0, "year3": 0, "year4": 0, "year5": 0, "year6": 0 },
    "other": { "year_minus_2": 0, "year_minus_1": 0, "current_year": 0, "year2": 0, "year3": 0, "year4": 0, "year5": 0, "year6": 0 }
  },
  "ebitda": { "year_minus_2": 0, "year_minus_1": 0, "current_year": 0, "year2": 0, "year3": 0, "year4": 0, "year5": 0, "year6": 0 },
  "ebitda_margin_pct": { "year_minus_2": 0, "year_minus_1": 0, "current_year": 0, "year2": 0, "year3": 0, "year4": 0, "year5": 0, "year6": 0 },
  "net_profit": { "year_minus_2": 0, "year_minus_1": 0, "current_year": 0, "year2": 0, "year3": 0, "year4": 0, "year5": 0, "year6": 0 },
  "cashflow": { "year_minus_2": 0, "year_minus_1": 0, "current_year": 0, "year2": 0, "year3": 0, "year4": 0, "year5": 0, "year6": 0 },
  "capex": [{ "label": "string", "acquisition_year": 2024, "acquisition_value": 0, "amortisation_rate_pct": 0.2 }],
  "loans": { "ovo": { "amount": 0, "rate": 0.07, "term_years": 5 }, "family": { "amount": 0, "rate": 0.10, "term_years": 3 }, "bank": { "amount": 0, "rate": 0.20, "term_years": 2 } },
  "simulation": { "typical_case": { "revenue_products": 1, "cogs_products": 1, "revenue_services": 1, "cogs_services": 1 } },
  "funding_need": 0,
  "break_even_year": "string",
  "key_assumptions": ["string"],
  "score": 0
}`;

function buildUserPrompt(ent: any, allData: any, docs: string): string {
  return `Generate a complete 5-year financial plan for this company:

COMPANY: ${ent.name}
COUNTRY: ${ent.country || "Côte d'Ivoire"}
SECTOR: ${ent.sector || 'Non spécifié'}
EMPLOYEES: ${ent.employees_count || 'Non spécifié'}
CREATION DATE: ${ent.creation_date || 'Non spécifié'}

EXISTING DATA FROM PREVIOUS MODULES:
${JSON.stringify(allData, null, 2)}

${docs ? `UPLOADED DOCUMENTS:\n${docs}` : ''}

IMPORTANT:
- All monetary values in XOF (FCFA)
- Use realistic growth rates for West African SMEs (15-30% max)
- Populate ALL year fields (year_minus_2 through year6)
- Include at least the main products/services from the BMC
- Staff categories should reflect actual team structure
- CAPEX should include real equipment/assets
- Break-even year should be realistic
- Score 0-100 representing financial viability
- key_assumptions should list 5-8 key modeling hypotheses`;
}

// ===== Claude API Call with retry =====
async function callClaude(systemPrompt: string, userPrompt: string, retries = 3): Promise<any> {
  const anthropicApiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!anthropicApiKey) throw { status: 500, message: "ANTHROPIC_API_KEY non configurée" };

  let lastError: any = null;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`[plan-ovo] Claude API call attempt ${attempt}/${retries}...`);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 180000); // 3min timeout

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": anthropicApiKey,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 8192,
          system: systemPrompt,
          messages: [{ role: "user", content: userPrompt }],
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errText = await response.text();
        console.error(`[plan-ovo] Claude error ${response.status}:`, errText.substring(0, 200));
        if (response.status === 429) {
          // Rate limited - wait before retry
          await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 2000));
          lastError = { status: 429, message: "Trop de requêtes, réessayez dans quelques instants." };
          continue;
        }
        throw { status: response.status, message: `Erreur API Claude: ${errText.substring(0, 200)}` };
      }

      const result = await response.json();
      const content = result.content?.[0]?.text || "";

      // Parse JSON
      let cleaned = content
        .replace(/```json\s*/gi, "")
        .replace(/```\s*/g, "")
        .trim();

      const jsonStart = cleaned.search(/[\{\[]/);
      const jsonEnd = cleaned.lastIndexOf(jsonStart !== -1 && cleaned[jsonStart] === '[' ? ']' : '}');

      if (jsonStart === -1 || jsonEnd === -1) {
        console.error("[plan-ovo] No JSON found in response:", cleaned.substring(0, 300));
        lastError = { status: 500, message: "Pas de JSON dans la réponse IA" };
        continue;
      }

      cleaned = cleaned.substring(jsonStart, jsonEnd + 1);

      try {
        return JSON.parse(cleaned);
      } catch {
        // Fix common JSON issues
        cleaned = cleaned
          .replace(/,\s*}/g, "}")
          .replace(/,\s*]/g, "]")
          .replace(/[\x00-\x1F\x7F]/g, "");

        const openBraces = (cleaned.match(/{/g) || []).length;
        const closeBraces = (cleaned.match(/}/g) || []).length;
        const openBrackets = (cleaned.match(/\[/g) || []).length;
        const closeBrackets = (cleaned.match(/\]/g) || []).length;

        if (openBrackets > closeBrackets || openBraces > closeBraces) {
          cleaned = cleaned.replace(/,\s*"[^"]*"?\s*:?\s*[^}\]]*$/, "");
          for (let i = 0; i < openBrackets - closeBrackets; i++) cleaned += "]";
          for (let i = 0; i < openBraces - closeBraces; i++) cleaned += "}";
        }

        return JSON.parse(cleaned);
      }
    } catch (e: any) {
      lastError = e;
      if (attempt < retries && !e.status) {
        await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000));
      }
    }
  }

  throw lastError || { status: 500, message: "Génération IA indisponible, réessayez dans quelques minutes" };
}

// ===== MAIN HANDLER =====
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    console.log("[plan-ovo] Starting generation pipeline...");

    // STEP 1: Fetch entrepreneur data
    const ctx = await verifyAndGetContext(req);
    const ent = ctx.enterprise;
    const allData = {
      inputs: ctx.deliverableMap["inputs_data"] || {},
      framework: ctx.deliverableMap["framework_data"] || {},
      bmc: ctx.deliverableMap["bmc_analysis"] || {},
      sic: ctx.deliverableMap["sic_analysis"] || {},
      diagnostic: ctx.deliverableMap["diagnostic_data"] || {},
    };

    console.log("[plan-ovo] Step 1 complete: context fetched");

    // STEP 2: Call Claude for 5-year projections
    const data = await callClaude(
      SYSTEM_PROMPT,
      buildUserPrompt(ent, allData, ctx.documentContent)
    );

    // Ensure company name and score
    if (!data.company) data.company = ent.name;
    if (!data.country) data.country = ent.country || "Côte d'Ivoire";
    if (!data.score && data.score !== 0) data.score = 50;

    console.log("[plan-ovo] Step 2 complete: Claude generated projections");

    // STEP 3: Fill Excel template
    let excelBase64: string | null = null;
    try {
      const xlsmBytes = await fillPlanOvoExcelTemplate(data, ent.name, ctx.supabase);
      // Convert to base64
      const binaryStr = Array.from(xlsmBytes).map(b => String.fromCharCode(b)).join('');
      excelBase64 = btoa(binaryStr);

      // Save as separate deliverable (same pattern as framework_excel)
      await ctx.supabase.from("deliverables").upsert({
        enterprise_id: ctx.enterprise_id,
        type: "plan_ovo_excel",
        data: { generated_at: new Date().toISOString(), size: xlsmBytes.length },
        html_content: excelBase64,
        ai_generated: true,
        version: 1,
      }, { onConflict: "enterprise_id,type" });

      console.log(`[plan-ovo] Step 3 complete: Excel template filled (${xlsmBytes.length} bytes)`);
    } catch (excelErr: any) {
      console.error("[plan-ovo] Excel generation failed (non-fatal):", excelErr.message);
      // Non-fatal: continue with HTML and JSON
    }

    // STEP 4: Generate HTML report
    const htmlContent = generatePlanOvoHTML(data, ent.name);

    // Save main deliverable with JSON data and HTML
    await saveDeliverable(ctx.supabase, ctx.enterprise_id, "plan_ovo", data, "plan_ovo", htmlContent);

    console.log("[plan-ovo] Step 4 complete: HTML report generated and saved");

    return jsonResponse({
      success: true,
      data,
      score: data.score,
      excel_generated: !!excelBase64,
    });

  } catch (e: any) {
    console.error("generate-plan-ovo error:", e);
    return errorResponse(e.message || "Erreur inconnue", e.status || 500);
  }
});
