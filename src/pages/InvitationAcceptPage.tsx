import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Building2, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { getValidAccessToken } from '@/lib/getValidAccessToken';
import { useOrganization } from '@/contexts/OrganizationContext';

interface InvitationDetails {
  organization_name: string;
  organization_logo: string | null;
  role: string;
  role_label: string;
  inviter_name: string;
  email: string;
  expires_at: string;
}

export default function InvitationAcceptPage() {
  const { token } = useParams<{ token: string }>();
  const { user, session } = useAuth();
  const { refreshOrganizations, switchOrganization } = useOrganization();
  const navigate = useNavigate();
  const [details, setDetails] = useState<InvitationDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);

  const baseUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

  useEffect(() => {
    if (!token) return;
    fetch(`${baseUrl}/get-invitation-details`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.error) setError(data.error);
        else setDetails(data);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  const handleAccept = async () => {
    if (!token) return;
    setAccepting(true);
    try {
      const accessToken = await getValidAccessToken(null);
      const resp = await fetch(`${baseUrl}/accept-invitation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
        body: JSON.stringify({ token }),
      });
      const result = await resp.json();
      if (!resp.ok) throw new Error(result.error || result.message);

      // Force la sélection de la nouvelle org AVANT le refresh (le refresh lira ce localStorage)
      if (result.organization_id) {
        try { localStorage.setItem('esono_current_org_id', result.organization_id); } catch {}
      }

      setAccepted(true);
      toast.success(`Bienvenue dans ${details?.organization_name} !`);

      // Rafraîchir le contexte org (lira localStorage et activera la bonne org)
      await refreshOrganizations();
      if (result.organization_id) switchOrganization(result.organization_id);

      // Redirection selon le rôle (évite le passage par /dashboard qui peut servir l'EntrepreneurDashboard par fallback)
      const role = (result.role || details?.role || '').toLowerCase();
      const targetPath =
        role === 'owner' || role === 'admin' || role === 'manager' ? '/programmes' :
        role === 'entrepreneur' ? '/dashboard' :
        '/dashboard'; // coach/analyst → CoachDashboard rendu par /dashboard

      setTimeout(() => navigate(targetPath), 1500);
    } catch (err: any) {
      toast.error(err.message);
    }
    setAccepting(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center space-y-4">
            <XCircle className="h-12 w-12 text-destructive mx-auto" />
            <h2 className="text-xl font-bold">Invitation invalide</h2>
            <p className="text-muted-foreground text-sm">{error}</p>
            <Link to="/login"><Button variant="outline">Se connecter</Button></Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (accepted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center space-y-4">
            <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto" />
            <h2 className="text-xl font-bold">Bienvenue !</h2>
            <p className="text-muted-foreground">Vous avez rejoint <strong>{details?.organization_name}</strong></p>
            <p className="text-sm text-muted-foreground">Redirection en cours...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="max-w-md w-full">
        <CardContent className="p-8 space-y-6">
          <div className="text-center space-y-3">
            {details?.organization_logo ? (
              <img src={details.organization_logo} alt="" className="h-12 mx-auto rounded-lg" />
            ) : (
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mx-auto">
                <Building2 className="h-6 w-6 text-primary" />
              </div>
            )}
            <h2 className="text-xl font-bold">Rejoindre {details?.organization_name}</h2>
            <p className="text-sm text-muted-foreground">
              {details?.inviter_name} vous invite en tant que <Badge variant="secondary">{details?.role_label}</Badge>
            </p>
          </div>

          {!user ? (
            <div className="space-y-3">
              <p className="text-sm text-center text-muted-foreground">Connectez-vous ou créez un compte pour accepter l'invitation.</p>
              <div className="grid grid-cols-2 gap-2">
                <Link to={`/login?redirect=/invitation/${token}`}>
                  <Button variant="outline" className="w-full">Se connecter</Button>
                </Link>
                <Link to={`/register?email=${encodeURIComponent(details?.email || '')}&redirect=/invitation/${token}`}>
                  <Button className="w-full">Créer un compte</Button>
                </Link>
              </div>
            </div>
          ) : user.email?.toLowerCase() !== details?.email.toLowerCase() ? (
            <div className="space-y-3 text-center">
              <p className="text-sm text-amber-600">
                Cette invitation est pour <strong>{details?.email}</strong>, mais vous êtes connecté avec <strong>{user.email}</strong>.
              </p>
              <Button variant="outline" onClick={() => navigate('/login')}>Se déconnecter et se reconnecter</Button>
            </div>
          ) : (
            <Button className="w-full" onClick={handleAccept} disabled={accepting}>
              {accepting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Accepter l'invitation
            </Button>
          )}

          <p className="text-[10px] text-center text-muted-foreground">
            Expire le {details?.expires_at ? new Date(details.expires_at).toLocaleDateString('fr-FR') : '—'}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
