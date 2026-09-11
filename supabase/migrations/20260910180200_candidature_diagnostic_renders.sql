-- Rendus linguistiques de la prose d'un diagnostic de candidature.
--
-- INVARIANT CENTRAL : candidatures.screening_data n'est JAMAIS écrasé par un rendu.
-- Le diagnostic source reste la seule vérité ; un rendu est une vue linguistique
-- de sa prose, stockée à part, indexée par (candidature, langue).
--
-- Ce que cette table NE contient PAS, délibérément : aucun score, aucun montant,
-- aucun statut, aucun niveau de preuve, aucune sévérité, aucun booléen de
-- cohérence. Ces valeurs sont lues dans screening_data quelle que soit la langue
-- d'affichage, et habillées via diagnostic_labels. C'est ce qui rend l'invariance
-- fr/en vraie par construction : il n'existe aucun chemin par lequel un
-- changement de langue pourrait déplacer un chiffre.
--
-- Le français n'a pas de ligne ici : la prose française EST screening_data.
-- Un rendu fr serait une copie, donc une seconde vérité — exactement ce qu'on évite.
--
-- Traçabilité : chaque ligne porte le code de prompt, sa version et le modèle qui
-- l'a produite, plus la screening_date de la source. Si le diagnostic est
-- régénéré, source_screening_date diverge et le rendu devient périmé — détectable
-- par simple comparaison, sans heuristique.

create table public.candidature_diagnostic_renders (
  id                    uuid primary key default gen_random_uuid(),
  candidature_id        uuid not null references public.candidatures(id) on delete cascade,
  locale                text not null,
  -- Prose rendue : mêmes clés que l'extrait de prose de screening_data.
  prose                 jsonb not null,
  prompt_code           text not null,
  prompt_version        integer not null,
  model                 text not null,
  -- screening_date de la source au moment du rendu. Sert à détecter la péremption.
  source_screening_date timestamptz,
  input_tokens          integer,
  output_tokens         integer,
  cost_usd              numeric(10,4),
  organization_id       uuid references public.organizations(id) on delete set null,
  created_at            timestamptz not null default now(),
  created_by            uuid references auth.users(id) on delete set null,
  constraint cdr_locale_supported check (locale in ('en')),
  constraint cdr_one_render_per_locale unique (candidature_id, locale)
);

comment on table public.candidature_diagnostic_renders is
  'Rendu linguistique de la PROSE d''un diagnostic. Ne contient aucune valeur déterministe : score, montants, statuts et niveaux de preuve restent lus dans candidatures.screening_data quelle que soit la langue.';
comment on column public.candidature_diagnostic_renders.locale is
  'Langue du rendu. Le français est absent par construction : la prose française est screening_data elle-même. Élargir le CHECK pour ajouter une langue.';
comment on column public.candidature_diagnostic_renders.source_screening_date is
  'screening_date de la source au moment du rendu. Si elle diffère de la valeur courante, le rendu est périmé.';

create index cdr_candidature_idx on public.candidature_diagnostic_renders (candidature_id);
create index cdr_org_idx on public.candidature_diagnostic_renders (organization_id);

-- Note RLS : auth.uid() est enveloppé dans (select …) pour n'être évalué qu'une
-- fois par requête au lieu d'une fois par ligne (règle Supabase security-rls-
-- performance). Les migrations antérieures du dépôt l'appellent nu ; on ne les
-- reprend pas ici, mais on ne propage pas le défaut.

alter table public.candidature_diagnostic_renders enable row level security;

-- Lecture : quiconque peut déjà voir la candidature peut en voir le rendu.
-- On réutilise la portée existante plutôt que d'en réinventer une — sinon un
-- rendu deviendrait une fuite latérale du diagnostic (cf. incident chef_candidatures).
create policy "cdr_read_scoped_to_candidature"
  on public.candidature_diagnostic_renders for select
  to authenticated
  using (
    exists (
      select 1
      from public.candidatures c
      join public.programmes p on p.id = c.programme_id
      where c.id = candidature_diagnostic_renders.candidature_id
        and (
          public.has_role((select auth.uid()), 'super_admin')
          or exists (
            select 1 from public.organization_members om
            where om.user_id = (select auth.uid())
              and om.is_active
              and om.organization_id = p.organization_id
              and om.role in ('owner', 'admin', 'manager')
          )
          or p.chef_programme_id = (select auth.uid())
        )
    )
  );

-- Écriture : réservée au service_role (edge function render-diagnostic).
-- Aucune policy d'insertion pour `authenticated` — un rendu ne doit pouvoir
-- naître que du chemin contrôlé, avec sa traçabilité de prompt.
