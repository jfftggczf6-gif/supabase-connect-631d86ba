import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  onAssigned: () => void;
}

interface Member { user_id: string; full_name: string | null; email: string | null; role: string; }

export default function AssignTeamDialog({ open, onOpenChange, organizationId, onAssigned }: Props) {
  const [ims, setIms] = useState<Member[]>([]);
  const [analysts, setAnalysts] = useState<Member[]>([]);
  const [imId, setImId] = useState('');
  const [analystId, setAnalystId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data: members } = await supabase
        .from('organization_members')
        .select('user_id, role')
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .in('role', ['investment_manager', 'analyst']);
      const userIds = (members || []).map((m: any) => m.user_id);
      if (!userIds.length) { setIms([]); setAnalysts([]); return; }
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, email')
        .in('user_id', userIds);
      const profMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));
      const enriched = (members || []).map((m: any) => ({
        ...m,
        full_name: profMap.get(m.user_id)?.full_name || null,
        email: profMap.get(m.user_id)?.email || null,
      }));
      setIms(enriched.filter(m => m.role === 'investment_manager'));
      setAnalysts(enriched.filter(m => m.role === 'analyst'));
    })();
  }, [open, organizationId]);

  const handleAssign = async () => {
    if (!imId || !analystId) { toast.error('Sélectionne un IM et un Analyste'); return; }
    setSubmitting(true);
    const { error, data } = await supabase.functions.invoke('assign-pe-team', {
      body: { organization_id: organizationId, im_user_id: imId, analyst_user_id: analystId, action: 'add' },
    });
    setSubmitting(false);
    if (error || (data as any)?.error) { toast.error((data as any)?.error || error?.message); return; }
    toast.success('Assignation enregistrée');
    setImId(''); setAnalystId('');
    onAssigned();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Assigner un analyste à un IM</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Investment Manager</Label>
            <Select value={imId} onValueChange={setImId}>
              <SelectTrigger><SelectValue placeholder="Sélectionner un IM" /></SelectTrigger>
              <SelectContent>
                {ims.map(im => (
                  <SelectItem key={im.user_id} value={im.user_id}>
                    {im.full_name || im.email || im.user_id.slice(0, 8)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!ims.length && <p className="text-xs text-muted-foreground">Aucun IM dans l'org. Invite-en un depuis /organization/members.</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Analyste</Label>
            <Select value={analystId} onValueChange={setAnalystId}>
              <SelectTrigger><SelectValue placeholder="Sélectionner un analyste" /></SelectTrigger>
              <SelectContent>
                {analysts.map(a => (
                  <SelectItem key={a.user_id} value={a.user_id}>
                    {a.full_name || a.email || a.user_id.slice(0, 8)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!analysts.length && <p className="text-xs text-muted-foreground">Aucun analyste dans l'org.</p>}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={handleAssign} disabled={submitting || !imId || !analystId}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Assigner
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
