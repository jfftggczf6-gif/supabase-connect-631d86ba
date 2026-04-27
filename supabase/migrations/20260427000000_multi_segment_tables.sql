-- ===========================================================================
-- Migration : Multi-Segment ESONO — Phase 1 (1/2) — Tables, CHECK, RLS
--
-- Cette migration crée les tables et étend les CHECK contraintes.
-- Elle peut être exécutée dans une transaction (compatible supabase db push).
--
-- Le fichier compagnon `20260427000001_multi_segment_enums.sql` ajoute les
-- nouvelles valeurs aux enums (ALTER TYPE ADD VALUE) et DOIT être exécuté
-- séparément hors transaction (voir le commentaire en tête de ce fichier-là).
--
-- Toutes les opérations sont ADDITIVES — aucun DROP, aucune modif de données.
-- Les 7 orgs / 35 entreprises / 238 deliverables actuels fonctionnent à
-- l'identique après application.
-- ===========================================================================


-- ============================================================
-- 1. Élargir organizations.type CHECK
--    Ajout des 2 nouveaux segments (banque_affaires, banque).
--    'mixed' est conservé pour rétrocompat des données existantes
--    (le code applicatif le traite comme 'programme' via detectSegment).
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
--
--    NOTE devise : nullable pour que getDevise() puisse appliquer
--    proprement le fallback config.tone.devise_defaut spécifique au
--    segment (FCFA pour programme/banque, EUR pour pe/banque_affaires).
-- ============================================================
CREATE TABLE IF NOT EXISTS organization_presets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Overrides segment
  fund_segment TEXT CHECK (fund_segment IN ('amorcage', 'mid_market', 'gros_tickets')),
  devise TEXT,                                 -- nullable, fallback sur config segment
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

-- Lecture : tout membre actif de l'org
-- Écriture : owner/admin/manager via une 2ᵉ policy à durcir en Phase 2 si besoin.
-- Pour Phase 1 (table vide), policy unique permissive.
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
  ordre INTEGER NOT NULL,                      -- pas de DEFAULT — l'appelant doit décider
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
-- 4. Élargir organization_members.role CHECK (TEXT, pas l'enum app_role)
--    Ajout des 5 rôles banque (conseiller_pme, analyste_credit,
--    directeur_agence, direction_pme, partner) en plus des 6 existants.
-- ============================================================
ALTER TABLE organization_members DROP CONSTRAINT IF EXISTS organization_members_role_check;
ALTER TABLE organization_members ADD CONSTRAINT organization_members_role_check
  CHECK (role IN (
    'owner', 'admin', 'manager', 'analyst', 'coach', 'entrepreneur',
    'conseiller_pme', 'analyste_credit', 'directeur_agence', 'direction_pme', 'partner'
  ));


-- ============================================================
-- Fin migration tables (1/2). Voir 20260427000001_multi_segment_enums.sql
-- pour les ALTER TYPE qui doivent tourner hors transaction.
-- ============================================================
