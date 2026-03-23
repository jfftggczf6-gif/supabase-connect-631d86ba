/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║  ESONO — Supabase Edge Function : generate-ovo-plan                ║
 * ║  Génère le Plan Financier OVO (.xlsm) depuis les données client    ║
 * ║                                                                      ║
 * ║  Pipeline :                                                          ║
 * ║    1. Reçoit les données entrepreneur (POST JSON)                   ║
 * ║    2. Appelle Claude API → JSON financier structuré                 ║
 * ║    3. Expand condensed data + scale to targets                      ║
 * ║    4. Envoie au serveur Python pour remplir le template Excel       ║
 * ║    5. Upload le fichier rempli dans Supabase Storage                ║
 * ║    6. Retourne l'URL de téléchargement                              ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 *
 * Deploy : supabase functions deploy generate-ovo-plan
 * Env vars requis :
 *   ANTHROPIC_API_KEY
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   PARSER_URL
 *   PARSER_API_KEY
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sanitize } from "../_shared/zip-utils.ts";
import { expandCondensedData, validateAndFillVolumes, scaleToFrameworkTargets, scaleCOGSToFramework, normalizeRangeData, alignOpexToPlanOvo, alignStaffToTarget, alignTotalOpexToFramework, reconcileWithPlanOvo } from "../_shared/ovo-data-expander.ts";
import { getFiscalParamsForPrompt } from "../_shared/helpers_v5.ts";

// ─────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────

