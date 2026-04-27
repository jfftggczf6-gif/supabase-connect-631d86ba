// ===========================================================================
// src/lib/segment-config-front.ts
// Configuration multi-segment côté frontend.
//
// Ce fichier est une projection minimale de _shared/segment-config.ts (backend) :
// - Le backend a besoin du tone_block long pour les prompts IA
// - Le frontend a besoin des labels affichables, modules visibles, scoring type
//
// Source de vérité du segment : `organizations.type` (charger via useOrganization).
// Utiliser le hook useSegment() pour accéder à la config courante dans un composant.
// ===========================================================================

import {
  Stethoscope, LayoutGrid, Globe, BarChart3, FileText, Target, TrendingUp,
  Briefcase, FileSpreadsheet, ShieldCheck, Banknote, FileBadge,
  type LucideIcon,
} from 'lucide-react';

export type SegmentType = 'programme' | 'pe' | 'banque_affaires' | 'banque';

export interface SegmentVocab {
  /** Singulier du nom de l'entité accompagnée (ex: "Entreprise", "Cible") */
  entity: string;
  /** Pluriel */
  entity_plural: string;
  /** Le propriétaire de l'entité (ex: "Entrepreneur", "Dirigeant", "Mandant") */
  entity_owner: string;
  /** L'analyste/coach (ex: "Coach", "Analyste", "Conseiller PME") */
  analyst: string;
  /** Le terme pipeline (ex: "candidature", "deal", "mandat", "dossier") */
  pipeline_term: string;
  /** Pluriel du pipeline_term */
  pipeline_term_plural: string;
}

export interface SegmentModule {
  code: string;
  title: string;
  shortTitle?: string;
  icon: LucideIcon;
  color: string;
  step: number;
}

export interface SegmentConfigFront {
  segment: SegmentType;
  /** Label affiché dans l'UI ("Programme", "Private Equity"...) */
  label: string;
  /** Label court pour les badges */
  shortLabel: string;
  /** Vocabulaire UI */
  vocab: SegmentVocab;
  /** Modules visibles dans la sidebar pour ce segment */
  modules: SegmentModule[];
  /** Type de scoring : numérique 0-100 ou grille de conformité */
  scoring: 'score_numerique' | 'grille_conformite';
  /** Statuts du pipeline pour les filtres */
  pipeline_statuts: string[];
  /** Devise par défaut affichée (pour vues agrégées — la vraie devise vient du pays) */
  devise_defaut: string;
  /** Rôles applicatifs disponibles pour ce segment */
  roles_disponibles: string[];
}

// ═══════════════════════════════════════════════════════════════════════════
// VOCABULAIRES par segment
// ═══════════════════════════════════════════════════════════════════════════

const VOCAB_PROGRAMME: SegmentVocab = {
  entity: 'Entreprise',
  entity_plural: 'Entreprises',
  entity_owner: 'Entrepreneur',
  analyst: 'Coach',
  pipeline_term: 'candidature',
  pipeline_term_plural: 'candidatures',
};

const VOCAB_PE: SegmentVocab = {
  entity: 'Cible',
  entity_plural: 'Cibles',
  entity_owner: 'Dirigeant',
  analyst: 'Analyste',
  pipeline_term: 'deal',
  pipeline_term_plural: 'deals',
};

const VOCAB_BA: SegmentVocab = {
  entity: 'Cible',
  entity_plural: 'Cibles',
  entity_owner: 'Mandant',
  analyst: 'Analyste',
  pipeline_term: 'mandat',
  pipeline_term_plural: 'mandats',
};

const VOCAB_BANQUE: SegmentVocab = {
  entity: 'PME',
  entity_plural: 'PME',
  entity_owner: 'Dirigeant',
  analyst: 'Conseiller PME',
  pipeline_term: 'dossier',
  pipeline_term_plural: 'dossiers',
};

// ═══════════════════════════════════════════════════════════════════════════
// MODULES par segment — sous-ensemble visible dans la sidebar
// ═══════════════════════════════════════════════════════════════════════════

const MODULES_PROGRAMME: SegmentModule[] = [
  { code: 'diagnostic',      title: 'Bilan de progression',      icon: Stethoscope, color: 'bg-orange-100 text-orange-600', step: 1 },
  { code: 'bmc',             title: 'Business Model Canvas',     icon: LayoutGrid,  color: 'bg-emerald-100 text-emerald-600', step: 2 },
  { code: 'sic',             title: 'Social Impact Canvas',      icon: Globe,       color: 'bg-teal-100 text-teal-600', step: 3 },
  { code: 'plan_financier',  title: 'Plan Financier',            icon: BarChart3,   color: 'bg-purple-100 text-purple-600', step: 4 },
  { code: 'business_plan',   title: 'Business Plan',             icon: FileText,    color: 'bg-indigo-100 text-indigo-600', step: 5 },
  { code: 'odd',             title: 'ODD',                       icon: Target,      color: 'bg-red-100 text-red-600', step: 6 },
  { code: 'valuation',       title: 'Valorisation',              icon: TrendingUp,  color: 'bg-violet-100 text-violet-700', step: 7 },
  { code: 'onepager',        title: 'One-Pager Investisseur',    icon: FileText,    color: 'bg-cyan-100 text-cyan-600', step: 8 },
  { code: 'investment_memo', title: "Mémo d'Investissement",     icon: Briefcase,   color: 'bg-slate-100 text-slate-700', step: 9 },
];

