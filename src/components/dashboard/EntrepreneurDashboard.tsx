import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  LayoutGrid, Globe, FileSpreadsheet, BarChart3,
  Stethoscope, ListChecks, FileText, Target,
  Plus, Building2, Upload, Sparkles, Download,
  LogOut, User, Clock, CheckCircle2, Loader2, X, FileUp,
  BookOpen, Lock, FolderPlus, Pencil, Trash2
} from 'lucide-react';
import BmcViewer from './BmcViewer';
import SicViewer from './SicViewer';
import DeliverableViewer from './DeliverableViewer';
import BusinessPlanPreview from './BusinessPlanPreview';

const MODULE_CONFIG = [
  { code: 'diagnostic' as const, title: 'Diagnostic Expert Global', shortTitle: 'Diagnostic Expert Global', icon: Stethoscope, color: 'bg-orange-100 text-orange-600', step: 1 },
  { code: 'bmc' as const, title: 'Business Model Canvas', shortTitle: 'Business Model Canvas', icon: LayoutGrid, color: 'bg-emerald-100 text-emerald-600', step: 2 },
  { code: 'sic' as const, title: 'Social Impact Canvas', shortTitle: 'Social Impact Canvas', icon: Globe, color: 'bg-teal-100 text-teal-600', step: 3 },
  { code: 'framework' as const, title: 'Plan Financier Intermédiaire', shortTitle: 'Plan Financier Intermédiaire', icon: BarChart3, color: 'bg-purple-100 text-purple-600', step: 4 },
  { code: 'plan_ovo' as const, title: 'Plan Financier Final', shortTitle: 'Plan Financier Final', icon: ListChecks, color: 'bg-amber-100 text-amber-600', step: 5 },
  { code: 'business_plan' as const, title: 'Business Plan', shortTitle: 'Business Plan', icon: FileText, color: 'bg-indigo-100 text-indigo-600', step: 6 },
  { code: 'odd' as const, title: 'ODD', shortTitle: 'ODD', icon: Target, color: 'bg-red-100 text-red-600', step: 7 },
];

const DELIVERABLE_CONFIG = [
  { type: 'bmc_analysis', label: 'Business Model Canvas', formats: ['html', 'json'], icon: '📊' },
  { type: 'sic_analysis', label: 'Social Impact Canvas', formats: ['html', 'json'], icon: '🌍' },
  { type: 'framework_data', label: 'Plan Financier Intermédiaire', formats: ['html', 'xlsx'], icon: '📈' },
  { type: 'diagnostic_data', label: 'Diagnostic Expert', formats: ['html', 'json'], icon: '🩺' },
  { type: 'plan_ovo', label: 'Plan Financier Final', formats: ['html', 'xlsx'], icon: '📋' },
  { type: 'business_plan', label: 'Business Plan', formats: ['html', 'json', 'docx'], icon: '📄' },
  { type: 'odd_analysis', label: 'ODD (17 Objectifs de Développement Durable)', formats: ['html', 'json', 'xlsx'], icon: '🌍' },
];

