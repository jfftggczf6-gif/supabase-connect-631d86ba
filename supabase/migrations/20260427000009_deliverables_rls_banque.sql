-- ===========================================================================
-- RLS sur deliverables pour les rôles banque (Phase 3.B.3 — workflow review).
--
-- Mirror des policies enterprises_rls_banque : un user banque voit les
-- deliverables des enterprises dans son périmètre (conseiller→ses dossiers,
-- analyste→ses équipes, directeur→toute l'org).
--
-- Les UPDATE de validation_status passent par l'edge function deliverable-workflow
-- qui utilise le service_role (bypass RLS), donc on n'ajoute PAS de policies
-- WRITE supplémentaires : les WRITE existantes (Users update v2) couvrent les
-- cas Programme et le service_role bypass tout pour les workflows banque.
-- ===========================================================================

-- Conseiller : deliverables des entreprises liées à ses dossiers de crédit
CREATE POLICY "Conseiller sees own dossier deliverables" ON deliverables
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM credit_dossiers cd
    WHERE cd.enterprise_id = deliverables.enterprise_id
      AND cd.conseiller_id = auth.uid()
  )
);

-- Analyste : deliverables des dossiers de ses équipes
CREATE POLICY "Analyste sees team dossier deliverables" ON deliverables
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM credit_dossiers cd
    JOIN bank_team_members btm ON btm.user_id = cd.conseiller_id
    JOIN bank_teams bt ON bt.id = btm.team_id
    WHERE cd.enterprise_id = deliverables.enterprise_id
      AND bt.lead_user_id = auth.uid()
      AND bt.is_active = true
  )
);

-- Directeur PME : deliverables de toutes les enterprises de l'org
CREATE POLICY "Directeur PME sees all org deliverables" ON deliverables
FOR SELECT USING (
  organization_id IN (
    SELECT organization_id FROM organization_members
    WHERE user_id = auth.uid() AND is_active = true
      AND role IN ('directeur_pme','direction_pme')
  )
);
