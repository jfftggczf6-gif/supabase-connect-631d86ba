// v5 — 2-pass checkpoint + Sonnet model 2026-03-20
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  corsHeaders, verifyAndGetContext, callAI, saveDeliverable, buildRAGContext,
  jsonResponse, errorResponse, getCoachingContext,
} from "../_shared/helpers_v5.ts";
import { getFinancialKnowledgePrompt, getValuationBenchmarksPrompt, getDonorCriteriaPrompt } from "../_shared/financial-knowledge.ts";
import { injectGuardrails } from "../_shared/guardrails.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const SONNET_MODEL = "claude-sonnet-4-20250514";

const MEMO_SYSTEM_PROMPT = `Tu es un analyste senior en Private Equity / Impact Investing avec 15+ ans d'expérience en Afrique subsaharienne.
Tu rédiges des Investment Memorandums professionnels pour des comités d'investissement de fonds (BAD, IFC, Proparco, I&P, Partech Africa, BII).

TU CONNAIS :
- Les normes SYSCOHADA révisé 2017 et la fiscalité UEMOA/CEMAC
- Les critères ESG des DFI (IFC Performance Standards 1-8, Principes Equateur)
- Le processus d'investissement : screening → due diligence → investment memo → comité → closing
- Les spécificités PME Afrique : informalité partielle, gouvernance familiale, saisonnalité
- Les multiples de valorisation réels en Afrique (PAS les multiples occidentaux)

EXIGENCES QUALITÉ :
- Chaque affirmation doit être sourcée (données entreprise, benchmark sectoriel, ou estimation explicite)
- La section valorisation utilise les résultats de l'agent Valuation — ne PAS recalculer, citer et commenter
- La thèse d'investissement doit être HONNÊTE
- Les projections financières citent le scénario réaliste du Plan OVO
- La recommandation finale doit être COHÉRENTE avec le score et les risques

EXIGENCES DE FORMAT (TRÈS IMPORTANT) :
- Ce memo est un document de COMITÉ D'INVESTISSEMENT — il doit être DÉTAILLÉ, EXPLICATIF et ARGUMENTÉ
- Chaque section narrative ("resume", "synthese", "explication") doit être RICHE en analyse — 2-4 phrases complètes, pas des mots-clés
- Les "arguments" et "explications" doivent être des VRAIS PARAGRAPHES avec du contexte et des preuves
- MAIS séparer le TEXTE des CHIFFRES : les analyses qualitatives dans les champs texte, les données quantitatives dans les tableaux structurés
- Les chiffres ne doivent JAMAIS être noyés au milieu d'un paragraphe — ils vont dans les objets structurés dédiés (tableau, indicateurs, chiffres_cles)
- Chaque champ "resume" = analyse qualitative détaillée SANS chiffres
- Chaque tableau = données quantitatives avec sources
- Le résultat doit être LISIBLE : un lecteur qui ne lit que les "resume" comprend le dossier, un lecteur qui veut les détails va dans les tableaux

IMPORTANT: Réponds UNIQUEMENT en JSON valide.`;

