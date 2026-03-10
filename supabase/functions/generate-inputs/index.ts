import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, errorResponse, jsonResponse, verifyAndGetContext, callAI, saveDeliverable, buildRAGContext, getFiscalParams } from "../_shared/helpers.ts";
import { normalizeInputs } from "../_shared/normalizers.ts";

const OPUS_MODEL = "claude-opus-4-20250514";

const SYSTEM_PROMPT = `Tu es un analyste financier senior expert, certifié SYSCOHADA révisé (2017), spécialisé PME africaines (zones UEMOA/CEMAC).

EXPERTISE ET MÉTHODOLOGIE:
1. ANALYSE HORIZONTALE: Calcule l'évolution N/N-1 et N/N-2 pour chaque poste du compte de résultat et du bilan.
2. ANALYSE VERTICALE: Exprime chaque poste en % du CA (compte de résultat) ou en % du total actif/passif (bilan).
3. RATIOS FINANCIERS: Calcule avec précision selon les formules SYSCOHADA:
   - Marge brute = (CA - Achats consommés) / CA × 100
   - EBITDA = Résultat d'exploitation + Dotations aux amortissements
   - Marge EBITDA = EBITDA / CA × 100
   - BFR = (Stocks + Créances clients) - Fournisseurs
   - DSO = (Créances clients / CA) × 365
   - DPO = (Fournisseurs / Achats) × 365
   - Rotation stocks = (Stocks / Achats) × 365
   - Ratio courant = Actif circulant / Passif circulant
   - Taux d'endettement = Dettes totales / Total passif × 100
   - CAF = Résultat net + Dotations - Reprises
   - DSCR = CAF / Service de la dette annuel

4. BENCHMARKS SECTORIELS: Compare systématiquement chaque ratio aux benchmarks du secteur en Afrique de l'Ouest. Signale tout écart > 20% par rapport au benchmark.

5. COHÉRENCE DES DONNÉES: Vérifie que Total Actif = Total Passif, que le résultat net est cohérent avec le résultat d'exploitation moins les charges financières et l'impôt.

IMPORTANT: Réponds UNIQUEMENT en JSON valide. Tous les montants en FCFA, sans séparateurs de milliers dans les champs numériques. Sois extrêmement précis et détaillé dans tes calculs.`;

