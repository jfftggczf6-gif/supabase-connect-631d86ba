// AddEntrepreneurAdminPage — page super_admin pour ajouter un entrepreneur à
// n'importe quelle organisation, avec assignation coach optionnelle et envoi
// d'invitation email automatique.
//
// Workflow :
//   1. Choisir une organisation cible (dropdown des orgs actives)
//   2. Choisir un coach (optionnel — dropdown filtré par org)
//   3. Saisir nom, email, pays, secteur de l'entreprise
//   4. Cocher "Envoyer invit" si on veut que l'entrepreneur reçoive le mail direct
//   5. Submit → crée enterprise + lie au coach + (optionnel) appelle send-invitation
//
// L'edge fn accept-invitation gère la liaison user_id ↔ enterprise + organization_members
// + user_roles → l'entrepreneur arrive sur SON panel personnel directement.
import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, UserPlus, Send, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const SUPPORTED_COUNTRIES = [
  'Bénin', 'Burkina Faso', 'Cameroun', 'Côte d\'Ivoire', 'Gabon', 'Guinée',
  'Mali', 'Mauritanie', 'Niger', 'République Démocratique du Congo',
  'République du Congo', 'Sénégal', 'Tchad', 'Togo',
];

const SECTORS = [
  'Agro-alimentaire', 'Agro-transformation', 'Agriculture', 'Élevage',
  'Pêche & aquaculture', 'Industrie manufacturière', 'BTP & construction',
  'Services B2B', 'Services B2C', 'Commerce & distribution',
  'Tech / numérique', 'Fintech', 'Santé', 'Éducation', 'Énergie',
  'Logistique & transport', 'Tourisme & hôtellerie', 'Mode & textile',
  'Cosmétique', 'Médias & culture', 'Autre',
];

interface Org { id: string; name: string; type: string; }
interface CoachOpt { user_id: string; full_name: string; }
interface EntOpt { id: string; name: string; contact_email: string | null; country: string | null; sector: string | null; user_id: string | null; }
interface ProgOpt { id: string; name: string; }

type Mode = 'new' | 'existing';