const MEMO_SCHEMA_PART1 = `{
  "page_de_garde": {
    "titre": "string — Investment Memorandum — [Nom Entreprise]",
    "sous_titre": "string — Confidentiel — Préparé par ESONO",
    "date": "string",
    "version": "string — v1.0"
  },
  "resume_executif": {
    "synthese": "string — 3-4 phrases de synthèse qualitative SANS chiffres",
    "points_cles": ["string — 5-8 points clés, 1 phrase chacun"],
    "chiffres_cles": [
      {"label": "string — ex: CA dernier exercice", "valeur": "string — ex: 150M FCFA", "evolution": "string — ex: +22% vs N-1", "source": "string"}
    ],
    "recommandation_preliminaire": "INVESTIR | APPROFONDIR | DECLINER",
    "score_ir": "<0-100>"
  },
  "presentation_entreprise": {
    "resume": "string — 2-3 phrases de présentation générale",
    "historique": {
      "resume": "string — 2 phrases sur le parcours",
      "jalons": [{"annee": "string", "evenement": "string"}]
    },
    "activites": {
      "resume": "string — 2 phrases sur l'activité principale",
      "produits_services": [{"nom": "string", "description": "string", "part_ca": "string"}]
    },
    "positionnement": "string — 2-3 phrases",
    "gouvernance": {
      "resume": "string — 2 phrases",
      "actionnariat": [{"nom": "string", "part": "string", "role": "string"}]
    },
    "effectifs": {
      "total": "string",
      "repartition": [{"departement": "string", "nombre": "string"}]
    }
  },
  "analyse_marche": {
    "resume": "string — 2-3 phrases de synthèse marché",
    "contexte_macro": {
      "resume": "string — 2 phrases sur l'environnement économique",
      "indicateurs": [{"label": "string — ex: PIB", "valeur": "string", "source": "string"}]
    },
    "taille_marche": {
      "tam": {"valeur": "string", "source": "string"},
      "sam": {"valeur": "string", "source": "string"},
      "som": {"valeur": "string", "source": "string"}
    },
    "dynamiques": {
      "croissance": "string — 1-2 phrases",
      "tendances": ["string — tendance clé"],
      "reglementation": "string — 1-2 phrases"
    },
    "concurrence": {
      "resume": "string — 2 phrases sur le paysage",
      "principaux_concurrents": [{"nom": "string", "positionnement": "string", "taille": "string"}]
    },
    "avantages_competitifs": ["string — 1 avantage par item"]
  },
  "modele_economique": {
    "resume": "string — 2-3 phrases",
    "proposition_valeur": "string — 2 phrases",
    "sources_revenus": [{"source": "string", "description": "string", "part_ca": "string"}],
    "structure_couts": {
      "resume": "string — 2 phrases",
      "postes_principaux": [{"poste": "string", "montant": "string", "part": "string"}]
    },
    "avantages_competitifs": ["string"],
    "scalabilite": "string — 2-3 phrases"
  },
  "analyse_financiere": {
    "resume": "string — 2-3 phrases de synthèse financière SANS chiffres",
    "historique": {
      "commentaire": "string — 2 phrases d'analyse qualitative",
      "tableau": [
        {"annee": "string", "ca": "string", "marge_brute": "string", "ebitda": "string", "resultat_net": "string"}
      ]
    },
    "projections": {
      "commentaire": "string — 2 phrases sur les hypothèses",
      "tableau": [
        {"annee": "string", "ca": "string", "marge_brute": "string", "ebitda": "string", "resultat_net": "string"}
      ]
    },
    "ratios_cles": [
      {"ratio": "string — ex: Marge brute", "valeur": "string — ex: 42%", "benchmark": "string — ex: 35-45% secteur", "verdict": "string — Bon | Moyen | Faible"}
    ],
    "besoins_financement": {
      "bfr": "string", "capex": "string", "dette": "string"
    },
    "qualite_donnees": "string — 2 phrases"
  },
  "valorisation": {
    "resume": "string — 2-3 phrases de synthèse SANS chiffres",
    "methodes_utilisees": ["DCF", "Multiples EBITDA", "Multiples CA"],
    "resultats": [
      {"methode": "string", "valeur_basse": "string", "valeur_haute": "string", "valeur_retenue": "string"}
    ],
    "fourchette_valorisation": "string",
    "valeur_mediane": "string",
    "parametres": [
      {"parametre": "string — ex: WACC", "valeur": "string", "justification": "string"}
    ],
    "note_valorisation": "string — analyse qualitative, 3-4 phrases",
    "sensitivity_summary": "string — 2 phrases"
  }
}`;

