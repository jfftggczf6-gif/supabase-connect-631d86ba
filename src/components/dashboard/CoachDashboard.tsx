import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from './DashboardLayout';
import DeliverableViewer from './DeliverableViewer';
import BmcViewer from './BmcViewer';
import SicViewer from './SicViewer';
import BusinessPlanPreview from './BusinessPlanPreview';
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
  Users, Building2, CheckCircle2, TrendingUp,
  Plus, Download, Sparkles, Loader2, ArrowLeft, Eye, Lock,
  Share2, AlertCircle, FileCheck, UserPlus, Search, Trash2,
  Upload, X, FileText, ListChecks
} from 'lucide-react';
import {
  MODULE_CONFIG_COACH as MODULE_CONFIG, PIPELINE,
  type Enterprise, type Deliverable, type EnterpriseModule, type CoachUpload,
} from '@/lib/dashboard-config';
import { getValidAccessToken } from '@/lib/getValidAccessToken';
import { runPipelineFromClient, getPipelineState, type PipelineState } from '@/lib/pipeline-runner';
import ScreeningDashboard from './ScreeningDashboard';
import ProgrammeCriteriaEditor from './ProgrammeCriteriaEditor';
import CoachingTab from './CoachingTab';

// ─── Constants ───────────────────────────────────────────────────────────────

const DELIV_MAP: Record<string, string> = {
  bmc: 'bmc_analysis', sic: 'sic_analysis', inputs: 'inputs_data',
  framework: 'framework_data', diagnostic: 'diagnostic_data',
  plan_ovo: 'plan_ovo', business_plan: 'business_plan', odd: 'odd_analysis',
};

