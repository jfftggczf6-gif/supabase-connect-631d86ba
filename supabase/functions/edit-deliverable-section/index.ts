// edit-deliverable-section — Modify a specific section of a deliverable via AI
import { corsHeaders, jsonResponse, errorResponse, verifyAndGetContext, callAI } from "../_shared/helpers_v5.ts";

const SUPPORTED_TYPES = [
  "bmc_analysis", "sic_analysis", "diagnostic_data", "business_plan",
  "odd_analysis", "pre_screening", "valuation", "screening_report",
  "plan_financier", "inputs_data", "framework_data",
  "onepager", "investment_memo",
];

// Map deliverable types to module codes for saveDeliverable
const TYPE_TO_MODULE: Record<string, string> = {
  bmc_analysis: "bmc",
  sic_analysis: "sic",
  diagnostic_data: "diagnostic",
  business_plan: "business_plan",
  odd_analysis: "odd",
  pre_screening: "pre_screening",
  valuation: "valuation",
  screening_report: "screening",
  plan_financier: "plan_financier",
  inputs_data: "inputs",
  framework_data: "framework",
  onepager: "onepager",
  investment_memo: "investment_memo",
};

function getNestedValue(obj: any, path: string): any {
  return path.split(".").reduce((acc, key) => acc?.[key], obj);
}

function setNestedValue(obj: any, path: string, value: any): any {
  const clone = JSON.parse(JSON.stringify(obj));
  const keys = path.split(".");
  let current = clone;
  for (let i = 0; i < keys.length - 1; i++) {
    if (!current[keys[i]] || typeof current[keys[i]] !== "object") {
      current[keys[i]] = {};
    }
    current = current[keys[i]];
  }
  current[keys[keys.length - 1]] = value;
  return clone;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { deliverable_type, section_path, instruction } = body;

    if (!deliverable_type || !section_path || !instruction) {
      return errorResponse("deliverable_type, section_path et instruction sont requis", 400);
    }

    if (!SUPPORTED_TYPES.includes(deliverable_type)) {
      return errorResponse(`Type non supporté: ${deliverable_type}. Types supportés: ${SUPPORTED_TYPES.join(", ")}`, 400);
    }

    const ctx = await verifyAndGetContext(req, body);
    const { supabase, enterprise_id, enterprise } = ctx;

    // Check role — only coaches and super_admins
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", ctx.user.id);
    
    const userRoles = (roles || []).map((r: any) => r.role);
    if (!userRoles.includes("coach") && !userRoles.includes("super_admin")) {
      return errorResponse("Seuls les coaches et super_admins peuvent modifier les sections", 403);
    }

    // Get existing deliverable
    const { data: deliverable } = await supabase
      .from("deliverables")
      .select("id, data, version, score")
      .eq("enterprise_id", enterprise_id)
      .eq("type", deliverable_type)
      .maybeSingle();

    if (!deliverable?.data) {
      return errorResponse("Livrable non trouvé", 404);
    }

    const currentData = deliverable.data as Record<string, any>;
    const originalValue = getNestedValue(currentData, section_path);

    if (originalValue === undefined) {
      return errorResponse(`Section introuvable: ${section_path}`, 404);
    }

    // Call AI to modify the section
    const systemPrompt = `Tu es un expert en analyse financière et business pour PME africaines.
Tu dois modifier une section spécifique d'un livrable "${deliverable_type}" pour l'entreprise "${enterprise.name}".

RÈGLES:
- Retourne UNIQUEMENT le JSON de la section modifiée, rien d'autre
- Conserve exactement la même structure JSON que l'original
- Applique la modification demandée par l'utilisateur
- Ne change pas les champs qui ne sont pas concernés par la modification
- Si la section est une string, retourne une string
- Si la section est un objet, retourne un objet avec la même structure
- Si la section est un array, retourne un array`;

    const userPrompt = `SECTION À MODIFIER: ${section_path}

CONTENU ACTUEL DE LA SECTION:
${JSON.stringify(originalValue, null, 2)}

INSTRUCTION DE MODIFICATION:
${instruction}

Retourne UNIQUEMENT le JSON modifié de cette section (pas d'explication, pas de markdown).`;

    let newValue: any;
    if (typeof originalValue === 'string') {
      // For string fields, get raw text response (don't parse as JSON)
      const anthropicApiKey = Deno.env.get("ANTHROPIC_API_KEY")!;
      const aiResp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": anthropicApiKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6", max_tokens: 4096, temperature: 0.2,
          system: systemPrompt,
          messages: [{ role: "user", content: userPrompt }],
        }),
      });
      if (!aiResp.ok) throw new Error(`AI error ${aiResp.status}`);
      const aiResult = await aiResp.json();
      newValue = (aiResult.content?.[0]?.text || "").trim();
    } else {
      newValue = await callAI(systemPrompt, userPrompt, 8192, undefined, undefined, { functionName: "edit-deliverable-section", enterpriseId: enterprise_id });
    }

    // Update the deliverable data
    const updatedData = setNestedValue(currentData, section_path, newValue);
    const newVersion = (deliverable.version || 0) + 1;

    // Archive current version
    if (currentData && Object.keys(currentData).length > 0) {
      await supabase.from("deliverable_versions").insert({
        deliverable_id: deliverable.id,
        enterprise_id,
        type: deliverable_type,
        version: deliverable.version || 1,
        data: currentData,
        score: deliverable.score,
        trigger_reason: `section_edit:${section_path}`,
      });
    }

    // Add metadata
    updatedData._metadata = {
      ...(updatedData._metadata || {}),
      version: newVersion,
      last_edited_at: new Date().toISOString(),
      last_edited_section: section_path,
      last_edited_by: ctx.user.id,
    };

    // Save updated deliverable
    await supabase.from("deliverables").update({
      data: updatedData,
      version: newVersion,
      updated_at: new Date().toISOString(),
    }).eq("id", deliverable.id);

    // Log the correction
    await supabase.from("deliverable_corrections").insert({
      enterprise_id,
      deliverable_id: deliverable.id,
      deliverable_type,
      field_path: section_path,
      original_value: originalValue,
      corrected_value: newValue,
      corrected_by: ctx.user.id,
      correction_reason: instruction,
    });

    // Activity log
    await supabase.from("activity_log").insert({
      enterprise_id,
      action: "section_edited",
      actor_id: ctx.user.id,
      actor_role: userRoles.includes("super_admin") ? "super_admin" : "coach",
      deliverable_type,
      metadata: { section_path, instruction: instruction.substring(0, 200) },
    });

    return jsonResponse({
      success: true,
      section_path,
      version: newVersion,
      original_value: originalValue,
      new_value: newValue,
    });

  } catch (err: any) {
    console.error("[edit-deliverable-section] Error:", err);
    return errorResponse(err.message || "Erreur interne", err.status || 500);
  }
});
