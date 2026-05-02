import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import ReactMarkdown from 'react-markdown';
import RedFlagItem from '@/components/dashboard/viewers/atoms/pe/RedFlagItem';

interface Props {
  section: { content_md: string | null; content_json: any };
  allSections?: Record<string, any>;
}

const SubHeading = ({ children }: { children: React.ReactNode }) => (
  <h4 className="text-xs font-bold uppercase tracking-wide text-foreground mb-2 mt-3 border-l-2 border-[var(--pe-purple)] pl-2 py-0.5">{children}</h4>
);

const sevToRedFlag: Record<string, 'high' | 'medium' | 'low'> = {
  Critical: 'high', High: 'high', Medium: 'medium', Low: 'low',
  high: 'high', medium: 'medium', low: 'low',
};

interface PnlRow {
  label: string;
  values: (string | number | null)[];
  delta?: string;
  highlight?: 'ok' | 'warning' | 'danger';
  bold?: boolean;
  indent?: boolean;
  sub?: boolean;
}

const HIGHLIGHT_COLOR: Record<string, string> = {
  ok: 'var(--pe-ok)',
  warning: 'var(--pe-warning)',
  danger: 'var(--pe-danger)',
};

function PnlTable({ headers, rows, deltaHeader }: { headers: string[]; rows: PnlRow[]; deltaHeader?: string }) {
  const cols = `2.8fr ${headers.map(() => '1fr').join(' ')} 1.2fr`;
  return (
    <div className="text-sm rounded border bg-muted/30 p-3">
      <div className="grid border-b" style={{ gridTemplateColumns: cols }}>
        <span className="text-[10px] text-muted-foreground">FCFA (M)</span>
        {headers.map((h, i) => <span key={i} className="text-[10px] text-muted-foreground text-right py-1">{h}</span>)}
        <span className="text-[10px] text-muted-foreground text-right">{deltaHeader ?? 'Δ 3 ans'}</span>
      </div>
      {rows.map((r, i) => (
        <div
          key={i}
          className="grid py-1 border-b border-border/30"
          style={{
            gridTemplateColumns: cols,
            fontWeight: r.bold ? 500 : undefined,
            color: r.highlight ? HIGHLIGHT_COLOR[r.highlight] : undefined,
          }}
        >
          <span className={r.indent ? 'pl-3 text-muted-foreground' : r.sub ? 'pl-3 text-muted-foreground italic' : ''}>{r.label}</span>
          {r.values.map((v, j) => (
            <span key={j} className="text-right">{v ?? '—'}</span>
          ))}
          <span className="text-right text-xs">{r.delta ?? ''}</span>
        </div>
      ))}
    </div>
  );
}

interface BenchmarkRow {
  ratio: string;
  company: string;
  p25?: string;
  median: string;
  quartile: string;
  highlight?: 'ok' | 'warning' | 'danger';
}

function BenchmarkRatios({ rows, source }: { rows: BenchmarkRow[]; source?: string }) {
  return (
    <div>
      <div className="text-sm rounded border bg-muted/30 p-3">
        <div className="grid grid-cols-5 border-b text-[10px] text-muted-foreground py-1">
          <span>Ratio</span>
          <span className="text-right">PharmaCi</span>
          <span className="text-right">P25</span>
          <span className="text-right">Médiane</span>
          <span className="text-right">Quartile</span>
        </div>
        {rows.map((r, i) => (
          <div
            key={i}
            className="grid grid-cols-5 py-1 border-b border-border/30"
            style={{ color: r.highlight ? HIGHLIGHT_COLOR[r.highlight] : undefined }}
          >
            <span className="text-muted-foreground">{r.ratio}</span>
            <span className="text-right font-medium">{r.company}</span>
            <span className="text-right">{r.p25 ?? '—'}</span>
            <span className="text-right">{r.median}</span>
            <span className="text-right">{r.quartile}</span>
          </div>
        ))}
      </div>
      {source && <p className="text-[10px] text-muted-foreground mt-1.5">Source : {source}</p>}
    </div>
  );
}

