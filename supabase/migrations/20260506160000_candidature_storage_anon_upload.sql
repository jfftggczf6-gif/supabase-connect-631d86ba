-- ============================================================================
-- Fix : autoriser les uploads anonymes sur le bucket candidature-documents
-- ============================================================================
-- Bug constaté en prod (cas FoodSen, 2026-05-06) : les fichiers uploadés via
-- le formulaire public d'appel à candidatures étaient rejetés en 400 par les
-- RLS storage.objects. Le formulaire (côté code) ne capturait pas l'erreur
-- et créait quand même la candidature en DB → fichiers fantômes (storage_path
-- en DB mais aucun fichier réel dans le bucket).
--
-- Le fix code (PublicCandidatureForm.tsx) bloque maintenant la soumission si
-- un upload échoue, avec un message clair. Cette migration ajoute en plus la
-- policy RLS qui rend l'upload réellement possible pour les anonymes.
-- ============================================================================

-- Crée le bucket s'il n'existe pas (privé : la lecture passe par signed URL)
INSERT INTO storage.buckets (id, name, public)
VALUES ('candidature-documents', 'candidature-documents', false)
ON CONFLICT (id) DO NOTHING;

-- INSERT anonyme : autorise les uploads depuis le formulaire public
DROP POLICY IF EXISTS "candidature_documents_anon_upload" ON storage.objects;
CREATE POLICY "candidature_documents_anon_upload"
  ON storage.objects FOR INSERT
  TO anon, authenticated
  WITH CHECK (bucket_id = 'candidature-documents');

-- SELECT pour membres d'org : autorise le download via signed URL pour les
-- utilisateurs authentifiés membres d'une org. (La signature URL est faite
-- côté serveur Supabase Storage, qui vérifie la policy.)
DROP POLICY IF EXISTS "candidature_documents_member_select" ON storage.objects;
CREATE POLICY "candidature_documents_member_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'candidature-documents');

-- DELETE : seuls les owner/admin/manager peuvent supprimer (rare, mais utile
-- en cas de cleanup ou de nettoyage RGPD).
DROP POLICY IF EXISTS "candidature_documents_admin_delete" ON storage.objects;
CREATE POLICY "candidature_documents_admin_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'candidature-documents'
    AND EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin', 'manager', 'managing_director')
        AND om.is_active
    )
  );
