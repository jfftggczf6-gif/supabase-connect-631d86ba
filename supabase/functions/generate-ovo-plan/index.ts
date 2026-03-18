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
import { type CellWrite, injectIntoXlsm, excelDateSerial, sanitize } from "../_shared/zip-utils.ts";
import { expandCondensedData, validateAndFillVolumes, scaleToFrameworkTargets, scaleCOGSToFramework, normalizeRangeData, alignOpexToPlanOvo, alignStaffToTarget, alignTotalOpexToFramework, verifyExcelRevenue, getTotalVolume, reconcileWithPlanOvo } from "../_shared/ovo-data-expander.ts";
import { getFiscalParamsForPrompt } from "../_shared/helpers.ts";
// enforceFrameworkConstraints removed — alignments handled by dedicated functions

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

// CellWrite type imported from ../shared/zip-utils.ts
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
        // C6: use base_year frozen at enterprise creation, not current date
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

    // Scale volumes to align Excel revenues with Framework/plan_ovo targets
    scaleToFrameworkTargets(financialJson, data.framework_data, data.plan_ovo_data, data.inputs_data, data.sector);

    // Scale product COGS to match Framework gross margin (aligns Excel margin with Plan OVO viewer)
    scaleCOGSToFramework(financialJson, data.framework_data);

    // Align staff costs with plan_ovo staff_salaries
    alignStaffToTarget(financialJson, data.plan_ovo_data);

    // Fix #4: Align OPEX sub-categories with plan_ovo aggregates (with mapping table)
    alignOpexToPlanOvo(financialJson, data.plan_ovo_data);

    // Align total OPEX with Framework-implied OPEX (Marge Brute - EBITDA)
    alignTotalOpexToFramework(financialJson, data.framework_data);

    // ── Final reconciliation: force Excel totals to match plan_ovo exactly ──
    reconcileWithPlanOvo(financialJson, data.plan_ovo_data);

    // [Removed] enforceFrameworkConstraints block — all alignments handled above
    // plus final reconciliation ensures Excel ↔ Plan OVO ↔ Framework consistency.

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
      const fallbackName = TEMPLATE_FILE.split("/").pop() || TEMPLATE_FILE;
      ({ data: templateBlob, error: dlError } = await supabase.storage
        .from(TEMPLATE_BUCKET)
        .download(fallbackName));
    }

    // Auto-upload from public templates if not found in storage
    if (dlError || !templateBlob) {
      console.warn(`[generate-ovo-plan] Template not in storage, attempting auto-upload from public URL...`);
      const origin = req.headers.get("origin") || req.headers.get("referer") || "";
      const baseUrl = origin ? new URL(origin).origin : "";
      if (baseUrl) {
        const publicUrl = `${baseUrl}/templates/${TEMPLATE_FILE}`;
        console.log(`[generate-ovo-plan] Fetching template from: ${publicUrl}`);
        const fetchResp = await fetch(publicUrl);
        if (fetchResp.ok) {
          const fetchedBuffer = await fetchResp.arrayBuffer();
          console.log(`[generate-ovo-plan] Fetched ${fetchedBuffer.byteLength} bytes, uploading to storage...`);
          await supabase.storage.from(TEMPLATE_BUCKET).upload(TEMPLATE_FILE, fetchedBuffer, {
            contentType: "application/vnd.ms-excel.sheet.macroEnabled.12",
            upsert: true,
          });
          // Re-download to get a proper Blob
          ({ data: templateBlob, error: dlError } = await supabase.storage
            .from(TEMPLATE_BUCKET)
            .download(TEMPLATE_FILE));
        }
      }
    }

    if (dlError || !templateBlob) {
      throw new Error(`Template download failed: ${dlError?.message}. Veuillez uploader le template '${TEMPLATE_FILE}' dans le bucket '${TEMPLATE_BUCKET}'.`);
    }

    const templateBuffer = await templateBlob.arrayBuffer();
    console.log(`[generate-ovo-plan] Template size: ${templateBuffer.byteLength} bytes`);

    // Validate that it's actually a ZIP file (XLSM = ZIP)
    if (templateBuffer.byteLength < 100) {
      throw new Error(`Template file is too small (${templateBuffer.byteLength} bytes) — likely not a valid XLSM file.`);
    }
    const headerView = new DataView(templateBuffer);
    const zipMagic = headerView.getUint32(0, true);
    if (zipMagic !== 0x04034b50) {
      const preview = new TextDecoder().decode(new Uint8Array(templateBuffer, 0, Math.min(200, templateBuffer.byteLength)));
      throw new Error(`Template is not a valid ZIP/XLSM file (magic: 0x${zipMagic.toString(16)}). Content preview: ${preview.slice(0, 100)}`);
    }

    // ── Étape 3 : Construire la liste des cellules à écrire ────────────
    console.log("[generate-ovo-plan] Building cell writes...");
    const cellWrites = buildCellWrites(financialJson);
    console.log(`[generate-ovo-plan] ${cellWrites.length} cells to write`);

    // Fix #5: Post-build revenue verification
    const { verified, gaps } = verifyExcelRevenue(financialJson, data.framework_data);
    if (!verified) {
      console.warn(`[generate-ovo-plan] Revenue verification FAILED — gaps: ${JSON.stringify(gaps)}`);
      // If critical gaps (>10%), trigger corrective re-scaling
      const criticalGaps = Object.values(gaps).filter(g => g.ecart > 10);
      if (criticalGaps.length > 0) {
        console.log("[generate-ovo-plan] Critical gaps detected, re-scaling and rebuilding cells...");
        scaleToFrameworkTargets(financialJson, data.framework_data, undefined, data.inputs_data, data.sector);
        const correctedWrites = buildCellWrites(financialJson);
        const { verified: v2 } = verifyExcelRevenue(financialJson, data.framework_data);
        if (v2) {
          console.log("[generate-ovo-plan] Corrective re-scaling successful");
          cellWrites.length = 0;
          cellWrites.push(...correctedWrites);
        } else {
          console.warn("[generate-ovo-plan] Corrective re-scaling still has gaps — proceeding with best effort");
        }
      }
    } else {
      console.log("[generate-ovo-plan] Revenue verification PASSED ✓");
    }

    // Post-build OPEX verification log
    if (data.framework_data?.projection_5ans?.lignes) {
      const fwL = data.framework_data.projection_5ans.lignes;
      const findL = (...pats: string[]) => fwL.find((l: any) => pats.some(p => (l.poste || l.libelle || '').toLowerCase().includes(p)));
      const mbL = findL('marge brute', 'gross margin');
      const ebL = findL('ebitda', 'ebe', 'excédent brut');
      if (mbL && ebL) {
        const fwM: Record<string, string> = { "YEAR2": "an1", "YEAR3": "an2", "YEAR4": "an3", "YEAR5": "an4", "YEAR6": "an5" };
        for (const [yl, fk] of Object.entries(fwM)) {
          const mb = Number(mbL[fk] || 0);
          const eb = Number(ebL[fk] || 0);
          if (mb > 0) {
            const fwOpex = mb - eb;
            console.log(`[generate-ovo-plan] OPEX check ${yl}: Framework-implied OPEX = ${fwOpex} (MB=${mb} - EBITDA=${eb})`);
          }
        }
      }
    }
    // ── Étape 4 : Injecter les valeurs dans le ZIP ─────────────────────
    console.log("[generate-ovo-plan] Injecting values into Excel...");
    const filledBuffer = await injectIntoXlsm(templateBuffer, cellWrites, SHEET_FILES);

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
  const systemPrompt = buildSystemPrompt(data.country);
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

