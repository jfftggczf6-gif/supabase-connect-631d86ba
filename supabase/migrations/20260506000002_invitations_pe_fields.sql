-- ============================================================================
-- PE Workspace MD — extension organization_invitations
-- ============================================================================
-- Ajoute :
--   - full_name : nom et prénom du futur membre (pré-remplis le profil)
--   - responsable_user_id : référence vers le user superviseur hiérarchique
--                            (MD pour un IM, IM/MD pour un Analyste)
-- Étend la CHECK constraint sur role pour autoriser les rôles PE
-- (managing_director, investment_manager) déjà utilisés dans organization_members.
-- ============================================================================

ALTER TABLE organization_invitations
  ADD COLUMN IF NOT EXISTS full_name TEXT,
  ADD COLUMN IF NOT EXISTS responsable_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN organization_invitations.full_name IS
  'Nom et prénom saisis lors de l''invitation (pré-remplit le profil à l''acceptation)';
COMMENT ON COLUMN organization_invitations.responsable_user_id IS
  'User superviseur hiérarchique du nouveau membre (ex: MD pour un IM en PE)';

-- Étend les rôles autorisés
ALTER TABLE organization_invitations
  DROP CONSTRAINT IF EXISTS organization_invitations_role_check;

ALTER TABLE organization_invitations
  ADD CONSTRAINT organization_invitations_role_check CHECK (
    role = ANY (ARRAY[
      'owner', 'admin', 'manager',
      'analyst', 'coach', 'entrepreneur',
      'managing_director', 'investment_manager',
      'conseiller_pme', 'analyste_credit', 'directeur_agence',
      'direction_pme', 'directeur_pme', 'partner'
    ])
  );
