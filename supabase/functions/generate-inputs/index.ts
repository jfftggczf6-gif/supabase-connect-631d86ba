import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, errorResponse, jsonResponse, verifyAndGetContext, callAI, saveDeliverable, buildRAGContext, getFiscalParams } from "../_shared/helpers.ts";
import { normalizeInputs } from "../_shared/normalizers.ts";
import { validateAndEnrich } from "../_shared/post-validator.ts";
import { getExtractionKnowledgePrompt } from "../_shared/financial-knowledge.ts";

/* ───── Financial document detection ───── */

const FINANCIAL_KEYWORDS = [
  "chiffre d'affaires", "chiffre d affaires", "bilan", "compte de résultat",
  "p&l", "total actif", "total passif", "capitaux propres", "résultat net",
  "résultat d'exploitation", "trésorerie", "immobilisations", "amortissement",
  "charges d'exploitation", "produits d'exploitation", "soldes intermédiaires",
  "excédent brut", "valeur ajoutée", "marge brute", "dotations", "provisions",
  "dettes financières", "créances clients", "fournisseurs", "stock",
  "balance générale", "grand livre", "journal comptable",
];

const FINANCIAL_FILE_EXTENSIONS = [".xlsx", ".xls", ".csv"];

function hasFinancialContent(documentContent: string, coachUploads: any[]): boolean {
  // 1. Check if any coach upload is categorized as "inputs"
  if (coachUploads.some((u: any) => u.category === "inputs")) return true;

  // 2. Check for Excel/CSV files in document labels
  const lower = documentContent.toLowerCase();
  if (FINANCIAL_FILE_EXTENSIONS.some(ext => lower.includes(ext))) return true;

  // 3. Check for financial keywords (need at least 3 distinct matches to avoid false positives)
  let matches = 0;
  for (const kw of FINANCIAL_KEYWORDS) {
    if (lower.includes(kw)) matches++;
    if (matches >= 3) return true;
  }

  return false;
}

function buildEmptyInputs(name: string, sector: string, country: string, devise: string) {
  return {
    score: 0,
    periode: "N/A",
    devise,
    fiabilite: "Aucune",
    source_documents: [],
    informations_generales: {
      nom: name, forme_juridique: "", pays: country, ville: "",
      secteur: sector, date_creation: "", dirigeant: "", description_activite: "",
    },
    historique_3ans: {
      n_moins_2: { annee: 0, ca_total: 0, couts_variables: 0, charges_fixes: 0, resultat_exploitation: 0, resultat_net: 0, nombre_clients: 0, nombre_employes: 0, tresorerie: 0, ca_par_produit: [] },
      n_moins_1: { annee: 0, ca_total: 0, couts_variables: 0, charges_fixes: 0, resultat_exploitation: 0, resultat_net: 0, nombre_clients: 0, nombre_employes: 0, tresorerie: 0, ca_par_produit: [] },
      n:          { annee: 0, ca_total: 0, couts_variables: 0, charges_fixes: 0, resultat_exploitation: 0, resultat_net: 0, nombre_clients: 0, nombre_employes: 0, tresorerie: 0, ca_par_produit: [] },
    },
    compte_resultat: {
      chiffre_affaires: 0, achats_matieres: 0, charges_personnel: 0, charges_externes: 0,
      dotations_amortissements: 0, resultat_exploitation: 0, charges_financieres: 0, resultat_net: 0,
    },
    bilan: {
      actif: { immobilisations: 0, stocks: 0, creances_clients: 0, tresorerie: 0, total_actif: 0 },
      passif: { capitaux_propres: 0, dettes_lt: 0, dettes_ct: 0, fournisseurs: 0, total_passif: 0 },
    },
    produits_services: [],
    equipe: [],
    couts_variables: [],
    couts_fixes: [],
    bfr: { delai_clients_jours: 0, delai_fournisseurs_jours: 0, stock_moyen_jours: 0, tresorerie_depart: 0 },
    investissements: [],
    financement: { apports_capital: 0, subventions: 0, prets: [] },
    hypotheses_croissance: {
      objectifs_ca: [], taux_marge_brute_cible: 0, taux_marge_operationnelle_cible: 0,
      inflation_annuelle: 0, augmentation_prix_annuelle: 0, croissance_volumes_annuelle: 0, taux_is: 0,
    },
    effectifs: { total: 0, cadres: 0, employes: 0 },
    kpis: { marge_brute_pct: "N/A", marge_nette_pct: "N/A", ratio_endettement_pct: "N/A" },
    donnees_manquantes: ["Aucun document financier uploadé — veuillez uploader le template Analyse Financière Excel"],
    hypotheses: [],
  };
}

