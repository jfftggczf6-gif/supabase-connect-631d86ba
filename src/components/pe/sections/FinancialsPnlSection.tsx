import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import FinancialTable from '@/components/dashboard/viewers/atoms/pe/FinancialTable';

interface Props { section: { content_md: string | null; content_json: any }; }

export default function FinancialsPnlSection({ section }: Props) {
  const snap = section.content_json?.snapshot_3y;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">États financiers PnL — Snapshot 3 ans</CardTitle>
      </CardHeader>
      <CardContent>
        {snap?.headers?.length > 0 && snap?.rows?.length > 0 && (
          <FinancialTable headers={snap.headers} rows={snap.rows} footnote={snap.footnote} />
        )}
        {section.content_md && (
          <p className="text-sm text-muted-foreground leading-relaxed mt-2">{section.content_md}</p>
        )}
      </CardContent>
    </Card>
  );
}
