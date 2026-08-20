-- RETOUR ARRIÈRE de 20260820091000_fix_profiles_chef_coach_global_read.sql
-- ⚠️ Recrée la lecture GLOBALE des profils par tout chef/coach → RÉTABLIT la fuite PII.

create policy "Chef programme can view coach profiles" on public.profiles
  for select
  using (has_role(auth.uid(), 'chef_programme'::app_role) or has_role(auth.uid(), 'coach'::app_role));
