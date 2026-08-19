-- Correctif point C-bis — fuite inter-organisation sur candidature_emails_select.
--
-- La clause chef de la migration 20260819120000 était GLOBALE :
--     has_role(auth.uid(), 'chef_programme'::app_role)
-- Or l'app_role chef_programme n'est pas bornée par organisation. Résultat : un
-- chef de programme lisait le journal e-mail de TOUTES les organisations.
-- Détecté au test d'isolement RLS (un manager+chef d'ESONO voyait les lignes
-- d'OVO et de Test Playwright). C'est exactement la fuite inter-org interdite —
-- et la policy chef existante sur `candidatures` a le même défaut, mais on ne le
-- réplique pas ici.
--
-- Remplacement : périmètre par PROPRIÉTÉ de programme. Un chef ne voit que le
-- journal des candidatures dont le programme lui appartient
-- (programmes.chef_programme_id = auth.uid()). Comme un chef ne possède que des
-- programmes de sa propre organisation, cette clause ne peut pas franchir une org.
--
-- Additif/correctif : on remplace UNE policy, aucune donnée touchée.

drop policy if exists candidature_emails_select on public.candidature_emails;

create policy candidature_emails_select on public.candidature_emails
  for select
  using (
    -- gestion de l'org (borné par organization_id)
    get_user_role_in(organization_id) = any (array['owner', 'admin', 'manager'])
    -- plateforme
    or has_role(auth.uid(), 'super_admin'::app_role)
    -- coach ASSIGNÉ à la candidature (borné à la candidature, donc à son org)
    or exists (
      select 1 from public.candidatures c
      where c.id = candidature_emails.candidature_id
        and c.assigned_coach_id = auth.uid()
    )
    -- chef PROPRIÉTAIRE du programme de la candidature (borné à son org)
    or exists (
      select 1 from public.candidatures c
      join public.programmes p on p.id = c.programme_id
      where c.id = candidature_emails.candidature_id
        and p.chef_programme_id = auth.uid()
    )
  );