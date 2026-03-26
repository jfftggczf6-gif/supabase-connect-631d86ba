import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface Props {
  candidatureId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  coaches: { id: string; name: string; count: number }[];
  onUpdated: () => void;
}

export default function CandidatureDetailDrawer({ candidatureId, open, onOpenChange, coaches, onUpdated }: Props) {
  const [detail, setDetail] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [notes, setNotes] = useState('');
  const [selectedCoach, setSelectedCoach] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!candidatureId || !open) return;
    setLoading(true);
    supabase.functions.invoke('get-candidature-detail', { body: { candidature_id: candidatureId } })
      .then(({ data, error }) => {
        if (error) { toast({ title: 'Erreur', description: error.message, variant: 'destructive' }); return; }
        // Backend returns { candidature: {...}, programme: {...} }
        const cand = data?.candidature || data;
        setDetail(cand);
        setNotes(cand?.committee_notes || '');
        setSelectedCoach(cand?.assigned_coach_id || '');
      })
      .finally(() => setLoading(false));
  }, [candidatureId, open]);

  const updateCandidature = async (action: string, extra: Record<string, any> = {}) => {
    setSaving(true);
    const { data, error } = await supabase.functions.invoke('update-candidature', {
      body: { candidature_id: candidatureId, action, ...extra }
    });
    setSaving(false);
    if (error || data?.error) {
      toast({ title: 'Erreur', description: data?.error || error?.message, variant: 'destructive' });
      return;
    }
    toast({ title: '✅ Candidature mise à jour' });
    onUpdated();
  };

  const screening = detail?.screening_data;
  const dimensions = screening?.dimensions || screening?.scores_dimensions;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{detail?.company_name || 'Candidature'}</SheetTitle>
        </SheetHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : detail ? (
          <div className="space-y-6 mt-4">
            {/* Contact */}
            <div className="space-y-1 text-sm">
              <p><strong>Contact :</strong> {detail.contact_name}</p>
              <p><strong>Email :</strong> {detail.contact_email}</p>
              {detail.contact_phone && <p><strong>Tél :</strong> {detail.contact_phone}</p>}
            </div>

            {/* Score */}
            {detail.screening_score != null && (
              <div className="p-4 rounded-lg bg-muted space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">Score IA</span>
                  <Badge className={detail.screening_score >= 70 ? 'bg-emerald-500' : detail.screening_score >= 40 ? 'bg-amber-500' : 'bg-red-500'}>
                    {detail.screening_score}/100
                  </Badge>
                </div>
                <Progress value={detail.screening_score} className="h-2" />
              </div>
            )}

            {/* Dimensions */}
            {dimensions && typeof dimensions === 'object' && (
              <div className="space-y-2">
                <h4 className="font-semibold text-sm">Dimensions</h4>
                {Object.entries(dimensions).map(([k, v]: [string, any]) => (
                  <div key={k} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="capitalize">{k.replace(/_/g, ' ')}</span>
                      <span>{typeof v === 'number' ? v : v?.score ?? '—'}/100</span>
                    </div>
                    <Progress value={typeof v === 'number' ? v : v?.score ?? 0} className="h-1.5" />
                  </div>
                ))}
              </div>
            )}

            {/* Matching */}
            {screening?.matching_criteres && (
              <div className="space-y-1">
                <h4 className="font-semibold text-sm">Matching critères</h4>
                {(Array.isArray(screening.matching_criteres) ? screening.matching_criteres : Object.entries(screening.matching_criteres).map(([k, v]: any) => ({ critere: k, ...v }))).map((c: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span>{c.status === 'ok' || c.match ? '✅' : c.status === 'partial' ? '⚠️' : '❌'}</span>
                    <span>{c.critere || c.label || c.name}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Points forts / vigilance */}
            {screening?.points_forts && (
              <div className="space-y-1">
                <h4 className="font-semibold text-sm text-emerald-700">Points forts</h4>
                <ul className="text-xs space-y-0.5 list-disc pl-4">
                  {screening.points_forts.map((p: string, i: number) => <li key={i}>{p}</li>)}
                </ul>
              </div>
            )}
            {screening?.points_vigilance && (
              <div className="space-y-1">
                <h4 className="font-semibold text-sm text-amber-700">Points de vigilance</h4>
                <ul className="text-xs space-y-0.5 list-disc pl-4">
                  {screening.points_vigilance.map((p: string, i: number) => <li key={i}>{p}</li>)}
                </ul>
              </div>
            )}

            {/* Incohérences */}
            {screening?.incoherences?.length > 0 && (
              <div className="space-y-1">
                <h4 className="font-semibold text-sm">Incohérences</h4>
                {screening.incoherences.map((inc: any, i: number) => (
                  <Badge key={i} variant="outline" className={inc.severity === 'bloquant' ? 'border-red-300 text-red-700' : 'border-amber-300 text-amber-700'}>
                    {inc.severity === 'bloquant' ? '🚫 BLOQUANT' : '⚠️ ATTENTION'} — {inc.label || inc.description}
                  </Badge>
                ))}
              </div>
            )}

            {/* Recommandation */}
            {screening?.recommandation && (
              <div className="p-3 rounded-lg bg-muted text-sm space-y-1">
                <h4 className="font-semibold">Recommandation</h4>
                <p>{typeof screening.recommandation === 'string' ? screening.recommandation : screening.recommandation.justification}</p>
              </div>
            )}

            {/* Résumé comité */}
            {screening?.resume_comite && (
              <div className="p-3 rounded-lg border-2 border-primary/20 bg-primary/5 text-sm">
                <h4 className="font-semibold mb-1">📋 Résumé comité (30s)</h4>
                <p>{screening.resume_comite}</p>
              </div>
            )}

            {/* Documents joints */}
            {detail.documents?.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-semibold text-sm">📎 Documents joints ({detail.documents.length})</h4>
                <div className="space-y-1">
                  {detail.documents.map((doc: any, i: number) => (
                    <div key={i} className="flex items-center justify-between p-2 bg-muted rounded text-xs">
                      <div>
                        <p className="font-medium">{doc.file_name}</p>
                        <p className="text-muted-foreground">{doc.field_label} — {Math.round((doc.file_size || 0) / 1024)} KB</p>
                      </div>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => {
                          const path = (doc.storage_path || '').replace('candidature-documents/', '');
                          const { data } = supabase.storage.from('candidature-documents').getPublicUrl(path);
                          window.open(data.publicUrl, '_blank');
                        }}>👁</Button>
                        <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => {
                          const path = (doc.storage_path || '').replace('candidature-documents/', '');
                          const { data } = supabase.storage.from('candidature-documents').getPublicUrl(path);
                          const a = document.createElement('a'); a.href = data.publicUrl; a.download = doc.file_name; a.click();
                        }}>⬇</Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Coach assignment */}
            <div className="space-y-2">
              <h4 className="font-semibold text-sm">Assigner un coach</h4>
              <Select value={selectedCoach} onValueChange={setSelectedCoach}>
                <SelectTrigger><SelectValue placeholder="Choisir un coach" /></SelectTrigger>
                <SelectContent>
                  {coaches.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name} ({c.count} entreprises)</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedCoach && selectedCoach !== detail.assigned_coach_id && (
                <Button size="sm" onClick={() => updateCandidature('assign_coach', { coach_id: selectedCoach })} disabled={saving}>
                  {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null} Assigner
                </Button>
              )}
            </div>

            {/* Notes comité */}
            <div className="space-y-2">
              <h4 className="font-semibold text-sm">Notes comité</h4>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Notes pour le comité..." />
              <Button size="sm" variant="outline" onClick={() => updateCandidature('add_note', { committee_notes: notes })} disabled={saving}>
                Enregistrer les notes
              </Button>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-4 border-t">
              <Button size="sm" variant="destructive" onClick={() => updateCandidature('move', { new_status: 'rejected' })} disabled={saving}>Rejeter</Button>
              <Button size="sm" variant="outline" onClick={() => updateCandidature('move', { new_status: 'pre_selected' })} disabled={saving}>Pré-sélectionner</Button>
              <Button size="sm" onClick={() => {
                if (!selectedCoach) { toast({ title: 'Assignez un coach', description: 'Un coach doit être assigné pour sélectionner', variant: 'destructive' }); return; }
                updateCandidature('move', { new_status: 'selected', coach_id: selectedCoach });
              }} disabled={saving}>Sélectionner</Button>
            </div>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
