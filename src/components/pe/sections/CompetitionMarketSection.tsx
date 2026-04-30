import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Props { section: { content_md: string | null; content_json: any }; }

export default function CompetitionMarketSection({ section }: Props) {
  const bm = section.content_json?.benchmark;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Concurrence et marché — Benchmark sectoriel</CardTitle>
      </CardHeader>
      <CardContent>
        {bm?.headers?.length > 0 && bm?.rows?.length > 0 && (
          <div className="text-sm">
            <div className="grid grid-cols-4 border-b border-border text-[10px] text-muted-foreground py-1">
              <span>Ratio</span>
              {bm.headers.map((h: string, i: number) => <span key={i} className="text-right">{h}</span>)}
            </div>
            {bm.rows.map((r: any, i: number) => (
              <div key={i} className="grid grid-cols-4 py-1 border-b border-border/30">
                <span className="text-muted-foreground">{r.ratio}</span>
                <span className="text-right font-medium">{r.company}</span>
                <span className="text-right">{r.median}</span>
                <span className="text-right" style={{ color: 'var(--pe-ok)' }}>{r.quartile}</span>
              </div>
            ))}
          </div>
        )}
        {bm?.source && <p className="text-[10px] text-muted-foreground mt-1.5">Source : {bm.source}</p>}
        {section.content_md && (
          <p className="text-sm text-muted-foreground leading-relaxed mt-2">{section.content_md}</p>
        )}
      </CardContent>
    </Card>
  );
}
