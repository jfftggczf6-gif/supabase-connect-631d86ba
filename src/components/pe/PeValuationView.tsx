// PeValuationView — Vue dédiée valuation détaillée (DCF + Multiples + ANCC + Synthèse).
// Lecture seule, alimentée par l'edge fn generate-pe-valuation.

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Loader2, Wand2, TrendingUp, BarChart3, Layers, Scale, Calculator } from 'lucide-react';
import { toast } from 'sonner';
import PeExportButton from './PeExportButton';

interface Props {
  dealId: string;
}

type Status = 'draft' | 'generating' | 'ready' | 'error';

interface DcfProjection { year: number; revenue: number; ebitda: number; ebit: number; capex: number; nwc_change: number; fcf: number; }
interface DcfInputs { wacc: number; terminal_growth_rate: number; tax_rate: number; beta?: number; risk_free_rate?: number; equity_risk_premium?: number; cost_of_debt?: number; debt_to_capital?: number; }
interface DcfTerminal { method: string; tv: number; pv_tv: number; exit_multiple?: number | null; exit_year?: number; }
interface DcfOutputs { enterprise_value: number; net_debt: number; minority_interests: number; equity_value: number; wacc_axis: number[]; g_axis: number[]; sensitivity_matrix: number[][]; }
interface Comparable { company: string; country: string; sector: string; source_year?: number; ev_ebitda?: number; ev_sales?: number; pe?: number; currency?: string; }
interface MultiplesOutputs { selected_ev_ebitda?: number; selected_ev_sales?: number; selected_pe?: number; ebitda_year_n?: number; revenue_year_n?: number; ev_from_ebitda?: number; ev_from_sales?: number; blended_ev?: number; justification?: string; }
interface AnccLine { label: string; book_value: number; adjustment: number; adjusted_value: number; note?: string; }
interface AnccOutputs { total_assets_adjusted?: number; total_liabilities_adjusted?: number; anc_corrected?: number; justification?: string; }
interface Synthesis {
  weights?: { dcf: number; multiples: number; ancc: number };
  method_evs?: { dcf: number; multiples: number; ancc: number };
  weighted_ev?: number;
  range?: { bear: number; base: number; bull: number };
  pre_money_recommended?: number;
  post_money_recommended?: number;
  ticket_recommended?: number;
  equity_stake_pct?: number;
  moic_bear?: number; moic_base?: number; moic_bull?: number;
  irr_bear?: number; irr_base?: number; irr_bull?: number;
  exit_horizon_years?: number;
  justification?: string;
}

interface ValuationRow {
  id: string;
  deal_id: string;
  currency: string;
  status: Status;
  dcf_inputs: DcfInputs;
  dcf_projections: DcfProjection[];
  dcf_terminal: DcfTerminal;
  dcf_outputs: DcfOutputs;
  multiples_comparables: Comparable[];
  multiples_outputs: MultiplesOutputs;
  ancc_assets: AnccLine[];
  ancc_liabilities: AnccLine[];
  ancc_outputs: AnccOutputs;
  synthesis: Synthesis;
  ai_justification: string | null;
  generated_at: string | null;
  generated_by_agent: string | null;
}

// Conventions PE Afrique francophone : les montants stockés sont en millions de la devise.
// Ex: weighted_ev = 3464 signifie 3 464 M FCFA (= 3.46 Md FCFA).
function fmtMoney(v: number | undefined | null, currency = 'FCFA'): string {
  if (v == null || isNaN(v as number)) return '—';
  const abs = Math.abs(v);
  if (abs >= 1000) return `${(v / 1000).toFixed(2)} Md ${currency}`;
  if (abs >= 1) return `${Math.round(v)} M ${currency}`;
  if (abs >= 0.001) return `${Math.round(v * 1000)} K ${currency}`;
  return `${Math.round(v * 1_000_000)} ${currency}`;
}
function fmtPct(v: number | undefined | null, digits = 1): string {
  if (v == null || isNaN(v as number)) return '—';
  return `${(v * 100).toFixed(digits)}%`;
}
function fmtX(v: number | undefined | null, digits = 1): string {
  if (v == null || isNaN(v as number)) return '—';
  return `${v.toFixed(digits)}x`;
}

