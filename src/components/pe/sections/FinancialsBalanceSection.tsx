import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import ReactMarkdown from 'react-markdown';
import NarrativeBlock from './NarrativeBlock';
import SectionMetadataFooter from './SectionMetadataFooter';

interface Props {
  section: { content_md: string | null; content_json: any };
  allSections?: Record<string, any>;
}

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
      <div className="grid border-b text-[10px] text-muted-foreground py-1" style={{ gridTemplateColumns: cols }}>
        <span>FCFA (M)</span>
        {headers.map((h, i) => <span key={i} className="text-right">{h}</span>)}
        <span className="text-right">Évolution</span>
      </div>
      {rows.map((r, i) => (
        <div
          key={i}
          className="grid py-1 border-b border-border/30 text-xs"
          style={{ gridTemplateColumns: cols, fontWeight: r.bold ? 500 : undefined }}
        >
          <span className={r.indent ? 'pl-3 text-muted-foreground italic' : ''}>{r.label}</span>
          {r.values.map((v, j) => <span key={j} className="text-right">{v ?? '—'}</span>)}
          <span className="text-right text-muted-foreground">{r.delta ?? ''}</span>
        </div>
      ))}
    </div>
  );
}

interface KpiCard {
  label: string; value: string; color?: 'ok' | 'warning' | 'danger'; hint?: string;
}

function KpiGrid({ kpis }: { kpis: KpiCard[] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
      {kpis.map((k, i) => (
        <div key={i} className="rounded p-3 bg-background border">
          <div className="text-[10px] text-muted-foreground">{k.label}</div>
          <div className="text-base font-medium">{k.value}</div>
          {k.hint && <div className="text-[9px] mt-0.5 text-muted-foreground">{k.hint}</div>}
        </div>
      ))}
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
  const bfrDecomposition = cj.bfr_decomposition;
  const leviersBfr = cj.leviers_bfr;
  const endettementKpis: KpiCard[] = cj.endettement_kpis ?? [];
  const endettement = cj.endettement;
  const desendettement = cj.desendettement;
  const tresorerieAnalysis = cj.tresorerie_analysis;
  const cashFlowOps = cj.cash_flow_operations;
  const noRedFlagBox = cj.no_red_flag_conclusion;
  const vigilancePoints: any[] = cj.vigilance_points ?? [];
  const vna = cj.vna_paragraphe;
  const redFlags: any[] = cj.red_flags ?? [];
  const footer = cj.footer;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">États financiers — Bilan et trésorerie</CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {(actif || passif) && (
          <NarrativeBlock title="Bilan simplifié 3 ans — SYSCOHADA">
            {actif && <BilanTable title="ACTIF" headers={actif.headers ?? ['2023', '2024', '2025']} rows={actif.rows ?? []} />}
            {passif && <div className="mt-3"><BilanTable title="PASSIF" headers={passif.headers ?? ['2023', '2024', '2025']} rows={passif.rows ?? []} /></div>}
          </NarrativeBlock>
        )}

        {(bfrKpis.length > 0 || bfrAnalysis?.paragraphs?.length > 0 || bfrDecomposition?.rows?.length > 0) && (
          <NarrativeBlock title="Analyse du BFR">
            {bfrKpis.length > 0 && <KpiGrid kpis={bfrKpis} />}
            {bfrAnalysis?.paragraphs?.length > 0 && (
              <div className="space-y-2 mt-3">
                {bfrAnalysis.paragraphs.map((p: string, i: number) => <p key={i}>{p}</p>)}
              </div>
            )}
            {bfrDecomposition?.rows?.length > 0 && (
              <div className="mt-3 pt-2 border-t border-dashed border-border">
                <p className="font-medium mb-2">Décomposition du BFR :</p>
                <div className="grid grid-cols-[3fr_1fr_1fr_1fr] border-b text-[10px] text-muted-foreground py-1">
                  <span>Composante BFR</span>
                  {(bfrDecomposition.headers ?? ['2023', '2025', 'Commentaire']).map((h: string, i: number) => (
                    <span key={i} className={i === 2 ? '' : 'text-right'}>{h}</span>
                  ))}
                </div>
                {bfrDecomposition.rows.map((r: any, i: number) => (
                  <div key={i} className="grid grid-cols-[3fr_1fr_1fr_1fr] py-1 border-b border-border/30 text-xs"
                    style={{ fontWeight: r.bold ? 500 : undefined }}>
                    <span>{r.label}</span>
                    <span className="text-right">{r.value_a}</span>
                    <span className="text-right">{r.value_b}</span>
                    <span className="text-muted-foreground italic">{r.comment}</span>
                  </div>
                ))}
              </div>
            )}
          </NarrativeBlock>
        )}

        {leviersBfr && (
          <NarrativeBlock title="Leviers de réduction du BFR identifiés">
            {leviersBfr.intro && <p className="mb-2">{leviersBfr.intro}</p>}
            {leviersBfr.items?.length > 0 && (
              <div className="space-y-2">
                {leviersBfr.items.map((it: any, i: number) => (
                  <p key={i}><strong>({it.n}) {it.title}</strong> — {it.body}</p>
                ))}
              </div>
            )}
          </NarrativeBlock>
        )}

        {(endettement || endettementKpis.length > 0 || desendettement) && (
          <NarrativeBlock title="Endettement">
            {endettement && <p className="mb-2">{endettement}</p>}
            {endettementKpis.length > 0 && <KpiGrid kpis={endettementKpis} />}
            {desendettement && (
              <p className="mt-2"><strong>Désendettement en cours :</strong> {desendettement}</p>
            )}
          </NarrativeBlock>
        )}

        {(tresorerieAnalysis || cashFlowOps) && (
          <NarrativeBlock title="Analyse de la trésorerie">
            {tresorerieAnalysis && <p>{tresorerieAnalysis}</p>}
            {cashFlowOps && (
              <p className="mt-2"><strong>Cash flow from operations :</strong> {cashFlowOps}</p>
            )}
          </NarrativeBlock>
        )}

        {(noRedFlagBox || vigilancePoints.length > 0) && (
          <NarrativeBlock title="Red flags bilan et conclusion">
            {noRedFlagBox && <p className="mb-2">{noRedFlagBox}</p>}
            {vigilancePoints.length > 0 && (
              <div className="space-y-2">
                <p className="font-medium">{vigilancePoints.length} point{vigilancePoints.length > 1 ? 's' : ''} de vigilance :</p>
                <ul className="space-y-1 text-muted-foreground">
                  {vigilancePoints.map((vp: any, i: number) => (
                    <li key={i}>· <strong className="text-foreground">{vp.title}</strong> — {vp.body}</li>
                  ))}
                </ul>
              </div>
            )}
          </NarrativeBlock>
        )}

        {vna && (
          <NarrativeBlock title="Valeur nette d'actif (VNA)">
            <p>{vna}</p>
          </NarrativeBlock>
        )}

        {redFlags.length > 0 && !vigilancePoints.length && (
          <NarrativeBlock title="Red flags identifiés">
            <div className="space-y-3">
              {redFlags.map((rf: any, i: number) => (
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
