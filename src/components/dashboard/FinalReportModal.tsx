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

const todayIso = () => new Date().toISOString().slice(0, 10);

export default function FinalReportModal({ enterpriseId, enterpriseName, onClose }: FinalReportModalProps) {
  const { t } = useTranslation();
  const { session: authSession } = useAuth();

  // Métadonnées de la session de coaching (en-tête du rapport)
  const [sessionNumber, setSessionNumber] = useState('');
  const [sessionDate, setSessionDate] = useState(todayIso());
  const [coachNames, setCoachNames] = useState('');
  const [nextSessionDate, setNextSessionDate] = useState('');
  const [nextSessionObjectives, setNextSessionObjectives] = useState('');

  // Note coach interne + recommandation globale
  const [comment, setComment] = useState('');
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
            coach_comment: comment,
            coach_recommendation: recommendation,
            session_number: sessionNumber || null,
            session_date: sessionDate || null,
            coach_names: coachNames || null,
            next_session_date: nextSessionDate || null,
            next_session_objectives: nextSessionObjectives || null,
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

  const baseFilename = `Rapport_Coaching_${enterpriseName.replace(/[^a-zA-Z0-9]/g, '_')}`;

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
    // HTML servi avec application/msword + extension .doc → Word l'ouvre nativement,
    // l'utilisateur peut ensuite « Enregistrer sous » en .docx s'il le souhaite.
    // Préfixe MIME pour forcer l'interprétation Word.
    const wordHtml = `<html xmlns:o="urn:schemas-microsoft-com:office:office"
xmlns:w="urn:schemas-microsoft-com:office:word"
xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>${baseFilename}</title></head>${reportHtml.replace(/<!DOCTYPE[^>]*>/i, '').replace(/<\/?html[^>]*>/gi, '')}</html>`;
    downloadFile(wordHtml, 'application/msword', 'doc');
    toast.success('Word téléchargé — ouvre avec Microsoft Word');
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        {!reportHtml ? (
          <>
            <DialogHeader>
              <DialogTitle>Rapport de coaching — {enterpriseName}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-medium">Numéro de session</Label>
                  <Input
                    type="number"
                    min="1"
                    value={sessionNumber}
                    onChange={(e) => setSessionNumber(e.target.value)}
                    placeholder="4"
                  />
                </div>
                <div>
                  <Label className="text-xs font-medium">Date de la session</Label>
                  <Input
                    type="date"
                    value={sessionDate}
                    onChange={(e) => setSessionDate(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs font-medium">Coachs présents</Label>
                <Input
                  value={coachNames}
                  onChange={(e) => setCoachNames(e.target.value)}
                  placeholder="K. Diabaté / P. N'Guessan"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-medium">Date prochaine session</Label>
                  <Input
                    type="date"
                    value={nextSessionDate}
                    onChange={(e) => setNextSessionDate(e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-xs font-medium">Objectifs prochaine session</Label>
                  <Input
                    value={nextSessionObjectives}
                    onChange={(e) => setNextSessionObjectives(e.target.value)}
                    placeholder="Valider chiffrage fiscal, BP v2..."
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs font-medium">
                  Note coach (visible par le chef de programme)
                </Label>
                <Textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={4}
                  placeholder="Entrepreneure très forte sur l'opérationnel mais réticente au volet fiscal..."
                />
              </div>

              <div>
                <Label className="text-xs font-medium">Recommandation globale</Label>
                <Textarea
                  value={recommendation}
                  onChange={(e) => setRecommendation(e.target.value)}
                  rows={2}
                  placeholder="ACCOMPAGNER — financer après régularisation fiscale..."
                />
              </div>

              <Button onClick={handleGenerate} disabled={generating} className="w-full">
                {generating ? (
                  <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Génération en cours (30-60s)…</>
                ) : (
                  <><Sparkles className="h-4 w-4 mr-1" /> Générer le rapport</>
                )}
              </Button>
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Rapport de coaching</DialogTitle>
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
