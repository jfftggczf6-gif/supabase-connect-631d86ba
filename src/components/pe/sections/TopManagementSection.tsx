import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import ReactMarkdown from 'react-markdown';
import NarrativeBlock from './NarrativeBlock';
import SectionMetadataFooter from './SectionMetadataFooter';

interface Props {
  section: { content_md: string | null; content_json: any };
  allSections?: Record<string, any>;
}

export default function TopManagementSection({ section }: Props) {
  const cj = section.content_json ?? {};
  const meta = cj.meta;
  const equipe = cj.equipe_dirigeante;
  const postesVacants: any[] = cj.postes_vacants ?? [];
  const capaciteAbsorption = cj.capacite_absorption;
  const redFlags: any[] = cj.red_flags ?? [];
  const legacyManagement: any[] = cj.management?.items ?? [];
  const footer = cj.footer;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Organisation interne et top management</CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {equipe?.rows?.length > 0 && (
          <NarrativeBlock title="Équipe dirigeante — profils et évaluation">
            <div className="space-y-3">
              {equipe.rows.map((p: any, i: number) => (
                <div key={i} className="border-b border-border/40 pb-2 last:border-b-0 last:pb-0">
                  <div className="flex items-baseline justify-between gap-3 flex-wrap">
                    <p className="font-medium">
                      {p.name}
                      {p.poste && <span className="text-muted-foreground font-normal"> — {p.poste}</span>}
                    </p>
                    {p.exp && (
                      <p className="text-xs text-muted-foreground">{p.exp}</p>
                    )}
                  </div>
                  {p.profil_eval && (
                    <p className="text-muted-foreground mt-1">{p.profil_eval}</p>
                  )}
                </div>
              ))}
            </div>
            {equipe.synthesis && <p className="mt-3 pt-2 border-t border-dashed border-border">{equipe.synthesis}</p>}
          </NarrativeBlock>
        )}

        {legacyManagement.length > 0 && !equipe && (
          <NarrativeBlock title="Top management">
            <div className="space-y-2">
              {legacyManagement.map((m: any, i: number) => (
                <div key={i} className="border-b border-border/50 py-1.5">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{m.name}</span>
                    <span className="text-xs text-muted-foreground">— {m.role}</span>
                  </div>
                  {m.note && <p className="text-xs text-muted-foreground mt-0.5">{m.note}</p>}
                </div>
              ))}
            </div>
          </NarrativeBlock>
        )}

        {postesVacants.length > 0 && (
          <NarrativeBlock title="Postes clés vacants — plan de recrutement budgété">
            <div className="space-y-3">
              {postesVacants.map((p: any, i: number) => (
                <div key={i} className="border-l-2 border-violet-200 pl-3">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-medium">{p.title}</span>
                    {p.priority && (
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Priorité {p.priority}
                      </span>
                    )}
                    {p.delay && <span className="text-[11px] text-muted-foreground">{p.delay}</span>}
                  </div>
                  <p className="text-muted-foreground">{p.body}</p>
                  {p.budget && <p className="text-[11px] mt-1"><strong>Budget :</strong> {p.budget}</p>}
                </div>
              ))}
            </div>
          </NarrativeBlock>
        )}

        {capaciteAbsorption && (
          <NarrativeBlock title="Capacité d'absorption de la croissance">
            {capaciteAbsorption.evaluation && (
              <p className="font-medium mb-2">{capaciteAbsorption.evaluation}</p>
            )}
            {capaciteAbsorption.paragraphs?.length > 0 && (
              <div className="space-y-2">
                {capaciteAbsorption.paragraphs.map((p: string, i: number) => <p key={i}>{p}</p>)}
              </div>
            )}
          </NarrativeBlock>
        )}

        {redFlags.length > 0 && (
          <NarrativeBlock title="Red flags identifiés">
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
