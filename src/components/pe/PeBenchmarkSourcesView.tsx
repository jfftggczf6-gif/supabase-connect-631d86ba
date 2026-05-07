import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, ExternalLink, BookMarked, Database, TrendingUp, Globe, Users, AlertTriangle, Target } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface Props {
  dealId: string;
}

interface CompetitorRow {
  name: string;
  ca?: string;
  pdm?: string;
  marge?: string;
  cagr?: string;
  analyse?: string;
  highlight?: string;
  cagr_color?: string;
}

interface MegatrendItem {
  label: string;
  value?: string;
  hint?: string;
  color?: string;
}

interface ThreatItem {
  title: string;
  body?: string;
  probability?: string;
}

interface MarketSizing {
  tam?: string;
  sam?: string;
  som?: string;
}

// Construit un résumé markdown à partir des paragraphes structurés de competition_market.
function buildMarketAnalysisMd(contentMd: string | null, json: any): string | null {
  if (json && typeof json === 'object') {
    const parts: string[] = [];
    const positionnement = json.positionnement?.paragraphs;
    if (Array.isArray(positionnement) && positionnement.length) {
      parts.push('**Positionnement & dynamique concurrentielle**\n\n' + positionnement.join('\n\n'));
    }
    const reglementation = json.reglementation?.paragraphs;
    if (Array.isArray(reglementation) && reglementation.length) {
      parts.push('**Réglementation & barrières**\n\n' + reglementation.join('\n\n'));
    }
    if (typeof json.senegal_analysis === 'string' && json.senegal_analysis.trim()) {
      parts.push('**Analyse pays / régionale**\n\n' + json.senegal_analysis);
    }
    if (parts.length) return parts.join('\n\n');
  }
  return contentMd && contentMd.trim() ? contentMd : null;
}

const PROBABILITY_STYLE: Record<string, string> = {
  'très faible': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'faible':      'bg-emerald-50 text-emerald-700 border-emerald-200',
  'modérée':     'bg-amber-50 text-amber-700 border-amber-200',
  'élevée':      'bg-red-50 text-red-700 border-red-200',
  'très élevée': 'bg-red-50 text-red-700 border-red-200',
};

