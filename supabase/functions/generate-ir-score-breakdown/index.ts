// Feature C — IR Score Breakdown into 6 OVO categories
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  corsHeaders, verifyAndGetContext, callAI,
  jsonResponse, errorResponse,
} from "../_shared/helpers_v5.ts";
import { IR_SCORE_CATEGORIES } from "../_shared/ovo-knowledge.ts";

const SYSTEM_PROMPT = `Tu es un analyste senior d'investissement d'impact spécialisé dans les PME africaines.
Tu travailles pour OVO, un fonds d'impact qui accompagne des PME en Afrique subsaharienne.

On te fournit les données de pré-screening et de diagnostic d'une entreprise.
Tu dois décomposer le score IR (Investment Readiness) en 6 catégories OVO.

Pour CHAQUE catégorie, attribue un score de 0 à 100 avec une justification courte (2-3 phrases max).
Base-toi sur les données factuelles disponibles. Si une catégorie manque de données, indique-le et attribue un score conservateur.

Réponds UNIQUEMENT en JSON valide selon le schéma fourni.`;

serve(async (req) => {
  console.log("[generate-ir-score-breakdown] loaded");
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

    // Read pre_screening + diagnostic_data deliverables
    const [preScreeningRes, diagnosticRes] = await Promise.all([
      supabase.from("deliverables").select("data, score").eq("enterprise_id", ctx.enterprise_id).eq("type", "pre_screening").maybeSingle(),
      supabase.from("deliverables").select("data, score").eq("enterprise_id", ctx.enterprise_id).eq("type", "diagnostic_data").maybeSingle(),
    ]);

    const preScreening = preScreeningRes?.data?.data || null;
    const diagnostic = diagnosticRes?.data?.data || null;

    if (!preScreening && !diagnostic) {
      return errorResponse("Aucune donnée de pré-screening ou diagnostic disponible. Générez d'abord un pré-screening.", 400);
    }

    // Build categories schema for the prompt
    const categoriesSchema = IR_SCORE_CATEGORIES.map(c =>
      `"${c.id}": { "score": <0-100>, "justification": "string — 2-3 phrases" }`
    ).join(",\n    ");

    const schema = `{
  "breakdown": {
    ${categoriesSchema}
  },
  "score_global": <0-100 — moyenne pondérée>,
  "synthese": "string — 3-4 phrases de synthèse globale"
}`;

    const categoriesContext = IR_SCORE_CATEGORIES.map(c =>
      `- ${c.id} (${c.label}, poids ${c.weight}%): ${c.description}. Checks associés: ${c.checks.length ? c.checks.join(", ") : "évaluation qualitative"}`
    ).join("\n");

    const prompt = `ENTREPRISE : ${ent.name}
SECTEUR : ${ent.sector || "Non spécifié"}
PAYS : ${ent.country || "Non spécifié"}

══════ CATÉGORIES IR (6 axes OVO) ══════
${categoriesContext}

══════ DONNÉES PRÉ-SCREENING ══════
${preScreening ? JSON.stringify(preScreening).substring(0, 15000) : "(Non disponible)"}

══════ DONNÉES DIAGNOSTIC ══════
${diagnostic ? JSON.stringify(diagnostic).substring(0, 15000) : "(Non disponible)"}

══════ INSTRUCTIONS ══════
Décompose le score IR en 6 catégories. Pour chaque catégorie :
1. Évalue un score 0-100 basé sur les données disponibles
2. Fournis une justification courte (2-3 phrases) avec des faits précis
3. Le score_global est la moyenne pondérée (operational 20%, managerial 20%, communication 10%, market 15%, financial 25%, compliance 10%)

Réponds en JSON selon ce schéma :
${schema}`;

    const rawData = await callAI(SYSTEM_PROMPT, prompt, 4096, undefined, 0.2, {
      functionName: "generate-ir-score-breakdown",
      enterpriseId: ctx.enterprise_id,
    });

    // Parse the AI response
    let breakdown: any;
    try {
      breakdown = typeof rawData === "string" ? JSON.parse(rawData) : rawData;
    } catch {
      // Try extracting JSON from markdown code block
      const match = (rawData as string).match(/```(?:json)?\s*([\s\S]*?)```/);
      if (match) {
        breakdown = JSON.parse(match[1]);
      } else {
        throw new Error("Réponse IA invalide — JSON attendu");
      }
    }

    // Write result to enterprises.score_ir_breakdown (jsonb UPDATE)
    const { error: updateError } = await supabase.from("enterprises").update({
      score_ir_breakdown: breakdown.breakdown,
      last_activity: new Date().toISOString(),
    }).eq("id", ctx.enterprise_id);

    if (updateError) {
      console.error("[ir-score-breakdown] Update error:", updateError);
      return errorResponse("Erreur lors de la sauvegarde du breakdown: " + updateError.message, 500);
    }

    // Also update score_ir if we computed a global score
    if (breakdown.score_global) {
      await supabase.from("enterprises").update({
        score_ir: breakdown.score_global,
      }).eq("id", ctx.enterprise_id);
    }

    console.log(`[ir-score-breakdown] Done for ${ctx.enterprise_id}`);
    return jsonResponse({
      success: true,
      breakdown: breakdown.breakdown,
      score_global: breakdown.score_global,
      synthese: breakdown.synthese,
    });

  } catch (e: any) {
    console.error("[generate-ir-score-breakdown] error:", e);
    return errorResponse(e.message || "Erreur interne", e.status || 500);
  }
});
