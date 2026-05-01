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

/** Retourne les stages affichés selon le rôle PE.
 *  Tous les rôles PE peuvent faire du sourcing → tous voient l'ensemble du pipeline.
 *  Les restrictions par rôle se font sur les TRANSITIONS (cf. canTransition). */
export function getStagesForRole(_role: string | null | undefined): StageDef[] {
  return ALL_STAGES;
}

/** Vérifie qu'un rôle a le droit de pousser un deal vers `toStage` depuis `fromStage`.
 *  L'analyste peut sourcing → pre_screening, mais doit demander validation IM/MD
 *  pour passer en note_ic1+ (DD, IC finale, closing). */
export function canTransition(
  role: string | null | undefined,
  fromStage: string,
  toStage: string,
): { allowed: boolean; reason?: string } {
  const isAnalyst = role === 'analyste' || role === 'analyst';
  if (!isAnalyst) return { allowed: true };

  // Analyste : ne peut pas pousser un deal au-delà de pre_screening sans validation
  const restrictedTargets = ['note_ic1', 'dd', 'note_ic_finale', 'closing', 'portfolio'];
  if (restrictedTargets.includes(toStage)) {
    return {
      allowed: false,
      reason: 'Demande la validation à ton IM ou MD avant de pousser ce deal plus loin.',
    };
  }
  return { allowed: true };
}

/** Stages "sensibles" qui demandent confirmation user avant transition (passage IC). */
export const SENSITIVE_TRANSITIONS = new Set<PeStage>(['note_ic1', 'dd', 'note_ic_finale', 'closing', 'lost']);
