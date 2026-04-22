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

interface SuiviReportModalProps {
  enterpriseId: string;
  enterpriseName: string;
  onClose: () => void;
}

export default function SuiviReportModal({ enterpriseId, enterpriseName, onClose }: SuiviReportModalProps) {
  const { t } = useTranslation();
  const { session: authSession, profile } = useAuth();

  const [coachNames, setCoachNames] = useState(profile?.full_name || '');
  const [nextSessionDate, setNextSessionDate] = useState('');
  const [noteCoach, setNoteCoach] = useState('');

  const [reportHtml, setReportHtml] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const token = await getValidAccessToken(authSession);
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-coaching-followup`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            enterprise_id: enterpriseId,
            coach_names: coachNames || null,
            next_session_date: nextSessionDate || null,
            note_coach: noteCoach || null,
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

  const baseFilename = `Rapport_Suivi_${enterpriseName.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().slice(0, 10)}`;

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
              <DialogTitle>Rapport de suivi — {enterpriseName}</DialogTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Snapshot de l'état actuel de l'entreprise. Généré par l'IA à partir des livrables, scores et notes de coaching récentes.
              </p>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label className="text-xs font-medium">Coachs</Label>
                <Input
                  value={coachNames}
                  onChange={(e) => setCoachNames(e.target.value)}
                  placeholder="K. Diabaté / P. N'Guessan"
                />
              </div>

              <div>
                <Label className="text-xs font-medium">Date prochaine session (optionnel)</Label>
                <Input
                  type="datetime-local"
                  value={nextSessionDate}
                  onChange={(e) => setNextSessionDate(e.target.value)}
                />
              </div>

              <div>
                <Label className="text-xs font-medium">
                  💬 Note coach (visibilité chef de programme — optionnel)
                </Label>
                <Textarea
                  value={noteCoach}
                  onChange={(e) => setNoteCoach(e.target.value)}
                  rows={4}
                  placeholder="Entrepreneure très forte sur l'opérationnel mais réticente au volet fiscal..."
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Si vide, l'IA déduit le contexte des données. Tu peux aussi écrire ce qui n'apparaît pas dans les notes.
                </p>
              </div>

              <div className="rounded-lg bg-muted/50 p-3 text-xs space-y-1">
                <p className="font-semibold">L'IA générera automatiquement :</p>
                <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
                  <li>📌 Synthèse de l'état actuel</li>
                  <li>🎯 Points clés à date (URGENT/ATTENTION/POSITIF)</li>
                  <li>✅ Chantiers en cours (table)</li>
                  <li>📋 Feuille de route 30 jours (table)</li>
                  <li>📂 Documents à obtenir + objectifs prochaine session</li>
                </ul>
              </div>

              <Button onClick={handleGenerate} disabled={generating} className="w-full">
                {generating ? (
                  <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Génération en cours (30-60s)…</>
                ) : (
                  <><Sparkles className="h-4 w-4 mr-1" /> Générer le rapport de suivi</>
                )}
              </Button>
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Rapport de suivi</DialogTitle>
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
