-- RETOUR ARRIÈRE de 20260820090000_fix_chef_candidatures_scope.sql
-- ⚠️ Restaure l'état GLOBAL d'origine → RÉTABLIT la fuite inter-org. À n'utiliser
-- que si le scope casse un accès légitime, le temps de corriger chef_programme_id.

drop policy if exists chef_candidatures_select on public.candidatures;
create policy chef_candidatures_select on public.candidatures
  for select using (has_role(auth.uid(), 'chef_programme'::app_role));

drop policy if exists chef_candidatures_update on public.candidatures;
create policy chef_candidatures_update on public.candidatures
  for update using (has_role(auth.uid(), 'chef_programme'::app_role));
