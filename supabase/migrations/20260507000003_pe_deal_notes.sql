-- ============================================================================
-- PE — Notes analyste (équivalent coaching_notes pour les deals PE)
-- ============================================================================
-- Permet à l'analyst (lead du deal), à l'IM rattaché et au MD de l'org de
-- déposer des notes contextuelles sur un deal — par texte ou via upload.
-- Les notes peuvent être analysées par l'IA et déclencher des corrections
-- automatiques sur les sections du memo / pré-screening (cf. boucle coach).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.pe_deal_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES public.pe_deals(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_role TEXT,                         -- analyst | investment_manager | managing_director | owner
  input_type TEXT NOT NULL DEFAULT 'text',  -- text | file
  raw_content TEXT,
  file_path TEXT,
  file_name TEXT,
  resume_ia TEXT,
  titre TEXT,
  date_rdv DATE,
  infos_extraites JSONB DEFAULT '[]'::jsonb,
  corrections_applied JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pe_deal_notes_deal     ON public.pe_deal_notes(deal_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pe_deal_notes_org      ON public.pe_deal_notes(organization_id);
CREATE INDEX IF NOT EXISTS idx_pe_deal_notes_author   ON public.pe_deal_notes(author_id);

ALTER TABLE public.pe_deal_notes ENABLE ROW LEVEL SECURITY;

-- SELECT : tous ceux qui peuvent voir le deal voient ses notes
DROP POLICY IF EXISTS "pe_deal_notes select" ON public.pe_deal_notes;
CREATE POLICY "pe_deal_notes select" ON public.pe_deal_notes FOR SELECT
USING (public.can_see_pe_deal(deal_id, auth.uid()));

-- INSERT : seuls ceux qui peuvent voir le deal peuvent ajouter une note,
-- et l'author_id doit être l'utilisateur courant
DROP POLICY IF EXISTS "pe_deal_notes insert" ON public.pe_deal_notes;
CREATE POLICY "pe_deal_notes insert" ON public.pe_deal_notes FOR INSERT
WITH CHECK (
  author_id = auth.uid()
  AND public.can_see_pe_deal(deal_id, auth.uid())
);

-- UPDATE : seul l'auteur peut modifier sa note (corrections_applied notamment)
DROP POLICY IF EXISTS "pe_deal_notes update author" ON public.pe_deal_notes;
CREATE POLICY "pe_deal_notes update author" ON public.pe_deal_notes FOR UPDATE
USING (author_id = auth.uid())
WITH CHECK (author_id = auth.uid());

-- DELETE : auteur OU MD/owner de l'org
DROP POLICY IF EXISTS "pe_deal_notes delete" ON public.pe_deal_notes;
CREATE POLICY "pe_deal_notes delete" ON public.pe_deal_notes FOR DELETE
USING (
  author_id = auth.uid()
  OR public.is_pe_md_or_owner(organization_id, auth.uid())
);

COMMENT ON TABLE  public.pe_deal_notes IS 'Notes contextuelles déposées par l''analyst, l''IM ou le MD sur un deal PE (équivalent coaching_notes côté PME).';
COMMENT ON COLUMN public.pe_deal_notes.author_role IS 'Rôle de l''auteur au moment de la création (snapshot).';
COMMENT ON COLUMN public.pe_deal_notes.corrections_applied IS 'Liste JSON des corrections appliquées par l''auteur via la boucle IA (target_type, target_code, field_path, value).';
