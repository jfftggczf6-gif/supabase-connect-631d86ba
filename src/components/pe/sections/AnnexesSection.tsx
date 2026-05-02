import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import ReactMarkdown from 'react-markdown';
import { CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import DocCategoryCard from '@/components/dashboard/viewers/atoms/pe/DocCategoryCard';

interface Props {
  section: { content_md: string | null; content_json: any };
  allSections?: Record<string, any>;
}

const SubHeading = ({ children }: { children: React.ReactNode }) => (
  <h4 className="text-xs font-bold uppercase tracking-wide text-foreground mb-2 mt-3">{children}</h4>
);

const STATUS_ICON: Record<string, React.ReactNode> = {
  ok:      <CheckCircle2 className="h-3.5 w-3.5 inline" style={{ color: 'var(--pe-ok)' }} />,
  partial: <AlertCircle className="h-3.5 w-3.5 inline" style={{ color: 'var(--pe-warning)' }} />,
  missing: <XCircle className="h-3.5 w-3.5 inline" style={{ color: 'var(--pe-danger)' }} />,
};

export default function AnnexesSection({ section }: Props) {
  const cj = section.content_json ?? {};
  const meta = cj.meta;
  const inventaire = cj.inventaire_documentaire; // { items: [{label, status, note}], summary }
  const knowledgeBase = cj.knowledge_base_refs; // [{name, description}]
  const historique = cj.historique_modifications; // [{date, actor, action}]
  const docQuality = cj.doc_quality; // legacy : { categories, global_level, summary }
  const footer = cj.footer;

  return (
    <Card>
      <CardHeader className="pb-2 space-y-2">
        <CardTitle className="text-base">Annexes</CardTitle>
        {meta && (
          <div className="flex flex-wrap gap-1.5 text-[11px]">
            {meta.redige_par && <Badge variant="outline" style={{ background: 'var(--pe-bg-info)', color: 'var(--pe-info)', border: 'none' }}>Rédigé : {meta.redige_par}</Badge>}
            {meta.review_par && <Badge variant="outline" style={{ background: 'var(--pe-bg-purple)', color: 'var(--pe-purple)', border: 'none' }}>Review : {meta.review_par}</Badge>}
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {inventaire?.items?.length > 0 && (
          <div>
            <SubHeading>Inventaire documentaire</SubHeading>
            <div className="space-y-1 text-sm">
              {inventaire.items.map((it: any, i: number) => (
                <div key={i} className="flex justify-between items-start border-b border-border/30 py-1">
                  <span className="flex-1">{it.label}</span>
                  <span className="flex items-center gap-1.5 text-xs" style={{ color: it.status === 'ok' ? 'var(--pe-ok)' : it.status === 'partial' ? 'var(--pe-warning)' : 'var(--pe-danger)' }}>
                    {STATUS_ICON[it.status]} {it.note ?? (it.status === 'ok' ? 'Fourni' : it.status === 'partial' ? 'Partiel' : 'Manquant')}
                  </span>
                </div>
              ))}
            </div>
            {inventaire.summary && <p className="text-sm mt-2 font-medium">{inventaire.summary}</p>}
          </div>
        )}

        {/* Doc quality legacy : grid catégories N0/N1/N2 */}
        {docQuality?.categories?.length > 0 && !inventaire && (
          <div>
            <SubHeading>Qualité du dossier documentaire</SubHeading>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {docQuality.categories.map((c: any, i: number) => (
                <DocCategoryCard key={i} name={c.name} level={c.level} checklist={c.checklist} />
              ))}
            </div>
            {(docQuality.global_level || docQuality.summary) && (
              <div className="border-t mt-2 pt-2 text-sm">
                {docQuality.global_level && <span className="font-medium" style={{ color: 'var(--pe-warning)' }}>Score qualité global : {docQuality.global_level} </span>}
                {docQuality.summary && <span className="text-muted-foreground">— {docQuality.summary}</span>}
              </div>
            )}
          </div>
        )}

        {knowledgeBase?.length > 0 && (
          <div>
            <SubHeading>Références knowledge base utilisées</SubHeading>
            <ul className="list-disc list-inside space-y-1 text-sm">
              {knowledgeBase.map((k: any, i: number) => (
                <li key={i}>
                  <strong>{k.name}</strong>{k.description && <> — <span className="text-muted-foreground">{k.description}</span></>}
                </li>
              ))}
            </ul>
          </div>
        )}

        {historique?.length > 0 && (
          <div>
            <SubHeading>Historique des modifications</SubHeading>
            <div className="space-y-1 text-xs">
              {historique.map((h: any, i: number) => (
                <div key={i} className="flex gap-3 border-l-2 border-border pl-2 py-0.5">
                  <span className="text-muted-foreground w-20 shrink-0">{h.date}</span>
                  <span><strong>{h.actor}</strong> — {h.action}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {section.content_md && (
          <div className="prose prose-sm max-w-none text-foreground border-t pt-2">
            <ReactMarkdown>{section.content_md}</ReactMarkdown>
          </div>
        )}

        {footer && (
          <div className="rounded px-3 py-2 text-[11px] mt-2" style={{ background: 'var(--pe-bg-info)', color: 'var(--pe-info)' }}>
            Section 12 · {footer.redige_par && `Rédigée par ${footer.redige_par}`} {footer.date ? `le ${footer.date}` : ''}
            {footer.sources && <p className="mt-0.5">Sources : {footer.sources}</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