/* ───── Prompts ───── */

const buildSystemPrompt = (devise: string) => `Tu es un analyste financier expert certifié SYSCOHADA révisé (2017), spécialisé PME africaines (zones UEMOA/CEMAC).

MISSION: EXTRAIRE les données financières HISTORIQUES des documents fournis (comptes de résultat, bilans, états financiers, templates Excel multi-feuilles).
Tu NE FAIS PAS de projections, PAS de scénarios, PAS de plan d'action.

ATTENTION CRITIQUE: Si les documents fournis sont des questionnaires BMC, des canvas d'impact social, ou tout document NON FINANCIER (pas de compte de résultat, pas de bilan, pas de P&L, pas de template Excel financier), retourne TOUTES les valeurs numériques à 0 et score à 0. N'invente AUCUN chiffre à partir de descriptions narratives.

RÈGLES D'EXTRACTION:
1. Analyse CHAQUE feuille/section/onglet du document uploadé. Ne te limite pas à un résumé — extrais toutes les données structurées disponibles.
2. Extrais UNIQUEMENT les chiffres présents dans les documents uploadés.
3. Si une donnée n'est pas dans les documents, mets 0 (ne l'invente PAS).
4. Vérifie la cohérence: Total Actif = Total Passif, Résultat net cohérent.
5. Tous les montants en ${devise} sans séparateurs de milliers dans les champs numériques.
6. Le score reflète la COMPLÉTUDE des données extraites (100 = toutes les données trouvées).

FEUILLES À ANALYSER SYSTÉMATIQUEMENT (si présentes):
- Informations générales / Fiche entreprise → informations_generales
- Historique financier (N-2, N-1, N) → historique_3ans
- Compte de résultat / P&L → compte_resultat
- Bilan → bilan
- Produits & services (grilles tarifaires, prix) → produits_services
- Équipe / Effectifs / Masse salariale → equipe
- Coûts variables (matières, logistique, emballages) → couts_variables
- Coûts fixes (loyer, électricité, maintenance, admin) → couts_fixes
- BFR / Working capital (DSO, DPO, stock) → bfr
- Investissements / CAPEX → investissements
- Financement (capital, subventions, prêts) → financement
- Hypothèses de croissance / Projections → hypotheses_croissance

${getExtractionKnowledgePrompt()}

IMPORTANT: Réponds UNIQUEMENT en JSON valide.`;

