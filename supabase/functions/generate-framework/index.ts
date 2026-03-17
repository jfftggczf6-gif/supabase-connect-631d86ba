import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, errorResponse, jsonResponse, verifyAndGetContext, callAI, saveDeliverable, buildRAGContext, getFiscalParams } from "../_shared/helpers.ts";
import { normalizeFramework } from "../_shared/normalizers.ts";
import { fillFrameworkExcelTemplate } from "../_shared/framework-excel-template.ts";
import { getFinancialKnowledgePrompt } from "../_shared/financial-knowledge.ts";

const OPUS_MODEL = "claude-opus-4-20250514";

const SYSTEM_PROMPT = `Tu es un expert financier senior de niveau CFO/analyste institutionnel, certifié SYSCOHADA révisé (2017), spécialisé dans l'analyse et la modélisation financière des PME africaines (zones UEMOA/CEMAC). Tu produis des analyses financières institutionnelles de type "Framework d'Analyse Financière PME" sans aucune erreur de calcul.

═══════════════════════════════════════════════════════════
RÈGLE FONDAMENTALE — CASCADE P&L (à respecter ABSOLUMENT)
═══════════════════════════════════════════════════════════
Pour CHAQUE année projetée (an1 à an5), la cascade est IMMUABLE :

  CA Total
  - Coût des ventes (COGS = achats matières + charges variables)
  ═ Marge Brute  →  TOUJOURS ≤ CA
  - OPEX total (salaires, loyer, marketing, admin, assurances...)
  ═ EBITDA  →  peut être < 0 en phase démarrage
  - Dotations aux amortissements
  ═ EBIT (Résultat d'exploitation)
  - Charges financières nettes
  ═ EBT (Résultat avant IS)
  - IS (impôt uniquement si EBT > 0)
  ═ Résultat Net

CONTRAINTES ABSOLUES (violations = ERREUR BLOQUANTE) :
  ✅ Marge Brute = CA - COGS  (exactement, chaque année)
  ✅ EBITDA = Marge Brute - OPEX  (exactement, chaque année)
  ✅ Résultat Net ≤ EBITDA  (TOUJOURS — amort + intérêts + IS sont toujours soustraits)
  ✅ EBITDA ≤ Marge Brute  (TOUJOURS)
  ✅ Marge Brute ≤ CA  (TOUJOURS)
  ✅ IS = 0 si EBT ≤ 0  (pas d'impôt sur les pertes)
  ❌ JAMAIS : Résultat Net > EBITDA
  ❌ JAMAIS : EBITDA > Marge Brute
  ❌ JAMAIS : Marge Brute > CA
  ❌ JAMAIS : Marge Brute % > 100% ou < 0%

═══════════════════════════════════════════════════════════
MÉTHODOLOGIE DE PROJECTION (obligatoire)
═══════════════════════════════════════════════════════════
1. APPROCHE TOP-DOWN : Partir du marché adressable (TAM/SAM/SOM), appliquer parts de marché réalistes.
2. APPROCHE BOTTOM-UP : Valider par capacités de production, effectifs, contraintes opérationnelles.
3. Les projections DOIVENT être la moyenne pondérée des deux approches.
4. Ancrer an1 sur le CA réel des Inputs × (1 + taux de croissance justifié).

═══════════════════════════════════════════════════════════
FORMULES DE CALCUL EXACTES
═══════════════════════════════════════════════════════════
── CAGR ──
  CAGR = (Valeur_finale / Valeur_initiale)^(1/n) - 1
  n = nombre d'années entre les deux valeurs
  ⚠️ Si Valeur_initiale ≤ 0 → CAGR = null (non calculable)

── VAN (NPV) ──
  VAN = Σ(CF_t / (1+r)^t) - I₀   pour t = 1 à 5
  r = 12% (taux d'actualisation PME UEMOA)
  ⚠️ Si VAN > 0 → TRI doit être > 12% (cohérence obligatoire)

── TRI (IRR) ──
  TRI = taux r* qui annule la VAN (Newton-Raphson)
  → En décimal (0.18 = 18%)
  ⚠️ Si TRI < 0 ET VAN > 0 → ERREUR, recalculer avec seed différent

── DSCR ──
  DSCR = EBITDA_an1 / (Principal_annuel + Intérêts_annuels)
  Principal_annuel = Σ(Montant_prêt_i / Durée_i)
  Intérêts_annuels ≈ Σ(Montant_prêt_i × Taux_i × 0.6)  [encours moyen ≈ 60% du capital]
  ⚠️ Si EBITDA_an1 ≤ 0 → dscr = null
  ⚠️ Si aucune dette → dscr = null
  Seuils : > 1.5 = bon | 1.2-1.5 = acceptable | < 1.2 = risqué | < 1 = insolvabilité

── POINT MORT ──
  CA_point_mort = Charges_fixes / (1 - Taux_COGS)
  Taux_COGS = COGS / CA
  Mois = (CA_point_mort / CA_annuel) × 12

═══════════════════════════════════════════════════════════
BENCHMARKS SECTORIELS (zones UEMOA)
═══════════════════════════════════════════════════════════
  Restauration/Traiteur/Hôtellerie : Marge Brute 35-55% | EBITDA 8-18%
  Commerce alimentaire/distribution : Marge Brute 15-35% | EBITDA 3-10%
  Agroalimentaire/transformation : Marge Brute 30-50% | EBITDA 8-20%
  Services aux entreprises : Marge Brute 50-75% | EBITDA 15-30%
  Commerce général/détail : Marge Brute 20-40% | EBITDA 5-15%
  BTP/Construction : Marge Brute 20-40% | EBITDA 5-15%
  Industrie/Manufacture : Marge Brute 30-50% | EBITDA 8-20%
  Technologie/Digital : Marge Brute 60-85% | EBITDA 15-35%

═══════════════════════════════════════════════════════════
RÈGLES DE VALIDATION PROJECTION 5 ANS
═══════════════════════════════════════════════════════════
- Croissance CA > 30%/an pendant 3+ ans → JUSTIFIER explicitement ou réduire
- Marge EBITDA > benchmark sectoriel + 15pts → signaler comme optimiste
- projection_5ans.lignes : valeurs an1 à an5 TOUJOURS numériques (jamais string, jamais null)
- CAGR implicite CA (an1→an5) réaliste : 5-25% pour PME stable, jusqu'à 40% pour startup
- Les lignes "Marge Brute (%)" et "Marge EBITDA (%)" sont des pourcentages (ex: 40.5, pas 0.405)
- Résultat Net INFÉRIEUR ou ÉGAL à EBITDA pour chaque colonne an1-an5 SANS EXCEPTION

═══════════════════════════════════════════════════════════
COHÉRENCE CROISÉE OBLIGATOIRE
═══════════════════════════════════════════════════════════
- Les projections DOIVENT être cohérentes avec les données Inputs (compte de résultat réel)
- Si CA actuel (Inputs) = X, alors an1 ∈ [X × 0.9, X × 1.35] (sauf justification)
- Scénarios prudent/central/ambitieux : écarts proportionnels de ±15-25% sur le CA
- tresorerie_bfr.dscr doit respecter la formule ci-dessus
- Les ratios (marge_brute, marge_nette, etc.) doivent être cohérents avec les lignes de projection

IMPORTANT: Réponds UNIQUEMENT en JSON valide. Tous les montants dans la devise du pays, numériques sans formatage.`;

