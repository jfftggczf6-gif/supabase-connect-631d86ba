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

function safeText(v: any): string {
  if (!v) return '';
  if (typeof v === 'string') return v;
  return v.titre || v.label || v.detail || v.description || v.name || JSON.stringify(v);
}

export default function CandidatureDetailDrawer({ candidatureId, open, onOpenChange, coaches, onUpdated }: Props) {
  const [detail, setDetail] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [notes, setNotes] = useState('');
  const [selectedCoach, setSelectedCoach] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!candidatureId || !open) { setDetail(null); return; }
    setLoading(true);
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke('get-candidature-detail', { body: { candidature_id: candidatureId } });
        if (error) { toast({ title: 'Erreur', description: error.message, variant: 'destructive' }); return; }
        const cand = data?.candidature || data;
        console.log('[drawer] detail loaded:', cand?.company_name, 'screening:', !!cand?.screening_data);
        setDetail(cand || null);
        setNotes(cand?.committee_notes || '');
        setSelectedCoach(cand?.assigned_coach_id || '');
      } catch (e: any) {
        console.error('[drawer] fetch error:', e);
        toast({ title: 'Erreur', description: e.message, variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    })();
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

  const s = detail?.screening_data || {};
  const dims = s.diagnostic_dimensions || s.dimensions || s.scores_dimensions;
  const matching = s.matching_criteres;
  const reco = s.recommandation_accompagnement || s.recommandation;
  const incoherences = s.incoherences_detectees || s.incoherences || [];
  const pointsForts = s.points_forts || [];
  const pointsVig = s.points_vigilance || [];

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
              <p><strong>Contact :</strong> {detail.contact_name || '—'}</p>
              <p><strong>Email :</strong> {detail.contact_email || '—'}</p>
              {detail.contact_phone && <p><strong>Tél :</strong> {detail.contact_phone}</p>}
            </div>

            {/* Score */}
            {detail.screening_score != null && (
              <div className="p-4 rounded-lg bg-muted space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">Score IA</span>
                  <Badge className={Number(detail.screening_score) >= 70 ? 'bg-emerald-500' : Number(detail.screening_score) >= 40 ? 'bg-amber-500' : 'bg-red-500'}>
                    {detail.screening_score}/100
                  </Badge>
                </div>
                <Progress value={Number(detail.screening_score)} className="h-2" />
              </div>
            )}

            {/* Classification */}
            {s.classification && (
              <Badge variant="outline" className="text-sm">{s.classification}</Badge>
            )}

            {/* Dimensions */}
            {dims && typeof dims === 'object' && Object.keys(dims).length > 0 && (
              <div className="space-y-2">
                <h4 className="font-semibold text-sm">Dimensions</h4>
                {Object.entries(dims).map(([k, v]: [string, any]) => {
                  const score = typeof v === 'number' ? v : (v?.score ?? 0);
                  const label = v?.label || '';
                  return (
                    <div key={k} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="capitalize">{k.replace(/_/g, ' ')}{label ? ` — ${label}` : ''}</span>
                        <span>{score}/100</span>
                      </div>
                      <Progress value={score} className="h-1.5" />
                    </div>
                  );
                })}
              </div>
            )}

            {/* Matching critères */}
            {matching && (
              <div className="space-y-1">
                <h4 className="font-semibold text-sm">Matching critères</h4>
                {Array.isArray(matching.criteres_ok) && matching.criteres_ok.map((c: any, i: number) => (
                  <div key={`ok-${i}`} className="flex items-center gap-2 text-xs"><span>✅</span><span>{safeText(c)}</span></div>
                ))}
                {Array.isArray(matching.criteres_partiels) && matching.criteres_partiels.map((c: any, i: number) => (
                  <div key={`p-${i}`} className="flex items-center gap-2 text-xs"><span>⚠️</span><span>{safeText(c)}</span></div>
                ))}
                {Array.isArray(matching.criteres_ko) && matching.criteres_ko.map((c: any, i: number) => (
                  <div key={`ko-${i}`} className="flex items-center gap-2 text-xs"><span>❌</span><span>{safeText(c)}</span></div>
                ))}
              </div>
            )}

            {/* Points forts */}
            {pointsForts.length > 0 && (
              <div className="space-y-1">
                <h4 className="font-semibold text-sm text-emerald-700">Points forts</h4>
                <ul className="text-xs space-y-0.5 list-disc pl-4">
                  {pointsForts.map((p: any, i: number) => <li key={i}>{safeText(p)}</li>)}
                </ul>
              </div>
            )}

            {/* Points de vigilance */}
            {pointsVig.length > 0 && (
              <div className="space-y-1">
                <h4 className="font-semibold text-sm text-amber-700">Points de vigilance</h4>
                <ul className="text-xs space-y-0.5 list-disc pl-4">
                  {pointsVig.map((p: any, i: number) => <li key={i}>{safeText(p)}</li>)}
                </ul>
              </div>
            )}

            {/* Incohérences */}
            {Array.isArray(incoherences) && incoherences.length > 0 && (
              <div className="space-y-1">
                <h4 className="font-semibold text-sm">Incohérences</h4>
                {incoherences.map((inc: any, i: number) => (
                  <div key={i} className="text-xs">
                    <Badge variant="outline" className={
                      (inc.severite || inc.severity || '').toLowerCase().includes('bloquant') ? 'border-red-300 text-red-700' : 'border-amber-300 text-amber-700'
                    }>
                      {(inc.severite || inc.severity || 'INFO').toUpperCase()}
                    </Badge>
                    <span className="ml-2">{inc.observation || inc.label || inc.description || ''}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Recommandation */}
            {reco && (
              <div className="p-3 rounded-lg bg-muted text-sm space-y-2">
                <h4 className="font-semibold">Recommandation</h4>
                {reco.verdict && <Badge variant="outline">{reco.verdict}</Badge>}
                {reco.justification && <p>{reco.justification}</p>}
                {typeof reco === 'string' && <p>{reco}</p>}
                {Array.isArray(reco.priorites_si_selectionnee) && reco.priorites_si_selectionnee.length > 0 && (
                  <div>
                    <p className="font-medium text-xs mt-1">Si sélectionnée :</p>
                    <ul className="text-xs list-disc pl-4">{reco.priorites_si_selectionnee.map((p: string, i: number) => <li key={i}>{p}</li>)}</ul>
                  </div>
                )}
              </div>
            )}

            {/* Résumé comité */}
            {s.resume_comite && (
              <div className="p-3 rounded-lg border-2 border-primary/20 bg-primary/5 text-sm">
                <h4 className="font-semibold mb-1">📋 Résumé comité (30s)</h4>
                <p>{s.resume_comite}</p>
              </div>
            )}

            {/* Documents joints */}
            {Array.isArray(detail.documents) && detail.documents.length > 0 && (
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
                          const { data: d } = supabase.storage.from('candidature-documents').getPublicUrl(path);
                          window.open(d.publicUrl, '_blank');
                        }}>👁</Button>
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
