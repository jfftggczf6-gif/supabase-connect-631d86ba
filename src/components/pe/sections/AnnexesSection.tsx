import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import ReactMarkdown from 'react-markdown';
import { CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import DocCategoryCard from '@/components/dashboard/viewers/atoms/pe/DocCategoryCard';
import NarrativeBlock from './NarrativeBlock';
import SectionMetadataFooter from './SectionMetadataFooter';

interface Props {
  section: { content_md: string | null; content_json: any };
  allSections?: Record<string, any>;
}

const STATUS_ICON: Record<string, React.ReactNode> = {
  ok:      <CheckCircle2 className="h-3.5 w-3.5 inline text-emerald-600" />,
  partial: <AlertCircle className="h-3.5 w-3.5 inline text-amber-600" />,
  missing: <XCircle className="h-3.5 w-3.5 inline text-red-500" />,
};

export default function AnnexesSection({ section }: Props) {
  const cj = section.content_json ?? {};
  const meta = cj.meta;
  const inventaire = cj.inventaire_documentaire;
  const knowledgeBase = cj.knowledge_base_refs;
  const historique = cj.historique_modifications;
  const docQuality = cj.doc_quality;
  const footer = cj.footer;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Annexes</CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {inventaire?.items?.length > 0 && (
          <NarrativeBlock title="Inventaire documentaire">
            <div className="space-y-1">
              {inventaire.items.map((it: any, i: number) => (
                <div key={i} className="flex justify-between items-start border-b border-border/30 py-1">
                  <span className="flex-1">{it.label}</span>
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    {STATUS_ICON[it.status]} {it.note ?? (it.status === 'ok' ? 'Fourni' : it.status === 'partial' ? 'Partiel' : 'Manquant')}
                  </span>
                </div>
              ))}
            </div>
            {inventaire.summary && <p className="mt-3 pt-2 border-t border-dashed border-border font-medium">{inventaire.summary}</p>}
          </NarrativeBlock>
        )}

        {docQuality?.categories?.length > 0 && !inventaire && (
          <NarrativeBlock title="Qualité du dossier documentaire">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {docQuality.categories.map((c: any, i: number) => (
                <DocCategoryCard key={i} name={c.name} level={c.level} checklist={c.checklist} />
              ))}
            </div>
            {(docQuality.global_level || docQuality.summary) && (
              <div className="mt-3 pt-2 border-t border-dashed border-border">
                {docQuality.global_level && <span className="font-medium">Score qualité global : {docQuality.global_level} </span>}
                {docQuality.summary && <span className="text-muted-foreground">— {docQuality.summary}</span>}
              </div>
            )}
          </NarrativeBlock>
        )}

        {knowledgeBase?.length > 0 && (
          <NarrativeBlock title="Références knowledge base utilisées">
            <ul className="list-disc list-inside space-y-1">
              {knowledgeBase.map((k: any, i: number) => (
                <li key={i}>
                  <strong>{k.name}</strong>{k.description && <> — <span className="text-muted-foreground">{k.description}</span></>}
                </li>
              ))}
            </ul>
          </NarrativeBlock>
        )}

        {historique?.length > 0 && (
          <NarrativeBlock title="Historique des modifications">
            <div className="space-y-1 text-xs">
              {historique.map((h: any, i: number) => (
                <div key={i} className="flex gap-3 border-l-2 border-border pl-2 py-0.5">
                  <span className="text-muted-foreground w-20 shrink-0">{h.date}</span>
                  <span><strong>{h.actor}</strong> — {h.action}</span>
                </div>
              ))}
            </div>
          </NarrativeBlock>
        )}

        {section.content_md && (
          <NarrativeBlock title="Notes complémentaires">
            <div className="prose prose-sm max-w-none text-foreground">
              <ReactMarkdown>{section.content_md}</ReactMarkdown>
            </div>
          </NarrativeBlock>
        )}

        <SectionMetadataFooter meta={meta} footer={footer} />
      </CardContent>
    </Card>
  );
}
