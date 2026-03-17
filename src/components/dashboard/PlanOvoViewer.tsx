import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { useMemo } from 'react';

const YEAR_KEYS = ['year_minus_2', 'year_minus_1', 'current_year', 'year2', 'year3', 'year4', 'year5', 'year6'] as const;

const fmt = (n: any) => {
  const v = Number(n);
  if (!v && v !== 0) return '—';
  return new Intl.NumberFormat('fr-FR').format(Math.round(v));
};

const pct = (n: any) => {
  const v = Number(n);
  if (isNaN(v)) return '—';
  return `${v.toFixed(1)}%`;
};

function yearLabel(key: string, years: any): string {
  if (years?.[key]) return String(years[key]);
  const map: Record<string, string> = {
    year_minus_2: 'N-2', year_minus_1: 'N-1', current_year: 'N',
    year2: 'N+1', year3: 'N+2', year4: 'N+3', year5: 'N+4', year6: 'N+5',
  };
  return map[key] || key;
}

function getYearSeries(obj: any): number[] {
  if (!obj) return YEAR_KEYS.map(() => 0);
  return YEAR_KEYS.map(k => Number(obj[k]) || 0);
}

// ===== Financial Calculations (fallback) =====
function calcCAGR(start: number, end: number, years: number): number | null {
  if (!start || start <= 0 || !end || end <= 0 || years <= 0) return null;
  return (Math.pow(end / start, 1 / years) - 1) * 100;
}

function calcNPV(cashflows: number[], rate: number, initialInvestment: number): number {
  let npv = -initialInvestment;
  for (let i = 0; i < cashflows.length; i++) {
    npv += cashflows[i] / Math.pow(1 + rate, i + 1);
  }
  return npv;
}

function calcIRR(cashflows: number[], initialInvestment: number): number | null {
  // Newton's method to find rate where NPV = 0
  let rate = 0.1;
  for (let iter = 0; iter < 100; iter++) {
    let npv = -initialInvestment;
    let dnpv = 0;
    for (let i = 0; i < cashflows.length; i++) {
      const t = i + 1;
      const d = Math.pow(1 + rate, t);
      npv += cashflows[i] / d;
      dnpv -= t * cashflows[i] / Math.pow(1 + rate, t + 1);
    }
    if (Math.abs(npv) < 1) return rate * 100;
    if (dnpv === 0) return null;
    rate -= npv / dnpv;
    if (rate < -0.99 || rate > 10) return null;
  }
  return null;
}

function calcPayback(cashflows: number[], investment: number): number | null {
  let cumulative = 0;
  for (let i = 0; i < cashflows.length; i++) {
    cumulative += cashflows[i];
    if (cumulative >= investment) return i + 1;
  }
  return null;
}

// ===== Metric Card =====
function MetricCard({ label, value, unit, status, description }: {
  label: string; value: string; unit?: string; status: 'good' | 'warning' | 'bad' | 'neutral'; description?: string;
}) {
  const statusStyles = {
    good: 'border-green-500/30 bg-green-500/5',
    warning: 'border-yellow-500/30 bg-yellow-500/5',
    bad: 'border-red-500/30 bg-red-500/5',
    neutral: 'border-border bg-muted/10',
  };
  const dotStyles = {
    good: 'bg-green-500',
    warning: 'bg-yellow-500',
    bad: 'bg-red-500',
    neutral: 'bg-muted-foreground',
  };
  return (
    <div className={`p-3 rounded-lg border ${statusStyles[status]}`}>
      <div className="flex items-center gap-1.5 mb-1">
        <div className={`w-2 h-2 rounded-full ${dotStyles[status]}`} />
        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
      </div>
      <p className="text-lg font-bold text-foreground">{value}{unit && <span className="text-xs font-normal text-muted-foreground ml-1">{unit}</span>}</p>
      {description && <p className="text-[9px] text-muted-foreground mt-0.5">{description}</p>}
    </div>
  );
}

