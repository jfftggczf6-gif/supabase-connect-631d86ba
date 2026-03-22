import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

/**
 * Récupère un access token valide en suivant la cascade :
 * 1. Session en mémoire (contexte Auth)
 * 2. getSession() depuis Supabase
 * 3. refreshSession() forcé
 * 4. Retry après 1s (le navigateur throttle au réveil du tab)
 * 5. Redirection vers /login si tout échoue
 */
export async function getValidAccessToken(
  authSession: Session | null,
  navigate?: (path: string) => void,
): Promise<string> {
  if (authSession?.access_token) return authSession.access_token;

  const { data: { session: s } } = await supabase.auth.getSession();
  if (s?.access_token) return s.access_token;

  const { data: { session: refreshed } } = await supabase.auth.refreshSession();
  if (refreshed?.access_token) return refreshed.access_token;

  // Retry après 1s — le navigateur throttle les requests au réveil du tab
  await new Promise(r => setTimeout(r, 1000));
  const { data: { session: retry } } = await supabase.auth.refreshSession();
  if (retry?.access_token) return retry.access_token;

  navigate?.('/login');
  throw new Error('Session expirée — veuillez vous reconnecter');
}