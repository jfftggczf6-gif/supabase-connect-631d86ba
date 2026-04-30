-- Phase B' Step 0 — Étendre le CHECK constraint sur organization_members.role
-- pour inclure les rôles PE (managing_director, investment_manager, analyste).
-- Fix manquant en local : Phase A avait étendu en prod mais pas committé en migration.

ALTER TABLE organization_members
  DROP CONSTRAINT IF EXISTS organization_members_role_check;

ALTER TABLE organization_members
  ADD CONSTRAINT organization_members_role_check
  CHECK (role = ANY (ARRAY[
    -- Programme classique
    'owner', 'admin', 'manager', 'analyst', 'coach', 'entrepreneur',
    -- Banque
    'conseiller_pme', 'analyste_credit', 'directeur_agence',
    'direction_pme', 'directeur_pme', 'partner',
    -- PE (Phase A)
    'managing_director', 'investment_manager', 'analyste'
  ]));
