// MandatProgressBar — barre de progression globale du mandat BA (brief #33).
// Pondération : docs 20 + pre-screening 15 + IM 25 + valuation 15 + teaser 15 + fonds 10.
// Affichée en haut de MandatSideNav.

import type { MandatStats } from '@/types/ba-shell';

interface Props {
  stats: MandatStats;
}

/**
 * Compute weighted completion % (0-100).
 * Doc breakdown :
 * - docs        : docs_received / docs_expected * 20 (max 20)
 * - pre-screening : binaire (started? 15 : 0)
 * - IM memo      : sections_validated / sections_total * 25 (max 25)
 * - valuation    : status='ready'|'validated' → 15
 * - teaser       : status='ready'|'validated' → 15
 * - fonds        : funds_contacted >= 1 → 10
 */
export function computeMandatProgress(stats: MandatStats): number {
  const docs = stats.docs_expected > 0
    ? Math.min(20, (stats.docs_received / stats.docs_expected) * 20)
    : 0;
  const preScreening = (stats.pre_screening_status !== 'not_started' && stats.pre_screening_status !== 'empty') ? 15 : 0;
  const memo = stats.sections_total > 0
    ? Math.min(25, (stats.sections_validated / stats.sections_total) * 25)
    : 0;
  const valuation = (stats.valuation_status === 'validated' || stats.valuation_status === 'submitted' || stats.valuation_status === 'draft') ? 15 : 0;
  const teaser = (stats.teaser_status === 'validated' || stats.teaser_status === 'submitted' || stats.teaser_status === 'draft') ? 15 : 0;
  const fonds = stats.funds_contacted >= 1 ? 10 : 0;
  return Math.round(docs + preScreening + memo + valuation + teaser + fonds);
}

export default function MandatProgressBar({ stats }: Props) {
  const pct = computeMandatProgress(stats);
  const colorClass =
    pct >= 80 ? 'bg-emerald-500' :
    pct >= 50 ? 'bg-violet-600' :
    pct >= 25 ? 'bg-amber-500' :
                'bg-rose-500';

  return (
    <div className="px-4 py-3 border-b bg-muted/20">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Avancement du mandat</span>
        <span className="text-xs font-bold text-violet-700">{pct}%</span>
      </div>
      <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full ${colorClass} transition-all duration-500 ease-out rounded-full`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-1.5 text-[10px] text-muted-foreground">
        Docs {Math.round((stats.docs_received / Math.max(1, stats.docs_expected)) * 100)}% · IM {stats.sections_total > 0 ? Math.round((stats.sections_validated / stats.sections_total) * 100) : 0}% · {stats.funds_contacted} fonds
      </div>
    </div>
  );
}