function heatColor(value: number, min: number, max: number): string {
  if (max === min) return 'var(--pe-bg-info)';
  const t = (value - min) / (max - min);
  // Du rouge (faible) au violet (haut)
  const r = Math.round(255 - 100 * t);
  const g = Math.round(220 - 100 * t);
  const b = Math.round(220 + 30 * t);
  return `rgba(${r},${g},${b},0.45)`;
}

export default function PeValuationView({ dealId }: Props) {
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [data, setData] = useState<ValuationRow | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    const { data: row } = await supabase
      .from('pe_valuation')
      .select('*')
      .eq('deal_id', dealId)
      .maybeSingle();
    setData(row as unknown as ValuationRow | null);
    setLoading(false);
  }, [dealId]);

  useEffect(() => { reload(); }, [reload]);

  const handleGenerate = async () => {
    if (generating) return;
    if (data && !confirm('Une valuation existe déjà. La régénérer remplacera l\'analyse actuelle et synchronisera la section thèse du memo. Continuer ?')) return;
    setGenerating(true);
    const { error, data: resp } = await supabase.functions.invoke('generate-pe-valuation', {
      body: { deal_id: dealId },
    });
    setGenerating(false);
    if (error || (resp as any)?.error) {
      toast.error((resp as any)?.error || error?.message || 'Génération valuation échouée');
      return;
    }
    toast.success('Valuation générée', { description: 'Memo IC1 mis à jour avec les nouveaux chiffres.' });
    reload();
  };

  if (loading) {
    return <div className="flex items-center gap-2 p-8 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Chargement de la valuation...</div>;
  }

  if (!data || data.status !== 'ready') {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="p-8 text-center space-y-3">
            <Calculator className="h-10 w-10 mx-auto text-muted-foreground/50" />
            <h2 className="text-lg font-semibold">Valuation</h2>
            <p className="text-sm text-muted-foreground max-w-xl mx-auto">
              Aucune valuation générée pour ce deal. Lance la génération pour produire une analyse selon 3 méthodes
              (DCF, Multiples, ANCC) avec une synthèse pondérée. Le memo IC1 sera automatiquement synchronisé.
            </p>
            <Button onClick={handleGenerate} disabled={generating} className="gap-2">
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
              Générer la valuation
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { dcf_inputs, dcf_projections, dcf_terminal, dcf_outputs,
          multiples_comparables, multiples_outputs,
          ancc_assets, ancc_liabilities, ancc_outputs,
          synthesis, ai_justification, currency } = data;

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <CardContent className="p-4 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <Calculator className="h-5 w-5 text-primary" />
            <span className="font-semibold">Valuation</span>
            <Badge variant="outline">3 méthodes pondérées</Badge>
            <Badge variant="outline" className="gap-1" style={{ background: 'var(--pe-bg-ok)', color: 'var(--pe-ok)', borderColor: 'var(--pe-ok)' }}>
              {synthesis.weighted_ev != null ? `EV synthèse ${fmtMoney(synthesis.weighted_ev, currency)}` : 'Ready'}
            </Badge>
            {data.generated_at && (
              <span className="text-[11px] text-muted-foreground">Générée le {new Date(data.generated_at).toLocaleString('fr-FR')}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <PeExportButton dealId={dealId} kind="valuation" label="Exporter" />
            <Button onClick={handleGenerate} disabled={generating} size="sm" variant="outline" className="gap-1.5">
              {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
              Régénérer
            </Button>
          </div>
        </CardContent>
      </Card>

      {ai_justification && (
        <Card>
          <CardContent className="p-4 text-sm leading-relaxed text-muted-foreground italic">
            {ai_justification}
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="synthesis">
        <TabsList>
          <TabsTrigger value="synthesis" className="gap-1"><Layers className="h-3.5 w-3.5" /> Synthèse</TabsTrigger>
          <TabsTrigger value="dcf" className="gap-1"><TrendingUp className="h-3.5 w-3.5" /> DCF</TabsTrigger>
          <TabsTrigger value="multiples" className="gap-1"><BarChart3 className="h-3.5 w-3.5" /> Multiples</TabsTrigger>
          <TabsTrigger value="ancc" className="gap-1"><Scale className="h-3.5 w-3.5" /> ANCC</TabsTrigger>
        </TabsList>

        {/* SYNTHÈSE */}
        <TabsContent value="synthesis" className="space-y-3 mt-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-xs uppercase text-muted-foreground">EV par méthode</CardTitle></CardHeader>
              <CardContent className="space-y-1.5 text-sm">
                <div className="flex justify-between"><span>DCF</span><span className="font-mono">{fmtMoney(synthesis.method_evs?.dcf, currency)}</span></div>
                <div className="flex justify-between"><span>Multiples</span><span className="font-mono">{fmtMoney(synthesis.method_evs?.multiples, currency)}</span></div>
                <div className="flex justify-between"><span>ANCC</span><span className="font-mono">{fmtMoney(synthesis.method_evs?.ancc, currency)}</span></div>
                <div className="border-t pt-1.5 flex justify-between font-semibold">
                  <span>Pondéré</span>
                  <span className="font-mono">{fmtMoney(synthesis.weighted_ev, currency)}</span>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-xs uppercase text-muted-foreground">Pondération</CardTitle></CardHeader>
              <CardContent className="space-y-1.5 text-sm">
                <div className="flex justify-between"><span>DCF</span><span className="font-mono">{fmtPct(synthesis.weights?.dcf, 0)}</span></div>
                <div className="flex justify-between"><span>Multiples</span><span className="font-mono">{fmtPct(synthesis.weights?.multiples, 0)}</span></div>
                <div className="flex justify-between"><span>ANCC</span><span className="font-mono">{fmtPct(synthesis.weights?.ancc, 0)}</span></div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-xs uppercase text-muted-foreground">Range</CardTitle></CardHeader>
              <CardContent className="space-y-1.5 text-sm">
                <div className="flex justify-between"><span>Bear</span><span className="font-mono">{fmtMoney(synthesis.range?.bear, currency)}</span></div>
                <div className="flex justify-between"><span>Base</span><span className="font-mono font-semibold">{fmtMoney(synthesis.range?.base, currency)}</span></div>
                <div className="flex justify-between"><span>Bull</span><span className="font-mono">{fmtMoney(synthesis.range?.bull, currency)}</span></div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-xs uppercase text-muted-foreground">Recommandation deal</CardTitle></CardHeader>
              <CardContent className="space-y-1.5 text-sm">
                <div className="flex justify-between"><span>Pre-money</span><span className="font-mono font-semibold">{fmtMoney(synthesis.pre_money_recommended, currency)}</span></div>
                <div className="flex justify-between"><span>Ticket recommandé</span><span className="font-mono">{fmtMoney(synthesis.ticket_recommended, currency)}</span></div>
                <div className="flex justify-between"><span>Post-money</span><span className="font-mono">{fmtMoney(synthesis.post_money_recommended, currency)}</span></div>
                <div className="flex justify-between"><span>Equity stake</span><span className="font-mono">{fmtPct(synthesis.equity_stake_pct, 1)}</span></div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs uppercase text-muted-foreground">
                  Performance attendue · horizon {synthesis.exit_horizon_years ?? 5} ans
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div className="text-center p-2 rounded-md" style={{ background: 'var(--pe-bg-danger)' }}>
                    <div className="text-[10px] uppercase text-muted-foreground">Bear</div>
                    <div className="font-mono font-semibold" style={{ color: 'var(--pe-danger)' }}>{fmtX(synthesis.moic_bear)}</div>
                    <div className="text-[11px] text-muted-foreground">{fmtPct(synthesis.irr_bear)} IRR</div>
                  </div>
                  <div className="text-center p-2 rounded-md" style={{ background: 'var(--pe-bg-info)' }}>
                    <div className="text-[10px] uppercase text-muted-foreground">Base</div>
                    <div className="font-mono font-semibold" style={{ color: 'var(--pe-info)' }}>{fmtX(synthesis.moic_base)}</div>
                    <div className="text-[11px] text-muted-foreground">{fmtPct(synthesis.irr_base)} IRR</div>
                  </div>
                  <div className="text-center p-2 rounded-md" style={{ background: 'var(--pe-bg-ok)' }}>
                    <div className="text-[10px] uppercase text-muted-foreground">Bull</div>
                    <div className="font-mono font-semibold" style={{ color: 'var(--pe-ok)' }}>{fmtX(synthesis.moic_bull)}</div>
                    <div className="text-[11px] text-muted-foreground">{fmtPct(synthesis.irr_bull)} IRR</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {synthesis.justification && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-xs uppercase text-muted-foreground">Justification de la synthèse</CardTitle></CardHeader>
              <CardContent className="text-sm leading-relaxed">{synthesis.justification}</CardContent>
            </Card>
          )}
        </TabsContent>

        {/* DCF */}
        <TabsContent value="dcf" className="space-y-3 mt-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card><CardContent className="p-3"><div className="text-[10px] uppercase text-muted-foreground">WACC</div><div className="font-mono font-semibold">{fmtPct(dcf_inputs.wacc, 2)}</div></CardContent></Card>
            <Card><CardContent className="p-3"><div className="text-[10px] uppercase text-muted-foreground">g terminal</div><div className="font-mono font-semibold">{fmtPct(dcf_inputs.terminal_growth_rate, 2)}</div></CardContent></Card>
            <Card><CardContent className="p-3"><div className="text-[10px] uppercase text-muted-foreground">Tax</div><div className="font-mono font-semibold">{fmtPct(dcf_inputs.tax_rate, 0)}</div></CardContent></Card>
            <Card><CardContent className="p-3"><div className="text-[10px] uppercase text-muted-foreground">Enterprise Value</div><div className="font-mono font-semibold">{fmtMoney(dcf_outputs.enterprise_value, currency)}</div></CardContent></Card>
          </div>

          {dcf_projections && dcf_projections.length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Projections financières (7 ans)</CardTitle></CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-muted-foreground border-b">
                      <th className="px-2 py-1.5">Année</th>
                      <th className="px-2 py-1.5 text-right">Revenue</th>
                      <th className="px-2 py-1.5 text-right">EBITDA</th>
                      <th className="px-2 py-1.5 text-right">EBIT</th>
                      <th className="px-2 py-1.5 text-right">Capex</th>
                      <th className="px-2 py-1.5 text-right">ΔBFR</th>
                      <th className="px-2 py-1.5 text-right font-semibold">FCF</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dcf_projections.map((p, i) => (
                      <tr key={i} className="border-b border-border/40 hover:bg-muted/30">
                        <td className="px-2 py-1.5 font-mono">{p.year}</td>
                        <td className="px-2 py-1.5 text-right font-mono">{fmtMoney(p.revenue, currency)}</td>
                        <td className="px-2 py-1.5 text-right font-mono">{fmtMoney(p.ebitda, currency)}</td>
                        <td className="px-2 py-1.5 text-right font-mono">{fmtMoney(p.ebit, currency)}</td>
                        <td className="px-2 py-1.5 text-right font-mono">{fmtMoney(p.capex, currency)}</td>
                        <td className="px-2 py-1.5 text-right font-mono">{fmtMoney(p.nwc_change, currency)}</td>
                        <td className="px-2 py-1.5 text-right font-mono font-semibold">{fmtMoney(p.fcf, currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}

          {dcf_outputs.sensitivity_matrix && dcf_outputs.sensitivity_matrix.length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Matrice de sensibilité — EV en fonction de WACC × g</CardTitle></CardHeader>
              <CardContent className="overflow-x-auto">
                {(() => {
                  const flat = dcf_outputs.sensitivity_matrix.flat();
                  const min = Math.min(...flat);
                  const max = Math.max(...flat);
                  return (
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-left text-muted-foreground border-b">
                          <th className="px-2 py-1.5">WACC \ g</th>
                          {dcf_outputs.g_axis.map((g, i) => (
                            <th key={i} className="px-2 py-1.5 text-right font-mono">{fmtPct(g, 1)}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {dcf_outputs.sensitivity_matrix.map((row, i) => (
                          <tr key={i} className="border-b border-border/40">
                            <td className="px-2 py-1.5 font-mono text-muted-foreground">{fmtPct(dcf_outputs.wacc_axis[i], 1)}</td>
                            {row.map((val, j) => (
                              <td key={j} className="px-2 py-1.5 text-right font-mono" style={{ background: heatColor(val, min, max) }}>
                                {fmtMoney(val, currency)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  );
                })()}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Bridge EV → Equity</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm">
              <div className="flex justify-between"><span>Enterprise Value</span><span className="font-mono">{fmtMoney(dcf_outputs.enterprise_value, currency)}</span></div>
              <div className="flex justify-between text-muted-foreground"><span>− Net Debt</span><span className="font-mono">{fmtMoney(dcf_outputs.net_debt, currency)}</span></div>
              <div className="flex justify-between text-muted-foreground"><span>− Minority Interests</span><span className="font-mono">{fmtMoney(dcf_outputs.minority_interests, currency)}</span></div>
              <div className="border-t pt-1 flex justify-between font-semibold"><span>Equity Value</span><span className="font-mono">{fmtMoney(dcf_outputs.equity_value, currency)}</span></div>
              <div className="text-[11px] text-muted-foreground pt-1">
                Méthode terminale : {dcf_terminal.method ?? '—'} · TV {fmtMoney(dcf_terminal.tv, currency)} (PV {fmtMoney(dcf_terminal.pv_tv, currency)})
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* MULTIPLES */}
        <TabsContent value="multiples" className="space-y-3 mt-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Card><CardContent className="p-3"><div className="text-[10px] uppercase text-muted-foreground">EV/EBITDA retenu</div><div className="font-mono font-semibold">{fmtX(multiples_outputs.selected_ev_ebitda)}</div></CardContent></Card>
            <Card><CardContent className="p-3"><div className="text-[10px] uppercase text-muted-foreground">EV/Sales retenu</div><div className="font-mono font-semibold">{fmtX(multiples_outputs.selected_ev_sales)}</div></CardContent></Card>
            <Card><CardContent className="p-3"><div className="text-[10px] uppercase text-muted-foreground">P/E retenu</div><div className="font-mono font-semibold">{fmtX(multiples_outputs.selected_pe)}</div></CardContent></Card>
          </div>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Comparables ({multiples_comparables.length})</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-muted-foreground border-b">
                    <th className="px-2 py-1.5">Société</th>
                    <th className="px-2 py-1.5">Pays</th>
                    <th className="px-2 py-1.5">Secteur</th>
                    <th className="px-2 py-1.5 text-right">Année</th>
                    <th className="px-2 py-1.5 text-right">EV/EBITDA</th>
                    <th className="px-2 py-1.5 text-right">EV/Sales</th>
                    <th className="px-2 py-1.5 text-right">P/E</th>
                  </tr>
                </thead>
                <tbody>
                  {multiples_comparables.map((c, i) => (
                    <tr key={i} className="border-b border-border/40 hover:bg-muted/30">
                      <td className="px-2 py-1.5 font-medium">{c.company}</td>
                      <td className="px-2 py-1.5 text-muted-foreground">{c.country}</td>
                      <td className="px-2 py-1.5 text-muted-foreground">{c.sector}</td>
                      <td className="px-2 py-1.5 text-right font-mono">{c.source_year ?? '—'}</td>
                      <td className="px-2 py-1.5 text-right font-mono">{fmtX(c.ev_ebitda)}</td>
                      <td className="px-2 py-1.5 text-right font-mono">{fmtX(c.ev_sales)}</td>
                      <td className="px-2 py-1.5 text-right font-mono">{fmtX(c.pe)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Application au deal</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm">
              <div className="flex justify-between"><span>EBITDA année N</span><span className="font-mono">{fmtMoney(multiples_outputs.ebitda_year_n, currency)}</span></div>
              <div className="flex justify-between"><span>Revenue année N</span><span className="font-mono">{fmtMoney(multiples_outputs.revenue_year_n, currency)}</span></div>
              <div className="flex justify-between"><span>EV via EV/EBITDA</span><span className="font-mono">{fmtMoney(multiples_outputs.ev_from_ebitda, currency)}</span></div>
              <div className="flex justify-between"><span>EV via EV/Sales</span><span className="font-mono">{fmtMoney(multiples_outputs.ev_from_sales, currency)}</span></div>
              <div className="border-t pt-1 flex justify-between font-semibold"><span>EV blended</span><span className="font-mono">{fmtMoney(multiples_outputs.blended_ev, currency)}</span></div>
              {multiples_outputs.justification && (
                <p className="text-[11px] text-muted-foreground italic pt-1">{multiples_outputs.justification}</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ANCC */}
        <TabsContent value="ancc" className="space-y-3 mt-3">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Actifs ajustés ({ancc_assets.length})</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-muted-foreground border-b">
                    <th className="px-2 py-1.5">Poste</th>
                    <th className="px-2 py-1.5 text-right">Book value</th>
                    <th className="px-2 py-1.5 text-right">Ajustement</th>
                    <th className="px-2 py-1.5 text-right">Valeur ajustée</th>
                    <th className="px-2 py-1.5">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {ancc_assets.map((a, i) => (
                    <tr key={i} className="border-b border-border/40">
                      <td className="px-2 py-1.5 font-medium">{a.label}</td>
                      <td className="px-2 py-1.5 text-right font-mono">{fmtMoney(a.book_value, currency)}</td>
                      <td className="px-2 py-1.5 text-right font-mono" style={{ color: a.adjustment < 0 ? 'var(--pe-danger)' : 'var(--pe-ok)' }}>
                        {a.adjustment > 0 ? '+' : ''}{fmtMoney(a.adjustment, currency)}
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono font-semibold">{fmtMoney(a.adjusted_value, currency)}</td>
                      <td className="px-2 py-1.5 text-[11px] text-muted-foreground">{a.note ?? ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Passifs ajustés ({ancc_liabilities.length})</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-muted-foreground border-b">
                    <th className="px-2 py-1.5">Poste</th>
                    <th className="px-2 py-1.5 text-right">Book value</th>
                    <th className="px-2 py-1.5 text-right">Ajustement</th>
                    <th className="px-2 py-1.5 text-right">Valeur ajustée</th>
                    <th className="px-2 py-1.5">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {ancc_liabilities.map((a, i) => (
                    <tr key={i} className="border-b border-border/40">
                      <td className="px-2 py-1.5 font-medium">{a.label}</td>
                      <td className="px-2 py-1.5 text-right font-mono">{fmtMoney(a.book_value, currency)}</td>
                      <td className="px-2 py-1.5 text-right font-mono" style={{ color: a.adjustment > 0 ? 'var(--pe-danger)' : 'var(--pe-ok)' }}>
                        {a.adjustment > 0 ? '+' : ''}{fmtMoney(a.adjustment, currency)}
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono font-semibold">{fmtMoney(a.adjusted_value, currency)}</td>
                      <td className="px-2 py-1.5 text-[11px] text-muted-foreground">{a.note ?? ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Actif Net Comptable Corrigé</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm">
              <div className="flex justify-between"><span>Total actifs ajustés</span><span className="font-mono">{fmtMoney(ancc_outputs.total_assets_adjusted, currency)}</span></div>
              <div className="flex justify-between"><span>− Total passifs ajustés</span><span className="font-mono">{fmtMoney(ancc_outputs.total_liabilities_adjusted, currency)}</span></div>
              <div className="border-t pt-1 flex justify-between font-semibold"><span>ANC corrigé</span><span className="font-mono">{fmtMoney(ancc_outputs.anc_corrected, currency)}</span></div>
              {ancc_outputs.justification && (
                <p className="text-[11px] text-muted-foreground italic pt-1">{ancc_outputs.justification}</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
