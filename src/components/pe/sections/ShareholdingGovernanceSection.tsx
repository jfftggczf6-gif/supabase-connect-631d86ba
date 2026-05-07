import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import ReactMarkdown from 'react-markdown';
import NarrativeBlock from './NarrativeBlock';
import SectionMetadataFooter from './SectionMetadataFooter';

interface Props {
  section: { content_md: string | null; content_json: any };
  allSections?: Record<string, any>;
}

export default function ShareholdingGovernanceSection({ section }: Props) {
  const cj = section.content_json ?? {};
  const meta = cj.meta;
  const capTable = cj.cap_table;
  const governance = cj.governance;
  const conventions: any[] = cj.conventions ?? [];
  const redFlags: any[] = cj.red_flags ?? [];
  const structurationPlan = cj.structuration_plan;
  const items: any[] = cj.actionnariat?.items ?? [];
  const footer = cj.footer;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Actionnariat et gouvernance</CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {capTable?.rows?.length > 0 && (
          <NarrativeBlock title="Table de capitalisation">
            <div className="space-y-3">
              {capTable.rows.map((r: any, i: number) => (
                <div key={i} className="border-b border-border/40 pb-2 last:border-b-0 last:pb-0">
                  <div className="flex items-baseline justify-between gap-3 flex-wrap">
                    <p className="font-medium">{r.actionnaire}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.percent}%
                      {r.type && <> · {r.type}</>}
                      {r.entree && <> · entré en {r.entree}</>}
                    </p>
                  </div>
                  {r.role && (
                    <p className="text-muted-foreground mt-1">{r.role}</p>
                  )}
                </div>
              ))}
            </div>
            {capTable.notes?.length > 0 && (
              <div className="space-y-2 mt-3 pt-2 border-t border-dashed border-border">
                {capTable.notes.map((n: string, i: number) => <p key={i}>{n}</p>)}
              </div>
            )}
          </NarrativeBlock>
        )}

        {items.length > 0 && !capTable && (
          <NarrativeBlock title="Actionnariat">
            <div className="space-y-1">
              {items.map((it: any, i: number) => (
                <div key={i} className="flex justify-between border-b border-border/50 py-1">
                  <div>
                    <span className="font-medium">{it.label}</span>
                    {it.subtitle && <span className="text-xs text-muted-foreground ml-2">{it.subtitle}</span>}
                  </div>
                  {it.percent != null && <span className="font-medium">{it.percent}%</span>}
                </div>
              ))}
            </div>
          </NarrativeBlock>
        )}

        {governance && (
          <NarrativeBlock title="Organes de gouvernance — état actuel">
            <div className="space-y-2">
              {governance.ca && <p><strong>Conseil d'administration :</strong> {governance.ca}</p>}
              {governance.ag && <p><strong>Assemblées générales :</strong> {governance.ag}</p>}
              {governance.cac && <p><strong>Commissaire aux comptes :</strong> {governance.cac}</p>}
              {governance.controle_interne && <p><strong>Contrôle interne :</strong> {governance.controle_interne}</p>}
            </div>
          </NarrativeBlock>
        )}

        {conventions.length > 0 && (
          <NarrativeBlock title="Conventions réglementées identifiées">
            <div className="space-y-3">
              {conventions.map((c: any, i: number) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-red-500 font-bold mt-0.5 shrink-0">✕</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{c.title}</p>
                    {(c.body || c.detail) && (
                      <p className="text-muted-foreground mt-0.5">{c.body ?? c.detail}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </NarrativeBlock>
        )}

        {redFlags.length > 0 && (
          <NarrativeBlock title="Red flags gouvernance détectés">
            <div className="space-y-3">
              {redFlags.map((rf: any, i: number) => (
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

        {structurationPlan?.items?.length > 0 && (
          <NarrativeBlock title="Plan de structuration post-investissement — convenu avec le fondateur">
            {structurationPlan.intro && <p className="mb-2">{structurationPlan.intro}</p>}
            <ol className="list-decimal list-inside space-y-1">
              {structurationPlan.items.map((it: any, i: number) => (
                <li key={i}>
                  {typeof it === 'string'
                    ? it
                    : <><strong>{it.title}</strong>{it.body ? ` — ${it.body}` : ''}</>}
                </li>
              ))}
            </ol>
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
