// ExitPrepSection — préparation de la sortie d'une participation
// Affiché dans la sidebar quand stage='portfolio' ou 'exit_prep' ou 'exited'
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import {
  Loader2, Sparkles, DoorOpen, TrendingUp, TrendingDown, CheckCircle2,
  Building, Users2, ArrowUpRight, AlertTriangle, Target, Calculator, Percent, Calendar,
} from 'lucide-react';
import { toast } from 'sonner';
import { getValidAccessToken } from '@/lib/getValidAccessToken';
import StatCard from '@/components/shared/StatCard';

interface Props {
  dealId: string;
  organizationId: string;
}

interface ExitDossier {
  id: string;
  deal_id: string;
  scenario: string;
  status: 'preparing' | 'in_negotiation' | 'signed' | 'closed' | 'cancelled';
  exit_valuation: number | null;
  exit_devise: string;
  fund_proceeds: number | null;
  exit_multiple: number | null;
  exit_irr: number | null;
  holding_period_months: number | null;
  scenarios_data: any[];
  these_initiale: string | null;
  these_realise: string | null;
  these_alignment_pct: number | null;
  drivers_de_valeur: any[];
  ratees: any[];
  vendor_dd_synthesis: string | null;
  potential_buyers: any[];
  capitalized_in_kb: boolean;
  signed_at: string | null;
  closed_at: string | null;
  ai_generated_at: string | null;
}

const SCENARIO_LABELS: Record<string, string> = {
  trade_sale: 'Trade sale industriel',
  secondary: 'Secondary fonds',
  ipo_brvm: 'IPO BRVM',
  ipo_other: 'IPO autre',
  mbo: 'Management buyout',
  other: 'Autre',
};

