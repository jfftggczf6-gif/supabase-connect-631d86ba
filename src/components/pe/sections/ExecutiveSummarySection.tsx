import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import ReactMarkdown from 'react-markdown';

interface Props {
  section: { content_md: string | null; content_json: any };
  allSections?: Record<string, any>;
}

export default function ExecutiveSummarySection({ section }: Props) {
  const kpis: any[] = section.content_json?.kpis_bandeau ?? [];
  const synth = section.content_json?.ai_synthesis;

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">Résumé exécutif</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {kpis.length > 0 && (
          <div className="flex gap-1.5 flex-wrap">
            {kpis.map((k: any, i: number) => (
              <div key={i} className="bg-muted rounded px-2 py-1.5 text-center flex-1 min-w-[100px]">
                <div className="text-[9px] text-muted-foreground">{k.label}</div>
                <div className="text-base font-medium">{k.value}</div>
                {k.hint && (
                  <div
                    className="text-[9px]"
                    style={{
                      color: k.hint_color === 'ok' ? 'var(--pe-ok)' :
                             k.hint_color === 'warning' ? 'var(--pe-warning)' :
                             'var(--pe-text-secondary)',
                    }}
                  >
                    {k.hint}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        {section.content_md && (
          <div className="prose prose-sm max-w-none text-foreground">
            <ReactMarkdown>{section.content_md}</ReactMarkdown>
          </div>
        )}
        {synth?.paragraph && (
          <div className="text-sm leading-relaxed text-muted-foreground border-t pt-2">
            <p>{synth.paragraph}</p>
            <div className="flex gap-1.5 flex-wrap mt-2">
              {(synth.strengths_tags ?? []).map((t: string, i: number) => (
                <Badge key={i} variant="outline" style={{ background: 'var(--pe-bg-info)', color: 'var(--pe-info)', border: 'none' }}>+ {t}</Badge>
              ))}
              {(synth.weaknesses_tags ?? []).map((t: string, i: number) => (
                <Badge key={i} variant="outline" style={{ background: 'var(--pe-bg-warning)', color: 'var(--pe-warning)', border: 'none' }}>- {t}</Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
