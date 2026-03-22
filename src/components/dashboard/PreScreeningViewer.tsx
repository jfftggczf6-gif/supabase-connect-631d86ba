import { useState, useEffect } from 'react';
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

interface PreScreeningViewerProps {
  data: Record<string, any>;
  enterprise?: Record<string, any> | null;
  onRegenerate?: (programmeId?: string | null) => void;
  onLaunchPipeline?: () => void;
}

export default function PreScreeningViewer({ data, enterprise: ent, onRegenerate, onLaunchPipeline: _onLaunchPipeline }: PreScreeningViewerProps) {
  const [activeScope, setActiveScope] = useState('all');
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

  const handleDownloadHtml = () => {
    const content = document.getElementById('prescreening-viewer-content')?.innerHTML || '';
    const fullHtml = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>Diagnostic initial — ${entInfo.name || ''}</title>
    <style>@page{size:A4;margin:16mm}body{font-family:"Segoe UI",sans-serif;font-size:10pt;color:#1E293B;max-width:190mm;margin:0 auto;padding:20px}h2,h3,h4{margin-top:16px}table{width:100%;border-collapse:collapse}td,th{border:1px solid #ddd;padding:6px;text-align:left;font-size:9pt}</style>
    </head><body>${content}</body></html>`;
    const blob = new Blob([fullHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `diagnostic_initial_${new Date().toISOString().slice(0, 10)}.html`; a.click();
    URL.revokeObjectURL(url);
    toast.success('HTML téléchargé');
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
    return <Badge className="text-[10px] bg-blue-100 text-blue-700 border-blue-300">Utile</Badge>;
  };

  const benchmarkVerdictColor = (v: string) => {
    if (v === 'conforme') return 'text-emerald-700 bg-emerald-50';
    if (v === 'optimiste') return 'text-blue-700 bg-blue-50';
    if (v === 'alerte') return 'text-amber-700 bg-amber-50';
    if (v === 'critique') return 'text-red-700 bg-red-50';
    return 'text-muted-foreground bg-muted';
  };

  return (
    <div className="space-y-6" id="prescreening-viewer-content">

      {/* ══════════ ZONE 1 — Bandeau verdict ══════════ */}
      <Card className={`p-5 ${cc.bg} border-2 ${cc.border}`}>
        <div className="flex items-center gap-4">
          <div className={`w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold text-white ${scoreBgClass} flex-none`}>
            {score}
          </div>
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

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2 mt-4 pt-3 border-t border-border/30">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handleDownloadHtml}>
            <Download className="h-3.5 w-3.5" /> HTML (A4)
          </Button>
          <div className="flex-1" />
          {onRegenerate && (
            <div className="flex items-center gap-2">
              <Select value={selectedProgrammeId || 'none'} onValueChange={(v) => setSelectedProgrammeId(v === 'none' ? null : v)}>
                <SelectTrigger className="w-[220px] h-8 text-xs">
                  <SelectValue placeholder="Critères programme (optionnel)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucun programme</SelectItem>
                  {programmes.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => onRegenerate(selectedProgrammeId)}>
                <RefreshCw className="h-3.5 w-3.5" /> Regénérer
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* ══════════ ZONE 2 — Guide d'accompagnement ══════════ */}
      {guideCoach && (
        <Card className="border-2 border-blue-200 bg-blue-50/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-blue-600" /> Guide d'accompagnement du coach
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">

            {/* 1. Points bloquants — EN PREMIER */}
            {guideCoach.points_bloquants_pipeline?.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-red-700 mb-2 uppercase tracking-wide flex items-center gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5" /> Points bloquants
                </h4>
                <div className="space-y-1.5">
                  {guideCoach.points_bloquants_pipeline.map((p: any, i: number) => (
                    <div key={i} className="p-3 rounded-md bg-red-50 border border-red-200 border-l-4 border-l-red-500 text-xs">
                      <p className="font-medium text-red-800">{p.blocage}</p>
                      <p className="text-red-600 mt-0.5">Conséquence : {p.consequence}</p>
                      <p className="text-emerald-700 mt-0.5">Résolution : {p.resolution}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 2. Actions cette semaine */}
            {guideCoach.actions_coach_semaine?.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-blue-800 mb-2 uppercase tracking-wide flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" /> Actions recommandées
                </h4>
                <div className="space-y-1.5">
                  {guideCoach.actions_coach_semaine.map((a: any, i: number) => (
                    <div key={i} className="flex items-start gap-2 p-2.5 rounded-md bg-white border border-blue-100 text-xs">
                      <span className="font-bold text-blue-700 mt-0.5">{a.priorite || i + 1}.</span>
                      <div className="flex-1">
                        <p className="font-medium">{a.action}</p>
                        <p className="text-[10px] text-muted-foreground">{a.objectif}</p>
                      </div>
                      {/* durée estimée masquée pour le pilote */}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 3. Documents à demander */}
            {guideCoach.documents_a_demander?.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-blue-800 mb-2 uppercase tracking-wide flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5" /> Documents à demander
                </h4>
                <div className="space-y-1.5">
                  {guideCoach.documents_a_demander.map((d: any, i: number) => (
                    <div key={i} className="flex items-start gap-2 p-2.5 rounded-md bg-white border border-blue-100">
                      {urgenceBadge(d.urgence)}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium">{d.document}</p>
                        <p className="text-[10px] text-muted-foreground">{d.raison}</p>
                        {d.impact && <p className="text-[10px] text-blue-600 mt-0.5">Impact : {d.impact}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 4. Questions à poser */}
            {guideCoach.questions_entrepreneur?.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-blue-800 mb-2 uppercase tracking-wide flex items-center gap-1.5">
                  <MessageSquare className="h-3.5 w-3.5" /> Questions à poser à l'entrepreneur
                </h4>
                <div className="space-y-1.5">
                  {guideCoach.questions_entrepreneur.map((q: string, i: number) => (
                    <div key={i} className="p-2.5 rounded-md bg-white border border-blue-100 text-xs leading-relaxed">
                      <span className="font-semibold text-blue-700 mr-1.5">{i + 1}.</span> {q}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 5. Axes d'accompagnement */}
            {guideCoach.axes_coaching?.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-blue-800 mb-2 uppercase tracking-wide flex items-center gap-1.5">
                  <Target className="h-3.5 w-3.5" /> Axes d'accompagnement (3-6 mois)
                </h4>
                <div className="grid md:grid-cols-2 gap-2">
                  {guideCoach.axes_coaching.map((axe: any, i: number) => (
                    <div key={i} className="p-3 rounded-md bg-white border border-blue-100">
                      <p className="text-xs font-semibold text-blue-800 mb-1">{axe.axe}</p>
                      <p className="text-[10px] text-muted-foreground mb-1">{axe.diagnostic_rapide}</p>
                      <p className="text-[10px] text-blue-700 font-medium">Objectif : {axe.objectif_accompagnement}</p>
                      {axe.premieres_actions?.length > 0 && (
                        <div className="mt-1.5">
                          {axe.premieres_actions.map((a: string, j: number) => (
                            <p key={j} className="text-[10px] text-muted-foreground">→ {a}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 6. Alertes */}
            {guideCoach.alertes_coach?.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-amber-700 mb-2 uppercase tracking-wide flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5" /> Alertes
                </h4>
                <div className="space-y-1">
                  {guideCoach.alertes_coach.map((a: string, i: number) => (
                    <p key={i} className="text-xs text-amber-700 flex items-start gap-1.5">
                      <span className="text-amber-500 mt-0.5">●</span> {a}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ══════════ ZONE 3 — Comprendre l'entreprise ══════════ */}
      {contexte && (
        <div>
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" /> Comprendre l'entreprise
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

      {/* ══════════ ZONE 4 — Constats par scope ══════════ */}
      {allConstats.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" /> Constats
          </h3>

          {/* Filter bar */}
          <div className="flex gap-1.5 flex-wrap sticky top-0 z-10 bg-background py-2">
            {scopes.map(s => {
              const count = s.key === 'all' ? allConstats.length : (constatsByScope[s.key] || []).length;
              if (s.key !== 'all' && count === 0) return null;
              return (
                <button key={s.key} onClick={() => setActiveScope(s.key)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium border flex items-center gap-1.5 transition-colors ${
                    activeScope === s.key ? 'border-blue-400 text-blue-800 bg-blue-50' : 'border-border text-muted-foreground hover:bg-muted/50'
                  }`}>
                  {s.label}
                  <span className={`text-[10px] px-1.5 rounded-full ${
                    activeScope === s.key ? 'bg-blue-600 text-white' : 'bg-muted text-muted-foreground'
                  }`}>{count}</span>
                </button>
              );
            })}
          </div>

          {/* Constats cards */}
          <div className="space-y-2 mt-2">
            {sortedConstats.map((c, i) => {
              const sc = severityConfig[c.severite] || severityConfig.attention;
              const SevIcon = sc.icon;
              const scopeLabel = scopes.find(s => s.key === c.scope)?.label || c.scope;
              return (
                <div key={i} className={`p-3 rounded-lg border border-l-4 ${sc.border} ${sc.bg} shadow-sm`}>
                  <div className="flex items-start gap-2">
                    <SevIcon className={`h-4 w-4 ${sc.text} flex-none mt-0.5`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold text-foreground">{c.titre}</span>
                        {activeScope === 'all' && (
                          <Badge variant="outline" className="text-[10px]">{scopeLabel}</Badge>
                        )}
                      </div>
                      <p className="text-xs text-foreground leading-relaxed">{c.constat}</p>
                      {c.piste && (
                        <p className="text-[10px] mt-1.5 font-medium text-primary">→ {c.piste}</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ══════════ ZONE 5 — Repères sectoriels + Scénarios ══════════ */}
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

      {scenarios && (
        <div className="grid md:grid-cols-3 gap-3">
          {[
            { key: 'scenario_pessimiste', label: 'Pessimiste', color: 'border-red-200 bg-red-50/30' },
            { key: 'scenario_base', label: 'Réaliste', color: 'border-amber-200 bg-amber-50/30' },
            { key: 'scenario_optimiste', label: 'Optimiste', color: 'border-emerald-200 bg-emerald-50/30' },
          ].map(s => {
            const sc = scenarios[s.key];
            if (!sc) return null;
            return (
              <Card key={s.key} className={`${s.color}`}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="text-xs font-semibold">{s.label}</h4>
                    {sc.probabilite && <Badge variant="outline" className="text-[10px]">{sc.probabilite}</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed mb-2">{sc.description}</p>
                  <div className="flex gap-3 text-xs">
                    {sc.ca_estime && <div><span className="text-muted-foreground">CA An3 :</span> <span className="font-medium">{sc.ca_estime}</span></div>}
                    {sc.ebitda_estime && <div><span className="text-muted-foreground">EBITDA :</span> <span className="font-medium">{sc.ebitda_estime}</span></div>}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ══════════ ZONE 6 — Matching programme ══════════ */}
      {programmeMatch && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm">Matching programme</CardTitle>
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

      {/* ══════════ ZONE 7 — Verdict final ══════════ */}
      {(verdictAnalyste?.synthese_pour_comite || classDetail) && (
        <Card className="bg-muted/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Verdict</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm leading-relaxed whitespace-pre-line">
              {verdictAnalyste?.synthese_pour_comite || classDetail}
            </p>
            {verdictAnalyste?.deal_breakers?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-red-700 mb-1">Deal breakers</p>
                {verdictAnalyste.deal_breakers.map((d: string, i: number) => (
                  <p key={i} className="text-xs text-red-600">• {d}</p>
                ))}
              </div>
            )}
            {verdictAnalyste?.conditions_sine_qua_non?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-amber-700 mb-1">Conditions sine qua non</p>
                {verdictAnalyste.conditions_sine_qua_non.map((c: string, i: number) => (
                  <p key={i} className="text-xs text-amber-600">• {c}</p>
                ))}
              </div>
            )}
            {verdictAnalyste?.quick_wins?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-emerald-700 mb-1">Quick wins</p>
                {verdictAnalyste.quick_wins.map((q: string, i: number) => (
                  <p key={i} className="text-xs text-emerald-600">• {q}</p>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

    </div>
  );
}
