import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, RefreshCw } from 'lucide-react';
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
    <style>@page{size:A4;margin:16mm}body{font-family:"Segoe UI",sans-serif;font-size:10pt;color:#1E293B;max-width:190mm;margin:0 auto;padding:20px}table{width:100%;border-collapse:collapse}td,th{border:1px solid #ddd;padding:6px;text-align:left;font-size:9pt}</style>
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

  return (
    <div className="space-y-4" id="screening-viewer-content">
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
      <Card className={`border-2 ${
        decision.verdict === 'ÉLIGIBLE' ? 'border-emerald-300 bg-emerald-50/30' :
        decision.verdict === 'CONDITIONNEL' ? 'border-amber-300 bg-amber-50/30' :
        'border-red-300 bg-red-50/30'
      }`}>
        <CardContent className="py-5">
          <div className="flex items-center gap-4">
            <div className={`w-16 h-16 rounded-xl flex items-center justify-center text-2xl font-bold text-white ${
              decision.verdict === 'ÉLIGIBLE' ? 'bg-emerald-500' :
              decision.verdict === 'CONDITIONNEL' ? 'bg-amber-500' : 'bg-red-500'
            }`}>
              {decision.verdict === 'ÉLIGIBLE' ? '✓' : decision.verdict === 'CONDITIONNEL' ? '?' : '✗'}
            </div>
            <div className="flex-1">
              <p className="text-lg font-semibold">{decision.verdict}</p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{decision.justification}</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold">{decision.niveau_conviction}%</p>
              <p className="text-[10px] text-muted-foreground">conviction</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ═══ ZONE 2 — Matching critères ═══ */}
      {matching.criteres?.length > 0 && (
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold">Critères programme</h4>
              <Badge>{matching.score_matching}% compatible</Badge>
            </div>
            <div className="space-y-1.5">
              {matching.criteres.map((c: any, i: number) => (
                <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-secondary border text-xs">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    c.statut === 'ok' ? 'bg-emerald-500' : c.statut === 'ko' ? 'bg-red-500' : 'bg-amber-500'
                  }`} />
                  <span className="font-medium flex-1">{c.critere}</span>
                  <span className="text-muted-foreground">{c.detail}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ═══ ZONE 3 — Impact attendu ═══ */}
      {(impact.emplois_directs || impact.odd_alignes?.length > 0) && (
        <Card>
          <CardContent className="py-4 space-y-4">
            <h4 className="text-sm font-semibold">Impact attendu</h4>

            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-lg bg-secondary text-center">
                <p className="text-base font-semibold">{impact.emplois_directs || '—'}</p>
                <p className="text-[10px] text-muted-foreground">Emplois directs</p>
              </div>
              <div className="p-3 rounded-lg bg-secondary text-center">
                <p className="text-base font-semibold">{impact.emplois_indirects || '—'}</p>
                <p className="text-[10px] text-muted-foreground">Emplois indirects</p>
              </div>
              <div className="p-3 rounded-lg bg-secondary text-center">
                <p className="text-base font-semibold">{impact.beneficiaires || '—'}</p>
                <p className="text-[10px] text-muted-foreground">Bénéficiaires</p>
              </div>
            </div>

            {impact.odd_alignes?.length > 0 && (
              <div className="space-y-1.5">
                {impact.odd_alignes.map((odd: any, i: number) => (
                  <div key={i} className="flex gap-2 p-2 rounded-lg bg-secondary border text-xs">
                    <span className="font-medium text-emerald-700">{odd.odd}</span>
                    <span className="text-muted-foreground">{odd.contribution}</span>
                  </div>
                ))}
              </div>
            )}

            {impact.indicateurs_suivi?.length > 0 && (
              <div>
                <h5 className="text-xs font-semibold mb-2">Indicateurs de suivi</h5>
                {impact.indicateurs_suivi.map((ind: any, i: number) => (
                  <div key={i} className="flex items-center gap-3 p-2 rounded-lg border text-xs mb-1">
                    <span className="flex-1 font-medium">{ind.indicateur}</span>
                    <span className="text-muted-foreground">{ind.baseline}</span>
                    <span className="text-muted-foreground">→</span>
                    <span className="font-medium text-emerald-700">{ind.cible}</span>
                    <Badge variant="outline" className="text-[9px]">{ind.horizon}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ═══ ZONE 4 — Dimensionnement ═══ */}
      {dimensionnement.montant_recommande && (
        <Card>
          <CardContent className="py-4 space-y-3">
            <h4 className="text-sm font-semibold">Dimensionnement du financement</h4>

            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-lg bg-secondary">
                <p className="text-[10px] text-muted-foreground">Montant recommandé</p>
                <p className="text-base font-semibold">{dimensionnement.montant_recommande}</p>
              </div>
              <div className="p-3 rounded-lg bg-secondary">
                <p className="text-[10px] text-muted-foreground">Type</p>
                <p className="text-base font-semibold">{dimensionnement.type_financement}</p>
              </div>
              <div className="p-3 rounded-lg bg-secondary">
                <p className="text-[10px] text-muted-foreground">Durée</p>
                <p className="text-base font-semibold">{dimensionnement.duree}</p>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">{dimensionnement.justification_montant}</p>

            {dimensionnement.utilisation_fonds?.length > 0 && (
              <div>
                <h5 className="text-xs font-semibold mb-2">Utilisation des fonds</h5>
                {dimensionnement.utilisation_fonds.map((u: string, i: number) => (
                  <p key={i} className="text-xs text-muted-foreground mb-1">• {u}</p>
                ))}
              </div>
            )}

            {dimensionnement.jalons?.length > 0 && (
              <div>
                <h5 className="text-xs font-semibold mb-2">Jalons</h5>
                {dimensionnement.jalons.map((j: any, i: number) => (
                  <div key={i} className="flex items-center gap-3 p-2 rounded-lg border text-xs mb-1">
                    <Badge variant="outline" className="text-[9px]">Mois {j.mois}</Badge>
                    <span className="flex-1">{j.jalon}</span>
                    <span className="text-muted-foreground">{j.indicateur}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ═══ ZONE 5 — Conditions ═══ */}
      {conditions.length > 0 && (
        <Card>
          <CardContent className="py-4">
            <h4 className="text-sm font-semibold mb-3">Conditions</h4>
            {['avant_financement', 'pendant', 'a_la_fin'].map(moment => {
              const items = conditions.filter((c: any) => c.moment === moment);
              if (!items.length) return null;
              const label = moment === 'avant_financement' ? 'Avant le financement' : moment === 'pendant' ? 'Pendant le programme' : 'En fin de programme';
              return (
                <div key={moment} className="mb-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">{label}</p>
                  {items.map((c: any, i: number) => (
                    <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-secondary border mb-1 text-xs">
                      <Badge variant="outline" className="text-[9px] flex-shrink-0 mt-0.5">{c.responsable}</Badge>
                      <div>
                        <p className="font-medium">{c.condition}</p>
                        {c.detail && <p className="text-muted-foreground mt-0.5">{c.detail}</p>}
                      </div>
                    </div>
                  ))}
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
            <h4 className="text-sm font-semibold mb-3">Risques pour le programme</h4>
            {risques.map((r: any, i: number) => (
              <div key={i} className="flex items-start gap-2 p-2.5 rounded-lg bg-secondary border mb-1.5">
                <Badge variant="outline" className={`text-[9px] flex-shrink-0 mt-0.5 ${
                  r.probabilite === 'élevée' ? 'bg-red-50 text-red-700 border-red-200' :
                  r.probabilite === 'moyenne' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                  'bg-blue-50 text-blue-700 border-blue-200'
                }`}>{r.probabilite}</Badge>
                <div className="flex-1 text-xs">
                  <p className="font-medium">{r.risque}</p>
                  <p className="text-muted-foreground mt-1">{r.impact}</p>
                  <p className="text-blue-700 mt-1">→ {r.mitigation}</p>
                </div>
              </div>
            ))}
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

      {/* Programme match from old format */}
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
