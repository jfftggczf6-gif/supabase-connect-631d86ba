-- Correctif SÉCURITÉ — fuite inter-organisation sur candidatures.
--
-- chef_candidatures_select et chef_candidatures_update étaient GLOBALES
-- (has_role(auth.uid(),'chef_programme') sans borne d'org) : tout chef lisait ET
-- modifiait les candidatures de toutes les organisations (~98 exposées).
-- On scope par PROPRIÉTÉ de programme (programmes.chef_programme_id = auth.uid()),
-- ce qui interdit mécaniquement le cross-org (un chef ne possède que des
-- programmes de son org). Vérifié le 20/08/2026 : aucun accès légitime coupé
-- (chaque chef garde son org via rôle owner/admin/manager + ses programmes possédés).
-- Isolement RLS re-testé après application.

drop policy if exists chef_candidatures_select on public.candidatures;
create policy chef_candidatures_select on public.candidatures
  for select
  using (
    exists (select 1 from public.programmes p
      where p.id = candidatures.programme_id and p.chef_programme_id = auth.uid())
  );

drop policy if exists chef_candidatures_update on public.candidatures;
create policy chef_candidatures_update on public.candidatures
  for update
  using (
    exists (select 1 from public.programmes p
      where p.id = candidatures.programme_id and p.chef_programme_id = auth.uid())
  )
  with check (
    exists (select 1 from public.programmes p
      where p.id = candidatures.programme_id and p.chef_programme_id = auth.uid())
  );
