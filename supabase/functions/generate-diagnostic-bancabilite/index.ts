// generate-diagnostic-bancabilite — segment Banque/IMF
//
// Génère le diagnostic de bancabilité (les "2 cercles" de la maquette ESONO Banque) :
//   Cercle 1 — grille de conformité quantitative : pour chaque critère
//              défini dans organization_presets.criteres_conformite, évalue
//              la valeur de l'entreprise vs le seuil et marque conforme / non_conforme.
//   Cercle 2 — constats et signaux : pour chaque facteur défini dans
//              organization_presets.constats_config, rédige un constat factuel
//              avec son impact pour le comité.
//   Synthèse  — classification (config_banque.classifications.diagnostic) +
//              plan de structuration P1 (rouge) / P2 (ambre) / P3 (gris).
//
// Toutes les valeurs spécifiques à la banque (seuils, libellés, classifications,
// devise, langue) viennent du preset — aucune valeur hardcodée NSIA.
//
// Sauvegarde en deliverable type='diagnostic_bancabilite'.
// Pattern async (EdgeRuntime.waitUntil) identique aux autres generate-*.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  corsHeaders, verifyAndGetContext, callAI, saveDeliverable,
  errorResponse, jsonResponse,
} from "../_shared/helpers_v5.ts";
import { injectGuardrails } from "../_shared/guardrails.ts";
import { buildToneForAgent } from "../_shared/agent-tone.ts";

const SYSTEM_PROMPT = `Tu prépares le DIAGNOSTIC DE BANCABILITÉ d'une PME pour un comité de crédit.

═══ STRUCTURE OBLIGATOIRE ═══

CERCLE 1 — Grille de conformité (objectif, binaire)
- Pour chaque critère du tableau "criteres_conformite" fourni en contexte, calcule la valeur effective de la PME à partir des données financières et documentaires fournies.
- Compare la valeur calculée au seuil. Renvoie statut "conforme" si la condition (operateur+seuil) est respectée, sinon "non_conforme".
- Indique la valeur exacte (chiffre, ratio, oui/non, nombre).
- N'invente pas de critère. N'omets aucun critère du tableau. Reprends exactement le code du critère fourni.

CERCLE 2 — Constats factuels (qualitatif)
- Pour chaque entrée du tableau "constats_config" fourni en contexte, rédige un constat factuel basé sur les documents et chiffres fournis.
- Tag le constat avec EXACTEMENT un des "tags_possibles" du facteur ("bloquant", "a_corriger", "a_surveiller", "ok").
- Indique l'impact pour le comité de crédit (1-2 phrases concrètes : DSCR potentiellement surévalué, garantie supplémentaire à demander, etc.).
- Indique une remédiation actionnable si le tag n'est pas "ok".
- Coche les items_check en t/f selon ce que les documents permettent de vérifier.

SYNTHÈSE
- Compte le nombre de critères conformes / non conformes (Cercle 1).
- Compte les bloquants / à corriger / à surveiller / ok (Cercle 2).
- Classification : choisis EXACTEMENT une valeur dans le tableau "classifications.diagnostic" fourni en contexte. Justifie en 2 phrases.
- Plan de structuration en 3 niveaux :
  P1 (rouge, bloquants) : actions sans lesquelles l'instruction est impossible. Durée estimée.
  P2 (ambre, à corriger) : actions qui améliorent les ratios ou réduisent un risque significatif.
  P3 (gris, à surveiller) : actions de fiabilisation, gouvernance, monitoring.

RÈGLES ABSOLUES
- Chaque chiffre doit être tiré des documents/données fournis. Si une info manque, indique-le explicitement (ne pas inventer).
- Ne jamais utiliser de devise hardcodée — utilise la devise fournie en contexte.
- Réponds UNIQUEMENT en JSON valide selon le schéma fourni.`;