const MEMO_SCHEMA_PART2 = `{
  "besoins_financement": {
    "resume": "string — 2-3 phrases expliquant le besoin global",
    "montant_recherche": "string",
    "utilisation_fonds": [{"poste": "string", "montant": "string", "pourcentage": "string", "justification": "string"}],
    "calendrier_deploiement": {
      "resume": "string — 2 phrases sur le calendrier",
      "phases": [{"phase": "string", "periode": "string", "montant": "string", "objectif": "string"}]
    },
    "retour_attendu": "string — 2-3 phrases sur le ROI attendu"
  },
  "equipe_et_gouvernance": {
    "resume": "string — 2-3 phrases d'évaluation globale de l'équipe",
    "fondateurs": [{"nom": "string", "role": "string", "parcours": "string — 2-3 phrases de background", "apport_cle": "string"}],
    "management": {
      "resume": "string — 2 phrases",
      "postes_cles": [{"poste": "string", "nom": "string", "experience": "string"}]
    },
    "conseil_administration": "string — 2 phrases",
    "points_forts_equipe": ["string — 1 point fort par item, phrase complète explicative"],
    "gaps_identifies": ["string — 1 gap par item, avec recommandation"]
  },
  "esg_impact": {
    "resume": "string — 2-3 phrases de synthèse impact",
    "odd_alignement": [{"odd_numero": "string", "odd_titre": "string", "contribution": "string — 2 phrases explicatives", "indicateur": "string"}],
    "impact_social": {
      "resume": "string — 2-3 phrases",
      "indicateurs": [{"label": "string", "valeur": "string", "cible": "string"}]
    },
    "impact_environnemental": {
      "resume": "string — 2 phrases",
      "indicateurs": [{"label": "string", "valeur": "string"}]
    },
    "conformite_ifc_ps": "string — 2-3 phrases",
    "plan_esg": ["string — action ESG concrète planifiée"]
  },
  "analyse_risques": {
    "resume": "string — 2-3 phrases de synthèse du profil de risque global",
    "risques_identifies": [
      {
        "categorie": "string — Marché | Opérationnel | Financier | Réglementaire | ESG | Gouvernance",
        "titre": "string — nom court du risque",
        "description": "string — 2-3 phrases explicatives",
        "probabilite": "faible | moyenne | elevee",
        "impact": "faible | moyen | fort",
        "mitigation": "string — 2-3 phrases de mesures",
        "source": "string"
      }
    ],
    "matrice_risque_synthese": "string — 3-4 phrases de synthèse : profil de risque global, risques deal-breakers, risques gérables"
  },
  "these_investissement": {
    "resume": "string — 2-3 phrases : pourquoi ce dossier mérite attention",
    "these_positive": {
      "synthese": "string — 3-4 phrases résumant la thèse positive",
      "arguments": [{"argument": "string — titre court", "explication": "string — 2-3 phrases détaillées avec preuves"}]
    },
    "these_negative": {
      "synthese": "string — 2-3 phrases résumant les réserves",
      "arguments": [{"argument": "string — titre court", "explication": "string — 2-3 phrases détaillées"}]
    },
    "facteurs_cles_succes": ["string — 1 facteur par item, phrase complète"],
    "catalyseurs": ["string — événement concret qui déclencherait la croissance"],
    "scenarios_sortie": {
      "resume": "string — 2 phrases",
      "options": [{"type": "string — Cession stratégique | MBO | IPO | Secondaire", "horizon": "string", "multiple_sortie": "string", "commentaire": "string"}]
    }
  },
  "structure_proposee": {
    "resume": "string — 2-3 phrases résumant la structure recommandée",
    "instrument": "string",
    "montant": "string",
    "dilution_estimee": "string",
    "droits_investisseur": [{"droit": "string", "detail": "string"}],
    "conditions_precedentes": [{"condition": "string", "justification": "string"}]
  },
  "recommandation_finale": {
    "verdict": "INVESTIR | APPROFONDIR | DECLINER",
    "resume": "string — 2-3 phrases de recommandation directe",
    "justification": {
      "arguments_pour": ["string — argument clé en faveur"],
      "arguments_contre": ["string — réserve importante"],
      "facteur_decisif": "string — 2-3 phrases : ce qui fait pencher la balance"
    },
    "conditions": ["string — condition pour que le verdict soit valide"],
    "prochaines_etapes": [{"etape": "string", "responsable": "string", "delai": "string"}]
  },
  "annexes": {
    "sources_donnees": ["string — document analysé"],
    "hypotheses_cles": [{"hypothese": "string", "base": "string — sur quoi elle repose"}],
    "glossaire": [{"terme": "string", "definition": "string"}]
  }
}`;

