// credit-readiness-prompts.ts — Dictionnaire des 6 livrables Credit Readiness
// Chaque entrée fournit le system_prompt et le output_schema attendus.
// Le router generate-credit-readiness résout livrable_code → entrée.

export type CreditReadinessLivrableCode =
  | 'modele_financier'
  | 'projections'
  | 'bp_credit'
  | 'plan_financement'
  | 'organigramme'
  | 'analyse_commerciale';

export interface CreditReadinessPromptDef {
  livrable_code: CreditReadinessLivrableCode;
  deliverable_type: string;
  label: string;
  system_prompt: string;
  output_schema: string;
  user_instruction: string;
}

const COMMON_RULES = `═══ RÈGLES ABSOLUES ═══
- Chaque chiffre vient des documents fournis. Si une info manque, indiquer la valeur "n/d" (string) ou null pour les nombres.
- Utilise la devise locale réelle de l'entreprise (FCFA en UEMOA/CEMAC, GHS Ghana, NGN Nigeria, KES Kenya, MAD Maroc, etc.). Le contexte donne la bonne devise.
- Tous les montants en unité de devise locale (pas en milliers, pas en millions, sauf si la donnée brute l'est et tu le marques explicitement).
- Pas d'euphémisme commercial : tu travailles pour un comité de crédit, sois factuel et chiffré.
- Réponds UNIQUEMENT en JSON valide selon le schéma fourni, sans commentaire ni texte autour.`;

