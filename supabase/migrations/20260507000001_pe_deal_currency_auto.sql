-- ============================================================================
-- PE — Devise du deal calculée auto depuis le pays de l'entreprise
-- ============================================================================
-- La devise (pe_deals.currency) n'est plus saisie manuellement : elle est
-- calculée automatiquement à partir de enterprises.country via un trigger.
-- Mapping basé sur _shared/ovo-knowledge.ts (UEMOA, CEMAC, devises locales).
--
-- Le frontend lit toujours deal.currency comme avant — pas de changement UI.
-- ============================================================================

-- 1. Fonction utilitaire : pays → devise
CREATE OR REPLACE FUNCTION get_currency_from_country(country TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF country IS NULL THEN
    RETURN 'XOF'; -- fallback par défaut
  END IF;

  RETURN CASE
    -- UEMOA — XOF (FCFA)
    WHEN country IN ('Sénégal', 'Côte d''Ivoire', 'Burkina Faso', 'Bénin',
                     'Mali', 'Togo', 'Niger', 'Guinée-Bissau') THEN 'XOF'

    -- CEMAC — XAF (FCFA)
    WHEN country IN ('Cameroun', 'Gabon', 'Tchad', 'République du Congo',
                     'Congo', 'République Centrafricaine', 'RCA',
                     'Guinée Équatoriale') THEN 'XAF'

    -- Devises locales spécifiques
    WHEN country IN ('RDC', 'République Démocratique du Congo') THEN 'CDF'
    WHEN country = 'Maroc' THEN 'MAD'
    WHEN country = 'Tunisie' THEN 'TND'
    WHEN country = 'Algérie' THEN 'DZD'
    WHEN country = 'Nigeria' THEN 'NGN'
    WHEN country = 'Ghana' THEN 'GHS'
    WHEN country = 'Kenya' THEN 'KES'
    WHEN country = 'Rwanda' THEN 'RWF'
    WHEN country IN ('Afrique du Sud', 'South Africa') THEN 'ZAR'
    WHEN country IN ('Tanzanie', 'Tanzania') THEN 'TZS'
    WHEN country IN ('Ouganda', 'Uganda') THEN 'UGX'
    WHEN country = 'Éthiopie' THEN 'ETB'
    WHEN country = 'Madagascar' THEN 'MGA'
    WHEN country = 'Mauritanie' THEN 'MRU'
    WHEN country = 'Guinée' THEN 'GNF'

    -- Europe + fallback
    WHEN country IN ('France', 'Belgique', 'Espagne', 'Italie',
                     'Allemagne', 'Portugal', 'Pays-Bas') THEN 'EUR'
    WHEN country IN ('USA', 'États-Unis', 'United States') THEN 'USD'
    WHEN country IN ('Royaume-Uni', 'UK', 'United Kingdom') THEN 'GBP'

    -- Default fallback (UEMOA est le plus représenté pour ESONO)
    ELSE 'XOF'
  END;
END;
$$;

COMMENT ON FUNCTION get_currency_from_country(TEXT) IS
  'Mappe un nom de pays vers le code ISO 4217 de sa devise principale.
   Fallback XOF (FCFA UEMOA) si pays inconnu, vu que la majorité des deals
   ESONO sont en zone UEMOA.';

-- 2. Trigger : à chaque INSERT/UPDATE sur pe_deals, set currency = pays de l'enterprise
CREATE OR REPLACE FUNCTION pe_deals_set_currency_from_enterprise()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  ent_country TEXT;
BEGIN
  -- Récupère le pays de l'enterprise liée
  IF NEW.enterprise_id IS NOT NULL THEN
    SELECT country INTO ent_country FROM enterprises WHERE id = NEW.enterprise_id;
    NEW.currency := get_currency_from_country(ent_country);
  ELSE
    -- Pas d'enterprise : on garde la devise existante ou XOF par défaut
    NEW.currency := COALESCE(NEW.currency, 'XOF');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pe_deals_currency_auto ON pe_deals;
CREATE TRIGGER pe_deals_currency_auto
  BEFORE INSERT OR UPDATE OF enterprise_id ON pe_deals
  FOR EACH ROW EXECUTE FUNCTION pe_deals_set_currency_from_enterprise();

-- 3. Backfill : update tous les deals existants pour aligner la devise sur le pays
UPDATE pe_deals d
SET currency = get_currency_from_country(e.country)
FROM enterprises e
WHERE d.enterprise_id = e.id;