export default function PeBenchmarkSourcesView({ dealId }: Props) {
  const [loading, setLoading] = useState(true);
  const [benchmarkData, setBenchmarkData] = useState<any>(null);
  const [marketAnalysis, setMarketAnalysis] = useState<string | null>(null);
  const [marketSizing, setMarketSizing] = useState<MarketSizing | null>(null);
  const [megatrends, setMegatrends] = useState<MegatrendItem[]>([]);
  const [competitors, setCompetitors] = useState<CompetitorRow[]>([]);
  const [threats, setThreats] = useState<ThreatItem[]>([]);
  const [citedSources, setCitedSources] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);

      const { data: memo } = await supabase
        .from('investment_memos').select('id').eq('deal_id', dealId).maybeSingle();

      let benchmark: any = null;
      let analysis: string | null = null;
      let sizing: MarketSizing | null = null;
      let trends: MegatrendItem[] = [];
      let comps: CompetitorRow[] = [];
      let menaces: ThreatItem[] = [];
      const cited: Set<string> = new Set();

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
              const cj = s.content_json ?? {};
              benchmark = cj.benchmark ?? null;
              analysis = buildMarketAnalysisMd(s.content_md, cj);
              if (cj.tam_sam_som && typeof cj.tam_sam_som === 'object') {
                sizing = { tam: cj.tam_sam_som.tam, sam: cj.tam_sam_som.sam, som: cj.tam_sam_som.som };
              }
              if (Array.isArray(cj.megatrends)) trends = cj.megatrends;
              if (Array.isArray(cj.concurrents?.rows)) comps = cj.concurrents.rows;
              if (Array.isArray(cj.menaces)) menaces = cj.menaces;
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
      setBenchmarkData(benchmark);
      setMarketAnalysis(analysis);
      setMarketSizing(sizing);
      setMegatrends(trends);
      setCompetitors(comps);
      setThreats(menaces);
      setCitedSources(Array.from(cited).slice(0, 30));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [dealId]);

  if (loading) {
    return <div className="flex items-center gap-2 p-8 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Chargement...</div>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <BookMarked className="h-5 w-5" /> Benchmark & sources
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          Tableau de bord complet pour se rassurer sur le deal : benchmark sectoriel, taille du marché, tendances, concurrents, risques et sources mobilisées.
        </p>
      </div>

      {/* 1. Benchmark sectoriel — table de ratios financiers */}
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

      {/* 2. Taille du marché — TAM / SAM / SOM */}
      {marketSizing && (marketSizing.tam || marketSizing.sam || marketSizing.som) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="h-4 w-4" /> Taille du marché — TAM / SAM / SOM
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {marketSizing.tam && (
              <div>
                <div className="text-[10px] uppercase tracking-wider text-violet-600 font-semibold mb-1">TAM — Total Addressable Market</div>
                <p className="text-sm leading-relaxed">{marketSizing.tam}</p>
              </div>
            )}
            {marketSizing.sam && (
              <div>
                <div className="text-[10px] uppercase tracking-wider text-violet-600 font-semibold mb-1">SAM — Serviceable Available Market</div>
                <p className="text-sm leading-relaxed">{marketSizing.sam}</p>
              </div>
            )}
            {marketSizing.som && (
              <div>
                <div className="text-[10px] uppercase tracking-wider text-violet-600 font-semibold mb-1">SOM — Serviceable Obtainable Market</div>
                <p className="text-sm leading-relaxed">{marketSizing.som}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 3. Mégatendances sectorielles */}
      {megatrends.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Globe className="h-4 w-4" /> Mégatendances sectorielles
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {megatrends.map((m, i) => (
                <div key={i} className="border rounded-md p-3 bg-muted/20">
                  <div className="text-xs font-semibold mb-1">{m.label}</div>
                  {m.value && (
                    <div className="text-base font-bold mb-1" style={{ color: m.color === 'ok' ? 'var(--pe-ok)' : undefined }}>
                      {m.value}
                    </div>
                  )}
                  {m.hint && <p className="text-[11px] text-muted-foreground leading-relaxed">{m.hint}</p>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 4. Tableau des concurrents */}
      {competitors.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" /> Paysage concurrentiel
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b text-[10px] text-muted-foreground uppercase tracking-wider">
                    <th className="text-left py-2 pr-2 font-medium">Concurrent</th>
                    <th className="text-right py-2 px-2 font-medium">CA (Mds)</th>
                    <th className="text-right py-2 px-2 font-medium">PdM</th>
                    <th className="text-right py-2 px-2 font-medium">Marge</th>
                    <th className="text-right py-2 px-2 font-medium">CAGR</th>
                  </tr>
                </thead>
                <tbody>
                  {competitors.map((c, i) => (
                    <tr key={i} className={`border-b border-border/30 ${c.highlight === 'self' ? 'bg-violet-50/50' : ''}`}>
                      <td className="py-2 pr-2 font-medium">
                        {c.name}
                        {c.highlight === 'self' && <span className="ml-2 text-[9px] uppercase text-violet-600 font-semibold">cible</span>}
                      </td>
                      <td className="py-2 px-2 text-right tabular-nums">{c.ca ?? '—'}</td>
                      <td className="py-2 px-2 text-right tabular-nums">{c.pdm ?? '—'}</td>
                      <td className="py-2 px-2 text-right tabular-nums">{c.marge ?? '—'}</td>
                      <td className="py-2 px-2 text-right tabular-nums" style={{ color: c.cagr_color === 'ok' ? 'var(--pe-ok)' : undefined }}>
                        {c.cagr ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {competitors.some(c => c.analyse) && (
              <div className="mt-4 space-y-2 text-xs">
                {competitors.filter(c => c.analyse).map((c, i) => (
                  <div key={i} className="border-l-2 border-violet-200 pl-3 py-1">
                    <div className="font-semibold">{c.name}</div>
                    <p className="text-muted-foreground leading-relaxed">{c.analyse}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 5. Analyse concurrentielle & marché — résumé texte */}
      {marketAnalysis && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4" /> Analyse concurrentielle & marché
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm max-w-none text-sm leading-relaxed">
              <ReactMarkdown>{marketAnalysis}</ReactMarkdown>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 6. Menaces / risques marché */}
      {threats.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" /> Menaces & risques marché
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {threats.map((t, i) => (
                <div key={i} className="border rounded-md p-3">
                  <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
                    <div className="text-sm font-semibold">{t.title}</div>
                    {t.probability && (
                      <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border ${PROBABILITY_STYLE[t.probability.toLowerCase()] ?? 'bg-muted text-muted-foreground border-border'}`}>
                        {t.probability}
                      </span>
                    )}
                  </div>
                  {t.body && <p className="text-xs text-muted-foreground leading-relaxed">{t.body}</p>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 7. Sources citées par l'IA dans le contenu */}
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
