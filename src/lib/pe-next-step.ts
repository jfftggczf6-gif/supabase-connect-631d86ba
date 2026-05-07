// Helper partagé : "Étape suivante" — mapping stage → action recommandée.
// Utilisé par le header de PeDealDetailPage et l'empty state des livrables.

export type PeNextStepEdgeFn =
  | 'generate-pe-pre-screening'
  | 'generate-ic1-memo'
  | 'generate-dd-report';

export interface PeNextStep {
  /** Label du bouton — court, action verbale. */
  label: string;
  /** Vers quel item de sidebar on bascule après le clic. */
  navigateTo: string;
  /** Edge function à invoquer (optionnel — si absent, on fait juste navigate). */
  edgeFunction?: PeNextStepEdgeFn;
  /** Court titre pour le toast de succès. */
  toastLabel: string;
}

const NEXT_STEP: Record<string, PeNextStep> = {
  sourcing: {
    label: 'Lancer le pré-screening 360°',
    navigateTo: 'pre_screening',
    edgeFunction: 'generate-pe-pre-screening',
    toastLabel: 'Pré-screening 360°',
  },
  pre_screening: {
    label: 'Lancer le pré-screening 360°',
    navigateTo: 'pre_screening',
    edgeFunction: 'generate-pe-pre-screening',
    toastLabel: 'Pré-screening 360°',
  },
  note_ic1: {
    label: 'Générer le memo IC1',
    navigateTo: 'memo',
    edgeFunction: 'generate-ic1-memo',
    toastLabel: 'Memo IC1',
  },
  dd: {
    label: 'Lancer la due diligence',
    navigateTo: 'dd',
    edgeFunction: 'generate-dd-report',
    toastLabel: 'Due diligence',
  },
  note_ic_finale: {
    label: 'Mettre à jour le memo final',
    navigateTo: 'memo',
    toastLabel: 'Memo final',
  },
  closing: {
    label: 'Préparer le closing',
    navigateTo: 'closing',
    toastLabel: 'Closing',
  },
  portfolio: {
    label: 'Mettre à jour le monitoring',
    navigateTo: 'monitoring',
    toastLabel: 'Monitoring',
  },
  exit_prep: {
    label: 'Préparer la sortie',
    navigateTo: 'exit_prep',
    toastLabel: 'Sortie',
  },
};

export function getPeNextStep(stage: string | undefined | null): PeNextStep | null {
  if (!stage) return null;
  return NEXT_STEP[stage] ?? null;
}
