import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ComposedChart,
} from 'recharts';
import { useMemo } from 'react';
import { getDevise } from '@/lib/format-currency';
import { ChevronDown, Info, ShieldCheck, AlertTriangle, TrendingUp, Users, Landmark, BarChart3 } from 'lucide-react';

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

// ─── Tracability component ────────────────────────────────────

function Tracabilite({ estimation }: { estimation?: any }) {
  if (!estimation) return null;
  const { methode, sources, hypotheses, niveau, confiance } = estimation;
  const hasContent = methode || sources?.length || hypotheses?.length || niveau || confiance;
  if (!hasContent) return null;

  return (
    <Collapsible>
      <CollapsibleTrigger className="inline-flex items-center gap-1 text-[9px] text-muted-foreground/60 hover:text-muted-foreground transition-colors mt-1 cursor-pointer">
        <Info className="h-3 w-3" />
        <span>Traçabilité</span>
        <ChevronDown className="h-2.5 w-2.5 transition-transform [[data-state=open]>&]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-1 pl-4 border-l border-border/40 text-[10px] text-muted-foreground/70 space-y-0.5">
        {methode && <p><span className="font-medium">Méthode :</span> {methode}</p>}
        {sources?.length > 0 && <p><span className="font-medium">Sources :</span> {sources.join(', ')}</p>}
        {hypotheses?.length > 0 && <p><span className="font-medium">Hypothèses :</span> {hypotheses.join(' · ')}</p>}
        {niveau && <p><span className="font-medium">Niveau :</span> {niveau}</p>}
        {confiance != null && <p><span className="font-medium">Confiance :</span> {confiance}%</p>}
      </CollapsibleContent>
    </Collapsible>
  );
}

// ─── Confidence dot ───────────────────────────────────────────

function ConfidenceDot({ value }: { value?: number }) {
  if (value == null) return null;
  const cls = value >= 80 ? 'bg-green-500' : value >= 40 ? 'bg-amber-500' : 'bg-red-500';
  return <span className={`inline-block w-1.5 h-1.5 rounded-full ${cls} ml-1`} title={`Confiance: ${value}%`} />;
}

// ─── Generic analysis section ─────────────────────────────────

