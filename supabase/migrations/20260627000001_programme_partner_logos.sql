-- ============================================================================
-- Bande « Partenaires » sur le formulaire public de candidature (Option B)
-- + upload des logos partenaires depuis les Paramètres du programme.
-- ============================================================================
-- Le formulaire public d'appel à candidatures affiche désormais une rangée de
-- logos partenaires en bas de page (« Avec le soutien de … »), séparée du texte
-- de présentation. Les logos sont uploadés côté admin et servis publiquement.
-- ============================================================================

-- 1. Colonne partner_logos : tableau JSONB de { url, name? }
ALTER TABLE public.programmes
  ADD COLUMN IF NOT EXISTS partner_logos jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.programmes.partner_logos IS
  'Logos partenaires affichés en bande sur le formulaire public. Tableau JSONB : [{ "url": "...", "name": "..." }].';

-- 2. Bucket PUBLIC pour les logos (la bande s'affiche sur le formulaire anonyme,
--    donc lecture publique via URL publique).
INSERT INTO storage.buckets (id, name, public)
VALUES ('programme-logos', 'programme-logos', true)
ON CONFLICT (id) DO NOTHING;

-- 3. RLS storage.objects pour le bucket programme-logos
-- Lecture publique (le bucket est public ; policy explicite pour le SELECT anon)
DROP POLICY IF EXISTS "programme_logos_public_read" ON storage.objects;
CREATE POLICY "programme_logos_public_read"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'programme-logos');

-- Upload réservé aux membres d'une org (gestion des logos depuis les Paramètres)
DROP POLICY IF EXISTS "programme_logos_member_insert" ON storage.objects;
CREATE POLICY "programme_logos_member_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'programme-logos'
    AND EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.user_id = auth.uid() AND om.is_active
    )
  );

-- Suppression réservée aux owner/admin/manager/managing_director
DROP POLICY IF EXISTS "programme_logos_admin_delete" ON storage.objects;
CREATE POLICY "programme_logos_admin_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'programme-logos'
    AND EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.user_id = auth.uid()
        AND om.role IN ('owner', 'admin', 'manager', 'managing_director')
        AND om.is_active
    )
  );