// ═══════════════════════════════════════════════════════════════════════════
// 1. MODELE FINANCIER NETTOYÉ
// ═══════════════════════════════════════════════════════════════════════════
const MODELE_FINANCIER: CreditReadinessPromptDef = {
  livrable_code: 'modele_financier',
  deliverable_type: 'credit_readiness_modele_financier',
  label: 'Modèle financier nettoyé',
  system_prompt: `Tu prépares le MODÈLE FINANCIER NETTOYÉ d'une PME pour le credit readiness bancaire.

═══ OBJECTIF ═══
Reconstruire le PnL et le bilan retraités en séparant ce qui relève de l'exploitation réelle de la PME de ce qui relève du dirigeant. Le banquier ne peut analyser la capacité de remboursement que sur des chiffres fiables. Sans ce nettoyage, les ratios calculés sont faussés et le comité ne peut pas trancher.

═══ STRUCTURE OBLIGATOIRE ═══
1. **Travaux réalisés** (4-5 puces) — méthodologie qui rassure le comité :
   - Séparation comptes perso/pro (date, action, par qui)
   - Identification des charges personnelles dans l'exploitation (montant + sources)
   - Certification des liasses par commissaire aux comptes (cabinet, date)
   - Réconciliation déclaratifs fiscaux vs relevés bancaires (écart constaté en %)
   - Retraitement des conventions réglementées (loyer SCI familiale, prêts parties liées)

2. **PnL retraité — historique 3 ans** (grande table 3 cols, ex 2023/2024/2025) avec lignes :
   - Chiffre d'affaires (avec sous-lignes par segment 2-3 lignes)
   - (-) Achats matières premières
   - (-) Variation stock (si pertinent)
   - **Marge brute** (avec % du CA)
   - (-) Charges de personnel (avec sous-lignes : permanents, saisonniers, charges sociales)
   - (-) Loyer usine / locaux (préciser SCI familiale si applicable)
   - (-) Énergie + eau
   - (-) Transport et logistique
   - (-) Honoraires et conseils
   - (-) Autres charges externes
   - **Retraitement : charges personnelles DG** (en italique rouge, en sous-lignes : véhicule perso, téléphone, scolarité, dépenses diverses)
   - **EBE retraité** (en vert avec %)
   - (-) Dotations amortissements
   - (-) Charges financières (CMT existant)
   - (-) Impôt 25%
   - **Résultat net retraité** (en vert)

3. **Bilan retraité — synthèse** : 2 colonnes (Actif/Passif), au 31/12/N
   - Actif : Immobilisations brutes, (-) Amortissements, Immobilisations nettes, Stocks, Créances clients, Disponibilités, Autres actifs courants → TOTAL ACTIF
   - Passif : Capitaux propres (avec sous-lignes capital social, réserves), Dettes financières MLT, Dettes fournisseurs, Dettes fiscales et sociales, Autres dettes courantes → TOTAL PASSIF

4. **KPIs financiers recalculés** (8 cards) :
   - DSCR (après crédit) : valeur + formule + seuil
   - Endettement : valeur + formule + seuil
   - Liquidité générale : actifs courants / passifs courants
   - Marge EBE : valeur + benchmark sectoriel
   - CAF : RN + DA
   - CAF / Service dette : capacité d'autofinancement vs dette
   - Fonds de roulement : capitaux permanents - immo
   - BFR / CA : besoin en fonds de roulement (avec note sur saisonnalité si pertinent)

5. **Synthèse pour le comité** : paragraphe explicatif (impact retraitement, conformité ratios)

6. **Sources** : liste des sources utilisées

${COMMON_RULES}`,
  output_schema: `{
  "objectif": "string — 1-2 phrases (pourquoi on retraite)",
  "travaux_realises": [
    { "label": "string ex 'Séparation comptes perso/pro'", "detail": "string — date, action, par qui, montant si pertinent" }
  ],
  "pnl_retraite": {
    "annees": ["2023", "2024", "2025"],
    "lignes": [
      { "label": "Chiffre d'affaires", "values": [<n1>,<n2>,<n3>], "type": "produit", "bold": true },
      { "label": "dont export [zone] (cajou brute)", "values": [], "type": "sub" },
      { "label": "dont marché local (sous-produits)", "values": [], "type": "sub" },
      { "label": "Achats matières premières", "values": [], "type": "charge" },
      { "label": "Variation stock", "values": [], "type": "charge", "can_be_positive": true },
      { "label": "Marge brute", "values": [], "type": "calc", "with_pct": true },
      { "label": "Charges de personnel (déclarées)", "values": [], "type": "charge" },
      { "label": "dont permanents", "values": [], "type": "sub" },
      { "label": "dont saisonniers", "values": [], "type": "sub" },
      { "label": "dont charges sociales CNPS", "values": [], "type": "sub" },
      { "label": "Loyer usine (SCI familiale)", "values": [], "type": "charge" },
      { "label": "Énergie + eau", "values": [], "type": "charge" },
      { "label": "Transport et logistique export", "values": [], "type": "charge" },
      { "label": "Honoraires et conseils", "values": [], "type": "charge" },
      { "label": "Autres charges externes", "values": [], "type": "charge" },
      { "label": "Retraitement : charges personnelles DG", "values": [], "type": "retraitement" },
      { "label": "dont véhicule personnel", "values": [], "type": "sub_retraitement" },
      { "label": "dont téléphone et abonnements", "values": [], "type": "sub_retraitement" },
      { "label": "dont scolarité enfants", "values": [], "type": "sub_retraitement" },
      { "label": "dont dépenses diverses (santé, voyages)", "values": [], "type": "sub_retraitement" },
      { "label": "EBE retraité", "values": [], "type": "calc", "with_pct": true, "highlight": "green", "bold": true },
      { "label": "Dotations amortissements", "values": [], "type": "charge" },
      { "label": "Charges financières (CMT existant)", "values": [], "type": "charge" },
      { "label": "Impôt sur les bénéfices (25%)", "values": [], "type": "charge" },
      { "label": "Résultat net retraité", "values": [], "type": "calc", "highlight": "green", "bold": true }
    ]
  },
  "bilan_retraite": {
    "date_arrete": "string ex '31/12/2025'",
    "actif": [
      { "label": "Immobilisations brutes", "value": <n>, "type": "ligne" },
      { "label": "Amortissements", "value": <n>, "type": "negatif" },
      { "label": "Immobilisations nettes", "value": <n>, "type": "calc" },
      { "label": "Stocks (cajou + sous-produits)", "value": <n> },
      { "label": "Créances clients", "value": <n> },
      { "label": "Disponibilités", "value": <n> },
      { "label": "Autres actifs courants", "value": <n> }
    ],
    "total_actif": <n>,
    "passif": [
      { "label": "Capitaux propres", "value": <n>, "type": "ligne" },
      { "label": "dont capital social", "value": <n>, "type": "sub" },
      { "label": "dont réserves + report à nouveau", "value": <n>, "type": "sub" },
      { "label": "Dettes financières MLT", "value": <n> },
      { "label": "Dettes fournisseurs", "value": <n> },
      { "label": "Dettes fiscales et sociales", "value": <n> },
      { "label": "Autres dettes courantes", "value": <n> }
    ],
    "total_passif": <n>
  },
  "kpis_recalcules": [
    {
      "code": "dscr_apres_credit",
      "label": "DSCR (après crédit)",
      "valeur": "1.35x",
      "valeur_num": <number>,
      "detail": "string ex 'EBE 140M / Service dette 104M (existant 19M + nouveau 85M annualisé)'",
      "seuil": "string ex 'Seuil NSIA : 1.2x'",
      "tone": "good | warning | bad"
    },
    {
      "code": "endettement", "label": "Endettement", "valeur": "38%", "valeur_num": <number>,
      "detail": "string", "seuil": "string", "tone": "good|warning|bad"
    },
    {
      "code": "liquidite_generale", "label": "Liquidité générale", "valeur": "1.42", "valeur_num": <number>,
      "detail": "string ex 'Actifs courants / Passifs courants'", "seuil": "Seuil ≥ 1.0", "tone": "good|warning|bad"
    },
    {
      "code": "marge_ebe", "label": "Marge EBE", "valeur": "22.6%", "valeur_num": <number>,
      "detail": "string", "seuil": "string ex 'Médiane secteur agro-export : 18%'", "tone": "good|warning|bad"
    },
    {
      "code": "caf", "label": "CAF", "valeur": "104M", "valeur_num": <number>,
      "detail": "RN 92M + DA 12M", "seuil": "Capacité d'autofinancement", "tone": "good|warning|bad"
    },
    {
      "code": "caf_service_dette", "label": "CAF / Service dette", "valeur": "100%", "valeur_num": <number>,
      "detail": "string", "seuil": "Couvre intégralement le service dette", "tone": "good|warning|bad"
    },
    {
      "code": "fonds_roulement", "label": "Fonds de roulement", "valeur": "29M", "valeur_num": <number>,
      "detail": "string ex 'Capitaux permanents 106 - Immo 53 - Reste 24M'", "seuil": "", "tone": "good|warning|bad"
    },
    {
      "code": "bfr_ca", "label": "BFR / CA", "valeur": "18%", "valeur_num": <number>,
      "detail": "string ex 'BFR 110M / CA 620M'", "seuil": "string ex 'Saisonnalité cajou oct-mars'", "tone": "good|warning|bad"
    }
  ],
  "synthese_comite": {
    "narratif": "string — 4-6 phrases (impact retraitement EBE, conformité 4 ratios clés, non-conformité résiduelle si applicable)",
    "ebe_avant_retraitement": <number>,
    "ebe_apres_retraitement": <number>,
    "ecart_pct": <number>,
    "verdict": "string ex 'conforme aux 4 ratios clés' | 'non conforme'"
  },
  "sources": ["string — chaque source"],
  "metadata": { "devise": "string", "annee_n": "string", "date_generation": "string ISO" }
}`,
  user_instruction: 'Produis le modèle financier nettoyé : travaux réalisés, PnL retraité 3 ans détaillé, bilan retraité, 8 KPIs recalculés, synthèse et sources. Réponds en JSON strict selon le schéma.',
};

