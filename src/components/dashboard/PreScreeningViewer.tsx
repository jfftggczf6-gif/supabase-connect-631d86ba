import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import SectionEditButton from './SectionEditButton';
import { downloadRichHtml, downloadRichPdf } from '@/lib/download-rich-html';
import { useAuth } from '@/hooks/useAuth';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertTriangle, CheckCircle2, XCircle, Download, RefreshCw,
  MessageSquare, FileText, Clock, AlertCircle, BookOpen, Target,
  TrendingUp, Banknote, BarChart3, Building2, Users, Gavel, Briefcase, Factory
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';

interface PreScreeningViewerProps {
  data: Record<string, any>;
  enterprise?: Record<string, any> | null;
  onRegenerate?: (programmeId?: string | null) => void;
  onLaunchPipeline?: () => void;
  enterpriseId?: string;
  onUpdated?: () => void;
}

// Adapter rétrocompatible : map l'ancien schéma (produit par submit-candidature
// et screen-candidatures) vers le nouveau (attendu par ce viewer). Conserve
// le contenu existant — n'écrase jamais un champ nouveau schéma déjà présent.
function normalizeOldSchema(d: Record<string, any> | null | undefined): Record<string, any> {
  if (!d) return {};
  const hasOld = !!(d.indicateurs_financiers || d.recommandation_accompagnement || d.matching_criteres);
  if (!hasOld) return d;

  const n: Record<string, any> = { ...d };

  if (!n.kpis_bandeau && d.indicateurs_financiers) {
    n.kpis_bandeau = {
      ca_n: d.indicateurs_financiers.ca_annuel ?? d.fiche_entreprise?.ca_declare ?? null,
      ca_growth_pct: d.indicateurs_financiers.croissance_ca_pct ?? null,
      marge_brute_pct: d.indicateurs_financiers.marge_estimee_pct ?? null,
    };
  }

  if (!n.programme_match && d.matching_criteres) {
    n.programme_match = {
      criteres_ok: d.matching_criteres.criteres_ok || [],
      criteres_ko: d.matching_criteres.criteres_ko || [],
      criteres_partiels: d.matching_criteres.criteres_partiels || [],
    };
  }

  if (!n.analyse_narrative && (d.resume_comite || d.points_vigilance?.length || d.recommandation_accompagnement)) {
    const reco = d.recommandation_accompagnement || {};
    n.analyse_narrative = {
      verdict_analyste: {
        synthese_pour_comite: typeof d.resume_comite === 'string' ? d.resume_comite : (reco.justification || ''),
        deal_breakers: Array.isArray(d.points_vigilance)
          ? d.points_vigilance.map((p: any) => p?.titre).filter(Boolean)
          : [],
        conditions_sine_qua_non: reco.conditions_prealables || [],
        quick_wins: reco.priorites_si_selectionnee || [],
      },
    };
  }

  if (!n.guide_coach && d.recommandation_accompagnement) {
    const reco = d.recommandation_accompagnement;
    n.guide_coach = {
      points_bloquants_pipeline: (reco.conditions_prealables || []).map((c: string) => ({
        blocage: c,
        consequence: 'Décaissement conditionné à la levée de ce blocage',
        resolution: c,
      })),
      actions_coach_semaine: (reco.priorites_si_selectionnee || []).map((p: string, i: number) => ({
        priorite: i + 1,
        action: p,
        objectif: '',
      })),
    };
  }

  return n;
}

