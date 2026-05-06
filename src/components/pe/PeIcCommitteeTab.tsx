// PeIcCommitteeTab — onglet "Comité d'investissement" du workspace MD
// Timeline des décisions pe_ic_decisions + filtres + stats Go/No-go + export PDF (registre IC)
import { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Loader2, Check, AlertTriangle, X, Printer, Users, Scale, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import StatCard from '@/components/shared/StatCard';

type IcType = 'ic1' | 'ic_finale';
type IcDecision = 'go' | 'go_conditional' | 'no_go';

interface IcDecisionRow {
  id: string;
  deal_id: string;
  ic_type: IcType;
  decision: IcDecision;
  conditions: string[];
  motif: string | null;
  voted_by: string[];
  decided_by: string;
  decided_at: string;
  notes: string | null;
  // joined
  deal_ref: string;
  enterprise_name: string | null;
  decided_by_name: string | null;
}

interface Props {
  organizationId: string;
}

const IC_TYPE_LABELS: Record<IcType, string> = { ic1: 'IC1 (avant DD)', ic_finale: 'IC finale (avant closing)' };
const IC_TYPE_BADGES: Record<IcType, string> = { ic1: 'bg-amber-50 text-amber-700 border-amber-200', ic_finale: 'bg-emerald-50 text-emerald-700 border-emerald-200' };

const DECISION_LABELS: Record<IcDecision, string> = { go: 'Go', go_conditional: 'Go conditionnel', no_go: 'No-go' };
const DECISION_BADGES: Record<IcDecision, string> = {
  go: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  go_conditional: 'bg-amber-50 text-amber-700 border-amber-200',
  no_go: 'bg-red-50 text-red-700 border-red-200',
};
const DECISION_ICONS: Record<IcDecision, typeof Check> = { go: Check, go_conditional: AlertTriangle, no_go: X };

export default function PeIcCommitteeTab({ organizationId }: Props) {
  const navigate = useNavigate();
  const [rows, setRows] = useState<IcDecisionRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [filterType, setFilterType] = useState<IcType | 'all'>('all');
  const [filterDecision, setFilterDecision] = useState<IcDecision | 'all'>('all');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const { data: decisions } = await supabase
      .from('pe_ic_decisions')
      .select('*')
      .eq('organization_id', organizationId)
      .order('decided_at', { ascending: false });

    if (!decisions || decisions.length === 0) { setRows([]); setLoading(false); return; }

    const dealIds = [...new Set(decisions.map((d: any) => d.deal_id))] as string[];
    const userIds = [...new Set(decisions.map((d: any) => d.decided_by))] as string[];

    const [{ data: deals }, { data: profs }] = await Promise.all([
      supabase.from('pe_deals').select('id, deal_ref, enterprise_id, enterprises(name)').in('id', dealIds),
      supabase.from('profiles').select('user_id, full_name').in('user_id', userIds),
    ]);
    const dealMap = new Map((deals || []).map((d: any) => [d.id, { ref: d.deal_ref, ent: d.enterprises?.name ?? null }]));
    const profMap = new Map((profs || []).map((p: any) => [p.user_id, p.full_name]));

    setRows(decisions.map((d: any) => ({
      ...d,
      deal_ref: dealMap.get(d.deal_id)?.ref ?? d.deal_id,
      enterprise_name: dealMap.get(d.deal_id)?.ent ?? null,
      decided_by_name: profMap.get(d.decided_by) ?? null,
    })));
    setLoading(false);
  }, [organizationId]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => rows.filter(r => {
    if (filterType !== 'all' && r.ic_type !== filterType) return false;
    if (filterDecision !== 'all' && r.decision !== filterDecision) return false;
    if (filterFrom && r.decided_at < filterFrom) return false;
    if (filterTo && r.decided_at > filterTo + 'T23:59:59') return false;
    return true;
  }), [rows, filterType, filterDecision, filterFrom, filterTo]);

  const stats = useMemo(() => {
    const total = filtered.length;
    const go = filtered.filter(r => r.decision === 'go').length;
    const cond = filtered.filter(r => r.decision === 'go_conditional').length;
    const noGo = filtered.filter(r => r.decision === 'no_go').length;
    const conversion = total > 0 ? Math.round(((go + cond) / total) * 100) : 0;
    return { total, go, cond, noGo, conversion };
  }, [filtered]);

  const handlePrint = () => {
    // Fenêtre print stylée — l'utilisateur Ctrl+P → enregistrer en PDF
    window.print();
  };

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  return (
    <div className="space-y-4 print:p-6">
      {/* En-tête + bouton print */}
      <div className="flex items-center justify-between flex-wrap gap-3 print:mb-4">
        <div className="flex items-center gap-2">
          <Scale className="h-5 w-5 text-violet-600" />
          <h2 className="text-lg font-semibold">Registre des comités d'investissement</h2>
        </div>
        <Button onClick={handlePrint} variant="outline" size="sm" className="gap-2 print:hidden">
          <Printer className="h-4 w-4" /> Exporter / Imprimer
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 print:grid-cols-5">
        <StatCard icon={Scale} value={stats.total} label="Décisions IC" iconColor="text-violet-600" />
        <StatCard icon={Check} value={stats.go} label="Go" iconColor="text-emerald-500" />
        <StatCard icon={AlertTriangle} value={stats.cond} label="Go conditionnel" iconColor="text-amber-500" />
        <StatCard icon={X} value={stats.noGo} label="No-go" iconColor="text-red-500" />
        <StatCard icon={Users} value={`${stats.conversion}%`} label="Taux Go (cumul)" iconColor="text-primary" />
      </div>

      {/* Filtres */}
      <Card className="print:hidden">
        <CardContent className="p-3 flex flex-wrap items-end gap-3">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Type IC</label>
            <Select value={filterType} onValueChange={(v) => setFilterType(v as IcType | 'all')}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="ic1">IC1</SelectItem>
                <SelectItem value="ic_finale">IC finale</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Décision</label>
            <Select value={filterDecision} onValueChange={(v) => setFilterDecision(v as IcDecision | 'all')}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes</SelectItem>
                <SelectItem value="go">Go</SelectItem>
                <SelectItem value="go_conditional">Go conditionnel</SelectItem>
                <SelectItem value="no_go">No-go</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Du</label>
            <Input type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} className="w-[160px]" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Au</label>
            <Input type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} className="w-[160px]" />
          </div>
          {(filterType !== 'all' || filterDecision !== 'all' || filterFrom || filterTo) && (
            <Button variant="ghost" size="sm" onClick={() => { setFilterType('all'); setFilterDecision('all'); setFilterFrom(''); setFilterTo(''); }}>
              Réinitialiser
            </Button>
          )}
          <div className="ml-auto text-xs text-muted-foreground">
            {filtered.length} / {rows.length} décision{rows.length > 1 ? 's' : ''}
          </div>
        </CardContent>
      </Card>

      {/* Timeline */}
      {filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          {rows.length === 0
            ? 'Aucune décision IC enregistrée à ce jour.'
            : 'Aucune décision ne correspond aux filtres.'}
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(row => {
            const Icon = DECISION_ICONS[row.decision];
            return (
              <Card key={row.id} className="print:break-inside-avoid">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {new Date(row.decided_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </span>
                      <Badge variant="outline" className={IC_TYPE_BADGES[row.ic_type]}>{IC_TYPE_LABELS[row.ic_type]}</Badge>
                      <Badge variant="outline" className={`${DECISION_BADGES[row.decision]} gap-1`}>
                        <Icon className="h-3 w-3" /> {DECISION_LABELS[row.decision]}
                      </Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1 print:hidden"
                      onClick={() => navigate(`/pe/deals/${row.deal_id}`)}
                    >
                      Voir le deal <ArrowRight className="h-3 w-3" />
                    </Button>
                  </div>
                  <p className="font-medium text-sm">
                    {row.enterprise_name ?? '—'}
                    <span className="text-muted-foreground font-normal ml-2">({row.deal_ref})</span>
                  </p>
                  {row.decision === 'go_conditional' && row.conditions.length > 0 && (
                    <div className="mt-2 text-sm">
                      <p className="text-xs font-medium text-amber-700 mb-1">Conditions :</p>
                      <ul className="list-disc ml-5 text-muted-foreground space-y-0.5">
                        {row.conditions.map((c, i) => <li key={i}>{c}</li>)}
                      </ul>
                    </div>
                  )}
                  {row.decision === 'no_go' && row.motif && (
                    <div className="mt-2 text-sm">
                      <p className="text-xs font-medium text-red-700 mb-1">Motif :</p>
                      <p className="text-muted-foreground">{row.motif}</p>
                    </div>
                  )}
                  {row.notes && (
                    <p className="mt-2 text-sm text-muted-foreground italic">"{row.notes}"</p>
                  )}
                  <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
                    <span>Décidé par : <span className="font-medium text-foreground">{row.decided_by_name ?? '—'}</span></span>
                    {row.voted_by.length > 0 && (
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" /> {row.voted_by.length} votant{row.voted_by.length > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
