-- ============================================================================
-- PE — Étendre la RLS enterprises aux rôles managing_director / investment_manager
-- ============================================================================
-- La policy "Managers see all org enterprises" autorisait owner/admin/
-- manager/analyst, mais pas les rôles PE (managing_director, investment_manager).
-- Conséquence : K. N'Guessan (MD Adiwale) ne pouvait pas voir les entreprises
-- de son fonds → header du deal vide (enterprise_name/country/sector tous null).
--
-- On élargit la policy pour inclure les 2 rôles PE manquants.
-- ============================================================================

DROP POLICY IF EXISTS "Managers see all org enterprises" ON enterprises;

CREATE POLICY "Managers see all org enterprises" ON enterprises FOR SELECT
USING (
  is_member_of(organization_id)
  AND get_user_role_in(organization_id) = ANY (ARRAY[
    'owner', 'admin', 'manager',
    'managing_director', 'investment_manager',
    'analyst'
  ])
);
