import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import ReactMarkdown from 'react-markdown';
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

export default function FinancialsBalanceSection({ section }: Props) {
  const cj = section.content_json ?? {};
  const meta = cj.meta;
  const actif = cj.bilan_actif; // { headers, rows }
  const passif = cj.bilan_passif; // { headers, rows }
  const bfrKpis = cj.bfr_kpis; // [{label, value, color, hint}]
  const bfrAnalysis = cj.bfr_analysis; // { paragraphs }
  const endettement = cj.endettement; // string
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

        {bfrKpis?.length > 0 && (
          <div>
            <SubHeading>Analyse du BFR — point de vigilance principal</SubHeading>
            <div className="grid grid-cols-3 gap-2">
              {bfrKpis.map((k: any, i: number) => {
                const bg = k.color === 'danger' ? 'var(--pe-bg-danger)' : k.color === 'warning' ? 'var(--pe-bg-warning)' : 'var(--muted)';
                const fg = k.color === 'danger' ? 'var(--pe-danger)' : k.color === 'warning' ? 'var(--pe-warning)' : undefined;
                return (
                  <div key={i} className="rounded p-3" style={{ background: bg }}>
                    <div className="text-[10px]" style={{ color: fg ?? 'var(--muted-foreground)' }}>{k.label}</div>
                    <div className="text-base font-medium" style={{ color: fg }}>{k.value}</div>
                    {k.hint && <div className="text-[9px] mt-0.5" style={{ color: fg ?? 'var(--muted-foreground)' }}>{k.hint}</div>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {bfrAnalysis?.paragraphs?.length > 0 && (
          <div className="space-y-2 text-sm leading-relaxed">
            {bfrAnalysis.paragraphs.map((p: string, i: number) => <p key={i}>{p}</p>)}
          </div>
        )}

        {endettement && (
          <div>
            <SubHeading>Endettement — désendettement naturel en cours</SubHeading>
            <p className="text-sm leading-relaxed">{endettement}</p>
          </div>
        )}

        {redFlags.length > 0 && (
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
            {footer.sources && <p className="mt-0.5">Sources : {footer.sources}</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
