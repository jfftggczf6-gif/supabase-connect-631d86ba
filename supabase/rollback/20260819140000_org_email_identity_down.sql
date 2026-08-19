-- RETOUR ARRIÈRE de 20260819140000_org_email_identity.sql
-- Additif pur → suppression des colonnes/contraintes ajoutées. Les valeurs
-- (dont l'adresse de réponse OVO provisoire) ne portent que l'identité d'émission :
-- leur perte ne détruit aucune donnée métier (les replis se recalculent).

alter table public.profiles   drop constraint if exists profiles_correspondence_email_format;
alter table public.organizations drop constraint if exists organizations_email_reply_to_format;

alter table public.profiles      drop column if exists correspondence_email;
alter table public.organizations drop column if exists email_signature;
alter table public.organizations drop column if exists email_sender_name;
alter table public.organizations drop column if exists email_reply_to;
