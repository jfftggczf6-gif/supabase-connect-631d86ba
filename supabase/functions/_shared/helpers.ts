// helpers.ts — shared utilities for edge functions (v2 — no .catch on Supabase queries)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import JSZip from "https://esm.sh/jszip@3.10.1";

// ===== DOCX PARSER (used by extract-enterprise-info, extract-programme-criteria) =====
export async function parseDocx(arrayBuffer: ArrayBuffer): Promise<string> {
  try {
    const zip = await JSZip.loadAsync(arrayBuffer);
    const docXml = await zip.file("word/document.xml")?.async("string");
    if (!docXml) return "[DOCX: contenu introuvable]";

    let text = "";
    const paragraphs = docXml.split(/<w:p[ >]/);
    for (const para of paragraphs) {
      const runs = para.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || [];
      const lineText = runs.map(r => {
        const m = r.match(/<w:t[^>]*>([^<]*)<\/w:t>/);
        return m ? m[1] : "";
      }).join("");
      if (lineText.trim()) text += lineText + "\n";
    }

    for (const fileName of Object.keys(zip.files)) {
      if ((fileName.startsWith("word/header") || fileName.startsWith("word/footer")) && fileName.endsWith(".xml")) {
        const headerXml = await zip.file(fileName)?.async("string");
        if (headerXml) {
          const runs = headerXml.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || [];
          const headerText = runs.map(r => {
            const m = r.match(/<w:t[^>]*>([^<]*)<\/w:t>/);
            return m ? m[1] : "";
          }).join(" ");
          if (headerText.trim()) text = headerText + "\n---\n" + text;
        }
      }
    }

    return text.trim() || "[DOCX: document vide]";
  } catch (e) {
    console.error("DOCX parse error:", e);
    return "[DOCX: erreur de parsing]";
  }
}

// ===== XLSX PARSER (used by extract-enterprise-info) =====
export async function parseXlsx(arrayBuffer: ArrayBuffer): Promise<string> {
  try {
    const zip = await JSZip.loadAsync(arrayBuffer);

    const sharedStringsXml = await zip.file("xl/sharedStrings.xml")?.async("string");
    const sharedStrings: string[] = [];
    if (sharedStringsXml) {
      const matches = sharedStringsXml.match(/<t[^>]*>([^<]*)<\/t>/g) || [];
      for (const m of matches) {
        const val = m.match(/<t[^>]*>([^<]*)<\/t>/);
        sharedStrings.push(val ? val[1] : "");
      }
    }

    const workbookXml = await zip.file("xl/workbook.xml")?.async("string");
    const sheetNames: string[] = [];
    if (workbookXml) {
      const nameMatches = workbookXml.match(/<sheet[^>]*name="([^"]*)"[^>]*\/>/g) || [];
      for (const nm of nameMatches) {
        const n = nm.match(/name="([^"]*)"/);
        if (n) sheetNames.push(n[1]);
      }
    }

    let result = "";
    const sheetFiles = Object.keys(zip.files).filter(f => f.match(/^xl\/worksheets\/sheet\d+\.xml$/)).sort();

    for (let si = 0; si < sheetFiles.length; si++) {
      const sheetXml = await zip.file(sheetFiles[si])?.async("string");
      if (!sheetXml) continue;

      const sheetName = sheetNames[si] || `Feuille ${si + 1}`;
      result += `\n=== ${sheetName} ===\n`;

      const rows = sheetXml.split(/<row /);
      for (let ri = 1; ri < rows.length; ri++) {
        const rowContent = rows[ri];
        const cells = rowContent.split(/<c /);
        const rowValues: string[] = [];

        for (let ci = 1; ci < cells.length; ci++) {
          const cell = cells[ci];
          const typeMatch = cell.match(/t="([^"]*)"/);
          const valueMatch = cell.match(/<v>([^<]*)<\/v>/);

          if (!valueMatch) {
            const inlineMatch = cell.match(/<is><t>([^<]*)<\/t><\/is>/);
            rowValues.push(inlineMatch ? inlineMatch[1] : "");
            continue;
          }

          const rawValue = valueMatch[1];
          if (typeMatch && typeMatch[1] === "s") {
            const idx = parseInt(rawValue, 10);
            rowValues.push(sharedStrings[idx] || rawValue);
          } else {
            rowValues.push(rawValue);
          }
        }

        if (rowValues.some(v => v.trim())) {
          result += rowValues.join("\t") + "\n";
        }
      }
    }

    return result.trim() || "[XLSX: classeur vide]";
  } catch (e) {
    console.error("XLSX parse error:", e);
    return "[XLSX: erreur de parsing]";
  }
}

