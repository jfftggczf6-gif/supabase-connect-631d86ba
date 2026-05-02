import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import ReactMarkdown from 'react-markdown';

interface Props {
  section: { content_md: string | null; content_json: any };
  allSections?: Record<string, any>;
}

const SubHeading = ({ children }: { children: React.ReactNode }) => (
  <h4 className="text-xs font-bold uppercase tracking-wide text-foreground mb-2 mt-3">{children}</h4>
);

export default function ServicesSection({ section }: Props) {
  const cj = section.content_json ?? {};
  const meta = cj.meta;
  const nature = cj.nature_activite; // string
  const gammeProduits = cj.gamme_produits; // { rows, formes_galeniques }
  const siteProduction = cj.site_production; // { paragraphs } or string
  const capaciteProduction = cj.capacite_production; // { kpis: [...], paragraphs }
  const distribution = cj.distribution; // { paragraphs }
  const supplyChain = cj.supply_chain; // { paragraphs }
  const moatBpf = cj.moat_bpf; // { intro, layers: [{title, body}] }
  const activiteLegacy = cj.activite; // legacy string
  const footer = cj.footer;

  return (
    <Card>
      <CardHeader className="pb-2 space-y-2">
        <CardTitle className="text-base">Services de l'entreprise et chaîne de valeur</CardTitle>
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
        {(nature || activiteLegacy) && (
          <div>
            <SubHeading>Nature de l'activité</SubHeading>
            <p className="text-sm leading-relaxed">{nature ?? activiteLegacy}</p>
          </div>
        )}

        {gammeProduits?.rows?.length > 0 && (
          <div>
            <SubHeading>Gamme de produits — {gammeProduits.rows.length} familles thérapeutiques</SubHeading>
            <div className="text-sm rounded border bg-muted/30 p-3">
              <div className="grid grid-cols-[2fr_0.8fr_1fr_1fr_2.5fr] border-b text-[10px] text-muted-foreground py-1">
                <span>Famille</span>
                <span className="text-right">% CA</span>
                <span className="text-right">Réf.</span>
                <span className="text-right">Marge</span>
                <span>Molécules / observations</span>
              </div>
              {gammeProduits.rows.map((r: any, i: number) => (
                <div key={i} className="grid grid-cols-[2fr_0.8fr_1fr_1fr_2.5fr] py-1.5 border-b border-border/30 text-xs">
                  <span className="font-medium">{r.famille}</span>
                  <span className="text-right">{r.pct_ca}</span>
                  <span className="text-right">{r.references}</span>
                  <span className="text-right">{r.marge}</span>
                  <span className="text-muted-foreground leading-relaxed">{r.molecules}</span>
                </div>
              ))}
            </div>
            {gammeProduits.formes_galeniques && <p className="text-sm leading-relaxed mt-2">{gammeProduits.formes_galeniques}</p>}
          </div>
        )}

        {siteProduction && (
          <div>
            <SubHeading>Site de production</SubHeading>
            {typeof siteProduction === 'string'
              ? <p className="text-sm leading-relaxed">{siteProduction}</p>
              : (siteProduction.paragraphs ?? []).map((p: string, i: number) => <p key={i} className="text-sm leading-relaxed mb-2">{p}</p>)
            }
          </div>
        )}

        {capaciteProduction && (
          <div>
            <SubHeading>Capacité de production — le levier de croissance clé</SubHeading>
            {capaciteProduction.kpis?.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2">
                {capaciteProduction.kpis.map((k: any, i: number) => (
                  <div key={i} className="rounded p-3 bg-muted">
                    <div className="text-base font-medium">{k.value}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">{k.label}</div>
                  </div>
                ))}
              </div>
            )}
            {(capaciteProduction.paragraphs ?? []).map((p: string, i: number) => <p key={i} className="text-sm leading-relaxed mb-2">{p}</p>)}
          </div>
        )}

        {distribution?.paragraphs?.length > 0 && (
          <div>
            <SubHeading>Distribution — double canal complémentaire</SubHeading>
            <div className="space-y-2 text-sm leading-relaxed">
              {distribution.paragraphs.map((p: string, i: number) => <p key={i}>{p}</p>)}
            </div>
          </div>
        )}

        {supplyChain?.paragraphs?.length > 0 && (
          <div>
            <SubHeading>Chaîne d'approvisionnement</SubHeading>
            <div className="space-y-2 text-sm leading-relaxed">
              {supplyChain.paragraphs.map((p: string, i: number) => <p key={i}>{p}</p>)}
            </div>
          </div>
        )}

        {moatBpf && (
          <div>
            <SubHeading>Avantage compétitif structurel — le moat BPF en 3 couches</SubHeading>
            {moatBpf.intro && <p className="text-sm leading-relaxed mb-2">{moatBpf.intro}</p>}
            {moatBpf.layers?.length > 0 && (
              <div className="space-y-1.5">
                {moatBpf.layers.map((l: any, i: number) => (
                  <div key={i} className="rounded px-3 py-2 text-sm" style={{ background: 'var(--pe-bg-purple)', borderLeft: '3px solid var(--pe-purple)' }}>
                    <strong style={{ color: 'var(--pe-purple)' }}>Couche {i + 1} — {l.title}</strong>
                    <p className="text-xs mt-1 leading-relaxed">{l.body}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {section.content_md && (
          <div className="prose prose-sm max-w-none text-foreground border-t pt-2">
            <ReactMarkdown>{section.content_md}</ReactMarkdown>
          </div>
        )}

        {footer && (
          <div className="rounded px-3 py-2 text-[11px] mt-2" style={{ background: 'var(--pe-bg-info)', color: 'var(--pe-info)' }}>
            Section 4 · Rédigée par {footer.redige_par ?? '—'} {footer.date ? `le ${footer.date}` : ''}
            {footer.sources && <p className="mt-0.5">Sources : {footer.sources}</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
