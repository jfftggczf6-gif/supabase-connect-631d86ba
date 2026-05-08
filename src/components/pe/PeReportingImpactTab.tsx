// PeReportingImpactTab — onglet "Reporting & Impact" du workspace MD
// MVP : KPIs financiers agrégés (NAV, MOIC, IRR, TVPI), distribution pays/secteur,
// listing rapports LP existants + bouton "Générer rapport LP" qui redirige vers
// /pe/reporting-lp (page existante avec dialog complet de génération).
// Backlog : carte géographique interactive, donut sectoriel recharts, 6 ODD agrégés.
import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, TrendingUp, Briefcase, DollarSign, Activity, Target, Globe, FileText, Eye, Plus, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import StatCard from '@/components/shared/StatCard';
import { useFundCurrency } from '@/hooks/useFundCurrency';
import { useFxRates } from '@/hooks/useFxRates';
import { convertCurrency } from '@/lib/currency-conversion';

interface Props {
  organizationId: string;
}

interface PortfolioKpis {
  participations: number;
  totalInvested: number;
  totalNav: number;
  avgMoic: number | null;
  avgIrr: number | null;
  tvpi: number | null;
  alertsOpen: number;
  currency: string;
}

interface Distribution {
  countries: { name: string; count: number }[];
  sectors: { name: string; count: number }[];
}

interface LpReportRow {
  id: string;
  format: 'participation' | 'portfolio';
  period: string;
  period_start: string;
  period_end: string;
  status: 'draft' | 'finalized' | 'sent';
  generated_at: string;
  data: any;
}

const STATUS_META: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-700 border-slate-200',
  finalized: 'bg-blue-50 text-blue-700 border-blue-200',
  sent: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

function fmtMoney(amount: number, currency: string) {
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M ${currency}`;
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(0)}K ${currency}`;
  return `${amount} ${currency}`;
}

