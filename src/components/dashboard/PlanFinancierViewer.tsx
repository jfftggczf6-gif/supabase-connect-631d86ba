import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ComposedChart,
} from 'recharts';
import { useMemo } from 'react';
import { getDevise } from '@/lib/format-currency';

// ─── Helpers ──────────────────────────────────────────────────

const fmt = (n: any) => {
  const v = Number(n);
  if (!v && v !== 0) return '—';
  return new Intl.NumberFormat('fr-FR').format(Math.round(v));
};

const fmtM = (n: any) => {
  const v = Number(n);
  if (!v && v !== 0) return '—';
  if (Math.abs(v) >= 1e9) return `${(v / 1e9).toFixed(1)}Mrd`;
  if (Math.abs(v) >= 1e6) return `${(v / 1e6).toFixed(0)}M`;
  if (Math.abs(v) >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
  return fmt(v);
};

const pctFmt = (n: any) => {
  const v = Number(n);
  if (isNaN(v)) return '—';
  return `${v.toFixed(1)}%`;
};


// ─── Types ────────────────────────────────────────────────────

interface PlanFinancierViewerProps {
  data: any;
}

// ─── Main Component ───────────────────────────────────────────

export default function PlanFinancierViewer({ data }: PlanFinancierViewerProps) {
  const devise = getDevise(data);
  const analyse = data.analyse || {};
  const kpis = data.kpis || {};
  const projections = data.projections || [];
  const sante = data.sante_financiere || {};
  const seuil = data.seuil_rentabilite || {};
  const indicateurs = data.indicateurs_decision || {};
  const produits = data.produits || [];
  
  const staff = data.staff || [];
  const capexItems = data.capex || [];
  const loans = data.loans || {};
  const scenarios = data.scenarios || {};

  // Chart data
  const chartData = useMemo(() =>
    projections.map((p: any) => ({
      name: String(p.annee_num),
      CA: p.ca,
      EBITDA: p.ebitda,
      'Résultat net': p.resultat_net,
      isReel: p.is_reel,
    })),
  [projections]);

  const cyProj = projections.find((p: any) => p.annee === 'CURRENT YEAR');
  const y5Proj = projections[projections.length - 1];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-foreground">Plan Financier</h3>
          <p className="text-xs text-muted-foreground">
            {data.company || '—'} • {data.country || ''} • {data.currency || 'XOF'}
          </p>
        </div>
        {analyse.score_investissabilite != null && (
          <Badge variant={analyse.score_investissabilite >= 70 ? 'default' : analyse.score_investissabilite >= 40 ? 'secondary' : 'destructive'}
                 className="text-sm px-3 py-1">
            {analyse.score_investissabilite}/100
          </Badge>
        )}
      </div>

      <Tabs defaultValue="synthese" className="w-full">
        <TabsList className="w-full flex overflow-x-auto">
          <TabsTrigger value="synthese" className="text-[11px] flex-1">Synthèse</TabsTrigger>
          <TabsTrigger value="situation" className="text-[11px] flex-1">Situation actuelle</TabsTrigger>
          <TabsTrigger value="marges" className="text-[11px] flex-1">Marges</TabsTrigger>
          <TabsTrigger value="hypotheses" className="text-[11px] flex-1">Hypothèses</TabsTrigger>
          <TabsTrigger value="projections" className="text-[11px] flex-1">Projections</TabsTrigger>
          <TabsTrigger value="produits" className="text-[11px] flex-1">Produits & RH</TabsTrigger>
          <TabsTrigger value="investissement" className="text-[11px] flex-1">Investissement</TabsTrigger>
        </TabsList>

        {/* ═══════════ TAB 1: SYNTHÈSE ═══════════ */}
        <TabsContent value="synthese">
          <div className="space-y-4">
            {/* Avis IA */}
            {analyse.avis && (
              <Card>
                <CardContent className="py-4">
                  <p className="text-sm font-semibold mb-2">Avis de l'IA</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{analyse.avis}</p>
                  {analyse.tags?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {analyse.tags.map((t: string, i: number) => (
                        <Badge key={i} variant="outline" className="text-[10px]">{t}</Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Résumé chiffré */}
            <div className="bg-muted/30 rounded-lg px-3 py-2 text-[11px] text-muted-foreground">
              CA {fmtM(kpis.ca)} • Marge brute {pctFmt(sante.rentabilite?.marge_brute_pct)} • EBITDA {fmtM(cyProj?.ebitda)} ({pctFmt(cyProj?.ebitda_pct)}) • Résultat net {fmtM(kpis.resultat_net)} • Trésorerie {fmtM(kpis.tresorerie)} • {kpis.effectif || '—'} employés
            </div>

            {/* Hier vs Demain */}
            <div className="grid grid-cols-2 gap-3">
              <Card>
                <CardContent className="py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Hier — État des lieux</p>
                  <div className="space-y-1 text-xs">
                    <Row label="CA" value={fmtM(kpis.ca)} />
                    <Row label="Marge brute" value={pctFmt(sante.rentabilite?.marge_brute_pct)} />
                    <Row label="EBITDA" value={`${fmtM(cyProj?.ebitda)} (${pctFmt(cyProj?.ebitda_pct)})`} />
                    <Row label="Résultat net" value={fmtM(kpis.resultat_net)} color={kpis.resultat_net < 0 ? 'text-red-600' : undefined} />
                    <Row label="Trésorerie" value={fmtM(kpis.tresorerie)} />
                    <Row label="CA/employé" value={fmtM(sante.cycle_exploitation?.ca_par_employe)} />
                    <Row label="DSCR" value={sante.solvabilite?.dscr != null ? `${sante.solvabilite.dscr}x` : '—'} />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Demain — Projections 5 ans</p>
                  <div className="space-y-1 text-xs">
                    <Row label="CA An 5" value={fmtM(y5Proj?.ca)} color="text-green-600" />
                    <Row label="CAGR" value={y5Proj && cyProj?.ca ? pctFmt((Math.pow(y5Proj.ca / cyProj.ca, 1/5) - 1) * 100) : '—'} color="text-green-600" />
                    <Row label="Marge brute" value={pctFmt(y5Proj?.marge_brute_pct)} />
                    <Row label="EBITDA An 5" value={`${fmtM(y5Proj?.ebitda)} (${pctFmt(y5Proj?.ebitda_pct)})`} color="text-green-600" />
                    <Row label="Résultat net" value={fmtM(y5Proj?.resultat_net)} color="text-green-600" />
                    <Row label="Investissement" value={fmtM(capexItems.reduce((s: number, c: any) => s + (c.acquisition_value || c.montant || 0), 0))} />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Indicateurs de décision */}
            <Card>
              <CardContent className="py-3">
                <p className="text-sm font-semibold mb-3">Indicateurs de décision</p>
                <div className="grid grid-cols-4 gap-2">
                  <MetricBox label="VAN" value={indicateurs.van != null ? fmtM(indicateurs.van) : '—'} color={indicateurs.van > 0 ? 'text-green-600' : 'text-red-600'} />
                  <MetricBox label="TRI" value={indicateurs.tri != null ? `${indicateurs.tri}%` : '—'} color={indicateurs.tri > 15 ? 'text-green-600' : 'text-amber-600'} />
                  <MetricBox label="Payback" value={indicateurs.payback_years != null ? `${indicateurs.payback_years} ans` : '—'} color={indicateurs.payback_years <= 3 ? 'text-green-600' : 'text-amber-600'} />
                  <MetricBox label="DSCR moy." value={indicateurs.dscr_moyen != null ? `${indicateurs.dscr_moyen}x` : '—'} color={indicateurs.dscr_moyen > 1.5 ? 'text-green-600' : 'text-amber-600'} />
                  <MetricBox label="ROI" value={indicateurs.roi != null ? `${indicateurs.roi}%` : '—'} color={indicateurs.roi > 20 ? 'text-green-600' : 'text-amber-600'} />
                  <MetricBox label="Couv. intérêts" value={indicateurs.couverture_interets != null ? `${indicateurs.couverture_interets}x` : '—'} />
                  <MetricBox label="Cycle tréso" value={`${indicateurs.cycle_tresorerie || 0}j`} />
                  <MetricBox label="Runway" value={indicateurs.runway_mois != null ? `${indicateurs.runway_mois} mois` : '—'} color={indicateurs.runway_mois != null && indicateurs.runway_mois < 2 ? 'text-red-600' : undefined} />
                </div>
              </CardContent>
            </Card>

            {/* Graphique CA + EBITDA */}
            {chartData.length > 0 && (
              <Card>
                <CardHeader className="py-3 px-4"><CardTitle className="text-sm">CA & EBITDA — historique + projeté</CardTitle></CardHeader>
                <CardContent className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => fmtM(v)} />
                      <Tooltip formatter={(v: number) => `${fmt(v)} ${devise}`} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="CA" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} opacity={0.8} />
                      <Bar dataKey="EBITDA" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
                      <Line type="monotone" dataKey="Résultat net" stroke="#E24B4A" strokeWidth={2} dot={{ r: 3 }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {/* Risques clés */}
            {analyse.risques?.length > 0 && (
              <Card>
                <CardContent className="py-3">
                  <p className="text-sm font-semibold mb-3">Risques clés</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {analyse.risques.map((r: any, i: number) => (
                      <div key={i} className={`rounded-lg p-3 ${r.impact === 'critique' ? 'bg-red-50' : r.impact === 'élevé' ? 'bg-amber-50' : 'bg-muted/30'}`}>
                        <p className={`text-[11px] font-semibold ${r.impact === 'critique' ? 'text-red-700' : r.impact === 'élevé' ? 'text-amber-700' : 'text-foreground'}`}>{r.titre}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">{r.description}</p>
                        <p className={`text-[9px] font-semibold mt-2 ${r.impact === 'critique' ? 'text-red-600' : 'text-amber-600'}`}>{r.impact}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Cohérence BMC */}
            {analyse.coherence_bmc?.length > 0 && (
              <Card>
                <CardContent className="py-3">
                  <p className="text-sm font-semibold mb-2">Cohérence BMC ↔ Financiers</p>
                  <div className="space-y-1.5">
                    {analyse.coherence_bmc.map((c: any, i: number) => (
                      <div key={i} className={`rounded-lg px-3 py-2 text-[11px] ${c.niveau === 'erreur' ? 'bg-red-50 text-red-700' : c.niveau === 'warning' ? 'bg-amber-50 text-amber-700' : 'bg-muted/30 text-muted-foreground'}`}>
                        <span className="font-semibold mr-1">{c.niveau === 'erreur' ? '!!' : c.niveau === 'warning' ? '!' : '✓'}</span>
                        {c.texte}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Scénarios */}
            {Object.keys(scenarios).length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {['pessimiste', 'realiste', 'optimiste'].map((s) => {
                  const vals = scenarios[s] || [];
                  const caFinal = vals[vals.length - 1] || 0;
                  const cls = s === 'pessimiste' ? 'bg-red-50' : s === 'realiste' ? 'bg-green-50 border border-green-200' : 'bg-blue-50';
                  const txtCls = s === 'pessimiste' ? 'text-red-700' : s === 'realiste' ? 'text-green-700' : 'text-blue-700';
                  return (
                    <div key={s} className={`rounded-lg p-3 text-center ${cls}`}>
                      <p className={`text-[10px] font-semibold capitalize ${txtCls}`}>{s}</p>
                      <p className={`text-sm font-bold mt-1 ${txtCls}`}>{fmtM(caFinal)}</p>
                      <p className={`text-[9px] ${txtCls}`}>CA An 5</p>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Conditions d'investissement */}
            {analyse.conditions_investissement?.length > 0 && (
              <Card>
                <CardContent className="py-3">
                  <p className="text-sm font-semibold mb-2">Conditions d'investissement</p>
                  <div className="space-y-1.5">
                    {analyse.conditions_investissement.map((c: any, i: number) => (
                      <div key={i} className="flex gap-2 items-start text-xs">
                        <Badge variant="outline" className={`text-[9px] shrink-0 ${c.type === 'prealable' ? 'bg-red-50 text-red-700 border-red-200' : c.type === 'recommande' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-green-50 text-green-700 border-green-200'}`}>
                          {c.type === 'prealable' ? 'Préalable' : c.type === 'recommande' ? 'Recommandé' : 'Suivi'}
                        </Badge>
                        <span className="text-muted-foreground">{c.texte}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Score investissabilité — en bas, indicatif */}
            {analyse.score_investissabilite != null && (
              <div className={`rounded-lg p-4 flex items-center gap-4 ${analyse.score_investissabilite >= 70 ? 'bg-green-50 border border-green-200' : analyse.score_investissabilite >= 40 ? 'bg-amber-50 border border-amber-200' : 'bg-red-50 border border-red-200'}`}>
                <div className="text-center shrink-0">
                  <p className={`text-2xl font-bold ${analyse.score_investissabilite >= 70 ? 'text-green-700' : analyse.score_investissabilite >= 40 ? 'text-amber-700' : 'text-red-700'}`}>{analyse.score_investissabilite}</p>
                  <p className="text-[9px] text-muted-foreground">/100</p>
                </div>
                <div className="border-l pl-4">
                  <p className="text-sm font-semibold">Score investissabilité : {analyse.verdict || '—'}</p>
                  {analyse.avis && <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{analyse.avis}</p>}
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ═══════════ TAB 2: SITUATION ACTUELLE ═══════════ */}
        <TabsContent value="situation">
          <div className="space-y-4">
            {/* KPIs */}
            <div className="grid grid-cols-3 gap-2">
              <MetricBox label="CA" value={fmtM(kpis.ca)} sub={devise} />
              <MetricBox label="Résultat net" value={fmtM(kpis.resultat_net)} color={kpis.resultat_net < 0 ? 'text-red-600' : undefined} />
              <MetricBox label="Trésorerie" value={fmtM(kpis.tresorerie)} />
            </div>

            {/* Compte de résultat réel */}
            {projections.filter((p: any) => p.is_reel).length > 0 && (
              <Card>
                <CardContent className="py-3 px-0">
                  <p className="text-sm font-semibold px-4 mb-2">Compte de résultat réel</p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Poste</TableHead>
                        {projections.filter((p: any) => p.is_reel).map((p: any) => (
                          <TableHead key={p.annee} className="text-xs text-right">{p.annee_num}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[
                        { label: "Chiffre d'affaires", key: 'ca', bold: true },
                        { label: "Achats matières", key: 'cogs', indent: true },
                        { label: "Marge brute", key: 'marge_brute', bold: true },
                        { label: "OPEX total", key: 'opex_total', indent: true },
                        { label: "EBITDA", key: 'ebitda', bold: true },
                        { label: "Résultat net", key: 'resultat_net', bold: true },
                      ].map((row) => (
                        <TableRow key={row.key} className={row.bold ? 'bg-muted/30' : ''}>
                          <TableCell className={`text-xs ${row.bold ? 'font-semibold' : 'text-muted-foreground'} ${row.indent ? 'pl-6' : ''}`}>{row.label}</TableCell>
                          {projections.filter((p: any) => p.is_reel).map((p: any) => (
                            <TableCell key={p.annee} className={`text-xs text-right ${row.bold ? 'font-semibold' : ''}`}>{fmtM(p[row.key])}</TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {/* Structure des coûts */}
            {data.structure_couts && (
              <Card>
                <CardContent className="py-3">
                  <p className="text-sm font-semibold mb-3">Structure des coûts</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-2">Coûts variables ({data.structure_couts.pct_variables}%)</p>
                      {data.structure_couts.variables?.map((c: any, i: number) => (
                        <CostBar key={i} label={c.poste} amount={c.montant} max={kpis.ca || 1} color="bg-red-400" />
                      ))}
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-2">Coûts fixes ({(100 - (data.structure_couts.pct_variables || 0)).toFixed(0)}%)</p>
                      {data.structure_couts.fixes?.map((c: any, i: number) => (
                        <CostBar key={i} label={c.poste} amount={c.montant} max={kpis.ca || 1} color="bg-blue-400" />
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Santé financière — 4 cartes visuelles */}
            <Card>
              <CardContent className="py-3">
                <p className="text-sm font-semibold mb-3">Santé financière</p>
                <div className="grid grid-cols-2 gap-3">
                  {/* Rentabilité */}
                  <RatioCard title="Rentabilité" ratios={[
                    { label: 'Marge brute', value: pctFmt(sante.rentabilite?.marge_brute_pct), bench: '30-50%' },
                    { label: 'Marge EBITDA', value: pctFmt(sante.rentabilite?.marge_ebitda_pct), bench: '10-20%' },
                    { label: 'Marge nette', value: pctFmt(sante.rentabilite?.marge_nette_pct) },
                    { label: 'ROE', value: pctFmt(sante.rentabilite?.roe), bench: '15-25%' },
                    { label: 'ROA', value: pctFmt(sante.rentabilite?.roa), bench: '5-10%' },
                    { label: 'Couv. intérêts', value: sante.rentabilite?.couverture_interets != null ? `${sante.rentabilite.couverture_interets}x` : '—', bench: '>3x' },
                  ]} />
                  {/* Liquidité */}
                  <RatioCard title="Liquidité & Trésorerie" ratios={[
                    { label: 'Tréso nette', value: fmtM(sante.liquidite?.tresorerie_nette) },
                    { label: 'Cash-flow op.', value: fmtM(sante.liquidite?.cashflow_operationnel) },
                    { label: 'Ratio courant', value: sante.liquidite?.ratio_courant != null ? `${sante.liquidite.ratio_courant}` : '—', bench: '>1.5' },
                    { label: 'Ratio rapide', value: sante.liquidite?.ratio_rapide != null ? `${sante.liquidite.ratio_rapide}` : '—', bench: '>1' },
                    { label: 'BFR', value: `${sante.liquidite?.bfr_jours || 0}j` },
                    { label: 'Runway', value: sante.liquidite?.runway_mois != null ? `${sante.liquidite.runway_mois} mois` : '—', bench: '>3 mois', alert: sante.liquidite?.runway_mois != null && sante.liquidite.runway_mois < 2 },
                  ]} />
                  {/* Solvabilité */}
                  <RatioCard title="Solvabilité" ratios={[
                    { label: 'Endettement', value: pctFmt(sante.solvabilite?.endettement_pct), bench: '<50%' },
                    { label: 'Autonomie fin.', value: pctFmt(sante.solvabilite?.autonomie_financiere_pct), bench: '>30%' },
                    { label: 'Cap. rembourst', value: sante.solvabilite?.capacite_remboursement_ans != null ? `${sante.solvabilite.capacite_remboursement_ans} ans` : '—', bench: '<3 ans' },
                    { label: 'Gearing', value: sante.solvabilite?.gearing != null ? `${sante.solvabilite.gearing}x` : '—', bench: '<2x' },
                  ]} />
                  {/* Cycle */}
                  <RatioCard title="Cycle d'exploitation" ratios={[
                    { label: 'DSO (clients)', value: `${sante.cycle_exploitation?.dso || 0}j`, bench: '30-45j' },
                    { label: 'DIO (stocks)', value: `${sante.cycle_exploitation?.dio || 0}j`, bench: '30-45j' },
                    { label: 'DPO (fourn.)', value: `${sante.cycle_exploitation?.dpo || 0}j`, bench: '45-60j' },
                    { label: 'Cycle tréso', value: `${sante.cycle_exploitation?.cycle_tresorerie || 0}j` },
                    { label: 'CA/employé', value: fmtM(sante.cycle_exploitation?.ca_par_employe), bench: '10-15M' },
                  ]} />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ═══════════ TAB 3: ANALYSE DES MARGES ═══════════ */}
        <TabsContent value="marges">
          <div className="space-y-4">
            {/* Seuil de rentabilité */}
            <Card>
              <CardContent className="py-3">
                <p className="text-sm font-semibold mb-3">Seuil de rentabilité</p>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <MetricBox label="Seuil annuel" value={fmtM(seuil.seuil_annuel)} />
                  <MetricBox label="CA actuel" value={fmtM(seuil.ca_actuel)} />
                  <MetricBox label="Marge sécurité" value={seuil.marge_securite_pct != null ? `+${seuil.marge_securite_pct}%` : '—'} color={seuil.marge_securite_pct > 20 ? 'text-green-600' : 'text-amber-600'} />
                </div>
                <div className="relative h-4 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-red-400 via-amber-400 to-green-400 rounded-full"
                       style={{ width: `${Math.min(((seuil.ca_actuel || 0) / Math.max(seuil.ca_actuel || 1, seuil.seuil_annuel || 1)) * 100, 100)}%` }} />
                  {seuil.seuil_annuel > 0 && seuil.ca_actuel > 0 && (
                    <div className="absolute top-0 h-full w-0.5 bg-foreground"
                         style={{ left: `${(seuil.seuil_annuel / Math.max(seuil.ca_actuel, seuil.seuil_annuel)) * 100}%` }} />
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ═══════════ TAB 4: HYPOTHÈSES ═══════════ */}
        <TabsContent value="hypotheses">
          <div className="space-y-4">
            <Card>
              <CardContent className="py-3">
                <p className="text-sm font-semibold mb-3">Hypothèses de croissance</p>
                <div className="space-y-1 text-xs">
                  <Row label="Croissance CA" value={data.hypotheses_ia?.taux_croissance_ca?.map((t: number) => `${(t*100).toFixed(0)}%`).join(' → ') || '—'} />
                  <Row label="Croissance prix" value={pctFmt((data.hypotheses_ia?.taux_croissance_prix || 0) * 100)} />
                  <Row label="Croissance OPEX" value={pctFmt((data.hypotheses_ia?.taux_croissance_opex || 0) * 100)} />
                  <Row label="Croissance salariale" value={pctFmt((data.hypotheses_ia?.taux_croissance_salariale || 0) * 100)} />
                  <Row label="Inflation" value={pctFmt((data.hypotheses_ia?.inflation || 0.03) * 100)} />
                </div>
                {data.hypotheses_ia?.justification && (
                  <p className="text-[10px] text-muted-foreground mt-3 italic border-l-2 pl-2">{data.hypotheses_ia.justification}</p>
                )}
              </CardContent>
            </Card>

            {/* Sensibilité */}
            {analyse.sensibilite?.length > 0 && (
              <Card>
                <CardContent className="py-3">
                  <p className="text-sm font-semibold mb-3">Analyse de sensibilité</p>
                  <div className="space-y-3">
                    {analyse.sensibilite.map((s: any, i: number) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <span className="text-muted-foreground min-w-[100px]">{s.variable}</span>
                        <span className="text-red-600 text-[10px] min-w-[40px] text-right">{fmtM(s.impact_plus20)}</span>
                        <div className="flex-1 h-3 bg-muted rounded relative overflow-hidden">
                          <div className="absolute left-1/2 h-full w-px bg-foreground/30" />
                          <div className="absolute h-full bg-red-200 rounded"
                               style={{ left: `${50 - Math.min(Math.abs(s.impact_plus20 || 0) / (kpis.ca || 1) * 500, 45)}%`, width: `${Math.min(Math.abs(s.impact_plus20 || 0) / (kpis.ca || 1) * 500, 45)}%` }} />
                        </div>
                        <span className="text-green-600 text-[10px] min-w-[40px]">{fmtM(s.impact_moins20)}</span>
                        <Badge variant="outline" className={`text-[9px] ${s.niveau === 'fort' ? 'bg-red-50 text-red-700' : s.niveau === 'moyen' ? 'bg-amber-50 text-amber-700' : 'bg-green-50 text-green-700'}`}>
                          {s.niveau}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* ═══════════ TAB 5: PROJECTIONS ═══════════ */}
        <TabsContent value="projections">
          <div className="space-y-4">
            <Card>
              <CardContent className="py-3 px-0">
                <p className="text-sm font-semibold px-4 mb-2">Compte de résultat prévisionnel</p>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-[10px] min-w-[120px]">Poste</TableHead>
                        {projections.map((p: any) => (
                          <TableHead key={p.annee} className={`text-[10px] text-right min-w-[70px] ${p.is_reel ? 'bg-blue-50' : ''}`}>
                            {p.annee_num}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[
                        { label: 'CA', key: 'ca', bold: true },
                        { label: 'COGS', key: 'cogs', indent: true },
                        { label: 'Marge brute', key: 'marge_brute', bold: true },
                        { label: '% marge', key: 'marge_brute_pct', pct: true, dim: true },
                        { label: 'OPEX', key: 'opex_total', indent: true },
                        { label: 'EBITDA', key: 'ebitda', bold: true },
                        { label: '% EBITDA', key: 'ebitda_pct', pct: true, dim: true },
                        { label: 'Résultat net', key: 'resultat_net', bold: true },
                        { label: 'Cash-flow', key: 'cashflow' },
                      ].map((row) => (
                        <TableRow key={row.key} className={row.bold ? 'bg-muted/30' : ''}>
                          <TableCell className={`text-[10px] ${row.bold ? 'font-semibold' : ''} ${row.indent ? 'pl-6 text-muted-foreground' : ''} ${row.dim ? 'text-muted-foreground italic' : ''}`}>
                            {row.label}
                          </TableCell>
                          {projections.map((p: any) => (
                            <TableCell key={p.annee} className={`text-[10px] text-right ${row.bold ? 'font-semibold' : ''} ${p.is_reel ? 'bg-blue-50' : ''}`}>
                              {row.pct ? pctFmt(p[row.key]) : fmtM(p[row.key])}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="flex gap-2 mt-2 px-4">
                  <span className="text-[9px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded">Bleu = données réelles</span>
                  <span className="text-[9px] bg-muted text-muted-foreground px-2 py-0.5 rounded">Gris = projections</span>
                </div>
              </CardContent>
            </Card>

            {/* Graphique */}
            {chartData.length > 0 && (
              <Card>
                <CardHeader className="py-3 px-4"><CardTitle className="text-sm">Résultat net & Cash-flow</CardTitle></CardHeader>
                <CardContent className="h-[240px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => fmtM(v)} />
                      <Tooltip formatter={(v: number) => `${fmt(v)} ${devise}`} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Line type="monotone" dataKey="Résultat net" stroke="#E24B4A" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* ═══════════ TAB 6: PRODUITS & RH ═══════════ */}
        <TabsContent value="produits">
          <div className="space-y-4">
            {/* Products */}
            {produits.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {produits.map((p: any, i: number) => (
                  <Card key={i}>
                    <CardContent className="py-3">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-semibold">{p.nom}</p>
                        <Badge variant="outline" className="text-[9px]">{(p.part_ca * 100).toFixed(0)}% CA</Badge>
                      </div>
                      <div className="space-y-1 text-[11px]">
                        <Row label="Prix" value={`${fmt(p.prix_unitaire)} ${devise}`} />
                        <Row label="COGS" value={`${fmt(p.cout_unitaire)} (${((p.cout_unitaire / (p.prix_unitaire || 1)) * 100).toFixed(0)}%)`} />
                        <Row label="Volume N" value={fmt(p.volume_annuel)} />
                        <Row label="Croissance" value={`+${(p.taux_croissance_volume * 100).toFixed(0)}%/an`} color="text-green-600" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Staff */}
            {staff.length > 0 && (
              <Card>
                <CardContent className="py-3 px-0">
                  <p className="text-sm font-semibold px-4 mb-2">Effectifs et masse salariale</p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-[10px]">Catégorie</TableHead>
                        <TableHead className="text-[10px] text-right">Effectif N</TableHead>
                        <TableHead className="text-[10px] text-right">Salaire/mois</TableHead>
                        <TableHead className="text-[10px] text-right">Charges %</TableHead>
                        <TableHead className="text-[10px] text-right">Eff. An 5</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {staff.map((s: any, i: number) => {
                        const cy = s.par_annee?.find((y: any) => y.annee === 'CURRENT YEAR') || s.par_annee?.[2] || {};
                        const y5 = s.par_annee?.[s.par_annee.length - 1] || {};
                        return (
                          <TableRow key={i}>
                            <TableCell className="text-[10px] font-medium">{s.categorie}</TableCell>
                            <TableCell className="text-[10px] text-right">{cy.effectif || 0}</TableCell>
                            <TableCell className="text-[10px] text-right">{fmt(cy.salaire_mensuel_brut || 0)}</TableCell>
                            <TableCell className="text-[10px] text-right">{((s.taux_charges_sociales || 0) * 100).toFixed(1)}%</TableCell>
                            <TableCell className="text-[10px] text-right">{y5.effectif || 0}</TableCell>
                          </TableRow>
                        );
                      })}
                      <TableRow className="bg-muted/30">
                        <TableCell className="text-[10px] font-semibold">Total</TableCell>
                        <TableCell className="text-[10px] text-right font-semibold">
                          {staff.reduce((s: number, st: any) => {
                            const cy = st.par_annee?.find((y: any) => y.annee === 'CURRENT YEAR') || st.par_annee?.[2] || {};
                            return s + (cy.effectif || 0);
                          }, 0)}
                        </TableCell>
                        <TableCell className="text-[10px] text-right text-muted-foreground">—</TableCell>
                        <TableCell className="text-[10px] text-right text-muted-foreground">—</TableCell>
                        <TableCell className="text-[10px] text-right font-semibold">
                          {staff.reduce((s: number, st: any) => {
                            const y5 = st.par_annee?.[st.par_annee.length - 1] || {};
                            return s + (y5.effectif || 0);
                          }, 0)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* ═══════════ TAB 7: INVESTISSEMENT ═══════════ */}
        <TabsContent value="investissement">
          <div className="space-y-4">
            {/* CAPEX */}
            {capexItems.length > 0 && (
              <Card>
                <CardContent className="py-3 px-0">
                  <p className="text-sm font-semibold px-4 mb-2">Plan d'investissement (CAPEX)</p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-[10px]">Investissement</TableHead>
                        <TableHead className="text-[10px]">Catégorie</TableHead>
                        <TableHead className="text-[10px] text-right">Montant</TableHead>
                        <TableHead className="text-[10px] text-right">Année</TableHead>
                        <TableHead className="text-[10px] text-right">Amort.</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {capexItems.map((c: any, i: number) => (
                        <TableRow key={i}>
                          <TableCell className="text-[10px] font-medium">{c.label}</TableCell>
                          <TableCell className="text-[10px] text-muted-foreground">{c.categorie}</TableCell>
                          <TableCell className="text-[10px] text-right">{fmtM(c.acquisition_value || c.montant)}</TableCell>
                          <TableCell className="text-[10px] text-right">{c.acquisition_year || c.annee}</TableCell>
                          <TableCell className="text-[10px] text-right">{((c.amortisation_rate || c.taux_amortissement || 0) * 100).toFixed(0)}%</TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-muted/30">
                        <TableCell colSpan={2} className="text-[10px] font-semibold">Total CAPEX</TableCell>
                        <TableCell className="text-[10px] text-right font-semibold">
                          {fmtM(capexItems.reduce((s: number, c: any) => s + (c.acquisition_value || c.montant || 0), 0))}
                        </TableCell>
                        <TableCell colSpan={2} />
                      </TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {/* Financement */}
            <Card>
              <CardContent className="py-3">
                <p className="text-sm font-semibold mb-3">Plan de financement</p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'Prêt OVO', data: loans.ovo, cls: 'bg-blue-50 text-blue-700' },
                    { label: 'Autofinancement', data: loans.family, cls: 'bg-muted' },
                    { label: 'Crédit bancaire', data: loans.bank, cls: 'bg-muted' },
                  ].map((l) => (
                    <div key={l.label} className={`rounded-lg p-3 text-center ${l.cls}`}>
                      <p className="text-[10px] text-muted-foreground">{l.label}</p>
                      <p className="text-base font-bold mt-1">{fmtM(l.data?.amount)}</p>
                      <p className="text-[9px] text-muted-foreground">{((l.data?.rate || 0) * 100).toFixed(0)}% • {l.data?.term_years || 0} ans</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* BFR */}
            <Card>
              <CardContent className="py-3">
                <p className="text-sm font-semibold mb-3">BFR et trésorerie</p>
                <div className="grid grid-cols-3 gap-2">
                  <MetricBox label="Stock" value={`${data.working_capital?.stock_days?.[0] || 0}j`} />
                  <MetricBox label="Clients" value={`${data.working_capital?.receivable_days?.[0] || 0}j`} />
                  <MetricBox label="Fournisseurs" value={`${data.working_capital?.payable_days?.[0] || 0}j`} />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────

function Row({ label, value, color, sub }: { label: string; value: string; color?: string; sub?: string }) {
  return (
    <div className="flex justify-between items-center py-0.5 border-b border-border/30 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-medium ${color || ''}`}>{value}{sub ? ` ${sub}` : ''}</span>
    </div>
  );
}

function MetricBox({ label, value, color, sub }: { label: string; value: string; color?: string; sub?: string }) {
  return (
    <div className="bg-muted/30 rounded-lg p-2.5 text-center">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className={`text-base font-semibold mt-0.5 ${color || ''}`}>{value}</p>
      {sub && <p className="text-[9px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

function RatioCard({ title, ratios }: { title: string; ratios: Array<{ label: string; value: string; bench?: string; alert?: boolean }> }) {
  return (
    <div className="border rounded-lg p-3">
      <p className="text-[11px] font-semibold mb-2 pb-1.5 border-b">{title}</p>
      <div className="grid grid-cols-2 gap-1.5">
        {ratios.map((r, i) => (
          <div key={i} className={`text-center p-1.5 rounded ${r.alert ? 'bg-red-50' : 'bg-muted/30'}`}>
            <p className={`text-[9px] ${r.alert ? 'text-red-600' : 'text-muted-foreground'}`}>{r.label}</p>
            <p className="text-sm font-semibold mt-0.5">{r.value}</p>
            {r.bench && <p className="text-[8px] text-muted-foreground">bench {r.bench}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

function CostBar({ label, amount, max, color }: { label: string; amount: number; max: number; color: string }) {
  const pct = Math.min((amount / max) * 100, 100);
  return (
    <div className="mb-1.5">
      <div className="flex justify-between text-[10px] mb-0.5">
        <span className="text-muted-foreground">{label}</span>
        <span>{fmtM(amount)}</span>
      </div>
      <div className="h-1 bg-muted rounded overflow-hidden">
        <div className={`h-full ${color} rounded`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
