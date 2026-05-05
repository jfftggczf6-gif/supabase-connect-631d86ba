// ValuationHistorySection — historique des NAV périodiques
// Timeline DCF re-calculé + bridge de valeur waterfall + MOIC/IRR à date
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Loader2, Calculator, Plus, TrendingUp, TrendingDown, Sparkles, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { getValidAccessToken } from '@/lib/getValidAccessToken';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, Cell, ReferenceLine,
} from 'recharts';

interface Props {
  dealId: string;
  organizationId: string;
}

interface Valuation {
  id: string;
  deal_id: string;
  period: string;
  period_start: string;
  period_end: string;
  devise: string;
  nav_amount: number | null;
  nav_method: string | null;
  moic_to_date: number | null;
  irr_to_date: number | null;
  tvpi: number | null;
  bridge_de_valeur: any[];
  comparison_entry: any;
  comparison_n_minus_1: any;
  ai_justification: string | null;
  computed_at: string;
}

export default function ValuationHistorySection({ dealId, organizationId }: Props) {
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [valuations, setValuations] = useState<Valuation[]>([]);
  const [showAdd, setShowAdd] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('pe_periodic_valuations')
      .select('*')
      .eq('deal_id', dealId)
      .order('period_end');
    setValuations((data ?? []) as any);
    setLoading(false);
  }, [dealId]);

  useEffect(() => { reload(); }, [reload]);

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  const lastVal = valuations[valuations.length - 1];
  const firstVal = valuations[0];
  const navData = valuations.map(v => ({
    period: v.period,
    nav: Number(v.nav_amount ?? 0),
    moic: Number(v.moic_to_date ?? 0),
  }));

  // Bridge data depuis dernière valuation
  const bridgeData = (lastVal?.bridge_de_valeur ?? []).map((b: any) => ({
    name: b.item,
    value: Number(b.amount ?? 0),
    pct: Number(b.impact_pct ?? 0),
  }));

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between flex-wrap gap-2">
            <span className="flex items-center gap-2">
              <Calculator className="h-4 w-4 text-violet-500" />
              Valorisation périodique (NAV)
              <Badge variant="outline" className="text-xs">{valuations.length} valuations</Badge>
            </span>
            <Button size="sm" onClick={() => setShowAdd(true)} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Recalculer NAV
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
            <div className="bg-violet-50 border border-violet-200 rounded p-2">
              <div className="text-violet-700 font-medium">NAV actuelle</div>
              <div className="text-2xl font-bold text-violet-800">
                {lastVal?.nav_amount ? Number(lastVal.nav_amount).toLocaleString('fr-FR') : '—'}
              </div>
              <div className="text-[10px] text-violet-600">{lastVal?.devise}</div>
            </div>
            <div className="bg-emerald-50 border border-emerald-200 rounded p-2">
              <div className="text-emerald-700 font-medium">MOIC</div>
              <div className="text-2xl font-bold text-emerald-800 flex items-center gap-1">
                {lastVal?.moic_to_date ? `${Number(lastVal.moic_to_date).toFixed(2)}x` : '—'}
                {lastVal?.moic_to_date && firstVal?.moic_to_date && Number(lastVal.moic_to_date) > Number(firstVal.moic_to_date) && <TrendingUp className="h-4 w-4" />}
              </div>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded p-2">
              <div className="text-blue-700 font-medium">IRR</div>
              <div className="text-2xl font-bold text-blue-800">
                {lastVal?.irr_to_date != null ? `${(Number(lastVal.irr_to_date) * 100).toFixed(1)}%` : '—'}
              </div>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded p-2">
              <div className="text-amber-700 font-medium">TVPI</div>
              <div className="text-2xl font-bold text-amber-800">
                {lastVal?.tvpi ? Number(lastVal.tvpi).toFixed(2) : '—'}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {valuations.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground space-y-2">
            <Calculator className="h-8 w-8 mx-auto text-muted-foreground/40" />
            <p>Aucune valuation périodique calculée.</p>
            <p className="text-sm">Click "Recalculer NAV" pour la 1ère mise à jour. Nécessite au moins 1 rapport trimestriel saisi.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Évolution NAV */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Évolution NAV (dans le temps)</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={navData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="period" fontSize={11} />
                  <YAxis fontSize={11} />
                  <Tooltip formatter={(v: any) => Number(v).toLocaleString('fr-FR')} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="nav" stroke="#7c3aed" strokeWidth={2} dot={{ r: 4 }} name={`NAV (${lastVal?.devise})`} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Bridge de valeur (dernière valuation) */}
          {bridgeData.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Bridge de valeur ({lastVal?.period})</CardTitle>
                <p className="text-xs text-muted-foreground">Décomposition de l'évolution depuis l'entrée</p>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={bridgeData} layout="horizontal">
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="name" fontSize={10} angle={-15} textAnchor="end" height={60} />
                    <YAxis fontSize={11} />
                    <Tooltip formatter={(v: any) => Number(v).toLocaleString('fr-FR')} />
                    <ReferenceLine y={0} stroke="#000" />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {bridgeData.map((entry, i) => (
                        <Cell key={`cell-${i}`} fill={entry.value >= 0 ? '#10b981' : '#ef4444'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>

                {/* Détail textuel */}
                <div className="mt-3 space-y-1 text-xs">
                  {(lastVal?.bridge_de_valeur ?? []).map((b: any, i: number) => (
                    <div key={i} className="flex items-start gap-2">
                      {b.amount >= 0 ? <TrendingUp className="h-3 w-3 text-emerald-500 mt-0.5" /> : <TrendingDown className="h-3 w-3 text-red-500 mt-0.5" />}
                      <div className="flex-1">
                        <strong>{b.item}</strong>
                        <span className={b.amount >= 0 ? 'text-emerald-700' : 'text-red-700'}> ({b.impact_pct > 0 ? '+' : ''}{b.impact_pct}%, {Number(b.amount).toLocaleString('fr-FR')})</span>
                        {b.explanation && <span className="text-muted-foreground"> · {b.explanation}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Justification IA dernière valuation */}
          {lastVal?.ai_justification && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Méthodologie & justification ({lastVal.period})</CardTitle></CardHeader>
              <CardContent className="text-sm text-muted-foreground italic leading-relaxed">{lastVal.ai_justification}</CardContent>
            </Card>
          )}

          {/* Liste valuations */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Historique</CardTitle></CardHeader>
            <CardContent className="space-y-1">
              {valuations.slice().reverse().map(v => (
                <div key={v.id} className="border rounded-lg p-2 flex items-center gap-3 flex-wrap">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{v.period}</span>
                  <span className="text-xs text-muted-foreground">{v.period_start} → {v.period_end}</span>
                  <span className="font-bold ml-2">NAV : {v.nav_amount ? Number(v.nav_amount).toLocaleString('fr-FR') : '—'} {v.devise}</span>
                  {v.moic_to_date && <Badge variant="outline" className="text-[10px]">MOIC {Number(v.moic_to_date).toFixed(2)}x</Badge>}
                  {v.irr_to_date != null && <Badge variant="outline" className="text-[10px]">IRR {(Number(v.irr_to_date) * 100).toFixed(1)}%</Badge>}
                  {v.nav_method && <Badge variant="outline" className="text-[10px]">{v.nav_method}</Badge>}
                  <span className="text-xs text-muted-foreground ml-auto">calculé le {new Date(v.computed_at).toLocaleDateString('fr-FR')}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}

      {/* Dialog ajout valuation */}
      <RecalculateNavDialog
        open={showAdd}
        onOpenChange={setShowAdd}
        dealId={dealId}
        onCreated={reload}
      />
    </div>
  );
}

function RecalculateNavDialog({
  open, onOpenChange, dealId, onCreated,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  dealId: string;
  onCreated: () => void;
}) {
  const today = new Date();
  const half = today.getMonth() < 6 ? 'H1' : 'H2';
  const [period, setPeriod] = useState(`${half}-${today.getFullYear()}`);
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!period.trim() || !periodStart || !periodEnd) {
      toast.error('Période + dates requises');
      return;
    }
    setSubmitting(true);
    try {
      const token = await getValidAccessToken(null);
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/recalculate-periodic-valuation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          deal_id: dealId,
          period: period.trim(),
          period_start: periodStart,
          period_end: periodEnd,
          force: false,
        }),
      });
      const result = await resp.json();
      if (resp.ok) {
        if (result.skipped) toast.info(result.reason);
        else toast.success(`NAV ${period} calculée : ${Number(result.valuation?.nav_amount ?? 0).toLocaleString('fr-FR')}`);
        onOpenChange(false);
        onCreated();
      } else {
        toast.error(`Erreur : ${result.error}`);
      }
    } catch (e: any) {
      toast.error(e.message);
    }
    setSubmitting(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Recalculer la NAV</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <p className="text-xs text-muted-foreground">
            L'IA recalcule DCF + Multiples + ANCC avec les données réelles des derniers rapports trimestriels.
            ⏱ ~30-60s. Standards IPEV.
          </p>
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Période *</Label>
              <Input value={period} onChange={e => setPeriod(e.target.value)} placeholder="H1-2026" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Date début *</Label>
              <Input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Date fin *</Label>
              <Input type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Annuler</Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Calcul…</> : <><Sparkles className="h-4 w-4 mr-2" /> Lancer le calcul</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