const OUTPUT_SCHEMA = `{
  "cercle_1_grille": [
    { "code": "string — code du critère (identique au preset)",
      "label": "string",
      "valeur_pme": "string ou number — valeur calculée",
      "seuil": "string ou number — seuil du preset",
      "operateur": "gte|lte|eq",
      "statut": "conforme|non_conforme",
      "source": "string — d'où vient la valeur (ex: 'liasse 2025 p.3')"
    }
  ],
  "cercle_2_constats": [
    { "code": "string — code du facteur (identique au preset)",
      "label": "string",
      "tag": "bloquant|a_corriger|a_surveiller|ok",
      "constat": "string — 2-4 phrases factuelles avec chiffres",
      "impact_financement": "string — 1-2 phrases sur l'impact comité",
      "remediation": "string — action concrète, vide si tag=ok",
      "items_check": { "<item_code>": true|false }
    }
  ],
  "synthese": {
    "nb_criteres_total": <number>,
    "nb_criteres_conformes": <number>,
    "nb_constats_bloquants": <number>,
    "nb_constats_a_corriger": <number>,
    "nb_constats_a_surveiller": <number>,
    "nb_constats_ok": <number>,
    "classification": "string — code exact de classifications.diagnostic",
    "classification_label": "string — label correspondant",
    "argumentaire": "string — 2-3 phrases justifiant la classification"
  },
  "plan_structuration": {
    "p1_bloquants": [
      { "action": "string", "duree_estimee": "string", "criteres_impactes": ["string"] }
    ],
    "p2_a_corriger": [
      { "action": "string", "criteres_impactes": ["string"] }
    ],
    "p3_a_surveiller": [
      { "action": "string", "constats_impactes": ["string"] }
    ]
  },
  "metadata": {
    "preset_version": "string",
    "devise_org": "string",
    "date_diagnostic": "string ISO date"
  }
}`;

