import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Props { section: { content_md: string | null; content_json: any }; }

export default function ServicesSection({ section }: Props) {
  const activite: string | undefined = section.content_json?.activite;
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">Services</CardTitle></CardHeader>
      <CardContent>
        {activite && <p className="text-sm leading-relaxed mb-2">{activite}</p>}
        {section.content_md && (
          <p className="text-sm text-muted-foreground leading-relaxed">{section.content_md}</p>
        )}
      </CardContent>
    </Card>
  );
}
