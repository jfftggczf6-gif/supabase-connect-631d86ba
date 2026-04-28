-- Étend deliverable_type pour les 6 livrables Credit Readiness banque.
-- ⚠ ALTER TYPE ADD VALUE doit s'exécuter hors transaction.

ALTER TYPE deliverable_type ADD VALUE IF NOT EXISTS 'credit_readiness_modele_financier';
ALTER TYPE deliverable_type ADD VALUE IF NOT EXISTS 'credit_readiness_projections';
ALTER TYPE deliverable_type ADD VALUE IF NOT EXISTS 'credit_readiness_bp_credit';
ALTER TYPE deliverable_type ADD VALUE IF NOT EXISTS 'credit_readiness_plan_financement';
ALTER TYPE deliverable_type ADD VALUE IF NOT EXISTS 'credit_readiness_organigramme';
ALTER TYPE deliverable_type ADD VALUE IF NOT EXISTS 'credit_readiness_analyse_commerciale';
ALTER TYPE deliverable_type ADD VALUE IF NOT EXISTS 'matching_produits';
