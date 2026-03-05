import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  ChevronRight, LogOut, User, Clock, CheckCircle2
} from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

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

export default function EntrepreneurDashboard() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [enterprise, setEnterprise] = useState<any>(null);
  const [modules, setModules] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newSector, setNewSector] = useState('');
  const [creating, setCreating] = useState(false);

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U';

  const fetchData = useCallback(async () => {
    if (!user) return;
    const { data: ent } = await supabase
      .from('enterprises')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (ent) {
      setEnterprise(ent);
      const { data: mods } = await supabase
        .from('enterprise_modules')
        .select('*')
        .eq('enterprise_id', ent.id);
      setModules(mods || []);
    }
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const createEnterprise = async () => {
    if (!user || !newName.trim()) return;
    setCreating(true);
    try {
      const { data, error } = await supabase
        .from('enterprises')
        .insert({ user_id: user.id, name: newName.trim(), sector: newSector.trim() || null })
        .select()
        .single();
      if (error) throw error;

      const moduleInserts = MODULE_CONFIG.map(m => ({
        enterprise_id: data.id,
        module: m.code,
      }));
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
    const mod = modules.find(m => m.module === code);
    return {
      status: (mod?.status || 'not_started') as 'not_started' | 'in_progress' | 'completed',
      progress: mod?.progress || 0,
    };
  };

  const completedCount = modules.filter(m => m.status === 'completed').length;
  const avgProgress = modules.length > 0
    ? Math.round(modules.reduce((sum, m) => sum + (m.progress || 0), 0) / modules.length)
    : 0;

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
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
            <CardHeader className="text-center">
              <div className="mx-auto h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                <Building2 className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="font-display">Créer votre entreprise</CardTitle>
            </CardHeader>
            <CardContent>
              <Dialog open={showCreate} onOpenChange={setShowCreate}>
                <DialogTrigger asChild>
                  <Button className="w-full gap-2">
                    <Plus className="h-4 w-4" /> Commencer
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle className="font-display">Nouvelle entreprise</DialogTitle>
                  </DialogHeader>
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
            </CardContent>
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
            {/* Progress indicator */}
            <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
              <span>{completedCount}/{MODULE_CONFIG.length} modules</span>
              <div className="w-20 h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${avgProgress}%` }}
                />
              </div>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2">
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden sm:inline text-sm">{profile?.full_name}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem className="gap-2">
                  <User className="h-4 w-4" /> Profil
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-2 text-destructive" onClick={handleSignOut}>
                  <LogOut className="h-4 w-4" /> Déconnexion
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Main content: 3-column layout */}
      <div className="flex-1 container py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" style={{ minHeight: 'calc(100vh - 120px)' }}>

          {/* LEFT: Upload & Documents */}
          <div className="lg:col-span-3 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Upload className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-display font-semibold uppercase tracking-wide text-muted-foreground">
                Documents
              </h2>
            </div>

            {/* Upload zones */}
            {['BMC / SIC (DOCX)', 'Inputs Financiers (XLSX)'].map((label, i) => (
              <div
                key={label}
                className="border-2 border-dashed rounded-lg p-4 text-center hover:border-primary/40 transition-colors cursor-pointer group"
              >
                <Upload className="h-6 w-6 mx-auto mb-2 text-muted-foreground group-hover:text-primary transition-colors" />
                <p className="text-xs font-medium">{label}</p>
                <p className="text-xs text-muted-foreground mt-1">Glissez ou cliquez</p>
              </div>
            ))}

            {/* Generate button */}
            <Button className="w-full gap-2 mt-4" size="lg">
              <Sparkles className="h-4 w-4" />
              Générer tous les livrables
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              IA analyse vos documents et génère 10+ livrables
            </p>
          </div>

          {/* CENTER: Dashboard & Modules */}
          <div className="lg:col-span-6 space-y-6">
            {/* Score overview */}
            <Card className="bg-gradient-to-br from-[hsl(222,47%,15%)] to-[hsl(222,47%,22%)] text-white border-0">
              <CardContent className="py-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-white/60 text-xs uppercase tracking-wider">Score Global</p>
                    <p className="text-4xl font-display font-bold">—</p>
                    <p className="text-white/60 text-sm">Investment Readiness</p>
                  </div>
                  <div className="text-right space-y-1">
                    {['BMC', 'SIC', 'Framework'].map(dim => (
                      <div key={dim} className="flex items-center gap-2 text-xs">
                        <span className="text-white/50 w-16 text-right">{dim}</span>
                        <div className="w-16 h-1.5 rounded-full bg-white/10 overflow-hidden">
                          <div className="h-full rounded-full bg-white/40" style={{ width: '0%' }} />
                        </div>
                        <span className="text-white/40 w-6">—</span>
                      </div>
                    ))}
                  </div>
                </div>
                <p className="text-white/50 text-xs">
                  Uploadez vos documents pour obtenir votre score d'Investment Readiness
                </p>
              </CardContent>
            </Card>

            {/* 8 Module cards in grid */}
            <div>
              <h2 className="text-sm font-display font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                8 Modules
              </h2>
              <div className="grid grid-cols-2 gap-3">
                {MODULE_CONFIG.map(mod => {
                  const data = getModuleData(mod.code);
                  const Icon = mod.icon;
                  const isAuto = mod.category === 'automatic';

                  return (
                    <div
                      key={mod.code}
                      onClick={() => navigate(`/module/${mod.code}`)}
                      className="bg-card border rounded-lg p-3 cursor-pointer hover:shadow-md hover:border-primary/30 transition-all group"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center group-hover:bg-primary/15 transition-colors">
                          <Icon className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex items-center gap-1">
                          {isAuto && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-info/10 text-info font-medium">IA</span>
                          )}
                          {data.status === 'completed' && (
                            <CheckCircle2 className="h-4 w-4 text-success" />
                          )}
                          {data.status === 'in_progress' && (
                            <Clock className="h-3.5 w-3.5 text-warning" />
                          )}
                        </div>
                      </div>
                      <p className="text-xs font-medium leading-tight">{mod.title}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{mod.description}</p>
                      {data.progress > 0 && (
                        <Progress value={data.progress} className="h-1 mt-2" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* RIGHT: Deliverables */}
          <div className="lg:col-span-3 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Download className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-display font-semibold uppercase tracking-wide text-muted-foreground">
                Livrables
              </h2>
            </div>

            {[
              { label: 'BMC Analysé', ext: '.docx', icon: '📄', color: 'text-info' },
              { label: 'SIC Analysé', ext: '.docx', icon: '📄', color: 'text-info' },
              { label: 'Inputs HTML', ext: '.html', icon: '🌐', color: 'text-primary' },
              { label: 'Framework Excel', ext: '.xlsx', icon: '📊', color: 'text-success' },
              { label: 'Diagnostic Expert', ext: '.html', icon: '🌐', color: 'text-primary' },
              { label: 'Plan OVO', ext: '.xlsx', icon: '📊', color: 'text-success' },
              { label: 'Business Plan', ext: '.docx', icon: '📄', color: 'text-info' },
              { label: 'Due Diligence ODD', ext: '.xlsx', icon: '📊', color: 'text-success' },
            ].map(deliv => (
              <div
                key={deliv.label}
                className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm">{deliv.icon}</span>
                  <div>
                    <p className="text-xs font-medium">{deliv.label}</p>
                    <p className="text-[10px] text-muted-foreground">{deliv.ext}</p>
                  </div>
                </div>
                <Badge variant="outline" className="text-[10px]">
                  En attente
                </Badge>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