export default function PreScreeningViewer({ data: rawData, enterprise: ent, onRegenerate, onLaunchPipeline: _onLaunchPipeline, enterpriseId, onUpdated }: PreScreeningViewerProps) {
  const data = useMemo(() => normalizeOldSchema(rawData), [rawData]);
  const { t } = useTranslation();
  const { session: authSession } = useAuth();
  const navigate = useNavigate();
  const [activeScope, setActiveScope] = useState('all');
  const [activeSection, setActiveSection] = useState('dashboard');
  const [programmes, setProgrammes] = useState<any[]>([]);
  const [selectedProgrammeId, setSelectedProgrammeId] = useState<string | null>(null);

  useEffect(() => {
    supabase.from('programme_criteria')
      .select('id, name, description, sector_filter, country_filter')
      .eq('is_active', true)
      .then(({ data: d }) => setProgrammes(d || []));
  }, []);

  // ─── Data extraction ───
  const score = data.pre_screening_score ?? data.score ?? 0;
  const classification = data.classification || 'COMPLETER_DABORD';
  const classLabel = data.classification_label || classification;
  const classDetail = data.classification_detail || '';
  const resumeExecutif = data.resume_executif || null;
  const kpis = data.kpis_bandeau || data.sante_financiere || {};
  const contexte = data.contexte_entreprise || null;
  const guideCoach = data.guide_coach || null;
  const sourcesConsultees = Array.isArray(data.sources_consultees) ? data.sources_consultees : [];
  const constatsByScope = data.constats_par_scope || {};
  const santeFinanciere = data.sante_financiere || {};
  const comparaisonSectorielle = data.analyse_narrative?.comparaison_sectorielle || null;
  const scenarios = data.analyse_narrative?.scenarios_prospectifs || null;
  const programmeMatch = data.programme_match || null;
  const verdictAnalyste = data.analyse_narrative?.verdict_analyste || null;
  const entInfo = ent || data._enterprise_info || {};

  // ─── Classification config ───
  const classConfig: Record<string, { color: string; bg: string; border: string; icon: any }> = {
    AVANCER_DIRECTEMENT: { color: 'text-success', bg: 'bg-card', border: 'border-success/30', icon: CheckCircle2 },
    ACCOMPAGNER: { color: 'text-foreground', bg: 'bg-card', border: 'border-warning/30', icon: Target },
    COMPLETER_DABORD: { color: 'text-foreground', bg: 'bg-card', border: 'border-warning/30', icon: AlertTriangle },
    REJETER: { color: 'text-destructive', bg: 'bg-card', border: 'border-destructive/30', icon: XCircle },
  };
  const cc = classConfig[classification] || classConfig.COMPLETER_DABORD;
  const scoreBgClass = score >= 70 ? 'bg-success' : score >= 40 ? 'bg-warning' : 'bg-destructive';

  const formatAmount = (v: number | null | undefined) => {
    if (v == null) return '—';
    if (Math.abs(v) >= 1_000_000) return (v / 1_000_000).toFixed(1).replace('.0', '') + 'M';
    if (Math.abs(v) >= 1_000) return (v / 1_000).toFixed(0) + 'K';
    return new Intl.NumberFormat('fr-FR').format(v);
  };

  const entId = ent?.id;
  const entName = entInfo.name || 'enterprise';

  const handleDownloadHtml = () => {
    if (entId) {
      downloadRichHtml('pre_screening', entId, entName, authSession, navigate);
    } else {
      toast.error('ID entreprise manquant');
    }
  };

  const handleDownloadPdf = () => {
    if (entId) {
      downloadRichPdf('pre_screening', entId, entName, authSession, navigate);
    } else {
      toast.error('ID entreprise manquant');
    }
  };

  // ─── Constats helpers ───
  const scopes = [
    { key: 'all', label: 'Tout', icon: BarChart3 },
    { key: 'financier', label: 'Financier', icon: Banknote },
    { key: 'commercial', label: 'Commercial', icon: Briefcase },
    { key: 'operationnel', label: 'Opérationnel', icon: Factory },
    { key: 'equipe_rh', label: 'Équipe & RH', icon: Users },
    { key: 'legal_conformite', label: 'Légal & conformité', icon: Gavel },
  ];

  const allConstats = Object.entries(constatsByScope).flatMap(
    ([scope, items]) => (Array.isArray(items) ? items : []).map((item: any) => ({ ...item, scope }))
  );
  const filteredConstats = activeScope === 'all'
    ? allConstats
    : allConstats.filter(c => c.scope === activeScope);

  const severityOrder = { urgent: 0, attention: 1, positif: 2 };
  const sortedConstats = [...filteredConstats].sort(
    (a, b) => (severityOrder[a.severite as keyof typeof severityOrder] ?? 1) - (severityOrder[b.severite as keyof typeof severityOrder] ?? 1)
  );

  const severityConfig: Record<string, { border: string; bg: string; text: string; icon: any }> = {
    urgent: { border: 'border-l-red-500', bg: 'bg-red-50/50', text: 'text-red-700', icon: XCircle },
    attention: { border: 'border-l-amber-500', bg: 'bg-amber-50/50', text: 'text-amber-700', icon: AlertTriangle },
    positif: { border: 'border-l-emerald-500', bg: 'bg-emerald-50/50', text: 'text-emerald-700', icon: CheckCircle2 },
  };

  const urgenceBadge = (u: string) => {
    if (u === 'bloquant') return <Badge className="text-[10px] bg-red-100 text-red-700 border-red-300">Bloquant</Badge>;
    if (u === 'important') return <Badge className="text-[10px] bg-orange-100 text-orange-700 border-orange-300">Important</Badge>;
    return <Badge className="text-[10px] bg-violet-100 text-violet-700 border-violet-300">Utile</Badge>;
  };

  // ─── Radar chart data — score by scope ───
  const radarData = scopes.filter(s => s.key !== 'all').map(s => {
    const items = constatsByScope[s.key] || [];
    if (!Array.isArray(items) || items.length === 0) return { dimension: s.label, score: 50 };
    const positifs = items.filter((c: any) => c.severite === 'positif').length;
    const urgents = items.filter((c: any) => c.severite === 'urgent').length;
    const total = items.length;
    // Score: 100 if all positive, 0 if all urgent, proportional otherwise
    const score = total > 0 ? Math.round(((positifs * 100) + ((total - positifs - urgents) * 50)) / total) : 50;
    return { dimension: s.label, score };
  });

  const benchmarkVerdictColor = (v: string) => {
    if (v === 'conforme') return 'text-emerald-700 bg-emerald-50';
    if (v === 'optimiste') return 'text-violet-700 bg-violet-50';
    if (v === 'alerte') return 'text-amber-700 bg-amber-50';
    if (v === 'critique') return 'text-red-700 bg-red-50';
    return 'text-muted-foreground bg-muted';
  };

  const editBtn = (sectionPath: string, sectionTitle: string) =>
    enterpriseId && onUpdated ? (
      <SectionEditButton enterpriseId={enterpriseId} deliverableType="pre_screening" sectionPath={sectionPath} sectionTitle={sectionTitle} onUpdated={onUpdated} />
    ) : null;

  // Table des matières sections (numérotées)
  const tocSections = [
    { id: 'dashboard', label: '1. Dashboard financier' },
    { id: 'comprendre', label: "2. Comprendre l'entreprise" },
    { id: 'reperes', label: '3. Repères sectoriels' },
    { id: 'radar', label: '4. Radar par dimension' },
    { id: 'constats', label: '5. Constats' },
    { id: 'criteres', label: '6. Critères programme' },
    { id: 'verdict', label: '7. Verdict' },
    { id: 'guide', label: "8. Guide d'accompagnement" },
  ];

  const scrollToSection = (id: string) => {
    setActiveSection(id);
    document.getElementById(`diag-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="flex gap-6 min-h-0" id="prescreening-viewer-content">

      {/* ══════════ SIDEBAR TABLE DES MATIÈRES ══════════ */}
      <aside className="w-56 flex-none sticky top-0 self-start space-y-0.5 hidden lg:block">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Table des matières</p>
        {tocSections.map(s => (
          <button
            key={s.id}
            onClick={() => scrollToSection(s.id)}
            className={`w-full text-left text-xs px-3 py-1.5 rounded-md transition-colors ${
              activeSection === s.id
                ? 'bg-primary text-primary-foreground font-semibold'
                : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            {s.label}
          </button>
        ))}
      </aside>

      {/* ══════════ CONTENU ══════════ */}
      <div className="flex-1 space-y-6 min-w-0">

      {/* ══════════ 1. Dashboard financier et présentation ══════════ */}
      <div id="diag-dashboard"></div>
      <Card className={`p-5 ${cc.bg} border-2 ${cc.border}`}>
        <div className="flex items-center gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-base font-semibold">{entInfo.name || '—'}</span>
              <Badge className={`${cc.bg} ${cc.color} border ${cc.border} text-xs font-semibold px-2 py-0.5`}>
                {classLabel}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {entInfo.sector || '—'} — {entInfo.country || '—'} — {entInfo.legal_form || '—'} — {entInfo.employees_count || '—'} personnes
            </p>
          </div>
        </div>

        {/* KPIs strip */}
        {(kpis.ca_n || kpis.ca_estime) && (
          <div className="grid grid-cols-4 border rounded-lg overflow-hidden mt-4 bg-card shadow-sm">
            <div className="p-3 text-center border-r bg-card">
              <p className="text-base font-semibold">{formatAmount(kpis.ca_n || kpis.ca_estime)}</p>
              <p className="text-[10px] text-muted-foreground">CA {kpis.annee_n || 'N'}</p>
              {kpis.ca_growth_pct != null && (
                <Badge variant="outline" className={`text-[10px] mt-1 ${kpis.ca_growth_pct < 0 ? 'bg-destructive/10 text-destructive border-destructive/20' : 'bg-success/10 text-success border-success/20'}`}>
                  {kpis.ca_growth_pct > 0 ? '+' : ''}{kpis.ca_growth_pct}% vs N-1
                </Badge>
              )}
            </div>
            <div className="p-3 text-center border-r bg-card">
              <p className="text-base font-semibold">{kpis.marge_brute_pct != null ? kpis.marge_brute_pct + '%' : (santeFinanciere.marge_brute_pct != null ? santeFinanciere.marge_brute_pct + '%' : '—')}</p>
              <p className="text-[10px] text-muted-foreground">Marge brute</p>
              {kpis.marge_brute_benchmark && (
                <Badge variant="outline" className="text-[10px] mt-1 bg-success/10 text-success border-success/20">{kpis.marge_brute_benchmark}</Badge>
              )}
            </div>
            <div className="p-3 text-center border-r bg-card">
              <p className="text-base font-semibold">{formatAmount(kpis.ebitda)}</p>
              <p className="text-[10px] text-muted-foreground">EBITDA</p>
            </div>
            <div className="p-3 text-center bg-card">
              <p className="text-base font-semibold">{formatAmount(kpis.tresorerie_nette ?? santeFinanciere.tresorerie_nette)}</p>
              <p className="text-[10px] text-muted-foreground">Trésorerie nette</p>
            </div>
          </div>
        )}

        {/* Context line */}
        {(kpis.ca_nm2 || kpis.resultat_net != null || kpis.nb_activites) && (
          <div className="grid grid-cols-3 border rounded-lg overflow-hidden mt-2 bg-card text-center text-xs shadow-sm">
            <div className="p-2 border-r bg-card">
              <p className="font-medium text-foreground">{formatAmount(kpis.ca_nm2)} → {formatAmount(kpis.ca_nm1)} → {formatAmount(kpis.ca_n || kpis.ca_estime)}</p>
              <p className="text-muted-foreground">Historique CA 3 ans</p>
            </div>
            <div className="p-2 border-r bg-card">
              <p className="font-medium text-foreground">{formatAmount(kpis.resultat_net)}</p>
              <p className="text-muted-foreground">Résultat net{kpis.resultat_net_pct != null ? ` (${kpis.resultat_net_pct}%)` : ''}</p>
            </div>
            <div className="p-2 bg-card">
              <p className="font-medium text-foreground">{kpis.nb_activites || '—'} activités</p>
              <p className="text-muted-foreground">{kpis.liste_activites || ''}</p>
            </div>
          </div>
        )}

        {/* Summary line */}
        {resumeExecutif?.synthese && (
          <p className="text-xs text-foreground mt-3 p-3 bg-card rounded-lg leading-relaxed border shadow-sm">{resumeExecutif.synthese}</p>
        )}

        {/* CTAs déplacés dans la barre d'actions unifiée du dashboard (HTML/PDF/Régénérer) */}
      </Card>

      {/* ══════════ 2. Comprendre l'entreprise ══════════ */}
      <div id="diag-comprendre"></div>
      {contexte && (
        <div>
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" /> Comprendre l'entreprise {editBtn('contexte_entreprise', 'Contexte Entreprise')}
          </h3>
          <div className="space-y-3">
            {contexte.histoire && (
              <div className="p-4 rounded-lg bg-card border shadow-sm">
                <h4 className="text-xs font-semibold mb-2 text-foreground">L'histoire</h4>
                <p className="text-xs text-foreground leading-relaxed">{contexte.histoire}</p>
              </div>
            )}
            {contexte.marche && (
              <div className="p-4 rounded-lg bg-card border shadow-sm">
                <h4 className="text-xs font-semibold mb-2 text-foreground">Le marché</h4>
                <p className="text-xs text-foreground leading-relaxed">{contexte.marche}</p>
              </div>
            )}
            {contexte.activite && (
              <div className="p-4 rounded-lg bg-card border shadow-sm">
                <h4 className="text-xs font-semibold mb-2 text-foreground">L'activité</h4>
                <p className="text-xs text-foreground leading-relaxed">{contexte.activite}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════ 3. Repères sectoriels ══════════ */}
      <div id="diag-reperes"></div>
      {(comparaisonSectorielle?.benchmark_detail?.length > 0 || santeFinanciere.benchmark_comparison?.length > 0) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" /> Repères sectoriels
            </CardTitle>
            {comparaisonSectorielle?.positionnement_global && (
              <p className="text-xs text-muted-foreground mt-1">{comparaisonSectorielle.positionnement_global}</p>
            )}
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Indicateur</TableHead>
                  <TableHead className="text-xs">Entreprise</TableHead>
                  <TableHead className="text-xs">Secteur</TableHead>
                  <TableHead className="text-xs">Position</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(comparaisonSectorielle?.benchmark_detail || santeFinanciere.benchmark_comparison || []).map((b: any, i: number) => (
                  <TableRow key={i}>
                    <TableCell className="text-xs font-medium">{b.indicateur}</TableCell>
                    <TableCell className="text-xs">{b.valeur_entreprise}</TableCell>
                    <TableCell className="text-xs">{b.mediane_secteur || b.benchmark_secteur || '—'}</TableCell>
                    <TableCell>
                      <Badge className={`text-[10px] ${benchmarkVerdictColor(b.position || b.verdict || '')}`}>
                        {b.position || b.verdict || '—'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* ══════════ 4. Radar par dimension ══════════ */}
      <div id="diag-radar"></div>
      {radarData.some(d => d.score !== 50) && (
        <Card className="border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" /> Radar — Évaluation par dimension
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="75%">
                  <PolarGrid stroke="hsl(var(--border))" />
                  <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                  <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 9 }} />
                  <Radar name="Score" dataKey="score" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.2} strokeWidth={2} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ══════════ 5. Constats — UN seul bloc continu avec sous-sections ══════════ */}
      <div id="diag-constats"></div>
      {allConstats.length > 0 && (
        <Card className="bg-white">
          <CardContent className="p-0">
            <div className="flex items-center gap-2 p-5 border-b border-border">
              <BarChart3 className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">Constats</h3>
              <div className="ml-auto">{editBtn('constats_par_scope', 'Constats')}</div>
            </div>
            <div className="divide-y divide-border">
              {scopes.filter(s => s.key !== 'all').map(scope => {
                const items = (constatsByScope[scope.key] || []) as any[];
                if (items.length === 0) return null;
                const sortedItems = [...items].sort((a, b) =>
                  (severityOrder[a.severite as keyof typeof severityOrder] ?? 1) -
                  (severityOrder[b.severite as keyof typeof severityOrder] ?? 1)
                );
                const ScopeIcon = scope.icon;
                return (
                  <div key={scope.key} className="p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <ScopeIcon className="h-4 w-4 text-primary" />
                      <h4 className="text-sm font-bold text-foreground">{scope.label}</h4>
                    </div>
                    <div className="space-y-4">
                      {sortedItems.map((c, i) => {
                        const sc = severityConfig[c.severite] || severityConfig.attention;
                        const SevIcon = sc.icon;
                        return (
                          <div key={i}>
                            <div className="flex items-start gap-2 mb-1">
                              <SevIcon className={`h-3.5 w-3.5 ${sc.text} flex-none mt-0.5`} />
                              <span className="text-sm font-semibold text-foreground">{c.titre}</span>
                            </div>
                            <p className="text-sm text-foreground leading-relaxed ml-5">{c.constat}</p>
                            {c.piste && (
                              <p className="text-xs mt-1.5 font-medium text-primary ml-5">→ {c.piste}</p>
                            )}
                            {c.source && (
                              <p className="text-xs text-muted-foreground mt-1 italic ml-5">Source : {c.source}</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ══════════ 6. Critères programme ══════════ */}
      <div id="diag-criteres"></div>
      {!programmeMatch ? (
        <Card className="bg-white border-dashed">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" /> Critères programme
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Aucun programme évalué pour ce diagnostic. Si l'entreprise a une candidature à un programme
              avec critères définis par le chef de programme, ils seront auto-résolus à la prochaine régénération.
              Sinon, sélectionne un programme dans le menu déroulant ci-dessus puis clique sur <strong>Régénérer</strong>.
            </p>
            {programmes.length === 0 && (
              <p className="text-xs text-amber-600 mt-2">⚠ Aucun programme actif configuré dans <code>programme_criteria</code>.</p>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm">Critères programme</CardTitle>
              {programmeMatch.match_score != null && (
                <Badge variant="outline" className="ml-auto text-xs">{programmeMatch.match_score}/100</Badge>
              )}
            </div>
            {programmeMatch.programme_name && (
              <p className="text-xs text-muted-foreground">{programmeMatch.programme_name}</p>
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            {programmeMatch.criteres_ok?.length > 0 && (
              <div className="space-y-1">
                {programmeMatch.criteres_ok.map((c: any, i: number) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <span className="text-emerald-500 mt-0.5">●</span>
                    <span><strong>{c.critere}</strong> — {c.detail}</span>
                  </div>
                ))}
              </div>
            )}
            {programmeMatch.criteres_ko?.length > 0 && (
              <div className="space-y-1">
                {programmeMatch.criteres_ko.map((c: any, i: number) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <span className="text-red-500 mt-0.5">●</span>
                    <span><strong>{c.critere}</strong> — {c.detail}{c.comment_corriger ? ` → ${c.comment_corriger}` : ''}</span>
                  </div>
                ))}
              </div>
            )}
            {programmeMatch.criteres_partiels?.length > 0 && (
              <div className="space-y-1">
                {programmeMatch.criteres_partiels.map((c: any, i: number) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <span className="text-amber-500 mt-0.5">●</span>
                    <span><strong>{c.critere}</strong> — {c.detail}{c.manque ? ` (manque : ${c.manque})` : ''}</span>
                  </div>
                ))}
              </div>
            )}
            {programmeMatch.recommandation && (
              <p className="text-xs text-muted-foreground pt-2 border-t border-border">{programmeMatch.recommandation}</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* ══════════ 7. Verdict ══════════ */}
      <div id="diag-verdict"></div>
      {(verdictAnalyste?.synthese_pour_comite || classDetail) && (
        <Card className="bg-white border-2 border-primary/20 shadow-sm">
          <CardHeader className="pb-3 border-b border-border/50">
            <CardTitle className="text-sm flex items-center gap-2">
              <Gavel className="h-4 w-4 text-primary" /> Verdict
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            {/* Synthèse principale */}
            <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
              <p className="text-sm leading-relaxed whitespace-pre-line text-foreground">
                {verdictAnalyste?.synthese_pour_comite || classDetail}
              </p>
            </div>

            {/* Grille 3 colonnes : Deal breakers / Conditions / Quick wins (sans couleurs de fond) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {verdictAnalyste?.deal_breakers?.length > 0 && (
                <div className="p-3 rounded-lg bg-white border border-border">
                  <div className="flex items-center gap-1.5 mb-2">
                    <XCircle className="h-3.5 w-3.5 text-muted-foreground" />
                    <p className="text-[11px] font-semibold text-foreground uppercase tracking-wide">Deal breakers</p>
                  </div>
                  <ul className="space-y-1">
                    {verdictAnalyste.deal_breakers.map((d: string, i: number) => (
                      <li key={i} className="text-xs text-foreground leading-relaxed">• {d}</li>
                    ))}
                  </ul>
                </div>
              )}
              {verdictAnalyste?.conditions_sine_qua_non?.length > 0 && (
                <div className="p-3 rounded-lg bg-white border border-border">
                  <div className="flex items-center gap-1.5 mb-2">
                    <AlertTriangle className="h-3.5 w-3.5 text-muted-foreground" />
                    <p className="text-[11px] font-semibold text-foreground uppercase tracking-wide">Conditions sine qua non</p>
                  </div>
                  <ul className="space-y-1">
                    {verdictAnalyste.conditions_sine_qua_non.map((c: string, i: number) => (
                      <li key={i} className="text-xs text-foreground leading-relaxed">• {c}</li>
                    ))}
                  </ul>
                </div>
              )}
              {verdictAnalyste?.quick_wins?.length > 0 && (
                <div className="p-3 rounded-lg bg-white border border-border">
                  <div className="flex items-center gap-1.5 mb-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground" />
                    <p className="text-[11px] font-semibold text-foreground uppercase tracking-wide">Quick wins</p>
                  </div>
                  <ul className="space-y-1">
                    {verdictAnalyste.quick_wins.map((q: string, i: number) => (
                      <li key={i} className="text-xs text-foreground leading-relaxed">• {q}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ══════════ 8. Guide d'accompagnement du coach ══════════ */}
      <div id="diag-guide"></div>
      {guideCoach && (
        <Card className="bg-white">
          <CardContent className="p-0">
            <div className="flex items-center gap-2 p-5 border-b border-border">
              <BookOpen className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">Guide d'accompagnement du coach</h3>
              {editBtn('guide_coach', 'Guide Coach')}
            </div>
            <div className="divide-y divide-border">
              {guideCoach.points_bloquants_pipeline?.length > 0 && (
                <div className="p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertCircle className="h-4 w-4 text-primary" />
                    <h4 className="text-sm font-bold text-foreground uppercase tracking-wide">Points bloquants</h4>
                  </div>
                  <div className="space-y-4">
                    {guideCoach.points_bloquants_pipeline.map((p: any, i: number) => (
                      <div key={i}>
                        <p className="text-sm font-semibold text-foreground">❌ {p.blocage}</p>
                        <p className="text-sm text-foreground leading-relaxed mt-1">Conséquence : {p.consequence}</p>
                        <p className="text-xs text-primary font-medium mt-1">→ Résolution : {p.resolution}</p>
                        {p.source && <p className="text-xs text-muted-foreground mt-1 italic">Source : {p.source}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {guideCoach.actions_coach_semaine?.length > 0 && (
                <div className="p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Clock className="h-4 w-4 text-primary" />
                    <h4 className="text-sm font-bold text-foreground uppercase tracking-wide">Actions recommandées</h4>
                  </div>
                  <div className="space-y-3">
                    {guideCoach.actions_coach_semaine.map((a: any, i: number) => (
                      <div key={i}>
                        <p className="text-sm font-semibold text-foreground">{a.priorite || i + 1}. {a.action}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 ml-4">{a.objectif}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {guideCoach.documents_a_demander?.length > 0 && (
                <div className="p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <FileText className="h-4 w-4 text-primary" />
                    <h4 className="text-sm font-bold text-foreground uppercase tracking-wide">Documents à demander</h4>
                  </div>
                  <div className="space-y-3">
                    {guideCoach.documents_a_demander.map((d: any, i: number) => (
                      <div key={i} className="flex items-start gap-2">
                        <div className="flex-none">{urgenceBadge(d.urgence)}</div>
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-foreground">{d.document}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{d.raison}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {guideCoach.questions_entrepreneur?.length > 0 && (
                <div className="p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <MessageSquare className="h-4 w-4 text-primary" />
                    <h4 className="text-sm font-bold text-foreground uppercase tracking-wide">Questions à poser</h4>
                  </div>
                  <div className="space-y-2">
                    {guideCoach.questions_entrepreneur.map((q: string, i: number) => (
                      <p key={i} className="text-sm text-foreground leading-relaxed">
                        <span className="font-semibold mr-1.5">{i + 1}.</span>{q}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {guideCoach.axes_coaching?.length > 0 && (
                <div className="p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Target className="h-4 w-4 text-primary" />
                    <h4 className="text-sm font-bold text-foreground uppercase tracking-wide">Axes d'accompagnement</h4>
                  </div>
                  <div className="space-y-4">
                    {guideCoach.axes_coaching.map((axe: any, i: number) => (
                      <div key={i}>
                        <p className="text-sm font-semibold text-foreground">{axe.axe}</p>
                        <p className="text-sm text-foreground leading-relaxed mt-1">{axe.diagnostic_rapide}</p>
                        <p className="text-xs font-medium text-primary mt-1">→ Objectif : {axe.objectif_accompagnement}</p>
                        {axe.premieres_actions?.length > 0 && (
                          <ul className="mt-1 ml-4 space-y-0.5">
                            {axe.premieres_actions.map((a: string, j: number) => (
                              <li key={j} className="text-xs text-muted-foreground">• {a}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {guideCoach.alertes_coach?.length > 0 && (
                <div className="p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle className="h-4 w-4 text-primary" />
                    <h4 className="text-sm font-bold text-foreground uppercase tracking-wide">Alertes</h4>
                  </div>
                  <ul className="space-y-2">
                    {guideCoach.alertes_coach.map((a: string, i: number) => (
                      <li key={i} className="text-sm text-foreground leading-relaxed flex items-start gap-2">
                        <span className="text-primary mt-0.5">●</span>
                        <span>{a}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Footer sources consultées — masqué temporairement, re-activé après Phase 2 RAG
          sourcesConsultees.length > 0 && ...
      */}

      </div>
    </div>
  );
}
