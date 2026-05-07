import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import ReactMarkdown from 'react-markdown';
import NarrativeBlock from './NarrativeBlock';
import SectionMetadataFooter from './SectionMetadataFooter';

interface Props {
  section: { content_md: string | null; content_json: any };
  allSections?: Record<string, any>;
}

const HORIZON_LABELS: Record<string, string> = {
  H1: 'Horizon 1 — 100 jours post-closing (structuration — non-négociable)',
  H2: 'Horizon 2 — 6 mois post-closing (accélération)',
  H3: 'Horizon 3 — 12 mois post-closing (exécution)',
};

export default function SupportRequestedSection({ section }: Props) {
  const cj = section.content_json ?? {};
  const meta = cj.meta;
  const useOfProceeds = cj.use_of_proceeds_detailed;
  const valueCreationPlan = cj.value_creation_plan;
  const kpisSuivi = cj.kpis_suivi;
  const decaissement = cj.decaissement;
  const valeurAjoutee = cj.valeur_ajoutee;
  const summaryNote = cj.summary_note;
  const legacyUseOfProceeds: any[] = cj.use_of_proceeds ?? [];
  const footer = cj.footer;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Accompagnement et value creation</CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {useOfProceeds?.length > 0 && (
          <NarrativeBlock title="Utilisation des fonds détaillée">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              {useOfProceeds.map((u: any, i: number) => (
                <div key={i} className="rounded p-3 bg-background border flex flex-col gap-1">
                  <div className="text-2xl font-semibold tabular-nums">{u.percent}%</div>
                  <div className="text-sm font-medium">{u.label}</div>
                  {u.body && <div className="text-xs text-muted-foreground leading-relaxed">{u.body}</div>}
                </div>
              ))}
            </div>
            {summaryNote && <p className="mt-3 pt-2 border-t border-dashed border-border">{summaryNote}</p>}
          </NarrativeBlock>
        )}

        {legacyUseOfProceeds.length > 0 && !useOfProceeds && (
          <NarrativeBlock title="Utilisation des fonds">
            <div className="space-y-1">
              {legacyUseOfProceeds.map((u: any, i: number) => (
                <div key={i} className="flex justify-between border-b border-border/30 py-1">
                  <span className="text-muted-foreground">{u.label}</span>
                  <span className="font-medium">{u.percent}%</span>
                </div>
              ))}
            </div>
          </NarrativeBlock>
        )}

        {valueCreationPlan?.length > 0 && (
          <NarrativeBlock title="Plan de value creation — 3 horizons temporels">
            <div className="space-y-3">
              {valueCreationPlan.map((h: any, i: number) => (
                <div key={i} className="border-l-2 border-violet-200 pl-3">
                  <p className="font-semibold">{HORIZON_LABELS[h.horizon] ?? h.horizon}</p>
                  {h.items?.length > 0 && (
                    <div className="mt-2 space-y-1.5">
                      {h.items.map((item: any, j: number) => (
                        <p key={j}>
                          <strong>{item.title}</strong>{item.delay && <span className="text-muted-foreground"> ({item.delay})</span>}
                          {item.body && <> — {item.body}</>}
                        </p>
                      ))}
                    </div>
                  )}
                  {h.budget_note && <p className="text-[11px] mt-2 italic text-muted-foreground">{h.budget_note}</p>}
                </div>
              ))}
            </div>
          </NarrativeBlock>
        )}

        {kpisSuivi?.rows?.length > 0 && (
          <NarrativeBlock title="KPIs de suivi trimestriel">
            <div className="grid grid-cols-[2.5fr_1fr_1fr_1fr] border-b text-[10px] text-muted-foreground py-1">
              <span>KPI</span>
              <span className="text-right">Actuel (T0)</span>
              <span className="text-right">Cible M+6</span>
              <span className="text-right">Cible M+12</span>
            </div>
            {kpisSuivi.rows.map((r: any, i: number) => (
              <div key={i} className="grid grid-cols-[2.5fr_1fr_1fr_1fr] py-1 border-b border-border/30 text-xs">
                <span>{r.kpi}</span>
                <span className="text-right">{r.t0}</span>
                <span className="text-right">{r.m6}</span>
                <span className="text-right font-medium">{r.m12}</span>
              </div>
            ))}
          </NarrativeBlock>
        )}

        {decaissement && (
          <NarrativeBlock title="Mécanisme de décaissement">
            <p>{decaissement}</p>
          </NarrativeBlock>
        )}

        {valeurAjoutee && (
          <NarrativeBlock title="Valeur ajoutée non-financière du fonds">
            <p>{valeurAjoutee}</p>
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
