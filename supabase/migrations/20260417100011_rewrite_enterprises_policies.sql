-- ============================================================================
-- Phase 1B — Migration 11 : Réécriture des policies enterprises
-- coach_id → is_coach_of_enterprise() + ajout org check
-- ============================================================================

-- Drop les anciennes policies enterprises
DROP POLICY IF EXISTS "Coaches see assigned enterprises" ON public.enterprises;
DROP POLICY IF EXISTS "Coaches can update assigned enterprises" ON public.enterprises;
DROP POLICY IF EXISTS "Coaches can delete assigned enterprises" ON public.enterprises;
DROP POLICY IF EXISTS "Entrepreneurs see own enterprises" ON public.enterprises;
DROP POLICY IF EXISTS "Entrepreneurs can create enterprises" ON public.enterprises;
DROP POLICY IF EXISTS "Entrepreneurs can update own enterprises" ON public.enterprises;
DROP POLICY IF EXISTS "Chef programme can view all enterprises" ON public.enterprises;
-- Préserver les policies super_admin (elles restent valides)

-- Nouvelles policies enterprises
-- Coach voit ses entreprises assignées (N-à-N via enterprise_coaches + fallback coach_id)
CREATE POLICY "Coaches see assigned enterprises v2"
  ON public.enterprises FOR SELECT TO authenticated
  USING (public.is_coach_of_enterprise(id));

-- Coach update ses entreprises assignées
CREATE POLICY "Coaches update assigned enterprises v2"
  ON public.enterprises FOR UPDATE TO authenticated
  USING (public.is_coach_of_enterprise(id));

-- Coach delete ses entreprises assignées
CREATE POLICY "Coaches delete assigned enterprises v2"
  ON public.enterprises FOR DELETE TO authenticated
  USING (public.is_coach_of_enterprise(id));

-- Entrepreneur voit son entreprise + check org
CREATE POLICY "Entrepreneurs see own enterprises v2"
  ON public.enterprises FOR SELECT TO authenticated
  USING (auth.uid() = user_id AND public.is_member_of(organization_id));

-- Entrepreneur crée une entreprise dans son org
CREATE POLICY "Entrepreneurs create enterprises v2"
  ON public.enterprises FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.is_member_of(organization_id));

-- Entrepreneur update son entreprise
CREATE POLICY "Entrepreneurs update own enterprises v2"
  ON public.enterprises FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND public.is_member_of(organization_id));

-- Manager de l'org voit toutes les entreprises (remplace "Chef programme can view all")
CREATE POLICY "Managers see all org enterprises"
  ON public.enterprises FOR SELECT TO authenticated
  USING (
    public.is_member_of(organization_id)
    AND public.get_user_role_in(organization_id) IN ('owner', 'admin', 'manager', 'analyst')
  );