// getFiscalParamsForPrompt imported at top of file
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

  // ── Coûts variables/fixes détaillés from Inputs ──
  let inputsCoutsBlock = "";
  if (inp.couts_variables && Array.isArray(inp.couts_variables) && inp.couts_variables.length > 0) {
    inputsCoutsBlock += `\nCOÛTS VARIABLES DÉTAILLÉS (source documents — utiliser pour COGS et charges variables) :\n${inp.couts_variables.map((c: any) => `  - ${c.poste}: ${(c.montant_annuel || c.montant_mensuel * 12 || 0).toLocaleString('fr-FR')} FCFA/an`).join('\n')}`;
  }
  if (inp.couts_fixes && Array.isArray(inp.couts_fixes) && inp.couts_fixes.length > 0) {
    inputsCoutsBlock += `\nCOÛTS FIXES DÉTAILLÉS (source documents — utiliser pour OPEX) :\n${inp.couts_fixes.map((c: any) => `  - ${c.poste}: ${(c.montant_annuel || c.montant_mensuel * 12 || 0).toLocaleString('fr-FR')} FCFA/an`).join('\n')}`;
  }

  // ── Équipe détaillée from Inputs ──
  let inputsEquipeBlock = "";
  if (inp.equipe && Array.isArray(inp.equipe) && inp.equipe.length > 0) {
    inputsEquipeBlock = `\nÉQUIPE DÉTAILLÉE (source documents — utiliser pour STAFF) :\n${inp.equipe.map((e: any) => `  - ${e.poste}: ${e.nombre} pers., salaire ${(e.salaire_mensuel || 0).toLocaleString('fr-FR')} FCFA/mois, charges sociales ${e.charges_sociales_pct || 0}%`).join('\n')}`;
  }

  // ── BFR from Inputs ──
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

  // ── Investissements from Inputs ──
  let inputsCapexBlock = "";
  if (inp.investissements && Array.isArray(inp.investissements) && inp.investissements.length > 0) {
    inputsCapexBlock = `\nINVESTISSEMENTS RÉELS (source documents — utiliser pour CAPEX) :\n${inp.investissements.map((inv: any) => `  - ${inv.nature}: ${(inv.montant || 0).toLocaleString('fr-FR')} FCFA, année ${inv.annee_achat || 'N/A'}, amort. ${inv.duree_amortissement_ans || 'N/A'} ans`).join('\n')}`;
  }

  // ── Financement from Inputs ──
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

  // ── Hypothèses de croissance from Inputs ──
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