const userPrompt = (name: string, sector: string, country: string, docs: string, inputsData: any, bmcData: any, devise: string) => `
Réalise l'analyse financière complète (Framework PME) de "${name}" (Secteur: ${sector}, Pays: ${country}).

${inputsData?.compte_resultat ? `DONNÉES FINANCIÈRES (Module Inputs):\n${JSON.stringify(inputsData, null, 2)}` : "Aucune donnée financière structurée, estime à partir des documents."}
${bmcData ? `DONNÉES BMC:\n${JSON.stringify(bmcData, null, 2)}` : ""}
${docs ? `DOCUMENTS:\n${docs}` : ""}

Génère le framework d'analyse financière COMPLET en JSON avec TOUTES les sections suivantes:
{
  "score": <0-100>,
  "periode": "N-2 à N",
  "fiabilite": "Élevée|Moyenne|Faible",
  "devise": "${devise}",
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
- Tous les montants numériques SANS formatage (pas de séparateurs de milliers dans les champs numériques)

VALIDATION FINALE OBLIGATOIRE AVANT RÉPONSE (vérifier chaque point) :
1. Pour chaque colonne an1-an5 : Résultat Net ≤ EBITDA ≤ Marge Brute ≤ CA Total
2. Pour chaque colonne : Marge Brute = CA Total - COGS implicite (cohérent avec %)
3. Pour chaque colonne : EBITDA = Marge Brute × (1 - ratio OPEX/MB)
4. tresorerie_bfr.dscr = null si EBITDA an1 ≤ 0
5. Marge Brute % ∈ [0%, 100%] pour chaque colonne
6. Résultat Net an1 peut être négatif (phase démarrage) mais DOIT être < EBITDA an1
7. Cash-Flow Net ≥ Résultat Net (car dotations s'ajoutent)
8. Trésorerie Cumulée an(t) = Trésorerie Cumulée an(t-1) + Cash-Flow Net an(t)`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const ctx = await verifyAndGetContext(req);
    const ent = ctx.enterprise;
    const inputsData = ctx.deliverableMap["inputs_data"] || ctx.moduleMap["inputs"] || {};
    const bmcData = ctx.deliverableMap["bmc_analysis"] || ctx.moduleMap["bmc"] || null;

    // Warning: check if Inputs data contains real historical financials
    const isEstimation = inputsData?.estimation_sectorielle === true;
    const hasRealInputs = inputsData?.compte_resultat?.chiffre_affaires && inputsData.compte_resultat.chiffre_affaires > 0;
    if (!hasRealInputs) {
      console.warn("[generate-framework] WARNING: Inputs data is empty or missing compte_resultat. Projections will not be anchored to real historical data.");
    }

    // RAG: enrichir avec benchmarks sectoriels et données fiscales
    const ragContext = await buildRAGContext(ctx.supabase, ent.country || "", ent.sector || "", ["benchmarks", "fiscal", "bailleurs", "secteurs"]);
    const fiscalParams = getFiscalParams(ent.country || "Côte d'Ivoire");

    // Inject centralized financial knowledge (without examples to save context)
    const countryKey = (ent.country || "Côte d'Ivoire").toLowerCase().replace(/[\s']/g, "_");
    const sectorKey = (ent.sector || "services_b2b").toLowerCase().replace(/[\s\-\/]/g, "_");
    const knowledgeBase = getFinancialKnowledgePrompt(countryKey, sectorKey, false);

    // Inject real product data from Inputs for anchored projections
    let produitsContext = '';
    if (inputsData?.produits_services && Array.isArray(inputsData.produits_services) && inputsData.produits_services.length > 0) {
      const prodLines = inputsData.produits_services.map((p: any, i: number) =>
        `  ${i+1}. ${p.nom} (${p.type || 'Produit'}) : prix=${p.prix_unitaire || 0} ${fiscalParams.devise}, coût=${p.cout_unitaire || 0}, marge=${p.marge_pct || 'N/A'}%, unité=${p.unite || 'unité'}, source=${p.source || 'document'}`
      ).join('\n');
      produitsContext = `\n\nPRODUITS/SERVICES RÉELS (source documents Inputs — utiliser ces marges pour les projections) :\n${prodLines}\nUtilise ces marges RÉELLES par produit pour calculer la Marge Brute projetée. Ne remplace PAS ces données par des benchmarks sectoriels.`;
    }

    // Inject historique 3 ans from Inputs for real trend analysis
    let historiqueContext = '';
    if (inputsData?.historique_3ans && typeof inputsData.historique_3ans === 'object') {
      const h = inputsData.historique_3ans;
      const years = ['n_moins_2', 'n_moins_1', 'n'];
      const lines = years.map(y => {
        const yr = h[y];
        if (!yr || yr.ca_total === 0) return null;
        return `  ${y.toUpperCase()}: CA=${yr.ca_total || 0}, Coûts var=${yr.couts_variables || 0}, Charges fixes=${yr.charges_fixes || 0}, Rés. exploit.=${yr.resultat_exploitation || 0}, Rés. net=${yr.resultat_net || 0}, Trésorerie=${yr.tresorerie || 0}, Employés=${yr.nombre_employes || 0}`;
      }).filter(Boolean);
      if (lines.length > 0) {
        historiqueContext = `\n\nHISTORIQUE FINANCIER 3 ANS (données réelles extraites des documents — utiliser pour les ratios historiques et ancrer les projections) :\n${lines.join('\n')}`;
      }
    }

    // Inject CAPEX réel from Inputs
    let capexContext = '';
    if (inputsData?.investissements && Array.isArray(inputsData.investissements) && inputsData.investissements.length > 0) {
      const lines = inputsData.investissements.map((inv: any, i: number) =>
        `  ${i+1}. ${inv.nature}: ${inv.montant || 0} ${fiscalParams.devise}, année ${inv.annee_achat || 'N/A'}, amort. ${inv.duree_amortissement_ans || 'N/A'} ans`
      ).join('\n');
      capexContext = `\n\nCAPEX RÉEL (source documents — utiliser pour le calcul VAN/TRI) :\n${lines}`;
    }

    // Inject financement réel from Inputs
    let financementContext = '';
    if (inputsData?.financement) {
      const fin = inputsData.financement;
      const parts = [];
      if (fin.apports_capital > 0) parts.push(`  Capital: ${fin.apports_capital} ${fiscalParams.devise}`);
      if (fin.subventions > 0) parts.push(`  Subventions: ${fin.subventions} ${fiscalParams.devise}`);
      if (fin.prets && Array.isArray(fin.prets) && fin.prets.length > 0) {
        fin.prets.forEach((p: any) => {
          parts.push(`  Prêt ${p.source}: ${p.montant} ${fiscalParams.devise} à ${p.taux_pct}% sur ${p.duree_mois} mois (différé ${p.differe_mois || 0} mois)`);
        });
      }
      if (parts.length > 0) {
        financementContext = `\n\nFINANCEMENT RÉEL (source documents — utiliser pour le calcul DSCR) :\n${parts.join('\n')}`;
      }
    }

    // Inject BFR réel from Inputs
    let bfrContext = '';
    if (inputsData?.bfr && typeof inputsData.bfr === 'object') {
      const b = inputsData.bfr;
      const parts = [];
      if (b.delai_clients_jours > 0) parts.push(`  DSO clients: ${b.delai_clients_jours} jours`);
      if (b.delai_fournisseurs_jours > 0) parts.push(`  DPO fournisseurs: ${b.delai_fournisseurs_jours} jours`);
      if (b.stock_moyen_jours > 0) parts.push(`  Rotation stock: ${b.stock_moyen_jours} jours`);
      if (b.tresorerie_depart > 0) parts.push(`  Trésorerie de départ: ${b.tresorerie_depart} ${fiscalParams.devise}`);
      if (parts.length > 0) {
        bfrContext = `\n\nBFR / TRÉSORERIE (source documents — utiliser pour les projections trésorerie) :\n${parts.join('\n')}`;
      }
    }

    // Inject hypothèses de croissance from Inputs
    let hypothesesContext = '';
    if (inputsData?.hypotheses_croissance && typeof inputsData.hypotheses_croissance === 'object') {
      const hc = inputsData.hypotheses_croissance;
      const parts = [];
      if (hc.objectifs_ca && Array.isArray(hc.objectifs_ca) && hc.objectifs_ca.length > 0) {
        parts.push(`  Objectifs CA: ${hc.objectifs_ca.map((o: any) => `${o.annee}=${o.montant}`).join(', ')}`);
      }
      if (hc.taux_marge_brute_cible > 0) parts.push(`  Marge brute cible: ${hc.taux_marge_brute_cible}%`);
      if (hc.inflation_annuelle > 0) parts.push(`  Inflation: ${hc.inflation_annuelle}%`);
      if (hc.croissance_volumes_annuelle > 0) parts.push(`  Croissance volumes: ${hc.croissance_volumes_annuelle}%`);
      if (hc.taux_is > 0) parts.push(`  Taux IS: ${hc.taux_is}%`);
      if (parts.length > 0) {
        hypothesesContext = `\n\nHYPOTHÈSES DE CROISSANCE DE L'ENTREPRENEUR (source documents — ancrer les projections sur ces objectifs) :\n${parts.join('\n')}`;
      }
    }

    // Inject coûts détaillés from Inputs
    let coutsContext = '';
    if (inputsData?.couts_variables && Array.isArray(inputsData.couts_variables) && inputsData.couts_variables.length > 0) {
      coutsContext += `\n\nCOÛTS VARIABLES DÉTAILLÉS (source documents) :\n${inputsData.couts_variables.map((c: any) => `  - ${c.poste}: ${c.montant_annuel || c.montant_mensuel * 12} ${fiscalParams.devise}/an`).join('\n')}`;
    }
    if (inputsData?.couts_fixes && Array.isArray(inputsData.couts_fixes) && inputsData.couts_fixes.length > 0) {
      coutsContext += `\n\nCOÛTS FIXES DÉTAILLÉS (source documents) :\n${inputsData.couts_fixes.map((c: any) => `  - ${c.poste}: ${c.montant_annuel || c.montant_mensuel * 12} ${fiscalParams.devise}/an`).join('\n')}`;
    }

    // Inject equipe from Inputs
    let equipeContext = '';
    if (inputsData?.equipe && Array.isArray(inputsData.equipe) && inputsData.equipe.length > 0) {
      equipeContext = `\n\nÉQUIPE DÉTAILLÉE (source documents) :\n${inputsData.equipe.map((e: any) => `  - ${e.poste}: ${e.nombre} personne(s), salaire ${e.salaire_mensuel || 'N/A'} ${fiscalParams.devise}/mois`).join('\n')}`;
    }

    // Add estimation warning if inputs are sectoral estimates
    const estimationWarning = isEstimation
      ? `\n\n⚠️ ATTENTION — MODE ESTIMATION SECTORIELLE ⚠️\nLes données d'entrée (Inputs) sont des ESTIMATIONS SECTORIELLES, PAS des données financières réelles. Les projections que tu génères doivent être marquées comme INDICATIVES. Utilise les benchmarks sectoriels mais précise clairement que ces chiffres sont des estimations. Ajoute "estimation_sectorielle: true" dans ta réponse JSON et mentionne dans les hypothèses que les projections sont basées sur des estimations sectorielles.\n`
      : '';

    const enrichedPrompt = userPrompt(
      ent.name, ent.sector || "", ent.country || "Côte d'Ivoire", ctx.documentContent, inputsData, bmcData, fiscalParams.devise
    ) + estimationWarning + produitsContext + historiqueContext + capexContext + financementContext + bfrContext + hypothesesContext + coutsContext + equipeContext + ragContext + `\n\nPARAMÈTRES FISCAUX:\n${JSON.stringify(fiscalParams)}`;

    const enrichedSystemPrompt = SYSTEM_PROMPT + "\n\n" + knowledgeBase;

    const rawData = await callAI(enrichedSystemPrompt, enrichedPrompt, 16384, OPUS_MODEL);
    const data = normalizeFramework(rawData);
    
    // Propagate estimation flag
    if (isEstimation) {
      data.estimation_sectorielle = true;
      if (!data.hypotheses) data.hypotheses = [];
      data.hypotheses.unshift("⚠️ Projections indicatives — basées sur des estimations sectorielles, pas sur des données financières réelles.");
    }

    await saveDeliverable(ctx.supabase, ctx.enterprise_id, "framework_data", data, "framework");

    // ── Pré-générer et stocker le template Excel rempli ──
    let excelGenerated = false;
    try {
      const xlsxBytes = await fillFrameworkExcelTemplate(data, ent.name, ctx.supabase);
      let binary = '';
      for (let i = 0; i < xlsxBytes.byteLength; i++) binary += String.fromCharCode(xlsxBytes[i]);
      const xlsxB64 = btoa(binary);

      await ctx.supabase.from("deliverables").upsert({
        enterprise_id: ctx.enterprise_id,
        type: "framework_excel",
        data: { generated_at: new Date().toISOString(), template: 'Framework_Analyse_PME_Cote_Ivoire.xlsx', size_bytes: xlsxBytes.byteLength },
        html_content: xlsxB64,
        score: data.score || null,
        ai_generated: true,
        version: 1,
      }, { onConflict: "enterprise_id,type" });

      excelGenerated = true;
      console.log(`[generate-framework] ✅ Template Excel rempli stocké (${xlsxBytes.byteLength} bytes)`);
    } catch (xlsxErr: any) {
      console.warn("[generate-framework] Excel filling failed (non-blocking):", xlsxErr?.message);
    }

    return jsonResponse({ success: true, data, score: data.score, excel_generated: excelGenerated });
  } catch (e: any) {
    console.error("generate-framework error:", e);
    return errorResponse(e.message || "Erreur inconnue", e.status || 500);
  }
});
