-- Étend organization_members.role pour autoriser 'directeur_pme'
-- (la contrainte précédente avait 'direction_pme' uniquement, mais la
-- maquette + le preset NSIA utilisent 'directeur_pme'). On garde les deux
-- valeurs pour rétrocompat.

ALTER TABLE organization_members DROP CONSTRAINT IF EXISTS organization_members_role_check;
ALTER TABLE organization_members ADD CONSTRAINT organization_members_role_check
  CHECK (role IN (
    'owner', 'admin', 'manager', 'analyst', 'coach', 'entrepreneur',
    'conseiller_pme', 'analyste_credit', 'directeur_agence', 'direction_pme', 'directeur_pme', 'partner'
  ));
