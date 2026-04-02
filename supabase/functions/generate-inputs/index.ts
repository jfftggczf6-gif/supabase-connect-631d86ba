// v4 — restore corsHeaders 2026-03-19
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, errorResponse, jsonResponse, verifyAndGetContext, callAI, saveDeliverable, buildRAGContext, getFiscalParams, getDocumentContentForAgent, getKnowledgeForAgent } from "../_shared/helpers_v5.ts";
import { normalizeInputs } from "../_shared/normalizers.ts";
import { validateAndEnrich } from "../_shared/post-validator.ts";
import { getExtractionKnowledgePrompt, getContextualBenchmarks } from "../_shared/financial-knowledge.ts";
import { injectGuardrails } from "../_shared/guardrails.ts";

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
    // Champs enrichis (extraction profonde)
    concurrents_mentionnes: [],
    certifications_normes: [],
    partenariats_contrats: [],
    organigramme: { dirigeant: "", nb_cadres: 0, nb_employes: 0, departements: [] },
    contexte_marche: { taille_estimee: "", croissance: "", positionnement: "" },
  };
}

/* ───── Prompts ───── */

const buildSystemPrompt = (devise: string) => `Tu es un analyste financier expert certifié SYSCOHADA révisé (2017), spécialisé PME africaines (zones UEMOA/CEMAC).

MISSION: EXTRAIRE les données financières HISTORIQUES des documents fournis (comptes de résultat, bilans, états financiers, templates Excel multi-feuilles), puis ESTIMER les données manquantes.
Tu NE FAIS PAS de projections futures, PAS de scénarios, PAS de plan d'action.

═══ HIÉRARCHIE DES SOURCES (par ordre de fiabilité) ═══

NIVEAU 1 — EXTRACTION DIRECTE (source: "état_financier")
  Chiffres extraits des CdR, bilans, relevés bancaires, déclarations fiscales.
  Fiabilité maximale. À utiliser en priorité absolue.

NIVEAU 2 — CALCUL CROISÉ (source: "calcul_croisé")
  Déduction logique depuis d'autres données extraites.
  Ex: masse salariale = effectif × salaire moyen extrait
  Ex: marge brute = CA - achats (les 2 extraits du CdR)
  Ex: CA par produit = CA total × part déclarée dans le rapport d'activités

NIVEAU 3 — ESTIMATION SECTORIELLE (source: "estimation_sectorielle")
  Quand une donnée est absente ET non déductible, estimer depuis les benchmarks du secteur.
  Ex: pas de charges externes documentées → estimer 10-15% du CA (benchmark PME Afrique)
  Ex: pas de BFR documenté → DSO=30j, DPO=45j, stock=30j (défauts sectoriels)
  Ex: pas de prix unitaire → benchmark du secteur + position concurrentielle

NIVEAU 4 — INCONNU (valeur: 0, source: "non_documenté")
  UNIQUEMENT quand aucune estimation n'est possible (ex: dette financière sans aucun document).
  Ajouter une note expliquant ce qui manque.

═══ RÈGLE ABSOLUE : JAMAIS DE 0 SILENCIEUX ═══
Si une valeur est 0, tu DOIS indiquer pourquoi dans "source":
- "état_financier" → le document dit explicitement 0
- "non_documenté" → pas de source, impossible d'estimer
INTERDIT de mettre 0 sans explication. Les agents en aval (BMC, SIC, Framework)
lisent ces données — un 0 silencieux casse toute l'analyse.

RÈGLES D'EXTRACTION:
1. Analyse CHAQUE feuille/section/onglet du document uploadé.
2. NIVEAU 1 d'abord : extrais les chiffres présents dans les documents.
3. NIVEAU 2 ensuite : déduis par calcul croisé ce qui manque.
4. NIVEAU 3 enfin : estime depuis les benchmarks sectoriels les postes manquants.
5. Vérifie la cohérence: Total Actif = Total Passif, Résultat net cohérent.
6. Tous les montants en ${devise} sans séparateurs de milliers.
7. Le score reflète : 90-100 = niveau 1 complet, 60-89 = niveaux 1+2, 30-59 = niveaux 1+2+3, 0-29 = presque tout estimé.

DEVISE :
- Détecte la devise utilisée dans les documents fournis (USD, EUR, FCFA/XOF, XAF, CDF, GNF, MGA, etc.)
- Si les documents mentionnent des montants en USD → utilise USD comme devise
- Si les documents sont en devise locale → utilise la devise locale
- Si les documents mélangent 2 devises (ex: RDC avec USD + CDF) → utilise la devise MAJORITAIRE dans les états financiers et mentionne l'autre devise dans les notes
- Stocke le résultat dans le champ "devise" du JSON (obligatoire)
- Ajoute "devise_secondaire" si double devise détectée
- Ne PAS convertir les montants. Garde les chiffres dans la devise d'origine des documents.
- La devise par défaut (${devise}) n'est qu'un fallback — utilise celle détectée dans les documents en priorité.

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

═══ CROISEMENT OBLIGATOIRE DES SOURCES ═══

Pour chaque section, tu DOIS croiser TOUTES les sources disponibles :

PRODUITS_SERVICES — MÉTHODE DE CROISEMENT :
1. ÉTATS FINANCIERS (CdR) → postes comptables : "Ventes de marchandises", "Travaux, services vendus", "Production vendue"
2. RAPPORT D'ACTIVITÉS → branches d'activité avec leurs CA détaillés par ligne de métier
3. BMC flux_revenus → produit principal, prix moyen, volume estimé, CA mensuel
4. PITCH DECK / PRÉSENTATION → description des activités et leur contribution

RÈGLE : Si le rapport d'activités mentionne une activité avec un CA chiffré (même partiel),
elle DOIT apparaître dans produits_services avec son CA. Même si le CdR ne la ventile pas.

Exemple de croisement :
- CdR dit "Ventes marchandises = 238M" (poste agrégé)
- Rapport dit "Distribution = 653M (commissions 157M + distribution 331M + ventes 106M + prestations 59M)"
- Rapport dit "Oeufs = 140 plaquettes/jour à 10 000 (devise locale)" → CA ≈ 140 × 365 × 10 000 × 0.7 (taux occupation) = 358M (2025)
- BMC dit "CA mensuel agriculture = 39M" → CA annuel ≈ 468M
→ Résultat : 3 produits_services avec CA estimé pour chacun

HISTORIQUE ca_par_produit — MÉTHODE DE CROISEMENT :
- Pour chaque année historique, ventiler le CA total entre les activités
- Utiliser les proportions du rapport d'activités si disponibles
- Si une activité était en démarrage (ex: œufs commencés en 2024 avec 22 plaquettes/jour),
  estimer son CA pour cette année : 22 × 365 × 10 000 × 0.5 (demi-année) = ~40M
- La somme des ca_par_produit DOIT ≈ ca_total (±5%)

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
      "nom": "<nom réel de l'activité — JAMAIS de nom générique>",
      "type": "Produit|Service",
      "prix_unitaire": <number — JAMAIS 0. Croiser: CdR CA÷vol, BMC flux_revenus prix_moyen, rapport d'activités, benchmark sectoriel>,
      "cout_unitaire": <number — JAMAIS 0. Croiser: CdR achats÷vol, BMC structure_couts, marge sectorielle × prix>,
      "unite": "<unité: plaquette, article, prestation, commande, lot, etc.>",
      "marge_pct": <number — calculé = (prix - cout) / prix × 100>,
      "volume_annuel": <number — JAMAIS 0. Croiser: CA÷prix, rapport d'activités (volumes, nb clients × fréquence), BMC volume_estime>,
      "ca_estime": <number — JAMAIS 0. = prix × volume. Si pas dans CdR, estimer depuis rapport d'activités ou BMC>,
      "ca_annuel": <number — idem>,
      "part_ca_pct": <number — = ca_estime ÷ CA_total × 100>,
      "taux_croissance_historique": <number — ex: 0.15 si +15%/an. Calculer depuis historique si disponible>,
      "source": "<état_financier|rapport_activite|bmc|estimé_croisement>"
    }
  ],

  ⚠️ RÈGLE PRODUITS ABSOLUE :
  - CHAQUE produit DOIT avoir prix_unitaire > 0, volume_annuel > 0, ca_estime > 0
  - Si le CdR ne ventile pas par produit → utiliser le rapport d'activités ou le BMC
  - Si aucune source ne donne le prix → estimer depuis benchmark sectoriel et marquer source="estimé_croisement"
  - La SOMME des ca_estime de tous les produits DOIT ≈ CA total du CdR (±10%)
  - Si une activité est en démarrage (CA petit) → l'inclure quand même avec le CA estimé

  "equipe": [
    {
      "poste": "<intitulé du poste>",
      "nombre": <number>,
      "salaire_mensuel": <number — si pas documenté: SMIG local × coefficient poste>,
      "charges_sociales_pct": <number — si pas documenté: 18% UEMOA, 5.5% RDC>,
      "source": "état_financier | estimation_sectorielle"
    }
  ],

  "couts_variables": [
    {
      "poste": "<ex: matières premières, logistique, emballages, commissions>",
      "montant_mensuel": <number>,
      "montant_annuel": <number>,
      "source": "état_financier | calcul_croisé | estimation_sectorielle"
    }
  ],
  ⚠️ Si aucun coût variable documenté mais CA > 0 → estimer depuis marge brute sectorielle :
  - Agro-industrie: coûts variables ≈ 50-65% du CA
  - Commerce: ≈ 75-85% du CA
  - Services: ≈ 30-45% du CA
  - BTP: ≈ 60-75% du CA

  "couts_fixes": [
    {
      "poste": "<ex: loyer, électricité, eau, maintenance, marketing, admin, assurances>",
      "montant_mensuel": <number>,
      "montant_annuel": <number>,
      "source": "état_financier | calcul_croisé | estimation_sectorielle"
    }
  ],
  ⚠️ Si aucun coût fixe documenté mais effectif > 0 → estimer au minimum :
  - Loyer bureau: 100K-500K (devise locale)/mois selon ville
  - Électricité/eau: 50K-200K (devise locale)/mois
  - Télécom/internet: 30K-100K (devise locale)/mois
  - Assurances: 1-2% du CA/an

  "bfr": {
    "delai_clients_jours": <number — défaut: 30j services, 0j commerce détail, 60j BTP>,
    "delai_fournisseurs_jours": <number — défaut: 45j>,
    "stock_moyen_jours": <number — défaut: 30j industrie, 15j commerce, 0j services>,
    "tresorerie_depart": <number — si bilan disponible: trésorerie actif, sinon 0>
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
  "hypotheses": ["<hypothèse utilisée pour compléter>"],

  "concurrents_mentionnes": [
    {"nom": "<nom du concurrent mentionné dans les documents>", "positionnement": "<description>", "source": "<document>"}
  ],
  "certifications_normes": ["<HACCP, ISO, OHADA, label qualité, etc. mentionnés>"],
  "partenariats_contrats": [
    {"partenaire": "<nom>", "type": "<fournisseur|client|financier|technique>", "detail": "<description>", "source": "<document>"}
  ],
  "organigramme": {
    "dirigeant": "<nom du dirigeant/DG>",
    "nb_cadres": <number>,
    "nb_employes": <number>,
    "departements": ["<liste des départements/services mentionnés>"]
  },
  "contexte_marche": {
    "taille_estimee": "<taille marché mentionnée dans les documents>",
    "croissance": "<taux croissance mentionné>",
    "positionnement": "<Leader/Challenger/Niche/Nouvel entrant>"
  }
}

RÈGLES PRODUITS/SERVICES :
- Extrais CHAQUE produit ou service identifiable dans les documents (tableaux de prix, grilles tarifaires, factures, etc.)
- Le prix_unitaire DOIT être le prix EXACT du document. Ne l'arrondis PAS.
- Si le cout_unitaire n'est pas explicite, ESTIME-le à partir de la marge brute sectorielle du pays/secteur (ex: BTP marge 20-35% donc coût = 65-80% du prix). Indique source: "estimé_sectoriel".
- Si le prix_unitaire n'apparaît PAS dans les documents, mets 0 et ajoute-le à donnees_manquantes. N'invente JAMAIS un prix.
- Si aucun produit/service n'est identifiable, retourne un tableau vide [].
- Ajoute un champ "ca_estime" pour chaque produit = prix_unitaire × volume_annuel. Si volume inconnu, estime depuis la part du CA total.
- Ajoute un champ "part_ca_pct" pour chaque produit = part estimée du CA total.
- Ajoute un champ "justification" expliquant l'origine du prix et du volume.

RÈGLE ABSOLUE DE COHÉRENCE CA :
La SOMME des ca_estime de TOUS les produits/services DOIT être ÉGALE au chiffre_affaires du compte_resultat (tolérance ±2%).
Si tu identifies 3 produits dont la somme = 450M mais le CA total est 460M, ajoute un produit "Autres revenus" de 10M pour combler l'écart.
Si tu ne peux pas ventiler, crée UN SEUL produit avec ca_estime = CA total et source: "non_ventilé".

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

/* ───── Diff computation ───── */

function summarizeValue(v: any): string {
  if (v === null || v === undefined) return "null";
  if (typeof v === "number") return v.toLocaleString("fr-FR");
  if (typeof v === "string") return v.length > 50 ? v.substring(0, 50) + "…" : v;
  if (Array.isArray(v)) return `[${v.length} éléments]`;
  return JSON.stringify(v).substring(0, 60);
}

function computeInputsDiff(oldInputs: any, newInputs: any): any {
  const diff = { added: [] as string[], modified: [] as string[], removed: [] as string[], unchanged_count: 0 };

  const compare = (oldObj: any, newObj: any, path: string) => {
    if (!oldObj && newObj) { diff.added.push(path); return; }
    if (oldObj && !newObj) { diff.removed.push(path); return; }
    if (typeof oldObj !== typeof newObj) { diff.modified.push(`${path}: ${summarizeValue(oldObj)} → ${summarizeValue(newObj)}`); return; }

    if (typeof oldObj === "object" && oldObj !== null && !Array.isArray(oldObj)) {
      const allKeys = new Set([...Object.keys(oldObj || {}), ...Object.keys(newObj || {})]);
      for (const key of allKeys) {
        compare(oldObj[key], newObj[key], path ? `${path}.${key}` : key);
      }
    } else if (JSON.stringify(oldObj) !== JSON.stringify(newObj)) {
      if (typeof oldObj === "number" && typeof newObj === "number") {
        const pctChange = oldObj !== 0 ? Math.round(((newObj - oldObj) / oldObj) * 100) : 100;
        diff.modified.push(`${path}: ${oldObj.toLocaleString("fr-FR")} → ${newObj.toLocaleString("fr-FR")} (${pctChange > 0 ? "+" : ""}${pctChange}%)`);
      } else {
        diff.modified.push(`${path}: ${summarizeValue(oldObj)} → ${summarizeValue(newObj)}`);
      }
    } else {
      diff.unchanged_count++;
    }
  };

  const sections = ["compte_resultat", "bilan", "historique_3ans", "produits_services", "equipe", "couts_variables", "couts_fixes", "investissements", "financement", "bfr", "effectifs", "kpis"];
  for (const section of sections) {
    compare(oldInputs?.[section], newInputs?.[section], section);
  }

  return diff;
}

/* ───── Main handler ───── */

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const ctx = await verifyAndGetContext(req);
    const ent = ctx.enterprise;
    const bmcData = ctx.deliverableMap["bmc_analysis"] || {};
    const fiscalParams = getFiscalParams(ent.country || '');

    // ── Load existing inputs for merge ──
    const { data: existingInputsDeliv } = await ctx.supabase
      .from("deliverables")
      .select("data, updated_at")
      .eq("enterprise_id", ctx.enterprise_id)
      .eq("type", "inputs_data")
      .maybeSingle();

    const existingInputs = existingInputsDeliv?.data as Record<string, any> | null;
    const hasExistingInputs = existingInputs && (existingInputs as any).score > 0;

    // ── Guard: detect if actual financial documents exist ──
    const { data: coachUploads } = await ctx.supabase
      .from("coach_uploads")
      .select("category, filename")
      .eq("enterprise_id", ctx.enterprise_id);

    const agentDocs = getDocumentContentForAgent(ent, "inputs", 260_000);
    const financialDetected = hasFinancialContent(
      agentDocs,
      coachUploads || [],
    );

    if (!financialDetected) {
      console.log("[inputs] No financial content detected — returning score 0");
      await saveDeliverable(ctx.supabase, ctx.enterprise_id, "inputs_data", {
        compte_resultat: {},
        bilan: {},
        metadata: { no_financial_data: true },
      }, "inputs");
      return jsonResponse({ success: true, score: 0 });
    }

    let ragContext = "";
    try {
      ragContext = await buildRAGContext(
        ctx.supabase, ent.country || "", ent.sector || "", ["benchmarks", "fiscal", "secteur"], "inputs_data", ctx.enterprise_id
      );
    } catch (e) {
      console.warn("[inputs] RAG context failed, continuing without:", e);
    }

    // ── Build merge instruction if existing inputs exist ──
    let mergeInstruction = "";
    if (hasExistingInputs) {
      mergeInstruction = `
