import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Search, ChevronDown, ChevronRight, Building2, FileText, Upload } from 'lucide-react';

interface Profile {
  user_id: string;
  full_name: string | null;
  email: string | null;
  created_at: string;
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

interface CoachesTabProps {
  coaches: Profile[];
  enterprises: Enterprise[];
  deliverables: Deliverable[];
  coachUploads: CoachUpload[];
  enterpriseMap: Record<string, Enterprise>;
}

interface CoachStat {
  profile: Profile;
  enterpriseCount: number;
  deliverablesCount: number;
  uploadsCount: number;
  lastActivity: string | null;
  enterprises: Enterprise[];
  deliverables: Deliverable[];
  uploads: CoachUpload[];
}

const formatDate = (d: string) =>
  new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });

const deliverableLabel = (type: string) =>
  type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

export default function CoachesTab({ coaches, enterprises, deliverables, coachUploads, enterpriseMap }: CoachesTabProps) {
  const [search, setSearch] = useState('');
  const [expandedCoach, setExpandedCoach] = useState<string | null>(null);

  const coachStats = useMemo<CoachStat[]>(() => {
    return coaches.map(coach => {
      const coachEnterprises = enterprises.filter(e => e.coach_id === coach.user_id);
      const coachDeliverables = deliverables.filter(
        d => (d.generated_by === 'coach' || d.generated_by === 'coach_mirror') &&
          coachEnterprises.some(e => e.id === d.enterprise_id)
      );
      const coachUps = coachUploads.filter(u => u.coach_id === coach.user_id);

      const dates = [
        ...coachDeliverables.map(d => d.created_at),
        ...coachUps.map(u => u.created_at),
      ];
      const lastActivity = dates.length
        ? dates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0]
        : null;

      return {
        profile: coach,
        enterpriseCount: coachEnterprises.length,
        deliverablesCount: coachDeliverables.length,
        uploadsCount: coachUps.length,
        lastActivity,
        enterprises: coachEnterprises,
        deliverables: coachDeliverables.slice(0, 10),
        uploads: coachUps.slice(0, 10),
      };
    });
  }, [coaches, enterprises, deliverables, coachUploads]);

  const filtered = useMemo(() => {
    if (!search) return coachStats;
    const q = search.toLowerCase();
    return coachStats.filter(
      c => c.profile.full_name?.toLowerCase().includes(q) || c.profile.email?.toLowerCase().includes(q)
    );
  }, [coachStats, search]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-4">
          <CardTitle className="text-lg">Activité des coaches</CardTitle>
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Rechercher un coach..." className="pl-8" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]" />
              <TableHead>Coach</TableHead>
              <TableHead>Email</TableHead>
              <TableHead className="text-center">Entreprises</TableHead>
              <TableHead className="text-center">Livrables</TableHead>
              <TableHead className="text-center">Uploads</TableHead>
              <TableHead>Dernière activité</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(c => {
              const isOpen = expandedCoach === c.profile.user_id;
              return (
                <Collapsible key={c.profile.user_id} asChild open={isOpen} onOpenChange={open => setExpandedCoach(open ? c.profile.user_id : null)}>
                  <>
                    <CollapsibleTrigger asChild>
                      <TableRow className="cursor-pointer hover:bg-muted/50">
                        <TableCell className="px-2">
                          {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                        </TableCell>
                        <TableCell className="font-medium">{c.profile.full_name || '—'}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{c.profile.email || '—'}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="text-xs">{c.enterpriseCount}</Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="secondary" className="text-xs">{c.deliverablesCount}</Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="text-xs">{c.uploadsCount}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {c.lastActivity ? formatDate(c.lastActivity) : '—'}
                        </TableCell>
                      </TableRow>
                    </CollapsibleTrigger>
                    <CollapsibleContent asChild>
                      <TableRow>
                        <TableCell colSpan={7} className="bg-muted/30 p-0">
                          <div className="p-4 space-y-4">
                            {/* Enterprises */}
                            <div>
                              <h4 className="text-sm font-semibold flex items-center gap-2 mb-2 text-foreground">
                                <Building2 className="h-4 w-4 text-primary" /> Entreprises assignées ({c.enterpriseCount})
                              </h4>
                              {c.enterprises.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                  {c.enterprises.map(ent => (
                                    <div key={ent.id} className="rounded-md border bg-background p-3 text-sm space-y-1">
                                      <p className="font-medium text-foreground">{ent.name}</p>
                                      <div className="flex gap-2 text-xs text-muted-foreground">
                                        <span>{ent.sector || 'N/A'}</span>
                                        <span>•</span>
                                        <span className="capitalize">{ent.phase || 'N/A'}</span>
                                        <span>•</span>
                                        <span>IR: <Badge variant={ent.score_ir && ent.score_ir >= 70 ? 'default' : 'outline'} className="text-xs ml-1">{ent.score_ir ?? '—'}</Badge></span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-xs text-muted-foreground">Aucune entreprise assignée</p>
                              )}
                            </div>

                            {/* Deliverables */}
                            <div>
                              <h4 className="text-sm font-semibold flex items-center gap-2 mb-2 text-foreground">
                                <FileText className="h-4 w-4 text-primary" /> Derniers livrables générés
                              </h4>
                              {c.deliverables.length > 0 ? (
                                <div className="space-y-1">
                                  {c.deliverables.map(d => (
                                    <div key={d.id} className="flex items-center justify-between rounded-md border bg-background px-3 py-2 text-sm">
                                      <div className="flex items-center gap-2">
                                        <Badge variant="outline" className="text-xs">{deliverableLabel(d.type)}</Badge>
                                        <span className="text-muted-foreground">{enterpriseMap[d.enterprise_id]?.name || '—'}</span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <Badge variant={d.visibility === 'shared' ? 'default' : 'secondary'} className="text-xs">
                                          {d.visibility === 'shared' ? 'Partagé' : 'Privé'}
                                        </Badge>
                                        <span className="text-xs text-muted-foreground">{formatDate(d.created_at)}</span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-xs text-muted-foreground">Aucun livrable généré</p>
                              )}
                            </div>

                            {/* Uploads */}
                            <div>
                              <h4 className="text-sm font-semibold flex items-center gap-2 mb-2 text-foreground">
                                <Upload className="h-4 w-4 text-primary" /> Documents uploadés
                              </h4>
                              {c.uploads.length > 0 ? (
                                <div className="space-y-1">
                                  {c.uploads.map(u => (
                                    <div key={u.id} className="flex items-center justify-between rounded-md border bg-background px-3 py-2 text-sm">
                                      <div className="flex items-center gap-2">
                                        <span className="font-medium text-foreground">{u.filename}</span>
                                        <Badge variant="outline" className="text-xs">{u.category}</Badge>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs text-muted-foreground">
                                          {enterpriseMap[u.enterprise_id]?.name || '—'}
                                        </span>
                                        <span className="text-xs text-muted-foreground">{formatDate(u.created_at)}</span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-xs text-muted-foreground">Aucun document uploadé</p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    </CollapsibleContent>
                  </>
                </Collapsible>
              );
            })}
            {!filtered.length && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">Aucun coach trouvé</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
