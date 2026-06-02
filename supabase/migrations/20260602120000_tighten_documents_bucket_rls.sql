-- ============================================================================
-- Tighten RLS on storage.objects for bucket 'documents'
-- ============================================================================
-- Problème détecté pendant l'investigation de Bug 2 (Savoki, suppression
-- silencieuse) : les 4 policies sur le bucket 'documents' avaient comme seule
-- condition `bucket_id = 'documents'`. Donc tout utilisateur authentifié
-- pouvait DELETE/UPDATE/INSERT/SELECT n'importe quel fichier de n'importe
-- quelle entreprise s'il connaissait le path.
--
-- Path conventions observées dans le bucket 'documents' (audit prod 2026-06-02) :
--   1. `{enterprise_id}/...` (cas Reconstruction, gros volume)
--      → accès = owner/coach/org_member/super_admin de l'enterprise
--   2. `programme-criteria/{programme_criteria_id}.pdf` (10 fichiers)
--      → accès = membre actif de l'organization qui possède le criteria
--
-- Cette migration crée :
--   - `public.has_role_enterprise_access(uuid)` : helper d'accès enterprise
--   - `public.can_access_documents_object(text)` : helper dispatch par path
--   - 4 nouvelles policies sur bucket 'documents' utilisant ce helper
-- ============================================================================

-- Helper d'accès enterprise (matche helpers_v5.verifyAndGetContext)
CREATE OR REPLACE FUNCTION public.has_enterprise_access(_enterprise_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT _enterprise_id IS NOT NULL AND (
    EXISTS (
      SELECT 1 FROM enterprises e
      WHERE e.id = _enterprise_id
        AND (
          e.user_id = auth.uid()
          OR e.coach_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM enterprise_coaches ec
            WHERE ec.enterprise_id = e.id
              AND ec.coach_id = auth.uid()
              AND ec.is_active = true
          )
          OR (
            e.organization_id IS NOT NULL
            AND EXISTS (
              SELECT 1 FROM organization_members om
              WHERE om.organization_id = e.organization_id
                AND om.user_id = auth.uid()
                AND om.is_active = true
            )
          )
        )
    )
    OR public.has_role(auth.uid(), 'super_admin'::app_role)
  );
$$;

COMMENT ON FUNCTION public.has_enterprise_access IS
'Returns true if calling user is owner / coach (legacy or N-N) / org member / super_admin of the enterprise.';

-- Helper d'accès dispatch pour les objets storage du bucket 'documents'
CREATE OR REPLACE FUNCTION public.can_access_documents_object(_name text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  first_seg text;
  second_seg text;
  parsed_uuid uuid;
  pc_org_id uuid;
BEGIN
  IF _name IS NULL OR _name = '' THEN
    RETURN false;
  END IF;

  first_seg := split_part(_name, '/', 1);

  -- Pattern 2 : programme-criteria/{programme_criteria_id}.pdf
  IF first_seg = 'programme-criteria' THEN
    second_seg := split_part(_name, '/', 2);
    -- Retire l'extension (.pdf, .docx, etc.)
    second_seg := regexp_replace(second_seg, '\.[a-zA-Z0-9]+$', '');
    BEGIN
      parsed_uuid := second_seg::uuid;
    EXCEPTION WHEN OTHERS THEN
      RETURN public.has_role(auth.uid(), 'super_admin'::app_role);
    END;
    SELECT pc.organization_id INTO pc_org_id
    FROM public.programme_criteria pc
    WHERE pc.id = parsed_uuid;
    RETURN (
      pc_org_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.organization_members om
        WHERE om.organization_id = pc_org_id
          AND om.user_id = auth.uid()
          AND om.is_active = true
      )
    ) OR public.has_role(auth.uid(), 'super_admin'::app_role);
  END IF;

  -- Pattern 1 : {enterprise_id}/...  (cas Reconstruction, dominant)
  BEGIN
    parsed_uuid := first_seg::uuid;
  EXCEPTION WHEN OTHERS THEN
    RETURN public.has_role(auth.uid(), 'super_admin'::app_role);
  END;

  RETURN public.has_enterprise_access(parsed_uuid);
END;
$$;

COMMENT ON FUNCTION public.can_access_documents_object IS
'Dispatches access control for storage.objects in bucket documents based on path pattern. Falls back to super_admin if path format is unknown.';

-- ============================================================================
-- Remplacement des 4 policies sur bucket 'documents'
-- ============================================================================

-- INSERT
DROP POLICY IF EXISTS "Auth upload documents" ON storage.objects;
CREATE POLICY "documents_insert_scoped_access"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'documents'
    AND public.can_access_documents_object(name)
  );

-- SELECT
DROP POLICY IF EXISTS "Auth read documents" ON storage.objects;
CREATE POLICY "documents_select_scoped_access"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'documents'
    AND public.can_access_documents_object(name)
  );

-- UPDATE — deux policies historiques (Auth update + Authenticated users can update), même effet
DROP POLICY IF EXISTS "Auth update documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update documents" ON storage.objects;
CREATE POLICY "documents_update_scoped_access"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'documents'
    AND public.can_access_documents_object(name)
  )
  WITH CHECK (
    bucket_id = 'documents'
    AND public.can_access_documents_object(name)
  );

-- DELETE
DROP POLICY IF EXISTS "Auth delete documents" ON storage.objects;
CREATE POLICY "documents_delete_scoped_access"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'documents'
    AND public.can_access_documents_object(name)
  );

-- ============================================================================
-- Notes de mise en prod
-- ============================================================================
-- 1. Tests à passer après deploy (sur staging idéalement) :
--    a. Owner d'enterprise upload via ReconstructionUploader → OK
--    b. Coach (assigné via enterprise_coaches) upload pour son entreprise → OK
--    c. Org member upload pour une enterprise de son org → OK
--    d. Super_admin upload pour n'importe quelle enterprise → OK
--    e. User auth random sans accès → BLOQUÉ (avant : OK)
--    f. Upload programme-criteria par membre actif de l'org owner → OK
-- 2. Audit post-deploy : si des fichiers existants ont un path qui ne matche
--    aucun des deux patterns connus, ils deviennent inaccessibles sauf
--    super_admin. À identifier via :
--      SELECT name FROM storage.objects
--      WHERE bucket_id = 'documents'
--        AND split_part(name, '/', 1) <> 'programme-criteria'
--        AND split_part(name, '/', 1) !~ '^[0-9a-f-]{36}$';
-- 3. Rollback : DROP les nouvelles policies puis recréer les 4 originales
--    avec USING (bucket_id = 'documents').
-- ============================================================================