// ═══════════════════════════════════════════════════════════════════════════
// 2. PROJECTIONS FINANCIÈRES
// ═══════════════════════════════════════════════════════════════════════════
const PROJECTIONS: CreditReadinessPromptDef = {
  livrable_code: 'projections',
  deliverable_type: 'credit_readiness_projections',
  label: 'Projections financières',
  system_prompt: `Tu prépares les PROJECTIONS FINANCIÈRES sur 5 ans d'une PME pour le comité de crédit.

═══ OBJECTIF ═══
Démontrer que la PME peut servir le crédit sur 5 ans dans un scénario réaliste, et qu'elle résiste à un scénario de stress. Les projections couvrent l'horizon du crédit (en mois) avec un buffer d'un an après remboursement.

═══ STRUCTURE OBLIGATOIRE ═══
1. **Hypothèses de projection** (2 blocs) :
   - Hypothèses de croissance CA — détail année par année (5 ans), avec % et commentaire bref par année
   - Hypothèses de marge — mix produit, marge brute, marge EBE projetée, levier opérationnel

2. **Compte de résultat projeté — scénario CENTRAL** (1 seule grande table 5 ans) avec lignes :
   - Chiffre d'affaires (puis sous-lignes par segment de produit/canal pertinent : 2-4 sous-lignes)
   - (-) Achats matières premières
   - Marge brute (avec % du CA en parenthèses)
   - (-) Charges de personnel
   - (-) Charges externes
   - (-) Énergie + transport (variable)
   - (-) Autres charges (assurance, conseil…)
   - **EBE retraité** (avec % du CA, mis en évidence vert)
   - (-) Dotations amortissements (puis sous-ligne pour le nouveau CAPEX)
   - (-) Charges financières crédit existant
   - (-) Charges financières NOUVEAU crédit
   - (-) Impôt 25%
   - **Résultat net** (en gras)

3. **Service de la dette et calcul DSCR** (table 5 ans) :
   - Service crédit existant (Capital + intérêts)
   - Service NOUVEAU crédit (avec sous-ligne période différé si applicable)
   - Service total dette annuel
   - **DSCR projeté = EBE / Service total** (en vert)
   - DSCR base CAF (alternatif plus conservateur, en italique)

4. **3 scénarios alternatifs** (chacun avec hypothèses détaillées + résumé CA/EBE/DSCR 2026) :
   - **Stress** (pire cas raisonnable) : prix matière -20%, perte d'un acheteur, etc.
   - **Réaliste** (base case) : conforme aux hypothèses
   - **Optimiste** (marché porteur) : nouveaux clients, prix favorables

5. **Sensibilité du DSCR** (table 4 dimensions × 5 colonnes : -20% / -10% / Base / +10% / +20%) :
   - Variation prix de vente
   - Variation volume vendu
   - Variation coût matière première (sens inverse : hausse = baisse DSCR)
   - Variation taux d'intérêt du crédit (sens inverse)

6. **Synthèse pour le comité** : narratif sur la conformité au seuil DSCR (1.2x), variable la plus sensible, recommandation de garantie complémentaire si pertinent.

7. **Sources** : liste des sources utilisées (PnL retraité, hypothèses validées DG, pipeline LOI, benchmarks…).

${COMMON_RULES}`,
  output_schema: `{
  "objectif": "string — 1 phrase d'objectif (capacité de remboursement sur la durée)",
  "horizon": {
    "duree_mois": <number>,
    "annee_debut": "string ex '2026'",
    "annee_fin": "string ex '2030'",
    "buffer_apres": "string ex '1 an après remboursement'"
  },
  "hypotheses": {
    "croissance_ca": [
      { "annee": "2026", "pct": 19, "commentaire": "string ex 'montée en charge ligne décortication'" },
      { "annee": "2027", "pct": 15, "commentaire": "string" },
      { "annee": "2028", "pct": 15, "commentaire": "string" },
      { "annee": "2029", "pct": 10, "commentaire": "string" },
      { "annee": "2030", "pct": 9,  "commentaire": "string" }
    ],
    "marge": [
      { "label": "Mix produit", "valeur": "string ex '70% brute / 30% décortiquée en 2026 → 30/70 en 2030'" },
      { "label": "Marge brute décortiquée", "valeur": "string ex '35-40% (vs 15% pour la brute)'" },
      { "label": "Marge EBE projetée", "valeur": "string ex '22-25% sur la période'" },
      { "label": "Levier opérationnel", "valeur": "string" }
    ]
  },
  "compte_resultat_central": {
    "annees": ["2026E", "2027E", "2028E", "2029E", "2030E"],
    "lignes": [
      { "label": "Chiffre d'affaires", "values": [<n1>, <n2>, <n3>, <n4>, <n5>], "type": "produit", "bold": true },
      { "label": "dont [segment 1, ex cajou brute (export)]", "values": [<n1>, <n2>, <n3>, <n4>, <n5>], "type": "sub" },
      { "label": "dont [segment 2]", "values": [], "type": "sub" },
      { "label": "dont [segment 3]", "values": [], "type": "sub" },
      { "label": "Achats matières premières", "values": [], "type": "charge" },
      { "label": "Marge brute", "values": [], "type": "calc", "with_pct": true, "highlight": null },
      { "label": "Charges de personnel", "values": [], "type": "charge" },
      { "label": "Charges externes", "values": [], "type": "charge" },
      { "label": "Énergie + transport (variable)", "values": [], "type": "charge" },
      { "label": "Autres charges (assurance, conseil)", "values": [], "type": "charge" },
      { "label": "EBE retraité", "values": [], "type": "calc", "with_pct": true, "highlight": "green", "bold": true },
      { "label": "Dotations amortissements", "values": [], "type": "charge" },
      { "label": "dont nouvelle ligne (CAPEX [montant] / [durée] ans)", "values": [], "type": "sub" },
      { "label": "Charges financières crédit existant", "values": [], "type": "charge" },
      { "label": "Charges financières NOUVEAU crédit", "values": [], "type": "charge" },
      { "label": "Impôt 25%", "values": [], "type": "charge" },
      { "label": "Résultat net", "values": [], "type": "calc", "bold": true }
    ]
  },
  "service_dette": {
    "annees": ["2026E", "2027E", "2028E", "2029E", "2030E"],
    "service_existant": [<n1>, <n2>, <n3>, <n4>, <n5>],
    "service_nouveau": [<n1>, <n2>, <n3>, <n4>, <n5>],
    "differe_commentaire": "string|null ex 'période de différé : 6 mois (T1-T2 2026)'",
    "service_total": [<n1>, <n2>, <n3>, <n4>, <n5>],
    "dscr_projete": [<n1>, <n2>, <n3>, <n4>, <n5>],
    "dscr_base_caf": [<n1>, <n2>, <n3>, <n4>, <n5>],
    "seuil_dscr": 1.2
  },
  "scenarios": {
    "stress": {
      "label": "Scénario stress — pire cas raisonnable",
      "hypotheses": ["string — 3-5 puces"],
      "ca_2026": <number>,
      "ca_variation_pct": <number>,
      "ebe_2026": <number>,
      "ebe_marge_pct": <number>,
      "dscr_2026": <number>,
      "verdict": "string ex 'sous le seuil' | 'conforme' | 'confortable'"
    },
    "realiste": {
      "label": "Scénario réaliste — base case",
      "hypotheses": ["string"],
      "ca_2026": <number>,
      "ca_variation_pct": <number>,
      "ebe_2026": <number>,
      "ebe_marge_pct": <number>,
      "dscr_2026": <number>,
      "verdict": "string"
    },
    "optimiste": {
      "label": "Scénario optimiste — marché porteur",
      "hypotheses": ["string"],
      "ca_2026": <number>,
      "ca_variation_pct": <number>,
      "ebe_2026": <number>,
      "ebe_marge_pct": <number>,
      "dscr_2026": <number>,
      "verdict": "string"
    }
  },
  "sensibilite_dscr": {
    "annee_reference": "2026",
    "colonnes": ["-20%", "-10%", "Base", "+10%", "+20%"],
    "dimensions": [
      { "label": "Variation prix vente",          "valeurs": [<n1>,<n2>,<n3>,<n4>,<n5>], "sens_inverse": false },
      { "label": "Variation volume vendu",        "valeurs": [<n1>,<n2>,<n3>,<n4>,<n5>], "sens_inverse": false },
      { "label": "Variation coût matière",        "valeurs": [<n1>,<n2>,<n3>,<n4>,<n5>], "sens_inverse": true },
      { "label": "Variation taux intérêt crédit", "valeurs": [<n1>,<n2>,<n3>,<n4>,<n5>], "sens_inverse": true }
    ]
  },
  "synthese_comite": {
    "narratif": "string — 4-6 phrases (conformité au seuil 1.2x sur l'horizon, variable la plus sensible, recommandation garantie si nécessaire)",
    "variable_plus_sensible": "string"
  },
  "sources": ["string — chaque source"],
  "metadata": { "devise": "string", "annee_base": "string", "date_generation": "string ISO" }
}`,
  user_instruction: 'Produis les projections financières 5 ans avec compte de résultat central détaillé, service de la dette, 3 scénarios alternatifs, sensibilité 4 dimensions et synthèse comité. Réponds en JSON strict selon le schéma.',
};

