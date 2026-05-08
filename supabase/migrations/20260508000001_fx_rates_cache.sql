-- ============================================================================
-- FX rates cache — Taux de change globaux pour conversion multi-devises PE
-- ============================================================================
-- Table singleton (id = 'eur_base') alimentée par l'edge fn `fetch-fx-rates`
-- qui interroge Frankfurter (ECB) quotidiennement. Lecture publique pour tout
-- utilisateur authentifié, écriture réservée au service_role.
--
-- Structure de `rates` JSONB :
--   { "EUR": 1, "XOF": 655.957, "XAF": 655.957, "USD": 1.0823 }
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.fx_rates_cache (
  id TEXT PRIMARY KEY DEFAULT 'eur_base',
  rates JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source TEXT,
  base TEXT NOT NULL DEFAULT 'EUR',
  CONSTRAINT fx_rates_cache_singleton CHECK (id = 'eur_base')
);

ALTER TABLE public.fx_rates_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fx_rates_select_authenticated" ON public.fx_rates_cache;
CREATE POLICY "fx_rates_select_authenticated"
  ON public.fx_rates_cache FOR SELECT
  TO authenticated
  USING (true);

-- Seed initial avec parités fixes XOF/XAF + approximation USD (sera écrasé au 1er fetch)
INSERT INTO public.fx_rates_cache (id, rates, source, last_fetched_at)
VALUES (
  'eur_base',
  '{"EUR": 1, "XOF": 655.957, "XAF": 655.957, "USD": 1.08}'::jsonb,
  'seed',
  '1970-01-01T00:00:00Z'
)
ON CONFLICT (id) DO NOTHING;

-- Realtime pour que l'UI se mette à jour en live après un refresh
ALTER PUBLICATION supabase_realtime ADD TABLE public.fx_rates_cache;