const userPrompt = (name: string, sector: string, country: string, docs: string, bmcData: any, devise: string) => `
Extrais les données financières HISTORIQUES de "${name}" (Secteur: ${sector}, Pays: ${country}).

${bmcData?.canvas ? `DONNÉES BMC (pour contexte):\n${JSON.stringify(bmcData.canvas, null, 2)}` : ""}
${docs ? `DOCUMENTS FINANCIERS À ANALYSER:\n${docs}` : "AUCUN DOCUMENT FINANCIER UPLOADÉ — mets toutes les valeurs à 0."}

Analyse CHAQUE feuille/section du document. Extrais et retourne ce JSON COMPLET:
{
  "score": <0-100 complétude des données extraites>,
  "periode": "<ex: N-2 à N ou Exercice 2024 ou N/A si pas de documents>",
  "devise": "${devise}",
  "fiabilite": "<Élevée|Moyenne|Faible>",
  "source_documents": ["<nom des fichiers analysés>"],

  "informations_generales": {
    "nom": "<nom entreprise>",
    "forme_juridique": "<SARL, SA, EI, etc.>",
    "pays": "<pays>",
    "ville": "<ville>",
    "secteur": "<secteur d'activité>",
    "date_creation": "<date ou année de création>",
    "dirigeant": "<nom du dirigeant>",
    "description_activite": "<description de l'activité principale>"
  },

  "historique_3ans": {
    "n_moins_2": {
      "annee": <number>,
      "ca_total": <number>,
      "couts_variables": <number>,
      "charges_fixes": <number>,
      "resultat_exploitation": <number>,
      "resultat_net": <number>,
      "nombre_clients": <number>,
      "nombre_employes": <number>,
      "tresorerie": <number>,
      "ca_par_produit": [{"nom": "<produit>", "ca": <number>}]
    },
    "n_moins_1": { <même structure> },
    "n": { <même structure> }
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

  "produits_services": [
    {
      "nom": "<nom exact du produit/service tel que dans le document>",
      "type": "Produit|Service",
      "prix_unitaire": <number exact du document, ou 0 si absent>,
      "cout_unitaire": <number exact du document, ou estimé via marge sectorielle>,
      "unite": "<unité telle que dans le document (unité, kg, m³, prestation, etc.)>",
      "marge_pct": <number calculé ou estimé via benchmark sectoriel>,
      "volume_annuel": <number si disponible dans le document, sinon 0>,
      "source": "<document|estimé_sectoriel>"
    }
  ],

  "equipe": [
    {
      "poste": "<intitulé du poste>",
      "nombre": <number>,
      "salaire_mensuel": <number si disponible, sinon 0>,
      "charges_sociales_pct": <number si disponible, sinon 0>
    }
  ],

  "couts_variables": [
    {
      "poste": "<ex: matières premières, logistique, emballages, commissions>",
      "montant_mensuel": <number>,
      "montant_annuel": <number>
    }
  ],

  "couts_fixes": [
    {
      "poste": "<ex: loyer, électricité, eau, maintenance, marketing, admin, assurances>",
      "montant_mensuel": <number>,
      "montant_annuel": <number>
    }
  ],

  "bfr": {
    "delai_clients_jours": <number>,
    "delai_fournisseurs_jours": <number>,
    "stock_moyen_jours": <number>,
    "tresorerie_depart": <number>
  },

  "investissements": [
    {
      "nature": "<ex: terrain, bâtiment, véhicule, machines, informatique>",
      "montant": <number>,
      "annee_achat": <number>,
      "duree_amortissement_ans": <number>
    }
  ],

  "financement": {
    "apports_capital": <number>,
    "subventions": <number>,
    "prets": [
      {
        "source": "<ex: banque, OVO, famille, bailleur>",
        "montant": <number>,
        "taux_pct": <number>,
        "duree_mois": <number>,
        "differe_mois": <number>
      }
    ]
  },

  "hypotheses_croissance": {
    "objectifs_ca": [{"annee": "<N+1>", "montant": <number>}],
    "taux_marge_brute_cible": <number en %>,
    "taux_marge_operationnelle_cible": <number en %>,
    "inflation_annuelle": <number en %>,
    "augmentation_prix_annuelle": <number en %>,
    "croissance_volumes_annuelle": <number en %>,
    "taux_is": <number en %>
  },

  "effectifs": {
    "total": <number>,
    "cadres": <number>,
    "employes": <number>
  },

  "kpis": {
    "marge_brute_pct": "<xx% ou N/A>",
    "marge_nette_pct": "<xx% ou N/A>",
    "ratio_endettement_pct": "<xx% ou N/A>"
  },

  "donnees_manquantes": ["<donnée non trouvée dans les documents>"],
  "hypotheses": ["<hypothèse utilisée pour compléter>"]
}

RÈGLES PRODUITS/SERVICES :
- Extrais CHAQUE produit ou service identifiable dans les documents (tableaux de prix, grilles tarifaires, factures, etc.)
- Le prix_unitaire DOIT être le prix EXACT du document. Ne l'arrondis PAS.
- Si le cout_unitaire n'est pas explicite, ESTIME-le à partir de la marge brute sectorielle du pays/secteur (ex: BTP marge 20-35% donc coût = 65-80% du prix). Indique source: "estimé_sectoriel".
- Si le prix_unitaire n'apparaît PAS dans les documents, mets 0 et ajoute-le à donnees_manquantes. N'invente JAMAIS un prix.
- Si aucun produit/service n'est identifiable, retourne un tableau vide [].

RÈGLES ÉQUIPE :
- Extrais CHAQUE poste avec son effectif et son salaire mensuel si disponible.
- Si la masse salariale totale est connue mais pas le détail, déduis les salaires individuels.

RÈGLES COÛTS :
- Sépare clairement coûts VARIABLES (liés au volume: matières, emballages, livraison) et coûts FIXES (loyer, électricité, assurances, admin).
- Si un montant est mensuel, calcule aussi l'annuel et vice-versa.

RÈGLES BFR :
- Extrais les délais de paiement (DSO clients, DPO fournisseurs, rotation stocks).
- La trésorerie de départ est le cash en caisse/banque au début de l'exercice.

RÈGLES INVESTISSEMENTS :
- Extrais CHAQUE investissement planifié avec montant, année et durée d'amortissement.

RÈGLES FINANCEMENT :
- Extrais CHAQUE source de financement: capital, subventions, prêts (avec taux, durée, différé).

RÈGLES HYPOTHÈSES DE CROISSANCE :
- Si le document contient des objectifs de CA sur 5 ans, extrais-les.
- Si des taux de croissance, marges cibles, ou paramètres d'inflation sont spécifiés, extrais-les.`;

