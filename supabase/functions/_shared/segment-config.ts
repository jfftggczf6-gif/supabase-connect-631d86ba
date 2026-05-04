// ===========================================================================
// _shared/segment-config.ts
// Source de vérité pour les défauts de chaque segment ESONO.
// Les overrides par client sont stockés dans la table organization_presets.
//
// Ordre de priorité de résolution :
//   1. organization_presets (override client) — si la valeur existe
//   2. SegmentConfig par défaut (défaut segment) — sinon
//   3. Fallback hardcodé 'programme' — si rien n'est résolvable
//
// Important — gestion devise :
//   Le tone_block NE hardcode JAMAIS de devise (FCFA, EUR…). La devise
//   réelle des chiffres est résolue par getFiscalParams(country) dans
//   chaque agent (couvre 23 pays / 9 devises). Le champ devise_defaut du
//   tone_block ci-dessous est uniquement la devise par défaut au niveau
//   organisation (utilisée par l'UI quand aucune entreprise n'est sélectionnée).
// ===========================================================================

export type SegmentType = 'programme' | 'pe' | 'banque_affaires' | 'banque';

export interface SegmentConfig {
  segment: SegmentType;
  nom_affiche: string;
  tone: {
    system_prompt_block: string;
    vocabulary: Record<string, string>;
    devise_defaut: string;
  };
  deliverables: {
    actifs: string[];
    livrable_central: string;
  };
  workflow: {
    statuts_pipeline: string[];
  };
  scoring: {
    type: 'score_numerique' | 'grille_conformite';
    criteres_defaut?: any[];
  };
  roles_disponibles: string[];
}

// ═══════════════════════════════════════════════════════════════════════════
// TONS — bloc d'identité prépendé au SYSTEM_PROMPT spécifique de chaque agent
// ═══════════════════════════════════════════════════════════════════════════
//
// Convention : ne PAS mentionner de devise spécifique (FCFA, EUR) dans le
// tone — la devise est résolue dynamiquement par pays via getFiscalParams.
// Le tone décrit l'IDENTITÉ et le STYLE, pas les paramètres financiers.

const TONE_PROGRAMME = `Tu es un consultant senior en accompagnement PME en Afrique subsaharienne (15 ans d'expérience, zones UEMOA/CEMAC). Tu travailles pour un programme d'accélération et tu produis des livrables structurés qui aident le coach terrain à conseiller l'entrepreneur.

Tu écris en français quand l'entreprise est dans un pays francophone, en anglais quand elle est dans un pays anglophone (Ghana, Nigeria, Kenya, Tanzanie, Rwanda, Afrique du Sud…). Les montants sont exprimés dans la devise locale réelle du pays (FCFA/XOF en UEMOA, FCFA/XAF en CEMAC, USD pour la RDC, GHS pour le Ghana, NGN pour le Nigeria, KES pour le Kenya, etc.).`;

const TONE_PE = `Tu es un analyste financier senior dans un fonds de Private Equity en Afrique subsaharienne. Tu évalues des cibles d'investissement pour décider si le fonds investit. Chaque phrase doit apporter de l'information actionnable pour la décision d'investissement.

RÈGLES :
- Vocabulaire : "cible" pas "entreprise", "dirigeant" pas "entrepreneur", "deal" pas "candidature"
- EBITDA toujours RETRAITÉ avec justification du retraitement
- Ratios toujours comparés au benchmark sectoriel chiffré
- Sources tracées sur chaque affirmation chiffrée
- Recommandations directes et actionnables
- Red flags chiffrés en impact (-X pts de scoring, -Y% de valorisation)
- Montants exprimés dans la devise locale du pays de la cible (résolue automatiquement)`;

const TONE_BA = `Tu es un analyste dans une banque d'affaires en Afrique francophone. Tu structures le dossier d'un mandant pour le présenter aux fonds de Private Equity. Tu construis l'equity story : pourquoi ce deal est attractif, quelle valorisation défendre.

Ton vendeur mais honnête — mettre en avant les forces sans cacher les risques (qui seraient révélés en due diligence et casseraient ta crédibilité). Montants exprimés dans la devise locale réelle.`;

