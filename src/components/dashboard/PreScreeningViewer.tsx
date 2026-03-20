import { useState, useEffect } from 'react';
import ConfidenceIndicator from './ConfidenceIndicator';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertTriangle, CheckCircle2, XCircle, Info, FileSearch, Heart, Shield, Copy,
  Download, Target, TrendingUp, Banknote, RefreshCw, ChevronDown, ChevronUp,
  Wand2, Rocket, Zap, Building2, Globe, Users, Calendar, Scale
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface PreScreeningViewerProps {
  data: Record<string, any>;
  enterprise?: Record<string, any> | null;
  onRegenerate?: (programmeId?: string | null) => void;
  onLaunchPipeline?: () => void;
}

export default function PreScreeningViewer({ data, enterprise: ent, onRegenerate, onLaunchPipeline }: PreScreeningViewerProps) {
  const [anomalyFilter, setAnomalyFilter] = useState<string>('all');
  const [expandedCV, setExpandedCV] = useState<Record<string, boolean>>({});
  const [programmes, setProgrammes] = useState<any[]>([]);
  const [selectedProgrammeId, setSelectedProgrammeId] = useState<string | null>(null);

  useEffect(() => {
    supabase.from('programme_criteria')
      .select('id, name, description, sector_filter, country_filter')
      .eq('is_active', true)
      .then(({ data: d }) => setProgrammes(d || []));
  }, []);

  const score = data.pre_screening_score ?? data.score ?? 0;
  const classification = data.classification || 'COMPLETER_DABORD';
  const classLabel = data.classification_label || classification;
  const classDetail = data.classification_detail || '';
  const resumeExecutif = data.resume_executif || null;
  const qualiteDossier = data.qualite_dossier || {};
  const anomalies = (data.anomalies || []).map((a: any) => {
    if (typeof a === 'string') {
      try { return JSON.parse(a); } catch { return { title: a, severity: 'note', detail: '' }; }
    }
    return a;
  });
  const crossValidation = data.cross_validation || {};
  const santeFinanciere = data.sante_financiere || {};
  const potentiel = data.potentiel_et_reconstructibilite || null;
  const profilRisque = data.profil_risque || null;
  const planAction = data.plan_action || [];
  const pathway = data.pathway_financement || null;
  const recommandationPipeline = data.recommandation_pipeline || null;
  const programmeMatch = data.programme_match || null;

  const classConfig: Record<string, { color: string; bg: string; border: string; ring: string; icon: any }> = {
    AVANCER_DIRECTEMENT: { color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-300', ring: 'ring-emerald-500', icon: CheckCircle2 },
    ACCOMPAGNER: { color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-300', ring: 'ring-amber-500', icon: Wand2 },
    COMPLETER_DABORD: { color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-300', ring: 'ring-orange-500', icon: AlertTriangle },
    REJETER: { color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-300', ring: 'ring-red-500', icon: XCircle },
  };
  const cc = classConfig[classification] || classConfig.COMPLETER_DABORD;
  const ClassIcon = cc.icon;
  const scoreColor = score >= 70 ? 'text-emerald-600' : score >= 40 ? 'text-amber-600' : 'text-red-600';
  const scoreBg = score >= 70 ? 'bg-emerald-100 ring-emerald-400' : score >= 40 ? 'bg-amber-100 ring-amber-400' : 'bg-red-100 ring-red-400';

  const bloquants = anomalies.filter((a: any) => a.severity === 'bloquant');
  const attentions = anomalies.filter((a: any) => a.severity === 'attention');
  const notes = anomalies.filter((a: any) => a.severity === 'note');
  const filteredAnomalies = anomalyFilter === 'all'
    ? [...bloquants, ...attentions, ...notes]
    : anomalies.filter((a: any) => a.severity === anomalyFilter);

  const blockingActions = planAction.filter((a: any) => a.bloquant_pipeline);

  const handleCopySummary = () => {
    const exec = resumeExecutif?.synthese || classDetail;
    const text = `Pre-screening ${classification} (${score}/100)\n${exec}\n\nAnomalies: ${bloquants.length} bloquantes, ${attentions.length} attentions, ${notes.length} notes`;
    navigator.clipboard.writeText(text);
    toast.success('Résumé copié !');
  };

  const handleDownloadJSON = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pre_screening_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('JSON téléchargé');
  };

  const severityIcon = (s: string) => {
    if (s === 'bloquant') return <XCircle className="h-4 w-4 text-red-500 flex-none" />;
    if (s === 'attention') return <AlertTriangle className="h-4 w-4 text-amber-500 flex-none" />;
    return <Info className="h-4 w-4 text-muted-foreground flex-none" />;
  };

  const responsableBadge = (r: string) => {
    if (r === 'entrepreneur') return <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200">Entrepreneur</Badge>;
    if (r === 'coach') return <Badge variant="outline" className="text-[10px] bg-purple-50 text-purple-700 border-purple-200">Coach</Badge>;
    if (r === 'ia') return <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200">IA</Badge>;
    return null;
  };

  const effortBadge = (e: string) => {
    if (e === 'facile') return <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">Facile</Badge>;
    if (e === 'moyen') return <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200">Moyen</Badge>;
    if (e === 'difficile') return <Badge variant="outline" className="text-[10px] bg-red-50 text-red-700 border-red-200">Difficile</Badge>;
    return null;
  };

  const benchmarkVerdictColor = (v: string) => {
    if (v === 'conforme') return 'text-emerald-700 bg-emerald-50';
    if (v === 'optimiste') return 'text-blue-700 bg-blue-50';
    if (v === 'alerte') return 'text-amber-700 bg-amber-50';
    if (v === 'critique') return 'text-red-700 bg-red-50';
    return 'text-muted-foreground bg-muted';
  };

  const riskColor = (prob: string, impact: string) => {
    const high = ['elevee', 'élevée', 'fort'];
    const p = high.includes(prob) ? 2 : prob === 'moyenne' ? 1 : 0;
    const i = high.includes(impact) ? 2 : impact === 'moyen' ? 1 : 0;
    const level = p + i;
    if (level >= 3) return 'bg-red-50 border-red-200';
    if (level >= 2) return 'bg-amber-50 border-amber-200';
    return 'bg-muted/50 border-border';
  };

  const formatAmount = (v: number | null | undefined) => {
    if (v == null) return '—';
    return new Intl.NumberFormat('fr-FR').format(v);
  };

  const toggleCV = (key: string) => setExpandedCV(prev => ({ ...prev, [key]: !prev[key] }));

  const normCouverture = (key: string) => {
    const c = qualiteDossier.couverture?.[key];
    if (!c) return null;
    if (typeof c === 'boolean') return { couvert: c, documents_trouves: [], manquants_critiques: [] };
    return c;
  };

  // Enterprise info: prefer passed enterprise prop, fallback to data
  const entInfo = ent || data._enterprise_info || {};

  return (
    <div className="space-y-6">

      {/* ═══ HEADER — Score + Classification + Actions ═══ */}
      <Card className={`p-6 ${cc.bg} border-2 ${cc.border}`}>
        <div className="flex items-start gap-5">
          {/* Score circle */}
          <div className={`w-20 h-20 rounded-full flex items-center justify-center ring-4 ${scoreBg} flex-none`}>
            <span className={`text-3xl font-bold font-display ${scoreColor}`}>{score}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <ClassIcon className={`h-5 w-5 ${cc.color}`} />
              <Badge className={`${cc.bg} ${cc.color} border ${cc.border} text-sm font-semibold px-3 py-1`}>
                {classLabel}
              </Badge>
            </div>
            <p className="text-sm leading-relaxed">{classDetail}</p>
            {resumeExecutif?.synthese && (
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{resumeExecutif.synthese}</p>
            )}
          </div>
        </div>

        {/* Actions bar */}
        <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-border/30">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handleCopySummary}>
            <Copy className="h-3.5 w-3.5" /> Copier
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handleDownloadJSON}>
            <Download className="h-3.5 w-3.5" /> JSON
          </Button>
          <div className="flex-1" />
          {onRegenerate && (
            <div className="flex items-center gap-2">
              {programmes.length > 0 && (
                <Select value={selectedProgrammeId || 'none'} onValueChange={(v) => setSelectedProgrammeId(v === 'none' ? null : v)}>
                  <SelectTrigger className="w-[240px] h-8 text-xs">
                    <SelectValue placeholder="Critères programme (optionnel)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucun programme</SelectItem>
                    {programmes.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => onRegenerate(selectedProgrammeId)}>
                <RefreshCw className="h-3.5 w-3.5" /> Regénérer
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* ═══ ROW: Fiche Entreprise + Qualité Dossier ═══ */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Fiche entreprise */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm">Fiche entreprise</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {[
              { icon: Building2, label: 'Secteur', value: entInfo.sector || data._sector },
              { icon: Globe, label: 'Pays', value: entInfo.country || data._country },
              { icon: Users, label: 'Effectifs', value: entInfo.employees_count },
              { icon: Scale, label: 'Forme juridique', value: entInfo.legal_form },
              { icon: Calendar, label: 'Création', value: entInfo.creation_date },
              { icon: TrendingUp, label: 'CA estimé', value: santeFinanciere.ca_estime ? formatAmount(santeFinanciere.ca_estime) + ' FCFA' : null },
            ].filter(r => r.value).map(row => (
              <div key={row.label} className="flex items-center justify-between py-1">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <row.icon className="h-3.5 w-3.5" /> {row.label}
                </span>
                <span className="font-medium">{row.value}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Qualité du dossier */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <FileSearch className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm">Qualité du dossier</CardTitle>
              {qualiteDossier.score_qualite != null && (
                <Badge variant="outline" className="text-xs ml-auto">{qualiteDossier.score_qualite}/100</Badge>
              )}
            </div>
            {qualiteDossier.niveau_preuve && (
              <Badge variant="outline" className="text-[10px] w-fit">{qualiteDossier.niveau_preuve}</Badge>
            )}
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3 mb-4">
              <span className="text-xs text-muted-foreground whitespace-nowrap">Docs exploitables</span>
              <Progress value={qualiteDossier.total_documents > 0 ? (qualiteDossier.documents_exploitables / qualiteDossier.total_documents) * 100 : 0} className="h-2 flex-1" />
              <span className="text-xs font-semibold">{qualiteDossier.documents_exploitables || 0}/{qualiteDossier.total_documents || 0}</span>
            </div>
            {qualiteDossier.couverture && (
              <div className="grid grid-cols-2 gap-2">
                {['finance', 'legal', 'commercial', 'rh'].map(key => {
                  const c = normCouverture(key);
                  if (!c) return null;
                  return (
                    <div key={key} className={`rounded-lg border p-2.5 ${c.couvert ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                      <p className="text-xs font-semibold mb-1">{c.couvert ? '✅' : '❌'} {key.charAt(0).toUpperCase() + key.slice(1)}</p>
                      {c.documents_trouves?.length > 0 && (
                        <div className="text-[10px] text-emerald-700">{c.documents_trouves.map((d: string, i: number) => <p key={i}>• {d}</p>)}</div>
                      )}
                      {c.manquants_critiques?.length > 0 && (
                        <div className="text-[10px] text-red-600 mt-0.5">{c.manquants_critiques.map((d: string, i: number) => <p key={i} className="line-through opacity-70">• {d}</p>)}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {qualiteDossier.note_qualite && <p className="text-xs text-muted-foreground mt-3">{qualiteDossier.note_qualite}</p>}
          </CardContent>
        </Card>
      </div>

      {/* ═══ Forces & Faiblesses ═══ */}
      {resumeExecutif && (resumeExecutif.points_forts?.length > 0 || resumeExecutif.points_faibles?.length > 0) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Scale className="h-4 w-4 text-primary" /> Forces & Faiblesses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              {resumeExecutif.points_forts?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-emerald-700 mb-2 uppercase tracking-wide">Forces</p>
                  <div className="space-y-1.5">
                    {resumeExecutif.points_forts.map((p: string, i: number) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-emerald-700 bg-emerald-50 rounded-md px-3 py-2 border border-emerald-100">
                        <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 flex-none" /><span>{p}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {resumeExecutif.points_faibles?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-red-700 mb-2 uppercase tracking-wide">Faiblesses</p>
                  <div className="space-y-1.5">
                    {resumeExecutif.points_faibles.map((p: string, i: number) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-red-700 bg-red-50 rounded-md px-3 py-2 border border-red-100">
                        <XCircle className="h-3.5 w-3.5 mt-0.5 flex-none" /><span>{p}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {resumeExecutif.potentiel_estime && (
              <p className="text-xs italic text-muted-foreground mt-4 pt-3 border-t border-border">{resumeExecutif.potentiel_estime}</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* ═══ Anomalies & Red Flags ═══ */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3 flex-wrap">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <CardTitle className="text-sm">Anomalies & Red flags</CardTitle>
            {bloquants.length > 0 && <Badge variant="destructive" className="text-[10px]">{bloquants.length} bloquante{bloquants.length > 1 ? 's' : ''}</Badge>}
            {attentions.length > 0 && <Badge className="bg-amber-100 text-amber-700 border border-amber-200 text-[10px]">{attentions.length} attention{attentions.length > 1 ? 's' : ''}</Badge>}
            {notes.length > 0 && <Badge variant="outline" className="text-[10px]">{notes.length} note{notes.length > 1 ? 's' : ''}</Badge>}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-1.5 mb-4">
            {['all', 'bloquant', 'attention', 'note'].map(f => (
              <Button key={f} variant={anomalyFilter === f ? 'default' : 'outline'} size="sm" className="text-xs h-7 px-2.5"
                onClick={() => setAnomalyFilter(f)}>
                {f === 'all' ? 'Tout' : f.charAt(0).toUpperCase() + f.slice(1)}
              </Button>
            ))}
          </div>
          {filteredAnomalies.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-4">Aucune anomalie {anomalyFilter !== 'all' ? 'de ce type' : 'détectée'}</p>
          ) : (
            <div className="space-y-2">
              {filteredAnomalies.map((a: any, i: number) => (
                <div key={i} className={`p-3 rounded-lg border-l-4 ${
                  a.severity === 'bloquant' ? 'bg-red-50 border-l-red-500 border border-red-200' :
                  a.severity === 'attention' ? 'bg-amber-50 border-l-amber-500 border border-amber-200' :
                  'bg-slate-50 border-l-slate-300 border border-slate-200'
                }`}>
                  <div className="flex items-start gap-3">
                    {severityIcon(a.severity)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-sm font-semibold">{a.title}</span>
                        <Badge variant="outline" className="text-[10px]">{a.category}</Badge>
                        {a.effort && effortBadge(a.effort)}
                        {a.responsable && responsableBadge(a.responsable)}
                      </div>
                      <p className="text-xs text-muted-foreground">{a.detail}</p>
                      {a.impact_investisseur && (
                        <p className={`text-xs mt-1 font-medium ${a.severity === 'bloquant' ? 'text-red-600' : 'text-amber-600'}`}>
                          ⚠️ Impact : {a.impact_investisseur}
                        </p>
                      )}
                      {a.recommendation && (
                        <p className="text-xs mt-2 text-primary font-medium">💡 {a.recommendation}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ═══ ROW: Cross-validation + Santé financière ═══ */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Cross-validation */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <FileSearch className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm">Cross-validation</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {[
              { key: 'ca', label: `CA cohérent${crossValidation.ca_ecart_pct != null ? ` (écart ${crossValidation.ca_ecart_pct}%)` : ''}`, ok: crossValidation.ca_coherent, detail: crossValidation.ca_detail },
              { key: 'bilan', label: 'Bilan équilibré', ok: crossValidation.bilan_equilibre, detail: crossValidation.bilan_detail },
              { key: 'charges', label: 'Charges vs effectifs', ok: crossValidation.charges_vs_effectifs, detail: crossValidation.charges_vs_effectifs_detail },
              { key: 'tresorerie', label: 'Trésorerie cohérente', ok: crossValidation.tresorerie_coherent, detail: crossValidation.tresorerie_detail },
              { key: 'dates', label: 'Dates cohérentes', ok: crossValidation.dates_coherentes, detail: crossValidation.dates_detail },
            ].map(item => (
              <div key={item.key} className="border-b border-border last:border-0">
                <div className="flex items-center gap-2 py-2.5 cursor-pointer" onClick={() => item.detail && toggleCV(item.key)}>
                  {item.ok === true ? <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-none" /> :
                    item.ok === false ? <XCircle className="h-4 w-4 text-red-500 flex-none" /> :
                    <Info className="h-4 w-4 text-muted-foreground flex-none" />}
                  <span className="text-sm flex-1">{item.label}</span>
                  {item.detail && (expandedCV[item.key] ? <ChevronUp className="h-3 w-3 text-muted-foreground" /> : <ChevronDown className="h-3 w-3 text-muted-foreground" />)}
                </div>
                {item.detail && expandedCV[item.key] && (
                  <p className="text-xs text-muted-foreground pb-2 pl-6">{item.detail}</p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Santé financière */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Heart className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm">Santé financière</CardTitle>
              {santeFinanciere.health_label && (
                <Badge variant="outline" className={`text-[10px] ml-auto ${
                  santeFinanciere.health_label === 'Saine' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                  santeFinanciere.health_label === 'Fragile' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                  santeFinanciere.health_label === 'Critique' ? 'bg-red-50 text-red-700 border-red-200' :
                  'bg-muted text-muted-foreground'
                }`}>{santeFinanciere.health_label}</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {santeFinanciere.benchmark_comparison?.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Indicateur</TableHead>
                    <TableHead className="text-xs">Entreprise</TableHead>
                    <TableHead className="text-xs">Benchmark</TableHead>
                    <TableHead className="text-xs">Verdict</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {santeFinanciere.benchmark_comparison.map((b: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell className="text-xs font-medium">{b.indicateur}</TableCell>
                      <TableCell className="text-xs">{b.valeur_entreprise}</TableCell>
                      <TableCell className="text-xs">{b.benchmark_secteur}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] ${benchmarkVerdictColor(b.verdict)}`}>{b.verdict}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="space-y-2">
                {[
                  { label: 'CA estimé', value: santeFinanciere.ca_estime, suffix: '', field: 'ca_estime' },
                  { label: 'Marge brute', value: santeFinanciere.marge_brute_pct, suffix: '%', field: 'marge_brute' },
                  { label: 'Marge nette', value: santeFinanciere.marge_nette_pct, suffix: '%', field: '' },
                  { label: 'Endettement', value: santeFinanciere.ratio_endettement_pct, suffix: '%', field: '' },
                  { label: 'Trésorerie nette', value: santeFinanciere.tresorerie_nette, suffix: '', field: '' },
                ].map(kpi => (
                  <div key={kpi.label} className="flex items-center justify-between py-1">
                    <span className="text-xs text-muted-foreground">{kpi.label}</span>
                    <span className="text-sm font-semibold">
                      {kpi.value != null ? `${kpi.suffix === '' ? formatAmount(kpi.value) : kpi.value + kpi.suffix}` : '—'}
                      {kpi.field && <ConfidenceIndicator field={kpi.field} confidence={data._confidence} />}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {santeFinanciere.health_detail && (
              <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-border">{santeFinanciere.health_detail}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ═══ Potentiel & Reconstructibilité IA ═══ */}
      {potentiel && (
        <Card className="border-teal-200 bg-teal-50/30">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Wand2 className="h-4 w-4 text-teal-600" />
              <CardTitle className="text-sm text-teal-800">Potentiel & Reconstructibilité IA</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {potentiel.fiabilite_pipeline_estimee != null && (
              <div className="mb-4 p-3 rounded-lg bg-teal-100/50 border border-teal-200">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-teal-700">Fiabilité pipeline</span>
                  <Progress value={potentiel.fiabilite_pipeline_estimee} className="h-2 flex-1 max-w-xs" />
                  <span className="text-sm font-bold text-teal-800">{potentiel.fiabilite_pipeline_estimee}%</span>
                </div>
                {potentiel.fiabilite_detail && <p className="text-xs text-teal-600 mt-1">{potentiel.fiabilite_detail}</p>}
              </div>
            )}

            <div className="grid md:grid-cols-3 gap-4 mb-4">
              {potentiel.donnees_fiables?.length > 0 && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3">
                  <p className="text-xs font-semibold text-emerald-700 mb-2">✅ Données fiables</p>
                  {potentiel.donnees_fiables.map((d: string, i: number) => (
                    <p key={i} className="text-xs text-emerald-600 mb-0.5">• {d}</p>
                  ))}
                </div>
              )}
              {potentiel.donnees_estimables_ia?.length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3">
                  <p className="text-xs font-semibold text-amber-700 mb-2 flex items-center gap-1"><Wand2 className="h-3 w-3" /> Estimable par l'IA</p>
                  {potentiel.donnees_estimables_ia.map((d: string, i: number) => (
                    <p key={i} className="text-xs text-amber-600 mb-0.5">• {d}</p>
                  ))}
                </div>
              )}
              {potentiel.donnees_non_reconstituables?.length > 0 && (
                <div className="rounded-lg border border-red-200 bg-red-50/50 p-3">
                  <p className="text-xs font-semibold text-red-700 mb-2">❌ Non reconstituable</p>
                  {potentiel.donnees_non_reconstituables.map((d: string, i: number) => (
                    <p key={i} className="text-xs text-red-600 mb-0.5">• {d}</p>
                  ))}
                </div>
              )}
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              {potentiel.signaux_positifs?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-emerald-700 mb-1">📈 Signaux positifs</p>
                  {potentiel.signaux_positifs.map((s: string, i: number) => (
                    <p key={i} className="text-xs text-emerald-600">• {s}</p>
                  ))}
                </div>
              )}
              {potentiel.signaux_negatifs?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-red-700 mb-1">📉 Signaux négatifs</p>
                  {potentiel.signaux_negatifs.map((s: string, i: number) => (
                    <p key={i} className="text-xs text-red-600">• {s}</p>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ═══ Profil de risque ═══ */}
      {profilRisque && profilRisque.risques?.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm">Profil de risque</CardTitle>
              {profilRisque.score_risque != null && (
                <Badge variant="outline" className="text-xs ml-auto">Sûreté : {profilRisque.score_risque}/100</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-3">
              {profilRisque.risques.map((r: any, i: number) => (
                <div key={i} className={`rounded-lg border p-3 ${riskColor(r.probabilite, r.impact)}`}>
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <Badge variant="outline" className="text-[10px] font-semibold">{r.type}</Badge>
                    <Badge variant="outline" className="text-[10px]">P: {r.probabilite}</Badge>
                    <Badge variant="outline" className="text-[10px]">I: {r.impact}</Badge>
                  </div>
                  <p className="text-xs mb-1">{r.description}</p>
                  {r.mitigation && <p className="text-xs text-primary italic">🛡️ {r.mitigation}</p>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ═══ Plan d'action prioritaire ═══ */}
      {planAction.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm">Plan d'action prioritaire</CardTitle>
              {blockingActions.length > 0 && (
                <Badge variant="destructive" className="text-[10px]">{blockingActions.length} bloquante{blockingActions.length > 1 ? 's' : ''} pipeline</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {planAction.sort((a: any, b: any) => (a.priorite || 5) - (b.priorite || 5)).map((r: any, i: number) => (
                <div key={i} className={`flex items-start gap-3 p-3 rounded-lg border-l-4 ${
                  r.priorite <= 1 ? 'border-l-red-500 bg-red-50/50 border border-red-200' :
                  r.priorite <= 2 ? 'border-l-orange-500 bg-orange-50/50 border border-orange-200' :
                  r.priorite <= 3 ? 'border-l-blue-500 bg-blue-50/50 border border-blue-200' :
                  'border-l-slate-300 bg-slate-50 border border-slate-200'
                }`}>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-none ${
                    r.priorite <= 2 ? 'bg-red-100 text-red-700' : r.priorite <= 3 ? 'bg-amber-100 text-amber-700' : 'bg-muted text-muted-foreground'
                  }`}>P{r.priorite}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-sm font-medium">{r.action}</p>
                      {r.bloquant_pipeline && <Zap className="h-3 w-3 text-red-500" />}
                    </div>
                    <div className="flex flex-wrap gap-2 mt-1.5">
                      {r.responsable && responsableBadge(r.responsable)}
                      {r.effort && effortBadge(r.effort)}
                      {r.delai && <Badge variant="outline" className="text-[10px]">⏱️ {r.delai}</Badge>}
                      {r.impact_score && <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">📈 {r.impact_score}</Badge>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ═══ ROW: Pipeline recommendation + Pathway financement ═══ */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Recommandation pipeline */}
        {recommandationPipeline && (
          <Card className={`border ${recommandationPipeline.lancer_pipeline ? 'border-emerald-300 bg-emerald-50/30' : 'border-amber-300 bg-amber-50/30'}`}>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Rocket className="h-4 w-4 text-primary" />
                <CardTitle className="text-sm">
                  {recommandationPipeline.lancer_pipeline ? 'Dossier prêt' : 'Pipeline non recommandé'}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-xs mb-3">{recommandationPipeline.raison}</p>

              {recommandationPipeline.avertissement && (
                <div className="p-2 rounded bg-amber-100 border border-amber-200 mb-3">
                  <p className="text-[10px] text-amber-700">⚠️ {recommandationPipeline.avertissement}</p>
                </div>
              )}

              {recommandationPipeline.modules_pertinents?.length > 0 && (
                <div className="mb-3">
                  <p className="text-[10px] font-semibold mb-1">Modules pertinents :</p>
                  <div className="flex flex-wrap gap-1">
                    {recommandationPipeline.modules_pertinents.map((m: string, i: number) => (
                      <Badge key={i} variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">{m}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {recommandationPipeline.modules_inutiles?.length > 0 && (
                <div className="mb-3">
                  <p className="text-[10px] font-semibold mb-1">Insuffisamment alimentés :</p>
                  <div className="flex flex-wrap gap-1">
                    {recommandationPipeline.modules_inutiles.map((m: string, i: number) => (
                      <Badge key={i} variant="outline" className="text-[10px] bg-red-50 text-red-700 border-red-200">{m}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {onLaunchPipeline && (
                <div className="pt-2">
                  {recommandationPipeline.lancer_pipeline ? (
                    <Button onClick={onLaunchPipeline} size="sm" className="gap-2 w-full">
                      <Rocket className="h-4 w-4" /> Lancer le pipeline
                    </Button>
                  ) : (
                    <Button variant="outline" onClick={onLaunchPipeline} size="sm" className="gap-2 w-full opacity-70">
                      <Rocket className="h-4 w-4" /> Lancer quand même
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Pathway financement */}
        {pathway && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Banknote className="h-4 w-4 text-primary" />
                <CardTitle className="text-sm">Pathway de financement</CardTitle>
              </div>
              {pathway.type_recommande && (
                <Badge className="text-[10px] bg-primary/10 text-primary border-primary/20 w-fit">{pathway.type_recommande}</Badge>
              )}
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 mb-3">
                {pathway.montant_eligible_estime && (
                  <div className="p-2.5 rounded-lg bg-muted/50 border border-border">
                    <p className="text-[10px] text-muted-foreground">Montant éligible</p>
                    <p className="text-sm font-semibold">{pathway.montant_eligible_estime}</p>
                  </div>
                )}
                {pathway.timeline_estimee && (
                  <div className="p-2.5 rounded-lg bg-muted/50 border border-border">
                    <p className="text-[10px] text-muted-foreground">Timeline</p>
                    <p className="text-sm font-semibold">{pathway.timeline_estimee}</p>
                  </div>
                )}
              </div>
              {pathway.bailleurs_potentiels?.length > 0 && (
                <div className="mb-3">
                  <p className="text-[10px] font-semibold mb-1">Bailleurs potentiels</p>
                  <div className="flex flex-wrap gap-1">
                    {pathway.bailleurs_potentiels.map((b: string, i: number) => (
                      <Badge key={i} variant="outline" className="text-[10px]">{b}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {pathway.conditions_prealables?.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold mb-1">Conditions préalables</p>
                  {pathway.conditions_prealables.map((c: string, i: number) => (
                    <p key={i} className="text-[10px] text-muted-foreground">☐ {c}</p>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* ═══ Matching Programme ═══ */}
      {programmeMatch && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <Target className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm">Matching Programme</CardTitle>
              <Badge variant={programmeMatch.match_score >= 70 ? 'default' : 'destructive'} className="text-xs">
                {programmeMatch.match_score}/100
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">{programmeMatch.programme_name}</p>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-4">
              {/* Critères OK */}
              {programmeMatch.criteres_ok?.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-emerald-700 mb-2 uppercase tracking-wide">Critères remplis</h4>
                  {programmeMatch.criteres_ok.map((c: any, i: number) => (
                    <div key={i} className="flex items-start gap-2 mb-2 text-xs">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 mt-0.5 flex-none" />
                      <div>
                        <span className="font-medium">{typeof c === 'string' ? c : c.critere}</span>
                        {typeof c === 'object' && c.detail && <p className="text-muted-foreground">{c.detail}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Critères KO */}
              {programmeMatch.criteres_ko?.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-red-700 mb-2 uppercase tracking-wide">Critères non remplis</h4>
                  {programmeMatch.criteres_ko.map((c: any, i: number) => (
                    <div key={i} className="flex items-start gap-2 mb-2 text-xs">
                      <XCircle className="h-3.5 w-3.5 text-red-500 mt-0.5 flex-none" />
                      <div>
                        <span className="font-medium">{typeof c === 'string' ? c : c.critere}</span>
                        {typeof c === 'object' && c.detail && <p className="text-muted-foreground">{c.detail}</p>}
                        {typeof c === 'object' && c.comment_corriger && <p className="text-blue-600 mt-1">💡 {c.comment_corriger}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Critères partiels */}
              {programmeMatch.criteres_partiels?.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-amber-700 mb-2 uppercase tracking-wide">Critères partiels</h4>
                  {programmeMatch.criteres_partiels.map((c: any, i: number) => (
                    <div key={i} className="flex items-start gap-2 mb-2 text-xs">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-500 mt-0.5 flex-none" />
                      <div>
                        <span className="font-medium">{c.critere}</span>
                        {c.detail && <p className="text-muted-foreground">{c.detail}</p>}
                        {c.manque && <p className="text-amber-600 mt-1">⚠️ Manque : {c.manque}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {programmeMatch.recommandation && (
              <p className="text-sm mt-4 pt-3 border-t border-border font-medium">{programmeMatch.recommandation}</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
