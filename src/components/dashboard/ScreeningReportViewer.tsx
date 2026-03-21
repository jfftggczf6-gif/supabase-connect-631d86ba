import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, RefreshCw, CheckCircle2, XCircle, AlertCircle, Target, TrendingUp, Banknote, Shield, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

interface ScreeningReportViewerProps {
  data: Record<string, any>;
  onRegenerate?: () => void;
}

export default function ScreeningReportViewer({ data, onRegenerate }: ScreeningReportViewerProps) {
  const isNewFormat = !!(data.decision?.verdict);

  const handleDownloadHtml = () => {
    const content = document.getElementById('screening-viewer-content')?.innerHTML || '';
    const fullHtml = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>Décision Programme</title>
    <style>@page{size:A4;margin:16mm}body{font-family:"Segoe UI",sans-serif;font-size:10pt;color:#1E293B;max-width:190mm;margin:0 auto;padding:20px}table{width:100%;border-collapse:collapse}td,th{border:1px solid #ddd;padding:6px;text-align:left;font-size:9pt}h2{font-size:14pt;border-bottom:2px solid #1e3a5f;padding-bottom:4px;margin-top:20px}h3{font-size:11pt;margin-top:16px}.card{border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin:8px 0}.verdict-box{padding:20px;border-radius:12px;margin:16px 0}</style>
    </head><body>${content}</body></html>`;
    const blob = new Blob([fullHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `decision_programme_${new Date().toISOString().slice(0, 10)}.html`; a.click();
    URL.revokeObjectURL(url);
    toast.success('HTML téléchargé');
  };

  if (!isNewFormat) {
    return <LegacyScreeningViewer data={data} onRegenerate={onRegenerate} handleDownloadHtml={handleDownloadHtml} />;
  }

  const decision = data.decision || {};
  const matching = data.matching_criteres || {};
  const impact = data.impact_attendu || {};
  const dimensionnement = data.dimensionnement || {};
  const conditions = data.conditions || [];
  const risques = data.risques_programme || [];
  const metadata = data.metadata || {};

  const verdictColor = decision.verdict === 'ÉLIGIBLE'
    ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30'
    : decision.verdict === 'CONDITIONNEL'
    ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/30'
    : 'border-red-400 bg-red-50 dark:bg-red-950/30';

  const verdictIcon = decision.verdict === 'ÉLIGIBLE'
    ? <CheckCircle2 className="h-8 w-8 text-emerald-600" />
    : decision.verdict === 'CONDITIONNEL'
    ? <AlertCircle className="h-8 w-8 text-amber-600" />
    : <XCircle className="h-8 w-8 text-red-600" />;

  const convictionColor = (decision.niveau_conviction || 0) >= 70
    ? 'text-emerald-600' : (decision.niveau_conviction || 0) >= 40
    ? 'text-amber-600' : 'text-red-600';

  return (
    <div className="space-y-5" id="screening-viewer-content">
      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" className="gap-1.5" onClick={handleDownloadHtml}>
          <Download className="h-3.5 w-3.5" /> HTML (A4)
        </Button>
        {onRegenerate && (
          <Button variant="outline" size="sm" className="gap-1.5" onClick={onRegenerate}>
            <RefreshCw className="h-3.5 w-3.5" /> Regénérer
          </Button>
        )}
      </div>

      {/* ═══ ZONE 1 — La décision ═══ */}
      <Card className={`border-2 ${verdictColor}`}>
        <CardContent className="py-5">
          <div className="flex items-center gap-4">
            <div className="flex-shrink-0">{verdictIcon}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg font-display font-bold">{decision.verdict}</span>
                {metadata.programme && metadata.programme !== 'Programme générique' && (
                  <Badge variant="outline" className="text-[10px]">{metadata.programme}</Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{decision.justification}</p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className={`text-3xl font-display font-bold ${convictionColor}`}>{decision.niveau_conviction}%</p>
              <p className="text-[10px] text-muted-foreground">conviction</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ═══ ZONE 2 — Matching critères ═══ */}
      {matching.criteres?.length > 0 && (
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" />
                <h4 className="text-sm font-display font-semibold">Critères programme</h4>
              </div>
              <Badge className="bg-primary text-primary-foreground">{matching.score_matching}% compatible</Badge>
            </div>
            <div className="space-y-2">
              {matching.criteres.map((c: any, i: number) => {
                const statusIcon = c.statut === 'ok'
                  ? <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                  : c.statut === 'ko'
                  ? <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                  : <AlertCircle className="h-4 w-4 text-amber-500 flex-shrink-0" />;
                const rowBg = c.statut === 'ok'
                  ? 'bg-emerald-50/50 border-emerald-100 dark:bg-emerald-950/20 dark:border-emerald-900/30'
                  : c.statut === 'ko'
                  ? 'bg-red-50/50 border-red-100 dark:bg-red-950/20 dark:border-red-900/30'
                  : 'bg-amber-50/50 border-amber-100 dark:bg-amber-950/20 dark:border-amber-900/30';
                return (
                  <div key={i} className={`flex items-center gap-3 p-3 rounded-lg border ${rowBg}`}>
                    {statusIcon}
                    <span className="font-medium text-sm flex-1">{c.critere}</span>
                    <span className="text-xs text-muted-foreground text-right max-w-[50%]">{c.detail}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ═══ ZONE 3 — Impact attendu ═══ */}
      {(impact.emplois_directs || impact.odd_alignes?.length > 0) && (
        <Card>
          <CardContent className="py-4 space-y-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <h4 className="text-sm font-display font-semibold">Impact attendu</h4>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {[
                { value: impact.emplois_directs, label: 'Emplois directs' },
                { value: impact.emplois_indirects, label: 'Emplois indirects' },
                { value: impact.beneficiaires, label: 'Bénéficiaires' },
              ].map((item, i) => (
                <div key={i} className="p-3 rounded-lg bg-card border text-center">
                  <p className="text-sm font-semibold leading-snug">{item.value || '—'}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">{item.label}</p>
                </div>
              ))}
            </div>

            {impact.odd_alignes?.length > 0 && (
              <div className="space-y-1.5">
                {impact.odd_alignes.map((odd: any, i: number) => (
                  <div key={i} className="flex gap-3 p-2.5 rounded-lg border bg-card text-sm">
                    <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200 border-0 text-[11px] font-medium whitespace-nowrap flex-shrink-0">
                      {odd.odd}
                    </Badge>
                    <span className="text-muted-foreground text-xs leading-relaxed">{odd.contribution}</span>
                  </div>
                ))}
              </div>
            )}

            {impact.indicateurs_suivi?.length > 0 && (
              <div>
                <h5 className="text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wide">Indicateurs de suivi</h5>
                <div className="space-y-1.5">
                  {impact.indicateurs_suivi.map((ind: any, i: number) => (
                    <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg border bg-card text-sm">
                      <span className="flex-1 font-medium text-xs">{ind.indicateur}</span>
                      <span className="text-xs text-muted-foreground">{ind.baseline}</span>
                      <span className="text-muted-foreground">→</span>
                      <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">{ind.cible}</span>
                      <Badge variant="outline" className="text-[9px] ml-1">{ind.horizon}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ═══ ZONE 4 — Dimensionnement ═══ */}
      {dimensionnement.montant_recommande && (
        <Card>
          <CardContent className="py-4 space-y-4">
            <div className="flex items-center gap-2">
              <Banknote className="h-4 w-4 text-primary" />
              <h4 className="text-sm font-display font-semibold">Dimensionnement du financement</h4>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Montant recommandé', value: dimensionnement.montant_recommande },
                { label: 'Type', value: dimensionnement.type_financement },
                { label: 'Durée', value: dimensionnement.duree },
              ].map((item, i) => (
                <div key={i} className="p-3 rounded-lg border bg-primary/5 dark:bg-primary/10">
                  <p className="text-[10px] text-muted-foreground mb-1">{item.label}</p>
                  <p className="text-sm font-bold">{item.value}</p>
                </div>
              ))}
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">{dimensionnement.justification_montant}</p>

            {dimensionnement.utilisation_fonds?.length > 0 && (
              <div>
                <h5 className="text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wide">Utilisation des fonds</h5>
                <div className="space-y-1">
                  {dimensionnement.utilisation_fonds.map((u: string, i: number) => (
                    <p key={i} className="text-xs text-foreground flex items-start gap-2">
                      <span className="text-primary mt-0.5">•</span> {u}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {dimensionnement.jalons?.length > 0 && (
              <div>
                <h5 className="text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wide">Jalons</h5>
                <div className="space-y-1.5">
                  {dimensionnement.jalons.map((j: any, i: number) => (
                    <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg border bg-card text-xs">
                      <Badge variant="outline" className="text-[9px] flex-shrink-0">Mois {j.mois}</Badge>
                      <span className="flex-1 font-medium">{j.jalon}</span>
                      <span className="text-muted-foreground">{j.indicateur}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ═══ ZONE 5 — Conditions ═══ */}
      {conditions.length > 0 && (
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-2 mb-4">
              <Shield className="h-4 w-4 text-primary" />
              <h4 className="text-sm font-display font-semibold">Conditions</h4>
            </div>
            {['avant_financement', 'pendant', 'a_la_fin'].map(moment => {
              const items = conditions.filter((c: any) => c.moment === moment);
              if (!items.length) return null;
              const label = moment === 'avant_financement' ? 'Avant le financement' : moment === 'pendant' ? 'Pendant le programme' : 'En fin de programme';
              return (
                <div key={moment} className="mb-4 last:mb-0">
                  <p className="text-xs font-semibold text-primary uppercase tracking-wide mb-2">{label}</p>
                  <div className="space-y-1.5">
                    {items.map((c: any, i: number) => {
                      const badgeColor = c.responsable === 'entrepreneur'
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                        : c.responsable === 'coach'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200'
                        : 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
                      return (
                        <div key={i} className="flex items-start gap-3 p-3 rounded-lg border bg-card">
                          <Badge className={`${badgeColor} border-0 text-[10px] flex-shrink-0 mt-0.5`}>{c.responsable}</Badge>
                          <div className="min-w-0">
                            <p className="text-sm font-medium">{c.condition}</p>
                            {c.detail && <p className="text-xs text-muted-foreground mt-0.5">{c.detail}</p>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* ═══ ZONE 6 — Risques programme ═══ */}
      {risques.length > 0 && (
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="h-4 w-4 text-primary" />
              <h4 className="text-sm font-display font-semibold">Risques pour le programme</h4>
            </div>
            <div className="space-y-2">
              {risques.map((r: any, i: number) => {
                const probColor = r.probabilite === 'élevée'
                  ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                  : r.probabilite === 'moyenne'
                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200'
                  : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
                return (
                  <div key={i} className="p-3 rounded-lg border bg-card">
                    <div className="flex items-start gap-3">
                      <Badge className={`${probColor} border-0 text-[10px] flex-shrink-0 mt-0.5`}>{r.probabilite}</Badge>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{r.risque}</p>
                        <p className="text-xs text-muted-foreground mt-1">{r.impact}</p>
                        <p className="text-xs text-primary mt-1 font-medium">→ {r.mitigation}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ===== LEGACY VIEWER (ancien format) =====
function LegacyScreeningViewer({ data, onRegenerate, handleDownloadHtml }: {
  data: Record<string, any>;
  onRegenerate?: () => void;
  handleDownloadHtml: () => void;
}) {
  const score = data.screening_score ?? 0;
  const verdict = data.verdict || 'INSUFFISANT';
  const summary = data.verdict_summary || '';
  const resumeExecutif = data.resume_executif || null;

  const verdictConfig: Record<string, { color: string; bg: string; border: string }> = {
    ELIGIBLE: { color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
    CONDITIONNEL: { color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
    NON_ELIGIBLE: { color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200' },
    INSUFFISANT: { color: 'text-muted-foreground', bg: 'bg-muted', border: 'border-border' },
  };
  const vc = verdictConfig[verdict] || verdictConfig.INSUFFISANT;
  const scoreColor = score >= 70 ? 'text-emerald-600' : score >= 40 ? 'text-amber-600' : 'text-red-600';

  return (
    <div className="space-y-6" id="screening-viewer-content">
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" className="gap-1.5" onClick={handleDownloadHtml}>
          <Download className="h-3.5 w-3.5" /> HTML (A4)
        </Button>
        {onRegenerate && (
          <Button variant="outline" size="sm" className="gap-1.5" onClick={onRegenerate}>
            <RefreshCw className="h-3.5 w-3.5" /> Regénérer
          </Button>
        )}
      </div>

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
                    <p key={i} className="text-xs text-emerald-600 flex items-start gap-1.5">✓ {p}</p>
                  ))}
                </div>
              )}
              {resumeExecutif.points_faibles?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-red-700 mb-1">Faiblesses</p>
                  {resumeExecutif.points_faibles.map((p: string, i: number) => (
                    <p key={i} className="text-xs text-red-600 flex items-start gap-1.5">✗ {p}</p>
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

      {data.programme_match && (
        <Card className="p-5">
          <h3 className="font-display font-semibold text-base mb-3">Matching programme : {data.programme_match.programme_name}</h3>
          <Badge className="mb-3">{data.programme_match.match_score}% compatible</Badge>
          <div className="space-y-1.5">
            {data.programme_match.criteres_ok?.map((c: any, i: number) => (
              <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-emerald-50 border border-emerald-100 text-xs">
                <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
                <span className="font-medium flex-1">{c.critere}</span>
                <span className="text-muted-foreground">{c.detail}</span>
              </div>
            ))}
            {data.programme_match.criteres_ko?.map((c: any, i: number) => (
              <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-red-50 border border-red-100 text-xs">
                <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
                <span className="font-medium flex-1">{c.critere}</span>
                <span className="text-muted-foreground">{c.detail}</span>
              </div>
            ))}
            {data.programme_match.criteres_partiels?.map((c: any, i: number) => (
              <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-amber-50 border border-amber-100 text-xs">
                <span className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0" />
                <span className="font-medium flex-1">{c.critere}</span>
                <span className="text-muted-foreground">{c.detail}</span>
              </div>
            ))}
          </div>
          {data.programme_match.recommandation && (
            <p className="text-xs text-muted-foreground mt-3 italic">{data.programme_match.recommandation}</p>
          )}
        </Card>
      )}
    </div>
  );
}
