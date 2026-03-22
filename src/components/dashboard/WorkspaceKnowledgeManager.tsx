import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { RefreshCw, Database, BarChart3, Globe, AlertTriangle } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface Benchmark {
  id: string; secteur: string; pays: string; zone: string;
  marge_brute_min: number; marge_brute_max: number; marge_brute_mediane: number;
  marge_ebitda_min: number; marge_ebitda_max: number;
  multiple_ebitda_min: number; multiple_ebitda_max: number;
  source: string; date_mise_a_jour: string;
}

interface RiskParam {
  id: string; pays: string; zone: string;
  risk_free_rate: number; equity_risk_premium: number; country_risk_premium: number;
  cost_of_debt: number; tax_rate: number; taux_directeur: number;
  risque_pays_label: string; source: string;
}

interface CountryData {
  id: string; pays: string; devise: string; taux_is: number; taux_tva: number;
  pib_usd_millions: number; croissance_pib_pct: number; inflation_pct: number;
  taux_emprunt_pme: number; source: string;
}

interface RiskFactor {
  id: string; code: string; categorie: string; titre: string; severity: string;
  description: string; is_active: boolean; source: string;
}

interface AggBenchmark {
  id: string; secteur: string; pays: string; nb_entreprises: number;
  marge_brute_mediane: number; derniere_agregation: string;
}

