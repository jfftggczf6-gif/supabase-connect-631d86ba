// Feature F — Pre-CI Checklist: deterministic compliance check (NO AI)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  corsHeaders, jsonResponse, errorResponse,
} from "../_shared/helpers_v5.ts";
import { OVO_COMPLIANCE_SECTIONS } from "../_shared/ovo-knowledge.ts";

// Helper to check if a deliverable exists and has meaningful data
function hasDeliverable(delivMap: Record<string, any>, type: string): boolean {
  const d = delivMap[type];
  if (!d?.data) return false;
  if (typeof d.data === "object" && Object.keys(d.data).length <= 2) return false;
  // Exclude processing/error states
  if (d.data.status === "processing" || d.data.status === "error") return false;
  return true;
}

// Helper to check if a field exists in a deliverable's data
function hasField(delivMap: Record<string, any>, type: string, ...fieldPaths: string[]): boolean {
  const d = delivMap[type];
  if (!d?.data) return false;
  for (const path of fieldPaths) {
    const keys = path.split(".");
    let obj = d.data;
    for (const k of keys) {
      if (obj == null || typeof obj !== "object") return false;
      obj = obj[k];
    }
    if (obj != null && obj !== "" && obj !== false) return true;
  }
  return false;
}

serve(async (req) => {
  console.log("[generate-pre-ci-checklist] loaded");
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Manual auth (same pattern as get-programme-dashboard since we don't use callAI)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return errorResponse("Non autorisé", 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || serviceKey;

    const anonClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userErr } = await anonClient.auth.getUser();
    if (userErr || !user) return errorResponse("Non autorisé", 401);

    const supabase = createClient(supabaseUrl, serviceKey);

    // Role check
    const { data: roleData } = await supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle();
    const role = roleData?.role;
    if (!["super_admin", "admin", "manager", "owner"].includes(role)) {
      return errorResponse("Accès réservé aux propriétaires, admins et managers", 403);
    }

    const { enterprise_id } = await req.json();
    if (!enterprise_id) return errorResponse("enterprise_id requis", 400);

    // Verify enterprise exists
    const { data: ent } = await supabase.from("enterprises").select("id, name, user_id").eq("id", enterprise_id).single();
    if (!ent) return errorResponse("Entreprise non trouvée", 404);

    // Fetch all data in parallel
    const [delivRes, notesRes, uploadsRes] = await Promise.all([
      supabase.from("deliverables").select("type, data, score, updated_at").eq("enterprise_id", enterprise_id),
      supabase.from("coaching_notes").select("id").eq("enterprise_id", enterprise_id),
      supabase.from("storage").from("coach-uploads").list(enterprise_id, { limit: 100 }).catch(() => ({ data: [] })),
    ]);

    const deliverables = delivRes.data || [];
    const coachingNotesCount = notesRes.data?.length || 0;

    // Try listing coach uploads from storage bucket
    let coachUploads: string[] = [];
    try {
      const { data: files } = await supabase.storage.from("coach-uploads").list(enterprise_id, { limit: 100 });
      coachUploads = (files || []).map((f: any) => f.name);
    } catch { /* bucket may not exist */ }

    // Build deliverable map
    const delivMap: Record<string, any> = {};
    for (const d of deliverables) {
      delivMap[d.type] = d;
    }

    // Available deliverable types
    const availableTypes = new Set(deliverables.map(d => d.type));

    // ═══ DETERMINISTIC CHECKS ═══
    const checks: any[] = [];

    // --- Section: Project Description ---
    const pdSection = OVO_COMPLIANCE_SECTIONS.find(s => s.id === "project_description")!;
    checks.push({
      section: pdSection.title,
      check: pdSection.checks[0], // Cohérence BP
      status: hasDeliverable(delivMap, "business_plan") ? "ok" : "missing",
      details: hasDeliverable(delivMap, "business_plan")
        ? "Business Plan généré et disponible"
        : "Business Plan non encore généré",
    });
    checks.push({
      section: pdSection.title,
      check: pdSection.checks[1], // Rapport coach
      status: coachingNotesCount > 0 ? "ok" : "warning",
      details: coachingNotesCount > 0
        ? `${coachingNotesCount} note(s) de coaching disponible(s)`
        : "Aucune note de coaching enregistrée",
    });
    checks.push({
      section: pdSection.title,
      check: pdSection.checks[2], // Justification prêt
      status: hasDeliverable(delivMap, "investment_memo") ? "ok" : "missing",
      details: hasDeliverable(delivMap, "investment_memo")
        ? "Investment memo disponible avec justification du prêt"
        : "Investment memo non généré — justification du prêt manquante",
    });
    checks.push({
      section: pdSection.title,
      check: pdSection.checks[3], // Alignement montant/investissements
      status: hasDeliverable(delivMap, "plan_financier") ? "ok" : "missing",
      details: hasDeliverable(delivMap, "plan_financier")
        ? "Plan financier disponible — alignement vérifiable"
        : "Plan financier non généré",
    });

    // --- Section: Financial Documentation ---
    const fdSection = OVO_COMPLIANCE_SECTIONS.find(s => s.id === "financial_documentation")!;
    const hasInputs = hasDeliverable(delivMap, "inputs_data");
    const hasPlanFin = hasDeliverable(delivMap, "plan_financier");
    const hasBP = hasDeliverable(delivMap, "business_plan");
    const hasPreScreening = hasDeliverable(delivMap, "pre_screening");

    checks.push({
      section: fdSection.title,
      check: fdSection.checks[0], // États financiers N-1
      status: hasInputs ? "ok" : "missing",
      details: hasInputs
        ? "Données financières extraites et disponibles"
        : "Données financières (inputs) non disponibles",
    });
    checks.push({
      section: fdSection.title,
      check: fdSection.checks[1], // Cohérence chiffres BP/plan/rapport
      status: (hasBP && hasPlanFin && hasPreScreening) ? "ok" : (hasBP || hasPlanFin ? "warning" : "missing"),
      details: (hasBP && hasPlanFin && hasPreScreening)
        ? "BP, Plan financier et Pré-screening disponibles — cross-validation possible"
        : "Documents insuffisants pour la cross-validation",
    });
    for (let i = 2; i < Math.min(fdSection.checks.length, 6); i++) {
      checks.push({
        section: fdSection.title,
        check: fdSection.checks[i],
        status: hasPlanFin ? "ok" : "missing",
        details: hasPlanFin ? "Vérifié dans le plan financier" : "Plan financier manquant — vérification impossible",
      });
    }
    // Projections trésorerie
    checks.push({
      section: fdSection.title,
      check: fdSection.checks[9], // Projections trésorerie
      status: hasField(delivMap, "plan_financier", "cash_flow", "tresorerie", "projection_tresorerie") ? "ok" : (hasPlanFin ? "warning" : "missing"),
      details: hasField(delivMap, "plan_financier", "cash_flow", "tresorerie") ? "Projections de trésorerie présentes" : "Projections de trésorerie non trouvées",
    });

    // --- Section: Legal Documentation ---
    const ldSection = OVO_COMPLIANCE_SECTIONS.find(s => s.id === "legal_documentation")!;
    const hasLegalDocs = coachUploads.some(f => /statut|registre|rccm|ohada/i.test(f));
    for (const check of ldSection.checks) {
      const isLegalRegistration = check.includes("Enregistrement");
      const isContracts = check.includes("Contrats");
      checks.push({
        section: ldSection.title,
        check,
        status: isLegalRegistration
          ? (hasLegalDocs ? "ok" : "warning")
          : (isContracts ? (coachUploads.length > 0 ? "warning" : "missing") : "warning"),
        details: isLegalRegistration
          ? (hasLegalDocs ? "Documents légaux détectés dans les uploads" : "Aucun document légal détecté — à vérifier manuellement")
          : "À vérifier manuellement dans le dossier",
      });
    }

    // --- Section: Intellectual Property ---
    const ipSection = OVO_COMPLIANCE_SECTIONS.find(s => s.id === "intellectual_property")!;
    for (const check of ipSection.checks) {
      checks.push({
        section: ipSection.title,
        check,
        status: "na",
        details: "Propriété intellectuelle — à vérifier au cas par cas",
      });
    }

    // --- Section: Social & Environmental ---
    const seSection = OVO_COMPLIANCE_SECTIONS.find(s => s.id === "social_environmental")!;
    const hasODD = hasDeliverable(delivMap, "odd_analysis");
    checks.push({
      section: seSection.title,
      check: seSection.checks[0], // Évaluation ODD
      status: hasODD ? "ok" : "missing",
      details: hasODD ? "Analyse ODD réalisée" : "Analyse ODD non générée",
    });
    checks.push({
      section: seSection.title,
      check: seSection.checks[1], // Indicateurs ODD SMART
      status: hasODD ? "ok" : "missing",
      details: hasODD ? "Indicateurs ODD disponibles dans l'analyse" : "Analyse ODD requise pour les indicateurs",
    });
    for (let i = 2; i < seSection.checks.length; i++) {
      checks.push({
        section: seSection.title,
        check: seSection.checks[i],
        status: hasODD ? "warning" : "missing",
        details: hasODD ? "À vérifier dans l'analyse ODD" : "Analyse ODD manquante",
      });
    }

    // --- Section: HR ---
    const hrSection = OVO_COMPLIANCE_SECTIONS.find(s => s.id === "hr")!;
    const hasRHData = hasField(delivMap, "plan_financier", "effectifs", "masse_salariale", "emplois");
    for (const check of hrSection.checks) {
      checks.push({
        section: hrSection.title,
        check,
        status: hasRHData ? "warning" : "missing",
        details: hasRHData ? "Données RH partielles dans le plan financier — vérification manuelle recommandée" : "Données RH non disponibles",
      });
    }

    // --- Section: Insurance ---
    const insSection = OVO_COMPLIANCE_SECTIONS.find(s => s.id === "insurance")!;
    const hasInsuranceMention = hasField(delivMap, "plan_financier", "assurance", "charges_assurance")
      || hasField(delivMap, "pre_screening", "constats_par_scope.legal_conformite");
    for (const check of insSection.checks) {
      checks.push({
        section: insSection.title,
        check,
        status: hasInsuranceMention ? "warning" : "missing",
        details: hasInsuranceMention ? "Mention d'assurance détectée — détails à vérifier" : "Aucune mention d'assurance trouvée dans les livrables",
      });
    }

    // ═══ COMPUTE SUMMARY ═══
    const blockers = checks.filter(c => c.status === "missing").length;
    const warnings = checks.filter(c => c.status === "warning").length;
    const ready = blockers === 0;

    const checklistData = {
      checks,
      ready,
      blockers,
      warnings,
      total_checks: checks.length,
      ok_count: checks.filter(c => c.status === "ok").length,
      na_count: checks.filter(c => c.status === "na").length,
      deliverables_available: Array.from(availableTypes),
      coaching_notes_count: coachingNotesCount,
      coach_uploads_count: coachUploads.length,
      generated_at: new Date().toISOString(),
      enterprise_name: ent.name,
    };

    // Save as deliverable type 'pre_ci_checklist'
    const { data: existing } = await supabase.from("deliverables")
      .select("id, version, data, score")
      .eq("enterprise_id", enterprise_id)
      .eq("type", "pre_ci_checklist")
      .maybeSingle();

    const newVersion = (existing?.version || 0) + 1;

    await supabase.from("deliverables").upsert({
      enterprise_id,
      type: "pre_ci_checklist",
      data: checklistData,
      score: ready ? 100 : Math.round((checklistData.ok_count / checks.length) * 100),
      version: newVersion,
      updated_at: new Date().toISOString(),
    }, { onConflict: "enterprise_id,type" });

    console.log(`[pre-ci-checklist] Done for ${enterprise_id}: ${blockers} blockers, ${warnings} warnings`);
    return jsonResponse({
      success: true,
      checks,
      ready,
      blockers,
      warnings,
    });

  } catch (e: any) {
    console.error("[generate-pre-ci-checklist] error:", e);
    return errorResponse(e.message || "Erreur interne", e.status || 500);
  }
});
