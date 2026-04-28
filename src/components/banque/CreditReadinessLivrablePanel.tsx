// CreditReadinessLivrablePanel — wrapper réutilisable pour TOUT livrable Credit Readiness.
//
// Responsabilités :
//   - charger le deliverable (data + validation_status + review_history)
//   - afficher l'en-tête de statut (Brouillon / Soumis / Corrections demandées / Validé)
//   - exposer les actions selon le rôle ET l'état (via useDeliverableCapabilities)
//   - afficher la timeline de revue
//   - render le viewer-spécifique passé en children
//
// Usage :
//   <CreditReadinessLivrablePanel
//     enterpriseId={...}
//     deliverableType="credit_readiness_modele_financier"
//     livrableCode="modele_financier"
//     livrableLabel="Modèle financier nettoyé"
//     emptyHint="Lance la génération IA pour produire le compte de résultat retraité."
//     renderViewer={(data) => <ModeleFinancierViewer data={data} />}
//   />

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, RefreshCw, Send, CheckCircle2, MessageSquare, Lock, History } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useDeliverableCapabilities } from './RoleGate';

interface ReviewEntry {
  at: string;
  by_user_id: string;
  by_role: string;
  action: string;
  comment: string | null;
}

interface DeliverableRow {
  id: string;
  data: any;
  validation_status: string | null;
  submitted_at: string | null;
  validated_at: string | null;
  review_comment: string | null;
  review_history: ReviewEntry[] | null;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft:              { label: 'Brouillon',           color: 'bg-muted text-muted-foreground border-border' },
  submitted:          { label: 'Soumis pour validation', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  revision_requested: { label: 'Corrections demandées', color: 'bg-amber-50 text-amber-800 border-amber-300' },
  validated:          { label: 'Validé',              color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  locked:             { label: 'Verrouillé',          color: 'bg-muted text-muted-foreground border-border' },
};

const ACTION_LABELS: Record<string, string> = {
  submitted:           'Soumis pour validation',
  validated:           'Validé',
  revision_requested:  'Corrections demandées',
  unlocked:            'Déverrouillé',
};

interface PanelProps {
  enterpriseId: string;
  deliverableType: string;
  livrableCode: string;
  livrableLabel: string;
  emptyHint?: string;
  renderViewer: (data: any) => React.ReactNode;
}

export default function CreditReadinessLivrablePanel({
  enterpriseId, deliverableType, livrableCode, livrableLabel, emptyHint, renderViewer,
}: PanelProps) {
  const [deliv, setDeliv] = useState<DeliverableRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<'generate' | 'submit' | 'validate' | 'request_revision' | null>(null);
  const [comment, setComment] = useState('');
  const [showCommentBox, setShowCommentBox] = useState<'request_revision' | 'validate' | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const fetchDeliv = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('deliverables')
      .select('id, data, validation_status, submitted_at, validated_at, review_comment, review_history')
      .eq('enterprise_id', enterpriseId)
      .eq('type', deliverableType)
      .maybeSingle();
    setDeliv(data as any);
    setLoading(false);
  }, [enterpriseId, deliverableType]);

  useEffect(() => { fetchDeliv(); }, [fetchDeliv]);

  // Polling pendant génération
  useEffect(() => {
    const isProcessing = (deliv?.data as any)?.status === 'processing';
    if (!isProcessing) return;
    const t = setInterval(fetchDeliv, 5000);
    return () => clearInterval(t);
  }, [deliv, fetchDeliv]);

  const status = deliv?.validation_status || (deliv ? 'draft' : null);
  const caps = useDeliverableCapabilities(status);
  const dataReady = deliv?.data && !((deliv.data as any).status);