interface EntrepreneurData {
  user_id: string;
  company: string;
  country: string;
  sector: string;
  business_model: string;
  products: Array<{ name: string; description: string; price?: number; deduit_du_bmc?: boolean }>;
  services: Array<{ name: string; description: string; price?: number; deduit_du_bmc?: boolean }>;
  current_year: number;
  employees?: number;
  existing_revenue?: number;
  startup_costs?: number;
  loan_needed?: number;
  bmc_data?: Record<string, unknown>;
  sic_data?: Record<string, unknown>;
  inputs_data?: Record<string, unknown>;
  framework_data?: Record<string, unknown>;
  plan_ovo_data?: Record<string, unknown>;
  diagnostic_data?: Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────────────
// CONSTANTES
// ─────────────────────────────────────────────────────────────────────

const TEMPLATE_BUCKET = "ovo-templates";
const TEMPLATE_FILE   = "251022-PlanFinancierOVO-Template5Ans-v0210-EMPTY.xlsm";
const OUTPUT_BUCKET   = "ovo-outputs";

// ─────────────────────────────────────────────────────────────────────
// HANDLER PRINCIPAL
// ─────────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders() });
  }

  try {
    // ── Auth: vérifier le JWT ──────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ success: false, error: "Non autorisé" }), {
        status: 401, headers: { ...corsHeaders(), "Content-Type": "application/json" },
      });
    }
    const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || "";
    const anonClient = createClient(Deno.env.get("SUPABASE_URL")!, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: { user: authUser }, error: authErr } = await anonClient.auth.getUser(token);
    if (authErr || !authUser) {
      return new Response(JSON.stringify({ success: false, error: "Non autorisé" }), {
        status: 401, headers: { ...corsHeaders(), "Content-Type": "application/json" },
      });
    }

    let data: EntrepreneurData & { enterprise_id?: string; request_id?: string } = await req.json();

    const enterpriseId = data.enterprise_id;
    const requestId = data.request_id || crypto.randomUUID();

    // ── DB-reload mode: if only enterprise_id provided, load from DB ──
    if (enterpriseId && !data.company) {
      console.log(`[generate-ovo-plan] DB-reload mode — loading data from DB for enterprise ${enterpriseId}`);
      const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

      const { data: ent } = await svc.from("enterprises").select("*").eq("id", enterpriseId).single();
      if (!ent) throw new Error("Enterprise not found");

      // Load all relevant deliverables
      const { data: delivs } = await svc.from("deliverables")
        .select("type, data")
        .eq("enterprise_id", enterpriseId)
        .in("type", ["bmc_analysis", "sic_analysis", "inputs_data", "framework_data", "plan_ovo", "diagnostic_data"])
        .order("updated_at", { ascending: false });

      const getDeliv = (t: string) => delivs?.find((d: any) => d.type === t)?.data || undefined;
      const bmcData = getDeliv("bmc_analysis") as any;
      const inputsData = getDeliv("inputs_data") as any;

      // Extract products/services — Priority 1: Inputs (real prices from documents)
      const products: EntrepreneurData["products"] = [];
      const services: EntrepreneurData["services"] = [];

      if (inputsData?.produits_services && Array.isArray(inputsData.produits_services) && inputsData.produits_services.length > 0) {
        for (const p of inputsData.produits_services) {
          const target = (p.type || '').toLowerCase() === 'service' ? services : products;
          target.push({
            name: p.nom || `Produit`,
            description: p.nom || '',
            price: p.prix_unitaire || 0,
          });
        }
        console.log(`[generate-ovo-plan] Loaded ${products.length} products + ${services.length} services from Inputs (real document prices)`);
      }
      // Priority 2: BMC canvas (names only, no prices)
      else if (bmcData?.canvas?.proposition_valeur) {
        const pv = bmcData.canvas.proposition_valeur;
        const items = Array.isArray(pv) ? pv : (pv.items || pv.elements || [pv]);
        items.forEach((item: any, i: number) => {
          const name = typeof item === "string" ? item : (item.name || item.titre || item.label || `Offre ${i + 1}`);
          const desc = typeof item === "string" ? item : (item.description || item.detail || name);
          products.push({ name, description: desc, deduit_du_bmc: true });
        });
      }
      // Fallback: at least one product from enterprise description
      if (products.length === 0 && services.length === 0) {
        products.push({ name: ent.name, description: ent.description || ent.name });
      }

      data = {
        ...data,
        user_id: ent.user_id,
        company: ent.name,
        country: ent.country || "Côte d'Ivoire",
        sector: ent.sector || "Autre",
        business_model: bmcData?.canvas?.modele_revenus?.[0] || "Vente directe",
        products,
        services,
        current_year: ent.base_year || new Date(ent.created_at || Date.now()).getFullYear(),
        employees: ent.employees_count || 1,
        existing_revenue: inputsData?.compte_resultat?.chiffre_affaires ? Number(inputsData.compte_resultat.chiffre_affaires) : 0,
        bmc_data: bmcData,
        sic_data: getDeliv("sic_analysis") as any,
        inputs_data: inputsData,
        framework_data: getDeliv("framework_data") as any,
        plan_ovo_data: getDeliv("plan_ovo") as any,
        diagnostic_data: getDeliv("diagnostic_data") as any,
      };
      console.log(`[generate-ovo-plan] DB-reload: company=${data.company}, products=${data.products.length}, services=${data.services.length}`);
    }

    // ── Validation: sécuriser products/services ───────────────────────
    if (!Array.isArray(data.products)) data.products = [];
    if (!Array.isArray(data.services)) data.services = [];

    console.log(`[generate-ovo-plan] START — user: ${authUser.id}, company: ${data.company}, enterprise: ${enterpriseId}, request: ${requestId}`);
    console.log(`[generate-ovo-plan] products: ${data.products.length}, services: ${data.services.length}`);
    console.log(`[generate-ovo-plan] Extra data: inputs=${!!data.inputs_data}, framework=${!!data.framework_data}, sic=${!!data.sic_data}, diagnostic=${!!data.diagnostic_data}, prev_plan=${!!data.plan_ovo_data}`);

    // ── Init Supabase service client ──────────────────────────────────
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ── Track status in deliverables (processing) ─────────────────────
    if (enterpriseId) {
      await supabase.from("deliverables").upsert(
        {
          enterprise_id: enterpriseId,
          type: "plan_ovo_excel",
          ai_generated: true,
          file_url: null,
          data: { status: "processing", request_id: requestId, started_at: new Date().toISOString(), phase: "init", attempt: 0 },
        },
        { onConflict: "enterprise_id,type" }
      );
    }

    try {
    // ── Étape 1 : Appel Claude API ─────────────────────────────────────
    console.log("[generate-ovo-plan] Calling Claude API...");
    const financialJson = await callClaudeAPI(data, supabase, enterpriseId, requestId);

    // ── Validation post-IA : vérifier products/services ────────────────
    const aiProducts = Array.isArray(financialJson.products) ? financialJson.products.filter((p: any) => p.active !== false) : [];
    const aiServices = Array.isArray(financialJson.services) ? financialJson.services.filter((s: any) => s.active !== false) : [];
    console.log(`[generate-ovo-plan] AI returned ${aiProducts.length} active products, ${aiServices.length} active services`);

    if (aiProducts.length === 0 && aiServices.length === 0) {
      console.error("[generate-ovo-plan] VALIDATION FAILED: AI returned 0 products AND 0 services");
      throw new Error("L'IA n'a généré aucun produit ni service. Veuillez vérifier que les données BMC/inputs contiennent des informations sur vos activités.");
    }

    // ── Étape 2 : Expand condensed AI output to full per_year format ──
    console.log("[generate-ovo-plan] Expanding condensed AI data...");
    expandCondensedData(financialJson);
    normalizeRangeData(financialJson);
    validateAndFillVolumes(financialJson);
    scaleToFrameworkTargets(financialJson, data.framework_data, data.plan_ovo_data, data.inputs_data, data.sector);
    scaleCOGSToFramework(financialJson, data.framework_data);
    alignStaffToTarget(financialJson, data.plan_ovo_data);
    alignOpexToPlanOvo(financialJson, data.plan_ovo_data);
    alignTotalOpexToFramework(financialJson, data.framework_data);
    reconcileWithPlanOvo(financialJson, data.plan_ovo_data);

    // Sort products/services by slot for consistent ordering
    if (Array.isArray(financialJson.products)) {
      financialJson.products.sort((a: any, b: any) => (a.slot || 0) - (b.slot || 0));
    }
    if (Array.isArray(financialJson.services)) {
      financialJson.services.sort((a: any, b: any) => (a.slot || 0) - (b.slot || 0));
    }

    // ── Étape 3 : Générer l'Excel via le serveur Python ───────────────
    console.log("[generate-ovo-plan] Downloading template for Python server...");

    let templateBlob: Blob | null = null;
    let dlError: any = null;

    ({ data: templateBlob, error: dlError } = await supabase.storage
      .from(TEMPLATE_BUCKET)
      .download(TEMPLATE_FILE));

    if (dlError || !templateBlob) {
      console.warn(`[generate-ovo-plan] Primary template not found: ${dlError?.message}. Trying fallback...`);
      const fallbackName = TEMPLATE_FILE.split("/").pop() || TEMPLATE_FILE;
      ({ data: templateBlob, error: dlError } = await supabase.storage
        .from(TEMPLATE_BUCKET)
        .download(fallbackName));
    }

    if (dlError || !templateBlob) {
      throw new Error(`Template download failed: ${dlError?.message}. Veuillez uploader le template '${TEMPLATE_FILE}' dans le bucket '${TEMPLATE_BUCKET}'.`);
    }

    const templateBuffer = await templateBlob.arrayBuffer();
    console.log(`[generate-ovo-plan] Template size: ${templateBuffer.byteLength} bytes`);

    // Encode template as base64
    const templateBytes = new Uint8Array(templateBuffer);
    let templateBase64 = "";
    const CHUNK = 32768;
    for (let i = 0; i < templateBytes.length; i += CHUNK) {
      templateBase64 += String.fromCharCode(...templateBytes.subarray(i, i + CHUNK));
    }
    templateBase64 = btoa(templateBase64);

    // Call Python server
    const PARSER_URL = Deno.env.get("PARSER_URL") || "";
    const PARSER_API_KEY = Deno.env.get("PARSER_API_KEY") || "";

    console.log(`[generate-ovo-plan] === DIAGNOSTIC ===`);
    console.log(`[generate-ovo-plan] PARSER_URL: ${PARSER_URL ? '✅ SET (' + PARSER_URL.substring(0, 30) + '...)' : '❌ MISSING'}`);
    console.log(`[generate-ovo-plan] PARSER_API_KEY: ${PARSER_API_KEY ? '✅ SET' : '❌ MISSING'}`);
    console.log(`[generate-ovo-plan] Template size: ${templateBase64?.length || 0} chars`);

    if (!PARSER_URL) {
      throw new Error("PARSER_URL non configuré. Ajoutez le secret PARSER_URL dans les paramètres Edge Functions.");
    }

    if (!PARSER_API_KEY) {
      throw new Error("PARSER_API_KEY non configuré. Ajoutez le secret PARSER_API_KEY dans les paramètres Edge Functions.");
    }

    // Sanitize: Python server calls .get() on values — ensure no raw lists where dicts expected
    function sanitizeForPython(obj: any): any {
      if (obj === null || obj === undefined) return obj;
      if (Array.isArray(obj)) return obj.map(sanitizeForPython);
      if (typeof obj !== 'object') return obj;
      const result: any = {};
      for (const [k, v] of Object.entries(obj)) {
        // opex sub-categories: Python expects { subKey: [...] } dicts, not raw arrays
        if (k === 'opex' && v && typeof v === 'object' && !Array.isArray(v)) {
          const sanitizedOpex: any = {};
          for (const [cat, catVal] of Object.entries(v as any)) {
            if (Array.isArray(catVal)) {
              // Wrap bare array into { main: [...] }
              console.warn(`[sanitize] opex.${cat} is array — wrapping as {main: [...]}`);
              sanitizedOpex[cat] = { main: catVal };
            } else {
              sanitizedOpex[cat] = sanitizeForPython(catVal);
            }
          }
          result[k] = sanitizedOpex;
        } else {
          result[k] = sanitizeForPython(v);
        }
      }
      return result;
    }

    const sanitizedJson = sanitizeForPython(financialJson);
    console.log(`[generate-ovo-plan] Calling Python server at ${PARSER_URL}/generate-ovo-excel...`);
    const excelResp = await fetch(`${PARSER_URL}/generate-ovo-excel`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PARSER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(180_000), // 3 min timeout
      body: JSON.stringify({
        data: sanitizedJson,
        template_base64: templateBase64,
      }),
    });

    if (!excelResp.ok) {
      const errText = await excelResp.text();
      throw new Error(`Python Excel generation failed: ${excelResp.status} ${errText}`);
    }

    console.log("[generate-ovo-plan] Python server returned Excel successfully");

    // ── Étape 4 : Upload le fichier Excel dans Supabase Storage ───────
    const excelBlob = await excelResp.blob();
    const timestamp = new Date().toISOString().replace(/[:.]/g, "").slice(0, 15);
    const rnd = Math.random().toString(36).substring(2, 8);
    const outputFileName = `PlanFinancier_${sanitize(data.company)}_OVO_${timestamp}_${rnd}.xlsm`;

    console.log(`[generate-ovo-plan] Uploading ${outputFileName} (${excelBlob.size} bytes)...`);
    const { error: uploadError } = await supabase.storage
      .from(OUTPUT_BUCKET)
      .upload(outputFileName, excelBlob, {
        contentType: "application/vnd.ms-excel.sheet.macroEnabled.12",
        upsert: false,
        cacheControl: "no-store",
      });

    if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

    const { data: urlData } = await supabase.storage
      .from(OUTPUT_BUCKET)
      .createSignedUrl(outputFileName, 86400);

    const downloadUrl = urlData?.signedUrl || null;

    // ── Track status in deliverables (completed) ──────────────────────
    if (enterpriseId) {
      await supabase.from("deliverables").upsert(
        {
          enterprise_id: enterpriseId,
          type: "plan_ovo_excel",
          ai_generated: true,
          file_url: downloadUrl,
          data: {
            status: "completed",
            request_id: requestId,
            file_name: outputFileName,
            generated_at: new Date().toISOString(),
            constraint_source: data.plan_ovo_data ? "prev_plan_sanitized" : "framework_fallback",
            phase: "completed",
          },
        },
        { onConflict: "enterprise_id,type" }
      );
    }

    console.log("[generate-ovo-plan] SUCCESS");

    return new Response(
      JSON.stringify({
        success: true,
        file_name: outputFileName,
        download_url: downloadUrl,
        financial_summary: extractSummary(financialJson),
      }),
      { headers: { ...corsHeaders(), "Content-Type": "application/json" } }
    );

    } catch (innerErr) {
      if (enterpriseId) {
        try {
          await supabase.from("deliverables").upsert(
            {
              enterprise_id: enterpriseId,
              type: "plan_ovo_excel",
              ai_generated: true,
              data: { status: "failed", request_id: requestId, error: String(innerErr), failed_at: new Date().toISOString() },
            },
            { onConflict: "enterprise_id,type" }
          );
        } catch (_) { /* best-effort */ }
      }
      throw innerErr;
    }

  } catch (err) {
    console.error("[generate-ovo-plan] ERROR:", err);
    return new Response(
      JSON.stringify({ success: false, error: String(err) }),
      { status: 500, headers: { ...corsHeaders(), "Content-Type": "application/json" } }
    );
  }
});

