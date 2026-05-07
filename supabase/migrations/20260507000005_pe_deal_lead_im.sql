-- ============================================================================
-- PE — Responsable explicite par deal (lead_im_id)
-- ============================================================================
-- Permet de désigner explicitement le "Responsable" (Investment Manager)
-- d'un deal au moment de la création, au lieu du fallback "premier admin de
-- l'org". L'analyste reste le lead_analyst_id (exécution opérationnelle),
-- l'IM est le lead_im_id (supervision et arbitrage IC).
-- ============================================================================

ALTER TABLE public.pe_deals
  ADD COLUMN IF NOT EXISTS lead_im_id UUID REFERENCES auth.users(id);

CREATE INDEX IF NOT EXISTS idx_pe_deals_lead_im ON public.pe_deals(lead_im_id);

COMMENT ON COLUMN public.pe_deals.lead_im_id IS 'Responsable du deal (Investment Manager / Managing Director). Distinct du lead_analyst_id qui exécute opérationnellement.';