/* ───── Main handler ───── */

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const ctx = await verifyAndGetContext(req);
    const ent = ctx.enterprise;
    const bmcData = ctx.deliverableMap["bmc_analysis"] || {};
    const fiscalParams = getFiscalParams(ent.country || "Côte d'Ivoire");

    // ── Guard: detect if actual financial documents exist ──
    const { data: coachUploads } = await ctx.supabase
      .from("coach_uploads")
      .select("category, filename")
      .eq("enterprise_id", ctx.enterprise_id);

    const financialDetected = hasFinancialContent(
      ctx.documentContent || "",
      coachUploads || [],
    );

    if (!financialDetected) {
      console.log("generate-inputs: No financial documents detected — saving empty skeleton with score 0");
      const emptyData = { score: 0, donnees_manquantes: ["Aucun document financier réel détecté. Uploadez le template Analyse Financière Excel pour débloquer les modules financiers."] };
      await saveDeliverable(ctx.supabase, ctx.enterprise_id, "inputs_data", emptyData, "inputs");
      return jsonResponse({ success: true, data: emptyData, score: 0 });
    }

    // ── Financial docs found — proceed with AI extraction ──
    const ragContext = await buildRAGContext(ctx.supabase, ent.country || "", ent.sector || "", ["benchmarks", "fiscal"], "inputs_data");

    const enrichedPrompt = userPrompt(
      ent.name, ent.sector || "", ent.country || "", ctx.documentContent, bmcData, fiscalParams.devise
    ) + ragContext + `\n\nPARAMÈTRES FISCAUX ${ent.country || "Côte d'Ivoire"}:\n${JSON.stringify(fiscalParams)}`;

    const rawData = await callAI(buildSystemPrompt(fiscalParams.devise), enrichedPrompt, 16384);
    const normalized = normalizeInputs(rawData);
    const data = validateAndEnrich(normalized, ent.country, ent.sector);

    await saveDeliverable(ctx.supabase, ctx.enterprise_id, "inputs_data", data, "inputs");

    return jsonResponse({ success: true, data, score: data.score });
  } catch (e: any) {
    console.error("generate-inputs error:", e);
    return errorResponse(e.message || "Erreur inconnue", e.status || 500);
  }
});