// ═══════════════════════════════════════════════════════════════════════════
// 3. BUSINESS PLAN ORIENTÉ CRÉDIT
// ═══════════════════════════════════════════════════════════════════════════
const BP_CREDIT: CreditReadinessPromptDef = {
  livrable_code: 'bp_credit',
  deliverable_type: 'credit_readiness_bp_credit',
  label: 'Business plan orienté crédit',
  system_prompt: `Tu prépares le BUSINESS PLAN ORIENTÉ CRÉDIT d'une PME pour le comité.

═══ OBJECTIF ═══
Document concentré sur ce qui justifie l'octroi du crédit : QUOI financer, POURQUOI maintenant, COMMENT ça rembourse.
Ne pas reprendre tout le BP stratégique de la PME — focus sur les éléments qui rassurent le comité.

═══ STRUCTURE OBLIGATOIRE ═══
1. Objet du financement : décomposition du crédit demandé en 2-4 catégories d'usage (avec %, montant, justification)
2. Justification économique : situation actuelle vs après investissement (KPIs comparés)
3. Calcul de la marge additionnelle générée (volume × marge unitaire vs service de la dette)
4. KPIs investissement : Payback simple, ROI 1ère année, VAN sur 5 ans (taux 10%)
5. Marché cible et pipeline commercial : table d'acheteurs identifiés (volume, prix, statut LOI)
6. Calendrier d'exécution : timeline M+0 à année 2
7. Risques opérationnels et mitigation (3-6 risques avec probabilité + mitigation concrète)
8. Synthèse pour le comité (1 paragraphe)

${COMMON_RULES}`,
  output_schema: `{
  "intro_narratif": "string — 2-3 phrases : quoi financer, pourquoi maintenant, comment ça rembourse",
  "objet_financement": {
    "montant_total": <number>,
    "categories": [
      { "label": "Équipement industriel", "pct": 70, "montant": <number>, "description": "string — détail technique", "fournisseur": "string|null", "delai_livraison": "string|null" }
    ]
  },
  "justification_economique": {
    "situation_actuelle": [
      { "indicateur": "string ex 'Capacité de production'", "valeur": "string ex '350 t/an'" }
    ],
    "apres_investissement": [
      { "indicateur": "string", "valeur": "string", "delta_positif": true }
    ]
  },
  "calcul_marge_additionnelle": {
    "volume_traite_annuel": <number>,
    "unite_volume": "string ex 'tonnes'",
    "marge_additionnelle_unitaire": <number>,
    "marge_additionnelle_annuelle": <number>,
    "service_credit_annuel": <number>,
    "excedent_disponible": <number>,
    "narratif": "string"
  },
  "kpis_investissement": {
    "payback_annees": <number>,
    "payback_detail": "string ex '85M / 45M par an'",
    "roi_pct_annee1": <number>,
    "roi_detail": "string ex '45M sur 85M investis'",
    "van_5ans": <number>,
    "van_detail": "string ex 'net de remboursement crédit'",
    "taux_actualisation": 10
  },
  "marche_cible": {
    "narratif_marche": "string — 2-3 phrases sur la dynamique de marché",
    "pipeline_commercial": [
      { "acheteur": "string", "pays": "string", "volume": <number>, "unite": "string", "prix_unitaire": <number>, "ca_potentiel": <number>, "statut": "LOI signée | LOI verbal | en cours | prospect" }
    ],
    "total_pipeline_volume": <number>,
    "total_pipeline_prix_moyen": <number>,
    "total_pipeline_ca": <number>,
    "couverture_capacite_pct": <number>,
    "narratif_pipeline": "string — paragraphe expliquant la couverture, les LOI fermes vs verbales"
  },
  "calendrier_execution": [
    { "periode": "string ex 'M+0 à M+1'", "etapes": "string description" }
  ],
  "risques_operationnels": [
    { "risque": "string", "probabilite": "Faible | Moyenne | Élevée", "mitigation": "string" }
  ],
  "synthese_comite": {
    "argument_principal": "string — 2-3 phrases",
    "couverture_dette_par_marge": "string ex 'la marge additionnelle (45M) couvre 2x le service annuel (22M)'"
  },
  "sources": ["string"],
  "metadata": { "devise": "string", "date_generation": "string ISO" }
}`,
  user_instruction: 'Produis le business plan orienté crédit avec intro narratif, objet du financement, justification économique, calcul marge additionnelle, KPIs investissement, marché cible avec pipeline, calendrier, risques et sources. Réponds en JSON strict selon le schéma.',
};

