// src/components/ba/CandidatureContent.tsx
// Contenu pur de l'onglet Candidature BA (sans DashboardLayout).
// MULTI-APPELS : N programmes BA en parallèle, sélecteur dropdown + bouton
// "+ Nouvel appel". Persistance de la sélection via URL ?appel=<id>.
// Assemble les 4 blocs : Diffusion · KPIs · Tableau · Modale.
// Form Builder en sous-page si view='builder'.
import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Settings, Copy, Pause, Play, Loader2, ArrowRight, Check, X, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useAuth } from '@/hooks/useAuth';
import { useBaProgrammes } from '@/hooks/useBaProgrammes';
import { useBaCandidatures } from '@/hooks/useBaCandidatures';
import CandidatureFormBuilder from './CandidatureFormBuilder';
import CandidatureDetailDialog from './CandidatureDetailDialog';
import CreateAppelDialog from './CreateAppelDialog';
import AppelSelector from './AppelSelector';
import {
  STATUS_LABEL, UI_TO_DB_STATUS, computeEligibility,
  type CandidatureRow, type CandidatureStatus,
} from '@/types/candidature-ba';
import EligibilityBadge from './EligibilityBadge';

function StatusTag({ s }: { s: CandidatureStatus }) {
  const cls =
    s === 'new' ? 'bg-violet-100 text-violet-700 border-violet-200'
    : s === 'reviewing' ? 'bg-amber-100 text-amber-700 border-amber-200'
    : s === 'accepted' ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
    : 'bg-muted text-muted-foreground border-border';
  return <Badge variant="outline" className={`text-[10px] ${cls}`}>{STATUS_LABEL[s]}</Badge>;
}

