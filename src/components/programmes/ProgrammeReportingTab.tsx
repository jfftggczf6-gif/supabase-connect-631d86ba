import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Loader2, FileText, Download, BarChart3, ClipboardList, Lock, AlertTriangle, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Props {
  programmeId: string;
  programmeName: string;
  programmeStatus?: string;
  hideClotureButton?: boolean;
}

export default function ProgrammeReportingTab({ programmeId, programmeName, programmeStatus, hideClotureButton }: Props) {
  const { t } = useTranslation();
  const [generatingReport, setGeneratingReport] = useState<string | null>(null);
  const [report, setReport] = useState<any>(null);
  const [lastReportAt, setLastReportAt] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [showClotureConfirm, setShowClotureConfirm] = useState(false);
  const [closing, setClosing] = useState(false);

  // Load last saved report on mount
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('programmes').select('last_report, last_report_at').eq('id', programmeId).single();
      if (data?.last_report && typeof data.last_report === 'object') {
        setReport(data.last_report);
        setLastReportAt(data.last_report_at);
      }
    })();
  }, [programmeId]);

  const handleGenerateReport = async (reportType: 'progress' | 'final') => {
    setGeneratingReport(reportType);
    setReport(null);
    try {
      const { data, error } = await supabase.functions.invoke('generate-programme-report', {
        body: { programme_id: programmeId, report_type: reportType }
      });
      if (error) throw error;
      if (data?.report) {
        setReport(data.report);
        setLastReportAt(new Date().toISOString());
        toast.success('Rapport généré');
      } else if (data?.download_url) {
        window.open(data.download_url, '_blank');
      }
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la génération');
    }
    setGeneratingReport(null);
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const { data, error } = await supabase.functions.invoke('export-programme-data', {
        body: { programme_id: programmeId, format: 'excel' }
      });
      if (error) throw error;

      if (data?.download_url) {
        window.open(data.download_url, '_blank');
      } else if (data?.export) {
        // Fallback: download JSON export as file
        const blob = new Blob([JSON.stringify(data.export, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${programmeName.replace(/\s+/g, '_')}_export.json`;
        a.click();
        URL.revokeObjectURL(url);
      } else if (typeof data === 'string') {
        // TSV format
        const blob = new Blob([data], { type: 'text/tab-separated-values' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${programmeName.replace(/\s+/g, '_')}_export.tsv`;
        a.click();
        URL.revokeObjectURL(url);
      }
      toast.success('Export téléchargé');
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de l'export");
    }
    setExporting(false);
  };

  const handleCloture = async () => {
    setClosing(true);
    try {
      const { error } = await supabase.functions.invoke('manage-programme', {
        body: { action: 'complete', id: programmeId }
      });
      if (error) throw error;
      toast.success('Programme clôturé');
      setShowClotureConfirm(false);
      // Soft reload — the parent will re-fetch via its own state
      window.dispatchEvent(new CustomEvent('programme-updated'));
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la clôture');
    }
    setClosing(false);
  };

  return (
    <div className="space-y-6">
      {/* Rapport */}
      {(() => {
        const isFinal = programmeStatus === 'completed';
        const reportType = isFinal ? 'final' : 'progress';
        const label = isFinal ? t('reporting.final_report') : t('reporting.progress_report');
        const desc = isFinal
          ? t('reporting.final_desc')
          : t('reporting.progress_desc_long');
        const Icon = isFinal ? ClipboardList : BarChart3;
        const color = isFinal ? 'purple' : 'blue';
        return (
          <Card><CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className={`h-10 w-10 rounded-lg bg-${color}-500/10 flex items-center justify-center`}>
                <Icon className={`h-5 w-5 text-${color}-600`} />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">{label}</h3>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>
            </div>
            <Button onClick={() => handleGenerateReport(reportType)} disabled={!!generatingReport} className="w-full gap-2">
              {generatingReport ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
              {generatingReport ? t('reporting.generating_report') : t('reporting.generate_report_type', { type: label.toLowerCase() })}
            </Button>
          </CardContent></Card>
        );
      })()}

      {/* Rapport généré */}
      {report && (
        <Card><CardContent className="p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-lg">{report.titre || t('reporting.report')}</h3>
            {lastReportAt && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {new Date(lastReportAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>

          {/* Résumé exécutif */}
          {report.resume_executif && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-medium text-blue-900 mb-1">{t('reporting.executive_summary')}</h4>
              <p className="text-sm text-blue-800 whitespace-pre-line">{report.resume_executif}</p>
            </div>
          )}

          {/* Chiffres clés (rapport progression) */}
          {report.chiffres_cles && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Object.entries(report.chiffres_cles).map(([key, val]: [string, any]) => (
                <div key={key} className="text-center p-3 rounded-lg bg-muted/50">
                  <p className="text-xl font-bold">{val}</p>
                  <p className="text-[10px] text-muted-foreground">{key.replace(/_/g, ' ')}</p>
                </div>
              ))}
            </div>
          )}

          {/* Stats cohorte (rapport final) */}
          {report.stats_cohorte && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Object.entries(report.stats_cohorte).map(([key, val]: [string, any]) => (
                <div key={key} className="text-center p-3 rounded-lg bg-muted/50">
                  <p className="text-lg font-bold">{val}</p>
                  <p className="text-[10px] text-muted-foreground">{key.replace(/_/g, ' ')}</p>
                </div>
              ))}
            </div>
          )}

          {/* Analyse cohorte */}
          {report.analyse_cohorte && (
            <div className="space-y-2">
              <h4 className="font-medium">{t('reporting.cohort_analysis')}</h4>
              {report.analyse_cohorte.progression && <p className="text-sm">{report.analyse_cohorte.progression}</p>}
              {report.analyse_cohorte.tendance && <Badge variant="outline">{report.analyse_cohorte.tendance}</Badge>}
              <div className="grid grid-cols-2 gap-3 mt-2">
                {report.analyse_cohorte.forces?.length > 0 && (
                  <div className="p-3 rounded bg-emerald-50 border border-emerald-200">
                    <p className="text-xs font-medium text-emerald-700 mb-1">{t('viewers.forces')}</p>
                    <ul className="text-xs space-y-0.5">{report.analyse_cohorte.forces.map((f: string, i: number) => <li key={i}>+ {f}</li>)}</ul>
                  </div>
                )}
                {report.analyse_cohorte.faiblesses?.length > 0 && (
                  <div className="p-3 rounded bg-red-50 border border-red-200">
                    <p className="text-xs font-medium text-red-700 mb-1">{t('viewers.watch_points')}</p>
                    <ul className="text-xs space-y-0.5">{report.analyse_cohorte.faiblesses.map((f: string, i: number) => <li key={i}>- {f}</li>)}</ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Performance coachs */}
          {report.performance_coachs?.length > 0 && (
            <div>
              <h4 className="font-medium mb-2">{t('dashboard_programme.by_coach')}</h4>
              <div className="space-y-2">
                {report.performance_coachs.map((c: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded bg-muted/30 text-sm">
                    <div>
                      <span className="font-medium">{c.coach}</span>
                      <span className="text-muted-foreground ml-2">({c.entreprises} entr.)</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <span>Score: <strong>{c.score_moyen}</strong></span>
                      <span>Complétion: <strong>{c.completion}</strong></span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Entreprises à risque */}
          {report.entreprises_a_risque?.length > 0 && (
            <div>
              <h4 className="font-medium mb-2 text-red-700">{t('reporting.at_risk')}</h4>
              {report.entreprises_a_risque.map((e: any, i: number) => (
                <div key={i} className="p-3 rounded bg-red-50 border border-red-200 mb-2 text-sm">
                  <p className="font-medium">{e.nom}</p>
                  <p className="text-red-700 text-xs">{e.risque}</p>
                  <p className="text-blue-600 text-xs mt-1">Action: {e.action_recommandee}</p>
                </div>
              ))}
            </div>
          )}

          {/* Entreprises performantes / Success stories */}
          {(report.entreprises_performantes || report.entreprises_succes)?.length > 0 && (
            <div>
              <h4 className="font-medium mb-2">{t('reporting.success_stories')}</h4>
              {(report.entreprises_performantes || report.entreprises_succes).map((e: any, i: number) => (
                <div key={i} className="flex items-center gap-2 p-2 rounded bg-emerald-50 border border-emerald-200 mb-1 text-sm">
                  <Badge variant="outline" className="text-emerald-700 border-emerald-300">{e.nom || e.name || `#${i+1}`}</Badge>
                  <span className="text-emerald-800">{e.point_fort || e.highlights || e.raison || ''}</span>
                  {e.score && <Badge variant="outline" className="text-xs">{e.score}</Badge>}
                </div>
              ))}
            </div>
          )}

          {/* Impact (rapport final) */}
          {report.impact && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Object.entries(report.impact).map(([key, val]: [string, any]) => (
                <div key={key} className="text-center p-3 rounded-lg bg-primary/5 border border-primary/10">
                  <p className="text-lg font-bold">{Array.isArray(val) ? val.join(', ') : val}</p>
                  <p className="text-[10px] text-muted-foreground">{key.replace(/_/g, ' ')}</p>
                </div>
              ))}
            </div>
          )}

          {/* Recommandations */}
          {(report.recommandations || report.recommandations_programme)?.length > 0 && (
            <div>
              <h4 className="font-medium mb-2">{t('reporting.recommendations')}</h4>
              <ul className="space-y-2 text-sm">
                {(report.recommandations || report.recommandations_programme).map((r: any, i: number) => (
                  <li key={i} className="p-3 rounded bg-emerald-50/50 border border-emerald-100">
                    <div className="flex items-start gap-2">
                      <span className="text-primary font-bold">{r.priorite || i + 1}.</span>
                      <div>
                        <p className="font-medium">{typeof r === 'string' ? r : r.action || r.texte || r.recommendation || JSON.stringify(r)}</p>
                        {r.impact_attendu && <p className="text-xs text-muted-foreground mt-0.5">{r.impact_attendu}</p>}
                        {r.responsable && <Badge variant="outline" className="text-[10px] mt-1">{r.responsable}</Badge>}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Prochaines étapes */}
          {report.prochaines_etapes?.length > 0 && (
            <div>
              <h4 className="font-medium mb-2">{t('reporting.next_steps')}</h4>
              <ol className="space-y-1 text-sm list-decimal pl-4">
                {report.prochaines_etapes.map((e: string, i: number) => <li key={i}>{e}</li>)}
              </ol>
            </div>
          )}

          {/* Leçons apprises (rapport final) */}
          {report.lecons_apprises && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <h4 className="font-medium text-amber-900 mb-1">{t('reporting.lessons_learned')}</h4>
              <p className="text-sm text-amber-800 whitespace-pre-line">{report.lecons_apprises}</p>
            </div>
          )}
        </CardContent></Card>
      )}

      {/* Export */}
      <Card><CardContent className="p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
            <Download className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <h3 className="font-semibold">{t('reporting.export_data')}</h3>
            <p className="text-xs text-muted-foreground">{t('reporting.export_desc')}</p>
          </div>
        </div>
        <Button variant="outline" onClick={handleExport} disabled={exporting} className="w-full gap-2">
          {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          {t('reporting.download_data')}
        </Button>
      </CardContent></Card>

      {/* Clôture */}
      {!hideClotureButton && programmeStatus === 'in_progress' && (
        <Card className="border-red-200"><CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                <Lock className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-semibold text-red-900">{t('programme.close_programme')}</h3>
                <p className="text-xs text-muted-foreground">{t('programme.close_desc')}</p>
              </div>
            </div>
            <Button variant="destructive" onClick={() => setShowClotureConfirm(true)}>
              {t('programme.close_button')}
            </Button>
          </div>
        </CardContent></Card>
      )}

      {/* Confirmation clôture */}
      <Dialog open={showClotureConfirm} onOpenChange={setShowClotureConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-red-500" /> {t('programme.close_programme')}</DialogTitle>
            <DialogDescription>
              {t('programme.close_confirm_desc', { name: programmeName })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowClotureConfirm(false)}>{t('common.cancel')}</Button>
            <Button variant="destructive" onClick={handleCloture} disabled={closing}>
              {closing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {t('programme.confirm_close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
