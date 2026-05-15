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

/** Type minimal du preset workflow attendu (cf. useOrgPreset). */
export interface PresetWorkflowLike {
  pipeline_statuts?: Array<{ code: string; label: string; order: number }>;
  pipeline_views_per_role?: Record<string, string[]>;
}

/** Résout les stages affichés en combinant preset DB + rôle.
 *  - Si le preset a `pipeline_statuts` → on l'utilise comme source de vérité
 *    (ordonné par `order`, mappé vers StageDef).
 *  - Si le preset a `pipeline_views_per_role[role]` → on filtre les stages
 *    pour ne garder que ceux autorisés au rôle (ex: analyste ne voit que
 *    sourcing/pre_screening/analyse).
 *  - Fallback : si pas de preset OU pas de pipeline_statuts → retourne
 *    `getStagesForRole(role)` (comportement historique hardcodé).
 *
 *  Permet à chaque org d'avoir son pipeline custom (9 stages Adiwale,
 *  7 stages OVO, 5 stages BA, etc.) sans modifier le code. */
export function resolveStagesForRole(
  role: string | null | undefined,
  workflow: PresetWorkflowLike | null | undefined,
): StageDef[] {
  if (!workflow?.pipeline_statuts || workflow.pipeline_statuts.length === 0) {
    return getStagesForRole(role);
  }

  const ordered = [...workflow.pipeline_statuts].sort((a, b) => a.order - b.order);
  const allFromPreset: StageDef[] = ordered.map(s => ({
    code: s.code as PeStage,
    label: s.label,
  }));

  // Filtrage par rôle si défini
  const allowedCodes = role && workflow.pipeline_views_per_role?.[role];
  if (Array.isArray(allowedCodes) && allowedCodes.length > 0) {
    return allFromPreset.filter(s => allowedCodes.includes(s.code));
  }
  return allFromPreset;
}

/** Vérifie qu'un rôle a le droit de pousser un deal vers `toStage` depuis `fromStage`.
 *  - Analyste : peut sourcing → pre_screening, mais doit demander validation IM/MD
 *    pour passer en note_ic1+ (DD, IC finale, closing).
 *  - IM : gère tout l'opérationnel, MAIS la décision IC finale (note_ic_finale →
 *    closing) reste au MD (sign-off go/no-go d'investissement).
 *  - MD / owner / admin / super_admin : tout autorisé. */
export function canTransition(
  role: string | null | undefined,
  fromStage: string,
  toStage: string,
): { allowed: boolean; reason?: string } {
  const isAnalyst = role === 'analyste' || role === 'analyst';
  const isIm = role === 'investment_manager';

  if (isAnalyst) {
    const restrictedTargets = ['note_ic1', 'dd', 'note_ic_finale', 'closing', 'portfolio'];
    if (restrictedTargets.includes(toStage)) {
      return {
        allowed: false,
        reason: 'Demande la validation à ton IM ou MD avant de pousser ce deal plus loin.',
      };
    }
    return { allowed: true };
  }

  if (isIm) {
    // IC finale = décision MD uniquement (engagement d'investissement).
    if (fromStage === 'note_ic_finale' && toStage === 'closing') {
      return {
        allowed: false,
        reason: "L'approbation de l'IC finale est réservée au Managing Director.",
      };
    }
    return { allowed: true };
  }

  return { allowed: true };
}

/** Stages "sensibles" qui demandent confirmation user avant transition (passage IC). */
export const SENSITIVE_TRANSITIONS = new Set<PeStage>(['note_ic1', 'dd', 'note_ic_finale', 'closing', 'lost']);