const SECTORS = [
  'Agriculture / Agroalimentaire', 'Tech / Digital', 'Commerce / Distribution',
  'Services / Conseil', 'Industrie / Manufacture', 'BTP / Construction',
  'Énergie / Environnement', 'Santé / Pharma', 'Éducation / Formation',
  'Transport / Logistique', 'Finance / Assurance', 'Artisanat', 'Autre',
];

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
type DetailTab = 'mirror' | 'coaching' | 'parcours' | 'livrables';

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CoachDashboard() {
  const { user, profile, session: authSession } = useAuth();

  const [view, setView] = useState<View>('list');
  const [selectedEnt, setSelectedEnt] = useState<Enterprise | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>('mirror');
  const [selectedModule, setSelectedModule] = useState('diagnostic');

  const [enterprises, setEnterprises] = useState<Enterprise[]>([]);
  const [modulesMap, setModulesMap] = useState<Record<string, EnterpriseModule[]>>({});
  const [deliverablesMap, setDeliverablesMap] = useState<Record<string, Deliverable[]>>({});
  const [uploadsMap, setUploadsMap] = useState<Record<string, CoachUpload[]>>({});

  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generatingReport, setGeneratingReport] = useState<string | null>(null);
  const [generatingMirror, _setGeneratingMirror] = useState(false);
  const [_generatingModuleCoach, _setGeneratingModuleCoach] = useState<string | null>(null);
  const [uploadingCategory, setUploadingCategory] = useState<string | null>(null);
  const [sharingId, setSharingId] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [filterPhase, setFilterPhase] = useState('');
  const [generationProgress, setGenerationProgress] = useState<{ current: number; total: number; name: string } | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', contact_name: '', contact_email: '', contact_phone: '', sector: '', country: "Côte d'Ivoire" });
  const [addLoading, setAddLoading] = useState(false);
  const [_mirrorPipelineState, setMirrorPipelineState] = useState<PipelineState>('generate');
  const [_generatingOvoPlanMirror, _setGeneratingOvoPlanMirror] = useState(false);
  const [reportPreview, setReportPreview] = useState<{ html: string; enterpriseName: string } | null>(null);

  // Enterprise info extraction states
  const [extractedInfo, setExtractedInfo] = useState<{ name: string | null; country: string | null; sector: string | null } | null>(null);
  const [showExtractDialog, setShowExtractDialog] = useState(false);
  const [_extractingEntId, setExtractingEntId] = useState<string | null>(null);
  const [savingExtraction, setSavingExtraction] = useState(false);

  const bmcInputRef = useRef<HTMLInputElement>(null);
  const inputsInputRef = useRef<HTMLInputElement>(null);
  const suppInputRef = useRef<HTMLInputElement>(null);

  // ─── Data loading ─────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: ents } = await supabase
        .from('enterprises')
        .select('*')
        .eq('coach_id', user.id)
        .order('updated_at', { ascending: false });

      setEnterprises(ents || []);

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
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Compute mirror pipeline state when selected enterprise changes
  useEffect(() => {
    if (!selectedEnt) return;
    getPipelineState(selectedEnt.id).then(setMirrorPipelineState);
  }, [selectedEnt?.id, selectedEnt?.updated_at, deliverablesMap[selectedEnt?.id || '']?.length]);

  // ─── KPIs ─────────────────────────────────────────────────────────────────

  const totalEntreprises = enterprises.length;
  const allScores = enterprises.map((e) => e.score_ir || 0).filter((s) => s > 0);
  const avgScore = allScores.length > 0 ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length) : 0;
  const allDelivs = Object.values(deliverablesMap).flat();
  const delivsThisWeek = allDelivs.filter(d => {
    const date = new Date(d.created_at || d.updated_at);
    return Date.now() - date.getTime() < 7 * 24 * 60 * 60 * 1000;
  }).length;
  const allMods = Object.values(modulesMap).flat();
  const completedMods = allMods.filter(m => m.status === 'completed').length;

  // ─── Add Entrepreneur ────────────────────────────────────────────────────

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
          sector: addForm.sector || null,
          country: addForm.country,
          contact_name: addForm.contact_name || null,
          contact_email: addForm.contact_email || null,
          contact_phone: addForm.contact_phone || null,
          coach_id: user.id,
          user_id: user.id,
          phase: 'identite',
          score_ir: 0,
        });

        if (error) throw error;
        toast.success(`${addForm.name} ajouté avec succès`);
      }

      setShowAddModal(false);
      setAddForm({ name: '', contact_name: '', contact_email: '', contact_phone: '', sector: '', country: "Côte d'Ivoire" });
      await fetchData();
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de l'ajout");
    } finally {
      setAddLoading(false);
    }
  };

  // ─── Upload (Parcours Rapide) ─────────────────────────────────────────────

  const handleUpload = async (file: File, category: string, enterpriseId: string) => {
    if (!file || !user) return;
    setUploadingCategory(category);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const filePath = `${enterpriseId}/coach/${category}/${Date.now()}_${safeName}`;
      const { error: storageError } = await supabase.storage
        .from('documents')
        .upload(filePath, file, { upsert: true });

      if (storageError) throw storageError;

      if (category === 'bmc_sic') {
        const existingUploads = uploadsMap[enterpriseId] || [];
        const toDelete = existingUploads.filter((u) => u.category === 'bmc' || u.category === 'sic');
        for (const u of toDelete) {
          await supabase.from('coach_uploads').delete().eq('id', u.id);
          await supabase.storage.from('documents').remove([u.storage_path]);
        }
        await supabase.from('coach_uploads').insert([
          { coach_id: user.id, enterprise_id: enterpriseId, category: 'bmc', filename: file.name, file_size: file.size, storage_path: filePath },
          { coach_id: user.id, enterprise_id: enterpriseId, category: 'sic', filename: file.name, file_size: file.size, storage_path: filePath },
        ]);
      } else {
        if (category !== 'supplementary') {
          const existingUploads = uploadsMap[enterpriseId] || [];
          const existing = existingUploads.filter((u) => u.category === category);
          for (const u of existing) {
            await supabase.from('coach_uploads').delete().eq('id', u.id);
            await supabase.storage.from('documents').remove([u.storage_path]);
          }
        }
        await supabase.from('coach_uploads').insert({
          coach_id: user.id, enterprise_id: enterpriseId,
          category, filename: file.name, file_size: file.size, storage_path: filePath,
        });
      }

      toast.success(`${file.name} uploadé`);
      await fetchData();

      // Trigger enterprise info extraction in background (best-effort)
      const ent = enterprises.find(e => e.id === enterpriseId);
      const entDelivs = deliverablesMap[enterpriseId] || [];
      if (entDelivs.length === 0) {
        extractEnterpriseInfoCoach(enterpriseId, ent || null);
      }
    } catch (err: any) {
      toast.error(err.message || "Erreur d'upload");
    } finally {
      setUploadingCategory(null);
    }
  };

  const extractEnterpriseInfoCoach = async (enterpriseId: string, ent: Enterprise | null) => {
    try {
      setExtractingEntId(enterpriseId);
      const token = await getValidAccessToken(authSession);
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/extract-enterprise-info`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ enterprise_id: enterpriseId }),
        }
      );
      if (!response.ok) return;
      const info = await response.json();
      if (info.name || info.country || info.sector) {
        const differs = (info.name && info.name !== ent?.name) ||
          (info.country && info.country !== ent?.country) ||
          (info.sector && info.sector !== ent?.sector);
        if (differs) {
          setExtractedInfo(info);
          setShowExtractDialog(true);
        }
      }
    } catch {
      // best-effort, silent
    } finally {
      setExtractingEntId(null);
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

  const handleRemoveUpload = async (uploadId: string, storagePath: string) => {
    if (!confirm('Supprimer ce fichier ?')) return;
    try {
      await supabase.from('coach_uploads').delete().eq('id', uploadId);
      await supabase.storage.from('documents').remove([storagePath]);
      toast.success('Fichier supprimé');
      await fetchData();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // ─── Generate (Parcours Rapide) ───────────────────────────────────────────

  const handleGenerateCoach = async (enterpriseId: string) => {
    if (!user) return;
    setGenerating(true);
    const entUploads = uploadsMap[enterpriseId] || [];
    if (entUploads.length === 0) {
      toast.error('Uploadez au moins un document avant de générer');
      setGenerating(false);
      return;
    }

    setGenerationProgress({ current: 0, total: PIPELINE.length, name: 'Lancement…' });

    let token: string;
    try { token = await getValidAccessToken(authSession); } catch { toast.error('Non authentifié'); setGenerating(false); return; }

    try {
      const pipelineResult = await runPipelineFromClient(enterpriseId, token, {
        onProgress: setGenerationProgress,
        onStepComplete: () => fetchData(),
      });

      if (pipelineResult.executedCount > 0) {
        // Mark all generated deliverables as coach-owned + private
        await supabase.from('deliverables')
          .update({ generated_by: 'coach', visibility: 'private', coach_id: user.id })
          .eq('enterprise_id', enterpriseId)
          .in('type', PIPELINE.map(s => s.type));

        const skippedMsg = pipelineResult.skippedCount > 0 ? `, ${pipelineResult.skippedCount} déjà à jour` : '';
        toast.success(`${pipelineResult.executedCount} livrable(s) recalculé(s)${skippedMsg} — 🔒 privés par défaut`);
      } else if (pipelineResult.skippedCount > 0) {
        toast.info(`Tous les livrables sont déjà à jour. Utilisez "Régénération complète" pour forcer le recalcul.`);
      }

      if (pipelineResult.creditError) {
        toast.error("Crédits IA insuffisants.");
      }

      await fetchData();

      // Auto-trigger OVO Excel
      if (pipelineResult.completedCount > 0) {
        try {
          toast.info('Génération automatique du Plan Financier Excel...');
          await handleGenerateOvoPlanCoach(enterpriseId);
        } catch {}
      }
    } catch (err: any) {
      toast.error(err.message || 'Erreur de génération');
    } finally {
      setGenerating(false);
      setGenerationProgress(null);
      await fetchData();
    }
  };

  // (handleGenerateMirror removed — mirror view now delegates to EntrepreneurDashboard)


  // ─── Share / Unshare ──────────────────────────────────────────────────────

  const handleShare = async (deliverableId: string) => {
    setSharingId(deliverableId);
    try {
      await supabase.from('deliverables')
        .update({ visibility: 'shared', shared_at: new Date().toISOString() })
        .eq('id', deliverableId);
      toast.success("Livrable partagé avec l'entrepreneur");
      await fetchData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSharingId(null);
    }
  };

  const handleShareAll = async (enterpriseId: string) => {
    if (!confirm("Partager tous les livrables privés avec l'entrepreneur ?")) return;
    try {
      const now = new Date().toISOString();
      const { error } = await supabase.from('deliverables')
        .update({ visibility: 'shared', shared_at: now })
        .eq('enterprise_id', enterpriseId)
        .eq('generated_by', 'coach')
        .eq('visibility', 'private');
      if (error) throw error;
      toast.success('Tous les livrables partagés !');
      await fetchData();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // ─── Download Coach (mirror) ────────────────────────────────────────────

  const handleDownloadCoach = async (type: string, format: string, enterpriseId: string) => {
    try {
      const token = await getValidAccessToken(authSession);
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/download-deliverable?type=${type}&enterprise_id=${enterpriseId}&format=${format}`;
      const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error('Erreur de téléchargement');
      const blob = await response.blob();
      const ext = format === 'xlsx' ? '.xlsx' : format === 'json' ? '.json' : format === 'docx' ? '.docx' : '.html';
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${selectedEnt?.name?.replace(/[^a-zA-Z0-9]/g, '_') || 'export'}_${type}${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
      toast.success('Fichier téléchargé !');
    } catch (err: any) {
      toast.error(err.message);
    }
  };


  // (handleGenerateModuleCoach removed — mirror view now delegates to EntrepreneurDashboard)


  const handleDownloadBpWordCoach = async (fileUrl: string, entName: string) => {
    try {
      // Extract file path from the URL for signed URL generation
      const bpMatch = fileUrl.match(/bp-outputs\/(.+)$/);
      if (bpMatch) {
        const filePath = bpMatch[1].split('?')[0];
        const { data: signedData, error: signedErr } = await supabase.storage
          .from('bp-outputs')
          .createSignedUrl(filePath, 3600);
        if (!signedErr && signedData?.signedUrl) {
          const response = await fetch(signedData.signedUrl);
          if (!response.ok) throw new Error('Erreur de téléchargement');
          const blob = await response.blob();
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = `${entName.replace(/[^a-zA-Z0-9]/g, '_')}_BusinessPlan.docx`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(a.href);
          toast.success('Business Plan Word téléchargé !');
          return;
        }
      }
      // Fallback: direct fetch with auth
      const token = await getValidAccessToken(authSession);
      const response = await fetch(fileUrl, { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error('Erreur de téléchargement');
      const blob = await response.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${entName.replace(/[^a-zA-Z0-9]/g, '_')}_BusinessPlan.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
      toast.success('Business Plan Word téléchargé !');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDownloadOvoCoach = async (_enterpriseId: string, entDelivs: Deliverable[]) => {
    try {
      const ovoExcel = entDelivs.find((d) => d.type === 'plan_ovo_excel');
      const fileName = (ovoExcel?.data as Record<string, unknown> | null)?.file_name as string | undefined;
      if (!fileName) { toast.error('Fichier OVO Excel introuvable'); return; }
      const { data: signedData, error: signedErr } = await supabase.storage
        .from('ovo-outputs')
        .createSignedUrl(fileName, 3600);
      if (signedErr || !signedData?.signedUrl) { toast.error('Erreur de téléchargement'); return; }
      const response = await fetch(signedData.signedUrl);
      if (!response.ok) throw new Error('Erreur');
      const blob = await response.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
      toast.success('Fichier téléchargé !');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDownloadOddExcelCoach = async (enterpriseId: string) => {
    try {
      const ent = enterprises.find((e) => e.id === enterpriseId) || selectedEnt;
      if (!enterpriseId) { toast.error('Entreprise introuvable'); return; }
      const token = await getValidAccessToken(authSession);
      const ts = Date.now();
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/download-deliverable?type=odd_analysis&enterprise_id=${enterpriseId}&format=xlsx&_ts=${ts}`;
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      if (!response.ok) { const err = await response.json().catch(() => ({})); throw new Error((err as any).error || 'Erreur de téléchargement'); }

      // Validate response — reject if contaminated with OVO content
      const contentDisp = response.headers.get('content-disposition') || '';
      if (contentDisp.includes('.xlsm') || contentDisp.toLowerCase().includes('ovo')) {
        throw new Error('Fichier ODD incorrect reçu (contamination OVO). Veuillez régénérer le module ODD.');
      }

      const blob = await response.blob();
      const safeName = ent?.name?.replace(/[^a-zA-Z0-9]/g, '_') || 'entreprise';
      const downloadName = `${safeName}_ODD_${ts}.xlsx`;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = downloadName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
      toast.success('Fichier téléchargé !');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // ─── Generate OVO Excel Plan (coach version) ────────────────────────────
  const handleGenerateOvoPlanCoach = async (enterpriseId: string) => {
    try {
      const token = await getValidAccessToken(authSession);
      
      // Gather deliverable data for this enterprise
      const entDelivs = deliverablesMap[enterpriseId] || [];
      const getDelivData = (type: string): Record<string, unknown> => {
        const d = entDelivs.find((d) => d.type === type);
        return (d?.data && typeof d.data === 'object') ? d.data as Record<string, unknown> : {};
      };

      const ent = enterprises.find((e) => e.id === enterpriseId);
      const planOvoData = getDelivData('plan_ovo');
      const bmcData = getDelivData('bmc_analysis');
      const inputsData = getDelivData('inputs_data');
      const frameworkData = getDelivData('framework_data');
      const sicData = getDelivData('sic_analysis');
      const diagnosticData = getDelivData('diagnostic_data');

      const requestId = crypto.randomUUID();

      const payload = {
        user_id: user?.id,
        enterprise_id: enterpriseId,
        request_id: requestId,
        company: ent?.name || '',
        country: ent?.country || "IVORY COAST",
        sector: ent?.sector || "",
        business_model: (bmcData as any)?.canvas?.proposition_valeur?.enonce || '',
        current_year: new Date().getFullYear(),
        employees: ent?.employees_count || 0,
        existing_revenue: (inputsData as any)?.compte_resultat?.chiffre_affaires || 0,
        products: planOvoData?.products || [],
        services: planOvoData?.services || [],
        bmc_data: bmcData,
        inputs_data: inputsData,
        framework_data: frameworkData,
        sic_data: sicData,
        plan_ovo_data: planOvoData,
        diagnostic_data: diagnosticData,
      };

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-ovo-plan`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Erreur' }));
        throw new Error(err.error || 'Génération OVO Excel échouée');
      }

      const result = await response.json();
      toast.success('Plan Financier Excel généré !');
      await fetchData();
      return result;
    } catch (err: unknown) {
      throw err;
    }
  };

  const handleDownloadReport = async (ent: Enterprise) => {
    if (generatingReport) return;
    setGeneratingReport(ent.id);
    try {
      let token: string;
      try { token = await getValidAccessToken(authSession); } catch { toast.error('Non authentifié'); return; }

      toast.info('Génération du rapport détaillé en cours... (30-60s)', { duration: 10000 });

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-coach-report`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ enterprise_id: ent.id }),
        }
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Erreur' }));
        throw new Error(err.error || 'Erreur de génération du rapport');
      }

      const result = await response.json();
      const html = result.html;
      setReportPreview({ html, enterpriseName: ent.name });
      toast.success('Rapport généré !');
    } catch (err: any) {
      console.error('Report generation error:', err);
      toast.error(err.message || 'Erreur lors de la génération du rapport');
    } finally {
      setGeneratingReport(null);
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
        setView('list');
        setSelectedEnt(null);
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
    const entDelivs = deliverablesMap[ent.id] || [];
    const entUploads = uploadsMap[ent.id] || [];
    // entMods not needed in non-mirror tabs

    const uploadsByCategory = {
      bmc: entUploads.filter((u) => u.category === 'bmc'),
      sic: entUploads.filter((u) => u.category === 'sic'),
      inputs: entUploads.filter((u) => u.category === 'inputs'),
      supplementary: entUploads.filter((u) => u.category === 'supplementary'),
    };
    const hasBmcSic = uploadsByCategory.bmc.length > 0 && uploadsByCategory.sic.length > 0;

    const coachDelivs = entDelivs.filter((d) => d.generated_by === 'coach');
    const privateDelivs = coachDelivs.filter((d) => d.visibility === 'private');

    const delivType = DELIV_MAP[selectedModule];
    const selectedDeliv = delivType ? entDelivs.find((d) => d.type === delivType) : null;

    const renderDeliverableContent = (deliv: Deliverable) => {
      if (!deliv?.data || typeof deliv.data !== 'object') return null;
      if (selectedModule === 'bmc') return <BmcViewer data={deliv.data} />;
      if (selectedModule === 'sic') return <SicViewer data={deliv.data} />;
      if (selectedModule === 'business_plan') return <BusinessPlanPreview data={deliv.data as Record<string, any>} />;
      return <DeliverableViewer moduleCode={selectedModule} data={deliv.data} allDeliverables={entDelivs} />;
    };

    // ═══ FULL-SCREEN MIRROR VIEW — delegates to EntrepreneurDashboard ═══
    if (detailTab === 'mirror') {
      return (
        <EntrepreneurDashboard
          enterpriseId={ent.id}
          showBackButton={true}
          onBack={() => { setView('list'); setSelectedEnt(null); }}
          coachMode={true}
        />
      );
    }

    // ═══ NON-MIRROR DETAIL VIEW (Parcours + Livrables) ═══
    return (
      <DashboardLayout
        title={ent.name}
        subtitle={`${ent.sector || 'Secteur non défini'} • ${ent.country || ''}`}
      >
        {/* Generation overlay */}
        {(generating || generatingMirror) && (
          <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center">
            <div className="bg-card border border-border rounded-2xl p-8 shadow-2xl text-center max-w-sm">
              <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-4" />
              <p className="font-bold text-lg">Génération en cours…</p>
              {generationProgress && (
                <p className="text-sm text-muted-foreground mt-2">
                  {generationProgress.name} ({generationProgress.current}/{generationProgress.total})
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-3">Veuillez patienter, ne quittez pas cette page</p>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => { setView('list'); setSelectedEnt(null); }}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Retour
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
            <Button variant="outline" size="sm" onClick={() => handleDownloadReport(ent)} disabled={generatingReport === ent.id}>
              {generatingReport === ent.id ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />} Rapport IA
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border mb-6 gap-1">
          {([
            { key: 'mirror' as DetailTab, label: '👁 Vue entrepreneur', desc: 'Livrables et diagnostic' },
            { key: 'coaching' as DetailTab, label: '📝 Coaching', desc: 'Notes et rapports' },
            { key: 'parcours' as DetailTab, label: '📤 Parcours rapide', desc: 'Upload documents' },
            { key: 'livrables' as DetailTab, label: '📁 Livrables', desc: `${entDelivs.length} générés` },
          ]).map(tab => (
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

        {/* ═══ TAB: COACHING ═══ */}
        {detailTab === 'coaching' && selectedEnt && (
          <CoachingTab enterpriseId={selectedEnt.id} enterpriseName={selectedEnt.name} />
        )}

        {/* ═══ TAB: PARCOURS RAPIDE ═══ */}
        {detailTab === 'parcours' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Phase 1 */}
              <Card className="border-2">
                <CardContent className="p-5">
                  <h3 className="text-sm font-bold flex items-center gap-2 mb-4">
                    <span className="h-6 w-6 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-xs font-black">1</span>
                    Identité & Impact
                  </h3>
                  <div
                    className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all ${
                      hasBmcSic ? 'border-green-400 bg-green-50' : 'border-muted hover:border-primary/50 hover:bg-primary/5'
                    }`}
                    onClick={() => bmcInputRef.current?.click()}
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleUpload(f, 'bmc_sic', ent.id); }}
                  >
                    {uploadingCategory === 'bmc_sic' ? (
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary mb-2" />
                    ) : hasBmcSic ? (
                      <FileCheck className="h-6 w-6 mx-auto text-green-600 mb-2" />
                    ) : (
                      <Upload className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
                    )}
                    <p className="text-xs font-semibold">{hasBmcSic ? 'BMC & SIC uploadés' : 'Questionnaire BMC & Impact Social'}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">.docx, .pdf</p>
                    {hasBmcSic && uploadsByCategory.bmc[0] && (
                      <div className="mt-2 flex items-center justify-between gap-2 p-2 bg-white rounded-lg border text-xs">
                        <span className="truncate text-green-700 font-medium">{uploadsByCategory.bmc[0].filename}</span>
                        <button
                          onClick={e => { e.stopPropagation(); handleRemoveUpload(uploadsByCategory.bmc[0].id, uploadsByCategory.bmc[0].storage_path); }}
                          className="text-red-400 hover:text-red-600 flex-none"
                        ><X className="h-3 w-3" /></button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Phase 2 */}
              <Card className="border-2">
                <CardContent className="p-5">
                  <h3 className="text-sm font-bold flex items-center gap-2 mb-4">
                    <span className="h-6 w-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-black">2</span>
                    Finance
                  </h3>
                  <div
                    className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all ${
                      uploadsByCategory.inputs.length > 0 ? 'border-green-400 bg-green-50' : 'border-muted hover:border-primary/50 hover:bg-primary/5'
                    }`}
                    onClick={() => inputsInputRef.current?.click()}
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleUpload(f, 'inputs', ent.id); }}
                  >
                    {uploadingCategory === 'inputs' ? (
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary mb-2" />
                    ) : uploadsByCategory.inputs.length > 0 ? (
                      <FileCheck className="h-6 w-6 mx-auto text-green-600 mb-2" />
                    ) : (
                      <Upload className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
                    )}
                    <p className="text-xs font-semibold">{uploadsByCategory.inputs.length > 0 ? 'Inputs uploadés' : 'Inputs Financiers'}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">.xlsx, .csv</p>
                    {uploadsByCategory.inputs.map((u: any) => (
                      <div key={u.id} className="mt-2 flex items-center justify-between gap-2 p-2 bg-white rounded-lg border text-xs">
                        <span className="truncate text-green-700 font-medium">{u.filename}</span>
                        <button onClick={e => { e.stopPropagation(); handleRemoveUpload(u.id, u.storage_path); }} className="text-red-400 hover:text-red-600 flex-none">
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Phase 3 */}
              <Card className="border-2 border-dashed">
                <CardContent className="p-5">
                  <h3 className="text-sm font-bold flex items-center gap-2 mb-4">
                    <span className="h-6 w-6 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-xs font-black">3</span>
                    Dossier Investisseur
                  </h3>
                  <div className="p-4 text-center text-muted-foreground">
                    <Sparkles className="h-8 w-8 mx-auto text-purple-400 mb-2" />
                    <p className="text-xs font-semibold">Auto-généré</p>
                    <p className="text-[10px] mt-1">Business Plan & ODD créés à partir des phases 1 et 2</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Documents supplémentaires */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => suppInputRef.current?.click()}
                  className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1.5 border border-dashed border-muted hover:border-primary/50 rounded-lg px-3 py-2 transition-all"
                >
                  <Plus className="h-3.5 w-3.5" /> Documents supplémentaires
                </button>
                {uploadsByCategory.supplementary.length > 0 && (
                  <span className="text-xs text-muted-foreground">{uploadsByCategory.supplementary.length} doc(s)</span>
                )}
              </div>
              {uploadsByCategory.supplementary.length > 0 && (
                <div className="space-y-1 pl-1">
                  {uploadsByCategory.supplementary.map((u: any) => (
                    <div key={u.id} className="flex items-center gap-2 p-1.5 rounded-lg group/file hover:bg-muted/50">
                      <span className="text-xs text-muted-foreground truncate font-medium flex-1">{u.filename}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleRemoveUpload(u.id, u.storage_path); }}
                        className="hidden group-hover/file:flex h-4 w-4 items-center justify-center rounded-sm hover:bg-destructive/10 text-muted-foreground hover:text-destructive flex-none"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Bouton Générer */}
            <div className="flex items-center justify-between p-5 bg-gradient-to-r from-primary to-primary/70 rounded-xl text-primary-foreground">
              <div>
                <p className="font-bold text-sm flex items-center gap-2"><Sparkles className="h-4 w-4" /> Générer les livrables</p>
                <p className="text-xs opacity-80 mt-0.5">
                  {entUploads.length} document(s) • 🔒 Livrables privés par défaut
                  {generationProgress && ` • ${generationProgress.name} (${generationProgress.current}/${generationProgress.total})`}
                </p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                disabled={generating || entUploads.length === 0}
                onClick={() => handleGenerateCoach(ent.id)}
                className="gap-2 font-bold"
              >
                {generating ? <><Loader2 className="h-4 w-4 animate-spin" /> En cours...</> : <><Sparkles className="h-4 w-4" /> Générer</>}
              </Button>
            </div>

            {/* Livrables générés (parcours rapide) */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  Livrables générés ({coachDelivs.length})
                </h3>
                {privateDelivs.length > 0 && (
                  <Button variant="outline" size="sm" onClick={() => handleShareAll(ent.id)} className="gap-1.5 text-xs">
                    <Share2 className="h-3.5 w-3.5" /> Tout partager ({privateDelivs.length})
                  </Button>
                )}
              </div>

              {coachDelivs.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="py-10 text-center text-muted-foreground">
                    <FileText className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm font-medium">Aucun livrable généré</p>
                    <p className="text-xs mt-1">Uploadez des documents et cliquez sur "Générer"</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2">
                  {MODULE_CONFIG.map(mod => {
                    const dType = DELIV_MAP[mod.code];
                    const d = coachDelivs.find((x: any) => x.type === dType);
                    if (!d) return null;
                    const isShared = d.visibility === 'shared';
                    const Icon = mod.icon;
                    return (
                      <div key={mod.code} className="flex items-center justify-between p-3 bg-card border rounded-xl hover:shadow-sm transition-all">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-lg flex items-center justify-center" style={{ background: `${mod.color}15`, color: mod.color }}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="text-xs font-semibold">{mod.title}</p>
                            <p className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                              {isShared ? (
                                <><Share2 className="h-2.5 w-2.5 text-green-500" /><span className="text-green-600">Partagé</span></>
                              ) : (
                                <><Lock className="h-2.5 w-2.5" /><span>Privé</span></>
                              )}
                              {d.score ? ` · ${d.score}/100` : ''}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs"
                            onClick={() => { setSelectedModule(mod.code); setDetailTab('livrables'); }}>
                            <Eye className="h-3 w-3 mr-1" /> Voir
                          </Button>
                          {/* Download buttons per format */}
                          <Button variant="outline" size="sm" className="h-7 px-2 text-xs gap-1"
                            onClick={() => handleDownloadCoach(DELIV_MAP[mod.code], 'html', ent.id)}>
                            <Download className="h-3 w-3" /> HTML
                          </Button>
                          {mod.code === 'plan_ovo' && entDelivs.find((x: any) => x.type === 'plan_ovo_excel') && (
                            <Button variant="outline" size="sm" className="h-7 px-2 text-xs gap-1"
                              onClick={() => handleDownloadOvoCoach(ent.id, entDelivs)}>
                              <Download className="h-3 w-3" /> XLSM
                            </Button>
                          )}
                          {mod.code === 'business_plan' && (d.data as any)?._meta?.download_url && (
                            <Button variant="outline" size="sm" className="h-7 px-2 text-xs gap-1"
                              onClick={() => handleDownloadBpWordCoach((d.data as any)._meta.download_url, ent.name)}>
                              <Download className="h-3 w-3" /> DOCX
                            </Button>
                          )}
                          {mod.code === 'odd' && entDelivs.find((x: any) => x.type === 'odd_excel') && (
                            <Button variant="outline" size="sm" className="h-7 px-2 text-xs gap-1"
                              onClick={() => handleDownloadOddExcelCoach(ent.id)}>
                              <Download className="h-3 w-3" /> XLSX
                            </Button>
                          )}
                          {!isShared && (
                            <Button variant="outline" size="sm" className="h-7 px-2 text-xs gap-1 text-purple-600 border-purple-200"
                              disabled={sharingId === d.id}
                              onClick={() => handleShare(d.id)}>
                              {sharingId === d.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Share2 className="h-3 w-3" />}
                              Partager
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Hidden file inputs — always in DOM regardless of active tab */}
        <input ref={bmcInputRef} type="file" accept=".docx,.doc,.pdf" className="hidden"
          onChange={e => { if (e.target.files?.[0]) handleUpload(e.target.files[0], 'bmc_sic', ent.id); e.target.value = ''; }} />
        <input ref={inputsInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
          onChange={e => { if (e.target.files?.[0]) handleUpload(e.target.files[0], 'inputs', ent.id); e.target.value = ''; }} />
        <input ref={suppInputRef} type="file" multiple accept=".docx,.doc,.pdf,.xlsx,.xls,.csv,.txt" className="hidden"
          onChange={e => { Array.from(e.target.files || []).forEach(f => handleUpload(f, 'supplementary', ent.id)); e.target.value = ''; }} />




        {/* ═══ TAB: LIVRABLES ═══ */}
        {detailTab === 'livrables' && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {MODULE_CONFIG.map(mod => {
                const dType = DELIV_MAP[mod.code];
                const d = entDelivs.find((x: any) => x.type === dType);
                const Icon = mod.icon;
                return (
                  <button
                    key={mod.code}
                    onClick={() => setSelectedModule(mod.code)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 text-xs font-medium transition-all ${
                      selectedModule === mod.code ? 'border-primary bg-primary/5 text-primary' : 'border-transparent hover:bg-muted/50 text-muted-foreground'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {mod.title}
                    {d && <CheckCircle2 className="h-3 w-3 text-green-500" />}
                  </button>
                );
              })}
            </div>

            {/* Contextual download bar for selected module in Livrables tab */}
            {selectedDeliv && (
              <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-muted/30">
                <span className="text-sm font-medium">{MODULE_CONFIG.find(m => m.code === selectedModule)?.title}</span>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" className="h-7 px-3 text-xs gap-1"
                    onClick={() => handleDownloadCoach(DELIV_MAP[selectedModule], 'html', ent.id)}>
                    <Download className="h-3 w-3" /> HTML
                  </Button>
                  {selectedModule === 'plan_ovo' && entDelivs.find((x: any) => x.type === 'plan_ovo_excel') && (
                    <Button variant="outline" size="sm" className="h-7 px-3 text-xs gap-1"
                      onClick={() => handleDownloadOvoCoach(ent.id, entDelivs)}>
                      <Download className="h-3 w-3" /> XLSM
                    </Button>
                  )}
                  {selectedModule === 'business_plan' && (selectedDeliv?.data as any)?._meta?.download_url && (
                    <Button variant="outline" size="sm" className="h-7 px-3 text-xs gap-1"
                      onClick={() => handleDownloadBpWordCoach((selectedDeliv?.data as any)._meta.download_url, ent.name)}>
                      <Download className="h-3 w-3" /> DOCX
                    </Button>
                  )}
                  {selectedModule === 'odd' && entDelivs.find((x: any) => x.type === 'odd_excel') && (
                    <Button variant="outline" size="sm" className="h-7 px-3 text-xs gap-1"
                      onClick={() => handleDownloadOddExcelCoach(ent.id)}>
                      <Download className="h-3 w-3" /> XLSX
                    </Button>
                  )}
                </div>
              </div>
            )}

            {renderDeliverableContent(selectedDeliv) || (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="font-medium">Aucune donnée pour ce module</p>
                  <p className="text-sm mt-1">Générez les livrables depuis l'onglet "Parcours Rapide"</p>
                </CardContent>
              </Card>
            )}
          </div>
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
          <Button variant="outline" onClick={() => setView('list')} className="gap-2">
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
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <KpiCard icon={Users} color="purple" value={totalEntreprises} label="Entrepreneurs suivis" />
        <KpiCard icon={TrendingUp} color="blue" value={`${avgScore}/100`} label="Score moyen IR" gauge={avgScore} />
        <KpiCard icon={CheckCircle2} color="green" value={completedMods} label="Modules complétés" />
        <KpiCard icon={Sparkles} color="orange" value={delivsThisWeek} label="Livrables cette semaine" />
      </div>

      {/* Actions rapides */}
      <div className="flex flex-wrap gap-3 mb-6">
        <Button onClick={() => setShowAddModal(true)} className="gap-2">
          <UserPlus className="h-4 w-4" /> Ajouter un entrepreneur
        </Button>
        <Button variant="outline" onClick={() => setView('screening')} className="gap-2">
          <ListChecks className="h-4 w-4" /> Screening & Programmes
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
                    onClick={() => { setSelectedEnt(ent); setView('detail'); setDetailTab('mirror'); }}
                  >
                    <Eye className="h-3 w-3" /> Voir
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => handleDownloadReport(ent)} disabled={generatingReport === ent.id}>
                    {generatingReport === ent.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
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
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Nom du contact</label>
                <input type="text" placeholder="Prénom Nom"
                  value={addForm.contact_name}
                  onChange={e => setAddForm(f => ({ ...f, contact_name: e.target.value }))}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Téléphone</label>
                <input type="tel" placeholder="+225 07 00 00 00"
                  value={addForm.contact_phone}
                  onChange={e => setAddForm(f => ({ ...f, contact_phone: e.target.value }))}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Email</label>
              <input type="email" placeholder="contact@entreprise.com"
                value={addForm.contact_email}
                onChange={e => setAddForm(f => ({ ...f, contact_email: e.target.value }))}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Secteur</label>
                <select value={addForm.sector} onChange={e => setAddForm(f => ({ ...f, sector: e.target.value }))}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none"
                >
                  <option value="">— Sélectionner —</option>
                  {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Pays</label>
                <select value={addForm.country} onChange={e => setAddForm(f => ({ ...f, country: e.target.value }))}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none"
                >
                  {["Côte d'Ivoire", "Sénégal", "Mali", "Burkina Faso", "Togo", "Bénin", "Guinée", "Niger"].map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
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

function KpiCard({ icon: Icon, color, value, label, gauge }: { icon: any; color: string; value: any; label: string; gauge?: number }) {
  const colorMap: Record<string, string> = {
    purple: 'bg-purple-100 text-purple-600',
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-green-100 text-green-600',
    orange: 'bg-orange-100 text-orange-600',
  };
  const gaugeColorMap: Record<string, string> = {
    purple: 'bg-purple-500', blue: 'bg-blue-500', green: 'bg-green-500', orange: 'bg-orange-500',
  };
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-center gap-3 mb-1">
          <div className={`h-9 w-9 rounded-lg flex items-center justify-center flex-none ${colorMap[color]}`}>
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <p className="text-2xl font-display font-black leading-none">{value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
          </div>
        </div>
        {gauge !== undefined && (
          <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
            <div className={`h-full rounded-full transition-all ${gaugeColorMap[color]}`} style={{ width: `${gauge}%` }} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