// ═══════════════════════════════════════════════════════════════════════════
// 4. PLAN DE FINANCEMENT ET GARANTIES
// ═══════════════════════════════════════════════════════════════════════════
const PLAN_FINANCEMENT: CreditReadinessPromptDef = {
  livrable_code: 'plan_financement',
  deliverable_type: 'credit_readiness_plan_financement',
  label: 'Plan de financement et garanties',
  system_prompt: `Tu prépares le PLAN DE FINANCEMENT ET GARANTIES d'un dossier crédit PME pour le comité.

═══ OBJECTIF ═══
Détailler les modalités du crédit proposé et la couverture en garanties. C'est le document qui transforme un dossier "structurable" en dossier "décaissable".

═══ STRUCTURE OBLIGATOIRE ═══
1. Caractéristiques du crédit (montant, durée, taux, périodicité, service annuel, coût total)
2. Échéancier de remboursement annuel (capital, intérêts, capital restant)
3. Garanties propres proposées par la PME (avec décote bancaire et valeur retenue)
4. Activation garantie de partage de risque (IFC, ARIZ, GUDE) si applicable — comparer avec/sans
5. Conditions habituelles attendues du comité (covenants, domiciliation, assurances)
6. Frais de mise en place à la charge de la PME
7. Synthèse pour le comité (couverture totale, conformité grille)

═══ RÈGLE GARANTIES ═══
- Si la couverture propre < 100% du crédit → activer une garantie de partage de risque (IFC ou équivalent local).
- Toujours expliciter le mécanisme de la garantie (qui paie quoi en cas de défaut).
- La caution personnelle DG est complémentaire mais ne compte pas comme couverture principale.

${COMMON_RULES}`,
  output_schema: `{
  "intro_narratif": "string — 1-2 phrases : ce qui transforme un dossier 'structurable' en dossier 'décaissable'",
  "caracteristiques_credit": {
    "montant": <number>,
    "montant_commentaire": "string|null — ex 'équivalent ~130 K EUR au cours du 18/4/2026'",
    "duree_annees": <number>,
    "duree_commentaire": "string|null — ex 'Dont différé de remboursement de 6 mois (T1-T2 2026)'",
    "taux_nominal_pct": <number>,
    "taux_commentaire": "string ex 'Préférentiel ligne GUDE-PME (vs 9-10% standard)'",
    "periodicite": "string ex 'Trimestrielle'",
    "periodicite_commentaire": "string|null — ex 'Cohérente avec saisonnalité cajou (camp. oct-mars)'",
    "differe_remboursement_mois": <number>,
    "service_annuel_apres_differe": <number>,
    "service_commentaire": "string|null — ex 'Après différé : 4 échéances de 5.5M FCFA'",
    "cout_total": <number>,
    "cout_commentaire": "string|null — ex '85M capital + 15M intérêts sur 5 ans'"
  },
  "echeancier_remboursement": [
    { "annee": "string", "capital_rembourse": <number>, "interets_payes": <number>, "service_total": <number>, "capital_restant": <number> }
  ],
  "garanties_propres": [
    { "garantie": "string", "description": "string", "valeur_estimee": <number|null>, "decote_pct": <number|null>, "valeur_retenue": <number|null>, "modalite_juridique": "string", "valeur_estimee_label": "string|null — pour 'illimitée' ou 'n/a'" }
  ],
  "couverture_propre": {
    "total_valeur_retenue": <number>,
    "ratio_couverture_pct": <number>,
    "verdict": "string ex 'insuffisant — activation garantie IFC nécessaire'"
  },
  "garantie_partage_risque": {
    "applicable": <boolean>,
    "nom_ligne": "string ex 'IFC partage de risque 50%'",
    "comparaison": {
      "sans_garantie": {
        "seuil_couverture_requis_pct": 100,
        "couverture_propre_pct": <number>,
        "deficit_pct": <number>,
        "conformite": "string",
        "decision_probable": "string"
      },
      "avec_garantie": {
        "seuil_couverture_requis_pct": <number>,
        "couverture_propre_pct": <number>,
        "marge_pts": <number>,
        "conformite": "string",
        "decision_probable": "string"
      }
    },
    "mecanique": "string — 3-5 phrases d'explication du fonctionnement",
    "eligibilite": ["string"],
    "narratif": "string"
  },
  "conditions_attendues": [
    "string — chaque condition sur 1 ligne"
  ],
  "frais_mise_en_place": [
    { "frais": "string", "montant": <number>, "beneficiaire": "string", "commentaire": "string|null" }
  ],
  "total_frais_initiaux": <number>,
  "frais_pct_credit": <number>,
  "synthese_comite": {
    "narratif": "string — 4-6 phrases",
    "conformite_grille": "string ex '7/7 critères'"
  },
  "sources": ["string"],
  "metadata": { "devise": "string", "date_generation": "string ISO" }
}`,
  user_instruction: 'Produis le plan de financement et garanties complet avec intro, caractéristiques crédit (avec commentaires), échéancier, garanties propres, activation garantie partage de risque, conditions, frais et sources. Réponds en JSON strict selon le schéma.',
};

