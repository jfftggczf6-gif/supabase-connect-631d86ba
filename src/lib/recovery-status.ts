// Statut du « lien pour compléter » (recovery) d'une candidature.
//
// Dérivé UNIQUEMENT des colonnes déjà présentes sur `candidatures`
// (aucune donnée ajoutée) :
//   - recovery_token / recovery_expires_at : un lien a été généré/envoyé
//   - recovery_used_at : rempli quand le candidat a complété (l'EF
//     candidature-recovery met used_at=now() à la soumission, et le
//     réinitialise à null quand on régénère un lien — c'est donc la source
//     de vérité du lien COURANT).
//
// États :
//   completed → le candidat a re-déposé ses documents
//   pending   → lien envoyé, pas encore complété, non expiré
//   expired   → lien envoyé, jamais complété, échéance passée
//   none      → aucun lien envoyé

export type RecoveryState = 'completed' | 'pending' | 'expired' | 'none';

export interface RecoveryInput {
  recovery_token?: string | null;
  recovery_used_at?: string | null;
  recovery_expires_at?: string | null;
}

export interface RecoveryStatus {
  state: RecoveryState;
  /** Libellé court prêt pour un badge. Vide si state === 'none'. */
  label: string;
  /** Date pertinente (ISO) : complété le / expire le. Null si none. */
  date: string | null;
}

export function getRecoveryStatus(c: RecoveryInput | null | undefined): RecoveryStatus {
  if (!c) return { state: 'none', label: '', date: null };

  // Complété : prioritaire et fiable (reset à la régénération d'un lien).
  if (c.recovery_used_at) {
    return { state: 'completed', label: 'Complété', date: c.recovery_used_at };
  }

  // Pas complété : un lien a-t-il seulement été généré ?
  if (!c.recovery_token && !c.recovery_expires_at) {
    return { state: 'none', label: '', date: null };
  }

  const exp = c.recovery_expires_at ? new Date(c.recovery_expires_at) : null;
  if (exp && exp.getTime() <= Date.now()) {
    return { state: 'expired', label: 'Lien expiré', date: c.recovery_expires_at ?? null };
  }
  return { state: 'pending', label: 'En attente', date: c.recovery_expires_at ?? null };
}

/** Classes Tailwind (bordure + texte) pour un Badge outline selon l'état. */
export function recoveryBadgeClass(state: RecoveryState): string {
  switch (state) {
    case 'completed': return 'border-emerald-300 text-emerald-700';
    case 'pending':   return 'border-amber-300 text-amber-700';
    case 'expired':   return 'border-red-300 text-red-700';
    default:          return '';
  }
}

/** Petit préfixe icône (émoji) selon l'état, pour un badge compact. */
export function recoveryBadgeIcon(state: RecoveryState): string {
  switch (state) {
    case 'completed': return '✓';
    case 'pending':   return '🕓';
    case 'expired':   return '⚠';
    default:          return '';
  }
}
