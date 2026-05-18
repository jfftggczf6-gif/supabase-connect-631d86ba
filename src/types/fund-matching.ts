// src/types/fund-matching.ts
// Contrats pour fund_matching + deal_tracking (wireframe wireframe_fund_matching_ba.html).
//
// État par deal × fonds : table pe_fund_outreach (migration 20260518000001).

export type OutreachStatus =
  | 'matched'        // dans shortlist, pas encore contacté
  | 'teaser_sent'    // teaser envoyé
  | 'interested'     // réponse positive
  | 'nda_pending'    // NDA envoyée
  | 'nda_signed'     // NDA signée
  | 'im_shared'      // IM partagé
  | 'meeting_held'   // management meeting réalisé
  | 'ioi_received'   // IOI reçue
  | 'loi_signed'     // LOI signée
  | 'closed'         // closing finalisé
  | 'declined';      // décliné

export const OUTREACH_STEPS: { code: OutreachStatus; label: string; short: string }[] = [
  { code: 'matched',       label: 'Matchés',         short: 'M' },
  { code: 'teaser_sent',   label: 'Teaser envoyé',   short: 'T' },
  { code: 'interested',    label: 'Intéressés',      short: 'I' },
  { code: 'nda_signed',    label: 'NDA signée',      short: 'N' },
  { code: 'im_shared',     label: 'IM partagé',      short: 'D' },
  { code: 'meeting_held',  label: 'Mgmt meeting',    short: 'R' },
  { code: 'ioi_received',  label: 'IOI reçue',       short: 'O' },
  { code: 'loi_signed',    label: 'LOI',             short: 'L' },
  { code: 'closed',        label: 'Closing',         short: 'C' },
];

/** Ordre logique pour vérifier "stage X atteint ou dépassé" (sauf declined). */
export const STAGE_ORDER: Record<OutreachStatus, number> = {
  matched: 0, teaser_sent: 1, interested: 2, nda_pending: 2.5, nda_signed: 3,
  im_shared: 4, meeting_held: 5, ioi_received: 6, loi_signed: 7, closed: 8,
  declined: -1,
};

export interface FundingProgramRow {
  id: string;
  name: string;
  organisme: string | null;
  type_financement: string[] | null;
  pays_eligibles: string[] | null;
  secteurs_eligibles: string[] | null;
  ticket_min: number | null;
  ticket_max: number | null;
  contact_email: string | null;
}

export interface OutreachRow {
  id: string;
  deal_id: string;
  funding_program_id: string;
  status: OutreachStatus;
  match_score: number | null;
  last_action_at: string | null;
  last_action_label: string | null;
  ioi_amount: number | null;
  ioi_currency: string | null;
  ioi_structure: string | null;
  ioi_conditions: string | null;
  ioi_exclusivity_days: number | null;
  ioi_received_at: string | null;
  private_notes: string | null;
}

/** Fond hydraté : merge programme + outreach + score IA. */
export interface FundRow {
  program: FundingProgramRow;
  outreach: OutreachRow | null;
  fit_score: number;
  /** Critères remplis (depuis funding_matches) */
  criteria_met: string[];
  criteria_missing: string[];
}

/** KPIs en haut du tableau. */
export interface OutreachKpis {
  matched: number;
  contacted: number;     // teaser_sent ou plus
  interested: number;    // interested ou plus (hors declined)
  nda: number;           // nda_signed ou plus
  ioi: number;           // ioi_received ou plus
  declined: number;
}

/** Métriques de conversion bas du wireframe. */
export interface ConversionMetrics {
  teaser_to_interest: { pct: number; num: number; denom: number };
  interest_to_nda:    { pct: number; num: number; denom: number };
  nda_to_ioi:         { pct: number; num: number; denom: number };
  overall:            { pct: number; num: number; denom: number };
}
