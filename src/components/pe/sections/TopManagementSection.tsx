import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import ReactMarkdown from 'react-markdown';
import RedFlagItem from '@/components/dashboard/viewers/atoms/pe/RedFlagItem';

interface Props {
  section: { content_md: string | null; content_json: any };
  allSections?: Record<string, any>;
}

const SubHeading = ({ children }: { children: React.ReactNode }) => (
  <h4 className="text-xs font-bold uppercase tracking-wide text-foreground mb-2 mt-3">{children}</h4>
);

const sevToRedFlag: Record<string, 'high' | 'medium' | 'low'> = {
  Critical: 'high', High: 'high', Medium: 'medium', Low: 'low',
  high: 'high', medium: 'medium', low: 'low',
};

const PRIORITY_COLOR: Record<string, string> = {
  '1': 'var(--pe-danger)',
  '2': 'var(--pe-warning)',
  '3': 'var(--pe-info)',
};

export default function TopManagementSection({ section }: Props) {
  const cj = section.content_json ?? {};
  const meta = cj.meta;
  const equipe = cj.equipe_dirigeante; // { rows: [{name, poste, exp, profil_eval}], synthesis }
  const postesVacants: any[] = cj.postes_vacants ?? []; // [{title, priority, body}]
  const capaciteAbsorption = cj.capacite_absorption; // { evaluation, paragraphs }
  const redFlags: any[] = cj.red_flags ?? [];
  const legacyManagement: any[] = cj.management?.items ?? [];
  const footer = cj.footer;

  return (
    <Card>
      <CardHeader className="pb-2 space-y-2">
        <CardTitle className="text-base">Organisation interne et top management</CardTitle>
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
        {/* Équipe dirigeante */}
        {equipe?.rows?.length > 0 && (
          <div>
            <SubHeading>Équipe dirigeante — profils et évaluation</SubHeading>
            <div className="text-sm rounded border bg-muted/30 p-3">
              <div className="grid grid-cols-[1.2fr_1fr_0.4fr_3fr] border-b text-[10px] text-muted-foreground py-1">
                <span>Nom</span>
                <span>Poste</span>
                <span className="text-right">Exp.</span>
                <span>Parcours et évaluation analyste</span>
              </div>
              {equipe.rows.map((p: any, i: number) => (
                <div key={i} className="grid grid-cols-[1.2fr_1fr_0.4fr_3fr] py-1.5 border-b border-border/30 text-xs">
                  <span className="font-medium">{p.name}</span>
                  <span>{p.poste}</span>
                  <span className="text-right text-muted-foreground">{p.exp}</span>
                  <span className="text-muted-foreground leading-relaxed">{p.profil_eval}</span>
                </div>
              ))}
            </div>
            {equipe.synthesis && <p className="text-sm leading-relaxed mt-2">{equipe.synthesis}</p>}
          </div>
        )}

        {/* Compat legacy management.items */}
        {legacyManagement.length > 0 && !equipe && (
          <div>
            <SubHeading>Top management</SubHeading>
            <div className="space-y-2">
              {legacyManagement.map((m: any, i: number) => (
                <div key={i} className="text-sm border-b border-border/50 py-1.5">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{m.name}</span>
                    <span className="text-xs text-muted-foreground">— {m.role}</span>
                  </div>
                  {m.note && <p className="text-xs text-muted-foreground mt-0.5">{m.note}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Postes vacants */}
        {postesVacants.length > 0 && (
          <div>
            <SubHeading>Postes clés vacants — plan de recrutement budgété</SubHeading>
            <div className="space-y-3">
              {postesVacants.map((p: any, i: number) => (
                <div key={i} className="border-l-2 pl-3" style={{ borderColor: PRIORITY_COLOR[String(p.priority)] ?? 'var(--pe-info)' }}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm">{p.title}</span>
                    {p.priority && (
                      <Badge variant="outline" className="text-[10px]" style={{ borderColor: PRIORITY_COLOR[String(p.priority)], color: PRIORITY_COLOR[String(p.priority)] }}>
                        Priorité {p.priority}
                      </Badge>
                    )}
                    {p.delay && <span className="text-[11px] text-muted-foreground">{p.delay}</span>}
                  </div>
                  <p className="text-xs leading-relaxed text-muted-foreground">{p.body}</p>
                  {p.budget && <p className="text-[11px] mt-1"><strong>Budget :</strong> {p.budget}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Capacité d'absorption */}
        {capaciteAbsorption && (
          <div>
            <SubHeading>Capacité d'absorption de la croissance</SubHeading>
            {capaciteAbsorption.evaluation && (
              <p className="text-sm leading-relaxed font-medium mb-2">{capaciteAbsorption.evaluation}</p>
            )}
            {capaciteAbsorption.paragraphs?.length > 0 && (
              <div className="space-y-2 text-sm leading-relaxed">
                {capaciteAbsorption.paragraphs.map((p: string, i: number) => <p key={i}>{p}</p>)}
              </div>
            )}
          </div>
        )}

        {/* Red flags */}
        {redFlags.length > 0 && (
          <div>
            <SubHeading>Red flags identifiés</SubHeading>
            <div className="space-y-1.5">
              {redFlags.map((rf: any, i: number) => (
                <RedFlagItem
                  key={i}
                  title={rf.title + (rf.severity ? ` — sévérité ${rf.severity}` : '')}
                  severity={sevToRedFlag[rf.severity] ?? 'medium'}
                  detail={rf.body ?? rf.detail ?? ''}
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
            Section 3 · Rédigée par {footer.redige_par ?? '—'} {footer.date ? `le ${footer.date}` : ''}
            {footer.sources && <p className="mt-0.5">Sources : {footer.sources}</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
