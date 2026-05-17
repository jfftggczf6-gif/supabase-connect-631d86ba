// src/types/synthese-ba.ts
// Types pour la feature synthese_partner (Ordre 6) — dashboard Partner BA.

import type { Mandat } from './ba';

/** Les 4 KPIs du brief #2 — buckets par groupe de stages. */
export interface SyntheseKpis {
  actifs: number;          // total mandats hors close+lost
  structuration: number;   // stages recus + im
  diffusion: number;       // stages interets + nego
  close_ytd: number;       // close avec updated_at année courante
}

/** Brief #4 — synthèse business : valeur du pipeline + fees + win rate. */
export interface BusinessSynthese {
  pipeline_value_usd: number;       // ∑ ticket_demande des mandats actifs (en USD équiv)
  success_fees_potential_usd: number;  // ∑ ticket × success_fee_pct (defaut 3%)
  deals_closed_ytd: number;
  /** Win rate YTD = close / (close + lost). 0-1, null si dénominateur 0. */
  win_rate_ytd: number | null;
  /** Taux success fee appliqué (defaut 3%, configurable plus tard via parametres_ba.investment_criteria). */
  success_fee_pct: number;
}

/** Bundle complet renvoyé par useSyntheseBa. */
export interface SyntheseBundle {
  mandats: Mandat[];
  kpis: SyntheseKpis;
  business: BusinessSynthese;
}

/** Stages considérés "actifs" (excluent close + lost). */
export const ACTIVE_STAGES = new Set(['recus', 'im', 'interets', 'nego']);
export const STRUCTURATION_STAGES = new Set(['recus', 'im']);
export const DIFFUSION_STAGES = new Set(['interets', 'nego']);

/** Taux success fee par défaut (3% du ticket). Override possible via parametres_ba. */
export const DEFAULT_SUCCESS_FEE_PCT = 0.03;
