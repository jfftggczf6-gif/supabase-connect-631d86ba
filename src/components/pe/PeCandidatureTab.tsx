// PeCandidatureTab — onglet "Candidature" du workspace MD (fonds à impact type I&P)
// Spec :
//   1. CTA "Gérer le formulaire" en haut → ouvre /programmes/:id (éditeur existant volet programme)
//   2. Section "Diffusion de l'appel" : URL + copie + ouvrir + embed iframe + compteur candidatures
//      (QR Code exclu sur demande user)
//   3. Si pas d'appel encore → CTA "Créer l'appel à candidatures"
//   4. Si plusieurs appels (cycles successifs) → liste empilée + bouton "Nouvel appel"
//   5. Réponses du formulaire viennent remplir le pipeline en Synthèse
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Loader2, Plus, Settings2, Copy, ExternalLink, Mail, FileSignature, Inbox, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { derivePeAppelStatus, PE_APPEL_STATUS_META } from '@/lib/pe-appel-status';

interface Programme {
  id: string;
  name: string;
  status: string;
  form_slug: string | null;
  start_date: string | null;
  end_date: string | null;
  organization_id: string;
  candidatures_count?: number;
}

interface Props {
  organizationId: string;
}

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  draft:       { label: 'Brouillon',  cls: 'bg-slate-100 text-slate-700 border-slate-200' },
  open:        { label: 'Ouvert',     cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  closed:      { label: 'Fermé',      cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  in_progress: { label: 'En cours',   cls: 'bg-violet-50 text-violet-700 border-violet-200' },
  completed:   { label: 'Terminé',    cls: 'bg-slate-100 text-slate-700 border-slate-200' },
};

export default function PeCandidatureTab({ organizationId }: Props) {
  const { t } = useTranslation();
  const nav = useNavigate();
  const [programmes, setProgrammes] = useState<Programme[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const fetchProgrammes = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-programme', {
        body: { action: 'list', organization_id: organizationId },
      });
      if (error) { toast.error(error.message); setProgrammes([]); setLoading(false); return; }
      const list: Programme[] = Array.isArray(data?.programmes) ? data.programmes : Array.isArray(data) ? data : [];
      // Tri : appels avec dates configurées (= utiles) en premier, brouillons vides en dernier
      const sorted = list
        .filter(p => p.organization_id === organizationId)
        .sort((a, b) => {
          const aHasDates = Boolean(a.start_date && a.end_date);
          const bHasDates = Boolean(b.start_date && b.end_date);
          if (aHasDates !== bHasDates) return aHasDates ? -1 : 1;
          return 0;
        });
      setProgrammes(sorted);
    } catch (e: any) {
      toast.error(e.message);
      setProgrammes([]);
    }
    setLoading(false);
  }, [organizationId]);

  useEffect(() => { fetchProgrammes(); }, [fetchProgrammes]);

  // Action unique du tab : ouvre le formulaire actif. Si aucun n'existe, en crée un puis ouvre.
  const handleGererFormulaire = async () => {
    if (programmes.length > 0) {
      nav(`/pe/candidature/${programmes[0].id}/edit`);
      return;
    }
    setCreating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase.functions.invoke('manage-programme', {
        body: {
          action: 'create',
          name: `Appel à candidatures ${new Date().getFullYear()}`,
          organization_id: organizationId,
          chef_programme_id: user?.id,
          status: 'draft',
        },
      });
      if (error) { toast.error(error.message); setCreating(false); return; }
      const newId = data?.programme?.id || data?.id;
      if (newId) {
        toast.success('Appel créé — complète le formulaire');
        nav(`/pe/candidature/${newId}/edit`);
      } else {
        toast.success('Appel créé');
        fetchProgrammes();
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setCreating(false);
    }
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  // Pas d'appel encore
  if (programmes.length === 0) {
    return (
      <Card>
        <CardContent className="py-16 text-center">
          <Inbox className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Aucun appel à candidatures</h3>
          <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
            Configure ton formulaire de candidature pour diffuser un appel public et récolter les
            dossiers qui rempliront automatiquement ton pipeline.
          </p>
          <Button onClick={handleGererFormulaire} disabled={creating} className="gap-2 bg-violet-600 hover:bg-violet-700">
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Settings2 className="h-4 w-4" />}
            Gérer le formulaire
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header — UN SEUL bouton "Gérer le formulaire" en haut à droite */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold">Appel à candidatures</h2>
          <p className="text-xs text-muted-foreground">
            Les réponses remplissent automatiquement le pipeline en Synthèse.
          </p>
        </div>
        <Button onClick={handleGererFormulaire} disabled={creating} className="gap-2 bg-violet-600 hover:bg-violet-700">
          {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Settings2 className="h-4 w-4" />}
          Gérer le formulaire
        </Button>
      </div>

      {/* Appel actif (le plus récent). Statut dérivé des dates. Diffuseur visible
          dès qu'il y a un slug + dates (peu importe que ce soit "Programmé" ou "Ouvert"). */}
      {(() => {
        const prog = programmes[0];
        const url = prog.form_slug ? `${window.location.origin}/candidature/${prog.form_slug}` : null;
        const derived = derivePeAppelStatus(prog.start_date, prog.end_date);
        const meta = PE_APPEL_STATUS_META[derived];
        const hasDates = Boolean(prog.start_date && prog.end_date);

        return (
          <Card key={prog.id}>
            <CardContent className="p-5 space-y-5">
              {/* Header de l'appel — statut dérivé des dates */}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold">{prog.name}</h3>
                    <Badge variant="outline" className={meta.cls}>{meta.emoji} {meta.label}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {hasDates
                      ? `Candidatures du ${new Date(prog.start_date!).toLocaleDateString('fr-FR')} au ${new Date(prog.end_date!).toLocaleDateString('fr-FR')}`
                      : 'Dates à configurer dans "Gérer le formulaire"'}
                  </p>
                </div>
                {derived === 'draft' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      if (!confirm(`Supprimer ce brouillon "${prog.name}" ?`)) return;
                      const { error } = await supabase.functions.invoke('manage-programme', {
                        body: { action: 'delete', id: prog.id },
                      });
                      if (error) { toast.error(error.message); return; }
                      toast.success('Brouillon supprimé');
                      fetchProgrammes();
                    }}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 gap-1.5"
                  >
                    <Trash2 className="h-4 w-4" /> Supprimer
                  </Button>
                )}
                {/* Clôture manuelle : force end_date à now → bascule auto en "Clôturé" */}
                {(derived === 'open' || derived === 'scheduled') && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      if (!confirm(`Clôturer les candidatures pour "${prog.name}" maintenant ? L'URL publique cessera d'accepter de nouvelles soumissions.`)) return;
                      const { error } = await supabase
                        .from('programmes')
                        .update({ end_date: new Date().toISOString().slice(0, 10) })
                        .eq('id', prog.id);
                      if (error) { toast.error(error.message); return; }
                      toast.success(`Candidatures clôturées pour "${prog.name}"`);
                      fetchProgrammes();
                    }}
                    className="text-amber-600 border-amber-300 hover:bg-amber-50 gap-1.5"
                  >
                    🔒 Clôturer les candidatures
                  </Button>
                )}
              </div>

              {/* Section Diffusion — visible dès qu'il y a un slug (peu importe le statut),
                  car l'URL est créée. L'edge fn submit-candidature garde la porte fermée
                  hors fenêtre de dates. */}
              {url && hasDates ? (
                <div className="space-y-4 pt-4 border-t">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <Mail className="h-4 w-4 text-violet-600" /> Diffusion de l'appel
                  </h4>

                  {/* Bandeau d'info selon le statut */}
                  {derived === 'scheduled' && (
                    <p className="text-xs bg-blue-50 border border-blue-200 text-blue-700 rounded px-3 py-2">
                      ⏳ Le formulaire est prêt. Les candidatures seront acceptées à partir du{' '}
                      <strong>{new Date(prog.start_date!).toLocaleDateString('fr-FR')}</strong>.
                    </p>
                  )}
                  {derived === 'closed' && (
                    <p className="text-xs bg-amber-50 border border-amber-200 text-amber-700 rounded px-3 py-2">
                      🔒 Période de candidature terminée le{' '}
                      <strong>{new Date(prog.end_date!).toLocaleDateString('fr-FR')}</strong>.
                      Modifie les dates dans "Gérer le formulaire" pour rouvrir.
                    </p>
                  )}

                  {/* URL public */}
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Lien public du formulaire</label>
                    <div className="flex items-center gap-2">
                      <Input value={url} readOnly className="flex-1 font-mono text-xs" />
                      <Button variant="outline" size="icon" onClick={() => { navigator.clipboard.writeText(url); toast.success('📋 Lien copié'); }} title="Copier">
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="icon" onClick={() => window.open(url, '_blank')} title="Ouvrir">
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Embed iframe */}
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Code d'intégration (iframe)</label>
                    <pre className="p-2 bg-muted rounded text-xs overflow-x-auto">
{`<iframe src="${url}" width="600" height="800" frameborder="0"></iframe>`}
                    </pre>
                  </div>

                  {/* Compteur candidatures + rappel pipeline auto */}
                  <div className="flex items-center justify-between gap-3 pt-2 border-t">
                    <div className="flex items-center gap-2">
                      <Inbox className="h-4 w-4 text-violet-600" />
                      <span className="text-sm">
                        <span className="font-semibold">{prog.candidatures_count ?? 0}</span>{' '}
                        candidature{(prog.candidatures_count ?? 0) > 1 ? 's' : ''} reçue{(prog.candidatures_count ?? 0) > 1 ? 's' : ''}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground italic">
                      → Chaque réponse alimente automatiquement le pipeline en pré-screening
                    </span>
                  </div>
                </div>
              ) : (
                <div className="pt-4 border-t flex items-start gap-3 bg-amber-50 border border-amber-200 rounded p-3">
                  <FileSignature className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-amber-800">Formulaire incomplet</p>
                    <p className="text-xs text-amber-700 mt-1">
                      Clique "Gérer le formulaire" pour configurer les critères, champs et dates de candidature.
                      Le diffuseur s'affichera automatiquement.
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })()}

      {/* Cycles précédents (si plus d'un appel) — collapsible */}
      {programmes.length > 1 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground py-2">
            Cycles précédents ({programmes.length - 1})
          </summary>
          <div className="space-y-2 mt-2">
            {programmes.slice(1).map(p => {
              const dv = derivePeAppelStatus(p.start_date, p.end_date);
              const m = PE_APPEL_STATUS_META[dv];
              return (
                <Card key={p.id} className="cursor-pointer hover:bg-muted/30" onClick={() => nav(`/pe/candidature/${p.id}/edit`)}>
                  <CardContent className="py-3 flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <span className="font-medium">{p.name}</span>{' '}
                      <Badge variant="outline" className={`text-[10px] ${m.cls}`}>{m.emoji} {m.label}</Badge>
                    </div>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {p.start_date && p.end_date
                        ? `${new Date(p.start_date).toLocaleDateString('fr-FR')} → ${new Date(p.end_date).toLocaleDateString('fr-FR')}`
                        : '—'}
                      {' · '}{p.candidatures_count ?? 0} candidature{(p.candidatures_count ?? 0) > 1 ? 's' : ''}
                    </span>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </details>
      )}
    </div>
  );
}