export async function verifyAndGetContext(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) throw { status: 401, message: "Non autorisé" };

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || serviceKey;

  const anonClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: userErr } = await anonClient.auth.getUser();
  if (userErr || !user) throw { status: 401, message: "Non autorisé" };

  const { enterprise_id } = await req.json();
  if (!enterprise_id) throw { status: 400, message: "enterprise_id requis" };

  const supabase = createClient(supabaseUrl, serviceKey);

  const { data: ent } = await supabase.from("enterprises").select("*").eq("id", enterprise_id).single();
  if (!ent || (ent.user_id !== user.id && ent.coach_id !== user.id)) {
    throw { status: 404, message: "Entreprise non trouvée" };
  }

  // Read cached document content — no more file parsing in edge functions!
  const documentContent = ent.document_content || "";

  const { data: delivs } = await supabase.from("deliverables").select("type, data, score").eq("enterprise_id", enterprise_id);
  const deliverableMap: Record<string, any> = {};
  (delivs || []).forEach((d: any) => { deliverableMap[d.type] = d; });

  const { data: modulesData } = await supabase.from("enterprise_modules").select("module, status, data").eq("enterprise_id", enterprise_id);
  const moduleMap: Record<string, any> = {};
  (modulesData || []).forEach((m: any) => { moduleMap[m.module] = m.data || {}; });

  const baseYear: number = ent.base_year || new Date(ent.created_at || Date.now()).getFullYear();

  return { supabase, user, enterprise: ent, enterprise_id, documentContent, moduleMap, deliverableMap, baseYear };
}

export async function callAI(systemPrompt: string, userPrompt: string, maxTokens = 16384, model = "claude-sonnet-4-20250514", temperature = 0) {
  const anthropicApiKey = Deno.env.get("ANTHROPIC_API_KEY")!;

  const doCall = async (mt: number): Promise<string> => {
    const aiResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": anthropicApiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: mt,
        temperature,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      if (status === 429) throw { status: 429, message: "Trop de requêtes, réessayez dans quelques instants." };
      if (status === 402 || status === 400) {
        const errText = await aiResponse.text();
        console.error("AI error:", status, errText);
        throw { status: 402, message: "Erreur API Anthropic: " + errText.substring(0, 200) };
      }
      const errText = await aiResponse.text();
      console.error("AI error:", status, errText);
      throw { status: 500, message: "Erreur IA" };
    }

    const aiResult = await aiResponse.json();
    if (aiResult.stop_reason === "max_tokens") {
      console.warn(`AI response truncated (max_tokens=${mt} reached)`);
    }
    return aiResult.content?.[0]?.text || "";
  };

  // Attempt 1
  let content = await doCall(maxTokens);
  let parsed = tryParseAIJson(content);
  if (parsed) return parsed;

  // If parsing failed, retry once with higher max_tokens
  console.warn("[callAI] First parse failed, retrying with higher max_tokens...");
  content = await doCall(Math.min(maxTokens * 2, 65536));
  parsed = tryParseAIJson(content);
  if (parsed) return parsed;

  console.error("Failed to parse AI response after retry:", content.substring(0, 500));
  throw { status: 500, message: "Erreur de parsing IA" };
}