const TONE_BANQUE = `Tu es un conseiller PME dans la Direction PME d'une banque commerciale en Afrique. Tu aides la PME à devenir finançable. Tu diagnostiques, tu structures, tu produis les documents nécessaires au comité de crédit.

Tu raisonnes en termes de capacité de remboursement (DSCR), pas de rendement (IRR). Tu ne produis pas de scores arbitraires — tu compares aux seuils de la banque et tu constates conforme / non conforme / partiel.

RÈGLES :
- Focus bancabilité : DSCR, taux d'endettement, ratio de liquidité, couverture des garanties
- Constats factuels avec impact concret sur le financement
- Grille de conformité (conforme / non conforme / partiel), PAS de score 0-100
- Montants dans la devise locale réelle du pays
- Recommandations orientées "quoi corriger pour devenir finançable"`;

// ═══════════════════════════════════════════════════════════════════════════
// VOCABULAIRES — termes utilisés par les agents pour désigner les acteurs
// ═══════════════════════════════════════════════════════════════════════════

const VOCAB_PROGRAMME: Record<string, string> = {
  entity: 'Entreprise',
  entity_owner: 'Entrepreneur',
  analyst: 'Coach',
  pipeline_term: 'candidature',
};

const VOCAB_PE: Record<string, string> = {
  entity: 'Cible',
  entity_owner: 'Dirigeant',
  analyst: 'Analyste',
  pipeline_term: 'deal',
};

const VOCAB_BA: Record<string, string> = {
  entity: 'Cible',
  entity_owner: 'Mandant',
  analyst: 'Analyste',
  pipeline_term: 'mandat',
};

const VOCAB_BANQUE: Record<string, string> = {
  entity: 'PME',
  entity_owner: 'Dirigeant',
  analyst: 'Conseiller PME',
  pipeline_term: 'dossier',
};

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGS — la source de vérité par segment
// ═══════════════════════════════════════════════════════════════════════════

