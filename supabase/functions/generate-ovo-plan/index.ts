/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║  ESONO — Supabase Edge Function : generate-ovo-plan                ║
 * ║  Génère le Plan Financier OVO (.xlsm) depuis les données client    ║
 * ║                                                                      ║
 * ║  Pipeline :                                                          ║
 * ║    1. Reçoit les données entrepreneur (POST JSON)                   ║
 * ║    2. Appelle Claude API → JSON financier structuré                 ║
 * ║    3. Télécharge le template .xlsm depuis Supabase Storage          ║
 * ║    4. Injecte les valeurs cellule par cellule via manipulation ZIP  ║
 * ║    5. Upload le fichier rempli dans Supabase Storage                ║
 * ║    6. Retourne l'URL de téléchargement                              ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 *
 * Deploy : supabase functions deploy generate-ovo-plan
 * Env vars requis :
 *   ANTHROPIC_API_KEY
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

interface CellWrite {
  sheet: string;
  row: number;
  col: number;   // 1-indexé : A=1, B=2, ..., Z=26, AA=27 ...
  value: string | number | null;
  type: "string" | "number" | "date";
}

// ─────────────────────────────────────────────────────────────────────
// CONSTANTES
// ─────────────────────────────────────────────────────────────────────

const TEMPLATE_BUCKET = "ovo-templates";
const TEMPLATE_FILE   = "251022-PlanFinancierOVO-Template5Ans-v0210-EMPTY.xlsm";
const OUTPUT_BUCKET   = "ovo-outputs";

const COL: Record<string, number> = {
  A:1,  B:2,  C:3,  D:4,  E:5,  F:6,  G:7,  H:8,  I:9,  J:10,
  K:11, L:12, M:13, N:14, O:15, P:16, Q:17, R:18, S:19, T:20,
  U:21, V:22, W:23, X:24, Y:25, Z:26,
  AA:27, AB:28, AC:29, AD:30, AE:31, AF:32, AG:33, AH:34,
  AI:35, AJ:36, AK:37, AL:38, AM:39, AN:40, AO:41, AP:42,
  AQ:43, AR:44, AS:45,
};

/** Ligne header RevenueData par slot produit */
const PRODUCT_HEADER: Record<number, number> = {
   1:8,   2:50,  3:92,  4:134, 5:176,
   6:218, 7:260, 8:302, 9:344, 10:386,
  11:428,12:470,13:512,14:554,15:596,
  16:638,17:680,18:722,19:764,20:806,
};

/** Ligne header RevenueData par slot service */
const SERVICE_HEADER: Record<number, number> = {
   1:848,  2:890,  3:932,  4:974,  5:1016,
   6:1058, 7:1100, 8:1142, 9:1184, 10:1226,
};

/** yearLabel → index 0-7 pour les lignes VOLUME */
const YEAR_IDX: Record<string, number> = {
  "YEAR-2":0, "YEAR-1":1, "CURRENT YEAR":2,
  "YEAR2":3, "YEAR3":4, "YEAR4":5, "YEAR5":6, "YEAR6":7,
};

/** Mapping yearLabel → colonne FinanceData (O-X) */
const YEAR_FIN_COL: Record<string, string> = {
  "YEAR-2":"O", "YEAR-1":"P", "H1":"Q", "H2":"R",
  "CURRENT YEAR":"S", "YEAR2":"T", "YEAR3":"U",
  "YEAR4":"V", "YEAR5":"W", "YEAR6":"X",
};

