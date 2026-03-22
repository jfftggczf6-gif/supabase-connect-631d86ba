import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from './DashboardLayout';
import EntrepreneurDashboard from './EntrepreneurDashboard';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from '@/components/ui/alert-dialog';
import {
  Users, Building2,
  Plus, Download, Loader2, ArrowLeft, Eye,
  UserPlus, Search, Trash2, Maximize2, Minimize2
} from 'lucide-react';
import {
  type Enterprise, type Deliverable, type EnterpriseModule, type CoachUpload,
} from '@/lib/dashboard-config';

import { getPipelineState, type PipelineState } from '@/lib/pipeline-runner';
import ScreeningDashboard from './ScreeningDashboard';
import ProgrammeCriteriaEditor from './ProgrammeCriteriaEditor';
import CoachingTab from './CoachingTab';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getScoreBg(score: number) {
  if (score >= 70) return 'bg-green-100 text-green-700 border-green-200';
  if (score >= 40) return 'bg-yellow-100 text-yellow-700 border-yellow-200';
  return 'bg-red-100 text-red-700 border-red-200';
}

function getPhaseLabel(phase: string) {
  switch (phase) {
    case 'identite': return { label: 'Identité', color: '#7c3aed' };
    case 'finance':  return { label: 'Finance',  color: '#2563eb' };
    case 'dossier':  return { label: 'Dossier',  color: '#059669' };
    default:         return { label: 'Identité', color: '#7c3aed' };
  }
}

// ─── Types ───────────────────────────────────────────────────────────────────