export default function PeReportingImpactTab({ organizationId }: Props) {
  const navigate = useNavigate();
  const { currency: fundCurrency } = useFundCurrency(organizationId);
  const { rates: fxRates } = useFxRates();
  const [kpis, setKpis] = useState<PortfolioKpis | null>(null);
  const [distribution, setDistribution] = useState<Distribution>({ countries: [], sectors: [] });
  const [reports, setReports] = useState<LpReportRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);

    // 1. Deals en portfolio (closing, portfolio, exit_prep, exited)
    const { data: dealsData } = await supabase
      .from('pe_deals')
      .select('id, ticket_demande, currency, enterprise_id, enterprises(name, sector, country)')
      .eq('organization_id', organizationId)
      .in('stage', ['closing', 'portfolio', 'exit_prep', 'exited']);

    const deals = dealsData ?? [];
    const dealIds = deals.map((d: any) => d.id);

    // 2. Dernière valuation périodique par deal (NAV, MOIC, IRR — pe_periodic_valuations)
    const { data: valData } = dealIds.length
      ? await (supabase as any)
          .from('pe_periodic_valuations')
          .select('deal_id, nav_amount, moic_to_date, irr_to_date, period_end')
          .in('deal_id', dealIds)
          .order('period_end', { ascending: false })
      : { data: [] as any[] };

    // Garde la plus récente par deal
    const lastValPerDeal = new Map<string, any>();
    (valData ?? []).forEach((v: any) => {
      if (!lastValPerDeal.has(v.deal_id)) lastValPerDeal.set(v.deal_id, v);
    });

    // 3. Alertes ouvertes
    const { count: alertsCount } = dealIds.length
      ? await supabase.from('pe_alert_signals').select('id', { count: 'exact', head: true })
          .in('deal_id', dealIds).is('resolved_at', null)
      : { count: 0 };

    // Agrégations
    let totalInvested = 0;
    let totalNav = 0;
    const moics: number[] = [];
    const irrs: number[] = [];
    const countryCounts = new Map<string, number>();
    const sectorCounts = new Map<string, number>();

    // Conversion vers la devise du fonds (Paramètres) avant agrégation.
    // ticket_demande et nav_amount sont stockés dans la devise du deal (auto-mappée par pays).
    deals.forEach((d: any) => {
      const dealCur = d.currency ?? fundCurrency;
      if (d.ticket_demande) {
        totalInvested += convertCurrency(Number(d.ticket_demande), dealCur, fundCurrency, fxRates);
      }
      if (d.enterprises?.country) countryCounts.set(d.enterprises.country, (countryCounts.get(d.enterprises.country) ?? 0) + 1);
      if (d.enterprises?.sector) sectorCounts.set(d.enterprises.sector, (sectorCounts.get(d.enterprises.sector) ?? 0) + 1);
      const v = lastValPerDeal.get(d.id);
      if (v?.nav_amount) totalNav += convertCurrency(Number(v.nav_amount), dealCur, fundCurrency, fxRates);
      if (v?.moic_to_date != null) moics.push(Number(v.moic_to_date));
      if (v?.irr_to_date != null) irrs.push(Number(v.irr_to_date));
    });

    const avgMoic = moics.length ? moics.reduce((a, b) => a + b, 0) / moics.length : null;
    const avgIrr = irrs.length ? irrs.reduce((a, b) => a + b, 0) / irrs.length : null;
    const tvpi = totalInvested > 0 ? totalNav / totalInvested : null;

    setKpis({
      participations: deals.length,
      totalInvested,
      totalNav,
      avgMoic,
      avgIrr,
      tvpi,
      alertsOpen: alertsCount ?? 0,
      currency: fundCurrency,
    });

    setDistribution({
      countries: [...countryCounts.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
      sectors: [...sectorCounts.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
    });

    // 4. Derniers rapports LP
    const { data: reportsData } = await supabase
      .from('pe_lp_reports')
      .select('id, format, period, period_start, period_end, status, generated_at, data')
      .eq('organization_id', organizationId)
      .order('generated_at', { ascending: false })
      .limit(10);
    setReports((reportsData ?? []) as any);

    setLoading(false);
  }, [organizationId, fundCurrency, fxRates]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-6">
      {/* === Section 1 : KPIs financiers agrégés === */}
      <div>
        <h3 className="text-xs uppercase tracking-wide text-violet-600 font-semibold mb-2">Performance du fonds</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard icon={Briefcase} value={kpis?.participations ?? 0} label="Participations" iconColor="text-violet-600" />
          <StatCard icon={DollarSign} value={kpis ? fmtMoney(kpis.totalInvested, kpis.currency) : '—'} label="Investi" iconColor="text-emerald-600" />
          <StatCard icon={TrendingUp} value={kpis ? fmtMoney(kpis.totalNav, kpis.currency) : '—'} label="NAV totale" iconColor="text-emerald-500" />
          <StatCard icon={Activity} value={kpis?.tvpi != null ? kpis.tvpi.toFixed(2) : '—'} label="TVPI" iconColor="text-primary" />
          <StatCard icon={Target} value={kpis?.avgMoic != null ? kpis.avgMoic.toFixed(2) : '—'} label="MOIC moyen" iconColor="text-blue-500" />
          <StatCard
            icon={TrendingUp}
            value={kpis?.avgIrr != null ? `${(kpis.avgIrr * 100).toFixed(1)}%` : '—'}
            label="IRR moyen"
            iconColor="text-violet-600"
          />
          <StatCard
            icon={AlertTriangle}
            value={kpis?.alertsOpen ?? 0}
            label="Alertes ouvertes"
            iconColor="text-amber-500"
            highlight={(kpis?.alertsOpen ?? 0) > 0 ? 'amber' : undefined}
          />
        </div>
      </div>

      {/* === Section 2 : Distribution pays / secteur === */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4">
            <h3 className="text-xs uppercase tracking-wide text-violet-600 font-semibold mb-3 flex items-center gap-2">
              <Globe className="h-3.5 w-3.5" /> Répartition géographique
            </h3>
            {distribution.countries.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune participation en portfolio.</p>
            ) : (
              <ul className="space-y-2">
                {distribution.countries.map(c => {
                  const pct = kpis?.participations ? (c.count / kpis.participations) * 100 : 0;
                  return (
                    <li key={c.name} className="text-sm">
                      <div className="flex justify-between mb-0.5">
                        <span>{c.name}</span>
                        <span className="text-muted-foreground tabular-nums">{c.count} · {pct.toFixed(0)}%</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded">
                        <div className="h-full bg-violet-500 rounded" style={{ width: `${pct}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <h3 className="text-xs uppercase tracking-wide text-violet-600 font-semibold mb-3 flex items-center gap-2">
              <Target className="h-3.5 w-3.5" /> Répartition sectorielle
            </h3>
            {distribution.sectors.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune participation en portfolio.</p>
            ) : (
              <ul className="space-y-2">
                {distribution.sectors.map(s => {
                  const pct = kpis?.participations ? (s.count / kpis.participations) * 100 : 0;
                  return (
                    <li key={s.name} className="text-sm">
                      <div className="flex justify-between mb-0.5">
                        <span>{s.name}</span>
                        <span className="text-muted-foreground tabular-nums">{s.count} · {pct.toFixed(0)}%</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded">
                        <div className="h-full bg-emerald-500 rounded" style={{ width: `${pct}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* === Section 3 : Rapports LPs === */}
      <div>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
          <h3 className="text-xs uppercase tracking-wide text-violet-600 font-semibold flex items-center gap-2">
            <FileText className="h-3.5 w-3.5" /> Rapports LPs
          </h3>
          <Button onClick={() => navigate('/pe/reporting-lp')} className="gap-2" size="sm">
            <Plus className="h-4 w-4" /> Générer un rapport
          </Button>
        </div>

        {reports.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <FileText className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
              <p className="text-sm">Aucun rapport LP encore généré.</p>
              <p className="text-xs mt-1">Clique "Générer un rapport" pour créer ton premier rapport (participation ou portfolio).</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {reports.map(r => {
              const isPortfolio = r.format === 'portfolio';
              const dealName = isPortfolio ? 'Portfolio agrégé' : (r.data?.deal?.name ?? r.data?.deal?.ref ?? 'Participation');
              return (
                <Card key={r.id}>
                  <CardContent className="py-3 flex items-center gap-3 flex-wrap">
                    <FileText className="h-5 w-5 text-violet-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{dealName}</span>
                        <Badge variant="outline" className="text-[10px]">{isPortfolio ? 'Portfolio' : 'Participation'}</Badge>
                        <Badge variant="outline" className="text-[10px]">{r.period}</Badge>
                        <Badge variant="outline" className={`text-[10px] ${STATUS_META[r.status] ?? ''}`}>{r.status}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 tabular-nums">
                        {r.period_start} → {r.period_end} · généré le {new Date(r.generated_at).toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                    <Button variant="outline" size="sm" className="gap-1 h-7 text-xs" onClick={() => navigate('/pe/reporting-lp')}>
                      <Eye className="h-3 w-3" /> Voir
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
            {reports.length >= 10 && (
              <p className="text-xs text-center text-muted-foreground">
                <Button variant="link" size="sm" onClick={() => navigate('/pe/reporting-lp')}>
                  Voir tous les rapports →
                </Button>
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
