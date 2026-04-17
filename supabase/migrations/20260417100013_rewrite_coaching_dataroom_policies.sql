-- ============================================================================
-- Phase 1B — Migration 13 : Réécriture policies coaching_notes, coach_uploads, data_room
-- ============================================================================

-- ═══ COACHING_NOTES ═══
-- Règle métier 13 : coaches assignés partagent les notes,
-- chef de programme voit si visible_chef_programme=true,
-- entrepreneur ne voit JAMAIS
DROP POLICY IF EXISTS "Coaches can manage coaching notes for their enterprises" ON public.coaching_notes;
DROP POLICY IF EXISTS "Super admin can select all coaching_notes" ON public.coaching_notes;

CREATE POLICY "Coaching notes access v2"
  ON public.coaching_notes FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin'::public.app_role)
    OR (
      public.is_member_of(organization_id) AND (
        -- Coach assigné à l'entreprise (tous les coaches partagent les notes)
        public.is_coach_of_enterprise(enterprise_id)
        -- Manager/admin/owner voit les notes si visible_chef_programme=true
        OR (
          public.get_user_role_in(organization_id) IN ('owner', 'admin', 'manager')
          AND (visible_chef_programme = true OR coach_id = auth.uid())
        )
      )
    )
  );

-- ═══ COACH_UPLOADS ═══
DROP POLICY IF EXISTS "Coaches see own uploads" ON public.coach_uploads;
DROP POLICY IF EXISTS "Coaches insert own uploads" ON public.coach_uploads;
DROP POLICY IF EXISTS "Coaches delete own uploads" ON public.coach_uploads;
DROP POLICY IF EXISTS "Super admin can select all coach_uploads" ON public.coach_uploads;

CREATE POLICY "Coach uploads select v2"
  ON public.coach_uploads FOR SELECT TO public
  USING (
    public.has_role(auth.uid(), 'super_admin'::public.app_role)
    OR (public.is_member_of(organization_id) AND (
      coach_id = auth.uid()
      OR public.is_coach_of_enterprise(enterprise_id)
      OR public.get_user_role_in(organization_id) IN ('owner', 'admin', 'manager')
    ))
  );

CREATE POLICY "Coach uploads insert v2"
  ON public.coach_uploads FOR INSERT TO public
  WITH CHECK (
    public.is_member_of(organization_id)
    AND coach_id = auth.uid()
    AND public.is_coach_of_enterprise(enterprise_id)
  );

CREATE POLICY "Coach uploads delete v2"
  ON public.coach_uploads FOR DELETE TO public
  USING (
    public.is_member_of(organization_id)
    AND coach_id = auth.uid()
  );

-- ═══ DATA_ROOM_DOCUMENTS ═══
DROP POLICY IF EXISTS "Users can view data_room_documents of own enterprises" ON public.data_room_documents;
DROP POLICY IF EXISTS "Users can insert data_room_documents for own enterprises" ON public.data_room_documents;
DROP POLICY IF EXISTS "Users can update data_room_documents of own enterprises" ON public.data_room_documents;
DROP POLICY IF EXISTS "Users can delete data_room_documents of own enterprises" ON public.data_room_documents;
DROP POLICY IF EXISTS "Super admin can select all data_room_documents" ON public.data_room_documents;

CREATE POLICY "Data room docs access v2"
  ON public.data_room_documents FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin'::public.app_role)
    OR (
      public.is_member_of(organization_id) AND EXISTS (
        SELECT 1 FROM public.enterprises e
        WHERE e.id = data_room_documents.enterprise_id
          AND (public.is_coach_of_enterprise(e.id) OR e.user_id = auth.uid())
      )
    )
  );

-- ═══ DATA_ROOM_SHARES ═══
DROP POLICY IF EXISTS "Users can view data_room_shares of own enterprises" ON public.data_room_shares;
DROP POLICY IF EXISTS "Users can insert data_room_shares for own enterprises" ON public.data_room_shares;
DROP POLICY IF EXISTS "Users can delete data_room_shares of own enterprises" ON public.data_room_shares;
DROP POLICY IF EXISTS "Super admin can select all data_room_shares" ON public.data_room_shares;

CREATE POLICY "Data room shares access v2"
  ON public.data_room_shares FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin'::public.app_role)
    OR (
      public.is_member_of(organization_id) AND EXISTS (
        SELECT 1 FROM public.enterprises e
        WHERE e.id = data_room_shares.enterprise_id
          AND (public.is_coach_of_enterprise(e.id) OR e.user_id = auth.uid())
      )
    )
  );