// Data expansion functions moved to ../_shared/ovo-data-expander.ts


// ─────────────────────────────────────────────────────────────────────
// ÉTAPE 3 : CONSTRUIRE LA LISTE DES CELLULES À ÉCRIRE
// ─────────────────────────────────────────────────────────────────────

// deno-lint-ignore no-explicit-any
function buildCellWrites(json: Record<string, any>): CellWrite[] {
  const writes: CellWrite[] = [];

  // Helper pour ajouter une cellule
  function w(sheet: string, row: number, col: string, value: string | number | null, type: CellWrite["type"] = "number", forceWrite = false) {
    if (value === null || value === undefined) return;
    writes.push({ sheet, row, col: COL[col], value, type, forceWrite });
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
        // Produit inactif : tout à 0 (forceWrite to overwrite any formulas)
        ["L","M","N","P","Q","R","S","T","U","W","X","Y","Z","AA","AB","AE","AF","AG","AH"]
          .forEach(col => w("RevenueData", row, col, 0, "number", true));
        return;
      }

      // Prix unitaire par gamme
      w("RevenueData", row, "L", yr.unit_price_r1 || 0, "number", true);
      w("RevenueData", row, "M", yr.unit_price_r2 || 0, "number", true);
      w("RevenueData", row, "N", yr.unit_price_r3 || 0, "number", true);
      // Mix volume par gamme (somme = 1.0)
      w("RevenueData", row, "P", yr.mix_r1 ?? 1.0, "number", true);
      w("RevenueData", row, "Q", yr.mix_r2 || 0,   "number", true);
      w("RevenueData", row, "R", yr.mix_r3 || 0,   "number", true);
      // COGS unitaire
      w("RevenueData", row, "S", yr.cogs_r1 || 0,  "number", true);
      w("RevenueData", row, "T", yr.cogs_r2 || 0,  "number", true);
      w("RevenueData", row, "U", yr.cogs_r3 || 0,  "number", true);
      // Mix canal
      w("RevenueData", row, "W", yr.mix_r1_ch1 ?? 0, "number", true);
      w("RevenueData", row, "X", yr.mix_r2_ch1 || 0, "number", true);
      w("RevenueData", row, "Y", yr.mix_r3_ch1 || 0, "number", true);
      w("RevenueData", row, "Z", yr.mix_r1_ch2 ?? 1.0, "number", true);
      w("RevenueData", row, "AA", yr.mix_r2_ch2 || 0, "number", true);
      w("RevenueData", row, "AB", yr.mix_r3_ch2 || 0, "number", true);
      // Volumes trimestriels (Q1-Q4)
      w("RevenueData", row, "AE", Math.round(yr.volume_q1 || yr.volume_h1 || 0), "number", true);
      w("RevenueData", row, "AF", Math.round(yr.volume_q2 || yr.volume_h2 || 0), "number", true);
      w("RevenueData", row, "AG", Math.round(yr.volume_q3 || 0), "number", true);
      w("RevenueData", row, "AH", Math.round(yr.volume_q4 || 0), "number", true);
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
          .forEach(col => w("RevenueData", row, col, 0, "number", true));
        return;
      }

      w("RevenueData", row, "L", yr.unit_price_r1 || 0, "number", true);
      w("RevenueData", row, "M", yr.unit_price_r2 || 0, "number", true);
      w("RevenueData", row, "N", yr.unit_price_r3 || 0, "number", true);
      w("RevenueData", row, "P", yr.mix_r1 ?? 1.0, "number", true);
      w("RevenueData", row, "Q", yr.mix_r2 || 0,   "number", true);
      w("RevenueData", row, "R", yr.mix_r3 || 0,   "number", true);
      w("RevenueData", row, "S", yr.cogs_r1 || 0,  "number", true);
      w("RevenueData", row, "T", yr.cogs_r2 || 0,  "number", true);
      w("RevenueData", row, "U", yr.cogs_r3 || 0,  "number", true);
      w("RevenueData", row, "W", yr.mix_r1_ch1 ?? 0, "number", true);
      w("RevenueData", row, "X", yr.mix_r2_ch1 || 0, "number", true);
      w("RevenueData", row, "Y", yr.mix_r3_ch1 || 0, "number", true);
      w("RevenueData", row, "Z", yr.mix_r1_ch2 ?? 1.0, "number", true);
      w("RevenueData", row, "AA", yr.mix_r2_ch2 || 0, "number", true);
      w("RevenueData", row, "AB", yr.mix_r3_ch2 || 0, "number", true);
      w("RevenueData", row, "AE", Math.round(yr.volume_q1 || yr.volume_h1 || 0), "number", true);
      w("RevenueData", row, "AF", Math.round(yr.volume_q2 || yr.volume_h2 || 0), "number", true);
      w("RevenueData", row, "AG", Math.round(yr.volume_q3 || 0), "number", true);
      w("RevenueData", row, "AH", Math.round(yr.volume_q4 || 0), "number", true);
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

  capexItems.forEach((c: { type: string; label?: string; acquisition_year: number; acquisition_value: number; amortisation_rate: number }) => {
    let row: number;
    if (c.type === "OFFICE_EQUIPMENT" && oeCount < 40) {
      row = OE_START + oeCount++;
    } else if (c.type === "OTHER_ASSETS" && oaCount < 20) {
      row = OA_START + oaCount++;
    } else return;

    w("FinanceData", row, "J", c.label || "",        "string");
    w("FinanceData", row, "K", c.acquisition_year,   "number");
    w("FinanceData", row, "L", c.acquisition_value,  "number");
    w("FinanceData", row, "M", c.amortisation_rate,  "number");
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

// ZIP/XML injection, utilities, and CRC32 are now in ../_shared/zip-utils.ts

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
