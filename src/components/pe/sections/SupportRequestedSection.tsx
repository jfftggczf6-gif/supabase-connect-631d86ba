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

const HORIZON_STYLE: Record<string, { bg: string; border: string; color: string; label: string }> = {
  H1: { bg: 'var(--pe-bg-danger)',  border: 'var(--pe-danger)',  color: 'var(--pe-danger)',  label: 'Horizon 1 — 100 jours post-closing (structuration — non-négociable)' },
  H2: { bg: 'var(--pe-bg-warning)', border: 'var(--pe-warning)', color: 'var(--pe-warning)', label: 'Horizon 2 — 6 mois post-closing (accélération)' },
  H3: { bg: 'var(--pe-bg-ok)',      border: 'var(--pe-ok)',      color: 'var(--pe-ok)',      label: 'Horizon 3 — 12 mois post-closing (exécution)' },
};

export default function SupportRequestedSection({ section }: Props) {
  const cj = section.content_json ?? {};
  const meta = cj.meta;
  const useOfProceeds = cj.use_of_proceeds_detailed; // [{label, percent, amount, body}]
  const valueCreationPlan = cj.value_creation_plan; // [{horizon: H1|H2|H3, items: [{title, body}], budget_total}]
  const kpisSuivi = cj.kpis_suivi; // { rows: [{kpi, t0, m6, m12, m6_color, m12_color}] }
  const decaissement = cj.decaissement; // string
  const valeurAjoutee = cj.valeur_ajoutee; // string
  const summaryNote = cj.summary_note; // legacy : "85% du ticket orienté CAPEX productif..."
  const legacyUseOfProceeds: any[] = cj.use_of_proceeds ?? [];
  const footer = cj.footer;

  return (
    <Card>
      <CardHeader className="pb-2 space-y-2">
        <CardTitle className="text-base">Accompagnement et value creation</CardTitle>
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
        {/* Use of proceeds détaillé */}
        {useOfProceeds?.length > 0 && (
          <div>
            <SubHeading>Use of proceeds détaillé</SubHeading>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              {useOfProceeds.map((u: any, i: number) => (
                <div key={i} className="rounded p-3" style={{ background: u.highlight ? 'var(--pe-bg-purple)' : 'var(--muted)' }}>
                  <div className="text-base font-medium" style={{ color: u.highlight ? 'var(--pe-purple)' : undefined }}>{u.percent}%</div>
                  <div className="text-xs font-medium mt-0.5" style={{ color: u.highlight ? 'var(--pe-purple)' : undefined }}>{u.label}</div>
                  {u.body && (
                    <div className="text-[10px] mt-1 leading-relaxed" style={{ color: u.highlight ? 'var(--pe-purple)' : 'var(--muted-foreground)' }}>
                      {u.body}
                    </div>
                  )}
                </div>
              ))}
            </div>
            {summaryNote && <p className="text-sm leading-relaxed mt-2">{summaryNote}</p>}
          </div>
        )}

        {/* Use of proceeds legacy fallback */}
        {legacyUseOfProceeds.length > 0 && !useOfProceeds && (
          <div>
            <SubHeading>Use of proceeds</SubHeading>
            <div className="space-y-1 text-sm mb-2">
              {legacyUseOfProceeds.map((u: any, i: number) => (
                <div key={i} className="flex justify-between border-b border-border/30 py-1">
                  <span className="text-muted-foreground">{u.label}</span>
                  <span className="font-medium">{u.percent}%</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Plan value creation 3 horizons */}
        {valueCreationPlan?.length > 0 && (
          <div>
            <SubHeading>Plan de value creation — 3 horizons temporels</SubHeading>
            <div className="space-y-2">
              {valueCreationPlan.map((h: any, i: number) => {
                const s = HORIZON_STYLE[h.horizon] ?? HORIZON_STYLE.H1;
                return (
                  <div key={i} className="rounded p-3" style={{ background: s.bg, borderLeft: `3px solid ${s.border}` }}>
                    <p className="font-medium text-sm" style={{ color: s.color }}>{s.label}</p>
                    {h.items?.length > 0 && (
                      <div className="mt-2 space-y-1.5 text-xs leading-relaxed">
                        {h.items.map((item: any, j: number) => (
                          <p key={j}>
                            <strong>{item.title}</strong>{item.delay && <span> ({item.delay})</span>}
                            {item.body && <> — {item.body}</>}
                          </p>
                        ))}
                      </div>
                    )}
                    {h.budget_note && <p className="text-[10px] mt-2 italic" style={{ color: s.color, opacity: 0.85 }}>{h.budget_note}</p>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* KPIs de suivi trimestriel */}
        {kpisSuivi?.rows?.length > 0 && (
          <div>
            <SubHeading>KPIs de suivi trimestriel</SubHeading>
            <div className="text-sm rounded border bg-muted/30 p-3">
              <div className="grid grid-cols-[2.5fr_1fr_1fr_1fr] border-b text-[10px] text-muted-foreground py-1">
                <span>KPI</span>
                <span className="text-right">Actuel (T0)</span>
                <span className="text-right">Cible M+6</span>
                <span className="text-right">Cible M+12</span>
              </div>
              {kpisSuivi.rows.map((r: any, i: number) => (
                <div key={i} className="grid grid-cols-[2.5fr_1fr_1fr_1fr] py-1 border-b border-border/30 text-xs">
                  <span>{r.kpi}</span>
                  <span className="text-right" style={{ color: r.t0_color === 'danger' ? 'var(--pe-danger)' : r.t0_color === 'warning' ? 'var(--pe-warning)' : undefined }}>{r.t0}</span>
                  <span className="text-right" style={{ color: r.m6_color === 'ok' ? 'var(--pe-ok)' : undefined }}>{r.m6}</span>
                  <span className="text-right font-medium" style={{ color: r.m12_color === 'ok' ? 'var(--pe-ok)' : undefined }}>{r.m12}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Mécanisme décaissement */}
        {decaissement && (
          <div>
            <SubHeading>Mécanisme de décaissement</SubHeading>
            <p className="text-sm leading-relaxed">{decaissement}</p>
          </div>
        )}

        {/* Valeur ajoutée non-financière */}
        {valeurAjoutee && (
          <div>
            <SubHeading>Valeur ajoutée non-financière du fonds</SubHeading>
            <p className="text-sm leading-relaxed">{valeurAjoutee}</p>
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
            Section 10 · Rédigée par {footer.redige_par ?? '—'} {footer.date ? `le ${footer.date}` : ''}
            {footer.sources && <p className="mt-0.5">Sources : {footer.sources}</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
