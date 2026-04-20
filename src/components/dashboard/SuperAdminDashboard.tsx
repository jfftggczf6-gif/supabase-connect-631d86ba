import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from './DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { toast } from '@/hooks/use-toast';
import { Users, Building2, FileText, Trash2, UserCog, Search, RefreshCw, Target, Database, Server, AlertTriangle, TrendingUp, DollarSign, Plus, X, Shield } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { DialogFooter } from '@/components/ui/dialog';
import CoachesTab from './CoachesTab';
import ProgrammeCriteriaEditor from './ProgrammeCriteriaEditor';
import ScreeningDashboard from './ScreeningDashboard';
import KnowledgeBaseManager from './KnowledgeBaseManager';
import WorkspaceKnowledgeManager from './WorkspaceKnowledgeManager';
import FundingMatchTab from './FundingMatchTab';
import PortfolioTab from './PortfolioTab';
import AlertsTab from './AlertsTab';
import ExportTab from './ExportTab';
import CostTrackingTab from './CostTrackingTab';
import { useTranslation } from 'react-i18next';
import { PIPELINE } from '@/lib/dashboard-config';
import EntrepreneurDashboard from './EntrepreneurDashboard';
import { ArrowLeft, Eye } from 'lucide-react';

interface Profile {
  user_id: string;
  full_name: string | null;
  email: string | null;
  created_at: string;
}

interface UserRole {
  user_id: string;
  role: string;
}

interface Enterprise {
  id: string;
  name: string;
  user_id: string;
  coach_id: string | null;
  sector: string | null;
  country: string | null;
  phase: string | null;
  score_ir: number | null;
  last_activity: string | null;
  contact_email: string | null;
  created_at: string;
}

interface Deliverable {
  id: string;
  enterprise_id: string;
  type: string;
  created_at: string;
  generated_by: string | null;
  coach_id?: string | null;
  visibility?: string | null;
  data?: any;
}

interface CoachUpload {
  id: string;
  coach_id: string;
  enterprise_id: string;
  filename: string;
  category: string;
  created_at: string;
}

