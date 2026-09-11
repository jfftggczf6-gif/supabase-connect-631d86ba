-- Registre de prompts versionnés.
--
-- Constat de l'audit du 2026-09-10 : le pipeline de diagnostic de candidature
-- n'a AUCUN prompt versionné. SCREENING_SYSTEM_PROMPT est une constante Python
-- en dur, et screening_data ne conserve ni le modèle ni la version de prompt
-- utilisés. Deux diagnostics à six mois d'écart sont donc indistinguables et
-- non comparables.
--
-- Cette table ouvre le registre. Elle est introduite par RENDER_DIAGNOSTIC (le
-- premier prompt à en bénéficier) mais n'est pas spécifique au rendu : tout
-- appel modèle du produit a vocation à y être déclaré.
--
-- Une seule version active par code, garantie EN BASE (index partiel) et non
-- par convention — un doublon d'actif rendrait le rendu non déterministe.
--
-- RLS : lecture pour tout utilisateur authentifié (les edge functions lisent en
-- service_role et court-circuitent RLS de toute façon) ; écriture super_admin.
-- Un prompt n'est pas une donnée d'organisation : pas de cloisonnement par org.

create table public.ai_prompts (
  id                   uuid primary key default gen_random_uuid(),
  code                 text not null,
  version              integer not null,
  is_active            boolean not null default false,
  model                text not null,
  temperature          numeric(4,3) not null default 0,
  max_tokens           integer not null default 8192,
  system_prompt        text not null,
  user_prompt_template text not null,
  description          text,
  created_at           timestamptz not null default now(),
  created_by           uuid references auth.users(id) on delete set null,
  constraint ai_prompts_code_version_uniq unique (code, version),
  constraint ai_prompts_temperature_range check (temperature >= 0 and temperature <= 1),
  constraint ai_prompts_max_tokens_positive check (max_tokens > 0)
);

comment on table public.ai_prompts is
  'Registre des prompts versionnés. Un appel modèle enregistre code + version + modèle dans sa sortie, pour qu''un résultat reste explicable et comparable après coup.';
comment on column public.ai_prompts.user_prompt_template is
  'Gabarit du prompt utilisateur. Marqueurs {{locale}}, {{locale_name}} et {{prose_json}} substitués à l''appel.';

-- Une seule version active par code — invariant porté par la base.
create unique index ai_prompts_one_active_per_code
  on public.ai_prompts (code)
  where is_active;

-- Note RLS : auth.uid() est enveloppé dans (select …) pour n'être évalué qu'une
-- fois par requête au lieu d'une fois par ligne (règle Supabase security-rls-
-- performance). Les migrations antérieures du dépôt l'appellent nu ; on ne les
-- reprend pas ici, mais on ne propage pas le défaut.

alter table public.ai_prompts enable row level security;

create policy "ai_prompts_read_authenticated"
  on public.ai_prompts for select to authenticated using (true);

create policy "ai_prompts_write_super_admin"
  on public.ai_prompts for all to authenticated
  using (public.has_role((select auth.uid()), 'super_admin'))
  with check (public.has_role((select auth.uid()), 'super_admin'));

-- ───────────────────────────────────────────────────────────────────────────
-- RENDER_DIAGNOSTIC v1
--
-- Rend la PROSE d'un diagnostic existant dans une langue cible. Ne diagnostique
-- pas, ne score pas, ne recalcule rien : il reçoit uniquement les champs de prose
-- extraits de screening_data et rend le même objet, mêmes clés, même ordre.
--
-- Les valeurs déterministes (score, montants, statuts, niveaux de preuve,
-- sévérités, booléens) ne lui sont JAMAIS transmises : elles sont lues
-- directement dans screening_data à l'affichage et habillées via
-- diagnostic_labels. C'est ce qui rend l'invariance fr/en vraie par
-- construction plutôt que par vérification.
-- ───────────────────────────────────────────────────────────────────────────

insert into public.ai_prompts
  (code, version, is_active, model, temperature, max_tokens, description, system_prompt, user_prompt_template)
values (
  'RENDER_DIAGNOSTIC',
  1,
  true,
  'claude-sonnet-4-6',
  0,
  16000,
  'Rend la prose d''un diagnostic de candidature dans une langue cible. Aucune donnée chiffrée ni statut transmis.',
$SYS$Tu es traducteur professionnel spécialisé en analyse financière et en accompagnement de PME africaines.

Tu reçois un objet JSON contenant UNIQUEMENT de la prose extraite d'un diagnostic d'entreprise déjà produit. Tu le rends dans la langue demandée.

═══ RÈGLES ABSOLUES ═══
1. STRUCTURE IDENTIQUE. Tu renvoies exactement les mêmes clés, au même niveau d'imbrication, dans le même ordre. Aucune clé ajoutée, aucune supprimée, aucune renommée.
2. TABLEAUX DE MÊME LONGUEUR. Un tableau de 5 éléments en entrée ressort avec 5 éléments, dans le même ordre.
3. CHIFFRES INCHANGÉS. Tout nombre, montant, pourcentage, date, devise, code ou nom propre présent dans le texte est recopié À L'IDENTIQUE. « CA 460M XOF en 2024 » reste « 460M XOF » et « 2024 ». Tu ne convertis aucune devise, tu ne reformates aucun nombre, tu n'arrondis rien.
4. AUCUN AJOUT. Tu ne complètes pas, tu ne développes pas, tu ne commentes pas, tu ne corriges pas le fond. Si une phrase est bancale, elle le reste dans la langue cible.
5. AUCUN JUGEMENT. Tu ne modifies pas la sévérité perçue d'un constat. Un constat prudent reste prudent, un constat alarmant reste alarmant.
6. CHAÎNE VIDE PRÉSERVÉE. Une valeur vide ou nulle en entrée ressort vide ou nulle.
7. Si la langue cible est celle du texte source, tu renvoies le texte inchangé.

═══ GLOSSAIRE JURIDIQUE — GHANA ═══
Le français de départ décrit souvent des formalités OHADA. Ne les transpose pas
mot à mot vers un vocabulaire ghanéen inexact.

- Le CERTIFICAT DE COMMENCEMENT D'ACTIVITÉ n'existe plus au Ghana : il est
  supprimé depuis le Companies Act 2019 (Act 992). N'écris JAMAIS
  « certificate to commence business » ni « certificate of commencement of
  business ». Le seul document constitutif est le CERTIFICATE OF INCORPORATION,
  délivré par l'OFFICE OF THE REGISTRAR OF COMPANIES (ORC).
- Pour les comptes annuels, la formulation exigible est
  « audited financial statements filed with the ORC ».
  N'écris PAS « certified financial statements » : « certified » ne correspond à
  aucune exigence ghanéenne et laisserait croire à une formalité qui n'existe pas.

Réponds UNIQUEMENT par le JSON, sans balise de code, sans commentaire.$SYS$,
$USR$Langue cible : {{locale_name}} (code {{locale}}).

Rends la prose suivante dans cette langue, en respectant les 7 règles.

{{prose_json}}$USR$
);
