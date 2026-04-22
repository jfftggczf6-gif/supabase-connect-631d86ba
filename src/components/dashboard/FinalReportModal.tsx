import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, Sparkles, FileDown, FileText } from 'lucide-react';
import { getValidAccessToken } from '@/lib/getValidAccessToken';

interface FinalReportModalProps {
  enterpriseId: string;
  enterpriseName: string;
  onClose: () => void;
}

export default function FinalReportModal({ enterpriseId, enterpriseName, onClose }: FinalReportModalProps) {
  const { t } = useTranslation();
  const { session: authSession, profile } = useAuth();

  // Métadonnées de l'accompagnement
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [sessionsCount, setSessionsCount] = useState('');
  const [coachNames, setCoachNames] = useState(profile?.full_name || '');

  // Inputs coach
  const [verdict, setVerdict] = useState('');
  const [recommendation, setRecommendation] = useState('');

  const [reportHtml, setReportHtml] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const token = await getValidAccessToken(authSession);
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-coach-report`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            enterprise_id: enterpriseId,
            period_start: periodStart || null,
            period_end: periodEnd || null,
            sessions_count: sessionsCount ? Number(sessionsCount) : null,
            coach_names: coachNames || null,
            coach_verdict: verdict || null,
            coach_recommendation: recommendation || null,
          }),
        }
      );
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: 'Erreur' }));
        throw new Error(err.error || 'Erreur génération');
      }
      const result = await resp.json();
      setReportHtml(result.html);
    } catch (e: any) {
      toast.error(e.message || 'Erreur génération');
    } finally {
      setGenerating(false);
    }
  };

  const baseFilename = `Rapport_FinCoaching_${enterpriseName.replace(/[^a-zA-Z0-9]/g, '_')}`;

  const downloadFile = (content: string, mime: string, ext: string) => {
    const blob = new Blob([content], { type: mime });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${baseFilename}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  };

  const downloadAsHtml = () => {
    if (!reportHtml) return;
    downloadFile(reportHtml, 'text/html', 'html');
    toast.success('HTML téléchargé');
  };

  const downloadAsWord = () => {
    if (!reportHtml) return;
    // HTML + namespaces Office → Microsoft Word ouvre le .doc nativement.
    const headMatch = reportHtml.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
    const bodyMatch = reportHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    const headInner = headMatch ? headMatch[1] : `<title>${baseFilename}</title>`;
    const bodyInner = bodyMatch ? bodyMatch[1] : reportHtml;
    const wordHtml = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8">${headInner}</head><body>${bodyInner}</body></html>`;
    downloadFile(wordHtml, 'application/msword', 'doc');
    toast.success('Word téléchargé — ouvre avec Microsoft Word');
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        {!reportHtml ? (
          <>
            <DialogHeader>
              <DialogTitle>Rapport de fin de coaching — {enterpriseName}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs font-medium">Période — début</Label>
                  <Input
                    value={periodStart}
                    onChange={(e) => setPeriodStart(e.target.value)}
                    placeholder="Oct. 2025"
                  />
                </div>
                <div>
                  <Label className="text-xs font-medium">Période — fin</Label>
                  <Input
                    value={periodEnd}
                    onChange={(e) => setPeriodEnd(e.target.value)}
                    placeholder="Avr. 2026"
                  />
                </div>
                <div>
                  <Label className="text-xs font-medium">Nb sessions</Label>
                  <Input
                    type="number"
                    min="1"
                    value={sessionsCount}
                    onChange={(e) => setSessionsCount(e.target.value)}
                    placeholder="8"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs font-medium">Coachs</Label>
                <Input
                  value={coachNames}
                  onChange={(e) => setCoachNames(e.target.value)}
                  placeholder="K. Diabaté / P. N'Guessan"
                />
              </div>

              <div>
                <Label className="text-xs font-medium">
                  ⭐ Verdict global (sera intégré en section 2)
                </Label>
                <Textarea
                  value={verdict}
                  onChange={(e) => setVerdict(e.target.value)}
                  rows={4}
                  placeholder="Accompagnement réussi sur les fondamentaux mais pivot stratégique prématuré. Éligible à 30-80M FCFA."
                />
              </div>

              <div>
                <Label className="text-xs font-medium">Recommandation complémentaire (optionnel)</Label>
                <Textarea
                  value={recommendation}
                  onChange={(e) => setRecommendation(e.target.value)}
                  rows={2}
                  placeholder="Prioriser I&P Acceleration pour un ticket 60-80M FCFA..."
                />
              </div>

              <p className="text-xs text-muted-foreground">
                L'IA générera : évolution du score par dimension, diagnostic avant/après, accomplissements/chantiers, bilan qualitatif, recommandations 3 horizons, matching financement, annexes (livrables + historique sessions).
              </p>

              <Button onClick={handleGenerate} disabled={generating} className="w-full">
                {generating ? (
                  <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Génération en cours (30-90s)…</>
                ) : (
                  <><Sparkles className="h-4 w-4 mr-1" /> Générer le rapport de fin</>
                )}
              </Button>
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Rapport de fin de coaching</DialogTitle>
              <div className="flex gap-2 flex-wrap">
                <Button size="sm" onClick={downloadAsWord}>
                  <FileDown className="h-4 w-4 mr-1" /> Télécharger Word
                </Button>
                <Button size="sm" variant="outline" onClick={downloadAsHtml}>
                  <FileText className="h-4 w-4 mr-1" /> HTML
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setReportHtml(null)}>
                  Modifier
                </Button>
              </div>
            </DialogHeader>
            <iframe srcDoc={reportHtml} className="w-full h-[600px] border rounded-lg" />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
