-- RETOUR ARRIÈRE de 20260819130000_candidature_emails_batch_id.sql
-- À exécuter manuellement. Additif pur → suppression sans perte de données
-- (la colonne batch_id ne porte que des identifiants d'opération d'envoi groupé).

drop index if exists public.candidature_emails_batch_idx;
alter table public.candidature_emails drop column if exists batch_id;