const userPrompt = (name: string, sector: string, country: string, docs: string, bmcData: any) => `
Réalise le FRAMEWORK D'ANALYSE FINANCIÈRE PME complet pour "${name}" (Secteur: ${sector}, Pays: ${country}).

${bmcData?.canvas ? `DONNÉES BMC:\n${JSON.stringify(bmcData, null, 2)}` : ""}
${docs ? `DOCUMENTS FINANCIERS:\n${docs}` : ""}

Génère le framework complet en JSON:
{
  "score": <0-100 score d'investissabilité>,
  "periode": "<ex: Année N (Source Excel 2024)>",
  "devise": "FCFA",
  "fiabilite": "<Élevée|Moyenne|Faible>",

  "kpis": {
    "marge_ebitda": "<xx%>",
    "ca_annee_n": <number>,
    "ebitda": <number>,
    "ca_an5_projete": <number>
  },

  "compte_resultat": {
    "chiffre_affaires": <number>,
    "achats_matieres": <number>,
    "charges_personnel": <number>,
    "charges_externes": <number>,
    "dotations_amortissements": <number>,
    "resultat_exploitation": <number>,
    "charges_financieres": <number>,
    "resultat_net": <number>
  },

  "bilan": {
    "actif": {
      "immobilisations": <number>,
      "stocks": <number>,
      "creances_clients": <number>,
      "tresorerie": <number>,
      "total_actif": <number>
    },
    "passif": {
      "capitaux_propres": <number>,
      "dettes_lt": <number>,
      "dettes_ct": <number>,
      "fournisseurs": <number>,
      "total_passif": <number>
    }
  },

  "alertes": [
    {"message": "<alerte>", "detail": "<explication>"}
  ],

  "croisements_bmc_fin": [
    {"bloc_bmc": "<ex: Flux de revenus>", "titre": "<ex: Export B2B Europe>", "recommandation": "<détail>"}
  ],

  "indicateurs_cles": {
    "marge_brute": "<xx%>",
    "charges_fixes_ca": "<xx%>",
    "masse_salariale_ca": "<xx%>"
  },

  "verdict_indicateurs": "<verdict analyste sur indicateurs>",

  "ratios_historiques": [
    {"ratio": "<nom>", "n_moins_2": "<val>", "n_moins_1": "<val>", "n": "<val>", "benchmark": "<val>"}
  ],

  "tresorerie_bfr": {
    "tresorerie_nette": <number>,
    "cashflow_operationnel": <number>,
    "caf": <number>,
    "dscr": "<x.x>",
    "composantes": [
      {"indicateur": "<DSO|DPO|Stock jours|BFR/CA|Dette/EBITDA>", "valeur": "<val>", "benchmark": "<val>"}
    ],
    "verdict": "<verdict analyste trésorerie>"
  },

  "sante_financiere": {
    "resume_chiffres": ["<CA: xxx FCFA>", "<Marge brute: xx%>"],
    "forces": ["<force>"],
    "faiblesses": ["<faiblesse>"]
  },

  "analyse_marge": {
    "verdict": "<verdict sur la création de marge>",
    "activites": [
      {"nom": "<activité>", "ca": <number>, "marge_brute": <number>, "marge_pct": "<xx%>", "classification": "RENFORCER|ARBITRER|RESTRUCTURER"}
    ],
    "message_cle": "<message clé>"
  },

  "projection_5ans": {
    "verdict": "<verdict analyste projections>",
    "lignes": [
      {"poste": "<CA Total|Marge Brute|EBITDA|Résultat Net|Cash-Flow Net|Trésorerie Cumulée>", "an1": <number>, "an2": <number>, "an3": <number>, "an4": <number>, "an5": <number>, "cagr": "<xx%>"}
    ],
    "marges": [
      {"poste": "<Marge Brute %|Marge EBITDA %>", "an1": "<xx%>", "an2": "<xx%>", "an3": "<xx%>", "an4": "<xx%>", "an5": "<xx%>"}
    ]
  },

  "seuil_rentabilite": {
    "ca_point_mort": <number>,
    "atteint_en": "<x.x mois>",
    "verdict": "<verdict>"
  },

  "scenarios": {
    "verdict": "<verdict comparatif scénarios>",
    "tableau": [
      {"indicateur": "<nom>", "prudent": "<val>", "central": "<val>", "ambitieux": "<val>"}
    ],
    "sensibilite": ["<CA +10%: EBITDA +xxx>"],
    "recommandation_scenario": "<scénario recommandé et pourquoi>"
  },

  "plan_action": [
    {"horizon": "COURT|MOYEN|LONG", "action": "<action détaillée>", "cout": "<montant>", "impact": "<impact attendu>"}
  ],

  "impact_attendu": {
    "ca_an5": "<montant>",
    "ebitda_an5": "<montant>",
    "marge_ebitda_an5": "<xx%>"
  },

  "besoins_financiers": {
    "capex_total": "<montant>",
    "timing": "<timing>"
  },

  "synthese_expert": "<paragraphe synthèse expert complet>",

  "analyse_scenarios_ia": "<commentaire IA sur scénarios>",

  "risques_cles": [
    {"risque": "<description>", "severite": "HAUTE|MOYENNE|FAIBLE"}
  ],

  "bailleurs_potentiels": [
    {"nom": "<nom bailleur>", "raison": "<pourquoi ce bailleur est adapté>"}
  ],

  "croisement_bmc_financiers": {
    "synthese": "<synthèse du croisement>",
    "incoherences": [
      {"severite": "CRITIQUE|HAUTE|MOYENNE", "description": "<description incohérence>"}
    ]
  },

  "donnees_manquantes": ["<donnée manquante>"],

  "hypotheses": ["<hypothèse utilisée>"],

  "effectifs": {
    "total": <number>,
    "cadres": <number>,
    "employes": <number>
  }
}`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const ctx = await verifyAndGetContext(req);
    const ent = ctx.enterprise;
    const bmcData = ctx.deliverableMap["bmc_analysis"] || {};
    const fiscalParams = getFiscalParams(ent.country || "Côte d'Ivoire");

    // RAG: enrichir avec benchmarks et données fiscales
    const ragContext = await buildRAGContext(ctx.supabase, ent.country || "", ent.sector || "", ["benchmarks", "fiscal", "bailleurs"]);

    const enrichedPrompt = userPrompt(
      ent.name, ent.sector || "", ent.country || "", ctx.documentContent, bmcData
    ) + ragContext + `\n\nPARAMÈTRES FISCAUX ${ent.country || "Côte d'Ivoire"}:\n${JSON.stringify(fiscalParams)}`;

    const rawData = await callAI(SYSTEM_PROMPT, enrichedPrompt, 16384, OPUS_MODEL);
    const data = normalizeInputs(rawData);

    await saveDeliverable(ctx.supabase, ctx.enterprise_id, "inputs_data", data, "inputs");

    return jsonResponse({ success: true, data, score: data.score });
  } catch (e: any) {
    console.error("generate-inputs error:", e);
    return errorResponse(e.message || "Erreur inconnue", e.status || 500);
  }
});
