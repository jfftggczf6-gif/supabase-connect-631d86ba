import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Loader2, Plus, ChevronRight, Building2, MoreVertical, Pencil, UserCog, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useOrganization } from '@/contexts/OrganizationContext';

const SUPPORTED_COUNTRIES = [
  "Afrique du Sud", "Bénin", "Burkina Faso", "Cameroun", "Congo",
  "Côte d'Ivoire", "Éthiopie", "Gabon", "Ghana", "Guinée",
  "Guinée-Bissau", "Kenya", "Madagascar", "Mali", "Maroc",
  "Niger", "Nigeria", "RDC", "Rwanda", "Sénégal",
  "Tanzanie", "Togo", "Tunisie",
].sort((a, b) => a.localeCompare(b, 'fr'));

interface Props {
  programmeId: string;
  programmeName: string;
}

export default function CohorteEnterprisesTab({ programmeId, programmeName }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { currentOrg } = useOrganization();
  const [enterprises, setEnterprises] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [availableEnts, setAvailableEnts] = useState<any[]>([]);
  const [selectedToAdd, setSelectedToAdd] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);

  // Sous-formulaire "Nouvelle entreprise" intégré au modal d'ajout
  const [showNewEnt, setShowNewEnt] = useState(false);
  const [newEntName, setNewEntName] = useState('');
  const [newEntSector, setNewEntSector] = useState('');
  const [newEntCountry, setNewEntCountry] = useState('');
  const [newEntContactEmail, setNewEntContactEmail] = useState('');
  const [creatingEnt, setCreatingEnt] = useState(false);

  // Coaches sélectionnables : déjà inscrits (user_id) + invités en attente (invitation_id)
  type CoachOption = {
    kind: 'member' | 'pending';
    user_id?: string;
    invitation_id?: string;
    full_name: string | null;
    email: string | null;
  };
  const [availableCoaches, setAvailableCoaches] = useState<CoachOption[]>([]);
  const [newEntCoachUserIds, setNewEntCoachUserIds] = useState<Set<string>>(new Set());
  const [newEntCoachInvitationIds, setNewEntCoachInvitationIds] = useState<Set<string>>(new Set());

  // Dialog d'édition des infos entreprise
  const [editInfoOpen, setEditInfoOpen] = useState(false);
  const [editingEnt, setEditingEnt] = useState<any>(null);
  const [editForm, setEditForm] = useState({ name: '', sector: '', country: '', contact_email: '' });
  const [savingInfo, setSavingInfo] = useState(false);

  // Dialog d'édition des coachs assignés
  const [editCoachesOpen, setEditCoachesOpen] = useState(false);
  const [editCoachesEntId, setEditCoachesEntId] = useState<string | null>(null);
  const [editCoachUserIds, setEditCoachUserIds] = useState<Set<string>>(new Set());
  const [editCoachInvitationIds, setEditCoachInvitationIds] = useState<Set<string>>(new Set());
  const [initialCoachUserIds, setInitialCoachUserIds] = useState<Set<string>>(new Set());
  const [initialCoachInvitationIds, setInitialCoachInvitationIds] = useState<Set<string>>(new Set());
  const [savingCoaches, setSavingCoaches] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  const fetchEnterprises = async () => {
    setLoading(true);
    const { data: cands } = await supabase
      .from('candidatures')
      .select('enterprise_id, assigned_coach_id, submitted_at')
      .eq('programme_id', programmeId)
      .eq('status', 'selected');

    if (!cands?.length) { setEnterprises([]); setLoading(false); return; }

    const entIds = cands.map(c => c.enterprise_id).filter(Boolean);
    const [{ data: ents }, { data: delivs }] = await Promise.all([
      supabase.from('enterprises').select('id, name, score_ir, coach_id, sector, country, last_activity').in('id', entIds),
      supabase.from('deliverables').select('enterprise_id').in('enterprise_id', entIds),
    ]);

    // N-to-N: fetch enterprise_coaches (multi-coachs par entreprise)
    const { data: ecLinks } = await supabase
      .from('enterprise_coaches')
      .select('enterprise_id, coach_id')
      .in('enterprise_id', entIds)
      .eq('is_active', true);
    const ecMap: Record<string, string[]> = {};
    (ecLinks || []).forEach(ec => {
      if (!ecMap[ec.enterprise_id]) ecMap[ec.enterprise_id] = [];
      ecMap[ec.enterprise_id].push(ec.coach_id);
    });

    // Pré-assignations en attente (invitations pas encore acceptées)
    const { data: eciLinks } = await supabase
      .from('enterprise_coach_invitations' as any)
      .select('enterprise_id, invitation_id')
      .in('enterprise_id', entIds);
    const eciMap: Record<string, string[]> = {};
    ((eciLinks || []) as any[]).forEach((ec: any) => {
      if (!eciMap[ec.enterprise_id]) eciMap[ec.enterprise_id] = [];
      eciMap[ec.enterprise_id].push(ec.invitation_id);
    });

    // Récupère noms : coachs acceptés (profiles) + emails des invitations pending
    const allCoachIds = [...new Set([
      ...Object.values(ecMap).flat(),
      ...(ents || []).filter(e => !ecMap[e.id]).map(e => e.coach_id).filter(Boolean),
    ])];
    let coachMap: Record<string, string> = {};
    if (allCoachIds.length) {
      const { data: profiles } = await supabase.from('profiles').select('user_id, full_name').in('user_id', allCoachIds);
      (profiles || []).forEach(p => { coachMap[p.user_id] = p.full_name || ''; });
    }

    const allInvIds = [...new Set(Object.values(eciMap).flat())];
    let invMap: Record<string, string> = {};
    if (allInvIds.length) {
      const { data: invs } = await supabase
        .from('organization_invitations')
        .select('id, email, accepted_at, revoked_at')
        .in('id', allInvIds);
      (invs || []).forEach((i: any) => {
        // N'affiche que si toujours pending
        if (!i.accepted_at && !i.revoked_at) invMap[i.id] = i.email;
      });
    }

    const delivCount: Record<string, number> = {};
    (delivs || []).forEach((d: any) => { delivCount[d.enterprise_id] = (delivCount[d.enterprise_id] || 0) + 1; });

    setEnterprises((ents || []).map(e => {
      const coachIds = ecMap[e.id] || (e.coach_id ? [e.coach_id] : []);
      const coachNames = coachIds.map(id => coachMap[id]).filter(Boolean);
      const pendingInvIds = (eciMap[e.id] || []).filter(id => invMap[id]);
      const pendingEmails = pendingInvIds.map(id => invMap[id]);
      return {
        ...e,
        coach_ids: coachIds,
        coach_names: coachNames,
        pending_invitation_ids: pendingInvIds,
        pending_emails: pendingEmails,
        deliverables_count: delivCount[e.id] || 0,
      };
    }).sort((a, b) => (b.score_ir || 0) - (a.score_ir || 0)));
    setLoading(false);
  };

  useEffect(() => { fetchEnterprises(); }, [programmeId]);

  // Charge les coaches disponibles (membres acceptés + invitations pending) pour la pré-assignation
  const fetchAvailableCoaches = async () => {
    if (!currentOrg?.id) { setAvailableCoaches([]); return; }
    const { data: members } = await supabase
      .from('organization_members')
      .select('user_id')
      .eq('organization_id', currentOrg.id)
      .eq('is_active', true)
      .eq('role', 'coach');
    const memberIds = (members || []).map((m: any) => m.user_id);
    let memberProfiles: Array<{ user_id: string; full_name: string | null; email: string | null }> = [];
    if (memberIds.length) {
      const { data: profs } = await supabase
        .from('profiles')
        .select('user_id, full_name, email')
        .in('user_id', memberIds);
      memberProfiles = (profs || []) as any;
    }
    const nowIso = new Date().toISOString();
    const { data: invites } = await supabase
      .from('organization_invitations')
      .select('id, email')
      .eq('organization_id', currentOrg.id)
      .eq('role', 'coach')
      .is('accepted_at', null)
      .is('revoked_at', null)
      .gt('expires_at', nowIso);
    const options: CoachOption[] = [
      ...memberProfiles.map(p => ({
        kind: 'member' as const,
        user_id: p.user_id,
        full_name: p.full_name,
        email: p.email,
      })),
      ...(invites || []).map((i: any) => ({
        kind: 'pending' as const,
        invitation_id: i.id,
        full_name: null,
        email: i.email,
      })),
    ];
    setAvailableCoaches(options);
  };

  const toggleCoachUser = (userId: string) => {
    setNewEntCoachUserIds(prev => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId); else next.add(userId);
      return next;
    });
  };
  const toggleCoachInvitation = (invitationId: string) => {
    setNewEntCoachInvitationIds(prev => {
      const next = new Set(prev);
      if (next.has(invitationId)) next.delete(invitationId); else next.add(invitationId);
      return next;
    });
  };

  const handleRemove = async (enterpriseId: string, name: string) => {
    if (!confirm(t('cohorte.remove_confirm', { name }))) return;
    setRemoving(enterpriseId);
    const { data, error } = await supabase.functions.invoke('manage-programme', {
      body: { action: 'remove_enterprise', programme_id: programmeId, enterprise_id: enterpriseId }
    });
    setRemoving(null);
    if (error || data?.error) { toast.error(data?.error || error?.message || t('common.error')); return; }
    toast.success(t('cohorte.removed', { name }));
    fetchEnterprises();
  };

  const openEditInfo = (ent: any) => {
    setEditingEnt(ent);
    setEditForm({
      name: ent.name || '',
      sector: ent.sector || '',
      country: ent.country || '',
      contact_email: ent.contact_email || '',
    });
    setEditInfoOpen(true);
  };

  const handleSaveInfo = async () => {
    if (!editingEnt || !editForm.name.trim()) {
      toast.error('Nom requis');
      return;
    }
    setSavingInfo(true);
    const { error } = await supabase
      .from('enterprises' as any)
      .update({
        name: editForm.name.trim(),
        sector: editForm.sector.trim() || null,
        country: editForm.country || null,
        contact_email: editForm.contact_email.trim() || null,
      })
      .eq('id', editingEnt.id);
    setSavingInfo(false);
    if (error) { toast.error(`Échec : ${error.message}`); return; }
    toast.success(`Infos de "${editForm.name.trim()}" mises à jour`);
    setEditInfoOpen(false);
    fetchEnterprises();
  };

  const openEditCoaches = async (ent: any) => {
    setEditCoachesEntId(ent.id);
    fetchAvailableCoaches();
    // Charge les assignations existantes
    const [{ data: ecRows }, { data: eciRows }] = await Promise.all([
      supabase
        .from('enterprise_coaches')
        .select('coach_id')
        .eq('enterprise_id', ent.id)
        .eq('is_active', true),
      supabase
        .from('enterprise_coach_invitations' as any)
        .select('invitation_id')
        .eq('enterprise_id', ent.id),
    ]);
    const userIds = new Set((ecRows || []).map((r: any) => r.coach_id as string));
    const invIds = new Set(((eciRows || []) as any[]).map((r: any) => r.invitation_id as string));
    setEditCoachUserIds(new Set(userIds));
    setEditCoachInvitationIds(new Set(invIds));
    setInitialCoachUserIds(new Set(userIds));
    setInitialCoachInvitationIds(new Set(invIds));
    setEditCoachesOpen(true);
  };

  const toggleEditCoachUser = (userId: string) => {
    setEditCoachUserIds(prev => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId); else next.add(userId);
      return next;
    });
  };
  const toggleEditCoachInvitation = (invitationId: string) => {
    setEditCoachInvitationIds(prev => {
      const next = new Set(prev);
      if (next.has(invitationId)) next.delete(invitationId); else next.add(invitationId);
      return next;
    });
  };

  const handleSaveCoaches = async () => {
    if (!editCoachesEntId || !currentOrg?.id) return;
    setSavingCoaches(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      // Diff membres acceptés
      const toAddUsers = [...editCoachUserIds].filter(id => !initialCoachUserIds.has(id));
      const toRemoveUsers = [...initialCoachUserIds].filter(id => !editCoachUserIds.has(id));
      // Diff pending
      const toAddInvs = [...editCoachInvitationIds].filter(id => !initialCoachInvitationIds.has(id));
      const toRemoveInvs = [...initialCoachInvitationIds].filter(id => !editCoachInvitationIds.has(id));

      if (toAddUsers.length) {
        const rows = toAddUsers.map(coachId => ({
          enterprise_id: editCoachesEntId,
          coach_id: coachId,
          organization_id: currentOrg.id,
          role: 'principal',
          assigned_by: user?.id || null,
          is_active: true,
        }));
        const { error } = await supabase.from('enterprise_coaches' as any).insert(rows);
        if (error) throw error;
      }
      if (toRemoveUsers.length) {
        const { error } = await supabase
          .from('enterprise_coaches' as any)
          .update({ is_active: false })
          .eq('enterprise_id', editCoachesEntId)
          .in('coach_id', toRemoveUsers);
        if (error) throw error;
      }
      if (toAddInvs.length) {
        const rows = toAddInvs.map(invId => ({
          enterprise_id: editCoachesEntId,
          invitation_id: invId,
          organization_id: currentOrg.id,
          role: 'principal',
          assigned_by: user?.id || null,
        }));
        const { error } = await supabase.from('enterprise_coach_invitations' as any).insert(rows);
        if (error) throw error;
      }
      if (toRemoveInvs.length) {
        const { error } = await supabase
          .from('enterprise_coach_invitations' as any)
          .delete()
          .eq('enterprise_id', editCoachesEntId)
          .in('invitation_id', toRemoveInvs);
        if (error) throw error;
      }

      toast.success('Coachs mis à jour');
      setEditCoachesOpen(false);
      fetchEnterprises();
    } catch (err: any) {
      toast.error(`Échec : ${err.message || 'erreur'}`);
    } finally {
      setSavingCoaches(false);
    }
  };

  const openAddDialog = async () => {
    setShowAdd(true);
    setSelectedToAdd(new Set());
    fetchAvailableCoaches();
    const existingIds = new Set(enterprises.map(e => e.id));
    let addEntQ = supabase
      .from('enterprises')
      .select('id, name, score_ir, coach_id, sector')
      .order('score_ir', { ascending: false });
    if (currentOrg?.id) addEntQ = addEntQ.eq('organization_id', currentOrg.id);
    const { data: allEnts } = await addEntQ;

    // N-to-N: fetch enterprise_coaches
    const allEntIds = (allEnts || []).map(e => e.id);
    const { data: ecLinks2 } = allEntIds.length > 0
      ? await supabase.from('enterprise_coaches').select('enterprise_id, coach_id').in('enterprise_id', allEntIds).eq('is_active', true)
      : { data: [] as any[] };
    const ecMap2: Record<string, string> = {};
    (ecLinks2 || []).forEach(ec => { ecMap2[ec.enterprise_id] = ec.coach_id; });

    const allCoachIds = [...new Set((allEnts || []).map(e => ecMap2[e.id] || e.coach_id).filter(Boolean))];
    let coachMap: Record<string, string> = {};
    if (allCoachIds.length) {
      const { data: profiles } = await supabase.from('profiles').select('user_id, full_name').in('user_id', allCoachIds);
      (profiles || []).forEach(p => { coachMap[p.user_id] = p.full_name || ''; });
    }

    setAvailableEnts((allEnts || []).filter(e => !existingIds.has(e.id)).map(e => ({
      ...e, coach_name: coachMap[ecMap2[e.id] || e.coach_id] || '',
    })));
  };

  // Crée une nouvelle entreprise (org courante) puis l'intègre directement à la cohorte
  const handleCreateAndAdd = async () => {
    if (!newEntName.trim() || !newEntCountry || !currentOrg?.id) {
      toast.error('Nom et pays requis');
      return;
    }
    setCreatingEnt(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: ent, error } = await supabase
        .from('enterprises' as any)
        .insert({
          name: newEntName.trim(),
          sector: newEntSector.trim() || null,
          country: newEntCountry,
          contact_email: newEntContactEmail.trim() || null,
          organization_id: currentOrg.id,
          user_id: user?.id || null,
          phase: 'identite',
        })
        .select('id, name')
        .single();
      if (error) throw error;
      const inserted = ent as any;

      // 1) Coaches déjà acceptés → enterprise_coaches
      if (newEntCoachUserIds.size > 0) {
        const rows = Array.from(newEntCoachUserIds).map(coachId => ({
          enterprise_id: inserted.id,
          coach_id: coachId,
          organization_id: currentOrg.id,
          role: 'principal',
          assigned_by: user?.id || null,
          is_active: true,
        }));
        const { error: ecError } = await supabase
          .from('enterprise_coaches' as any)
          .insert(rows);
        if (ecError) {
          console.warn('[create-enterprise] coach assignment failed:', ecError);
          toast.warning(`Entreprise créée mais ${newEntCoachUserIds.size} coach(es) non assignés : ${ecError.message}`);
        }
      }

      // 2) Coaches en attente d'acceptation → enterprise_coach_invitations
      if (newEntCoachInvitationIds.size > 0) {
        const rows = Array.from(newEntCoachInvitationIds).map(invId => ({
          enterprise_id: inserted.id,
          invitation_id: invId,
          organization_id: currentOrg.id,
          role: 'principal',
          assigned_by: user?.id || null,
        }));
        const { error: eciError } = await supabase
          .from('enterprise_coach_invitations' as any)
          .insert(rows);
        if (eciError) {
          console.warn('[create-enterprise] pending coach pre-assign failed:', eciError);
          toast.warning(`Entreprise créée mais ${newEntCoachInvitationIds.size} pré-assignation(s) en attente non enregistrées : ${eciError.message}`);
        }
      }

      // Intègre immédiatement la nouvelle entreprise au programme courant
      const { data, error: addErr } = await supabase.functions.invoke('manage-programme', {
        body: { action: 'add_enterprise', programme_id: programmeId, enterprise_id: inserted.id }
      });
      const totalAssigned = newEntCoachUserIds.size + newEntCoachInvitationIds.size;
      const coachSuffix = totalAssigned > 0 ? ` · ${totalAssigned} coach(es) assigné(s)${newEntCoachInvitationIds.size > 0 ? ' (dont pré-assignés en attente)' : ''}` : '';
      if (addErr || data?.error) {
        toast.warning(`Entreprise "${inserted.name}" créée${coachSuffix} mais non ajoutée à la cohorte : ${data?.error || addErr?.message}`);
      } else {
        toast.success(`Entreprise "${inserted.name}" créée et ajoutée à la cohorte${coachSuffix}`);
      }

      // Reset + refresh
      setNewEntName(''); setNewEntSector(''); setNewEntCountry(''); setNewEntContactEmail('');
      setNewEntCoachUserIds(new Set());
      setNewEntCoachInvitationIds(new Set());
      setShowNewEnt(false);
      await fetchEnterprises();
      await openAddDialog(); // recharge la liste des candidats (la nouvelle entreprise sera désormais dans la cohorte)
    } catch (err: any) {
      toast.error(err.message || 'Erreur création entreprise');
    } finally {
      setCreatingEnt(false);
    }
  };

  const handleAddEnterprises = async () => {
    setAdding(true);
    let added = 0;
    for (const entId of selectedToAdd) {
      const { data, error } = await supabase.functions.invoke('manage-programme', {
        body: { action: 'add_enterprise', programme_id: programmeId, enterprise_id: entId }
      });
      if (!error && !data?.error) added++;
    }
    toast.success(t('cohorte.enterprises_added', { count: added }));
    setShowAdd(false);
    setAdding(false);
    fetchEnterprises();
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">{t('cohorte.enterprises_title')} ({enterprises.length})</h3>
        <Button size="sm" onClick={openAddDialog}><Plus className="h-4 w-4 mr-1" /> {t('common.add')}</Button>
      </div>

      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>{t('cohorte.enterprise')}</TableHead>
            <TableHead>{t('cohorte.score_ir')}</TableHead>
            <TableHead>{t('cohorte.coach')}</TableHead>
            <TableHead>{t('cohorte.deliverables')}</TableHead>
            <TableHead>{t('cohorte.activity')}</TableHead>
            <TableHead></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {enterprises.map(e => {
              const totalCoaches = (e.coach_names?.length || 0) + (e.pending_emails?.length || 0);
              return (
              <TableRow key={e.id} className="group cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/programmes/${programmeId}/enterprise/${e.id}`)}>
                <TableCell className="font-medium">{e.name}</TableCell>
                <TableCell>
                  {e.score_ir > 0 ? (
                    <Badge variant="outline" className={e.score_ir >= 70 ? 'border-emerald-300 text-emerald-700' : e.score_ir >= 40 ? 'border-amber-300 text-amber-700' : 'border-red-300 text-red-700'}>{e.score_ir}</Badge>
                  ) : '—'}
                </TableCell>
                <TableCell className="text-sm">
                  {totalCoaches === 0 ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {(e.coach_names || []).map((name: string, i: number) => (
                        <Badge key={`c-${i}`} variant="secondary" className="text-[11px] font-normal">{name}</Badge>
                      ))}
                      {(e.pending_emails || []).map((email: string, i: number) => (
                        <Badge
                          key={`p-${i}`}
                          variant="outline"
                          className="text-[11px] font-normal bg-amber-50 text-amber-800 border-amber-200"
                          title="Coach pré-assigné, en attente d'acceptation de l'invitation"
                        >
                          {email}
                        </Badge>
                      ))}
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-sm">{e.deliverables_count}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{e.last_activity ? new Date(e.last_activity).toLocaleDateString('fr-FR') : '—'}</TableCell>
                <TableCell onClick={(ev) => ev.stopPropagation()}>
                  <div className="flex items-center gap-1">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          disabled={removing === e.id}
                          title="Actions"
                        >
                          {removing === e.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreVertical className="h-4 w-4" />}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-52">
                        <DropdownMenuItem onClick={() => openEditInfo(e)} className="gap-2">
                          <Pencil className="h-3.5 w-3.5" /> Modifier les infos
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openEditCoaches(e)} className="gap-2">
                          <UserCog className="h-3.5 w-3.5" /> Modifier les coachs
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleRemove(e.id, e.name)}
                          className="gap-2 text-red-600 focus:text-red-700 focus:bg-red-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Retirer de la cohorte
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </TableCell>
              </TableRow>
              );
            })}
            {enterprises.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">{t('cohorte.no_enterprises')}</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent></Card>

      {/* Add dialog */}
      <Dialog open={showAdd} onOpenChange={(open) => {
        setShowAdd(open);
        if (!open) {
          setShowNewEnt(false);
          setNewEntCoachUserIds(new Set());
          setNewEntCoachInvitationIds(new Set());
        }
      }}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{t('cohorte.add_enterprises')}</DialogTitle></DialogHeader>

          {/* Toggle créer nouvelle entreprise */}
          <div className="flex items-center justify-between border-b pb-2">
            <span className="text-xs text-muted-foreground">
              Sélectionne dans la liste ou crée une nouvelle entreprise.
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowNewEnt(!showNewEnt)}
              className="gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              {showNewEnt ? 'Fermer' : 'Nouvelle entreprise'}
            </Button>
          </div>

          {/* Sous-formulaire création */}
          {showNewEnt && (
            <div className="rounded-lg border border-dashed bg-muted/30 p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Building2 className="h-4 w-4" /> Créer une nouvelle entreprise
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Nom *</Label>
                  <Input value={newEntName} onChange={e => setNewEntName(e.target.value)} placeholder="EcoBuild CI SARL" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Pays *</Label>
                  <select
                    value={newEntCountry}
                    onChange={e => setNewEntCountry(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">— Sélectionner —</option>
                    {SUPPORTED_COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Secteur</Label>
                  <Input value={newEntSector} onChange={e => setNewEntSector(e.target.value)} placeholder="Agro-industrie, BTP..." />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Email contact entrepreneur</Label>
                  <Input type="email" value={newEntContactEmail} onChange={e => setNewEntContactEmail(e.target.value)} placeholder="contact@pme.ci" />
                </div>
              </div>
              <div className="space-y-2 pt-1">
                <Label className="text-xs">Coaches assignés (optionnel)</Label>
                {availableCoaches.length === 0 ? (
                  <div className="text-[11px] text-muted-foreground italic px-2 py-1.5 rounded bg-background border">
                    Aucun coach disponible dans cette organisation. Tu peux créer l'entreprise sans coach et l'assigner plus tard.
                  </div>
                ) : (
                  <div className="rounded-md border bg-background max-h-44 overflow-y-auto divide-y">
                    {availableCoaches.map((c) => {
                      const isMember = c.kind === 'member';
                      const id = isMember ? c.user_id! : c.invitation_id!;
                      const checked = isMember
                        ? newEntCoachUserIds.has(id)
                        : newEntCoachInvitationIds.has(id);
                      const onToggle = () => isMember
                        ? toggleCoachUser(id)
                        : toggleCoachInvitation(id);
                      return (
                        <label
                          key={`${c.kind}-${id}`}
                          className="flex items-center gap-2 px-2.5 py-1.5 cursor-pointer hover:bg-muted/30"
                        >
                          <Checkbox checked={checked} onCheckedChange={onToggle} />
                          <span className="flex-1 text-xs flex items-center gap-1.5 min-w-0">
                            <span className="truncate">
                              {c.full_name && (
                                <span className="font-medium">{c.full_name}</span>
                              )}
                              {c.email && (
                                <span className={c.full_name ? 'text-muted-foreground ml-1' : 'font-medium'}>
                                  {c.email}
                                </span>
                              )}
                            </span>
                            {!isMember && (
                              <Badge variant="outline" className="text-[9px] bg-amber-50 text-amber-800 border-amber-200 flex-shrink-0">
                                En attente
                              </Badge>
                            )}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
                {(newEntCoachUserIds.size > 0 || newEntCoachInvitationIds.size > 0) && (
                  <div className="text-[11px] text-muted-foreground">
                    {newEntCoachUserIds.size + newEntCoachInvitationIds.size} coach(es) assigné(s)
                    {newEntCoachInvitationIds.size > 0 && (
                      <span className="italic"> · dont {newEntCoachInvitationIds.size} pré-assigné(s) — l'assignation sera effective dès leur acceptation</span>
                    )}
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" variant="ghost" size="sm" onClick={() => {
                  setShowNewEnt(false);
                  setNewEntCoachUserIds(new Set());
                  setNewEntCoachInvitationIds(new Set());
                }}>
                  Annuler
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleCreateAndAdd}
                  disabled={creatingEnt || !newEntName.trim() || !newEntCountry}
                >
                  {creatingEnt ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Plus className="h-3.5 w-3.5 mr-1.5" />}
                  Créer et ajouter à la cohorte
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-1">
            {availableEnts.map(e => (
              <label key={e.id} className="flex items-center gap-3 p-2 rounded hover:bg-muted/50 cursor-pointer">
                <Checkbox checked={selectedToAdd.has(e.id)} onCheckedChange={() => {
                  const next = new Set(selectedToAdd);
                  if (next.has(e.id)) next.delete(e.id); else next.add(e.id);
                  setSelectedToAdd(next);
                }} />
                <span className="flex-1 text-sm font-medium truncate">{e.name}</span>
                {e.score_ir > 0 && <Badge variant="outline" className="text-[10px]">{e.score_ir}</Badge>}
                {e.coach_name && <span className="text-[10px] text-muted-foreground">{e.coach_name}</span>}
              </label>
            ))}
            {availableEnts.length === 0 && !showNewEnt && (
              <p className="text-sm text-muted-foreground py-4 text-center">
                {t('cohorte.all_enterprises_added')}
                <br />
                <span className="text-xs">Clique sur « Nouvelle entreprise » ci-dessus pour en créer une.</span>
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleAddEnterprises} disabled={adding || selectedToAdd.size === 0}>
              {adding ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {t('common.add')} ({selectedToAdd.size})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog : modifier les infos de l'entreprise */}
      <Dialog open={editInfoOpen} onOpenChange={setEditInfoOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-4 w-4" /> Modifier l'entreprise
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Nom *</Label>
              <Input
                value={editForm.name}
                onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Pays</Label>
              <select
                value={editForm.country}
                onChange={e => setEditForm(f => ({ ...f, country: e.target.value }))}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">— Non défini —</option>
                {SUPPORTED_COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Secteur</Label>
              <Input
                value={editForm.sector}
                onChange={e => setEditForm(f => ({ ...f, sector: e.target.value }))}
                placeholder="Agro-industrie, BTP..."
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Email contact entrepreneur</Label>
              <Input
                type="email"
                value={editForm.contact_email}
                onChange={e => setEditForm(f => ({ ...f, contact_email: e.target.value }))}
                placeholder="contact@pme.ci"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditInfoOpen(false)} disabled={savingInfo}>Annuler</Button>
            <Button onClick={handleSaveInfo} disabled={savingInfo || !editForm.name.trim()}>
              {savingInfo && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog : modifier les coachs assignés à l'entreprise */}
      <Dialog open={editCoachesOpen} onOpenChange={(open) => {
        setEditCoachesOpen(open);
        if (!open) {
          setEditCoachesEntId(null);
          setEditCoachUserIds(new Set());
          setEditCoachInvitationIds(new Set());
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCog className="h-4 w-4" /> Modifier les coachs assignés
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {availableCoaches.length === 0 ? (
              <div className="text-xs text-muted-foreground italic px-2 py-3 rounded bg-muted/40 border">
                Aucun coach disponible dans cette organisation. Invite un coach depuis la page Membres pour pouvoir l'assigner.
              </div>
            ) : (
              <div className="rounded-md border bg-background max-h-72 overflow-y-auto divide-y">
                {availableCoaches.map((c) => {
                  const isMember = c.kind === 'member';
                  const id = isMember ? c.user_id! : c.invitation_id!;
                  const checked = isMember
                    ? editCoachUserIds.has(id)
                    : editCoachInvitationIds.has(id);
                  const onToggle = () => isMember
                    ? toggleEditCoachUser(id)
                    : toggleEditCoachInvitation(id);
                  return (
                    <label
                      key={`${c.kind}-${id}`}
                      className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-muted/30"
                    >
                      <Checkbox checked={checked} onCheckedChange={onToggle} />
                      <span className="flex-1 text-sm flex items-center gap-1.5 min-w-0">
                        <span className="truncate">
                          {c.full_name && <span className="font-medium">{c.full_name}</span>}
                          {c.email && (
                            <span className={c.full_name ? 'text-muted-foreground ml-1' : 'font-medium'}>
                              {c.email}
                            </span>
                          )}
                        </span>
                        {!isMember && (
                          <Badge variant="outline" className="text-[9px] bg-amber-50 text-amber-800 border-amber-200 flex-shrink-0">
                            En attente
                          </Badge>
                        )}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
            <div className="text-[11px] text-muted-foreground">
              {editCoachUserIds.size + editCoachInvitationIds.size} coach(es) sélectionné(s)
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditCoachesOpen(false)} disabled={savingCoaches}>Annuler</Button>
            <Button onClick={handleSaveCoaches} disabled={savingCoaches}>
              {savingCoaches && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
