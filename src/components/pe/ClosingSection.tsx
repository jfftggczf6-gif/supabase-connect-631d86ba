// ClosingSection — gestion du term sheet + tranches de décaissement
// Affiché dans la sidebar du deal quand stage='closing' ou 'portfolio'
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Loader2, Save, Plus, CheckCircle2, Clock, Ban, Trash2, FileSignature, Banknote } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  dealId: string;
  organizationId: string;
}

interface TermSheet {
  id?: string;
  deal_id: string;
  organization_id: string;
  signed_at: string | null;
  total_amount: number | null;
  devise: string;
  equity_stake_pct: number | null;
  pre_money_valuation: number | null;
  post_money_valuation: number | null;
  governance_seats: number | null;
  liquidation_preference: string | null;
  anti_dilution: string | null;
  drag_along: boolean;
  tag_along: boolean;
  vesting_terms: string | null;
  notes: string | null;
}

interface Tranche {
  id: string;
  deal_id: string;
  organization_id: string;
  tranche_number: number;
  amount: number;
  devise: string;
  scheduled_date: string | null;
  released_at: string | null;
  conditions: string[];
  conditions_met: boolean;
  status: 'pending' | 'released' | 'blocked' | 'cancelled';
  notes: string | null;
}

const STATUS_META: Record<Tranche['status'], { label: string; cls: string; Icon: any }> = {
  pending: { label: 'En attente', cls: 'bg-amber-50 text-amber-700 border-amber-200', Icon: Clock },
  released: { label: 'Décaissée', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', Icon: CheckCircle2 },
  blocked: { label: 'Bloquée', cls: 'bg-red-50 text-red-700 border-red-200', Icon: Ban },
  cancelled: { label: 'Annulée', cls: 'bg-slate-100 text-slate-600 border-slate-200', Icon: Ban },
};

const DEFAULT_TERM_SHEET = (dealId: string, orgId: string): TermSheet => ({
  deal_id: dealId,
  organization_id: orgId,
  signed_at: null,
  total_amount: null,
  devise: 'EUR',
  equity_stake_pct: null,
  pre_money_valuation: null,
  post_money_valuation: null,
  governance_seats: null,
  liquidation_preference: null,
  anti_dilution: null,
  drag_along: false,
  tag_along: false,
  vesting_terms: null,
  notes: null,
});

export default function ClosingSection({ dealId, organizationId }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [termSheet, setTermSheet] = useState<TermSheet>(DEFAULT_TERM_SHEET(dealId, organizationId));
  const [tranches, setTranches] = useState<Tranche[]>([]);
  const [showAddTranche, setShowAddTranche] = useState(false);
  const [newTranche, setNewTranche] = useState<{ amount: string; scheduled_date: string; conditions: string }>({
    amount: '', scheduled_date: '', conditions: '',
  });

  const reload = useCallback(async () => {
    setLoading(true);
    const [{ data: ts }, { data: tr }] = await Promise.all([
      supabase.from('pe_term_sheets').select('*').eq('deal_id', dealId).maybeSingle(),
      supabase.from('pe_disbursement_tranches').select('*').eq('deal_id', dealId).order('tranche_number'),
    ]);
    if (ts) setTermSheet(ts as any);
    setTranches((tr ?? []) as any);
    setLoading(false);
  }, [dealId, organizationId]);

  useEffect(() => { reload(); }, [reload]);

  const saveTermSheet = async () => {
    setSaving(true);
    const payload: any = { ...termSheet, deal_id: dealId, organization_id: organizationId };
    delete payload.id;
    const { error } = await supabase.from('pe_term_sheets').upsert(payload, { onConflict: 'deal_id' });
    setSaving(false);
    if (error) {
      toast.error(`Erreur : ${error.message}`);
      return;
    }
    toast.success('Term sheet enregistré');
    reload();
  };

  const addTranche = async () => {
    const amount = parseFloat(newTranche.amount);
    if (!amount || amount <= 0) {
      toast.error('Montant invalide');
      return;
    }
    const conditions = newTranche.conditions
      .split('\n')
      .map(c => c.trim())
      .filter(Boolean);

    const { error } = await supabase.from('pe_disbursement_tranches').insert({
      deal_id: dealId,
      organization_id: organizationId,
      tranche_number: tranches.length + 1,
      amount,
      devise: termSheet.devise || 'EUR',
      scheduled_date: newTranche.scheduled_date || null,
      conditions,
      status: 'pending',
    });
    if (error) {
      toast.error(`Erreur : ${error.message}`);
      return;
    }
    toast.success('Tranche ajoutée');
    setShowAddTranche(false);
    setNewTranche({ amount: '', scheduled_date: '', conditions: '' });
    reload();
  };

  const updateTrancheStatus = async (id: string, status: Tranche['status']) => {
    const updates: any = { status };
    if (status === 'released') updates.released_at = new Date().toISOString();
    const { error } = await supabase.from('pe_disbursement_tranches').update(updates).eq('id', id);
    if (error) {
      toast.error(`Erreur : ${error.message}`);
      return;
    }
    toast.success(`Tranche ${status === 'released' ? 'décaissée' : status}`);
    reload();
  };

  const deleteTranche = async (id: string) => {
    if (!confirm('Supprimer cette tranche ?')) return;
    const { error } = await supabase.from('pe_disbursement_tranches').delete().eq('id', id);
    if (error) {
      toast.error(`Erreur : ${error.message}`);
      return;
    }
    reload();
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  const totalDecaisse = tranches.filter(t => t.status === 'released').reduce((s, t) => s + Number(t.amount), 0);
  const totalEnCours = tranches.filter(t => t.status === 'pending').reduce((s, t) => s + Number(t.amount), 0);
  const fmt = (n: number | null) => n != null ? n.toLocaleString('fr-FR') : '—';

  return (
    <div className="space-y-6">
      {/* === Term Sheet === */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileSignature className="h-4 w-4 text-primary" />
            Term Sheet
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Date de signature</Label>
              <Input type="date" value={termSheet.signed_at ?? ''} onChange={e => setTermSheet(t => ({ ...t, signed_at: e.target.value || null }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Devise</Label>
              <Input value={termSheet.devise} onChange={e => setTermSheet(t => ({ ...t, devise: e.target.value }))} placeholder="EUR / FCFA / USD…" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Montant total</Label>
              <Input type="number" value={termSheet.total_amount ?? ''} onChange={e => setTermSheet(t => ({ ...t, total_amount: e.target.value ? Number(e.target.value) : null }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">% détention</Label>
              <Input type="number" step="0.01" value={termSheet.equity_stake_pct ?? ''} onChange={e => setTermSheet(t => ({ ...t, equity_stake_pct: e.target.value ? Number(e.target.value) : null }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Pre-money valuation</Label>
              <Input type="number" value={termSheet.pre_money_valuation ?? ''} onChange={e => setTermSheet(t => ({ ...t, pre_money_valuation: e.target.value ? Number(e.target.value) : null }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Post-money valuation</Label>
              <Input type="number" value={termSheet.post_money_valuation ?? ''} onChange={e => setTermSheet(t => ({ ...t, post_money_valuation: e.target.value ? Number(e.target.value) : null }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Sièges au CA</Label>
              <Input type="number" value={termSheet.governance_seats ?? ''} onChange={e => setTermSheet(t => ({ ...t, governance_seats: e.target.value ? Number(e.target.value) : null }))} />
            </div>
            <div className="space-y-1 col-span-2">
              <Label className="text-xs">Liquidation preference</Label>
              <Input value={termSheet.liquidation_preference ?? ''} onChange={e => setTermSheet(t => ({ ...t, liquidation_preference: e.target.value || null }))} placeholder="ex: 1x non-participating" />
            </div>
            <div className="flex items-center gap-2 pt-5">
              <input type="checkbox" id="drag" checked={termSheet.drag_along} onChange={e => setTermSheet(t => ({ ...t, drag_along: e.target.checked }))} />
              <Label htmlFor="drag" className="text-xs cursor-pointer">Drag-along</Label>
            </div>
            <div className="flex items-center gap-2 pt-5">
              <input type="checkbox" id="tag" checked={termSheet.tag_along} onChange={e => setTermSheet(t => ({ ...t, tag_along: e.target.checked }))} />
              <Label htmlFor="tag" className="text-xs cursor-pointer">Tag-along</Label>
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Notes & clauses spéciales</Label>
            <Textarea rows={2} value={termSheet.notes ?? ''} onChange={e => setTermSheet(t => ({ ...t, notes: e.target.value || null }))} />
          </div>

          <div className="flex justify-end">
            <Button onClick={saveTermSheet} disabled={saving} size="sm" className="gap-2">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Enregistrer
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* === Tranches === */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Banknote className="h-4 w-4 text-emerald-600" />
            Tranches de décaissement
            <Badge variant="outline" className="text-[10px]">{tranches.length}</Badge>
          </CardTitle>
          <Button size="sm" variant="outline" onClick={() => setShowAddTranche(v => !v)} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Ajouter
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Récap */}
          {tranches.length > 0 && (
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="bg-emerald-50 border border-emerald-200 rounded p-2">
                <div className="text-emerald-700 font-medium">Décaissé</div>
                <div className="text-lg font-bold text-emerald-800">{fmt(totalDecaisse)} {termSheet.devise}</div>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded p-2">
                <div className="text-amber-700 font-medium">En attente</div>
                <div className="text-lg font-bold text-amber-800">{fmt(totalEnCours)} {termSheet.devise}</div>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded p-2">
                <div className="text-slate-700 font-medium">Total prévu</div>
                <div className="text-lg font-bold text-slate-800">{fmt(termSheet.total_amount)} {termSheet.devise}</div>
              </div>
            </div>
          )}

          {/* Form ajouter */}
          {showAddTranche && (
            <div className="border border-dashed rounded-lg p-3 space-y-2 bg-muted/20">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Montant *</Label>
                  <Input type="number" value={newTranche.amount} onChange={e => setNewTranche(t => ({ ...t, amount: e.target.value }))} placeholder={`En ${termSheet.devise}`} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Date prévue</Label>
                  <Input type="date" value={newTranche.scheduled_date} onChange={e => setNewTranche(t => ({ ...t, scheduled_date: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Conditions à respecter (1 par ligne)</Label>
                <Textarea rows={2} value={newTranche.conditions} onChange={e => setNewTranche(t => ({ ...t, conditions: e.target.value }))} placeholder="Recrutement DAF&#10;Formalisation conseil d'admin" />
              </div>
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={() => setShowAddTranche(false)}>Annuler</Button>
                <Button size="sm" onClick={addTranche}>Ajouter la tranche</Button>
              </div>
            </div>
          )}

          {/* Liste tranches */}
          {tranches.length === 0 && !showAddTranche ? (
            <p className="text-sm text-muted-foreground text-center py-4">Aucune tranche prévue. Ajoute la 1ère ci-dessus.</p>
          ) : (
            tranches.map(tr => {
              const meta = STATUS_META[tr.status];
              const Icon = meta.Icon;
              return (
                <div key={tr.id} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">Tranche {tr.tranche_number}</span>
                      <span className="text-lg font-bold">{Number(tr.amount).toLocaleString('fr-FR')} {tr.devise}</span>
                      {tr.scheduled_date && <span className="text-xs text-muted-foreground">prévue le {tr.scheduled_date}</span>}
                      <Badge variant="outline" className={meta.cls + ' gap-1'}>
                        <Icon className="h-3 w-3" /> {meta.label}
                      </Badge>
                      {tr.released_at && <span className="text-xs text-emerald-700">décaissée le {new Date(tr.released_at).toLocaleDateString('fr-FR')}</span>}
                    </div>
                    <div className="flex gap-1">
                      {tr.status === 'pending' && (
                        <>
                          <Button size="sm" variant="outline" className="gap-1 h-7 text-xs" onClick={() => updateTrancheStatus(tr.id, 'released')}>
                            <CheckCircle2 className="h-3 w-3" /> Décaisser
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => updateTrancheStatus(tr.id, 'blocked')}>
                            Bloquer
                          </Button>
                        </>
                      )}
                      {tr.status === 'blocked' && (
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => updateTrancheStatus(tr.id, 'pending')}>
                          Débloquer
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => deleteTranche(tr.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  {tr.conditions.length > 0 && (
                    <div className="text-xs text-muted-foreground border-l-2 border-muted pl-2">
                      <div className="font-medium mb-1">Conditions :</div>
                      <ul className="list-disc list-inside space-y-0.5">
                        {tr.conditions.map((c, i) => <li key={i}>{c}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
