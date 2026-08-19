-- Journal des e-mails candidats — Phase 0 (socle de traçabilité, garde-fou du chantier)
--
-- Cette table sort du brief 1 pour devenir la PREMIÈRE migration, indépendante :
-- le journal doit être en place et vérifié AVANT le premier envoi réel.
--
-- Deux types d'envoi : 'relance' (relance documentaire, existant) et 'communication'
-- (second type, brief 1). Écriture réelle par l'edge function d'envoi (rôle service,
-- qui contourne la RLS) ; les politiques ci-dessous sécurisent tout accès client.
--
-- Autorisation (confirmée le 19/08/2026, corrigée point C) :
--  · ÉMISSION réservée à owner / admin / manager (la gestionnaire de programme
--    est admin — Nathalie chez OVO). Les coaches n'émettent pas.
--  · LECTURE alignée sur l'accès à la candidature : owner/admin/manager voient
--    tout le journal de l'org ; un COACH ASSIGNÉ voit celui de ses candidatures
--    (il prépare une visite, il doit savoir ce que l'entrepreneur a déjà reçu) ;
--    chef_programme et super_admin aussi. Ni analyste, ni entrepreneur.
-- Aucune fuite inter-organisation.

create table public.candidature_emails (
  id                  uuid primary key default gen_random_uuid(),
  candidature_id      uuid not null references public.candidatures(id) on delete cascade,
  organization_id     uuid not null references public.organizations(id) on delete cascade,
  type                text not null check (type in ('relance', 'communication')),
  subject             text not null,
  body_html           text not null,
  sent_by             uuid,                   -- auth.users.id de l'émetteur (pas de FK cross-schema)
  sent_at             timestamptz not null default now(),
  delivery_status     text not null default 'queued'
                        check (delivery_status in ('queued','sent','delivered','bounced','failed','complained')),
  provider_message_id text,                   -- id Resend, pour rapprocher les webhooks de remise
  error               text,
  created_at          timestamptz not null default now()
);

comment on table public.candidature_emails is
  'Journal des e-mails candidats (relance documentaire / communication). Écriture par l''edge function d''envoi (rôle service). RLS : émission owner/admin/manager ; lecture = accès à la candidature (owner/admin/manager, chef_programme, coach assigné, super_admin), jamais analyste ni entrepreneur. Aucun accès inter-organisation.';

-- Historique par fiche (tri anté-chronologique), plafond quotidien par org, rapprochement webhook
create index candidature_emails_candidature_idx on public.candidature_emails (candidature_id, sent_at desc);
create index candidature_emails_org_sent_idx     on public.candidature_emails (organization_id, sent_at);
create index candidature_emails_provider_idx      on public.candidature_emails (provider_message_id);

alter table public.candidature_emails enable row level security;

-- LECTURE (point C) : alignée sur l'accès à la candidature, mais SANS le is_member_of
-- brut de candidatures_read (qui laisserait lire un analyste membre). On énumère :
--   · owner / admin / manager de l'org  → tout le journal de l'org
--   · chef_programme                     → cf. chef_candidatures_select
--   · coach ASSIGNÉ à la candidature     → cf. coach_candidatures_select (assigned_coach_id)
--   · super_admin
-- Exclut explicitement analyste et entrepreneur.
create policy candidature_emails_select on public.candidature_emails
  for select
  using (
    get_user_role_in(organization_id) = any (array['owner', 'admin', 'manager'])
    or has_role(auth.uid(), 'super_admin'::app_role)
    or has_role(auth.uid(), 'chef_programme'::app_role)
    or exists (
      select 1 from public.candidatures c
      where c.id = candidature_emails.candidature_id
        and c.assigned_coach_id = auth.uid()
    )
  );

-- ÉCRITURE (défense en profondeur) : même périmètre. L'EF d'envoi tourne en rôle
-- service et contourne cette policy ; elle protège tout INSERT client direct.
create policy candidature_emails_insert on public.candidature_emails
  for insert
  with check (
    get_user_role_in(organization_id) = any (array['owner', 'admin', 'manager'])
    or has_role(auth.uid(), 'super_admin'::app_role)
  );

-- MISE À JOUR (statut de remise via webhook Resend) : aucune policy client →
-- refus par défaut. Le webhook tourne en rôle service et contourne la RLS.
-- DELETE : idem, aucun accès client.
