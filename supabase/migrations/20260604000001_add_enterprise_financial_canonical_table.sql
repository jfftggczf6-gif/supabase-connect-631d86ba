-- ============================================================================
-- enterprise_financial_canonical — Single Source of Truth des chiffres financiers
-- ============================================================================
-- Brief 0.5 (refonte SSOT). Cette table résout le problème observé sur Savoki :
-- chaque agent IA (plan_financier, valuation, memo, onepager...) faisait ses
-- propres calculs en silos → divergences (WACC 25% BP vs 60.3% Valuation,
-- médiane 113k Memo vs 142k, TRI 153% + Runway 0.8 mois...).
--
-- À partir de cette table :
--   - generate-plan-financier écrit les projections + composition besoin
--   - generate-valuation écrit le WACC + valorisations DCF/multiples
--   - generate-memo, generate-onepager, generate-business-plan LISENT
--     uniquement, jamais ne recalculent.
--
-- RLS : SELECT autorisé pour owner / coach / org_member. INSERT/UPDATE
-- réservés au service_role (les Edge Functions agissent en service_role).
-- ============================================================================

CREATE TABLE public.enterprise_financial_canonical (
  enterprise_id uuid PRIMARY KEY REFERENCES public.enterprises(id) ON DELETE CASCADE,

  -- ─── DEVISE & CONTEXTE ───────────────────────────────────────────
  currency text NOT NULL,
  currency_iso text NOT NULL,
  base_year int NOT NULL,
  zone_monetaire text,

  -- ─── HISTORIQUE Y-2, Y-1, Y0 ─────────────────────────────────────
  ca_y_minus_2 numeric,
  ca_y_minus_1 numeric,
  ca_y numeric,
  ebitda_y_minus_2 numeric,
  ebitda_y_minus_1 numeric,
  ebitda_y numeric,
  resultat_net_y_minus_2 numeric,
  resultat_net_y_minus_1 numeric,
  resultat_net_y numeric,
  tresorerie_actuelle numeric,
  dette_financiere_actuelle numeric,
  capitaux_propres_actuels numeric,

  -- ─── PROJECTIONS Y+1 à Y+5 ───────────────────────────────────────
  -- JSONB { "y1": ..., "y2": ..., "y3": ..., "y4": ..., "y5": ... }
  ca_projected jsonb,
  ebitda_projected jsonb,
  cashflow_projected jsonb,
  resultat_net_projected jsonb,
  inflation_used numeric,

  -- ─── VALORISATION (écrit par generate-valuation uniquement) ──────
  wacc_pct numeric,
  wacc_components jsonb,
  wacc_capped boolean DEFAULT false,
  wacc_raw numeric,
  equity_value_dcf numeric,
  enterprise_value_dcf numeric,
  terminal_value numeric,
  multiple_ebitda_retenu numeric,
  multiple_ca_retenu numeric,
  valeur_par_ebitda numeric,
  valeur_par_ca numeric,
  valorisation_basse numeric,
  valorisation_mediane numeric,
  valorisation_haute numeric,
  methode_privilegiee text,

  -- ─── INVESTISSEMENT ──────────────────────────────────────────────
  besoin_financement_total numeric,
  capex_prevu numeric,
  bfr_initial numeric,
  restructuration_dette numeric,
  financement_deja_obtenu numeric,
  composition_besoin jsonb,

  -- ─── INDICATEURS DE DÉCISION ─────────────────────────────────────
  van numeric,
  tri_pct numeric,
  payback_years numeric,
  dscr_moyen numeric,
  duree_pret_utilisee_dscr numeric,
  roi_pct numeric,
  runway_mois numeric,
  couverture_interets numeric,
  cycle_tresorerie_jours numeric,

  -- ─── MÉTADONNÉES ─────────────────────────────────────────────────
  last_updated_by text NOT NULL,
  last_updated_at timestamptz NOT NULL DEFAULT NOW(),
  version int NOT NULL DEFAULT 1,
  source_deliverables jsonb,

  -- ─── VALIDATION COHÉRENCE (rempli par brief 0.12) ────────────────
  coherence_validated boolean DEFAULT false,
  coherence_warnings jsonb,
  coherence_last_check_at timestamptz,

  -- ─── CONTRAINTES DE COHÉRENCE NUMÉRIQUE ──────────────────────────
  CONSTRAINT chk_wacc_range CHECK (wacc_pct IS NULL OR (wacc_pct >= 0 AND wacc_pct <= 100)),
  CONSTRAINT chk_tri_range CHECK (tri_pct IS NULL OR (tri_pct >= -100 AND tri_pct <= 500)),
  CONSTRAINT chk_payback_positive CHECK (payback_years IS NULL OR payback_years >= 0)
);

COMMENT ON TABLE public.enterprise_financial_canonical IS
'Single Source of Truth des chiffres financiers d''une entreprise. Écrit par generate-plan-financier (projections+invest) et generate-valuation (WACC+valos). Lu par tous les autres agents IA.';

CREATE INDEX idx_efc_enterprise ON public.enterprise_financial_canonical(enterprise_id);
CREATE INDEX idx_efc_updated ON public.enterprise_financial_canonical(last_updated_at DESC);

-- ─── ROW LEVEL SECURITY ──────────────────────────────────────────────
ALTER TABLE public.enterprise_financial_canonical ENABLE ROW LEVEL SECURITY;

CREATE POLICY efc_select_own_or_coach ON public.enterprise_financial_canonical
FOR SELECT TO authenticated
USING (
  -- Propriétaire de l'entreprise
  enterprise_id IN (SELECT id FROM public.enterprises WHERE user_id = auth.uid())
  -- Coach assigné (N-N)
  OR enterprise_id IN (
    SELECT enterprise_id FROM public.enterprise_coaches
    WHERE coach_id = auth.uid() AND is_active = true
  )
  -- Membre actif de l'organisation
  OR enterprise_id IN (
    SELECT e.id FROM public.enterprises e
    JOIN public.organization_members om ON om.organization_id = e.organization_id
    WHERE om.user_id = auth.uid() AND om.is_active = true
  )
);

-- Pas de policy INSERT/UPDATE pour authenticated → service_role uniquement.
-- Les Edge Functions utilisent SUPABASE_SERVICE_ROLE_KEY pour écrire.

-- ─── TRIGGER : versioning + last_updated_at automatique ─────────────
CREATE OR REPLACE FUNCTION public.update_efc_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_updated_at = NOW();
  NEW.version = COALESCE(OLD.version, 0) + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_efc_update_timestamp
BEFORE UPDATE ON public.enterprise_financial_canonical
FOR EACH ROW EXECUTE FUNCTION public.update_efc_timestamp();

COMMENT ON FUNCTION public.update_efc_timestamp IS
'Bump version + last_updated_at automatiquement à chaque UPDATE.';
