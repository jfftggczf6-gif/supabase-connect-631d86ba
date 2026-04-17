-- ============================================================================
-- Phase 1A — Migration 4/8 : Extension de l'enum app_role
-- Ajout des rôles PE (analyste, investment_manager, managing_director)
-- IMPORTANT : ALTER TYPE ADD VALUE ne peut pas être dans une transaction
-- ============================================================================

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'analyste';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'investment_manager';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'managing_director';
