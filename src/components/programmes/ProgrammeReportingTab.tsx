import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, FileText, Download, BarChart3 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface Props {
  programmeId: string;
  programmeName: string;
}

export default function ProgrammeReportingTab({ programmeId, programmeName }: Props) {
  const [generatingReport, setGeneratingReport] = useState(false);
  const [exporting, setExporting] = useState(false);

  const handleGenerateReport = async () => {
    setGeneratingReport(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-programme-report', {
        body: { programme_id: programmeId }
      });
      if (error) throw error;
      toast({ title: '✅ Rapport généré', description: 'Le rapport est prêt.' });
      // If there's a download URL
      if (data?.download_url) {
        window.open(data.download_url, '_blank');
      }
    } catch (err: any) {
      toast({ title: 'Erreur', description: err.message || 'Erreur lors de la génération', variant: 'destructive' });
    }
    setGeneratingReport(false);
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const { data, error } = await supabase.functions.invoke('export-programme-data', {
        body: { programme_id: programmeId }
      });
      if (error) throw error;
      
      // Handle blob/file download
      if (data?.download_url) {
        const link = document.createElement('a');
        link.href = data.download_url;
        link.download = `${programmeName}_export.xlsx`;
        link.click();
      } else if (data instanceof Blob) {
        const url = URL.createObjectURL(data);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${programmeName}_export.xlsx`;
        link.click();
        URL.revokeObjectURL(url);
      }
      toast({ title: '✅ Export téléchargé' });
    } catch (err: any) {
      toast({ title: 'Erreur', description: err.message || "Erreur lors de l'export", variant: 'destructive' });
    }
    setExporting(false);
  };

  return (
    <div className="space-y-4">
      <div className="grid md:grid-cols-2 gap-4">
        {/* Generate report */}
        <Card><CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold">Rapport programme</h3>
              <p className="text-xs text-muted-foreground">Rapport de synthèse avec KPIs, analyses et recommandations</p>
            </div>
          </div>
          <Button onClick={handleGenerateReport} disabled={generatingReport} className="w-full gap-2">
            {generatingReport ? <Loader2 className="h-4 w-4 animate-spin" /> : <BarChart3 className="h-4 w-4" />}
            Générer le rapport
          </Button>
        </CardContent></Card>

        {/* Export Excel */}
        <Card><CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <Download className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <h3 className="font-semibold">Export Excel</h3>
              <p className="text-xs text-muted-foreground">Données complètes : candidatures, scores, entreprises</p>
            </div>
          </div>
          <Button variant="outline" onClick={handleExport} disabled={exporting} className="w-full gap-2">
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Exporter les données
          </Button>
        </CardContent></Card>
      </div>
    </div>
  );
}