  async function handleGenerate() {
    setBusy('generate');
    try {
      const { error } = await supabase.functions.invoke('generate-credit-readiness', {
        body: { enterprise_id: enterpriseId, livrable_code: livrableCode },
      });
      if (error) throw error;
      toast({ title: 'Génération lancée', description: 'Le livrable est en cours de calcul.' });
      setTimeout(fetchDeliv, 3000);
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message, variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  }

  async function handleWorkflow(action: 'submit' | 'validate' | 'request_revision') {
    setBusy(action);
    try {
      const body: any = { enterprise_id: enterpriseId, deliverable_type: deliverableType, action };
      if (comment.trim()) body.comment = comment.trim();
      const { error } = await supabase.functions.invoke('deliverable-workflow', { body });
      if (error) throw error;
      const labels = { submit: 'Soumis pour validation', validate: 'Livrable validé', request_revision: 'Corrections demandées' };
      toast({ title: labels[action] });
      setComment('');
      setShowCommentBox(null);
      await fetchDeliv();
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message, variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  // Pas de livrable encore
  if (!deliv) {
    return (
      <Card className="p-12 text-center">
        <div className="text-base font-semibold mb-1">{livrableLabel}</div>
        <div className="text-sm text-muted-foreground mb-4">
          {emptyHint || 'Lance la génération IA pour produire ce livrable.'}
        </div>
        {caps.canRegenerate && (
          <Button onClick={handleGenerate} disabled={busy === 'generate'} className="gap-2">
            {busy === 'generate' ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Générer le livrable
          </Button>
        )}
      </Card>
    );
  }

  // En cours de génération
  if ((deliv.data as any)?.status === 'processing') {
    return (
      <Card className="p-12 text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary mb-3" />
        <div className="text-sm font-medium">Génération en cours…</div>
        <div className="text-xs text-muted-foreground mt-1">~ 1 à 2 minutes.</div>
      </Card>
    );
  }

  // En erreur
  if ((deliv.data as any)?.status === 'error') {
    return (
      <Card className="p-12 text-center">
        <div className="text-sm font-medium text-red-700">Échec de la génération</div>
        <div className="text-xs text-muted-foreground mt-1 mb-4">{(deliv.data as any).error || 'Erreur inconnue'}</div>
        {caps.canRegenerate && (
          <Button onClick={handleGenerate} disabled={busy === 'generate'} className="gap-2">
            {busy === 'generate' ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Réessayer
          </Button>
        )}
      </Card>
    );
  }

  const statusInfo = STATUS_LABELS[status || 'draft'];

  return (
    <div className="space-y-4">
      {/* Bandeau d'état + actions */}
      <Card className="p-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div>
              <div className="text-base font-semibold">{livrableLabel}</div>
              <Badge variant="outline" className={`text-[10px] mt-1 ${statusInfo.color}`}>
                {caps.isLocked && <Lock className="h-3 w-3 mr-1 inline" />}
                {statusInfo.label}
              </Badge>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {/* Actions producteur */}
            {caps.canRegenerate && (
              <Button variant="outline" size="sm" onClick={handleGenerate} disabled={!!busy} className="gap-2">
                {busy === 'generate' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                Régénérer IA
              </Button>
            )}
            {caps.canSubmit && (
              <Button size="sm" onClick={() => handleWorkflow('submit')} disabled={!!busy} className="gap-2">
                {busy === 'submit' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                Soumettre pour validation
              </Button>
            )}

            {/* Actions valideur */}
            {caps.canRequestRevision && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCommentBox(showCommentBox === 'request_revision' ? null : 'request_revision')}
                className="gap-2 border-amber-300 text-amber-800"
              >
                <MessageSquare className="h-3.5 w-3.5" />
                Demander corrections
              </Button>
            )}
            {caps.canValidate && (
              <Button
                size="sm"
                onClick={() => handleWorkflow('validate')}
                disabled={!!busy}
                className="gap-2 bg-emerald-600 hover:bg-emerald-700"
              >
                {busy === 'validate' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                Valider livrable
              </Button>
            )}

            {/* Historique toggle */}
            {(deliv.review_history?.length || 0) > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setShowHistory(!showHistory)} className="gap-2">
                <History className="h-3.5 w-3.5" />
                Historique ({deliv.review_history?.length})
              </Button>
            )}
          </div>
        </div>

        {/* Box commentaire (corrections demandées) */}
        {showCommentBox === 'request_revision' && (
          <div className="mt-3 p-3 rounded-md bg-amber-50 border border-amber-200">
            <div className="text-xs font-semibold text-amber-900 mb-1.5">Commentaire à transmettre au conseiller :</div>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Ex : Le retraitement charges perso est correct mais il manque la convention loyer SCI familiale. Ajouter ce retraitement et recalculer l'EBITDA."
              className="text-sm min-h-[80px]"
            />
            <div className="flex gap-2 mt-2 justify-end">
              <Button variant="ghost" size="sm" onClick={() => { setShowCommentBox(null); setComment(''); }}>
                Annuler
              </Button>
              <Button
                size="sm"
                onClick={() => handleWorkflow('request_revision')}
                disabled={!!busy || !comment.trim()}
                className="gap-2 bg-amber-600 hover:bg-amber-700"
              >
                {busy === 'request_revision' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                Envoyer la demande
              </Button>
            </div>
          </div>
        )}

        {/* Dernier commentaire (s'il y en a un) */}
        {deliv.review_comment && status === 'revision_requested' && (
          <div className="mt-3 p-3 rounded-md bg-amber-50 border border-amber-200 text-xs">
            <div className="font-semibold text-amber-900 mb-1">Dernier commentaire de l'analyste :</div>
            <div className="text-amber-900">{deliv.review_comment}</div>
          </div>
        )}
      </Card>

      {/* Historique de revue */}
      {showHistory && (deliv.review_history?.length || 0) > 0 && (
        <Card className="p-4">
          <div className="text-sm font-semibold mb-2">Historique de la revue</div>
          <div className="space-y-2">
            {deliv.review_history!.map((entry, i) => (
              <div key={i} className="flex gap-3 text-xs border-l-2 border-border pl-3 py-1">
                <div className="text-muted-foreground whitespace-nowrap">
                  {new Date(entry.at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{ACTION_LABELS[entry.action] || entry.action}</div>
                  <div className="text-muted-foreground">par {entry.by_role}</div>
                  {entry.comment && <div className="mt-1 italic text-foreground/80">« {entry.comment} »</div>}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Le viewer spécifique au livrable */}
      {dataReady && renderViewer(deliv.data)}
    </div>
  );
}
