import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calculator } from 'lucide-react';
import NarrativeBlock from './NarrativeBlock';

interface Synthesis {
  weights?: { dcf?: number; multiples?: number; ancc?: number };
  weighted_ev?: number;
  range?: { bear?: number; base?: number; bull?: number };
  pre_money_recommended?: number;
  ticket_recommended?: number;
  equity_stake_pct?: number;
  moic_bear?: number; moic_base?: number; moic_bull?: number;
  irr_bear?: number; irr_base?: number; irr_bull?: number;
  exit_horizon_years?: number;
  justification?: string;
}

interface Props {
  valuation: { status?: string; synthesis?: Synthesis; currency?: string; ai_justification?: string | null } | null;
  currency?: string;
  onNavigate?: (item: string) => void;
}

// Conventions PE Afrique francophone : montants stockés en millions de la devise.
function fmtMoney(v: number | undefined | null, currency = 'FCFA'): string {
  if (v == null || isNaN(v as number)) return '—';
  const abs = Math.abs(v);
  if (abs >= 1000) return `${(v / 1000).toFixed(2)} Md ${currency}`;
  if (abs >= 1) return `${Math.round(v)} M ${currency}`;
  if (abs >= 0.001) return `${Math.round(v * 1000)} K ${currency}`;
  return `${Math.round(v * 1_000_000)} ${currency}`;
}
function fmtPct(v: number | undefined | null, digits = 1): string {
  if (v == null || isNaN(v as number)) return '—';
  return `${(v * 100).toFixed(digits)}%`;
}
function fmtX(v: number | undefined | null, digits = 1): string {
  if (v == null || isNaN(v as number)) return '—';
  return `${v.toFixed(digits)}x`;
}

export default function ValuationMemoSection({ valuation, currency, onNavigate }: Props) {
  const isReady = valuation && valuation.status === 'ready' && valuation.synthesis;
  const cur = valuation?.currency ?? currency ?? 'FCFA';
  const syn = (valuation?.synthesis ?? {}) as Synthesis;
  const justification = syn.justification ?? valuation?.ai_justification ?? '';

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Valorisation</CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {!isReady ? (
          <div className="rounded-md border border-dashed border-border/60 bg-muted/30 p-6 text-center space-y-3">
            <div className="mx-auto h-10 w-10 rounded-lg bg-violet-50 flex items-center justify-center">
              <Calculator className="h-5 w-5 text-violet-600" />
            </div>
            <div>
              <p className="font-medium">Pas encore de valorisation</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Lance la valuation (DCF · Multiples · ANCC) pour voir la synthèse ici.
              </p>
            </div>
            {onNavigate && (
              <Button size="sm" onClick={() => onNavigate('valuation')} className="gap-1.5">
                <Calculator className="h-3.5 w-3.5" /> Aller dans Valuation
              </Button>
            )}
          </div>
        ) : (
          <>
            <NarrativeBlock title="Synthèse de valorisation">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <div className="rounded p-3 bg-violet-50 border border-violet-100">
                  <div className="text-[10px] text-violet-700 uppercase tracking-wider">Pre-money</div>
                  <div className="text-base font-semibold">{fmtMoney(syn.pre_money_recommended, cur)}</div>
                </div>
                <div className="rounded p-3 bg-violet-50 border border-violet-100">
                  <div className="text-[10px] text-violet-700 uppercase tracking-wider">Ticket recommandé</div>
                  <div className="text-base font-semibold">{fmtMoney(syn.ticket_recommended, cur)}</div>
                </div>
                <div className="rounded p-3 bg-violet-50 border border-violet-100">
                  <div className="text-[10px] text-violet-700 uppercase tracking-wider">Equity stake</div>
                  <div className="text-base font-semibold">
                    {syn.equity_stake_pct != null ? fmtPct(syn.equity_stake_pct, 1) : '—'}
                  </div>
                </div>
                <div className="rounded p-3 bg-violet-50 border border-violet-100">
                  <div className="text-[10px] text-violet-700 uppercase tracking-wider">Horizon de sortie</div>
                  <div className="text-base font-semibold">
                    {syn.exit_horizon_years != null ? `${syn.exit_horizon_years} ans` : '—'}
                  </div>
                </div>
              </div>
              {syn.weighted_ev != null && (
                <p className="mt-3 pt-2 border-t border-dashed border-border text-xs text-muted-foreground">
                  Enterprise Value pondérée : <strong className="text-foreground tabular-nums">{fmtMoney(syn.weighted_ev, cur)}</strong>
                </p>
              )}
            </NarrativeBlock>

            <NarrativeBlock title="Fourchette de valorisation — 3 scénarios">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                {([
                  { key: 'bear', label: 'Bear', ev: syn.range?.bear, moic: syn.moic_bear, irr: syn.irr_bear },
                  { key: 'base', label: 'Base', ev: syn.range?.base, moic: syn.moic_base, irr: syn.irr_base },
                  { key: 'bull', label: 'Bull', ev: syn.range?.bull, moic: syn.moic_bull, irr: syn.irr_bull },
                ] as const).map((s) => (
                  <div key={s.key} className="rounded-md p-3 bg-background border border-border/60">
                    <p className="font-semibold mb-2">{s.label}</p>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="rounded bg-muted/50 px-2 py-1.5">
                        <div className="text-[9px] uppercase tracking-wider text-muted-foreground">EV</div>
                        <div className="text-sm font-semibold tabular-nums">{fmtMoney(s.ev, cur)}</div>
                      </div>
                      <div className="rounded bg-muted/50 px-2 py-1.5">
                        <div className="text-[9px] uppercase tracking-wider text-muted-foreground">MOIC</div>
                        <div className="text-sm font-semibold tabular-nums">{fmtX(s.moic)}</div>
                      </div>
                      <div className="rounded bg-muted/50 px-2 py-1.5">
                        <div className="text-[9px] uppercase tracking-wider text-muted-foreground">TRI</div>
                        <div className="text-sm font-semibold tabular-nums">{fmtPct(s.irr, 0)}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </NarrativeBlock>

            {(syn.weights?.dcf != null || syn.weights?.multiples != null || syn.weights?.ancc != null) && (
              <NarrativeBlock title="Pondération des méthodes">
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded p-3 bg-background border border-border/60">
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider">DCF</div>
                    <div className="text-base font-semibold">{fmtPct(syn.weights?.dcf, 0)}</div>
                  </div>
                  <div className="rounded p-3 bg-background border border-border/60">
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Multiples</div>
                    <div className="text-base font-semibold">{fmtPct(syn.weights?.multiples, 0)}</div>
                  </div>
                  <div className="rounded p-3 bg-background border border-border/60">
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider">ANCC</div>
                    <div className="text-base font-semibold">{fmtPct(syn.weights?.ancc, 0)}</div>
                  </div>
                </div>
              </NarrativeBlock>
            )}

            {justification && (
              <NarrativeBlock title="Justification analyste">
                <p className="leading-relaxed whitespace-pre-line">{justification}</p>
              </NarrativeBlock>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
