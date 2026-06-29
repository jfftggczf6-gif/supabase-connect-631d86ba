-- Demandes de documents sur-mesure attachées à un lien de complétion de dossier.
-- Stocke les libellés des pièces que le chef de programme réclame spécifiquement
-- à un candidat (en plus des champs "document" déjà définis par le formulaire).
-- Lu par l'edge function candidature-recovery (action "info") pour construire la
-- checklist affichée au candidat sur la page publique de complétion.
alter table public.candidatures
  add column if not exists recovery_requested_docs jsonb not null default '[]'::jsonb;

comment on column public.candidatures.recovery_requested_docs is
  'Libellés des documents demandés sur-mesure au candidat via le lien de complétion (recovery). Ex: ["RIB","Attestation fiscale"].';