// ─────────────────────────────────────────────────────────────────────
// ÉTAPE 1 : APPEL CLAUDE API
// ─────────────────────────────────────────────────────────────────────

async function callClaudeAPI(data: EntrepreneurData, supabase?: any, enterpriseId?: string, requestId?: string): Promise<Record<string, unknown>> {
  const systemPrompt = buildSystemPrompt(data.country);
  const userPrompt  = buildUserPrompt(data);

  const FUNCTION_START = Date.now();
  const MAX_WALL_MS = 380_000;
  const AI_TIMEOUT_MS = 180_000;
  const MAX_ATTEMPTS = 2;

  let lastError: Error | null = null;

  const updatePhase = async (phase: string, attempt: number) => {
    if (!supabase || !enterpriseId) return;
    try {
      await supabase.from("deliverables").update({
        data: { status: "processing", request_id: requestId, phase, attempt, last_update_at: new Date().toISOString() },
      }).eq("enterprise_id", enterpriseId).eq("type", "plan_ovo_excel");
    } catch (_) { /* best effort */ }
  };

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const elapsed = Date.now() - FUNCTION_START;
    const remaining = MAX_WALL_MS - elapsed;

    if (remaining < 60_000) {
      console.warn(`[Claude] Only ${Math.round(remaining/1000)}s remaining, skipping attempt ${attempt}`);
      break;
    }

    const timeout = Math.min(AI_TIMEOUT_MS, remaining - 10_000);
    console.log(`[Claude] Attempt ${attempt}/${MAX_ATTEMPTS} — timeout: ${Math.round(timeout/1000)}s, wall remaining: ${Math.round(remaining/1000)}s`);

    await updatePhase("calling_ai", attempt);

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        signal: AbortSignal.timeout(timeout),
        headers: {
          "Content-Type": "application/json",
          "x-api-key": Deno.env.get("ANTHROPIC_API_KEY")!,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 8192,
          system: systemPrompt,
          messages: [{ role: "user", content: userPrompt }],
        }),
      });

      if (!response.ok) {
        throw new Error(`Claude API HTTP ${response.status}: ${await response.text()}`);
      }

      const result = await response.json();
      
      const stopReason = result.stop_reason;
      if (stopReason === "max_tokens") {
        console.warn("[Claude] Response truncated (max_tokens reached), attempting JSON repair...");
      }

      const rawText = result.content
        .filter((b: { type: string }) => b.type === "text")
        .map((b: { text: string }) => b.text)
        .join("");

      let cleaned = rawText
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();

      try {
        return JSON.parse(cleaned);
      } catch (parseErr) {
        if (stopReason === "max_tokens") {
          console.warn("[Claude] Repairing truncated JSON...");
          cleaned = cleaned.replace(/,\s*\{[^}]*$/g, "");
          cleaned = cleaned.replace(/,\s*\[[^\]]*$/g, "");
          cleaned = cleaned.replace(/,\s*"[^"]*"?\s*:?\s*[^}\]]*$/g, "");
          cleaned = cleaned.replace(/,\s*"per_year"\s*:\s*\[[^\]]*$/g, "");
          cleaned = cleaned.replace(/,\s*([}\]])/g, "$1");
          const openBraces = (cleaned.match(/{/g) || []).length;
          const closeBraces = (cleaned.match(/}/g) || []).length;
          const openBrackets = (cleaned.match(/\[/g) || []).length;
          const closeBrackets = (cleaned.match(/]/g) || []).length;
          for (let i = 0; i < openBrackets - closeBrackets; i++) cleaned += "]";
          for (let i = 0; i < openBraces - closeBraces; i++) cleaned += "}";
          const parsed = JSON.parse(cleaned);
          console.log("[Claude] JSON repair successful");
          return parsed;
        }
        throw parseErr;
      }

    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.error(`[Claude] Attempt ${attempt} failed:`, lastError.message);
      if (attempt < MAX_ATTEMPTS) {
        const postElapsed = Date.now() - FUNCTION_START;
        const postRemaining = MAX_WALL_MS - postElapsed;
        if (postRemaining < 60_000) {
          console.warn(`[Claude] Not enough time for retry (${Math.round(postRemaining/1000)}s left)`);
          break;
        }
        await sleep(3000);
      }
    }
  }

  throw new Error(`Claude API failed after attempts: ${lastError?.message}`);
}