function tryParseAIJson(content: string): any | null {
  if (!content) return null;

  try {
    let cleaned = content
      .replace(/```json\s*/gi, "")
      .replace(/```\s*/g, "")
      .trim();

    const jsonStart = cleaned.search(/[\{\[]/);
    const jsonEnd = cleaned.lastIndexOf(jsonStart !== -1 && cleaned[jsonStart] === '[' ? ']' : '}');

    if (jsonStart === -1 || jsonEnd === -1 || jsonEnd <= jsonStart) {
      console.warn("No valid JSON boundaries found in AI response, length:", cleaned.length);
      return null;
    }

    cleaned = cleaned.substring(jsonStart, jsonEnd + 1);

    try {
      return JSON.parse(cleaned);
    } catch {
      cleaned = cleaned
        .replace(/,\s*}/g, "}")
        .replace(/,\s*]/g, "]")
        .replace(/[\x00-\x1F\x7F]/g, "");

      let openBraces = (cleaned.match(/{/g) || []).length;
      let closeBraces = (cleaned.match(/}/g) || []).length;
      let openBrackets = (cleaned.match(/\[/g) || []).length;
      let closeBrackets = (cleaned.match(/\]/g) || []).length;

      if (openBrackets > closeBrackets || openBraces > closeBraces) {
        console.warn("Truncated JSON detected, attempting deep repair...");
        
        // Close any open string value first
        const quoteCount = (cleaned.match(/(?<!\\)"/g) || []).length;
        if (quoteCount % 2 !== 0) {
          cleaned = cleaned.replace(/"[^"]*$/, '""');
        }
        
        // Remove trailing incomplete key-value pairs aggressively
        cleaned = cleaned
          .replace(/,\s*"[^"]*"\s*:\s*"[^"]*$/, "")
          .replace(/,\s*"[^"]*"\s*:\s*\[[^\]]*$/, "")
          .replace(/,\s*"[^"]*"\s*:\s*\{[^}]*$/, "")
          .replace(/,\s*"[^"]*"\s*:\s*$/, "")
          .replace(/,\s*"[^"]*$/, "")
          .replace(/,\s*$/, "");
        
        openBraces = (cleaned.match(/{/g) || []).length;
        closeBraces = (cleaned.match(/}/g) || []).length;
        openBrackets = (cleaned.match(/\[/g) || []).length;
        closeBrackets = (cleaned.match(/\]/g) || []).length;
        
        for (let i = 0; i < openBrackets - closeBrackets; i++) cleaned += "]";
        for (let i = 0; i < openBraces - closeBraces; i++) cleaned += "}";
      }

      try {
        return JSON.parse(cleaned);
      } catch {
        console.warn("Deep repair failed, trying progressive trim...");
        let trimmed = cleaned;
        for (let i = 0; i < 50; i++) {
          trimmed = trimmed
            .replace(/,?\s*"[^"]*"?\s*:\s*"[^"]*"?\s*$/, "")
            .replace(/,?\s*"[^"]*"?\s*:\s*\[[^\]]*$/, "")
            .replace(/,?\s*"[^"]*"?\s*:\s*\{[^}]*$/, "")
            .replace(/,?\s*"[^"]*"?\s*:\s*[^{}\[\],"]*\s*$/, "")
            .replace(/,\s*$/, "");
          const ob = (trimmed.match(/{/g) || []).length;
          const cb = (trimmed.match(/}/g) || []).length;
          const oq = (trimmed.match(/\[/g) || []).length;
          const cq = (trimmed.match(/\]/g) || []).length;
          const qc = (trimmed.match(/(?<!\\)"/g) || []).length;
          if (qc % 2 !== 0) trimmed = trimmed.replace(/"[^"]*$/, '""');
          let attempt = trimmed;
          for (let j = 0; j < oq - cq; j++) attempt += "]";
          for (let j = 0; j < ob - cb; j++) attempt += "}";
          try {
            return JSON.parse(attempt);
          } catch { continue; }
        }
        return null;
      }
    }
  } catch (e: any) {
    if (e.status) throw e;
    return null;
  }
}

