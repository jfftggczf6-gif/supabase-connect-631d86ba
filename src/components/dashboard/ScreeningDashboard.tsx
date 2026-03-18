import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Search, Filter, CheckCircle2, XCircle, AlertTriangle, ArrowUpDown, Download } from 'lucide-react';

interface Enterprise {
  id: string;
  name: string;
  sector: string | null;
  country: string | null;
  score_ir: number | null;
  phase: string | null;
  contact_email: string | null;
  coach_id: string | null;
}

interface Deliverable {
  id: string;
  enterprise_id: string;
  type: string;
  data: any;
  score: number | null;
}

interface ProgrammeCriteria {
  id: string;
  name: string;
  min_score_ir: number;
  required_deliverables: string[];
  sector_filter: string[];
  country_filter: string[];
  min_revenue: number;
  max_debt_ratio: number;
  min_margin: number;
  is_active: boolean;
}

interface Profile {
  user_id: string;
  full_name: string | null;
  email: string | null;
}

interface ScoredEnterprise extends Enterprise {
  matchScore: number;
  matchDetails: { label: string; passed: boolean }[];
  deliverableCount: number;
  screeningScore: number | null;
  verdict: string;
}

interface ScreeningDashboardProps {
  coachId?: string;
}

export default function ScreeningDashboard({ coachId }: ScreeningDashboardProps = {}) {
  const [enterprises, setEnterprises] = useState<Enterprise[]>([]);
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [criteria, setCriteria] = useState<ProgrammeCriteria[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedCriteria, setSelectedCriteria] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<'matchScore' | 'name' | 'score_ir'>('matchScore');
  const [sortAsc, setSortAsc] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      let entQuery = supabase.from('enterprises').select('id, name, sector, country, score_ir, phase, contact_email, coach_id');
      if (coachId) entQuery = entQuery.eq('coach_id', coachId);
      const [eRes, dRes, cRes, pRes] = await Promise.all([
        entQuery,
        supabase.from('deliverables').select('id, enterprise_id, type, data, score'),
        supabase.from('programme_criteria').select('*').eq('is_active', true),
        supabase.from('profiles').select('user_id, full_name, email'),
      ]);
      setEnterprises(eRes.data || []);
      setDeliverables(dRes.data || []);
      setCriteria((cRes.data as unknown as ProgrammeCriteria[]) || []);
      setProfiles(pRes.data || []);
      setLoading(false);
    };
    fetchAll();
  }, []);

  const coachMap = useMemo(() => {
    const m: Record<string, string> = {};
    profiles.forEach(p => { m[p.user_id] = p.full_name || p.email || p.user_id.slice(0, 8); });
    return m;
  }, [profiles]);

  const delivsByEnterprise = useMemo(() => {
    const m: Record<string, Deliverable[]> = {};
    deliverables.forEach(d => { (m[d.enterprise_id] ||= []).push(d); });
    return m;
  }, [deliverables]);

  const scoredEnterprises = useMemo((): ScoredEnterprise[] => {
    const activeCriteria = selectedCriteria === 'all'
      ? null
      : criteria.find(c => c.id === selectedCriteria) || null;

    return enterprises.map(ent => {
      const entDelivs = delivsByEnterprise[ent.id] || [];
      const delivTypes = new Set(entDelivs.map(d => d.type));
      const screeningDeliv = entDelivs.find(d => d.type === 'screening_report');
      const screeningData = screeningDeliv?.data as any;
      const screeningScore = screeningData?.score ?? screeningDeliv?.score ?? null;

      if (!activeCriteria) {
        return {
          ...ent,
          matchScore: screeningScore ?? (ent.score_ir || 0),
          matchDetails: [] as { label: string; passed: boolean }[],
          deliverableCount: entDelivs.length,
          screeningScore,
          verdict: screeningData?.verdict || (screeningScore != null && screeningScore >= 60 ? 'Éligible' : screeningScore != null ? 'Non éligible' : '—'),
        };
      }

      const checks: { label: string; passed: boolean }[] = [];
      let passed = 0;

      // Score IR
      const scoreOk = (ent.score_ir || 0) >= activeCriteria.min_score_ir;
      checks.push({ label: `Score IR ≥ ${activeCriteria.min_score_ir}`, passed: scoreOk });
      if (scoreOk) passed++;

      // Required deliverables
      if (activeCriteria.required_deliverables?.length) {
        const hasAll = activeCriteria.required_deliverables.every(d => delivTypes.has(d));
        checks.push({ label: `Livrables requis (${activeCriteria.required_deliverables.length})`, passed: hasAll });
        if (hasAll) passed++;
      }

      // Sector filter
      if (activeCriteria.sector_filter?.length) {
        const sectorOk = !ent.sector || activeCriteria.sector_filter.includes(ent.sector);
        checks.push({ label: 'Secteur éligible', passed: sectorOk });
        if (sectorOk) passed++;
      }

      // Country filter
      if (activeCriteria.country_filter?.length) {
        const countryOk = !ent.country || activeCriteria.country_filter.includes(ent.country);
        checks.push({ label: 'Pays éligible', passed: countryOk });
        if (countryOk) passed++;
      }

      const total = checks.length || 1;
      const matchScore = Math.round((passed / total) * 100);

      return {
        ...ent,
        matchScore,
        matchDetails: checks,
        deliverableCount: entDelivs.length,
        screeningScore,
        verdict: matchScore >= 80 ? 'Éligible' : matchScore >= 50 ? 'À examiner' : 'Non éligible',
      };
    });
  }, [enterprises, delivsByEnterprise, criteria, selectedCriteria]);

  const filtered = useMemo(() => {
    let list = scoredEnterprises;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(e => e.name.toLowerCase().includes(q) || e.sector?.toLowerCase().includes(q));
    }
    list.sort((a, b) => {
      const av = sortField === 'name' ? a.name : sortField === 'score_ir' ? (a.score_ir || 0) : a.matchScore;
      const bv = sortField === 'name' ? b.name : sortField === 'score_ir' ? (b.score_ir || 0) : b.matchScore;
      if (typeof av === 'string' && typeof bv === 'string') return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortAsc ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
    return list;
  }, [scoredEnterprises, search, sortField, sortAsc]);

  const stats = useMemo(() => ({
    total: filtered.length,
    eligible: filtered.filter(e => e.verdict === 'Éligible').length,
    review: filtered.filter(e => e.verdict === 'À examiner').length,
    rejected: filtered.filter(e => e.verdict === 'Non éligible').length,
  }), [filtered]);

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) setSortAsc(!sortAsc);
    else { setSortField(field); setSortAsc(false); }
  };

  const getVerdictBadge = (verdict: string) => {
    if (verdict === 'Éligible') return <Badge className="bg-green-100 text-green-700 border-green-200"><CheckCircle2 className="h-3 w-3 mr-1" />Éligible</Badge>;
    if (verdict === 'À examiner') return <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200"><AlertTriangle className="h-3 w-3 mr-1" />À examiner</Badge>;
    if (verdict === 'Non éligible') return <Badge className="bg-red-100 text-red-700 border-red-200"><XCircle className="h-3 w-3 mr-1" />Non éligible</Badge>;
    return <Badge variant="outline">—</Badge>;
  };

  const handleExportCSV = () => {
    const headers = ['Entreprise', 'Secteur', 'Pays', 'Score IR', 'Score Screening', 'Match %', 'Verdict', 'Coach', 'Livrables'];
    const rows = filtered.map(e => [
      e.name, e.sector || '', e.country || '', e.score_ir ?? '', e.screeningScore ?? '',
      e.matchScore, e.verdict, e.coach_id ? coachMap[e.coach_id] || '' : '', e.deliverableCount,
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `screening_${selectedCriteria === 'all' ? 'global' : 'programme'}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <p className="text-center text-muted-foreground py-8">Chargement…</p>;

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-foreground">{stats.total}</p>
          <p className="text-xs text-muted-foreground">Entreprises</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-green-600">{stats.eligible}</p>
          <p className="text-xs text-muted-foreground">Éligibles</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-yellow-600">{stats.review}</p>
          <p className="text-xs text-muted-foreground">À examiner</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-red-600">{stats.rejected}</p>
          <p className="text-xs text-muted-foreground">Non éligibles</p>
        </CardContent></Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Rechercher une entreprise…" className="pl-8" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={selectedCriteria} onValueChange={setSelectedCriteria}>
          <SelectTrigger className="w-[220px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Programme" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous (vue globale)</SelectItem>
            {criteria.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={handleExportCSV} className="gap-2">
          <Download className="h-4 w-4" /> Export CSV
        </Button>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="cursor-pointer" onClick={() => toggleSort('name')}>
                  Entreprise <ArrowUpDown className="inline h-3 w-3 ml-1" />
                </TableHead>
                <TableHead>Secteur</TableHead>
                <TableHead>Pays</TableHead>
                <TableHead className="cursor-pointer" onClick={() => toggleSort('score_ir')}>
                  Score IR <ArrowUpDown className="inline h-3 w-3 ml-1" />
                </TableHead>
                <TableHead>Screening</TableHead>
                <TableHead className="cursor-pointer" onClick={() => toggleSort('matchScore')}>
                  Match <ArrowUpDown className="inline h-3 w-3 ml-1" />
                </TableHead>
                <TableHead>Verdict</TableHead>
                <TableHead>Coach</TableHead>
                {selectedCriteria !== 'all' && <TableHead>Détails</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(e => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium">{e.name}</TableCell>
                  <TableCell className="text-sm">{e.sector || '—'}</TableCell>
                  <TableCell className="text-sm">{e.country || '—'}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{e.score_ir ?? '—'}</Badge>
                  </TableCell>
                  <TableCell>
                    {e.screeningScore != null ? (
                      <Badge variant="outline">{e.screeningScore}/100</Badge>
                    ) : '—'}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Progress value={e.matchScore} className="w-16 h-2" />
                      <span className="text-xs font-medium">{e.matchScore}%</span>
                    </div>
                  </TableCell>
                  <TableCell>{getVerdictBadge(e.verdict)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {e.coach_id ? coachMap[e.coach_id] || '—' : '—'}
                  </TableCell>
                  {selectedCriteria !== 'all' && (
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {e.matchDetails.map((d, i) => (
                          <Badge key={i} variant="outline" className={`text-xs ${d.passed ? 'border-green-300 text-green-700' : 'border-red-300 text-red-700'}`}>
                            {d.passed ? '✓' : '✗'} {d.label}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {!filtered.length && (
                <TableRow><TableCell colSpan={selectedCriteria !== 'all' ? 9 : 8} className="text-center text-muted-foreground py-8">Aucune entreprise trouvée</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
