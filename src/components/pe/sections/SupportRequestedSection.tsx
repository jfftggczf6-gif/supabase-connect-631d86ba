import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import ReactMarkdown from 'react-markdown';

interface Props { section: { content_md: string | null; content_json: any }; }

export default function SupportRequestedSection({ section }: Props) {
  const uop: any[] = section.content_json?.use_of_proceeds ?? [];
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Accompagnement demandé — Use of proceeds</CardTitle>
      </CardHeader>
      <CardContent>
        {uop.length > 0 && (
          <div className="space-y-1 text-sm mb-2">
            {uop.map((u: any, i: number) => (
              <div key={i} className="flex justify-between border-b border-border/30 py-1">
                <span className="text-muted-foreground">{u.label}</span>
                <span className="font-medium">{u.percent}%</span>
              </div>
            ))}
          </div>
        )}
        {section.content_md && (
          <div className="prose prose-sm max-w-none text-foreground">
            <ReactMarkdown>{section.content_md}</ReactMarkdown>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
