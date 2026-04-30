-- ===========================================================================
-- RLS sur enterprises pour les rôles banque (Phase 3.B.3).
--
-- Les RLS existantes (Managers, SA, Coaches, Entrepreneurs) couvrent les
-- segments programme/PE mais pas les nouveaux rôles banque. Cette migration
-- ajoute 3 policies SELECT additives :
--   conseiller_pme  → enterprises liées à ses dossiers de crédit
--   analyste_credit → enterprises liées aux dossiers de ses équipes
--   directeur_pme   → toutes les enterprises de l'org
--
-- Les policies sont OR avec les existantes (pas de remplacement).
-- ===========================================================================

-- Conseiller : enterprises avec un credit_dossier où conseiller_id = auth.uid()
CREATE POLICY "Conseiller sees own dossier enterprises" ON enterprises
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM credit_dossiers cd
    WHERE cd.enterprise_id = enterprises.id
      AND cd.conseiller_id = auth.uid()
  )
);

-- Analyste : enterprises avec un credit_dossier dont le conseiller appartient à une de mes équipes
CREATE POLICY "Analyste sees team dossier enterprises" ON enterprises
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM credit_dossiers cd
    JOIN bank_team_members btm ON btm.user_id = cd.conseiller_id
    JOIN bank_teams bt ON bt.id = btm.team_id
    WHERE cd.enterprise_id = enterprises.id
      AND bt.lead_user_id = auth.uid()
      AND bt.is_active = true
  )
);

-- Directeur PME : toutes les enterprises de l'org
CREATE POLICY "Directeur PME sees all org enterprises" ON enterprises
FOR SELECT USING (
  organization_id IN (
    SELECT organization_id FROM organization_members
    WHERE user_id = auth.uid() AND is_active = true
      AND role IN ('directeur_pme','direction_pme')
  )
);