export default function EntrepreneurDashboard() {
  const { user, profile, session: authSession, signOut } = useAuth();

  /** Robust access token retrieval: context → getSession → refreshSession → redirect */
  const getValidAccessToken = async (): Promise<string> => {
    // 1. Try auth context session first (most reliable in-memory source)
    if (authSession?.access_token) return authSession.access_token;

    // 2. Try Supabase getSession
    const { data: { session: s } } = await supabase.auth.getSession();
    if (s?.access_token) return s.access_token;

    // 3. Force refresh
    const { data: { session: refreshed } } = await supabase.auth.refreshSession();
    if (refreshed?.access_token) return refreshed.access_token;

    // 4. All failed — redirect to login
    navigate('/login');
    throw new Error("Session expirée — redirection vers la connexion");
  };
  const navigate = useNavigate();
  const [initialLoading, setInitialLoading] = useState(true);
  const [enterprise, setEnterprise] = useState<any>(null);
  const [modules, setModules] = useState<any[]>([]);
  const [deliverables, setDeliverables] = useState<any[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newSector, setNewSector] = useState('');
  const [newCountry, setNewCountry] = useState("Côte d'Ivoire");
  const [newCity, setNewCity] = useState('');
  const [newLegalForm, setNewLegalForm] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generatingModule, setGeneratingModule] = useState<string | null>(null);
  const [generatingOvoPlan, setGeneratingOvoPlan] = useState(false);
  const [ovoDownloadUrl, setOvoDownloadUrl] = useState<string | null>(null);
  const [selectedModule, setSelectedModule] = useState<string>('business_plan');
  const [showEdit, setShowEdit] = useState(false);
  const [editName, setEditName] = useState('');
  const [editSector, setEditSector] = useState('');
  const [editCountry, setEditCountry] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editLegalForm, setEditLegalForm] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [extractedInfo, setExtractedInfo] = useState<{ name: string | null; country: string | null; sector: string | null } | null>(null);
  const [showExtractDialog, setShowExtractDialog] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const docInputRef = useRef<HTMLInputElement>(null);
  const finInputRef = useRef<HTMLInputElement>(null);
  const extraInputRef = useRef<HTMLInputElement>(null);

  const fetchData = useCallback(async () => {
    if (!user) return;
    const { data: ent } = await supabase
      .from('enterprises').select('*').eq('user_id', user.id).maybeSingle();

    if (ent) {
      setEnterprise(ent);
      const [modsRes, delivRes, filesRes] = await Promise.all([
        supabase.from('enterprise_modules').select('*').eq('enterprise_id', ent.id),
        supabase.from('deliverables').select('*').eq('enterprise_id', ent.id),
        supabase.storage.from('documents').list(ent.id),
      ]);
      setModules(modsRes.data || []);
      setDeliverables(delivRes.data || []);
      setUploadedFiles((filesRes.data || []).map((f: any) => ({ name: f.name, size: f.metadata?.size || 0 })));
    }
    setInitialLoading(false);
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Ensure templates are uploaded to storage buckets (best-effort, silent)
  useEffect(() => {
    if (!user) return;
    const ensureTemplates = async () => {
      try {
        const token = await getValidAccessToken();
        await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/upload-template`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({}),
        });
      } catch (_) { /* silent */ }
    };
    ensureTemplates();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Auto-resume polling if OVO generation is stuck in "processing" on page load
  useEffect(() => {
    if (!enterprise || generatingOvoPlan) return;
    const ovoDeliv = deliverables.find((d: any) => d.type === 'plan_ovo_excel');
    const meta = ovoDeliv?.data as Record<string, any> | undefined;
    if (meta?.status === 'processing' && meta?.request_id && meta?.started_at) {
      const age = Date.now() - new Date(meta.started_at).getTime();
      if (age < 10 * 60 * 1000) { // less than 10 min old
        console.log('[OVO] Resuming polling for in-progress generation:', meta.request_id);
        setGeneratingOvoPlan(true);
        toast.info('Génération OVO en cours, reprise du suivi...');
        pollForOvoCompletion(enterprise.id, meta.request_id, meta.started_at)
          .then((polled) => {
            if (polled) {
              setOvoDownloadUrl(polled.url);
              toast.success('Plan Financier OVO généré avec succès !');
            }
            fetchData();
          })
          .catch((err) => {
            toast.error(err.message || 'La génération a échoué');
          })
          .finally(() => setGeneratingOvoPlan(false));
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enterprise?.id, deliverables.length]);

  const extractEnterpriseInfo = async (enterpriseId: string) => {
    try {
      setExtracting(true);
      const token = await getValidAccessToken();
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
        // Check if info differs from current enterprise
        const differs = (info.name && info.name !== enterprise?.name) ||
          (info.country && info.country !== enterprise?.country) ||
          (info.sector && info.sector !== enterprise?.sector);
        if (differs) {
          setExtractedInfo(info);
          setShowExtractDialog(true);
        }
      }
    } catch (e) {
      console.error('Extraction error:', e);
    } finally {
      setExtracting(false);
    }
  };

  const handleConfirmExtraction = async () => {
    if (!enterprise || !extractedInfo) return;
    setSaving(true);
    try {
      const updates: any = {};
      if (extractedInfo.name) updates.name = extractedInfo.name;
      if (extractedInfo.country) updates.country = extractedInfo.country;
      if (extractedInfo.sector) updates.sector = extractedInfo.sector;
      const { error } = await supabase.from('enterprises').update(updates).eq('id', enterprise.id);
      if (error) throw error;
      toast.success('Informations mises à jour !');
      setShowExtractDialog(false);
      setExtractedInfo(null);
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, category: string) => {
    const files = e.target.files;
    if (!enterprise) return;
    setUploading(category);
    try {
      for (const file of Array.from(files || [])) {
        const filePath = `${enterprise.id}/${file.name}`;
        const { error } = await supabase.storage.from('documents').upload(filePath, file, { upsert: true });
        if (error) throw error;
      }
      toast.success(`${files?.length || 0} fichier(s) uploadé(s)`);
      await fetchData();
      // Trigger enterprise info extraction in background
      const hasDeliverables = deliverables.length > 0;
      if (!hasDeliverables) {
        extractEnterpriseInfo(enterprise.id);
      }
    } catch (err: any) {
      toast.error(err.message || "Erreur d'upload");
    } finally {
      setUploading(null);
      if (docInputRef.current) docInputRef.current.value = '';
      if (finInputRef.current) finInputRef.current.value = '';
      if (extraInputRef.current) extraInputRef.current.value = '';
    }
  };

  const handleDeleteFile = async (fileName: string) => {
    if (!enterprise) return;
    if (!confirm(`Supprimer "${fileName}" ?`)) return;
    try {
      const { error } = await supabase.storage.from('documents').remove([`${enterprise.id}/${fileName}`]);
      if (error) throw error;
      toast.success('Fichier supprimé');
      await fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Erreur de suppression');
    }
  };

  const [generationProgress, setGenerationProgress] = useState<{ current: number; total: number; name: string } | null>(null);

  const PIPELINE = [
    { name: "BMC", fn: "generate-bmc", type: "bmc_analysis" },
    { name: "SIC", fn: "generate-sic", type: "sic_analysis" },
    { name: "Inputs", fn: "generate-inputs", type: "inputs_data" },
    { name: "Framework", fn: "generate-framework", type: "framework_data" },
    { name: "Diagnostic", fn: "generate-diagnostic", type: "diagnostic_data" },
    { name: "Plan OVO", fn: "generate-plan-ovo", type: "plan_ovo" },
    { name: "Business Plan", fn: "generate-business-plan", type: "business_plan" },
    { name: "ODD", fn: "generate-odd", type: "odd_analysis" },
  ];

  const handleGenerate = async (force = false) => {
    if (!enterprise) return;
    setGenerating(true);
    let completed = 0;
    const scores: number[] = [];
    const errors: string[] = [];

    try {
      const token = await getValidAccessToken();

      for (let i = 0; i < PIPELINE.length; i++) {
        const step = PIPELINE[i];
        setGenerationProgress({ current: i + 1, total: PIPELINE.length, name: step.name });

        // Skip if deliverable already exists with rich data (unless force=true)
        const existing = deliverables.find(d => d.type === step.type);
        if (!force && existing?.data && typeof existing.data === 'object' && Object.keys(existing.data as object).length > 0) {
          completed++;
          if (existing.score) scores.push(existing.score);
          continue;
        }

        try {
          const response = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${step.fn}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({ enterprise_id: enterprise.id }),
            }
          );

          if (response.ok) {
            const result = await response.json();
            completed++;
            if (result.score) scores.push(result.score);
            // Refresh data so the user sees the deliverable immediately
            await fetchData();
          } else {
            const err = await response.json().catch(() => ({ error: 'Erreur inconnue' }));
            if (response.status === 402) {
              toast.error("Crédits IA insuffisants.");
              break;
            }
            errors.push(`${step.name}: ${err.error || 'Erreur'}`);
          }
        } catch (e: any) {
          errors.push(`${step.name}: ${e.message || 'Erreur réseau'}`);
        }
      }

      const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
      toast.success(`${completed} livrables générés ! Score: ${avgScore}/100`);
      if (errors.length > 0) {
        toast.warning(`${errors.length} module(s) en erreur`);
      }
      await fetchData();

      // Auto-trigger Plan OVO Excel generation if plan_ovo was generated
      const hasOvo = deliverables.find(d => d.type === 'plan_ovo') || completed > 0;
      if (hasOvo && !generatingOvoPlan) {
        toast.info('Génération automatique du Plan Financier Excel...');
        try {
          await handleGenerateOvoPlan();
        } catch (ovoErr: any) {
          console.warn('[Pipeline] OVO Excel auto-generation failed:', ovoErr.message);
        }
      }
    } catch (err: any) {
      toast.error(err.message || 'Erreur de génération');
    } finally {
      setGenerating(false);
      setGenerationProgress(null);
    }
  };

  const handleGenerateModule = async (moduleCode: string) => {
    if (!enterprise) return;
    setGeneratingModule(moduleCode);
    try {
      const token = await getValidAccessToken();
      const fnMap: Record<string, string> = {
        bmc: 'generate-bmc', sic: 'generate-sic', inputs: 'generate-inputs',
        framework: 'generate-framework', diagnostic: 'generate-diagnostic',
        plan_ovo: 'generate-plan-ovo', business_plan: 'generate-business-plan', odd: 'generate-odd',
      };
      const functionName = fnMap[moduleCode] || `generate-${moduleCode}`;
      
      // Longer timeout for business_plan (split AI calls)
      const timeoutMs = moduleCode === 'business_plan' ? 180000 : 120000;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${functionName}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ enterprise_id: enterprise.id }),
          signal: controller.signal,
        }
      );
      clearTimeout(timeoutId);
      if (!response.ok) { const err = await response.json(); throw new Error(err.error || 'Erreur'); }
      const result = await response.json();
      toast.success(`${moduleCode.toUpperCase()} généré ! Score: ${result.score}/100`);
      setSelectedModule(moduleCode);
      await fetchData();
    } catch (err: any) {
      if (err.name === 'AbortError') {
        toast.error('La génération a pris trop de temps. Réessayez.');
      } else {
        toast.error(err.message || 'Erreur de génération');
      }
    } finally {
      setGeneratingModule(null);
    }
  };

  const createEnterprise = async () => {
    if (!user || !newName.trim()) return;
    setCreating(true);
    try {
      const { data, error } = await supabase
        .from('enterprises')
        .insert({
          user_id: user.id, name: newName.trim(), sector: newSector.trim() || null,
          country: newCountry.trim() || "Côte d'Ivoire", city: newCity.trim() || null,
          legal_form: newLegalForm.trim() || null, description: newDescription.trim() || null,
          contact_email: profile?.email || user?.email || null,
          contact_name: profile?.full_name || null,
        })
        .select().single();
      if (error) throw error;
      const moduleInserts = MODULE_CONFIG.map(m => ({ enterprise_id: data.id, module: m.code }));
      await supabase.from('enterprise_modules').insert(moduleInserts);
      toast.success('Entreprise créée !');
      setShowCreate(false);
      setNewName('');
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setCreating(false);
    }
  };
  const openEditDialog = () => {
    if (!enterprise) return;
    setEditName(enterprise.name || '');
    setEditSector(enterprise.sector || '');
    setEditCountry(enterprise.country || '');
    setEditCity(enterprise.city || '');
    setEditLegalForm(enterprise.legal_form || '');
    setEditDescription(enterprise.description || '');
    setShowEdit(true);
  };

  const saveEnterprise = async () => {
    if (!enterprise || !editName.trim()) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('enterprises').update({
        name: editName.trim(),
        sector: editSector.trim() || null,
        country: editCountry.trim() || null,
        city: editCity.trim() || null,
        legal_form: editLegalForm.trim() || null,
        description: editDescription.trim() || null,
      }).eq('id', enterprise.id);
      if (error) throw error;
      toast.success('Entreprise mise à jour !');
      setShowEdit(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const getModuleData = (code: string) => {
    const mod = modules.find((m: any) => m.module === code);
    return { status: (mod?.status || 'not_started') as 'not_started' | 'in_progress' | 'completed', progress: mod?.progress || 0 };
  };

  const getDeliverable = (type: string) => {
    const matches = deliverables.filter((d: any) => d.type === type);
    if (matches.length <= 1) return matches[0] || undefined;
    // Return the most recently updated one
    return matches.sort((a: any, b: any) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())[0];
  };

  const completedCount = modules.filter((m: any) => m.status === 'completed').length;
  const scoredDeliverables = deliverables.filter((d: any) => d.score != null);
  const globalScore = scoredDeliverables.length > 0
    ? Math.round(scoredDeliverables.reduce((sum: number, d: any) => sum + (d.score || 0), 0) / scoredDeliverables.length)
    : 0;

  const maturityLabel = globalScore >= 80 ? 'Excellent' : globalScore >= 60 ? 'Très bien' : globalScore >= 40 ? 'Moyen' : globalScore > 0 ? 'À améliorer' : '—';

  const handleSignOut = async () => { await signOut(); navigate('/login'); };

  const pollForOvoCompletion = async (enterpriseId: string, requestId: string, startedAt: string): Promise<{ url: string; fileName: string } | null> => {
    const maxAttempts = 160; // 160 × 3s = ~8 min max
    const STALE_THRESHOLD_MS = 10 * 60 * 1000; // 10 min = stale
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(r => setTimeout(r, 3000));
      const { data: d } = await supabase
        .from('deliverables')
        .select('file_url, data')
        .eq('enterprise_id', enterpriseId)
        .eq('type', 'plan_ovo_excel' as any)
        .maybeSingle();
      if (!d?.data || typeof d.data !== 'object') continue;
      const meta = d.data as Record<string, any>;
      if (meta.request_id !== requestId && !(meta.generated_at && meta.generated_at > startedAt)) continue;
      if (meta.status === 'completed' && meta.file_name) {
        const { data: signedData, error: signedError } = await supabase.storage
          .from('ovo-outputs')
          .createSignedUrl(meta.file_name, 3600);
        if (signedError || !signedData?.signedUrl) {
          return { url: d.file_url || '', fileName: meta.file_name };
        }
        return { url: signedData.signedUrl, fileName: meta.file_name };
      }
      if (meta.status === 'failed') {
        throw new Error(meta.error || 'La génération a échoué côté serveur');
      }
      // Detect stale processing (started_at too old)
      if (meta.status === 'processing' && meta.started_at) {
        const age = Date.now() - new Date(meta.started_at).getTime();
        if (age > STALE_THRESHOLD_MS) {
          throw new Error('La génération semble bloquée (aucune mise à jour depuis 10 min). Veuillez réessayer.');
        }
      }
    }
    throw new Error('Délai dépassé (~8 min) — la génération prend trop de temps. Veuillez réessayer.');
  };

  const handleGenerateOvoPlan = async () => {
    if (!enterprise) return;
    setGeneratingOvoPlan(true);
    setOvoDownloadUrl(null);
    const requestId = crypto.randomUUID();
    const startedAt = new Date().toISOString();
    try {
      const token = await getValidAccessToken();

      // Gather ALL existing deliverable data
      const getDelivData = (type: string): Record<string, any> => {
        const d = deliverables.find((d: any) => d.type === type);
        return (d?.data && typeof d.data === 'object') ? d.data as Record<string, any> : {};
      };

      const bmcData = getDelivData('bmc_analysis');
      const inputsData = getDelivData('inputs_data');
      const frameworkData = getDelivData('framework_data');
      const sicData = getDelivData('sic_analysis');
      const planOvoData = getDelivData('plan_ovo');
      const diagnosticData = getDelivData('diagnostic_data');

      // ── Extract products/services via priority cascade ──
      const extractItems = (type: 'products' | 'services'): Array<{ name: string; description: string; price?: number; deduit_du_bmc?: boolean }> => {
        // 1. Previous plan_ovo generation
        if (Array.isArray(planOvoData?.[type]) && planOvoData[type].length > 0) {
          return planOvoData[type].map((p: any) => ({ name: p.name || p.nom || '', description: p.description || '', price: p.price || p.prix || undefined }));
        }

        // 2. Explicit products/services from BMC or inputs
        for (const src of [bmcData, inputsData]) {
          const arr = src?.[type] || src?.[type === 'products' ? 'produits' : 'services'];
          if (Array.isArray(arr) && arr.length > 0) {
            return arr.map((p: any) => typeof p === 'string' ? { name: p, description: '' } : { name: p.name || p.nom || p.label || '', description: p.description || '', price: p.price || p.prix || undefined });
          }
        }

        // 3. BMC canvas: flux_revenus, proposition_valeur
        const canvas = bmcData?.canvas || {};
        const items: Array<{ name: string; description: string; price?: number; deduit_du_bmc?: boolean }> = [];

        if (canvas.flux_revenus) {
          const fr = canvas.flux_revenus;
          if (fr.produit_principal) items.push({ name: fr.produit_principal, description: 'Produit principal (BMC)', deduit_du_bmc: true });
          if (fr.sources_revenus) {
            const sources = Array.isArray(fr.sources_revenus) ? fr.sources_revenus : [fr.sources_revenus];
            sources.forEach((s: any) => items.push({ name: typeof s === 'string' ? s : s.name || s.label || JSON.stringify(s), description: 'Source de revenus (BMC)', deduit_du_bmc: true }));
          }
        }
        if (canvas.proposition_valeur) {
          const pv = canvas.proposition_valeur;
          if (pv.produits && Array.isArray(pv.produits)) {
            pv.produits.forEach((p: any) => items.push({ name: typeof p === 'string' ? p : p.name || p.label || '', description: pv.enonce || 'Proposition de valeur (BMC)', deduit_du_bmc: true }));
          }
          if (items.length === 0 && pv.enonce) {
            items.push({ name: pv.enonce.substring(0, 80), description: 'Proposition de valeur (BMC)', deduit_du_bmc: true });
          }
        }
        if (items.length > 0) return items;

        // 4. Fallback: structure_couts, partenaires_cles
        if (canvas.structure_couts?.postes && Array.isArray(canvas.structure_couts.postes)) {
          canvas.structure_couts.postes.forEach((p: any) => {
            const name = typeof p === 'string' ? p : p.libelle || p.label || p.name || '';
            if (name) items.push({ name, description: 'Déduit de la structure des coûts (BMC)', deduit_du_bmc: true });
          });
        }
        if (canvas.partenaires_cles?.items && Array.isArray(canvas.partenaires_cles.items)) {
          canvas.partenaires_cles.items.forEach((p: any) => {
            const name = typeof p === 'string' ? p : p.name || p.label || '';
            if (name) items.push({ name, description: 'Déduit des partenaires clés (BMC)', deduit_du_bmc: true });
          });
        }
        if (items.length > 0) return items;

        // 5. Last resort: activites_cles → treat as products/services
        if (canvas.activites_cles?.items && Array.isArray(canvas.activites_cles.items)) {
          return canvas.activites_cles.items.map((a: any) => ({
            name: typeof a === 'string' ? a : a.name || a.label || '',
            description: 'Activité clé transformée en produit/service (BMC)',
            deduit_du_bmc: true,
          })).filter((i: any) => i.name);
        }

        return [];
      };

      let products = extractItems('products');
      const services = extractItems('services');

      // Enrich products with CA/marge from framework analyse_marge
      const margeActivites = (frameworkData as any)?.analyse_marge?.activites || [];
      if (margeActivites.length > 0) {
        products = products.map((p) => {
          const match = margeActivites.find((a: any) =>
            (a.nom || a.name || '').toLowerCase().includes((p.name || '').toLowerCase().substring(0, 8)) ||
            (p.name || '').toLowerCase().includes((a.nom || a.name || '').toLowerCase().substring(0, 8))
          );
          if (match) {
            return { ...p, ca: match.ca || 0, marge_pct: match.ca > 0 ? Math.round(((match.marge_brute || 0) / match.ca) * 100) : 60 };
          }
          return p;
        });
      }

      // Add prix_moyen from BMC
      const bmcFluxRevenus = bmcData?.canvas?.flux_revenus || {};
      const prixMoyen = bmcFluxRevenus?.prix_moyen || bmcFluxRevenus?.prix_unitaire || 0;
      if (prixMoyen > 0 && products.length > 0) {
        products = products.map(p => ({ ...p, price: p.price || prixMoyen }));
      }

      // Extract financial KPIs
      const cr = inputsData?.compte_resultat || {};
      const existingRevenue = cr.chiffre_affaires || cr.ca || inputsData?.revenue || inputsData?.chiffre_affaires || 0;

      const payload = {
        user_id: user?.id,
        enterprise_id: enterprise.id,
        request_id: requestId,
        company: enterprise.name,
        country: enterprise.country || "IVORY COAST",
        sector: enterprise.sector || "",
        business_model: bmcData?.canvas?.proposition_valeur?.enonce || bmcData?.business_model || bmcData?.proposition_valeur || "",
        current_year: new Date().getFullYear(),
        employees: enterprise.employees_count || 0,
        existing_revenue: existingRevenue,
        startup_costs: inputsData?.startup_costs || inputsData?.couts_demarrage || 0,
        loan_needed: inputsData?.loan_needed || inputsData?.besoin_financement || 0,
        products,
        services,
        bmc_data: bmcData,
        inputs_data: inputsData,
        framework_data: frameworkData,
        sic_data: sicData,
        plan_ovo_data: planOvoData,
        diagnostic_data: diagnosticData,
      };

      let downloadUrl: string | null = null;
      let fileName = 'PlanFinancierOVO.xlsm';

      try {
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-ovo-plan`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify(payload),
          }
        );

        if (!response.ok) {
          // HTTP error (400/500) — show the real server error, do NOT fall back to polling
          const err = await response.json().catch(() => ({ error: 'Erreur inconnue' }));
          const serverMsg = err.error || 'La génération a échoué';
          console.error(`[OVO] Server error ${response.status}:`, serverMsg);
          throw new Error(`Échec génération OVO Excel (${response.status}): ${serverMsg}`);
        }

        const result = await response.json();
        downloadUrl = result.download_url;
        fileName = result.file_name || fileName;
      } catch (fetchErr: any) {
        // Distinguish real network errors from HTTP errors we already formatted
        const isHttpError = fetchErr.message?.startsWith('Échec génération OVO Excel');
        if (isHttpError) {
          throw fetchErr; // Re-throw HTTP errors directly — don't mask them
        }
        // True network error / connection closed — fall back to polling
        console.warn('[OVO] Network error, falling back to polling:', fetchErr.message);
        toast.info('Connexion interrompue — vérification en cours (peut prendre 3-5 min)...');
        const polled = await pollForOvoCompletion(enterprise.id, requestId, startedAt);
        if (polled) {
          downloadUrl = polled.url;
          fileName = polled.fileName;
        }
      }

      if (downloadUrl) {
        setOvoDownloadUrl(downloadUrl);
        toast.success('Plan Financier OVO généré avec succès !');
      }

      await fetchData();
    } catch (err: any) {
      toast.error(err.message || 'La génération a échoué, veuillez réessayer');
    } finally {
      setGeneratingOvoPlan(false);
    }
  };

  const handleDownloadOvoFile = async (url: string) => {
    try {
      const token = await getValidAccessToken();
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Erreur de téléchargement');
      const blob = await response.blob();
      // Try to get real file name from deliverable data
      const ovoDeliv = deliverables.find((d: any) => d.type === 'plan_ovo_excel');
      const realName = (ovoDeliv?.data as any)?.file_name;
      const downloadName = realName || `${enterprise?.name?.replace(/[^a-zA-Z0-9]/g, '_') || 'entreprise'}_PlanFinancierOVO.xlsm`;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = downloadName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
      toast.success('Fichier téléchargé !');
    } catch (err: any) {
      toast.error(err.message || 'Erreur de téléchargement');
    }
  };

  const handleDownload = async (type: string, format: string) => {
    if (!enterprise) return;
    try {
      const token = await getValidAccessToken();
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/download-deliverable?type=${type}&enterprise_id=${enterprise.id}&format=${format}`;
      const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) { const err = await response.json(); throw new Error(err.error || 'Erreur'); }
      const blob = await response.blob();
      const ext = format === 'csv' ? '.csv' : format === 'json' ? '.json' : format === 'xlsx' ? ((type === 'odd_analysis' || type === 'plan_ovo') ? '.xlsm' : '.xlsx') : '.html';
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${enterprise.name.replace(/[^a-zA-Z0-9]/g, '_')}_${type}${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
      toast.success('Fichier téléchargé !');
    } catch (err: any) {
      toast.error(err.message || 'Erreur de téléchargement');
    }
  };

  const handleDownloadBpWord = async () => {
    try {
      const bpDeliv = deliverables.find((d: any) => d.type === 'business_plan');
      const fileName = (bpDeliv?.data as any)?._meta?.file_name;
      if (!fileName) throw new Error('Fichier non disponible');

      const { data: signedData, error } = await supabase.storage
        .from('bp-outputs')
        .createSignedUrl(fileName, 300);

      if (error || !signedData?.signedUrl) throw new Error('Erreur de téléchargement');

      const response = await fetch(signedData.signedUrl);
      if (!response.ok) throw new Error('Erreur de téléchargement');
      const blob = await response.blob();

      const downloadName = fileName || `${enterprise?.name?.replace(/[^a-zA-Z0-9]/g, '_') || 'entreprise'}_BusinessPlan.docx`;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = downloadName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
      toast.success('Business Plan Word téléchargé !');
    } catch (err: any) {
      toast.error(err.message || 'Erreur de téléchargement');
    }
  };

  // Classify uploaded files
  const docFiles = uploadedFiles.filter(f => /\.(docx?|pdf|txt)$/i.test(f.name));
  const finFiles = uploadedFiles.filter(f => /\.(xlsx?|csv)$/i.test(f.name));
  const inputsCount = docFiles.length + finFiles.length;
  const deliverablesCount = deliverables.length;

  // No enterprise yet
  if (initialLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!enterprise) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b bg-card/80 backdrop-blur-sm">
          <div className="container flex h-14 items-center justify-between">
            <span className="font-display font-bold text-lg tracking-tight">ESONO</span>
          </div>
        </header>
        <div className="container py-20 flex justify-center">
          <Card className="max-w-md w-full">
            <div className="p-6 text-center">
              <div className="mx-auto h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                <Building2 className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-xl font-display font-bold mb-4">Créer votre entreprise</h2>
              <Dialog open={showCreate} onOpenChange={setShowCreate}>
                <DialogTrigger asChild>
                  <Button className="w-full gap-2"><Plus className="h-4 w-4" /> Commencer</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle className="font-display">Nouvelle entreprise</DialogTitle></DialogHeader>
                  <div className="space-y-3 mt-4 max-h-[60vh] overflow-y-auto pr-1">
                    <div className="space-y-1.5"><Label>Nom *</Label><Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Ex: EcoBuild CI SARL" /></div>
                    <div className="space-y-1.5"><Label>Secteur</Label><Input value={newSector} onChange={e => setNewSector(e.target.value)} placeholder="Recyclage, Agroalimentaire..." /></div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5"><Label>Pays</Label><Input value={newCountry} onChange={e => setNewCountry(e.target.value)} /></div>
                      <div className="space-y-1.5"><Label>Ville</Label><Input value={newCity} onChange={e => setNewCity(e.target.value)} placeholder="Abidjan" /></div>
                    </div>
                    <div className="space-y-1.5"><Label>Forme juridique</Label><Input value={newLegalForm} onChange={e => setNewLegalForm(e.target.value)} placeholder="SARL, SA, SAS..." /></div>
                    <div className="space-y-1.5"><Label>Description</Label><Input value={newDescription} onChange={e => setNewDescription(e.target.value)} placeholder="Décrivez votre activité..." /></div>
                    <Button className="w-full" onClick={createEnterprise} disabled={creating || !newName.trim()}>
                      {creating ? 'Création...' : 'Créer mon entreprise'}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  // Get the selected module config & deliverable
  const selectedMod = MODULE_CONFIG.find(m => m.code === selectedModule);
  const delivTypeMap: Record<string, string> = {
    bmc: 'bmc_analysis', sic: 'sic_analysis', inputs: 'inputs_data', framework: 'framework_data',
    diagnostic: 'diagnostic_data', plan_ovo: 'plan_ovo', business_plan: 'business_plan', odd: 'odd_analysis',
  };
  const selectedDelivType = delivTypeMap[selectedModule];
  const selectedDeliv = selectedDelivType ? getDeliverable(selectedDelivType) : null;

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      {/* ===== TOP HEADER ===== */}
      <header className="flex-none h-14 border-b border-border bg-card flex items-center px-6 z-50">
        <span className="font-display font-bold text-lg tracking-tight">ESONO</span>
        <span className="mx-3 text-muted-foreground">·</span>
        <span className="text-sm font-medium text-foreground">{enterprise.name}</span>
        <Button variant="ghost" size="icon" className="h-7 w-7 ml-1" onClick={openEditDialog}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <div className="mr-auto" />
        <div className="flex items-center gap-4">
          <span className="text-sm text-foreground">
            {profile?.full_name} · <span className="text-muted-foreground">{profile?.email}</span>
          </span>
          <Button variant="outline" size="sm" className="gap-2" onClick={handleSignOut}>
            <LogOut className="h-4 w-4" /> Déconnexion
          </Button>
        </div>
      </header>

      {/* ===== EDIT ENTERPRISE DIALOG ===== */}
      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display">Modifier l'entreprise</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-4 max-h-[60vh] overflow-y-auto pr-1">
            <div className="space-y-1.5"><Label>Nom *</Label><Input value={editName} onChange={e => setEditName(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Secteur</Label><Input value={editSector} onChange={e => setEditSector(e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Pays</Label><Input value={editCountry} onChange={e => setEditCountry(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Ville</Label><Input value={editCity} onChange={e => setEditCity(e.target.value)} /></div>
            </div>
            <div className="space-y-1.5"><Label>Forme juridique</Label><Input value={editLegalForm} onChange={e => setEditLegalForm(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Description</Label><Input value={editDescription} onChange={e => setEditDescription(e.target.value)} /></div>
            <Button className="w-full" onClick={saveEnterprise} disabled={saving || !editName.trim()}>
              {saving ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ===== EXTRACT ENTERPRISE INFO DIALOG ===== */}
      <Dialog open={showExtractDialog} onOpenChange={setShowExtractDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">Informations détectées</DialogTitle>
            <DialogDescription>
              D'après vos documents, nous avons identifié les informations suivantes :
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            {extractedInfo?.name && (
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
                <span className="text-sm text-muted-foreground">Nom</span>
                <span className="text-sm font-semibold">{extractedInfo.name}</span>
              </div>
            )}
            {extractedInfo?.country && (
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
                <span className="text-sm text-muted-foreground">Pays</span>
                <span className="text-sm font-semibold">{extractedInfo.country}</span>
              </div>
            )}
            {extractedInfo?.sector && (
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
                <span className="text-sm text-muted-foreground">Secteur</span>
                <span className="text-sm font-semibold">{extractedInfo.sector}</span>
              </div>
            )}
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => { setShowExtractDialog(false); setExtractedInfo(null); }}>
              Non merci
            </Button>
            <Button onClick={handleConfirmExtraction} disabled={saving}>
              {saving ? 'Mise à jour...' : 'Oui, mettre à jour'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      <div className="flex-none h-12 bg-[hsl(222,47%,15%)] flex items-center px-6 gap-6">
        <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-white/60">Investment Readiness</span>
        <span className="text-2xl font-display font-bold text-white">{globalScore > 0 ? `${globalScore}/100` : '—/100'}</span>
        <div className="w-40 h-2 rounded-full bg-white/10 overflow-hidden">
          <div className="h-full rounded-full bg-[hsl(var(--success))] transition-all duration-500" style={{ width: `${globalScore}%` }} />
        </div>
        <div className="flex items-center gap-2 text-white/60 text-xs">
          <span>🏁 v{deliverablesCount}</span>
          <span className="px-2 py-0.5 rounded bg-white/10 text-white/80 text-[10px] font-medium">🏆 {maturityLabel}</span>
        </div>
      </div>

      {/* ===== MAIN AREA (sources left + content center) ===== */}
      <div className="flex-1 min-h-0 flex">
        {/* LEFT PANEL: Sources */}
        <div className="w-72 flex-none border-r border-border bg-card flex flex-col overflow-y-auto">
          <div className="p-5 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">📁</span>
              <h2 className="font-display font-bold text-base">Sources</h2>
            </div>
            <p className="text-xs text-muted-foreground">Ajoutez vos documents d'inputs</p>
          </div>

          <div className="px-5 pb-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Documents d'inputs ({inputsCount}/{docFiles.length + finFiles.length || inputsCount})
            </p>
          </div>

          {/* Document card: BMC & Impact Social */}
          <input ref={docInputRef} type="file" multiple accept=".docx,.doc,.pdf,.txt" className="hidden" onChange={e => handleFileUpload(e, 'doc')} />
          <div
            onClick={() => docInputRef.current?.click()}
            className="mx-4 mb-3 p-3 rounded-xl border-2 border-[hsl(var(--success))]/30 bg-[hsl(var(--success))]/5 cursor-pointer hover:border-[hsl(var(--success))]/50 transition-colors"
          >
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center flex-none">
                <FileText className="h-5 w-5 text-blue-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">BMC & Impact Social</p>
                {docFiles.length > 0 ? (
                  docFiles.map(f => (
                    <div key={f.name} className="flex items-center gap-1.5 mt-1 group/file">
                      <CheckCircle2 className="h-3.5 w-3.5 text-[hsl(var(--success))] flex-none" />
                      <span className="text-xs text-[hsl(var(--success))] truncate font-medium flex-1">{f.name}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteFile(f.name); }}
                        className="hidden group-hover/file:flex h-4 w-4 items-center justify-center rounded-sm hover:bg-destructive/10 text-muted-foreground hover:text-destructive flex-none"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground mt-1">Cliquez pour uploader (.docx, .pdf)</p>
                )}
              </div>
            </div>
            {uploading === 'doc' && <Loader2 className="h-4 w-4 animate-spin text-primary mt-2" />}
          </div>

          {/* Document card: Inputs Financiers */}
          <input ref={finInputRef} type="file" multiple accept=".xlsx,.xls,.csv" className="hidden" onChange={e => handleFileUpload(e, 'fin')} />
          <div
            onClick={() => finInputRef.current?.click()}
            className="mx-4 mb-3 p-3 rounded-xl border-2 border-[hsl(var(--success))]/30 bg-[hsl(var(--success))]/5 cursor-pointer hover:border-[hsl(var(--success))]/50 transition-colors"
          >
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center flex-none">
                <BarChart3 className="h-5 w-5 text-green-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">Inputs Financiers</p>
                {finFiles.length > 0 ? (
                  finFiles.map(f => (
                    <div key={f.name} className="flex items-center gap-1.5 mt-1 group/file">
                      <CheckCircle2 className="h-3.5 w-3.5 text-[hsl(var(--success))] flex-none" />
                      <span className="text-xs text-[hsl(var(--success))] truncate font-medium flex-1">{f.name}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteFile(f.name); }}
                        className="hidden group-hover/file:flex h-4 w-4 items-center justify-center rounded-sm hover:bg-destructive/10 text-muted-foreground hover:text-destructive flex-none"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground mt-1">Cliquez pour uploader (.xlsx, .csv)</p>
                )}
              </div>
            </div>
            {uploading === 'fin' && <Loader2 className="h-4 w-4 animate-spin text-primary mt-2" />}
          </div>

          {/* Extra documents */}
          <input ref={extraInputRef} type="file" multiple className="hidden" onChange={e => handleFileUpload(e, 'extra')} />
          <button
            onClick={() => extraInputRef.current?.click()}
            className="mx-4 mb-4 flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors py-2 border-t border-dashed border-border"
          >
            <FolderPlus className="h-3.5 w-3.5" />
            Documents supplémentaires
          </button>

          {/* Spacer */}
          <div className="flex-1" />
        </div>

        {/* CENTER PANEL: Content */}
        <div className="flex-1 min-w-0 flex flex-col">
          {/* Module title bar */}
          <div className="flex-none h-12 border-b border-border bg-card/50 flex items-center px-6 gap-3">
            {selectedMod && (
              <>
                <selectedMod.icon className="h-5 w-5 text-muted-foreground" />
                <h1 className="font-display font-semibold text-base">{selectedMod.title}</h1>
              </>
            )}
            {/* Module-specific download handled via contextual bars below */}
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto">
            {/* Download bar for Diagnostic module */}
            {selectedModule === 'diagnostic' && selectedDeliv && (
              <div className="mx-6 mt-4 mb-2 rounded-xl border border-orange-200 bg-gradient-to-r from-orange-50 to-amber-50 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-orange-100 flex items-center justify-center">
                      <Stethoscope className="h-5 w-5 text-orange-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-orange-900">Diagnostic Expert Global</p>
                      <p className="text-xs text-orange-600">Analyse complète de l'entreprise avec SWOT et recommandations</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleDownload('diagnostic_data', 'html')}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-600 text-white text-xs font-semibold hover:bg-orange-700 transition-colors shadow-sm"
                    >
                      <Download className="h-3.5 w-3.5" /> Rapport HTML
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Download bar for BMC module */}
            {selectedModule === 'bmc' && selectedDeliv && (
              <div className="mx-6 mt-4 mb-2 rounded-xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                      <LayoutGrid className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-emerald-900">Business Model Canvas</p>
                      <p className="text-xs text-emerald-600">Canvas complet avec analyse des 9 blocs</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleDownload('bmc_analysis', 'html')}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-colors shadow-sm"
                    >
                      <Download className="h-3.5 w-3.5" /> Rapport HTML
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Download bar for SIC module */}
            {selectedModule === 'sic' && selectedDeliv && (
              <div className="mx-6 mt-4 mb-2 rounded-xl border border-teal-200 bg-gradient-to-r from-teal-50 to-cyan-50 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-teal-100 flex items-center justify-center">
                      <Globe className="h-5 w-5 text-teal-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-teal-900">Social Impact Canvas</p>
                      <p className="text-xs text-teal-600">Analyse d'impact social avec scoring par dimension</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleDownload('sic_analysis', 'html')}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-600 text-white text-xs font-semibold hover:bg-teal-700 transition-colors shadow-sm"
                    >
                      <Download className="h-3.5 w-3.5" /> Rapport HTML
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Green download bar for Framework module */}
            {selectedModule === 'framework' && selectedDeliv && (
              <div className="mx-6 mt-4 mb-2 rounded-xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                      <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-emerald-900">Plan Financier Intermédiaire</p>
                      <p className="text-xs text-emerald-600">Framework Analyse PME rempli avec les données réelles de votre entreprise</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleDownload('framework_data', 'xlsx')}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-colors shadow-sm"
                    >
                      <Download className="h-3.5 w-3.5" /> Framework Excel (.xlsx)
                    </button>
                    <button
                      onClick={() => handleDownload('framework_data', 'html')}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white text-emerald-700 border border-emerald-300 text-xs font-semibold hover:bg-emerald-50 transition-colors"
                    >
                      <Download className="h-3.5 w-3.5" /> Rapport HTML
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Green generation bar for Plan OVO module */}
            {selectedModule === 'plan_ovo' && (
              <div className="mx-6 mt-4 mb-2 rounded-xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                      <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-emerald-900">Plan Financier OVO (Excel)</p>
                      <p className="text-xs text-emerald-600">Génère le fichier Excel .xlsm rempli avec vos données financières</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {generatingOvoPlan ? (
                      <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-100 text-emerald-700 text-xs font-semibold">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Génération en cours… (30-60 secondes)
                      </div>
                    ) : ovoDownloadUrl || deliverables.find((d: any) => d.type === 'plan_ovo_excel')?.file_url ? (
                      <>
                        <button
                          onClick={() => handleDownloadOvoFile(ovoDownloadUrl || deliverables.find((d: any) => d.type === 'plan_ovo_excel')?.file_url)}
                          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-colors shadow-sm"
                        >
                          <Download className="h-3.5 w-3.5" /> Télécharger mon Plan Financier Excel
                        </button>
                        <button
                          onClick={handleGenerateOvoPlan}
                          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white text-emerald-700 border border-emerald-300 text-xs font-semibold hover:bg-emerald-50 transition-colors"
                        >
                          <Sparkles className="h-3.5 w-3.5" /> Regénérer
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={handleGenerateOvoPlan}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-colors shadow-sm"
                      >
                        <Sparkles className="h-3.5 w-3.5" /> Générer mon Plan Financier OVO
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Green bar for Business Plan module */}
            {selectedModule === 'business_plan' && (
              <div className="mx-6 mt-4 mb-2 rounded-xl border border-indigo-200 bg-gradient-to-r from-indigo-50 to-blue-50 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                      <FileText className="h-5 w-5 text-indigo-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-indigo-900">Business Plan OVO (Word)</p>
                      <p className="text-xs text-indigo-600">Génère un BP complet au format OVO avec fichier Word téléchargeable</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {generatingModule === 'business_plan' ? (
                      <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-100 text-indigo-700 text-xs font-semibold">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Génération en cours… (30-90 secondes)
                      </div>
                    ) : selectedDeliv?.data?._meta?.download_url ? (
                      <>
                        <button
                          onClick={() => handleDownloadBpWord()}
                          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors shadow-sm"
                        >
                          <Download className="h-3.5 w-3.5" /> Télécharger Word (.docx)
                        </button>
                        <button
                          onClick={() => handleGenerateModule('business_plan')}
                          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white text-indigo-700 border border-indigo-300 text-xs font-semibold hover:bg-indigo-50 transition-colors"
                        >
                          <Sparkles className="h-3.5 w-3.5" /> Regénérer
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => handleGenerateModule('business_plan')}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors shadow-sm"
                      >
                        <Sparkles className="h-3.5 w-3.5" /> Générer le Business Plan
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Green bar for ODD module */}
            {selectedModule === 'odd' && (
              <div className="mx-6 mt-4 mb-2 rounded-xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                      <Target className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-emerald-900">Évaluation ODD (Excel)</p>
                      <p className="text-xs text-emerald-600">Template ODD rempli avec les évaluations de votre entreprise</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {deliverables.find((d: any) => d.type === 'odd_excel')?.file_url ? (
                      <>
                        <button
                          onClick={async () => {
                            const oddExcel = deliverables.find((d: any) => d.type === 'odd_excel');
                            const fileName = (oddExcel?.data as any)?.file_name;

                            if (!fileName) {
                              toast.error('Fichier ODD Excel introuvable');
                              return;
                            }

                            const { data: signedData, error: signedErr } = await supabase.storage
                              .from('ovo-outputs')
                              .createSignedUrl(fileName, 3600);

                            if (!signedErr && signedData?.signedUrl) {
                              await handleDownloadOvoFile(signedData.signedUrl);
                              return;
                            }

                            await handleDownload('odd_analysis', 'xlsx');
                          }}
                          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-colors shadow-sm"
                        >
                          <Download className="h-3.5 w-3.5" /> ODD Excel (.xlsm)
                        </button>
                        <button
                          onClick={() => handleDownload('odd_analysis', 'html')}
                          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white text-emerald-700 border border-emerald-300 text-xs font-semibold hover:bg-emerald-50 transition-colors"
                        >
                          <Download className="h-3.5 w-3.5" /> Rapport HTML
                        </button>
                      </>
                    ) : selectedDeliv?.data ? (
                      <Badge variant="outline" className="text-xs text-emerald-600">
                        <Clock className="h-3 w-3 mr-1" /> Excel sera généré à la prochaine génération
                      </Badge>
                    ) : null}
                  </div>
                </div>
              </div>
            )}

            {selectedDeliv?.data && typeof selectedDeliv.data === 'object' ? (
              <div className="p-6">
                {selectedModule === 'bmc' ? (
                  <BmcViewer data={selectedDeliv.data} />
                ) : selectedModule === 'sic' ? (
                  <SicViewer data={selectedDeliv.data} />
                ) : selectedModule === 'business_plan' ? (
                  <BusinessPlanPreview data={selectedDeliv.data as Record<string, any>} />
                ) : (
                  <DeliverableViewer moduleCode={selectedModule} data={selectedDeliv.data} />
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center px-6">
                <div className="mb-4">
                  <Sparkles className="h-16 w-16 text-muted-foreground/20" />
                </div>
                <h3 className="font-display font-semibold text-lg text-muted-foreground mb-2">Prêt à être généré</h3>
                <p className="text-sm text-muted-foreground/70 max-w-sm">
                  Cliquez sur "Générer les livrables" dans la barre latérale.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ===== BOTTOM MODULE BAR ===== */}
      <div className="flex-none border-t border-border bg-card px-6 py-3">
        <div className="flex items-end justify-center gap-6">
          {MODULE_CONFIG.map(mod => {
            const data = getModuleData(mod.code);
            const Icon = mod.icon;
            const isSelected = selectedModule === mod.code;
            const isCompleted = data.status === 'completed';

            return (
              <button
                key={mod.code}
                onClick={() => setSelectedModule(mod.code)}
                className={`flex flex-col items-center gap-1.5 group relative transition-all ${
                  isSelected ? '' : 'opacity-80 hover:opacity-100'
                }`}
              >
                {/* Completion checkmark */}
                {isCompleted && (
                  <CheckCircle2 className="h-4 w-4 text-[hsl(var(--success))] absolute -top-1 -right-1 z-10" />
                )}
                {/* Icon circle */}
                <div className={`h-12 w-12 rounded-2xl flex items-center justify-center transition-all ${
                  isSelected
                    ? `${mod.color} ring-2 ring-primary ring-offset-2 ring-offset-background`
                    : `${mod.color} group-hover:scale-105`
                }`}>
                  <Icon className="h-5 w-5" />
                </div>
                {/* Label */}
                <span className={`text-[10px] leading-tight text-center max-w-[90px] ${
                  isSelected ? 'font-semibold text-foreground' : 'text-muted-foreground'
                }`}>
                  {mod.shortTitle}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ===== BOTTOM-LEFT GENERATE BUTTON (overlay) ===== */}
      <div className="fixed bottom-20 left-0 z-50 px-4">
        <Button
          size="lg"
          onClick={() => handleGenerate(true)}
          disabled={generating}
          className="gap-3 rounded-xl shadow-lg bg-[hsl(var(--success))] hover:bg-[hsl(var(--success))]/90 text-white px-5 py-3 h-auto"
        >
          {generating && generationProgress ? (
            <><Loader2 className="h-5 w-5 animate-spin" /> {generationProgress.name} ({generationProgress.current}/{generationProgress.total})...</>
          ) : (
            <><Sparkles className="h-5 w-5" /> Regénérer les livrables</>
          )}
          <span className="text-white/70 text-xs ml-1">
            {inputsCount}/{inputsCount} inputs · {deliverablesCount}/{MODULE_CONFIG.length} livrables
          </span>
        </Button>
      </div>

      {/* ===== NON-BLOCKING GENERATION PROGRESS BANNER ===== */}
      {generating && generationProgress && (
        <div className="fixed top-0 left-0 right-0 z-[100] bg-primary text-primary-foreground shadow-lg">
          <div className="container flex items-center gap-3 py-2 px-4">
            <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />
            <span className="text-sm font-medium truncate">
              Génération {generationProgress.current}/{generationProgress.total} : {generationProgress.name}
            </span>
            <Progress
              value={(generationProgress.current / generationProgress.total) * 100}
              className="h-1.5 flex-1 max-w-xs bg-primary-foreground/20"
            />
            <span className="text-xs opacity-80 flex-shrink-0">
              Vous pouvez consulter les livrables disponibles
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
