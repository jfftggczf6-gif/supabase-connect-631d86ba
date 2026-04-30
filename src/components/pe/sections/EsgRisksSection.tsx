import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import RedFlagItem from '@/components/dashboard/viewers/atoms/pe/RedFlagItem';
import ReactMarkdown from 'react-markdown';

interface Props { section: { content_md: string | null; content_json: any }; }

export default function EsgRisksSection({ section }: Props) {
  const flags: any[] = section.content_json?.red_flags ?? [];
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base" style={{ color: flags.length ? 'var(--pe-danger)' : undefined }}>
          ESG / Risques
        </CardTitle>
      </CardHeader>
      <CardContent>
        {flags.length > 0 ? (
          <div className="space-y-1.5">
            {flags.map((f: any, i: number) => (
              <RedFlagItem key={i} title={f.title} severity={f.severity} detail={f.detail} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Aucun red flag identifié.</p>
        )}
        {section.content_md && (
          <div className="prose prose-sm max-w-none text-foreground mt-2 border-t pt-2">
            <ReactMarkdown>{section.content_md}</ReactMarkdown>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
