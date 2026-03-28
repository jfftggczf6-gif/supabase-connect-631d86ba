import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CreateCohorteDialog({ open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [organization, setOrganization] = useState('');
  const [budget, setBudget] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [enterprises, setEnterprises] = useState<any[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!open) return;
    (async () => {
      setLoading(true);
      const { data: ents } = await supabase
        .from('enterprises')
        .select('id, name, score_ir, coach_id, sector, country')
        .order('score_ir', { ascending: false });

      // Get coach names
      const coachIds = [...new Set((ents || []).map(e => e.coach_id).filter(Boolean))];
      let coachMap: Record<string, string> = {};
      if (coachIds.length) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', coachIds);
        (profiles || []).forEach(p => { coachMap[p.user_id] = p.full_name || ''; });
      }

      // Count deliverables per enterprise
      const { data: delivCounts } = await supabase
        .from('deliverables')
        .select('enterprise_id');
      const countMap: Record<string, number> = {};
      (delivCounts || []).forEach((d: any) => { countMap[d.enterprise_id] = (countMap[d.enterprise_id] || 0) + 1; });

      setEnterprises((ents || []).map(e => ({
        ...e,
        coach_name: coachMap[e.coach_id] || '',
        deliverables_count: countMap[e.id] || 0,
      })).filter(e => e.deliverables_count > 0 || e.score_ir > 0));
      setLoading(false);
    })();
  }, [open]);

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const handleCreate = async () => {
    if (!name.trim()) { toast.error('Le nom est requis'); return; }
    if (selected.size === 0) { toast.error('Sélectionnez au moins une entreprise'); return; }
    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-programme', {
        body: {
          action: 'create_cohorte',
          name: name.trim(),
          description: description.trim() || null,
          organization: organization.trim() || null,
          budget: budget ? Number(budget) : null,
          programme_start: startDate || null,
          programme_end: endDate || null,
          enterprise_ids: [...selected],
        }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(data.message || 'Cohorte créée');
      onOpenChange(false);
      if (data?.programme?.id) navigate(`/programmes/${data.programme.id}`);
    } catch (err: any) {
      toast.error(err.message || 'Erreur');
    }
    setCreating(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> Créer une cohorte de suivi</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Nom *</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="Cohorte Pilote Q2 2026" /></div>
            <div className="space-y-1.5"><Label>Organisation</Label><Input value={organization} onChange={e => setOrganization(e.target.value)} placeholder="ESONO / SellArts" /></div>
          </div>
          <div className="space-y-1.5"><Label>Description</Label><Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Suivi des PME accompagnées..." /></div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5"><Label>Budget</Label><Input type="number" value={budget} onChange={e => setBudget(e.target.value)} placeholder="250000000" /></div>
            <div className="space-y-1.5"><Label>Début</Label><Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Fin</Label><Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} /></div>
          </div>

          <div className="border-t pt-4">
            <h4 className="font-semibold text-sm mb-3">Sélectionner les entreprises</h4>
            {loading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
            ) : (
              <div className="space-y-1 max-h-[40vh] overflow-y-auto">
                {enterprises.map(e => (
                  <label key={e.id} className="flex items-center gap-3 p-2 rounded hover:bg-muted/50 cursor-pointer">
                    <Checkbox checked={selected.has(e.id)} onCheckedChange={() => toggle(e.id)} />
                    <span className="flex-1 text-sm font-medium truncate">{e.name}</span>
                    {e.score_ir > 0 && (
                      <Badge variant="outline" className={`text-[10px] ${e.score_ir >= 70 ? 'border-emerald-300 text-emerald-700' : e.score_ir >= 40 ? 'border-amber-300 text-amber-700' : 'border-red-300 text-red-700'}`}>
                        {e.score_ir}
                      </Badge>
                    )}
                    <span className="text-[10px] text-muted-foreground">{e.deliverables_count} livr.</span>
                    {e.coach_name && <span className="text-[10px] text-muted-foreground">coach: {e.coach_name}</span>}
                  </label>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-2">{selected.size} entreprise(s) sélectionnée(s)</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={handleCreate} disabled={creating || !name.trim() || selected.size === 0}>
            {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Users className="h-4 w-4 mr-2" />}
            Créer la cohorte ({selected.size})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
