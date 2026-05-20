import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import ReactMarkdown from 'react-markdown';
import { useSearchParams } from 'react-router-dom';
import { ExternalLink, TrendingUp } from 'lucide-react';
import MatchCriteriaList from '@/components/dashboard/viewers/atoms/pe/MatchCriteriaList';
import NarrativeBlock from './NarrativeBlock';
import SectionMetadataFooter from './SectionMetadataFooter';

interface Props {
  section: { content_md: string | null; content_json: any };
  allSections?: Record<string, any>;
}

// Format un nombre brut avec sa devise, sans abréviation (300000000 → "300 000 000 FCFA")
function fmtMoney(n: any, currency: string): string {
  if (n == null || isNaN(Number(n))) return '—';
  const num = Number(n);
  // Au-dessus du million, abrège pour lisibilité
  if (Math.abs(num) >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(num >= 100_000_000 ? 0 : 1)} M ${currency}`;
  }
  if (Math.abs(num) >= 1_000) {
    return `${(num / 1_000).toFixed(0)} K ${currency}`;
  }
  return `${num.toLocaleString('fr-FR')} ${currency}`;
}

function fmtPct(n: any, decimals = 1): string {
  if (n == null || isNaN(Number(n))) return '—';
  return `${Number(n).toFixed(decimals)}%`;
}

function fmtMultiple(n: any): string {
  if (n == null || isNaN(Number(n))) return '—';
  return `${Number(n).toFixed(2)}x`;
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
  // Bloc valuation synchronisé depuis pe_valuation par le worker
  // generate_pe_valuation.py:251-280 (lecture seule, source de vérité = page Valorisation)
  const valuation = cj.valuation;
  const valuationSyncedAt = cj.valuation_synced_at;
  const [, setSearchParams] = useSearchParams();

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

        {/* Bloc valuation synchronisé depuis pe_valuation (worker generate_pe_valuation
            écrit content_json.valuation à chaque génération). Affiché en lecture seule
            avec lien vers la page Valorisation détaillée. */}
        {valuation && (
          <NarrativeBlock
            title={
              <span className="flex items-center gap-2">
                <TrendingUp className="h-3.5 w-3.5 text-violet-600" />
                Valorisation
                <Badge variant="outline" className="text-[9px] bg-violet-50 text-violet-700 border-violet-200">
                  3 méthodes pondérées
                </Badge>
              </span>
            }
          >
            <div className="space-y-3">
              {/* KPIs principaux */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {valuation.pre_money != null && (
                  <div className="rounded p-3 bg-violet-50/40 border border-violet-100">
                    <div className="text-[9px] text-muted-foreground uppercase tracking-wider">Pre-money</div>
                    <div className="text-base font-semibold text-violet-700">{fmtMoney(valuation.pre_money, valuation.currency || 'FCFA')}</div>
                  </div>
                )}
                {valuation.ticket_recommended != null && (
                  <div className="rounded p-3 bg-violet-50/40 border border-violet-100">
                    <div className="text-[9px] text-muted-foreground uppercase tracking-wider">Ticket recommandé</div>
                    <div className="text-base font-semibold text-violet-700">{fmtMoney(valuation.ticket_recommended, valuation.currency || 'FCFA')}</div>
                  </div>
                )}
                {valuation.equity_stake_pct != null && (
                  <div className="rounded p-3 bg-violet-50/40 border border-violet-100">
                    <div className="text-[9px] text-muted-foreground uppercase tracking-wider">Equity stake</div>
                    <div className="text-base font-semibold text-violet-700">{fmtPct(valuation.equity_stake_pct, 1)}</div>
                  </div>
                )}
                {valuation.weighted_ev != null && (
                  <div className="rounded p-3 bg-violet-50/40 border border-violet-100">
                    <div className="text-[9px] text-muted-foreground uppercase tracking-wider">EV pondérée</div>
                    <div className="text-base font-semibold text-violet-700">{fmtMoney(valuation.weighted_ev, valuation.currency || 'FCFA')}</div>
                  </div>
                )}
              </div>

              {/* Scénarios MOIC + IRR */}
              {(valuation.moic || valuation.irr) && (
                <div className="space-y-1.5">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Retours par scénario {valuation.exit_horizon_years && `(horizon ${valuation.exit_horizon_years} ans)`}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded p-2 bg-rose-50/40 border border-rose-100 text-center">
                      <div className="text-[9px] uppercase tracking-wider text-rose-700">Bear</div>
                      <div className="text-sm font-semibold">{fmtMultiple(valuation.moic?.bear)} · {fmtPct(valuation.irr?.bear, 0)}</div>
                    </div>
                    <div className="rounded p-2 bg-blue-50/40 border border-blue-100 text-center">
                      <div className="text-[9px] uppercase tracking-wider text-blue-700">Base</div>
                      <div className="text-sm font-semibold">{fmtMultiple(valuation.moic?.base)} · {fmtPct(valuation.irr?.base, 0)}</div>
                    </div>
                    <div className="rounded p-2 bg-emerald-50/40 border border-emerald-100 text-center">
                      <div className="text-[9px] uppercase tracking-wider text-emerald-700">Bull</div>
                      <div className="text-sm font-semibold">{fmtMultiple(valuation.moic?.bull)} · {fmtPct(valuation.irr?.bull, 0)}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Pondération méthodes */}
              {valuation.weights && (
                <div className="text-[10px] text-muted-foreground">
                  Pondération : DCF {fmtPct(valuation.weights.dcf, 0)} · Multiples {fmtPct(valuation.weights.multiples, 0)} · ANCC {fmtPct(valuation.weights.ancc, 0)}
                </div>
              )}

              {/* Action : voir la valuation détaillée */}
              <div className="flex items-center justify-between pt-2 border-t border-dashed border-violet-200">
                <div className="text-[10px] text-muted-foreground">
                  {valuationSyncedAt
                    ? `Synchronisé depuis la page Valorisation le ${new Date(valuationSyncedAt).toLocaleDateString('fr-FR')}`
                    : 'Synchronisé depuis la page Valorisation'}
                </div>
                <Button
                  size="sm" variant="ghost"
                  className="h-7 text-[11px] gap-1 text-violet-700 hover:text-violet-900 hover:bg-violet-100"
                  onClick={() => setSearchParams(prev => { prev.set('section', 'valuation'); return prev; })}
                >
                  Voir la valuation détaillée <ExternalLink className="h-3 w-3" />
                </Button>
              </div>
            </div>
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
