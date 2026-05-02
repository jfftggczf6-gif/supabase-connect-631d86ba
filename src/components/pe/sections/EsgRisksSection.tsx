import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import ReactMarkdown from 'react-markdown';
import { CheckCircle2, XCircle } from 'lucide-react';
import RedFlagItem from '@/components/dashboard/viewers/atoms/pe/RedFlagItem';

interface Props {
  section: { content_md: string | null; content_json: any };
  allSections?: Record<string, any>;
}

const SubHeading = ({ children, color }: { children: React.ReactNode; color?: string }) => (
  <h4 className="text-xs font-bold uppercase tracking-wide text-foreground mb-2 mt-3" style={color ? { color } : undefined}>
    {children}
  </h4>
);

const sevToRedFlag: Record<string, 'high' | 'medium' | 'low'> = {
  Critical: 'high', High: 'high', Medium: 'medium', Low: 'low',
  high: 'high', medium: 'medium', low: 'low',
};

const STATUS_COLOR: Record<string, string> = {
  ok: 'var(--pe-ok)',
  warning: 'var(--pe-warning)',
  danger: 'var(--pe-danger)',
  partial: 'var(--pe-warning)',
  ACTIF: 'var(--pe-danger)',
  Monitorer: 'var(--pe-warning)',
  'Non détecté': 'var(--pe-ok)',
  'Détecté partiel': 'var(--pe-warning)',
};

const StatusIcon = ({ status }: { status: string }) => {
  const s = status.toLowerCase();
  if (s.includes('ok') || s.includes('oui') || s === 'conforme' || s === 'direct' || s === 'non détecté') {
    return <CheckCircle2 className="h-3.5 w-3.5 inline" style={{ color: 'var(--pe-ok)' }} />;
  }
  if (s === 'no' || s === 'non' || s.includes('non conforme') || s === 'actif') {
    return <XCircle className="h-3.5 w-3.5 inline" style={{ color: 'var(--pe-danger)' }} />;
  }
  return null;
};