export default function SuperAdminDashboard() {
  const { t } = useTranslation();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [enterprises, setEnterprises] = useState<Enterprise[]>([]);
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [coachUploads, setCoachUploads] = useState<CoachUpload[]>([]);
  const [enterpriseCoaches, setEnterpriseCoaches] = useState<Array<{ enterprise_id: string; coach_id: string; is_active: boolean }>>([]);
  const [loading, setLoading] = useState(true);
  const [searchUsers, setSearchUsers] = useState('');
  const [searchEnterprises, setSearchEnterprises] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [parserStatus, setParserStatus] = useState<'checking' | 'up' | 'down'>('checking');
  const [parserVersion, setParserVersion] = useState('');
  const [selectedEnterprise, setSelectedEnterprise] = useState<Enterprise | null>(null);
  const [viewingEnterprise, setViewingEnterprise] = useState<Enterprise | null>(null);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [newUser, setNewUser] = useState({ full_name: '', email: '', password: '', roles: [] as string[] });
  const [creatingUser, setCreatingUser] = useState(false);
  const [managingRole, setManagingRole] = useState<{ userId: string; action: 'add' | 'remove'; role: string } | null>(null);

  // --- Helpers declared early ---
  const formatDate = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  const deliverableLabel = (type: string) => type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  const fetchAll = async () => {
    setLoading(true);
    const [pRes, rRes, eRes, dRes, cuRes, ecRes] = await Promise.all([
      supabase.from('profiles').select('user_id, full_name, email, created_at'),
      supabase.from('user_roles').select('user_id, role'),
      supabase.from('enterprises').select('id, name, user_id, coach_id, sector, country, phase, score_ir, last_activity, contact_email, created_at'),
      supabase.from('deliverables').select('id, enterprise_id, type, created_at, generated_by, coach_id, visibility, data').order('created_at', { ascending: false }).limit(500),
      supabase.from('coach_uploads').select('id, coach_id, enterprise_id, filename, category, created_at').order('created_at', { ascending: false }).limit(500),
      supabase.from('enterprise_coaches').select('enterprise_id, coach_id, is_active').eq('is_active', true),
    ]);
    if (pRes.data) setProfiles(pRes.data);
    if (rRes.data) setRoles(rRes.data);
    if (eRes.data) setEnterprises(eRes.data);
    if (dRes.data) setDeliverables(dRes.data);
    if (cuRes.data) setCoachUploads(cuRes.data as CoachUpload[]);
    if (ecRes.data) setEnterpriseCoaches(ecRes.data);
    setLoading(false);
  };

  // STEP 1 — Auto-refresh polling
  useEffect(() => {
    fetchAll();
    if (!autoRefresh) return;
    const interval = setInterval(fetchAll, 30000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  // STEP 3 — Parser health check
  useEffect(() => {
    const checkParser = async () => {
      try {
        const resp = await fetch(`${import.meta.env.VITE_PARSER_URL}/health`, { signal: AbortSignal.timeout(5000) });
        if (resp.ok) {
          const data = await resp.json();
          setParserStatus('up');
          setParserVersion(data.version || '');
        } else {
          setParserStatus('down');
        }
      } catch {
        setParserStatus('down');
      }
    };
    checkParser();
    const interval = setInterval(checkParser, 60000);
    return () => clearInterval(interval);
  }, []);

  const roleMap = useMemo(() => {
    const m: Record<string, string[]> = {};
    roles.forEach(r => { (m[r.user_id] ||= []).push(r.role); });
    return m;
  }, [roles]);

  const profileMap = useMemo(() => {
    const m: Record<string, Profile> = {};
    profiles.forEach(p => { m[p.user_id] = p; });
    return m;
  }, [profiles]);

  const enterpriseMap = useMemo(() => {
    const m: Record<string, Enterprise> = {};
    enterprises.forEach(e => { m[e.id] = e; });
    return m;
  }, [enterprises]);

  const coaches = useMemo(() =>
    profiles.filter(p => roleMap[p.user_id]?.includes('coach')),
    [profiles, roleMap]
  );

  // N-to-N: build coach→enterprises and enterprise→coach mappings
  const coachEnterprisesMap = useMemo(() => {
    const m: Record<string, string[]> = {};
    enterpriseCoaches.forEach(ec => {
      (m[ec.coach_id] ||= []).push(ec.enterprise_id);
    });
    // Also include legacy coach_id for enterprises not yet in enterprise_coaches
    enterprises.forEach(e => {
      if (e.coach_id && !enterpriseCoaches.some(ec => ec.enterprise_id === e.id && ec.coach_id === e.coach_id)) {
        (m[e.coach_id] ||= []).push(e.id);
      }
    });
    return m;
  }, [enterpriseCoaches, enterprises]);

  const enterpriseCoachMap = useMemo(() => {
    const m: Record<string, string | null> = {};
    enterprises.forEach(e => { m[e.id] = e.coach_id; });
    enterpriseCoaches.forEach(ec => { m[ec.enterprise_id] = ec.coach_id; });
    return m;
  }, [enterpriseCoaches, enterprises]);

  const stats = useMemo(() => ({
    users: profiles.length,
    coaches: coaches.length,
    enterprises: enterprises.length,
    deliverables: deliverables.length,
  }), [profiles, coaches, enterprises, deliverables]);

  const deliverablesPerEnterprise = useMemo(() => {
    const m: Record<string, number> = {};
    deliverables.forEach(d => { m[d.enterprise_id] = (m[d.enterprise_id] || 0) + 1; });
    return m;
  }, [deliverables]);

  const filteredUsers = useMemo(() => {
    if (!searchUsers) return profiles;
    const q = searchUsers.toLowerCase();
    return profiles.filter(p =>
      p.full_name?.toLowerCase().includes(q) || p.email?.toLowerCase().includes(q)
    );
  }, [profiles, searchUsers]);

  const filteredEnterprises = useMemo(() => {
    if (!searchEnterprises) return enterprises;
    const q = searchEnterprises.toLowerCase();
    return enterprises.filter(e =>
      e.name.toLowerCase().includes(q) || e.sector?.toLowerCase().includes(q)
    );
  }, [enterprises, searchEnterprises]);

  // STEP 5 — Combined activity feed
  const recentActivity = useMemo(() => {
    const items: Array<{ date: string; type: 'deliverable' | 'upload'; label: string; enterprise: string; user: string }> = [];

    deliverables.slice(0, 30).forEach(d => {
      const ent = enterpriseMap[d.enterprise_id];
      items.push({
        date: d.created_at,
        type: 'deliverable',
        label: deliverableLabel(d.type),
        enterprise: ent?.name || '?',
        user: d.generated_by || '—',
      });
    });

    coachUploads.slice(0, 30).forEach(u => {
      const ent = enterpriseMap[u.enterprise_id];
      const coach = profileMap[u.coach_id];
      items.push({
        date: u.created_at,
        type: 'upload',
        label: u.filename,
        enterprise: ent?.name || '?',
        user: coach?.full_name || '—',
      });
    });

    return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 50);
  }, [deliverables, coachUploads, enterpriseMap, profileMap]);

  // STEP 2 — Error deliverables
  const errorDeliverables = useMemo(() =>
    deliverables.filter(d => {
      const data = d.data as any;
      return data?.error || data?.status === 'failed' || data?.success === false;
    }).slice(0, 50),
    [deliverables]
  );

  const handleReassignCoach = async (enterpriseId: string, newCoachId: string | null) => {
    try {
      // Remove old enterprise_coaches entries for this enterprise
      await supabase.from('enterprise_coaches').delete().eq('enterprise_id', enterpriseId);

      // Insert new entry if a coach is selected
      if (newCoachId) {
        const { error: ecErr } = await supabase.from('enterprise_coaches').insert({
          enterprise_id: enterpriseId,
          coach_id: newCoachId,
          role: 'principal',
        } as any);
        if (ecErr) throw ecErr;
      }

      // Also update legacy coach_id for backward compatibility
      const { error } = await supabase.from('enterprises').update({ coach_id: newCoachId || null }).eq('id', enterpriseId);
      if (error) throw error;

      toast({ title: t('admin.coach_reassigned') });
      setEnterprises(prev => prev.map(e => e.id === enterpriseId ? { ...e, coach_id: newCoachId || null } : e));
      setEnterpriseCoaches(prev => {
        const filtered = prev.filter(ec => ec.enterprise_id !== enterpriseId);
        if (newCoachId) filtered.push({ enterprise_id: enterpriseId, coach_id: newCoachId, is_active: true });
        return filtered;
      });
    } catch (error: any) {
      toast({ title: t('common.error'), description: error.message, variant: 'destructive' });
    }
  };

  const handleDeleteEnterprise = async (id: string) => {
    const { error: dErr } = await supabase.from('deliverables').delete().eq('enterprise_id', id);
    if (dErr) { toast({ title: t('admin.error_delete_deliverables'), description: dErr.message, variant: 'destructive' }); return; }
    const { error } = await supabase.from('enterprises').delete().eq('id', id);
    if (error) {
      toast({ title: t('common.error'), description: error.message, variant: 'destructive' });
    } else {
      toast({ title: t('admin.enterprise_deleted') });
      setEnterprises(prev => prev.filter(e => e.id !== id));
      setDeliverables(prev => prev.filter(d => d.enterprise_id !== id));
    }
  };

  const roleBadgeVariant = (role: string) => {
    if (role === 'super_admin') return 'default';
    if (role === 'coach') return 'secondary';
    return 'outline';
  };

  // --- Drill-down: full enterprise view ---
  if (viewingEnterprise) {
    const veCoachId = enterpriseCoachMap[viewingEnterprise.id] || viewingEnterprise.coach_id;
    const veCoach = coaches.find(c => c.user_id === veCoachId);
    const veOwner = profileMap[viewingEnterprise.user_id];
    return (
      <DashboardLayout title={t('admin.title')} subtitle={viewingEnterprise.name}>
        <div className="mb-4 flex items-center gap-3 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => setViewingEnterprise(null)}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Retour admin
          </Button>
          <Badge variant="secondary" className="text-xs">
            {viewingEnterprise.name}
          </Badge>
          {veOwner && (
            <Badge variant="outline" className="text-xs">
              Entrepreneur : {veOwner.full_name || veOwner.email || '—'}
            </Badge>
          )}
          {veCoach && (
            <Badge variant="outline" className="text-xs">
              Coach : {veCoach.full_name || veCoach.email || '—'}
            </Badge>
          )}
          <Badge variant="outline" className="text-xs">
            Secteur : {viewingEnterprise.sector || '—'}
          </Badge>
          <Badge variant="outline" className="text-xs">
            Score IR : {viewingEnterprise.score_ir ?? '—'}
          </Badge>
        </div>
        <EntrepreneurDashboard
          enterpriseId={viewingEnterprise.id}
          showBackButton={false}
          coachMode={true}
          readOnly={true}
        />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title={t('admin.title')} subtitle={t('admin.subtitle')}>
      {/* KPI Cards — STEP 3: added parser status card */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        {[
          { label: t('admin.users_label'), value: stats.users, icon: Users },
          { label: t('admin.coaches_label'), value: stats.coaches, icon: UserCog },
          { label: t('admin.enterprises_label'), value: stats.enterprises, icon: Building2 },
          { label: t('admin.deliverables_label'), value: stats.deliverables, icon: FileText },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <s.icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{loading ? '–' : s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
        {/* Parser status card */}
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
              parserStatus === 'up' ? 'bg-emerald-100' : parserStatus === 'down' ? 'bg-red-100' : 'bg-muted'
            }`}>
              <Server className={`h-5 w-5 ${
                parserStatus === 'up' ? 'text-emerald-600' : parserStatus === 'down' ? 'text-red-600' : 'text-muted-foreground'
              }`} />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">
                {parserStatus === 'up' ? t('admin.parser_online') : parserStatus === 'down' ? t('admin.parser_offline') : t('admin.parser_checking')}
              </p>
              <p className="text-xs text-muted-foreground">
                {t('admin.parser_server')} {parserVersion ? `v${parserVersion}` : ''}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* STEP 1 — Auto-refresh toggle + manual refresh */}
      <div className="flex justify-end mb-4">
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
            <input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} className="rounded" />
            {t('admin.auto_refresh')}
          </label>
          <Button variant="outline" size="sm" onClick={fetchAll} disabled={loading} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> {t('admin.refresh')}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="users">
        <TabsList className="mb-4 flex-wrap">
          <TabsTrigger value="users">{t('admin.tab_users')}</TabsTrigger>
          <TabsTrigger value="coaches">{t('admin.tab_coaches')}</TabsTrigger>
          <TabsTrigger value="enterprises">{t('admin.tab_enterprises')}</TabsTrigger>
          <TabsTrigger value="errors" className="gap-1"><AlertTriangle className="h-3.5 w-3.5" /> {t('admin.tab_errors')}{errorDeliverables.length > 0 ? ` (${errorDeliverables.length})` : ''}</TabsTrigger>
          <TabsTrigger value="screening" className="gap-1"><Target className="h-3.5 w-3.5" />{t('admin.tab_screening')}</TabsTrigger>
          <TabsTrigger value="knowledge" className="gap-1"><Database className="h-3.5 w-3.5" />{t('admin.tab_knowledge')}</TabsTrigger>
          <TabsTrigger value="activity">{t('admin.tab_activity')}</TabsTrigger>
          <TabsTrigger value="kb_structured" className="gap-1"><Database className="h-3.5 w-3.5" />{t('admin.tab_kb_structured')}</TabsTrigger>
          <TabsTrigger value="portfolio" className="gap-1"><TrendingUp className="h-3.5 w-3.5" />{t('admin.tab_portfolio')}</TabsTrigger>
          <TabsTrigger value="funding" className="gap-1"><Target className="h-3.5 w-3.5" />{t('admin.tab_funding')}</TabsTrigger>
          <TabsTrigger value="alerts" className="gap-1"><AlertTriangle className="h-3.5 w-3.5" />{t('admin.tab_alerts')}</TabsTrigger>
          <TabsTrigger value="costs" className="gap-1"><DollarSign className="h-3.5 w-3.5" />{t('admin.tab_costs')}</TabsTrigger>
          <TabsTrigger value="exports" className="gap-1"><FileText className="h-3.5 w-3.5" />{t('admin.tab_exports')}</TabsTrigger>
        </TabsList>

        {/* USERS TAB */}
        <TabsContent value="users">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-4">
                <CardTitle className="text-lg">{t('admin.all_users')}</CardTitle>
                <div className="flex items-center gap-2">
                  <div className="relative w-64">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input placeholder={t('admin.search')} className="pl-8" value={searchUsers} onChange={e => setSearchUsers(e.target.value)} />
                  </div>
                  <Button size="sm" onClick={() => { setNewUser({ full_name: '', email: '', password: `ESONO-${Date.now().toString(36)}`, roles: [] }); setShowCreateUser(true); }}>
                    <Plus className="h-4 w-4 mr-1" /> Créer un utilisateur
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('admin.col_name')}</TableHead>
                    <TableHead>{t('admin.col_email')}</TableHead>
                    <TableHead>{t('admin.col_roles')}</TableHead>
                    <TableHead>{t('admin.col_registration')}</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map(p => {
                    const userRoles = roleMap[p.user_id] || [];
                    const allRoles = ['coach', 'chef_programme', 'entrepreneur', 'super_admin'];
                    const missingRoles = allRoles.filter(r => !userRoles.includes(r));
                    return (
                      <TableRow key={p.user_id}>
                        <TableCell className="font-medium">{p.full_name || '—'}</TableCell>
                        <TableCell className="text-muted-foreground">{p.email}</TableCell>
                        <TableCell>
                          <div className="flex gap-1 flex-wrap">
                            {userRoles.map(r => (
                              <Badge key={r} variant={roleBadgeVariant(r)} className="text-xs cursor-pointer group" onClick={async () => {
                                if (userRoles.length <= 1) { toast({ title: 'Impossible', description: 'Dernier rôle — ne peut pas être retiré', variant: 'destructive' }); return; }
                                if (!confirm(`Retirer le rôle "${r}" ?`)) return;
                                const { error } = await supabase.functions.invoke('admin-manage-users', { body: { action: 'remove_role', user_id: p.user_id, role: r } });
                                if (error) toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
                                else { toast({ title: `Rôle ${r} retiré` }); fetchAll(); }
                              }}>
                                {r} <X className="h-2.5 w-2.5 ml-0.5 opacity-0 group-hover:opacity-100" />
                              </Badge>
                            ))}
                            {!userRoles.length && <span className="text-xs text-muted-foreground">{t('admin.no_role')}</span>}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">{formatDate(p.created_at)}</TableCell>
                        <TableCell>
                          {missingRoles.length > 0 && (
                            <Select onValueChange={async (role) => {
                              const { error } = await supabase.functions.invoke('admin-manage-users', { body: { action: 'add_role', user_id: p.user_id, role } });
                              if (error) toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
                              else { toast({ title: `Rôle ${role} ajouté` }); fetchAll(); }
                            }}>
                              <SelectTrigger className="h-7 w-36 text-xs"><SelectValue placeholder="+ Ajouter rôle" /></SelectTrigger>
                              <SelectContent>
                                {missingRoles.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {!filteredUsers.length && (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">{t('admin.no_user_found')}</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Create User Dialog */}
          <Dialog open={showCreateUser} onOpenChange={setShowCreateUser}>
            <DialogContent>
              <DialogHeader><DialogTitle>Créer un utilisateur</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="space-y-1">
                  <Label>Nom complet *</Label>
                  <Input value={newUser.full_name} onChange={e => setNewUser({ ...newUser, full_name: e.target.value })} placeholder="Awa Traoré" />
                </div>
                <div className="space-y-1">
                  <Label>Email *</Label>
                  <Input type="email" value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })} placeholder="awa@exemple.com" />
                </div>
                <div className="space-y-1">
                  <Label>Mot de passe temporaire</Label>
                  <Input value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Rôles *</Label>
                  {[
                    { value: 'coach', label: 'Coach', desc: 'Accompagne les entrepreneurs' },
                    { value: 'chef_programme', label: 'Chef de programme', desc: 'Gère les programmes et candidatures' },
                    { value: 'entrepreneur', label: 'Entrepreneur', desc: 'Développe son business plan' },
                  ].map(r => (
                    <label key={r.value} className="flex items-start gap-3 p-2 rounded border cursor-pointer hover:bg-muted/50">
                      <Checkbox
                        checked={newUser.roles.includes(r.value)}
                        onCheckedChange={(checked) => {
                          setNewUser(prev => ({
                            ...prev,
                            roles: checked ? [...prev.roles, r.value] : prev.roles.filter(x => x !== r.value),
                          }));
                        }}
                      />
                      <div>
                        <p className="text-sm font-medium">{r.label}</p>
                        <p className="text-xs text-muted-foreground">{r.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowCreateUser(false)}>Annuler</Button>
                <Button disabled={creatingUser || !newUser.full_name || !newUser.email || !newUser.roles.length} onClick={async () => {
                  setCreatingUser(true);
                  const { data, error } = await supabase.functions.invoke('admin-manage-users', {
                    body: { action: 'create_user', ...newUser },
                  });
                  setCreatingUser(false);
                  if (error || data?.error) {
                    toast({ title: 'Erreur', description: data?.error || error?.message, variant: 'destructive' });
                  } else {
                    toast({ title: 'Compte créé', description: `${newUser.full_name} — ${newUser.roles.join(', ')}. Mot de passe : ${newUser.password}` });
                    setShowCreateUser(false);
                    fetchAll();
                  }
                }}>
                  {creatingUser ? 'Création...' : 'Créer le compte'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* COACHES TAB */}
        <TabsContent value="coaches">
          <CoachesTab
            coaches={coaches}
            enterprises={enterprises}
            deliverables={deliverables}
            coachUploads={coachUploads}
            enterpriseMap={enterpriseMap}
            coachEnterprisesMap={coachEnterprisesMap}
          />
        </TabsContent>

        {/* ENTERPRISES TAB — STEP 4: clickable name */}
        <TabsContent value="enterprises">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-4">
                <CardTitle className="text-lg">{t('admin.all_enterprises')}</CardTitle>
                <div className="relative w-64">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input placeholder={t('admin.search')} className="pl-8" value={searchEnterprises} onChange={e => setSearchEnterprises(e.target.value)} />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('admin.col_enterprise')}</TableHead>
                    <TableHead>{t('admin.col_entrepreneur')}</TableHead>
                    <TableHead>{t('admin.col_coach')}</TableHead>
                    <TableHead>{t('admin.col_sector')}</TableHead>
                    <TableHead>{t('admin.col_score_ir')}</TableHead>
                    <TableHead>{t('admin.col_phase')}</TableHead>
                    <TableHead>{t('admin.col_deliverables')}</TableHead>
                    <TableHead>{t('admin.col_last_activity')}</TableHead>
                    <TableHead className="w-[80px]">{t('common.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEnterprises.map(e => {
                    const owner = profileMap[e.user_id];
                    return (
                      <TableRow key={e.id}>
                        <TableCell className="font-medium">
                          <span
                            className="cursor-pointer hover:text-primary hover:underline"
                            onClick={() => setViewingEnterprise(e)}
                          >
                            {e.name}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 ml-2 text-muted-foreground hover:text-primary"
                            onClick={() => setSelectedEnterprise(e)}
                            title="Pipeline rapide"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{owner?.full_name || owner?.email || e.user_id.slice(0, 8)}</TableCell>
                        <TableCell>
                          <Select
                            value={enterpriseCoachMap[e.id] || e.coach_id || 'none'}
                            onValueChange={v => handleReassignCoach(e.id, v === 'none' ? null : v)}
                          >
                            <SelectTrigger className="h-8 w-[160px] text-xs">
                              <SelectValue placeholder={t('admin.no_coach')} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">{t('admin.no_coach_short')}</SelectItem>
                              {coaches.map(c => (
                                <SelectItem key={c.user_id} value={c.user_id}>
                                  {c.full_name || c.email || c.user_id.slice(0, 8)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-sm">{e.sector || '—'}</TableCell>
                        <TableCell>
                          <Badge variant={e.score_ir && e.score_ir >= 70 ? 'default' : 'outline'} className="text-xs">
                            {e.score_ir ?? '—'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm capitalize">{e.phase || '—'}</TableCell>
                        <TableCell className="text-sm text-center">{deliverablesPerEnterprise[e.id] || 0}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{e.last_activity ? formatDate(e.last_activity) : '—'}</TableCell>
                        <TableCell>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>{t('admin.delete_enterprise_title', { name: e.name })}</AlertDialogTitle>
                                <AlertDialogDescription>
                                  {t('admin.delete_enterprise_desc')}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteEnterprise(e.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                  {t('common.delete')}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {!filteredEnterprises.length && (
                    <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">{t('admin.no_enterprise_found')}</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* STEP 2 — ERRORS TAB */}
        <TabsContent value="errors">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t('admin.errors_title')}</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('admin.col_date')}</TableHead>
                    <TableHead>{t('admin.col_enterprise')}</TableHead>
                    <TableHead>{t('admin.col_module')}</TableHead>
                    <TableHead>{t('admin.col_error')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {errorDeliverables.map(d => {
                    const ent = enterpriseMap[d.enterprise_id];
                    const data = d.data as any;
                    const errorMsg = data?.error || data?.detail || data?.message || t('admin.unknown_error');
                    return (
                      <TableRow key={d.id}>
                        <TableCell className="text-sm text-muted-foreground">{formatDate(d.created_at)}</TableCell>
                        <TableCell className="font-medium">{ent?.name || d.enterprise_id.slice(0, 8)}</TableCell>
                        <TableCell><Badge variant="destructive" className="text-xs">{deliverableLabel(d.type)}</Badge></TableCell>
                        <TableCell className="text-sm text-destructive max-w-md truncate">{errorMsg}</TableCell>
                      </TableRow>
                    );
                  })}
                  {!errorDeliverables.length && (
                    <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">{t('admin.no_errors')}</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* STEP 5 — ENRICHED ACTIVITY TAB */}
        <TabsContent value="activity">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t('admin.activity_title')}</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('admin.col_type')}</TableHead>
                    <TableHead>{t('admin.col_enterprise')}</TableHead>
                    <TableHead>{t('admin.col_by')}</TableHead>
                    <TableHead>{t('admin.col_date')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentActivity.map((a, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <Badge variant={a.type === 'deliverable' ? 'outline' : 'secondary'} className="text-xs">
                          {a.type === 'deliverable' ? '📄' : '📤'} {a.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{a.enterprise}</TableCell>
                      <TableCell className="text-sm text-muted-foreground capitalize">{a.user}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDate(a.date)}</TableCell>
                    </TableRow>
                  ))}
                  {!recentActivity.length && (
                    <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">{t('admin.no_activity')}</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* SCREENING TAB */}
        <TabsContent value="screening" className="space-y-6">
          <ProgrammeCriteriaEditor />
          <ScreeningDashboard />
        </TabsContent>

        {/* KNOWLEDGE BASE TAB */}
        <TabsContent value="knowledge">
          <KnowledgeBaseManager isAdmin={true} />
        </TabsContent>

        {/* STRUCTURED KB TAB */}
        <TabsContent value="kb_structured">
          <WorkspaceKnowledgeManager />
        </TabsContent>
        <TabsContent value="portfolio">
          <PortfolioTab />
        </TabsContent>
        <TabsContent value="funding">
          <FundingMatchTab />
        </TabsContent>
        <TabsContent value="alerts">
          <AlertsTab />
        </TabsContent>
        <TabsContent value="costs">
          <CostTrackingTab />
        </TabsContent>
        <TabsContent value="exports">
          <ExportTab />
        </TabsContent>
      </Tabs>

      {/* STEP 4 — Enterprise pipeline dialog */}
      {selectedEnterprise && (
        <Dialog open={!!selectedEnterprise} onOpenChange={() => setSelectedEnterprise(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{selectedEnterprise.name} — {t('admin.pipeline_title')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-2 mt-4">
              {PIPELINE.map(step => {
                const deliv = deliverables.find(
                  d => d.enterprise_id === selectedEnterprise.id && d.type === step.type
                );
                const hasError = deliv && (deliv.data as any)?.error;
                const status = !deliv ? 'not_started' : hasError ? 'error' : 'done';
                return (
                  <div key={step.fn} className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50">
                    <span className="text-sm">{step.name}</span>
                    <div className="flex items-center gap-2">
                      {status === 'done' && (
                        <Badge className="text-xs bg-emerald-100 text-emerald-700">{t('admin.status_done')}</Badge>
                      )}
                      {status === 'error' && (
                        <Badge variant="destructive" className="text-xs">{t('admin.status_error')}</Badge>
                      )}
                      {status === 'not_started' && (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                      {deliv && (
                        <span className="text-[10px] text-muted-foreground">
                          {formatDate(deliv.created_at)}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </DashboardLayout>
  );
}
