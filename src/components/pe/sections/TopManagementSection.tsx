import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Props { section: { content_md: string | null; content_json: any }; }

const TAG_STYLE: Record<string, { bg: string; color: string }> = {
  ok:      { bg: 'var(--pe-bg-ok)',      color: 'var(--pe-ok)' },
  warning: { bg: 'var(--pe-bg-warning)', color: 'var(--pe-warning)' },
  danger:  { bg: 'var(--pe-bg-danger)',  color: 'var(--pe-danger)' },
};

export default function TopManagementSection({ section }: Props) {
  const items: any[] = section.content_json?.management?.items ?? [];
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">Top management</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {items.map((m: any, i: number) => {
          const ts = m.tag ? TAG_STYLE[m.tag] : null;
          return (
            <div key={i} className="text-sm border-b border-border/50 py-1.5">
              <div className="flex items-center gap-2">
                <span className="font-medium">{m.name}</span>
                <span className="text-xs text-muted-foreground">— {m.role}</span>
                {ts && <span className="px-1.5 py-0.5 rounded text-[10px]" style={{ background: ts.bg, color: ts.color }}>{m.tag}</span>}
              </div>
              {m.note && <p className="text-xs text-muted-foreground mt-0.5">{m.note}</p>}
            </div>
          );
        })}
        {section.content_md && (
          <p className="text-sm text-muted-foreground leading-relaxed mt-2">{section.content_md}</p>
        )}
      </CardContent>
    </Card>
  );
}