export async function saveDeliverable(supabase: any, enterprise_id: string, type: string, data: any, moduleCode: string, htmlContent?: string, triggerReason?: string) {
  // 1. Get existing deliverable for versioning
  const { data: existing } = await supabase
    .from("deliverables")
    .select("id, version, data, score")
    .eq("enterprise_id", enterprise_id)
    .eq("type", type)
    .maybeSingle();
  
  const newVersion = (existing?.version || 0) + 1;

  // 2. Archive previous version if exists
  if (existing?.data && typeof existing.data === 'object' && Object.keys(existing.data).length > 0) {
    const { error: archiveError } = await supabase.from("deliverable_versions").insert({
      deliverable_id: existing.id,
      enterprise_id,
      type,
      version: existing.version || 1,
      data: existing.data,
      score: existing.score,
      validation_report: existing.data?._validation || null,
      generated_by: existing.data?._metadata?.generated_by || 'ai',
      trigger_reason: triggerReason || 'regeneration',
    });

    if (archiveError) {
      console.warn("[saveDeliverable] version archive failed:", archiveError);
    }

    // Purge old versions (keep last 10)
    const { data: versions } = await supabase
      .from("deliverable_versions")
      .select("id")
      .eq("deliverable_id", existing.id)
      .order("version", { ascending: false });

    if (versions && versions.length > 10) {
      const toDelete = versions.slice(10).map((v: any) => v.id);
      const { error: purgeError } = await supabase
        .from("deliverable_versions")
        .delete()
        .in("id", toDelete);

      if (purgeError) {
        console.warn("[saveDeliverable] old versions purge failed:", purgeError);
      }
    }
  }

  // 3. Add metadata
  data._metadata = {
    ...(data._metadata || {}),
    version: newVersion,
    generated_at: new Date().toISOString(),
    generated_by: 'ai',
    trigger_reason: triggerReason || 'pipeline',
  };

  // 4. Upsert deliverable
  const { data: upserted } = await supabase.from("deliverables").upsert({
    enterprise_id,
    type,
    data,
    score: data.score || data.score_global || null,
    html_content: htmlContent || null,
    ai_generated: true,
    version: newVersion,
  }, { onConflict: "enterprise_id,type" }).select("id").maybeSingle();

  await supabase.from("enterprise_modules")
    .update({ status: "completed", progress: 100, data })
    .eq("enterprise_id", enterprise_id)
    .eq("module", moduleCode);

  // 5. Activity log (non-blocking)
  const { error: activityError } = await supabase.from("activity_log").insert({
    enterprise_id,
    actor_role: 'ai',
    action: 'generate',
    resource_type: 'deliverable',
    resource_id: upserted?.id || existing?.id || null,
    deliverable_type: type,
    metadata: {
      version: newVersion,
      score: data.score,
      validation_valid: data._validation?.valid,
      validation_errors: data._validation?.errors || 0,
      trigger_reason: triggerReason,
    },
  });

  if (activityError) {
    console.warn("[saveDeliverable] activity log failed:", activityError);
  }

  // 6. Recalculate global score_ir
  try {
    const { data: allDeliverables } = await supabase
      .from("deliverables")
      .select("score")
      .eq("enterprise_id", enterprise_id)
      .not("score", "is", null)
      .gt("score", 0);

    if (allDeliverables && allDeliverables.length > 0) {
      const scores = allDeliverables.map((d: any) => Number(d.score));
      const globalScore = Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length);
      await supabase.from("enterprises").update({ score_ir: globalScore }).eq("id", enterprise_id);
    }
  } catch (e) {
    console.warn("[saveDeliverable] score_ir update failed:", e);
  }
}

