import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DollarSign, TrendingUp, Cpu } from 'lucide-react';

export default function CostTrackingTab() {
  const [costs, setCosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('ai_cost_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200)
      .then(({ data }) => {
        setCosts(data || []);
        setLoading(false);
      });
  }, []);

  if (loading) return <p className="text-sm text-muted-foreground">Chargement...</p>;

  // Aggregate stats
  const totalCost = costs.reduce((s, c) => s + Number(c.cost_usd || 0), 0);
  const totalInput = costs.reduce((s, c) => s + (c.input_tokens || 0), 0);
  const totalOutput = costs.reduce((s, c) => s + (c.output_tokens || 0), 0);
  const nbCalls = costs.length;

  // By model
  const byModel: Record<string, { calls: number; cost: number; input: number; output: number }> = {};
  costs.forEach(c => {
    const m = c.model || 'unknown';
    if (!byModel[m]) byModel[m] = { calls: 0, cost: 0, input: 0, output: 0 };
    byModel[m].calls++;
    byModel[m].cost += Number(c.cost_usd || 0);
    byModel[m].input += c.input_tokens || 0;
    byModel[m].output += c.output_tokens || 0;
  });

  // By day
  const byDay: Record<string, number> = {};
  costs.forEach(c => {
    const day = c.created_at?.slice(0, 10) || 'unknown';
    byDay[day] = (byDay[day] || 0) + Number(c.cost_usd || 0);
  });

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-4 gap-3">
        <Card><CardContent className="py-3 text-center">
          <DollarSign className="h-5 w-5 mx-auto text-primary mb-1" />
          <p className="text-2xl font-bold">${totalCost.toFixed(2)}</p>
          <p className="text-[10px] text-muted-foreground">Coût total</p>
        </CardContent></Card>
        <Card><CardContent className="py-3 text-center">
          <Cpu className="h-5 w-5 mx-auto text-primary mb-1" />
          <p className="text-2xl font-bold">{nbCalls}</p>
          <p className="text-[10px] text-muted-foreground">Appels IA</p>
        </CardContent></Card>
        <Card><CardContent className="py-3 text-center">
          <TrendingUp className="h-5 w-5 mx-auto text-primary mb-1" />
          <p className="text-2xl font-bold">{(totalInput / 1000).toFixed(0)}K</p>
          <p className="text-[10px] text-muted-foreground">Tokens input</p>
        </CardContent></Card>
        <Card><CardContent className="py-3 text-center">
          <p className="text-2xl font-bold">{(totalOutput / 1000).toFixed(0)}K</p>
          <p className="text-[10px] text-muted-foreground">Tokens output</p>
        </CardContent></Card>
      </div>

      {/* By model */}
      <Card>
        <CardContent className="py-3">
          <p className="text-xs font-semibold mb-2">Par modèle</p>
          {Object.entries(byModel).sort(([,a], [,b]) => b.cost - a.cost).map(([model, stats]) => (
            <div key={model} className="flex items-center justify-between py-1.5 border-b border-border/30">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px]">{model.replace('claude-', '')}</Badge>
                <span className="text-xs text-muted-foreground">{stats.calls} appels</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">{(stats.input / 1000).toFixed(0)}K in / {(stats.output / 1000).toFixed(0)}K out</span>
                <span className="text-xs font-semibold">${stats.cost.toFixed(3)}</span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* By day */}
      <Card>
        <CardContent className="py-3">
          <p className="text-xs font-semibold mb-2">Par jour</p>
          {Object.entries(byDay).sort(([a], [b]) => b.localeCompare(a)).slice(0, 14).map(([day, cost]) => (
            <div key={day} className="flex items-center justify-between py-1 border-b border-border/30">
              <span className="text-xs">{day}</span>
              <span className="text-xs font-semibold">${cost.toFixed(3)}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Recent calls */}
      <Card>
        <CardContent className="py-3">
          <p className="text-xs font-semibold mb-2">Derniers appels</p>
          <div className="space-y-1">
            {costs.slice(0, 30).map((c, i) => (
              <div key={i} className="flex items-center justify-between py-1 border-b border-border/20 text-[11px]">
                <span className="text-muted-foreground w-32 truncate">{c.function_name}</span>
                <Badge variant="outline" className="text-[9px]">{(c.model || '').replace('claude-', '')}</Badge>
                <span className="text-muted-foreground">{c.input_tokens}+{c.output_tokens}</span>
                <span className="font-semibold">${Number(c.cost_usd).toFixed(4)}</span>
                <span className="text-muted-foreground">{c.created_at?.slice(11, 16)}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {costs.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Aucun coût enregistré — les données apparaîtront après la prochaine génération.</p>}
    </div>
  );
}
