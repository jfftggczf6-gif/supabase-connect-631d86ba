import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Building2, TrendingUp, Users, Target } from 'lucide-react';

export default function PortfolioTab() {
  const [stats, setStats] = useState<any>(null);
  const [enterprises, setEnterprises] = useState<any[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    // All enterprises with their scores
    const { data: ents } = await supabase
      .from('enterprises')
      .select('id, name, country, sector, score_ir, employees_count, created_at')
      .order('created_at', { ascending: false });

    const { data: deliverables } = await supabase
      .from('deliverables')
      .select('enterprise_id, type, score');

    if (!ents) return;

    // Compute stats per enterprise
    const enriched = ents.map(e => {
      const delivs = (deliverables || []).filter(d => d.enterprise_id === e.id);
      const scores = delivs.filter(d => d.score != null).map(d => Number(d.score));
      const avgScore = scores.length > 0 ? Math.round(scores.reduce((s, v) => s + v, 0) / scores.length) : 0;
      return { ...e, nb_deliverables: delivs.length, avg_score: avgScore, scores };
    });

    setEnterprises(enriched);

    // Aggregate stats
    const totalEnts = enriched.length;
    const withDeliverables = enriched.filter(e => e.nb_deliverables > 0).length;
    const avgScoreAll = enriched.filter(e => e.avg_score > 0).length > 0
      ? Math.round(enriched.filter(e => e.avg_score > 0).reduce((s, e) => s + e.avg_score, 0) / enriched.filter(e => e.avg_score > 0).length)
      : 0;

    // By country
    const byCountry: Record<string, number> = {};
    enriched.forEach(e => { byCountry[e.country || 'N/A'] = (byCountry[e.country || 'N/A'] || 0) + 1; });

    // By sector
    const bySector: Record<string, number> = {};
    enriched.forEach(e => { bySector[e.sector || 'N/A'] = (bySector[e.sector || 'N/A'] || 0) + 1; });

    // Funnel
    const funnel = {
      total: totalEnts,
      analysed: withDeliverables,
      scored_above_60: enriched.filter(e => e.avg_score >= 60).length,
      scored_above_70: enriched.filter(e => e.avg_score >= 70).length,
      ready: enriched.filter(e => e.avg_score >= 80).length,
    };

    setStats({ totalEnts, withDeliverables, avgScoreAll, byCountry, bySector, funnel });
  };

  if (!stats) return <p className="text-sm text-muted-foreground">Chargement...</p>;

  const scoreBg = (s: number) => s >= 70 ? 'bg-emerald-100 text-emerald-700' : s >= 40 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700';

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-5 gap-3">
        <Card><CardContent className="py-3 text-center">
          <Building2 className="h-5 w-5 mx-auto text-primary mb-1" />
          <p className="text-2xl font-bold">{stats.totalEnts}</p>
          <p className="text-[10px] text-muted-foreground">Entreprises</p>
        </CardContent></Card>
        <Card><CardContent className="py-3 text-center">
          <Target className="h-5 w-5 mx-auto text-primary mb-1" />
          <p className="text-2xl font-bold">{stats.withDeliverables}</p>
          <p className="text-[10px] text-muted-foreground">Analysées</p>
        </CardContent></Card>
        <Card><CardContent className="py-3 text-center">
          <TrendingUp className="h-5 w-5 mx-auto text-primary mb-1" />
          <p className="text-2xl font-bold">{stats.avgScoreAll}</p>
          <p className="text-[10px] text-muted-foreground">Score moyen</p>
        </CardContent></Card>
        <Card className="border-emerald-200"><CardContent className="py-3 text-center">
          <p className="text-2xl font-bold text-emerald-600">{stats.funnel.scored_above_70}</p>
          <p className="text-[10px] text-muted-foreground">Score &gt; 70</p>
        </CardContent></Card>
        <Card className="border-amber-200"><CardContent className="py-3 text-center">
          <p className="text-2xl font-bold text-amber-600">{stats.funnel.ready}</p>
          <p className="text-[10px] text-muted-foreground">Prêtes (&gt;80)</p>
        </CardContent></Card>
      </div>

      {/* Funnel */}
      <Card>
        <CardContent className="py-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Funnel pipeline</p>
          {[
            { label: 'Entreprises enregistrées', value: stats.funnel.total, pct: 100 },
            { label: 'Pipeline complété', value: stats.funnel.analysed, pct: Math.round((stats.funnel.analysed / stats.funnel.total) * 100) },
            { label: 'Score ≥ 60', value: stats.funnel.scored_above_60, pct: Math.round((stats.funnel.scored_above_60 / stats.funnel.total) * 100) },
            { label: 'Score ≥ 70 (éligibles)', value: stats.funnel.scored_above_70, pct: Math.round((stats.funnel.scored_above_70 / stats.funnel.total) * 100) },
            { label: 'Score ≥ 80 (prêtes)', value: stats.funnel.ready, pct: Math.round((stats.funnel.ready / stats.funnel.total) * 100) },
          ].map((step, i) => (
            <div key={i} className="flex items-center gap-3 mb-2">
              <span className="text-xs w-40 text-muted-foreground">{step.label}</span>
              <div className="flex-1 h-5 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary/70 rounded-full transition-all" style={{ width: `${step.pct}%` }} />
              </div>
              <span className="text-xs font-semibold w-16 text-right">{step.value} ({step.pct}%)</span>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* By country / sector */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="py-3">
            <p className="text-xs font-semibold mb-2">Par pays</p>
            {Object.entries(stats.byCountry).sort(([,a]: any, [,b]: any) => b - a).map(([country, count]: any) => (
              <div key={country} className="flex justify-between text-xs py-1 border-b border-border/50">
                <span>{country}</span><Badge variant="outline">{count}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3">
            <p className="text-xs font-semibold mb-2">Par secteur</p>
            {Object.entries(stats.bySector).sort(([,a]: any, [,b]: any) => b - a).slice(0, 8).map(([sector, count]: any) => (
              <div key={sector} className="flex justify-between text-xs py-1 border-b border-border/50">
                <span>{sector}</span><Badge variant="outline">{count}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Enterprise list */}
      <Card>
        <CardContent className="py-3">
          <p className="text-xs font-semibold mb-2">Classement entreprises</p>
          <div className="space-y-1">
            {enterprises.sort((a, b) => b.avg_score - a.avg_score).map((e, i) => (
              <div key={e.id} className="flex items-center gap-3 py-1.5 border-b border-border/30">
                <span className="text-xs text-muted-foreground w-6 text-right">{i + 1}.</span>
                <span className="text-xs font-medium flex-1">{e.name}</span>
                <span className="text-[10px] text-muted-foreground">{e.country}</span>
                <span className="text-[10px] text-muted-foreground">{e.nb_deliverables} livrables</span>
                <Badge className={`text-[10px] ${scoreBg(e.avg_score)}`}>{e.avg_score || '—'}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
