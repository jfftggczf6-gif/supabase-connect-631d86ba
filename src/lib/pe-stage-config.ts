// src/lib/pe-stage-config.ts
// Définit les colonnes du kanban PE selon le rôle.

export type PeStage =
  | 'sourcing'
  | 'pre_screening'
  | 'note_ic1'
  | 'dd'
  | 'note_ic_finale'
  | 'closing'
  | 'portfolio'
  | 'lost'
  | 'analyse';  // legacy, ne sera plus jamais utilisé en Phase B'+

export interface StageDef { code: PeStage; label: string; }

// 7 colonnes en ordre canonique (sans 'lost' et sans 'analyse')
const ALL_STAGES: StageDef[] = [
  { code: 'sourcing',       label: 'Sourcing' },
  { code: 'pre_screening',  label: 'Pré-screening' },
  { code: 'note_ic1',       label: 'Note IC1' },
  { code: 'dd',             label: 'DD' },
  { code: 'note_ic_finale', label: 'Note IC finale' },
  { code: 'closing',        label: 'Closing' },
  { code: 'portfolio',      label: 'Portfolio' },
];

/** Retourne les stages affichés selon le rôle PE. */
export function getStagesForRole(role: string | null | undefined): StageDef[] {
  if (role === 'analyste' || role === 'analyst') {
    // Analyste : focus sur ses deals en travail (pas de sourcing initial, pas de portfolio)
    return ALL_STAGES.filter(s => !['sourcing', 'closing', 'portfolio'].includes(s.code));
  }
  if (role === 'investment_manager') {
    // IM : voit tout sauf sourcing initial et portfolio
    return ALL_STAGES.filter(s => !['sourcing', 'portfolio'].includes(s.code));
  }
  // MD, admin, owner, super_admin : pipeline complet
  return ALL_STAGES;
}

/** Stages "sensibles" qui demandent confirmation user avant transition (passage IC). */
export const SENSITIVE_TRANSITIONS = new Set<PeStage>(['note_ic1', 'dd', 'note_ic_finale', 'closing', 'lost']);
