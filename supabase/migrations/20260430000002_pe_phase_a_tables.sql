-- ===========================================================================
-- Migration : Phase A Foundation PE — Tables, triggers, helpers, RLS
-- Fichier compagnon de 20260430000001_pe_phase_a_enums.sql
-- ===========================================================================

-- 1. Étendre organizations avec le code utilisé pour generer les deal_ref
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS code VARCHAR(6);

-- 2. Table pe_deals : un deal = un cycle d'investissement sur une enterprise
CREATE TABLE IF NOT EXISTS pe_deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  enterprise_id UUID REFERENCES enterprises(id) ON DELETE SET NULL,
  deal_ref TEXT NOT NULL,
  stage pe_deal_stage NOT NULL DEFAULT 'sourcing',
  lead_analyst_id UUID REFERENCES auth.users(id),
  ticket_demande NUMERIC,
  currency TEXT DEFAULT 'EUR',
  source pe_deal_source DEFAULT 'autre',
  source_detail TEXT,
  score_360 INTEGER,
  lost_reason TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (organization_id, deal_ref)
);

CREATE INDEX IF NOT EXISTS idx_pe_deals_org_stage ON pe_deals(organization_id, stage);
CREATE INDEX IF NOT EXISTS idx_pe_deals_lead_analyst ON pe_deals(lead_analyst_id);
CREATE INDEX IF NOT EXISTS idx_pe_deals_enterprise ON pe_deals(enterprise_id);

-- 3. Table pe_team_assignments : mapping IM ↔ Analyste (M-to-N)
CREATE TABLE IF NOT EXISTS pe_team_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  im_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  analyst_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT true,
  assigned_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (organization_id, im_user_id, analyst_user_id)
);

