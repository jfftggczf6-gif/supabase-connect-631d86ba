import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import ReactMarkdown from 'react-markdown';

interface Props {
  section: { content_md: string | null; content_json: any };
  allSections?: Record<string, any>;
}

const SubHeading = ({ children }: { children: React.ReactNode }) => (
  <h4 className="text-xs font-bold uppercase tracking-wide text-foreground mb-2 mt-3 border-l-2 border-[var(--pe-purple)] pl-2 py-0.5">{children}</h4>
);

function GenericTable({ headers, rows, gridCols }: { headers: string[]; rows: any[][]; gridCols: string }) {
  return (
    <div className="text-sm rounded border bg-muted/30 p-3">
      <div className="grid border-b text-[10px] text-muted-foreground py-1" style={{ gridTemplateColumns: gridCols }}>
        {headers.map((h, i) => <span key={i} className={i === 0 ? '' : 'text-right'}>{h}</span>)}
      </div>
      {rows.map((row, i) => (
        <div key={i} className="grid py-1 border-b border-border/30 text-xs" style={{ gridTemplateColumns: gridCols }}>
          {row.map((cell, j) => (
            <span key={j} className={j === 0 ? 'text-muted-foreground' : 'text-right'}>
              {typeof cell === 'object' && cell != null
                ? <span style={{ color: cell.color, fontWeight: cell.bold ? 500 : undefined }}>{cell.v}</span>
                : cell}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

export default function UnitEconomicsSection({ section }: Props) {
  const cj = section.content_json ?? {};
  const meta = cj.meta;
  const renderingByCanal = cj.rentabilite_canal; // { headers, rows: cells[][] }
  const renderingByFamille = cj.rentabilite_famille;
  const decompositionCout = cj.decomposition_cout; // [{label, value, hint}]
  const sensibiliteApi = cj.sensibilite_api; // { headers, rows }
  const breakEven = cj.break_even; // { value, hint }
  const levierOpe = cj.levier_operationnel; // string
  const unitEcoSn = cj.unit_eco_sn; // string
  const benchmarks = cj.benchmarks; // { headers, rows }
  const footer = cj.footer;

  return (
    <Card>
      <CardHeader className="pb-2 space-y-2">
        <CardTitle className="text-base">Unit economics</CardTitle>
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
        {renderingByCanal?.rows?.length > 0 && (
          <div>
            <SubHeading>Rentabilité par canal de distribution</SubHeading>
            <GenericTable headers={renderingByCanal.headers} rows={renderingByCanal.rows} gridCols="2fr 1fr 1fr 1fr 1fr" />
          </div>
        )}

        {renderingByFamille?.rows?.length > 0 && (
          <div>
            <SubHeading>Rentabilité par famille thérapeutique</SubHeading>
            <GenericTable headers={renderingByFamille.headers} rows={renderingByFamille.rows} gridCols="2fr 1fr 1fr 1fr 1fr" />
          </div>
        )}

        {decompositionCout?.length > 0 && (
          <div>
            <SubHeading>Décomposition du coût de revient (par unité)</SubHeading>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              {decompositionCout.map((k: any, i: number) => (
                <div key={i} className="rounded p-3 bg-muted">
                  <div className="text-base font-medium">{k.value}</div>
                  <div className="text-[10px] mt-0.5">{k.label}</div>
                  {k.hint && <div className="text-[9px] text-muted-foreground mt-0.5">{k.hint}</div>}
                </div>
              ))}
            </div>
          </div>
        )}

        {sensibiliteApi?.rows?.length > 0 && (
          <div>
            <SubHeading>Sensibilité au prix des API</SubHeading>
            <GenericTable headers={sensibiliteApi.headers} rows={sensibiliteApi.rows} gridCols="2fr 1fr 1fr 1fr 1fr" />
          </div>
        )}

        {breakEven && (
          <div>
            <SubHeading>Break-even et levier opérationnel</SubHeading>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <div className="rounded p-3" style={{ background: 'var(--pe-bg-ok)' }}>
                <div className="text-[10px]" style={{ color: 'var(--pe-ok)' }}>Break-even</div>
                <div className="text-base font-medium" style={{ color: 'var(--pe-ok)' }}>{breakEven.value}</div>
                {breakEven.hint && <div className="text-[9px] mt-0.5" style={{ color: 'var(--pe-ok)' }}>{breakEven.hint}</div>}
              </div>
              {levierOpe && (
                <div className="rounded p-3 bg-muted">
                  <div className="text-[10px] text-muted-foreground">Levier opérationnel</div>
                  <p className="text-xs mt-0.5 leading-relaxed">{levierOpe}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {unitEcoSn && (
          <div>
            <SubHeading>Unit economics expansion Sénégal</SubHeading>
            <p className="text-sm leading-relaxed">{unitEcoSn}</p>
          </div>
        )}

        {benchmarks?.rows?.length > 0 && (
          <div>
            <SubHeading>Benchmarks sectoriels</SubHeading>
            <GenericTable headers={benchmarks.headers} rows={benchmarks.rows} gridCols="2fr 1fr 1fr 1fr 1fr" />
          </div>
        )}

        {section.content_md && !renderingByCanal && (
          <div className="prose prose-sm max-w-none text-foreground border-t pt-2">
            <ReactMarkdown>{section.content_md}</ReactMarkdown>
          </div>
        )}

        {footer && (
          <div className="rounded px-3 py-2 text-[11px] mt-2" style={{ background: 'var(--pe-bg-info)', color: 'var(--pe-info)' }}>
            Section 6 · Rédigée par {footer.redige_par ?? '—'} {footer.date ? `le ${footer.date}` : ''}
            {footer.sources && <p className="mt-0.5">Sources : {footer.sources}</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
