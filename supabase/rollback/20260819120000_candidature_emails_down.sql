-- RETOUR ARRIÈRE de supabase/migrations/20260819120000_candidature_emails.sql
--
-- À exécuter MANUELLEMENT en cas de rollback. Volontairement hors du dossier
-- migrations/ pour ne jamais être rejoué comme une migration avant.
--
-- Additif pur : la migration ne crée qu'une table neuve (candidature_emails).
-- La supprimer suffit — aucune donnée existante n'est touchée, drop table cascade
-- retire indexes et policies. Aucun autre objet n'a été modifié.

drop policy if exists candidature_emails_select on public.candidature_emails;
drop policy if exists candidature_emails_insert on public.candidature_emails;
drop table  if exists public.candidature_emails;  -- cascade : indexes + policies restants
