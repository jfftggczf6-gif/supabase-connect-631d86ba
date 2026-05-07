import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import ReactMarkdown from 'react-markdown';
import NarrativeBlock from './NarrativeBlock';
import SectionMetadataFooter from './SectionMetadataFooter';

interface Props {
  section: { content_md: string | null; content_json: any };
  allSections?: Record<string, any>;
}

export default function ServicesSection({ section }: Props) {
  const cj = section.content_json ?? {};
  const meta = cj.meta;
  const nature = cj.nature_activite;
  const gammeProduits = cj.gamme_produits;
  const siteProduction = cj.site_production;
  const capaciteProduction = cj.capacite_production;
  const distribution = cj.distribution;
  const supplyChain = cj.supply_chain;
  const moatBpf = cj.moat_bpf;
  const activiteLegacy = cj.activite;
  const footer = cj.footer;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Services de l'entreprise et chaîne de valeur</CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {(nature || activiteLegacy) && (
          <NarrativeBlock title="Nature de l'activité">
            <p>{nature ?? activiteLegacy}</p>
          </NarrativeBlock>
        )}

        {gammeProduits?.rows?.length > 0 && (
          <NarrativeBlock title={`Gamme de produits — ${gammeProduits.rows.length} familles thérapeutiques`}>
            <div className="space-y-3">
              {gammeProduits.rows.map((r: any, i: number) => (
                <div key={i} className="border-b border-border/40 pb-2 last:border-b-0 last:pb-0">
                  <div className="flex items-baseline justify-between gap-3 flex-wrap">
                    <p className="font-medium">{r.famille}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.pct_ca && <>CA {r.pct_ca}</>}
                      {r.references && <> · {r.references} réf.</>}
                      {r.marge && <> · marge {r.marge}</>}
                    </p>
                  </div>
                  {r.molecules && (
                    <p className="text-muted-foreground mt-1">{r.molecules}</p>
                  )}
                </div>
              ))}
            </div>
            {gammeProduits.formes_galeniques && <p className="mt-3 pt-2 border-t border-dashed border-border">{gammeProduits.formes_galeniques}</p>}
          </NarrativeBlock>
        )}

        {siteProduction && (
          <NarrativeBlock title="Site de production">
            {typeof siteProduction === 'string'
              ? <p>{siteProduction}</p>
              : (siteProduction.paragraphs ?? []).map((p: string, i: number) => <p key={i} className="mb-2 last:mb-0">{p}</p>)
            }
          </NarrativeBlock>
        )}

        {capaciteProduction && (
          <NarrativeBlock title="Capacité de production — le levier de croissance clé">
            {capaciteProduction.kpis?.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
                {capaciteProduction.kpis.map((k: any, i: number) => (
                  <div key={i} className="rounded p-3 bg-background border">
                    <div className="text-base font-medium">{k.value}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">{k.label}</div>
                  </div>
                ))}
              </div>
            )}
            {(capaciteProduction.paragraphs ?? []).map((p: string, i: number) => <p key={i} className="mb-2 last:mb-0">{p}</p>)}
          </NarrativeBlock>
        )}

        {distribution?.paragraphs?.length > 0 && (
          <NarrativeBlock title="Distribution — double canal complémentaire">
            <div className="space-y-2">
              {distribution.paragraphs.map((p: string, i: number) => <p key={i}>{p}</p>)}
            </div>
          </NarrativeBlock>
        )}

        {supplyChain?.paragraphs?.length > 0 && (
          <NarrativeBlock title="Chaîne d'approvisionnement">
            <div className="space-y-2">
              {supplyChain.paragraphs.map((p: string, i: number) => <p key={i}>{p}</p>)}
            </div>
          </NarrativeBlock>
        )}

        {moatBpf && (
          <NarrativeBlock title="Avantage compétitif structurel — le moat BPF en 3 couches">
            {moatBpf.intro && <p className="mb-3">{moatBpf.intro}</p>}
            {moatBpf.layers?.length > 0 && (
              <div className="space-y-3">
                {moatBpf.layers.map((l: any, i: number) => (
                  <div key={i} className="border-l-2 border-violet-200 pl-3">
                    <p className="font-semibold">Couche {i + 1} — {l.title}</p>
                    <p className="text-muted-foreground mt-0.5">{l.body}</p>
                  </div>
                ))}
              </div>
            )}
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
