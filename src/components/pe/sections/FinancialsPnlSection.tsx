import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import ReactMarkdown from 'react-markdown';
import NarrativeBlock from './NarrativeBlock';
import SectionMetadataFooter from './SectionMetadataFooter';

interface Props {
  section: { content_md: string | null; content_json: any };
  allSections?: Record<string, any>;
}

interface PnlRow {
  label: string;
  values: (string | number | null)[];
  delta?: string;
  highlight?: 'ok' | 'warning' | 'danger';
  bold?: boolean;
  indent?: boolean;
  sub?: boolean;
}

function PnlTable({ headers, rows, deltaHeader }: { headers: string[]; rows: PnlRow[]; deltaHeader?: string }) {
  const cols = `2.8fr ${headers.map(() => '1fr').join(' ')} 1.2fr`;
  return (
    <>
      <div className="grid border-b" style={{ gridTemplateColumns: cols }}>
        <span className="text-[10px] text-muted-foreground">FCFA (M)</span>
        {headers.map((h, i) => <span key={i} className="text-[10px] text-muted-foreground text-right py-1">{h}</span>)}
        <span className="text-[10px] text-muted-foreground text-right">{deltaHeader ?? 'Δ 3 ans'}</span>
      </div>
      {rows.map((r, i) => (
        <div
          key={i}
          className="grid py-1 border-b border-border/30"
          style={{ gridTemplateColumns: cols, fontWeight: r.bold ? 500 : undefined }}
        >
          <span className={r.indent ? 'pl-3 text-muted-foreground' : r.sub ? 'pl-3 text-muted-foreground italic' : ''}>{r.label}</span>
          {r.values.map((v, j) => (
            <span key={j} className="text-right">{v ?? '—'}</span>
          ))}
          <span className="text-right text-xs text-muted-foreground">{r.delta ?? ''}</span>
        </div>
      ))}
    </>
  );
}

interface BenchmarkRow {
  ratio: string;
  company: string;
  p25?: string;
  median: string;
  quartile: string;
}

function BenchmarkRatios({ rows, source }: { rows: BenchmarkRow[]; source?: string }) {
  return (
    <>
      <div className="grid grid-cols-5 border-b text-[10px] text-muted-foreground py-1">
        <span>Ratio</span>
        <span className="text-right">Cible</span>
        <span className="text-right">P25</span>
        <span className="text-right">Médiane</span>
        <span className="text-right">Quartile</span>
      </div>
      {rows.map((r, i) => (
        <div key={i} className="grid grid-cols-5 py-1 border-b border-border/30 text-xs">
          <span className="text-muted-foreground">{r.ratio}</span>
          <span className="text-right font-medium">{r.company}</span>
          <span className="text-right">{r.p25 ?? '—'}</span>
          <span className="text-right">{r.median}</span>
          <span className="text-right">{r.quartile}</span>
        </div>
      ))}
      {source && <p className="text-[10px] text-muted-foreground mt-2">Source : {source}</p>}
    </>
  );
}

export default function FinancialsPnlSection({ section }: Props) {
  const cj = section.content_json ?? {};
  const meta = cj.meta;
  const pnl3y = cj.pnl_3y;
  const growthAnalysis = cj.growth_analysis;
  const grossMarginAnalysis = cj.gross_margin_analysis;
  const ebitdaAdjustments = cj.ebitda_adjustments;
  const taxRate = cj.tax_rate;
  const benchmarks = cj.benchmarks;
  const synthesis = cj.synthesis;
  const snapshot = cj.snapshot_3y;
  const footer = cj.footer;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">États financiers — Compte de résultat</CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {pnl3y && (
          <NarrativeBlock title="Compte de résultat historique 3 ans — SYSCOHADA">
            <PnlTable headers={pnl3y.headers ?? ['2023', '2024', '2025']} rows={pnl3y.rows ?? []} deltaHeader={pnl3y.delta_header} />
            {pnl3y.footnote && <p className="text-[11px] text-muted-foreground mt-2">{pnl3y.footnote}</p>}
          </NarrativeBlock>
        )}

        {!pnl3y && snapshot && (
          <NarrativeBlock title="Compte de résultat — Snapshot 3 ans">
            <PnlTable headers={snapshot.headers ?? []} rows={snapshot.rows ?? []} deltaHeader="Évolution" />
            {snapshot.footnote && <p className="text-[11px] text-muted-foreground mt-2">{snapshot.footnote}</p>}
          </NarrativeBlock>
        )}

        {growthAnalysis?.paragraphs?.length > 0 && (
          <NarrativeBlock title="Analyse de la croissance du CA">
            <div className="space-y-2">
              {growthAnalysis.paragraphs.map((p: string, i: number) => <p key={i}>{p}</p>)}
            </div>
          </NarrativeBlock>
        )}

        {grossMarginAnalysis?.paragraphs?.length > 0 && (
          <NarrativeBlock title="Analyse de la marge brute">
            <div className="space-y-2">
              {grossMarginAnalysis.paragraphs.map((p: string, i: number) => <p key={i}>{p}</p>)}
            </div>
          </NarrativeBlock>
        )}

        {ebitdaAdjustments && (
          <NarrativeBlock title="Retraitements EBITDA — détail et traçabilité">
            {ebitdaAdjustments.red_flags?.length > 0 && (
              <div className="space-y-3 mb-3">
                {ebitdaAdjustments.red_flags.map((rf: any, i: number) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-red-500 font-bold mt-0.5 shrink-0">✕</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">{rf.title}{rf.severity ? ` — sévérité ${rf.severity}` : ''}</p>
                      {(rf.body || rf.detail) && (
                        <p className="text-muted-foreground mt-0.5">{rf.body ?? rf.detail}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {ebitdaAdjustments.reconciliation && (
              <div>
                <p className="text-xs font-medium mb-1">Réconciliation EBITDA :</p>
                <div className="grid grid-cols-2 border-b text-[10px] text-muted-foreground py-1">
                  <span>Poste</span>
                  <span className="text-right">FCFA (M)</span>
                </div>
                {(ebitdaAdjustments.reconciliation.rows ?? []).map((r: any, i: number) => (
                  <div
                    key={i}
                    className="grid grid-cols-2 py-1 border-b border-border/30"
                    style={{ fontWeight: r.bold ? 500 : undefined }}
                  >
                    <span>{r.label}</span>
                    <span className="text-right">{r.value}</span>
                  </div>
                ))}
              </div>
            )}
            {ebitdaAdjustments.note && <p className="text-muted-foreground mt-2">{ebitdaAdjustments.note}</p>}
          </NarrativeBlock>
        )}

        {taxRate?.narrative && (
          <NarrativeBlock title="Taux d'imposition effectif">
            <p>{taxRate.narrative}</p>
          </NarrativeBlock>
        )}

        {benchmarks && (
          <NarrativeBlock title="Positionnement vs benchmarks sectoriels — ratios de rentabilité">
            <BenchmarkRatios rows={benchmarks.rows ?? []} source={benchmarks.source} />
          </NarrativeBlock>
        )}

        {synthesis && (
          <NarrativeBlock title="Synthèse PnL">
            <p>{synthesis}</p>
          </NarrativeBlock>
        )}

        {section.content_md && (
          <NarrativeBlock title="Notes complémentaires">
            <div className="prose prose-sm max-w-none text-foreground">
              <ReactMarkdown>{section.content_md}</ReactMarkdown>
            </div>
          </NarrativeBlock>
        )}

        <SectionMetadataFooter meta={meta} footer={footer} />
      </CardContent>
    </Card>
  );
}
