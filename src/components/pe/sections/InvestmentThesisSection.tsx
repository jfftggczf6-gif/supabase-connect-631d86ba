import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import ReactMarkdown from 'react-markdown';
import { CheckCircle2, XCircle, Lightbulb } from 'lucide-react';
import MatchCriteriaList from '@/components/dashboard/viewers/atoms/pe/MatchCriteriaList';
import ScenariosBox from '@/components/dashboard/viewers/atoms/pe/ScenariosBox';

interface Props {
  section: { content_md: string | null; content_json: any };
  allSections?: Record<string, any>;
}

const VERDICT_STYLE: Record<string, { bg: string; border: string; color: string }> = {
  go_direct:       { bg: 'var(--pe-bg-ok)',      border: 'var(--pe-ok)',      color: 'var(--pe-ok)' },
  go_conditionnel: { bg: 'var(--pe-bg-ok)',      border: 'var(--pe-ok)',      color: 'var(--pe-ok)' },
  hold:            { bg: 'var(--pe-bg-warning)', border: 'var(--pe-warning)', color: 'var(--pe-warning)' },
  reject:          { bg: 'var(--pe-bg-danger)',  border: 'var(--pe-danger)',  color: 'var(--pe-danger)' },
};

const SubHeading = ({ children, color }: { children: React.ReactNode; color?: string }) => (
  <h4 className="text-xs font-bold uppercase tracking-wide text-foreground mb-2 mt-3" style={color ? { color } : undefined}>
    {children}
  </h4>
);

