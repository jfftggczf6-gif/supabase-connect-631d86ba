import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import ReactMarkdown from 'react-markdown';
import RedFlagItem from '@/components/dashboard/viewers/atoms/pe/RedFlagItem';

interface Props {
  section: { content_md: string | null; content_json: any };
  allSections?: Record<string, any>;
}

const SubHeading = ({ children }: { children: React.ReactNode }) => (
  <h4 className="text-xs font-bold uppercase tracking-wide text-foreground mb-2 mt-3 border-l-2 border-[var(--pe-purple)] pl-2 py-0.5">{children}</h4>
);

const sevToRedFlag: Record<string, 'high' | 'medium' | 'low'> = {
  Critical: 'high', High: 'high', Medium: 'medium', Low: 'low',
  high: 'high', medium: 'medium', low: 'low',
};

export default function ShareholdingGovernanceSection({ section }: Props) {
  const cj = section.content_json ?? {};
  const meta = cj.meta;
  const capTable = cj.cap_table; // { rows: [{actionnaire, percent, type, entree, role}], notes: [...] }
  const governance = cj.governance; // { paragraphs: { ca, ag, cac, controle_interne } } each is string or paragraphs[]
  const conventions: any[] = cj.conventions ?? []; // [{title, severity, body}]
  const redFlags: any[] = cj.red_flags ?? [];
  const structurationPlan = cj.structuration_plan; // { intro, items: [string|{title,body}] }
  const items: any[] = cj.actionnariat?.items ?? []; // legacy
  const footer = cj.footer;

  return (
    <Card>
      <CardHeader className="pb-2 space-y-2">
        <CardTitle className="text-base">Actionnariat et gouvernance</CardTitle>
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
        {/* Table de capitalisation */}
        {capTable?.rows?.length > 0 && (
          <div>
            <SubHeading>Table de capitalisation</SubHeading>
            <div className="text-sm rounded border bg-muted/30 p-3">
              <div className="grid grid-cols-[2.5fr_0.6fr_0.6fr_0.6fr_2fr] border-b text-[10px] text-muted-foreground py-1">
                <span>Actionnaire</span>
                <span className="text-right">%</span>
                <span className="text-right">Type</span>
                <span className="text-right">Entrée</span>
                <span>Nature / Rôle opérationnel</span>
              </div>
              {capTable.rows.map((r: any, i: number) => (
                <div
                  key={i}
                  className="grid grid-cols-[2.5fr_0.6fr_0.6fr_0.6fr_2fr] py-1 border-b border-border/30 text-xs"
                  style={{ fontWeight: r.bold ? 500 : undefined }}
                >
                  <span className={r.bold ? 'font-medium' : ''}>{r.actionnaire}</span>
                  <span className="text-right">{r.percent}%</span>
                  <span className="text-right text-muted-foreground">{r.type}</span>
                  <span className="text-right text-muted-foreground">{r.entree}</span>
                  <span className="text-muted-foreground">{r.role}</span>
                </div>
              ))}
            </div>
            {capTable.notes?.length > 0 && (
              <div className="space-y-2 mt-2 text-sm leading-relaxed">
                {capTable.notes.map((n: string, i: number) => <p key={i}>{n}</p>)}
              </div>
            )}
          </div>
        )}

        {/* Compat legacy actionnariat.items */}
        {items.length > 0 && !capTable && (
          <div>
            <SubHeading>Actionnariat</SubHeading>
            <div className="space-y-1 text-sm">
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
          </div>
        )}

        {/* Organes de gouvernance */}
        {governance && (
          <div>
            <SubHeading>Organes de gouvernance — état actuel</SubHeading>
            <div className="space-y-2 text-sm leading-relaxed">
              {governance.ca && <p><strong>Conseil d'administration :</strong> {governance.ca}</p>}
              {governance.ag && <p><strong>Assemblées générales :</strong> {governance.ag}</p>}
              {governance.cac && <p><strong>Commissaire aux comptes :</strong> {governance.cac}</p>}
              {governance.controle_interne && <p><strong>Contrôle interne :</strong> {governance.controle_interne}</p>}
            </div>
          </div>
        )}

        {/* Conventions réglementées */}
        {conventions.length > 0 && (
          <div>
            <SubHeading>Conventions réglementées identifiées</SubHeading>
            <div className="space-y-1.5">
              {conventions.map((c: any, i: number) => (
                <RedFlagItem
                  key={i}
                  title={c.title}
                  severity={sevToRedFlag[c.severity] ?? 'medium'}
                  detail={c.body ?? c.detail ?? ''}
                />
              ))}
            </div>
          </div>
        )}

        {/* Red flags gouvernance */}
        {redFlags.length > 0 && (
          <div>
            <SubHeading>Red flags gouvernance détectés</SubHeading>
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

        {/* Plan de structuration post-investissement */}
        {structurationPlan?.items?.length > 0 && (
          <div>
            <SubHeading>Plan de structuration post-investissement — convenu avec le fondateur</SubHeading>
            {structurationPlan.intro && <p className="text-sm leading-relaxed mb-2">{structurationPlan.intro}</p>}
            <ol className="list-decimal list-inside space-y-1 text-sm leading-relaxed">
              {structurationPlan.items.map((it: any, i: number) => (
                <li key={i}>
                  {typeof it === 'string'
                    ? it
                    : <><strong>{it.title}</strong>{it.body ? ` — ${it.body}` : ''}</>}
                </li>
              ))}
            </ol>
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
            Section 2 · Rédigée par {footer.redige_par ?? '—'} {footer.date ? `le ${footer.date}` : ''}
            {footer.review_comment && <p className="mt-0.5">Commentaire IM : "{footer.review_comment}"</p>}
            {footer.sources && <p className="mt-0.5">Sources : {footer.sources}</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
