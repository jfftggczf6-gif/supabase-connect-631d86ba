import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Users, Plus, Building2 } from 'lucide-react';
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
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CreateCohorteDialog({ open, onOpenChange }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { currentOrg } = useOrganization();
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

  // Sous-formulaire création nouvelle entreprise
  const [showNewEnt, setShowNewEnt] = useState(false);
  const [newEntName, setNewEntName] = useState('');
  const [newEntSector, setNewEntSector] = useState('');
  const [newEntCountry, setNewEntCountry] = useState('');
  const [newEntContactEmail, setNewEntContactEmail] = useState('');
  const [newEntCoaches, setNewEntCoaches] = useState<Set<string>>(new Set());
  const [creatingEnt, setCreatingEnt] = useState(false);

  // Coaches disponibles dans l'org courante (pour assignation à la création)
  const [availableCoaches, setAvailableCoaches] = useState<{ user_id: string; full_name: string | null; email: string | null }[]>([]);

  const fetchEnterprises = async () => {
    setLoading(true);
    let entQ = supabase
      .from('enterprises')
      .select('id, name, score_ir, coach_id, sector, country, created_at')
      .order('created_at', { ascending: false });
    if (currentOrg?.id) entQ = entQ.eq('organization_id', currentOrg.id);
    const { data: ents } = await entQ;

    // N-to-N: fetch enterprise_coaches
    const entIds = (ents || []).map(e => e.id);
    const { data: ecLinks } = entIds.length > 0
      ? await supabase.from('enterprise_coaches').select('enterprise_id, coach_id').in('enterprise_id', entIds).eq('is_active', true)
      : { data: [] as any[] };
    const ecMap: Record<string, string> = {};
    (ecLinks || []).forEach(ec => { ecMap[ec.enterprise_id] = ec.coach_id; });

    // Get coach names
    const coachIds = [...new Set((ents || []).map(e => ecMap[e.id] || e.coach_id).filter(Boolean))];
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

    // Affiche TOUTES les entreprises de l'org (même sans pipeline démarré)
    setEnterprises((ents || []).map(e => ({
      ...e,
      coach_name: coachMap[ecMap[e.id] || e.coach_id] || '',
      deliverables_count: countMap[e.id] || 0,
    })));
    setLoading(false);
  };

  // Charge les coaches actifs de l'org pour le multi-select de création d'entreprise
  const fetchAvailableCoaches = async () => {
    if (!currentOrg?.id) { setAvailableCoaches([]); return; }
    const { data: members } = await supabase
      .from('organization_members')
      .select('user_id')
      .eq('organization_id', currentOrg.id)
      .eq('is_active', true)
      .eq('role', 'coach');
    const userIds = (members || []).map((m: any) => m.user_id);
    if (!userIds.length) { setAvailableCoaches([]); return; }
    const { data: profs } = await supabase
      .from('profiles')
      .select('user_id, full_name, email')
      .in('user_id', userIds);
    setAvailableCoaches((profs || []).map((p: any) => ({
      user_id: p.user_id,
      full_name: p.full_name,
      email: p.email,
    })));
  };

  useEffect(() => {
    if (open) {
      fetchEnterprises();
      fetchAvailableCoaches();
    }
  }, [open, currentOrg?.id]);

  const toggleNewEntCoach = (userId: string) => {
    setNewEntCoaches(prev => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId); else next.add(userId);
      return next;
    });
  };

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const handleCreateEnterprise = async () => {
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

      // Assignation des coaches sélectionnés (si applicable) — N-à-N enterprise_coaches
      if (newEntCoaches.size > 0) {
        const rows = Array.from(newEntCoaches).map(coachId => ({
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
          // L'entreprise est créée mais l'assignation a échoué → toast warning, pas blocking
          console.warn('[create-enterprise] coach assignment failed:', ecError);
          toast.warning(`Entreprise créée mais ${newEntCoaches.size} coach(es) non assignés : ${ecError.message}`);
        } else {
          toast.success(`Entreprise "${inserted.name}" créée avec ${newEntCoaches.size} coach(es) assigné(s)`);
        }
      } else {
        toast.success(`Entreprise "${inserted.name}" créée`);
      }

      // Refresh + select automatiquement la nouvelle entreprise
      await fetchEnterprises();
      setSelected(new Set([...selected, inserted.id]));
      // Reset form
      setNewEntName(''); setNewEntSector(''); setNewEntCountry(''); setNewEntContactEmail('');
      setNewEntCoaches(new Set());
      setShowNewEnt(false);
    } catch (err: any) {
      toast.error(err.message || 'Erreur création entreprise');
    } finally {
      setCreatingEnt(false);
    }
  };

  const handleCreate = async () => {
    if (!name.trim()) { toast.error(t('cohorte.name_required_error')); return; }
    if (selected.size === 0) { toast.error(t('cohorte.select_min_one')); return; }
    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-programme', {
        body: {
          action: 'create_cohorte',
          organization_id: currentOrg?.id,
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
      toast.error(err.message || t('common.error'));
    }
    setCreating(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> {t('cohorte.create_title')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>{t('cohorte.name_required')}</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="Cohorte Pilote Q2 2026" /></div>
            <div className="space-y-1.5"><Label>{t('cohorte.organization')}</Label><Input value={organization} onChange={e => setOrganization(e.target.value)} placeholder="ESONO / SellArts" /></div>
          </div>
          <div className="space-y-1.5"><Label>{t('cohorte.description')}</Label><Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Suivi des PME accompagnées..." /></div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5"><Label>{t('cohorte.budget')}</Label><Input type="number" value={budget} onChange={e => setBudget(e.target.value)} placeholder="250000000" /></div>
            <div className="space-y-1.5"><Label>{t('cohorte.start_date')}</Label><Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>{t('cohorte.end_date')}</Label><Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} /></div>
          </div>

          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-sm">{t('cohorte.select_enterprises')}</h4>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowNewEnt(!showNewEnt)}
                className="gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" /> Nouvelle entreprise
              </Button>
            </div>

            {/* Sous-formulaire création */}
            {showNewEnt && (
              <div className="rounded-lg border border-dashed bg-muted/30 p-4 mb-3 space-y-3">
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

                {/* Section assignation coaches (optionnelle) */}
                <div className="space-y-1.5 pt-2 border-t border-dashed">
                  <Label className="text-xs flex items-center gap-1.5">
                    <Users className="h-3 w-3" />
                    Coaches assignés (optionnel)
                  </Label>
                  {availableCoaches.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic px-1">
                      Aucun coach disponible dans cette organisation. Tu peux créer l'entreprise sans coach et l'assigner plus tard.
                    </p>
                  ) : (
                    <div className="max-h-32 overflow-y-auto rounded-md border border-input bg-background p-2 space-y-1">
                      {availableCoaches.map(c => (
                        <label
                          key={c.user_id}
                          className="flex items-center gap-2 text-sm rounded px-1.5 py-1 hover:bg-muted/50 cursor-pointer"
                        >
                          <Checkbox
                            checked={newEntCoaches.has(c.user_id)}
                            onCheckedChange={() => toggleNewEntCoach(c.user_id)}
                          />
                          <span className="flex-1 truncate">
                            <span className="font-medium">{c.full_name || 'Sans nom'}</span>
                            {c.email && <span className="text-muted-foreground text-xs ml-1.5">{c.email}</span>}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                  {newEntCoaches.size > 0 && (
                    <p className="text-[11px] text-muted-foreground px-1">
                      {newEntCoaches.size} coach(es) assigné(s) à la création (rôle « principal »)
                    </p>
                  )}
                </div>

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setShowNewEnt(false)}>
                    Annuler
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleCreateEnterprise}
                    disabled={creatingEnt || !newEntName.trim() || !newEntCountry}
                  >
                    {creatingEnt ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Plus className="h-3.5 w-3.5 mr-1.5" />}
                    Créer et ajouter
                  </Button>
                </div>
              </div>
            )}

            {loading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
            ) : enterprises.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Aucune entreprise dans cette org. Clique sur "Nouvelle entreprise" pour en créer une.
              </p>
            ) : (
              <div className="space-y-1 max-h-[40vh] overflow-y-auto">
                {enterprises.map(e => (
                  <label key={e.id} className="flex items-center gap-3 p-2 rounded hover:bg-muted/50 cursor-pointer">
                    <Checkbox checked={selected.has(e.id)} onCheckedChange={() => toggle(e.id)} />
                    <span className="flex-1 text-sm font-medium truncate">{e.name}</span>
                    {e.score_ir > 0 ? (
                      <Badge variant="outline" className={`text-[10px] ${e.score_ir >= 70 ? 'border-emerald-300 text-emerald-700' : e.score_ir >= 40 ? 'border-amber-300 text-amber-700' : 'border-red-300 text-red-700'}`}>
                        {e.score_ir}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] border-muted-foreground/30 text-muted-foreground">
                        Pipeline non démarré
                      </Badge>
                    )}
                    <span className="text-[10px] text-muted-foreground">{e.deliverables_count} livr.</span>
                    {e.coach_name && <span className="text-[10px] text-muted-foreground">coach: {e.coach_name}</span>}
                  </label>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-2">{t('cohorte.enterprises_selected', { count: selected.size })}</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
          <Button onClick={handleCreate} disabled={creating || !name.trim() || selected.size === 0}>
            {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Users className="h-4 w-4 mr-2" />}
            {t('cohorte.create_cohorte')} ({selected.size})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