function AnalysisSection({ title, icon, data: sectionData }: { title: string; icon: React.ReactNode; data?: any }) {
  if (!sectionData || (typeof sectionData === 'object' && Object.keys(sectionData).length === 0)) return null;

  return (
    <Card>
      <CardContent className="py-3">
        <div className="flex items-center gap-2 mb-3">
          {icon}
          <p className="text-sm font-semibold">{title}</p>
        </div>
        <div className="space-y-2">
          {Object.entries(sectionData).map(([key, value]: [string, any]) => {
            if (['sources', 'methode', 'hypotheses', 'niveau', 'confiance', 'score'].includes(key)) return null;
            if (value == null) return null;

            const label = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

            // String
            if (typeof value === 'string') {
              return (
                <div key={key} className="text-xs">
                  <p className="text-[10px] font-medium text-muted-foreground mb-0.5">{label}</p>
                  <p className="text-foreground leading-relaxed">{value}</p>
                </div>
              );
            }

            // Array of strings
            if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'string') {
              return (
                <div key={key}>
                  <p className="text-[10px] font-medium text-muted-foreground mb-1">{label}</p>
                  <ul className="space-y-0.5">
                    {value.map((item: string, i: number) => (
                      <li key={i} className="text-xs text-foreground flex items-start gap-1.5">
                        <span className="text-muted-foreground mt-0.5">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            }

            // Array of objects
            if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'object') {
              return (
                <div key={key}>
                  <p className="text-[10px] font-medium text-muted-foreground mb-1">{label}</p>
                  <div className="space-y-1.5">
                    {value.map((item: any, i: number) => (
                      <div key={i} className="bg-muted/30 rounded-lg px-3 py-2 text-xs">
                        {item.titre && <p className="font-semibold text-[11px]">{item.titre}</p>}
                        {item.description && <p className="text-muted-foreground mt-0.5">{item.description}</p>}
                        {item.texte && <p className="text-muted-foreground">{item.texte}</p>}
                        {item.impact && <Badge variant="outline" className="text-[9px] mt-1">{item.impact}</Badge>}
                        {item.priorite && <Badge variant="outline" className="text-[9px] mt-1 ml-1">{item.priorite}</Badge>}
                        {item.delai && <span className="text-[9px] text-muted-foreground ml-1">• {item.delai}</span>}
                        <Tracabilite estimation={item.estimation || item} />
                      </div>
                    ))}
                  </div>
                </div>
              );
            }

            // Nested object (not array)
            if (typeof value === 'object' && !Array.isArray(value)) {
              return (
                <div key={key}>
                  <p className="text-[10px] font-medium text-muted-foreground mb-1">{label}</p>
                  <div className="bg-muted/30 rounded-lg px-3 py-2 text-xs space-y-0.5">
                    {Object.entries(value).filter(([k]) => !['sources', 'methode', 'hypotheses', 'niveau', 'confiance'].includes(k)).map(([k, v]) => (
                      <div key={k} className="flex justify-between">
                        <span className="text-muted-foreground">{k.replace(/_/g, ' ')}</span>
                        <span className="font-medium">{typeof v === 'string' || typeof v === 'number' ? String(v) : '—'}</span>
                      </div>
                    ))}
                  </div>
                  <Tracabilite estimation={value} />
                </div>
              );
            }

            return null;
          })}

          {/* Discrete tracability for the whole section */}
          <Tracabilite estimation={sectionData} />
        </div>
      </CardContent>
    </Card>
  );
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
  const services = data.services || [];
  
  const staff = data.staff || [];
  const capexItems = data.capex || [];
  const loans = data.loans || {};
  const scenarios = data.scenarios || {};

  // New analysis blocs
  const analyseInvestisseur = data.analyse_investisseur || null;
  const analyseCoaching = data.analyse_coaching || null;
  const analyseMarges = data.analyse_marges || null;
  const analyseRH = data.analyse_rh || null;
  const analyseInvestissement = data.analyse_investissement || null;
  const analyseFinancement = data.analyse_financement || null;
  const auditReconciliation = data.audit_reconciliation || null;
  const explicabilite = data.explicabilite || null;

  const hasAnalyseTab = analyseInvestisseur || analyseCoaching || analyseMarges || analyseRH || analyseInvestissement || analyseFinancement;
  const hasAuditTab = auditReconciliation || explicabilite;

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
          <TabsTrigger value="situation" className="text-[11px] flex-1">Situation</TabsTrigger>
          <TabsTrigger value="marges" className="text-[11px] flex-1">Marges</TabsTrigger>
          <TabsTrigger value="hypotheses" className="text-[11px] flex-1">Hypothèses</TabsTrigger>
          <TabsTrigger value="projections" className="text-[11px] flex-1">Projections</TabsTrigger>
          <TabsTrigger value="produits" className="text-[11px] flex-1">Produits & RH</TabsTrigger>
          <TabsTrigger value="investissement" className="text-[11px] flex-1">Invest.</TabsTrigger>
          {hasAnalyseTab && <TabsTrigger value="analyse" className="text-[11px] flex-1">Analyse</TabsTrigger>}
          {hasAuditTab && <TabsTrigger value="audit" className="text-[11px] flex-1">Audit</TabsTrigger>}
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

            {/* Risques clés — without source display */}
            {analyse.risques?.length > 0 && (
              <Card>
                <CardContent className="py-3">
                  <p className="text-sm font-semibold mb-3">Risques clés</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {analyse.risques.map((r: any, i: number) => (
                      <div key={i} className={`rounded-lg p-3 ${r.impact === 'critique' ? 'bg-red-50' : r.impact === 'élevé' ? 'bg-amber-50' : 'bg-muted/30'}`}>
                        <div className="flex items-center gap-1">
                          <p className={`text-[11px] font-semibold ${r.impact === 'critique' ? 'text-red-700' : r.impact === 'élevé' ? 'text-amber-700' : 'text-foreground'}`}>{r.titre}</p>
                          <ConfidenceDot value={r.confiance || r.estimation?.confiance} />
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1">{r.description}</p>
                        <p className={`text-[9px] font-semibold mt-2 ${r.impact === 'critique' ? 'text-red-600' : 'text-amber-600'}`}>{r.impact}</p>
                        <Tracabilite estimation={r.estimation || r} />
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

            {/* Score investissabilité */}
            {analyse.score_investissabilite != null && (
              <div className={`rounded-lg p-4 flex items-center gap-4 ${analyse.score_investissabilite >= 70 ? 'bg-green-50 border border-green-200' : analyse.score_investissabilite >= 40 ? 'bg-amber-50 border border-amber-200' : 'bg-red-50 border border-red-200'}`}>
                <div className="text-center shrink-0">
                  <p className={`text-2xl font-bold ${analyse.score_investissabilite >= 70 ? 'text-green-700' : analyse.score_investissabilite >= 40 ? 'text-amber-700' : 'text-red-700'}`}>{analyse.score_investissabilite}</p>
                  <p className="text-[9px] text-muted-foreground">/100</p>
                </div>
                <div className="border-l pl-4">
                  <p className="text-sm font-semibold">Score investissabilité : {analyse.verdict || '—'}</p>
                  
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ═══════════ TAB 2: SITUATION ACTUELLE ═══════════ */}
        <TabsContent value="situation">
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              <MetricBox label="CA" value={fmtM(kpis.ca)} sub={devise} />
              <MetricBox label="Résultat net" value={fmtM(kpis.resultat_net)} color={kpis.resultat_net < 0 ? 'text-red-600' : undefined} />
              <MetricBox label="Trésorerie" value={fmtM(kpis.tresorerie)} />
            </div>

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

            {/* Structure des coûts moved to Marges tab */}

            <Card>
              <CardContent className="py-3">
                <p className="text-sm font-semibold mb-3">Santé financière</p>
                <div className="grid grid-cols-2 gap-3">
                  <RatioCard title="Rentabilité" ratios={[
                    { label: 'Marge brute', value: pctFmt(sante.rentabilite?.marge_brute_pct), bench: '30-50%' },
                    { label: 'Marge EBITDA', value: pctFmt(sante.rentabilite?.marge_ebitda_pct), bench: '10-20%' },
                    { label: 'Marge nette', value: pctFmt(sante.rentabilite?.marge_nette_pct) },
                    { label: 'ROE', value: pctFmt(sante.rentabilite?.roe), bench: '15-25%' },
                    { label: 'ROA', value: pctFmt(sante.rentabilite?.roa), bench: '5-10%' },
                    { label: 'Couv. intérêts', value: sante.rentabilite?.couverture_interets != null ? `${sante.rentabilite.couverture_interets}x` : '—', bench: '>3x' },
                  ]} />
                  <RatioCard title="Liquidité & Trésorerie" ratios={[
                    { label: 'Tréso nette', value: fmtM(sante.liquidite?.tresorerie_nette) },
                    { label: 'Cash-flow op.', value: fmtM(sante.liquidite?.cashflow_operationnel) },
                    { label: 'Ratio courant', value: sante.liquidite?.ratio_courant != null ? `${sante.liquidite.ratio_courant}` : '—', bench: '>1.5' },
                    { label: 'Ratio rapide', value: sante.liquidite?.ratio_rapide != null ? `${sante.liquidite.ratio_rapide}` : '—', bench: '>1' },
                    { label: 'BFR', value: `${sante.liquidite?.bfr_jours || 0}j` },
                    { label: 'Runway', value: sante.liquidite?.runway_mois != null ? `${sante.liquidite.runway_mois} mois` : '—', bench: '>3 mois', alert: sante.liquidite?.runway_mois != null && sante.liquidite.runway_mois < 2 },
                  ]} />
                  <RatioCard title="Solvabilité" ratios={[
                    { label: 'Endettement', value: pctFmt(sante.solvabilite?.endettement_pct), bench: '<50%' },
                    { label: 'Autonomie fin.', value: pctFmt(sante.solvabilite?.autonomie_financiere_pct), bench: '>30%' },
                    { label: 'Cap. rembourst', value: sante.solvabilite?.capacite_remboursement_ans != null ? `${sante.solvabilite.capacite_remboursement_ans} ans` : '—', bench: '<3 ans' },
                    { label: 'Gearing', value: sante.solvabilite?.gearing != null ? `${sante.solvabilite.gearing}x` : '—', bench: '<2x' },
                  ]} />
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

            {/* KPIs marges résumé */}
            <div className="grid grid-cols-4 gap-2">
              <MetricBox label="Marge brute" value={pctFmt(sante.rentabilite?.marge_brute_pct)} color={sante.rentabilite?.marge_brute_pct >= 30 ? 'text-green-600' : 'text-amber-600'} sub="bench 30-50%" />
              <MetricBox label="Marge EBITDA" value={pctFmt(sante.rentabilite?.marge_ebitda_pct)} color={sante.rentabilite?.marge_ebitda_pct >= 10 ? 'text-green-600' : 'text-amber-600'} sub="bench 10-20%" />
              <MetricBox label="Marge nette" value={pctFmt(sante.rentabilite?.marge_nette_pct)} />
              <MetricBox label="Seuil rentabilité" value={fmtM(seuil.seuil_annuel)} sub={seuil.marge_securite_pct != null ? `+${seuil.marge_securite_pct}% sécurité` : undefined} />
            </div>

            {/* Cascade CA → Résultat net */}
            {(kpis.ca || cyProj?.ca) && (
              <Card>
                <CardContent className="py-3">
                  <p className="text-sm font-semibold mb-3">Où se crée la marge</p>
                  {(() => {
                    const ca = kpis.ca || cyProj?.ca || 0;
                    const cogs = cyProj?.cogs || 0;
                    const mb = cyProj?.marge_brute || (ca - cogs);
                    const opex = cyProj?.opex_total || 0;
                    const ebitda = cyProj?.ebitda || (mb - opex);
                    const amort = cyProj?.amortissement || 0;
                    const rn = cyProj?.resultat_net || (ebitda - amort);
                    const steps = [
                      { label: "Chiffre d'affaires", value: ca, color: 'bg-blue-500' },
                      { label: 'Achats / COGS', value: -Math.abs(cogs), color: 'bg-red-400' },
                      { label: 'Marge brute', value: mb, color: 'bg-green-500', bold: true },
                      { label: 'OPEX', value: -Math.abs(opex), color: 'bg-red-400' },
                      { label: 'EBITDA', value: ebitda, color: 'bg-green-400', bold: true },
                      { label: 'Amortissements', value: -Math.abs(amort), color: 'bg-red-300' },
                      { label: 'Résultat net', value: rn, color: rn >= 0 ? 'bg-green-600' : 'bg-red-600', bold: true },
                    ];
                    const maxVal = Math.max(...steps.map(s => Math.abs(s.value)), 1);
                    return (
                      <div className="space-y-1.5">
                        {steps.map((s, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <span className={`text-[10px] w-[110px] shrink-0 text-right ${s.bold ? 'font-semibold' : 'text-muted-foreground'}`}>{s.label}</span>
                            <div className="flex-1 flex items-center">
                              <div className={`h-4 rounded ${s.color}`} style={{ width: `${Math.max((Math.abs(s.value) / maxVal) * 100, 2)}%` }} />
                            </div>
                            <span className={`text-[10px] w-[70px] text-right ${s.value < 0 ? 'text-red-600' : s.bold ? 'font-semibold' : ''}`}>
                              {s.value < 0 ? '−' : ''}{fmtM(Math.abs(s.value))}
                            </span>
                            {s.bold && ca > 0 && (
                              <span className="text-[9px] text-muted-foreground w-[40px]">({pctFmt((s.value / ca) * 100)})</span>
                            )}
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>
            )}

            {/* Détail marges par produit */}
            {produits.length > 0 && (
              <Card>
                <CardContent className="py-3 px-0">
                  <p className="text-sm font-semibold px-4 mb-2">Marges par produit</p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-[10px]">Produit</TableHead>
                        <TableHead className="text-[10px] text-right">Prix unit.</TableHead>
                        <TableHead className="text-[10px] text-right">Coût unit.</TableHead>
                        <TableHead className="text-[10px] text-right">Marge unit.</TableHead>
                        <TableHead className="text-[10px] text-right">Marge %</TableHead>
                        <TableHead className="text-[10px] text-right">Volume</TableHead>
                        <TableHead className="text-[10px] text-right">CA total</TableHead>
                        <TableHead className="text-[10px] text-right">Marge totale</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {produits.map((p: any, i: number) => {
                        const prix = p.prix_unitaire || 0;
                        const cout = p.cout_unitaire || 0;
                        const margeUnit = prix - cout;
                        const margePct = prix > 0 ? (margeUnit / prix) * 100 : 0;
                        const vol = p.volume_annuel || 0;
                        const caTotal = prix * vol;
                        const margeTotal = margeUnit * vol;
                        return (
                          <TableRow key={i}>
                            <TableCell className="text-[10px] font-medium">{p.nom}</TableCell>
                            <TableCell className="text-[10px] text-right">{fmt(prix)}</TableCell>
                            <TableCell className="text-[10px] text-right">{fmt(cout)}</TableCell>
                            <TableCell className={`text-[10px] text-right font-medium ${margeUnit >= 0 ? 'text-green-700' : 'text-red-700'}`}>{fmt(margeUnit)}</TableCell>
                            <TableCell className={`text-[10px] text-right ${margePct >= 30 ? 'text-green-700' : margePct >= 10 ? 'text-amber-600' : 'text-red-700'}`}>{pctFmt(margePct)}</TableCell>
                            <TableCell className="text-[10px] text-right">{fmt(vol)}</TableCell>
                            <TableCell className="text-[10px] text-right">{fmtM(caTotal)}</TableCell>
                            <TableCell className={`text-[10px] text-right font-medium ${margeTotal >= 0 ? 'text-green-700' : 'text-red-700'}`}>{fmtM(margeTotal)}</TableCell>
                          </TableRow>
                        );
                      })}
                      <TableRow className="bg-muted/30">
                        <TableCell colSpan={6} className="text-[10px] font-semibold">Total produits</TableCell>
                        <TableCell className="text-[10px] text-right font-semibold">
                          {fmtM(produits.reduce((s: number, p: any) => s + (p.prix_unitaire || 0) * (p.volume_annuel || 0), 0))}
                        </TableCell>
                        <TableCell className="text-[10px] text-right font-semibold">
                          {fmtM(produits.reduce((s: number, p: any) => s + ((p.prix_unitaire || 0) - (p.cout_unitaire || 0)) * (p.volume_annuel || 0), 0))}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {/* Détail marges par service */}
            {services.length > 0 && (
              <Card>
                <CardContent className="py-3 px-0">
                  <p className="text-sm font-semibold px-4 mb-2">Marges par service</p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-[10px]">Service</TableHead>
                        <TableHead className="text-[10px] text-right">Prix unit.</TableHead>
                        <TableHead className="text-[10px] text-right">Coût unit.</TableHead>
                        <TableHead className="text-[10px] text-right">Marge %</TableHead>
                        <TableHead className="text-[10px] text-right">Volume</TableHead>
                        <TableHead className="text-[10px] text-right">Marge totale</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {services.map((s: any, i: number) => {
                        const prix = s.prix_unitaire || 0;
                        const cout = s.cout_unitaire || 0;
                        const margePct = prix > 0 ? ((prix - cout) / prix) * 100 : 0;
                        return (
                          <TableRow key={i}>
                            <TableCell className="text-[10px] font-medium">{s.nom}</TableCell>
                            <TableCell className="text-[10px] text-right">{fmt(prix)}</TableCell>
                            <TableCell className="text-[10px] text-right">{fmt(cout)}</TableCell>
                            <TableCell className={`text-[10px] text-right ${margePct >= 30 ? 'text-green-700' : 'text-amber-600'}`}>{pctFmt(margePct)}</TableCell>
                            <TableCell className="text-[10px] text-right">{fmt(s.volume_annuel || 0)}</TableCell>
                            <TableCell className="text-[10px] text-right font-medium">{fmtM((prix - cout) * (s.volume_annuel || 0))}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {/* Évolution des marges dans le temps */}
            {projections.length > 1 && (
              <Card>
                <CardContent className="py-3 px-0">
                  <p className="text-sm font-semibold px-4 mb-2">Évolution des marges</p>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-[10px]">Indicateur</TableHead>
                          {projections.map((p: any) => (
                            <TableHead key={p.annee} className={`text-[10px] text-right ${p.is_reel ? 'bg-muted/30' : ''}`}>
                              {p.annee_num}{p.is_reel ? ' ✓' : ''}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {[
                          { label: 'Marge brute %', key: 'marge_brute_pct', isPct: true },
                          { label: 'EBITDA %', key: 'ebitda_pct', isPct: true },
                          { label: 'Marge nette %', key: 'resultat_net', compute: (p: any) => p.ca > 0 ? (p.resultat_net / p.ca) * 100 : 0, isPct: true },
                        ].map((row) => (
                          <TableRow key={row.key}>
                            <TableCell className="text-[10px] font-medium">{row.label}</TableCell>
                            {projections.map((p: any) => {
                              const val = row.compute ? row.compute(p) : p[row.key];
                              const isGood = (val || 0) >= 10;
                              return (
                                <TableCell key={p.annee} className={`text-[10px] text-right font-medium ${p.is_reel ? 'bg-muted/30' : ''} ${isGood ? 'text-green-700' : (val || 0) >= 0 ? 'text-amber-600' : 'text-red-700'}`}>
                                  {pctFmt(val)}
                                </TableCell>
                              );
                            })}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Rentabilité par activité (existant) */}
            {analyse.rentabilite_par_activite?.length > 0 && (
              <Card>
                <CardContent className="py-3 px-0">
                  <p className="text-sm font-semibold px-4 mb-2">Rentabilité par activité</p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-[10px]">Activité</TableHead>
                        <TableHead className="text-[10px] text-right">CA</TableHead>
                        <TableHead className="text-[10px] text-right">% CA</TableHead>
                        <TableHead className="text-[10px] text-right">Coûts directs</TableHead>
                        <TableHead className="text-[10px] text-right">Marge brute</TableHead>
                        <TableHead className="text-[10px] text-right">Marge %</TableHead>
                        <TableHead className="text-[10px] text-right">EBE</TableHead>
                        <TableHead className="text-[10px] text-center">Verdict</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {analyse.rentabilite_par_activite.map((item: any, i: number) => {
                        const rentable = (item.verdict || '').toLowerCase().includes('rentable') && !(item.verdict || '').toLowerCase().includes('déficitaire');
                        return (
                          <TableRow key={i} className={!rentable ? 'bg-red-50/50' : ''}>
                            <TableCell className={`text-[10px] font-medium ${!rentable ? 'text-red-800' : ''}`}>{item.activite || item.nom}</TableCell>
                            <TableCell className="text-[10px] text-right">{fmtM(item.ca)}</TableCell>
                            <TableCell className="text-[10px] text-right text-muted-foreground">{pctFmt(item.pct_ca)}</TableCell>
                            <TableCell className="text-[10px] text-right">{fmtM(item.couts_directs)}</TableCell>
                            <TableCell className={`text-[10px] text-right font-medium ${(item.marge_brute || 0) >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                              {(item.marge_brute || 0) >= 0 ? '+' : ''}{fmtM(item.marge_brute)}
                            </TableCell>
                            <TableCell className={`text-[10px] text-right ${(item.marge_pct || 0) >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                              {(item.marge_pct || 0) < 0 ? 'neg.' : pctFmt(item.marge_pct)}
                            </TableCell>
                            <TableCell className={`text-[10px] text-right font-medium ${(item.ebe || 0) >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                              {(item.ebe || 0) >= 0 ? '+' : ''}{fmtM(item.ebe)}
                            </TableCell>
                            <TableCell className="text-[10px] text-center">
                              <span className={`text-[9px] px-1.5 py-0.5 rounded ${rentable ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                {rentable ? 'Rentable' : 'Déficitaire'}
                              </span>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {/* Waterfall chart */}
            {analyse.rentabilite_par_activite?.length > 0 && (
              <Card>
                <CardContent className="py-3">
                  <p className="text-sm font-semibold mb-3">Visualisation — contribution à la marge</p>
                  <div className="flex items-end gap-1 h-[120px] px-5">
                    {analyse.rentabilite_par_activite.map((item: any, i: number) => {
                      const mb = item.marge_brute || 0;
                      const maxAbs = Math.max(...analyse.rentabilite_par_activite.map((a: any) => Math.abs(a.marge_brute || 0)), 1);
                      const barH = Math.max((Math.abs(mb) / maxAbs) * 100, 4);
                      const isPositive = mb >= 0;
                      return (
                        <div key={i} className="flex-1 flex flex-col items-center justify-end">
                          {isPositive && <p className="text-[9px] text-green-700 font-medium mb-0.5">+{fmtM(mb)}</p>}
                          <div className={`w-full rounded-t ${isPositive ? 'bg-green-500' : 'bg-red-500 rounded-t-none rounded-b'}`} style={{ height: `${barH}px` }} />
                          {!isPositive && <p className="text-[9px] text-red-700 font-medium mt-0.5">{fmtM(mb)}</p>}
                          <p className="text-[9px] text-muted-foreground mt-0.5 text-center truncate w-full">{item.activite || item.nom}</p>
                        </div>
                      );
                    })}
                    <div className="w-px bg-border h-full mx-2" />
                    {(() => {
                      const totalMB = analyse.rentabilite_par_activite.reduce((s: number, a: any) => s + (a.marge_brute || 0), 0);
                      const maxAbs = Math.max(...analyse.rentabilite_par_activite.map((a: any) => Math.abs(a.marge_brute || 0)), 1);
                      const barH = Math.max((Math.abs(totalMB) / maxAbs) * 100, 4);
                      return (
                        <div className="flex-1 flex flex-col items-center justify-end">
                          {totalMB >= 0 && <p className="text-[9px] text-green-700 font-medium mb-0.5">+{fmtM(totalMB)}</p>}
                          <div className={`w-full rounded ${totalMB >= 0 ? 'bg-green-400' : 'bg-amber-500'}`} style={{ height: `${barH}px` }} />
                          {totalMB < 0 && <p className="text-[9px] text-amber-700 font-medium mt-0.5">{fmtM(totalMB)}</p>}
                          <p className="text-[9px] text-muted-foreground mt-0.5 text-center font-medium">Résultat net</p>
                        </div>
                      );
                    })()}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Seuil de rentabilité */}
            {(seuil.seuil_annuel || seuil.ca_actuel) && (
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
            )}

            {/* Structure coûts variables vs fixes */}
            {data.structure_couts && (
              <Card>
                <CardContent className="py-3">
                  <p className="text-sm font-semibold mb-3">Structure des coûts</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-2">Coûts variables ({data.structure_couts.pct_variables || 0}%)</p>
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

            {/* Ratios vs benchmarks */}
            {analyse.ratios_vs_benchmarks?.length > 0 && (
              <Card>
                <CardContent className="py-3 px-0">
                  <p className="text-sm font-semibold px-4 mb-2">Ratios vs benchmarks sectoriels</p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-[10px]">Indicateur</TableHead>
                        <TableHead className="text-[10px] text-right">Valeur</TableHead>
                        <TableHead className="text-[10px] text-right">Benchmark</TableHead>
                        <TableHead className="text-[10px] text-center">Statut</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {analyse.ratios_vs_benchmarks.map((r: any, i: number) => {
                        const statut = (r.statut || r.status || '').toLowerCase();
                        const isOk = statut.includes('ok') || statut.includes('bon') || statut.includes('conforme');
                        const isWarn = statut.includes('attention') || statut.includes('moyen');
                        return (
                          <TableRow key={i}>
                            <TableCell className="text-[10px] font-medium">{r.label}</TableCell>
                            <TableCell className="text-[10px] text-right font-semibold">{r.valeur}</TableCell>
                            <TableCell className="text-[10px] text-right text-muted-foreground">{r.benchmark}</TableCell>
                            <TableCell className="text-[10px] text-center">
                              <Badge variant="outline" className={`text-[9px] ${isOk ? 'bg-green-50 text-green-700 border-green-200' : isWarn ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                                {r.statut || r.status || '—'}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
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

            {/* ── Analyse des marges ── */}
            <AnalysisSection
              title="Analyse des marges"
              icon={<BarChart3 className="h-4 w-4 text-primary" />}
              data={analyseMarges}
            />
          </div>
        </TabsContent>

        {/* ═══════════ TAB 4: HYPOTHESES ═══════════ */}
        <TabsContent value="hypotheses">
          <div className="space-y-4">

            {/* Hypothèses globales de croissance */}
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

            {/* Per-product/service/RH/CAPEX/financement/BFR details removed — shown in respective tabs */}

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

            {/* --- Graphique d'évolution --- */}
            {projections.length > 0 && (
              <Card>
                <CardContent className="py-3">
                  <p className="text-sm font-semibold mb-2">Évolution prévisionnelle</p>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                        <XAxis dataKey="name" className="text-[10px]" />
                        <YAxis className="text-[10px]" tickFormatter={(v: number) => fmtM(v)} />
                        <Tooltip formatter={(v: number) => fmt(v)} />
                        <Legend wrapperStyle={{ fontSize: 10 }} />
                        <Bar dataKey="CA" fill="hsl(var(--primary))" opacity={0.3} name="CA" />
                        <Bar dataKey="EBITDA" fill="hsl(var(--primary))" opacity={0.7} name="EBITDA" />
                        <Line type="monotone" dataKey="Résultat net" stroke="hsl(var(--accent-foreground))" strokeWidth={2} dot={{ r: 3 }} name="Résultat net" />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* --- Compte de résultat prévisionnel --- */}
            {projections.length > 0 && (
              <Card>
                <CardContent className="py-3 px-0">
                  <p className="text-sm font-semibold px-4 mb-2">Compte de résultat prévisionnel</p>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-[10px]">Poste</TableHead>
                          {projections.map((p: any) => (
                            <TableHead key={p.annee} className={`text-[10px] text-right ${p.is_reel ? 'bg-muted/30' : ''}`}>
                              {p.annee_num}{p.is_reel ? ' ✓' : ''}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {[
                          { label: "Chiffre d'affaires", key: 'ca', bold: true },
                          { label: "COGS", key: 'cogs' },
                          { label: "Marge brute", key: 'marge_brute', bold: true },
                          { label: "Marge brute %", key: 'marge_brute_pct', isPct: true },
                          { label: "Masse salariale", key: 'masse_salariale' },
                          { label: "Charges externes", key: 'charges_externes' },
                          { label: "OPEX total", key: 'opex_total' },
                          { label: "EBITDA", key: 'ebitda', bold: true },
                          { label: "EBITDA %", key: 'ebitda_pct', isPct: true },
                          { label: "Amortissements", key: 'amortissement' },
                          { label: "Charges financières", key: 'charges_financieres' },
                          { label: "Impôts", key: 'impots' },
                          { label: "Résultat net", key: 'resultat_net', bold: true },
                          { label: "Résultat net %", key: 'resultat_net_pct', isPct: true },
                        ].map((row) => (
                          <TableRow key={row.key} className={row.bold ? 'bg-muted/30' : ''}>
                            <TableCell className={`text-[10px] ${row.bold ? 'font-semibold' : 'text-muted-foreground'}`}>{row.label}</TableCell>
                            {projections.map((p: any) => {
                              let val = p[row.key];
                              if (row.key === 'resultat_net_pct' && val == null && p.resultat_net != null && p.ca) {
                                val = (p.resultat_net / p.ca) * 100;
                              }
                              return (
                                <TableCell key={p.annee} className={`text-[10px] text-right ${row.bold ? 'font-semibold' : ''} ${p.is_reel ? 'bg-muted/30' : ''}`}>
                                  {row.isPct ? pctFmt(val) : fmtM(val)}
                                </TableCell>
                              );
                            })}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* --- CA par produit / service --- */}
            {projections.length > 0 && (produits.length > 0 || services.length > 0) && (
              <Card>
                <CardContent className="py-3 px-0">
                  <p className="text-sm font-semibold px-4 mb-2">Décomposition du CA par activité</p>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-[10px]">Activité</TableHead>
                          {projections.map((p: any) => (
                            <TableHead key={p.annee} className="text-[10px] text-right">{p.annee_num}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {[...produits, ...services].map((item: any, idx: number) => {
                          const vol0 = item.volume_annuel || 0;
                          const prix0 = item.prix_unitaire || 0;
                          const crois = item.taux_croissance_volume || 0;
                          return (
                            <TableRow key={idx}>
                              <TableCell className="text-[10px] font-medium">{item.nom}</TableCell>
                              {projections.map((p: any, yi: number) => {
                                const yIdx = yi; // year index from 0
                                const vol = vol0 * Math.pow(1 + crois, yIdx);
                                const ca = vol * prix0;
                                return (
                                  <TableCell key={p.annee} className="text-[10px] text-right">{fmtM(ca)}</TableCell>
                                );
                              })}
                            </TableRow>
                          );
                        })}
                        <TableRow className="bg-muted/30">
                          <TableCell className="text-[10px] font-semibold">Total CA</TableCell>
                          {projections.map((p: any) => (
                            <TableCell key={p.annee} className="text-[10px] text-right font-semibold">{fmtM(p.ca)}</TableCell>
                          ))}
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* --- Plan de trésorerie / Cash-flow --- */}
            {projections.length > 0 && projections.some((p: any) => p.free_cashflow != null || p.bfr != null) && (
              <Card>
                <CardContent className="py-3 px-0">
                  <p className="text-sm font-semibold px-4 mb-2">Flux de trésorerie</p>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-[10px]">Poste</TableHead>
                          {projections.map((p: any) => (
                            <TableHead key={p.annee} className="text-[10px] text-right">{p.annee_num}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {[
                          { label: "EBITDA", key: 'ebitda', bold: true },
                          { label: "Δ BFR", key: 'variation_bfr' },
                          { label: "BFR", key: 'bfr' },
                          { label: "CAPEX", key: 'capex_annuel' },
                          { label: "Remboursement dette", key: 'remboursement_dette' },
                          { label: "Cash-flow libre", key: 'free_cashflow', bold: true },
                          { label: "Trésorerie cumulée", key: 'tresorerie_cumulee', bold: true },
                        ].filter(r => projections.some((p: any) => p[r.key] != null)).map((row) => (
                          <TableRow key={row.key} className={row.bold ? 'bg-muted/30' : ''}>
                            <TableCell className={`text-[10px] ${row.bold ? 'font-semibold' : 'text-muted-foreground'}`}>{row.label}</TableCell>
                            {projections.map((p: any) => (
                              <TableCell key={p.annee} className={`text-[10px] text-right ${row.bold ? 'font-semibold' : ''}`}>
                                {fmtM(p[row.key])}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* CAPEX, Financement, BFR moved to Investissement tab */}

            {/* --- OPEX évolution (moved from Produits & RH) --- */}
            {(data.opex_categories?.length > 0 || projections.length > 0) && (
              <div className="space-y-3">
                <p className="text-sm font-semibold flex items-center gap-2">
                  <Landmark className="h-4 w-4 text-primary" /> Charges opérationnelles (OPEX)
                </p>

                {data.opex_categories?.length > 0 && (
                  <Card>
                    <CardContent className="py-3 px-0">
                      <p className="text-xs font-semibold px-4 mb-2">Répartition OPEX</p>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-[10px]">Poste</TableHead>
                            <TableHead className="text-[10px] text-right">Montant ({devise})</TableHead>
                            <TableHead className="text-[10px] text-right">%</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {data.opex_categories.map((op: any, i: number) => (
                            <TableRow key={i}>
                              <TableCell className="text-[10px]">{op.poste}</TableCell>
                              <TableCell className="text-[10px] text-right">{fmtM(op.montant)}</TableCell>
                              <TableCell className="text-[10px] text-right">{pctFmt(op.pct)}</TableCell>
                            </TableRow>
                          ))}
                          <TableRow className="bg-muted/30">
                            <TableCell className="text-[10px] font-bold">Total</TableCell>
                            <TableCell className="text-[10px] text-right font-bold">
                              {fmtM(data.opex_categories.reduce((s: number, o: any) => s + (o.montant || 0), 0))}
                            </TableCell>
                            <TableCell className="text-[10px] text-right font-bold">100%</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                )}

                {projections.length > 0 && (
                  <Card>
                    <CardContent className="py-3 px-0">
                      <p className="text-xs font-semibold px-4 mb-2">OPEX — évolution pluriannuelle</p>
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-[10px]">Poste</TableHead>
                              {projections.map((p: any) => (
                                <TableHead key={p.annee} className={`text-[10px] text-right ${p.is_reel ? 'bg-muted/30' : ''}`}>
                                  {p.annee_num}{p.is_reel ? ' ✓' : ''}
                                </TableHead>
                              ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {[
                              { label: 'Masse salariale', key: 'masse_salariale' },
                              { label: 'Loyers', key: 'loyers' },
                              { label: 'Marketing', key: 'marketing' },
                              { label: 'Autres OPEX', key: 'autres_opex' },
                              { label: 'OPEX total', key: 'opex_total', bold: true },
                              { label: '% du CA', key: 'opex_pct_ca', isPct: true },
                            ].filter(row => row.key === 'opex_total' || projections.some((p: any) => p[row.key] != null)).map((row) => (
                              <TableRow key={row.key} className={row.bold ? 'bg-muted/30' : ''}>
                                <TableCell className={`text-[10px] ${row.bold ? 'font-semibold' : 'text-muted-foreground'}`}>{row.label}</TableCell>
                                {projections.map((p: any) => {
                                  const val = row.key === 'opex_pct_ca' && p.ca ? ((p.opex_total || 0) / p.ca) * 100 : p[row.key];
                                  return (
                                    <TableCell key={p.annee} className={`text-[10px] text-right ${row.bold ? 'font-semibold' : ''} ${p.is_reel ? 'bg-muted/30' : ''}`}>
                                      {row.isPct ? pctFmt(val) : fmtM(val)}
                                    </TableCell>
                                  );
                                })}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {data.opex_detail?.length > 0 && (
                  <Card>
                    <CardContent className="py-3 px-0">
                      <p className="text-xs font-semibold px-4 mb-2">Détail des charges</p>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-[10px]">Poste</TableHead>
                            <TableHead className="text-[10px]">Type</TableHead>
                            <TableHead className="text-[10px] text-right">Montant annuel</TableHead>
                            <TableHead className="text-[10px] text-right">Croissance</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {data.opex_detail.map((op: any, i: number) => (
                            <TableRow key={i}>
                              <TableCell className="text-[10px] font-medium">{op.poste || op.label || op.nom}</TableCell>
                              <TableCell className="text-[10px] text-muted-foreground">{op.type || op.categorie || '—'}</TableCell>
                              <TableCell className="text-[10px] text-right">{fmtM(op.montant || op.amount)}</TableCell>
                              <TableCell className="text-[10px] text-right">{op.croissance != null ? pctFmt((op.croissance || 0) * 100) : '—'}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

          </div>
        </TabsContent>

        {/* ═══════════ TAB 6: PRODUITS & RH ═══════════ */}
        <TabsContent value="produits">
          <div className="space-y-6">

            {/* ─── SECTION PRODUITS ─── */}
            {produits.length > 0 && (
              <div className="space-y-3">
                <p className="text-sm font-semibold flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-primary" /> Produits
                </p>

                {/* Cartes produits */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {produits.map((p: any, i: number) => {
                    const marge = (p.prix_unitaire || 0) - (p.cout_unitaire || 0);
                    const margePct = p.prix_unitaire ? (marge / p.prix_unitaire) * 100 : 0;
                    const caAnnuel = (p.prix_unitaire || 0) * (p.volume_annuel || 0);
                    return (
                      <Card key={i}>
                        <CardContent className="py-3">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-xs font-semibold">{p.nom}</p>
                            <Badge variant="outline" className="text-[9px]">{((p.part_ca || 0) * 100).toFixed(0)}% CA</Badge>
                          </div>
                          <div className="space-y-1 text-[11px]">
                            <Row label="Prix unitaire" value={`${fmt(p.prix_unitaire)} ${devise}`} />
                            <Row label="Coût unitaire" value={`${fmt(p.cout_unitaire)} ${devise}`} />
                            <Row label="Marge unitaire" value={`${fmt(marge)} (${margePct.toFixed(0)}%)`} color={margePct > 30 ? 'text-green-600' : margePct > 10 ? 'text-amber-600' : 'text-red-500'} />
                            <Row label="Volume annuel" value={fmt(p.volume_annuel)} />
                            <Row label="CA annuel" value={`${fmtM(caAnnuel)} ${devise}`} />
                            <Row label="Croissance vol." value={`+${((p.taux_croissance_volume || 0) * 100).toFixed(0)}%/an`} color="text-green-600" />
                            {p.saisonnalite && <Row label="Saisonnalité" value={p.saisonnalite} />}
                          </div>
                          <Tracabilite estimation={p.estimation} />
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>

                {/* Tableau récap marges produits */}
                {produits.length > 1 && (
                  <Card>
                    <CardContent className="py-3 px-0">
                      <p className="text-xs font-semibold px-4 mb-2">Contribution par produit</p>
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-[10px]">Produit</TableHead>
                              <TableHead className="text-[10px] text-right">Prix</TableHead>
                              <TableHead className="text-[10px] text-right">Coût</TableHead>
                              <TableHead className="text-[10px] text-right">Marge %</TableHead>
                              <TableHead className="text-[10px] text-right">Volume</TableHead>
                              <TableHead className="text-[10px] text-right">CA annuel</TableHead>
                              <TableHead className="text-[10px] text-right">Marge totale</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {produits.map((p: any, i: number) => {
                              const marge = (p.prix_unitaire || 0) - (p.cout_unitaire || 0);
                              const margePct = p.prix_unitaire ? (marge / p.prix_unitaire) * 100 : 0;
                              const ca = (p.prix_unitaire || 0) * (p.volume_annuel || 0);
                              const margeTot = marge * (p.volume_annuel || 0);
                              return (
                                <TableRow key={i}>
                                  <TableCell className="text-[10px] font-medium">{p.nom}</TableCell>
                                  <TableCell className="text-[10px] text-right">{fmtM(p.prix_unitaire)}</TableCell>
                                  <TableCell className="text-[10px] text-right">{fmtM(p.cout_unitaire)}</TableCell>
                                  <TableCell className={`text-[10px] text-right font-medium ${margePct > 30 ? 'text-green-600' : margePct > 10 ? 'text-amber-600' : 'text-red-500'}`}>{pctFmt(margePct)}</TableCell>
                                  <TableCell className="text-[10px] text-right">{fmt(p.volume_annuel)}</TableCell>
                                  <TableCell className="text-[10px] text-right">{fmtM(ca)}</TableCell>
                                  <TableCell className="text-[10px] text-right font-medium">{fmtM(margeTot)}</TableCell>
                                </TableRow>
                              );
                            })}
                            <TableRow className="bg-muted/30">
                              <TableCell className="text-[10px] font-semibold">Total</TableCell>
                              <TableCell colSpan={4} />
                              <TableCell className="text-[10px] text-right font-semibold">
                                {fmtM(produits.reduce((s: number, p: any) => s + ((p.prix_unitaire || 0) * (p.volume_annuel || 0)), 0))}
                              </TableCell>
                              <TableCell className="text-[10px] text-right font-semibold">
                                {fmtM(produits.reduce((s: number, p: any) => s + (((p.prix_unitaire || 0) - (p.cout_unitaire || 0)) * (p.volume_annuel || 0)), 0))}
                              </TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Projection CA par produit */}
                {projections.length > 0 && produits.length > 0 && (
                  <Card>
                    <CardContent className="py-3 px-0">
                      <p className="text-xs font-semibold px-4 mb-2">Projection du CA par produit</p>
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-[10px]">Produit</TableHead>
                              {projections.map((p: any) => (
                                <TableHead key={p.annee} className="text-[10px] text-right">{p.annee_num}</TableHead>
                              ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {produits.map((prod: any, idx: number) => (
                              <TableRow key={idx}>
                                <TableCell className="text-[10px] font-medium">{prod.nom}</TableCell>
                                {projections.map((_: any, yi: number) => {
                                  const vol = (prod.volume_annuel || 0) * Math.pow(1 + (prod.taux_croissance_volume || 0), yi);
                                  return (
                                    <TableCell key={yi} className="text-[10px] text-right">{fmtM(vol * (prod.prix_unitaire || 0))}</TableCell>
                                  );
                                })}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {/* ─── SECTION SERVICES ─── */}
            {services.length > 0 && (
              <div className="space-y-3">
                <p className="text-sm font-semibold flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" /> Services
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {services.map((s: any, i: number) => {
                    const marge = (s.prix_unitaire || 0) - (s.cout_unitaire || 0);
                    const margePct = s.prix_unitaire ? (marge / s.prix_unitaire) * 100 : 0;
                    const caAnnuel = (s.prix_unitaire || 0) * (s.volume_annuel || 0);
                    return (
                      <Card key={i}>
                        <CardContent className="py-3">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-xs font-semibold">{s.nom}</p>
                            {s.part_ca != null && <Badge variant="outline" className="text-[9px]">{((s.part_ca || 0) * 100).toFixed(0)}% CA</Badge>}
                          </div>
                          <div className="space-y-1 text-[11px]">
                            {s.prix_unitaire != null && <Row label="Prix unitaire" value={`${fmt(s.prix_unitaire)} ${devise}`} />}
                            {s.cout_unitaire != null && <Row label="Coût unitaire" value={`${fmt(s.cout_unitaire)} ${devise}`} />}
                            {s.prix_unitaire != null && s.cout_unitaire != null && (
                              <Row label="Marge" value={`${fmt(marge)} (${margePct.toFixed(0)}%)`} color={margePct > 30 ? 'text-green-600' : 'text-amber-600'} />
                            )}
                            {s.volume_annuel != null && <Row label="Volume annuel" value={fmt(s.volume_annuel)} />}
                            {caAnnuel > 0 && <Row label="CA annuel" value={`${fmtM(caAnnuel)} ${devise}`} />}
                            {s.taux_croissance_volume != null && <Row label="Croissance" value={`+${((s.taux_croissance_volume || 0) * 100).toFixed(0)}%/an`} color="text-green-600" />}
                            {s.type_facturation && <Row label="Facturation" value={s.type_facturation} />}
                          </div>
                          <Tracabilite estimation={s.estimation} />
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ─── SECTION RH ─── */}
            {staff.length > 0 && (
              <div className="space-y-3">
                <p className="text-sm font-semibold flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" /> Ressources humaines
                </p>

                {/* Tableau principal */}
                <Card>
                  <CardContent className="py-3 px-0">
                    <p className="text-xs font-semibold px-4 mb-2">Effectifs et masse salariale</p>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-[10px]">Catégorie</TableHead>
                            <TableHead className="text-[10px] text-right">Effectif N</TableHead>
                            <TableHead className="text-[10px] text-right">Salaire brut/mois</TableHead>
                            <TableHead className="text-[10px] text-right">Charges soc.</TableHead>
                            <TableHead className="text-[10px] text-right">Coût annuel chargé</TableHead>
                            <TableHead className="text-[10px] text-right">Eff. An 5</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {staff.map((s: any, i: number) => {
                            const cy = s.par_annee?.find((y: any) => y.annee === 'CURRENT YEAR') || s.par_annee?.[0] || {};
                            const y5 = s.par_annee?.[s.par_annee?.length - 1] || {};
                            const salaire = cy.salaire_mensuel_brut || s.salaire_mensuel_brut || 0;
                            const effectif = cy.effectif || s.effectif_actuel || 0;
                            const charges = s.taux_charges_sociales || 0;
                            const coutAnnuel = effectif * salaire * 12 * (1 + charges);
                            return (
                              <TableRow key={i}>
                                <TableCell className="text-[10px] font-medium">
                                  {s.categorie}
                                  <Tracabilite estimation={s.estimation} />
                                </TableCell>
                                <TableCell className="text-[10px] text-right">{effectif}</TableCell>
                                <TableCell className="text-[10px] text-right">{fmtM(salaire)} {devise}</TableCell>
                                <TableCell className="text-[10px] text-right">{pctFmt(charges * 100)}</TableCell>
                                <TableCell className="text-[10px] text-right font-medium">{fmtM(coutAnnuel)} {devise}</TableCell>
                                <TableCell className="text-[10px] text-right">{y5.effectif || '—'}</TableCell>
                              </TableRow>
                            );
                          })}
                          <TableRow className="bg-muted/30">
                            <TableCell className="text-[10px] font-semibold">Total</TableCell>
                            <TableCell className="text-[10px] text-right font-semibold">
                              {staff.reduce((s: number, st: any) => {
                                const cy = st.par_annee?.find((y: any) => y.annee === 'CURRENT YEAR') || st.par_annee?.[0] || {};
                                return s + (cy.effectif || st.effectif_actuel || 0);
                              }, 0)}
                            </TableCell>
                            <TableCell className="text-[10px] text-right text-muted-foreground">—</TableCell>
                            <TableCell className="text-[10px] text-right text-muted-foreground">—</TableCell>
                            <TableCell className="text-[10px] text-right font-semibold">
                              {fmtM(staff.reduce((s: number, st: any) => {
                                const cy = st.par_annee?.find((y: any) => y.annee === 'CURRENT YEAR') || st.par_annee?.[0] || {};
                                const sal = cy.salaire_mensuel_brut || st.salaire_mensuel_brut || 0;
                                const eff = cy.effectif || st.effectif_actuel || 0;
                                return s + (eff * sal * 12 * (1 + (st.taux_charges_sociales || 0)));
                              }, 0))} {devise}
                            </TableCell>
                            <TableCell className="text-[10px] text-right font-semibold">
                              {staff.reduce((s: number, st: any) => {
                                const y5 = st.par_annee?.[st.par_annee?.length - 1] || {};
                                return s + (y5.effectif || 0);
                              }, 0)}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>

                {/* Évolution effectifs par année */}
                {staff.some((s: any) => s.par_annee?.length > 1) && (
                  <Card>
                    <CardContent className="py-3 px-0">
                      <p className="text-xs font-semibold px-4 mb-2">Évolution des effectifs</p>
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-[10px]">Catégorie</TableHead>
                              {(staff[0]?.par_annee || []).map((y: any, yi: number) => (
                                <TableHead key={yi} className="text-[10px] text-right">{y.annee || `An ${yi}`}</TableHead>
                              ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {staff.map((s: any, i: number) => (
                              <TableRow key={i}>
                                <TableCell className="text-[10px] font-medium">{s.categorie}</TableCell>
                                {(s.par_annee || []).map((y: any, yi: number) => (
                                  <TableCell key={yi} className="text-[10px] text-right">{y.effectif || 0}</TableCell>
                                ))}
                              </TableRow>
                            ))}
                            <TableRow className="bg-muted/30">
                              <TableCell className="text-[10px] font-semibold">Total</TableCell>
                              {(staff[0]?.par_annee || []).map((_: any, yi: number) => (
                                <TableCell key={yi} className="text-[10px] text-right font-semibold">
                                  {staff.reduce((sum: number, s: any) => sum + (s.par_annee?.[yi]?.effectif || 0), 0)}
                                </TableCell>
                              ))}
                            </TableRow>
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Évolution masse salariale par année */}
                {staff.some((s: any) => s.par_annee?.length > 1) && (
                  <Card>
                    <CardContent className="py-3 px-0">
                      <p className="text-xs font-semibold px-4 mb-2">Évolution de la masse salariale chargée</p>
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-[10px]">Catégorie</TableHead>
                              {(staff[0]?.par_annee || []).map((y: any, yi: number) => (
                                <TableHead key={yi} className="text-[10px] text-right">{y.annee || `An ${yi}`}</TableHead>
                              ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {staff.map((s: any, i: number) => (
                              <TableRow key={i}>
                                <TableCell className="text-[10px] font-medium">{s.categorie}</TableCell>
                                {(s.par_annee || []).map((y: any, yi: number) => {
                                  const cost = (y.effectif || 0) * (y.salaire_mensuel_brut || 0) * 12 * (1 + (s.taux_charges_sociales || 0));
                                  return (
                                    <TableCell key={yi} className="text-[10px] text-right">{fmtM(cost)}</TableCell>
                                  );
                                })}
                              </TableRow>
                            ))}
                            <TableRow className="bg-muted/30">
                              <TableCell className="text-[10px] font-semibold">Total</TableCell>
                              {(staff[0]?.par_annee || []).map((_: any, yi: number) => (
                                <TableCell key={yi} className="text-[10px] text-right font-semibold">
                                  {fmtM(staff.reduce((sum: number, s: any) => {
                                    const y = s.par_annee?.[yi] || {};
                                    return sum + ((y.effectif || 0) * (y.salaire_mensuel_brut || 0) * 12 * (1 + (s.taux_charges_sociales || 0)));
                                  }, 0))}
                                </TableCell>
                              ))}
                            </TableRow>
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {/* OPEX section moved to Projections tab */}

            {/* ─── CANAUX & RANGES ─── */}
            {data.channels?.length > 0 && (
              <Card>
                <CardContent className="py-3">
                  <p className="text-sm font-semibold mb-2">Canaux de distribution</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {data.channels.map((ch: any, i: number) => (
                      <div key={i} className="bg-muted/30 rounded-lg p-2.5 text-xs">
                        <p className="font-semibold text-[11px]">{ch.nom || ch.name}</p>
                        {ch.part_ca != null && <p className="text-muted-foreground mt-0.5">{pctFmt((ch.part_ca || 0) * 100)} du CA</p>}
                        {ch.description && <p className="text-muted-foreground mt-0.5">{ch.description}</p>}
                        <Tracabilite estimation={ch.estimation} />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {data.ranges && typeof data.ranges === 'object' && Object.keys(data.ranges).length > 0 && (
              <Card>
                <CardContent className="py-3">
                  <p className="text-sm font-semibold mb-2">Fourchettes de revenus</p>
                  <div className="space-y-1 text-[11px]">
                    {Object.entries(data.ranges).map(([key, val]: [string, any]) => (
                      <Row key={key} label={key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} value={typeof val === 'number' ? fmtM(val) : typeof val === 'object' ? `${fmtM(val?.min)} — ${fmtM(val?.max)}` : String(val || '—')} />
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* ═══════════ TAB 7: INVESTISSEMENT ═══════════ */}
        <TabsContent value="investissement">
          <div className="space-y-6">

            {/* ─── CAPEX ─── */}
            {capexItems.length > 0 && (
              <div className="space-y-3">
                <p className="text-sm font-semibold flex items-center gap-2">
                  <Landmark className="h-4 w-4 text-primary" /> Plan d'investissement (CAPEX)
                </p>
                <Card>
                  <CardContent className="py-3 px-0">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-[10px]">Investissement</TableHead>
                            <TableHead className="text-[10px]">Catégorie</TableHead>
                            <TableHead className="text-[10px] text-right">Montant ({devise})</TableHead>
                            <TableHead className="text-[10px] text-right">Année</TableHead>
                            <TableHead className="text-[10px] text-right">Durée amort.</TableHead>
                            <TableHead className="text-[10px] text-right">Dot. annuelle</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {capexItems.map((c: any, i: number) => {
                            const montant = c.acquisition_value || c.montant || 0;
                            const taux = c.amortisation_rate || c.taux_amortissement || 0;
                            const duree = c.duree_amortissement || c.amortissement_annees || (taux > 0 ? Math.round(1 / taux) : 0);
                            const dotation = duree > 0 ? montant / duree : montant * taux;
                            return (
                              <TableRow key={i}>
                                <TableCell className="text-[10px] font-medium">
                                  {c.label || c.nom}
                                  <Tracabilite estimation={c.estimation} />
                                </TableCell>
                                <TableCell className="text-[10px] text-muted-foreground">{c.categorie || '—'}</TableCell>
                                <TableCell className="text-[10px] text-right">{fmtM(montant)}</TableCell>
                                <TableCell className="text-[10px] text-right">{c.acquisition_year || c.annee || '—'}</TableCell>
                                <TableCell className="text-[10px] text-right">{duree > 0 ? `${duree} ans` : `${(taux * 100).toFixed(0)}%`}</TableCell>
                                <TableCell className="text-[10px] text-right">{fmtM(dotation)}</TableCell>
                              </TableRow>
                            );
                          })}
                          <TableRow className="bg-muted/30">
                            <TableCell colSpan={2} className="text-[10px] font-semibold">Total CAPEX</TableCell>
                            <TableCell className="text-[10px] text-right font-semibold">
                              {fmtM(capexItems.reduce((s: number, c: any) => s + (c.acquisition_value || c.montant || 0), 0))}
                            </TableCell>
                            <TableCell colSpan={2} />
                            <TableCell className="text-[10px] text-right font-semibold">
                              {fmtM(capexItems.reduce((s: number, c: any) => {
                                const m = c.acquisition_value || c.montant || 0;
                                const t = c.amortisation_rate || c.taux_amortissement || 0;
                                const d = c.duree_amortissement || c.amortissement_annees || (t > 0 ? Math.round(1 / t) : 0);
                                return s + (d > 0 ? m / d : m * t);
                              }, 0))}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>

                {/* Amortissements par année */}
                {projections.length > 0 && (
                  <Card>
                    <CardContent className="py-3 px-0">
                      <p className="text-xs font-semibold px-4 mb-2">Amortissements prévisionnels</p>
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-[10px]">Poste</TableHead>
                              {projections.map((p: any) => (
                                <TableHead key={p.annee} className="text-[10px] text-right">{p.annee_num}</TableHead>
                              ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {[
                              { label: 'CAPEX annuel', key: 'capex_annuel' },
                              { label: 'Amortissements', key: 'amortissement', bold: true },
                              { label: 'VNC (valeur nette)', key: 'vnc' },
                            ].filter(r => r.key === 'amortissement' || projections.some((p: any) => p[r.key] != null)).map((row) => (
                              <TableRow key={row.key} className={row.bold ? 'bg-muted/30' : ''}>
                                <TableCell className={`text-[10px] ${row.bold ? 'font-semibold' : 'text-muted-foreground'}`}>{row.label}</TableCell>
                                {projections.map((p: any) => (
                                  <TableCell key={p.annee} className={`text-[10px] text-right ${row.bold ? 'font-semibold' : ''}`}>
                                    {fmtM(p[row.key])}
                                  </TableCell>
                                ))}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {/* ─── FINANCEMENT ─── */}
            <div className="space-y-3">
              <p className="text-sm font-semibold flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" /> Plan de financement
              </p>

              {/* Cartes prêts — format enrichi */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { key: 'ovo', label: 'Prêt OVO', data: loans.ovo, fallback: { amount: loans.ovo?.amount, rate: loans.ovo?.rate, term_years: loans.ovo?.term_years } },
                  { key: 'bancaire', label: 'Crédit bancaire', data: loans.bancaire || loans.bank },
                  { key: 'famille', label: 'Autofinancement / Famille', data: loans.famille || loans.family },
                ].filter(l => {
                  const d = l.data;
                  return d && ((d.montant || d.amount || 0) > 0);
                }).map((l) => {
                  const d = l.data;
                  const montant = d.montant || d.amount || 0;
                  const taux = d.taux || d.rate || 0;
                  const duree = d.duree_mois || d.term_months || ((d.term_years || d.duree_annees || 0) * 12);
                  const grace = d.grace_mois || d.grace_months || 0;
                  const mensualite = d.mensualite || d.monthly_payment || 0;
                  return (
                    <Card key={l.key}>
                      <CardContent className="py-3">
                        <p className="text-xs font-semibold mb-2">{l.label}</p>
                        <p className="text-xl font-bold text-primary">{fmtM(montant)} <span className="text-xs font-normal text-muted-foreground">{devise}</span></p>
                        <div className="space-y-1 mt-2 text-[11px]">
                          <Row label="Taux" value={pctFmt(taux > 1 ? taux : taux * 100)} />
                          {duree > 0 && <Row label="Durée" value={`${duree} mois (${(duree / 12).toFixed(1)} ans)`} />}
                          {grace > 0 && <Row label="Différé" value={`${grace} mois`} />}
                          {mensualite > 0 && <Row label="Mensualité" value={`${fmtM(mensualite)} ${devise}`} />}
                        </div>
                        <Tracabilite estimation={d.estimation} />
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* Sources de financement complémentaires */}
              {data.financing && Array.isArray(data.financing) && data.financing.length > 0 && (
                <Card>
                  <CardContent className="py-3">
                    <p className="text-xs font-semibold mb-2">Sources complémentaires</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {data.financing.map((f: any, i: number) => (
                        <div key={i} className="border border-border rounded-lg p-2.5 text-[11px] space-y-1">
                          <p className="font-semibold text-xs">{f.source || f.type || 'Source'}</p>
                          {f.montant != null && <Row label="Montant" value={`${fmtM(f.montant)} ${devise}`} />}
                          {f.part != null && <Row label="Part" value={pctFmt((f.part || 0) * 100)} />}
                          {f.condition && <Row label="Conditions" value={f.condition} />}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {data.financing && typeof data.financing === 'object' && !Array.isArray(data.financing) && Object.keys(data.financing).length > 0 && (
                <Card>
                  <CardContent className="py-3">
                    <p className="text-xs font-semibold mb-2">Détail du financement</p>
                    <div className="space-y-1 text-[11px]">
                      {Object.entries(data.financing).filter(([k]) => !['sources', 'methode', 'hypotheses', 'niveau', 'confiance'].includes(k)).map(([key, val]: [string, any]) => {
                        if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
                          return (
                            <div key={key} className="bg-muted/30 rounded-lg p-2.5 mb-1.5">
                              <p className="text-[10px] font-semibold mb-1">{key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</p>
                              <div className="space-y-0.5">
                                {Object.entries(val).filter(([k]) => !['sources', 'methode', 'hypotheses'].includes(k)).map(([k, v]) => (
                                  <div key={k} className="flex justify-between text-[10px]">
                                    <span className="text-muted-foreground">{k.replace(/_/g, ' ')}</span>
                                    <span className="font-medium">{typeof v === 'number' ? fmtM(v) : String(v)}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        }
                        return <Row key={key} label={key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} value={typeof val === 'number' ? fmtM(val) : String(val || '—')} />;
                      })}
                    </div>
                    <Tracabilite estimation={data.financing} />
                  </CardContent>
                </Card>
              )}
            </div>

            {/* ─── BFR & TRÉSORERIE ─── */}
            <div className="space-y-3">
              <p className="text-sm font-semibold flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" /> BFR et trésorerie
              </p>
              <Card>
                <CardContent className="py-3">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <MetricBox label="Délai clients" value={`${data.working_capital?.receivable_days?.[0] || data.bfr?.delai_clients || 0} j`} />
                    <MetricBox label="Délai fournisseurs" value={`${data.working_capital?.payable_days?.[0] || data.bfr?.delai_fournisseurs || 0} j`} />
                    <MetricBox label="Rotation stock" value={`${data.working_capital?.stock_days?.[0] || data.bfr?.delai_stock || 0} j`} />
                    <MetricBox label="BFR (jrs CA)" value={`${data.bfr?.bfr_jours_ca || '—'} j`} />
                  </div>
                  <Tracabilite estimation={data.bfr?.estimation || data.working_capital?.estimation} />
                </CardContent>
              </Card>

              {/* Évolution BFR/trésorerie sur les projections */}
              {projections.length > 0 && projections.some((p: any) => p.bfr != null || p.tresorerie_cumulee != null) && (
                <Card>
                  <CardContent className="py-3 px-0">
                    <p className="text-xs font-semibold px-4 mb-2">Évolution BFR & trésorerie</p>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-[10px]">Poste</TableHead>
                            {projections.map((p: any) => (
                              <TableHead key={p.annee} className="text-[10px] text-right">{p.annee_num}</TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {[
                            { label: 'BFR', key: 'bfr' },
                            { label: 'Δ BFR', key: 'variation_bfr' },
                            { label: 'Trésorerie cumulée', key: 'tresorerie_cumulee', bold: true },
                          ].filter(r => projections.some((p: any) => p[r.key] != null)).map((row) => (
                            <TableRow key={row.key} className={row.bold ? 'bg-muted/30' : ''}>
                              <TableCell className={`text-[10px] ${row.bold ? 'font-semibold' : 'text-muted-foreground'}`}>{row.label}</TableCell>
                              {projections.map((p: any) => (
                                <TableCell key={p.annee} className={`text-[10px] text-right ${row.bold ? 'font-semibold' : ''}`}>
                                  {fmtM(p[row.key])}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* ─── ÉCHÉANCIER ─── */}
            {data.echeancier?.length > 0 && (
              <div className="space-y-3">
                <p className="text-sm font-semibold flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-primary" /> Échéancier de remboursement
                </p>
                <Card>
                  <CardContent className="py-3 px-0">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-[10px]">Prêt</TableHead>
                            {data.echeancier[0]?.annees?.map((_: any, i: number) => (
                              <TableHead key={i} className="text-[10px] text-right">An {i + 1}</TableHead>
                            )) || projections.filter((p: any) => !p.is_reel).map((p: any) => (
                              <TableHead key={p.annee} className="text-[10px] text-right">{p.annee_num}</TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {data.echeancier.map((pret: any, i: number) => (
                            <TableRow key={i}>
                              <TableCell className="text-[10px] font-medium">{pret.label || pret.pret}</TableCell>
                              {(pret.annees || pret.montants || []).map((val: any, j: number) => {
                                const montant = typeof val === 'object' ? val.montant : val;
                                const dscr = typeof val === 'object' ? val.dscr : null;
                                return (
                                  <TableCell key={j} className="text-[10px] text-right">
                                    <div>{fmtM(montant)}</div>
                                    {dscr != null && (
                                      <div className={`text-[9px] font-semibold ${dscr >= 1.5 ? 'text-green-600' : dscr >= 1.2 ? 'text-amber-600' : 'text-red-600'}`}>
                                        DSCR {dscr}x
                                      </div>
                                    )}
                                  </TableCell>
                                );
                              })}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

          </div>
        </TabsContent>

        {/* ═══════════ TAB 8: ANALYSE ═══════════ */}
        {hasAnalyseTab && (
          <TabsContent value="analyse">
            <div className="space-y-4">
              <AnalysisSection
                title="Analyse investisseur"
                icon={<TrendingUp className="h-4 w-4 text-primary" />}
                data={analyseInvestisseur}
              />
              <AnalysisSection
                title="Analyse coaching"
                icon={<Users className="h-4 w-4 text-primary" />}
                data={analyseCoaching}
              />
              <AnalysisSection
                title="Analyse des marges"
                icon={<BarChart3 className="h-4 w-4 text-primary" />}
                data={analyseMarges}
              />
              <AnalysisSection
                title="Analyse RH"
                icon={<Users className="h-4 w-4 text-primary" />}
                data={analyseRH}
              />
              <AnalysisSection
                title="Analyse investissement"
                icon={<Landmark className="h-4 w-4 text-primary" />}
                data={analyseInvestissement}
              />
              <AnalysisSection
                title="Analyse financement"
                icon={<Landmark className="h-4 w-4 text-primary" />}
                data={analyseFinancement}
              />
            </div>
          </TabsContent>
        )}

        {/* ═══════════ TAB 9: AUDIT ═══════════ */}
        {hasAuditTab && (
          <TabsContent value="audit">
            <div className="space-y-4">
              {/* Explicabilité */}
              {explicabilite && (
                <Card>
                  <CardContent className="py-3">
                    <div className="flex items-center gap-2 mb-3">
                      <ShieldCheck className="h-4 w-4 text-primary" />
                      <p className="text-sm font-semibold">Explicabilité</p>
                      {explicabilite.score_confiance_global != null && (
                        <Badge variant={explicabilite.score_confiance_global >= 70 ? 'default' : explicabilite.score_confiance_global >= 40 ? 'secondary' : 'destructive'} className="text-[9px] ml-auto">
                          Confiance : {explicabilite.score_confiance_global}%
                        </Badge>
                      )}
                    </div>
                    <div className="space-y-3">
                      {explicabilite.zones_fiables?.length > 0 && (
                        <div>
                          <p className="text-[10px] font-medium text-green-700 mb-1">✓ Zones fiables</p>
                          <div className="space-y-1">
                            {explicabilite.zones_fiables.map((z: any, i: number) => (
                              <p key={i} className="text-xs text-muted-foreground bg-green-50 rounded px-2 py-1">{typeof z === 'string' ? z : z.texte || z.zone || JSON.stringify(z)}</p>
                            ))}
                          </div>
                        </div>
                      )}
                      {explicabilite.zones_estimees?.length > 0 && (
                        <div>
                          <p className="text-[10px] font-medium text-amber-700 mb-1">⚠ Zones estimées</p>
                          <div className="space-y-1">
                            {explicabilite.zones_estimees.map((z: any, i: number) => (
                              <p key={i} className="text-xs text-muted-foreground bg-amber-50 rounded px-2 py-1">{typeof z === 'string' ? z : z.texte || z.zone || JSON.stringify(z)}</p>
                            ))}
                          </div>
                        </div>
                      )}
                      {explicabilite.hypotheses_sensibles?.length > 0 && (
                        <div>
                          <p className="text-[10px] font-medium text-red-700 mb-1">⚡ Hypothèses sensibles</p>
                          <div className="space-y-1">
                            {explicabilite.hypotheses_sensibles.map((h: any, i: number) => (
                              <p key={i} className="text-xs text-muted-foreground bg-red-50 rounded px-2 py-1">{typeof h === 'string' ? h : h.texte || h.hypothese || JSON.stringify(h)}</p>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Audit Réconciliation */}
              {auditReconciliation && (
                <Card>
                  <CardContent className="py-3">
                    <div className="flex items-center gap-2 mb-3">
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                      <p className="text-sm font-semibold">Audit de réconciliation</p>
                    </div>

                    {auditReconciliation.commentaire_global && (
                      <p className="text-xs text-muted-foreground mb-3 italic border-l-2 border-primary/30 pl-2">{auditReconciliation.commentaire_global}</p>
                    )}

                    {auditReconciliation.reference_historique_retenue && (
                      <div className="mb-3">
                        <p className="text-[10px] font-medium text-muted-foreground">Référence historique</p>
                        <p className="text-xs">{typeof auditReconciliation.reference_historique_retenue === 'string' ? auditReconciliation.reference_historique_retenue : JSON.stringify(auditReconciliation.reference_historique_retenue)}</p>
                      </div>
                    )}

                    {/* Ponts de réconciliation */}
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      {['pont_ca', 'pont_opex', 'pont_personnel', 'pont_bfr'].map((pontKey) => {
                        const pont = auditReconciliation[pontKey];
                        if (!pont) return null;
                        const label = pontKey.replace('pont_', '').toUpperCase();
                        return (
                          <div key={pontKey} className="bg-muted/30 rounded-lg p-2.5">
                            <p className="text-[10px] font-semibold mb-1">Pont {label}</p>
                            {typeof pont === 'string' ? (
                              <p className="text-[10px] text-muted-foreground">{pont}</p>
                            ) : typeof pont === 'object' && !Array.isArray(pont) ? (
                              <div className="space-y-0.5 text-[10px]">
                                {Object.entries(pont).filter(([k]) => !['sources', 'methode', 'hypotheses', 'niveau', 'confiance'].includes(k)).map(([k, v]) => (
                                  <div key={k} className="flex justify-between">
                                    <span className="text-muted-foreground">{k.replace(/_/g, ' ')}</span>
                                    <span className="font-medium">{typeof v === 'number' ? fmtM(v) : String(v)}</span>
                                  </div>
                                ))}
                              </div>
                            ) : Array.isArray(pont) ? (
                              <div className="space-y-0.5 text-[10px]">
                                {pont.map((item: any, i: number) => (
                                  <p key={i} className="text-muted-foreground">{typeof item === 'string' ? item : item.texte || JSON.stringify(item)}</p>
                                ))}
                              </div>
                            ) : null}
                            <Tracabilite estimation={pont} />
                          </div>
                        );
                      })}
                    </div>

                    {/* Écarts, zones à revoir, hypothèses forcées */}
                    {auditReconciliation.ecarts_inputs_modele?.length > 0 && (
                      <div className="mb-2">
                        <p className="text-[10px] font-medium text-amber-700 mb-1">Écarts inputs ↔ modèle</p>
                        <div className="space-y-1">
                          {auditReconciliation.ecarts_inputs_modele.map((e: any, i: number) => (
                            <p key={i} className="text-[10px] text-muted-foreground bg-amber-50 rounded px-2 py-1">{typeof e === 'string' ? e : e.texte || e.description || JSON.stringify(e)}</p>
                          ))}
                        </div>
                      </div>
                    )}

                    {auditReconciliation.zones_a_revoir?.length > 0 && (
                      <div className="mb-2">
                        <p className="text-[10px] font-medium text-red-700 mb-1">Zones à revoir</p>
                        <div className="space-y-1">
                          {auditReconciliation.zones_a_revoir.map((z: any, i: number) => (
                            <p key={i} className="text-[10px] text-muted-foreground bg-red-50 rounded px-2 py-1">{typeof z === 'string' ? z : z.texte || JSON.stringify(z)}</p>
                          ))}
                        </div>
                      </div>
                    )}

                    {auditReconciliation.hypotheses_forcees?.length > 0 && (
                      <div>
                        <p className="text-[10px] font-medium text-muted-foreground mb-1">Hypothèses forcées</p>
                        <div className="space-y-1">
                          {auditReconciliation.hypotheses_forcees.map((h: any, i: number) => (
                            <p key={i} className="text-[10px] text-muted-foreground bg-muted/50 rounded px-2 py-1">{typeof h === 'string' ? h : h.texte || JSON.stringify(h)}</p>
                          ))}
                        </div>
                      </div>
                    )}

                    <Tracabilite estimation={auditReconciliation} />
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        )}
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