// ═══════════════════════════════════════════════════════════════════════════
// 5. ORGANIGRAMME ET GOUVERNANCE
// ═══════════════════════════════════════════════════════════════════════════
const ORGANIGRAMME: CreditReadinessPromptDef = {
  livrable_code: 'organigramme',
  deliverable_type: 'credit_readiness_organigramme',
  label: 'Organigramme et gouvernance',
  system_prompt: `Tu évalues la SOLIDITÉ ORGANISATIONNELLE d'une PME — un facteur clé pour le comité de crédit.

═══ OBJECTIF ═══
Le banquier veut savoir si l'organisation peut absorber un choc (départ du dirigeant, conflit familial, fraude interne, mauvais contrôle des opérations). Une PME aux bons ratios mais avec une gouvernance fragile présente un risque élevé.

═══ STRUCTURE ═══
1. Forme juridique + répartition du capital (avec analyse structure familiale/concentrée)
2. Équipe dirigeante et opérationnelle (DG, DAF, production, commerce, comptable externe)
3. Diagnostic des points de fragilité (4-6 points avec sévérité : risque homme-clé, DAF interne, gouvernance formelle, conformité juridique, équipe opérationnelle)
4. Plan de renforcement de la gouvernance (actions recommandées, échéances, coûts)
5. Synthèse pour le comité

═══ POINTS DE FRAGILITÉ TYPIQUES À ÉVALUER ═══
- Risque homme-clé (DG cumule trop de fonctions ?)
- Pas de DAF interne (qui contrôle les flux financiers ?)
- Gouvernance formelle limitée (CA, AG, PV à jour ?)
- Conformité juridique et réglementaire (RCCM, statuts, quitus fiscal, assurances)
- Solidité de l'équipe permanente (turnover, ancienneté)

Code chaque fragilité avec un niveau : 'critique' (rouge), 'modere' (orange), 'attention' (jaune), 'ok' (vert).

${COMMON_RULES}`,
  output_schema: `{
  "intro_narratif": "string — 2-3 phrases : pourquoi évaluer la gouvernance, quels chocs absorber",
  "forme_juridique": {
    "type": "string ex 'SARL'",
    "capital_social": <number>,
    "annee_creation": "string",
    "statuts_a_jour": <boolean>,
    "commentaire": "string — 1-2 phrases (modifications, dépôt greffe, etc.)"
  },
  "repartition_capital": [
    { "associe": "string", "role": "string", "pct": <number>, "nb_parts": <number>, "lien_dirigeant": "string|null" }
  ],
  "analyse_actionnariat": "string — ex 'Structure familiale : 90% du capital est détenu par la famille proche du DG. Le minoritaire (10%) n'a pas de droits spéciaux au-delà des statuts standards SARL OHADA.'",
  "equipe_dirigeante": [
    { "personne": "string", "age": <number>, "role": "string", "profil": "string", "anciennete": "string" }
  ],
  "effectif": {
    "cadres_label": "string ex '5 cadres + assistants'",
    "ouvriers_saisonniers_label": "string ex '+12 ouvriers + 25 saisonniers'",
    "total_label": "string ex 'Total 18 / 43 en pic'",
    "permanents": <number>,
    "saisonniers": <number>,
    "total_pic": <number>
  },
  "diagnostic_fragilites": [
    {
      "code": "string ex 'homme_cle'",
      "label": "string ex 'Risque homme-clé élevé'",
      "severite": "critique | modere | attention | ok",
      "constat": "string — paragraphe complet",
      "mitigation_existante": "string|null",
      "recommandation_comite": "string|null",
      "note_positive": "string|null — uniquement pour les cards severite=ok"
    }
  ],
  "plan_renforcement": {
    "intro": "string ex 'Liste des actions recommandées pour le comité mais non bloquantes pour le décaissement.'",
    "actions": [
      { "action": "string", "echeance": "string ex 'M+12'", "cout_estime": "string|null", "statut": "string ex 'Engagement DG | À planifier | Condition | À discuter | Engagement contractuel | Standard SA'" }
    ]
  },
  "synthese_comite": {
    "verdict": "string ex 'gouvernance typique PME en croissance, pas de drapeau rouge bloquant'",
    "narratif": "string — paragraphe complet",
    "blocages_decaissement": <boolean>
  },
  "sources": ["string"],
  "metadata": { "date_generation": "string ISO" }
}`,
  user_instruction: 'Produis l\'analyse organigramme et gouvernance avec intro, forme juridique, répartition capital, équipe dirigeante, diagnostic fragilités (4-6 cards avec sévérité), plan de renforcement et sources. Réponds en JSON strict selon le schéma.',
};

