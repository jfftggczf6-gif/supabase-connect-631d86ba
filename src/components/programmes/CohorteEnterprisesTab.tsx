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
import { Loader2, Plus, X, ChevronRight, Building2 } from 'lucide-react';
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
  const [removing, setRemoving] = useState<string | null>(null);

  // Sous-formulaire "Nouvelle entreprise" intégré au modal d'ajout
  const [showNewEnt, setShowNewEnt] = useState(false);
  const [newEntName, setNewEntName] = useState('');
  const [newEntSector, setNewEntSector] = useState('');
  const [newEntCountry, setNewEntCountry] = useState('');
  const [newEntContactEmail, setNewEntContactEmail] = useState('');
  const [creatingEnt, setCreatingEnt] = useState(false);

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

    // N-to-N: fetch enterprise_coaches for these enterprises
    const { data: ecLinks } = await supabase
      .from('enterprise_coaches')
      .select('enterprise_id, coach_id')
      .in('enterprise_id', entIds)
      .eq('is_active', true);
    const ecMap: Record<string, string> = {};
    (ecLinks || []).forEach(ec => { ecMap[ec.enterprise_id] = ec.coach_id; });

    // Merge: prefer enterprise_coaches, fallback to legacy coach_id
    const allCoachIds = [...new Set([
      ...(ents || []).map(e => ecMap[e.id] || e.coach_id).filter(Boolean),
    ])];
    let coachMap: Record<string, string> = {};
    if (allCoachIds.length) {
      const { data: profiles } = await supabase.from('profiles').select('user_id, full_name').in('user_id', allCoachIds);
      (profiles || []).forEach(p => { coachMap[p.user_id] = p.full_name || ''; });
    }

    const delivCount: Record<string, number> = {};
    (delivs || []).forEach((d: any) => { delivCount[d.enterprise_id] = (delivCount[d.enterprise_id] || 0) + 1; });

    setEnterprises((ents || []).map(e => ({
      ...e,
      coach_name: coachMap[ecMap[e.id] || e.coach_id] || '—',
      deliverables_count: delivCount[e.id] || 0,
    })).sort((a, b) => (b.score_ir || 0) - (a.score_ir || 0)));
    setLoading(false);
  };

  useEffect(() => { fetchEnterprises(); }, [programmeId]);

  const handleRemove = async (enterpriseId: string, name: string) => {
    if (!confirm(t('cohorte.remove_confirm', { name }))) return;
    setRemoving(enterpriseId);
    const { data, error } = await supabase.functions.invoke('manage-programme', {
      body: { action: 'remove_enterprise', programme_id: programmeId, enterprise_id: enterpriseId }
    });
    if (error || data?.error) toast.error(data?.error || error?.message || t('common.error'));
    else { toast.success(t('cohorte.removed', { name })); fetchEnterprises(); }
    setRemoving(null);
  };

  const openAddDialog = async () => {
    setShowAdd(true);
    setSelectedToAdd(new Set());
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

      // Intègre immédiatement la nouvelle entreprise au programme courant
      const { data, error: addErr } = await supabase.functions.invoke('manage-programme', {
        body: { action: 'add_enterprise', programme_id: programmeId, enterprise_id: inserted.id }
      });
      if (addErr || data?.error) {
        toast.warning(`Entreprise "${inserted.name}" créée mais non ajoutée à la cohorte : ${data?.error || addErr?.message}`);
      } else {
        toast.success(`Entreprise "${inserted.name}" créée et ajoutée à la cohorte`);
      }

      // Reset + refresh
      setNewEntName(''); setNewEntSector(''); setNewEntCountry(''); setNewEntContactEmail('');
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
            {enterprises.map(e => (
              <TableRow key={e.id} className="group cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/programmes/${programmeId}/enterprise/${e.id}`)}>
                <TableCell className="font-medium">{e.name}</TableCell>
                <TableCell>
                  {e.score_ir > 0 ? (
                    <Badge variant="outline" className={e.score_ir >= 70 ? 'border-emerald-300 text-emerald-700' : e.score_ir >= 40 ? 'border-amber-300 text-amber-700' : 'border-red-300 text-red-700'}>{e.score_ir}</Badge>
                  ) : '—'}
                </TableCell>
                <TableCell className="text-sm">{e.coach_name}</TableCell>
                <TableCell className="text-sm">{e.deliverables_count}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{e.last_activity ? new Date(e.last_activity).toLocaleDateString('fr-FR') : '—'}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <button onClick={(ev) => { ev.stopPropagation(); handleRemove(e.id, e.name); }}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-100 text-red-500 transition-opacity"
                      disabled={removing === e.id}>
                      {removing === e.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                    </button>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {enterprises.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">{t('cohorte.no_enterprises')}</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent></Card>

      {/* Add dialog */}
      <Dialog open={showAdd} onOpenChange={(open) => { setShowAdd(open); if (!open) setShowNewEnt(false); }}>
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
              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" variant="ghost" size="sm" onClick={() => setShowNewEnt(false)}>
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
    </div>
  );
}
