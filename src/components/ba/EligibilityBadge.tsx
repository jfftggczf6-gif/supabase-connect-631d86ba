// src/components/ba/EligibilityBadge.tsx
// Badge d'éligibilité d'une candidature BA (vert/orange/rouge).
// Remplace l'ancien score IA numérique 0-100 par un signal qualitatif aligné
// sur le métier banque d'affaires.
//
// Utilisable seul (passer level directement) OU avec computeEligibility(formData).

import { ELIGIBILITY_LABEL, type EligibilityLevel } from '@/types/candidature-ba';
import { cn } from '@/lib/utils';

interface Props {
  level: EligibilityLevel;
  /** 'sm' (table row, défaut) ou 'md' (modale détail). */
  size?: 'sm' | 'md';
  className?: string;
}

const ICONS: Record<EligibilityLevel, string> = {
  green: '🟢',
  orange: '🟠',
  red: '🔴',
};

const COLOR_CLASSES: Record<EligibilityLevel, string> = {
  green: 'bg-emerald-100 text-emerald-700',
  orange: 'bg-amber-100 text-amber-700',
  red: 'bg-rose-100 text-rose-700',
};

const SIZE_CLASSES: Record<NonNullable<Props['size']>, string> = {
  sm: 'px-2 py-0.5 text-[10px]',
  md: 'px-2.5 py-0.5 text-xs',
};

export default function EligibilityBadge({ level, size = 'sm', className }: Props) {
  return (
    <span
      className={cn(
        'rounded-full font-semibold inline-flex items-center gap-1 whitespace-nowrap',
        COLOR_CLASSES[level],
        SIZE_CLASSES[size],
        className,
      )}
      data-testid={`eligibility-badge-${level}`}
      role="status"
      aria-label={`Éligibilité : ${ELIGIBILITY_LABEL[level]}`}
    >
      <span aria-hidden="true">{ICONS[level]}</span>
      {ELIGIBILITY_LABEL[level]}
    </span>
  );
}
