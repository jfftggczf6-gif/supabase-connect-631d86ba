import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
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
  UserPlus, Search, Trash2, Maximize2, Minimize2, Database
} from 'lucide-react';
import {
  type Enterprise, type Deliverable, type EnterpriseModule, type CoachUpload,
} from '@/lib/dashboard-config';

import { getPipelineState, type PipelineState } from '@/lib/pipeline-runner';
import ScreeningDashboard from './ScreeningDashboard';
import ProgrammeCriteriaEditor from './ProgrammeCriteriaEditor';
import CoachingTab from './CoachingTab';
import KnowledgeBaseManager from './KnowledgeBaseManager';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getScoreBg(score: number) {
  if (score >= 70) return 'bg-green-100 text-green-700 border-green-200';
  if (score >= 40) return 'bg-yellow-100 text-yellow-700 border-yellow-200';
  return 'bg-red-100 text-red-700 border-red-200';
}


// ─── Types ───────────────────────────────────────────────────────────────────

type View = 'list' | 'detail' | 'screening';
type DetailTab = 'mirror' | 'coaching';

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CoachDashboard() {
  const { t } = useTranslation();
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
  const [showAddModal, setShowAddModal] = useState(false);
  const SUPPORTED_COUNTRIES = ["Côte d'Ivoire", "Sénégal", "Cameroun", "Mali", "Burkina Faso", "Guinée", "Togo", "Bénin", "Niger", "Congo", "RDC", "Gabon", "Madagascar", "Rwanda", "Kenya", "Nigeria", "Ghana", "Maroc", "Tunisie", "Éthiopie", "Tanzanie", "Afrique du Sud"];
  const [addForm, setAddForm] = useState({ name: '', contact_email: '', country: '', sector: '', city: '', description: '' });
  const [addLoading, setAddLoading] = useState(false);
  const [showKBManager, setShowKBManager] = useState(false);
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

  // ─── Realtime: listen for deliverable/module changes across all coach enterprises
  useEffect(() => {
    if (!user?.id || enterprises.length === 0) return;
    const ids = enterprises.map(e => e.id);

    const channels = ids.flatMap(entId => [
      supabase
        .channel(`coach-deliv-${entId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'deliverables', filter: `enterprise_id=eq.${entId}` },
          () => {
            supabase.from('deliverables').select('*').eq('enterprise_id', entId).then(({ data }) => {
              if (data) setDeliverablesMap(prev => ({ ...prev, [entId]: data }));
            });
          }
        )
        .subscribe(),
      supabase
        .channel(`coach-mods-${entId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'enterprise_modules', filter: `enterprise_id=eq.${entId}` },
          () => {
            supabase.from('enterprise_modules').select('*').eq('enterprise_id', entId).then(({ data }) => {
              if (data) setModulesMap(prev => ({ ...prev, [entId]: data }));
            });
          }
        )
        .subscribe(),
    ]);

    return () => { channels.forEach(ch => supabase.removeChannel(ch)); };
  }, [user?.id, enterprises.map(e => e.id).join(',')]);

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
        t('dashboard_coach.confirm_leave_generating')
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
          toast.success(t('dashboard_coach.linked_success'));
          linked = true;
        } else if (status === 'already_yours') {
          toast.info(t('dashboard_coach.already_in_portfolio'));
          linked = true;
        } else if (status === 'already_assigned') {
          toast.error(t('dashboard_coach.already_assigned_other'));
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
          country: addForm.country || null,
          sector: addForm.sector || null,
          city: addForm.city || null,
          description: addForm.description || null,
          coach_id: user.id,
          user_id: user.id,
          phase: 'identite',
          score_ir: 0,
        });

        if (error) throw error;
        toast.success(t('dashboard_coach.added_success', { name: addForm.name }));
      }

      setShowAddModal(false);
      setAddForm({ name: '', contact_email: '', country: '', sector: '', city: '', description: '' });
      await fetchData();
    } catch (err: any) {
      toast.error(err.message || t('dashboard_coach.add_error'));
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
      toast.success(t('dashboard_coach.info_updated'));
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
        toast.success(t('dashboard_coach.deleted_success', { name: ent.name }));
      } else {
        // Entrepreneur owns this — just detach coach
        await supabase.from('enterprises').update({ coach_id: null }).eq('id', ent.id);
        toast.success(t('dashboard_coach.detached_success', { name: ent.name }));
      }

      if (selectedEnt?.id === ent.id) {
        handleBackToList();
      }
      await fetchData();
    } catch (err: any) {
      toast.error(err.message || t('dashboard_coach.delete_error'));
    }
  };

  // ─── Filtered Enterprises ─────────────────────────────────────────────────

  const filteredEnts = enterprises.filter(e => {
    const matchSearch = !search || e.name.toLowerCase().includes(search.toLowerCase()) ||
      (e.contact_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (e.contact_email || '').toLowerCase().includes(search.toLowerCase());
    return matchSearch;
  });

  // ─── RENDER: Detail View ──────────────────────────────────────────────────

   if (view === 'detail' && selectedEnt) {
    const ent = selectedEnt;

    const tabsConfig = [
      { key: 'mirror' as DetailTab, label: `👁 ${t('dashboard_coach.tab_mirror')}`, desc: t('dashboard_coach.tab_mirror_desc') },
      { key: 'coaching' as DetailTab, label: `📝 ${t('dashboard_coach.tab_coaching')}`, desc: t('dashboard_coach.tab_coaching_desc') },
    ];

    // ═══ FULLSCREEN MODE ═══
    if (fullscreen) {
      return (
        <div className="min-h-screen bg-background">
          <div className="sticky top-0 z-10 bg-background border-b border-border">
            <div className="flex items-center justify-between px-4 py-2">
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="sm" onClick={() => setFullscreen(false)}>
                  <Minimize2 className="h-4 w-4 mr-1" /> {t('dashboard_coach.minimize')}
                </Button>
                <h2 className="font-display font-semibold">{ent.name}</h2>
                {(ent.score_ir || 0) > 0 && (
                  <Badge variant="outline" className={`text-sm font-bold px-3 py-1 ${getScoreBg(ent.score_ir)}`}>
                    {ent.score_ir}/100
                  </Badge>
                )}
              </div>
              <Button variant="ghost" size="sm" onClick={handleBackToList}>
                <ArrowLeft className="h-4 w-4 mr-1" /> {childGenerating ? t('dashboard_coach.generating_in_progress') : t('dashboard_coach.back_to_list')}
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
        subtitle={`${ent.sector || t('dashboard_coach.sector_undefined')} • ${ent.country || ''}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={handleBackToList}>
              <ArrowLeft className="h-4 w-4 mr-1" /> {childGenerating ? t('dashboard_coach.generating_in_progress') : t('common.back')}
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
            <Button variant="ghost" size="sm" onClick={() => setFullscreen(true)} title={t('dashboard_coach.fullscreen')}>
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
        title={t('dashboard_coach.screening_title')}
        subtitle={t('dashboard_coach.screening_subtitle')}
      >
        <div className="flex gap-3 mb-6">
          <Button variant="outline" onClick={handleBackToList} className="gap-2">
            <ArrowLeft className="h-4 w-4" /> {t('dashboard_coach.back_to_portfolio')}
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
      title={`${t('dashboard_coach.greeting', { name: profile?.full_name || 'Coach' })} 👋`}
      subtitle={t('dashboard_coach.coaching_dashboard')}
    >
      {/* Liste des entreprises */}

      {/* Actions rapides */}
      <div className="flex flex-wrap gap-3 mb-6">
        <Button onClick={() => setShowAddModal(true)} className="gap-2">
          <UserPlus className="h-4 w-4" /> {t('dashboard_coach.add_enterprise')}
        </Button>
        <Button variant="outline" asChild className="gap-2">
          <a href="/templates"><Download className="h-4 w-4" /> {t('dashboard_coach.blank_templates')}</a>
        </Button>
        <Button variant="outline" className="gap-2" onClick={() => setShowKBManager(true)}>
          <Database className="h-4 w-4" /> {t('dashboard_coach.knowledge_base')}
        </Button>
      </div>

      {/* Barre de recherche + filtres */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder={t('dashboard_coach.search_placeholder')}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
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
            <p className="font-medium">{search ? t('dashboard_coach.no_results') : t('dashboard_coach.no_entrepreneurs')}</p>
            <p className="text-sm mt-1">
              {search ? t('dashboard_coach.try_other_criteria') : t('dashboard_coach.click_add_entrepreneur')}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="grid grid-cols-12 gap-2 px-4 py-2.5 bg-muted/30 border-b border-border text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
            <div className="col-span-3">{t('dashboard_coach.table_enterprise')}</div>
            <div className="col-span-2 hidden md:block">{t('dashboard_coach.table_contact')}</div>
            <div className="col-span-2 hidden lg:block">{t('dashboard_coach.table_sector')}</div>
            <div className="col-span-1">{t('dashboard_coach.table_score')}</div>
            <div className="col-span-3 text-right">{t('dashboard_coach.table_actions')}</div>
          </div>

          {filteredEnts.map(ent => {
            const delivs = deliverablesMap[ent.id] || [];
            const mods = modulesMap[ent.id] || [];
            const completed = mods.filter((m: any) => m.status === 'completed').length;
            const total = mods.length || 8;
            const pct = Math.round((completed / total) * 100);
            const score = ent.score_ir || (delivs.length > 0 ? Math.round(delivs.reduce((s: number, d: any) => s + (d.score || 0), 0) / delivs.length) : 0);

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
                <div className="col-span-3 flex items-center justify-end gap-1.5">
                  <Button
                    variant="outline" size="sm" className="h-7 px-2.5 text-xs gap-1"
                    onClick={() => handleViewEnterprise(ent)}
                  >
                    <Eye className="h-3 w-3" /> {t('dashboard_coach.view')}
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
                          {ent.user_id === user?.id ? t('dashboard_coach.delete_enterprise') : t('dashboard_coach.detach_enterprise')} {t('dashboard_coach.delete_confirm', { name: ent.name })}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          {ent.user_id === user?.id
                            ? t('dashboard_coach.delete_description')
                            : t('dashboard_coach.detach_description')}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDeleteEnterprise(ent)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          {ent.user_id === user?.id ? t('dashboard_coach.delete_enterprise') : t('dashboard_coach.detach_enterprise')}
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
              <UserPlus className="h-5 w-5 text-primary" /> {t('dashboard_coach.new_entrepreneur')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">{t('dashboard_coach.enterprise_name_required')}</label>
              <input type="text" placeholder="SARL Mon Entreprise" value={addForm.name} onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">{t('dashboard_coach.country')} *</label>
                <select value={addForm.country} onChange={e => setAddForm(f => ({ ...f, country: e.target.value }))} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/20">
                  <option value="">— {t('auth.select_country')} —</option>
                  {SUPPORTED_COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">{t('dashboard_coach.sector')}</label>
                <input type="text" placeholder="Agro-industrie, Fintech..." value={addForm.sector} onChange={e => setAddForm(f => ({ ...f, sector: e.target.value }))} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">{t('dashboard_coach.city')}</label>
                <input type="text" placeholder="Abidjan, Lagos..." value={addForm.city} onChange={e => setAddForm(f => ({ ...f, city: e.target.value }))} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">{t('dashboard_coach.email_label')}</label>
                <input type="email" placeholder="contact@entreprise.com" value={addForm.contact_email} onChange={e => setAddForm(f => ({ ...f, contact_email: e.target.value }))} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">{t('dashboard_coach.description')}</label>
              <input type="text" placeholder={t('dashboard_coach.description')} value={addForm.description} onChange={e => setAddForm(f => ({ ...f, description: e.target.value }))} className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setShowAddModal(false)}>{t('common.cancel')}</Button>
              <Button onClick={handleAddEntrepreneur} disabled={addLoading || !addForm.name.trim()} className="gap-2">
                {addLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {t('common.add')}
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
                {t('dashboard_coach.report_title', { name: reportPreview?.enterpriseName })}
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
                  toast.success(t('dashboard_coach.report_downloaded'));
                }}
              >
                <Download className="h-4 w-4 mr-1" /> {t('common.download')}
              </Button>
            </div>
          </DialogHeader>
          <div className="flex-1 min-h-0 px-6 pb-6">
            <iframe
              srcDoc={reportPreview?.html ?? ''}
              className="w-full h-full rounded-md border bg-background"
              title={t('reporting.report')}
              sandbox="allow-same-origin"
            />
          </div>
        </DialogContent>
      </Dialog>
      {/* ===== EXTRACT INFO DIALOG ===== */}
      <Dialog open={showExtractDialog} onOpenChange={setShowExtractDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('dashboard_coach.extracted_info_title')}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground mb-4">
            {t('dashboard_coach.extracted_info_desc')}
          </p>
          <div className="space-y-2">
            {extractedInfo?.name && (
              <div className="flex items-center gap-2">
                <Badge variant="outline">{t('dashboard_coach.label_name')}</Badge>
                <span className="text-sm font-medium">{extractedInfo.name}</span>
              </div>
            )}
            {extractedInfo?.sector && (
              <div className="flex items-center gap-2">
                <Badge variant="outline">{t('dashboard_coach.label_sector')}</Badge>
                <span className="text-sm font-medium">{extractedInfo.sector}</span>
              </div>
            )}
            {extractedInfo?.country && (
              <div className="flex items-center gap-2">
                <Badge variant="outline">{t('dashboard_coach.label_country')}</Badge>
                <span className="text-sm font-medium">{extractedInfo.country}</span>
              </div>
            )}
          </div>
          <div className="flex gap-2 justify-end mt-4">
            <Button variant="outline" onClick={() => { setShowExtractDialog(false); setExtractedInfo(null); }}>
              {t('dashboard_coach.ignore')}
            </Button>
            <Button onClick={handleConfirmExtraction} disabled={savingExtraction}>
              {savingExtraction ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              {t('dashboard_coach.update')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Knowledge Base Manager Dialog */}
      <Dialog open={showKBManager} onOpenChange={setShowKBManager}>
        <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('dashboard_coach.knowledge_base')}</DialogTitle>
          </DialogHeader>
          <KnowledgeBaseManager />
        </DialogContent>
      </Dialog>

    </DashboardLayout>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────
