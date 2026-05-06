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

export default function AddEntrepreneurAdminPage() {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [orgsLoading, setOrgsLoading] = useState(true);
  const [coaches, setCoaches] = useState<CoachOpt[]>([]);
  const [coachesLoading, setCoachesLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [orgId, setOrgId] = useState('');
  const [coachUserId, setCoachUserId] = useState('none');
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
    if (!orgId || !name.trim() || !country) {
      toast.error('Organisation, nom et pays requis');
      return;
    }
    if (sendInvitation && !email.trim()) {
      toast.error('Email requis pour envoyer l\'invitation');
      return;
    }
    setSubmitting(true);

    try {
      // 1. Crée l'enterprise
      const { data: { user } } = await supabase.auth.getUser();
      const { data: ent, error } = await supabase
        .from('enterprises' as any)
        .insert({
          name: name.trim(),
          sector: sector || null,
          country,
          contact_email: email.trim() || null,
          contact_name: name.trim(),
          organization_id: orgId,
          user_id: null, // sera updaté par accept-invitation
          phase: 'identite',
        })
        .select('id, name')
        .single();
      if (error) throw error;
      const inserted = ent as any;

      // 2. Lien coach (si choisi) — enterprise_coaches
      if (coachUserId !== 'none') {
        const { error: ecErr } = await supabase
          .from('enterprise_coaches' as any)
          .insert({
            enterprise_id: inserted.id,
            coach_id: coachUserId,
            organization_id: orgId,
            role: 'principal',
            assigned_by: user?.id || null,
            is_active: true,
          });
        if (ecErr) {
          toast.warning(`Entreprise créée mais coach non assigné : ${ecErr.message}`);
        }
      }

      // 3. Invitation entrepreneur (si toggle ON)
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
            enterprise_id: inserted.id,
            full_name: name.trim(),
          }),
        });
        const result = await resp.json();
        if (!resp.ok) {
          toast.warning(`Entreprise créée mais invitation non envoyée : ${result.error}`);
        } else if (result.email_sent === false && result.invitation_url) {
          try { await navigator.clipboard.writeText(result.invitation_url); } catch { /* ignore */ }
          toast.warning(`Invitation créée mais email non envoyé. Lien copié — transmets-le à ${email}.`, { duration: 12000 });
        } else {
          toast.success(`✅ Entreprise "${inserted.name}" créée + 📧 invitation envoyée à ${email}`);
        }
      } else {
        toast.success(`✅ Entreprise "${inserted.name}" créée (sans invitation)`);
      }

      // Reset
      setName(''); setEmail(''); setCountry(''); setSector('');
      setCoachUserId('none');
      setSendInvitation(true);
    } catch (e: any) {
      toast.error(e.message || 'Erreur création entrepreneur');
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
            <p className="font-medium">À utiliser pour créer un entrepreneur de A à Z</p>
            <p className="text-xs mt-1">
              L'entreprise est créée, liée à un coach (si tu en choisis un) et l'entrepreneur reçoit
              un email avec un lien pour finir son inscription. À l'acceptation, il est automatiquement
              redirigé vers son dashboard et lié à son organisation.
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

          {/* Infos entreprise */}
          <div className="space-y-1">
            <Label className="text-xs">Nom de l'entreprise *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="SARL Mon Entreprise" />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Email entrepreneur {sendInvitation && '*'}</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="contact@entreprise.com" />
          </div>

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
            disabled={submitting || !orgId || !name.trim() || !country || (sendInvitation && !email.trim())}
            className="w-full gap-2 bg-violet-600 hover:bg-violet-700"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : (sendInvitation ? <Send className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />)}
            {submitting ? 'Création...' : (sendInvitation ? 'Créer et envoyer l\'invitation' : 'Créer l\'entrepreneur')}
          </Button>
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
