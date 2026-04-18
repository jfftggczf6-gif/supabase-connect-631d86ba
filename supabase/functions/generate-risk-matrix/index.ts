// Feature D — Risk Matrix: cross-reference enterprise data with OVO red flags
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  corsHeaders, verifyAndGetContext, callAI, saveDeliverable,
  jsonResponse, errorResponse,
} from "../_shared/helpers_v5.ts";
import { OVO_RED_FLAGS, buildOvoRedFlagsPromptContext } from "../_shared/ovo-knowledge.ts";

const SYSTEM_PROMPT = `Tu es un analyste de risques senior spécialisé dans l'investissement d'impact en Afrique subsaharienne.
Tu travailles pour OVO, un fonds d'impact. On te fournit toutes les données disponibles sur une entreprise.

Tu dois croiser ces données avec les 15 red flags identifiés par OVO (basés sur l'analyse de 60 projets).
Pour CHAQUE red flag, détermine s'il est détecté ou non dans les données de l'entreprise.

Pour chaque risque, fournis :
- detected: true/false — le red flag est-il présent ?
- severity: "critical" | "high" | "medium" | "low"
- probability: 0-100 — probabilité que ce risque se matérialise
- impact: 0-100 — impact si le risque se matérialise
- details: string — explication factuelle avec données chiffrées
- mitigation: string — mesure d'atténuation recommandée

Calcule aussi un risk_score global (0-100, 0 = aucun risque, 100 = risque maximal).

Réponds UNIQUEMENT en JSON valide selon le schéma fourni.`;

serve(async (req) => {
  console.log("[generate-risk-matrix] loaded");
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const ctx = await verifyAndGetContext(req);
    const ent = ctx.enterprise;

    // Role check: owner/admin/manager/super_admin only
    const { supabase, user } = ctx;
    const { data: roleData } = await supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle();
    const role = roleData?.role;
    const isOwner = ent.user_id === user.id;
    if (!isOwner && !["super_admin", "admin", "manager", "owner"].includes(role)) {
      return errorResponse("Accès réservé aux propriétaires, admins et managers", 403);
    }

    // Read ALL deliverables for enterprise
    const { data: allDeliverables } = await supabase.from("deliverables")
      .select("type, data, score")
      .eq("enterprise_id", ctx.enterprise_id);

    if (!allDeliverables || allDeliverables.length === 0) {
      return errorResponse("Aucun livrable disponible. Générez d'abord un pré-screening.", 400);
    }

    // Build deliverables context (truncated)
    const delivContext = (allDeliverables || []).map(d => {
      const dataStr = JSON.stringify(d.data || {});
      return `[${d.type}] (score: ${d.score || "N/A"})\n${dataStr.substring(0, 5000)}`;
    }).join("\n\n");

    // Build red flags reference
    const redFlagsRef = OVO_RED_FLAGS.map(rf =>
      `{ "id": "${rf.id}", "label": "${rf.pattern}", "category": "${rf.category}", "severity": "${rf.severity}", "frequency_pct": ${rf.pct || 'null'} }`
    ).join(",\n");

    const schema = `{
  "risks": [
    {
      "id": "string — id du red flag OVO",
      "label": "string — description du risque",
      "category": "string — operational | managerial | communication | business_model | external | coaching",
      "detected": true|false,
      "severity": "critical | high | medium | low",
      "probability": <0-100>,
      "impact": <0-100>,
      "details": "string — explication factuelle, chiffres si disponibles",
      "mitigation": "string — mesure d'atténuation recommandée"
    }
  ],
  "risk_score": <0-100>,
  "synthese": "string — 3-5 phrases de synthèse des risques majeurs",
  "top_risks": ["string — les 3 risques les plus critiques"]
}`;

    const prompt = `ENTREPRISE : ${ent.name}
SECTEUR : ${ent.sector || "Non spécifié"}
PAYS : ${ent.country || "Non spécifié"}
DATE CRÉATION : ${ent.creation_date || "Non spécifié"}
EFFECTIFS : ${ent.employees_count || "Non spécifié"}

══════ RED FLAGS OVO (15 risques identifiés sur 60 projets) ══════
${buildOvoRedFlagsPromptContext()}

══════ RÉFÉRENCE RED FLAGS (IDs) ══════
[${redFlagsRef}]

══════ DONNÉES ENTREPRISE (tous livrables) ══════
${delivContext.substring(0, 40000)}

══════ INSTRUCTIONS ══════
Analyse chaque red flag OVO et détermine s'il est détecté dans les données de l'entreprise.
Utilise les données factuelles et chiffrées des livrables.
Produis un risk_score global (0 = sûr, 100 = très risqué).
Identifie les 3 risques les plus critiques dans top_risks.

Réponds en JSON selon ce schéma :
${schema}`;

    const rawData = await callAI(SYSTEM_PROMPT, prompt, 8192, undefined, 0.2, {
      functionName: "generate-risk-matrix",
      enterpriseId: ctx.enterprise_id,
    });

    // Parse AI response
    let result: any;
    try {
      result = typeof rawData === "string" ? JSON.parse(rawData) : rawData;
    } catch {
      const match = (rawData as string).match(/```(?:json)?\s*([\s\S]*?)```/);
      if (match) {
        result = JSON.parse(match[1]);
      } else {
        throw new Error("Réponse IA invalide — JSON attendu");
      }
    }

    // Save as deliverable type 'risk_matrix'
    await saveDeliverable(supabase, ctx.enterprise_id, "risk_matrix", {
      ...result,
      generated_at: new Date().toISOString(),
      enterprise_name: ent.name,
    }, "diagnostic");

    console.log(`[risk-matrix] Done for ${ctx.enterprise_id}, risk_score=${result.risk_score}`);
    return jsonResponse({
      success: true,
      risks: result.risks,
      risk_score: result.risk_score,
      synthese: result.synthese,
      top_risks: result.top_risks,
    });

  } catch (e: any) {
    console.error("[generate-risk-matrix] error:", e);
    return errorResponse(e.message || "Erreur interne", e.status || 500);
  }
});
