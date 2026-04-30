import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Props { section: { content_md: string | null; content_json: any }; }

export default function ShareholdingGovernanceSection({ section }: Props) {
  const items: any[] = section.content_json?.actionnariat?.items ?? [];
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">Actionnariat et gouvernance</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {items.length > 0 && (
          <div className="space-y-1 text-sm">
            {items.map((it: any, i: number) => (
              <div key={i} className="flex justify-between border-b border-border/50 py-1">
                <div>
                  <span className="font-medium">{it.label}</span>
                  {it.subtitle && <span className="text-xs text-muted-foreground ml-2">{it.subtitle}</span>}
                </div>
                {it.percent != null && <span className="font-medium">{it.percent}%</span>}
              </div>
            ))}
          </div>
        )}
        {section.content_md && (
          <p className="text-sm text-muted-foreground leading-relaxed mt-2">{section.content_md}</p>
        )}
      </CardContent>
    </Card>
  );
}