// Mapping feuille nom → fichier XML dans le ZIP
const SHEET_FILES: Record<string, string> = {
  "ReadMe":     "xl/worksheets/sheet1.xml",
  "Instructions":"xl/worksheets/sheet2.xml",
  "InputsData": "xl/worksheets/sheet3.xml",
  "RevenueData":"xl/worksheets/sheet4.xml",
  "FinanceData":"xl/worksheets/sheet7.xml",
};

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

    const data: EntrepreneurData & { enterprise_id?: string; request_id?: string } = await req.json();

    // ── Validation: sécuriser products/services ───────────────────────
    if (!Array.isArray(data.products)) data.products = [];
    if (!Array.isArray(data.services)) data.services = [];

    const enterpriseId = data.enterprise_id;
    const requestId = data.request_id || crypto.randomUUID();

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
          file_url: null, // Clear old file URL to avoid stale downloads
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

    // ── Expand condensed AI output to full per_year format ────────────
    console.log("[generate-ovo-plan] Expanding condensed AI data...");
    expandCondensedData(financialJson);

    // Bug #4: Normalize range data (shift r3/r2 → r1 if only one range used)
    normalizeRangeData(financialJson);

    // Post-expansion validation: fill any remaining zero-volume gaps
    validateAndFillVolumes(financialJson);

    // Bug #7: Sort products/services by slot for consistent ordering
    if (Array.isArray(financialJson.products)) {
      financialJson.products.sort((a: any, b: any) => (a.slot || 0) - (b.slot || 0));
    }
    if (Array.isArray(financialJson.services)) {
      financialJson.services.sort((a: any, b: any) => (a.slot || 0) - (b.slot || 0));
    }

    // ── Étape 2 : Télécharger le template ─────────────────────────────
    console.log("[generate-ovo-plan] Downloading template...");

    let templateBlob: Blob | null = null;
    let dlError: any = null;

    // Bug #6: Try primary template, then fallback path
    ({ data: templateBlob, error: dlError } = await supabase.storage
      .from(TEMPLATE_BUCKET)
      .download(TEMPLATE_FILE));

    if (dlError || !templateBlob) {
      console.warn(`[generate-ovo-plan] Primary template not found: ${dlError?.message}. Trying fallback...`);
      // Try without path prefix
      const fallbackName = TEMPLATE_FILE.split("/").pop() || TEMPLATE_FILE;
      ({ data: templateBlob, error: dlError } = await supabase.storage
        .from(TEMPLATE_BUCKET)
        .download(fallbackName));
    }

    if (dlError || !templateBlob) {
      throw new Error(`Template download failed: ${dlError?.message}. Veuillez uploader le template '${TEMPLATE_FILE}' dans le bucket '${TEMPLATE_BUCKET}'.`);
    }

    const templateBuffer = await templateBlob.arrayBuffer();

    // ── Étape 3 : Construire la liste des cellules à écrire ────────────
    console.log("[generate-ovo-plan] Building cell writes...");
    const cellWrites = buildCellWrites(financialJson);
    console.log(`[generate-ovo-plan] ${cellWrites.length} cells to write`);

    // ── Étape 4 : Injecter les valeurs dans le ZIP ─────────────────────
    console.log("[generate-ovo-plan] Injecting values into Excel...");
    const filledBuffer = await injectIntoXlsm(templateBuffer, cellWrites);

    // ── Étape 5 : Upload vers Supabase Storage ─────────────────────────
    const timestamp = new Date().toISOString().replace(/[:.]/g, "").slice(0, 15);
    const rnd = Math.random().toString(36).substring(2, 8);
    const outputFileName = `PlanFinancier_${sanitize(data.company)}_OVO_${timestamp}_${rnd}.xlsm`;

    console.log(`[generate-ovo-plan] Uploading ${outputFileName}...`);
    const { error: uploadError } = await supabase.storage
      .from(OUTPUT_BUCKET)
      .upload(outputFileName, filledBuffer, {
        contentType: "application/vnd.ms-excel.sheet.macroEnabled.12",
        upsert: false,
        cacheControl: "no-store",
      });

    if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

    const { data: urlData } = await supabase.storage
      .from(OUTPUT_BUCKET)
      .createSignedUrl(outputFileName, 86400); // 24 heures

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
        cells_written: cellWrites.length,
        financial_summary: extractSummary(financialJson),
      }),
      { headers: { ...corsHeaders(), "Content-Type": "application/json" } }
    );

    } catch (innerErr) {
      // ── Track status in deliverables (failed) ─────────────────────────
      if (enterpriseId) {
        await supabase.from("deliverables").upsert(
          {
            enterprise_id: enterpriseId,
            type: "plan_ovo_excel",
            ai_generated: true,
            data: { status: "failed", request_id: requestId, error: String(innerErr), failed_at: new Date().toISOString() },
          },
          { onConflict: "enterprise_id,type" }
        ).catch(() => {}); // best-effort
      }
      throw innerErr; // re-throw to outer catch
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
  const systemPrompt = buildSystemPrompt();
  const userPrompt  = buildUserPrompt(data);

  // Budget-aware retry: Deno edge functions have ~400s wall time.
  // We track elapsed time and only retry if enough budget remains.
  const FUNCTION_START = Date.now();
  const MAX_WALL_MS = 380_000; // conservative 380s (leave 20s buffer)
  const AI_TIMEOUT_MS = 180_000; // 180s per attempt (3 min)
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

    // Don't start an attempt if we can't finish it
    if (remaining < 60_000) {
      console.warn(`[Claude] Only ${Math.round(remaining/1000)}s remaining, skipping attempt ${attempt}`);
      break;
    }

    const timeout = Math.min(AI_TIMEOUT_MS, remaining - 10_000); // leave 10s for post-processing
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

function buildSystemPrompt(): string {
  return `Tu es un expert financier spécialisé dans les PME africaines (Afrique de l'Ouest, zone FCFA/XOF).
Tu génères un plan financier OVO au FORMAT CONDENSÉ pour un entrepreneur.

CONTEXTE FISCAL CÔTE D'IVOIRE (2025) :
- Devise : XOF (FCFA) — taux fixe 655.957 XOF/EUR
- TVA : 18% (0.18)
- IS régime simplifié (revenus ≤ 200M FCFA) : 4% du CA (0.04)
- IS régime réel (revenus > 200M FCFA) : 30% du bénéfice (0.30)
- Cotisations sociales patronales : 16.45% du salaire brut (0.1645)
- Inflation estimée : 3%/an (0.03)
- Charges bancaires : ~1% des revenus (0.01)

RÈGLES DE PROJECTION RÉALISTES :
- Croissance max 30%/an les 3 premières années de prévision, 15-20% ensuite
- Marge brute produits physiques : 30-60% selon secteur
- Marge brute services : 60-85% selon complexité
- Staff : effectif réel uniquement, pas de sur-estimation
- Volumes = entiers (jamais décimaux)
- Montants = FCFA, arrondir à 1000 FCFA près

FORMAT CONDENSÉ OBLIGATOIRE :
- Pour chaque produit/service : donne UNIQUEMENT prix CY, taux COGS, volumes (YM2/YM1/CY), taux de croissance
- Pour le staff : donne headcount par année (8 valeurs) + salaire CY + taux croissance salariale
- Pour l'OPEX : donne le total CY par catégorie + taux de croissance
- NE PAS générer de tableaux per_year détaillés — le code les reconstruit automatiquement
- Chaque produit/service actif DOIT avoir volume_cy > 0

SORTIE OBLIGATOIRE :
- UNIQUEMENT un objet JSON valide — zéro markdown, zéro texte avant/après
- Respecter EXACTEMENT la structure condensée demandée
- Tous montants en XOF (FCFA)`;
}

// ─────────────────────────────────────────────────────────────────────
// SANITIZE STALE PREV PLAN DATA
// ─────────────────────────────────────────────────────────────────────

/**
 * Check if a year-series object has valid future projections (YEAR2..YEAR6).
 * Returns false if 3+ future years are zero/missing → stale data.
 */
function isSeriesValid(series: Record<string, any> | undefined): boolean {
  if (!series || typeof series !== 'object') return false;
  const futureKeys = ['year2', 'year3', 'year4', 'year5', 'year6'];
  const zeroCount = futureKeys.filter(k => !series[k] || Number(series[k]) === 0).length;
  return zeroCount < 3; // valid if at least 3 out of 5 future years have non-zero values
}

/**
 * Sanitize previous plan data: remove "NE PAS MODIFIER" constraint blocks
 * when their values are stale (zeros in future years).
 * Returns a cleaned copy of prevPlan with only trustworthy data.
 */
function sanitizePrevPlan(prevPlan: Record<string, any>): Record<string, any> {
  const clean = { ...prevPlan };
  
  // Remove stale revenue/cogs/ebitda/cashflow series
  for (const key of ['revenue', 'cogs', 'gross_profit', 'ebitda', 'net_profit', 'cashflow']) {
    if (clean[key] && !isSeriesValid(clean[key])) {
      console.warn(`[sanitize] Removing stale ${key} from prev_plan (future years are zeros)`);
      delete clean[key];
    }
  }
  
  // Remove stale opex sub-series
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

  // ── Build enriched context blocks ──
  const hasProducts = (data.products || []).length > 0;
  const hasServices = (data.services || []).length > 0;
  const deducedProducts = (data.products || []).filter(p => p.deduit_du_bmc);
  const deducedServices = (data.services || []).filter(s => s.deduit_du_bmc);

  // ── Extract structured revenue data from framework/plan_ovo ──
  const fw = (data.framework_data || {}) as Record<string, any>;
  const rawPrevPlan = (data.plan_ovo_data || {}) as Record<string, any>;
  const prevPlan = sanitizePrevPlan(rawPrevPlan); // ← sanitize stale data
  const inp = (data.inputs_data || {}) as Record<string, any>;
  const cr = inp.compte_resultat || {};
  const bmc = (data.bmc_data || {}) as Record<string, any>;
  const sic = (data.sic_data || {}) as Record<string, any>;
  const diag = (data.diagnostic_data || {}) as Record<string, any>;

  // ── REVENUS PAR PRODUIT (structured from analyse_marge) ──
  const margeActivites = fw.analyse_marge?.activites || [];
  const totalCA = cr.chiffre_affaires || cr.ca || inp.revenue || data.existing_revenue || 0;
  const bmcFlux = bmc.canvas?.flux_revenus || {};
  const prixMoyen = bmcFlux.prix_moyen || bmcFlux.prix_unitaire || 0;
  const volumeAnnuel = bmcFlux.volume_annuel || bmcFlux.volume_estime || 0;
  const bmcSourcesRevenus = bmcFlux.sources_revenus || bmcFlux.sources || [];
  const bmcModelePricing = bmcFlux.modele_pricing || bmcFlux.modele || '';
  const bmcProduitPrincipal = bmcFlux.produit_principal || bmcFlux.produit || '';

  // ── BMC detailed revenue streams ──
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

  // ── Inputs financiers détaillés ──
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
  // Bilan résumé from inputs
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

  // ── REVENUS HISTORIQUES (from previous plan_ovo) ──
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

  // ── OPEX HISTORIQUES (from previous plan_ovo) ──
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

  // ── CAPEX from previous plan ──
  let capexBlock = "";
  if (Array.isArray(prevPlan.capex) && prevPlan.capex.length > 0) {
    capexBlock = `
CAPEX (du plan financier intermédiaire — à reprendre) :
${prevPlan.capex.map((c: any) => `  - ${c.label || c.type}: ${(c.acquisition_value || 0).toLocaleString('fr-FR')} FCFA, acquis en ${c.acquisition_year}, amort. ${((c.amortisation_rate_pct || c.amortisation_rate || 0.2) * 100).toFixed(0)}%/an`).join("\n")}`;
  }

  // ── STAFF from previous plan ──
  let staffBlock = "";
  if (Array.isArray(prevPlan.staff) && prevPlan.staff.length > 0) {
    staffBlock = `
EFFECTIFS (du plan financier intermédiaire — à reprendre) :
${prevPlan.staff.map((s: any) => `  - ${s.label || s.category}: département ${s.department || 'N/A'}, cotisations ${((s.social_security_rate || 0.1645) * 100).toFixed(1)}%`).join("\n")}`;
  }

  // ── LOANS from previous plan ──
  let loansBlock = "";
  if (prevPlan.loans && typeof prevPlan.loans === 'object') {
    const l = prevPlan.loans;
    loansBlock = `
PRÊTS (du plan financier intermédiaire) :
  - OVO: ${(l.ovo?.amount || 0).toLocaleString('fr-FR')} FCFA à ${((l.ovo?.rate || 0.07) * 100)}% sur ${l.ovo?.term_years || 5} ans
  - Famille: ${(l.family?.amount || 0).toLocaleString('fr-FR')} FCFA à ${((l.family?.rate || 0.10) * 100)}% sur ${l.family?.term_years || 3} ans
  - Banque: ${(l.bank?.amount || 0).toLocaleString('fr-FR')} FCFA à ${((l.bank?.rate || 0.20) * 100)}% sur ${l.bank?.term_years || 2} ans`;
  }

  // ── COGS from previous plan ──
  let cogsBlock = "";
  if (prevPlan.cogs && typeof prevPlan.cogs === 'object') {
    const cogs = prevPlan.cogs;
    cogsBlock = `
COGS / COÛT DES VENTES (NE PAS MODIFIER) :
  YEAR-2: ${(cogs.year_minus_2 || 0).toLocaleString('fr-FR')} → YEAR-1: ${(cogs.year_minus_1 || 0).toLocaleString('fr-FR')} → CY: ${(cogs.current_year || 0).toLocaleString('fr-FR')} → Y2: ${(cogs.year2 || 0).toLocaleString('fr-FR')} → Y3: ${(cogs.year3 || 0).toLocaleString('fr-FR')} → Y4: ${(cogs.year4 || 0).toLocaleString('fr-FR')} → Y5: ${(cogs.year5 || 0).toLocaleString('fr-FR')} → Y6: ${(cogs.year6 || 0).toLocaleString('fr-FR')} FCFA`;
  }

  // ── Framework projections (structured) ──
  let projectionBlock = "";
  if (fw.projection_5ans?.lignes && Array.isArray(fw.projection_5ans.lignes)) {
    projectionBlock = `
PROJECTIONS 5 ANS (Framework — contraintes de cohérence) :
${fw.projection_5ans.lignes.map((l: any) => `  ${l.libelle || l.label}: An1=${l.an1}, An2=${l.an2}, An3=${l.an3}, An4=${l.an4}, An5=${l.an5}`).join("\n")}`;
  }

  // ── Framework KPIs ──
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

  // ── Investment metrics from previous plan ──
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

  // ── SIC block (compacted to save tokens) ──
  let sicBlock = "";
  if (sic && sic.odd_alignment) {
    const oddList = Array.isArray(sic.odd_alignment) ? sic.odd_alignment.map((o: any) => typeof o === 'string' ? o : o.odd || o.name || '').join(', ') : String(sic.odd_alignment);
    sicBlock = `\nIMPACT SOCIAL: ODD alignés: ${oddList}`;
  }

  // ── Diagnostic block (compacted — only score + key metrics) ──
  let diagnosticBlock = "";
  if (diag && Object.keys(diag).length > 0) {
    const score = diag.score || 'N/A';
    const niveau = diag.niveau_maturite || '';
    const synthese = diag.synthese_executive ? diag.synthese_executive.substring(0, 200) : '';
    diagnosticBlock = `\nDIAGNOSTIC: Score=${score}/100, Maturité=${niveau}. ${synthese}`;
  }

  // Format products/services lists with financial data
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

  // ── Smart product instructions ──
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
// EXPANSION DES DONNÉES CONDENSÉES → FORMAT COMPLET per_year
// ─────────────────────────────────────────────────────────────────────

// deno-lint-ignore no-explicit-any
function expandCondensedData(json: Record<string, any>): void {
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

/**
 * Post-expansion validation: scan all active products/services and ensure
 * no future year has zero volumes when CURRENT YEAR has positive volumes.
 */
// deno-lint-ignore no-explicit-any
function validateAndFillVolumes(json: Record<string, any>): void {
  const validate = (items: any[], label: string) => {
    if (!Array.isArray(items)) return;
    for (const item of items) {
      if (!item?.active || !item.per_year || !Array.isArray(item.per_year)) continue;
      const g = item.growth_rate || 0.15;
      item.per_year = repairPerYearVolumes(item.per_year, g);
    }
  };
  validate(json.products || [], "Product");
  validate(json.services || [], "Service");
}

// deno-lint-ignore no-explicit-any
function expandProductOrService(p: any): any {
  const yearLabels = ["YEAR-2","YEAR-1","CURRENT YEAR","YEAR2","YEAR3","YEAR4","YEAR5","YEAR6"];

  // If already has full 8-entry per_year, keep but validate volumes
  if (p.per_year && Array.isArray(p.per_year) && p.per_year.length >= 8) {
    // Still validate: if future years have zero volumes, fill them
    return { ...p, per_year: repairPerYearVolumes(p.per_year, p.growth_rate || 0.15) };
  }

  // If partial per_year (4-7 entries from truncated AI), extrapolate missing years
  if (p.per_year && Array.isArray(p.per_year) && p.per_year.length >= 4 && p.per_year.length < 8) {
    console.log(`[expand] Product "${p.name}": partial per_year (${p.per_year.length}/8), extrapolating...`);
    const existing = p.per_year;
    const lastEntry = existing[existing.length - 1];
    const g = p.growth_rate || 0.15;
    const pg = p.price_growth || 0.03;
    
    while (existing.length < 8) {
      const idx = existing.length;
      const prevEntry = existing[existing.length - 1];
      const totalVol = (prevEntry.volume_h1 || 0) + (prevEntry.volume_h2 || 0);
      const newVol = Math.round(totalVol * (1 + g));
      const newEntry = { ...prevEntry };
      newEntry.year = yearLabels[idx];
      newEntry.volume_h1 = Math.round(newVol * 0.45);
      newEntry.volume_h2 = Math.round(newVol * 0.55);
      // Grow prices
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
      volume_h1:0, volume_h2:0, volume_q3:0, volume_q4:0,
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

  // Channel mix from flags
  const totalCh = (cf[0]||0) + (cf[1]||0) || 1;
  const mixCh1 = (cf[0]||0) / totalCh;
  const mixCh2 = (cf[1]||0) / totalCh;

  const per_year = yearConfigs.map(yc => {
    const price = Math.round(priceCY * yc.pMul / 1000) * 1000;
    const cogs = Math.round(price * cogsRate / 1000) * 1000;
    const vol_h1 = Math.round(yc.volume * 0.45);
    const vol_h2 = Math.round(yc.volume * 0.55);

    return {
      year: yc.year,
      unit_price_r1: rf[0] ? price : 0, unit_price_r2: rf[1] ? price : 0, unit_price_r3: rf[2] ? price : 0,
      mix_r1: rf[0] ? 1.0 : 0, mix_r2: rf[1] ? 1.0 : 0, mix_r3: rf[2] ? 1.0 : 0,
      cogs_r1: rf[0] ? cogs : 0, cogs_r2: rf[1] ? cogs : 0, cogs_r3: rf[2] ? cogs : 0,
      mix_r1_ch1: rf[0] ? mixCh1 : 0, mix_r2_ch1: rf[1] ? mixCh1 : 0, mix_r3_ch1: rf[2] ? mixCh1 : 0,
      mix_r1_ch2: rf[0] ? mixCh2 : 0, mix_r2_ch2: rf[1] ? mixCh2 : 0, mix_r3_ch2: rf[2] ? mixCh2 : 0,
      volume_h1: vol_h1, volume_h2: vol_h2, volume_q3: 0, volume_q4: 0,
    };
  });

  return { ...p, per_year };
}

/**
 * Repair per_year volumes: if active product has zero volumes in future years
 * (YEAR2-YEAR6) while CURRENT YEAR has volumes, extrapolate using growth_rate.
 */
// deno-lint-ignore no-explicit-any
function repairPerYearVolumes(perYear: any[], growthRate: number): any[] {
  if (!perYear || perYear.length < 3) return perYear;
  
  // Find CURRENT YEAR entry (index 2)
  const cyEntry = perYear.find((e: any) => e.year === "CURRENT YEAR") || perYear[2];
  const cyVolume = (cyEntry?.volume_h1 || 0) + (cyEntry?.volume_h2 || 0);
  if (cyVolume === 0) return perYear; // No base volume to extrapolate from
  
  const g = growthRate || 0.15;
  let lastKnownVolume = cyVolume;
  
  // Check YEAR2 through YEAR6 (indices 3-7)
  for (let i = 3; i < perYear.length && i < 8; i++) {
    const entry = perYear[i];
    const vol = (entry.volume_h1 || 0) + (entry.volume_h2 || 0);
    if (vol > 0) {
      lastKnownVolume = vol;
    } else {
      // Zero volume in future year — extrapolate
      const newVol = Math.round(lastKnownVolume * (1 + g));
      entry.volume_h1 = Math.round(newVol * 0.45);
      entry.volume_h2 = Math.round(newVol * 0.55);
      lastKnownVolume = newVol;
      console.warn(`[repairVolumes] Fixed zero volume at ${entry.year}: h1=${entry.volume_h1}, h2=${entry.volume_h2}`);
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

// Default subcategory splits for OPEX categories
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
    // Travel is special
    if (category === 'travel') {
      result.travel = expandTravelOpex(catData);
      continue;
    }

    // If already in expanded format (subcategories have arrays), keep as-is
    if (catData && typeof catData === 'object' && !Array.isArray(catData)) {
      const vals = Object.values(catData as Record<string, unknown>);
      if (vals.length > 0 && Array.isArray(vals[0])) {
        result[category] = catData;
        continue;
      }
    }

    // Condensed format: { total_cy, growth, split? }
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
  if (Array.isArray(travel.nb_travellers)) return travel; // already expanded

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
  const cy = 0; // S column = formula in Excel
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

// ─────────────────────────────────────────────────────────────────────
// BUG #4 FIX : NORMALISATION DES GAMMES DE PRIX
// ─────────────────────────────────────────────────────────────────────

// deno-lint-ignore no-explicit-any
function normalizeRangeData(json: Record<string, any>): void {
  const normalize = (items: any[], label: string) => {
    if (!Array.isArray(items)) return;
    for (const item of items) {
      if (!item?.active || !item.per_year) continue;
      const rf = item.range_flags || [1, 0, 0];
      // If only r3 or r2 is flagged (r1=0), shift everything to r1
      if (rf[0] === 0 && (rf[2] === 1 || rf[1] === 1)) {
        const srcRange = rf[2] === 1 ? 'r3' : 'r2';
        console.log(`[normalize] ${label} "${item.name}": shifting ${srcRange} → r1`);
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
  normalize(json.products || [], "Product");
  normalize(json.services || [], "Service");
}

// ─────────────────────────────────────────────────────────────────────
// ÉTAPE 3 : CONSTRUIRE LA LISTE DES CELLULES À ÉCRIRE
// ─────────────────────────────────────────────────────────────────────

// deno-lint-ignore no-explicit-any
function buildCellWrites(json: Record<string, any>): CellWrite[] {
  const writes: CellWrite[] = [];

  // Helper pour ajouter une cellule
  function w(sheet: string, row: number, col: string, value: string | number | null, type: CellWrite["type"] = "number") {
    if (value === null || value === undefined) return;
    writes.push({ sheet, row, col: COL[col], value, type });
  }

  // Helper pour écrire 10 valeurs dans les colonnes O→X
  // Col S = CURRENT YEAR = formule auto dans FinanceData (ex: Q+R, Q201+R201)
  // Elle est calculée automatiquement par Excel → NE JAMAIS écrire S directement
  function wFinance(sheet: string, row: number, values: number[], skipCols: string[] = []) {
    const cols = ["O","P","Q","R","S","T","U","V","W","X"];
    const skip = new Set(["S", ...skipCols]);
    cols.forEach((col, i) => {
      if (!skip.has(col)) {
        w(sheet, row, col, values[i] ?? 0, "number");
      }
    });
  }

  // ── ReadMe ──────────────────────────────────────────────────────────
  w("ReadMe", 3, "L", "French", "string");

  // ── InputsData Section 1 : Paramètres entreprise ───────────────────
  w("InputsData", 5,  "J", json.company,          "string");
  w("InputsData", 6,  "J", json.country,           "string");
  w("InputsData", 8,  "J", json.currency || "XOF", "string");
  w("InputsData", 9,  "J", json.exchange_rate_eur || 655.957, "number");
  w("InputsData", 10, "J", excelDateSerial(new Date()), "number"); // Date aujourd'hui
  w("InputsData", 12, "J", json.vat_rate || 0.18,        "number");
  w("InputsData", 14, "J", json.inflation_rate || 0.03,  "number");
  w("InputsData", 17, "J", json.tax_regime_1 || 0.04,    "number");
  w("InputsData", 18, "J", json.tax_regime_2 || 0.30,    "number");

  // ── InputsData Section 2 : Années ──────────────────────────────────
  const yrs = json.years || {};
  w("InputsData", 24, "J", yrs.year_minus_2, "number");
  w("InputsData", 25, "J", yrs.year_minus_1, "number");
  w("InputsData", 26, "J", yrs.current_year, "number");
  w("InputsData", 27, "J", yrs.current_year, "number"); // H1
  w("InputsData", 28, "J", yrs.current_year, "number"); // H2
  w("InputsData", 29, "J", yrs.year2, "number");
  w("InputsData", 30, "J", yrs.year3, "number");
  w("InputsData", 31, "J", yrs.year4, "number");
  w("InputsData", 32, "J", yrs.year5, "number");
  w("InputsData", 33, "J", yrs.year6, "number");

  // ── InputsData Section 3 : Gammes ──────────────────────────────────
  (json.ranges || []).forEach((r: { slot: number; name: string; description?: string }) => {
    const row = 69 + r.slot; // slot 1=row70, 2=row71, 3=row72
    w("InputsData", row, "H", r.name,            "string");
    w("InputsData", row, "J", r.description || r.name, "string");
  });

  // ── InputsData Section 3 : Canaux ──────────────────────────────────
  (json.channels || []).forEach((c: { slot: number; name: string; description?: string }) => {
    const row = 74 + c.slot; // slot 1=row75, 2=row76
    w("InputsData", row, "H", c.name,                 "string");
    w("InputsData", row, "J", c.description || c.name, "string");
  });

  // ── InputsData Section 3 : Produits (rows 36-55) ───────────────────
  const products = json.products || [];
  for (let i = 0; i < 20; i++) {
    const row = 36 + i;
    const p = products[i];
    if (p && p.active) {
      w("InputsData", row, "H", p.name,            "string");
      w("InputsData", row, "I", 1,                 "number");
      w("InputsData", row, "J", p.description || p.name, "string");
    } else {
      w("InputsData", row, "H", "-", "string");
      w("InputsData", row, "I", 0,   "number");
    }
  }

  // ── InputsData Section 3 : Services (rows 58-67) ───────────────────
  const services = json.services || [];
  for (let i = 0; i < 10; i++) {
    const row = 58 + i;
    const s = services[i];
    if (s && s.active) {
      w("InputsData", row, "H", s.name,                 "string");
      w("InputsData", row, "I", 1,                      "number");
      w("InputsData", row, "J", s.description || s.name, "string");
    } else {
      w("InputsData", row, "H", "-", "string");
      w("InputsData", row, "I", 0,   "number");
    }
  }

  // ── InputsData Section 4 : Matrice produits × gammes/canaux ─────────
  products.forEach((p: { slot: number; range_flags?: number[]; channel_flags?: number[] }, i: number) => {
    if (i >= 20) return;
    const row = 79 + i;
    const rf = p.range_flags   || [1, 0, 0];
    const cf = p.channel_flags || [0, 1];
    w("InputsData", row, "F", rf[0], "number");
    w("InputsData", row, "G", rf[1], "number");
    w("InputsData", row, "H", rf[2], "number");
    w("InputsData", row, "I", cf[0], "number");
    w("InputsData", row, "J", cf[1], "number");
  });

  services.forEach((s: { slot: number; range_flags?: number[]; channel_flags?: number[] }, i: number) => {
    if (i >= 10) return;
    const row = 101 + i;
    const rf = s.range_flags   || [1, 0, 0];
    const cf = s.channel_flags || [0, 1];
    w("InputsData", row, "F", rf[0], "number");
    w("InputsData", row, "G", rf[1], "number");
    w("InputsData", row, "H", rf[2], "number");
    w("InputsData", row, "I", cf[0], "number");
    w("InputsData", row, "J", cf[1], "number");
  });

  // ── InputsData Section 5 : Staff (rows 113-122) ─────────────────────
  const staffCats = json.staff || [];
  const STAFF_ROWS = [113,114,115,116,117,118,119,120,121,122];
  staffCats.forEach((cat: { category_id: string; occupational_category: string; department: string; social_security_rate: number }, i: number) => {
    if (i >= 10) return;
    const row = STAFF_ROWS[i];
    w("InputsData", row, "H", cat.occupational_category, "string");
    w("InputsData", row, "I", cat.department,             "string");
    w("InputsData", row, "J", cat.social_security_rate || 0.1645, "number");
  });

  // ── InputsData Section 6 : Prêts (paramètres) ──────────────────────
  const fin = json.financing || {};
  if (fin.ovo_schedule) {
    w("InputsData", 125, "I", 0.07,                              "number"); // taux OVO
    w("InputsData", 125, "J", fin.ovo_schedule.duration_years || 5, "number");
  }
  if (fin.family_schedule) {
    w("InputsData", 126, "I", 0.10,                                 "number");
    w("InputsData", 126, "J", fin.family_schedule.duration_years || 3, "number");
  }
  if (fin.bank_schedule) {
    w("InputsData", 127, "I", 0.20,                               "number");
    w("InputsData", 127, "J", fin.bank_schedule.duration_years || 2, "number");
  }

  // ── RevenueData : Volumes produits ──────────────────────────────────
  products.forEach((p: { slot: number; active: boolean; per_year?: Array<Record<string, number>> }, idx: number) => {
    const slot = idx + 1;
    const headerRow = PRODUCT_HEADER[slot];
    if (!headerRow) return;

    const perYear = p.per_year || [];
    const yearLabels = ["YEAR-2","YEAR-1","CURRENT YEAR","YEAR2","YEAR3","YEAR4","YEAR5","YEAR6"];

    yearLabels.forEach((yearLabel, yIdx) => {
      const yr = perYear.find((y: Record<string, unknown>) => y.year === yearLabel) || {};
      const row = headerRow + 1 + yIdx;

      if (!p.active) {
        // Produit inactif : tout à 0
        ["L","M","N","P","Q","R","S","T","U","W","X","Y","Z","AA","AB","AE","AF","AG","AH"]
          .forEach(col => w("RevenueData", row, col, 0, "number"));
        return;
      }

      // Prix unitaire par gamme
      w("RevenueData", row, "L", yr.unit_price_r1 || 0, "number");
      w("RevenueData", row, "M", yr.unit_price_r2 || 0, "number");
      w("RevenueData", row, "N", yr.unit_price_r3 || 0, "number");
      // Mix volume par gamme (somme = 1.0)
      w("RevenueData", row, "P", yr.mix_r1 ?? 1.0, "number");
      w("RevenueData", row, "Q", yr.mix_r2 || 0,   "number");
      w("RevenueData", row, "R", yr.mix_r3 || 0,   "number");
      // COGS unitaire
      w("RevenueData", row, "S", yr.cogs_r1 || 0,  "number");
      w("RevenueData", row, "T", yr.cogs_r2 || 0,  "number");
      w("RevenueData", row, "U", yr.cogs_r3 || 0,  "number");
      // Mix canal
      w("RevenueData", row, "W", yr.mix_r1_ch1 ?? 0, "number");
      w("RevenueData", row, "X", yr.mix_r2_ch1 || 0, "number");
      w("RevenueData", row, "Y", yr.mix_r3_ch1 || 0, "number");
      w("RevenueData", row, "Z", yr.mix_r1_ch2 ?? 1.0, "number");
      w("RevenueData", row, "AA", yr.mix_r2_ch2 || 0, "number");
      w("RevenueData", row, "AB", yr.mix_r3_ch2 || 0, "number");
      // Volumes trimestriels
      w("RevenueData", row, "AE", Math.round(yr.volume_h1 || 0), "number");
      w("RevenueData", row, "AF", Math.round(yr.volume_h2 || 0), "number");
      w("RevenueData", row, "AG", Math.round(yr.volume_q3 || 0), "number");
      w("RevenueData", row, "AH", Math.round(yr.volume_q4 || 0), "number");
    });
  });

  // ── RevenueData : Volumes services ──────────────────────────────────
  services.forEach((s: { slot: number; active: boolean; per_year?: Array<Record<string, number>> }, idx: number) => {
    const slot = idx + 1;
    const headerRow = SERVICE_HEADER[slot];
    if (!headerRow) return;

    const perYear = s.per_year || [];
    const yearLabels = ["YEAR-2","YEAR-1","CURRENT YEAR","YEAR2","YEAR3","YEAR4","YEAR5","YEAR6"];

    yearLabels.forEach((yearLabel, yIdx) => {
      const yr = perYear.find((y: Record<string, unknown>) => y.year === yearLabel) || {};
      const row = headerRow + 1 + yIdx;

      if (!s.active) {
        ["L","M","N","P","Q","R","S","T","U","W","X","Y","Z","AA","AB","AE","AF","AG","AH"]
          .forEach(col => w("RevenueData", row, col, 0, "number"));
        return;
      }

      w("RevenueData", row, "L", yr.unit_price_r1 || 0, "number");
      w("RevenueData", row, "M", yr.unit_price_r2 || 0, "number");
      w("RevenueData", row, "N", yr.unit_price_r3 || 0, "number");
      w("RevenueData", row, "P", yr.mix_r1 ?? 1.0, "number");
      w("RevenueData", row, "Q", yr.mix_r2 || 0,   "number");
      w("RevenueData", row, "R", yr.mix_r3 || 0,   "number");
      w("RevenueData", row, "S", yr.cogs_r1 || 0,  "number");
      w("RevenueData", row, "T", yr.cogs_r2 || 0,  "number");
      w("RevenueData", row, "U", yr.cogs_r3 || 0,  "number");
      w("RevenueData", row, "W", yr.mix_r1_ch1 ?? 0, "number");
      w("RevenueData", row, "X", yr.mix_r2_ch1 || 0, "number");
      w("RevenueData", row, "Y", yr.mix_r3_ch1 || 0, "number");
      w("RevenueData", row, "Z", yr.mix_r1_ch2 ?? 1.0, "number");
      w("RevenueData", row, "AA", yr.mix_r2_ch2 || 0, "number");
      w("RevenueData", row, "AB", yr.mix_r3_ch2 || 0, "number");
      w("RevenueData", row, "AE", Math.round(yr.volume_h1 || 0), "number");
      w("RevenueData", row, "AF", Math.round(yr.volume_h2 || 0), "number");
      w("RevenueData", row, "AG", Math.round(yr.volume_q3 || 0), "number");
      w("RevenueData", row, "AH", Math.round(yr.volume_q4 || 0), "number");
    });
  });

  // ── FinanceData : Staff ──────────────────────────────────────────────
  const STAFF_FIN_ROWS: Record<string, { eft: number; salary: number; allowances: number }> = {
    STAFF_CAT01: { eft:213, salary:214, allowances:215 },
    STAFF_CAT02: { eft:220, salary:221, allowances:222 },
    STAFF_CAT03: { eft:227, salary:228, allowances:229 },
    STAFF_CAT04: { eft:234, salary:235, allowances:236 },
    STAFF_CAT05: { eft:241, salary:242, allowances:243 },
    STAFF_CAT06: { eft:248, salary:249, allowances:250 },
    STAFF_CAT07: { eft:255, salary:256, allowances:257 },
    STAFF_CAT08: { eft:262, salary:263, allowances:264 },
    STAFF_CAT09: { eft:269, salary:270, allowances:271 },
    STAFF_CAT10: { eft:276, salary:277, allowances:278 },
  };

  staffCats.forEach((cat: { category_id: string; per_year: Array<{ year: string; headcount: number; gross_monthly_salary_per_person: number; annual_allowances_per_person: number }> }) => {
    const rows = STAFF_FIN_ROWS[cat.category_id];
    if (!rows) return;
    const perYear = cat.per_year || [];
    const periods = ["YEAR-2","YEAR-1","H1","H2","CURRENT YEAR","YEAR2","YEAR3","YEAR4","YEAR5","YEAR6"];
    const finCols  = ["O","P","Q","R","S","T","U","V","W","X"];

    periods.forEach((period, i) => {
      // Match: "CURRENT YEAR" couvre les 3 periodes H1/H2/CY
      const yr = perYear.find(y =>
        y.year === period ||
        (period === "H1" && y.year === "CURRENT YEAR H1") ||
        (period === "H2" && y.year === "CURRENT YEAR H2") ||
        (["H1","H2","CURRENT YEAR"].includes(period) && y.year === "CURRENT YEAR")
      ) || { headcount:0, gross_monthly_salary_per_person:0, annual_allowances_per_person:0 };

      // Skip col S pour TOUTES les lignes staff (headcount, salary, allowances)
      // S = formule (Q+R)/2 dans le template → auto-calculé depuis H1(Q) + H2(R)
      if (finCols[i] !== "S") {
        w("FinanceData", rows.eft,        finCols[i], Math.round(yr.headcount || 0),                        "number");
        w("FinanceData", rows.salary,     finCols[i], yr.gross_monthly_salary_per_person || 0,              "number");
        w("FinanceData", rows.allowances, finCols[i], yr.annual_allowances_per_person    || 0,              "number");
      }
    });
  });

  // ── FinanceData : OPEX Marketing ────────────────────────────────────
  const opex = json.opex || {};
  const mkt = opex.marketing || {};
  const MARKETING_ROWS: Record<string, number> = {
    research:201, purchase_studies:202, receptions:203, documentation:204, advertising:205
  };
  Object.entries(MARKETING_ROWS).forEach(([key, row]) => {
    wFinance("FinanceData", row, (mkt[key] || new Array(10).fill(0)));
  });

  // ── FinanceData : OPEX Taxes on Staff ───────────────────────────────
  const tax = opex.taxes_on_staff || {};
  wFinance("FinanceData", 283, tax.salaries_tax   || new Array(10).fill(0));
  wFinance("FinanceData", 284, tax.apprenticeship || new Array(10).fill(0));
  wFinance("FinanceData", 285, tax.training        || new Array(10).fill(0));
  wFinance("FinanceData", 286, tax.other           || new Array(10).fill(0));

  // ── FinanceData : OPEX Office ────────────────────────────────────────
  const off = opex.office || {};
  const OFFICE_ROWS: Record<string, number> = {
    rent:294, internet:295, telecom:296, supplies:297,
    fuel:300, water:301, electricity:302, cleaning:303
  };
  Object.entries(OFFICE_ROWS).forEach(([key, row]) => {
    wFinance("FinanceData", row, (off[key] || new Array(10).fill(0)));
  });

  // ── FinanceData : OPEX Other ─────────────────────────────────────────
  const oth = opex.other || {};
  wFinance("FinanceData", 311, oth.health    || new Array(10).fill(0));
  wFinance("FinanceData", 312, oth.directors || new Array(10).fill(0));
  wFinance("FinanceData", 313, oth.donations || new Array(10).fill(0));

  // ── FinanceData : Travel ─────────────────────────────────────────────
  const trv = opex.travel || {};
  wFinance("FinanceData", 322, trv.nb_travellers || new Array(10).fill(0));
  wFinance("FinanceData", 323, trv.avg_cost      || new Array(10).fill(0));

  // ── FinanceData : Insurance ──────────────────────────────────────────
  const ins = opex.insurance || {};
  wFinance("FinanceData", 326, ins.building || new Array(10).fill(0));
  wFinance("FinanceData", 327, ins.company  || new Array(10).fill(0));

  // ── FinanceData : Maintenance ────────────────────────────────────────
  const mnt = opex.maintenance || {};
  wFinance("FinanceData", 335, mnt.movable || new Array(10).fill(0));
  wFinance("FinanceData", 337, mnt.other   || new Array(10).fill(0));

  // ── FinanceData : Third Parties ──────────────────────────────────────
  const trd = opex.third_parties || {};
  const THIRD_ROWS: Record<string, number> = {
    legal:345, accounting:352, transport:348, commissions:350, delivery:349
  };
  Object.entries(THIRD_ROWS).forEach(([key, row]) => {
    wFinance("FinanceData", row, (trd[key] || new Array(10).fill(0)));
  });

  // ── FinanceData : CAPEX ──────────────────────────────────────────────
  const capexItems = json.capex || [];
  const OE_START = 408;
  const OA_START = 462;
  let oeCount = 0, oaCount = 0;

  capexItems.forEach((c: { type: string; acquisition_year: number; acquisition_value: number; amortisation_rate: number }) => {
    let row: number;
    if (c.type === "OFFICE_EQUIPMENT" && oeCount < 40) {
      row = OE_START + oeCount++;
    } else if (c.type === "OTHER_ASSETS" && oaCount < 20) {
      row = OA_START + oaCount++;
    } else return;

    w("FinanceData", row, "K", c.acquisition_year,  "number");
    w("FinanceData", row, "L", c.acquisition_value, "number");
    w("FinanceData", row, "M", c.amortisation_rate, "number");
  });

  // ── FinanceData : Working Capital ────────────────────────────────────
  const wc = json.working_capital || {};
  wFinance("FinanceData", 693, wc.stock_days      || [0,0,45,45,45,45,60,60,60,60]);
  wFinance("FinanceData", 697, wc.receivable_days || [0,0,15,15,15,15,15,15,15,15]);
  wFinance("FinanceData", 701, wc.payable_days    || [0,0,30,30,30,30,30,30,30,30]);

  // ── FinanceData : Cash initial ───────────────────────────────────────
  // ⚠ Seulement col P (col O = None dans le template)
  w("FinanceData", 749, "P", json.opening_cash_year_minus_1 || 0, "number");

  // ── FinanceData : Bank charges ───────────────────────────────────────
  // ⚠ Skip colonnes Q et R (None dans le template)
  const bcRates = json.bank_charges_rate || new Array(10).fill(0.01);
  wFinance("FinanceData", 729, bcRates, ["Q","R"]);

  // ── FinanceData : Sources de financement ────────────────────────────
  const FINANCE_COLS_6 = ["S","T","U","V","W","X"]; // cols S-X = périodes 4-9

  // Montants prêts (cols S-X uniquement, O/P = None)
  if (fin.loan_ovo_by_period) {
    FINANCE_COLS_6.forEach((col, i) => {
      w("FinanceData", 785, col, fin.loan_ovo_by_period[i+4] || 0, "number");
    });
  }
  if (fin.loan_family_by_period) {
    FINANCE_COLS_6.forEach((col, i) => {
      w("FinanceData", 786, col, fin.loan_family_by_period[i+4] || 0, "number");
    });
  }
  if (fin.loan_bank_by_period) {
    FINANCE_COLS_6.forEach((col, i) => {
      w("FinanceData", 787, col, fin.loan_bank_by_period[i+4] || 0, "number");
    });
  }
  // Apports actionnaires existants (cols O-X tous éditables)
  if (fin.existing_shareholders_capital) {
    wFinance("FinanceData", 788, fin.existing_shareholders_capital);
  }
  // Apports nouveaux actionnaires (cols S-X)
  if (fin.new_shareholders_capital) {
    FINANCE_COLS_6.forEach((col, i) => {
      w("FinanceData", 789, col, fin.new_shareholders_capital[i+4] || 0, "number");
    });
  }

  // Calendrier remboursement OVO
  if (fin.ovo_schedule) {
    w("FinanceData", 793, "J", fin.ovo_schedule.duration_years || 5, "number");
    FINANCE_COLS_6.forEach((col, i) => {
      w("FinanceData", 793, col, fin.ovo_schedule.by_period?.[i] ?? 0, "number");
      w("FinanceData", 797, col, fin.ovo_schedule.interest_rate?.[i] ?? 0.07, "number");
    });
  }
  // Famille/amis
  if (fin.family_schedule) {
    w("FinanceData", 802, "J", fin.family_schedule.duration_years || 3, "number");
    FINANCE_COLS_6.forEach((col, i) => {
      w("FinanceData", 802, col, fin.family_schedule.by_period?.[i] ?? 0, "number");
      w("FinanceData", 806, col, fin.family_schedule.interest_rate?.[i] ?? 0.10, "number");
    });
  }
  // Banque locale
  if (fin.bank_schedule) {
    w("FinanceData", 811, "J", fin.bank_schedule.duration_years || 2, "number");
    FINANCE_COLS_6.forEach((col, i) => {
      w("FinanceData", 811, col, fin.bank_schedule.by_period?.[i] ?? 0, "number");
      w("FinanceData", 815, col, fin.bank_schedule.interest_rate?.[i] ?? 0.20, "number");
    });
  }

  return writes;
}

// ─────────────────────────────────────────────────────────────────────
// ÉTAPE 4 : INJECTION DANS LE XLSM (manipulation ZIP/XML)
// ─────────────────────────────────────────────────────────────────────

async function injectIntoXlsm(
  templateBuffer: ArrayBuffer,
  writes: CellWrite[]
): Promise<ArrayBuffer> {

  // Grouper les writes par feuille
  const bySheet: Record<string, CellWrite[]> = {};
  for (const cw of writes) {
    if (!bySheet[cw.sheet]) bySheet[cw.sheet] = [];
    bySheet[cw.sheet].push(cw);
  }

  // Lire le ZIP (retourne données décompressées + données compressées originales)
  const zipResult = await readZip(new Uint8Array(templateBuffer));
  const modifiedFiles = new Set<string>();

  // Modifier chaque feuille concernée
  for (const [sheetName, sheetWrites] of Object.entries(bySheet)) {
    const xmlPath = SHEET_FILES[sheetName];
    if (!xmlPath || !zipResult.entries[xmlPath]) {
      console.warn(`[inject] Sheet ${sheetName} not found at ${xmlPath}`);
      continue;
    }

    let xml = new TextDecoder().decode(zipResult.entries[xmlPath]);
    xml = applyWritesToXml(xml, sheetWrites);
    zipResult.entries[xmlPath] = new TextEncoder().encode(xml);
    modifiedFiles.add(xmlPath);

    console.log(`[inject] ${sheetName}: ${sheetWrites.length} cells updated`);
  }

  // Reconstruire le ZIP (ne recompresse que les fichiers modifiés)
  return await buildZip(zipResult, modifiedFiles);
}

/**
 * Batch XML update: single-pass parsing instead of per-cell regex.
 * O(xml_length + cells) instead of O(cells × xml_length).
 */
function applyWritesToXml(xml: string, writes: CellWrite[]): string {
  // Index writes by "row:col" for O(1) lookup
  const writeMap = new Map<string, CellWrite>();
  const rowsNeeded = new Set<number>();
  for (const cw of writes) {
    if (cw.value === null || cw.value === undefined) continue;
    const cellRef = colNumToLetter(cw.col) + cw.row;
    writeMap.set(cellRef, cw);
    rowsNeeded.add(cw.row);
  }

  if (writeMap.size === 0) return xml;

  // Track which writes were applied (to handle missing rows)
  const applied = new Set<string>();
  // Bug #5: Aggregate formula cell skip count instead of per-cell logging
  let formulaSkipCount = 0;

  // Bug #1: Regex matches BOTH self-closing <c .../> AND regular <c ...>...</c> cells
  const CELL_REGEX = /<c\s+r="([A-Z]+\d+)"([^>]*?)(?:\s*\/>|>([\s\S]*?)<\/c>)/g;

  // Process existing rows — replace matching cells, track applied
  xml = xml.replace(/<row\b([^>]*)>([\s\S]*?)<\/row>/g, (fullMatch, attrs, content) => {
    const rMatch = attrs.match(/r="(\d+)"/);
    if (!rMatch) return fullMatch;
    const rowNum = parseInt(rMatch[1]);

    if (!rowsNeeded.has(rowNum)) return fullMatch;

    // Collect writes for this row
    const rowWrites = new Map<string, CellWrite>();
    for (const [ref, cw] of writeMap) {
      if (cw.row === rowNum) rowWrites.set(ref, cw);
    }
    if (rowWrites.size === 0) return fullMatch;

    // Replace existing cells (handles self-closing and regular cells)
    let newContent = content.replace(
      CELL_REGEX,
      (cellMatch: string, ref: string, _cellAttrs: string, cellContent: string | undefined) => {
        const cw = rowWrites.get(ref);
        if (!cw) return cellMatch;
        // Skip formula cells (only in regular cells with content)
        if (cellContent && cellContent.includes("<f")) {
          formulaSkipCount++;
          applied.add(ref);
          return cellMatch;
        }
        applied.add(ref);
        return buildCellXml(ref, cw);
      }
    );

    // Insert new cells that didn't exist
    for (const [ref, cw] of rowWrites) {
      if (applied.has(ref)) continue;
      applied.add(ref);
      const newCell = buildCellXml(ref, cw);
      newContent = insertCellInRow(newContent, newCell, ref);
    }

    return `<row${attrs}>${newContent}</row>`;
  });

  // Insert entirely new rows for remaining writes
  const remaining = new Map<number, CellWrite[]>();
  for (const [ref, cw] of writeMap) {
    if (applied.has(ref)) continue;
    if (!remaining.has(cw.row)) remaining.set(cw.row, []);
    remaining.get(cw.row)!.push(cw);
  }

  if (remaining.size > 0) {
    const newRows: string[] = [];
    for (const [rowNum, rowWrites] of [...remaining.entries()].sort((a, b) => a[0] - b[0])) {
      const cells = rowWrites
        .sort((a, b) => a.col - b.col)
        .map(cw => buildCellXml(colNumToLetter(cw.col) + cw.row, cw))
        .join("");
      newRows.push(`<row r="${rowNum}">${cells}</row>`);
    }
    xml = xml.replace(/<\/sheetData>/, newRows.join("") + "</sheetData>");
  }

  // Bug #5: Single aggregated log
  if (formulaSkipCount > 0) {
    console.log(`[inject] Skipped ${formulaSkipCount} formula cells (preserved Excel formulas)`);
  }

  return xml;
}

function buildCellXml(ref: string, cw: CellWrite): string {
  if (cw.type === "string") {
    const strValue = String(cw.value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    return `<c r="${ref}" t="inlineStr"><is><t>${strValue}</t></is></c>`;
  }
  const numValue = typeof cw.value === "number" ? cw.value : parseFloat(String(cw.value));
  return `<c r="${ref}"><v>${numValue}</v></c>`;
}

/**
 * Insère une cellule dans le contenu d'une ligne en respectant l'ordre des colonnes.
 * Bug #1 fix: matches both self-closing and regular cells.
 */
function insertCellInRow(rowContent: string, newCell: string, newRef: string): string {
  // Match both <c r="..." ...>...</c> and <c r="..." ... />
  const cells = [...rowContent.matchAll(/<c\s+r="([A-Z]+\d+)"[^>]*?(?:\s*\/>|>[\s\S]*?<\/c>)/gs)];

  if (cells.length === 0) return newCell + rowContent;

  const newColNum = refToColNum(newRef);
  let insertPos = rowContent.length;

  for (const cell of cells) {
    const cellColNum = refToColNum(cell[1]);
    if (cellColNum > newColNum) {
      insertPos = cell.index!;
      break;
    }
  }

  return rowContent.slice(0, insertPos) + newCell + rowContent.slice(insertPos);
}

// ─────────────────────────────────────────────────────────────────────
// UTILITAIRES ZIP (optimisé: conserve les données compressées originales)
// ─────────────────────────────────────────────────────────────────────

interface ZipReadResult {
  entries: Record<string, Uint8Array>;          // décompressées
  originalCompressed: Record<string, {          // compressées originales
    data: Uint8Array;
    crc: number;
    uncompSize: number;
    method: number;
  }>;
}

async function readZip(data: Uint8Array): Promise<ZipReadResult> {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const entries: Record<string, Uint8Array> = {};
  const originalCompressed: ZipReadResult["originalCompressed"] = {};

  // Trouver le End of Central Directory
  let eocdOffset = -1;
  for (let i = data.length - 22; i >= 0; i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }

  if (eocdOffset === -1) throw new Error("Invalid ZIP: EOCD not found");

  const centralDirOffset = view.getUint32(eocdOffset + 16, true);
  const centralDirSize   = view.getUint32(eocdOffset + 12, true);
  let pos = centralDirOffset;

  while (pos < centralDirOffset + centralDirSize) {
    if (view.getUint32(pos, true) !== 0x02014b50) break;

    const compMethod    = view.getUint16(pos + 10, true);
    const crcVal        = view.getUint32(pos + 16, true);
    const compSize      = view.getUint32(pos + 20, true);
    const uncompSize    = view.getUint32(pos + 24, true);
    const fileNameLen   = view.getUint16(pos + 28, true);
    const extraLen      = view.getUint16(pos + 30, true);
    const commentLen    = view.getUint16(pos + 32, true);
    const localOffset   = view.getUint32(pos + 42, true);

    const fileName = new TextDecoder().decode(data.slice(pos + 46, pos + 46 + fileNameLen));
    pos += 46 + fileNameLen + extraLen + commentLen;

    const localView      = new DataView(data.buffer, data.byteOffset + localOffset);
    const localFileNameLen = localView.getUint16(26, true);
    const localExtraLen    = localView.getUint16(28, true);
    const dataStart        = localOffset + 30 + localFileNameLen + localExtraLen;

    const compData = data.slice(dataStart, dataStart + compSize);

    // Store original compressed data for later reuse
    originalCompressed[fileName] = {
      data: compData,
      crc: crcVal,
      uncompSize,
      method: compMethod,
    };

    if (compMethod === 0) {
      entries[fileName] = compData;
    } else if (compMethod === 8) {
      const ds = new DecompressionStream("deflate-raw");
      const writer = ds.writable.getWriter();
      const reader = ds.readable.getReader();

      writer.write(compData);
      writer.close();

      const chunks: Uint8Array[] = [];
      let done = false;
      while (!done) {
        const { value, done: d } = await reader.read();
        if (value) chunks.push(value);
        done = d;
      }

      const result = new Uint8Array(uncompSize);
      let offset = 0;
      for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.length;
      }
      entries[fileName] = result;
    }
  }

  return { entries, originalCompressed };
}

async function buildZip(zipResult: ZipReadResult, modifiedFiles: Set<string>): Promise<ArrayBuffer> {
  const { entries, originalCompressed } = zipResult;
  const parts: Uint8Array[] = [];
  const centralDir: Uint8Array[] = [];
  let offset = 0;

  for (const [name, uncompData] of Object.entries(entries)) {
    const nameBytes = new TextEncoder().encode(name);
    let compData: Uint8Array;
    let crcVal: number;
    let compMethod: number;

    if (modifiedFiles.has(name)) {
      // Modified file: recompress
      const cs = new CompressionStream("deflate-raw");
      const writer = cs.writable.getWriter();
      const reader = cs.readable.getReader();

      writer.write(uncompData);
      writer.close();

      const chunks: Uint8Array[] = [];
      let done = false;
      while (!done) {
        const { value, done: d } = await reader.read();
        if (value) chunks.push(value);
        done = d;
      }

      compData = mergeUint8Arrays(chunks);
      crcVal = crc32(uncompData);
      compMethod = 8;
    } else if (originalCompressed[name]) {
      // Unmodified: reuse original compressed bytes directly
      const orig = originalCompressed[name];
      compData = orig.data;
      crcVal = orig.crc;
      compMethod = orig.method;
    } else {
      // Fallback: compress
      compData = uncompData;
      crcVal = crc32(uncompData);
      compMethod = 0;
    }

    // Local file header
    const localHeader = buildLocalHeader(nameBytes, compData.length, uncompData.length, crcVal, compMethod);
    parts.push(localHeader, nameBytes, compData);

    // Central directory entry
    centralDir.push(buildCentralDirEntry(nameBytes, compData.length, uncompData.length, crcVal, offset, compMethod));

    offset += localHeader.length + nameBytes.length + compData.length;
  }

  const cdData = mergeUint8Arrays(centralDir);
  const eocd   = buildEOCD(centralDir.length, cdData.length, offset);

  const allParts = [...parts, cdData, eocd];
  return mergeUint8Arrays(allParts).buffer;
}

function buildLocalHeader(name: Uint8Array, compSize: number, uncompSize: number, crc: number, method = 8): Uint8Array {
  const buf = new Uint8Array(30);
  const view = new DataView(buf.buffer);
  view.setUint32(0, 0x04034b50, true);
  view.setUint16(4, 20, true);
  view.setUint16(6, 0, true);
  view.setUint16(8, method, true);
  view.setUint16(10, 0, true);
  view.setUint16(12, 0, true);
  view.setUint32(14, crc, true);
  view.setUint32(18, compSize, true);
  view.setUint32(22, uncompSize, true);
  view.setUint16(26, name.length, true);
  view.setUint16(28, 0, true);
  return buf;
}

function buildCentralDirEntry(name: Uint8Array, compSize: number, uncompSize: number, crc: number, localOffset: number, method = 8): Uint8Array {
  const buf = new Uint8Array(46 + name.length);
  const view = new DataView(buf.buffer);
  view.setUint32(0, 0x02014b50, true);
  view.setUint16(4, 20, true);
  view.setUint16(6, 20, true);
  view.setUint16(8, 0, true);
  view.setUint16(10, method, true);
  view.setUint16(12, 0, true);
  view.setUint16(14, 0, true);
  view.setUint32(16, crc, true);
  view.setUint32(20, compSize, true);
  view.setUint32(24, uncompSize, true);
  view.setUint16(28, name.length, true);
  view.setUint16(30, 0, true);
  view.setUint16(32, 0, true);
  view.setUint16(34, 0, true);
  view.setUint16(36, 0, true);
  view.setUint32(38, 0, true);
  view.setUint32(42, localOffset, true);
  buf.set(name, 46);
  return buf;
}

function buildEOCD(numEntries: number, cdSize: number, cdOffset: number): Uint8Array {
  const buf = new Uint8Array(22);
  const view = new DataView(buf.buffer);
  view.setUint32(0, 0x06054b50, true);
  view.setUint16(4, 0, true);
  view.setUint16(6, 0, true);
  view.setUint16(8, numEntries, true);
  view.setUint16(10, numEntries, true);
  view.setUint32(12, cdSize, true);
  view.setUint32(16, cdOffset, true);
  view.setUint16(20, 0, true);
  return buf;
}

// ─────────────────────────────────────────────────────────────────────
// UTILITAIRES DIVERS
// ─────────────────────────────────────────────────────────────────────

function colNumToLetter(n: number): string {
  let result = "";
  while (n > 0) {
    n--;
    result = String.fromCharCode(65 + (n % 26)) + result;
    n = Math.floor(n / 26);
  }
  return result;
}

function refToColNum(ref: string): number {
  const letters = ref.replace(/\d+/g, "");
  let result = 0;
  for (const ch of letters) {
    result = result * 26 + (ch.charCodeAt(0) - 64);
  }
  return result;
}

function excelDateSerial(date: Date): number {
  const epoch = new Date(1899, 11, 30);
  const diff  = date.getTime() - epoch.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function mergeUint8Arrays(arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((sum, a) => sum + a.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

// Module-level cached CRC32 table (computed once)
const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c;
  }
  return table;
})();

function crc32(data: Uint8Array): number {
  let crc = 0xFFFFFFFF;
  for (const byte of data) {
    crc = (crc >>> 8) ^ CRC32_TABLE[(crc ^ byte) & 0xFF];
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function sanitize(str: string): string {
  return str.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 30);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// deno-lint-ignore no-explicit-any
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