export default function AddEntrepreneurAdminPage() {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [orgsLoading, setOrgsLoading] = useState(true);
  const [coaches, setCoaches] = useState<CoachOpt[]>([]);
  const [coachesLoading, setCoachesLoading] = useState(false);
  const [enterprises, setEnterprises] = useState<EntOpt[]>([]);
  const [programmes, setProgrammes] = useState<ProgOpt[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const [mode, setMode] = useState<Mode>('new');
  const [orgId, setOrgId] = useState('');
  const [coachUserId, setCoachUserId] = useState('none');
  const [existingEntId, setExistingEntId] = useState('');
  const [programmeId, setProgrammeId] = useState('none');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [country, setCountry] = useState('');
  const [sector, setSector] = useState('');
  const [sendInvitation, setSendInvitation] = useState(true);

  // Charge les orgs actives
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('organizations')
        .select('id, name, type')
        .eq('is_active', true)
        .order('name');
      setOrgs((data || []) as any);
      setOrgsLoading(false);
    })();
  }, []);

  // Charge entreprises + programmes de l'org sélectionnée (en parallèle avec les coaches).
  useEffect(() => {
    if (!orgId) { setEnterprises([]); setProgrammes([]); setExistingEntId(''); setProgrammeId('none'); return; }
    (async () => {
      const [{ data: ents }, { data: progs }] = await Promise.all([
        supabase
          .from('enterprises')
          .select('id, name, contact_email, country, sector, user_id')
          .eq('organization_id', orgId)
          .order('name'),
        supabase
          .from('programmes')
          .select('id, name')
          .eq('organization_id', orgId)
          .order('name'),
      ]);
      setEnterprises((ents || []) as any);
      setProgrammes((progs || []) as any);
    })();
  }, [orgId]);

  // Quand on choisit une entreprise existante, on préfill les champs (read-only en mode existing)
  useEffect(() => {
    if (mode !== 'existing' || !existingEntId) return;
    const ent = enterprises.find(e => e.id === existingEntId);
    if (!ent) return;
    setName(ent.name);
    setEmail(ent.contact_email || '');
    setCountry(ent.country || '');
    setSector(ent.sector || '');
  }, [mode, existingEntId, enterprises]);

  // Reset des champs spécifiques au changement de mode
  useEffect(() => {
    setExistingEntId('');
    if (mode === 'new') {
      // mode "new" : on vide pour ne pas garder les valeurs de l'ancien enterprise
      setName(''); setEmail(''); setCountry(''); setSector('');
    }
  }, [mode]);

  // Charge les coaches de l'org sélectionnée
  useEffect(() => {
    if (!orgId) { setCoaches([]); setCoachUserId('none'); return; }
    setCoachesLoading(true);
    (async () => {
      const { data: members } = await supabase
        .from('organization_members')
        .select('user_id, role')
        .eq('organization_id', orgId)
        .eq('is_active', true)
        .in('role', ['coach', 'manager', 'analyst']);
      const userIds = (members || []).map((m: any) => m.user_id);
      if (userIds.length === 0) { setCoaches([]); setCoachesLoading(false); return; }
      const { data: profs } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', userIds);
      setCoaches(((profs || []) as any[]).map(p => ({
        user_id: p.user_id,
        full_name: p.full_name || p.user_id.slice(0, 8),
      })));
      setCoachesLoading(false);
      setCoachUserId('none');
    })();
  }, [orgId]);

  const handleSubmit = async () => {
    if (!orgId) {
      toast.error('Organisation requise');
      return;
    }
    if (mode === 'new' && (!name.trim() || !country)) {
      toast.error('Nom et pays requis pour une nouvelle entreprise');
      return;
    }
    if (mode === 'existing' && !existingEntId) {
      toast.error('Choisis une entreprise existante');
      return;
    }
    if (sendInvitation && !email.trim()) {
      toast.error("Email requis pour envoyer l'invitation");
      return;
    }
    setSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      let entId: string;
      let entName: string;

      if (mode === 'existing') {
        // Réutiliser l'entreprise sélectionnée
        const ent = enterprises.find(e => e.id === existingEntId);
        if (!ent) throw new Error('Entreprise introuvable');
        entId = ent.id;
        entName = ent.name;

        // Patcher contact_email si vide et qu'on en a un + envoi d'invit
        if (!ent.contact_email && email.trim()) {
          await supabase
            .from('enterprises' as any)
            .update({ contact_email: email.trim() })
            .eq('id', entId);
        }
      } else {
        // Crée une nouvelle entreprise — user_id = admin courant (propriétaire
        // temporaire, sera updaté par accept-invitation à l'acceptation du lien).
        const { data: ent, error } = await supabase
          .from('enterprises' as any)
          .insert({
            name: name.trim(),
            sector: sector || null,
            country,
            contact_email: email.trim() || null,
            contact_name: name.trim(),
            organization_id: orgId,
            user_id: user?.id || null,
            phase: 'identite',
          })
          .select('id, name')
          .single();
        if (error) throw error;
        entId = (ent as any).id;
        entName = (ent as any).name;
      }

      // 2. Lien coach (si choisi) — enterprise_coaches (idempotent : si déjà lié, on skip)
      if (coachUserId !== 'none') {
        const { data: existingLink } = await supabase
          .from('enterprise_coaches' as any)
          .select('id')
          .eq('enterprise_id', entId)
          .eq('coach_id', coachUserId)
          .eq('is_active', true)
          .maybeSingle();
        if (!existingLink) {
          const { error: ecErr } = await supabase
            .from('enterprise_coaches' as any)
            .insert({
              enterprise_id: entId,
              coach_id: coachUserId,
              organization_id: orgId,
              role: 'principal',
              assigned_by: user?.id || null,
              is_active: true,
            });
          if (ecErr) {
            toast.warning(`Action effectuée mais coach non assigné : ${ecErr.message}`);
          }
        }
      }

      // 3. Liaison programme (si choisi) — crée une candidature status='selected'
      //    qui fait apparaître l'entreprise dans la fiche du programme.
      if (programmeId !== 'none') {
        const { data: existingCand } = await supabase
          .from('candidatures' as any)
          .select('id, status')
          .eq('enterprise_id', entId)
          .eq('programme_id', programmeId)
          .maybeSingle();
        if (!existingCand) {
          const { error: candErr } = await supabase
            .from('candidatures' as any)
            .insert({
              programme_id: programmeId,
              enterprise_id: entId,
              organization_id: orgId,
              status: 'selected',
              company_name: entName,
              contact_email: email.trim() || null,
              contact_name: name.trim() || entName,
              assigned_coach_id: coachUserId !== 'none' ? coachUserId : null,
            });
          if (candErr) {
            toast.warning(`Action effectuée mais programme non lié : ${candErr.message}`);
          }
        }
      }

      // 4. Invitation entrepreneur (si toggle ON)
      if (sendInvitation && email.trim()) {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (!token) throw new Error('Non authentifié');
        const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-invitation`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({
            email: email.trim(),
            role: 'entrepreneur',
            organization_id: orgId,
            enterprise_id: entId,
            full_name: name.trim(),
          }),
        });
        const result = await resp.json();
        if (!resp.ok) {
          toast.warning(`Action effectuée mais invitation non envoyée : ${result.error}`);
        } else if (result.email_sent === false && result.invitation_url) {
          try { await navigator.clipboard.writeText(result.invitation_url); } catch { /* ignore */ }
          toast.warning(`Invitation créée mais email non envoyé. Lien copié — transmets-le à ${email}.`, { duration: 12000 });
        } else {
          toast.success(`✅ "${entName}" — 📧 invitation envoyée à ${email}`);
        }
      } else {
        toast.success(`✅ "${entName}" — action effectuée (sans invitation)`);
      }

      // Reset
      setName(''); setEmail(''); setCountry(''); setSector('');
      setCoachUserId('none'); setExistingEntId(''); setProgrammeId('none');
      setSendInvitation(true);
      setMode('new');
    } catch (e: any) {
      toast.error(e.message || 'Erreur action entrepreneur');
    } finally {
      setSubmitting(false);
    }
  };

  if (orgsLoading) {
    return (
      <DashboardLayout title="Ajouter un entrepreneur">
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Ajouter un entrepreneur"
      subtitle="Super admin — crée un dossier entrepreneur dans n'importe quelle organisation et envoie l'invitation par email"
    >
      <Card className="max-w-2xl border-amber-200 bg-amber-50 mb-4">
        <CardContent className="py-3 flex items-start gap-3 text-sm">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-amber-900">
            <p className="font-medium">Créer ou lier un entrepreneur</p>
            <p className="text-xs mt-1">
              <strong>Nouvelle entreprise</strong> : crée le dossier + lien coach + invitation email.
              <br />
              <strong>Entreprise existante</strong> : envoie l'invitation à une entreprise déjà créée
              (ex : sortie de candidature ou créée à la main). Aucun doublon.
              <br />
              Tu peux aussi associer l'entreprise à un programme (création d'une candidature
              "Sélectionnée" automatique).
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="max-w-2xl">
        <CardContent className="p-6 space-y-4">
          {/* Org cible */}
          <div className="space-y-1">
            <Label className="text-xs">Organisation cible *</Label>
            <Select value={orgId} onValueChange={setOrgId}>
              <SelectTrigger><SelectValue placeholder="Choisir une organisation" /></SelectTrigger>
              <SelectContent>
                {orgs.map(o => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.name} <span className="text-muted-foreground text-xs">({o.type})</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Mode : nouvelle ou existante */}
          {orgId && (
            <div className="space-y-1">
              <Label className="text-xs">Mode *</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setMode('new')}
                  className={`text-sm py-2 px-3 rounded-lg border transition-colors ${mode === 'new' ? 'bg-primary text-primary-foreground border-primary' : 'bg-card hover:bg-muted border-border'}`}
                >
                  🆕 Nouvelle entreprise
                </button>
                <button
                  type="button"
                  onClick={() => setMode('existing')}
                  className={`text-sm py-2 px-3 rounded-lg border transition-colors ${mode === 'existing' ? 'bg-primary text-primary-foreground border-primary' : 'bg-card hover:bg-muted border-border'}`}
                >
                  🔗 Entreprise existante
                </button>
              </div>
            </div>
          )}

          {/* Sélection entreprise existante (mode existing) */}
          {orgId && mode === 'existing' && (
            <div className="space-y-1">
              <Label className="text-xs">Entreprise existante *</Label>
              <Select value={existingEntId} onValueChange={setExistingEntId}>
                <SelectTrigger><SelectValue placeholder={enterprises.length === 0 ? 'Aucune entreprise dans cette org' : 'Choisir une entreprise'} /></SelectTrigger>
                <SelectContent>
                  {enterprises.map(e => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.name}
                      {e.contact_email && <span className="text-muted-foreground text-xs ml-1">({e.contact_email})</span>}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Coach principal (optionnel) */}
          {orgId && (
            <div className="space-y-1">
              <Label className="text-xs">Coach principal (optionnel)</Label>
              <Select value={coachUserId} onValueChange={setCoachUserId} disabled={coachesLoading}>
                <SelectTrigger>
                  <SelectValue placeholder={coachesLoading ? 'Chargement…' : 'Aucun coach assigné'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucun (à assigner plus tard)</SelectItem>
                  {coaches.map(c => (
                    <SelectItem key={c.user_id} value={c.user_id}>{c.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Mode existing : carte de résumé read-only (la fiche n'est pas modifiée
              par ce form, seul l'email peut être surchargé pour l'invitation). */}
          {mode === 'existing' && existingEntId && (() => {
            const ent = enterprises.find(e => e.id === existingEntId);
            if (!ent) return null;
            return (
              <div className="space-y-1">
                <Label className="text-xs">Fiche entreprise (lecture seule)</Label>
                <div className="rounded-lg border bg-muted/30 px-3 py-2 text-xs space-y-1">
                  <p><span className="text-muted-foreground">Nom :</span> <strong>{ent.name}</strong></p>
                  <p><span className="text-muted-foreground">Pays :</span> {ent.country || '—'}</p>
                  <p><span className="text-muted-foreground">Secteur :</span> {ent.sector || '—'}</p>
                </div>
              </div>
            );
          })()}

          {/* Mode new : champs entreprise éditables */}
          {mode === 'new' && (
            <div className="space-y-1">
              <Label className="text-xs">Nom de l'entreprise *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="SARL Mon Entreprise" />
            </div>
          )}

          {/* Email — toujours visible, éditable. Préfill auto en mode existing si l'enterprise en a un. */}
          <div className="space-y-1">
            <Label className="text-xs">Email entrepreneur {sendInvitation && '*'}</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="contact@entreprise.com" />
            {mode === 'existing' && (
              <p className="text-[11px] text-muted-foreground">
                Tu peux changer l'email destinataire si l'invitation doit aller à une autre adresse.
              </p>
            )}
          </div>

          {/* Pays + Secteur — uniquement en mode new */}
          {mode === 'new' && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Pays *</Label>
                <Select value={country} onValueChange={setCountry}>
                  <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                  <SelectContent>
                    {SUPPORTED_COUNTRIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Secteur</Label>
                <Select value={sector} onValueChange={setSector}>
                  <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                  <SelectContent>
                    {SECTORS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Programme à associer (optionnel) — crée une candidature 'selected' */}
          {orgId && programmes.length > 0 && (
            <div className="space-y-1">
              <Label className="text-xs">Programme à associer (optionnel)</Label>
              <Select value={programmeId} onValueChange={setProgrammeId}>
                <SelectTrigger><SelectValue placeholder="Aucun programme" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucun (pas de programme lié)</SelectItem>
                  {programmes.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                L'entreprise apparaîtra dans la fiche du programme (statut "Sélectionnée").
              </p>
            </div>
          )}

          {/* Toggle envoi invitation */}
          <label className={`flex items-start gap-2 text-sm rounded-lg px-3 py-2 border ${email.trim() ? 'bg-primary/5 border-primary/20 cursor-pointer' : 'bg-muted/30 border-muted-foreground/10 text-muted-foreground cursor-not-allowed'}`}>
            <input
              type="checkbox"
              checked={sendInvitation && !!email.trim()}
              disabled={!email.trim()}
              onChange={(e) => setSendInvitation(e.target.checked)}
              className="mt-0.5 rounded border-border"
            />
            <span className="leading-snug">
              Envoyer un email d'invitation à l'entrepreneur maintenant — il recevra un lien pour
              accéder à son panel et son dossier.
              {!email.trim() && <span className="block text-xs mt-0.5">— Renseigne un email pour activer.</span>}
            </span>
          </label>

          <Button
            onClick={handleSubmit}
            disabled={
              submitting ||
              !orgId ||
              (mode === 'new' && (!name.trim() || !country)) ||
              (mode === 'existing' && !existingEntId) ||
              (sendInvitation && !email.trim())
            }
            className="w-full gap-2 bg-violet-600 hover:bg-violet-700"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : (sendInvitation ? <Send className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />)}
            {submitting
              ? 'En cours...'
              : sendInvitation
                ? (mode === 'existing' ? "Envoyer l'invitation" : "Créer et envoyer l'invitation")
                : (mode === 'existing' ? 'Lier (sans invitation)' : "Créer l'entrepreneur")}
          </Button>
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