// ===== UEMOA FISCAL PARAMETERS (SOURCE DE VÉRITÉ UNIQUE) =====
export const FISCAL_PARAMS: Record<string, {
  tva: number; is: number; ir_max: number; smig: number;
  patente: string; cotisations_sociales: number; devise: string;
  currency_iso: string; exchange_rate_eur: number;
}> = {
  "Côte d'Ivoire": { tva: 18, is: 25, ir_max: 36, smig: 75000, patente: "0.5% CA", cotisations_sociales: 25, devise: "FCFA", currency_iso: "XOF", exchange_rate_eur: 655.957 },
  "Sénégal":        { tva: 18, is: 30, ir_max: 40, smig: 60000, patente: "Variable", cotisations_sociales: 24, devise: "FCFA", currency_iso: "XOF", exchange_rate_eur: 655.957 },
  "Mali":           { tva: 18, is: 30, ir_max: 40, smig: 40000, patente: "Variable", cotisations_sociales: 22, devise: "FCFA", currency_iso: "XOF", exchange_rate_eur: 655.957 },
  "Burkina Faso":   { tva: 18, is: 27.5, ir_max: 35, smig: 35000, patente: "Variable", cotisations_sociales: 22, devise: "FCFA", currency_iso: "XOF", exchange_rate_eur: 655.957 },
  "Bénin":          { tva: 18, is: 30, ir_max: 35, smig: 40000, patente: "Variable", cotisations_sociales: 24.5, devise: "FCFA", currency_iso: "XOF", exchange_rate_eur: 655.957 },
  "Togo":           { tva: 18, is: 27, ir_max: 35, smig: 35000, patente: "Variable", cotisations_sociales: 23.5, devise: "FCFA", currency_iso: "XOF", exchange_rate_eur: 655.957 },
  "Niger":          { tva: 19, is: 30, ir_max: 35, smig: 30047, patente: "Variable", cotisations_sociales: 20, devise: "FCFA", currency_iso: "XOF", exchange_rate_eur: 655.957 },
  "Guinée-Bissau":  { tva: 17, is: 25, ir_max: 30, smig: 19030, patente: "Variable", cotisations_sociales: 18, devise: "FCFA", currency_iso: "XOF", exchange_rate_eur: 655.957 },
  "Cameroun":       { tva: 19.25, is: 33, ir_max: 35, smig: 41875, patente: "Variable", cotisations_sociales: 18.5, devise: "FCFA", currency_iso: "XAF", exchange_rate_eur: 655.957 },
  "Gabon":          { tva: 18, is: 30, ir_max: 35, smig: 150000, patente: "Variable", cotisations_sociales: 20.1, devise: "FCFA", currency_iso: "XAF", exchange_rate_eur: 655.957 },
  "Congo":          { tva: 18.9, is: 28, ir_max: 40, smig: 90000, patente: "Variable", cotisations_sociales: 22.6, devise: "FCFA", currency_iso: "XAF", exchange_rate_eur: 655.957 },
  "RDC":            { tva: 16, is: 30, ir_max: 40, smig: 7075, patente: "Variable", cotisations_sociales: 14.5, devise: "CDF", currency_iso: "CDF", exchange_rate_eur: 2800 },
  "Guinée":         { tva: 18, is: 35, ir_max: 40, smig: 440000, patente: "Variable", cotisations_sociales: 23, devise: "GNF", currency_iso: "GNF", exchange_rate_eur: 9500 },
};

export function getFiscalParams(country: string) {
  // Direct match
  if (FISCAL_PARAMS[country]) return FISCAL_PARAMS[country];
  // Fuzzy match
  const c = (country || '').toLowerCase().trim();
  for (const [key, val] of Object.entries(FISCAL_PARAMS)) {
    if (c.includes(key.toLowerCase()) || key.toLowerCase().includes(c)) return val;
  }
  return FISCAL_PARAMS["Côte d'Ivoire"];
}

/**
 * Returns fiscal params in prompt-friendly format for AI system prompts.
 * This is the SINGLE source — no more local copies in edge functions.
 */
export function getFiscalParamsForPrompt(country: string): {
  tva: number; is_standard: number; is_pme: number; seuil_pme: string;
  charges_sociales: number; focus: string;
  devise: string; currency_iso: string; exchange_rate_eur: number;
} {
  const fp = getFiscalParams(country);
  const c = (country || '').toLowerCase().trim();
  
  // CIV has a special PME regime
  const isCIV = c.includes("ivoire") || c.includes("civ") || country === "Côte d'Ivoire";
  
  // Determine focus name
  let focus = country;
  for (const key of Object.keys(FISCAL_PARAMS)) {
    const kl = key.toLowerCase();
    if (c.includes(kl) || kl.includes(c)) { focus = key; break; }
  }
  
  return {
    tva: fp.tva,
    is_standard: fp.is,
    is_pme: isCIV ? 4 : fp.is,
    seuil_pme: isCIV ? `200M ${fp.devise}` : 'N/A',
    charges_sociales: fp.cotisations_sociales,
    focus,
    devise: fp.devise,
    currency_iso: fp.currency_iso,
    exchange_rate_eur: fp.exchange_rate_eur,
  };
}