serve(async (req) => {
  console.log("[generate-diagnostic-bancabilite] loaded");
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const ctx = await verifyAndGetContext(req);
    const ent = ctx.enterprise;
    const requestId = crypto.randomUUID();

    // 1. Lecture du preset banque
    const { data: presetRow } = await ctx.supabase
      .from("organization_presets")
      .select("criteres_conformite, constats_config, matching_config, config_banque, devise, langue")
      .eq("organization_id", ctx.organization_id)
      .maybeSingle();

    if (!presetRow?.criteres_conformite || !presetRow?.config_banque) {
      return errorResponse(
        "Preset banque non configuré pour cette organisation. Charger le seed (preset_<banque>.json) avant.",
        400
      );
    }

    const criteres = presetRow.criteres_conformite as any[];
    const constats = (presetRow.constats_config || []) as any[];
    const cb = presetRow.config_banque as any;
    const classifications = cb?.classifications?.diagnostic || [];
    const devise = presetRow.devise || cb?.devise_defaut || "FCFA";
    const langue = presetRow.langue || "fr";

    // 2. Marquer en processing
    await ctx.supabase.from("deliverables").upsert({
      enterprise_id: ctx.enterprise_id,
      type: "diagnostic_bancabilite",
      data: { status: "processing", request_id: requestId, started_at: new Date().toISOString() },
    }, { onConflict: "enterprise_id,type" });

    // 3. Async work
    const asyncWork = async () => {
      try {
        // Lecture des deliverables existants (inputs_data, plan_financier) si présents
        const { data: delivs } = await ctx.supabase
          .from("deliverables")
          .select("type, data")
          .eq("enterprise_id", ctx.enterprise_id)
          .in("type", ["inputs_data", "plan_financier"]);

        const inputsData = delivs?.find((d: any) => d.type === "inputs_data")?.data || null;
        const planFinancier = delivs?.find((d: any) => d.type === "plan_financier")?.data || null;

        // Lecture documents (cache)
        const documentContent = (ent.document_content || "").slice(0, 25000);

        // Construction du contexte structuré pour l'IA
        const context = `
══════ ENTREPRISE ══════
Nom : ${ent.name}
Pays : ${ent.country || "n/d"}
Secteur : ${ent.sector || "n/d"}
Devise org : ${devise}

══════ CRITÈRES À ÉVALUER (Cercle 1) ══════
${JSON.stringify(criteres, null, 2)}

══════ FACTEURS À ANALYSER (Cercle 2) ══════
${JSON.stringify(constats, null, 2)}

══════ CLASSIFICATIONS POSSIBLES ══════
${JSON.stringify(classifications, null, 2)}

══════ DONNÉES INPUTS (extraction structurée si dispo) ══════
${inputsData ? JSON.stringify(inputsData, null, 2).slice(0, 8000) : "Pas de données inputs structurées."}

══════ PLAN FINANCIER (ratios calculés si dispo) ══════
${planFinancier ? JSON.stringify({
  dscr: planFinancier?.ratios?.dscr || planFinancier?.dscr,
  endettement: planFinancier?.ratios?.endettement,
  liquidite: planFinancier?.ratios?.liquidite,
  ebe: planFinancier?.synthese?.ebe,
  ca: planFinancier?.synthese?.ca,
}, null, 2) : "Pas de plan financier généré."}

══════ DOCUMENTS (extraits) ══════
${documentContent || "Pas de documents parsés."}
`;

        // 4. Appel IA — tone composé selon segment
        const toneBlock = await buildToneForAgent(ctx.supabase, ctx.organization_id);
        const finalSystemPrompt = `${toneBlock}\n\n${SYSTEM_PROMPT}\n\n══ SCHÉMA DE SORTIE ══\n${OUTPUT_SCHEMA}`;

        const userPrompt = `${context}

Évalue cette PME selon les 2 cercles, classifie-la et propose un plan de structuration. Réponds en ${langue === "fr" ? "français" : "english"}, en JSON strict selon le schéma.`;

        const rawData = await callAI(
          injectGuardrails(finalSystemPrompt, ent.country),
          userPrompt,
          12288,
          undefined,
          0.2,
          { functionName: "generate-diagnostic-bancabilite", enterpriseId: ctx.enterprise_id },
        );

        // 5. Enrichir avec metadata
        const enriched = {
          ...rawData,
          metadata: {
            ...(rawData?.metadata || {}),
            preset_version: cb?._version || "1.0.0",
            devise_org: devise,
            date_diagnostic: new Date().toISOString(),
            request_id: requestId,
          },
        };

        // 6. Sauver
        await saveDeliverable(
          ctx.supabase,
          ctx.enterprise_id,
          "diagnostic_bancabilite",
          enriched,
          "diagnostic_bancabilite",
        );

        // 7. Mettre à jour banque_metadata sur l'enterprise (classification + dernier diag)
        await ctx.supabase.from("enterprises").update({
          banque_metadata: {
            ...(ent.banque_metadata || {}),
            last_diagnostic: {
              classification: enriched?.synthese?.classification,
              date: new Date().toISOString(),
              nb_conformes: enriched?.synthese?.nb_criteres_conformes,
              nb_total: enriched?.synthese?.nb_criteres_total,
            },
          },
          last_activity: new Date().toISOString(),
        }).eq("id", ctx.enterprise_id);

        console.log(`[diagnostic-bancabilite] ✅ DONE ${requestId}`);
      } catch (innerErr: any) {
        console.error("[diagnostic-bancabilite] Background error:", innerErr);
        await ctx.supabase.from("deliverables").update({
          data: { status: "error", error: innerErr.message?.slice(0, 500), request_id: requestId },
        }).eq("enterprise_id", ctx.enterprise_id).eq("type", "diagnostic_bancabilite");
      }
    };

    // @ts-ignore
    EdgeRuntime.waitUntil(asyncWork());
    return jsonResponse({ accepted: true, request_id: requestId }, 202);
  } catch (e: any) {
    console.error("generate-diagnostic-bancabilite error:", e);
    return errorResponse(e.message || "Erreur", e.status || 500);
  }
});
