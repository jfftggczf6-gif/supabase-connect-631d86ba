import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import ReactMarkdown from 'react-markdown';
import MatchCriteriaList from '@/components/dashboard/viewers/atoms/pe/MatchCriteriaList';
import NarrativeBlock from './NarrativeBlock';
import SectionMetadataFooter from './SectionMetadataFooter';

interface Props {
  section: { content_md: string | null; content_json: any };
  allSections?: Record<string, any>;
}

export default function InvestmentThesisSection({ section }: Props) {
  const cj = section.content_json ?? {};
  const meta = cj.meta;
  const fivePoints = cj.five_arguments ?? cj.thesis_5_points;
  const structuration = cj.structuration;
  const scenarios = cj.scenarios_returns;
  const sortie = cj.exit_strategy;
  const thesisMatch = cj.thesis_match;
  const reco = cj.recommendation;
  const footer = cj.footer;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Thèse d'investissement</CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {fivePoints?.items?.length > 0 && (
          <NarrativeBlock title={`Pourquoi investir — ${fivePoints.items.length} arguments structurés`}>
            <div className="space-y-2">
              {fivePoints.items.map((p: any, i: number) => (
                <p key={i}>
                  <strong>{p.n}. {p.lead}</strong> {p.body}
                </p>
              ))}
            </div>
          </NarrativeBlock>
        )}

        {structuration && (
          <NarrativeBlock title="Structuration proposée">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
              {structuration.pre_money && (
                <div className="rounded p-3 bg-background border">
                  <div className="text-[9px] text-muted-foreground">Pre-money</div>
                  <div className="text-base font-medium">{structuration.pre_money.value}</div>
                  {structuration.pre_money.hint && <div className="text-[9px] text-muted-foreground">{structuration.pre_money.hint}</div>}
                </div>
              )}
              {structuration.ticket && (
                <div className="rounded p-3 bg-background border">
                  <div className="text-[9px] text-muted-foreground">Ticket</div>
                  <div className="text-base font-medium">{structuration.ticket.value}</div>
                  {structuration.ticket.hint && <div className="text-[9px] text-muted-foreground">{structuration.ticket.hint}</div>}
                </div>
              )}
              {structuration.participation && (
                <div className="rounded p-3 bg-background border">
                  <div className="text-[9px] text-muted-foreground">Participation</div>
                  <div className="text-base font-medium">{structuration.participation.value}</div>
                  {structuration.participation.hint && <div className="text-[9px] text-muted-foreground">{structuration.participation.hint}</div>}
                </div>
              )}
              {structuration.horizon && (
                <div className="rounded p-3 bg-background border">
                  <div className="text-[9px] text-muted-foreground">Horizon</div>
                  <div className="text-base font-medium">{structuration.horizon.value}</div>
                  {structuration.horizon.hint && <div className="text-[9px] text-muted-foreground">{structuration.horizon.hint}</div>}
                </div>
              )}
            </div>
            {structuration.instrument_note && <p>{structuration.instrument_note}</p>}
            {structuration.governance_items?.length > 0 && (
              <div className="mt-3 pt-2 border-t border-dashed border-border">
                <p className="font-medium mb-1">Gouvernance post-deal :</p>
                <ul className="space-y-0.5 list-decimal list-inside">
                  {structuration.governance_items.map((g: string, i: number) => (
                    <li key={i}>{g}</li>
                  ))}
                </ul>
              </div>
            )}
          </NarrativeBlock>
        )}

        {thesisMatch && !fivePoints && (
          <NarrativeBlock title="Adéquation thèse du fonds">
            <MatchCriteriaList
              criteria={thesisMatch.criteria ?? []}
              match_count={thesisMatch.match_count}
              total={thesisMatch.total}
              score_percent={thesisMatch.score_percent}
            />
          </NarrativeBlock>
        )}

        {scenarios && (scenarios.bear || scenarios.base || scenarios.bull) && (
          <NarrativeBlock title="Scénarios de sortie">
            <div className="space-y-2">
              {scenarios.bear && (
                <div className="rounded p-3 bg-background border">
                  <div className="flex justify-between">
                    <span><strong>Bear case</strong> — {scenarios.bear.tagline ?? 'Marché stagne'}</span>
                    <span className="font-medium">MOIC {scenarios.bear.moic} · IRR {scenarios.bear.irr}</span>
                  </div>
                  {scenarios.bear.description && <p className="text-muted-foreground mt-1">{scenarios.bear.description}</p>}
                </div>
              )}
              {scenarios.base && (
                <div className="rounded p-3 bg-background border">
                  <div className="flex justify-between">
                    <span><strong>Base case</strong> — {scenarios.base.tagline ?? 'Exécution du plan'}</span>
                    <span className="font-medium">MOIC {scenarios.base.moic} · IRR {scenarios.base.irr}</span>
                  </div>
                  {scenarios.base.description && <p className="text-muted-foreground mt-1">{scenarios.base.description}</p>}
                </div>
              )}
              {scenarios.bull && (
                <div className="rounded p-3 bg-background border">
                  <div className="flex justify-between">
                    <span><strong>Bull case</strong> — {scenarios.bull.tagline ?? 'Expansion réussie'}</span>
                    <span className="font-medium">MOIC {scenarios.bull.moic} · IRR {scenarios.bull.irr}</span>
                  </div>
                  {scenarios.bull.description && <p className="text-muted-foreground mt-1">{scenarios.bull.description}</p>}
                </div>
              )}
              {scenarios.pre_money_indicatif && <p className="text-[10px] text-muted-foreground mt-2">Pre-money indicatif : {scenarios.pre_money_indicatif}</p>}
            </div>
          </NarrativeBlock>
        )}

        {sortie?.narratif && (
          <NarrativeBlock title="Type de sortie envisagé">
            <p>{sortie.narratif}</p>
          </NarrativeBlock>
        )}

        {reco && !fivePoints && (
          <NarrativeBlock title="Recommandation">
            <p className="font-semibold mb-2">{reco.verdict?.replace('_', ' ') ?? '—'}</p>
            {reco.summary && <p className="text-muted-foreground">{reco.summary}</p>}
            {(reco.conditions ?? []).length > 0 && (
              <div className="space-y-1 mt-2">
                {reco.conditions.map((c: any, i: number) => (
                  <p key={i} className="text-muted-foreground">
                    <span className="font-medium text-foreground">Condition {c.n} —</span> {c.text}
                  </p>
                ))}
              </div>
            )}
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
