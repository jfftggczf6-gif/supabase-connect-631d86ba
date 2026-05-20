// src/types/ba-shell.ts
// Types pour le MandatShell — conteneur navigationnel principal du workspace mandat BA.
// Brief : mandat_detail_layout (Ordre 4).

import type { Mandat } from './ba';

/** Statut générique d'une section/item dans la sidebar.
 *  Aligné memo_sections.status PE (empty/draft/submitted/correction/validated).
 *  + 'not_started' pour les features non commencées. */
export type SectionStatus = 'not_started' | 'empty' | 'draft' | 'submitted' | 'correction' | 'validated';

/** Code unique de chaque item navigable dans la sidebar.
 *  Sert de query param ?section=<code> + de discriminant pour le routing interne. */
// Aligné EXACTEMENT sur le wireframe BA fourni (sidebar 6 groupes).
// Note : "Informations de l'analyste" = page NOTES (notes_rdv_ba), pas un
// formulaire structuré. Brief #8 info_analyste et brief #8.5 notes_rdv_ba
// décrivent en réalité la même page côté UI.
export type SectionCode =
  // Vue 360° compacte (brief #32)
  | 'overview'
  // Groupe Données
  | 'upload_documents'
  | 'info_analyste'      // = Notes & RDV (NotesRdvSection)
  | 'benchmarks'
  | 'sources'
  // Groupe Pré-screening
  | 'pre_screening'
  // Groupe Mémo investissement (sections dynamiques memo:1 à memo:12)
  | 'memo'
  | `memo:${number}`
  // Groupe Valorisation
  | 'valuation'
  // Groupe Teaser
  | 'teaser'
  // Groupe Diffusion (Partner only)
  | 'fund_matching'
  | 'deal_tracking'
  | 'data_room';

export type GroupCode = 'vue_360' | 'donnees' | 'pre_screening' | 'memo' | 'valuation' | 'teaser' | 'diffusion';

export interface SidebarItem {
  code: SectionCode;
  label: string;
  status: SectionStatus;
  /** Sous-texte affiché (ex: "8/12 sections validées", "5/7 docs reçus"). */
  caption?: string;
  /** Si true, le clic est bloqué (feature pas encore intégrée — utile pour les versions intermédiaires). */
  disabled?: boolean;
}

export interface SidebarGroup {
  code: GroupCode;
  label: string;
  items: SidebarItem[];
  /** Visible uniquement pour ces rôles. undefined = visible pour tous. */
  visibleForRoles?: string[];
}

/** Snapshot des compteurs nécessaires pour les captions sidebar. */
export interface MandatStats {
  /** Documents reçus (count pe_deal_documents) vs attendus (V1 = 7 docs hardcodés). */
  docs_received: number;
  docs_expected: number;
  /** Sections IM validées / total (12). */
  sections_validated: number;
  sections_total: number;
  /** Compteurs par statut pour visualisation rapide. */
  sections_draft: number;
  sections_submitted: number;
  sections_correction: number;
  /** Statut individuel des features standalone. */
  pre_screening_status: SectionStatus;
  valuation_status: SectionStatus;
  teaser_status: SectionStatus;
  /** Diffusion : nombre de fonds contactés. */
  funds_contacted: number;
}

/** Bundle complet renvoyé par useMandatDetail. */
export interface MandatDetailBundle {
  mandat: Mandat;
  enterprise: {
    id: string;
    name: string;
    sector: string | null;
    country: string | null;
  } | null;
  stats: MandatStats;
}

/** Documents attendus V1 (brief upload_documents — 7 items hardcodés). */
export const EXPECTED_DOCUMENTS_V1 = [
  'Liasses fiscales N',
  'Liasses fiscales N-1',
  'Liasses fiscales N-2',
  'Relevés bancaires 12 mois',
  'Statuts + RCCM',
  'Quittances fiscales',
  'Pitch deck + CV dirigeants',
] as const;
