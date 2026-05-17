// src/types/info-analyste-ba.ts
// Types pour la feature info_analyste BA (Ordre 8).
// Stockage : enterprises.ba_info_metadata jsonb + champs natifs (name, legal_form, creation_date).

export interface IdentityInfo {
  /** RCCM du Registre du Commerce. */
  rccm: string;
  /** Date création (ISO YYYY-MM-DD). Aussi mappé sur enterprises.creation_date. */
  date_creation_iso: string;
  /** SARL, SA, SAS, EI, SCS, etc. Aussi mappé sur enterprises.legal_form. */
  legal_form: string;
  /** Capital social en XOF (ou devise du fonds). */
  capital_social: number | null;
}

export interface Shareholder {
  /** id local stable (uuid ou timestamp). */
  id: string;
  name: string;
  /** Pourcentage 0-100. */
  pct: number;
  /** Rôle : Fondateur, Investisseur, Membre famille, etc. */
  role: string;
}

export interface ManagementMember {
  id: string;
  name: string;
  /** CEO, CFO, COO, CTO, Direction commerciale, etc. */
  role: string;
  /** Ancienneté dans le poste, en années. */
  anciennete_years: number;
}

export interface ActivityInfo {
  /** Description détaillée (aussi mappé sur enterprises.description). */
  description: string;
  /** Liste de produits/services principaux. */
  products: string[];
  /** Marchés cibles (B2B/B2C, secteurs, géos). */
  markets: string[];
  /** Clients clés nommés (ex: "BCEAO", "Total Sénégal"). */
  key_clients: string[];
  /** Texte libre : avantages compétitifs, USP, moats. */
  competitive_advantages: string;
}

export interface FinancialsSynth {
  /** Chiffre d'affaires Année N (en XOF ou devise par défaut). */
  ca_n: number | null;
  ca_n_1: number | null;
  ca_n_2: number | null;
  /** EBITDA année N. */
  ebitda_n: number | null;
  /** Marge EBITDA % (calculée ou saisie). */
  marge_ebitda_n: number | null;
  /** Dette totale (court + long terme). */
  dette_totale: number | null;
  /** Devise des montants (défaut XOF). */
  currency: string;
}

/** Bundle complet du formulaire info_analyste. */
export interface InfoAnalysteBa {
  identity: IdentityInfo;
  shareholders: Shareholder[];
  management: ManagementMember[];
  activity: ActivityInfo;
  financials: FinancialsSynth;
}

/** Snapshot enterprise persisté en DB + sources natives. */
export interface EnterpriseSnapshot {
  id: string;
  organization_id: string | null;
  name: string;
  sector: string | null;
  country: string | null;
  legal_form: string | null;
  creation_date: string | null;
  description: string | null;
  document_content: string | null;
  document_files_count: number | null;
  ba_info_metadata: Partial<InfoAnalysteBa>;
  ba_info_ai_filled: boolean;
  ba_info_updated_at: string | null;
}

export const DEFAULT_INFO_ANALYSTE_BA: InfoAnalysteBa = {
  identity: {
    rccm: '',
    date_creation_iso: '',
    legal_form: '',
    capital_social: null,
  },
  shareholders: [],
  management: [],
  activity: {
    description: '',
    products: [],
    markets: [],
    key_clients: [],
    competitive_advantages: '',
  },
  financials: {
    ca_n: null,
    ca_n_1: null,
    ca_n_2: null,
    ebitda_n: null,
    marge_ebitda_n: null,
    dette_totale: null,
    currency: 'XOF',
  },
};

export const LEGAL_FORMS = ['SARL', 'SA', 'SAS', 'SASU', 'EI', 'SCS', 'GIE', 'Coopérative', 'Autre'];

/** Forge un identifiant stable pour les rows tableau. */
export function makeRowId(): string {
  return `r-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Merge un snapshot DB + defaults vers l'objet typé complet. */
export function snapshotToInfo(snap: EnterpriseSnapshot): InfoAnalysteBa {
  const meta = snap.ba_info_metadata ?? {};
  return {
    identity: {
      ...DEFAULT_INFO_ANALYSTE_BA.identity,
      ...(meta.identity ?? {}),
      // Fallback depuis colonnes natives si meta vide
      date_creation_iso: meta.identity?.date_creation_iso || snap.creation_date || '',
      legal_form: meta.identity?.legal_form || snap.legal_form || '',
    },
    shareholders: meta.shareholders ?? [],
    management: meta.management ?? [],
    activity: {
      ...DEFAULT_INFO_ANALYSTE_BA.activity,
      ...(meta.activity ?? {}),
      description: meta.activity?.description || snap.description || '',
    },
    financials: { ...DEFAULT_INFO_ANALYSTE_BA.financials, ...(meta.financials ?? {}) },
  };
}
