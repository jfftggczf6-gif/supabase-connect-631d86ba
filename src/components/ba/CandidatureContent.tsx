// src/components/ba/CandidatureContent.tsx
// Contenu pur de l'onglet Candidature BA (sans DashboardLayout).
// Assemble les 4 blocs principaux : Diffusion · KPIs · Tableau · Modale.
// Form Builder en sous-page si view='builder'.
//
// État vide : "aucun appel" + bouton "Créer l'appel" qui appelle manage-programme
// action='create' avec type='banque_affaires' + 10 champs par défaut.
import { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Settings, Copy, Pause, Play, Loader2, ArrowRight, Check, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useAuth } from '@/hooks/useAuth';
import { useBaProgramme } from '@/hooks/useBaProgramme';
import { useBaCandidatures } from '@/hooks/useBaCandidatures';
import CandidatureFormBuilder from './CandidatureFormBuilder';
import CandidatureDetailDialog from './CandidatureDetailDialog';
import {
  DEFAULT_FORM_FIELDS, STATUS_LABEL, UI_TO_DB_STATUS,
  type CandidatureRow, type CandidatureStatus,
} from '@/types/candidature-ba';

function ScoreBadge({ score }: { score: number | null }) {
  if (score == null) return <span className="text-xs text-muted-foreground">—</span>;
  const cls =
    score >= 80 ? 'bg-emerald-100 text-emerald-700'
    : score >= 60 ? 'bg-amber-100 text-amber-700'
    : 'bg-rose-100 text-rose-700';
  return <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${cls}`}>{score}</span>;
}

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
  const { programme, loading: progLoading, reload: reloadProgramme } = useBaProgramme(currentOrg?.id);
  const {
    candidatures, counts, convertedIds, loading: candLoading, reload: reloadCands,
  } = useBaCandidatures(programme?.id, currentOrg?.id);

  const [view, setView] = useState<'list' | 'builder'>('list');
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
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

  const handleCreateProgramme = async () => {
    if (!currentOrg) return;
    setCreating(true);
    const { data, error } = await supabase.functions.invoke('manage-programme', {
      body: {
        action: 'create',
        organization_id: currentOrg.id,
        name: 'Appel à candidatures BA',
        description: 'Vous êtes une PME africaine en croissance recherchant un financement ? Candidatez à notre appel.',
        type: 'banque_affaires',
        form_fields: DEFAULT_FORM_FIELDS,
        status: 'in_progress',
      },
    });
    setCreating(false);
    if (error || (data as any)?.error) {
      let real: string | null = (data as any)?.error || null;
      if (!real && error) {
        const ctx = (error as any)?.context;
        if (ctx?.json) { try { real = (await ctx.json())?.error ?? null; } catch {} }
        if (!real) real = error.message;
      }
      toast.error(real || 'Création échouée');
      return;
    }
    toast.success("Appel à candidatures créé");
    reloadProgramme();
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
    reloadProgramme();
  };

  if (progLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  // ─── État vide : aucun programme BA ────────────────────────────
  if (!programme) {
    return (
      <Card className="p-12 text-center">
        <h3 className="text-base font-semibold mb-2">Aucun appel à candidatures</h3>
        <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
          Créez votre premier appel pour commencer à recevoir des candidatures.
          Un formulaire avec 10 champs par défaut sera initialisé — tu pourras le personnaliser ensuite.
        </p>
        <Button onClick={handleCreateProgramme} disabled={creating}>
          {creating ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Création…</> : "Créer l'appel"}
        </Button>
      </Card>
    );
  }

  // ─── Form builder en sous-page ─────────────────────────────────
  if (view === 'builder') {
    return (
      <CandidatureFormBuilder
        programme={programme}
        onBack={() => setView('list')}
        onSaved={() => { reloadProgramme(); setView('list'); }}
      />
    );
  }

  // ─── Vue liste ─────────────────────────────────────────────────
  return (
    <>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
        <div className="text-sm text-muted-foreground">
          Gérez l'appel à candidatures, sa diffusion et les réponses reçues.
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
              <TableHead className="text-center">Score IA</TableHead>
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
                  <TableCell className="text-center"><ScoreBadge score={c.screening_score} /></TableCell>
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
    </>
  );
}
