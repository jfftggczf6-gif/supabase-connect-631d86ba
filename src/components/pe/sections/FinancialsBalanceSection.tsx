import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import ReactMarkdown from 'react-markdown';
import { CheckCircle2 } from 'lucide-react';
import RedFlagItem from '@/components/dashboard/viewers/atoms/pe/RedFlagItem';

interface Props {
  section: { content_md: string | null; content_json: any };
  allSections?: Record<string, any>;
}

const SubHeading = ({ children }: { children: React.ReactNode }) => (
  <h4 className="text-xs font-bold uppercase tracking-wide text-foreground mb-2 mt-3">{children}</h4>
);

const sevToRedFlag: Record<string, 'high' | 'medium' | 'low'> = {
  Critical: 'high', High: 'high', Medium: 'medium', Low: 'low',
  high: 'high', medium: 'medium', low: 'low',
};

const HIGHLIGHT: Record<string, string> = {
  ok: 'var(--pe-ok)', warning: 'var(--pe-warning)', danger: 'var(--pe-danger)',
};

interface BilanRow {
  label: string;
  values: (string | number | null)[];
  delta?: string;
  highlight?: 'ok' | 'warning' | 'danger';
  bold?: boolean;
  indent?: boolean;
}

function BilanTable({ title, headers, rows }: { title: string; headers: string[]; rows: BilanRow[] }) {
  const cols = `3fr ${headers.map(() => '1fr').join(' ')} 1fr`;
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">{title}</p>
      <div className="text-sm rounded border bg-muted/30 p-3">
        <div className="grid border-b text-[10px] text-muted-foreground py-1" style={{ gridTemplateColumns: cols }}>
          <span>FCFA (M)</span>
          {headers.map((h, i) => <span key={i} className="text-right">{h}</span>)}
          <span className="text-right">Évolution</span>
        </div>
        {rows.map((r, i) => (
          <div
            key={i}
            className="grid py-1 border-b border-border/30 text-xs"
            style={{
              gridTemplateColumns: cols,
              fontWeight: r.bold ? 500 : undefined,
              color: r.highlight ? HIGHLIGHT[r.highlight] : undefined,
            }}
          >
            <span className={r.indent ? 'pl-3 text-muted-foreground italic' : ''}>{r.label}</span>
            {r.values.map((v, j) => <span key={j} className="text-right">{v ?? '—'}</span>)}
            <span className="text-right">{r.delta ?? ''}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

interface KpiCard {
  label: string; value: string; color?: 'ok' | 'warning' | 'danger'; hint?: string;
}

function KpiGrid({ kpis }: { kpis: KpiCard[] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
      {kpis.map((k, i) => {
        const bg = k.color === 'danger' ? 'var(--pe-bg-danger)' : k.color === 'warning' ? 'var(--pe-bg-warning)' : k.color === 'ok' ? 'var(--pe-bg-ok)' : 'var(--muted)';
        const fg = k.color ? HIGHLIGHT[k.color] : undefined;
        return (
          <div key={i} className="rounded p-3" style={{ background: bg }}>
            <div className="text-[10px]" style={{ color: fg ?? 'var(--muted-foreground)' }}>{k.label}</div>
            <div className="text-base font-medium" style={{ color: fg }}>{k.value}</div>
            {k.hint && <div className="text-[9px] mt-0.5" style={{ color: fg ?? 'var(--muted-foreground)' }}>{k.hint}</div>}
          </div>
        );
      })}
    </div>
  );
}

export default function FinancialsBalanceSection({ section }: Props) {
  const cj = section.content_json ?? {};
  const meta = cj.meta;
  const actif = cj.bilan_actif;
  const passif = cj.bilan_passif;
  const bfrKpis: KpiCard[] = cj.bfr_kpis ?? [];
  const bfrAnalysis = cj.bfr_analysis;
  const bfrDecomposition = cj.bfr_decomposition; // { headers, rows: [{label, values: [v2023, v2025, comment], highlight, bold}], totals }
  const leviersBfr = cj.leviers_bfr; // { intro, items: [{n, title, body}] }
  const endettementKpis: KpiCard[] = cj.endettement_kpis ?? [];
  const endettement = cj.endettement; // string ou paragraphes
  const desendettement = cj.desendettement; // string
  const tresorerieAnalysis = cj.tresorerie_analysis; // string
  const cashFlowOps = cj.cash_flow_operations; // string
  const noRedFlagBox = cj.no_red_flag_conclusion; // string positive
  const vigilancePoints: any[] = cj.vigilance_points ?? []; // [{title, body}]
  const vna = cj.vna_paragraphe; // string
  const redFlags: any[] = cj.red_flags ?? [];
  const footer = cj.footer;

  return (
    <Card>
      <CardHeader className="pb-2 space-y-2">
        <CardTitle className="text-base">États financiers — Bilan et trésorerie</CardTitle>
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
        {(actif || passif) && (
          <div>
            <SubHeading>Bilan simplifié 3 ans — SYSCOHADA</SubHeading>
            {actif && <BilanTable title="ACTIF" headers={actif.headers ?? ['2023', '2024', '2025']} rows={actif.rows ?? []} />}
            {passif && <div className="mt-3"><BilanTable title="PASSIF" headers={passif.headers ?? ['2023', '2024', '2025']} rows={passif.rows ?? []} /></div>}
          </div>
        )}

        {bfrKpis.length > 0 && (
          <div>
            <SubHeading>Analyse du BFR — point de vigilance principal</SubHeading>
            <KpiGrid kpis={bfrKpis} />
          </div>
        )}

        {bfrAnalysis?.paragraphs?.length > 0 && (
          <div className="space-y-2 text-sm leading-relaxed">
            {bfrAnalysis.paragraphs.map((p: string, i: number) => <p key={i}>{p}</p>)}
          </div>
        )}

        {bfrDecomposition?.rows?.length > 0 && (
          <div>
            <p className="text-sm font-medium mb-1">Décomposition du BFR :</p>
            <div className="text-sm rounded border bg-muted/30 p-3">
              <div className="grid grid-cols-[3fr_1fr_1fr_1fr] border-b text-[10px] text-muted-foreground py-1">
                <span>Composante BFR</span>
                {(bfrDecomposition.headers ?? ['2023', '2025', 'Commentaire']).map((h: string, i: number) => (
                  <span key={i} className={i === 2 ? '' : 'text-right'}>{h}</span>
                ))}
              </div>
              {bfrDecomposition.rows.map((r: any, i: number) => (
                <div key={i} className="grid grid-cols-[3fr_1fr_1fr_1fr] py-1 border-b border-border/30 text-xs"
                  style={{ fontWeight: r.bold ? 500 : undefined, color: r.highlight ? HIGHLIGHT[r.highlight] : undefined }}>
                  <span>{r.label}</span>
                  <span className="text-right">{r.value_a}</span>
                  <span className="text-right">{r.value_b}</span>
                  <span className="text-muted-foreground italic">{r.comment}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {leviersBfr && (
          <div>
            <SubHeading>Leviers de réduction du BFR identifiés</SubHeading>
            {leviersBfr.intro && <p className="text-sm leading-relaxed mb-2">{leviersBfr.intro}</p>}
            {leviersBfr.items?.length > 0 && (
              <div className="space-y-2 text-sm leading-relaxed">
                {leviersBfr.items.map((it: any, i: number) => (
                  <p key={i}><strong>({it.n}) {it.title}</strong> — {it.body}</p>
                ))}
              </div>
            )}
          </div>
        )}

        {(endettement || endettementKpis.length > 0) && (
          <div>
            <SubHeading>Endettement — profil sain et en amélioration</SubHeading>
            {endettement && <p className="text-sm leading-relaxed mb-2">{endettement}</p>}
            {endettementKpis.length > 0 && <KpiGrid kpis={endettementKpis} />}
          </div>
        )}

        {desendettement && (
          <div>
            <p className="text-sm leading-relaxed"><strong>Désendettement en cours :</strong> {desendettement}</p>
          </div>
        )}

        {tresorerieAnalysis && (
          <div>
            <SubHeading>Analyse de la trésorerie — volatilité préoccupante</SubHeading>
            <p className="text-sm leading-relaxed">{tresorerieAnalysis}</p>
          </div>
        )}

        {cashFlowOps && (
          <div>
            <p className="text-sm leading-relaxed"><strong>Cash flow from operations :</strong> {cashFlowOps}</p>
          </div>
        )}

        {(noRedFlagBox || vigilancePoints.length > 0) && (
          <div>
            <SubHeading>Red flags bilan et conclusion</SubHeading>
            {noRedFlagBox && (
              <div className="rounded px-3 py-2 text-sm" style={{ background: 'var(--pe-bg-ok)', borderLeft: '3px solid var(--pe-ok)' }}>
                <p className="flex items-center gap-2 font-semibold" style={{ color: 'var(--pe-ok)' }}>
                  <CheckCircle2 className="h-4 w-4" />
                  {noRedFlagBox}
                </p>
              </div>
            )}
            {vigilancePoints.length > 0 && (
              <div className="rounded px-3 py-2 text-sm mt-2" style={{ background: 'var(--pe-bg-warning)', borderLeft: '3px solid var(--pe-warning)' }}>
                <p className="font-semibold mb-1" style={{ color: 'var(--pe-warning)' }}>{vigilancePoints.length} points de vigilance :</p>
                <ul className="space-y-1 text-xs">
                  {vigilancePoints.map((vp: any, i: number) => (
                    <li key={i}>· <strong>{vp.title}</strong> — {vp.body}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {vna && (
          <div>
            <p className="text-sm leading-relaxed"><strong>Valeur nette d'actif (VNA) :</strong> {vna}</p>
          </div>
        )}

        {/* Legacy red_flags fallback */}
        {redFlags.length > 0 && !vigilancePoints.length && (
          <div>
            <SubHeading>Red flags identifiés</SubHeading>
            <div className="space-y-1.5">
              {redFlags.map((rf: any, i: number) => (
                <RedFlagItem
                  key={i}
                  title={rf.title + (rf.severity ? ` — sévérité ${rf.severity}` : '')}
                  severity={sevToRedFlag[rf.severity] ?? 'medium'}
                  detail={rf.body ?? rf.detail ?? ''}
                />
              ))}
            </div>
          </div>
        )}

        {section.content_md && (
          <div className="prose prose-sm max-w-none text-foreground border-t pt-2">
            <ReactMarkdown>{section.content_md}</ReactMarkdown>
          </div>
        )}

        {footer && (
          <div className="rounded px-3 py-2 text-[11px] mt-2" style={{ background: 'var(--pe-bg-info)', color: 'var(--pe-info)' }}>
            Section 8 · Rédigée par {footer.redige_par ?? '—'} {footer.date ? `le ${footer.date}` : ''}
            {footer.review_comment && <p className="mt-0.5">Commentaire IM : "{footer.review_comment}"</p>}
            {footer.sources && <p className="mt-0.5">Sources : {footer.sources}</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
