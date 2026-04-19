-- S5: MFA support — Supabase Auth handles TOTP natively
-- This migration adds a column to track MFA enrollment preference per org

-- Add MFA policy to organizations
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'mfa_policy') THEN
    ALTER TABLE public.organizations ADD COLUMN mfa_policy text DEFAULT 'optional' CHECK (mfa_policy IN ('disabled', 'optional', 'required'));
    COMMENT ON COLUMN public.organizations.mfa_policy IS 'MFA policy: disabled, optional (default), required (for sensitive roles)';
  END IF;
END $$;

-- S8: Prepare for PII encryption — add encrypted_fields tracking
-- Actual Supabase Vault integration requires dashboard setup
-- This tracks which fields are encrypted for future migration
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'encrypted_fields') THEN
    ALTER TABLE public.organizations ADD COLUMN encrypted_fields text[] DEFAULT '{}';
    COMMENT ON COLUMN public.organizations.encrypted_fields IS 'List of fields encrypted with Supabase Vault (Phase 6-7)';
  END IF;
END $$;

-- S11: Enhanced activity logging — add login/logout tracking
-- Add security-relevant columns to activity_log
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'activity_log' AND column_name = 'ip_address') THEN
    ALTER TABLE public.activity_log ADD COLUMN ip_address text;
    ALTER TABLE public.activity_log ADD COLUMN user_agent text;
  END IF;
END $$;

-- Create index for security monitoring queries
CREATE INDEX IF NOT EXISTS idx_activity_log_actor_created ON public.activity_log (actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_action_created ON public.activity_log (action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_cost_log_created ON public.ai_cost_log (created_at DESC);
