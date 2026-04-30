import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

const SOURCES = [
  { value: 'reseau_pe', label: 'Réseau PE' },
  { value: 'inbound', label: 'Inbound' },
  { value: 'dfi', label: 'DFI' },
  { value: 'banque', label: 'Banque' },
  { value: 'mandat_ba', label: "Mandat banque d'affaires" },
  { value: 'conference', label: 'Conférence' },
  { value: 'autre', label: 'Autre' },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  currentUserId: string;
  onCreated: () => void;
}

interface AnalystOpt { user_id: string; full_name: string | null; email: string | null; role: string; }

export default function CreateDealDialog({ open, onOpenChange, organizationId, currentUserId, onCreated }: Props) {
  const [enterpriseName, setEnterpriseName] = useState('');
  const [ticket, setTicket] = useState('');
  const [currency, setCurrency] = useState('EUR');
  const [source, setSource] = useState('reseau_pe');
  const [sourceDetail, setSourceDetail] = useState('');
  const [leadAnalystId, setLeadAnalystId] = useState(currentUserId);
  const [analysts, setAnalysts] = useState<AnalystOpt[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLeadAnalystId(currentUserId);
    (async () => {
      const { data: members } = await supabase
        .from('organization_members')
        .select('user_id, role')
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .in('role', ['analyst', 'investment_manager', 'managing_director', 'owner', 'admin']);
      const ids = (members || []).map((m: any) => m.user_id);
      if (!ids.length) { setAnalysts([]); return; }
      const { data: profs } = await supabase.from('profiles').select('user_id, full_name, email').in('user_id', ids);
      const profMap = new Map((profs || []).map((p: any) => [p.user_id, p]));
      setAnalysts((members || []).map((m: any) => ({
        ...m,
        full_name: profMap.get(m.user_id)?.full_name || null,
        email: profMap.get(m.user_id)?.email || null,
      })));
    })();
  }, [open, organizationId, currentUserId]);

  const handleCreate = async () => {
    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke('create-pe-deal', {
      body: {
        organization_id: organizationId,
        enterprise_name: enterpriseName.trim() || null,
        ticket_demande: ticket ? Number(ticket) * 1_000_000 : null,
        currency,
        source,
        source_detail: source === 'autre' ? sourceDetail.trim() || null : null,
        lead_analyst_id: leadAnalystId,
      },
    });
    setSubmitting(false);
    if (error || (data as any)?.error) { toast.error((data as any)?.error || error?.message); return; }
    toast.success(`Deal ${(data as any).deal.deal_ref} créé`);
    setEnterpriseName(''); setTicket(''); setSourceDetail('');
    onCreated();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Nouveau deal</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label>Nom de la cible</Label>
            <Input value={enterpriseName} onChange={e => setEnterpriseName(e.target.value)} placeholder="PharmaCi Industries" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Ticket demandé (M)</Label>
              <Input type="number" step="0.1" value={ticket} onChange={e => setTicket(e.target.value)} placeholder="4.2" />
            </div>
            <div className="space-y-1.5">
              <Label>Devise</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="EUR">EUR</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="FCFA">FCFA</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Source</Label>
            <Select value={source} onValueChange={setSource}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SOURCES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {source === 'autre' && (
            <div className="space-y-1.5">
              <Label>Précision</Label>
              <Input value={sourceDetail} onChange={e => setSourceDetail(e.target.value)} placeholder="…" />
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Analyste lead</Label>
            <Select value={leadAnalystId} onValueChange={setLeadAnalystId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {analysts.map((a) => (
                  <SelectItem key={a.user_id} value={a.user_id}>
                    {a.full_name || a.email} {a.user_id === currentUserId ? '(moi)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={handleCreate} disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Créer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
