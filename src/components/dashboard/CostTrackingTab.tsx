import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DollarSign, TrendingUp, Cpu } from 'lucide-react';
import { useOrganization } from '@/contexts/OrganizationContext';

export default function CostTrackingTab() {
  const { t } = useTranslation();
  const { currentOrg } = useOrganization();
  const [costs, setCosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [enterpriseNames, setEnterpriseNames] = useState<Record<string, string>>({});

  useEffect(() => {
    let costQuery = supabase.from('ai_cost_log').select('*').order('created_at', { ascending: false }).limit(500);
    if (currentOrg?.id) costQuery = costQuery.eq('organization_id', currentOrg.id);
    let entQuery = supabase.from('enterprises').select('id, name');
    if (currentOrg?.id) entQuery = entQuery.eq('organization_id', currentOrg.id);
    Promise.all([
      costQuery,
      entQuery,
    ]).then(([{ data: costData }, { data: entData }]) => {
      setCosts(costData || []);
      const names: Record<string, string> = {};
      (entData || []).forEach((e: any) => { names[e.id] = e.name; });
      setEnterpriseNames(names);
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

  // By agent (function_name)
  const byAgent: Record<string, { calls: number; cost: number }> = {};
  costs.forEach(c => {
    const fn = c.function_name || 'unknown';
    if (fn.includes('eventLoop')) return; // skip old bad logs
    if (!byAgent[fn]) byAgent[fn] = { calls: 0, cost: 0 };
    byAgent[fn].calls++;
    byAgent[fn].cost += Number(c.cost_usd || 0);
  });

  // By enterprise
  const byEnterprise: Record<string, { name: string; calls: number; cost: number }> = {};
  costs.forEach(c => {
    if (!c.enterprise_id) return;
    if (!byEnterprise[c.enterprise_id]) byEnterprise[c.enterprise_id] = { name: enterpriseNames[c.enterprise_id] || c.enterprise_id.slice(0, 8), calls: 0, cost: 0 };
    byEnterprise[c.enterprise_id].calls++;
    byEnterprise[c.enterprise_id].cost += Number(c.cost_usd || 0);
  });

  // Estimated costs
  const avgSonnet = byModel['claude-sonnet-4-6']?.calls ? byModel['claude-sonnet-4-6'].cost / byModel['claude-sonnet-4-6'].calls : 0.18;
  const avgOpus = byModel['claude-opus-4-6']?.calls ? byModel['claude-opus-4-6'].cost / byModel['claude-opus-4-6'].calls : 1.66;
  const avgSonnet4 = byModel['claude-sonnet-4-20250514']?.calls ? byModel['claude-sonnet-4-20250514'].cost / byModel['claude-sonnet-4-20250514'].calls : 0.08;
  const pipelineCost = avgOpus * 1 + avgSonnet * 10 + avgSonnet4 * 3;
  const diagnosticCost = avgSonnet;

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

      {/* Estimations */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="border-primary/20 bg-primary/5"><CardContent className="py-3 text-center">
          <p className="text-xs text-muted-foreground mb-1">Pipeline complet (1 entreprise)</p>
          <p className="text-2xl font-bold">${pipelineCost.toFixed(2)}</p>
          <p className="text-[10px] text-muted-foreground">1 Opus + 10 Sonnet 4.6 + 3 Sonnet 4.0</p>
        </CardContent></Card>
        <Card className="border-primary/20 bg-primary/5"><CardContent className="py-3 text-center">
          <p className="text-xs text-muted-foreground mb-1">Diagnostic candidature</p>
          <p className="text-2xl font-bold">${diagnosticCost.toFixed(2)}</p>
          <p className="text-[10px] text-muted-foreground">1 appel Sonnet 4.6</p>
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

      {/* By agent */}
      {Object.keys(byAgent).length > 0 && (
        <Card>
          <CardContent className="py-3">
            <p className="text-xs font-semibold mb-2">Par agent</p>
            {Object.entries(byAgent).sort(([,a], [,b]) => b.cost - a.cost).map(([fn, stats]) => (
              <div key={fn} className="flex items-center justify-between py-1 border-b border-border/30">
                <span className="text-xs">{fn}</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">{stats.calls} appels</span>
                  <span className="text-xs font-semibold">${stats.cost.toFixed(3)}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* By enterprise */}
      {Object.keys(byEnterprise).length > 0 && (
        <Card>
          <CardContent className="py-3">
            <p className="text-xs font-semibold mb-2">Par entreprise</p>
            {Object.entries(byEnterprise).sort(([,a], [,b]) => b.cost - a.cost).map(([id, stats]) => (
              <div key={id} className="flex items-center justify-between py-1 border-b border-border/30">
                <span className="text-xs">{stats.name}...</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">{stats.calls} appels</span>
                  <span className="text-xs font-semibold">${stats.cost.toFixed(3)}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

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
