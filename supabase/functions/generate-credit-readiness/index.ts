// generate-credit-readiness — Router unique pour les 6 livrables Credit Readiness.
//
// Body : { enterprise_id, livrable_code }
//   livrable_code ∈ ['modele_financier', 'projections', 'bp_credit',
//                    'plan_financement', 'organigramme', 'analyse_commerciale']
//
// Pattern :
//   1. Résout livrable_code → CR_PROMPTS[code]  (system_prompt + output_schema)
//   2. Construit le contexte enterprise + documents + autres deliverables
//   3. Appelle callAI avec buildToneForAgent + injectGuardrails
//   4. Sauve avec validation_status='draft' (entrée dans le workflow review)
//
// Sortie : 202 Accepted + { request_id } (traitement async via EdgeRuntime.waitUntil)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  corsHeaders, verifyAndGetContext, callAI, saveDeliverable,
  errorResponse, jsonResponse,
} from "../_shared/helpers_v5.ts";
import { injectGuardrails } from "../_shared/guardrails.ts";
import { buildToneForAgent } from "../_shared/agent-tone.ts";
import { getCRPromptDef, CR_PROMPTS } from "../_shared/credit-readiness-prompts.ts";

serve(async (req) => {
  console.log('[generate-credit-readiness] loaded');
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const livrable_code = body?.livrable_code;
    if (!livrable_code) return errorResponse('livrable_code requis', 400);

    const promptDef = getCRPromptDef(livrable_code);
    if (!promptDef) {
      return errorResponse(
        `livrable_code inconnu: ${livrable_code}. Valides: ${Object.keys(CR_PROMPTS).join(', ')}`,
        400,
      );
    }

    const ctx = await verifyAndGetContext(req, body);
    const ent = ctx.enterprise;
    const requestId = crypto.randomUUID();
    const deliverableType = promptDef.deliverable_type;

    const { data: presetRow } = await ctx.supabase
      .from('organization_presets')
      .select('config_banque, devise')
      .eq('organization_id', ctx.organization_id)
      .maybeSingle();
    const cb = presetRow?.config_banque || {};
    const devise = presetRow?.devise || cb.devise_defaut || 'FCFA';

    await ctx.supabase.from('deliverables').upsert({
      enterprise_id: ctx.enterprise_id,
      type: deliverableType,
      data: {
        status: 'processing',
        request_id: requestId,
        started_at: new Date().toISOString(),
        livrable_code,
      },
      validation_status: 'draft',
    }, { onConflict: 'enterprise_id,type' });

    const asyncWork = async () => {
      try {
        // Récupère TOUS les deliverables liés au dossier crédit pour enrichir le contexte
        // (un livrable CR consomme souvent les sorties des livrables précédents)
        const { data: delivs } = await ctx.supabase.from('deliverables')
          .select('type, data')
          .eq('enterprise_id', ctx.enterprise_id)
          .in('type', [
            'inputs_data',
            'plan_financier',
            'diagnostic_bancabilite',
            'credit_readiness_modele_financier',
            'credit_readiness_projections',
            'credit_readiness_bp_credit',
            'credit_readiness_plan_financement',
          ]);

        const findDeliv = (t: string) => delivs?.find((d: any) => d.type === t)?.data || null;
        const inputsData = findDeliv('inputs_data');
        const planFinancier = findDeliv('plan_financier');
        const diagnostic = findDeliv('diagnostic_bancabilite');
        const modeleFinancier = findDeliv('credit_readiness_modele_financier');
        const projections = findDeliv('credit_readiness_projections');
        const bpCredit = findDeliv('credit_readiness_bp_credit');
        const planFinancement = findDeliv('credit_readiness_plan_financement');

        // Récupère le dossier crédit (pour le montant demandé, l'objet, etc.)
        const { data: dossier } = await ctx.supabase
          .from('credit_dossiers')
          .select('*')
          .eq('enterprise_id', ctx.enterprise_id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        const documentContent = (ent.document_content || '').slice(0, 25000);

        const upstreamCtx = buildUpstreamContext(livrable_code, {
          modeleFinancier, projections, bpCredit, planFinancement,
        });

        const context = `
══════ ENTREPRISE ══════
Nom : ${ent.name}
Pays : ${ent.country || 'n/d'}
Secteur : ${ent.sector || 'n/d'}
Devise : ${devise}

══════ DOSSIER CRÉDIT ══════
${dossier ? JSON.stringify({
  reference: dossier.reference_dossier,
  montant_demande: dossier.montant_demande,
  objet: dossier.objet_credit,
  duree_mois: dossier.duree_mois,
  taux_propose_pct: dossier.taux_propose_pct,
  phase: dossier.phase,
  statut: dossier.statut,
}, null, 2) : 'Pas de dossier crédit lié.'}

══════ DOCUMENTS (extraits) ══════
${documentContent || 'Pas de documents parsés.'}

══════ INPUTS STRUCTURÉS ══════
${inputsData ? JSON.stringify(inputsData, null, 2).slice(0, 6000) : 'Pas d\'extraction structurée.'}

══════ PLAN FINANCIER (si dispo) ══════
${planFinancier ? JSON.stringify(planFinancier, null, 2).slice(0, 4000) : 'Pas de plan financier.'}

══════ DIAGNOSTIC BANCABILITÉ (si dispo) ══════
${diagnostic ? JSON.stringify({
  bloquants: diagnostic?.cercle_2_constats?.filter((c: any) => c.tag === 'bloquant'),
  classification: diagnostic?.synthese?.classification,
}, null, 2).slice(0, 3000) : 'Pas de diagnostic disponible.'}

${upstreamCtx}
`;

        const toneBlock = await buildToneForAgent(ctx.supabase, ctx.organization_id);
        const finalSystemPrompt = `${toneBlock}\n\n${promptDef.system_prompt}\n\n══ SCHÉMA ══\n${promptDef.output_schema}`;

        const userPrompt = `${context}\n\n${promptDef.user_instruction}`;

        const rawData = await callAI(
          injectGuardrails(finalSystemPrompt, ent.country),
          userPrompt,
          12288,
          undefined,
          0.2,
          {
            functionName: `generate-credit-readiness/${livrable_code}`,
            enterpriseId: ctx.enterprise_id,
          },
        );

        const enriched = {
          ...rawData,
          metadata: {
            ...(rawData?.metadata || {}),
            devise,
            livrable_code,
            request_id: requestId,
            date_generation: new Date().toISOString(),
          },
        };

        await saveDeliverable(
          ctx.supabase,
          ctx.enterprise_id,
          deliverableType,
          enriched,
          livrable_code,
        );

        // saveDeliverable peut écraser validation_status — on le force à 'draft'
        await ctx.supabase.from('deliverables').update({
          validation_status: 'draft',
        }).eq('enterprise_id', ctx.enterprise_id).eq('type', deliverableType);

        console.log(`[credit-readiness/${livrable_code}] ✅ DONE ${requestId}`);
      } catch (innerErr: any) {
        console.error(`[credit-readiness/${livrable_code}] error:`, innerErr);
        await ctx.supabase.from('deliverables').update({
          data: {
            status: 'error',
            error: innerErr.message?.slice(0, 500),
            request_id: requestId,
            livrable_code,
          },
        }).eq('enterprise_id', ctx.enterprise_id).eq('type', deliverableType);
      }
    };

    // @ts-ignore
    EdgeRuntime.waitUntil(asyncWork());
    return jsonResponse({ accepted: true, request_id: requestId, livrable_code, deliverable_type: deliverableType }, 202);
  } catch (e: any) {
    console.error('generate-credit-readiness error:', e);
    return errorResponse(e.message || 'Erreur', e.status || 500);
  }
});

