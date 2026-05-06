// Statut d'un appel à candidatures PE — dérivé des dates et de la date courante.
//   - Pas de dates renseignées          → 'draft'         (création initiale)
//   - now < start_date                  → 'scheduled'     (à venir, mais déjà publié)
//   - start_date ≤ now ≤ end_date       → 'open'          (ouvert aux candidatures)
//   - now > end_date                    → 'closed'        (clôturé automatiquement)
// Cette logique remplace la bascule manuelle "brouillon → publier" : on enregistre
// le formulaire, et le statut se calcule tout seul.
export type PeAppelDerivedStatus = 'draft' | 'scheduled' | 'open' | 'closed';

export function derivePeAppelStatus(startDate?: string | null, endDate?: string | null, now: Date = new Date()): PeAppelDerivedStatus {
  if (!startDate || !endDate) return 'draft';
  const start = new Date(startDate);
  const end = new Date(endDate + 'T23:59:59'); // inclusif jusqu'à la fin de la journée
  if (now < start) return 'scheduled';
  if (now > end) return 'closed';
  return 'open';
}

export const PE_APPEL_STATUS_META: Record<PeAppelDerivedStatus, { label: string; cls: string; emoji: string }> = {
  draft:     { label: 'Brouillon',          cls: 'bg-slate-100 text-slate-700 border-slate-200',         emoji: '📝' },
  scheduled: { label: 'Programmé',          cls: 'bg-blue-50 text-blue-700 border-blue-200',             emoji: '⏳' },
  open:      { label: 'Ouvert',             cls: 'bg-emerald-50 text-emerald-700 border-emerald-200',    emoji: '🟢' },
  closed:    { label: 'Clôturé',            cls: 'bg-amber-50 text-amber-700 border-amber-200',          emoji: '🔒' },
};