type View = 'list' | 'detail' | 'screening';
type DetailTab = 'mirror' | 'coaching';

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CoachDashboard() {
  const { user, profile } = useAuth();

  const [searchParams, setSearchParams] = useSearchParams();
  const entIdFromUrl = searchParams.get('ent');

  const [view, setView] = useState<View>(entIdFromUrl ? 'detail' : 'list');
  const [selectedEnt, setSelectedEnt] = useState<Enterprise | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>(
    () => (sessionStorage.getItem('esono_detail_tab') as DetailTab) || 'mirror'
  );
  const [_selectedModule, _setSelectedModule] = useState('diagnostic');

  const [enterprises, setEnterprises] = useState<Enterprise[]>([]);
  const [modulesMap, setModulesMap] = useState<Record<string, EnterpriseModule[]>>({});
  const [deliverablesMap, setDeliverablesMap] = useState<Record<string, Deliverable[]>>({});
  const [_uploadsMap, setUploadsMap] = useState<Record<string, CoachUpload[]>>({});

  const [loading, setLoading] = useState(true);
  

  const [search, setSearch] = useState('');
  const [filterPhase, setFilterPhase] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', contact_email: '' });
  const [addLoading, setAddLoading] = useState(false);
  const [_mirrorPipelineState, setMirrorPipelineState] = useState<PipelineState>('generate');
  const [reportPreview, setReportPreview] = useState<{ html: string; enterpriseName: string } | null>(null);
  const [fullscreen, setFullscreen] = useState(!!entIdFromUrl);
  const [extractedInfo, setExtractedInfo] = useState<{ name: string | null; country: string | null; sector: string | null } | null>(null);
  const [showExtractDialog, setShowExtractDialog] = useState(false);
  const [_extractingEntId, _setExtractingEntId] = useState<string | null>(null);
  const [savingExtraction, setSavingExtraction] = useState(false);
  const [childGenerating, setChildGenerating] = useState(false);

  // ─── Data loading ─────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const { data: ents } = await supabase
        .from('enterprises')
        .select('*')
        .eq('coach_id', user.id)
        .order('updated_at', { ascending: false });

      setEnterprises(_prev => {
        const newEnts = ents || [];
        // Preserve selectedEnt reference by ID after refetch
        if (selectedEnt) {
          const stillExists = newEnts.find(e => e.id === selectedEnt.id);
          if (stillExists) {
            setTimeout(() => setSelectedEnt(stillExists), 0);
          }
        }
        return newEnts;
      });

      if (ents && ents.length > 0) {
        const ids = ents.map(e => e.id);
        const [modsRes, delivsRes, uploadsRes] = await Promise.all([
          supabase.from('enterprise_modules').select('*').in('enterprise_id', ids),
          supabase.from('deliverables').select('*').in('enterprise_id', ids),
          supabase.from('coach_uploads').select('*').eq('coach_id', user.id).in('enterprise_id', ids),
        ]);

        const modMap: Record<string, EnterpriseModule[]> = {};
        (modsRes.data || []).forEach(m => {
          if (!modMap[m.enterprise_id]) modMap[m.enterprise_id] = [];
          modMap[m.enterprise_id].push(m);
        });
        setModulesMap(modMap);

        const delMap: Record<string, Deliverable[]> = {};
        (delivsRes.data || []).forEach(d => {
          if (!delMap[d.enterprise_id]) delMap[d.enterprise_id] = [];
          delMap[d.enterprise_id].push(d);
        });
        setDeliverablesMap(delMap);

        const upMap: Record<string, CoachUpload[]> = {};
        (uploadsRes.data || []).forEach(u => {
          if (!upMap[u.enterprise_id]) upMap[u.enterprise_id] = [];
          upMap[u.enterprise_id].push(u);
        });
        setUploadsMap(upMap);
      }
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Compute mirror pipeline state when selected enterprise changes
  useEffect(() => {
    if (!selectedEnt) return;
    getPipelineState(selectedEnt.id).then(setMirrorPipelineState);
  }, [selectedEnt?.id, selectedEnt?.updated_at, deliverablesMap[selectedEnt?.id || '']?.length]);

  // Persist detailTab in sessionStorage
  useEffect(() => {
    sessionStorage.setItem('esono_detail_tab', detailTab);
  }, [detailTab]);

  // Restore selectedEnt from URL when enterprises load
  useEffect(() => {
    if (entIdFromUrl && enterprises.length > 0 && !selectedEnt) {
      const found = enterprises.find(e => e.id === entIdFromUrl);
      if (found) {
        setSelectedEnt(found);
        setView('detail');
        setFullscreen(true);
      } else {
        searchParams.delete('ent');
        setSearchParams(searchParams, { replace: true });
        setView('list');
      }
    }
  }, [enterprises, entIdFromUrl]);

  // Navigation helpers
  const handleViewEnterprise = useCallback((ent: Enterprise) => {
    setSelectedEnt(ent);
    setView('detail');
    setDetailTab('mirror');
    setFullscreen(true);
    setSearchParams({ ent: ent.id }, { replace: true });
  }, [setSearchParams]);

  const handleBackToList = useCallback(() => {
    if (childGenerating) {
      const confirmed = window.confirm(
        'Une génération est en cours. Si vous quittez, elle sera interrompue. Continuer ?'
      );
      if (!confirmed) return;
    }
    setView('list');
    setSelectedEnt(null);
    setFullscreen(false);
    searchParams.delete('ent');
    setSearchParams(searchParams, { replace: true });
  }, [childGenerating, searchParams, setSearchParams]);



  const handleAddEntrepreneur = async () => {
    if (!addForm.name.trim() || !user) return;
    setAddLoading(true);
    try {
      let linked = false;

      // Step 1: Try secure backend linking by email
      if (addForm.contact_email?.trim()) {
        const { data: status, error: rpcError } = await supabase.rpc(
          'link_enterprise_to_coach_by_email',
          { enterprise_email: addForm.contact_email.trim() }
        );

        if (rpcError) throw rpcError;

        if (status === 'linked') {
          toast.success("Entreprise liée avec succès !");
          linked = true;
        } else if (status === 'already_yours') {
          toast.info("Cette entreprise est déjà dans votre portefeuille");
          linked = true;
        } else if (status === 'already_assigned') {
          toast.error("Cette entreprise est déjà suivie par un autre coach");
          setAddLoading(false);
          return;
        }
        // status === 'not_found' → fall through to create a lead
      }

      // Step 2: If no existing enterprise found, create a new coach-owned lead
      if (!linked) {
        const { error } = await supabase.from('enterprises').insert({
          name: addForm.name.trim(),
          contact_email: addForm.contact_email || null,
          coach_id: user.id,
          user_id: user.id,
          phase: 'identite',
          score_ir: 0,
        });

        if (error) throw error;
        toast.success(`${addForm.name} ajouté avec succès`);
      }

      setShowAddModal(false);
      setAddForm({ name: '', contact_email: '' });
      await fetchData();
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de l'ajout");
    } finally {
      setAddLoading(false);
    }
  };

  const handleConfirmExtraction = async () => {
    if (!selectedEnt || !extractedInfo) return;
    setSavingExtraction(true);
    try {
      const updates: Record<string, string> = {};
      if (extractedInfo.name) updates.name = extractedInfo.name;
      if (extractedInfo.country) updates.country = extractedInfo.country;
      if (extractedInfo.sector) updates.sector = extractedInfo.sector;
      const { error } = await supabase.from('enterprises').update(updates).eq('id', selectedEnt.id);
      if (error) throw error;
      toast.success('Informations mises à jour !');
      setShowExtractDialog(false);
      setExtractedInfo(null);
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSavingExtraction(false);
    }
  };


  // ─── Delete / Detach Enterprise ────────────────────────────────────────────

  const handleDeleteEnterprise = async (ent: Enterprise) => {
    if (!user) return;
    try {
      const isCoachOwned = ent.user_id === user.id;

      if (isCoachOwned) {
        // Coach owns this enterprise — full delete
        await supabase.from('coach_uploads').delete().eq('enterprise_id', ent.id);
        await supabase.from('deliverables').delete().eq('enterprise_id', ent.id);
        await supabase.from('enterprise_modules').delete().eq('enterprise_id', ent.id);
        await supabase.from('enterprises').delete().eq('id', ent.id);
        toast.success(`${ent.name} supprimé`);
      } else {
        // Entrepreneur owns this — just detach coach
        await supabase.from('enterprises').update({ coach_id: null }).eq('id', ent.id);
        toast.success(`${ent.name} détaché de votre liste`);
      }

      if (selectedEnt?.id === ent.id) {
        handleBackToList();
      }
      await fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la suppression');
    }
  };

  // ─── Filtered Enterprises ─────────────────────────────────────────────────

  const filteredEnts = enterprises.filter(e => {
    const matchSearch = !search || e.name.toLowerCase().includes(search.toLowerCase()) ||
      (e.contact_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (e.contact_email || '').toLowerCase().includes(search.toLowerCase());
    const matchPhase = !filterPhase || e.phase === filterPhase;
    return matchSearch && matchPhase;
  });

  // ─── RENDER: Detail View ──────────────────────────────────────────────────

   if (view === 'detail' && selectedEnt) {
    const ent = selectedEnt;

    const tabsConfig = [
      { key: 'mirror' as DetailTab, label: '👁 Vue entrepreneur', desc: 'Livrables et diagnostic' },
      { key: 'coaching' as DetailTab, label: '📝 Coaching', desc: 'Notes et rapports' },
    ];

    // ═══ FULLSCREEN MODE ═══
    if (fullscreen) {
      return (
        <div className="min-h-screen bg-background">
          <div className="sticky top-0 z-10 bg-background border-b border-border">
            <div className="flex items-center justify-between px-4 py-2">
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="sm" onClick={() => setFullscreen(false)}>
                  <Minimize2 className="h-4 w-4 mr-1" /> Réduire
                </Button>
                <h2 className="font-display font-semibold">{ent.name}</h2>
                {(ent.score_ir || 0) > 0 && (
                  <Badge variant="outline" className={`text-sm font-bold px-3 py-1 ${getScoreBg(ent.score_ir)}`}>
                    {ent.score_ir}/100
                  </Badge>
                )}
              </div>
              <Button variant="ghost" size="sm" onClick={handleBackToList}>
                <ArrowLeft className="h-4 w-4 mr-1" /> {childGenerating ? 'Génération en cours…' : 'Retour à la liste'}
              </Button>
            </div>
            <div className="flex gap-0 px-4 border-t border-border">
              {tabsConfig.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setDetailTab(tab.key)}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    detailTab === tab.key
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="p-0">
            {detailTab === 'mirror' && (
              <EntrepreneurDashboard
                enterpriseId={ent.id}
                showBackButton={false}
                onBack={handleBackToList}
                coachMode={true}
                onGeneratingChange={setChildGenerating}
              />
            )}
            {detailTab === 'coaching' && (
              <div className="p-6">
                <CoachingTab enterpriseId={ent.id} enterpriseName={ent.name} />
              </div>
            )}
          </div>
        </div>
      );
    }

    // ═══ NORMAL DETAIL VIEW ═══
    return (
      <DashboardLayout
        title={ent.name}
        subtitle={`${ent.sector || 'Secteur non défini'} • ${ent.country || ''}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={handleBackToList}>
              <ArrowLeft className="h-4 w-4 mr-1" /> {childGenerating ? 'Génération en cours…' : 'Retour'}
            </Button>
            <div>
              <h2 className="text-xl font-display font-bold">{ent.name}</h2>
              {ent.contact_name && <p className="text-sm text-muted-foreground">{ent.contact_name} {ent.contact_email && `• ${ent.contact_email}`}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {(ent.score_ir || 0) > 0 && (
              <Badge variant="outline" className={`text-sm font-bold px-3 py-1 ${getScoreBg(ent.score_ir)}`}>
                {ent.score_ir}/100
              </Badge>
            )}
            <Button variant="ghost" size="sm" onClick={() => setFullscreen(true)} title="Plein écran">
              <Maximize2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border mb-6 gap-1">
          {tabsConfig.map(tab => (
            <button
              key={tab.key}
              onClick={() => setDetailTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                detailTab === tab.key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
              <span className="text-xs text-muted-foreground hidden sm:inline">({tab.desc})</span>
            </button>
          ))}
        </div>

        {/* ═══ TAB: MIRROR (Vue entrepreneur) ═══ */}
        {detailTab === 'mirror' && selectedEnt && (
          <EntrepreneurDashboard
            enterpriseId={selectedEnt.id}
            showBackButton={false}
            onBack={handleBackToList}
            coachMode={true}
            onGeneratingChange={setChildGenerating}
          />
        )}

        {/* ═══ TAB: COACHING ═══ */}
        {detailTab === 'coaching' && selectedEnt && (
          <CoachingTab enterpriseId={selectedEnt.id} enterpriseName={selectedEnt.name} />
        )}
      </DashboardLayout>
    );
  }

  // ─── RENDER: Screening View ────────────────────────────────────────────────

  if (view === 'screening') {
    return (
      <DashboardLayout
        title="Screening & Programmes"
        subtitle="Évaluez vos entreprises par critères programme"
      >
        <div className="flex gap-3 mb-6">
          <Button variant="outline" onClick={handleBackToList} className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Retour au portefeuille
          </Button>
        </div>
        <ProgrammeCriteriaEditor />
        <div className="mt-6">
          <ScreeningDashboard coachId={user?.id} />
        </div>
      </DashboardLayout>
    );
  }

  // ─── RENDER: List View ────────────────────────────────────────────────────

  return (
    <DashboardLayout
      title={`Bonjour, ${profile?.full_name || 'Coach'} 👋`}
      subtitle="Tableau de bord de coaching"
    >
      {/* Liste des entreprises */}

      {/* Actions rapides */}
      <div className="flex flex-wrap gap-3 mb-6">
        <Button onClick={() => setShowAddModal(true)} className="gap-2">
          <UserPlus className="h-4 w-4" /> Ajouter un entrepreneur
        </Button>
        <Button variant="outline" asChild className="gap-2">
          <a href="/templates"><Download className="h-4 w-4" /> Templates vierges</a>
        </Button>
      </div>

      {/* Barre de recherche + filtres */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Rechercher par nom, contact, email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <select
          value={filterPhase}
          onChange={e => setFilterPhase(e.target.value)}
          className="border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none"
        >
          <option value="">Toutes les phases</option>
          <option value="identite">Identité</option>
          <option value="finance">Finance</option>
          <option value="dossier">Dossier</option>
        </select>
      </div>

      {/* Tableau des entrepreneurs */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filteredEnts.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p className="font-medium">{search || filterPhase ? 'Aucun résultat' : 'Aucun entrepreneur'}</p>
            <p className="text-sm mt-1">
              {search || filterPhase ? "Essayez avec d'autres critères de recherche" : 'Cliquez sur "Ajouter un entrepreneur" pour commencer'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="grid grid-cols-12 gap-2 px-4 py-2.5 bg-muted/30 border-b border-border text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
            <div className="col-span-3">Entreprise</div>
            <div className="col-span-2 hidden md:block">Contact</div>
            <div className="col-span-2 hidden lg:block">Secteur</div>
            <div className="col-span-1">Score</div>
            <div className="col-span-1 hidden sm:block">Phase</div>
            <div className="col-span-3 text-right">Actions</div>
          </div>

          {filteredEnts.map(ent => {
            const delivs = deliverablesMap[ent.id] || [];
            const mods = modulesMap[ent.id] || [];
            const completed = mods.filter((m: any) => m.status === 'completed').length;
            const total = mods.length || 8;
            const pct = Math.round((completed / total) * 100);
            const score = ent.score_ir || (delivs.length > 0 ? Math.round(delivs.reduce((s: number, d: any) => s + (d.score || 0), 0) / delivs.length) : 0);
            const phase = getPhaseLabel(ent.phase || 'identite');

            return (
              <div key={ent.id} className="grid grid-cols-12 gap-2 px-4 py-3.5 border-b border-border/50 hover:bg-muted/20 transition-colors items-center">
                <div className="col-span-3 flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center flex-none">
                    <Building2 className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate">{ent.name}</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <Progress value={pct} className="h-1 w-14" />
                      <span className="text-[10px] text-muted-foreground">{pct}%</span>
                    </div>
                  </div>
                </div>
                <div className="col-span-2 hidden md:block">
                  {ent.contact_name && <p className="text-xs font-medium truncate">{ent.contact_name}</p>}
                  {ent.contact_email && <p className="text-[10px] text-muted-foreground truncate">{ent.contact_email}</p>}
                  {!ent.contact_name && !ent.contact_email && <span className="text-xs text-muted-foreground">—</span>}
                </div>
                <div className="col-span-2 hidden lg:block">
                  <span className="text-xs text-muted-foreground">{ent.sector || '—'}</span>
                </div>
                <div className="col-span-1">
                  {score > 0 ? (
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${getScoreBg(score)}`}>
                      {score}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </div>
                <div className="col-span-1 hidden sm:block">
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ color: phase.color, background: `${phase.color}15` }}>
                    {phase.label}
                  </span>
                </div>
                <div className="col-span-3 flex items-center justify-end gap-1.5">
                  <Button
                    variant="outline" size="sm" className="h-7 px-2.5 text-xs gap-1"
                    onClick={() => handleViewEnterprise(ent)}
                  >
                    <Eye className="h-3 w-3" /> Voir
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-destructive hover:text-destructive">
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          {ent.user_id === user?.id ? 'Supprimer' : 'Détacher'} {ent.name} ?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          {ent.user_id === user?.id
                            ? "Cette entreprise et tous ses livrables seront définitivement supprimés."
                            : "L'entreprise sera retirée de votre liste mais restera accessible à l'entrepreneur."}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Annuler</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDeleteEnterprise(ent)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          {ent.user_id === user?.id ? 'Supprimer' : 'Détacher'}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Ajouter entrepreneur */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" /> Nouvel entrepreneur
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Nom de l'entreprise *</label>
              <input
                type="text" placeholder="SARL Mon Entreprise"
                value={addForm.name}
                onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Email</label>
              <input type="email" placeholder="contact@entreprise.com"
                value={addForm.contact_email}
                onChange={e => setAddForm(f => ({ ...f, contact_email: e.target.value }))}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setShowAddModal(false)}>Annuler</Button>
              <Button onClick={handleAddEntrepreneur} disabled={addLoading || !addForm.name.trim()} className="gap-2">
                {addLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Ajouter
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Report Preview Dialog ─── */}
      <Dialog open={!!reportPreview} onOpenChange={(open) => { if (!open) setReportPreview(null); }}>
        <DialogContent className="max-w-[90vw] h-[85vh] flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-2 flex-none">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-lg font-semibold">
                Rapport — {reportPreview?.enterpriseName}
              </DialogTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (!reportPreview) return;
                  const blob = new Blob([reportPreview.html], { type: 'text/html' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `Rapport_${reportPreview.enterpriseName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.html`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                  toast.success('Rapport téléchargé !');
                }}
              >
                <Download className="h-4 w-4 mr-1" /> Télécharger
              </Button>
            </div>
          </DialogHeader>
          <div className="flex-1 min-h-0 px-6 pb-6">
            <iframe
              srcDoc={reportPreview?.html ?? ''}
              className="w-full h-full rounded-md border bg-background"
              title="Rapport Coach"
              sandbox="allow-same-origin"
            />
          </div>
        </DialogContent>
      </Dialog>
      {/* ===== EXTRACT INFO DIALOG ===== */}
      <Dialog open={showExtractDialog} onOpenChange={setShowExtractDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Informations détectées</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground mb-4">
            Nous avons extrait les informations suivantes du document uploadé. Souhaitez-vous mettre à jour l'entreprise ?
          </p>
          <div className="space-y-2">
            {extractedInfo?.name && (
              <div className="flex items-center gap-2">
                <Badge variant="outline">Nom</Badge>
                <span className="text-sm font-medium">{extractedInfo.name}</span>
              </div>
            )}
            {extractedInfo?.sector && (
              <div className="flex items-center gap-2">
                <Badge variant="outline">Secteur</Badge>
                <span className="text-sm font-medium">{extractedInfo.sector}</span>
              </div>
            )}
            {extractedInfo?.country && (
              <div className="flex items-center gap-2">
                <Badge variant="outline">Pays</Badge>
                <span className="text-sm font-medium">{extractedInfo.country}</span>
              </div>
            )}
          </div>
          <div className="flex gap-2 justify-end mt-4">
            <Button variant="outline" onClick={() => { setShowExtractDialog(false); setExtractedInfo(null); }}>
              Ignorer
            </Button>
            <Button onClick={handleConfirmExtraction} disabled={savingExtraction}>
              {savingExtraction ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Mettre à jour
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </DashboardLayout>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────
