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
  LogOut, User, Clock, CheckCircle2, Loader2, X, FileUp
} from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import BmcViewer from './BmcViewer';

const MODULE_CONFIG = [
  { code: 'bmc' as const, title: 'Business Model Canvas', description: 'Analysez votre modèle économique', icon: LayoutGrid, category: 'hybrid' as const, step: 1 },
  { code: 'sic' as const, title: 'Social Impact Canvas', description: 'Évaluez votre impact social et ODD', icon: Globe, category: 'hybrid' as const, step: 2 },
  { code: 'inputs' as const, title: 'Données Financières', description: 'Saisissez vos données financières', icon: FileSpreadsheet, category: 'hybrid' as const, step: 3 },
  { code: 'framework' as const, title: 'Framework Analyse', description: 'Analyse financière complète', icon: BarChart3, category: 'automatic' as const, step: 4 },
  { code: 'diagnostic' as const, title: 'Diagnostic Expert', description: 'Diagnostic global entreprise', icon: Stethoscope, category: 'automatic' as const, step: 5 },
  { code: 'plan_ovo' as const, title: 'Plan Financier OVO', description: 'Projections et scénarios', icon: ListChecks, category: 'automatic' as const, step: 6 },
  { code: 'business_plan' as const, title: 'Business Plan', description: 'Génération IA du BP complet', icon: FileText, category: 'automatic' as const, step: 7 },
  { code: 'odd' as const, title: 'Due Diligence ODD', description: 'Checklist investment readiness', icon: Target, category: 'automatic' as const, step: 8 },
];

const DELIVERABLE_CONFIG = [
  { type: 'bmc_analysis', label: 'BMC Analysé', ext: '.docx', icon: '📄', color: 'text-info' },
  { type: 'sic_analysis', label: 'SIC Analysé', ext: '.docx', icon: '📄', color: 'text-info' },
  { type: 'inputs_html', label: 'Inputs HTML', ext: '.html', icon: '🌐', color: 'text-primary' },
  { type: 'framework_data', label: 'Framework Excel', ext: '.xlsx', icon: '📊', color: 'text-success' },
  { type: 'diagnostic_data', label: 'Diagnostic Expert', ext: '.html', icon: '🌐', color: 'text-primary' },
  { type: 'plan_ovo', label: 'Plan OVO', ext: '.xlsx', icon: '📊', color: 'text-success' },
  { type: 'business_plan', label: 'Business Plan', ext: '.docx', icon: '📄', color: 'text-info' },
  { type: 'odd_analysis', label: 'Due Diligence ODD', ext: '.xlsx', icon: '📊', color: 'text-success' },
];