const MODULES_PE: SegmentModule[] = [
  { code: 'pre_screening',   title: 'Pre-screening',             icon: Stethoscope, color: 'bg-orange-100 text-orange-600', step: 1 },
  { code: 'valuation',       title: 'Valorisation',              icon: TrendingUp,  color: 'bg-violet-100 text-violet-700', step: 2 },
  { code: 'onepager',        title: 'One-Pager',                 icon: FileText,    color: 'bg-cyan-100 text-cyan-600', step: 3 },
  { code: 'investment_memo', title: "Investment Memo",           icon: Briefcase,   color: 'bg-slate-100 text-slate-700', step: 4 },
];

const MODULES_BA: SegmentModule[] = [
  { code: 'pre_screening',   title: 'Analyse cible',             icon: Stethoscope, color: 'bg-orange-100 text-orange-600', step: 1 },
  { code: 'valuation',       title: 'Valorisation',              icon: TrendingUp,  color: 'bg-violet-100 text-violet-700', step: 2 },
  { code: 'investment_memo', title: 'Memo vendeur',              icon: Briefcase,   color: 'bg-slate-100 text-slate-700', step: 3 },
  { code: 'teaser_anonymise', title: 'Teaser anonymisé',         icon: FileBadge,   color: 'bg-blue-100 text-blue-700', step: 4 },
  { code: 'onepager',        title: 'One-Pager',                 icon: FileText,    color: 'bg-cyan-100 text-cyan-600', step: 5 },
];

const MODULES_BANQUE: SegmentModule[] = [
  { code: 'diagnostic_bancabilite', title: 'Diagnostic bancabilité', icon: ShieldCheck,    color: 'bg-amber-100 text-amber-700', step: 1 },
  { code: 'credit_readiness_pack',  title: 'Credit Readiness Pack',  icon: FileSpreadsheet, color: 'bg-blue-100 text-blue-700', step: 2 },
  { code: 'note_credit',            title: 'Note de crédit',         icon: Banknote,        color: 'bg-emerald-100 text-emerald-700', step: 3 },
];

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGS — registre central
// ═══════════════════════════════════════════════════════════════════════════

const SEGMENT_CONFIGS: Record<SegmentType, SegmentConfigFront> = {
  programme: {
    segment: 'programme',
    label: 'Programme',
    shortLabel: 'Prog',
    vocab: VOCAB_PROGRAMME,
    modules: MODULES_PROGRAMME,
    scoring: 'score_numerique',
    pipeline_statuts: ['Candidatures', 'En review', 'Pré-sélectionnées', 'Sélectionnées', 'Suivies'],
    devise_defaut: 'FCFA',
    roles_disponibles: ['owner', 'admin', 'manager', 'coach', 'entrepreneur'],
  },
  pe: {
    segment: 'pe',
    label: 'Private Equity',
    shortLabel: 'PE',
    vocab: VOCAB_PE,
    modules: MODULES_PE,
    scoring: 'score_numerique',
    pipeline_statuts: ['Sourcing', 'Pre-screening', 'Analyse', 'IC1', 'DD', 'IC final', 'Closing', 'Suivi'],
    devise_defaut: 'EUR',
    roles_disponibles: ['owner', 'admin', 'manager', 'analyst'],
  },
  banque_affaires: {
    segment: 'banque_affaires',
    label: "Banque d'affaires",
    shortLabel: 'BA',
    vocab: VOCAB_BA,
    modules: MODULES_BA,
    scoring: 'score_numerique',
    pipeline_statuts: ['Mandats reçus', 'En structuration', 'Teaser envoyé', 'Approche fonds', 'Closing'],
    devise_defaut: 'EUR',
    roles_disponibles: ['owner', 'admin', 'partner', 'analyst'],
  },
  banque: {
    segment: 'banque',
    label: 'Banque / IMF',
    shortLabel: 'Banque',
    vocab: VOCAB_BANQUE,
    modules: MODULES_BANQUE,
    scoring: 'grille_conformite',
    pipeline_statuts: ['Accueil', 'Diagnostic', 'En structuration', 'Note de crédit', 'Décision comité', 'Décaissement'],
    devise_defaut: 'FCFA',
    roles_disponibles: ['owner', 'admin', 'direction_pme', 'conseiller_pme', 'analyste_credit', 'directeur_agence'],
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// FONCTIONS D'ACCÈS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Renvoie la config front d'un segment.
 * Tolérant : si type === 'mixed' ou type inconnu → fallback 'programme'
 * (cohérent avec detectSegment côté backend).
 */
export function getSegmentConfigFront(orgType: string | null | undefined): SegmentConfigFront {
  if (orgType === 'pe' || orgType === 'banque_affaires' || orgType === 'banque') {
    return SEGMENT_CONFIGS[orgType];
  }
  // 'programme', 'mixed', null, undefined → programme par défaut
  return SEGMENT_CONFIGS.programme;
}

/**
 * Renvoie le vocabulaire UI d'un segment.
 */
export function getVocab(orgType: string | null | undefined): SegmentVocab {
  return getSegmentConfigFront(orgType).vocab;
}

/**
 * Renvoie la liste des modules visibles dans la sidebar pour ce segment.
 */
export function getModulesForSegment(orgType: string | null | undefined): SegmentModule[] {
  return getSegmentConfigFront(orgType).modules;
}

/**
 * Renvoie le label du segment ("Programme", "Private Equity", ...).
 */
export function getSegmentLabel(orgType: string | null | undefined): string {
  return getSegmentConfigFront(orgType).label;
}

/**
 * Indique si le segment utilise le scoring numérique 0-100 ou la grille de conformité.
 */
export function getScoringType(orgType: string | null | undefined): 'score_numerique' | 'grille_conformite' {
  return getSegmentConfigFront(orgType).scoring;
}
