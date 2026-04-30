import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import ReactMarkdown from 'react-markdown';

interface Props { section: { content_md: string | null; content_json: any }; }

export default function UnitEconomicsSection({ section }: Props) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">Units economics</CardTitle></CardHeader>
      <CardContent>
        {section.content_md
          ? <div className="prose prose-sm max-w-none text-foreground"><ReactMarkdown>{section.content_md}</ReactMarkdown></div>
          : <p className="text-sm text-muted-foreground">Non renseigné.</p>}
      </CardContent>
    </Card>
  );
}