const STATUS_META: Record<string, { label: string; cls: string }> = {
  preparing: { label: 'En préparation', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  in_negotiation: { label: 'En négociation', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  signed: { label: 'Signé', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  closed: { label: 'Clôturé', cls: 'bg-violet-50 text-violet-700 border-violet-200' },
  cancelled: { label: 'Annulé', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
};

export default function ExitPrepSection({ dealId }: Props) {
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [dossier, setDossier] = useState<ExitDossier | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('pe_exit_dossiers')
      .select('*')
      .eq('deal_id', dealId)
      .maybeSingle();
    setDossier(data as any);
    setLoading(false);
  }, [dealId]);

  useEffect(() => { reload(); }, [reload]);

  const generate = async (scenario_target?: string) => {
    setGenerating(true);
    try {
      const token = await getValidAccessToken(null);
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-exit-dossier`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ deal_id: dealId, scenario_target, force: !!dossier }),
      });
      const result = await resp.json();
      if (resp.ok) {
        toast.success(dossier ? 'Dossier régénéré' : 'Dossier de sortie créé');
        reload();
      } else {
        toast.error(`Erreur : ${result.error}`);
      }
    } catch (e: any) {
      toast.error(e.message);
    }
    setGenerating(false);
  };

  const updateStatus = async (status: ExitDossier['status']) => {
    if (!dossier) return;
    const updates: any = { status };
    if (status === 'signed' && !dossier.signed_at) updates.signed_at = new Date().toISOString().slice(0, 10);
    if (status === 'closed' && !dossier.closed_at) updates.closed_at = new Date().toISOString().slice(0, 10);
    const { error } = await supabase.from('pe_exit_dossiers').update(updates).eq('id', dossier.id);
    if (!error) {
      toast.success(`Statut → ${STATUS_META[status]?.label}`);
      reload();
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  // === État vide : pas encore de dossier ===
  if (!dossier) {
    return (
      <Card>
        <CardContent className="py-12 text-center space-y-4">
          <DoorOpen className="h-12 w-12 mx-auto text-violet-300" />
          <div>
            <h3 className="font-semibold mb-1">Préparation de la sortie</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Génère le dossier de sortie : vendor DD interne, scénarios de valorisation,
              bilan thèse initiale vs réalisé, MOIC et IRR estimés.
            </p>
          </div>
          <div className="flex gap-2 justify-center flex-wrap">
            <Button onClick={() => generate('trade_sale')} disabled={generating} className="gap-2">
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Générer dossier (Trade sale)
            </Button>
            <Button variant="outline" onClick={() => generate('secondary')} disabled={generating}>
              Secondary fonds
            </Button>
            <Button variant="outline" onClick={() => generate('ipo_brvm')} disabled={generating}>
              IPO BRVM
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">⏱ Génération ~60-90s. Synthétise tout l'historique du deal (entrée, monitoring, valuations).</p>
        </CardContent>
      </Card>
    );
  }

  // === Dossier existant ===
  const statusMeta = STATUS_META[dossier.status] ?? STATUS_META.preparing;

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between flex-wrap gap-2">
            <span className="flex items-center gap-2">
              <DoorOpen className="h-4 w-4 text-violet-500" />
              Dossier de sortie
              <Badge variant="outline" className={statusMeta.cls}>{statusMeta.label}</Badge>
              <Badge variant="outline" className="text-[10px]">{SCENARIO_LABELS[dossier.scenario] ?? dossier.scenario}</Badge>
            </span>
            <div className="flex gap-1">
              <Button size="sm" variant="outline" onClick={() => generate(dossier.scenario)} disabled={generating} className="gap-1.5">
                {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                Régénérer
              </Button>
              {dossier.status === 'preparing' && (
                <Button size="sm" onClick={() => updateStatus('in_negotiation')}>Lancer négociations</Button>
              )}
              {dossier.status === 'in_negotiation' && (
                <Button size="sm" onClick={() => updateStatus('signed')}>Signer</Button>
              )}
              {dossier.status === 'signed' && (
                <Button size="sm" onClick={() => updateStatus('closed')}>Clôturer sortie</Button>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard
              icon={Calculator}
              value={dossier.exit_valuation ? Number(dossier.exit_valuation).toLocaleString('fr-FR') : '—'}
              label="Valuation sortie"
              subText={dossier.exit_devise}
              iconColor="text-primary"
            />
            <StatCard
              icon={TrendingUp}
              value={dossier.exit_multiple ? `${dossier.exit_multiple}x` : '—'}
              label="Multiple sortie"
              iconColor="text-emerald-500"
            />
            <StatCard
              icon={Percent}
              value={dossier.exit_irr != null ? `${(Number(dossier.exit_irr) * 100).toFixed(1)}%` : '—'}
              label="IRR estimé"
              iconColor="text-blue-500"
            />
            <StatCard
              icon={Calendar}
              value={dossier.holding_period_months ? `${(dossier.holding_period_months / 12).toFixed(1)} ans` : '—'}
              label="Durée portage"
              iconColor="text-amber-500"
            />
          </div>
        </CardContent>
      </Card>

      {/* Bilan thèse */}
      {dossier.these_alignment_pct != null && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2">
            <Target className="h-4 w-4 text-violet-500" /> Bilan thèse initiale vs réalisé
          </CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span>Alignement thèse</span>
                <span className="font-bold">{dossier.these_alignment_pct}%</span>
              </div>
              <Progress value={dossier.these_alignment_pct} className="h-3" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Thèse initiale</div>
                <p className="text-sm leading-relaxed bg-blue-50/40 border-l-2 border-blue-200 pl-2 py-1">{dossier.these_initiale}</p>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">Réalisé</div>
                <p className="text-sm leading-relaxed bg-emerald-50/40 border-l-2 border-emerald-200 pl-2 py-1">{dossier.these_realise}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Drivers + Ratées */}
      {(dossier.drivers_de_valeur.length > 0 || dossier.ratees.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2 text-emerald-700">
              <TrendingUp className="h-4 w-4" /> Drivers de valeur ({dossier.drivers_de_valeur.length})
            </CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {dossier.drivers_de_valeur.map((d: any, i: number) => (
                <div key={i} className="border-l-2 border-emerald-300 pl-2">
                  <div className="text-sm font-medium">{d.driver}
                    {d.impact_pct != null && <Badge variant="outline" className="ml-1 text-[10px] bg-emerald-50">+{d.impact_pct}%</Badge>}
                  </div>
                  {d.explanation && <p className="text-xs text-muted-foreground">{d.explanation}</p>}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2 text-amber-700">
              <AlertTriangle className="h-4 w-4" /> Ratées ({dossier.ratees.length})
            </CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {dossier.ratees.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">Pas de ratée majeure identifiée.</p>
              ) : (
                dossier.ratees.map((r: any, i: number) => (
                  <div key={i} className="border-l-2 border-amber-300 pl-2">
                    <div className="text-sm font-medium">{r.driver}</div>
                    {r.explanation && <p className="text-xs text-muted-foreground">{r.explanation}</p>}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Scénarios */}
      {dossier.scenarios_data.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2">
            <ArrowUpRight className="h-4 w-4 text-violet-500" /> Scénarios de sortie ({dossier.scenarios_data.length})
          </CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {dossier.scenarios_data.map((s: any, i: number) => (
              <div key={i} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="font-medium text-sm flex items-center gap-2">
                    {s.name}
                    <Badge variant="outline" className="text-[10px]">{SCENARIO_LABELS[s.type] ?? s.type}</Badge>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <Badge variant="outline" className="text-[10px]">Proba {s.probability_pct}%</Badge>
                    <span className="text-muted-foreground">Multiple {s.multiple_estimee}x</span>
                    <span className="font-bold">{Number(s.valuation_estimee).toLocaleString('fr-FR')} {dossier.exit_devise}</span>
                  </div>
                </div>
                {s.conditions?.length > 0 && (
                  <div className="text-xs">
                    <span className="text-muted-foreground">Conditions : </span>
                    {s.conditions.join(' · ')}
                  </div>
                )}
                {s.buyers_potentiels?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {s.buyers_potentiels.map((b: any, j: number) => (
                      <Badge key={j} variant="outline" className="text-[10px] gap-1">
                        {b.type === 'industriel' ? <Building className="h-2.5 w-2.5" /> : <Users2 className="h-2.5 w-2.5" />}
                        {b.nom ?? b.type}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Vendor DD synthesis */}
      {dossier.vendor_dd_synthesis && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Vendor DD — Synthèse exécutive</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed whitespace-pre-line">{dossier.vendor_dd_synthesis}</p>
          </CardContent>
        </Card>
      )}

      {/* État capitalisation KB */}
      {dossier.status === 'closed' && (
        <Card>
          <CardContent className="py-3 flex items-center gap-2 text-sm">
            <CheckCircle2 className={`h-5 w-5 ${dossier.capitalized_in_kb ? 'text-emerald-500' : 'text-muted-foreground'}`} />
            {dossier.capitalized_in_kb ? (
              <span>Capitalisé dans la KB propriétaire du fonds (deal-learnings + benchmarks réalisés)</span>
            ) : (
              <span className="text-muted-foreground">Capitalisation post-exit en attente — sera déclenchée automatiquement.</span>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