// ═══════════════════════════════════════════════════════════════════════════
// 6. ANALYSE COMMERCIALE
// ═══════════════════════════════════════════════════════════════════════════
const ANALYSE_COMMERCIALE: CreditReadinessPromptDef = {
  livrable_code: 'analyse_commerciale',
  deliverable_type: 'credit_readiness_analyse_commerciale',
  label: 'Analyse commerciale',
  system_prompt: `Tu évalues la SOLIDITÉ COMMERCIALE d'une PME pour le comité de crédit.

═══ OBJECTIF ═══
Le banquier veut s'assurer que le crédit ne dépend pas d'un équilibre commercial fragile. Tu analyses : portefeuille clients (concentration), géographie, saisonnalité, sensibilité aux chocs (perte de client, baisse de prix).

═══ STRUCTURE ═══
1. Portefeuille clients (table avec %CA, ancienneté, type de relation contrat/spot)
2. KPIs de concentration (Top 3, Top 5, % sous contrat pluriannuel)
3. Géographie et canaux d'export
4. Saisonnalité et impact trésorerie (table mensuelle/trimestrielle achats vs CA encaissé)
5. Sensibilité au prix mondial / matière première (table de stress sur DSCR)
6. Plan de diversification commerciale (actions engagées + objectifs)
7. Risques commerciaux et mitigation
8. Synthèse pour le comité

═══ SEUILS BANCAIRES ═══
- Concentration Top 3 < 60% (limite haute)
- % sous contrat pluriannuel ≥ 50% (cible)
- DSCR sous scénario stress ≥ 1.2x (seuil)

${COMMON_RULES}`,
  output_schema: `{
  "intro_narratif": "string — 2-3 phrases : pourquoi cette analyse, ce que le banquier veut s'assurer (que le crédit ne dépend pas d'un équilibre commercial fragile)",
  "portefeuille_clients": [
    { "client": "string", "type_produit": "string|null", "ca_annuel": <number>, "pct_ca": <number>, "anciennete": "string", "nature_relation": "string ex 'Contrat annuel | Spot saisonnier | Contrat pluriannuel'" }
  ],
  "total_ca": <number>,
  "annee_reference": "string",
  "kpis_concentration": {
    "top3_pct": <number>,
    "top3_clients": "string",
    "top3_seuil": "< 60% (limite haute)",
    "top3_verdict": "string ex 'au seuil' | 'concentration modérée' | 'sur-concentration'",
    "top5_pct": <number>,
    "pct_sous_contrat_pluriannuel": <number>,
    "objectif_pct_sous_contrat": 50
  },
  "geographie": {
    "repartition_ca": [
      { "zone": "string ex 'Asie (Inde+Vietnam+Singapore)'", "pct": <number>, "commentaire": "string|null" }
    ],
    "narratif": "string — 2-3 phrases"
  },
  "canaux_logistiques": ["string — chaque ligne"],
  "saisonnalite": {
    "narratif": "string — 2-3 phrases sur le cycle",
    "table_periodes": [
      { "periode": "string ex 'Oct-Dec (récolte)'", "achats_matiere": <number>, "ca_encaisse": <number>, "solde_mensuel": <number>, "bfr_cumule": <number> }
    ],
    "bfr_max": <number>,
    "periode_bfr_max": "string",
    "implication_credit": "string ex 'crédit campagne distinct nécessaire pour 2027'"
  },
  "sensibilite_prix": {
    "narratif": "string",
    "matiere_premiere": "string ex 'cajou brute'",
    "stress_table": [
      { "variation": "string ex '-30% (crise type 2018)'", "ca_impact": <number>, "ebe_impact": <number>, "dscr": <number>, "verdict": "tenable | sous seuil | rupture" }
    ],
    "point_attention": "string"
  },
  "plan_diversification": {
    "actions_engagees": ["string"],
    "objectifs": ["string"]
  },
  "risques_commerciaux": [
    { "risque": "string", "probabilite": "Faible|Moyenne|Élevée", "impact": "Faible|Modéré|Élevé", "mitigation": "string" }
  ],
  "synthese_comite": {
    "verdict": "string ex 'profil commercial conforme, sans drapeau rouge majeur'",
    "narratif": "string — paragraphe complet"
  },
  "sources": ["string"],
  "metadata": { "devise": "string", "annee_reference": "string", "date_generation": "string ISO" }
}`,
  user_instruction: 'Produis l\'analyse commerciale complète avec intro narratif, portefeuille clients, concentration, géographie, saisonnalité, sensibilité prix, plan de diversification, risques et sources. Réponds en JSON strict selon le schéma.',
};

// ═══════════════════════════════════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════════════════════════════════
export const CR_PROMPTS: Record<CreditReadinessLivrableCode, CreditReadinessPromptDef> = {
  modele_financier: MODELE_FINANCIER,
  projections: PROJECTIONS,
  bp_credit: BP_CREDIT,
  plan_financement: PLAN_FINANCEMENT,
  organigramme: ORGANIGRAMME,
  analyse_commerciale: ANALYSE_COMMERCIALE,
};

export function getCRPromptDef(code: string): CreditReadinessPromptDef | null {
  return (CR_PROMPTS as Record<string, CreditReadinessPromptDef>)[code] ?? null;
}
