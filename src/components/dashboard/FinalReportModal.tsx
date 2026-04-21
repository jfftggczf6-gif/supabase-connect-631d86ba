import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, Sparkles } from 'lucide-react';
import { getValidAccessToken } from '@/lib/getValidAccessToken';

interface FinalReportModalProps {
  enterpriseId: string;
  enterpriseName: string;
  onClose: () => void;
}

export default function FinalReportModal({ enterpriseId, enterpriseName, onClose }: FinalReportModalProps) {
  const { t } = useTranslation();
  const { session: authSession } = useAuth();
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

  const downloadAsHtml = () => {
    if (!reportHtml) return;
    const blob = new Blob([reportHtml], { type: 'text/html' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `Rapport_Final_${enterpriseName.replace(/[^a-zA-Z0-9]/g, '_')}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
    toast.success('Rapport téléchargé');
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        {!reportHtml ? (
          <>
            <DialogHeader>
              <DialogTitle>Rapport final — {enterpriseName}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label className="text-xs font-medium">Commentaire du coach</Label>
                <Textarea value={comment} onChange={e => setComment(e.target.value)} rows={4}
                  placeholder="L'entreprise présente des fondamentaux solides…" />
              </div>
              <div>
                <Label className="text-xs font-medium">Recommandation</Label>
                <Textarea value={recommendation} onChange={e => setRecommendation(e.target.value)} rows={2}
                  placeholder="ÉLIGIBLE SOUS CONDITIONS — Financer après…" />
              </div>
              <Button onClick={handleGenerate} disabled={generating} className="w-full">
                {generating ? (
                  <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Génération en cours (30-60s)…</>
                ) : (
                  <><Sparkles className="h-4 w-4 mr-1" /> Générer le rapport final</>
                )}
              </Button>
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Rapport final</DialogTitle>
              <div className="flex gap-2">
                <Button size="sm" onClick={downloadAsHtml}>HTML</Button>
                <Button size="sm" variant="outline" onClick={() => setReportHtml(null)}>Modifier</Button>
              </div>
            </DialogHeader>
            <iframe srcDoc={reportHtml} className="w-full h-[600px] border rounded-lg" />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
