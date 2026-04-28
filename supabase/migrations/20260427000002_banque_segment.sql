-- ===========================================================================
-- Migration : Multi-Segment ESONO — Phase 3.B.1 — Fondations Banque
--
-- Étend l'architecture multi-segment pour supporter le segment Banque/IMF :
--   - colonne config_banque JSONB sur organization_presets (produits NSIA-like,
--     canaux d'acquisition, classifications, livrables credit readiness,
--     pipeline_views_per_role, monitoring, montée en gamme, roles_labels)
--   - table funding_lines pour les lignes DFI avec tracking d'utilisation
--   - colonnes source_acquisition + banque_metadata sur enterprises
--
-- ⚠ AUCUNE valeur tenant-specific (NSIA, Atlantique, etc.) dans cette
-- migration. Toutes les valeurs vivent dans les seeds (preset_*.json).
--
-- Idempotente — toutes les colonnes sont ADDITIVES.
-- ===========================================================================


-- ============================================================
-- 1. Étendre organization_presets avec config_banque
--    Conteneur JSONB pour tout ce qui est spécifique au segment Banque
--    et qui ne rentre pas dans les colonnes existantes (criteres_conformite,
--    constats_config, matching_config, templates_custom).
--
--    Structure typée du contenu (documenté dans seeds/preset_banque.schema.json):
--    {
--      "produits": [{ code, label, type, capacite, taux, criteres_eligibilite }],
--      "canaux_acquisition": [{ code, label, description }],
--      "classifications": {
--        "diagnostic": ["structurable", "non_financable", "compromis"],
--        "monitoring": ["sain", "alerte", "pre_douteux", "douteux", "compromis"]
--      },
--      "livrables_credit_readiness": [{ code, label, ordre, requis }],
--      "pipeline_statuts": [{ code, label, ordre }],
--      "pipeline_views_per_role": {
--        "conseiller_pme": [{ label, statuts, color }],
--        "analyste_credit": [...],
--        "directeur_pme": [...]
--      },
--      "monitoring_seuils": { "retard_alerte_jours", "retard_pre_douteux_jours", ... },
--      "montee_en_gamme_rules": [{ from_produit, to_produit, conditions }],
--      "roles_labels": { "conseiller_pme": "Conseiller PME", ... },
--      "note_credit_sections": [{ code, label, ordre, prompt_template }]
--    }
-- ============================================================
ALTER TABLE organization_presets ADD COLUMN IF NOT EXISTS config_banque JSONB;


-- ============================================================
-- 2. Créer funding_lines
--    Une ligne DFI = une enveloppe de financement (BAD, IFC, Proparco, GUDE-PME...)
--    avec capacité totale et tracking d'utilisation. Référencée par dossier
--    via deliverables / decaissements quand un crédit est décaissé sur cette ligne.
--
--    capacite_totale et montant_deploye sont stockés dans la devise de la ligne
--    (peut différer de la devise de l'org : EUR pour BAD/IFC, FCFA pour GUDE).
--    devise est nullable — si NULL on retombe sur la devise de l'org.
-- ============================================================
CREATE TABLE IF NOT EXISTS funding_lines (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  code TEXT NOT NULL,                          -- ex: "BAD_FEMININ", "IFC_50", "GUDE_PME"
  label TEXT NOT NULL,                         -- ex: "Ligne BAD — entreprises féminines"
  type TEXT NOT NULL CHECK (type IN ('dfi', 'fonds_propres', 'garantie', 'programme')),

  bailleur TEXT,                               -- ex: "BAD", "IFC", "Proparco", "FMO"
  devise TEXT,                                 -- nullable (fallback org devise)
  capacite_totale NUMERIC,                     -- en devise de la ligne
  montant_deploye NUMERIC DEFAULT 0,           -- mis à jour à chaque décaissement

  -- Critères structurés (cibles, exclusions, seuils)
  criteres_eligibilite JSONB,                  -- ex: { "secteur": [...], "ticket_min": 200000000, "genre_dirigeant": "F" }

  -- KPIs ESG/Impact à reporter (varient par bailleur)
  kpi_a_reporter TEXT[],                       -- ex: ['emplois_crees', 'femmes_dirigeantes', 'co2_evite']

  taux_partage_risque NUMERIC,                 -- ex: 0.50 pour IFC partage 50%, NULL si pas de partage
  taux_preferentiel NUMERIC,                   -- taux d'intérêt indicatif si applicable

  is_active BOOLEAN DEFAULT true,
  metadata JSONB,                              -- libre pour overrides custom

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(organization_id, code)
);

CREATE INDEX IF NOT EXISTS idx_funding_lines_org ON funding_lines(organization_id) WHERE is_active = true;

ALTER TABLE funding_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "funding_lines_org_member" ON funding_lines
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );


