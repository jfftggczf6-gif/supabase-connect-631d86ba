import { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, GraduationCap } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

const COUNTRIES = [
  'Sénégal', "Côte d'Ivoire", 'Burkina Faso', 'Mali', 'Bénin', 'Togo',
  'Niger', 'Cameroun', 'RD Congo', 'Maroc', 'Algérie', 'Tunisie',
  'Kenya', 'Nigeria', 'Ghana', 'Rwanda',
];

export default function Register() {
  const [_searchParams] = useSearchParams();
  const initialRole = 'coach' as AppRole;

  const [selectedRole] = useState<AppRole>(initialRole);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [country, setCountry] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  

  const { signUp } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accepted) {
      toast.error("Veuillez accepter les conditions d'utilisation");
      return;
    }
    setIsLoading(true);
    try {
      await signUp(email, password, fullName, selectedRole);
      toast.success('Compte créé avec succès !');
      navigate('/dashboard');
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de l'inscription");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="flex flex-col items-center mb-6">
          <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center mb-4">
            <span className="text-lg font-display font-bold text-primary-foreground">ES</span>
          </div>
          <h1 className="text-2xl font-display font-bold text-foreground">
            Créer votre compte {selectedRole === 'coach' ? 'Coach' : 'Entrepreneur'}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {selectedRole === 'entrepreneur'
              ? 'Structurez votre projet et générez vos livrables investisseurs.'
              : 'Accompagnez vos entrepreneurs et suivez leur progression.'}
          </p>
        </div>

        {/* Role fixed to coach for pilot */}
        <div className="flex mb-6 bg-muted rounded-lg p-1">
          <div className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-medium bg-primary text-primary-foreground shadow-sm">
            <GraduationCap className="h-4 w-4" />
            Coach
          </div>
        </div>

        {/* Form card */}
        <div className="bg-card rounded-xl border p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">
                Nom complet <span className="text-destructive">*</span>
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
                Email <span className="text-destructive">*</span>
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="awa@startup.com"
                required
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="password">
                Mot de passe <span className="text-destructive">*</span>
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
              <p className="text-xs text-muted-foreground">Minimum 6 caractères</p>
            </div>

            <div className="space-y-2">
              <Label>
                Pays <span className="text-destructive">*</span>
              </Label>
              <Select value={country} onValueChange={setCountry}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un pays" />
                </SelectTrigger>
                <SelectContent>
                  {COUNTRIES.map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-start gap-2 pt-2">
              <Checkbox
                id="terms"
                checked={accepted}
                onCheckedChange={(v) => setAccepted(v === true)}
              />
              <label htmlFor="terms" className="text-xs text-muted-foreground leading-relaxed cursor-pointer">
                J'accepte les conditions d'utilisation et la politique de confidentialité.
              </label>
            </div>

            <button
              type="submit"
              disabled={isLoading || !accepted || !country}
              className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Création en cours...
                </>
              ) : (
                `Créer mon compte ${selectedRole === 'coach' ? 'Coach' : 'Entrepreneur'}`
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-muted-foreground mt-6">
          Déjà inscrit ?{' '}
          <Link to="/login" className="text-primary hover:underline font-medium">
            Se connecter
        </Link>
        </p>
        
      </div>
    </div>
  );
}
