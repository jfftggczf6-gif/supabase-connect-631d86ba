import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import DocCategoryCard from '@/components/dashboard/viewers/atoms/pe/DocCategoryCard';
import ReactMarkdown from 'react-markdown';

interface Props { section: { content_md: string | null; content_json: any }; }

export default function AnnexesSection({ section }: Props) {
  const dq = section.content_json?.doc_quality;
  const cats: any[] = dq?.categories ?? [];
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Annexes — Qualité du dossier documentaire</CardTitle>
      </CardHeader>
      <CardContent>
        {cats.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {cats.map((c: any, i: number) => (
              <DocCategoryCard key={i} name={c.name} level={c.level} checklist={c.checklist} />
            ))}
          </div>
        )}
        {(dq?.global_level || dq?.summary) && (
          <div className="border-t mt-2 pt-2 text-sm">
            {dq.global_level && <span className="font-medium" style={{ color: 'var(--pe-warning)' }}>Score qualité global : {dq.global_level} </span>}
            {dq.summary && <span className="text-muted-foreground">— {dq.summary}</span>}
          </div>
        )}
        {section.content_md && (
          <div className="prose prose-sm max-w-none text-foreground mt-2">
            <ReactMarkdown>{section.content_md}</ReactMarkdown>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
