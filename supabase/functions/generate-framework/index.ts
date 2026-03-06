import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, errorResponse, jsonResponse, verifyAndGetContext, callAI, saveDeliverable } from "../_shared/helpers.ts";
import { normalizeFramework } from "../_shared/normalizers.ts";

const SYSTEM_PROMPT = `Tu es un analyste financier expert spécialisé dans les PME africaines (zone UEMOA/CEMAC). Tu produis des analyses financières complètes de type "Framework d'Analyse Financière PME" avec ratios, projections 5 ans, scénarios, et plan d'action.
IMPORTANT: Réponds UNIQUEMENT en JSON valide. Tous les montants en FCFA.`;

const userPrompt = (name: string, sector: string, country: string, docs: string, inputsData: any, bmcData: any) => `
Réalise l'analyse financière complète (Framework PME) de "${name}" (Secteur: ${sector}, Pays: ${country}).

${inputsData?.compte_resultat ? `DONNÉES FINANCIÈRES (Module Inputs):\n${JSON.stringify(inputsData, null, 2)}` : "Aucune donnée financière structurée, estime à partir des documents."}
${bmcData ? `DONNÉES BMC:\n${JSON.stringify(bmcData, null, 2)}` : ""}
${docs ? `DOCUMENTS:\n${docs}` : ""}

Génère le framework d'analyse financière COMPLET en JSON avec TOUTES les sections suivantes:
{
  "score": <0-100>,
  "periode": "N-2 à N",
  "fiabilite": "Élevée|Moyenne|Faible",
  "devise": "FCFA",
  "kpis": {
    "marge_ebitda": "<xx%>",
    "ca_annee_n": <nombre>,
    "ebitda": <nombre>,
    "ca_an5_projete": <nombre>
  },
  "alertes": [
    {"message": "<alerte>", "detail": "<détail>"}
  ],
  "croisements_bmc_fin": [
    {"bloc_bmc": "<bloc>", "titre": "<titre>", "recommandation": "<recommandation détaillée>"}
  ],
  "indicateurs_cles": {
    "marge_brute": "<xx%>",
    "charges_fixes_ca": "<xx%>",
    "masse_salariale_ca": "<xx%>"
  },
  "verdict_indicateurs": "<verdict analyste détaillé>",
  "ratios_historiques": [
    {"ratio": "<nom>", "n_moins_2": "<val>", "n_moins_1": "<val>", "n": "<val>", "benchmark": "<benchmark secteur>"}
  ],
  "tresorerie_bfr": {
    "tresorerie_nette": <nombre>,
    "cashflow_operationnel": <nombre>,
    "caf": <nombre>,
    "dscr": "<x.xx>",
    "composantes": [
      {"indicateur": "<nom>", "valeur": "<val>", "benchmark": "<benchmark>"}
    ],
    "verdict": "<verdict analyste>"
  },
  "ratios": {
    "rentabilite": {
      "marge_brute": {"valeur": "<xx%>", "benchmark": "<secteur>", "verdict": "Bon|Moyen|Faible"},
      "marge_nette": {"valeur": "<xx%>", "benchmark": "<secteur>", "verdict": "Bon|Moyen|Faible"},
      "roe": {"valeur": "<xx%>", "benchmark": "<secteur>", "verdict": "Bon|Moyen|Faible"},
      "roa": {"valeur": "<xx%>", "benchmark": "<secteur>", "verdict": "Bon|Moyen|Faible"}
    },
    "liquidite": {
      "ratio_courant": {"valeur": "<x.x>", "seuil": ">1.5", "verdict": "Bon|Moyen|Faible"},
      "ratio_rapide": {"valeur": "<x.x>", "seuil": ">1.0", "verdict": "Bon|Moyen|Faible"},
      "bfr_jours": {"valeur": "<xx jours>", "commentaire": "<analyse>"}
    },
    "solvabilite": {
      "endettement": {"valeur": "<xx%>", "seuil": "<60%", "verdict": "Bon|Moyen|Faible"},
      "autonomie_financiere": {"valeur": "<xx%>", "seuil": ">40%", "verdict": "Bon|Moyen|Faible"},
      "capacite_remboursement": {"valeur": "<x.x ans>", "seuil": "<3 ans", "verdict": "Bon|Moyen|Faible"}
    },
    "activite": {
      "rotation_stocks": {"valeur": "<x.x>", "commentaire": "<analyse>"},
      "delai_clients": {"valeur": "<xx jours>", "commentaire": "<analyse>"},
      "delai_fournisseurs": {"valeur": "<xx jours>", "commentaire": "<analyse>"}
    }
  },
  "sante_financiere": {
    "resume_chiffres": ["<chiffre clé : valeur>"],
    "forces": ["<force financière>"],
    "faiblesses": ["<faiblesse financière>"]
  },
  "analyse_marge": {
    "verdict": "<verdict analyste sur la marge>",
    "activites": [
      {"nom": "<activité>", "ca": <nombre>, "marge_brute": <nombre>, "marge_pct": "<xx%>", "classification": "RENFORCER|ARBITRER|RESTRUCTURER"}
    ],
    "message_cle": "<message clé>"
  },
  "projection_5ans": {
    "verdict": "<verdict analyste>",
    "lignes": [
      {"poste": "CA Total", "an1": <n>, "an2": <n>, "an3": <n>, "an4": <n>, "an5": <n>, "cagr": "<xx%>"},
      {"poste": "Marge Brute", "an1": <n>, "an2": <n>, "an3": <n>, "an4": <n>, "an5": <n>},
      {"poste": "Marge Brute (%)", "an1": <n>, "an2": <n>, "an3": <n>, "an4": <n>, "an5": <n>},
      {"poste": "EBITDA", "an1": <n>, "an2": <n>, "an3": <n>, "an4": <n>, "an5": <n>},
      {"poste": "Marge EBITDA (%)", "an1": <n>, "an2": <n>, "an3": <n>, "an4": <n>, "an5": <n>},
      {"poste": "Résultat Net", "an1": <n>, "an2": <n>, "an3": <n>, "an4": <n>, "an5": <n>},
      {"poste": "Cash-Flow Net", "an1": <n>, "an2": <n>, "an3": <n>, "an4": <n>, "an5": <n>},
      {"poste": "Trésorerie Cumulée", "an1": <n>, "an2": <n>, "an3": <n>, "an4": <n>, "an5": <n>}
    ]
  },
  "seuil_rentabilite": {
    "ca_point_mort": <nombre>,
    "atteint_en": "<x.x mois>",
    "verdict": "<verdict>"
  },
  "scenarios": {
    "verdict": "<verdict analyste sur les scénarios>",
    "tableau": [
      {"indicateur": "Croissance CA (CAGR)", "prudent": "<val>", "central": "<val>", "ambitieux": "<val>"},
      {"indicateur": "CA An 5", "prudent": "<val>", "central": "<val>", "ambitieux": "<val>"},
      {"indicateur": "EBITDA An 5", "prudent": "<val>", "central": "<val>", "ambitieux": "<val>"},
      {"indicateur": "Marge EBITDA", "prudent": "<val>", "central": "<val>", "ambitieux": "<val>"},
      {"indicateur": "Résultat Net", "prudent": "<val>", "central": "<val>", "ambitieux": "<val>"},
      {"indicateur": "Trésorerie", "prudent": "<val>", "central": "<val>", "ambitieux": "<val>"},
      {"indicateur": "ROI", "prudent": "<val>", "central": "<val>", "ambitieux": "<val>"}
    ],
    "sensibilite": [
      "CA +10% : EBITDA: +<montant>",
      "Marge brute -10% : EBITDA: <montant>",
      "Charges fixes +10% : EBITDA: <montant>"
    ],
    "recommandation_scenario": "<recommandation>"
  },
  "plan_action": [
    {"horizon": "COURT", "action": "<action détaillée avec chiffres>", "cout": "<coût>", "impact": "<impact>"},
    {"horizon": "MOYEN", "action": "<action>", "cout": "<coût>", "impact": "<impact>"},
    {"horizon": "LONG", "action": "<action>", "cout": "<coût>", "impact": "<impact>"}
  ],
  "impact_attendu": {
    "ca_an5": "<montant FCFA>",
    "ebitda_an5": "<montant FCFA>",
    "marge_ebitda": "<xx%>"
  },
  "besoins_financiers": {
    "capex_total": "<montant>",
    "timing": "<timing>"
  },
  "synthese_expert": "<synthèse experte détaillée 3-5 lignes>",
  "score_investissabilite": <0-100>,
  "analyse_scenarios_ia": "<analyse détaillée des scénarios>",
  "risques_cles": [
    {"risque": "<risque>", "severite": "HAUTE|MOYENNE|CRITIQUE"}
  ],
  "bailleurs_potentiels": [
    {"nom": "<bailleur>", "raison": "<raison>"}
  ],
  "croisement_bmc_financiers": {
    "synthese": "<synthèse des incohérences>",
    "incoherences": [
      {"severite": "HAUTE|MOYENNE|CRITIQUE", "description": "<description>"}
    ]
  },
  "donnees_manquantes": ["<donnée manquante>"],
  "hypotheses": ["<hypothèse utilisée>"],
  "analyse_tendance": "<analyse de l'évolution sur 3 ans>",
  "points_forts": ["<point fort financier>"],
  "points_faibles": ["<point faible financier>"],
  "risques_financiers": ["<risque identifié>"],
  "recommandations": ["<recommandation financière>"],
  "capacite_investissement": "<analyse de la capacité d'investissement>",
  "besoin_financement": "<estimation du besoin de financement>"
}

INSTRUCTIONS CRITIQUES:
- projection_5ans.lignes DOIT avoir EXACTEMENT 8 lignes (CA Total, Marge Brute, Marge Brute %, EBITDA, Marge EBITDA %, Résultat Net, Cash-Flow Net, Trésorerie Cumulée)
- scenarios.tableau DOIT inclure la ligne ROI comme dernier indicateur
- sensibilite DOIT avoir EXACTEMENT 3 entrées (CA +10%, Marge brute -10%, Charges fixes +10%)
- plan_action doit avoir des actions avec horizon COURT, MOYEN ou LONG avec coûts chiffrés
- croisements_bmc_fin: analyse croisée entre le BMC et les données financières (min 3 croisements)
- Tous les montants numériques SANS formatage (pas de séparateurs de milliers dans les champs numériques)`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const ctx = await verifyAndGetContext(req);
    const ent = ctx.enterprise;
    const inputsData = ctx.deliverableMap["inputs_data"] || ctx.moduleMap["inputs"] || {};
    const bmcData = ctx.deliverableMap["bmc_analysis"] || ctx.moduleMap["bmc"] || null;

    const rawData = await callAI(SYSTEM_PROMPT, userPrompt(
      ent.name, ent.sector || "", ent.country || "Côte d'Ivoire", ctx.documentContent, inputsData, bmcData
    ));
    const data = normalizeFramework(rawData);

    await saveDeliverable(ctx.supabase, ctx.enterprise_id, "framework_data", data, "framework");

    return jsonResponse({ success: true, data, score: data.score });
  } catch (e: any) {
    console.error("generate-framework error:", e);
    return errorResponse(e.message || "Erreur inconnue", e.status || 500);
  }
});