/** Upsert the enterprise_modules row for investment_memo with checkpoint data */
async function updateMemoModuleState(
  enterpriseId: string,
  moduleData: Record<string, any>,
  progress: number,
  status: string,
) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const svc = createClient(supabaseUrl, serviceKey);

  const mappedStatus = status === "completed" ? "completed"
    : status === "not_started" ? "not_started" : "in_progress";

  await svc.from("enterprise_modules").upsert({
    enterprise_id: enterpriseId,
    module: "investment_memo",
    data: moduleData,
    progress,
    status: mappedStatus,
  }, { onConflict: "enterprise_id,module" });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    console.log("[generate-investment-memo] v5 loaded — 2-pass checkpoint");
    const ctx = await verifyAndGetContext(req);
    const ent = ctx.enterprise;
    const requestId = crypto.randomUUID();
    const startedAt = new Date().toISOString();

    // Check for existing checkpoint in enterprise_modules
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const svc = createClient(supabaseUrl, serviceKey);
    const { data: moduleRow } = await svc.from("enterprise_modules")
      .select("data, status")
      .eq("enterprise_id", ctx.enterprise_id)
      .eq("module", "investment_memo")
      .single();

    const moduleData = moduleRow?.data as Record<string, any> | null;
    const hasCheckpoint = moduleData?.phase === "part1_completed" && moduleData?.part1;

    let part1: any = null;

    // ═══════ Fetch deliverables & build context (needed for both passes) ═══════
    const { data: existingDeliverables } = await ctx.supabase
      .from("deliverables")
      .select("type, data")
      .eq("enterprise_id", ctx.enterprise_id);

    const getDelivData = (type: string) => {
      const d = existingDeliverables?.find((del: any) => del.type === type);
      return d?.data && typeof d.data === "object" ? d.data : null;
    };

    const bmcData = getDelivData("bmc_analysis");
    const sicData = getDelivData("sic_analysis");
    const inputsData = getDelivData("inputs_data");
    const frameworkData = getDelivData("framework_data");
    const planOvoData = getDelivData("plan_ovo");
    const valuationData = getDelivData("valuation");
    const oddData = getDelivData("odd_analysis");
    const diagnosticData = getDelivData("diagnostic_data");

    const knowledgeBase = getFinancialKnowledgePrompt(ent.country || "cote_d_ivoire", ent.sector || "services_b2b", true);
    const valuationBenchmarks = getValuationBenchmarksPrompt();
    const donorCriteria = getDonorCriteriaPrompt();
    const ragContext = await buildRAGContext(
      ctx.supabase, ent.country || "", ent.sector || "", ["benchmarks", "fiscal", "secteur"], "investment_memo"
    );

    const delivSummary: string[] = [];
    if (bmcData) delivSummary.push(`BMC:\n${JSON.stringify(bmcData).substring(0, 4000)}`);
    if (sicData) delivSummary.push(`SIC:\n${JSON.stringify(sicData).substring(0, 3000)}`);
    if (inputsData) delivSummary.push(`INPUTS:\n${JSON.stringify(inputsData).substring(0, 5000)}`);
    if (frameworkData) delivSummary.push(`FRAMEWORK:\n${JSON.stringify(frameworkData).substring(0, 5000)}`);
    if (planOvoData) delivSummary.push(`PLAN OVO:\n${JSON.stringify(planOvoData).substring(0, 8000)}`);
    if (valuationData) delivSummary.push(`VALORISATION:\n${JSON.stringify(valuationData).substring(0, 5000)}`);
    if (oddData) delivSummary.push(`ODD:\n${JSON.stringify(oddData).substring(0, 3000)}`);
    if (diagnosticData) delivSummary.push(`DIAGNOSTIC:\n${JSON.stringify(diagnosticData).substring(0, 3000)}`);

    const contextBlock = `ENTREPRISE : ${ent.name}
SECTEUR : ${ent.sector || "Non spécifié"}
PAYS : ${ent.country || "Côte d'Ivoire"}
EFFECTIFS : ${ent.employees_count || "Non spécifié"}
FORME JURIDIQUE : ${ent.legal_form || "Non spécifié"}
DESCRIPTION : ${ent.description || ""}

══════ LIVRABLES ══════
${delivSummary.join("\n\n")}

══════ CONNAISSANCES FINANCIÈRES ══════
${knowledgeBase}

══════ MULTIPLES VALORISATION ══════
${valuationBenchmarks}

══════ CRITÈRES BAILLEURS ══════
${donorCriteria}

${ragContext}`;

    const coachingContext = await getCoachingContext(ctx.supabase, ctx.enterprise_id);

    if (hasCheckpoint) {
      // ═══════ CAS A: Resume from checkpoint — run Pass 2 only ═══════
      console.log("Investment Memo — Resuming from checkpoint, running Pass 2/2...");
      part1 = moduleData!.part1;

      await updateMemoModuleState(ctx.enterprise_id, {
        ...moduleData,
        phase: "part2",
        request_id: requestId,
        started_at: startedAt,
        last_update_at: new Date().toISOString(),
      }, 60, "in_progress");

      const part1Summary = JSON.stringify({
        recommandation: part1.resume_executif?.recommandation_preliminaire,
        score: part1.resume_executif?.score_ir,
        valorisation: part1.valorisation?.fourchette_valorisation,
      });

      const prompt2 = `${contextBlock}

══════ RÉSUMÉ PASSE 1 ══════
${part1Summary}

══════ INSTRUCTIONS — PASSE 2/2 ══════
Rédige les sections 8 à 15 (besoins de financement → annexes).
La recommandation finale doit être COHÉRENTE avec le score IR (${part1.resume_executif?.score_ir || '?'}/100) et les risques identifiés.
Minimum 200 mots pour la thèse d'investissement et la recommandation finale.

Réponds en JSON selon ce schéma :
${MEMO_SCHEMA_PART2}`;

      const part2 = await callAI(injectGuardrails(MEMO_SYSTEM_PROMPT), prompt2 + coachingContext, 16384, SONNET_MODEL, 0.3);

      const mergedMemo = { ...part1, ...part2 };
      mergedMemo.score = part1.resume_executif?.score_ir || 0;

      await saveDeliverable(ctx.supabase, ctx.enterprise_id, "investment_memo", mergedMemo, "investment_memo");

      await updateMemoModuleState(ctx.enterprise_id, {
        phase: "completed",
        completed_at: new Date().toISOString(),
      }, 100, "completed");

      return jsonResponse({ success: true, data: mergedMemo, score: mergedMemo.score || 0 });

    } else {
      // ═══════ CAS B: First call — run Pass 1, checkpoint, return 202 ═══════
      console.log("Investment Memo — Pass 1/2...");

      await updateMemoModuleState(ctx.enterprise_id, {
        phase: "part1",
        request_id: requestId,
        started_at: startedAt,
      }, 10, "in_progress");

      const prompt1 = `${contextBlock}

══════ INSTRUCTIONS — PASSE 1/2 ══════
Rédige les sections 1 à 7 du mémo d'investissement (page de garde → valorisation).
La section valorisation doit CITER les résultats de l'agent Valuation, pas recalculer.
Chaque section narrative doit faire au minimum 200 mots.

Réponds en JSON selon ce schéma :
${MEMO_SCHEMA_PART1}`;

      try {
        part1 = await callAI(injectGuardrails(MEMO_SYSTEM_PROMPT), prompt1 + coachingContext, 16384, SONNET_MODEL, 0.3);
      } catch (e: any) {
        await updateMemoModuleState(ctx.enterprise_id, {
          phase: "failed",
          error: e.message || "Pass 1 failed",
          failed_at: new Date().toISOString(),
        }, 0, "not_started");
        throw e;
      }

      const score = part1.resume_executif?.score_ir || 0;

      // Save checkpoint IMMEDIATELY after AI call — before HTTP return
      // This is critical: the HTTP connection may already be dead at this point
      console.log("Investment Memo — Pass 1 AI done, saving checkpoint NOW...");
      try {
        await updateMemoModuleState(ctx.enterprise_id, {
          phase: "part1_completed",
          part1,
          score,
          part1_completed_at: new Date().toISOString(),
          request_id: requestId,
        }, 50, "in_progress");
        console.log("Investment Memo — Checkpoint saved successfully.");
      } catch (checkpointErr: any) {
        console.error("Investment Memo — CRITICAL: checkpoint save failed:", checkpointErr.message);
      }

      console.log("Investment Memo — Returning 202 (client may have disconnected, frontend will poll).");
      return new Response(JSON.stringify({
        success: true,
        processing: true,
        phase: "part1_completed",
        score,
        request_id: requestId,
      }), {
        status: 202,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

  } catch (e: any) {
    console.error("generate-investment-memo error:", e);
    return errorResponse(e.message || "Erreur", e.status || 500);
  }
});
