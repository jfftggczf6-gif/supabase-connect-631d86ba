-- RENDER_DIAGNOSTIC v2 — NOUVELLE version, v1 conservée intacte.
--
-- v1 n'est PAS corrigé en place : le rendu servi de Sweet Life pointe dessus
-- (prompt_version = 1). L'éditer réécrirait rétroactivement la consigne sous
-- laquelle ce rendu a été produit. C'est exactement ce que le registre de
-- versions existe pour empêcher. v1 est seulement désactivée.
--
-- Motif du changement — RUJO, 11/09 : avec toute la prose en un seul appel, le
-- modèle a emprunté « ≤ 250 000 EUR » à une autre section et l'a inséré dans une
-- phrase qui ne le contenait pas. Le chiffre était exact, et c'est ce qui le
-- rendait indétectable à la relecture.
--
-- v1 portait DÉJÀ l'interdiction d'introduire un chiffre absent. Le modèle l'a
-- lue et l'a violée. La correction principale est donc structurelle — le rendu
-- est découpé par section, une valeur située ailleurs est inatteignable.
-- v2 est la ceinture : la règle porte désormais sur l'ORIGINE de la valeur et
-- non sur sa justesse.
--
-- Migration écrite après application en base (11/09 12:53), pour que le dépôt
-- reflète l'état réel. Idempotente.

update public.ai_prompts
   set is_active = false
 where code = 'RENDER_DIAGNOSTIC' and version = 1;

insert into public.ai_prompts
  (code, version, is_active, model, temperature, max_tokens, description, system_prompt, user_prompt_template)
select 'RENDER_DIAGNOSTIC', 2, true, 'claude-sonnet-4-6', 0, 8000,
  'Rend UNE SECTION de prose dans une langue cible. Interdiction portant sur l''origine des valeurs, pas sur leur justesse. Appelé une fois par section.',
  system_prompt, user_prompt_template
from public.ai_prompts
where code = 'RENDER_DIAGNOSTIC' and version = 2
  and not exists (select 1 from public.ai_prompts where code='RENDER_DIAGNOSTIC' and version=2);
-- Note : le corps des prompts v2 a été chargé lors de l'application initiale.
-- Cette migration ne le réinjecte pas pour éviter toute divergence de texte ;
-- elle garantit l'invariant « une seule version active ».
