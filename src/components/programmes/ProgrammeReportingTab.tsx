import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Loader2, FileText, Download, BarChart3, ClipboardList, Lock, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Props {
  programmeId: string;
  programmeName: string;
  programmeStatus?: string;
}

export default function ProgrammeReportingTab({ programmeId, programmeName, programmeStatus }: Props) {
  const [generatingReport, setGeneratingReport] = useState<string | null>(null);
  const [report, setReport] = useState<any>(null);
  const [exporting, setExporting] = useState(false);
  const [showClotureConfirm, setShowClotureConfirm] = useState(false);
  const [closing, setClosing] = useState(false);

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
      window.location.reload();
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la clôture');
    }
    setClosing(false);
  };

  return (
    <div className="space-y-6">
      {/* Rapports */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card><CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <BarChart3 className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold">Rapport de progression</h3>
              <p className="text-xs text-muted-foreground">Bilan intermédiaire avec KPIs et recommandations</p>
            </div>
          </div>
          <Button onClick={() => handleGenerateReport('progress')} disabled={!!generatingReport} className="w-full gap-2">
            {generatingReport === 'progress' ? <Loader2 className="h-4 w-4 animate-spin" /> : <BarChart3 className="h-4 w-4" />}
            {generatingReport === 'progress' ? 'Génération... (30-60s)' : 'Générer'}
          </Button>
        </CardContent></Card>

        <Card><CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <ClipboardList className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <h3 className="font-semibold">Rapport final</h3>
              <p className="text-xs text-muted-foreground">Bilan complet pour le bailleur avec impact et success stories</p>
            </div>
          </div>
          <Button variant="outline" onClick={() => handleGenerateReport('final')} disabled={!!generatingReport} className="w-full gap-2">
            {generatingReport === 'final' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardList className="h-4 w-4" />}
            {generatingReport === 'final' ? 'Génération... (30-60s)' : 'Générer'}
          </Button>
        </CardContent></Card>
      </div>

      {/* Rapport généré */}
      {report && (
        <Card><CardContent className="p-6 space-y-4">
          <h3 className="font-semibold text-lg">{report.titre || 'Rapport'}</h3>

          {report.resume_executif && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-medium text-blue-900 mb-1">Résumé exécutif</h4>
              <p className="text-sm text-blue-800">{report.resume_executif}</p>
            </div>
          )}

          {report.stats_cohorte && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Object.entries(report.stats_cohorte).map(([key, val]: [string, any]) => (
                <div key={key} className="text-center p-3 rounded-lg bg-muted/50">
                  <p className="text-lg font-bold">{typeof val === 'number' ? val : val}</p>
                  <p className="text-[10px] text-muted-foreground">{key.replace(/_/g, ' ')}</p>
                </div>
              ))}
            </div>
          )}

          {report.entreprises_performantes?.length > 0 && (
            <div>
              <h4 className="font-medium mb-2">Success stories</h4>
              {report.entreprises_performantes.map((e: any, i: number) => (
                <div key={i} className="flex items-center gap-2 p-2 rounded bg-emerald-50 border border-emerald-200 mb-1 text-sm">
                  <Badge variant="outline" className="text-emerald-700 border-emerald-300">{e.nom || e.name || `#${i+1}`}</Badge>
                  <span className="text-emerald-800">{e.raison || e.detail || ''}</span>
                </div>
              ))}
            </div>
          )}

          {report.recommandations?.length > 0 && (
            <div>
              <h4 className="font-medium mb-2">Recommandations</h4>
              <ul className="space-y-1 text-sm">
                {report.recommandations.map((r: any, i: number) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-primary font-bold">{i+1}.</span>
                    <span>{typeof r === 'string' ? r : r.texte || r.recommendation || JSON.stringify(r)}</span>
                  </li>
                ))}
              </ul>
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
            <h3 className="font-semibold">Export des données</h3>
            <p className="text-xs text-muted-foreground">Candidatures, scores, entreprises, notes de coaching</p>
          </div>
        </div>
        <Button variant="outline" onClick={handleExport} disabled={exporting} className="w-full gap-2">
          {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Télécharger les données
        </Button>
      </CardContent></Card>

      {/* Clôture */}
      {programmeStatus === 'in_progress' && (
        <Card className="border-red-200"><CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                <Lock className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-semibold text-red-900">Clôturer le programme</h3>
                <p className="text-xs text-muted-foreground">Marque le programme comme terminé. Action irréversible.</p>
              </div>
            </div>
            <Button variant="destructive" onClick={() => setShowClotureConfirm(true)}>
              Clôturer
            </Button>
          </div>
        </CardContent></Card>
      )}

      {/* Confirmation clôture */}
      <Dialog open={showClotureConfirm} onOpenChange={setShowClotureConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-red-500" /> Clôturer le programme</DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir clôturer "{programmeName}" ? Cette action est irréversible.
              Les entreprises ne pourront plus générer de livrables dans le cadre de ce programme.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowClotureConfirm(false)}>Annuler</Button>
            <Button variant="destructive" onClick={handleCloture} disabled={closing}>
              {closing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Confirmer la clôture
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
