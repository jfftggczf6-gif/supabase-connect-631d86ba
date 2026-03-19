import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  AlertTriangle, CheckCircle2, XCircle, Info, FileSearch, Heart, Shield, Copy,
  Download, Target, TrendingUp, Banknote, RefreshCw, ChevronDown, ChevronUp
} from 'lucide-react';
import { toast } from 'sonner';

interface ScreeningReportViewerProps {
  data: Record<string, any>;
  onRegenerate?: () => void;
}

export default function ScreeningReportViewer({ data, onRegenerate }: ScreeningReportViewerProps) {
  const [anomalyFilter, setAnomalyFilter] = useState<string>('all');
  const [expandedCV, setExpandedCV] = useState<Record<string, boolean>>({});

  const score = data.screening_score ?? 0;
  const verdict = data.verdict || 'INSUFFISANT';
  const summary = data.verdict_summary || '';
  const anomalies = (data.anomalies || []).map((a: any) => {
    let parsed = a;
    // Handle string-wrapped anomalies (double-serialized JSON)
    if (typeof parsed === 'string') {
      try { parsed = JSON.parse(parsed); } catch { return { title: parsed, severity: 'note', detail: '', category: 'general' }; }
    }
    // Handle case where the object has a title that is itself a JSON string
    if (parsed && typeof parsed === 'object' && typeof parsed.title === 'string' && parsed.title.startsWith('{')) {
      try {
        const inner = JSON.parse(parsed.title);
        if (inner && typeof inner === 'object' && inner.title) return inner;
      } catch { /* keep original */ }
    }
    // Handle case where the entire anomaly content is nested inside a single field
    if (parsed && typeof parsed === 'object') {
      // If title looks like a JSON blob, try to extract meaningful fields
      for (const key of ['title', 'detail', 'description']) {
        if (typeof parsed[key] === 'string' && parsed[key].startsWith('{') && parsed[key].includes('"title"')) {
          try {
            const inner = JSON.parse(parsed[key]);
            if (inner && typeof inner === 'object' && inner.title) return inner;
          } catch { /* continue */ }
        }
      }
    }
    return parsed;
  });
  const crossValidation = data.cross_validation || {};
  const docQuality = data.document_quality || {};
  const financialHealth = data.financial_health || {};
  const programmeMatch = data.programme_match || null;
  const resumeExecutif = data.resume_executif || null;
  const profilRisque = data.profil_risque || null;
  const recommandations = data.recommandations_prioritaires || [];
  const pathway = data.pathway_financement || null;

  const verdictConfig: Record<string, { color: string; bg: string; border: string }> = {
    ELIGIBLE: { color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
    CONDITIONNEL: { color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
    NON_ELIGIBLE: { color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200' },
    INSUFFISANT: { color: 'text-muted-foreground', bg: 'bg-muted', border: 'border-border' },
  };
  const vc = verdictConfig[verdict] || verdictConfig.INSUFFISANT;
  const scoreColor = score >= 70 ? 'text-emerald-600' : score >= 40 ? 'text-amber-600' : 'text-red-600';

  const bloquants = anomalies.filter((a: any) => a.severity === 'bloquant');
  const attentions = anomalies.filter((a: any) => a.severity === 'attention');
  const notes = anomalies.filter((a: any) => a.severity === 'note');

  const filteredAnomalies = anomalyFilter === 'all'
    ? [...bloquants, ...attentions, ...notes]
    : anomalies.filter((a: any) => a.severity === anomalyFilter);

  const handleCopySummary = () => {
    const exec = resumeExecutif?.synthese || summary;
    const text = `Screening ${verdict} (${score}/100)\n${exec}\n\nAnomalies: ${bloquants.length} bloquantes, ${attentions.length} attentions, ${notes.length} notes`;
    navigator.clipboard.writeText(text);
    toast.success('Résumé copié !');
  };

  const handleDownloadJSON = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `screening_report_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('JSON téléchargé');
  };

  const severityIcon = (s: string) => {
    if (s === 'bloquant') return <XCircle className="h-4 w-4 text-red-500 flex-none" />;
    if (s === 'attention') return <AlertTriangle className="h-4 w-4 text-amber-500 flex-none" />;
    return <Info className="h-4 w-4 text-muted-foreground flex-none" />;
  };

  const severityBg = (s: string) => {
    if (s === 'bloquant') return 'bg-red-50 border-red-200';
    if (s === 'attention') return 'bg-amber-50 border-amber-200';
    return 'bg-muted/50 border-border';
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

  const cvRow = (key: string, label: string, ok: boolean | null | undefined, detail?: string, ecart?: string) => (
    <div key={key} className="border-b border-border last:border-0">
      <div className="flex items-center gap-2 py-2 cursor-pointer" onClick={() => detail && toggleCV(key)}>
        {ok === true ? <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-none" /> :
          ok === false ? <XCircle className="h-4 w-4 text-red-500 flex-none" /> :
          <Info className="h-4 w-4 text-muted-foreground flex-none" />}
        <span className="text-sm flex-1">{label}</span>
        {ecart && <Badge variant="outline" className="text-[10px]">{ecart}</Badge>}
        {detail && (expandedCV[key] ? <ChevronUp className="h-3 w-3 text-muted-foreground" /> : <ChevronDown className="h-3 w-3 text-muted-foreground" />)}
      </div>
      {detail && expandedCV[key] && (
        <p className="text-xs text-muted-foreground pb-2 pl-6">{detail}</p>
      )}
    </div>
  );

  // Normalize couverture — handle both old (boolean) and new (object) format
  const normCouverture = (key: string) => {
    const c = docQuality.couverture?.[key];
    if (c == null) return null;
    if (typeof c === 'boolean') return { present: c, documents: [], manquants: [] };
    return c;
  };

  return (
    <div className="space-y-6">
      {/* Global action buttons */}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" className="gap-1.5" onClick={handleCopySummary}>
          <Copy className="h-3.5 w-3.5" /> Copier le résumé
        </Button>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={handleDownloadJSON}>
          <Download className="h-3.5 w-3.5" /> Télécharger JSON
        </Button>
        {onRegenerate && (
          <Button variant="outline" size="sm" className="gap-1.5" onClick={onRegenerate}>
            <RefreshCw className="h-3.5 w-3.5" /> Regénérer
          </Button>
        )}
      </div>

      {/* Section 1 — Verdict + Résumé exécutif */}
      <Card className={`p-6 ${vc.bg} ${vc.border} border`}>
        <div className="flex items-start gap-4 mb-4">
          <div className={`text-5xl font-display font-bold ${scoreColor}`}>{score}</div>
          <div className="flex-1">
            <Badge className={`${vc.bg} ${vc.color} border ${vc.border} text-sm font-semibold mb-2`}>
              {verdict}
            </Badge>
            <p className="text-sm">{summary}</p>
          </div>
        </div>

        {resumeExecutif && (
          <div className="pt-4 border-t border-border/50 space-y-4">
            {resumeExecutif.synthese && (
              <p className="text-sm leading-relaxed">{resumeExecutif.synthese}</p>
            )}
            <div className="grid md:grid-cols-2 gap-4">
              {resumeExecutif.points_forts?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-emerald-700 mb-1">Forces</p>
                  {resumeExecutif.points_forts.map((p: string, i: number) => (
                    <p key={i} className="text-xs text-emerald-600 flex items-start gap-1.5">
                      <CheckCircle2 className="h-3 w-3 mt-0.5 flex-none" />{p}
                    </p>
                  ))}
                </div>
              )}
              {resumeExecutif.points_faibles?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-red-700 mb-1">Faiblesses</p>
                  {resumeExecutif.points_faibles.map((p: string, i: number) => (
                    <p key={i} className="text-xs text-red-600 flex items-start gap-1.5">
                      <XCircle className="h-3 w-3 mt-0.5 flex-none" />{p}
                    </p>
                  ))}
                </div>
              )}
            </div>
            {resumeExecutif.decision_rationale && (
              <p className="text-xs italic text-muted-foreground">{resumeExecutif.decision_rationale}</p>
            )}
          </div>
        )}
      </Card>

      {/* Section 2 — Anomalies */}
      <div>
        <div className="flex items-center gap-3 mb-3 flex-wrap">
          <AlertTriangle className="h-5 w-5 text-muted-foreground" />
          <h3 className="font-display font-semibold text-base">Anomalies détectées</h3>
          <div className="flex gap-1.5 text-xs">
            {bloquants.length > 0 && <Badge variant="destructive" className="text-[10px]">{bloquants.length} bloquante{bloquants.length > 1 ? 's' : ''}</Badge>}
            {attentions.length > 0 && <Badge className="bg-amber-100 text-amber-700 border border-amber-200 text-[10px]">{attentions.length} attention{attentions.length > 1 ? 's' : ''}</Badge>}
            {notes.length > 0 && <Badge variant="outline" className="text-[10px]">{notes.length} note{notes.length > 1 ? 's' : ''}</Badge>}
          </div>
        </div>
        <div className="flex gap-1.5 mb-3">
          {['all', 'bloquant', 'attention', 'note'].map(f => (
            <Button key={f} variant={anomalyFilter === f ? 'default' : 'outline'} size="sm" className="text-xs h-7 px-2.5"
              onClick={() => setAnomalyFilter(f)}>
              {f === 'all' ? 'Tout' : f.charAt(0).toUpperCase() + f.slice(1)}
            </Button>
          ))}
        </div>
        {filteredAnomalies.length === 0 ? (
          <Card className="p-4 text-center text-sm text-muted-foreground">Aucune anomalie {anomalyFilter !== 'all' ? 'de ce type' : 'détectée'}</Card>
        ) : (
          <div className="space-y-2">
            {filteredAnomalies.map((a: any, i: number) => {
              // Final safety: if title still looks like JSON, try to extract fields
              let displayTitle = a.title || '';
              let displayDetail = a.detail || '';
              let displayCategory = a.category || 'general';
              let displayImpact = a.impact || '';
              let displayRecommendation = a.recommendation || '';
              let displayEffort = a.effort || '';
              let displaySeverity = a.severity || 'note';
              let displaySourceDocs = a.source_documents || [];

              if (typeof displayTitle === 'string' && displayTitle.startsWith('{')) {
                try {
                  const parsed = JSON.parse(displayTitle);
                  displayTitle = parsed.title || displayTitle;
                  displayDetail = parsed.detail || displayDetail;
                  displayCategory = parsed.category || displayCategory;
                  displayImpact = parsed.impact || displayImpact;
                  displayRecommendation = parsed.recommendation || displayRecommendation;
                  displayEffort = parsed.effort || displayEffort;
                  displaySeverity = parsed.severity || displaySeverity;
                  displaySourceDocs = parsed.source_documents || displaySourceDocs;
                } catch { /* keep as-is */ }
              }

              // Skip if detail is just a duplicate JSON string
              if (typeof displayDetail === 'string' && displayDetail.startsWith('{') && displayDetail.includes('"title"')) {
                try { const p = JSON.parse(displayDetail); displayDetail = p.detail || ''; } catch { displayDetail = ''; }
              }

              return (
                <Card key={i} className={`p-4 border ${severityBg(displaySeverity)}`}>
                  <div className="flex items-start gap-3">
                    {severityIcon(displaySeverity)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-sm font-semibold">{displayTitle}</span>
                        <Badge variant="outline" className="text-[10px]">{displayCategory}</Badge>
                        {displayEffort && effortBadge(displayEffort)}
                      </div>
                      {displayDetail && <p className="text-xs text-muted-foreground">{displayDetail}</p>}
                      {displayImpact && (
                        <p className={`text-xs mt-1 font-medium ${displaySeverity === 'bloquant' ? 'text-red-600' : 'text-amber-600'}`}>
                          ⚠️ Impact : {displayImpact}
                        </p>
                      )}
                      {displaySourceDocs?.length > 0 && (
                        <p className="text-[10px] text-muted-foreground/70 mt-1">📎 {displaySourceDocs.join(', ')}</p>
                      )}
                      {displayRecommendation && (
                        <p className="text-xs mt-2 text-primary font-medium">💡 {displayRecommendation}</p>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Section 3 — Cross-validation */}
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <FileSearch className="h-5 w-5 text-muted-foreground" />
          <h3 className="font-display font-semibold text-base">Cross-validation documentaire</h3>
        </div>
        <div>
          {cvRow('ca', `CA cohérent${crossValidation.ca_ecart_pct != null ? ` (écart ${crossValidation.ca_ecart_pct}%)` : ''}`,
            crossValidation.ca_coherent, crossValidation.ca_detail,
            crossValidation.ca_declared != null ? `Déclaré: ${formatAmount(crossValidation.ca_declared)}` : undefined)}
          {cvRow('bilan', `Bilan équilibré${crossValidation.bilan_ecart != null ? ` (écart ${formatAmount(crossValidation.bilan_ecart)})` : ''}`,
            crossValidation.bilan_equilibre, crossValidation.bilan_detail)}
          {cvRow('charges', 'Charges personnel cohérentes',
            crossValidation.charges_personnel_coherent, crossValidation.charges_personnel_detail)}
          {cvRow('tresorerie', 'Trésorerie cohérente',
            crossValidation.tresorerie_coherent, crossValidation.tresorerie_detail)}
          {cvRow('dates', 'Dates cohérentes',
            crossValidation.dates_coherentes, crossValidation.dates_detail)}
        </div>
        {crossValidation.notes?.length > 0 && (
          <div className="mt-3 pt-3 border-t border-border space-y-1">
            {crossValidation.notes.map((n: string, i: number) => (
              <p key={i} className="text-xs text-muted-foreground">• {n}</p>
            ))}
          </div>
        )}
      </Card>

      {/* Section 4 — Qualité documentaire */}
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <FileSearch className="h-5 w-5 text-muted-foreground" />
          <h3 className="font-display font-semibold text-base">Qualité documentaire</h3>
          {docQuality.niveau_preuve_global && (
            <Badge variant="outline" className="text-xs">{docQuality.niveau_preuve_global}</Badge>
          )}
        </div>
        <div className="flex items-center gap-4 mb-4">
          <span className="text-sm text-muted-foreground">Documents exploitables</span>
          <Progress value={docQuality.total_documents > 0 ? (docQuality.documents_exploitables / docQuality.total_documents) * 100 : 0} className="h-2 flex-1 max-w-xs" />
          <span className="text-sm font-semibold">{docQuality.documents_exploitables || 0}/{docQuality.total_documents || 0}</span>
        </div>

        {/* Couverture grid */}
        {docQuality.couverture && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
            {['legal', 'finance', 'commercial', 'rh', 'esg'].map(key => {
              const c = normCouverture(key);
              if (!c) return null;
              return (
                <div key={key} className={`rounded-lg border p-3 text-center ${c.present ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                  <p className="text-xs font-semibold mb-1">{c.present ? '✅' : '❌'} {key.charAt(0).toUpperCase() + key.slice(1)}</p>
                  {c.documents?.length > 0 && (
                    <div className="text-[10px] text-emerald-700">{c.documents.map((d: string, i: number) => <p key={i}>• {d}</p>)}</div>
                  )}
                  {c.manquants?.length > 0 && (
                    <div className="text-[10px] text-red-600 mt-1">{c.manquants.map((d: string, i: number) => <p key={i}>⊘ {d}</p>)}</div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {docQuality.note_qualite && <p className="text-xs text-muted-foreground mb-2">{docQuality.note_qualite}</p>}

        {docQuality.documents_manquants_critiques?.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-semibold text-red-600">Documents manquants critiques :</p>
            {docQuality.documents_manquants_critiques.map((d: string, i: number) => (
              <p key={i} className="text-xs text-red-500">• {d}</p>
            ))}
          </div>
        )}
        {docQuality.anciennete_documents && <p className="text-xs text-muted-foreground mt-2">📅 {docQuality.anciennete_documents}</p>}
      </Card>

      {/* Section 5 — Santé financière */}
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <Heart className="h-5 w-5 text-muted-foreground" />
          <h3 className="font-display font-semibold text-base">Santé financière</h3>
          {financialHealth.health_label && (
            <Badge variant="outline" className={`text-xs ${
              financialHealth.health_label === 'Saine' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
              financialHealth.health_label === 'Fragile' ? 'bg-amber-50 text-amber-700 border-amber-200' :
              financialHealth.health_label === 'Critique' ? 'bg-red-50 text-red-700 border-red-200' :
              'bg-muted text-muted-foreground'
            }`}>{financialHealth.health_label}</Badge>
          )}
        </div>

        {/* Mini P&L */}
        {financialHealth.compte_resultat_resume && (
          <div className="mb-4 p-3 rounded-lg bg-muted/50 border border-border">
            <p className="text-xs font-semibold mb-2">Compte de résultat résumé</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "Chiffre d'affaires", value: financialHealth.compte_resultat_resume.chiffre_affaires },
                { label: 'Marge brute', value: financialHealth.compte_resultat_resume.marge_brute },
                { label: 'EBITDA', value: financialHealth.compte_resultat_resume.ebitda },
                { label: 'Résultat net', value: financialHealth.compte_resultat_resume.resultat_net },
              ].map(item => (
                <div key={item.label} className="text-center">
                  <p className="text-[10px] text-muted-foreground">{item.label}</p>
                  <p className="text-sm font-semibold">{formatAmount(item.value)}</p>
                </div>
              ))}
            </div>
            {financialHealth.compte_resultat_resume.source && (
              <p className="text-[10px] text-muted-foreground mt-2">Source : {financialHealth.compte_resultat_resume.source}</p>
            )}
          </div>
        )}

        {/* Benchmark table */}
        {financialHealth.benchmark_comparison?.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Indicateur</TableHead>
                <TableHead className="text-xs">Entreprise</TableHead>
                <TableHead className="text-xs">Benchmark secteur</TableHead>
                <TableHead className="text-xs">Verdict</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {financialHealth.benchmark_comparison.map((b: any, i: number) => (
                <TableRow key={i}>
                  <TableCell className="text-xs font-medium">{b.indicateur}</TableCell>
                  <TableCell className="text-xs">{b.valeur_entreprise}</TableCell>
                  <TableCell className="text-xs">{b.benchmark_secteur}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`text-[10px] ${benchmarkVerdictColor(b.verdict)}`}>
                      {b.verdict}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          /* Fallback: old format KPIs */
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'Marge brute', value: financialHealth.marge_brute_pct, suffix: '%' },
              { label: 'Marge nette', value: financialHealth.marge_nette_pct, suffix: '%' },
              { label: 'Endettement', value: financialHealth.ratio_endettement_pct, suffix: '%' },
              { label: 'Liquidité', value: financialHealth.ratio_liquidite, suffix: '' },
              { label: 'BFR', value: financialHealth.bfr_jours, suffix: ' jours' },
              { label: 'DSCR', value: financialHealth.dscr, suffix: '' },
            ].map(kpi => (
              <div key={kpi.label} className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{kpi.label}</span>
                <span className="text-sm font-semibold">{kpi.value != null ? `${kpi.value}${kpi.suffix}` : '—'}</span>
              </div>
            ))}
          </div>
        )}

        {financialHealth.tresorerie_nette != null && (
          <p className="text-xs mt-3 text-muted-foreground">Trésorerie nette : <span className="font-semibold">{formatAmount(financialHealth.tresorerie_nette)}</span></p>
        )}
        {financialHealth.health_detail && (
          <p className="text-xs text-muted-foreground mt-2 pt-2 border-t border-border">{financialHealth.health_detail}</p>
        )}
        {!financialHealth.health_detail && financialHealth.benchmark_sector && (
          <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-border">📊 {financialHealth.benchmark_sector}</p>
        )}
      </Card>

      {/* Section 6 — Profil de risque */}
      {profilRisque && (
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <Target className="h-5 w-5 text-muted-foreground" />
            <h3 className="font-display font-semibold text-base">Profil de risque</h3>
            {profilRisque.score_risque != null && (
              <Badge variant="outline" className="text-xs">Score sûreté : {profilRisque.score_risque}/100</Badge>
            )}
          </div>

          {profilRisque.score_risque != null && (
            <div className="flex items-center gap-3 mb-4">
              <span className="text-xs text-muted-foreground">Risqué</span>
              <Progress value={profilRisque.score_risque} className="h-2 flex-1 max-w-xs" />
              <span className="text-xs text-muted-foreground">Sûr</span>
            </div>
          )}

          {profilRisque.risques_identifies?.length > 0 && (
            <div className="space-y-2 mb-4">
              {profilRisque.risques_identifies.map((r: any, i: number) => (
                <div key={i} className={`rounded-lg border p-3 ${riskColor(r.probabilite, r.impact)}`}>
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <Badge variant="outline" className="text-[10px]">{r.type}</Badge>
                    <Badge variant="outline" className="text-[10px]">P: {r.probabilite}</Badge>
                    <Badge variant="outline" className="text-[10px]">I: {r.impact}</Badge>
                  </div>
                  <p className="text-xs">{r.description}</p>
                  {r.mitigation && <p className="text-xs text-primary mt-1">🛡️ {r.mitigation}</p>}
                </div>
              ))}
            </div>
          )}

          <div className="grid md:grid-cols-3 gap-3 text-xs">
            {profilRisque.concentration_client && (
              <div className="p-2 rounded bg-muted/50 border border-border">
                <p className="font-semibold mb-0.5">Concentration client</p>
                <p className="text-muted-foreground">{profilRisque.concentration_client}</p>
              </div>
            )}
            {profilRisque.dependance_fournisseur && (
              <div className="p-2 rounded bg-muted/50 border border-border">
                <p className="font-semibold mb-0.5">Dépendance fournisseur</p>
                <p className="text-muted-foreground">{profilRisque.dependance_fournisseur}</p>
              </div>
            )}
            {profilRisque.risque_pays && (
              <div className="p-2 rounded bg-muted/50 border border-border">
                <p className="font-semibold mb-0.5">Risque pays</p>
                <p className="text-muted-foreground">{profilRisque.risque_pays}</p>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Section 7 — Plan d'action prioritaire */}
      {recommandations.length > 0 && (
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="h-5 w-5 text-muted-foreground" />
            <h3 className="font-display font-semibold text-base">Plan d'action prioritaire</h3>
          </div>
          <div className="space-y-2">
            {recommandations.sort((a: any, b: any) => (a.priorite || 5) - (b.priorite || 5)).map((r: any, i: number) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-lg border border-border bg-muted/30">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-none ${
                  r.priorite <= 2 ? 'bg-red-100 text-red-700' : r.priorite <= 3 ? 'bg-amber-100 text-amber-700' : 'bg-muted text-muted-foreground'
                }`}>P{r.priorite}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{r.action}</p>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {r.responsable && <Badge variant="outline" className="text-[10px]">👤 {r.responsable}</Badge>}
                    {r.delai && <Badge variant="outline" className="text-[10px]">⏱️ {r.delai}</Badge>}
                    {r.impact_score && <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">📈 {r.impact_score}</Badge>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Section 8 — Pathway de financement */}
      {pathway && (
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <Banknote className="h-5 w-5 text-muted-foreground" />
            <h3 className="font-display font-semibold text-base">Pathway de financement</h3>
          </div>

          {pathway.type_recommande && (
            <Badge className="mb-3 text-sm bg-primary/10 text-primary border-primary/20">{pathway.type_recommande}</Badge>
          )}

          <div className="grid md:grid-cols-2 gap-4 mb-3">
            {pathway.montant_eligible_estime && (
              <div className="p-3 rounded-lg bg-muted/50 border border-border">
                <p className="text-xs text-muted-foreground">Montant éligible estimé</p>
                <p className="text-sm font-semibold">{pathway.montant_eligible_estime}</p>
              </div>
            )}
            {pathway.timeline_estimee && (
              <div className="p-3 rounded-lg bg-muted/50 border border-border">
                <p className="text-xs text-muted-foreground">Timeline estimée</p>
                <p className="text-sm font-semibold">{pathway.timeline_estimee}</p>
              </div>
            )}
          </div>

          {pathway.bailleurs_potentiels?.length > 0 && (
            <div className="mb-3">
              <p className="text-xs font-semibold mb-1">Bailleurs potentiels</p>
              <div className="flex flex-wrap gap-1.5">
                {pathway.bailleurs_potentiels.map((b: string, i: number) => (
                  <Badge key={i} variant="outline" className="text-xs">{b}</Badge>
                ))}
              </div>
            </div>
          )}

          {pathway.conditions_prealables?.length > 0 && (
            <div>
              <p className="text-xs font-semibold mb-1">Conditions préalables</p>
              {pathway.conditions_prealables.map((c: string, i: number) => (
                <p key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                  <span className="text-amber-500">☐</span> {c}
                </p>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Section 9 — Programme match */}
      {programmeMatch && (
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <Shield className="h-5 w-5 text-muted-foreground" />
            <h3 className="font-display font-semibold text-base">Matching programme : {programmeMatch.programme_name}</h3>
            <Badge variant="outline" className="text-xs">{programmeMatch.match_score}/100</Badge>
          </div>
          <div className="space-y-2">
            {programmeMatch.criteres_ok?.map((c: any, i: number) => {
              const critere = typeof c === 'string' ? c : c.critere;
              const detail = typeof c === 'object' ? c.detail : null;
              return (
                <div key={i}>
                  <div className="flex items-center gap-2 text-xs">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 flex-none" />
                    <span className="font-medium">{critere}</span>
                  </div>
                  {detail && <p className="text-[10px] text-muted-foreground pl-5">{detail}</p>}
                </div>
              );
            })}
            {programmeMatch.criteres_partiels?.map((c: any, i: number) => {
              const critere = typeof c === 'string' ? c : c.critere;
              const detail = typeof c === 'object' ? c.detail : null;
              const manque = typeof c === 'object' ? c.manque : null;
              return (
                <div key={i}>
                  <div className="flex items-center gap-2 text-xs">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500 flex-none" />
                    <span className="font-medium">{critere}</span>
                  </div>
                  {detail && <p className="text-[10px] text-muted-foreground pl-5">{detail}</p>}
                  {manque && <p className="text-[10px] text-amber-600 pl-5">→ {manque}</p>}
                </div>
              );
            })}
            {programmeMatch.criteres_ko?.map((c: any, i: number) => {
              const critere = typeof c === 'string' ? c : c.critere;
              const detail = typeof c === 'object' ? c.detail : null;
              const fix = typeof c === 'object' ? c.comment_corriger : null;
              return (
                <div key={i}>
                  <div className="flex items-center gap-2 text-xs">
                    <XCircle className="h-3.5 w-3.5 text-red-500 flex-none" />
                    <span className="font-medium">{critere}</span>
                  </div>
                  {detail && <p className="text-[10px] text-muted-foreground pl-5">{detail}</p>}
                  {fix && <p className="text-[10px] text-primary pl-5">💡 {fix}</p>}
                </div>
              );
            })}
          </div>
          {programmeMatch.recommandation && (
            <p className="text-sm mt-3 pt-3 border-t border-border font-medium">{programmeMatch.recommandation}</p>
          )}
        </Card>
      )}
    </div>
  );
}
