import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import ReactMarkdown from 'react-markdown';
import MatchCriteriaList from '@/components/dashboard/viewers/atoms/pe/MatchCriteriaList';
import ScenariosBox from '@/components/dashboard/viewers/atoms/pe/ScenariosBox';

interface Props { section: { content_md: string | null; content_json: any }; }

export default function InvestmentThesisSection({ section }: Props) {
  const thesisMatch = section.content_json?.thesis_match;
  const scenarios = section.content_json?.scenarios_returns;
  const reco = section.content_json?.recommendation;

  return (
    <Card style={{ borderColor: 'var(--pe-ok)', borderWidth: 2 }}>
      <CardHeader className="pb-2"><CardTitle className="text-base">Thèse d'investissement</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {thesisMatch && (
          <div>
            <div className="text-sm font-medium mb-1.5">Adéquation thèse du fonds</div>
            <MatchCriteriaList
              criteria={thesisMatch.criteria ?? []}
              match_count={thesisMatch.match_count}
              total={thesisMatch.total}
              score_percent={thesisMatch.score_percent}
            />
          </div>
        )}

        {scenarios && (
          <div>
            <div className="text-sm font-medium mb-1.5">Scénarios retour (horizon 5 ans)</div>
            <ScenariosBox
              bear={scenarios.bear}
              base={scenarios.base}
              bull={scenarios.bull}
              pre_money_indicatif={scenarios.pre_money_indicatif}
            />
          </div>
        )}

        {reco && (
          <div className="border-t pt-3 space-y-2">
            <div className="flex gap-2 items-start">
              <Badge
                variant="default"
                style={{ background: 'var(--pe-bg-ok)', color: 'var(--pe-ok)', border: 'none', fontSize: '13px', padding: '4px 12px' }}
              >
                {reco.verdict?.replace('_', ' ') ?? '—'}
              </Badge>
              {reco.summary && <p className="text-xs text-muted-foreground leading-relaxed flex-1">{reco.summary}</p>}
            </div>
            {(reco.conditions ?? []).length > 0 && (
              <div className="space-y-1">
                {reco.conditions.map((c: any, i: number) => (
                  <div key={i} className="flex gap-2 items-start text-xs">
                    <Badge variant="outline" style={{ background: 'var(--pe-bg-info)', color: 'var(--pe-info)', border: 'none' }}>
                      Condition {c.n}
                    </Badge>
                    <span>{c.text}</span>
                  </div>
                ))}
              </div>
            )}
            {(reco.deal_breakers ?? []).length > 0 && (
              <p className="text-xs text-muted-foreground">
                <span className="text-muted-foreground">Deal breakers : </span>
                {reco.deal_breakers.map((db: string, i: number) => (
                  <span key={i} style={{ color: 'var(--pe-danger)' }}>{i > 0 ? ' · ' : ''}{db}</span>
                ))}
              </p>
            )}
            {reco.conviction && (
              <p className="text-xs">
                <span className="text-muted-foreground">Niveau de conviction : </span>
                <span style={{ color: 'var(--pe-info)', fontWeight: 500 }}>{reco.conviction}</span>
              </p>
            )}
          </div>
        )}

        {section.content_md && (
          <div className="prose prose-sm max-w-none text-foreground border-t pt-2">
            <ReactMarkdown>{section.content_md}</ReactMarkdown>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