export default function InvestmentThesisSection({ section }: Props) {
  const cj = section.content_json ?? {};
  const meta = cj.meta;
  const fivePoints = cj.five_arguments ?? cj.thesis_5_points;
  const structuration = cj.structuration; // { pre_money, ticket, participation, horizon, instrument_note, governance_items }
  const scenarios = cj.scenarios_returns;
  const sortie = cj.exit_strategy; // { type_envisage, narratif }
  const thesisMatch = cj.thesis_match; // legacy
  const reco = cj.recommendation; // legacy
  const footer = cj.footer;

  return (
    <Card style={{ borderColor: 'var(--pe-ok)', borderWidth: 2 }}>
      <CardHeader className="pb-2 space-y-2">
        <CardTitle className="text-base">Thèse d'investissement</CardTitle>
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
        {meta?.pivot_hint && (
          <p className="text-[10px] flex items-center gap-1.5" style={{ color: 'var(--pe-purple)' }}>
            <Lightbulb className="h-3 w-3" /> {meta.pivot_hint}
          </p>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* 5 arguments structurés */}
        {fivePoints?.items?.length > 0 && (
          <div>
            <SubHeading>Pourquoi investir — {fivePoints.items.length} arguments structurés</SubHeading>
            <div className="space-y-2 text-sm leading-relaxed">
              {fivePoints.items.map((p: any, i: number) => (
                <p key={i}>
                  <strong>{p.n}. {p.lead}</strong> {p.body}
                </p>
              ))}
            </div>
          </div>
        )}

        {/* Structuration proposée — 4 KPIs purple */}
        {structuration && (
          <div>
            <SubHeading>Structuration proposée</SubHeading>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2">
              {structuration.pre_money && (
                <div className="rounded p-3" style={{ background: 'var(--pe-bg-purple)' }}>
                  <div className="text-[9px]" style={{ color: 'var(--pe-purple)' }}>Pre-money</div>
                  <div className="text-base font-medium" style={{ color: 'var(--pe-purple)' }}>{structuration.pre_money.value}</div>
                  {structuration.pre_money.hint && <div className="text-[9px]" style={{ color: 'var(--pe-purple)' }}>{structuration.pre_money.hint}</div>}
                </div>
              )}
              {structuration.ticket && (
                <div className="rounded p-3" style={{ background: 'var(--pe-bg-purple)' }}>
                  <div className="text-[9px]" style={{ color: 'var(--pe-purple)' }}>Ticket</div>
                  <div className="text-base font-medium" style={{ color: 'var(--pe-purple)' }}>{structuration.ticket.value}</div>
                  {structuration.ticket.hint && <div className="text-[9px]" style={{ color: 'var(--pe-purple)' }}>{structuration.ticket.hint}</div>}
                </div>
              )}
              {structuration.participation && (
                <div className="rounded p-3" style={{ background: 'var(--pe-bg-purple)' }}>
                  <div className="text-[9px]" style={{ color: 'var(--pe-purple)' }}>Participation</div>
                  <div className="text-base font-medium" style={{ color: 'var(--pe-purple)' }}>{structuration.participation.value}</div>
                  {structuration.participation.hint && <div className="text-[9px]" style={{ color: 'var(--pe-purple)' }}>{structuration.participation.hint}</div>}
                </div>
              )}
              {structuration.horizon && (
                <div className="rounded p-3 bg-muted">
                  <div className="text-[9px] text-muted-foreground">Horizon</div>
                  <div className="text-base font-medium">{structuration.horizon.value}</div>
                  {structuration.horizon.hint && <div className="text-[9px] text-muted-foreground">{structuration.horizon.hint}</div>}
                </div>
              )}
            </div>
            {structuration.instrument_note && <p className="text-sm leading-relaxed">{structuration.instrument_note}</p>}
            {structuration.governance_items?.length > 0 && (
              <div className="mt-2">
                <p className="text-xs font-medium mb-1">Gouvernance post-deal :</p>
                <ul className="space-y-0.5 text-xs leading-relaxed list-decimal list-inside">
                  {structuration.governance_items.map((g: string, i: number) => (
                    <li key={i}>{g}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Adéquation thèse (compat legacy thesis_match) */}
        {thesisMatch && !fivePoints && (
          <div>
            <SubHeading>Adéquation thèse du fonds</SubHeading>
            <MatchCriteriaList
              criteria={thesisMatch.criteria ?? []}
              match_count={thesisMatch.match_count}
              total={thesisMatch.total}
              score_percent={thesisMatch.score_percent}
            />
          </div>
        )}

        {/* Scénarios de sortie */}
        {scenarios && (
          <div>
            <SubHeading>Scénarios de sortie</SubHeading>
            {/* Compat: si scenarios.bear/base/bull sont des objets {moic, irr, description} on rend à plat. Sinon ScenariosBox simple. */}
            {(scenarios.bear || scenarios.base || scenarios.bull) && (
              <div className="space-y-2">
                {scenarios.bear && (
                  <div className="rounded p-3 text-sm bg-muted">
                    <div className="flex justify-between">
                      <span><strong>Bear case</strong> — {scenarios.bear.tagline ?? 'Marché stagne'}</span>
                      <span style={{ color: 'var(--pe-warning)', fontWeight: 500 }}>MOIC {scenarios.bear.moic} · IRR {scenarios.bear.irr}</span>
                    </div>
                    {scenarios.bear.description && <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{scenarios.bear.description}</p>}
                  </div>
                )}
                {scenarios.base && (
                  <div className="rounded p-3 text-sm" style={{ background: 'var(--pe-bg-purple)' }}>
                    <div className="flex justify-between" style={{ color: 'var(--pe-purple)' }}>
                      <span><strong>Base case</strong> — {scenarios.base.tagline ?? 'Exécution du plan'}</span>
                      <span style={{ fontWeight: 500 }}>MOIC {scenarios.base.moic} · IRR {scenarios.base.irr}</span>
                    </div>
                    {scenarios.base.description && <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--pe-purple)' }}>{scenarios.base.description}</p>}
                  </div>
                )}
                {scenarios.bull && (
                  <div className="rounded p-3 text-sm" style={{ background: 'var(--pe-bg-ok)' }}>
                    <div className="flex justify-between" style={{ color: 'var(--pe-ok)' }}>
                      <span><strong>Bull case</strong> — {scenarios.bull.tagline ?? 'Expansion réussie'}</span>
                      <span style={{ fontWeight: 500 }}>MOIC {scenarios.bull.moic} · IRR {scenarios.bull.irr}</span>
                    </div>
                    {scenarios.bull.description && <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--pe-ok)' }}>{scenarios.bull.description}</p>}
                  </div>
                )}
                {scenarios.pre_money_indicatif && <p className="text-[10px] text-muted-foreground mt-2">Pre-money indicatif : {scenarios.pre_money_indicatif}</p>}
              </div>
            )}
          </div>
        )}

        {/* Type de sortie envisagé */}
        {sortie?.narratif && (
          <div>
            <SubHeading>Type de sortie envisagé</SubHeading>
            <p className="text-sm leading-relaxed">{sortie.narratif}</p>
          </div>
        )}

        {/* Recommandation legacy fallback (si pas de 5 arguments) */}
        {reco && !fivePoints && (
          <div className="border-t pt-3 space-y-2">
            <Badge style={{ background: VERDICT_STYLE[reco.verdict?.toLowerCase()]?.bg, color: VERDICT_STYLE[reco.verdict?.toLowerCase()]?.color, border: 'none' }}>
              {reco.verdict?.replace('_', ' ') ?? '—'}
            </Badge>
            {reco.summary && <p className="text-xs text-muted-foreground leading-relaxed">{reco.summary}</p>}
            {(reco.conditions ?? []).length > 0 && (
              <div className="space-y-1">
                {reco.conditions.map((c: any, i: number) => (
                  <div key={i} className="flex gap-2 items-start text-xs">
                    <Badge variant="outline" style={{ background: 'var(--pe-bg-info)', color: 'var(--pe-info)', border: 'none' }}>Condition {c.n}</Badge>
                    <span>{c.text}</span>
                  </div>
                ))}
              </div>
            )}
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
            Section 9 · Rédigée par {footer.redige_par ?? '—'} {footer.date ? `le ${footer.date}` : ''}
            {footer.review_par && ` · Validée IM (${footer.review_par}${footer.review_date ? `, ${footer.review_date}` : ''})`}
            {footer.valide_par && ` · Validée MD (${footer.valide_par}${footer.valide_date ? `, ${footer.valide_date}` : ''})`}
            {footer.sources && <p className="mt-0.5">Sources : {footer.sources}</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
