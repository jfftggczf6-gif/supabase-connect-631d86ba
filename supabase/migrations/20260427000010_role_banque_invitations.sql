-- Étend organization_invitations.role pour accepter les rôles banque
-- (NSIA-style et apparentés). organization_members accepte déjà ces rôles
-- depuis 20260427000004 ; il faut le même alignement côté invitations
-- pour que send-invitation puisse écrire dans la table sans CHECK violation.

ALTER TABLE organization_invitations DROP CONSTRAINT IF EXISTS organization_invitations_role_check;
ALTER TABLE organization_invitations ADD CONSTRAINT organization_invitations_role_check
  CHECK (role IN (
    'owner', 'admin', 'manager',
    'analyst', 'coach', 'entrepreneur',
    'conseiller_pme', 'analyste_credit',
    'directeur_agence', 'direction_pme', 'directeur_pme',
    'partner'
  ));
