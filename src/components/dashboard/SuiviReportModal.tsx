import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { buildSuiviReportHtml } from '@/lib/suivi-report-builder';

interface SuiviReportModalProps {
  enterpriseId: string;
  enterpriseName: string;
  onClose: () => void;
}

export default function SuiviReportModal({ enterpriseId, enterpriseName, onClose }: SuiviReportModalProps) {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const [comment, setComment] = useState('');
  const [nextSteps, setNextSteps] = useState('');
  const [reportHtml, setReportHtml] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const [entRes, delivRes, notesRes, uploadsRes] = await Promise.all([
        supabase.from('enterprises').select('*').eq('id', enterpriseId).single(),
        supabase.from('deliverables').select('type, data, score').eq('enterprise_id', enterpriseId),
        supabase.from('coaching_notes' as any).select('*').eq('enterprise_id', enterpriseId).order('created_at', { ascending: false }),
        supabase.from('coach_uploads').select('*').eq('enterprise_id', enterpriseId),
      ]);

      const html = buildSuiviReportHtml({
        enterprise: entRes.data,
        deliverables: delivRes.data || [],
        notes: (notesRes.data as any[]) || [],
        uploads: uploadsRes.data || [],
        coachComment: comment,
        nextSteps,
        coachName: profile?.full_name || 'Coach',
      });
      setReportHtml(html);
    } catch (err: any) {
      toast.error(err.message || 'Erreur');
    } finally {
      setGenerating(false);
    }
  };

  const downloadAsHtml = () => {
    if (!reportHtml) return;
    const blob = new Blob([reportHtml], { type: 'text/html' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `Suivi_${enterpriseName.replace(/[^a-zA-Z0-9]/g, '_')}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
    toast.success(t('coaching.suivi_report_downloaded'));
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        {!reportHtml ? (
          <>
            <DialogHeader>
              <DialogTitle>{t('coaching.suivi_modal_title')} — {enterpriseName}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label className="text-xs font-medium">{t('coaching.suivi_comment_label')}</Label>
                <Textarea value={comment} onChange={e => setComment(e.target.value)} rows={4}
                  placeholder={t('coaching.suivi_comment_placeholder')} />
              </div>
              <div>
                <Label className="text-xs font-medium">{t('coaching.suivi_next_steps')}</Label>
                <Textarea value={nextSteps} onChange={e => setNextSteps(e.target.value)} rows={2}
                  placeholder={t('coaching.suivi_next_steps_placeholder')} />
              </div>
              <Button onClick={handleGenerate} disabled={generating} className="w-full">
                {generating ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> {t('coaching.suivi_compiling')}</> : t('coaching.suivi_generate')}
              </Button>
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{t('coaching.suivi_modal_title')}</DialogTitle>
              <div className="flex gap-2">
                <Button size="sm" onClick={downloadAsHtml}>{t('coaching.suivi_download_html')}</Button>
                <Button size="sm" variant="outline" onClick={() => setReportHtml(null)}>{t('coaching.modify')}</Button>
              </div>
            </DialogHeader>
            <iframe srcDoc={reportHtml} className="w-full h-[600px] border rounded-lg" />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