export default function WorkspaceKnowledgeManager() {
  const [benchmarks, setBenchmarks] = useState<Benchmark[]>([]);
  const [riskParams, setRiskParams] = useState<RiskParam[]>([]);
  const [countryData, setCountryData] = useState<CountryData[]>([]);
  const [riskFactors, setRiskFactors] = useState<RiskFactor[]>([]);
  const [aggBenchmarks, setAggBenchmarks] = useState<AggBenchmark[]>([]);
  const [loading, setLoading] = useState(true);
  const [aggregating, setAggregating] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    const [bRes, rpRes, cdRes, rfRes, abRes] = await Promise.all([
      supabase.from('knowledge_benchmarks' as any).select('*').order('secteur'),
      supabase.from('knowledge_risk_params' as any).select('*').order('pays'),
      supabase.from('knowledge_country_data' as any).select('*').order('pays'),
      supabase.from('knowledge_risk_factors' as any).select('*').order('severity'),
      supabase.from('aggregated_benchmarks' as any).select('*').order('nb_entreprises', { ascending: false }),
    ]);
    if (bRes.data) setBenchmarks(bRes.data as any);
    if (rpRes.data) setRiskParams(rpRes.data as any);
    if (cdRes.data) setCountryData(cdRes.data as any);
    if (rfRes.data) setRiskFactors(rfRes.data as any);
    if (abRes.data) setAggBenchmarks(abRes.data as any);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  const handleAggregate = async () => {
    setAggregating(true);
    try {
      const { data, error } = await supabase.functions.invoke('aggregate-benchmarks');
      if (error) throw error;
      toast.success(`Agrégation terminée: ${data?.aggregated || 0} secteurs mis à jour`);
      fetchAll();
    } catch (e: any) {
      toast.error(e.message || 'Erreur lors de l\'agrégation');
    } finally {
      setAggregating(false);
    }
  };

  const severityColor = (s: string) => {
    switch (s) {
      case 'critical': return 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300';
      case 'high': return 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300';
      case 'medium': return 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  if (loading) return <p className="text-sm text-muted-foreground p-4">Chargement de la KB…</p>;

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { icon: BarChart3, label: 'Benchmarks', value: benchmarks.length },
          { icon: Globe, label: 'Pays (WACC)', value: riskParams.length },
          { icon: Globe, label: 'Pays (macro)', value: countryData.length },
          { icon: AlertTriangle, label: 'Risques terrain', value: riskFactors.length },
          { icon: Database, label: 'Auto-enrichis', value: aggBenchmarks.length },
        ].map((s, i) => (
          <Card key={i} className="bg-card">
            <CardContent className="p-3 flex items-center gap-2">
              <s.icon className="h-4 w-4 text-primary" />
              <div>
                <p className="text-lg font-bold">{s.value}</p>
                <p className="text-[10px] text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="benchmarks">
        <TabsList className="flex-wrap">
          <TabsTrigger value="benchmarks">Benchmarks sectoriels</TabsTrigger>
          <TabsTrigger value="wacc">WACC / Risque pays</TabsTrigger>
          <TabsTrigger value="macro">Données macro</TabsTrigger>
          <TabsTrigger value="risks">Risques terrain</TabsTrigger>
          <TabsTrigger value="aggregated">Auto-enrichis</TabsTrigger>
        </TabsList>

        <TabsContent value="benchmarks">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Benchmarks sectoriels ({benchmarks.length} secteurs)</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Secteur</TableHead>
                    <TableHead>Marge brute</TableHead>
                    <TableHead>Marge EBITDA</TableHead>
                    <TableHead>Multiple EBITDA</TableHead>
                    <TableHead>Source</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {benchmarks.map(b => (
                    <TableRow key={b.id}>
                      <TableCell className="font-medium text-xs">{b.secteur}</TableCell>
                      <TableCell className="text-xs">{b.marge_brute_min}-{b.marge_brute_max}% (méd. {b.marge_brute_mediane}%)</TableCell>
                      <TableCell className="text-xs">{b.marge_ebitda_min}-{b.marge_ebitda_max}%</TableCell>
                      <TableCell className="text-xs">{b.multiple_ebitda_min}-{b.multiple_ebitda_max}×</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{b.source}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="wacc">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Paramètres WACC par pays ({riskParams.length})</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pays</TableHead>
                    <TableHead>Zone</TableHead>
                    <TableHead>Rf</TableHead>
                    <TableHead>ERP</TableHead>
                    <TableHead>CRP</TableHead>
                    <TableHead>Coût dette</TableHead>
                    <TableHead>IS</TableHead>
                    <TableHead>Risque</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {riskParams.map(r => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium text-xs">{r.pays}</TableCell>
                      <TableCell><Badge variant="outline" className="text-[10px]">{r.zone}</Badge></TableCell>
                      <TableCell className="text-xs">{r.risk_free_rate}%</TableCell>
                      <TableCell className="text-xs">{r.equity_risk_premium}%</TableCell>
                      <TableCell className="text-xs">{r.country_risk_premium}%</TableCell>
                      <TableCell className="text-xs">{r.cost_of_debt}%</TableCell>
                      <TableCell className="text-xs">{r.tax_rate}%</TableCell>
                      <TableCell><Badge className={severityColor(r.country_risk_premium > 12 ? 'high' : r.country_risk_premium > 10 ? 'medium' : 'low')} variant="outline">{r.risque_pays_label}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="macro">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Données macro pays ({countryData.length})</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pays</TableHead>
                    <TableHead>Devise</TableHead>
                    <TableHead>PIB (M USD)</TableHead>
                    <TableHead>Croissance</TableHead>
                    <TableHead>Inflation</TableHead>
                    <TableHead>IS</TableHead>
                    <TableHead>TVA</TableHead>
                    <TableHead>Taux PME</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {countryData.map(c => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium text-xs">{c.pays}</TableCell>
                      <TableCell className="text-xs">{c.devise}</TableCell>
                      <TableCell className="text-xs">{c.pib_usd_millions?.toLocaleString('fr-FR')}</TableCell>
                      <TableCell className="text-xs">{c.croissance_pib_pct}%</TableCell>
                      <TableCell className="text-xs">{c.inflation_pct}%</TableCell>
                      <TableCell className="text-xs">{c.taux_is}%</TableCell>
                      <TableCell className="text-xs">{c.taux_tva}%</TableCell>
                      <TableCell className="text-xs">{c.taux_emprunt_pme}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="risks">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Risques terrain ({riskFactors.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {riskFactors.map(rf => (
                  <div key={rf.id} className="p-3 rounded-lg border bg-card">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className={severityColor(rf.severity)}>{rf.severity}</Badge>
                      <Badge variant="outline" className="text-[10px]">{rf.categorie}</Badge>
                      <span className="font-medium text-sm">{rf.titre}</span>
                      <span className="text-[10px] text-muted-foreground ml-auto">{rf.code}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{rf.description}</p>
                    {rf.source && <p className="text-[10px] text-muted-foreground mt-1">Source: {rf.source}</p>}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="aggregated">
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm">Benchmarks auto-enrichis ({aggBenchmarks.length})</CardTitle>
              <Button size="sm" variant="outline" onClick={handleAggregate} disabled={aggregating} className="gap-1.5">
                <RefreshCw className={`h-3.5 w-3.5 ${aggregating ? 'animate-spin' : ''}`} />
                Lancer l'agrégation
              </Button>
            </CardHeader>
            <CardContent>
              {aggBenchmarks.length === 0 ? (
                <p className="text-sm text-muted-foreground p-4">Aucun benchmark agrégé. Lancez l'agrégation quand suffisamment d'entreprises ont été analysées.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Secteur</TableHead>
                      <TableHead>Pays</TableHead>
                      <TableHead>Nb entreprises</TableHead>
                      <TableHead>Marge brute méd.</TableHead>
                      <TableHead>Dernière agrégation</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {aggBenchmarks.map(a => (
                      <TableRow key={a.id}>
                        <TableCell className="font-medium text-xs">{a.secteur}</TableCell>
                        <TableCell className="text-xs">{a.pays}</TableCell>
                        <TableCell className="text-xs">{a.nb_entreprises}</TableCell>
                        <TableCell className="text-xs">{a.marge_brute_mediane}%</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {a.derniere_agregation ? new Date(a.derniere_agregation).toLocaleDateString('fr-FR') : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