// ===== KPI Card =====
function KpiCard({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <Card className="flex-1 min-w-[140px]">
      <CardContent className="py-3 px-4">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{icon} {label}</p>
        <p className="text-lg font-bold text-foreground mt-0.5">{value}</p>
        <p className="text-[9px] text-muted-foreground">FCFA</p>
      </CardContent>
    </Card>
  );
}

export default function PlanOvoViewer({ data, staleness: _staleness }: { data: any; staleness?: { frameworkUpdatedAt: any; planOvoUpdatedAt: any } }) {
  const years = data.years || {};
  const labels = YEAR_KEYS.map(k => yearLabel(k, years));
  const revSeries = getYearSeries(data.revenue);
  const cogsSeries = getYearSeries(data.cogs);
  const gpSeries = getYearSeries(data.gross_profit);
  const ebitdaSeries = getYearSeries(data.ebitda);
  // Compute margin % live to avoid stale stored values from old generations
  const gpPctSeries = gpSeries.map((gp, i) => revSeries[i] > 0 ? (gp / revSeries[i]) * 100 : 0);
  const ebitdaPctSeries = ebitdaSeries.map((ebitda, i) => revSeries[i] > 0 ? (ebitda / revSeries[i]) * 100 : 0);
  const npSeries = getYearSeries(data.net_profit);
  const cfSeries = getYearSeries(data.cashflow);

  // Investment metrics - AI provided or fallback calculation
  const metrics = useMemo(() => {
    const ai = data.investment_metrics;
    const currentIdx = 2;
    // Future cashflows: year2..year6 (indices 3-7)
    const futureCf = cfSeries.slice(3);
    void ebitdaSeries.slice(3); // futureEbitda reserved
    // Total investment
    const capexTotal = (data.capex || []).reduce((s: number, c: any) => s + (Number(c.acquisition_value) || 0), 0);
    const fundingNeed = Number(data.funding_need) || 0;
    const totalInvestment = Math.max(fundingNeed, capexTotal) || 1;
    // Debt service
    const loans = data.loans || {};
    let annualDebtService = 0;
    for (const l of Object.values(loans)) {
      const loan = l as { amount?: number; term_years?: number; rate?: number };
      const amount = Number(loan?.amount) || 0;
      const term = Number(loan?.term_years) || 1;
      const rate = Number(loan?.rate) || 0;
      if (amount > 0) annualDebtService += amount * (rate + 1 / term);
    }

    const discountRate = ai?.discount_rate || 0.12;
    const nYears = 5;

    // AI returns decimals (0.15 = 15%), fallback calcIRR/calcCAGR also return decimals → multiply by 100 for display

    // Guard: DSCR and Multiple EBITDA are meaningless when first projection year EBITDA is negative
    const year2Ebitda = ebitdaSeries[3] ?? 0; // index 3 = year2 (first projection year)

    return {
      van: ai?.van ?? calcNPV(futureCf, discountRate, totalInvestment),
      // AI returns decimals (0.15), fallback functions return % (15) — normalise to %
      tri: ai?.tri != null ? ai.tri * 100 : calcIRR(futureCf, totalInvestment),
      cagr_revenue: ai?.cagr_revenue != null ? ai.cagr_revenue * 100 : calcCAGR(revSeries[currentIdx], revSeries[7], nYears),
      cagr_ebitda: ai?.cagr_ebitda != null ? ai.cagr_ebitda * 100 : calcCAGR(ebitdaSeries[currentIdx], ebitdaSeries[7], nYears),
      roi: ai?.roi != null ? ai.roi * 100 : (totalInvestment > 0 ? (npSeries.slice(3).reduce((a, b) => a + b, 0) / totalInvestment) * 100 : null),
      payback_years: ai?.payback_years ?? calcPayback(futureCf, totalInvestment),
      dscr: year2Ebitda <= 0 ? null : (ai?.dscr ?? (annualDebtService > 0 ? ebitdaSeries[currentIdx] / annualDebtService : null)),
      multiple_ebitda: year2Ebitda <= 0 ? null : (ai?.multiple_ebitda ?? null),
      discount_rate: discountRate * 100,
      cost_of_capital: (ai?.cost_of_capital || 0.12) * 100,
    };
  }, [data, cfSeries, ebitdaSeries, revSeries, npSeries]);

  // Status thresholds
  const vanStatus = (v: number | null) => v == null ? 'neutral' as const : v > 0 ? 'good' as const : v > -1e6 ? 'warning' as const : 'bad' as const;
  const triStatus = (v: number | null) => v == null ? 'neutral' as const : v > 15 ? 'good' as const : v > 8 ? 'warning' as const : 'bad' as const;
  const cagrStatus = (v: number | null) => v == null ? 'neutral' as const : v > 20 ? 'good' as const : v > 10 ? 'warning' as const : 'bad' as const;
  const roiStatus = (v: number | null) => v == null ? 'neutral' as const : v > 30 ? 'good' as const : v > 10 ? 'warning' as const : 'bad' as const;
  const paybackStatus = (v: number | null) => v == null ? 'neutral' as const : v <= 3 ? 'good' as const : v <= 5 ? 'warning' as const : 'bad' as const;
  const dscrStatus = (v: number | null) => v == null ? 'neutral' as const : v > 1.5 ? 'good' as const : v > 1 ? 'warning' as const : 'bad' as const;
  const multipleEbitdaStatus = (v: number | null) => v == null ? 'neutral' as const : v >= 5 ? 'good' as const : v >= 3 ? 'warning' as const : 'bad' as const;

  const fmtMetric = (v: number | null, suffix = '') => v == null ? '—' : `${v.toFixed(1)}${suffix}`;

  // Chart data
  const chartData = YEAR_KEYS.map((_k, i) => ({
    name: labels[i],
    Revenue: revSeries[i],
    EBITDA: ebitdaSeries[i],
    'Net Profit': npSeries[i],
    Cashflow: cfSeries[i],
  }));

  const opex = data.opex || {};
  const opexLabels: Record<string, string> = {
    staff_salaries: 'Salaires', marketing: 'Marketing', office_costs: 'Bureaux',
    travel: 'Déplacements', insurance: 'Assurances', maintenance: 'Maintenance',
    third_parties: 'Prestataires', other: 'Autres',
  };

  const summaryRows = [
    { label: 'Chiffre d\'affaires', values: revSeries, bold: true },
    { label: 'Coûts directs (COGS)', values: cogsSeries },
    { label: 'Marge brute', values: gpSeries, bold: true },
    { label: 'Marge brute %', values: gpPctSeries, isPct: true },
    { label: 'EBITDA', values: ebitdaSeries, bold: true },
    { label: 'Marge EBITDA %', values: ebitdaPctSeries, isPct: true },
    { label: 'Résultat net', values: npSeries, bold: true },
    { label: 'Cash-Flow', values: cfSeries },
  ];

  const currentIdx = 2;

  return (
    <div className="space-y-5">
      {/* Estimation Banner */}
      {data.estimation_sectorielle && (
        <Card className="border-amber-400/50 bg-amber-50 dark:bg-amber-950/30">
          <CardContent className="py-3">
            <div className="flex items-start gap-2">
              <span className="text-lg">⚠️</span>
              <div>
                <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">Projections indicatives</p>
                <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                  Ce plan financier est basé sur des estimations sectorielles et les informations du BMC/SIC. 
                  <strong> Uploadez le template Analyse Financière Excel</strong> pour un plan financier basé sur vos données comptables réelles.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-foreground">Plan Financier OVO</h3>
          <p className="text-xs text-muted-foreground">
            {data.company || '—'} • {data.country || 'Côte d\'Ivoire'} • {data.currency || 'XOF'}
          </p>
        </div>
        {data.score != null && (
          <div className="text-center">
            <Badge variant={data.score >= 70 ? 'default' : data.score >= 40 ? 'secondary' : 'destructive'} className="text-sm px-3 py-1">
              {data.score}/100
            </Badge>
            <Progress value={data.score} className="w-24 h-1.5 mt-1" />
          </div>
        )}
      </div>

      {/* KPI Bar */}
      <div className="flex flex-wrap gap-3">
        <KpiCard label="Revenue" value={fmt(revSeries[currentIdx])} icon="💰" />
        <KpiCard label="Marge brute" value={fmt(gpSeries[currentIdx])} icon="📊" />
        <KpiCard label="EBITDA" value={fmt(ebitdaSeries[currentIdx])} icon="📈" />
        <KpiCard label="Résultat net" value={fmt(npSeries[currentIdx])} icon="🎯" />
      </div>

      {/* ===== INVESTMENT METRICS ===== */}
      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm">📐 Indicateurs de décision d'investissement</CardTitle>
        </CardHeader>
        <CardContent className="py-2">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <MetricCard
              label="VAN (NPV)"
              value={metrics.van != null ? fmt(metrics.van) : '—'}
              unit="FCFA"
              status={vanStatus(metrics.van)}
              description={`Taux d'actualisation: ${metrics.discount_rate.toFixed(0)}%`}
            />
            <MetricCard
              label="TRI (IRR)"
              value={fmtMetric(metrics.tri, '%')}
              status={triStatus(metrics.tri)}
              description={metrics.tri != null && metrics.cost_of_capital ? `vs coût du capital ${metrics.cost_of_capital.toFixed(0)}%` : undefined}
            />
            <MetricCard
              label="CAGR Revenue"
              value={fmtMetric(metrics.cagr_revenue, '%')}
              status={cagrStatus(metrics.cagr_revenue)}
              description="Croissance annuelle composée du CA"
            />
            <MetricCard
              label="CAGR EBITDA"
              value={fmtMetric(metrics.cagr_ebitda, '%')}
              status={cagrStatus(metrics.cagr_ebitda)}
              description="Croissance annuelle composée EBITDA"
            />
            <MetricCard
              label="ROI"
              value={fmtMetric(metrics.roi, '%')}
              status={roiStatus(metrics.roi)}
              description="Retour sur investissement cumulé"
            />
            <MetricCard
              label="Payback"
              value={metrics.payback_years != null ? `${metrics.payback_years}` : '—'}
              unit="ans"
              status={paybackStatus(metrics.payback_years)}
              description="Délai de récupération"
            />
            <MetricCard
              label="DSCR"
              value={metrics.dscr != null ? metrics.dscr.toFixed(2) : '—'}
              unit="x"
              status={dscrStatus(metrics.dscr)}
              description="Couverture du service de la dette"
            />
            <MetricCard
              label="Multiple EBITDA"
              value={metrics.multiple_ebitda != null ? `${Number(metrics.multiple_ebitda).toFixed(1)}` : '—'}
              unit="x"
              status={multipleEbitdaStatus(metrics.multiple_ebitda != null ? Number(metrics.multiple_ebitda) : null)}
              description="Valorisation / EBITDA"
            />
          </div>

          {/* TRI vs Cost of Capital gauge */}
          {metrics.tri != null && metrics.cost_of_capital > 0 && (
            <div className="mt-4 p-3 rounded-lg border bg-muted/10">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-muted-foreground">TRI vs Coût du capital</span>
                <span className="font-semibold">
                  {metrics.tri.toFixed(1)}% / {metrics.cost_of_capital.toFixed(0)}%
                </span>
              </div>
              <div className="relative h-3 bg-muted rounded-full overflow-hidden">
                {/* Cost of capital marker */}
                <div
                  className="absolute top-0 h-full w-0.5 bg-destructive z-10"
                  style={{ left: `${Math.min(metrics.cost_of_capital / Math.max(metrics.tri, metrics.cost_of_capital, 30) * 100, 100)}%` }}
                />
                {/* TRI bar */}
                <div
                  className={`h-full rounded-full transition-all ${metrics.tri > metrics.cost_of_capital ? 'bg-green-500' : 'bg-red-500'}`}
                  style={{ width: `${Math.min(metrics.tri / Math.max(metrics.tri, metrics.cost_of_capital, 30) * 100, 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-[9px] text-muted-foreground mt-1">
                <span>0%</span>
                <span className="text-destructive font-semibold">Seuil: {metrics.cost_of_capital.toFixed(0)}%</span>
                <span>{Math.max(metrics.tri, metrics.cost_of_capital, 30).toFixed(0)}%</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary Table */}
      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm">📋 Compte de résultat prévisionnel</CardTitle>
        </CardHeader>
        <CardContent className="px-0 pb-3">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs min-w-[140px]">Poste</TableHead>
                  {labels.map((l, i) => (
                    <TableHead key={i} className="text-xs text-right min-w-[90px]">{l}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {summaryRows.map((row, ri) => (
                  <TableRow key={ri} className={row.bold ? 'bg-muted/30' : ''}>
                    <TableCell className={`text-xs ${row.bold ? 'font-semibold' : 'text-muted-foreground pl-6'}`}>
                      {row.label}
                    </TableCell>
                    {row.values.map((v, ci) => (
                      <TableCell key={ci} className={`text-xs text-right ${row.bold ? 'font-semibold' : ''}`}>
                        {row.isPct ? pct(v) : fmt(v)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Revenue vs EBITDA Chart */}
      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm">📊 Revenue vs EBITDA</CardTitle>
        </CardHeader>
        <CardContent className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1e6).toFixed(0)}M`} />
              <Tooltip formatter={(v: number) => fmt(v) + ' FCFA'} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="EBITDA" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Net Profit & Cashflow Line Chart */}
      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm">📈 Résultat net & Cash-Flow</CardTitle>
        </CardHeader>
        <CardContent className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1e6).toFixed(0)}M`} />
              <Tooltip formatter={(v: number) => fmt(v) + ' FCFA'} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="Net Profit" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="Cashflow" stroke="hsl(var(--accent))" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* OPEX Detail */}
      {Object.keys(opex).length > 0 && (
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm">🏢 Charges d'exploitation (OPEX)</CardTitle>
          </CardHeader>
          <CardContent className="px-0 pb-3">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs min-w-[120px]">Poste</TableHead>
                    {labels.map((l, i) => (
                      <TableHead key={i} className="text-xs text-right min-w-[80px]">{l}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(opexLabels).map(([key, label]) => {
                    const row = opex[key];
                    if (!row) return null;
                    const vals = getYearSeries(row);
                    if (vals.every(v => v === 0)) return null;
                    return (
                      <TableRow key={key}>
                        <TableCell className="text-xs text-muted-foreground">{label}</TableCell>
                        {vals.map((v, i) => (
                          <TableCell key={i} className="text-xs text-right">{fmt(v)}</TableCell>
                        ))}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Staff */}
      {data.staff?.length > 0 && (
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm">👥 Personnel</CardTitle>
          </CardHeader>
          <CardContent className="px-0 pb-3">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Catégorie</TableHead>
                  <TableHead className="text-xs">Département</TableHead>
                  <TableHead className="text-xs text-right">Charges sociales</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.staff.map((s: any, i: number) => (
                  <TableRow key={i}>
                    <TableCell className="text-xs font-medium">{s.label}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{s.department}</TableCell>
                    <TableCell className="text-xs text-right">{pct((s.social_security_rate || 0) * 100)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* CAPEX */}
      {data.capex?.length > 0 && (
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm">🏗️ Investissements (CAPEX)</CardTitle>
          </CardHeader>
          <CardContent className="px-0 pb-3">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Investissement</TableHead>
                  <TableHead className="text-xs text-right">Année</TableHead>
                  <TableHead className="text-xs text-right">Montant (FCFA)</TableHead>
                  <TableHead className="text-xs text-right">Amortissement</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.capex.map((c: any, i: number) => (
                  <TableRow key={i}>
                    <TableCell className="text-xs font-medium">{c.label}</TableCell>
                    <TableCell className="text-xs text-right">{c.acquisition_year}</TableCell>
                    <TableCell className="text-xs text-right">{fmt(c.acquisition_value)}</TableCell>
                    <TableCell className="text-xs text-right">{pct((c.amortisation_rate_pct || 0) * 100)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Loans */}
      {data.loans && (
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm">🏦 Financement</CardTitle>
          </CardHeader>
          <CardContent className="py-2">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {Object.entries(data.loans).map(([key, loan]: [string, any]) => {
                if (!loan?.amount) return null;
                const loanLabels: Record<string, string> = { ovo: 'Prêt OVO', family: 'Prêt Famille', bank: 'Prêt Banque' };
                return (
                  <div key={key} className="p-3 rounded-lg border bg-muted/20">
                    <p className="text-xs font-semibold">{loanLabels[key] || key}</p>
                    <p className="text-sm font-bold mt-1">{fmt(loan.amount)} FCFA</p>
                    <p className="text-[10px] text-muted-foreground">Taux: {pct((loan.rate || 0) * 100)} • {loan.term_years} ans</p>
                  </div>
                );
              })}
            </div>
            {data.funding_need != null && data.funding_need > 0 && (
              <div className="mt-3 p-2 rounded bg-primary/10 text-xs">
                <span className="font-semibold">Besoin de financement total: </span>
                <span className="font-bold text-primary">{fmt(data.funding_need)} FCFA</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Break-even */}
      {data.break_even_year && (
        <Card className="border-green-500/30 bg-green-500/5">
          <CardContent className="py-3 px-4 flex items-center gap-3">
            <span className="text-2xl">🎯</span>
            <div>
              <p className="text-xs font-semibold text-green-600">Point mort atteint en</p>
              <p className="text-lg font-bold text-green-600">{data.break_even_year}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Key Assumptions */}
      {data.key_assumptions?.length > 0 && (
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm">📝 Hypothèses clés</CardTitle>
          </CardHeader>
          <CardContent className="py-2">
            <ul className="space-y-1">
              {data.key_assumptions.map((a: string, i: number) => (
                <li key={i} className="text-xs flex gap-2">
                  <span className="text-primary shrink-0">•</span>
                  <span>{a}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Scenarios OVO */}
      {data.scenarios && (
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm">🔮 Scénarios OVO (Optimiste-Vraisemblable-Pessimiste)</CardTitle>
          </CardHeader>
          <CardContent className="py-2 space-y-3">
            {(['optimiste', 'realiste', 'pessimiste'] as const).map(key => {
              const s = data.scenarios[key];
              if (!s) return null;
              const icons: Record<string, string> = { optimiste: '🚀', realiste: '📊', pessimiste: '⚠️' };
              const colors: Record<string, string> = {
                optimiste: 'border-green-500/30 bg-green-500/5',
                realiste: 'border-primary/30 bg-primary/5',
                pessimiste: 'border-yellow-500/30 bg-yellow-500/5',
              };
              return (
                <div key={key} className={`p-3 rounded-lg border ${colors[key]}`}>
                  <p className="text-xs font-bold uppercase mb-1">{icons[key]} Scénario {key}</p>
                  <p className="text-[11px] text-muted-foreground mb-2">{s.hypotheses}</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                    <div><span className="text-muted-foreground">Croissance:</span> <span className="font-semibold">{s.taux_croissance_ca}</span></div>
                    {s.revenue_year5 != null && <div><span className="text-muted-foreground">CA An 5:</span> <span className="font-semibold">{fmt(s.revenue_year5)}</span></div>}
                    {s.ebitda_year5 != null && <div><span className="text-muted-foreground">EBITDA An 5:</span> <span className="font-semibold">{fmt(s.ebitda_year5)}</span></div>}
                    {s.net_profit_year5 != null && <div><span className="text-muted-foreground">Résultat An 5:</span> <span className="font-semibold">{fmt(s.net_profit_year5)}</span></div>}
                    {s.van != null && <div><span className="text-muted-foreground">VAN:</span> <span className="font-semibold">{fmt(s.van)}</span></div>}
                    {s.tri != null && <div><span className="text-muted-foreground">TRI:</span> <span className="font-semibold">{pct(s.tri * 100)}</span></div>}
                  </div>
                  {s.projections?.length > 0 && (
                    <div className="mt-2 overflow-x-auto">
                      <table className="w-full text-[11px]">
                        <thead><tr className="border-b border-border/30">
                          <th className="text-left py-1">Année</th><th className="text-right py-1">CA</th><th className="text-right py-1">Résultat</th><th className="text-right py-1">Trésorerie</th>
                        </tr></thead>
                        <tbody>
                          {s.projections.map((p: any, i: number) => (
                            <tr key={i} className="border-b border-border/20">
                              <td className="py-0.5">{p.annee}</td>
                              <td className="text-right">{fmt(p.ca)}</td>
                              <td className="text-right">{fmt(p.resultat_net)}</td>
                              <td className="text-right">{fmt(p.tresorerie)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Scenario Comparison Table */}
            <div className="mt-2">
              <p className="text-xs font-semibold mb-2">📊 Comparaison des scénarios</p>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Indicateur</TableHead>
                      <TableHead className="text-xs text-right">🚀 Optimiste</TableHead>
                      <TableHead className="text-xs text-right">📊 Réaliste</TableHead>
                      <TableHead className="text-xs text-right">⚠️ Pessimiste</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="text-xs font-medium">CA An 5</TableCell>
                      {(['optimiste', 'realiste', 'pessimiste'] as const).map(k => (
                        <TableCell key={k} className="text-xs text-right">{fmt(data.scenarios[k]?.revenue_year5)}</TableCell>
                      ))}
                    </TableRow>
                    <TableRow>
                      <TableCell className="text-xs font-medium">EBITDA An 5</TableCell>
                      {(['optimiste', 'realiste', 'pessimiste'] as const).map(k => (
                        <TableCell key={k} className="text-xs text-right">{fmt(data.scenarios[k]?.ebitda_year5)}</TableCell>
                      ))}
                    </TableRow>
                    <TableRow>
                      <TableCell className="text-xs font-medium">Résultat net An 5</TableCell>
                      {(['optimiste', 'realiste', 'pessimiste'] as const).map(k => (
                        <TableCell key={k} className="text-xs text-right">{fmt(data.scenarios[k]?.net_profit_year5)}</TableCell>
                      ))}
                    </TableRow>
                    <TableRow className="bg-muted/20">
                      <TableCell className="text-xs font-semibold">VAN</TableCell>
                      {(['optimiste', 'realiste', 'pessimiste'] as const).map(k => (
                        <TableCell key={k} className="text-xs text-right font-semibold">{fmt(data.scenarios[k]?.van)}</TableCell>
                      ))}
                    </TableRow>
                    <TableRow className="bg-muted/20">
                      <TableCell className="text-xs font-semibold">TRI</TableCell>
                      {(['optimiste', 'realiste', 'pessimiste'] as const).map(k => (
                        <TableCell key={k} className="text-xs text-right font-semibold">{data.scenarios[k]?.tri != null ? pct(data.scenarios[k].tri * 100) : '—'}</TableCell>
                      ))}
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recommendations */}
      {data.recommandations?.length > 0 && (
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm">🎯 Recommandations</CardTitle>
          </CardHeader>
          <CardContent className="py-2">
            <ul className="space-y-1">
              {data.recommandations.map((r: string, i: number) => (
                <li key={i} className="text-xs flex gap-2"><span className="text-primary">→</span>{r}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Products & Services */}
      {(data.products?.length > 0 || data.services?.length > 0) && (
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm">🛍️ Produits & Services</CardTitle>
          </CardHeader>
          <CardContent className="py-2">
            <div className="flex flex-wrap gap-2">
              {(data.products || []).map((p: any, i: number) => (
                <Badge key={`p-${i}`} variant="outline" className="text-[10px]">
                  📦 {p.name} ({p.range} • {p.channel})
                </Badge>
              ))}
              {(data.services || []).map((s: any, i: number) => (
                <Badge key={`s-${i}`} variant="secondary" className="text-[10px]">
                  🔧 {s.name} ({s.range} • {s.channel})
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
