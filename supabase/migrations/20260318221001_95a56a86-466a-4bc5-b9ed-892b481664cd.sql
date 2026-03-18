
-- 1. Activer l'extension pgvector
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- 2. Ajouter la colonne embedding à knowledge_base
ALTER TABLE public.knowledge_base
  ADD COLUMN IF NOT EXISTS embedding extensions.vector(1536);

-- 3. Index pour recherche par similarité
CREATE INDEX IF NOT EXISTS idx_knowledge_base_embedding
  ON public.knowledge_base
  USING ivfflat (embedding extensions.vector_cosine_ops)
  WITH (lists = 100);

-- 4. Ajouter des colonnes de métadonnées pour le refresh automatique
ALTER TABLE public.knowledge_base
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS auto_refresh BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS refresh_source TEXT,
  ADD COLUMN IF NOT EXISTS last_refreshed_at TIMESTAMPTZ;

-- 5. Fonction SQL pour la recherche par similarité
CREATE OR REPLACE FUNCTION public.search_knowledge(
  query_embedding extensions.vector(1536),
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 10,
  filter_categories TEXT[] DEFAULT NULL,
  filter_country TEXT DEFAULT NULL,
  filter_sector TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  content TEXT,
  category TEXT,
  source TEXT,
  country TEXT,
  sector TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    kb.id,
    kb.title,
    kb.content,
    kb.category,
    kb.source,
    kb.country,
    kb.sector,
    (1 - (kb.embedding <=> query_embedding))::FLOAT AS similarity
  FROM public.knowledge_base kb
  WHERE
    kb.embedding IS NOT NULL
    AND (filter_categories IS NULL OR kb.category = ANY(filter_categories))
    AND (filter_country IS NULL OR kb.country IS NULL OR kb.country ILIKE '%' || filter_country || '%')
    AND (filter_sector IS NULL OR kb.sector IS NULL OR kb.sector ILIKE '%' || filter_sector || '%')
    AND (1 - (kb.embedding <=> query_embedding))::FLOAT > match_threshold
  ORDER BY kb.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