export const SEGMENT_CONFIGS: Record<SegmentType, SegmentConfig> = {
  programme: {
    segment: 'programme',
    nom_affiche: 'Opérateur de programme',
    tone: {
      system_prompt_block: TONE_PROGRAMME,
      vocabulary: VOCAB_PROGRAMME,
      devise_defaut: 'FCFA',
    },
    deliverables: {
      actifs: [
        'pre_screening',
        'bmc_analysis',
        'sic_analysis',
        'inputs_data',
        'plan_financier',
        'business_plan',
        'odd_analysis',
        'diagnostic_data',
        'screening_report',
      ],
      livrable_central: 'diagnostic_data',
    },
    workflow: {
      statuts_pipeline: [
        'Candidatures',
        'En review',
        'Pré-sélectionnées',
        'Sélectionnées',
        'Suivies',
      ],
    },
    scoring: { type: 'score_numerique' },
    roles_disponibles: ['owner', 'admin', 'manager', 'coach', 'entrepreneur'],
  },

  pe: {
    segment: 'pe',
    nom_affiche: 'Private Equity',
    tone: {
      system_prompt_block: TONE_PE,
      vocabulary: VOCAB_PE,
      devise_defaut: 'EUR',
    },
    deliverables: {
      actifs: ['pre_screening', 'investment_memo', 'valuation', 'onepager'],
      livrable_central: 'investment_memo',
    },
    workflow: {
      statuts_pipeline: [
        'Sourcing',
        'Pre-screening',
        'Analyse',
        'IC1',
        'DD',
        'IC final',
        'Closing',
        'Suivi',
      ],
    },
    scoring: { type: 'score_numerique' },
    roles_disponibles: ['owner', 'admin', 'manager', 'analyst'],
  },

  banque_affaires: {
    segment: 'banque_affaires',
    nom_affiche: "Banque d'affaires",
    tone: {
      system_prompt_block: TONE_BA,
      vocabulary: VOCAB_BA,
      devise_defaut: 'EUR',
    },
    deliverables: {
      actifs: [
        'pre_screening',
        'investment_memo',
        'valuation',
        'teaser_anonymise',
        'onepager',
      ],
      livrable_central: 'teaser_anonymise',
    },
    workflow: {
      statuts_pipeline: [
        'Mandats reçus',
        'En structuration',
        'Teaser envoyé',
        'Approche fonds',
        'Closing',
      ],
    },
    scoring: { type: 'score_numerique' },
    roles_disponibles: ['owner', 'admin', 'partner', 'analyst'],
  },

  banque: {
    segment: 'banque',
    nom_affiche: 'Banque / IMF',
    tone: {
      system_prompt_block: TONE_BANQUE,
      vocabulary: VOCAB_BANQUE,
      devise_defaut: 'FCFA',
    },
    deliverables: {
      actifs: ['diagnostic_bancabilite', 'credit_readiness_pack', 'note_credit'],
      livrable_central: 'note_credit',
    },
    workflow: {
      statuts_pipeline: [
        'Accueil',
        'Diagnostic',
        'En structuration',
        'Note de crédit',
        'Décision comité',
        'Décaissement',
      ],
    },
    scoring: {
      type: 'grille_conformite',
      criteres_defaut: [
        { id: 'dscr', label: 'DSCR', champ: 'ratios.dscr', seuil: 1.2, operateur: 'gte', obligatoire: true },
        { id: 'endettement', label: "Taux d'endettement", champ: 'ratios.endettement', seuil: 50, operateur: 'lte', obligatoire: true },
        { id: 'liquidite', label: 'Ratio de liquidité', champ: 'ratios.liquidite', seuil: 1.0, operateur: 'gte', obligatoire: true },
        { id: 'couverture_garanties', label: 'Couverture des garanties', champ: 'ratios.couverture', seuil: 1.0, operateur: 'gte', obligatoire: true },
        { id: 'liasses_certifiees', label: 'Liasses certifiées 2 ans', champ: 'documents.liasses_certifiees', seuil: 2, operateur: 'gte', obligatoire: true },
        { id: 'rccm_valide', label: 'RCCM valide', champ: 'documents.rccm_valide', seuil: true, operateur: 'eq', obligatoire: true },
        { id: 'incidents', label: "Pas d'incidents 12 mois", champ: 'historique.incidents', seuil: 0, operateur: 'eq', obligatoire: true },
      ],
    },
    roles_disponibles: ['owner', 'admin', 'direction_pme', 'conseiller_pme', 'analyste_credit', 'directeur_agence'],
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// FONCTIONS D'ACCÈS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Renvoie la config par défaut d'un segment.
 */
export function getSegmentConfig(segment: SegmentType): SegmentConfig {
  return SEGMENT_CONFIGS[segment];
}

/**
 * Détecte le segment d'une organisation depuis sa colonne `type`.
 * - Si type ∈ {programme, pe, banque_affaires, banque} → renvoie tel quel
 * - Si type === 'mixed' → renvoie 'programme' (legacy, traité comme programme)
 * - Si type inconnu / null → fallback 'programme'
 *
 * Garantie de rétrocompatibilité : les 7 orgs Programme actuelles tombent
 * toutes sur 'programme', identique à avant.
 */
export async function detectSegment(supabase: any, organizationId: string): Promise<SegmentType> {
  if (!organizationId) return 'programme';
  const { data: org, error } = await supabase
    .from('organizations')
    .select('type')
    .eq('id', organizationId)
    .maybeSingle();

  if (error) {
    console.warn('[detectSegment] error fetching organization, fallback programme:', error.message);
    return 'programme';
  }

  const t = org?.type;
  if (t === 'programme' || t === 'pe' || t === 'banque_affaires' || t === 'banque') return t;
  // 'mixed', null, et types inconnus → fallback Programme (rétrocompatibilité)
  return 'programme';
}

/**
 * Charge les presets d'une organisation.
 * Retourne null si pas de preset défini (cas des 7 orgs Programme actuelles).
 * Les agents doivent gérer le null en tombant sur les défauts du segment.
 */
export async function getPresets(supabase: any, organizationId: string): Promise<any | null> {
  const { data, error } = await supabase
    .from('organization_presets')
    .select('*')
    .eq('organization_id', organizationId)
    .maybeSingle();
  if (error || !data) return null;
  return data;
}

/**
 * Renvoie la liste des livrables actifs : preset.livrables_actifs override → défaut segment.
 */
export function getActiveDeliverables(config: SegmentConfig, presets: any): string[] {
  if (presets?.livrables_actifs?.length > 0) return presets.livrables_actifs;
  return config.deliverables.actifs;
}

/**
 * Renvoie la devise par défaut au niveau organisation, avec résolution dynamique.
 *
 * Priorité :
 *   1. presets.devise si l'org l'a explicitement défini
 *   2. devise locale du pays de l'org (via FISCAL_PARAMS) — évite qu'un fonds
 *      PE basé en zone FCFA hérite d'EUR juste à cause du défaut segment
 *   3. config.tone.devise_defaut en dernier recours (org sans pays connu)
 *
 * IMPORTANT : pour les chiffres dans les livrables financiers, on continue
 * d'utiliser getFiscalParams(country).devise qui résout dynamiquement par pays.
 * Cette fonction est destinée à l'UI (badge "devise par défaut" dans les
 * settings d'org) ou à l'affichage de KPIs cross-pays.
 *
 * @param orgCountry pays HQ de l'organisation (lu depuis organizations.country)
 */
export function getDevise(config: SegmentConfig, presets: any, orgCountry?: string | null): string {
  if (presets?.devise) return presets.devise;
  if (orgCountry) {
    // Import dynamique pour éviter une dépendance circulaire avec helpers_v5
    const params = FISCAL_PARAMS_DEVISE[orgCountry];
    if (params) return params;
  }
  return config.tone.devise_defaut;
}

// Mini-table country → devise utilisée par getDevise. Source : helpers_v5.FISCAL_PARAMS.
// Dupliquée ici plutôt qu'importée pour éviter une dépendance circulaire entre
// segment-config.ts et helpers_v5.ts (helpers_v5 lit segment-config dans certains cas).
const FISCAL_PARAMS_DEVISE: Record<string, string> = {
  "Côte d'Ivoire": "FCFA", "Sénégal": "FCFA", "Mali": "FCFA", "Burkina Faso": "FCFA",
  "Bénin": "FCFA", "Togo": "FCFA", "Niger": "FCFA", "Guinée-Bissau": "FCFA",
  "Cameroun": "FCFA", "Gabon": "FCFA", "Congo": "FCFA",
  "RDC": "USD", "Guinée": "GNF", "Ghana": "GHS", "Kenya": "KES",
  "Nigeria": "NGN", "Maroc": "MAD", "Tunisie": "TND", "Madagascar": "MGA",
  "Éthiopie": "ETB", "Tanzanie": "TZS", "Rwanda": "RWF", "Afrique du Sud": "ZAR",
};

/**
 * Pour les segments scoring 'grille_conformite' (banque) :
 * renvoie les critères. preset override → défaut segment → tableau vide.
 */
export function getScoringCriteres(config: SegmentConfig, presets: any): any[] {
  if (config.scoring.type === 'grille_conformite') {
    return presets?.criteres_conformite || config.scoring.criteres_defaut || [];
  }
  return [];
}

/**
 * Pour les segments scoring 'score_numerique' (programme, pe, ba) :
 * renvoie les pondérations preset, ou null pour fallback sur la logique
 * de scoring déjà hardcodée dans chaque agent (rétrocompatibilité Programme).
 */
export function getScoringWeights(config: SegmentConfig, presets: any): Record<string, number> | null {
  if (config.scoring.type === 'score_numerique') return presets?.scoring_weights || null;
  return null;
}