-- ============================================================
-- 3. Étendre enterprises avec colonnes spécifiques banque
--    source_acquisition : par quel canal la PME est arrivée (libre, mappé sur
--                         config_banque.canaux_acquisition[].code)
--    banque_metadata    : tout ce qui est calculé/saisi pour le diagnostic et le suivi
--                         (ratios Cercle 1, constats Cercle 2 saisis, classification,
--                         pipeline_status, dossier_credit_id, encours_actuel...)
--
--    Ces colonnes sont nullables — invisibles pour les segments programme/pe/banque_affaires.
-- ============================================================
ALTER TABLE enterprises ADD COLUMN IF NOT EXISTS source_acquisition TEXT;
ALTER TABLE enterprises ADD COLUMN IF NOT EXISTS banque_metadata JSONB;


-- ============================================================
-- 4. Créer credit_dossiers
--    Un dossier de crédit = une demande de financement par une PME pour un produit donné.
--    Distinct d'enterprises pour permettre plusieurs dossiers par PME (renouvellement,
--    nouveau crédit, montée en gamme).
--
--    Le statut canonique du dossier dans le pipeline. Les vues kanban par rôle
--    (config_banque.pipeline_views_per_role) groupent ces statuts différemment.
-- ============================================================
CREATE TABLE IF NOT EXISTS credit_dossiers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  enterprise_id UUID NOT NULL REFERENCES enterprises(id) ON DELETE CASCADE,

  numero TEXT,                                 -- ex: "NSIA-2026-042", libre par org
  montant_demande NUMERIC,
  devise TEXT,                                 -- nullable (fallback org devise)
  duree_mois INTEGER,
  type_credit TEXT,                            -- ex: "investissement", "tresorerie", "decouvert"

  -- Statut canonique pipeline (référence config_banque.pipeline_statuts[].code)
  pipeline_status TEXT NOT NULL DEFAULT 'accueil',

  -- Classification après diagnostic (config_banque.classifications.diagnostic)
  classification_diagnostic TEXT,
  -- Classification monitoring (config_banque.classifications.monitoring)
  classification_monitoring TEXT,

  -- Affectation
  conseiller_id UUID REFERENCES auth.users(id),
  analyste_id UUID REFERENCES auth.users(id),

  -- Ligne DFI/produit retenu (renseigné après matching)
  produit_retenu_code TEXT,                    -- ex: "GUDE_PME"
  funding_line_id UUID REFERENCES funding_lines(id),

  -- Montants après décaissement
  montant_decaisse NUMERIC,
  date_decaissement DATE,
  encours_actuel NUMERIC,
  retard_jours INTEGER DEFAULT 0,

  metadata JSONB,                              -- libre (canal, notes, etc.)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_credit_dossiers_org ON credit_dossiers(organization_id);
CREATE INDEX IF NOT EXISTS idx_credit_dossiers_enterprise ON credit_dossiers(enterprise_id);
CREATE INDEX IF NOT EXISTS idx_credit_dossiers_status ON credit_dossiers(organization_id, pipeline_status);

ALTER TABLE credit_dossiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "credit_dossiers_org_member" ON credit_dossiers
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );


-- ============================================================
-- 5. Trigger updated_at sur les nouvelles tables
-- ============================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS funding_lines_set_updated_at ON funding_lines;
CREATE TRIGGER funding_lines_set_updated_at
  BEFORE UPDATE ON funding_lines
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS credit_dossiers_set_updated_at ON credit_dossiers;
CREATE TRIGGER credit_dossiers_set_updated_at
  BEFORE UPDATE ON credit_dossiers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ============================================================
-- Fin migration banque (3.B.1).
-- Les seeds NSIA et Atlantique vivent dans supabase/seeds/preset_*.json
-- et sont chargés par scripts/seed_banque.sql (à venir).
-- ============================================================
