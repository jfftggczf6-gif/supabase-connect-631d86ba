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

export default function CompetitionMarketSection({ section }: Props) {
  const cj = section.content_json ?? {};
  const meta = cj.meta;
  const tamSamSom = cj.tam_sam_som; // { tam_paragraph, sam_paragraph, som_paragraph }
  const megatrends: any[] = cj.megatrends ?? []; // [{label, value, hint, color}]
  const reglementation = cj.reglementation; // { paragraphs }
  const concurrents = cj.concurrents; // { rows: [{name, ca, pdm, marge, cagr, analyse, highlight}], dynamique }
  const senegalAnalysis = cj.senegal_analysis; // string
  const menaces: any[] = cj.menaces ?? []; // [{title, probability, body}]
  const positionnement = cj.positionnement; // { paragraphs }
  const benchmark = cj.benchmark; // legacy
  const footer = cj.footer;

  return (
    <Card>
      <CardHeader className="pb-2 space-y-2">
        <CardTitle className="text-base">Concurrence et marché</CardTitle>
        {meta && (
          <div className="flex flex-wrap gap-1.5 text-[11px]">
            {meta.redige_par && <Badge variant="outline" style={{ background: 'var(--pe-bg-info)', color: 'var(--pe-info)', border: 'none' }}>Rédigé : {meta.redige_par}</Badge>}
            {meta.review_par && <Badge variant="outline" style={{ background: 'var(--pe-bg-purple)', color: 'var(--pe-purple)', border: 'none' }}>Review : {meta.review_par}</Badge>}
            {meta.valide_par && <Badge variant="outline" style={{ background: 'var(--pe-bg-warning)', color: 'var(--pe-warning)', border: 'none' }}>Validé : {meta.valide_par}</Badge>}
          </div>
        )}
        {meta?.version_note && (
          <div className="rounded px-3 py-1.5 text-[11px]" style={{ background: 'var(--pe-bg-info)', color: 'var(--pe-info)' }}>
            <strong>Version {meta.version_label ?? 'IC1 (draft)'}</strong> — {meta.version_note}
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Taille marché TAM/SAM/SOM */}
        {tamSamSom && (
          <div>
            <SubHeading>Taille du marché — TAM / SAM / SOM</SubHeading>
            <div className="space-y-2 text-sm leading-relaxed">
              {tamSamSom.tam && <p><strong>TAM :</strong> {tamSamSom.tam}</p>}
              {tamSamSom.sam && <p><strong>SAM :</strong> {tamSamSom.sam}</p>}
              {tamSamSom.som && <p><strong>SOM :</strong> {tamSamSom.som}</p>}
            </div>
          </div>
        )}

        {/* Mégatrends — 3 KPIs */}
        {megatrends.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            {megatrends.map((k: any, i: number) => {
              const bg = k.color === 'ok' ? 'var(--pe-bg-ok)' : 'var(--muted)';
              const fg = k.color === 'ok' ? 'var(--pe-ok)' : undefined;
              return (
                <div key={i} className="rounded p-3" style={{ background: bg }}>
                  <div className="text-base font-medium" style={{ color: fg }}>{k.value}</div>
                  <div className="text-[10px] mt-0.5" style={{ color: fg ?? 'var(--muted-foreground)' }}>{k.label}</div>
                  {k.hint && <div className="text-[9px] mt-1 text-muted-foreground leading-relaxed">{k.hint}</div>}
                </div>
              );
            })}
          </div>
        )}

        {/* Réglementation */}
        {reglementation?.paragraphs?.length > 0 && (
          <div>
            <SubHeading>Réglementation — un environnement de plus en plus favorable</SubHeading>
            <div className="space-y-2 text-sm leading-relaxed">
              {reglementation.paragraphs.map((p: string, i: number) => <p key={i}>{p}</p>)}
            </div>
          </div>
        )}

        {/* Paysage concurrentiel */}
        {concurrents?.rows?.length > 0 && (
          <div>
            <SubHeading>Paysage concurrentiel — un oligopole à 3 acteurs certifiés</SubHeading>
            {concurrents.intro && <p className="text-sm leading-relaxed mb-2">{concurrents.intro}</p>}
            <div className="text-sm rounded border bg-muted/30 p-3">
              <div className="grid grid-cols-[1.6fr_0.7fr_0.5fr_0.5fr_0.5fr_2.5fr] border-b text-[10px] text-muted-foreground py-1">
                <span>Concurrent</span>
                <span className="text-right">CA</span>
                <span className="text-right">PDM</span>
                <span className="text-right">Marge</span>
                <span className="text-right">CAGR</span>
                <span>Analyse</span>
              </div>
              {concurrents.rows.map((r: any, i: number) => (
                <div
                  key={i}
                  className="grid grid-cols-[1.6fr_0.7fr_0.5fr_0.5fr_0.5fr_2.5fr] py-1.5 border-b border-border/30 text-xs"
                  style={r.highlight === 'self' ? { background: 'var(--pe-bg-purple)', color: 'var(--pe-purple)' } : {}}
                >
                  <span className={r.highlight === 'self' ? 'font-medium' : 'font-medium'}>
                    {r.name}{r.highlight === 'self' ? ' ★' : ''}
                  </span>
                  <span className="text-right">{r.ca}</span>
                  <span className="text-right">{r.pdm}</span>
                  <span className="text-right">{r.marge}</span>
                  <span
                    className="text-right"
                    style={{ color: r.cagr_color === 'ok' ? 'var(--pe-ok)' : undefined }}
                  >
                    {r.cagr}
                  </span>
                  <span className="text-muted-foreground leading-relaxed">{r.analyse}</span>
                </div>
              ))}
            </div>
            {concurrents.dynamique && <p className="text-sm leading-relaxed mt-2">{concurrents.dynamique}</p>}
          </div>
        )}

        {/* Marché Sénégal */}
        {senegalAnalysis && (
          <div>
            <SubHeading>Analyse de la concurrence sur le marché sénégalais (expansion prévue)</SubHeading>
            <p className="text-sm leading-relaxed">{senegalAnalysis}</p>
          </div>
        )}

        {/* Menaces */}
        {menaces.length > 0 && (
          <div>
            <SubHeading>Menaces potentielles et analyse de résilience</SubHeading>
            <div className="space-y-2 text-sm leading-relaxed">
              {menaces.map((m: any, i: number) => (
                <p key={i}>
                  <strong>Menace {i + 1} — {m.title} :</strong>
                  {m.probability && <> Probabilité <strong>{m.probability}</strong>.</>}
                  {' '}{m.body}
                </p>
              ))}
            </div>
          </div>
        )}

        {/* Positionnement synthèse */}
        {positionnement?.paragraphs?.length > 0 && (
          <div>
            <SubHeading>Positionnement concurrentiel de PharmaCi — synthèse analyste</SubHeading>
            <div className="space-y-2 text-sm leading-relaxed">
              {positionnement.paragraphs.map((p: string, i: number) => <p key={i}>{p}</p>)}
            </div>
          </div>
        )}

        {/* Benchmark legacy */}
        {benchmark?.headers?.length > 0 && benchmark?.rows?.length > 0 && !concurrents && (
          <div>
            <SubHeading>Benchmark sectoriel</SubHeading>
            <div className="text-sm rounded border bg-muted/30 p-3">
              <div className="grid grid-cols-4 border-b text-[10px] text-muted-foreground py-1">
                <span>Ratio</span>
                {benchmark.headers.map((h: string, i: number) => <span key={i} className="text-right">{h}</span>)}
              </div>
              {benchmark.rows.map((r: any, i: number) => (
                <div key={i} className="grid grid-cols-4 py-1 border-b border-border/30">
                  <span className="text-muted-foreground">{r.ratio}</span>
                  <span className="text-right font-medium">{r.company}</span>
                  <span className="text-right">{r.median}</span>
                  <span className="text-right" style={{ color: 'var(--pe-ok)' }}>{r.quartile}</span>
                </div>
              ))}
            </div>
            {benchmark.source && <p className="text-[10px] text-muted-foreground mt-1.5">Source : {benchmark.source}</p>}
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
            Section 5 · Rédigée par {footer.redige_par ?? '—'} {footer.date ? `le ${footer.date}` : ''}
            {footer.review_par && ` · Validée IM (${footer.review_par})`}
            {footer.valide_par && ` · Validée MD (${footer.valide_par}${footer.valide_date ? `, ${footer.valide_date}` : ''})`}
            {footer.sources && <p className="mt-0.5">Sources : {footer.sources}</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