export default function EsgRisksSection({ section }: Props) {
  const cj = section.content_json ?? {};
  const meta = cj.meta;
  const odd = cj.odd_kpis; // [{label, value, hint, color}]
  const oddDetails = cj.odd_details; // { odd3, odd8, odd9 paragraphs }
  const irisPlus = cj.iris_plus; // { rows: [...] }
  const twoXCriteria = cj.two_x_criteria; // { rows, conclusion }
  const ifcPS = cj.ifc_ps; // { intro, rows, synthesis }
  const dfiAttractivite = cj.dfi_attractivite; // { intro, dfis: [...] }
  const risksMatrix = cj.risks_matrix; // { rows: [...] }
  const redFlagsSyscohada = cj.red_flags_syscohada; // { rows, score_brut, score_net, threshold }
  const redFlagsLegacy: any[] = cj.red_flags ?? []; // backward compat
  const footer = cj.footer;

  return (
    <Card>
      <CardHeader className="pb-2 space-y-2">
        <CardTitle className="text-base" style={{ color: redFlagsLegacy.length || redFlagsSyscohada ? 'var(--pe-danger)' : undefined }}>
          ESG, impact et risques
        </CardTitle>
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
        {/* Impact et alignement ODD */}
        {odd?.length > 0 && (
          <div>
            <SubHeading>Impact et alignement ODD — un deal à impact mesurable</SubHeading>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {odd.map((k: any, i: number) => {
                const bg = k.color === 'ok' ? 'var(--pe-bg-ok)' : k.color === 'warning' ? 'var(--pe-bg-warning)' : 'var(--muted)';
                const fg = k.color === 'ok' ? 'var(--pe-ok)' : k.color === 'warning' ? 'var(--pe-warning)' : undefined;
                return (
                  <div key={i} className="rounded p-3" style={{ background: bg }}>
                    <div className="text-[9px]" style={{ color: fg ?? 'var(--muted-foreground)' }}>{k.label}</div>
                    <div className="text-base font-medium" style={{ color: fg }}>{k.value}</div>
                    {k.hint && <div className="text-[9px] mt-0.5" style={{ color: fg ?? 'var(--muted-foreground)' }}>{k.hint}</div>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Détails ODD3/8/9 */}
        {oddDetails && (
          <div className="space-y-2 text-sm leading-relaxed">
            {oddDetails.odd3 && <p>{oddDetails.odd3}</p>}
            {oddDetails.odd8 && <p>{oddDetails.odd8}</p>}
            {oddDetails.odd9 && <p>{oddDetails.odd9}</p>}
          </div>
        )}

        {/* IRIS+ */}
        {irisPlus?.rows?.length > 0 && (
          <div>
            <SubHeading>Indicateurs d'impact IRIS+ — cadre de mesure proposé</SubHeading>
            <div className="text-sm rounded border bg-muted/30 p-3">
              <div className="grid grid-cols-[2.5fr_1fr_1fr_2fr] border-b text-[10px] text-muted-foreground py-1">
                <span>Indicateur IRIS+</span>
                <span className="text-right">Actuel</span>
                <span className="text-right">Cible M+24</span>
                <span>Méthode</span>
              </div>
              {irisPlus.rows.map((r: any, i: number) => (
                <div key={i} className="grid grid-cols-[2.5fr_1fr_1fr_2fr] py-1 border-b border-border/30 text-xs">
                  <span>{r.indicator}</span>
                  <span className="text-right" style={{ color: r.actuel_color ? STATUS_COLOR[r.actuel_color] : undefined }}>{r.actuel}</span>
                  <span className="text-right" style={{ color: 'var(--pe-ok)' }}>{r.cible}</span>
                  <span className="text-muted-foreground">{r.method}</span>
                </div>
              ))}
            </div>
            {irisPlus.note && <p className="text-xs text-muted-foreground mt-2">{irisPlus.note}</p>}
          </div>
        )}

        {/* 2X Criteria */}
        {twoXCriteria && (
          <div>
            <SubHeading>Éligibilité 2X Criteria IFC — analyse détaillée</SubHeading>
            {twoXCriteria.intro && <p className="text-sm leading-relaxed mb-2">{twoXCriteria.intro}</p>}
            {twoXCriteria.rows?.length > 0 && (
              <div className="text-sm rounded border bg-muted/30 p-3">
                <div className="grid grid-cols-[2fr_1fr_1fr_2.5fr] border-b text-[10px] text-muted-foreground py-1">
                  <span>Critère 2X</span>
                  <span className="text-center">Actuel</span>
                  <span className="text-center">Post-invest.</span>
                  <span>Analyse</span>
                </div>
                {twoXCriteria.rows.map((r: any, i: number) => (
                  <div key={i} className="grid grid-cols-[2fr_1fr_1fr_2.5fr] py-1 border-b border-border/30 text-xs">
                    <span>{r.criterion}</span>
                    <span className="text-center" style={{ color: STATUS_COLOR[r.actuel_status] }}>{r.actuel}</span>
                    <span className="text-center" style={{ color: STATUS_COLOR[r.post_status] }}>{r.post}</span>
                    <span className="text-muted-foreground">{r.analyse}</span>
                  </div>
                ))}
              </div>
            )}
            {twoXCriteria.conclusion && <p className="text-sm leading-relaxed mt-2"><strong>Conclusion 2X :</strong> {twoXCriteria.conclusion}</p>}
          </div>
        )}

        {/* IFC Performance Standards */}
        {ifcPS && (
          <div>
            <SubHeading>Conformité IFC Performance Standards — évaluation préliminaire</SubHeading>
            {ifcPS.intro && <p className="text-sm leading-relaxed mb-2">{ifcPS.intro}</p>}
            {ifcPS.rows?.length > 0 && (
              <div className="text-sm rounded border bg-muted/30 p-3">
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
                    <span className="text-center" style={{ color: STATUS_COLOR[r.conformite_color] }}>
                      {r.conformite}
                    </span>
                    <span className="text-muted-foreground">{r.analyse}</span>
                  </div>
                ))}
              </div>
            )}
            {ifcPS.synthesis && <p className="text-sm leading-relaxed mt-2"><strong>Synthèse IFC PS :</strong> {ifcPS.synthesis}</p>}
          </div>
        )}

        {/* Attractivité DFI */}
        {dfiAttractivite && (
          <div>
            <SubHeading>Attractivité DFI — co-investisseurs institutionnels</SubHeading>
            {dfiAttractivite.intro && <p className="text-sm leading-relaxed mb-2">{dfiAttractivite.intro}</p>}
            {dfiAttractivite.dfis?.length > 0 && (
              <div className="text-sm rounded border bg-muted/30 p-3">
                <div className="grid grid-cols-[1.5fr_1fr_1fr_2.5fr] border-b text-[10px] text-muted-foreground py-1">
                  <span>DFI</span>
                  <span className="text-right">Ticket cible</span>
                  <span className="text-right">Instrument</span>
                  <span>Adéquation</span>
                </div>
                {dfiAttractivite.dfis.map((d: any, i: number) => (
                  <div key={i} className="grid grid-cols-[1.5fr_1fr_1fr_2.5fr] py-1 border-b border-border/30 text-xs">
                    <span className="font-medium">{d.name}</span>
                    <span className="text-right">{d.ticket}</span>
                    <span className="text-right">{d.instrument}</span>
                    <span className="text-muted-foreground">{d.note}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Matrice des risques */}
        {risksMatrix?.rows?.length > 0 && (
          <div>
            <SubHeading>Matrice des risques — analyse complète</SubHeading>
            <div className="text-sm rounded border bg-muted/30 p-3">
              <div className="grid grid-cols-[2.5fr_0.7fr_0.7fr_3fr] border-b text-[10px] text-muted-foreground py-1">
                <span>Risque identifié</span>
                <span className="text-center">Prob.</span>
                <span className="text-center">Impact</span>
                <span>Mitigation</span>
              </div>
              {risksMatrix.rows.map((r: any, i: number) => (
                <div key={i} className="grid grid-cols-[2.5fr_0.7fr_0.7fr_3fr] py-1 border-b border-border/30 text-xs">
                  <span style={{ color: r.title_color ? STATUS_COLOR[r.title_color] : undefined, fontWeight: r.title_color ? 500 : undefined }}>
                    {r.title}
                  </span>
                  <span className="text-center" style={{ color: STATUS_COLOR[r.prob_color] }}>{r.prob}</span>
                  <span className="text-center" style={{ color: STATUS_COLOR[r.impact_color] }}>{r.impact}</span>
                  <span className="text-muted-foreground">{r.mitigation}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Récap 12 red flags SYSCOHADA */}
        {redFlagsSyscohada?.rows?.length > 0 && (
          <div>
            <SubHeading>Récapitulatif des 12 red flags SYSCOHADA — scoring</SubHeading>
            <div className="text-sm rounded border bg-muted/30 p-3">
              <div className="grid grid-cols-[3fr_1fr_1fr_1fr] border-b text-[10px] text-muted-foreground py-1">
                <span>Facteur</span>
                <span className="text-center">Statut</span>
                <span className="text-center">Sévérité</span>
                <span className="text-center">Pénalité</span>
              </div>
              {redFlagsSyscohada.rows.map((r: any, i: number) => (
                <div
                  key={i}
                  className="grid grid-cols-[3fr_1fr_1fr_1fr] py-1 border-b border-border/30 text-xs"
                  style={{ color: r.color ? STATUS_COLOR[r.color] : undefined, fontWeight: r.bold ? 500 : undefined }}
                >
                  <span>{r.factor}</span>
                  <span className="text-center">{r.status}</span>
                  <span className="text-center">{r.severity}</span>
                  <span className="text-center">{r.penalty}</span>
                </div>
              ))}
              <div className="grid grid-cols-[3fr_1fr_1fr_1fr] pt-2 border-t font-medium">
                <span>Score avant pénalités</span>
                <span></span>
                <span></span>
                <span className="text-center">{redFlagsSyscohada.score_brut}/100</span>
              </div>
              <div className="grid grid-cols-[3fr_1fr_1fr_1fr] py-1 font-medium" style={{ color: 'var(--pe-purple)' }}>
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
                  <span className="text-center" style={{ color: 'var(--pe-ok)' }}>{redFlagsSyscohada.threshold}/100 ✓</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Legacy red_flags fallback */}
        {redFlagsLegacy.length > 0 && !redFlagsSyscohada && (
          <div>
            <SubHeading color="var(--pe-danger)">Red flags identifiés</SubHeading>
            <div className="space-y-1.5">
              {redFlagsLegacy.map((rf: any, i: number) => (
                <RedFlagItem
                  key={i}
                  title={rf.title}
                  severity={sevToRedFlag[rf.severity] ?? 'medium'}
                  detail={rf.detail ?? rf.body ?? ''}
                />
              ))}
            </div>
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
            Section 11 · Rédigée par {footer.redige_par ?? '—'} {footer.date ? `le ${footer.date}` : ''}
            {footer.review_par && ` · Validée IM (${footer.review_par}${footer.review_date ? `, ${footer.review_date}` : ''})`}
            {footer.valide_par && ` · Validée MD (${footer.valide_par}${footer.valide_date ? `, ${footer.valide_date}` : ''})`}
            {footer.sources && <p className="mt-0.5">Sources : {footer.sources}</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
