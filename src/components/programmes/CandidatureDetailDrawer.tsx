import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, FileText, Download, Building2, TrendingUp, Users, Target, ShieldAlert, BarChart3, Briefcase, Mail, Send } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import CompletionLinkDialog from './CompletionLinkDialog';
import CandidatureEmailHistory from './CandidatureEmailHistory';
import BulkEmailComposer, { type ComposerRecipient } from './BulkEmailComposer';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentRole } from '@/hooks/useCurrentRole';
import { getRecoveryStatus, recoveryBadgeClass } from '@/lib/recovery-status';
import { safeText, fmt } from '@/lib/candidature-format';
import { CandidatureDocumentsUploader } from './CandidatureDocumentsUploader';
import { mergeDocuments, type CandidatureDoc } from '@/lib/candidature-docs';
import { exportSingleCandidaturePdf, exportSingleCandidatureWord } from '@/lib/export-candidature-report-pdf';
import { buildLookup, enumIs, enumIncludes, type DiagnosticLabelRow, type Locale } from '@/lib/diagnostic-labels';
import { loadDiagnosticLabels } from '@/lib/diagnostic-labels-loader';
import { diagnosticForLocale } from '@/lib/diagnostic-prose';
import { DownloadAllZipButton } from '@/components/common/DownloadAllZipButton';

interface Props {
  candidatureId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  coaches: { id: string; name: string; count: number }[];
  onUpdated: () => void;
  candidatureIds?: string[];
  onNavigate?: (candidatureId: string) => void;
}

