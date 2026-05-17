// src/components/ba/sections/BenchmarksSection.tsx
// Section "Benchmarks sectoriels" du MandatShell. Brief #10 benchmarks_sectoriels.
// Structure alignée wireframe : 4 cards (Benchmark sectoriel · Concurrents directs ·
// SWOT · Comparables transactionnels).

import { useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  BarChart3, Briefcase, TrendingUp, Target, Loader2, AlertCircle,
  ArrowUp, ArrowDown, Minus, Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useBaBenchmarks } from '@/hooks/useBaBenchmarks';
import { buildRatioRows, type RatioRow, type RatioStatus } from '@/types/benchmarks-ba';

interface Props {
  dealId: string;
}

function formatRatio(val: number | null, format: 'pct' | 'multiple' | 'absolute'): string {
  if (val == null) return '—';
  if (format === 'pct') return `${val.toFixed(1)}%`;
  if (format === 'multiple') return `${val.toFixed(1)}x`;
  return val.toLocaleString('fr-FR');
}

function StatusIcon({ status }: { status: RatioStatus }) {
  switch (status) {
    case 'above':  return <ArrowUp className="h-3 w-3 text-emerald-600" />;
    case 'below':  return <ArrowDown className="h-3 w-3 text-rose-600" />;
    case 'around': return <Minus className="h-3 w-3 text-amber-600" />;
    default:       return <span className="h-3 w-3 inline-block" />;
  }
}

function statusLabel(s: RatioStatus): string {
  if (s === 'above') return 'Au-dessus de la médiane sectorielle';
  if (s === 'below') return 'En dessous de la médiane';
  if (s === 'around') return 'Aligné secteur';
  return '—';
}

function statusClass(s: RatioStatus): string {
  if (s === 'above') return 'text-emerald-700';
  if (s === 'below') return 'text-rose-700';
  if (s === 'around') return 'text-amber-700';
  return 'text-muted-foreground';
}

function PlaceholderCard({
  Icon, title, hint, feature,
}: {
  Icon: typeof BarChart3;
  title: string;
  hint: string;
  feature: string;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="h-4 w-4 text-violet-600" />
        <span className="text-sm font-semibold">{title}</span>
      </div>
      <p className="text-xs text-muted-foreground mb-3">{hint}</p>
      <div className="text-[10px] text-muted-foreground bg-muted/30 px-2 py-1.5 rounded inline-flex items-center gap-1.5">
        <Sparkles className="h-3 w-3" />
        Sera enrichi par <span className="font-mono">{feature}</span>
      </div>
    </Card>
  );
}

