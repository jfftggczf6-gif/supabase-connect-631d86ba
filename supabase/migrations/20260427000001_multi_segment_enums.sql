-- ===========================================================================
-- Migration : Multi-Segment ESONO — Phase 1 (2/2) — Enums
--
-- ⚠ ATTENTION — ALTER TYPE ADD VALUE ne peut PAS s'exécuter dans une
-- transaction Postgres. Si tu utilises `supabase db push` ou
-- `supabase db reset`, ces commandes peuvent échouer avec :
--   ERROR: ALTER TYPE ... ADD cannot run inside a transaction block
--
-- 3 options pour appliquer cette migration :
--
-- OPTION A — Exécuter manuellement dans le SQL Editor Supabase
--   (recommandé pour la prod — c'est sûr et ré-exécutable)
--   Aller sur https://supabase.com/dashboard/project/gszwotgppuinpfnyrjnu/sql
--   Copier-coller le contenu de ce fichier, exécuter.
--
-- OPTION B — Désactiver la transaction au niveau du runner
--   Si tu utilises supabase CLI, ajouter cette ligne en tête de fichier :
--   -- @supabase/no-transaction
--   (selon la version du CLI, ce pragma peut s'écrire différemment)
--
-- OPTION C — MCP Supabase (mcp__claude_ai_Supabase__apply_migration)
--   Le MCP accepte les ALTER TYPE car il peut isoler les commandes.
--
-- Toutes les commandes ci-dessous sont idempotentes (IF NOT EXISTS) —
-- ré-exécutables sans erreur.
-- ===========================================================================

ALTER TYPE deliverable_type ADD VALUE IF NOT EXISTS 'diagnostic_bancabilite';
ALTER TYPE deliverable_type ADD VALUE IF NOT EXISTS 'credit_readiness_pack';
ALTER TYPE deliverable_type ADD VALUE IF NOT EXISTS 'note_credit';
ALTER TYPE deliverable_type ADD VALUE IF NOT EXISTS 'teaser_anonymise';

ALTER TYPE module_code ADD VALUE IF NOT EXISTS 'diagnostic_bancabilite';
ALTER TYPE module_code ADD VALUE IF NOT EXISTS 'credit_readiness_pack';
ALTER TYPE module_code ADD VALUE IF NOT EXISTS 'note_credit';
ALTER TYPE module_code ADD VALUE IF NOT EXISTS 'teaser_anonymise';

ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'conseiller_pme';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'analyste_credit';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'directeur_agence';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'direction_pme';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'partner';
