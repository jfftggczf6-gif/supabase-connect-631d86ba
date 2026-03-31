import { useState, useEffect } from 'react';
import LanguageToggle from "@/components/LanguageToggle";
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

export default function ResetPassword() {
  const { t } = useTranslation();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if we have a recovery token in the URL hash
    const hash = window.location.hash;
    if (hash.includes('type=recovery') || hash.includes('access_token')) {
      setReady(true);
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setReady(true);
    });

    // Also check current session — user might already be in recovery state
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) { toast.error(t('auth.passwords_mismatch')); return; }
    if (password.length < 6) { toast.error(t('auth.min_chars')); return; }
    setIsLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) { toast.error(error.message); setIsLoading(false); return; }
    toast.success(t('auth.password_updated'));
    navigate('/dashboard');
  };

  if (!ready) return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
        <p className="text-sm text-muted-foreground">{t('auth.checking_link')}</p>
        <p className="text-xs text-muted-foreground mt-4">
          {t('auth.link_expired_hint')}
        </p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 relative">
      <LanguageToggle className="absolute top-4 right-4" />
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center mb-4">
            <span className="text-lg font-display font-bold text-primary-foreground">ES</span>
          </div>
          <h1 className="text-2xl font-display font-bold text-foreground">{t('auth.new_password')}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t('auth.new_password_subtitle')}</p>
        </div>
        <div className="bg-card rounded-xl border p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">{t('auth.new_password')}</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required minLength={6} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">{t('auth.confirm_password')}</Label>
              <Input id="confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="••••••••" required minLength={6} />
            </div>
            <button type="submit" disabled={isLoading} className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2">
              {isLoading ? <><Loader2 className="h-4 w-4 animate-spin" />{t('auth.updating')}</> : t('auth.update_password')}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