export default function CandidatureContent() {
  const { currentOrg } = useOrganization();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const { programmes, loading: progLoading, reload: reloadProgrammes } = useBaProgrammes(currentOrg?.id);

  // ─── Sélection appel : URL ?appel=<id> · fallback au plus récent ─────
  const urlAppelId = searchParams.get('appel');
  const selectedId = useMemo(() => {
    if (urlAppelId && programmes.some(p => p.id === urlAppelId)) return urlAppelId;
    return programmes[0]?.id ?? null;
  }, [urlAppelId, programmes]);

  // Si l'URL est obsolète (appel supprimé / autre org), nettoyer.
  useEffect(() => {
    if (urlAppelId && programmes.length > 0 && !programmes.some(p => p.id === urlAppelId)) {
      setSearchParams(prev => { prev.delete('appel'); return prev; }, { replace: true });
    }
  }, [urlAppelId, programmes, setSearchParams]);

  const selectAppel = (id: string) => {
    setSearchParams(prev => { prev.set('appel', id); return prev; }, { replace: true });
  };

  const programme = useMemo(
    () => programmes.find(p => p.id === selectedId) ?? null,
    [programmes, selectedId],
  );

  const {
    candidatures, counts, convertedIds, loading: candLoading, reload: reloadCands,
  } = useBaCandidatures(programme?.id, currentOrg?.id);

  const [view, setView] = useState<'list' | 'builder'>('list');
  const [openId, setOpenId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [toggling, setToggling] = useState(false);

  const openCandidature = useMemo(
    () => openId ? candidatures.find(c => c.id === openId) ?? null : null,
    [openId, candidatures],
  );

  const publicUrl = programme
    ? `${window.location.origin}/candidature/${programme.form_slug}`
    : '';

  // Pause = status='closed' : submit-candidature refuse déjà les soumissions
  // sur ce status, donc le formulaire public devient inaccessible (brief #6).
  const isPaused = programme?.status === 'closed';
  const isActive = programme?.status === 'in_progress' || programme?.status === 'draft';

  const changeCandStatus = async (cand: CandidatureRow, uiStatus: CandidatureStatus) => {
    const { data, error } = await supabase.functions.invoke('update-candidature', {
      body: {
        candidature_id: cand.id,
        action: 'change_status',
        new_status: UI_TO_DB_STATUS[uiStatus],
      },
    });
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error || error?.message || 'Action refusée');
      return;
    }
    toast.success(`Candidature ${STATUS_LABEL[uiStatus].toLowerCase()}`);
    reloadCands();
  };

  const handleTogglePause = async () => {
    if (!programme) return;
    setToggling(true);
    const newStatus = isPaused ? 'in_progress' : 'closed';
    const { data, error } = await supabase.functions.invoke('manage-programme', {
      body: { action: 'update', id: programme.id, status: newStatus },
    });
    setToggling(false);
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error || error?.message || 'Action refusée');
      return;
    }
    toast.success(isPaused ? 'Appel réactivé' : 'Appel mis en pause');
    reloadProgrammes();
  };

  if (progLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  // ─── État vide : aucun appel ───────────────────────────────────
  if (programmes.length === 0) {
    return (
      <>
        <Card className="p-12 text-center">
          <h3 className="text-base font-semibold mb-2">Aucun appel à candidatures</h3>
          <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
            Créez votre premier appel pour commencer à recevoir des candidatures.
            Un formulaire avec 11 champs par défaut sera initialisé — tu pourras le
            personnaliser ensuite via "Gérer le formulaire".
          </p>
          <Button onClick={() => setCreateOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Créer mon premier appel
          </Button>
        </Card>
        {currentOrg && (
          <CreateAppelDialog
            open={createOpen}
            onOpenChange={setCreateOpen}
            organizationId={currentOrg.id}
            onCreated={(id) => { reloadProgrammes(); selectAppel(id); }}
          />
        )}
      </>
    );
  }

  // ─── Form builder en sous-page ─────────────────────────────────
  if (view === 'builder' && programme) {
    return (
      <CandidatureFormBuilder
        programme={programme}
        onBack={() => setView('list')}
        onSaved={() => { reloadProgrammes(); setView('list'); }}
      />
    );
  }

  if (!programme) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  // ─── Vue liste ─────────────────────────────────────────────────
  return (
    <>
      {/* Header : sélecteur appel + actions */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div className="flex items-center gap-2 flex-wrap">
          <AppelSelector
            programmes={programmes}
            selectedId={selectedId}
            onSelect={selectAppel}
          />
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 h-9"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="h-3.5 w-3.5" /> Nouvel appel
          </Button>
        </div>
        <Button onClick={() => setView('builder')} className="gap-2">
          <Settings className="h-4 w-4" /> Gérer le formulaire
        </Button>
      </div>

      {/* Bloc 1 — Diffusion */}
      <Card className="p-4 mb-4">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-3">
          Diffusion de l'appel
        </div>
        <div className="grid md:grid-cols-3 gap-4 mb-3">
          <div>
            <div className="text-[10px] text-muted-foreground">Statut</div>
            <div className={`text-sm font-semibold mt-1 flex items-center gap-1.5 ${isPaused ? 'text-amber-600' : 'text-emerald-600'}`}>
              <span className={`h-2 w-2 rounded-full ${isPaused ? 'bg-amber-500' : 'bg-emerald-500'}`} />
              {isPaused ? 'En pause' : isActive ? 'Actif' : programme.status}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-muted-foreground">Période</div>
            <div className="text-sm font-semibold mt-1">
              {programme.start_date
                ? new Date(programme.start_date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
                : '—'}
              {' → '}
              {programme.end_date
                ? new Date(programme.end_date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
                : '—'}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-muted-foreground">Lien public</div>
            <div className="flex gap-1 mt-1">
              <input
                readOnly
                value={publicUrl}
                className="flex-1 px-2 py-1 text-[11px] border rounded font-mono bg-muted/30 text-muted-foreground"
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2"
                onClick={async () => {
                  try { await navigator.clipboard.writeText(publicUrl); toast.success('Lien copié'); }
                  catch { toast.error('Copie refusée'); }
                }}
              >
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>
        {(programme.country_filter.length > 0 || programme.sector_filter.length > 0) && (
          <div className="flex flex-wrap gap-1.5 mb-3 pb-3 border-b">
            {programme.country_filter.map(c => (
              <Badge key={`c-${c}`} variant="secondary" className="text-[10px]">{c}</Badge>
            ))}
            {programme.sector_filter.map(s => (
              <Badge key={`s-${s}`} variant="outline" className="text-[10px]">{s}</Badge>
            ))}
          </div>
        )}
        <div className="flex justify-end">
          <Button
            size="sm"
            variant="outline"
            onClick={handleTogglePause}
            disabled={toggling}
            className={isPaused ? '' : 'text-amber-600 border-amber-300'}
          >
            {toggling ? <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              : isPaused ? <Play className="h-3 w-3 mr-1" /> : <Pause className="h-3 w-3 mr-1" />}
            {isPaused ? 'Réactiver' : 'Mettre en pause'}
          </Button>
        </div>
      </Card>

      {/* Bloc 4 — KPIs */}
      <div className="text-sm font-semibold text-muted-foreground mb-2">
        Réponses reçues — {candidatures.length} candidature{candidatures.length > 1 ? 's' : ''}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
        <Card className="p-3 text-center">
          <div className="text-2xl font-bold text-violet-600">{counts.new}</div>
          <div className="text-[10px] text-muted-foreground mt-1">Nouvelles</div>
        </Card>
        <Card className="p-3 text-center">
          <div className="text-2xl font-bold text-amber-600">{counts.reviewing}</div>
          <div className="text-[10px] text-muted-foreground mt-1">En revue</div>
        </Card>
        <Card className="p-3 text-center">
          <div className="text-2xl font-bold text-emerald-600">{counts.accepted}</div>
          <div className="text-[10px] text-muted-foreground mt-1">Acceptées</div>
        </Card>
        <Card className="p-3 text-center">
          <div className="text-2xl font-bold text-muted-foreground">{counts.rejected}</div>
          <div className="text-[10px] text-muted-foreground mt-1">Refusées</div>
        </Card>
      </div>

      {/* Bloc 4 — Tableau */}
      <Card className="overflow-hidden mb-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Candidat</TableHead>
              <TableHead>Secteur</TableHead>
              <TableHead>Ticket</TableHead>
              <TableHead>Reçue</TableHead>
              <TableHead className="text-center">Éligibilité</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {candLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></TableCell></TableRow>
            ) : candidatures.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground italic py-8">
                  Aucune candidature reçue pour le moment.
                </TableCell>
              </TableRow>
            ) : candidatures.map(c => {
              const converted = convertedIds.has(c.id);
              return (
                <TableRow
                  key={c.id}
                  onClick={() => setOpenId(c.id)}
                  className="cursor-pointer hover:bg-muted/30"
                >
                  <TableCell>
                    <div className="font-semibold text-sm">{c.company_name}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {c.contact_name || '—'}{c.country && ` · ${c.country}`}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{c.sector || '—'}</TableCell>
                  <TableCell className="text-sm font-semibold text-violet-600">{c.ticket || '—'}</TableCell>
                  <TableCell className="text-[11px] text-muted-foreground">
                    {new Date(c.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                  </TableCell>
                  <TableCell className="text-center">
                    <EligibilityBadge level={computeEligibility(c.form_data).level} />
                  </TableCell>
                  <TableCell className="space-x-1">
                    <StatusTag s={c.status} />
                    {converted && <Badge variant="outline" className="text-[10px] bg-blue-100 text-blue-700 border-blue-200">Convertie</Badge>}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-1 justify-end" onClick={e => e.stopPropagation()}>
                      {c.status === 'new' && (
                        <Button size="sm" variant="outline" className="h-7" onClick={() => changeCandStatus(c, 'reviewing')}>
                          Examiner
                        </Button>
                      )}
                      {c.status === 'reviewing' && (
                        <>
                          <Button size="sm" variant="outline" className="h-7 px-2 text-emerald-600 border-emerald-300"
                            onClick={() => changeCandStatus(c, 'accepted')}>
                            <Check className="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 px-2 text-destructive border-destructive/30"
                            onClick={() => changeCandStatus(c, 'rejected')}>
                            <X className="h-3 w-3" />
                          </Button>
                        </>
                      )}
                      {c.status === 'accepted' && !converted && (
                        <Button size="sm" className="h-7 gap-1" onClick={() => setOpenId(c.id)}>
                          <ArrowRight className="h-3 w-3" /> Mandat
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      {/* Bloc 5 — Modale détail */}
      {currentOrg && user && (
        <CandidatureDetailDialog
          open={openId !== null}
          onOpenChange={(v) => { if (!v) setOpenId(null); }}
          candidature={openCandidature}
          organizationId={currentOrg.id}
          currentUserId={user.id}
          alreadyConverted={openCandidature ? convertedIds.has(openCandidature.id) : false}
          onChanged={reloadCands}
        />
      )}

      {/* Dialog création nouvel appel */}
      {currentOrg && (
        <CreateAppelDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          organizationId={currentOrg.id}
          onCreated={(id) => { reloadProgrammes(); selectAppel(id); }}
        />
      )}
    </>
  );
}
