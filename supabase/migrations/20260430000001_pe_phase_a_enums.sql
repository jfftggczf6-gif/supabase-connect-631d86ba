-- ===========================================================================
-- Migration : Phase A Foundation PE — Enums (hors transaction)
--
-- Ce fichier contient UNIQUEMENT les ALTER TYPE / CREATE TYPE qui ne peuvent
-- pas tourner dans une transaction (ALTER TYPE ADD VALUE en particulier).
--
-- Le fichier compagnon `20260430000002_pe_phase_a_tables.sql` contient les
-- tables, triggers, helpers et RLS, et tourne en transaction normale.
-- ===========================================================================

-- 1. Étendre app_role avec les rôles PE manquants
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'managing_director';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'investment_manager';
-- 'analyst' existe déjà depuis multi_segment_enums

-- 2. Nouvel enum pour les stages du pipeline PE
DO $$ BEGIN
  CREATE TYPE pe_deal_stage AS ENUM (
    'sourcing', 'pre_screening', 'analyse',
    'ic1', 'dd', 'ic_finale', 'closing',
    'portfolio', 'lost'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 3. Nouvel enum pour la source des deals
DO $$ BEGIN
  CREATE TYPE pe_deal_source AS ENUM (
    'reseau_pe', 'inbound', 'dfi', 'banque', 'mandat_ba', 'conference', 'autre'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;
