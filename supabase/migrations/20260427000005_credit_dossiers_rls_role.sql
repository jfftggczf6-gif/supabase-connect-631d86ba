-- ===========================================================================
-- Affine la RLS sur credit_dossiers selon le rôle banque (Phase 3.B.3).
--
-- AVANT : un seul policy FOR ALL exposait tous les dossiers de l'org à tout
--         membre actif (correct pour directeur, mais trop large pour
--         conseiller/analyste qui doivent voir leur scope).
--
-- APRÈS :
--   SELECT  → filtré selon rôle :
--               directeur/admin/manager → tout l'org
--               analyste_credit         → dossiers des conseillers de ses équipes
--               conseiller_pme          → ses propres dossiers (conseiller_id = auth.uid())
--   INSERT/UPDATE/DELETE → réservés aux rôles "manager+" de l'org banque
--                          (les écritures massives passent côté admin/back-office,
--                          pas côté conseiller)
--
-- NB : 'directeur_pme' et 'direction_pme' sont tous deux acceptés pour la
-- transition de nommage (cf migration 20260427000004).
-- ===========================================================================

DROP POLICY IF EXISTS "credit_dossiers_org_member" ON credit_dossiers;

-- SELECT : 3 OR pour couvrir les 3 rôles + admin/owner/manager
CREATE POLICY "credit_dossiers_select_by_role" ON credit_dossiers
FOR SELECT USING (
  -- Vue globale org : owner/admin/manager + Direction PME
  organization_id IN (
    SELECT om.organization_id FROM organization_members om
    WHERE om.user_id = auth.uid() AND om.is_active = true
      AND om.role IN ('owner','admin','manager','direction_pme','directeur_pme')
  )
  OR
  -- Analyste : dossiers des conseillers de ses équipes
  conseiller_id IN (
    SELECT btm.user_id
    FROM bank_team_members btm
    JOIN bank_teams bt ON bt.id = btm.team_id
    WHERE bt.lead_user_id = auth.uid() AND bt.is_active = true
  )
  OR
  -- Conseiller : ses propres dossiers
  conseiller_id = auth.uid()
);

-- WRITE : org-admin uniquement pour INSERT/UPDATE/DELETE en masse.
-- Les UPDATE ciblés (ex: changer pipeline_status) sont traités via edge functions
-- qui utilisent le service_role (bypass RLS) après avoir vérifié les permissions
-- métier dans le code.
CREATE POLICY "credit_dossiers_write_admin" ON credit_dossiers
FOR INSERT WITH CHECK (
  organization_id IN (
    SELECT om.organization_id FROM organization_members om
    WHERE om.user_id = auth.uid() AND om.is_active = true
      AND om.role IN ('owner','admin','manager','direction_pme','directeur_pme','analyste_credit','conseiller_pme')
  )
);

CREATE POLICY "credit_dossiers_update_role" ON credit_dossiers
FOR UPDATE USING (
  organization_id IN (
    SELECT om.organization_id FROM organization_members om
    WHERE om.user_id = auth.uid() AND om.is_active = true
      AND om.role IN ('owner','admin','manager','direction_pme','directeur_pme','analyste_credit','conseiller_pme')
  )
);

CREATE POLICY "credit_dossiers_delete_admin" ON credit_dossiers
FOR DELETE USING (
  organization_id IN (
    SELECT om.organization_id FROM organization_members om
    WHERE om.user_id = auth.uid() AND om.is_active = true
      AND om.role IN ('owner','admin','manager','direction_pme','directeur_pme')
  )
);