══════ INPUTS EXISTANTS (extraction précédente) ══════
${JSON.stringify(existingInputs, null, 1).substring(0, 15000)}
══════ FIN INPUTS EXISTANTS ══════

RÈGLE DE FUSION :
- Les nouveaux documents COMPLÈTENT les inputs existants, ils ne les REMPLACENT PAS
- Si un champ est rempli dans les inputs existants ET dans les nouveaux documents :
  → PRENDRE LA VALEUR DES NOUVEAUX DOCUMENTS (plus récents)
- Si un champ est rempli dans les inputs existants MAIS PAS dans les nouveaux documents :
  → GARDER LA VALEUR EXISTANTE
- Si un champ est NOUVEAU (pas dans les inputs existants) :
  → L'AJOUTER

EXEMPLES :
- Inputs existants ont CA = 460M, nouveaux documents confirment CA = 460M → garder 460M
- Inputs existants ont effectifs = 0, nouveau document (organigramme) montre 89 personnes → mettre 89
- Inputs existants n'ont pas de ca_par_produit, nouveau document le détaille → l'ajouter
- Inputs existants ont un bilan, nouveau document a un bilan plus récent → prendre le nouveau
`;
    }

    const kbContext = await getKnowledgeForAgent(ctx.supabase, ent.country || "", ent.sector || "", "inputs");

    // Inject pre_screening insights if available (activities, risks, scores)
    let preScreenContext = "";
    const preScreen = ctx.deliverableMap["pre_screening"];
    if (preScreen && typeof preScreen === "object" && Object.keys(preScreen).length > 5) {
      const ps = preScreen;
      preScreenContext = `\n\n══════ PRÉ-SCREENING (analyse préliminaire — UTILISE CES INSIGHTS) ══════\n`;
      if (ps.classification) preScreenContext += `Classification: ${ps.classification}\n`;
      if (ps.activites_identifiees?.length) preScreenContext += `Activités identifiées: ${ps.activites_identifiees.map((a: any) => typeof a === 'string' ? a : a.nom || a.name).join(', ')}\n`;
      if (ps.chiffres_cles) preScreenContext += `Chiffres clés: ${JSON.stringify(ps.chiffres_cles)}\n`;
      if (ps.forces?.length) preScreenContext += `Forces: ${ps.forces.slice(0, 5).map((f: any) => typeof f === 'string' ? f : f.titre || f).join(' | ')}\n`;
      if (ps.risques?.length) preScreenContext += `Risques: ${ps.risques.slice(0, 5).map((r: any) => typeof r === 'string' ? r : r.titre || r).join(' | ')}\n`;
      preScreenContext += `⚠️ Utilise ces informations pour identifier TOUTES les activités et estimer les CA par produit.\n`;
    }

    const benchmarks = getContextualBenchmarks(ent.country || '', ent.sector || "services_b2b");

    const enrichedPrompt = userPrompt(
      ent.name, ent.sector || "", ent.country || "", agentDocs, bmcData, fiscalParams.devise
    ) + mergeInstruction + ragContext + kbContext + preScreenContext
      + `\n\nPARAMÈTRES FISCAUX ${ent.country || ''}:\n${JSON.stringify(fiscalParams)}`
      + `\n\n${benchmarks}`;

    const rawData = await callAI(injectGuardrails(buildSystemPrompt(fiscalParams.devise), ent.country), enrichedPrompt, 16384, "claude-opus-4-6", undefined, { functionName: "generate-inputs", enterpriseId: ctx.enterprise_id });
    const normalized = normalizeInputs(rawData);
    const data = validateAndEnrich(normalized, ent.country, ent.sector);

    // ── Compute diff and save to inputs_history ──
    const diff = hasExistingInputs ? computeInputsDiff(existingInputs, data) : null;

    // Get names of recently added documents (from parsing report)
    const parsingReport = ent.document_parsing_report as any;
    const newDocumentNames = parsingReport?.files?.map((f: any) => f.fileName) || [];

    try {
      await ctx.supabase.from("inputs_history").insert({
        enterprise_id: ctx.enterprise_id,
        data: data,
        score: data.score || 0,
        trigger: hasExistingInputs ? "new_documents" : "initial",
        documents_added: newDocumentNames,
        diff: diff,
      });
    } catch (histErr) {
      console.warn("[inputs] Failed to save inputs_history:", histErr);
    }

    await saveDeliverable(ctx.supabase, ctx.enterprise_id, "inputs_data", data, "inputs");

    return jsonResponse({ success: true, data, score: data.score, diff });
  } catch (e: any) {
    console.error("generate-inputs error:", e);
    return errorResponse(e.message || "Erreur inconnue", e.status || 500);
  }
});
