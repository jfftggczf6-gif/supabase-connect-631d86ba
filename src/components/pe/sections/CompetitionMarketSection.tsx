import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import ReactMarkdown from 'react-markdown';
import NarrativeBlock from './NarrativeBlock';
import SectionMetadataFooter from './SectionMetadataFooter';

interface Props {
  section: { content_md: string | null; content_json: any };
  allSections?: Record<string, any>;
}

export default function CompetitionMarketSection({ section }: Props) {
  const cj = section.content_json ?? {};
  const meta = cj.meta;
  const tamSamSom = cj.tam_sam_som;
  const megatrends: any[] = cj.megatrends ?? [];
  const reglementation = cj.reglementation;
  const concurrents = cj.concurrents;
  const senegalAnalysis = cj.senegal_analysis;
  const menaces: any[] = cj.menaces ?? [];
  const positionnement = cj.positionnement;
  const benchmark = cj.benchmark;
  const footer = cj.footer;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Concurrence et marché</CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {tamSamSom && (
          <NarrativeBlock title="Taille du marché — TAM / SAM / SOM">
            <div className="space-y-2">
              {tamSamSom.tam && <p><strong>TAM :</strong> {tamSamSom.tam}</p>}
              {tamSamSom.sam && <p><strong>SAM :</strong> {tamSamSom.sam}</p>}
              {tamSamSom.som && <p><strong>SOM :</strong> {tamSamSom.som}</p>}
            </div>
          </NarrativeBlock>
        )}

        {megatrends.length > 0 && (
          <NarrativeBlock title="Mégatendances sectorielles">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              {megatrends.map((k: any, i: number) => (
                <div key={i} className="rounded p-3 bg-background border">
                  <div className="text-base font-medium">{k.value}</div>
                  <div className="text-[10px] mt-0.5 text-muted-foreground">{k.label}</div>
                  {k.hint && <div className="text-[9px] mt-1 text-muted-foreground">{k.hint}</div>}
                </div>
              ))}
            </div>
          </NarrativeBlock>
        )}

        {reglementation?.paragraphs?.length > 0 && (
          <NarrativeBlock title="Réglementation — un environnement de plus en plus favorable">
            <div className="space-y-2">
              {reglementation.paragraphs.map((p: string, i: number) => <p key={i}>{p}</p>)}
            </div>
          </NarrativeBlock>
        )}

        {concurrents?.rows?.length > 0 && (
          <NarrativeBlock title="Paysage concurrentiel">
            {concurrents.intro && <p className="mb-3">{concurrents.intro}</p>}
            <div className="space-y-4">
              {concurrents.rows.map((r: any, i: number) => (
                <div
                  key={i}
                  className={`rounded-md p-3 ${r.highlight === 'self' ? 'bg-violet-50 border border-violet-200' : 'bg-background border border-border/60'}`}
                >
                  <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
                    <p className="font-semibold">
                      {r.name}
                      {r.highlight === 'self' && <span className="ml-2 text-[10px] uppercase tracking-wider text-violet-700 font-semibold">cible</span>}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                    {r.ca && (
                      <div className="rounded bg-muted/50 px-2 py-1.5">
                        <div className="text-[9px] uppercase tracking-wider text-muted-foreground">CA</div>
                        <div className="text-sm font-semibold tabular-nums">{r.ca}</div>
                      </div>
                    )}
                    {r.pdm && (
                      <div className="rounded bg-muted/50 px-2 py-1.5">
                        <div className="text-[9px] uppercase tracking-wider text-muted-foreground">PdM</div>
                        <div className="text-sm font-semibold tabular-nums">{r.pdm}</div>
                      </div>
                    )}
                    {r.marge && (
                      <div className="rounded bg-muted/50 px-2 py-1.5">
                        <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Marge</div>
                        <div className="text-sm font-semibold tabular-nums">{r.marge}</div>
                      </div>
                    )}
                    {r.cagr && (
                      <div className="rounded bg-muted/50 px-2 py-1.5">
                        <div className="text-[9px] uppercase tracking-wider text-muted-foreground">CAGR</div>
                        <div className="text-sm font-semibold tabular-nums">{r.cagr}</div>
                      </div>
                    )}
                  </div>
                  {r.analyse && (
                    <p className="text-muted-foreground text-sm leading-relaxed">{r.analyse}</p>
                  )}
                </div>
              ))}
            </div>
            {concurrents.dynamique && <p className="mt-3 pt-2 border-t border-dashed border-border">{concurrents.dynamique}</p>}
          </NarrativeBlock>
        )}

        {senegalAnalysis && (
          <NarrativeBlock title="Analyse de la concurrence sur le marché sénégalais (expansion prévue)">
            <p>{senegalAnalysis}</p>
          </NarrativeBlock>
        )}

        {menaces.length > 0 && (
          <NarrativeBlock title="Menaces potentielles et analyse de résilience">
            <div className="space-y-2">
              {menaces.map((m: any, i: number) => (
                <p key={i}>
                  <strong>Menace {i + 1} — {m.title} :</strong>
                  {m.probability && <> Probabilité <strong>{m.probability}</strong>.</>}
                  {' '}{m.body}
                </p>
              ))}
            </div>
          </NarrativeBlock>
        )}

        {positionnement?.paragraphs?.length > 0 && (
          <NarrativeBlock title="Positionnement concurrentiel — synthèse analyste">
            <div className="space-y-2">
              {positionnement.paragraphs.map((p: string, i: number) => <p key={i}>{p}</p>)}
            </div>
          </NarrativeBlock>
        )}

        {benchmark?.headers?.length > 0 && benchmark?.rows?.length > 0 && !concurrents && (
          <NarrativeBlock title="Benchmark sectoriel">
            <div className="grid grid-cols-4 border-b text-[10px] text-muted-foreground py-1">
              <span>Ratio</span>
              {benchmark.headers.map((h: string, i: number) => <span key={i} className="text-right">{h}</span>)}
            </div>
            {benchmark.rows.map((r: any, i: number) => (
              <div key={i} className="grid grid-cols-4 py-1 border-b border-border/30 text-xs">
                <span className="text-muted-foreground">{r.ratio}</span>
                <span className="text-right font-medium">{r.company}</span>
                <span className="text-right">{r.median}</span>
                <span className="text-right">{r.quartile}</span>
              </div>
            ))}
            {benchmark.source && <p className="text-[10px] text-muted-foreground mt-2">Source : {benchmark.source}</p>}
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
