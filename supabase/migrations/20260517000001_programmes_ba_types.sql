-- Feature candidature_ba : étend les check constraints sur programmes pour
-- accepter le type 'banque_affaires' et le statut 'paused'.
--
-- Avant :
--   type   ∈ {appel_candidatures, cohorte_directe}
--   status ∈ {draft, open, closed, in_progress, completed}
--
-- Après :
--   type   ∈ {appel_candidatures, cohorte_directe, banque_affaires}
--   status ∈ {draft, open, closed, in_progress, completed, paused}
--
-- 'paused' permet au Partner BA de mettre en pause son appel via toggle UI
-- sans utiliser 'lost' ou 'closed' (sémantique propre, réversible).
-- Le code submit-candidature refuse déjà les status 'completed' et 'lost' ;
-- on ajoutera 'paused' côté EF si nécessaire (à confirmer).

ALTER TABLE public.programmes DROP CONSTRAINT IF EXISTS programmes_type_check;
ALTER TABLE public.programmes ADD CONSTRAINT programmes_type_check
  CHECK (type = ANY (ARRAY['appel_candidatures'::text, 'cohorte_directe'::text, 'banque_affaires'::text]));

ALTER TABLE public.programmes DROP CONSTRAINT IF EXISTS programmes_status_check;
ALTER TABLE public.programmes ADD CONSTRAINT programmes_status_check
  CHECK (status = ANY (ARRAY['draft'::text, 'open'::text, 'closed'::text, 'in_progress'::text, 'completed'::text, 'paused'::text]));
