-- Envoi groupé (brief 1) — identifiant d'opération sur le journal des e-mails.
--
-- Permet de grouper les lignes d'un même envoi groupé et de reprendre sur le
-- reliquat « depuis le journal » (critère 11) : à la reprise, on saute les
-- destinataires qui ont déjà une ligne 'sent'/'delivered' pour ce batch_id.
--
-- ADDITIF PUR : colonne nullable, aucune ligne existante impactée (batch_id reste
-- NULL pour tout l'historique et pour les envois unitaires — relance single).
-- RLS : rien à ajouter. candidature_emails a déjà ses policies SELECT/INSERT ;
-- une nouvelle colonne est couverte par ces policies (l'accès est décidé par
-- organization_id / candidature, pas par colonne). Aucune policy par colonne à
-- créer, donc pas de changement RLS dans cette migration — c'est volontaire.

alter table public.candidature_emails
  add column batch_id uuid;

comment on column public.candidature_emails.batch_id is
  'Identifiant d''une opération d''envoi groupé (brief 1). NULL pour les envois unitaires (relance single). Sert à la reprise sur reliquat : sauter les destinataires déjà servis d''un même batch.';

-- Index partiel : seules les lignes d'envoi groupé portent un batch_id.
create index candidature_emails_batch_idx
  on public.candidature_emails (batch_id)
  where batch_id is not null;
