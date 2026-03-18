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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { toast } from '@/hooks/use-toast';
import { Users, Building2, FileText, Trash2, UserCog, Search, RefreshCw, Target, Database } from 'lucide-react';
import CoachesTab from './CoachesTab';
import ProgrammeCriteriaEditor from './ProgrammeCriteriaEditor';
import ScreeningDashboard from './ScreeningDashboard';
import KnowledgeBaseManager from './KnowledgeBaseManager';

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
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [enterprises, setEnterprises] = useState<Enterprise[]>([]);
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [coachUploads, setCoachUploads] = useState<CoachUpload[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchUsers, setSearchUsers] = useState('');
  const [searchEnterprises, setSearchEnterprises] = useState('');

  const fetchAll = async () => {
    setLoading(true);
    const [pRes, rRes, eRes, dRes, cuRes] = await Promise.all([
      supabase.from('profiles').select('user_id, full_name, email, created_at'),
      supabase.from('user_roles').select('user_id, role'),
      supabase.from('enterprises').select('id, name, user_id, coach_id, sector, country, phase, score_ir, last_activity, contact_email, created_at'),
      supabase.from('deliverables').select('id, enterprise_id, type, created_at, generated_by, coach_id, visibility').order('created_at', { ascending: false }).limit(500),
      supabase.from('coach_uploads').select('id, coach_id, enterprise_id, filename, category, created_at').order('created_at', { ascending: false }).limit(500),
    ]);
    if (pRes.data) setProfiles(pRes.data);
    if (rRes.data) setRoles(rRes.data);
    if (eRes.data) setEnterprises(eRes.data);
    if (dRes.data) setDeliverables(dRes.data);
    if (cuRes.data) setCoachUploads(cuRes.data as CoachUpload[]);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

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

  const handleReassignCoach = async (enterpriseId: string, newCoachId: string | null) => {
    const { error } = await supabase.from('enterprises').update({ coach_id: newCoachId || null }).eq('id', enterpriseId);
    if (error) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Coach réassigné' });
      setEnterprises(prev => prev.map(e => e.id === enterpriseId ? { ...e, coach_id: newCoachId || null } : e));
    }
  };

  const handleDeleteEnterprise = async (id: string) => {
    const { error: dErr } = await supabase.from('deliverables').delete().eq('enterprise_id', id);
    if (dErr) { toast({ title: 'Erreur suppression livrables', description: dErr.message, variant: 'destructive' }); return; }
    const { error } = await supabase.from('enterprises').delete().eq('id', id);
    if (error) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Entreprise supprimée' });
      setEnterprises(prev => prev.filter(e => e.id !== id));
      setDeliverables(prev => prev.filter(d => d.enterprise_id !== id));
    }
  };

  const roleBadgeVariant = (role: string) => {
    if (role === 'super_admin') return 'default';
    if (role === 'coach') return 'secondary';
    return 'outline';
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });

  const deliverableLabel = (type: string) => type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  return (
    <DashboardLayout title="Administration" subtitle="Vue globale de la plateforme">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Utilisateurs', value: stats.users, icon: Users },
          { label: 'Coaches', value: stats.coaches, icon: UserCog },
          { label: 'Entreprises', value: stats.enterprises, icon: Building2 },
          { label: 'Livrables', value: stats.deliverables, icon: FileText },
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
      </div>

      <div className="flex justify-end mb-4">
        <Button variant="outline" size="sm" onClick={fetchAll} disabled={loading} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Actualiser
        </Button>
      </div>

      <Tabs defaultValue="users">
        <TabsList className="mb-4 flex-wrap">
          <TabsTrigger value="users">Utilisateurs</TabsTrigger>
          <TabsTrigger value="coaches">Coaches</TabsTrigger>
          <TabsTrigger value="enterprises">Entreprises</TabsTrigger>
          <TabsTrigger value="screening" className="gap-1"><Target className="h-3.5 w-3.5" />Screening</TabsTrigger>
          <TabsTrigger value="knowledge" className="gap-1"><Database className="h-3.5 w-3.5" />Base de connaissances</TabsTrigger>
          <TabsTrigger value="activity">Activité récente</TabsTrigger>
        </TabsList>

        {/* USERS TAB */}
        <TabsContent value="users">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-4">
                <CardTitle className="text-lg">Tous les utilisateurs</CardTitle>
                <div className="relative w-64">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Rechercher..." className="pl-8" value={searchUsers} onChange={e => setSearchUsers(e.target.value)} />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Rôle(s)</TableHead>
                    <TableHead>Inscription</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map(p => (
                    <TableRow key={p.user_id}>
                      <TableCell className="font-medium">{p.full_name || '—'}</TableCell>
                      <TableCell className="text-muted-foreground">{p.email}</TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {(roleMap[p.user_id] || []).map(r => (
                            <Badge key={r} variant={roleBadgeVariant(r)} className="text-xs">{r}</Badge>
                          ))}
                          {!roleMap[p.user_id]?.length && <span className="text-xs text-muted-foreground">aucun</span>}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">{formatDate(p.created_at)}</TableCell>
                    </TableRow>
                  ))}
                  {!filteredUsers.length && (
                    <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Aucun utilisateur trouvé</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* COACHES TAB */}
        <TabsContent value="coaches">
          <CoachesTab
            coaches={coaches}
            enterprises={enterprises}
            deliverables={deliverables}
            coachUploads={coachUploads}
            enterpriseMap={enterpriseMap}
          />
        </TabsContent>

        {/* ENTERPRISES TAB */}
        <TabsContent value="enterprises">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-4">
                <CardTitle className="text-lg">Toutes les entreprises</CardTitle>
                <div className="relative w-64">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Rechercher..." className="pl-8" value={searchEnterprises} onChange={e => setSearchEnterprises(e.target.value)} />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Entreprise</TableHead>
                    <TableHead>Entrepreneur</TableHead>
                    <TableHead>Coach</TableHead>
                    <TableHead>Secteur</TableHead>
                    <TableHead>Score IR</TableHead>
                    <TableHead>Phase</TableHead>
                    <TableHead>Livrables</TableHead>
                    <TableHead>Dernière activité</TableHead>
                    <TableHead className="w-[80px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEnterprises.map(e => {
                    const owner = profileMap[e.user_id];
                    return (
                      <TableRow key={e.id}>
                        <TableCell className="font-medium">{e.name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{owner?.full_name || owner?.email || e.user_id.slice(0, 8)}</TableCell>
                        <TableCell>
                          <Select
                            value={e.coach_id || 'none'}
                            onValueChange={v => handleReassignCoach(e.id, v === 'none' ? null : v)}
                          >
                            <SelectTrigger className="h-8 w-[160px] text-xs">
                              <SelectValue placeholder="Aucun coach" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Aucun</SelectItem>
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
                                <AlertDialogTitle>Supprimer « {e.name} » ?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Cette action supprimera l'entreprise et tous ses livrables. Cette action est irréversible.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Annuler</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteEnterprise(e.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                  Supprimer
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {!filteredEnterprises.length && (
                    <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Aucune entreprise trouvée</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ACTIVITY TAB */}
        <TabsContent value="activity">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Activité récente</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Entreprise</TableHead>
                    <TableHead>Généré par</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deliverables.slice(0, 50).map(d => {
                    const ent = enterpriseMap[d.enterprise_id];
                    return (
                      <TableRow key={d.id}>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">{deliverableLabel(d.type)}</Badge>
                        </TableCell>
                        <TableCell className="font-medium">{ent?.name || d.enterprise_id.slice(0, 8)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground capitalize">{d.generated_by || '—'}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{formatDate(d.created_at)}</TableCell>
                      </TableRow>
                    );
                  })}
                  {!deliverables.length && (
                    <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Aucune activité</TableCell></TableRow>
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
          <KnowledgeBaseManager />
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}