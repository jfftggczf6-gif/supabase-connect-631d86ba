// src/types/ba.ts
// Types pour le module Banque d'Affaires (BA / Advisory).
// Réutilise pe_deals avec source='mandat_ba' — pas de table dédiée côté DB.

export type BaStage = 'recus' | 'im' | 'interets' | 'nego' | 'close';

export type BaRoleLabel = 'Analyste BA' | 'Senior' | 'Partner';

/** Mandat = ligne pe_deals (source='mandat_ba') + jointure enrichies.
 *  V1 : on réutilise ticket_demande / enterprises.sector / enterprises.country.
 *  Les champs ticket_min/max/success_fee/retainer arriveront avec fund_matching. */
export interface Mandat {
  id: string;
  deal_ref: string;
  enterprise_id: string | null;
  enterprise_name?: string | null;
  sector?: string | null;
  country?: string | null;
  stage: string;
  ticket_demande: number | null;
  currency: string | null;
  lead_analyst_id: string | null;
  lead_analyst_name?: string | null;
  lead_analyst_initials?: string;
  lead_im_id: string | null;
  lead_im_name?: string | null;
  score_360: number | null;
  progress_pct?: number;
  sections_in_review?: number;
  created_at?: string;
  updated_at?: string;
}

export interface NewMandatInput {
  enterprise_name: string;
  sector: string;
  country: string;
  contact_name: string;
  contact_email?: string;
  ticket_demande: number;
  currency: string;
  lead_analyst_id: string;
  lead_im_id?: string;
}

export interface MandatKpis {
  /** Analyste : mes mandats / à corriger / sections OK / docs manquants
   *  Senior   : mandats actifs / à reviewer / analystes / sections en review
   *  Partner  : total / nouveaux / en revue / closés ce mois */
  label_1: string; value_1: number | string;
  label_2: string; value_2: number | string;
  label_3: string; value_3: number | string;
  label_4: string; value_4: number | string;
}

export type ViewMode = 'kanban' | 'table';

/** Activité récente (lecture pe_deal_history + format human). */
export interface RecentActivity {
  id: string;
  deal_id: string;
  deal_ref: string;
  enterprise_name?: string | null;
  action: string;
  actor_name?: string | null;
  at: string;
  dot_color: 'green' | 'orange' | 'red' | 'gray' | 'blue';
}

/** Référentiels P6 — secteurs et pays. */
export const BA_SECTORS = [
  'Agro-industrie',
  'Énergie',
  'Fintech',
  'Industrie',
  'Logistique',
  'Santé',
  'Services',
  'Télécoms',
  'Distribution',
  'Construction',
] as const;

export const BA_COUNTRIES = [
  'Bénin',
  'Burkina Faso',
  'Côte d\'Ivoire',
  'Guinée-Bissau',
  'Mali',
  'Niger',
  'Sénégal',
  'Togo',
] as const;

export const BA_CURRENCIES = ['EUR', 'USD', 'XOF', 'GBP'] as const;
export type BaCurrency = (typeof BA_CURRENCIES)[number];