// Construit le contexte amont selon le livrable demandé.
// Ex : projections a besoin du modele_financier (point de départ EBE).
//      bp_credit a besoin du modele_financier + projections.
//      plan_financement a besoin de bp_credit (montant + structure).
function buildUpstreamContext(
  code: string,
  upstream: { modeleFinancier: any; projections: any; bpCredit: any; planFinancement: any },
): string {
  const blocks: string[] = [];

  const include = (label: string, data: any, maxLen = 4000) => {
    if (!data) return;
    blocks.push(`══════ ${label} (livrable amont) ══════\n${JSON.stringify(data, null, 2).slice(0, maxLen)}`);
  };

  switch (code) {
    case 'modele_financier':
      // Aucun upstream CR — utilise inputs_data / plan_financier déjà inclus en haut
      break;

    case 'projections':
      include('MODÈLE FINANCIER NETTOYÉ', upstream.modeleFinancier, 5000);
      break;

    case 'bp_credit':
      include('MODÈLE FINANCIER NETTOYÉ', upstream.modeleFinancier, 4000);
      include('PROJECTIONS FINANCIÈRES', upstream.projections, 4000);
      break;

    case 'plan_financement':
      include('BUSINESS PLAN ORIENTÉ CRÉDIT', upstream.bpCredit, 4000);
      include('PROJECTIONS FINANCIÈRES', upstream.projections, 3000);
      break;

    case 'organigramme':
      // Pas de dépendance financière mais peut être utile d'avoir le diagnostic
      break;

    case 'analyse_commerciale':
      include('PROJECTIONS FINANCIÈRES', upstream.projections, 3000);
      include('BUSINESS PLAN ORIENTÉ CRÉDIT', upstream.bpCredit, 3000);
      break;
  }

  return blocks.join('\n\n');
}
