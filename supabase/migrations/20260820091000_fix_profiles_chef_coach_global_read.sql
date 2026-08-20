-- Correctif SÉCURITÉ — fuite PII inter-organisation sur profiles.
--
-- La policy « Chef programme can view coach profiles » = has_role(chef/coach)
-- global : tout chef ou coach lisait les 87 profils de TOUTES les organisations.
-- Elle est REDONDANTE en intra-org (déjà couverte par « Org members can view
-- profiles of co-members ») et ne fait fuiter que le cross-org. On la SUPPRIME,
-- sans remplacement : l'accès légitime reste assuré par les policies co-membres,
-- profil propre, et super_admin.
--
-- Vérifié le 20/08/2026 : aucun compte actif ne perd d'accès légitime. Seuls 3
-- comptes coach orphelins (sans org, connectés une fois il y a 119 j, 0 coaching)
-- sont réduits à leur propre profil. Isolement RLS re-testé après application
-- (coach réel : 80 co-membres au lieu de 87 ; orphelin : 1).

drop policy if exists "Chef programme can view coach profiles" on public.profiles;
