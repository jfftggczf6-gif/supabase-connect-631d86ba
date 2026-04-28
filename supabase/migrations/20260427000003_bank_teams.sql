-- ===========================================================================
-- Migration : Bank teams (segment Banque)
--
-- Modélise la hiérarchie de supervision dans une banque :
--   - Une "team" est portée par un analyste (`lead_user_id`).
--   - Les conseillers PME sont membres de la team via `bank_team_members`.
--   - `parent_team_id` permet une arborescence multi-niveaux (Direction PME →
--     Régions → Agences) — non utilisé pour l'instant mais prévu.
--   - Le Directeur PME n'a PAS besoin d'être dans une team — il voit
--     l'ensemble de l'org via le filtre RLS standard `organization_id`.
--
-- Filtrage typique des dossiers (à appliquer en RLS dans une migration suivante) :
--   conseiller_pme  → WHERE conseiller_id = auth.uid()
--   analyste_credit → WHERE conseiller_id IN (
--                       SELECT user_id FROM bank_team_members WHERE team_id IN (
--                         SELECT id FROM bank_teams WHERE lead_user_id = auth.uid()
--                       )
--                     )
--   directeur_pme   → pas de filtre additionnel (RLS org standard)
--
-- Toutes les opérations sont ADDITIVES.
-- ===========================================================================

CREATE TABLE IF NOT EXISTS bank_teams (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                               -- ex: "Équipe Bouaké"
  parent_team_id UUID REFERENCES bank_teams(id) ON DELETE SET NULL,
  lead_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, name)
);

CREATE INDEX IF NOT EXISTS idx_bank_teams_org ON bank_teams(organization_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_bank_teams_lead ON bank_teams(lead_user_id);

ALTER TABLE bank_teams ENABLE ROW LEVEL SECURITY;

-- RLS : tout membre actif de l'org peut LIRE ses teams (utile pour la UI).
-- Écriture : owner/admin/manager (à durcir si nécessaire dans une phase ultérieure).
CREATE POLICY "bank_teams_org_member_read" ON bank_teams
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "bank_teams_org_admin_write" ON bank_teams
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND is_active = true
        AND role IN ('owner','admin','manager','direction_pme','directeur_pme')
    )
  );


CREATE TABLE IF NOT EXISTS bank_team_members (
  team_id UUID NOT NULL REFERENCES bank_teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_in_team TEXT,                                -- ex: "conseiller", "junior", "stagiaire"
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (team_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_bank_team_members_user ON bank_team_members(user_id);

ALTER TABLE bank_team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bank_team_members_org_member_read" ON bank_team_members
  FOR SELECT USING (
    team_id IN (
      SELECT id FROM bank_teams t
      WHERE t.organization_id IN (
        SELECT organization_id FROM organization_members
        WHERE user_id = auth.uid() AND is_active = true
      )
    )
  );

CREATE POLICY "bank_team_members_admin_write" ON bank_team_members
  FOR ALL USING (
    team_id IN (
      SELECT t.id FROM bank_teams t
      JOIN organization_members om ON om.organization_id = t.organization_id
      WHERE om.user_id = auth.uid() AND om.is_active = true
        AND om.role IN ('owner','admin','manager','direction_pme','directeur_pme')
    )
  );

DROP TRIGGER IF EXISTS bank_teams_set_updated_at ON bank_teams;
CREATE TRIGGER bank_teams_set_updated_at
  BEFORE UPDATE ON bank_teams
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
