import { useState } from 'react';
import LanguageToggle from "@/components/LanguageToggle";
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, GraduationCap, Building2 } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

const COUNTRIES = [
  'Sénégal', "Côte d'Ivoire", 'Burkina Faso', 'Mali', 'Bénin', 'Togo',
  'Niger', 'Cameroun', 'RD Congo', 'Congo', 'Gabon', 'Guinée', 'Guinée-Bissau',
  'Maroc', 'Algérie', 'Tunisie', 'Madagascar', 'Rwanda', 'Éthiopie',
  'Kenya', 'Nigeria', 'Ghana', 'Tanzanie', 'Ouganda', 'Afrique du Sud', 'Mozambique',
  'France', 'Belgique', 'Suisse', 'Luxembourg', 'Canada',
  'Allemagne', 'Pays-Bas', 'Royaume-Uni', 'Espagne', 'Portugal', 'Italie',
];

export default function Register() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const initialRole = (searchParams.get('role') === 'entrepreneur' ? 'entrepreneur' : 'coach') as AppRole;
  const redirectTo = searchParams.get('redirect') || '';
  const prefilledEmail = searchParams.get('email') || '';
  const isInvitation = redirectTo.startsWith('/invitation/');

  const [selectedRole, setSelectedRole] = useState<AppRole>(initialRole);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState(prefilledEmail);
  const [password, setPassword] = useState('');
  const [country, setCountry] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);


  const { signUp, setRole } = useAuth();
  const navigate = useNavigate();

  const roleLabel = selectedRole === 'coach' ? t('auth.role_coach') : t('auth.role_entrepreneur');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accepted) {
      toast.error(t('auth.accept_terms_error'));
      return;
    }
    // S4: Password policy — min 12 chars, at least 1 uppercase, 1 lowercase, 1 number
    if (password.length < 12) {
      toast.error('Le mot de passe doit contenir au moins 12 caractères');
      return;
    }
    if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
      toast.error('Le mot de passe doit contenir au moins 1 majuscule, 1 minuscule et 1 chiffre');
      return;
    }
    setIsLoading(true);
    try {
      await signUp(email, password, fullName, isInvitation ? 'entrepreneur' : selectedRole);
      // Pour les invitations, le rôle sera défini par accept-invitation (organization_members)
      // Pour les inscriptions classiques, on crée le user_roles
      if (!isInvitation) {
        await setRole(selectedRole);
      }
      toast.success(t('auth.account_created'));
      navigate(redirectTo || '/dashboard');
    } catch (err: any) {
      toast.error(err.message || t('auth.register_error'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8 relative">
      <LanguageToggle className="absolute top-4 right-4" />
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="flex flex-col items-center mb-6">
          <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center mb-4">
            <span className="text-lg font-display font-bold text-primary-foreground">ES</span>
          </div>
          <h1 className="text-2xl font-display font-bold text-foreground">
            {isInvitation ? 'Créer votre compte' : t('auth.create_account_title', { role: roleLabel })}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isInvitation
              ? 'Créez votre compte pour accepter l\'invitation'
              : selectedRole === 'entrepreneur'
                ? t('auth.register_subtitle_entrepreneur')
                : t('auth.register_subtitle_coach')}
          </p>
        </div>

        {!isInvitation && (
        <div className="flex mb-6 bg-muted rounded-lg p-1">
          <button
            type="button"
            onClick={() => setSelectedRole('coach')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-medium transition-all ${selectedRole === 'coach' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <GraduationCap className="h-4 w-4" />
            {t('auth.role_coach')}
          </button>
          <button
            type="button"
            onClick={() => setSelectedRole('entrepreneur')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-medium transition-all ${selectedRole === 'entrepreneur' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <Building2 className="h-4 w-4" />
            {t('auth.role_entrepreneur')}
          </button>
        </div>
        )}

        {/* Form card */}
        <div className="bg-card rounded-xl border p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">
                {t('auth.full_name')} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Awa Traoré"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">
                {t('auth.email')} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="awa@startup.com"
                required
                readOnly={!!prefilledEmail}
                className={prefilledEmail ? 'bg-muted' : ''}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="password">
                {t('auth.password')} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                minLength={6}
                required
              />
              <p className="text-xs text-muted-foreground">{t('auth.min_chars')}</p>
            </div>

            {!isInvitation && (
            <div className="space-y-2">
              <Label>
                {t('auth.country')} <span className="text-destructive">*</span>
              </Label>
              <Select value={country} onValueChange={setCountry}>
                <SelectTrigger>
                  <SelectValue placeholder={t('auth.select_country')} />
                </SelectTrigger>
                <SelectContent>
                  {COUNTRIES.map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            )}

            <div className="flex items-start gap-2 pt-2">
              <Checkbox
                id="terms"
                checked={accepted}
                onCheckedChange={(v) => setAccepted(v === true)}
              />
              <label htmlFor="terms" className="text-xs text-muted-foreground leading-relaxed cursor-pointer">
                {t('auth.accept_terms')}
              </label>
            </div>

            <button
              type="submit"
              disabled={isLoading || !accepted || (!isInvitation && !country)}
              className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('auth.creating_account')}
                </>
              ) : isInvitation ? (
                'Créer mon compte'
              ) : (
                t('auth.create_account_btn', { role: roleLabel })
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-muted-foreground mt-6">
          {t('auth.already_registered')}{' '}
          <Link to="/login" className="text-primary hover:underline font-medium">
            {t('auth.sign_in')}
        </Link>
        </p>

      </div>
    </div>
  );
}
