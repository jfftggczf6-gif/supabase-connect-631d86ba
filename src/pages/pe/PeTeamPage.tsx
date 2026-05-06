import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, UserPlus, X, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useCurrentRole } from '@/hooks/useCurrentRole';
import { toast } from 'sonner';
import AssignTeamDialog from '@/components/pe/AssignTeamDialog';

interface Member { user_id: string; full_name: string | null; email: string | null; role: string; }
interface Assignment { id: string; im_user_id: string; analyst_user_id: string; }

export default function PeTeamPage() {
  const navigate = useNavigate();
  const { currentOrg } = useOrganization();
  const { role: orgRole, isSuperAdmin } = useCurrentRole();
  const [ims, setIms] = useState<Member[]>([]);
  const [analysts, setAnalysts] = useState<Member[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAssign, setShowAssign] = useState(false);

  const isManager = orgRole === 'owner' || orgRole === 'admin' || orgRole === 'managing_director' || isSuperAdmin;

  const load = useCallback(async () => {
    if (!currentOrg) return;
    setLoading(true);
    const { data: members } = await supabase
      .from('organization_members')
      .select('user_id, role')
      .eq('organization_id', currentOrg.id)
      .eq('is_active', true);
    const userIds = (members || []).map((m: any) => m.user_id);
    let profMap = new Map<string, any>();
    if (userIds.length) {
      const { data: profs } = await supabase.from('profiles').select('user_id, full_name, email').in('user_id', userIds);
      profMap = new Map((profs || []).map((p: any) => [p.user_id, p]));
    }
    const enriched = (members || []).map((m: any) => ({
      ...m,
      full_name: profMap.get(m.user_id)?.full_name || null,
      email: profMap.get(m.user_id)?.email || null,
    }));
    setIms(enriched.filter(m => m.role === 'investment_manager'));
    setAnalysts(enriched.filter(m => m.role === 'analyst'));

    const { data: asg } = await supabase
      .from('pe_team_assignments')
      .select('id, im_user_id, analyst_user_id')
      .eq('organization_id', currentOrg.id)
      .eq('is_active', true);
    setAssignments(asg || []);
    setLoading(false);
  }, [currentOrg]);

  useEffect(() => { load(); }, [load]);

  const handleRemove = async (im_user_id: string, analyst_user_id: string) => {
    if (!confirm('Retirer cette assignation ?')) return;
    const { error, data } = await supabase.functions.invoke('assign-pe-team', {
      body: { organization_id: currentOrg!.id, im_user_id, analyst_user_id, action: 'remove' },
    });
    if (error || (data as any)?.error) { toast.error((data as any)?.error || error?.message); return; }
    toast.success('Assignation retirée');
    load();
  };

  if (loading) return <DashboardLayout title="Équipe PE"><div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div></DashboardLayout>;

  // Analystes non rattachés (uniquement utile au MD)
  const assignedAnalystIds = new Set(assignments.map(a => a.analyst_user_id));
  const orphanAnalysts = analysts.filter(a => !assignedAnalystIds.has(a.user_id));

  const memberName = (uid: string) => {
    const m = [...ims, ...analysts].find(x => x.user_id === uid);
    return m?.full_name || m?.email || uid.slice(0, 8);
  };

  return (
    <DashboardLayout title="Équipe PE" subtitle={currentOrg?.name || ''}>
      <Button variant="ghost" size="sm" className="mb-4 gap-1.5" onClick={() => navigate('/pe')}>
        ← Retour au workspace
      </Button>

      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{ims.length}</span> Investment Manager{ims.length > 1 ? 's' : ''}
          {' · '}
          <span className="font-medium text-foreground">{analysts.length}</span> Analyste{analysts.length > 1 ? 's' : ''}
        </div>
        {isManager && (
          <Button onClick={() => setShowAssign(true)} className="gap-2">
            <UserPlus className="h-4 w-4" /> Assigner un analyste
          </Button>
        )}
      </div>

      {ims.length === 0 ? (
        <Card><CardContent className="p-5 text-sm text-muted-foreground">
          Aucun IM dans l'organisation. Invitez-en depuis la page Membres.
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {ims.map(im => {
            const supervised = assignments.filter(a => a.im_user_id === im.user_id);
            return (
              <Card key={im.user_id}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{im.full_name || im.email}</p>
                      <p className="text-xs text-muted-foreground">{im.email}</p>
                    </div>
                    <Badge variant="outline">{supervised.length} analyste{supervised.length > 1 ? 's' : ''}</Badge>
                  </div>
                  {supervised.length > 0 && (
                    <ul className="ml-4 space-y-1">
                      {supervised.map(a => (
                        <li key={a.id} className="flex items-center justify-between text-sm py-1">
                          <span>{memberName(a.analyst_user_id)}</span>
                          {isManager && (
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500"
                              onClick={() => handleRemove(im.user_id, a.analyst_user_id)}>
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {orphanAnalysts.length > 0 && isManager && (
        <Card className="border-amber-300 bg-amber-50/50 mt-4">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center gap-2 text-amber-900">
              <AlertTriangle className="h-4 w-4" />
              <p className="font-medium text-sm">{orphanAnalysts.length} analyste{orphanAnalysts.length > 1 ? 's' : ''} non rattaché{orphanAnalysts.length > 1 ? 's' : ''}</p>
            </div>
            <p className="text-xs text-muted-foreground">Leurs deals seront visibles uniquement au MD.</p>
            <ul className="ml-4 text-sm">
              {orphanAnalysts.map(a => <li key={a.user_id}>· {a.full_name || a.email}</li>)}
            </ul>
          </CardContent>
        </Card>
      )}

      {currentOrg && (
        <AssignTeamDialog open={showAssign} onOpenChange={setShowAssign}
          organizationId={currentOrg.id} onAssigned={load} />
      )}
    </DashboardLayout>
  );
}