// ─────────────────────────────────────────────────────────────────────
// CONSTRUCTION DU PROMPT SYSTÈME
// ─────────────────────────────────────────────────────────────────────

function buildSystemPrompt(country: string): string {
  const fp = getFiscalParamsForPrompt(country);
  const isRegimeInfo = fp.seuil_pme !== 'N/A'
    ? `- IS régime simplifié (revenus ≤ ${fp.seuil_pme}) : ${fp.is_pme}% du CA\n- IS régime réel (revenus > ${fp.seuil_pme}) : ${fp.is_standard}% du bénéfice`
    : `- IS : ${fp.is_standard}% du bénéfice`;

  return `Tu es un expert financier spécialisé dans les PME africaines (focus: ${fp.focus}).
Tu génères un plan financier OVO au FORMAT CONDENSÉ pour un entrepreneur.

CONTEXTE FISCAL ${fp.focus.toUpperCase()} (${new Date().getFullYear()}) :
- Devise : ${fp.currency_iso} (${fp.devise}) — taux ${fp.exchange_rate_eur} ${fp.currency_iso}/EUR
- TVA : ${fp.tva}% (${(fp.tva / 100).toFixed(2)})
${isRegimeInfo}
- Cotisations sociales patronales : ${fp.charges_sociales}% du salaire brut (${(fp.charges_sociales / 100).toFixed(4)})
- Inflation estimée : 3%/an (0.03)
- Charges bancaires : ~1% des revenus (0.01)

CONTRAINTE GÉOGRAPHIQUE ABSOLUE:
- Le pays de l'entreprise est ${fp.focus}. Tous les CAPEX, investissements, locaux DOIVENT concerner UNIQUEMENT ${fp.focus}.
- Ne PAS mentionner d'autres pays africains dans les investissements ou localisations.

RÈGLES DE PROJECTION RÉALISTES :
- Croissance max 30%/an les 3 premières années de prévision, 15-20% ensuite
- Marge brute produits physiques : 30-60% selon secteur
- Marge brute services : 60-85% selon complexité
- Staff : effectif réel uniquement, pas de sur-estimation
- Volumes = entiers (jamais décimaux)
- Montants = ${fp.devise}, arrondir à 1000 ${fp.devise} près

FORMAT CONDENSÉ OBLIGATOIRE :
- Pour chaque produit/service : donne UNIQUEMENT prix CY, taux COGS, volumes (YM2/YM1/CY), taux de croissance
- Pour le staff : donne headcount par année (8 valeurs) + salaire CY + taux croissance salariale
- Pour l'OPEX : donne le total CY par catégorie + taux de croissance
- NE PAS générer de tableaux per_year détaillés — le code les reconstruit automatiquement
- Chaque produit/service actif DOIT avoir volume_cy > 0

SORTIE OBLIGATOIRE :
- UNIQUEMENT un objet JSON valide — zéro markdown, zéro texte avant/après
- Respecter EXACTEMENT la structure condensée demandée
- Tous montants en ${fp.currency_iso} (${fp.devise})`;
}

// ─────────────────────────────────────────────────────────────────────
// SANITIZE STALE PREV PLAN DATA
// ─────────────────────────────────────────────────────────────────────

function isSeriesValid(series: Record<string, any> | undefined): boolean {
  if (!series || typeof series !== 'object') return false;
  const futureKeys = ['year2', 'year3', 'year4', 'year5', 'year6'];
  const zeroCount = futureKeys.filter(k => !series[k] || Number(series[k]) === 0).length;
  return zeroCount < 3;
}

function sanitizePrevPlan(prevPlan: Record<string, any>): Record<string, any> {
  const clean = { ...prevPlan };
  
  for (const key of ['revenue', 'cogs', 'gross_profit', 'ebitda', 'net_profit', 'cashflow']) {
    if (clean[key] && !isSeriesValid(clean[key])) {
      console.warn(`[sanitize] Removing stale ${key} from prev_plan (future years are zeros)`);
      delete clean[key];
    }
  }
  
  if (clean.opex && typeof clean.opex === 'object') {
    const opex = { ...clean.opex };
    let allStale = true;
    for (const [cat, series] of Object.entries(opex)) {
      if (series && typeof series === 'object' && !isSeriesValid(series as Record<string, any>)) {
        console.warn(`[sanitize] Removing stale opex.${cat} from prev_plan`);
        delete opex[cat];
      } else if (series && typeof series === 'object') {
        allStale = false;
      }
    }
    clean.opex = allStale ? undefined : opex;
  }
  
  return clean;
}

// ─────────────────────────────────────────────────────────────────────
// CONSTRUCTION DU PROMPT UTILISATEUR
// ─────────────────────────────────────────────────────────────────────

