// helpers_v5.ts — shared utilities for edge functions (v5 — cache-bust + lazy JSZip 2026-03-19)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// S7: Prompt injection sanitizer — neutralize potential instruction injection in user data
export function sanitizeForPrompt(text: string): string {
  if (!text || typeof text !== 'string') return '';
  return text
    // Remove common prompt injection patterns
    .replace(/ignore\s+(all\s+)?(previous|above|prior)\s+(instructions?|prompts?|rules?)/gi, '[FILTERED]')
    .replace(/you\s+are\s+now\s+/gi, '[FILTERED]')
    .replace(/disregard\s+(all\s+)?(previous|above)/gi, '[FILTERED]')
    .replace(/system\s*:\s*/gi, '[FILTERED]')
    .replace(/\{?\{?\s*system\s*\}?\}?/gi, '[FILTERED]')
    .replace(/<<\s*SYS\s*>>/gi, '[FILTERED]')
    .replace(/<\|im_start\|>/gi, '[FILTERED]')
    .replace(/\[INST\]/gi, '[FILTERED]')
    // Limit consecutive special characters that could break prompt structure
    .replace(/={10,}/g, '=====')
    .replace(/-{10,}/g, '-----')
    .replace(/#{5,}/g, '###');
}

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

export function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function errorResponse(message: string, status = 500) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ===== DOCX PARSER (used by extract-enterprise-info, extract-programme-criteria) =====
export async function parseDocx(arrayBuffer: ArrayBuffer): Promise<string> {
  const JSZip = (await import("https://esm.sh/jszip@3.10.1")).default;
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
  const JSZip = (await import("https://esm.sh/jszip@3.10.1")).default;
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

export async function verifyAndGetContext(req: Request, preParsedBody?: any) {
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

  const body = preParsedBody ?? await req.json();
  const enterprise_id = body.enterprise_id;
  if (!enterprise_id) throw { status: 400, message: "enterprise_id requis" };

  const supabase = createClient(supabaseUrl, serviceKey);

  const { data: ent } = await supabase.from("enterprises").select("*").eq("id", enterprise_id).single();
  if (!ent) throw { status: 404, message: "Entreprise non trouvée" };

  // Vérification d'accès : propriétaire, coach assigné (N-à-N ou legacy), membre de l'org, ou super_admin
  const isOwner = ent.user_id === user.id;
  const isLegacyCoach = ent.coach_id === user.id;
  const { data: isCoachNN } = await supabase.from("enterprise_coaches")
    .select("id").eq("enterprise_id", enterprise_id).eq("coach_id", user.id).eq("is_active", true).limit(1);
  const isCoach = isLegacyCoach || (isCoachNN && isCoachNN.length > 0);
  const { data: isMember } = ent.organization_id ? await supabase.from("organization_members")
    .select("id").eq("organization_id", ent.organization_id).eq("user_id", user.id).eq("is_active", true).limit(1) : { data: null };
  const isOrgMember = isMember && isMember.length > 0;
  const { data: isSA } = await supabase.rpc("has_role", { _user_id: user.id, _role: "super_admin" });

  if (!isOwner && !isCoach && !isOrgMember && !isSA) {
    throw { status: 403, message: "Accès non autorisé à cette entreprise" };
  }

  // Read cached document content — no more file parsing in edge functions!
  const documentContent = ent.document_content || "";

  const { data: delivs } = await supabase.from("deliverables").select("type, data, score").eq("enterprise_id", enterprise_id);
  const deliverableMap: Record<string, any> = {};
  (delivs || []).forEach((d: any) => { deliverableMap[d.type] = d; });

  const { data: modulesData } = await supabase.from("enterprise_modules").select("module, status, data").eq("enterprise_id", enterprise_id);
  const moduleMap: Record<string, any> = {};
  (modulesData || []).forEach((m: any) => { moduleMap[m.module] = m.data || {}; });

  // Derive base_year from inputs historique_3ans (last year with real financial data)
  const inputsDeliv = deliverableMap["inputs_data"];
  const inputsDataForYear = inputsDeliv?.data || inputsDeliv;
  const hist3 = inputsDataForYear?.historique_3ans;
  const detectedBaseYear = hist3 ? Math.max(
    hist3.n?.annee || 0,
    hist3.n_moins_1?.annee || 0,
    hist3.n_moins_2?.annee || 0
  ) : 0;
  const baseYear: number = (detectedBaseYear > 2000 ? detectedBaseYear : 0) || ent.base_year || new Date(ent.created_at || Date.now()).getFullYear();

  const organization_id = ent.organization_id;
  return { supabase, user, enterprise: ent, enterprise_id, organization_id, documentContent, moduleMap, deliverableMap, baseYear };
}

/**
 * Réordonne le document_content selon les priorités de l'agent.
 * Chaque agent a des catégories de documents prioritaires différentes.
 * Le parsing report (stocké en JSONB) contient la catégorie de chaque fichier.
 */
export function getDocumentContentForAgent(
  enterprise: any,
  agentType: string,
  maxChars: number = 100_000
): string {
  const fullContent = sanitizeForPrompt(enterprise.document_content || "");
  const report = enterprise.document_parsing_report;

  // Si pas de rapport de parsing, retourner le contenu tel quel (cappé + sanitized)
  if (!report?.files || !Array.isArray(report.files)) {
    return fullContent.substring(0, maxChars);
  }

  // Priorités par agent — les catégories les plus utiles en premier
  const AGENT_PRIORITIES: Record<string, string[]> = {
    reconstruct: ['etats_financiers', 'releve_bancaire', 'budget_previsionnel', 'facture', 'business_plan', 'rapport_activite', 'document_legal'],
    inputs: ['etats_financiers', 'releve_bancaire', 'budget_previsionnel', 'facture', 'business_plan'],
    bmc: ['business_plan', 'rapport_activite', 'autre', 'budget_previsionnel', 'facture', 'etats_financiers'],
    sic: ['rapport_activite', 'business_plan', 'autre', 'document_legal'],
    framework: ['etats_financiers', 'releve_bancaire', 'budget_previsionnel', 'facture', 'business_plan'],
    plan_ovo: ['budget_previsionnel', 'etats_financiers', 'business_plan', 'releve_bancaire'],
    business_plan: ['business_plan', 'rapport_activite', 'etats_financiers', 'budget_previsionnel', 'facture', 'document_legal'],
    odd: ['rapport_activite', 'business_plan', 'autre', 'document_legal'],
    diagnostic: ['etats_financiers', 'business_plan', 'rapport_activite', 'budget_previsionnel', 'releve_bancaire'],
    valuation: ['etats_financiers', 'budget_previsionnel', 'releve_bancaire', 'business_plan'],
    onepager: ['business_plan', 'etats_financiers', 'rapport_activite', 'budget_previsionnel'],
    investment_memo: ['etats_financiers', 'business_plan', 'rapport_activite', 'budget_previsionnel', 'document_legal', 'releve_bancaire'],
    screening: ['etats_financiers', 'releve_bancaire', 'business_plan', 'rapport_activite', 'document_legal', 'budget_previsionnel', 'facture', 'organigramme_rh', 'photo_installation', 'autre'],
    pre_screening: ['etats_financiers', 'releve_bancaire', 'business_plan', 'rapport_activite', 'budget_previsionnel', 'document_legal', 'facture', 'organigramme_rh', 'photo_installation', 'autre'],
  };

  const priorities = AGENT_PRIORITIES[agentType] || AGENT_PRIORITIES['reconstruct'];

  // Trier les fichiers du rapport selon les priorités de l'agent
  const sortedFiles = [...report.files].sort((a: any, b: any) => {
    const idxA = priorities.indexOf(a.category || 'autre');
    const idxB = priorities.indexOf(b.category || 'autre');
    const posA = idxA === -1 ? 999 : idxA;
    const posB = idxB === -1 ? 999 : idxB;
    return posA - posB;
  });

  // Reconstruire le contenu dans le nouvel ordre
  let reordered = '';
  for (const file of sortedFiles) {
    if (reordered.length >= maxChars) break;

    const marker = `══════ ${file.fileName}`;
    const startIdx = fullContent.indexOf(marker);
    if (startIdx === -1) continue;

    const nextMarker = fullContent.indexOf('\n══════ ', startIdx + marker.length);
    const endIdx = nextMarker === -1 ? fullContent.length : nextMarker;

    const section = fullContent.substring(startIdx, endIdx);
    const remaining = maxChars - reordered.length;
    if (remaining <= 0) break;

    reordered += '\n' + section.substring(0, remaining);
  }

  return reordered.trim() || fullContent.substring(0, maxChars);
}

export async function callAI(systemPrompt: string, userPrompt: string, maxTokens = 16384, model = "claude-sonnet-4-6", temperature = 0, costContext?: { functionName?: string; enterpriseId?: string }) {
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
    // Token tracking + cost logging
    const usage = aiResult.usage;
    if (usage) {
      const inputCost = (usage.input_tokens || 0) * (model.includes("opus") ? 15 : 3) / 1_000_000;
      const outputCost = (usage.output_tokens || 0) * (model.includes("opus") ? 75 : 15) / 1_000_000;
      const totalCost = inputCost + outputCost;
      console.log(`[cost] ${model.slice(0,20)}: ${usage.input_tokens || 0} in + ${usage.output_tokens || 0} out = $${totalCost.toFixed(4)}`);
      // Log to DB (non-blocking)
      try {
        const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
        await svc.from("ai_cost_log").insert({
          function_name: costContext?.functionName || 'callAI',
          enterprise_id: costContext?.enterpriseId || null,
          organization_id: costContext?.organizationId || null,
          model,
          input_tokens: usage.input_tokens || 0,
          output_tokens: usage.output_tokens || 0,
          cost_usd: totalCost,
        });
      } catch (_) {}
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
      let closeBrackets = (cleaned.match(/]/g) || []).length;

      if (openBrackets > closeBrackets || openBraces > closeBraces) {
        console.warn("Truncated JSON detected, attempting deep repair...");
        
        // Close any open string value first
        const quoteCount = (cleaned.match(/(?<!\\)\"/g) || []).length;
        if (quoteCount % 2 !== 0) {
          cleaned = cleaned.replace(/\"[^"]*$/, '""');
        }
        
        // Remove trailing incomplete key-value pairs aggressively
        cleaned = cleaned
          .replace(/,\s*\"[^\"]*\"\s*:\s*\"[^\"]*$/, "")
          .replace(/,\s*\"[^\"]*\"\s*:\s*\[[^\]]*$/, "")
          .replace(/,\s*\"[^\"]*\"\s*:\s*\{[^}]*$/, "")
          .replace(/,\s*\"[^\"]*\"\s*:\s*$/, "")
          .replace(/,\s*\"[^\"]*$/, "")
          .replace(/,\s*$/, "");
        
        openBraces = (cleaned.match(/{/g) || []).length;
        closeBraces = (cleaned.match(/}/g) || []).length;
        openBrackets = (cleaned.match(/\[/g) || []).length;
        closeBrackets = (cleaned.match(/]/g) || []).length;
        
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
            .replace(/,?\s*\"[^\"]*\"?\s*:\s*\"[^\"]*\"?\s*$/, "")
            .replace(/,?\s*\"[^\"]*\"?\s*:\s*\[[^\]]*$/, "")
            .replace(/,?\s*\"[^\"]*\"?\s*:\s*\{[^}]*$/, "")
            .replace(/,?\s*\"[^\"]*\"?\s*:\s*[^{}\[\],"\s]*\s*$/, "")
            .replace(/,\s*$/, "");
          const ob = (trimmed.match(/{/g) || []).length;
          const cb = (trimmed.match(/}/g) || []).length;
          const oq = (trimmed.match(/\[/g) || []).length;
          const cq = (trimmed.match(/]/g) || []).length;
          const qc = (trimmed.match(/(?<!\\)\"/g) || []).length;
          if (qc % 2 !== 0) trimmed = trimmed.replace(/\"[^"]*$/, '""');
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

  // 2. Fetch organization_id for this enterprise (used in archive + score_history)
  const { data: entForOrg } = await supabase.from("enterprises").select("organization_id").eq("id", enterprise_id).single();

  // 3. Archive previous version if exists
  if (existing?.data && typeof existing.data === 'object' && Object.keys(existing.data).length > 0) {
    const { error: archiveError } = await supabase.from("deliverable_versions").insert({
      deliverable_id: existing.id,
      enterprise_id,
      organization_id: entForOrg?.organization_id || null,
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

  // 4. Compute weighted score (replaces subjective AI score)
  try {
    const { scoreInputs, scoreBmc, scoreSic, scoreOdd, scorePreScreening, scorePlanFinancier, scoreBusinessPlan, scoreOnepager, scoreDiagnostic, scoreValuation, scoreMemo, scoreScreening } = await import("./scoring.ts");
    const scoreFns: Record<string, (d: any) => any> = {
      inputs_data: scoreInputs,
      pre_screening: scorePreScreening,
      bmc_analysis: scoreBmc,
      sic_analysis: scoreSic,
      plan_financier: scorePlanFinancier,
      business_plan: scoreBusinessPlan,
      odd_analysis: scoreOdd,
      diagnostic_data: scoreDiagnostic,
      valuation: scoreValuation,
      onepager: scoreOnepager,
      investment_memo: scoreMemo,
      screening_report: scoreScreening,
    };
    const scoreFn = scoreFns[type];
    if (scoreFn) {
      const result = scoreFn(data);
      data._scoring = { weighted_score: result.score, criteria: result.criteria, confidence: result.confidence };
      data.score = result.score;
      console.log(`[scoring] ${type}: ${result.score}/100 (confidence ${result.confidence}%, ${result.criteria.length} critères)`);
    }
  } catch (e) {
    console.warn("[scoring] non-blocking error:", e);
  }

  // 5. Upsert deliverable
  const { data: upserted } = await supabase.from("deliverables").upsert({
    enterprise_id,
    type,
    data,
    score: data.score ?? data.score_global ?? data.verdict_readiness?.score ?? null,
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
    organization_id: entForOrg?.organization_id || null,
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
      .select("type, score")
      .eq("enterprise_id", enterprise_id)
      .not("score", "is", null)
      .gt("score", 0);

    if (allDeliverables && allDeliverables.length > 0) {
      const scores = allDeliverables.map((d: any) => Number(d.score));
      const globalScore = Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length);

      // 6b. Track score history before updating
      try {
        const { data: currentEnt } = await supabase
          .from("enterprises").select("score_ir").eq("id", enterprise_id).single();
        const previousScore = currentEnt?.score_ir || 0;

        if (globalScore !== previousScore) {
          await supabase.from("score_history").insert({
            enterprise_id,
            organization_id: entForOrg?.organization_id || null,
            score: globalScore,
            scores_detail: {
              trigger_type: type,
              trigger_score: data.score || data.score_global || null,
              previous_global: previousScore,
              new_global: globalScore,
              all_scores: Object.fromEntries(
                allDeliverables.map((d: any) => [d.type, Number(d.score)])
              ),
            },
          });
        }
      } catch (shErr) {
        console.warn("[saveDeliverable] score_history insert failed:", shErr);
      }

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
  "RDC":            { tva: 16, is: 30, ir_max: 40, smig: 7075, patente: "Variable", cotisations_sociales: 14.5, devise: "USD", currency_iso: "USD", exchange_rate_eur: 1.08 },
  "Guinée":         { tva: 18, is: 35, ir_max: 40, smig: 440000, patente: "Variable", cotisations_sociales: 23, devise: "GNF", currency_iso: "GNF", exchange_rate_eur: 9500 },
  "Ghana":          { tva: 15, is: 25, ir_max: 30, smig: 44800, patente: "Variable", cotisations_sociales: 18.5, devise: "GHS", currency_iso: "GHS", exchange_rate_eur: 15.5 },
  "Kenya":          { tva: 16, is: 30, ir_max: 30, smig: 15120, patente: "Variable", cotisations_sociales: 12, devise: "KES", currency_iso: "KES", exchange_rate_eur: 165 },
  "Nigeria":        { tva: 7.5, is: 30, ir_max: 24, smig: 30000, patente: "Variable", cotisations_sociales: 18, devise: "NGN", currency_iso: "NGN", exchange_rate_eur: 1750 },
  "Maroc":          { tva: 20, is: 31, ir_max: 38, smig: 2970, patente: "Variable", cotisations_sociales: 26.6, devise: "MAD", currency_iso: "MAD", exchange_rate_eur: 10.8 },
  "Tunisie":        { tva: 19, is: 25, ir_max: 35, smig: 460, patente: "Variable", cotisations_sociales: 25.75, devise: "TND", currency_iso: "TND", exchange_rate_eur: 3.35 },
  "Madagascar":     { tva: 20, is: 20, ir_max: 20, smig: 200000, patente: "Variable", cotisations_sociales: 19, devise: "MGA", currency_iso: "MGA", exchange_rate_eur: 4900 },
  "Éthiopie":       { tva: 15, is: 30, ir_max: 35, smig: 0, patente: "Variable", cotisations_sociales: 18, devise: "ETB", currency_iso: "ETB", exchange_rate_eur: 130 },
  "Tanzanie":       { tva: 18, is: 30, ir_max: 30, smig: 100000, patente: "Variable", cotisations_sociales: 20, devise: "TZS", currency_iso: "TZS", exchange_rate_eur: 2850 },
  "Rwanda":         { tva: 18, is: 30, ir_max: 30, smig: 0, patente: "Variable", cotisations_sociales: 8, devise: "RWF", currency_iso: "RWF", exchange_rate_eur: 1450 },
  "Afrique du Sud": { tva: 15, is: 27, ir_max: 45, smig: 4600, patente: "Variable", cotisations_sociales: 2, devise: "ZAR", currency_iso: "ZAR", exchange_rate_eur: 20.5 },
};

export function getFiscalParams(country: string) {
  // Direct match
  if (FISCAL_PARAMS[country]) return FISCAL_PARAMS[country];
  // Fuzzy match
  const c = (country || '').toLowerCase().trim();
  for (const [key, val] of Object.entries(FISCAL_PARAMS)) {
    if (c.includes(key.toLowerCase()) || key.toLowerCase().includes(c)) return val;
  }
  // Fallback générique — taux moyens UEMOA (pas spécifique à un pays)
  return { tva: 18, is: 25, ir_max: 35, smig: 60000, patente: "0.5% CA", cotisations_sociales: 20, devise: "", currency_iso: "", exchange_rate_eur: 655.957 };
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
// Voyage AI voyage-3 1024d — cohérent avec knowledge_base.embedding (migré
// d'OpenAI 1536d le 2026-05-13) et knowledge_chunks. Si Voyage rate-limit ou
// indispo, on retourne null → buildRAGContext fait fallback text-search.
async function getQueryEmbedding(text: string): Promise<number[] | null> {
  try {
    const voyageKey = Deno.env.get("VOYAGE_API_KEY");
    if (!voyageKey) return null;

    const response = await fetch("https://api.voyageai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${voyageKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "voyage-3",
        input: [text.substring(0, 8000)],
        input_type: "query",
        output_dimension: 1024,
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
  deliverableType?: string,
  enterpriseId?: string,
  organizationId?: string | null,
): Promise<string> {
  try {
    const queryText = `PME ${sector || "entreprise"} en ${country || "Afrique"} : benchmarks financiers, conditions bancaires, fiscalité, bailleurs de fonds, cours matières premières, réglementation`;

    // Try semantic search first
    const queryEmbedding = await getQueryEmbedding(queryText);
    let entries: any[] = [];

    if (queryEmbedding) {
      // KB globale via search_knowledge_chunks (sans filter_organization_id).
      // search_knowledge sur knowledge_base.embedding n'est pas utilisé :
      // colonne non peuplée. Les embeddings vivent dans knowledge_chunks.
      const { data: semanticResults } = await supabase.rpc("search_knowledge_chunks", {
        query_embedding: queryEmbedding,
        match_threshold: 0.5,
        match_count: 15,
        filter_country: country || null,
        filter_sector: sector || null,
        filter_organization_id: null,
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

    let ragText = "";
    if (entries && entries.length > 0) {
      ragText = "\n\n══════ BASE DE CONNAISSANCES (RAG) ══════\n";
      for (const entry of entries.slice(0, 20)) {
        ragText += `\n--- ${(entry.category || "").toUpperCase()}: ${entry.title} ---\n`;
        ragText += (entry.content || "").substring(0, 2000) + "\n";
        if (entry.source) ragText += `(Source: ${entry.source})\n`;
        if (entry.similarity) ragText += `(Pertinence: ${Math.round(entry.similarity * 100)}%)\n`;
      }
      ragText += "══════════════════════════════════════════\n";
    }

    // ── KB propriétaire de l'organisation (deal-learnings, thèses, comparables) ──
    if (organizationId) {
      try {
        // 1. Recherche vectorielle scopée org (priorité aux deal_learnings sectoriellement
        //    proches), via knowledge_chunks filtre organization_id.
        const orgEmb = queryEmbedding ?? await getQueryEmbedding(queryText);
        if (orgEmb) {
          const { data: orgChunks } = await supabase.rpc("search_knowledge_chunks", {
            query_embedding: orgEmb,
            match_threshold: 0.3,
            match_count: 8,
            filter_country: null,
            filter_sector: null,
            filter_organization_id: organizationId,
          });
          if (orgChunks && orgChunks.length > 0) {
            ragText += "\n\n══════ KB PROPRIÉTAIRE DE L'ORG (deals comparables, thèses, leçons internes) ══════\n";
            for (const c of orgChunks.slice(0, 10)) {
              ragText += `\n--- ${(c.category || "").toUpperCase()}: ${c.title} ---\n`;
              ragText += (c.content || "").substring(0, 1800) + "\n";
              if (c.source) ragText += `(Source: ${c.source})\n`;
              if (c.similarity) ragText += `(Pertinence: ${Math.round(c.similarity * 100)}%)\n`;
            }
            ragText += "══════════════════════════════════════════\n";
          }
        }

        // 2. Fallback / complément : lecture directe organization_knowledge filtrée par
        //    secteur/pays (plus large que la recherche vectorielle, utile si peu de chunks
        //    mais une fiche pertinente texte).
        const { data: orgEntries } = await supabase
          .from("organization_knowledge")
          .select("category, title, content, source")
          .eq("organization_id", organizationId)
          .eq("is_active", true)
          .or(`sector.eq.${sector},sector.is.null`)
          .or(`country.eq.${country},country.is.null`)
          .order("created_at", { ascending: false })
          .limit(5);
        if (orgEntries && orgEntries.length > 0) {
          ragText += "\n\n══════ FICHES ORG SUPPLÉMENTAIRES ══════\n";
          for (const e of orgEntries) {
            ragText += `\n--- ${(e.category || "").toUpperCase()}: ${e.title} ---\n`;
            ragText += (e.content || "").substring(0, 1500) + "\n";
            if (e.source) ragText += `(Source: ${e.source})\n`;
          }
          ragText += "══════════════════════════════════════════\n";
        }
      } catch (e: any) {
        console.warn("[buildRAGContext] org knowledge fetch failed (non-blocking):", e.message);
      }
    }

    if (!ragText) return "";

    // ── Feedback loop: inject recent corrections as few-shot examples ──
    if (deliverableType) {
      try {
        let corrQuery = supabase
          .from("deliverable_corrections")
          .select("field_path, original_value, corrected_value, correction_reason, deliverable_type")
          .eq("deliverable_type", deliverableType)
          .order("created_at", { ascending: false })
          .limit(10);
        // Compartmentalize: only this enterprise's corrections
        if (enterpriseId) corrQuery = corrQuery.eq("enterprise_id", enterpriseId);
        const { data: recentCorrections } = await corrQuery;

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

// ===== COACHING CONTEXT (inject coach notes into AI prompts) =====
export async function getCoachingContext(supabase: any, enterpriseId: string): Promise<string> {
  try {
    const { data: notes } = await supabase
      .from('coaching_notes')
      .select('titre, resume_ia, infos_extraites, date_rdv')
      .eq('enterprise_id', enterpriseId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (!notes?.length) return "";

    const infos = notes.flatMap((n: any) =>
      (n.infos_extraites || []).filter((i: any) => i.injecter).map((i: any) => `[${i.categorie}] ${i.info}`)
    );
    if (!infos.length) return "";

    const rdvs = notes.filter((n: any) => n.resume_ia).slice(0, 3)
      .map((n: any) => `${n.date_rdv || '?'} : ${n.resume_ia}`);

    return `
══════ INFORMATIONS DU COACH (terrain, validées) ══════
${infos.join('\n')}
${rdvs.length ? `\nDERNIERS RDV :\n${rdvs.join('\n')}` : ''}
⚠ Ces informations COMPLÈTENT et CORRIGENT les documents. En cas de contradiction, PRIVILÉGIER les infos du coach.
══════ FIN ══════
`;
  } catch (e) {
    console.warn("getCoachingContext error (non-blocking):", e);
    return "";
  }
}

// ===== RAG v2: Voyage AI semantic search via knowledge_chunks =====
async function generateQueryEmbeddingVoyage(text: string): Promise<number[] | null> {
  try {
    const voyageKey = Deno.env.get("VOYAGE_API_KEY");
    if (!voyageKey) return null;
    const resp = await fetch("https://api.voyageai.com/v1/embeddings", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${voyageKey}` },
      body: JSON.stringify({
        input: text.slice(0, 32000),
        model: "voyage-3",
        input_type: "query",
      }),
      signal: AbortSignal.timeout(8_000),
    });
    if (!resp.ok) {
      console.warn("[rag-voyage]", resp.status, (await resp.text()).slice(0, 200));
      return null;
    }
    const data = await resp.json();
    return data.data?.[0]?.embedding || null;
  } catch (e: any) {
    console.warn("[rag-voyage] exception", e.message);
    return null;
  }
}

// Queries construites à partir du type d'agent pour cibler les chunks les plus utiles
const AGENT_RAG_QUERIES: Record<string, string> = {
  pre_screening: "benchmarks financiers, critères d'investissement, marge EBITDA, conditions de financement PME",
  screening_report: "screening approfondi PME, benchmarks sectoriels, risques investissement, capital risque",
  business_plan: "plan d'affaires, structure, projections financières, marché, concurrence, hypothèses",
  bmc: "business model canvas, proposition de valeur, segments clients, partenaires, ressources clés",
  sic: "secteur, industrie, concurrence, analyse marché, tendances Afrique",
  valuation: "valorisation, multiples EBITDA, multiples CA, comparables, transactions M&A, prime risque pays",
  odd: "objectifs développement durable, impact ESG, social, environnement, IRIS+",
  inputs: "états financiers, SYSCOHADA, hypothèses, comptabilité PME, structure bilan",
  diagnostic: "diagnostic financier, forces faiblesses, ratios PME, risques",
  framework: "financement PME, levées de fonds, bailleurs, Proparco, IFC, AFD",
  plan_ovo: "plan financier prévisionnel, budget, projections, PME",
  plan_financier: "plan financier prévisionnel, budget, projections, CAPEX, BFR, trésorerie",
};

async function ragSearchChunks(
  supabase: any,
  pays: string,
  secteur: string,
  agentType: string,
  matchCount = 8,
  organizationId?: string | null,
): Promise<any[]> {
  try {
    const agentQuery = AGENT_RAG_QUERIES[agentType] || AGENT_RAG_QUERIES.pre_screening;
    const queryText = `PME ${secteur || "entreprise"} en ${pays || "Afrique"} — ${agentQuery}`;
    const emb = await generateQueryEmbeddingVoyage(queryText);
    if (!emb) return [];
    const { data: chunks, error } = await supabase.rpc("search_knowledge_chunks", {
      query_embedding: emb,
      match_threshold: 0.3,
      match_count: matchCount,
      filter_country: null,
      filter_sector: null,
      filter_organization_id: organizationId ?? null,
    });
    if (error) {
      console.warn("[rag-search] rpc error", error.message);
      return [];
    }
    return chunks || [];
  } catch (e: any) {
    console.warn("[rag-search] exception", e.message);
    return [];
  }
}

// ===== KNOWLEDGE FOR AGENT (4-layer KB retrieval) =====
export async function getKnowledgeForAgent(
  supabase: any,
  pays: string,
  secteur: string,
  agentType: 'valuation' | 'diagnostic' | 'framework' | 'pre_screening' | 'screening_report' | 'business_plan' | 'bmc' | 'sic' | 'inputs' | 'odd' | 'plan_ovo',
  ownerId?: string,
  organizationId?: string
): Promise<string> {
  try {
    const paysKey = pays.toLowerCase().replace(/[\s'']/g, '_').replace(/côte_d_ivoire|cote_divoire/i, 'cote_d_ivoire');
    const secteurKey = secteur.toLowerCase().replace(/[\s\-\/]/g, '_');

    // 1. Benchmarks sectoriels (couche 2)
    const { data: benchmarks } = await supabase
      .from('knowledge_benchmarks')
      .select('*')
      .or(`pays.eq.${paysKey},pays.eq.all`)
      .eq('secteur', secteurKey)
      .order('pays', { ascending: false })
      .limit(1);

    // 2. Paramètres risque pays (couche 2)
    const { data: riskParams } = await supabase
      .from('knowledge_risk_params')
      .select('*')
      .eq('pays', paysKey)
      .maybeSingle();

    // 3. Données macro pays (couche 2)
    const { data: countryData } = await supabase
      .from('knowledge_country_data')
      .select('*')
      .eq('pays', paysKey)
      .maybeSingle();

    // 4. Risk factors applicables (couche 2)
    const { data: riskFactors } = await supabase
      .from('knowledge_risk_factors')
      .select('*')
      .eq('is_active', true);

    // 5. Données propriétaires workspace (couche 3)
    let workspaceData = null;
    if (ownerId) {
      const { data } = await supabase
        .from('workspace_knowledge')
        .select('*')
        .eq('owner_id', ownerId);
      workspaceData = data;
    }

    // 6. Organization knowledge — Couche 1 (docs privés de l'org)
    let orgKnowledge: any[] = [];
    if (organizationId) {
      const { data: orgDocs } = await supabase
        .from('organization_knowledge')
        .select('id, title, content, category, sector, country, source, metadata')
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .limit(10);
      orgKnowledge = orgDocs || [];
    }

    // 7. Benchmarks auto-enrichis (couche 4)
    const { data: aggBenchmarks } = await supabase
      .from('aggregated_benchmarks')
      .select('*')
      .eq('secteur', secteurKey)
      .eq('pays', paysKey)
      .maybeSingle();

    // 8. Ressources documentaires — Phase 2 RAG (recherche vectorielle Voyage → knowledge_chunks)
    //    Fallback sur l'ancien filtre country/limit si Voyage absent, rate-limit, ou base vide
    let kbDocs: any[] = [];
    const ragChunks = await ragSearchChunks(supabase, pays, secteur, agentType, 8, organizationId);
    if (ragChunks.length > 0) {
      // Mapper vers le shape attendu par buildKnowledgePrompt (metadata.source_url, metadata.publication_date)
      kbDocs = ragChunks.map((c: any) => ({
        title: c.title,
        content: c.content,
        source: c.source,
        country: c.country,
        sector: c.sector,
        category: c.category,
        metadata: {
          source_url: c.source_url,
          publication_date: c.publication_date,
          similarity: c.similarity,
        },
      }));
    } else {
      // Fallback legacy : simple filtre country
      const { data: legacyDocs } = await supabase
        .from('knowledge_base')
        .select('id, title, content, category, sector, country, source, metadata')
        .or(`country.eq.${pays},country.eq.Afrique,country.eq.Monde`)
        .limit(15);
      kbDocs = legacyDocs || [];
    }

    return buildKnowledgePrompt({
      benchmarks: benchmarks?.[0] || null,
      riskParams: riskParams || null,
      countryData: countryData || null,
      riskFactors: riskFactors || [],
      workspaceData,
      orgKnowledge,
      kbDocs,
      aggBenchmarks: aggBenchmarks?.nb_entreprises >= 10 ? aggBenchmarks : null,
      agentType,
    });
  } catch (e) {
    console.warn("getKnowledgeForAgent error (non-blocking):", e);
    return "";
  }
}

function buildKnowledgePrompt(ctx: {
  benchmarks: any; riskParams: any; countryData: any;
  riskFactors: any[]; workspaceData: any; orgKnowledge?: any[]; kbDocs?: any[]; aggBenchmarks: any; agentType: string;
}): string {
  const parts: string[] = [];

  if (ctx.benchmarks) {
    const b = ctx.benchmarks;
    parts.push(`══ BENCHMARKS SECTORIELS (${b.secteur}, source: ${b.source}) ══
Marge brute: ${b.marge_brute_min}-${b.marge_brute_max}% (médiane ${b.marge_brute_mediane}%)
Marge EBITDA: ${b.marge_ebitda_min}-${b.marge_ebitda_max}%
Marge nette: ${b.marge_nette_min}-${b.marge_nette_max}%
Ratio personnel/CA: ${b.ratio_personnel_ca_min}-${b.ratio_personnel_ca_max}%
Croissance CA max raisonnable: ${b.croissance_ca_max}%/an
Multiples EBITDA: ${b.multiple_ebitda_min}-${b.multiple_ebitda_max}×
Multiples CA: ${b.multiple_ca_min}-${b.multiple_ca_max}×`);

    // CAPEX typiques du secteur
    if (b.capex_typiques && typeof b.capex_typiques === 'object' && Object.keys(b.capex_typiques).length > 0) {
      let capexLines = `══ CAPEX TYPIQUES SECTEUR (${b.secteur}) ══\n`;
      for (const [item, detail] of Object.entries(b.capex_typiques as Record<string, any>)) {
        capexLines += `${item}: ${detail.min?.toLocaleString('fr-FR')}-${detail.max?.toLocaleString('fr-FR')} ${detail.devise || ''} (amort ${detail.amort_ans} ans)\n`;
      }
      capexLines += `⚠️ Utiliser comme référence pour valider les CAPEX de l'entreprise`;
      parts.push(capexLines);
    }

    // Structure OPEX du secteur
    if (b.opex_structure && typeof b.opex_structure === 'object' && Object.keys(b.opex_structure).length > 0) {
      let opexLines = `══ STRUCTURE OPEX SECTEUR (${b.secteur}) ══\n`;
      for (const [poste, detail] of Object.entries(b.opex_structure as Record<string, any>)) {
        opexLines += `${poste}: ${detail.min}-${detail.max}% CA${detail.detail ? ` (${detail.detail})` : ''}\n`;
      }
      parts.push(opexLines);
    }

    // BFR typique du secteur
    if (b.bfr_typique && typeof b.bfr_typique === 'object' && Object.keys(b.bfr_typique).length > 0) {
      const bfr = b.bfr_typique as Record<string, any>;
      parts.push(`══ BFR TYPIQUE SECTEUR (${b.secteur}) ══
DSO: ${bfr.dso_jours}j | DPO: ${bfr.dpo_jours}j | DIO: ${bfr.dio_jours}j
${bfr.notes || ''}`);
    }
  }

  if (ctx.riskParams) {
    const r = ctx.riskParams;
    parts.push(`══ PARAMÈTRES RISQUE PAYS (${r.pays}, source: ${r.source}) ══
Risk-free rate: ${r.risk_free_rate}% | ERP: ${r.equity_risk_premium}%
CRP: ${r.country_risk_premium}% | Default spread: ${r.default_spread}%
Size premium micro/small/medium: ${r.size_premium_micro}/${r.size_premium_small}/${r.size_premium_medium}%
Illiquidity premium: ${r.illiquidity_premium_min}-${r.illiquidity_premium_max}%
Coût dette: ${r.cost_of_debt}% | Taux IS: ${r.tax_rate}%
Taux directeur: ${r.taux_directeur}%
Risque pays: ${r.risque_pays_label} (prime ${r.risque_pays_prime}%)`);
  }

  if (ctx.countryData) {
    const c = ctx.countryData;
    parts.push(`══ DONNÉES MACRO PAYS (${c.pays}, source: ${c.source}) ══
PIB: ${c.pib_usd_millions} M USD | Croissance: ${c.croissance_pib_pct}% | Inflation: ${c.inflation_pct}%
Devise: ${c.devise} | Cadre: ${c.cadre_comptable}
IS: ${c.taux_is}% | TVA: ${c.taux_tva}% | Cotis. sociales: ${c.cotisations_sociales_pct}%
SMIG: ${c.salaire_minimum?.toLocaleString('fr-FR')} ${c.devise}/mois
Salaire dirigeant PME: ${c.salaire_dirigeant_pme_min?.toLocaleString('fr-FR')}-${c.salaire_dirigeant_pme_max?.toLocaleString('fr-FR')} ${c.devise}/mois
Taux emprunt PME: ${c.taux_emprunt_pme}% | Accès crédit: ${c.acces_credit_pme_pct}%`);

    // Charges sociales détaillées
    if (c.charges_sociales_detail) {
      const cs = c.charges_sociales_detail;
      let csBlock = `══ CHARGES SOCIALES DÉTAILLÉES (${c.pays}) ══\nPatronal total: ${cs.total_patronal || c.cotisations_sociales_pct}%\nSalarial total: ${cs.total_salarial || 0}%\nBase: ${cs.base || 'Salaire brut'}`;
      if (cs.cnps_patronal) csBlock += `\nCNPS patronal: ${cs.cnps_patronal.taux}% (${cs.cnps_patronal.detail})`;
      if (cs.cnps_salarial) csBlock += `\nCNPS salarial: ${cs.cnps_salarial.taux}% (${cs.cnps_salarial.detail})`;
      if (cs.fdfp) csBlock += `\nFDFP: ${cs.fdfp.taux}% (${cs.fdfp.detail})`;
      csBlock += `\n⚠️ Utiliser ces taux pour calculer le coût RÉEL d'un employé = brut × (1 + patronal)`;
      parts.push(csBlock);
    }

    // Fiscalité détaillée
    if (c.fiscalite_detail) {
      const f = c.fiscalite_detail;
      let fBlock = `══ FISCALITÉ DÉTAILLÉE (${c.pays}) ══\nIS standard: ${f.is_standard}%`;
      if (f.is_pme) fBlock += ` | IS PME: ${f.is_pme}% (seuil CA < ${f.seuil_pme_ca?.toLocaleString('fr-FR') || 'N/A'})`;
      fBlock += `\nTVA standard: ${f.tva_standard}%`;
      if (f.tva_reduit) fBlock += ` | TVA réduit: ${f.tva_reduit}%`;
      if (f.minimum_fiscal) fBlock += `\nMinimum fiscal: ${f.minimum_fiscal}`;
      if (f.patente) fBlock += `\nPatente: ${f.patente}`;
      if (f.retenue_source) fBlock += `\nRetenue source prestataires: ${f.retenue_source}%`;
      fBlock += `\n⚠️ Appliquer le TAUX IS DU PAYS dans les projections (pas 25% par défaut)`;
      parts.push(fBlock);
    }

    // Coûts de référence (OPEX)
    if (c.opex_benchmarks && typeof c.opex_benchmarks === 'object' && Object.keys(c.opex_benchmarks).length > 0) {
      let opexLines = `══ COÛTS DE RÉFÉRENCE (${c.pays}) ══\n`;
      for (const [key, val] of Object.entries(c.opex_benchmarks as Record<string, any>)) {
        if (typeof val === 'object' && val !== null) {
          opexLines += `${key}: ${JSON.stringify(val)}\n`;
        } else {
          opexLines += `${key}: ${val} ${c.devise || ''}\n`;
        }
      }
      opexLines += `⚠️ Utiliser ces coûts pour valider les OPEX de l'entreprise`;
      parts.push(opexLines);
    }

    // Amortissements standard par pays
    if (c.duree_amort_immeubles_ans) {
      parts.push(`══ DURÉES AMORTISSEMENT (${c.pays}, SYSCOHADA) ══
Immeubles: ${c.duree_amort_immeubles_ans} ans | Véhicules: ${c.duree_amort_vehicules_ans} ans
Matériel industriel: ${c.duree_amort_materiel_ans} ans | Mobilier: ${c.duree_amort_mobilier_ans} ans
Informatique: ${c.duree_amort_informatique_ans} ans | Équipement agricole: ${c.duree_amort_equipement_agri_ans} ans
⚠️ Utiliser ces durées pour calculer les dotations aux amortissements des CAPEX`);
    }
  }

  if (ctx.riskFactors?.length) {
    const relevant = ctx.riskFactors.filter(f => 
      !f.secteurs_concernes || f.secteurs_concernes.length === 0
    );
    if (relevant.length) {
      parts.push(`══ RISQUES TERRAIN À VÉRIFIER (${relevant.length} facteurs actifs) ══
${relevant.map(f => `[${f.severity}] ${f.titre}: ${f.description}`).join('\n')}`);
    }
  }

  if (ctx.workspaceData?.length) {
    parts.push(`══ PARAMÈTRES PROPRIÉTAIRES PROGRAMME ══
${ctx.workspaceData.map((w: any) => `${w.type}/${w.cle}: ${JSON.stringify(w.valeur)}`).join('\n')}`);
  }

  if (ctx.aggBenchmarks) {
    const a = ctx.aggBenchmarks;
    parts.push(`══ BENCHMARKS ESONO (${a.nb_entreprises} entreprises analysées, ${a.secteur}/${a.pays}) ══
Marge brute P25/médiane/P75: ${a.marge_brute_p25}/${a.marge_brute_mediane}/${a.marge_brute_p75}%
EBITDA médiane: ${a.marge_ebitda_mediane}% | CA médiane: ${a.ca_mediane?.toLocaleString('fr-FR')}`);
  }

  // Organization knowledge (Couche 1 — docs privés de l'org client)
  if (ctx.orgKnowledge?.length) {
    const orgLines = ctx.orgKnowledge.slice(0, 5).map((doc: any) =>
      `[${doc.category}] ${doc.title}${doc.source ? ` (${doc.source})` : ''}\n${(doc.content || '').slice(0, 1000)}`
    );
    parts.push(`══ RÉFÉRENCES ORGANISATION (documents privés du client) ══\n${orgLines.join('\n---\n')}`);
  }

  // Ressources documentaires knowledge_base (rapports AVCA, UNCTAD, IFC, BAD, FMI, etc.)
  if (ctx.kbDocs?.length) {
    const kbLines = ctx.kbDocs.slice(0, 10).map((doc: any, i: number) => {
      const sourceStr = doc.source ? ` — ${doc.source}` : '';
      const urlStr = doc.metadata?.source_url ? ` | ${doc.metadata.source_url}` : '';
      const pubDate = doc.metadata?.publication_date ? ` (${doc.metadata.publication_date})` : '';
      return `[REF-${i + 1}] ${doc.title}${sourceStr}${pubDate}${urlStr}\n${(doc.content || '').slice(0, 800)}`;
    });
    parts.push(`══ RESSOURCES DOCUMENTAIRES (knowledge_base, ${ctx.kbDocs.length} sources pertinentes) ══
Instruction: lorsque tu utilises un chiffre ou une affirmation issue d'une de ces sources, note-la dans 'sources_consultees' (cf. schéma de sortie).

${kbLines.join('\n---\n')}`);
  }

  return parts.length ? `\n${parts.join('\n\n')}\n` : '';
}
