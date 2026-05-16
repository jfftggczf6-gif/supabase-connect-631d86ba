// CreateMandatDialog — Formulaire P6 (création mandat BA).
// Insert via edge function create-pe-deal avec source='mandat_ba'.
// L'EF gère : création enterprise (si nouvelle), deal_ref auto, currency
// auto via trigger pe_deals_set_currency_from_enterprise (depuis country).

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { BA_SECTORS, BA_COUNTRIES } from '@/types/ba';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  currentUserId: string;
  firstStage: string;
  onCreated: () => void;
}

interface MemberOpt {
  user_id: string;
  full_name: string | null;
  email: string | null;
  role: string;
}

const ANALYST_ROLES = ['analyst', 'analyste'];
const SENIOR_ROLES = ['investment_manager', 'managing_director', 'owner', 'admin', 'partner'];

export default function CreateMandatDialog({
  open, onOpenChange, organizationId, currentUserId, firstStage, onCreated,
}: Props) {
  const { currentRole, isSuperAdmin } = useOrganization();
  const isAnalystCreator = !isSuperAdmin && ANALYST_ROLES.includes(currentRole || '');

  const [enterpriseName, setEnterpriseName] = useState('');
  const [dirigeantName, setDirigeantName] = useState('');
  const [sector, setSector] = useState('');
  const [country, setCountry] = useState('');
  const [ticket, setTicket] = useState('');
  const [analystId, setAnalystId] = useState(currentUserId);
  const [imId, setImId] = useState('');

  const [analysts, setAnalysts] = useState<MemberOpt[]>([]);
  const [seniors, setSeniors] = useState<MemberOpt[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setAnalystId(currentUserId);
    setImId('');
    (async () => {
      const allRoles = [...new Set([...ANALYST_ROLES, ...SENIOR_ROLES])];
      const { data: members } = await supabase
        .from('organization_members')
        .select('user_id, role')
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .in('role', allRoles);
      const ids = (members || []).map((m: any) => m.user_id);
      if (!ids.length) { setAnalysts([]); setSeniors([]); return; }
      const { data: profs } = await supabase
        .from('profiles')
        .select('user_id, full_name, email')
        .in('user_id', ids);
      const profMap = new Map((profs || []).map((p: any) => [p.user_id, p]));
      const enriched: MemberOpt[] = (members || []).map((m: any) => ({
        user_id: m.user_id,
        role: m.role,
        full_name: profMap.get(m.user_id)?.full_name || null,
        email: profMap.get(m.user_id)?.email || null,
      }));
      setAnalysts(enriched.filter(m => ANALYST_ROLES.includes(m.role)));
      setSeniors(enriched.filter(m => SENIOR_ROLES.includes(m.role)));
    })();
  }, [open, organizationId, currentUserId]);

  const labelOf = (m: MemberOpt) => m.full_name || m.email || m.user_id.slice(0, 8);

  const reset = () => {
    setEnterpriseName('');
    setDirigeantName('');
    setSector('');
    setCountry('');
    setTicket('');
    setAnalystId(currentUserId);
    setImId('');
  };

  const handleCreate = async () => {
    if (!enterpriseName.trim()) {
      toast.error("Le nom de la société est requis");
      return;
    }
    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke('create-pe-deal', {
      body: {
        organization_id: organizationId,
        enterprise_name: enterpriseName.trim(),
        enterprise_country: country || null,
        enterprise_sector: sector || null,
        dirigeant_name: dirigeantName.trim() || null,
        ticket_demande: ticket ? Number(ticket) * 1_000_000 : null,
        source: 'mandat_ba',
        stage: firstStage,
        lead_analyst_id: analystId,
        lead_im_id: imId || null,
      },
    });
    if (error || (data as any)?.error) {
      setSubmitting(false);
      toast.error((data as any)?.error || error?.message || 'Erreur création mandat');
      return;
    }
    toast.success(`Mandat ${(data as any).deal.deal_ref} créé`);
    setSubmitting(false);
    reset();
    onCreated();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Nouveau mandat</DialogTitle>
          <DialogDescription>
            La devise est définie automatiquement selon le pays de la société.
            {firstStage && <span> Le mandat démarre au stage « {firstStage} ».</span>}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="ent-name">Raison sociale <span className="text-destructive">*</span></Label>
            <Input
              id="ent-name"
              value={enterpriseName}
              onChange={(e) => setEnterpriseName(e.target.value)}
              placeholder="Ex : PharmaCi Industries SA"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Secteur</Label>
              <Select value={sector} onValueChange={setSector}>
                <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                <SelectContent>
                  {BA_SECTORS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Pays</Label>
              <Select value={country} onValueChange={setCountry}>
                <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                <SelectContent>
                  {BA_COUNTRIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="dirigeant">Dirigeant principal</Label>
            <Input
              id="dirigeant"
              value={dirigeantName}
              onChange={(e) => setDirigeantName(e.target.value)}
              placeholder="Ex : J. Diabaté"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ticket">Ticket demandé (en M)</Label>
            <Input
              id="ticket"
              type="number"
              inputMode="decimal"
              value={ticket}
              onChange={(e) => setTicket(e.target.value)}
              placeholder="Ex : 10"
            />
            <p className="text-[11px] text-muted-foreground">
              Devise déterminée automatiquement selon le pays.
            </p>
          </div>

          {!isAnalystCreator && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Analyste</Label>
                <Select value={analystId} onValueChange={setAnalystId}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                  <SelectContent>
                    {analysts.length === 0 && (
                      <SelectItem value="__none" disabled>Aucun analyste disponible</SelectItem>
                    )}
                    {analysts.map(m => (
                      <SelectItem key={m.user_id} value={m.user_id}>{labelOf(m)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Senior</Label>
                <Select value={imId} onValueChange={setImId}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                  <SelectContent>
                    {seniors.length === 0 && (
                      <SelectItem value="__none" disabled>Aucun senior disponible</SelectItem>
                    )}
                    {seniors.map(m => (
                      <SelectItem key={m.user_id} value={m.user_id}>{labelOf(m)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onOpenChange(false); }} disabled={submitting}>
            Annuler
          </Button>
          <Button onClick={handleCreate} disabled={submitting || !enterpriseName.trim()}>
            {submitting ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Création...</> : 'Enregistrer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
