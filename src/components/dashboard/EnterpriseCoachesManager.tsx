import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Plus, X, Loader2, UserCog } from 'lucide-react';
import { toast } from 'sonner';

interface CoachRow {
  id: string;              // enterprise_coaches.id (soft-delete handle)
  coach_id: string;
  full_name: string | null;
  email: string | null;
}

interface CandidateCoach {
  user_id: string;
  full_name: string | null;
  email: string | null;
}

interface Props {
  enterpriseId: string;
  organizationId: string;
  canManage: boolean;
}

export default function EnterpriseCoachesManager({ enterpriseId, organizationId, canManage }: Props) {
  const [coaches, setCoaches] = useState<CoachRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [candidates, setCandidates] = useState<CandidateCoach[]>([]);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  const loadCoaches = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('enterprise_coaches')
      .select('id, coach_id')
      .eq('enterprise_id', enterpriseId)
      .eq('is_active', true);

    if (error) {
      console.error('[coaches-manager] load failed:', error);
      setLoading(false);
      return;
    }

    const ids = (data || []).map(r => r.coach_id);
    let profiles: Record<string, { full_name: string | null; email: string | null }> = {};
    if (ids.length) {
      const { data: profs } = await supabase
        .from('profiles')
        .select('user_id, full_name, email')
        .in('user_id', ids);
      profiles = Object.fromEntries((profs || []).map((p: any) => [p.user_id, { full_name: p.full_name, email: p.email }]));
    }
    setCoaches((data || []).map((r: any) => ({
      id: r.id,
      coach_id: r.coach_id,
      full_name: profiles[r.coach_id]?.full_name ?? null,
      email: profiles[r.coach_id]?.email ?? null,
    })));
    setLoading(false);
  }, [enterpriseId]);

  useEffect(() => { loadCoaches(); }, [loadCoaches]);

  const loadCandidates = useCallback(async () => {
    // Coaches de l'org moins ceux déjà assignés (actifs)
    const { data: members } = await supabase
      .from('organization_members')
      .select('user_id, role')
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .eq('role', 'coach');

    const memberIds = (members || []).map((m: any) => m.user_id);
    const assignedIds = new Set(coaches.map(c => c.coach_id));
    const freeIds = memberIds.filter((id: string) => !assignedIds.has(id));
    if (!freeIds.length) { setCandidates([]); return; }

    const { data: profs } = await supabase
      .from('profiles')
      .select('user_id, full_name, email')
      .in('user_id', freeIds);

    setCandidates((profs || []).map((p: any) => ({
      user_id: p.user_id,
      full_name: p.full_name,
      email: p.email,
    })));
  }, [organizationId, coaches]);

  useEffect(() => { if (popoverOpen) loadCandidates(); }, [popoverOpen, loadCandidates]);

  const addCoach = async (coachId: string) => {
    setAdding(coachId);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('enterprise_coaches').insert({
        enterprise_id: enterpriseId,
        coach_id: coachId,
        organization_id: organizationId,
        role: 'principal',
        assigned_by: user?.id ?? null,
        is_active: true,
      } as any);
      if (error) throw error;
      toast.success('Coach ajouté');
      setPopoverOpen(false);
      await loadCoaches();
    } catch (e: any) {
      toast.error(e.message?.includes('row-level security')
        ? 'Permission refusée. Seul un manager/admin de l\'organisation peut ajouter un coach.'
        : `Échec : ${e.message}`);
    } finally {
      setAdding(null);
    }
  };

  const removeCoach = async (row: CoachRow) => {
    if (!window.confirm(`Retirer ${row.full_name || row.email || 'ce coach'} du dossier ?`)) return;
    setRemoving(row.id);
    try {
      const { error } = await supabase
        .from('enterprise_coaches')
        .update({ is_active: false, unassigned_at: new Date().toISOString() } as any)
        .eq('id', row.id);
      if (error) throw error;
      toast.success('Coach retiré');
      await loadCoaches();
    } catch (e: any) {
      toast.error(e.message?.includes('row-level security')
        ? 'Permission refusée.'
        : `Échec : ${e.message}`);
    } finally {
      setRemoving(null);
    }
  };

  if (loading) {
    return <span className="text-xs text-muted-foreground flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> coaches…</span>;
  }

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <UserCog className="h-3.5 w-3.5 text-muted-foreground" />
      {coaches.length === 0 && (
        <span className="text-xs text-muted-foreground italic">Aucun coach assigné</span>
      )}
      {coaches.map(c => (
        <Badge key={c.id} variant="secondary" className="text-xs font-normal gap-1">
          {c.full_name || c.email || c.coach_id.slice(0, 8)}
          {canManage && (
            <button
              onClick={() => removeCoach(c)}
              disabled={removing === c.id}
              className="hover:text-destructive disabled:opacity-40 ml-0.5"
              aria-label={`Retirer ${c.full_name || 'ce coach'}`}
            >
              {removing === c.id ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <X className="h-3 w-3" />}
            </button>
          )}
        </Badge>
      ))}
      {canManage && (
        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-6 px-2 text-xs gap-1">
              <Plus className="h-3 w-3" /> Coach
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-2" align="start">
            <div className="text-xs font-medium text-muted-foreground px-2 py-1.5">Ajouter un coach de l'organisation</div>
            {candidates.length === 0 ? (
              <div className="text-xs text-muted-foreground italic px-2 py-3 text-center">
                Aucun coach disponible dans cette organisation.
              </div>
            ) : (
              <div className="max-h-64 overflow-y-auto">
                {candidates.map(c => (
                  <button
                    key={c.user_id}
                    onClick={() => addCoach(c.user_id)}
                    disabled={adding === c.user_id}
                    className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-muted disabled:opacity-50 flex items-center justify-between"
                  >
                    <span className="truncate">
                      <span className="font-medium">{c.full_name || 'Sans nom'}</span>
                      {c.email && <span className="text-muted-foreground text-xs ml-1">{c.email}</span>}
                    </span>
                    {adding === c.user_id && <Loader2 className="h-3 w-3 animate-spin flex-shrink-0" />}
                  </button>
                ))}
              </div>
            )}
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