// ===== RAG: EMBEDDING HELPER =====
async function getQueryEmbedding(text: string): Promise<number[] | null> {
  try {
    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) return null;

    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: text.substring(0, 2000),
        dimensions: 1536,
      }),
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) return null;
    const data = await response.json();
    return data.data[0].embedding;
  } catch {
    return null;
  }
}

// ===== RAG: BUILD KNOWLEDGE CONTEXT (v2 — semantic search + fallback) =====
export async function buildRAGContext(
  supabase: any,
  country: string,
  sector: string,
  categories: string[],
  deliverableType?: string
): Promise<string> {
  try {
    const queryText = `PME ${sector || "entreprise"} en ${country || "Afrique"} : benchmarks financiers, conditions bancaires, fiscalité, bailleurs de fonds, cours matières premières, réglementation`;

    // Try semantic search first
    const queryEmbedding = await getQueryEmbedding(queryText);
    let entries: any[] = [];

    if (queryEmbedding) {
      const { data: semanticResults } = await supabase.rpc("search_knowledge", {
        query_embedding: JSON.stringify(queryEmbedding),
        match_threshold: 0.5,
        match_count: 15,
        filter_categories: categories,
        filter_country: country || null,
        filter_sector: sector || null,
      });

      if (semanticResults && semanticResults.length > 0) {
        entries = semanticResults;
      }
    }

    // Fallback to text-based search
    if (entries.length === 0) {
      const { data: textResults } = await supabase
        .from("knowledge_base")
        .select("title, content, category, source, country, sector")
        .in("category", categories)
        .limit(30);

      if (textResults) {
        const countryLower = (country || "").toLowerCase();
        const sectorLower = (sector || "").toLowerCase();

        const relevant = textResults.filter((e: any) => {
          const matchCountry = !e.country || e.country.toLowerCase().includes(countryLower) || countryLower.includes((e.country || "").toLowerCase());
          const matchSector = !e.sector || e.sector.toLowerCase().includes(sectorLower) || sectorLower.includes((e.sector || "").toLowerCase());
          return matchCountry || matchSector;
        });

        entries = relevant.length > 0 ? relevant : textResults.slice(0, 15);
      }
    }

    if (!entries || entries.length === 0) return "";

    let ragText = "\n\n══════ BASE DE CONNAISSANCES (RAG) ══════\n";
    for (const entry of entries.slice(0, 20)) {
      ragText += `\n--- ${(entry.category || "").toUpperCase()}: ${entry.title} ---\n`;
      ragText += (entry.content || "").substring(0, 2000) + "\n";
      if (entry.source) ragText += `(Source: ${entry.source})\n`;
      if (entry.similarity) ragText += `(Pertinence: ${Math.round(entry.similarity * 100)}%)\n`;
    }
    ragText += "══════════════════════════════════════════\n";

    // ── Feedback loop: inject recent corrections as few-shot examples ──
    if (deliverableType) {
      try {
        const { data: recentCorrections } = await supabase
          .from("deliverable_corrections")
          .select("field_path, original_value, corrected_value, correction_reason, deliverable_type")
          .eq("deliverable_type", deliverableType)
          .order("created_at", { ascending: false })
          .limit(10);

        if (recentCorrections && recentCorrections.length > 0) {
          ragText += "\n\n══════ CORRECTIONS HISTORIQUES (apprends de ces erreurs) ══════\n";
          ragText += "Des analystes humains ont corrigé ces erreurs dans des générations précédentes du même type.\n";
          ragText += "ÉVITE de reproduire ces erreurs :\n";
          for (const c of recentCorrections) {
            ragText += `\n- Champ "${c.field_path}" : l'IA avait généré ${JSON.stringify(c.original_value)} → corrigé en ${JSON.stringify(c.corrected_value)}`;
            if (c.correction_reason) ragText += ` (Raison : ${c.correction_reason})`;
            ragText += "\n";
          }
          ragText += "══════════════════════════════════════════\n";
        }
      } catch (e) {
        console.warn("Feedback loop query failed (non-blocking):", e);
      }
    }

    return ragText;
  } catch (e) {
    console.warn("buildRAGContext error (non-blocking):", e);
    return "";
  }
}
