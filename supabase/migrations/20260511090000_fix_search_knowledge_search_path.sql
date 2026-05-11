-- ============================================================================
-- search_knowledge — Fix search_path manquant pour pgvector
-- ============================================================================
-- La fonction RPC search_knowledge avait search_path=public, mais l'opérateur
-- cosine distance (<=>) du type vector vit dans le schéma 'extensions'.
-- Résultat : la fonction levait
--   "operator does not exist: extensions.vector <=> extensions.vector"
-- à chaque appel, et le RAG global tombait en fallback texte.
--
-- search_knowledge_chunks avait déjà search_path=public, extensions ; on
-- aligne search_knowledge.
--
-- Note: agent_context.py (worker Railway) n'utilise plus search_knowledge
-- depuis 2026-05-11 (bascule vers search_knowledge_chunks pour la KB
-- globale). Ce fix reste utile pour le code Deno qui s'appuie encore
-- dessus, et pour propreté.
-- ============================================================================

ALTER FUNCTION public.search_knowledge(vector, double precision, integer, text[], text, text)
  SET search_path = public, extensions;