function buildUserPrompt(data: EntrepreneurData): string {
  const cy = data.current_year || new Date().getFullYear();

  const hasProducts = (data.products || []).length > 0;
  const hasServices = (data.services || []).length > 0;
  const deducedProducts = (data.products || []).filter(p => p.deduit_du_bmc);
  const deducedServices = (data.services || []).filter(s => s.deduit_du_bmc);

  const fw = (data.framework_data || {}) as Record<string, any>;
  const rawPrevPlan = (data.plan_ovo_data || {}) as Record<string, any>;
  const prevPlan = sanitizePrevPlan(rawPrevPlan);
  const inp = (data.inputs_data || {}) as Record<string, any>;
  const cr = inp.compte_resultat || {};
  const bmc = (data.bmc_data || {}) as Record<string, any>;
  const sic = (data.sic_data || {}) as Record<string, any>;
  const diag = (data.diagnostic_data || {}) as Record<string, any>;

  const margeActivites = fw.analyse_marge?.activites || [];
  const totalCA = cr.chiffre_affaires || cr.ca || inp.revenue || data.existing_revenue || 0;
  const bmcFlux = bmc.canvas?.flux_revenus || {};
  const prixMoyen = bmcFlux.prix_moyen || bmcFlux.prix_unitaire || 0;
  const volumeAnnuel = bmcFlux.volume_annuel || bmcFlux.volume_estime || 0;
  const bmcSourcesRevenus = bmcFlux.sources_revenus || bmcFlux.sources || [];
  const bmcModelePricing = bmcFlux.modele_pricing || bmcFlux.modele || '';
  const bmcProduitPrincipal = bmcFlux.produit_principal || bmcFlux.produit || '';

  let bmcRevenueBlock = "";
  if (bmcFlux && Object.keys(bmcFlux).length > 0) {
    const parts = [];
    if (bmcProduitPrincipal) parts.push(`  Produit principal: ${bmcProduitPrincipal}`);
    if (bmcModelePricing) parts.push(`  Modèle pricing: ${bmcModelePricing}`);
    if (prixMoyen > 0) parts.push(`  Prix moyen: ${prixMoyen.toLocaleString('fr-FR')} FCFA`);
    if (volumeAnnuel > 0) parts.push(`  Volume annuel estimé: ${volumeAnnuel.toLocaleString('fr-FR')}`);
    if (Array.isArray(bmcSourcesRevenus) && bmcSourcesRevenus.length > 0) {
      parts.push(`  Sources de revenus: ${bmcSourcesRevenus.map((s: any) => typeof s === 'string' ? s : s.nom || s.name || JSON.stringify(s)).join(', ')}`);
    }
    if (parts.length > 0) {
      bmcRevenueBlock = `\nFLUX DE REVENUS (BMC — utiliser pour déduire prix de vente et volumes) :\n${parts.join('\n')}`;
    }
  }

  let inputsDetailBlock = "";
  if (cr && Object.keys(cr).length > 0) {
    const lines = [];
    if (cr.chiffre_affaires || cr.ca) lines.push(`  Chiffre d'affaires: ${(cr.chiffre_affaires || cr.ca || 0).toLocaleString('fr-FR')} FCFA`);
    if (cr.achats_matieres || cr.achats) lines.push(`  Achats matières: ${(cr.achats_matieres || cr.achats || 0).toLocaleString('fr-FR')} FCFA`);
    if (cr.charges_personnel || cr.salaires) lines.push(`  Charges personnel: ${(cr.charges_personnel || cr.salaires || 0).toLocaleString('fr-FR')} FCFA`);
    if (cr.charges_externes) lines.push(`  Charges externes: ${(cr.charges_externes || 0).toLocaleString('fr-FR')} FCFA`);
    if (cr.dotations_amortissements) lines.push(`  Dotations amortissements: ${(cr.dotations_amortissements || 0).toLocaleString('fr-FR')} FCFA`);
    if (cr.resultat_exploitation) lines.push(`  Résultat exploitation: ${(cr.resultat_exploitation || 0).toLocaleString('fr-FR')} FCFA`);
    if (cr.resultat_net) lines.push(`  Résultat net: ${(cr.resultat_net || 0).toLocaleString('fr-FR')} FCFA`);
    if (lines.length > 0) {
      inputsDetailBlock = `\nCOMPTE DE RÉSULTAT DÉTAILLÉ (Inputs financiers — données réelles à respecter) :\n${lines.join('\n')}`;
    }
  }

  let inputsCoutsBlock = "";
  if (inp.couts_variables && Array.isArray(inp.couts_variables) && inp.couts_variables.length > 0) {
    inputsCoutsBlock += `\nCOÛTS VARIABLES DÉTAILLÉS (source documents — utiliser pour COGS et charges variables) :\n${inp.couts_variables.map((c: any) => `  - ${c.poste}: ${(c.montant_annuel || c.montant_mensuel * 12 || 0).toLocaleString('fr-FR')} FCFA/an`).join('\n')}`;
  }
  if (inp.couts_fixes && Array.isArray(inp.couts_fixes) && inp.couts_fixes.length > 0) {
    inputsCoutsBlock += `\nCOÛTS FIXES DÉTAILLÉS (source documents — utiliser pour OPEX) :\n${inp.couts_fixes.map((c: any) => `  - ${c.poste}: ${(c.montant_annuel || c.montant_mensuel * 12 || 0).toLocaleString('fr-FR')} FCFA/an`).join('\n')}`;
  }

  let inputsEquipeBlock = "";
  if (inp.equipe && Array.isArray(inp.equipe) && inp.equipe.length > 0) {
    inputsEquipeBlock = `\nÉQUIPE DÉTAILLÉE (source documents — utiliser pour STAFF) :\n${inp.equipe.map((e: any) => `  - ${e.poste}: ${e.nombre} pers., salaire ${(e.salaire_mensuel || 0).toLocaleString('fr-FR')} FCFA/mois, charges sociales ${e.charges_sociales_pct || 0}%`).join('\n')}`;
  }

  let inputsBfrBlock = "";
  if (inp.bfr && typeof inp.bfr === 'object') {
    const b = inp.bfr;
    const parts = [];
    if (b.delai_clients_jours > 0) parts.push(`  DSO clients: ${b.delai_clients_jours} jours`);
    if (b.delai_fournisseurs_jours > 0) parts.push(`  DPO fournisseurs: ${b.delai_fournisseurs_jours} jours`);
    if (b.stock_moyen_jours > 0) parts.push(`  Rotation stock: ${b.stock_moyen_jours} jours`);
    if (b.tresorerie_depart > 0) parts.push(`  Trésorerie de départ: ${b.tresorerie_depart.toLocaleString('fr-FR')} FCFA`);
    if (parts.length > 0) {
      inputsBfrBlock = `\nBFR / TRÉSORERIE (source documents — utiliser pour working_capital et opening_cash) :\n${parts.join('\n')}`;
    }
  }

  let inputsCapexBlock = "";
  if (inp.investissements && Array.isArray(inp.investissements) && inp.investissements.length > 0) {
    inputsCapexBlock = `\nINVESTISSEMENTS RÉELS (source documents — utiliser pour CAPEX) :\n${inp.investissements.map((inv: any) => `  - ${inv.nature}: ${(inv.montant || 0).toLocaleString('fr-FR')} FCFA, année ${inv.annee_achat || 'N/A'}, amort. ${inv.duree_amortissement_ans || 'N/A'} ans`).join('\n')}`;
  }

  let inputsFinBlock = "";
  if (inp.financement && typeof inp.financement === 'object') {
    const fin = inp.financement;
    const parts = [];
    if (fin.apports_capital > 0) parts.push(`  Capital: ${fin.apports_capital.toLocaleString('fr-FR')} FCFA`);
    if (fin.subventions > 0) parts.push(`  Subventions: ${fin.subventions.toLocaleString('fr-FR')} FCFA`);
    if (fin.prets && Array.isArray(fin.prets) && fin.prets.length > 0) {
      fin.prets.forEach((p: any) => {
        parts.push(`  Prêt ${p.source}: ${(p.montant || 0).toLocaleString('fr-FR')} FCFA à ${p.taux_pct}% sur ${p.duree_mois} mois (différé ${p.differe_mois || 0} mois)`);
      });
    }
    if (parts.length > 0) {
      inputsFinBlock = `\nFINANCEMENT RÉEL (source documents — utiliser pour loans) :\n${parts.join('\n')}`;
    }
  }

  let inputsHypBlock = "";
  if (inp.hypotheses_croissance && typeof inp.hypotheses_croissance === 'object') {
    const hc = inp.hypotheses_croissance;
    const parts = [];
    if (hc.objectifs_ca && Array.isArray(hc.objectifs_ca) && hc.objectifs_ca.length > 0) {
      parts.push(`  Objectifs CA: ${hc.objectifs_ca.map((o: any) => `${o.annee}=${(o.montant || 0).toLocaleString('fr-FR')}`).join(', ')}`);
    }
    if (hc.taux_marge_brute_cible > 0) parts.push(`  Marge brute cible: ${hc.taux_marge_brute_cible}%`);
    if (hc.inflation_annuelle > 0) parts.push(`  Inflation: ${hc.inflation_annuelle}%`);
    if (hc.croissance_volumes_annuelle > 0) parts.push(`  Croissance volumes: ${hc.croissance_volumes_annuelle}%`);
    if (parts.length > 0) {
      inputsHypBlock = `\nHYPOTHÈSES DE CROISSANCE (source documents — ancrer les projections) :\n${parts.join('\n')}`;
    }
  }

  const bilan = inp.bilan || inp.balance_sheet || {};
  let bilanBlock = "";
  if (bilan && Object.keys(bilan).length > 0) {
    const parts = [];
    if (bilan.total_actif) parts.push(`  Total actif: ${bilan.total_actif.toLocaleString('fr-FR')} FCFA`);
    if (bilan.capitaux_propres) parts.push(`  Capitaux propres: ${bilan.capitaux_propres.toLocaleString('fr-FR')} FCFA`);
    if (bilan.dettes) parts.push(`  Dettes: ${bilan.dettes.toLocaleString('fr-FR')} FCFA`);
    if (bilan.tresorerie) parts.push(`  Trésorerie: ${bilan.tresorerie.toLocaleString('fr-FR')} FCFA`);
    if (parts.length > 0) {
      bilanBlock = `\nBILAN RÉSUMÉ (Inputs) :\n${parts.join('\n')}`;
    }
  }

  let revenueByProductBlock = "";
  if (margeActivites.length > 0) {
    revenueByProductBlock = `
REVENUS PAR PRODUIT (DONNÉES RÉELLES — À RESPECTER IMPÉRATIVEMENT) :
${margeActivites.map((a: any, i: number) => {
  const ca = a.ca || 0;
  const pct = totalCA > 0 ? Math.round((ca / totalCA) * 100) : 0;
  const marge = a.marge_brute || a.marge || 0;
  const margePct = ca > 0 ? Math.round((marge / ca) * 100) : (a.marge_pct || 60);
  const estimatedPrice = prixMoyen || (ca > 0 && volumeAnnuel > 0 ? Math.round(ca / volumeAnnuel) : 0);
  const estimatedVolume = estimatedPrice > 0 ? Math.round(ca / estimatedPrice) : 0;
  return `  Produit ${i+1}: ${a.nom || a.name || a.label || `Activité ${i+1}`}
    → CA = ${ca.toLocaleString('fr-FR')} FCFA (${pct}% du CA total)
    → Marge brute = ${marge.toLocaleString('fr-FR')} FCFA (${margePct}%)
    → Prix unitaire estimé = ${estimatedPrice.toLocaleString('fr-FR')} FCFA
    → Volume annuel estimé = ${estimatedVolume.toLocaleString('fr-FR')} unités
    → CALCUL: volume = CA / prix_unitaire, volume_h1 = volume × 0.45, volume_h2 = volume × 0.55`;
}).join("\n")}
  TOTAL CA = ${totalCA.toLocaleString('fr-FR')} FCFA
  ⚠️ La SOMME des CA par produit DOIT correspondre au revenue total par année.`;
  }

  let historicalRevenueBlock = "";
  if (prevPlan.revenue && typeof prevPlan.revenue === 'object') {
    const rev = prevPlan.revenue;
    historicalRevenueBlock = `
REVENUS HISTORIQUES ET PROJETÉS (NE PAS MODIFIER — données du plan financier intermédiaire) :
  YEAR-2 (${cy-2}): ${(rev.year_minus_2 || 0).toLocaleString('fr-FR')} FCFA
  YEAR-1 (${cy-1}): ${(rev.year_minus_1 || 0).toLocaleString('fr-FR')} FCFA
  CURRENT YEAR (${cy}): ${(rev.current_year || 0).toLocaleString('fr-FR')} FCFA
  YEAR2 (${cy+1}): ${(rev.year2 || 0).toLocaleString('fr-FR')} FCFA
  YEAR3 (${cy+2}): ${(rev.year3 || 0).toLocaleString('fr-FR')} FCFA
  YEAR4 (${cy+3}): ${(rev.year4 || 0).toLocaleString('fr-FR')} FCFA
  YEAR5 (${cy+4}): ${(rev.year5 || 0).toLocaleString('fr-FR')} FCFA
  YEAR6 (${cy+5}): ${(rev.year6 || 0).toLocaleString('fr-FR')} FCFA
  ⚠️ Ces revenus sont des CONTRAINTES ABSOLUES. Le total revenue par année dans ton JSON DOIT correspondre.`;
  }

  let opexBlock = "";
  if (prevPlan.opex && typeof prevPlan.opex === 'object') {
    const opex = prevPlan.opex;
    const fmtLine = (label: string, obj: any) => {
      if (!obj || typeof obj !== 'object') return "";
      const vals = [obj.year_minus_2, obj.year_minus_1, obj.current_year, obj.year2, obj.year3, obj.year4, obj.year5, obj.year6]
        .map((v: any) => v != null ? Number(v).toLocaleString('fr-FR') : '0');
      return `  ${label}: ${vals.join(' → ')} FCFA`;
    };
    const lines = [
      fmtLine("Staff salaires", opex.staff_salaries),
      fmtLine("Marketing", opex.marketing),
      fmtLine("Bureaux", opex.office_costs),
      fmtLine("Déplacements", opex.travel),
      fmtLine("Assurances", opex.insurance),
      fmtLine("Maintenance", opex.maintenance),
      fmtLine("Tiers", opex.third_parties),
      fmtLine("Autres", opex.other),
    ].filter(Boolean);
    if (lines.length > 0) {
      opexBlock = `
OPEX HISTORIQUES ET PROJETÉS (NE PAS MODIFIER) :
  (Format: YEAR-2 → YEAR-1 → CY → Y2 → Y3 → Y4 → Y5 → Y6)
${lines.join("\n")}`;
    }
  }

  let capexBlock = "";
  if (Array.isArray(prevPlan.capex) && prevPlan.capex.length > 0) {
    capexBlock = `
CAPEX (du plan financier intermédiaire — à reprendre) :
${prevPlan.capex.map((c: any) => `  - ${c.label || c.type}: ${(c.acquisition_value || 0).toLocaleString('fr-FR')} FCFA, acquis en ${c.acquisition_year}, amort. ${((c.amortisation_rate_pct || c.amortisation_rate || 0.2) * 100).toFixed(0)}%/an`).join("\n")}`;
  }

  let staffBlock = "";
  if (Array.isArray(prevPlan.staff) && prevPlan.staff.length > 0) {
    staffBlock = `
EFFECTIFS (du plan financier intermédiaire — à reprendre) :
${prevPlan.staff.map((s: any) => `  - ${s.label || s.category}: département ${s.department || 'N/A'}, cotisations ${((s.social_security_rate || 0.1645) * 100).toFixed(1)}%`).join("\n")}`;
  }

  let loansBlock = "";
  if (prevPlan.loans && typeof prevPlan.loans === 'object') {
    const l = prevPlan.loans;
    loansBlock = `
PRÊTS (du plan financier intermédiaire) :
  - OVO: ${(l.ovo?.amount || 0).toLocaleString('fr-FR')} FCFA à ${((l.ovo?.rate || 0.07) * 100)}% sur ${l.ovo?.term_years || 5} ans
  - Famille: ${(l.family?.amount || 0).toLocaleString('fr-FR')} FCFA à ${((l.family?.rate || 0.10) * 100)}% sur ${l.family?.term_years || 3} ans
  - Banque: ${(l.bank?.amount || 0).toLocaleString('fr-FR')} FCFA à ${((l.bank?.rate || 0.20) * 100)}% sur ${l.bank?.term_years || 2} ans`;
  }

  let cogsBlock = "";
  if (prevPlan.cogs && typeof prevPlan.cogs === 'object') {
    const cogs = prevPlan.cogs;
    cogsBlock = `
COGS / COÛT DES VENTES (NE PAS MODIFIER) :
  YEAR-2: ${(cogs.year_minus_2 || 0).toLocaleString('fr-FR')} → YEAR-1: ${(cogs.year_minus_1 || 0).toLocaleString('fr-FR')} → CY: ${(cogs.current_year || 0).toLocaleString('fr-FR')} → Y2: ${(cogs.year2 || 0).toLocaleString('fr-FR')} → Y3: ${(cogs.year3 || 0).toLocaleString('fr-FR')} → Y4: ${(cogs.year4 || 0).toLocaleString('fr-FR')} → Y5: ${(cogs.year5 || 0).toLocaleString('fr-FR')} → Y6: ${(cogs.year6 || 0).toLocaleString('fr-FR')} FCFA`;
  }

  let projectionBlock = "";
  if (fw.projection_5ans?.lignes && Array.isArray(fw.projection_5ans.lignes)) {
    projectionBlock = `
PROJECTIONS 5 ANS (Framework — contraintes de cohérence) :
${fw.projection_5ans.lignes.map((l: any) => `  ${l.libelle || l.label}: An1=${l.an1}, An2=${l.an2}, An3=${l.an3}, An4=${l.an4}, An5=${l.an5}`).join("\n")}`;
  }

  let kpisBlock = "";
  if (fw.kpis) {
    kpisBlock = `
KPIs FRAMEWORK :
  - CA année N: ${fw.kpis.ca_annee_n || 'N/A'} FCFA
  - EBITDA: ${fw.kpis.ebitda || 'N/A'} FCFA  
  - Marge brute: ${fw.kpis.marge_brute || 'N/A'}%
  - Trésorerie nette: ${fw.tresorerie_bfr?.tresorerie_nette || 'N/A'} FCFA
  - CAF: ${fw.tresorerie_bfr?.caf || 'N/A'} FCFA
  - DSCR: ${fw.tresorerie_bfr?.dscr || 'N/A'}`;
  }

  let investmentBlock = "";
  if (prevPlan.investment_metrics) {
    const im = prevPlan.investment_metrics;
    investmentBlock = `
MÉTRIQUES D'INVESTISSEMENT (à recalculer de manière cohérente) :
  - VAN précédente: ${(im.van || 0).toLocaleString('fr-FR')} FCFA (taux actualisation ${((im.discount_rate || 0.12) * 100)}%)
  - TRI précédent: ${((im.tri || 0) * 100).toFixed(1)}%
  - CAGR Revenue: ${((im.cagr_revenue || 0) * 100).toFixed(1)}%
  - ROI: ${((im.roi || 0) * 100).toFixed(1)}%
  - Payback: ${im.payback_years || 'N/A'} ans`;
  }

  let sicBlock = "";
  if (sic && sic.odd_alignment) {
    const oddList = Array.isArray(sic.odd_alignment) ? sic.odd_alignment.map((o: any) => typeof o === 'string' ? o : o.odd || o.name || '').join(', ') : String(sic.odd_alignment);
    sicBlock = `\nIMPACT SOCIAL: ODD alignés: ${oddList}`;
  }

  let diagnosticBlock = "";
  if (diag && Object.keys(diag).length > 0) {
    const score = diag.score || 'N/A';
    const niveau = diag.niveau_maturite || '';
    const synthese = diag.synthese_executive ? diag.synthese_executive.substring(0, 200) : '';
    diagnosticBlock = `\nDIAGNOSTIC: Score=${score}/100, Maturité=${niveau}. ${synthese}`;
  }

  const productsList = hasProducts
    ? (data.products || []).map((p, i) => {
        const margeMatch = margeActivites.find((a: any) => 
          (a.nom || a.name || '').toLowerCase().includes((p.name || '').toLowerCase().substring(0, 8)) ||
          (p.name || '').toLowerCase().includes((a.nom || a.name || '').toLowerCase().substring(0, 8))
        );
        const caInfo = margeMatch ? ` — CA réel: ${(margeMatch.ca || 0).toLocaleString('fr-FR')} FCFA, marge: ${(margeMatch.marge_brute || 0).toLocaleString('fr-FR')} FCFA` : "";
        return `  ${i+1}. ${p.name} — ${p.description}${p.price ? ` — Prix: ${p.price} FCFA` : ""}${caInfo}${p.deduit_du_bmc ? " [DÉDUIT DU BMC]" : ""}`;
      }).join("\n")
    : "  Aucun produit fourni explicitement.";

  const servicesList = hasServices
    ? (data.services || []).map((s, i) => `  ${i+1}. ${s.name} — ${s.description}${s.price ? ` — Prix: ${s.price} FCFA` : ""}${s.deduit_du_bmc ? " [DÉDUIT DU BMC]" : ""}`).join("\n")
    : "  Aucun service fourni explicitement.";

  const productInstructions = hasProducts
    ? `1. Utilise les ${data.products.length} produits fournis${deducedProducts.length > 0 ? ` (dont ${deducedProducts.length} déduits du BMC — enrichis-les avec des noms commerciaux et prix réalistes)` : ""}`
    : `1. DÉDUIS au moins 1 produit depuis les données ci-dessus — ne laisse JAMAIS les produits vides`;

  const serviceInstructions = hasServices
    ? `2. Utilise les ${data.services.length} services fournis${deducedServices.length > 0 ? ` (dont ${deducedServices.length} déduits du BMC)` : ""}`
    : `2. DÉDUIS au moins 1 service depuis les données ci-dessus — ne laisse JAMAIS les services vides`;

  return `Génère le plan financier OVO pour cette entreprise :

ENTREPRISE :
- Nom : ${data.company}
- Pays : ${data.country}
- Secteur : ${data.sector}
- Modèle : ${data.business_model}
- Année courante : ${cy}
- Employés actuels : ${data.employees || 0}
- CA actuel estimé : ${totalCA > 0 ? totalCA.toLocaleString('fr-FR') : (data.existing_revenue || 0)} FCFA
${prixMoyen > 0 ? `- Prix moyen unitaire (BMC) : ${prixMoyen.toLocaleString('fr-FR')} FCFA` : ""}
${volumeAnnuel > 0 ? `- Volume annuel estimé (BMC) : ${volumeAnnuel.toLocaleString('fr-FR')} unités` : ""}

PRODUITS (${(data.products || []).length}) :
${productsList}

SERVICES (${(data.services || []).length}) :
${servicesList}
${bmcRevenueBlock}
${revenueByProductBlock}
${inputsDetailBlock}
${inputsCoutsBlock}
${inputsEquipeBlock}
${inputsBfrBlock}
${inputsCapexBlock}
${inputsFinBlock}
${inputsHypBlock}
${bilanBlock}
${historicalRevenueBlock}
${cogsBlock}
${opexBlock}
${staffBlock}
${capexBlock}
${loansBlock}
${projectionBlock}
${kpisBlock}
${investmentBlock}
${sicBlock}
${diagnosticBlock}

BESOINS FINANCIERS :
- Investissements démarrage : ${data.startup_costs || 0} FCFA
- Prêt OVO souhaité : ${data.loan_needed || 0} FCFA

INSTRUCTIONS CRITIQUES :
${productInstructions}
${serviceInstructions}
3. Au minimum 1 catégorie de staff (STAFF_CAT01)
4. CAPEX réaliste pour les immobilisations nécessaires
5. Scénario : TYPICAL_CASE
6. CHAQUE produit/service actif DOIT avoir volume_cy > 0

HIÉRARCHIE DES PRIX (OBLIGATOIRE — respecter cet ordre) :
1. Si un prix réel est fourni par les Inputs (source: documents) → l'utiliser EXACTEMENT tel quel. Ne l'arrondir PAS, ne le modifier PAS.
2. Si pas de prix réel → estimer via les benchmarks sectoriels du pays/secteur (ex: BTP marge brute 20-35% → coût ≈ 65-80% du prix, restauration 35-50%, etc.)
3. En dernier recours → dériver mathématiquement : price_cy = CA_total_produit / volume_cy_produit
4. JAMAIS de valeur fixe arbitraire (pas de "500 FCFA par défaut", pas de prix rond inventé)
- Un produit avec price_cy = 0 génère ZÉRO revenu dans l'Excel — c'est une erreur bloquante.

CONTRAINTE CRITIQUE VOLUMES :
- CHAQUE produit/service actif DOIT avoir des volumes > 0 pour les 8 années (YEAR-2 à YEAR6).
- Ne JAMAIS laisser les volumes à zéro après l'année courante.
- Utilise le growth_rate pour projeter les volumes sur TOUTES les années futures.
- Si l'entreprise est récente, YEAR-2 et YEAR-1 peuvent être zéro, mais CURRENT YEAR et YEAR2-YEAR6 DOIVENT avoir des volumes positifs.

CONTRAINTES DE COHÉRENCE :
- Les revenus historiques ci-dessus sont des DONNÉES RÉELLES — volume_cy × price_cy DOIT correspondre au CA
- Répartis le CA total entre les produits selon les % indiqués dans REVENUS PAR PRODUIT
- YEAR-2 et YEAR-1 ne sont PAS zéro si l'entreprise a un historique
- Les OPEX, CAPEX et STAFF doivent être cohérents avec les données du plan intermédiaire ci-dessus

JSON SCHEMA CONDENSÉ ATTENDU :
{
  "company": "string",
  "country": "string (en anglais)",
  "currency": "XOF",
  "exchange_rate_eur": 655.957,
  "vat_rate": 0.18,
  "inflation_rate": 0.03,
  "tax_regime_1": 0.04,
  "tax_regime_2": 0.30,
  "years": {
    "year_minus_2": ${cy-2}, "year_minus_1": ${cy-1}, "current_year": ${cy},
    "year2": ${cy+1}, "year3": ${cy+2}, "year4": ${cy+3}, "year5": ${cy+4}, "year6": ${cy+5}
  },
  "ranges": [
    {"slot": 1, "name": "LOW END"}, {"slot": 2, "name": "MEDIUM END"}, {"slot": 3, "name": "HIGH END"}
  ],
  "channels": [
    {"slot": 1, "name": "B2B"}, {"slot": 2, "name": "B2C"}
  ],
  "products": [
    {
      "slot": 1, "name": "Nom produit", "active": true, "description": "...",
      "range_flags": [1, 0, 0], "channel_flags": [0, 1],
      "price_cy": 12000, "cogs_rate": 0.35,
      "volume_ym2": 0, "volume_ym1": 0, "volume_cy": 5000,
      "growth_rate": 0.20, "price_growth": 0.03
    }
  ],
  "services": [ /* même structure condensée que products */ ],
  "staff": [
    {
      "category_id": "STAFF_CAT01", "occupational_category": "EMPLOYE(E)S",
      "department": "DIRECTION", "social_security_rate": 0.1645,
      "headcount_by_year": [0, 1, 2, 2, 3, 3, 4, 4],
      "monthly_salary_cy": 400000, "salary_growth": 0.05,
      "annual_allowances_cy": 50000
    }
  ],
  "capex": [
    {"type": "OFFICE_EQUIPMENT", "slot": 1, "label": "Ordinateurs", "acquisition_year": ${cy}, "acquisition_value": 500000, "amortisation_rate": 0.333}
  ],
  "opex": {
    "marketing": {"total_cy": 1500000, "growth": 0.10},
    "taxes_on_staff": {"total_cy": 200000, "growth": 0.05},
    "office": {"total_cy": 800000, "growth": 0.05},
    "other": {"total_cy": 100000, "growth": 0.03},
    "travel": {"nb_travellers_cy": 3, "avg_cost_cy": 200000, "growth": 0.05},
    "insurance": {"total_cy": 300000, "growth": 0.03},
    "maintenance": {"total_cy": 200000, "growth": 0.05},
    "third_parties": {"total_cy": 600000, "growth": 0.08}
  },
  "working_capital": {
    "stock_days": [0, 0, 45, 45, 45, 45, 60, 60, 60, 60],
    "receivable_days": [0, 0, 15, 15, 15, 15, 15, 15, 15, 15],
    "payable_days": [0, 0, 30, 30, 30, 30, 30, 30, 30, 30]
  },
  "opening_cash_year_minus_1": 0,
  "bank_charges_rate": [0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01],
  "financing": {
    "loan_ovo_by_period": [0, 0, 0, 0, 0, ${data.loan_needed || 0}, 0, 0, 0, 0],
    "loan_family_by_period": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    "loan_bank_by_period": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    "existing_shareholders_capital": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    "new_shareholders_capital": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    "ovo_schedule": {"duration_years": 5, "by_period": [0, 0, 0, 1, 1, 1], "interest_rate": [0.07, 0.07, 0.07, 0.07, 0.07, 0.07]},
    "family_schedule": {"duration_years": 3, "by_period": [0, 0, 0, 0, 0, 0], "interest_rate": [0.10, 0.10, 0.10, 0.10, 0.10, 0.10]},
    "bank_schedule": {"duration_years": 2, "by_period": [0, 0, 0, 0, 0, 0], "interest_rate": [0.20, 0.20, 0.20, 0.20, 0.20, 0.20]}
  },
  "simulation_scenario": "TYPICAL_CASE",
  "key_assumptions": ["Croissance annuelle 20-25%", "Marché local prioritaire"]
}`;
}

// ─────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function extractSummary(json: Record<string, any>) {
  return {
    company:        json.company,
    active_products: (json.products || []).filter((p: { active: boolean }) => p.active).length,
    active_services: (json.services || []).filter((s: { active: boolean }) => s.active).length,
    scenario:        json.simulation_scenario,
    years:           json.years,
  };
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin":  "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  };
}