export default function BenchmarksSection({ dealId }: Props) {
  const { benchmark, loading, error } = useBaBenchmarks(dealId);

  // Pour l'instant, pas de données financières du deal (elles arriveront via
  // memo §7/§8 quand generate_im_vendeur sera livré). Donc tous les ratios
  // entreprise sont null — le tableau affiche juste les fourchettes sectorielles.
  const ratios: RatioRow[] = useMemo(() => buildRatioRows(benchmark), [benchmark]);

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  return (
    <div className="space-y-4 max-w-5xl">
      <header>
        <h2 className="text-base font-semibold">Benchmark & analyse concurrentielle</h2>
        <p className="text-xs text-muted-foreground mt-0.5 max-w-2xl">
          Positionnement du mandat vs acteurs du secteur en Afrique de l'Ouest. Données agrégées depuis la base de connaissance ESONO (knowledge_benchmarks) et sources sectorielles.
        </p>
      </header>

      {error && (
        <Card className="p-3 bg-rose-50 border-rose-200 text-rose-700 text-xs flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </Card>
      )}

      {/* ─── Card 1 : Benchmark sectoriel (data-driven knowledge_benchmarks) ─── */}
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 className="h-4 w-4 text-violet-600" />
          <span className="text-sm font-semibold">Benchmark sectoriel</span>
        </div>

        {!benchmark ? (
          <div className="text-center py-8">
            <AlertCircle className="h-6 w-6 text-amber-500 mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">
              Pas de benchmark disponible pour ce secteur/pays dans <code className="px-1.5 py-0.5 bg-muted/50 rounded">knowledge_benchmarks</code>.
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">
              À seeder via le module Knowledge Base ou un import knowledge_benchmarks dédié.
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
                    <th className="text-left py-2 px-1">Ratio</th>
                    <th className="text-right py-2 px-1">Entreprise</th>
                    <th className="text-right py-2 px-1">Médiane</th>
                    <th className="text-right py-2 px-1">Fourchette</th>
                    <th className="text-right py-2 px-1">Position</th>
                  </tr>
                </thead>
                <tbody>
                  {ratios.map(r => (
                    <tr key={r.label} className="border-b last:border-b-0 hover:bg-muted/20">
                      <td className="py-2.5 px-1 font-medium">{r.label}</td>
                      <td className="text-right py-2.5 px-1 font-semibold">
                        {formatRatio(r.company, r.format)}
                      </td>
                      <td className="text-right py-2.5 px-1 text-muted-foreground">
                        {formatRatio(r.median, r.format)}
                      </td>
                      <td className="text-right py-2.5 px-1 text-muted-foreground">
                        {r.min != null || r.max != null
                          ? `${formatRatio(r.min, r.format)} – ${formatRatio(r.max, r.format)}`
                          : '—'}
                      </td>
                      <td className="text-right py-2.5 px-1">
                        <span className={cn('inline-flex items-center gap-1 text-[10px]', statusClass(r.status))}>
                          <StatusIcon status={r.status} />
                          {statusLabel(r.status)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 pt-3 border-t text-[10px] text-muted-foreground">
              <strong>Source : </strong>
              {benchmark.source || 'knowledge_benchmarks'}
              {benchmark.date_source && ` · ${new Date(benchmark.date_source).getFullYear()}`}
              {benchmark.zone && ` · zone ${benchmark.zone}`}
              {benchmark.perimetre && ` · ${benchmark.perimetre}`}
              {benchmark.source_url && (
                <> · <a href={benchmark.source_url} target="_blank" rel="noopener noreferrer" className="text-violet-600 hover:underline">consulter</a></>
              )}
            </div>

            {/* Note explicative si pas encore de données entreprise */}
            {ratios.every(r => r.company == null) && (
              <div className="mt-3 p-2.5 bg-amber-50 border border-amber-200 rounded text-[11px] text-amber-700">
                <Sparkles className="inline h-3 w-3 mr-1" />
                Les ratios de l'entreprise seront calculés automatiquement quand les
                sections §7 États financiers PnL et §8 Bilan du Memo seront renseignées.
              </div>
            )}
          </>
        )}
      </Card>

      {/* ─── Card 2 : Concurrents directs (placeholder pour le moment) ─── */}
      <PlaceholderCard
        Icon={Briefcase}
        title="Concurrents directs"
        hint="Tableau des acteurs identifiés sur le segment avec part de marché, CA et marges. Cible en surbrillance pour comparaison directe."
        feature="generate_im_vendeur §5 (Concurrence & marché)"
      />

      {/* ─── Card 3 : Positionnement stratégique SWOT (placeholder) ─── */}
      <PlaceholderCard
        Icon={TrendingUp}
        title="Positionnement stratégique (SWOT)"
        hint="Analyse Forces / Faiblesses / Opportunités / Menaces générée par l'IA à partir des entretiens, benchmarks et notes."
        feature="generate_im_vendeur §9 + §11"
      />

      {/* ─── Card 4 : Comparables transactionnels (placeholder) ─── */}
      <PlaceholderCard
        Icon={Target}
        title="Comparables transactionnels"
        hint="Transactions M&A retenues pour la valuation par multiples (EV/EBITDA, EV/CA, acquéreurs récents)."
        feature="valuation_ba (multiples comparables)"
      />
    </div>
  );
}
