import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import ReactMarkdown from 'react-markdown';
import NarrativeBlock from './NarrativeBlock';
import SectionMetadataFooter from './SectionMetadataFooter';

interface Props {
  section: { content_md: string | null; content_json: any };
  allSections?: Record<string, any>;
}

export default function EsgRisksSection({ section }: Props) {
  const cj = section.content_json ?? {};
  const meta = cj.meta;
  const odd = cj.odd_kpis;
  const oddDetails = cj.odd_details;
  const irisPlus = cj.iris_plus;
  const twoXCriteria = cj.two_x_criteria;
  const ifcPS = cj.ifc_ps;
  const dfiAttractivite = cj.dfi_attractivite;
  const risksMatrix = cj.risks_matrix;
  const redFlagsSyscohada = cj.red_flags_syscohada;
  const redFlagsLegacy: any[] = cj.red_flags ?? [];
  const footer = cj.footer;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">ESG, impact et risques</CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {(odd?.length > 0 || oddDetails) && (
          <NarrativeBlock title="Impact et alignement ODD">
            {odd?.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {odd.map((k: any, i: number) => (
                  <div key={i} className="rounded p-3 bg-background border border-border/60 flex flex-col gap-1">
                    <div className="text-[10px] text-muted-foreground">{k.label}</div>
                    <div className="text-base font-medium">{k.value}</div>
                    {k.hint && <div className="text-[11px] text-muted-foreground leading-snug">{k.hint}</div>}
                  </div>
                ))}
              </div>
            )}
            {oddDetails && (
              <div className="space-y-2 mt-3">
                {oddDetails.odd3 && <p>{oddDetails.odd3}</p>}
                {oddDetails.odd8 && <p>{oddDetails.odd8}</p>}
                {oddDetails.odd9 && <p>{oddDetails.odd9}</p>}
              </div>
            )}
          </NarrativeBlock>
        )}

        {irisPlus?.rows?.length > 0 && (
          <NarrativeBlock title="Indicateurs d'impact IRIS+">
            <div className="space-y-3">
              {irisPlus.rows.map((r: any, i: number) => (
                <div key={i} className="rounded-md bg-background border border-border/60 p-3">
                  <p className="font-semibold mb-2">{r.indicator}</p>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <div className="rounded bg-muted/50 px-2 py-1.5">
                      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Actuel</div>
                      <div className="text-sm font-semibold tabular-nums">{r.actuel ?? '—'}</div>
                    </div>
                    <div className="rounded bg-muted/50 px-2 py-1.5">
                      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Cible M+24</div>
                      <div className="text-sm font-semibold tabular-nums">{r.cible ?? '—'}</div>
                    </div>
                  </div>
                  {r.method && (
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      <span className="text-[10px] uppercase tracking-wider mr-1">Méthode :</span>
                      {r.method}
                    </p>
                  )}
                </div>
              ))}
            </div>
            {irisPlus.note && <p className="text-xs text-muted-foreground mt-3 pt-2 border-t border-dashed border-border">{irisPlus.note}</p>}
          </NarrativeBlock>
        )}

        {twoXCriteria && (
          <NarrativeBlock title="Éligibilité 2X Criteria IFC">
            {twoXCriteria.intro && <p className="mb-2">{twoXCriteria.intro}</p>}
            {twoXCriteria.rows?.length > 0 && (
              <>
                <div className="grid grid-cols-[2fr_1fr_1fr_2.5fr] border-b text-[10px] text-muted-foreground py-1">
                  <span>Critère 2X</span>
                  <span className="text-center">Actuel</span>
                  <span className="text-center">Post-invest.</span>
                  <span>Analyse</span>
                </div>
                {twoXCriteria.rows.map((r: any, i: number) => (
                  <div key={i} className="grid grid-cols-[2fr_1fr_1fr_2.5fr] py-1 border-b border-border/30 text-xs">
                    <span>{r.criterion}</span>
                    <span className="text-center">{r.actuel}</span>
                    <span className="text-center">{r.post}</span>
                    <span className="text-muted-foreground">{r.analyse}</span>
                  </div>
                ))}
              </>
            )}
            {twoXCriteria.conclusion && <p className="mt-2"><strong>Conclusion 2X :</strong> {twoXCriteria.conclusion}</p>}
          </NarrativeBlock>
        )}

        {ifcPS && (
          <NarrativeBlock title="Conformité IFC Performance Standards">
            {ifcPS.intro && <p className="mb-2">{ifcPS.intro}</p>}
            {ifcPS.rows?.length > 0 && (
              <>
                <div className="grid grid-cols-[0.5fr_2fr_1fr_3fr] border-b text-[10px] text-muted-foreground py-1">
                  <span>PS</span>
                  <span>Performance Standard</span>
                  <span className="text-center">Conformité</span>
                  <span>Analyse</span>
                </div>
                {ifcPS.rows.map((r: any, i: number) => (
                  <div key={i} className="grid grid-cols-[0.5fr_2fr_1fr_3fr] py-1 border-b border-border/30 text-xs">
                    <span className="font-medium">{r.ps}</span>
                    <span>{r.standard}</span>
                    <span className="text-center">{r.conformite}</span>
                    <span className="text-muted-foreground">{r.analyse}</span>
                  </div>
                ))}
              </>
            )}
            {ifcPS.synthesis && <p className="mt-2"><strong>Synthèse IFC PS :</strong> {ifcPS.synthesis}</p>}
          </NarrativeBlock>
        )}

        {dfiAttractivite && (
          <NarrativeBlock title="Attractivité DFI — co-investisseurs institutionnels">
            {dfiAttractivite.intro && <p className="mb-3">{dfiAttractivite.intro}</p>}
            {dfiAttractivite.dfis?.length > 0 && (
              <div className="space-y-3">
                {dfiAttractivite.dfis.map((d: any, i: number) => (
                  <div key={i} className="rounded-md bg-background border border-border/60 p-3">
                    <p className="font-semibold mb-2">{d.name}</p>
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <div className="rounded bg-muted/50 px-2 py-1.5">
                        <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Ticket cible</div>
                        <div className="text-sm font-semibold tabular-nums">{d.ticket ?? '—'}</div>
                      </div>
                      <div className="rounded bg-muted/50 px-2 py-1.5">
                        <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Instrument</div>
                        <div className="text-sm font-semibold">{d.instrument ?? '—'}</div>
                      </div>
                    </div>
                    {d.note && (
                      <p className="text-muted-foreground text-sm leading-relaxed">
                        <span className="text-[10px] uppercase tracking-wider mr-1">Adéquation :</span>
                        {d.note}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </NarrativeBlock>
        )}

        {risksMatrix?.rows?.length > 0 && (
          <NarrativeBlock title="Matrice des risques">
            <div className="grid grid-cols-[2.5fr_0.7fr_0.7fr_3fr] border-b text-[10px] text-muted-foreground py-1">
              <span>Risque identifié</span>
              <span className="text-center">Prob.</span>
              <span className="text-center">Impact</span>
              <span>Mitigation</span>
            </div>
            {risksMatrix.rows.map((r: any, i: number) => (
              <div key={i} className="grid grid-cols-[2.5fr_0.7fr_0.7fr_3fr] py-1 border-b border-border/30 text-xs"
                style={{ fontWeight: r.title_color ? 500 : undefined }}>
                <span>{r.title}</span>
                <span className="text-center">{r.prob}</span>
                <span className="text-center">{r.impact}</span>
                <span className="text-muted-foreground">{r.mitigation}</span>
              </div>
            ))}
          </NarrativeBlock>
        )}

        {redFlagsSyscohada?.rows?.length > 0 && (
          <NarrativeBlock title="Récapitulatif des red flags SYSCOHADA — scoring">
            <div className="grid grid-cols-[3fr_1fr_1fr_1fr] border-b text-[10px] text-muted-foreground py-1">
              <span>Facteur</span>
              <span className="text-center">Statut</span>
              <span className="text-center">Sévérité</span>
              <span className="text-center">Pénalité</span>
            </div>
            {redFlagsSyscohada.rows.map((r: any, i: number) => (
              <div key={i} className="grid grid-cols-[3fr_1fr_1fr_1fr] py-1 border-b border-border/30 text-xs"
                style={{ fontWeight: r.bold ? 500 : undefined }}>
                <span>{r.factor}</span>
                <span className="text-center">{r.status}</span>
                <span className="text-center">{r.severity}</span>
                <span className="text-center">{r.penalty}</span>
              </div>
            ))}
            <div className="grid grid-cols-[3fr_1fr_1fr_1fr] pt-2 mt-1 border-t font-medium">
              <span>Score avant pénalités</span>
              <span></span>
              <span></span>
              <span className="text-center">{redFlagsSyscohada.score_brut}/100</span>
            </div>
            <div className="grid grid-cols-[3fr_1fr_1fr_1fr] py-1 font-medium">
              <span>Score après pénalités</span>
              <span></span>
              <span></span>
              <span className="text-center text-base">{redFlagsSyscohada.score_net}/100</span>
            </div>
            {redFlagsSyscohada.threshold != null && (
              <div className="grid grid-cols-[3fr_1fr_1fr_1fr] text-xs text-muted-foreground">
                <span>Seuil de passage mid-market</span>
                <span></span>
                <span></span>
                <span className="text-center">{redFlagsSyscohada.threshold}/100</span>
              </div>
            )}
          </NarrativeBlock>
        )}

        {redFlagsLegacy.length > 0 && !redFlagsSyscohada && (
          <NarrativeBlock title="Red flags identifiés">
            <div className="space-y-3">
              {redFlagsLegacy.map((rf: any, i: number) => (
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