export default function CandidatureDetailDrawer({ candidatureId, open, onOpenChange, coaches, onUpdated, candidatureIds = [], onNavigate }: Props) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { role, isSuperAdmin } = useCurrentRole();
  const [showMessageComposer, setShowMessageComposer] = useState(false);
  const [emailSentTick, setEmailSentTick] = useState(0);
  const [detail, setDetail] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [notes, setNotes] = useState('');
  const [selectedCoach, setSelectedCoach] = useState('');
  const [saving, setSaving] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [showCompletionLink, setShowCompletionLink] = useState(false);
  // Docs ajoutés par le coordinateur pendant cette session (affichage optimiste,
  // fusionnés avec detail.documents ; la source de vérité revient au prochain reload).
  const [optimisticDocs, setOptimisticDocs] = useState<CandidatureDoc[]>([]);
  const [programmeName, setProgrammeName] = useState('');
  const [exportingPdf, setExportingPdf] = useState(false);
  // Langue d'affichage du diagnostic. Indépendante de la langue de l'interface :
  // un analyste francophone peut vouloir relire un dossier en anglais avant de
  // l'envoyer à un bailleur anglophone.
  const [diagLocale, setDiagLocale] = useState<Locale>('fr');
  const [labelRows, setLabelRows] = useState<DiagnosticLabelRow[]>([]);
  const [render, setRender] = useState<{ prose: any } | null>(null);
  const [rendering, setRendering] = useState(false);

  useEffect(() => {
    if (!candidatureId || !open) { setDetail(null); setShowMore(false); setOptimisticDocs([]); setProgrammeName(''); return; }
    setLoading(true);
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke('get-candidature-detail', { body: { candidature_id: candidatureId } });
        if (error) { toast({ title: 'Erreur', description: error.message, variant: 'destructive' }); return; }
        const cand = data?.candidature || data;
        setDetail(cand || null);
        setProgrammeName(data?.programme?.name || cand?.programme_name || '');
        setNotes(cand?.committee_notes || '');
        setSelectedCoach(cand?.assigned_coach_id || '');
      } catch (e: any) {
        toast({ title: 'Erreur', description: e.message, variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    })();
  }, [candidatureId, open]);

  // Référentiel de libellés : chargé une fois, mis en cache par le module.
  useEffect(() => { loadDiagnosticLabels().then(setLabelRows); }, []);

  // Rendu linguistique de la prose. Aucun rendu pour 'fr' : la prose française
  // EST screening_data (cf. diagnostic-prose.ts).
  useEffect(() => {
    if (!candidatureId || !open || diagLocale === 'fr') { setRender(null); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('candidature_diagnostic_renders')
        .select('prose, source_screening_date')
        .eq('candidature_id', candidatureId)
        .eq('locale', diagLocale)
        .maybeSingle();
      if (!cancelled) setRender(data ? { prose: (data as any).prose } : null);
    })();
    return () => { cancelled = true; };
  }, [candidatureId, open, diagLocale]);

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
    toast({ title: t('candidature.updated') });
    onUpdated();
    // Si l'action est un changement de status (move), on ferme le drawer pour
    // que l'user voie immédiatement la carte se déplacer dans le kanban et
    // que les autres espaces (Entreprises, dashboards) prennent le relais.
    if (action === 'move') {
      onOpenChange(false);
    }
  };

  // Le déterministe (score, montants, statuts) vient TOUJOURS de screening_data :
  // diagnosticForLocale ne remplace que les chemins de PROSE_PATHS.
  const s = diagnosticForLocale(detail?.screening_data, diagLocale, render) as any;
  const L = buildLookup(labelRows, diagLocale);
  // Le français insère une espace avant les deux-points, l'anglais non. Écrit en
  // dur, ce détail signait chaque ligne du diagnostic anglais comme traduite.
  const sep = diagLocale === 'en' ? ':' : ' :';
  // Les clés de dimension sont STRUCTURELLES (schéma), pas des valeurs du modèle :
  // elles passent par le référentiel, jamais par le rendu linguistique. Repli sur
  // la clé dé-soulignée si le schéma gagne une dimension avant le référentiel.
  const dimensionLabel = (cle: string): string => {
    const k = `dimension.${cle}`;
    const libelle = L.label(k);
    return libelle === k ? cle.replace(/_/g, ' ') : libelle;
  };
  const dims = s.diagnostic_dimensions || s.dimensions || s.scores_dimensions;
  const matching = s.matching_criteres;
  const reco = s.recommandation_accompagnement || s.recommandation;
  const incoherences = s.incoherences_detectees || s.incoherences || [];
  const pointsForts = s.points_forts || [];
  const pointsVig = s.points_vigilance || [];

  // Nouvelles sections enrichies
  const fiche = s.fiche_entreprise;
  const indFin = s.indicateurs_financiers;
  const marche = s.marche_positionnement;
  const equipe = s.equipe_gouvernance;
  const impact = s.impact_mesurable;
  const besoin = s.besoin_financement;
  const risques = s.risques_programme || [];
  const traction = s.traction;
  const benchmark = s.benchmark_declaratif;

  const hasEnrichedData = fiche || indFin || marche || equipe || impact || besoin || risques.length > 0 || traction || benchmark;

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto p-0">
        <DialogHeader className="px-6 pt-6 pb-2">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl">{detail?.company_name || L.label('doc.candidature')}</DialogTitle>
            {/* Langue du DIAGNOSTIC seulement. Les réponses au formulaire ne sont
                jamais traduites : ce sont les mots du candidat. */}
            <div className="flex items-center gap-1 ml-3" role="group" aria-label="Langue du diagnostic">
              {(['fr', 'en'] as Locale[]).map((lc) => (
                <Button
                  key={lc}
                  size="sm"
                  variant={diagLocale === lc ? 'default' : 'outline'}
                  className="h-7 px-2 text-[11px] uppercase"
                  onClick={() => setDiagLocale(lc)}
                >{lc}</Button>
              ))}
              {/* Rendu absent pour la langue choisie : on le propose plutôt que
                  d'afficher silencieusement du français sous un bouton « EN ». */}
              {diagLocale !== 'fr' && !render && detail?.screening_data && (
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-7 px-2 text-[11px]"
                  disabled={rendering}
                  onClick={async () => {
                    setRendering(true);
                    const { data, error } = await supabase.functions.invoke('render-diagnostic', {
                      body: { candidature_id: candidatureId, locale: diagLocale },
                    });
                    setRendering(false);
                    if (error || data?.error) {
                      toast({ title: 'Erreur', description: data?.error || error?.message, variant: 'destructive' });
                      return;
                    }
                    const { data: row } = await supabase
                      .from('candidature_diagnostic_renders')
                      .select('prose')
                      .eq('candidature_id', candidatureId)
                      .eq('locale', diagLocale)
                      .maybeSingle();
                    if (row) setRender({ prose: (row as any).prose });
                  }}
                >
                  {rendering ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Générer la version EN'}
                </Button>
              )}
            </div>
            {candidatureIds.length > 1 && onNavigate && candidatureId && (
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground mr-2">
                  {candidatureIds.indexOf(candidatureId) + 1}/{candidatureIds.length}
                </span>
                <Button
                  size="icon"
                  variant="outline"
                  className="h-8 w-8"
                  disabled={candidatureIds.indexOf(candidatureId) <= 0}
                  onClick={() => {
                    const idx = candidatureIds.indexOf(candidatureId);
                    if (idx > 0) onNavigate(candidatureIds[idx - 1]);
                  }}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="outline"
                  className="h-8 w-8"
                  disabled={candidatureIds.indexOf(candidatureId) >= candidatureIds.length - 1}
                  onClick={() => {
                    const idx = candidatureIds.indexOf(candidatureId);
                    if (idx < candidatureIds.length - 1) onNavigate(candidatureIds[idx + 1]);
                  }}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : detail ? (
          <div className="px-6 pb-6">
            {/* Top bar */}
            <div className="flex items-center gap-4 mb-6 pb-4 border-b flex-wrap">
              {detail.screening_score != null && (
                <div className="flex items-center gap-3">
                  <div className={`w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-lg ${
                    Number(detail.screening_score) >= 70 ? 'bg-emerald-500' : Number(detail.screening_score) >= 40 ? 'bg-amber-500' : 'bg-red-500'
                  }`}>
                    {detail.screening_score}
                  </div>
                  <div>
                    <p className="font-semibold text-sm">{t('candidature.score_ia')}</p>
                    <Progress value={Number(detail.screening_score)} className="h-1.5 w-24" />
                  </div>
                </div>
              )}
              {s.classification && <Badge variant="outline" className="text-sm h-8">{s.classification}</Badge>}
              {(() => {
                // Statut du « lien pour compléter » : dérivé des colonnes recovery_* de la candidature.
                const rs = getRecoveryStatus(detail);
                if (rs.state === 'none') return null;
                const d = rs.date ? new Date(rs.date).toLocaleDateString('fr-FR') : '';
                const text = rs.state === 'completed'
                  ? `✓ Complété le ${d}`
                  : rs.state === 'pending'
                    ? `🕓 Complétion en attente (expire le ${d})`
                    : `⚠ Lien expiré le ${d} — sans réponse`;
                return (
                  <Badge variant="outline" className={`text-xs h-8 ${recoveryBadgeClass(rs.state)}`}>
                    {text}
                  </Badge>
                );
              })()}
              <div className="ml-auto flex items-center gap-2">
                {/* Extract de CETTE fiche (PDF/Word), indépendant du reporting agrégé */}
                <Button size="sm" variant="outline" className="gap-1.5" disabled={exportingPdf} title="Exporter cette fiche en PDF" onClick={async () => {
                  setExportingPdf(true);
                  try { await exportSingleCandidaturePdf(detail, programmeName, diagLocale); }
                  catch (e: any) { toast({ title: 'Export PDF impossible', description: e?.message, variant: 'destructive' }); }
                  finally { setExportingPdf(false); }
                }}>
                  {exportingPdf ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />} Extract PDF
                </Button>
                <Button size="sm" variant="outline" className="gap-1.5" title="Exporter cette fiche en Word" onClick={() => {
                  try { await exportSingleCandidatureWord(detail, programmeName, diagLocale); }
                  catch (e: any) { toast({ title: 'Export Word impossible', description: e?.message, variant: 'destructive' }); }
                }}>
                  <FileText className="h-3.5 w-3.5" /> Extract Word
                </Button>
                {detail?.status === 'selected' ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      setSaving(true);
                      const { data, error } = await supabase.functions.invoke('update-candidature', {
                        body: { candidature_id: candidatureId, action: 'retry_doc_transfer' }
                      });
                      setSaving(false);
                      if (error || data?.error) {
                        toast({ title: 'Erreur', description: data?.error || error?.message, variant: 'destructive' });
                      } else {
                        toast({ title: 'Transfer relancé', description: `${data?.transferred ?? 0} nouveaux, ${data?.skipped ?? 0} déjà là, ${data?.failed?.length ?? 0} échecs` });
                        onUpdated();
                      }
                    }}
                    disabled={saving}
                  >
                    Re-transférer documents
                  </Button>
                ) : (
                  <>
                    <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowCompletionLink(true)} disabled={saving} title="Envoyer au candidat un lien pour re-déposer ses documents">
                      <Mail className="h-3.5 w-3.5" />
                      Lien pour compléter
                    </Button>
                    {/* Bouton « Envoyer un message » (communication mono-destinataire).
                        Visibilité = owner/admin/manager OU coach assigné ; l'autorisation
                        RÉELLE est re-vérifiée côté EF (candidature-email-send). */}
                    {(isSuperAdmin
                      || ['owner', 'admin', 'manager'].includes(role || '')
                      || (detail?.assigned_coach_id && detail.assigned_coach_id === user?.id)) && (
                      <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowMessageComposer(true)} disabled={saving} title="Envoyer un message à ce candidat">
                        <Send className="h-3.5 w-3.5" />
                        Envoyer un message
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => updateCandidature('move', { new_status: 'pre_selected' })} disabled={saving}>{t('candidature.preselect')}</Button>
                    <Button size="sm" onClick={() => updateCandidature('move', { new_status: 'selected' })} disabled={saving}>{t('candidature.select')}</Button>
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => updateCandidature('move', { new_status: 'rejected' })} disabled={saving}>{t('candidature.reject')}</Button>
                  </>
                )}
              </div>
            </div>

            {/* 2-column layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* LEFT (2 cols) */}
              <div className="lg:col-span-2 space-y-4">
                {/* Résumé comité */}
                {s.resume_comite && (
                  <Card className="border-primary/20 bg-primary/5">
                    <CardContent className="p-4">
                      <h4 className="font-semibold text-sm mb-2">{t('candidature.committee_summary')}</h4>
                      <p className="text-sm">{s.resume_comite}</p>
                    </CardContent>
                  </Card>
                )}

                {/* Fiche entreprise (NOUVEAU) */}
                {fiche && (
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <h4 className="font-semibold text-sm">{t('screening.company_profile')}</h4>
                        {fiche.stade && <Badge variant="outline" className="text-[10px]">{L.enumLabel('stade', fiche.stade)}</Badge>}
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs mb-2">
                        {fiche.ca_declare != null && (
                          <div className="p-2 bg-muted/50 rounded text-center">
                            <p className="font-bold text-sm">{fmt(fiche.ca_declare, '', diagLocale)}</p>
                            <p className="text-muted-foreground">{L.label('champ.ca')} {fiche.ca_devise || ''}</p>
                          </div>
                        )}
                        {fiche.effectif_declare != null && (
                          <div className="p-2 bg-muted/50 rounded text-center">
                            <p className="font-bold text-sm">{fiche.effectif_declare}</p>
                            <p className="text-muted-foreground">{L.label('champ.employes')}</p>
                          </div>
                        )}
                        {fiche.anciennete_ans != null && (
                          <div className="p-2 bg-muted/50 rounded text-center">
                            <p className="font-bold text-sm">{fiche.anciennete_ans} {L.label('unite.ans')}</p>
                            <p className="text-muted-foreground">{L.label('champ.anciennete')}</p>
                          </div>
                        )}
                        {fiche.pays && (
                          <div className="p-2 bg-muted/50 rounded text-center">
                            <p className="font-bold text-sm">{fiche.pays}</p>
                            <p className="text-muted-foreground">{fiche.ville || L.label('champ.pays')}</p>
                          </div>
                        )}
                      </div>
                      {fiche.description_activite && <p className="text-xs text-muted-foreground">{fiche.description_activite}</p>}
                    </CardContent>
                  </Card>
                )}

                {/* Dimensions */}
                {dims && typeof dims === 'object' && Object.keys(dims).length > 0 && (
                  <Card>
                    <CardContent className="p-4">
                      <h4 className="font-semibold text-sm mb-3">{t('screening.dimensions')}</h4>
                      <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                        {Object.entries(dims).map(([k, v]: [string, any]) => {
                          const score = typeof v === 'number' ? v : (v?.score ?? 0);
                          const label = v?.label || '';
                          return (
                            <div key={k} className="space-y-1">
                              <div className="flex justify-between text-xs">
                                <span>{dimensionLabel(k)}{label ? ` — ${label}` : ''}</span>
                                <span className="font-medium">{score}/100</span>
                              </div>
                              <Progress value={score} className="h-2" />
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Matching critères */}
                {matching && (
                  <Card>
                    <CardContent className="p-4">
                      <h4 className="font-semibold text-sm mb-2">{t('screening.matching_criteria')}</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {Array.isArray(matching.criteres_ok) && matching.criteres_ok.length > 0 && (
                          <div className="space-y-1">
                            <p className="text-xs font-medium text-emerald-700">{t('screening.validated')} ({matching.criteres_ok.length})</p>
                            {matching.criteres_ok.map((c: any, i: number) => (
                              <div key={i} className="flex items-start gap-1.5 text-xs"><span className="text-emerald-500 mt-0.5">✓</span><span>{safeText(c)}</span></div>
                            ))}
                          </div>
                        )}
                        {Array.isArray(matching.criteres_partiels) && matching.criteres_partiels.length > 0 && (
                          <div className="space-y-1">
                            <p className="text-xs font-medium text-amber-700">{t('screening.partial')} ({matching.criteres_partiels.length})</p>
                            {matching.criteres_partiels.map((c: any, i: number) => (
                              <div key={i} className="flex items-start gap-1.5 text-xs"><span className="text-amber-500 mt-0.5">~</span><span>{safeText(c)}</span></div>
                            ))}
                          </div>
                        )}
                        {Array.isArray(matching.criteres_ko) && matching.criteres_ko.length > 0 && (
                          <div className="space-y-1">
                            <p className="text-xs font-medium text-red-700">{t('screening.not_met')} ({matching.criteres_ko.length})</p>
                            {matching.criteres_ko.map((c: any, i: number) => (
                              <div key={i} className="flex items-start gap-1.5 text-xs"><span className="text-red-500 mt-0.5">✗</span><span>{safeText(c)}</span></div>
                            ))}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Points forts + vigilance */}
                {(pointsForts.length > 0 || pointsVig.length > 0) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {pointsForts.length > 0 && (
                      <Card>
                        <CardContent className="p-4">
                          <h4 className="font-semibold text-sm text-emerald-700 mb-2">{t('screening.strengths')}</h4>
                          <ul className="text-xs space-y-1 list-disc pl-4">
                            {pointsForts.map((p: any, i: number) => <li key={i}>{safeText(p)}</li>)}
                          </ul>
                        </CardContent>
                      </Card>
                    )}
                    {pointsVig.length > 0 && (
                      <Card>
                        <CardContent className="p-4">
                          <h4 className="font-semibold text-sm text-amber-700 mb-2">{t('screening.watch_points')}</h4>
                          <ul className="text-xs space-y-1 list-disc pl-4">
                            {pointsVig.map((p: any, i: number) => <li key={i}>{safeText(p)}</li>)}
                          </ul>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                )}

                {/* Incohérences */}
                {Array.isArray(incoherences) && incoherences.length > 0 && (
                  <Card>
                    <CardContent className="p-4">
                      <h4 className="font-semibold text-sm mb-2">{t('screening.inconsistencies')}</h4>
                      <div className="space-y-2">
                        {incoherences.map((inc: any, i: number) => (
                          <div key={i} className="flex items-start gap-2 text-xs">
                            <Badge variant="outline" className={`shrink-0 ${
                              (inc.severite || '').includes('BLOQUANT') ? 'border-red-300 text-red-700' :
                              (inc.severite || '').includes('ATTENTION') ? 'border-amber-300 text-amber-700' :
                              'border-gray-300'
                            }`}>{L.enumLabel('severite', inc.severite || 'INFO')}</Badge>
                            <span>{inc.observation || ''}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Recommandation */}
                {reco && (
                  <Card className="bg-muted/50">
                    <CardContent className="p-4">
                      <h4 className="font-semibold text-sm mb-2">{t('screening.recommendation')}</h4>
                      {(reco.avis || reco.verdict) && <Badge variant="outline" className="mb-2">{L.enumLabel('avis', reco.avis || reco.verdict)}</Badge>}
                      {reco.justification && <p className="text-sm mb-2">{reco.justification}</p>}
                      {typeof reco === 'string' && <p className="text-sm">{reco}</p>}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2 text-xs">
                        {Array.isArray(reco.priorites_si_selectionnee) && reco.priorites_si_selectionnee.length > 0 && (
                          <div>
                            <p className="font-medium mb-1">{t('screening.priorities_if_selected')}</p>
                            <ul className="list-disc pl-4 space-y-0.5">{reco.priorites_si_selectionnee.map((p: string, i: number) => <li key={i}>{p}</li>)}</ul>
                          </div>
                        )}
                        {Array.isArray(reco.conditions_prealables) && reco.conditions_prealables.length > 0 && (
                          <div>
                            <p className="font-medium text-red-700 mb-1">{t('screening.prerequisites')}</p>
                            <ul className="list-disc pl-4 space-y-0.5">{reco.conditions_prealables.map((c: string, i: number) => <li key={i}>{c}</li>)}</ul>
                          </div>
                        )}
                      </div>
                      {reco.potentiel_6_mois && <p className="text-xs mt-2"><strong>{t('screening.potential_6m')}{sep}</strong> {reco.potentiel_6_mois}</p>}
                      {reco.profil_coach_ideal && <p className="text-xs"><strong>{t('screening.coach_profile')}{sep}</strong> {reco.profil_coach_ideal}</p>}
                    </CardContent>
                  </Card>
                )}

                {/* ═══ VOIR PLUS — sections enrichies ═══ */}
                {hasEnrichedData && (
                  <div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full gap-2"
                      onClick={() => setShowMore(!showMore)}
                    >
                      <FileText className="h-4 w-4" />
                      {showMore ? t('candidature.hide_diagnostic') : t('candidature.view_full_diagnostic')}
                      {showMore ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>

                    {showMore && (
                      <div className="mt-4 space-y-4">

                        {/* Indicateurs financiers */}
                        {indFin && (
                          <Card>
                            <CardContent className="p-4">
                              <div className="flex items-center gap-2 mb-3">
                                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                                <h4 className="font-semibold text-sm">{t('screening.financial_indicators')}</h4>
                                {indFin.fiabilite && <Badge variant="outline" className={`text-[10px] ${
                                  enumIs(indFin.fiabilite, 'Élevée') ? 'text-emerald-700' : enumIs(indFin.fiabilite, 'Faible') ? 'text-red-700' : 'text-amber-700'
                                }`}>{L.enumLabel('fiabilite', indFin.fiabilite)}</Badge>}
                              </div>
                              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-2">
                                {indFin.ca_annuel != null && (
                                  <div className="p-2 bg-muted/50 rounded text-center text-xs">
                                    <p className="font-bold">{fmt(indFin.ca_annuel, '', diagLocale)}</p>
                                    <p className="text-muted-foreground">{L.label('champ.ca_annuel')}</p>
                                  </div>
                                )}
                                {indFin.croissance_ca_pct != null && (
                                  <div className="p-2 bg-muted/50 rounded text-center text-xs">
                                    <p className={`font-bold ${indFin.croissance_ca_pct >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{indFin.croissance_ca_pct}%</p>
                                    <p className="text-muted-foreground">{L.label('champ.croissance')}</p>
                                  </div>
                                )}
                                {indFin.marge_estimee_pct != null && (
                                  <div className="p-2 bg-muted/50 rounded text-center text-xs">
                                    <p className="font-bold">{indFin.marge_estimee_pct}%</p>
                                    <p className="text-muted-foreground">{L.label('champ.marge')}</p>
                                  </div>
                                )}
                                {indFin.rentabilite && (
                                  <div className="p-2 bg-muted/50 rounded text-center text-xs">
                                    <p className={`font-bold ${enumIs(indFin.rentabilite, 'Rentable') ? 'text-emerald-600' : enumIs(indFin.rentabilite, 'Déficitaire') ? 'text-red-600' : ''}`}>{L.enumLabel('rentabilite', indFin.rentabilite)}</p>
                                    <p className="text-muted-foreground">{L.label('champ.rentabilite')}</p>
                                  </div>
                                )}
                                {indFin.tresorerie_estimee && (
                                  <div className="p-2 bg-muted/50 rounded text-center text-xs">
                                    <p className={`font-bold ${enumIs(indFin.tresorerie_estimee, 'Critique') ? 'text-red-600' : enumIs(indFin.tresorerie_estimee, 'Tendue') ? 'text-amber-600' : ''}`}>{L.enumLabel('tresorerie', indFin.tresorerie_estimee)}</p>
                                    <p className="text-muted-foreground">{L.label('champ.tresorerie')}</p>
                                  </div>
                                )}
                                {indFin.niveau_endettement && (
                                  <div className="p-2 bg-muted/50 rounded text-center text-xs">
                                    <p className={`font-bold ${enumIs(indFin.niveau_endettement, 'Élevé') ? 'text-red-600' : ''}`}>{L.enumLabel('endettement', indFin.niveau_endettement)}</p>
                                    <p className="text-muted-foreground">{L.label('champ.endettement')}</p>
                                  </div>
                                )}
                              </div>
                              {indFin.commentaire && <p className="text-xs text-muted-foreground">{indFin.commentaire}</p>}
                              <p className="text-[10px] text-muted-foreground mt-1">{indFin.source_donnees || L.label('etat.donnees_decl')}</p>
                            </CardContent>
                          </Card>
                        )}

                        {/* Marché & positionnement */}
                        {marche && (
                          <Card>
                            <CardContent className="p-4">
                              <div className="flex items-center gap-2 mb-2">
                                <Target className="h-4 w-4 text-muted-foreground" />
                                <h4 className="font-semibold text-sm">{t('screening.market_positioning')}</h4>
                                {marche.barriere_entree && <Badge variant="outline" className="text-[10px]">{L.label('champ.barriere_entree')}{sep} {L.enumLabel('barriere_entree', marche.barriere_entree)}</Badge>}
                              </div>
                              <div className="text-xs space-y-1.5">
                                {marche.marche_cible && <p><strong>{L.label('champ.marche')}{sep}</strong> {marche.marche_cible}</p>}
                                {marche.taille_estimee && <p><strong>{L.label('champ.taille')}{sep}</strong> {marche.taille_estimee}</p>}
                                {marche.positionnement && <p><strong>{L.label('champ.positionnement')}{sep}</strong> {marche.positionnement}</p>}
                                {marche.concurrence && <p><strong>{L.label('champ.concurrence')}{sep}</strong> {marche.concurrence}</p>}
                                {marche.avantage_competitif && <p><strong>{L.label('champ.avantage')}{sep}</strong> {marche.avantage_competitif}</p>}
                              </div>
                            </CardContent>
                          </Card>
                        )}

                        {/* Équipe & gouvernance */}
                        {equipe && (
                          <Card>
                            <CardContent className="p-4">
                              <div className="flex items-center gap-2 mb-2">
                                <Users className="h-4 w-4 text-muted-foreground" />
                                <h4 className="font-semibold text-sm">{t('screening.team_governance')}</h4>
                                {equipe.gouvernance && <Badge variant="outline" className="text-[10px]">{L.enumLabel('gouvernance', equipe.gouvernance)}</Badge>}
                                {equipe.key_man_risk && <Badge variant="outline" className="text-[10px] border-red-300 text-red-700">{L.label('champ.key_man_risk')}</Badge>}
                              </div>
                              <div className="text-xs space-y-1.5">
                                {equipe.profil_dirigeant && <p><strong>{L.label('champ.dirigeant')}{sep}</strong> {equipe.profil_dirigeant}</p>}
                                {equipe.equipe_direction && <p><strong>{L.label('champ.equipe')}{sep}</strong> {equipe.equipe_direction}</p>}
                                {equipe.commentaire && <p className="text-muted-foreground">{equipe.commentaire}</p>}
                              </div>
                            </CardContent>
                          </Card>
                        )}

                        {/* Impact mesurable */}
                        {impact && (
                          <Card>
                            <CardContent className="p-4">
                              <div className="flex items-center gap-2 mb-2">
                                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                                <h4 className="font-semibold text-sm">{t('screening.measurable_impact')}</h4>
                                {impact.mesurabilite && <Badge variant="outline" className={`text-[10px] ${
                                  enumIs(impact.mesurabilite, 'Forte') ? 'text-emerald-700' : enumIs(impact.mesurabilite, 'Faible') ? 'text-red-700' : 'text-amber-700'
                                }`}>{L.label('champ.mesurabilite')}{sep} {L.enumLabel('mesurabilite', impact.mesurabilite)}</Badge>}
                              </div>
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
                                {impact.emplois_actuels != null && (
                                  <div className="p-2 bg-muted/50 rounded text-center text-xs">
                                    <p className="font-bold">{impact.emplois_actuels}</p>
                                    <p className="text-muted-foreground">{L.label('champ.emplois_actuels')}</p>
                                  </div>
                                )}
                                {impact.pct_femmes != null && (
                                  <div className="p-2 bg-muted/50 rounded text-center text-xs">
                                    <p className="font-bold">{impact.pct_femmes}%</p>
                                    <p className="text-muted-foreground">{L.label('champ.femmes')}</p>
                                  </div>
                                )}
                                {impact.pct_jeunes != null && (
                                  <div className="p-2 bg-muted/50 rounded text-center text-xs">
                                    <p className="font-bold">{impact.pct_jeunes}%</p>
                                    <p className="text-muted-foreground">{L.label('champ.jeunes')}</p>
                                  </div>
                                )}
                              </div>
                              <div className="text-xs space-y-1">
                                {impact.emplois_projetes && <p><strong>{L.label('champ.projection')}{sep}</strong> {impact.emplois_projetes}</p>}
                                {impact.beneficiaires_directs && <p><strong>{L.label('champ.beneficiaires')}{sep}</strong> {impact.beneficiaires_directs}</p>}
                                {Array.isArray(impact.odd_potentiels) && impact.odd_potentiels.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {impact.odd_potentiels.map((o: string, i: number) => <Badge key={i} variant="outline" className="text-[10px]">{o}</Badge>)}
                                  </div>
                                )}
                                {impact.commentaire && <p className="text-muted-foreground mt-1">{impact.commentaire}</p>}
                              </div>
                            </CardContent>
                          </Card>
                        )}

                        {/* Besoin de financement */}
                        {besoin && (
                          <Card>
                            <CardContent className="p-4">
                              <div className="flex items-center gap-2 mb-2">
                                <Briefcase className="h-4 w-4 text-muted-foreground" />
                                <h4 className="font-semibold text-sm">{t('screening.funding_need')}</h4>
                              </div>
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
                                {besoin.montant_demande != null && (
                                  <div className="p-2 bg-muted/50 rounded text-center text-xs">
                                    <p className="font-bold">{fmt(besoin.montant_demande, '', diagLocale)}</p>
                                    <p className="text-muted-foreground">{L.label('champ.montant')} {besoin.montant_devise || ''}</p>
                                  </div>
                                )}
                                {besoin.type_adapte && (
                                  <div className="p-2 bg-muted/50 rounded text-center text-xs">
                                    <p className="font-bold">{L.enumLabel('type_adapte', besoin.type_adapte)}</p>
                                    <p className="text-muted-foreground">{L.label('champ.type_adapte')}</p>
                                  </div>
                                )}
                                {besoin.coherence_vs_ca && (
                                  <div className="p-2 bg-muted/50 rounded text-center text-xs">
                                    <p className={`font-bold ${enumIs(besoin.coherence_vs_ca, 'Cohérent') ? 'text-emerald-600' : enumIncludes(besoin.coherence_vs_ca, 'Élevé') ? 'text-red-600' : ''}`}>{L.enumLabel('coherence_vs_ca', besoin.coherence_vs_ca)}</p>
                                    <p className="text-muted-foreground">{L.label('champ.vs_ca')}</p>
                                  </div>
                                )}
                                {besoin.capacite_absorption && (
                                  <div className="p-2 bg-muted/50 rounded text-center text-xs">
                                    <p className={`font-bold ${enumIs(besoin.capacite_absorption, 'Faible') ? 'text-red-600' : ''}`}>{L.enumLabel('absorption', besoin.capacite_absorption)}</p>
                                    <p className="text-muted-foreground">{L.label('champ.absorption')}</p>
                                  </div>
                                )}
                              </div>
                              {Array.isArray(besoin.utilisation_prevue) && besoin.utilisation_prevue.length > 0 && (
                                <div className="text-xs mb-1">
                                  <p className="font-medium mb-0.5">{L.label('champ.utilisation')}</p>
                                  <ul className="list-disc pl-4 space-y-0.5">{besoin.utilisation_prevue.map((u: string, i: number) => <li key={i}>{u}</li>)}</ul>
                                </div>
                              )}
                              {besoin.commentaire && <p className="text-xs text-muted-foreground">{besoin.commentaire}</p>}
                            </CardContent>
                          </Card>
                        )}

                        {/* Risques programme */}
                        {risques.length > 0 && (
                          <Card>
                            <CardContent className="p-4">
                              <div className="flex items-center gap-2 mb-2">
                                <ShieldAlert className="h-4 w-4 text-muted-foreground" />
                                <h4 className="font-semibold text-sm">{t('screening.programme_risks')}</h4>
                              </div>
                              <div className="space-y-2">
                                {risques.map((r: any, i: number) => (
                                  <div key={i} className="p-2 rounded bg-muted/30 text-xs">
                                    <div className="flex items-center gap-2 mb-0.5">
                                      <Badge variant="outline" className={`text-[10px] ${
                                        enumIs(r.probabilite, 'élevée') ? 'border-red-300 text-red-700' :
                                        enumIs(r.probabilite, 'moyenne') ? 'border-amber-300 text-amber-700' :
                                        'border-gray-300'
                                      }`}>{L.enumLabel('probabilite', r.probabilite) || '?'}</Badge>
                                      <span className="font-medium">{r.risque}</span>
                                      {r.type && <Badge variant="outline" className="text-[9px]">{r.type}</Badge>}
                                    </div>
                                    {r.impact_programme && <p className="text-muted-foreground">Impact : {r.impact_programme}</p>}
                                    {r.mitigation && <p className="text-violet-600">Mitigation : {r.mitigation}</p>}
                                  </div>
                                ))}
                              </div>
                            </CardContent>
                          </Card>
                        )}

                        {/* Traction */}
                        {traction && (
                          <Card>
                            <CardContent className="p-4">
                              <h4 className="font-semibold text-sm mb-2">{t('screening.traction_proof')}</h4>
                              {traction.niveau_preuve && (
                                <Badge variant="outline" className={`text-[10px] mb-2 ${
                                  enumIs(traction.niveau_preuve, 'Solide') ? 'text-emerald-700' :
                                  enumIs(traction.niveau_preuve, 'Déclaratif uniquement') ? 'text-red-700' : 'text-amber-700'
                                }`}>{L.enumLabel('niveau_preuve', traction.niveau_preuve)}</Badge>
                              )}
                              <div className="text-xs space-y-1">
                                {traction.anciennete && <p><strong>{L.label('champ.anciennete')}{sep}</strong> {traction.anciennete}</p>}
                                {traction.evolution_ca && <p><strong>{L.label('champ.evolution_ca')}{sep}</strong> {traction.evolution_ca}</p>}
                                {Array.isArray(traction.preuves_tangibles) && traction.preuves_tangibles.length > 0 && (
                                  <div>
                                    <p className="font-medium mt-1">{L.label('champ.preuves')}</p>
                                    <ul className="list-disc pl-4 space-y-0.5">{traction.preuves_tangibles.map((p: string, i: number) => <li key={i}>{p}</li>)}</ul>
                                  </div>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        )}

                        {/* Benchmark */}
                        {benchmark && (
                          <Card>
                            <CardContent className="p-4">
                              <h4 className="font-semibold text-sm mb-1">{t('screening.sector_benchmark')}</h4>
                              <div className="flex items-center gap-2 text-xs">
                                {benchmark.position_vs_secteur && (
                                  <Badge variant="outline" className={`${
                                    enumIs(benchmark.position_vs_secteur, 'Au-dessus') ? 'text-emerald-700' :
                                    enumIs(benchmark.position_vs_secteur, 'En-dessous') ? 'text-red-700' : 'text-amber-700'
                                  }`}>{L.enumLabel('position_vs_secteur', benchmark.position_vs_secteur)}</Badge>
                                )}
                                {benchmark.commentaire && <span className="text-muted-foreground">{benchmark.commentaire}</span>}
                              </div>
                            </CardContent>
                          </Card>
                        )}

                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* RIGHT (1 col) */}
              <div className="space-y-4">
                {/* Contact */}
                <Card>
                  <CardContent className="p-4 space-y-1 text-sm">
                    <h4 className="font-semibold text-sm mb-2">{t('candidature.contact')}</h4>
                    <p><strong>{L.label('champ.nom')}{sep}</strong> {detail.contact_name || '—'}</p>
                    <p><strong>{L.label('champ.email')}{sep}</strong> {detail.contact_email || '—'}</p>
                    {detail.contact_phone && <p><strong>{L.label('champ.tel')}{sep}</strong> {detail.contact_phone}</p>}
                    {detail.form_data?.secteur && <p><strong>{L.label('champ.secteur')}{sep}</strong> {detail.form_data.secteur}</p>}
                    {detail.form_data?.pays && <p><strong>{L.label('champ.pays')}{sep}</strong> {detail.form_data.pays}</p>}
                    {detail.form_data?.effectif && <p><strong>{L.label('champ.effectif')}{sep}</strong> {fmt(Number(detail.form_data.effectif), '', diagLocale)}</p>}
                    {detail.form_data?.ca && <p><strong>{L.label('champ.ca')}{sep}</strong> {fmt(Number(detail.form_data.ca), '', diagLocale)}</p>}
                  </CardContent>
                </Card>

                {/* Réponses au formulaire (champs personnalisés) — gère texte ET choix multiples (tableau) */}
                {(() => {
                  const fd = (detail.form_data || {}) as Record<string, any>;
                  const SKIP = new Set(['pays', 'secteur', 'effectif', 'ca']);
                  const entries = Object.entries(fd).filter(([k, v]) =>
                    !SKIP.has(k)
                    && v != null
                    && !(Array.isArray(v) && v.length === 0)
                    && String(v).trim() !== '',
                  );
                  if (entries.length === 0) return null;
                  return (
                    <Card>
                      <CardContent className="p-4">
                        <h4 className="font-semibold text-sm mb-2">{L.label('section.reponses_form')}</h4>
                        <div className="space-y-2.5 text-sm">
                          {entries.map(([k, v]) => (
                            <div key={k}>
                              <p className="text-xs font-medium text-muted-foreground">{k}</p>
                              {Array.isArray(v)
                                ? <ul className="list-disc pl-4 space-y-0.5">{v.map((x, i) => <li key={i}>{String(x)}</li>)}</ul>
                                : <p className="whitespace-pre-wrap">{String(v)}</p>}
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })()}

                {/* Documents */}
                {(() => {
                  const docs = mergeDocuments(Array.isArray(detail.documents) ? detail.documents : [], optimisticDocs);
                  return (
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold text-sm">{t('candidature.documents')} ({docs.length})</h4>
                        {docs.length > 0 && (
                          <DownloadAllZipButton
                            zipBaseName={detail.company_name || 'candidature'}
                            files={docs.map((doc: any) => ({
                              name: doc.file_name,
                              fetch: async () => {
                                const path = (doc.storage_path || '').replace('candidature-documents/', '');
                                const { data: signed } = await supabase.storage.from('candidature-documents').createSignedUrl(path, 300);
                                if (!signed?.signedUrl) return null;
                                const res = await fetch(signed.signedUrl);
                                return res.ok ? await res.blob() : null;
                              },
                            }))}
                          />
                        )}
                      </div>
                      {docs.length > 0 && (
                        <div className="space-y-1.5 mb-3">
                          {docs.map((doc: any, i: number) => (
                            <div key={i} className="flex items-center justify-between p-2 bg-muted rounded text-xs">
                              <div className="min-w-0">
                                <p className="font-medium truncate">{doc.file_name}</p>
                                <p className="text-muted-foreground">{doc.field_label} — {Math.round((doc.file_size || 0) / 1024)} KB</p>
                                {doc.source === 'coordinator' && (
                                  <p className="text-[10px] text-primary mt-0.5">
                                    Ajouté par {doc.added_by_name || 'coordinateur'}{doc.added_at ? ` le ${new Date(doc.added_at).toLocaleDateString('fr-FR')}` : ''}
                                  </p>
                                )}
                              </div>
                              <Button size="sm" variant="ghost" className="h-6 text-xs shrink-0" onClick={async () => {
                                // Bucket candidature-documents = privé en prod. On génère une URL signée
                                // (valide 5 min) plutôt qu'une URL publique qui renverrait 404.
                                const path = (doc.storage_path || '').replace('candidature-documents/', '');
                                const { data: signed, error } = await supabase.storage
                                  .from('candidature-documents')
                                  .createSignedUrl(path, 300, { download: doc.file_name });
                                if (error || !signed?.signedUrl) {
                                  toast({
                                    title: 'Téléchargement impossible',
                                    description: error?.message || 'Lien introuvable',
                                    variant: 'destructive',
                                  });
                                  return;
                                }
                                const a = document.createElement('a');
                                a.href = signed.signedUrl;
                                a.download = doc.file_name;
                                a.target = '_blank';
                                a.rel = 'noopener';
                                a.click();
                              }}>
                                <Download className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                      {/* Ajout de docs par le coordinateur (entreprise n'ayant pas pu uploader) */}
                      <CandidatureDocumentsUploader
                        candidatureId={candidatureId!}
                        onDone={(added) => { setOptimisticDocs(prev => mergeDocuments(prev, added)); onUpdated(); }}
                      />
                    </CardContent>
                  </Card>
                  );
                })()}

                {/* Historique des e-mails envoyés (brief 1, critère 10) */}
                <Card>
                  <CardContent className="p-4">
                    <CandidatureEmailHistory key={emailSentTick} candidatureId={candidatureId} />
                  </CardContent>
                </Card>

                {/* La sélection du coach se fait depuis le volet Entreprises
                    après création de l'entreprise (transition selected → enterprise) */}

                {/* Notes */}
                <Card>
                  <CardContent className="p-4 space-y-2">
                    <h4 className="font-semibold text-sm">{t('candidature.committee_notes')}</h4>
                    <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={4} placeholder="Notes internes..." className="text-sm" />
                    <Button size="sm" variant="outline" className="w-full" onClick={() => updateCandidature('add_note', { committee_notes: notes })} disabled={saving}>
                      {t('common.save')}
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>

    <CompletionLinkDialog
      candidatureId={candidatureId}
      contactEmail={detail?.contact_email ?? null}
      contactName={detail?.contact_name ?? null}
      companyName={detail?.company_name ?? null}
      programmeName={detail?.programme?.name ?? null}
      open={showCompletionLink}
      onOpenChange={setShowCompletionLink}
    />

    {/* Bouton « Envoyer un message » : composeur en mode mono-destinataire
        (communication). MÊME chemin d'envoi que le groupé — garde-fou, plafonds,
        journalisation, identité — via BulkEmailComposer → candidature-email-send. */}
    <BulkEmailComposer
      open={showMessageComposer}
      onOpenChange={setShowMessageComposer}
      soloMode
      recipients={detail && candidatureId ? [{
        id: candidatureId,
        company_name: detail.company_name ?? null,
        contact_name: detail.contact_name ?? null,
        contact_email: detail.contact_email ?? null,
        form_data: detail.form_data ?? null,
        documents: Array.isArray(detail.documents) ? detail.documents : null,
        status: detail.status ?? '',
      } as ComposerRecipient] : []}
      programme={{ name: detail?.programme?.name ?? programmeName, form_fields: detail?.programme?.form_fields }}
      onSent={() => { setEmailSentTick((n) => n + 1); onUpdated(); }}
    />
    </>
  );
}
