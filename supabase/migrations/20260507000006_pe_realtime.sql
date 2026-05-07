-- ============================================================================
-- PE — Activer Realtime sur les tables suivies pendant les générations
-- ============================================================================
-- Permet au frontend de s'abonner aux changements via supabase.channel() +
-- postgres_changes. Utilisé par usePeGenerationStatus() pour afficher la
-- progression live des générations IA (memo, valuation, etc.).
-- ============================================================================

-- memo_versions : status (generating → ready) + overall_score + classification
ALTER PUBLICATION supabase_realtime ADD TABLE public.memo_versions;

-- memo_sections : content_md / content_json se remplissent au fur et à mesure
ALTER PUBLICATION supabase_realtime ADD TABLE public.memo_sections;

-- pe_valuation : status (generating → ready) pour DCF/Multiples/ANCC
ALTER PUBLICATION supabase_realtime ADD TABLE public.pe_valuation;

-- pe_deals : stage (pour suivre les transitions automatiques pre_screening → note_ic1)
ALTER PUBLICATION supabase_realtime ADD TABLE public.pe_deals;
