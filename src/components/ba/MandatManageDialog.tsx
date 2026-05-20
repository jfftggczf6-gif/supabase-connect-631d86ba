// MandatManageDialog — modal "Gérer le mandat" : panel détails éditables
// + actions rapides (voir pipeline, marquer perdu/close).
// Brief P7 AUDIT 19/05 + P7 panel éditable (stage + équipe ajoutés 20/05).

import { useEffect, useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Loader2, ExternalLink, XCircle, CheckCircle2, Save, Settings, Pencil,
} from 'lucide-react';
import type { Mandat } from '@/types/ba';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mandat: Mandat;
  organizationId?: string;
  onUpdated?: () => void;
}

const STAGE_LABELS: Record<string, string> = {
  recus: 'Reçus', im: 'IM produit', interets: 'Intérêts fonds',
  nego: 'Négociation', close: 'Closé', lost: 'Perdu',
};
const STAGE_VALUES = Object.keys(STAGE_LABELS);

const CURRENCIES = ['USD', 'EUR', 'XOF', 'XAF', 'MAD', 'NGN', 'KES', 'GHS'];

interface TeamMember {
  user_id: string;
  full_name: string | null;
  email: string | null;
  role: string;
}

export default function MandatManageDialog({ open, onOpenChange, mandat, organizationId, onUpdated }: Props) {
  const navigate = useNavigate();
  const [updating, setUpdating] = useState(false);
  const [saving, setSaving] = useState(false);

  // Éditables — chargés à l'ouverture pour récupérer la valeur fresh
  const [name, setName] = useState(mandat.enterprise_name || '');
  const [sector, setSector] = useState(mandat.sector || '');
  const [country, setCountry] = useState(mandat.country || '');
  const [ticket, setTicket] = useState(mandat.ticket_demande ? String(mandat.ticket_demande / 1_000_000) : '');
  const [currency, setCurrency] = useState(mandat.currency || 'USD');
  const [stage, setStage] = useState<string>(mandat.stage || 'recus');
  const [analystId, setAnalystId] = useState<string>(mandat.lead_analyst_id || 'none');
  const [imId, setImId] = useState<string>(mandat.lead_im_id || 'none');

  // Équipe BA (analystes + IMs + partners + admin pour SELECT)
  const [team, setTeam] = useState<TeamMember[]>([]);

  useEffect(() => {
    if (!open) return;
    setName(mandat.enterprise_name || '');
    setSector(mandat.sector || '');
    setCountry(mandat.country || '');
    setTicket(mandat.ticket_demande ? String(mandat.ticket_demande / 1_000_000) : '');
    setCurrency(mandat.currency || 'USD');
    setStage(mandat.stage || 'recus');
    setAnalystId(mandat.lead_analyst_id || 'none');
    setImId(mandat.lead_im_id || 'none');
  }, [open, mandat]);

  // Charge l'équipe quand le dialog s'ouvre
  useEffect(() => {
    if (!open || !organizationId) return;
    (async () => {
      const { data: orgMembers } = await supabase
        .from('organization_members')
        .select('user_id, role, is_active')
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .in('role', ['analyst', 'investment_manager', 'partner', 'managing_director', 'admin', 'owner']);
      const userIds = (orgMembers || []).map((m: any) => m.user_id);
      if (userIds.length === 0) { setTeam([]); return; }
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, email')
        .in('user_id', userIds);
      const profMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));
      const members: TeamMember[] = (orgMembers || []).map((m: any) => ({
        user_id: m.user_id,
        role: m.role,
        full_name: profMap.get(m.user_id)?.full_name ?? null,
        email: profMap.get(m.user_id)?.email ?? null,
      }));
      setTeam(members);
    })();
  }, [open, organizationId]);

  const analystCandidates = team.filter(m => ['analyst', 'partner', 'managing_director', 'admin', 'owner'].includes(m.role));
  const imCandidates = team.filter(m => ['investment_manager', 'partner', 'managing_director', 'admin', 'owner'].includes(m.role));

  const updateStage = async (newStage: 'lost' | 'close') => {
    const labels = { lost: 'perdu', close: 'closé' };
    if (!confirm(`Marquer ce mandat comme ${labels[newStage]} ? Action réversible via le pipeline.`)) return;
    setUpdating(true);
    try {
      const { error } = await supabase.functions.invoke('update-pe-deal-stage', {
        body: { deal_id: mandat.id, new_stage: newStage },
      });
      if (error) throw new Error(error.message);
      toast.success(`Mandat marqué ${labels[newStage]}`);
      onOpenChange(false);
      onUpdated?.();
    } catch (e: any) {
      toast.error(`Échec : ${e.message}`);
    } finally {
      setUpdating(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Le nom de la société est requis'); return; }
    setSaving(true);
    try {
      // 1. Update enterprise (name, sector, country)
      if (mandat.enterprise_id) {
        const { error: entErr } = await supabase
          .from('enterprises')
          .update({
            name: name.trim(),
            sector: sector.trim() || null,
            country: country.trim() || null,
          })
          .eq('id', mandat.enterprise_id);
        if (entErr) throw new Error(`Enterprise: ${entErr.message}`);
      }

      // 2. Update deal (ticket_demande, currency, stage, équipe)
      const ticketNum = ticket.trim() ? parseFloat(ticket) * 1_000_000 : null;
      const dealUpdates: Record<string, unknown> = {
        ticket_demande: ticketNum,
        currency: currency,
        lead_analyst_id: analystId === 'none' ? null : analystId,
        lead_im_id: imId === 'none' ? null : imId,
        updated_at: new Date().toISOString(),
      };
      const { error: dealErr } = await supabase
        .from('pe_deals')
        .update(dealUpdates)
        .eq('id', mandat.id);
      if (dealErr) throw new Error(`Deal: ${dealErr.message}`);

      // 3. Stage transition via EF (audit pe_deal_history + règles métier)
      if (stage !== mandat.stage) {
        const { error: stageErr } = await supabase.functions.invoke('update-pe-deal-stage', {
          body: { deal_id: mandat.id, new_stage: stage },
        });
        if (stageErr) throw new Error(`Stage transition: ${stageErr.message}`);
      }

      toast.success('Mandat mis à jour');
      onUpdated?.();
    } catch (e: any) {
      toast.error(`Sauvegarde échouée : ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Gérer le mandat</DialogTitle>
          <DialogDescription>
            Modifie les informations du mandat ou exécute une action rapide.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="details">
          <TabsList className="grid grid-cols-2 mb-3">
            <TabsTrigger value="details" className="gap-1.5">
              <Pencil className="h-3.5 w-3.5" /> Détails
            </TabsTrigger>
            <TabsTrigger value="actions" className="gap-1.5">
              <Settings className="h-3.5 w-3.5" /> Actions
            </TabsTrigger>
          </TabsList>

          {/* ─── Onglet Détails (éditable) ──────────────────────────────── */}
          <TabsContent value="details" className="space-y-3">
            <div>
              <Label className="text-xs">Société *</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: PharmaCi Industries SA" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Secteur</Label>
                <Input value={sector} onChange={e => setSector(e.target.value)} placeholder="Pharma, Agro, Fintech…" />
              </div>
              <div>
                <Label className="text-xs">Pays</Label>
                <Input value={country} onChange={e => setCountry(e.target.value)} placeholder="Côte d'Ivoire, Sénégal…" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <Label className="text-xs">Ticket demandé (M)</Label>
                <Input
                  type="number" step="0.1" min="0"
                  value={ticket} onChange={e => setTicket(e.target.value)}
                  placeholder="5"
                />
              </div>
              <div>
                <Label className="text-xs">Devise</Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Stage (Select libre vers tous les stages BA) */}
            <div>
              <Label className="text-xs">Stage</Label>
              <Select value={stage} onValueChange={setStage}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STAGE_VALUES.map(s => <SelectItem key={s} value={s}>{STAGE_LABELS[s]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Équipe : analyste + IM (depuis organization_members) */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Analyste lead</Label>
                <Select value={analystId} onValueChange={setAnalystId}>
                  <SelectTrigger><SelectValue placeholder="Aucun" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Non assigné</SelectItem>
                    {analystCandidates.map(m => (
                      <SelectItem key={m.user_id} value={m.user_id}>
                        {m.full_name || m.email || m.user_id.slice(0, 8)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">IM lead</Label>
                <Select value={imId} onValueChange={setImId}>
                  <SelectTrigger><SelectValue placeholder="Aucun" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Non assigné</SelectItem>
                    {imCandidates.map(m => (
                      <SelectItem key={m.user_id} value={m.user_id}>
                        {m.full_name || m.email || m.user_id.slice(0, 8)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-2 border-t">
              <span>Référence : <span className="font-mono">{mandat.deal_ref}</span></span>
              <Badge variant="outline">{STAGE_LABELS[mandat.stage] || mandat.stage}</Badge>
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
              <Button onClick={handleSave} disabled={saving} className="gap-1.5">
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                Enregistrer
              </Button>
            </DialogFooter>
          </TabsContent>

          {/* ─── Onglet Actions ─────────────────────────────────────────── */}
          <TabsContent value="actions" className="space-y-2">
            <Button
              variant="outline"
              className="w-full justify-start gap-2"
              onClick={() => { onOpenChange(false); navigate('/ba?tab=mandats'); }}
            >
              <ExternalLink className="h-4 w-4" /> Voir dans le pipeline
            </Button>
            {mandat.stage !== 'close' && mandat.stage !== 'lost' && (
              <>
                <Button
                  variant="outline"
                  className="w-full justify-start gap-2"
                  disabled={updating}
                  onClick={() => updateStage('close')}
                >
                  {updating ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                  Marquer comme closé
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start gap-2"
                  disabled={updating}
                  onClick={() => updateStage('lost')}
                >
                  {updating ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4 text-rose-600" />}
                  Marquer comme perdu
                </Button>
              </>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
