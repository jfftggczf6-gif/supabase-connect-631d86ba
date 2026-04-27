-- ===========================================================================
-- Migration : Infrastructure Multi-Segment ESONO
-- Phase 1 — Tables et enums uniquement, aucune modif des données existantes.
--
-- ⚠ NE PAS APPLIQUER tant que le code de Phase 1 n'est pas validé en review.
-- Tout est ADDITIF (CREATE TABLE, ADD CONSTRAINT, ADD VALUE) — zéro régression
-- prévue sur les 7 orgs / 35 entreprises / 238 deliverables actuels.
--
-- ⚠ ALTER TYPE ADD VALUE ne fonctionne PAS dans une transaction Postgres.
-- Si appliqué via supabase CLI / migrations, il faut séparer le bloc enums
-- en migrations distinctes ou exécuter chaque ALTER TYPE séparément
-- dans le SQL editor Supabase.
-- ===========================================================================


-- ============================================================
-- 1. Élargir organizations.type CHECK
--    Ajout des 2 nouveaux segments (banque_affaires, banque)
--    'mixed' est conservé pour rétrocompat des données existantes
--    (le code applicatif le traite comme 'programme' via detectSegment)
-- ============================================================
ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_type_check;
ALTER TABLE organizations ADD CONSTRAINT organizations_type_check
  CHECK (type IN ('programme', 'pe', 'mixed', 'banque_affaires', 'banque'));


-- ============================================================
-- 2. Créer organization_presets
--    Config métier par client (overrides du SegmentConfig).
--    1 ligne max par org (UNIQUE), nullable au démarrage —
--    les 7 orgs Programme actuelles n'en ont pas besoin pour
--    fonctionner (fallback sur les défauts du segment).
-- ============================================================
CREATE TABLE IF NOT EXISTS organization_presets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Overrides segment
  fund_segment TEXT CHECK (fund_segment IN ('amorcage', 'mid_market', 'gros_tickets')),
  devise TEXT NOT NULL DEFAULT 'FCFA',
  langue TEXT NOT NULL DEFAULT 'fr',
  horizon_projection INTEGER CHECK (horizon_projection IN (5, 7, 10)),

  -- Scoring
  scoring_weights JSONB,

  -- Banque spécifique
  criteres_conformite JSONB,
  constats_config JSONB,

  -- Livrables et workflow
  livrables_actifs TEXT[],
  modules_desactives TEXT[],
  workflow_overrides JSONB,

  -- Matching
  matching_config JSONB,

  -- Templates
  templates_custom JSONB,

  -- Onboarding
  onboarding_completed BOOLEAN DEFAULT false,
  onboarding_data JSONB,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(organization_id)
);

ALTER TABLE organization_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "presets_org_member" ON organization_presets
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );


-- ============================================================
-- 3. Créer organization_workflows
--    Étapes pipeline custom par org (override workflow segment)
-- ============================================================
CREATE TABLE IF NOT EXISTS organization_workflows (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  etape_id TEXT NOT NULL,
  label TEXT NOT NULL,
  ordre INTEGER NOT NULL,
  type TEXT CHECK (type IN ('action', 'decision', 'external')) DEFAULT 'action',
  roles TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, etape_id)
);

ALTER TABLE organization_workflows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workflows_org_member" ON organization_workflows
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );


-- ============================================================
-- 4. Élargir les enums (4 livrables banque + 5 rôles banque)
--    ATTENTION : ces ALTER TYPE doivent être exécutés HORS transaction
--    si tu utilises supabase CLI. Sinon les exécuter dans le SQL editor.
-- ============================================================
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


-- ============================================================
-- 5. Élargir organization_members.role CHECK
-- ============================================================
ALTER TABLE organization_members DROP CONSTRAINT IF EXISTS organization_members_role_check;
ALTER TABLE organization_members ADD CONSTRAINT organization_members_role_check
  CHECK (role IN (
    'owner', 'admin', 'manager', 'analyst', 'coach', 'entrepreneur',
    'conseiller_pme', 'analyste_credit', 'directeur_agence', 'direction_pme', 'partner'
  ));


-- ============================================================
-- Fin de la migration Phase 1.
-- Phase 2 : modification de generate-deliverables et generate-pre-screening
--           pour consommer SegmentConfig + organization_presets.
-- Phase 3 : extension aux 12 autres agents + 3 edge functions banque.
-- ============================================================
