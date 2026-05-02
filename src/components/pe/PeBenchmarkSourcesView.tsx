import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, FileText, ExternalLink, BookMarked, Database } from 'lucide-react';

interface Props {
  dealId: string;
}

interface DocRow {
  id: string;
  filename: string;
  category: string | null;
  size_bytes: number | null;
  created_at: string;
}

export default function PeBenchmarkSourcesView({ dealId }: Props) {
  const [loading, setLoading] = useState(true);
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [benchmarkData, setBenchmarkData] = useState<any>(null);
  const [citedSources, setCitedSources] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);

      // 1) Documents uploadés
      const { data: docsRes } = await supabase
        .from('pe_deal_documents')
        .select('id, filename, category, size_bytes, created_at')
        .eq('deal_id', dealId)
        .order('created_at', { ascending: false });

      // 2) Dernière version pre_screening + sa section competition_market (benchmark)
      const { data: memo } = await supabase
        .from('investment_memos').select('id').eq('deal_id', dealId).maybeSingle();

      let benchmark: any = null;
      let cited: Set<string> = new Set();

      if (memo) {
        const { data: vers } = await supabase
          .from('memo_versions')
          .select('id, status, memo_sections(section_code, content_md, content_json)')
          .eq('memo_id', memo.id)
          .eq('status', 'ready')
          .order('created_at', { ascending: false })
          .limit(1);
        const v = vers?.[0];
        if (v) {
          (v.memo_sections ?? []).forEach((s: any) => {
            if (s.section_code === 'competition_market') {
              benchmark = s.content_json?.benchmark ?? null;
            }
            // Extraction sources citées : pattern [Source: ...] ou [<nom> <année>]
            if (s.content_md) {
              const matches = (s.content_md as string).matchAll(/\[(?:Source\s*:\s*)?([^\]]{4,80})\]/gi);
              for (const m of matches) {
                cited.add(m[1].trim());
              }
            }
          });
        }
      }

      if (cancelled) return;
      setDocs((docsRes ?? []) as DocRow[]);
      setBenchmarkData(benchmark);
      setCitedSources(Array.from(cited).slice(0, 30));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [dealId]);

  if (loading) {
    return <div className="flex items-center gap-2 p-8 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Chargement...</div>;
  }

  return (
    <div className="space-y-4 max-w-4xl">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <BookMarked className="h-5 w-5" /> Benchmark & sources
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          Toutes les sources mobilisées pour produire le dossier d'investissement (documents internes, base de connaissance, citations IA).
          Pour la transparence et la robustesse de la recommandation.
        </p>
      </div>

      {/* Benchmark sectoriel principal */}
      {benchmarkData && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Database className="h-4 w-4" /> Benchmark sectoriel
            </CardTitle>
          </CardHeader>
          <CardContent>
            {benchmarkData.headers?.length > 0 && benchmarkData.rows?.length > 0 ? (
              <div className="text-sm overflow-x-auto">
                <div className="grid border-b border-border text-[10px] text-muted-foreground py-1" style={{ gridTemplateColumns: `2fr ${benchmarkData.headers.map(() => '1fr').join(' ')}` }}>
                  <span>Ratio</span>
                  {benchmarkData.headers.map((h: string, i: number) => <span key={i} className="text-right">{h}</span>)}
                </div>
                {benchmarkData.rows.map((r: any, i: number) => (
                  <div key={i} className="grid py-1 border-b border-border/30" style={{ gridTemplateColumns: `2fr ${benchmarkData.headers.map(() => '1fr').join(' ')}` }}>
                    <span className="text-muted-foreground">{r.ratio}</span>
                    <span className="text-right font-medium">{r.company}</span>
                    <span className="text-right">{r.median}</span>
                    <span className="text-right" style={{ color: 'var(--pe-ok)' }}>{r.quartile}</span>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-muted-foreground">Pas de données de benchmark structurées dans cette version.</p>}
            {benchmarkData.source && (
              <p className="text-[11px] text-muted-foreground mt-2 pt-2 border-t">
                <strong>Source agrégée :</strong> {benchmarkData.source}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Documents internes */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" /> Pièces uploadées ({docs.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {docs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune pièce uploadée pour ce deal.</p>
          ) : (
            <div className="space-y-1">
              {docs.map(d => (
                <div key={d.id} className="flex justify-between items-center border-b border-border/30 py-1.5 text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="truncate">{d.filename}</span>
                    {d.category && <Badge variant="outline" className="text-[10px]">{d.category}</Badge>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2 text-xs text-muted-foreground">
                    {d.size_bytes && <span>{(d.size_bytes / 1024 / 1024).toFixed(1)} Mo</span>}
                    <span>{new Date(d.created_at).toLocaleDateString('fr-FR')}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sources citées par l'IA dans le contenu */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <ExternalLink className="h-4 w-4" /> Sources citées dans l'analyse ({citedSources.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {citedSources.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucune citation explicite détectée dans le contenu généré.
              Les sources citées apparaissent sous forme [Source: ...] dans le markdown des sections.
            </p>
          ) : (
            <div className="space-y-1">
              {citedSources.map((src, i) => (
                <div key={i} className="text-xs px-2 py-1 bg-muted/50 rounded">
                  <span className="text-muted-foreground">[{i + 1}]</span> {src}
                </div>
              ))}
            </div>
          )}
          <p className="text-[11px] text-muted-foreground mt-3 pt-2 border-t">
            <strong>À venir :</strong> intégration de la base de connaissance (knowledge_benchmarks),
            web search citations, et croisement automatique avec les bases sectorielles IFC / Damodaran.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
