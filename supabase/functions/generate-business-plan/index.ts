import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, errorResponse, jsonResponse, verifyAndGetContext, callAI, saveDeliverable } from "../_shared/helpers.ts";

const SYSTEM_PROMPT = `Tu es un rédacteur expert de Business Plans pour les PME africaines cherchant des financements. Tu rédiges des BP professionnels, convaincants et structurés selon les standards des investisseurs.
IMPORTANT: Réponds UNIQUEMENT en JSON valide.`;

const userPrompt = (name: string, sector: string, country: string, docs: string, allData: any) => `
Rédige le Business Plan complet de "${name}" (Secteur: ${sector}, Pays: ${country}).

TOUTES LES DONNÉES DISPONIBLES:
${JSON.stringify(allData, null, 2)}
${docs ? `\nDOCUMENTS:\n${docs}` : ""}

Génère le Business Plan en JSON:
{
  "score": <0-100>,
  "resume_executif": {
    "accroche": "<phrase d'accroche percutante>",
    "probleme": "<problème adressé>",
    "solution": "<solution proposée>",
    "marche": "<taille et opportunité du marché>",
    "modele_economique": "<comment l'entreprise gagne de l'argent>",
    "equipe": "<forces de l'équipe>",
    "besoin_financement": "<montant et utilisation>",
    "vision": "<vision à 5 ans>"
  },
  "presentation_entreprise": {
    "historique": "<histoire de l'entreprise>",
    "mission_vision": "<mission et vision>",
    "statut_juridique": "<forme juridique>",
    "equipe_dirigeante": "<présentation de l'équipe>",
    "valeurs": ["<valeur>"]
  },
  "analyse_marche": {
    "taille_marche": "<données chiffrées>",
    "tendances": ["<tendance>"],
    "segments_cibles": ["<segment>"],
    "concurrence": [{"concurrent": "<nom>", "forces": "<forces>", "faiblesses": "<faiblesses>"}],
    "avantages_concurrentiels": ["<avantage>"],
    "positionnement": "<positionnement stratégique>"
  },
  "strategie_commerciale": {
    "produits_services": [{"nom": "<nom>", "description": "<desc>", "prix": "<prix>"}],
    "strategie_prix": "<approche tarifaire>",
    "canaux_distribution": ["<canal>"],
    "plan_marketing": "<stratégie marketing>",
    "objectifs_vente": "<objectifs chiffrés>"
  },
  "plan_operationnel": {
    "processus_cles": ["<processus>"],
    "ressources_necessaires": ["<ressource>"],
    "plan_rh": "<plan de recrutement>",
    "partenariats": ["<partenariat stratégique>"],
    "calendrier_mise_en_oeuvre": [{"etape": "<étape>", "delai": "<quand>"}]
  },
  "plan_financier_resume": {
    "investissement_initial": "<montant>",
    "ca_previsionnel_3ans": "<N+1, N+2, N+3>",
    "point_equilibre": "<quand>",
    "rentabilite": "<marge nette attendue>",
    "besoin_financement": "<montant détaillé>",
    "utilisation_fonds": [{"poste": "<poste>", "montant": "<montant>", "pourcentage": <number>}]
  },
  "impact_social": {
    "emplois_crees": "<nombre>",
    "impact_communaute": "<description>",
    "odd_vises": ["<ODD>"],
    "indicateurs_impact": ["<indicateur>"]
  },
  "risques_et_mitigations": [
    {"risque": "<risque>", "probabilite": "Élevée|Moyenne|Faible", "mitigation": "<action>"}
  ],
  "conclusion": "<conclusion convaincante pour les investisseurs>"
}`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const ctx = await verifyAndGetContext(req);
    const ent = ctx.enterprise;
    const allData = {
      bmc: ctx.deliverableMap["bmc_analysis"] || {},
      sic: ctx.deliverableMap["sic_analysis"] || {},
      inputs: ctx.deliverableMap["inputs_data"] || {},
      framework: ctx.deliverableMap["framework_data"] || {},
      diagnostic: ctx.deliverableMap["diagnostic_data"] || {},
      plan_ovo: ctx.deliverableMap["plan_ovo"] || {},
    };

    const data = await callAI(SYSTEM_PROMPT, userPrompt(
      ent.name, ent.sector || "", ent.country || "", ctx.documentContent, allData
    ));

    await saveDeliverable(ctx.supabase, ctx.enterprise_id, "business_plan", data, "business_plan");

    return jsonResponse({ success: true, data, score: data.score });
  } catch (e: any) {
    console.error("generate-business-plan error:", e);
    return errorResponse(e.message || "Erreur inconnue", e.status || 500);
  }
});