export default function EntrepreneurDashboard() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [enterprise, setEnterprise] = useState<any>(null);
  const [modules, setModules] = useState<any[]>([]);
  const [deliverables, setDeliverables] = useState<any[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newSector, setNewSector] = useState('');
  const [creating, setCreating] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generatingModule, setGeneratingModule] = useState<string | null>(null);
  const [selectedModule, setSelectedModule] = useState<string>('bmc');
  const docInputRef = useRef<HTMLInputElement>(null);
  const finInputRef = useRef<HTMLInputElement>(null);

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U';

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
      setUploadedFiles((filesRes.data || []).map((f: any) => f.name));
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
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ enterprise_id: enterprise.id }),
        }
      );

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Erreur de génération');
      }

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

      const functionName = `generate-${moduleCode}`;
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${functionName}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ enterprise_id: enterprise.id }),
        }
      );

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Erreur de génération');
      }

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


    if (!user || !newName.trim()) return;
    setCreating(true);
    try {
      const { data, error } = await supabase
        .from('enterprises')
        .insert({ user_id: user.id, name: newName.trim(), sector: newSector.trim() || null })
        .select().single();
      if (error) throw error;

      const moduleInserts = MODULE_CONFIG.map(m => ({ enterprise_id: data.id, module: m.code }));
      await supabase.from('enterprise_modules').insert(moduleInserts);

      toast.success('Entreprise créée !');
      setShowCreate(false);
      setNewName('');
      setNewSector('');
      fetchData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setCreating(false);
    }
  };

  const getModuleData = (code: string) => {
    const mod = modules.find((m: any) => m.module === code);
    return {
      status: (mod?.status || 'not_started') as 'not_started' | 'in_progress' | 'completed',
      progress: mod?.progress || 0,
    };
  };

  const getDeliverable = (type: string) => deliverables.find((d: any) => d.type === type);

  const completedCount = modules.filter((m: any) => m.status === 'completed').length;
  const avgProgress = modules.length > 0
    ? Math.round(modules.reduce((sum: number, m: any) => sum + (m.progress || 0), 0) / modules.length)
    : 0;
  const globalScore = deliverables.length > 0
    ? Math.round(deliverables.reduce((sum: number, d: any) => sum + (d.score || 0), 0) / deliverables.length)
    : 0;

  const handleSignOut = async () => { await signOut(); navigate('/login'); };

  const handleDownload = async (type: string, format: string) => {
    if (!enterprise) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Non authentifié");

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/download-deliverable?type=${type}&enterprise_id=${enterprise.id}&format=${format}`;
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Erreur');
      }

      const blob = await response.blob();
      const ext = format === 'csv' ? '.csv' : format === 'json' ? '.json' : '.html';
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

  // No enterprise yet
  if (!enterprise) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b bg-card/80 backdrop-blur-sm">
          <div className="container flex h-14 items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                <span className="text-sm font-display font-bold text-primary-foreground">ES</span>
              </div>
              <span className="font-display font-bold">ESONO</span>
            </div>
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
                  <div className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label>Nom de l'entreprise</Label>
                      <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Ex: EcoBuild CI SARL" />
                    </div>
                    <div className="space-y-2">
                      <Label>Secteur d'activité</Label>
                      <Input value={newSector} onChange={e => setNewSector(e.target.value)} placeholder="Ex: Recyclage, Agroalimentaire..." />
                    </div>
                    <Button className="w-full" onClick={createEnterprise} disabled={creating || !newName.trim()}>
                      {creating ? 'Création...' : 'Créer'}
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

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur-sm">
        <div className="container flex h-14 items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-sm font-display font-bold text-primary-foreground">ES</span>
            </div>
            <span className="font-display font-bold hidden sm:inline">ESONO</span>
            <span className="text-xs text-muted-foreground hidden md:inline">|</span>
            <span className="text-sm font-medium hidden md:inline">{enterprise.name}</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
              <span>{completedCount}/{MODULE_CONFIG.length} modules</span>
              <div className="w-20 h-1.5 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${avgProgress}%` }} />
              </div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2">
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">{initials}</AvatarFallback>
                  </Avatar>
                  <span className="hidden sm:inline text-sm">{profile?.full_name}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem className="gap-2"><User className="h-4 w-4" /> Profil</DropdownMenuItem>
                <DropdownMenuItem className="gap-2 text-destructive" onClick={handleSignOut}>
                  <LogOut className="h-4 w-4" /> Déconnexion
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 container py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" style={{ minHeight: 'calc(100vh - 120px)' }}>
          {/* LEFT: Upload & Documents */}
          <div className="lg:col-span-3 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Upload className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-display font-semibold uppercase tracking-wide text-muted-foreground">Documents</h2>
            </div>

            {/* Upload zone 1: BMC / SIC */}
            <input ref={docInputRef} type="file" multiple accept=".docx,.doc,.pdf,.txt" className="hidden" onChange={e => handleFileUpload(e, 'doc')} />
            <div
              onClick={() => docInputRef.current?.click()}
              className="border-2 border-dashed rounded-lg p-4 text-center hover:border-primary/40 transition-colors cursor-pointer group"
            >
              {uploading === 'doc' ? (
                <Loader2 className="h-6 w-6 mx-auto mb-2 animate-spin text-primary" />
              ) : (
                <Upload className="h-6 w-6 mx-auto mb-2 text-muted-foreground group-hover:text-primary transition-colors" />
              )}
              <p className="text-xs font-medium">BMC / SIC (DOCX)</p>
              <p className="text-xs text-muted-foreground mt-1">Glissez ou cliquez</p>
            </div>

            {/* Upload zone 2: Inputs Financiers */}
            <input ref={finInputRef} type="file" multiple accept=".xlsx,.xls,.csv" className="hidden" onChange={e => handleFileUpload(e, 'fin')} />
            <div
              onClick={() => finInputRef.current?.click()}
              className="border-2 border-dashed rounded-lg p-4 text-center hover:border-primary/40 transition-colors cursor-pointer group"
            >
              {uploading === 'fin' ? (
                <Loader2 className="h-6 w-6 mx-auto mb-2 animate-spin text-primary" />
              ) : (
                <Upload className="h-6 w-6 mx-auto mb-2 text-muted-foreground group-hover:text-primary transition-colors" />
              )}
              <p className="text-xs font-medium">Inputs Financiers (XLSX)</p>
              <p className="text-xs text-muted-foreground mt-1">Glissez ou cliquez</p>
            </div>

            {/* Uploaded files list */}
            {uploadedFiles.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground font-medium">Fichiers uploadés :</p>
                {uploadedFiles.map(f => (
                  <div key={f} className="flex items-center gap-2 text-xs p-2 rounded bg-muted/50">
                    <CheckCircle2 className="h-3 w-3 text-success flex-shrink-0" />
                    <span className="truncate">{f}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Generate button */}
            <Button
              className="w-full gap-2 mt-4"
              size="lg"
              onClick={handleGenerate}
              disabled={generating}
            >
              {generating ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Génération en cours...</>
              ) : (
                <><Sparkles className="h-4 w-4" /> Générer tous les livrables</>
              )}
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              L'IA analyse vos documents et génère 8+ livrables
            </p>
          </div>

          {/* CENTER: Content viewer */}
          <div className="lg:col-span-6 space-y-6">
            {/* Score overview bar */}
            <Card className="bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(222,47%,25%)] text-primary-foreground border-0">
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <p className="text-xs uppercase tracking-wider opacity-60">Investment Readiness</p>
                    <p className="text-3xl font-display font-bold">{globalScore > 0 ? `${globalScore}/100` : '—'}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {['BMC', 'SIC', 'Framework'].map(dim => {
                      const typeMap: Record<string, string> = { BMC: 'bmc_analysis', SIC: 'sic_analysis', Framework: 'framework_data' };
                      const deliv = getDeliverable(typeMap[dim]);
                      const score = deliv?.score || 0;
                      return (
                        <div key={dim} className="flex items-center gap-1.5 text-xs">
                          <span className="opacity-50">{dim}</span>
                          <div className="w-12 h-1.5 rounded-full bg-white/10 overflow-hidden">
                            <div className="h-full rounded-full bg-white/60 transition-all" style={{ width: `${score}%` }} />
                          </div>
                          <span className="opacity-40 w-4">{score > 0 ? score : '—'}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                {(generating || generatingModule) && (
                  <div className="flex items-center gap-2 text-primary-foreground/70 text-xs mt-2">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Analyse IA en cours{generatingModule ? ` (${generatingModule.toUpperCase()})` : ''}...
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Selected module content */}
            <div className="min-h-[400px]">
              {selectedModule === 'bmc' && (() => {
                const bmcDeliv = getDeliverable('bmc_analysis');
                if (bmcDeliv?.data && typeof bmcDeliv.data === 'object') {
                  return <BmcViewer data={bmcDeliv.data} />;
                }
                return (
                  <Card className="flex flex-col items-center justify-center py-20 text-center">
                    <LayoutGrid className="h-12 w-12 text-muted-foreground/30 mb-4" />
                    <h3 className="font-display font-semibold text-lg mb-2">Business Model Canvas</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Uploadez vos documents puis générez l'analyse BMC par l'IA
                    </p>
                    <Button
                      onClick={() => handleGenerateModule('bmc')}
                      disabled={!!generatingModule}
                      className="gap-2"
                    >
                      {generatingModule === 'bmc' ? (
                        <><Loader2 className="h-4 w-4 animate-spin" /> Génération...</>
                      ) : (
                        <><Sparkles className="h-4 w-4" /> Générer le BMC</>
                      )}
                    </Button>
                  </Card>
                );
              })()}
              {selectedModule !== 'bmc' && (
                <Card className="flex flex-col items-center justify-center py-20 text-center">
                  {(() => {
                    const mod = MODULE_CONFIG.find(m => m.code === selectedModule);
                    const Icon = mod?.icon || FileText;
                    return (
                      <>
                        <Icon className="h-12 w-12 text-muted-foreground/30 mb-4" />
                        <h3 className="font-display font-semibold text-lg mb-2">{mod?.title}</h3>
                        <p className="text-sm text-muted-foreground">Agent IA à venir — en cours de développement</p>
                      </>
                    );
                  })()}
                </Card>
              )}
            </div>

            {/* Horizontal module bar (like reference) */}
            <div className="border-t pt-4">
              <div className="flex items-center gap-2 overflow-x-auto pb-2">
                {MODULE_CONFIG.map(mod => {
                  const data = getModuleData(mod.code);
                  const Icon = mod.icon;
                  const isSelected = selectedModule === mod.code;
                  return (
                    <button
                      key={mod.code}
                      onClick={() => setSelectedModule(mod.code)}
                      className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg border-2 transition-all min-w-[80px] ${
                        isSelected
                          ? 'border-primary bg-primary/5 shadow-sm'
                          : 'border-transparent hover:bg-muted/50'
                      }`}
                    >
                      <div className="relative">
                        <div className={`h-8 w-8 rounded-lg flex items-center justify-center transition-colors ${
                          isSelected ? 'bg-primary/15' : 'bg-muted'
                        }`}>
                          <Icon className={`h-4 w-4 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                        </div>
                        {data.status === 'completed' && (
                          <CheckCircle2 className="h-3.5 w-3.5 text-success absolute -top-1 -right-1 bg-background rounded-full" />
                        )}
                      </div>
                      <span className={`text-[10px] font-medium text-center leading-tight ${
                        isSelected ? 'text-primary' : 'text-muted-foreground'
                      }`}>{mod.title}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* RIGHT: Deliverables */}
          <div className="lg:col-span-3 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Download className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-display font-semibold uppercase tracking-wide text-muted-foreground">Livrables</h2>
            </div>

            {DELIVERABLE_CONFIG.map(dc => {
              const deliv = getDeliverable(dc.type);
              const isReady = !!deliv;
              const downloadFormat = dc.ext === '.xlsx' ? 'csv' : dc.ext === '.docx' ? 'html' : 'html';
              return (
                <div
                  key={dc.type}
                  onClick={() => isReady && handleDownload(dc.type, downloadFormat)}
                  className={`flex items-center justify-between p-3 rounded-lg border bg-card transition-colors ${
                    isReady ? 'hover:bg-muted/50 cursor-pointer' : 'opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{dc.icon}</span>
                    <div>
                      <p className="text-xs font-medium">{dc.label}</p>
                      <p className="text-[10px] text-muted-foreground">{dc.ext}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {isReady ? (
                      <>
                        <Badge variant="default" className="text-[10px] bg-success/10 text-success border-success/20">
                          {deliv.score ? `${deliv.score}/100` : 'Prêt'}
                        </Badge>
                        <Download className="h-3.5 w-3.5 text-muted-foreground" />
                      </>
                    ) : (
                      <Badge variant="outline" className="text-[10px]">En attente</Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
