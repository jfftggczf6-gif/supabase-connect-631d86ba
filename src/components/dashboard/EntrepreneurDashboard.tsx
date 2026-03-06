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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  LayoutGrid, Globe, FileSpreadsheet, BarChart3,
  Stethoscope, ListChecks, FileText, Target,
  Plus, Building2, Upload, Sparkles, Download,
  LogOut, User, Clock, CheckCircle2, Loader2, X, FileUp,
  BookOpen, Lock, FolderPlus
} from 'lucide-react';
import BmcViewer from './BmcViewer';
import SicViewer from './SicViewer';
import DeliverableViewer from './DeliverableViewer';

const MODULE_CONFIG = [
  { code: 'diagnostic' as const, title: 'Diagnostic Expert Global', shortTitle: 'Diagnostic Expert Global', icon: Stethoscope, color: 'bg-orange-100 text-orange-600', step: 1 },
  { code: 'bmc' as const, title: 'Business Model Canvas', shortTitle: 'Business Model Canvas', icon: LayoutGrid, color: 'bg-emerald-100 text-emerald-600', step: 2 },
  { code: 'sic' as const, title: 'Social Impact Canvas', shortTitle: 'Social Impact Canvas', icon: Globe, color: 'bg-teal-100 text-teal-600', step: 3 },
  { code: 'inputs' as const, title: 'Plan Financier Intermédiaire', shortTitle: 'Plan Financier Intermédiaire', icon: FileSpreadsheet, color: 'bg-blue-100 text-blue-600', step: 4 },
  { code: 'framework' as const, title: 'Plan Financier Final', shortTitle: 'Plan Financier Final', icon: BarChart3, color: 'bg-purple-100 text-purple-600', step: 5 },
  { code: 'business_plan' as const, title: 'Business Plan', shortTitle: 'Business Plan', icon: FileText, color: 'bg-indigo-100 text-indigo-600', step: 6 },
  { code: 'odd' as const, title: 'ODD', shortTitle: 'ODD', icon: Target, color: 'bg-red-100 text-red-600', step: 7 },
];

const DELIVERABLE_CONFIG = [
  { type: 'bmc_analysis', label: 'BMC Analysé', formats: ['html', 'json'], icon: '📊' },
  { type: 'sic_analysis', label: 'Social Impact Canvas', formats: ['html', 'json'], icon: '🌍' },
  { type: 'inputs_data', label: 'Données Financières', formats: ['html', 'xlsx', 'csv'], icon: '💰' },
  { type: 'framework_data', label: 'Framework Financier', formats: ['html', 'xlsx'], icon: '📈' },
  { type: 'diagnostic_data', label: 'Diagnostic Expert', formats: ['html', 'json'], icon: '🩺' },
  { type: 'plan_ovo', label: 'Plan Financier OVO', formats: ['html', 'xlsx'], icon: '📋' },
  { type: 'business_plan', label: 'Business Plan', formats: ['html', 'json'], icon: '📄' },
  { type: 'odd_analysis', label: 'Due Diligence ODD', formats: ['html', 'json'], icon: '✅' },
];

