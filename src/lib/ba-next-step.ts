// Helper "Étape suivante" BA — mapping état réel du dossier → action recommandée.
// Diffère du PE : pas basé sur stage (recus/im/...) mais sur progression livrables :
// pre_screening / IM / valuation / teaser / matching.

import type { MandatDetailBundle } from '@/types/ba-shell';

export type BaNextStepEdgeFn =
  | 'generate-pe-pre-screening'
  | 'generate-ic1-memo'
  | 'generate-pe-valuation'
  | 'generate-teaser-ba'
  | 'match-deal-funds';

export interface BaNextStep {
  label: string;
  navigateTo: string;
  edgeFunction: BaNextStepEdgeFn;
  toastLabel: string;
}

/**
 * Détermine la prochaine étape selon les stats du mandat.
 * Returns null si tout est déjà fait.
 */
export function getBaNextStep(stats: MandatDetailBundle['stats']): BaNextStep | null {
  // 1. Pas de pré-screening fait → générer
  if (stats.pre_screening_status === 'not_started' || stats.pre_screening_status === 'empty') {
    return {
      label: 'Générer le pré-screening',
      navigateTo: 'pre_screening',
      edgeFunction: 'generate-pe-pre-screening',
      toastLabel: 'Pré-screening 360°',
    };
  }
  // 2. Pré-screening fait, pas de sections IM enrichies → générer IM
  if (stats.sections_validated + stats.sections_submitted + stats.sections_draft < 6) {
    return {
      label: "Générer l'IM vendeur",
      navigateTo: 'memo',
      edgeFunction: 'generate-ic1-memo',
      toastLabel: 'IM vendeur',
    };
  }
  // 3. IM enrichi, pas de valuation → générer valuation
  if (stats.valuation_status === 'not_started' || stats.valuation_status === 'empty') {
    return {
      label: 'Générer la valorisation',
      navigateTo: 'valuation',
      edgeFunction: 'generate-pe-valuation',
      toastLabel: 'Valorisation',
    };
  }
  // 4. Valuation faite, pas de teaser → générer teaser
  if (stats.teaser_status === 'not_started' || stats.teaser_status === 'empty') {
    return {
      label: 'Générer le teaser',
      navigateTo: 'teaser',
      edgeFunction: 'generate-teaser-ba',
      toastLabel: 'Teaser anonymisé',
    };
  }
  // 5. Teaser fait, pas de matching → lancer matching IA
  if (stats.funds_contacted === 0) {
    return {
      label: 'Lancer le matching IA',
      navigateTo: 'fund_matching',
      edgeFunction: 'match-deal-funds',
      toastLabel: 'Matching IA',
    };
  }
  // Tout fait
  return null;
}
