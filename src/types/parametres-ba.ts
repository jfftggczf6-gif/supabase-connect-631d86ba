// src/types/parametres-ba.ts
// Types pour la feature parametres_ba — config org BA.
// Stockage : organization_presets.templates_custom jsonb + devise + langue top-level.

/** SECTION 1 — Identité du fonds */
export interface FundIdentity {
  commercial_name: string;
  legal_name: string;
  email: string;
  website: string | null;
  address: string | null;
  /** URL publique Supabase Storage bucket `org_logos`. */
  logo_url: string | null;
}

/** SECTION 2 — Devise & formats */
export type Devise = 'XOF' | 'EUR' | 'USD' | 'GBP';
export type DateFormat = 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD';
export type NumberFormat = 'fr-FR' | 'en-US';
export type Langue = 'fr' | 'en';

export interface DeviseFormats {
  devise: Devise;
  date_format: DateFormat;
  number_format: NumberFormat;
  langue: Langue;
}

/** SECTION 3 — Critères d'investissement (alimente pre-screening, screening, matching) */
export type GeographieUEMOA =
  | 'Bénin' | 'Burkina Faso' | "Côte d'Ivoire" | 'Guinée-Bissau'
  | 'Mali' | 'Niger' | 'Sénégal' | 'Togo';

export const ESG_EXCLUDED_PRESETS = ['Tabac', 'Alcool', 'Armes', 'Jeux de hasard', 'Pornographie'] as const;
export const SECTORS_PRESETS = [
  'Agro-industrie', 'Énergie', 'Fintech', 'Industrie',
  'Logistique', 'Santé', 'Services', 'Télécoms',
  'Distribution', 'Construction', 'Tech', 'Éducation',
] as const;
export const GEOGRAPHIES_UEMOA: GeographieUEMOA[] = [
  'Bénin', 'Burkina Faso', "Côte d'Ivoire", 'Guinée-Bissau',
  'Mali', 'Niger', 'Sénégal', 'Togo',
];

export interface InvestmentCriteria {
  /** Fourchette ticket en M USD. */
  ticket_min: number;
  ticket_max: number;
  /** Tags secteurs autorisés. */
  sectors_authorized: string[];
  /** Tags secteurs exclus ESG. */
  sectors_excluded: string[];
  /** Géographies UEMOA cibles. */
  geographies: GeographieUEMOA[];
  /** Ancienneté minimum société en années. */
  anciennete_min: number;
  /** Grille ESG IFC active ? */
  esg_ifc_enabled: boolean;
}

/** SECTION 4 — Thèse d'investissement (texte libre) */
export interface InvestmentThesis {
  text: string;
  /** Limite caractères (UI compteur). */
  max_length: number;
}

/** Bundle complet des 4 sections — shape stockée dans organization_presets. */
export interface ParametresBa {
  fund_identity: FundIdentity;
  devise_formats: DeviseFormats;
  investment_criteria: InvestmentCriteria;
  investment_thesis: InvestmentThesis;
}

/** Defaults pour une org BA fraîchement créée. */
export const DEFAULT_PARAMETRES_BA: ParametresBa = {
  fund_identity: {
    commercial_name: '',
    legal_name: '',
    email: '',
    website: null,
    address: null,
    logo_url: null,
  },
  devise_formats: {
    devise: 'XOF',
    date_format: 'DD/MM/YYYY',
    number_format: 'fr-FR',
    langue: 'fr',
  },
  investment_criteria: {
    ticket_min: 2,
    ticket_max: 25,
    sectors_authorized: [],
    sectors_excluded: ['Tabac', 'Alcool', 'Armes', 'Jeux de hasard'],
    geographies: [...GEOGRAPHIES_UEMOA],
    anciennete_min: 3,
    esg_ifc_enabled: true,
  },
  investment_thesis: {
    text: '',
    max_length: 2000,
  },
};

/** Liste des usages IA pour aperçu UX (Section 4 — brief #6). */
export const THESIS_AI_USAGES = [
  { code: 'pre_screening', label: 'Pre-screening 360°' },
  { code: 'memo_sections', label: 'Sections IM (§5 Marché, §10 Thèse, §11 Risques)' },
  { code: 'teaser', label: 'Génération du teaser anonymisé' },
  { code: 'fund_matching', label: 'Matching avec fonds candidats' },
];