CREATE INDEX IF NOT EXISTS idx_pe_team_im ON pe_team_assignments(im_user_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_pe_team_analyst ON pe_team_assignments(analyst_user_id) WHERE is_active = true;

-- 4. Table pe_deal_history : audit des transitions de stage
CREATE TABLE IF NOT EXISTS pe_deal_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES pe_deals(id) ON DELETE CASCADE,
  from_stage pe_deal_stage,
  to_stage pe_deal_stage NOT NULL,
  changed_by UUID REFERENCES auth.users(id),
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pe_deal_history_deal ON pe_deal_history(deal_id, created_at DESC);

-- 5. Trigger : auto-génère deal_ref {ORG_CODE}-{YEAR}-{SEQ}
CREATE OR REPLACE FUNCTION generate_pe_deal_ref() RETURNS TRIGGER AS $$
DECLARE
  org_code TEXT;
  year_str TEXT;
  seq_num INTEGER;
BEGIN
  IF NEW.deal_ref IS NULL OR NEW.deal_ref = '' THEN
    SELECT COALESCE(code, 'DEAL') INTO org_code FROM organizations WHERE id = NEW.organization_id;
    year_str := to_char(now(), 'YYYY');
    SELECT COALESCE(MAX(CAST(split_part(deal_ref, '-', 3) AS INTEGER)), 0) + 1
      INTO seq_num
      FROM pe_deals
      WHERE organization_id = NEW.organization_id
        AND deal_ref LIKE org_code || '-' || year_str || '-%';
    NEW.deal_ref := org_code || '-' || year_str || '-' || lpad(seq_num::text, 3, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS pe_deals_generate_ref ON pe_deals;
CREATE TRIGGER pe_deals_generate_ref
  BEFORE INSERT ON pe_deals
  FOR EACH ROW EXECUTE FUNCTION generate_pe_deal_ref();

-- 6. Trigger : enterprise_id requis dès stage > sourcing, lost_reason requis si stage=lost
CREATE OR REPLACE FUNCTION enforce_pe_deal_invariants() RETURNS TRIGGER AS $$
BEGIN
  -- enterprise_id requis sauf au sourcing ou si on marque le deal lost
  IF NEW.stage NOT IN ('sourcing', 'lost') AND NEW.enterprise_id IS NULL THEN
    RAISE EXCEPTION 'enterprise_id requis dès le stage pre_screening (deal %)', NEW.deal_ref USING ERRCODE = '23514';
  END IF;
  IF NEW.stage = 'lost' AND (NEW.lost_reason IS NULL OR trim(NEW.lost_reason) = '') THEN
    RAISE EXCEPTION 'lost_reason requis quand stage=lost (deal %)', NEW.deal_ref USING ERRCODE = '23514';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS pe_deals_enforce_invariants ON pe_deals;
CREATE TRIGGER pe_deals_enforce_invariants
  BEFORE INSERT OR UPDATE ON pe_deals
  FOR EACH ROW EXECUTE FUNCTION enforce_pe_deal_invariants();

-- 7. Trigger audit : trace tout changement de stage dans pe_deal_history
CREATE OR REPLACE FUNCTION track_pe_deal_stage_change() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.pe_deal_history (deal_id, from_stage, to_stage, changed_by, reason)
    VALUES (NEW.id, NULL, NEW.stage, NEW.created_by, NULL);
  ELSIF TG_OP = 'UPDATE' AND OLD.stage IS DISTINCT FROM NEW.stage THEN
    INSERT INTO public.pe_deal_history (deal_id, from_stage, to_stage, changed_by, reason)
    VALUES (NEW.id, OLD.stage, NEW.stage,
            (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb->>'sub')::uuid,
            CASE WHEN NEW.stage = 'lost' THEN NEW.lost_reason ELSE NULL END);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

DROP TRIGGER IF EXISTS pe_deals_track_stage ON pe_deals;
CREATE TRIGGER pe_deals_track_stage
  AFTER INSERT OR UPDATE ON pe_deals
  FOR EACH ROW EXECUTE FUNCTION track_pe_deal_stage_change();

-- 8. Helper : true si user est MD/owner/admin de l'org
CREATE OR REPLACE FUNCTION is_pe_md_or_owner(p_org_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = p_org_id
      AND user_id = p_user_id
      AND is_active = true
      AND role IN ('owner', 'admin', 'managing_director')
  )
  OR public.has_role(p_user_id, 'super_admin'::public.app_role);
$$;

-- 9. Helper : true si im_user supervise analyst_user dans cette org
CREATE OR REPLACE FUNCTION is_supervising_analyst(p_org_id UUID, p_im_user UUID, p_analyst_user UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.pe_team_assignments
    WHERE organization_id = p_org_id
      AND im_user_id = p_im_user
      AND analyst_user_id = p_analyst_user
      AND is_active = true
  );
$$;

-- 10. Helper : true si user peut voir le deal
CREATE OR REPLACE FUNCTION can_see_pe_deal(p_deal_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.pe_deals d
    WHERE d.id = p_deal_id
      AND (
        d.lead_analyst_id = p_user_id
        OR public.is_pe_md_or_owner(d.organization_id, p_user_id)
        OR EXISTS (
          SELECT 1 FROM public.pe_team_assignments t
          WHERE t.organization_id = d.organization_id
            AND t.im_user_id = p_user_id
            AND t.analyst_user_id = d.lead_analyst_id
            AND t.is_active = true
        )
      )
  );
$$;

-- 11. Helper : retourne le rôle de l'utilisateur dans l'org
CREATE OR REPLACE FUNCTION get_pe_role(p_org_id UUID, p_user_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT role::text FROM public.organization_members
  WHERE organization_id = p_org_id AND user_id = p_user_id AND is_active = true
  LIMIT 1;
$$;

-- 12. RLS sur pe_deals
ALTER TABLE pe_deals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pe_deals_select" ON pe_deals;
CREATE POLICY "pe_deals_select" ON pe_deals
  FOR SELECT USING (can_see_pe_deal(id, auth.uid()));

DROP POLICY IF EXISTS "pe_deals_insert" ON pe_deals;
CREATE POLICY "pe_deals_insert" ON pe_deals
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_id = pe_deals.organization_id
        AND user_id = auth.uid()
        AND is_active = true
        AND role IN ('owner', 'admin', 'managing_director', 'investment_manager', 'analyst')
    )
  );

DROP POLICY IF EXISTS "pe_deals_update" ON pe_deals;
CREATE POLICY "pe_deals_update" ON pe_deals
  FOR UPDATE USING (can_see_pe_deal(id, auth.uid()))
  WITH CHECK (can_see_pe_deal(id, auth.uid()));

-- 13. RLS sur pe_team_assignments
ALTER TABLE pe_team_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pe_team_select" ON pe_team_assignments;
CREATE POLICY "pe_team_select" ON pe_team_assignments
  FOR SELECT USING (
    is_pe_md_or_owner(organization_id, auth.uid())
    OR im_user_id = auth.uid()
    OR im_user_id IN (
      SELECT t.im_user_id FROM pe_team_assignments t
      WHERE t.analyst_user_id = auth.uid() AND t.is_active = true
    )
  );

DROP POLICY IF EXISTS "pe_team_modify" ON pe_team_assignments;
CREATE POLICY "pe_team_modify" ON pe_team_assignments
  FOR ALL USING (is_pe_md_or_owner(organization_id, auth.uid()))
  WITH CHECK (is_pe_md_or_owner(organization_id, auth.uid()));

-- 14. RLS sur pe_deal_history
ALTER TABLE pe_deal_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pe_deal_history_select" ON pe_deal_history;
CREATE POLICY "pe_deal_history_select" ON pe_deal_history
  FOR SELECT USING (can_see_pe_deal(deal_id, auth.uid()));