export default function FinancialsPnlSection({ section }: Props) {
  const cj = section.content_json ?? {};
  const meta = cj.meta;
  const pnl3y = cj.pnl_3y; // { headers, rows, footnote }
  const growthAnalysis = cj.growth_analysis; // { paragraphs }
  const grossMarginAnalysis = cj.gross_margin_analysis; // { paragraphs }
  const ebitdaAdjustments = cj.ebitda_adjustments; // { red_flags[], reconciliation_table }
  const taxRate = cj.tax_rate; // { narrative }
  const benchmarks = cj.benchmarks; // { rows[], source }
  const synthesis = cj.synthesis; // string narrative
  const snapshot = cj.snapshot_3y; // legacy
  const footer = cj.footer;

  return (
    <Card>
      <CardHeader className="pb-2 space-y-2">
        <CardTitle className="text-base">États financiers — Compte de résultat</CardTitle>
        {meta && (
          <div className="flex flex-wrap gap-1.5 text-[11px]">
            {meta.redige_par && <Badge variant="outline" style={{ background: 'var(--pe-bg-info)', color: 'var(--pe-info)', border: 'none' }}>Rédigé : {meta.redige_par}</Badge>}
            {meta.review_par && <Badge variant="outline" style={{ background: 'var(--pe-bg-purple)', color: 'var(--pe-purple)', border: 'none' }}>Review : {meta.review_par}</Badge>}
          </div>
        )}
        {meta?.version_note && (
          <div className="rounded px-3 py-1.5 text-[11px]" style={{ background: 'var(--pe-bg-info)', color: 'var(--pe-info)' }}>
            <strong>Version {meta.version_label ?? 'IC1 (draft)'}</strong> — {meta.version_note}
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Compte de résultat 3 ans */}
        {pnl3y && (
          <div>
            <SubHeading>Compte de résultat historique 3 ans — SYSCOHADA</SubHeading>
            <PnlTable headers={pnl3y.headers ?? ['2023', '2024', '2025']} rows={pnl3y.rows ?? []} deltaHeader={pnl3y.delta_header} />
            {pnl3y.footnote && <p className="text-[11px] text-muted-foreground mt-2">{pnl3y.footnote}</p>}
          </div>
        )}

        {/* Compat : snapshot_3y legacy */}
        {!pnl3y && snapshot && (
          <div>
            <SubHeading>Compte de résultat — Snapshot 3 ans</SubHeading>
            <PnlTable headers={snapshot.headers ?? []} rows={snapshot.rows ?? []} deltaHeader="Évolution" />
            {snapshot.footnote && <p className="text-[11px] text-muted-foreground mt-2">{snapshot.footnote}</p>}
          </div>
        )}

        {/* Analyse croissance CA */}
        {growthAnalysis?.paragraphs?.length > 0 && (
          <div>
            <SubHeading>Analyse de la croissance du CA</SubHeading>
            <div className="space-y-2 text-sm leading-relaxed">
              {growthAnalysis.paragraphs.map((p: string, i: number) => <p key={i}>{p}</p>)}
            </div>
          </div>
        )}

        {/* Analyse marge brute */}
        {grossMarginAnalysis?.paragraphs?.length > 0 && (
          <div>
            <SubHeading>Analyse de la marge brute — expansion continue</SubHeading>
            <div className="space-y-2 text-sm leading-relaxed">
              {grossMarginAnalysis.paragraphs.map((p: string, i: number) => <p key={i}>{p}</p>)}
            </div>
          </div>
        )}

        {/* Retraitements EBITDA */}
        {ebitdaAdjustments && (
          <div>
            <SubHeading>Retraitements EBITDA — détail et traçabilité</SubHeading>
            {ebitdaAdjustments.red_flags?.length > 0 && (
              <div className="space-y-1.5 mb-3">
                {ebitdaAdjustments.red_flags.map((rf: any, i: number) => (
                  <RedFlagItem
                    key={i}
                    title={rf.title + (rf.severity ? ` — sévérité ${rf.severity}` : '')}
                    severity={sevToRedFlag[rf.severity] ?? 'medium'}
                    detail={rf.body ?? rf.detail ?? ''}
                  />
                ))}
              </div>
            )}
            {ebitdaAdjustments.reconciliation && (
              <div>
                <p className="text-xs font-medium mb-1">Réconciliation EBITDA :</p>
                <div className="text-sm rounded border bg-muted/30 p-3">
                  <div className="grid grid-cols-2 border-b text-[10px] text-muted-foreground py-1">
                    <span>Poste</span>
                    <span className="text-right">FCFA (M)</span>
                  </div>
                  {(ebitdaAdjustments.reconciliation.rows ?? []).map((r: any, i: number) => (
                    <div
                      key={i}
                      className="grid grid-cols-2 py-1 border-b border-border/30"
                      style={{ fontWeight: r.bold ? 500 : undefined, color: r.highlight ? HIGHLIGHT_COLOR[r.highlight] : undefined }}
                    >
                      <span>{r.label}</span>
                      <span className="text-right">{r.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {ebitdaAdjustments.note && <p className="text-sm text-muted-foreground leading-relaxed mt-2">{ebitdaAdjustments.note}</p>}
          </div>
        )}

        {/* Taux d'imposition effectif */}
        {taxRate?.narrative && (
          <div>
            <SubHeading>Taux d'imposition effectif</SubHeading>
            <p className="text-sm leading-relaxed">{taxRate.narrative}</p>
          </div>
        )}

        {/* Benchmarks sectoriels */}
        {benchmarks && (
          <div>
            <SubHeading>Positionnement vs benchmarks sectoriels — ratios de rentabilité</SubHeading>
            <BenchmarkRatios rows={benchmarks.rows ?? []} source={benchmarks.source} />
          </div>
        )}

        {/* Synthèse PnL */}
        {synthesis && (
          <div>
            <SubHeading>Synthèse PnL</SubHeading>
            <p className="text-sm leading-relaxed">{synthesis}</p>
          </div>
        )}

        {/* Markdown libre */}
        {section.content_md && (
          <div className="prose prose-sm max-w-none text-foreground border-t pt-2">
            <ReactMarkdown>{section.content_md}</ReactMarkdown>
          </div>
        )}

        {/* Footer */}
        {footer && (
          <div className="rounded px-3 py-2 text-[11px] mt-2" style={{ background: 'var(--pe-bg-info)', color: 'var(--pe-info)' }}>
            Section 7 · Rédigée par {footer.redige_par ?? '—'} {footer.date ? `le ${footer.date}` : ''}
            {footer.review_comment && <p className="mt-0.5">Commentaire IM : "{footer.review_comment}"</p>}
            {footer.sources && <p className="mt-0.5">Sources : {footer.sources}</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
