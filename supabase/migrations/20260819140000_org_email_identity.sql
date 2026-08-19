-- Brief 2 — identité d'émission par organisation.
--
-- Additif : 3 colonnes sur organizations (signature, nom d'expéditeur, adresse de
-- réponse de repli), 1 sur profiles (adresse de correspondance de l'utilisateur),
-- et 2 CHECK de format e-mail. AUCUNE valeur en dur : la signature et le nom
-- d'expéditeur se CALCULENT au rendu quand la colonne est null (voir email-identity) —
-- donc une organisation existante ou nouvellement créée est cohérente sans init
-- (critères 5, 16, 17). Seule exception : l'adresse de réponse OVO, initialisée à
-- titre provisoire ci-dessous.
--
-- RLS (critère 15) : rien à ajouter. organizations et profiles ont déjà leurs
-- policies (lecture/écriture bornées à l'org / au compte) ; des colonnes neuves
-- sont couvertes par ces policies (l'accès est décidé par ligne, pas par colonne).

alter table public.organizations
  add column email_signature   text,
  add column email_sender_name text,
  add column email_reply_to     text;

alter table public.profiles
  add column correspondence_email text;

-- Format e-mail (forme, pas délivrabilité). Une adresse invalide dans ces champs
-- bloquerait/casserait le canal de réponse — on la refuse à la saisie plutôt que
-- de chercher l'erreur ailleurs au moment de l'envoi.
alter table public.organizations
  add constraint organizations_email_reply_to_format
  check (email_reply_to is null or email_reply_to ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$');

alter table public.profiles
  add constraint profiles_correspondence_email_format
  check (correspondence_email is null or correspondence_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$');

-- OVO : adresse de réponse PROVISOIRE. Filet en attendant une boîte d'organisation
-- relevée (type info@ / programmes@), à remplacer depuis l'écran de réglages SANS
-- migration. Sans ce filet, un envoi sous le compte de service (admin@esono.app)
-- ferait atterrir les réponses des candidats OVO chez ESONO — le courrier du client
-- chez nous.
update public.organizations
  set email_reply_to = 'nathalie.schots@ondernemersvoorondernemers.be'
  where id = '69eb5440-81e0-4446-81e3-a308dd2cc369';

comment on column public.organizations.email_reply_to is
  'Adresse de réponse de repli de l''organisation (cascade : correspondence_email utilisateur → e-mail de connexion → cette colonne → blocage). OVO = nathalie.schots@… à TITRE PROVISOIRE en attendant une boîte d''organisation relevée.';
comment on column public.profiles.correspondence_email is
  'Adresse de correspondance de l''utilisateur (reply-to des e-mails qu''il émet), distincte de l''e-mail de connexion. Priorité 1 de la cascade reply-to.';