export default function EntrepreneurDashboard() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
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
  const [selectedModule, setSelectedModule] = useState<string>('business_plan');
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
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, category: string) => {
    const files = e.target.files;
    if (!files || !enterprise) return;
    setUploading(category);
    try {
      for (const file of Array.from(files)) {
        const filePath = `${enterprise.id}/${file.name}`;
        const { error } = await supabase.storage.from('documents').upload(filePath, file, { upsert: true });
        if (error) throw error;
      }
      toast.success(`${files.length} fichier(s) uploadé(s)`);
      await fetchData();
    } catch (err: any) {
      toast.error(err.message || "Erreur d'upload");
    } finally {
      setUploading(null);
      if (docInputRef.current) docInputRef.current.value = '';
      if (finInputRef.current) finInputRef.current.value = '';
      if (extraInputRef.current) extraInputRef.current.value = '';
    }
  };

  const handleGenerate = async () => {
    if (!enterprise) return;
    setGenerating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Non authentifié");
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-deliverables`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
          body: JSON.stringify({ enterprise_id: enterprise.id }),
        }
      );
      if (!response.ok) { const err = await response.json(); throw new Error(err.error || 'Erreur'); }
      const result = await response.json();
      toast.success(`${result.deliverables_count} livrables générés ! Score: ${result.global_score}/100`);
      await fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Erreur de génération');
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateModule = async (moduleCode: string) => {
    if (!enterprise) return;
    setGeneratingModule(moduleCode);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Non authentifié");
      const fnMap: Record<string, string> = {
        bmc: 'generate-bmc', sic: 'generate-sic', inputs: 'generate-inputs',
        framework: 'generate-framework', diagnostic: 'generate-diagnostic',
        plan_ovo: 'generate-plan-ovo', business_plan: 'generate-business-plan', odd: 'generate-odd',
      };
      const functionName = fnMap[moduleCode] || `generate-${moduleCode}`;
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${functionName}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
          body: JSON.stringify({ enterprise_id: enterprise.id }),
        }
      );
      if (!response.ok) { const err = await response.json(); throw new Error(err.error || 'Erreur'); }
      const result = await response.json();
      toast.success(`${moduleCode.toUpperCase()} généré ! Score: ${result.score}/100`);
      setSelectedModule(moduleCode);
      await fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Erreur de génération');
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

  const getModuleData = (code: string) => {
    const mod = modules.find((m: any) => m.module === code);
    return { status: (mod?.status || 'not_started') as 'not_started' | 'in_progress' | 'completed', progress: mod?.progress || 0 };
  };

  const getDeliverable = (type: string) => deliverables.find((d: any) => d.type === type);

  const completedCount = modules.filter((m: any) => m.status === 'completed').length;
  const globalScore = deliverables.length > 0
    ? Math.round(deliverables.reduce((sum: number, d: any) => sum + (d.score || 0), 0) / deliverables.filter((d: any) => d.score).length || 0)
    : 0;

  const maturityLabel = globalScore >= 80 ? 'Excellent' : globalScore >= 60 ? 'Très bien' : globalScore >= 40 ? 'Moyen' : globalScore > 0 ? 'À améliorer' : '—';

  const handleSignOut = async () => { await signOut(); navigate('/login'); };

  const handleDownload = async (type: string, format: string) => {
    if (!enterprise) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Non authentifié");
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/download-deliverable?type=${type}&enterprise_id=${enterprise.id}&format=${format}`;
      const response = await fetch(url, { headers: { Authorization: `Bearer ${session.access_token}` } });
      if (!response.ok) { const err = await response.json(); throw new Error(err.error || 'Erreur'); }
      const blob = await response.blob();
      const ext = format === 'csv' ? '.csv' : format === 'json' ? '.json' : format === 'xlsx' ? '.xlsx' : '.html';
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

  // Classify uploaded files
  const docFiles = uploadedFiles.filter(f => /\.(docx?|pdf|txt)$/i.test(f.name));
  const finFiles = uploadedFiles.filter(f => /\.(xlsx?|csv)$/i.test(f.name));
  const inputsCount = docFiles.length + finFiles.length;
  const deliverablesCount = deliverables.length;

  // No enterprise yet
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
        <span className="font-display font-bold text-lg tracking-tight mr-auto">ESONO</span>
        <div className="flex items-center gap-4">
          <span className="text-sm text-foreground">
            {profile?.full_name} · <span className="text-muted-foreground">{profile?.email}</span>
          </span>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => navigate('/formations')}>
            <BookOpen className="h-4 w-4" /> Formations
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={handleSignOut}>
            <LogOut className="h-4 w-4" /> Déconnexion
          </Button>
        </div>
      </header>

      {/* ===== INVESTMENT READINESS BAR ===== */}
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
                    <div key={f.name} className="flex items-center gap-1.5 mt-1">
                      <CheckCircle2 className="h-3.5 w-3.5 text-[hsl(var(--success))] flex-none" />
                      <span className="text-xs text-[hsl(var(--success))] truncate font-medium">{f.name}</span>
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
                    <div key={f.name} className="flex items-center gap-1.5 mt-1">
                      <CheckCircle2 className="h-3.5 w-3.5 text-[hsl(var(--success))] flex-none" />
                      <span className="text-xs text-[hsl(var(--success))] truncate font-medium">{f.name}</span>
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
            {/* Download buttons if deliverable exists */}
            {selectedDeliv && (
              <div className="ml-auto flex items-center gap-1.5">
                {(DELIVERABLE_CONFIG.find(d => d.type === selectedDelivType)?.formats || ['html']).map(fmt => (
                  <button
                    key={fmt}
                    onClick={() => handleDownload(selectedDelivType, fmt)}
                    className="flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-md bg-muted hover:bg-accent transition-colors text-muted-foreground font-medium"
                  >
                    <Download className="h-3 w-3" />
                    {fmt.toUpperCase()}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto">
            {selectedDeliv?.data && typeof selectedDeliv.data === 'object' ? (
              <div className="p-6">
                {selectedModule === 'bmc' ? (
                  <BmcViewer data={selectedDeliv.data} />
                ) : selectedModule === 'sic' ? (
                  <SicViewer data={selectedDeliv.data} />
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
          onClick={handleGenerate}
          disabled={generating}
          className="gap-3 rounded-xl shadow-lg bg-[hsl(var(--success))] hover:bg-[hsl(var(--success))]/90 text-white px-5 py-3 h-auto"
        >
          {generating ? (
            <><Loader2 className="h-5 w-5 animate-spin" /> Génération...</>
          ) : (
            <><Sparkles className="h-5 w-5" /> Regénérer les livrables</>
          )}
          <span className="text-white/70 text-xs ml-1">
            {inputsCount}/{inputsCount} inputs · {deliverablesCount}/{MODULE_CONFIG.length} livrables
          </span>
        </Button>
      </div>
    </div>
  );
}
