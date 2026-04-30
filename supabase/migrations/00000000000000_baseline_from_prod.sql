


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";






CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "vector" WITH SCHEMA "extensions";






CREATE TYPE "public"."app_role" AS ENUM (
    'coach',
    'entrepreneur',
    'super_admin',
    'chef_programme',
    'analyste',
    'investment_manager',
    'managing_director'
);


ALTER TYPE "public"."app_role" OWNER TO "postgres";


CREATE TYPE "public"."deliverable_type" AS ENUM (
    'bmc_analysis',
    'bmc_html',
    'sic_analysis',
    'sic_html',
    'inputs_data',
    'inputs_html',
    'framework_data',
    'framework_html',
    'framework_excel',
    'diagnostic_data',
    'diagnostic_html',
    'diagnostic_analyses',
    'plan_ovo',
    'business_plan',
    'odd_analysis',
    'odd_excel',
    'screening_report',
    'pre_screening',
    'valuation',
    'onepager',
    'pitch_deck',
    'investment_memo',
    'plan_ovo_excel',
    'plan_financier'
);


ALTER TYPE "public"."deliverable_type" OWNER TO "postgres";


CREATE TYPE "public"."module_code" AS ENUM (
    'bmc',
    'sic',
    'inputs',
    'framework',
    'diagnostic',
    'plan_ovo',
    'business_plan',
    'odd',
    'valuation',
    'onepager',
    'pitch_deck',
    'investment_memo',
    'plan_financier'
);


ALTER TYPE "public"."module_code" OWNER TO "postgres";


CREATE TYPE "public"."module_status" AS ENUM (
    'not_started',
    'in_progress',
    'completed'
);


ALTER TYPE "public"."module_status" OWNER TO "postgres";


CREATE TYPE "public"."operating_mode" AS ENUM (
    'reconstruction',
    'due_diligence'
);


ALTER TYPE "public"."operating_mode" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_slug_available"("p_slug" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT NOT EXISTS (SELECT 1 FROM public.organizations WHERE slug = p_slug)
$$;


ALTER FUNCTION "public"."check_slug_available"("p_slug" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."deliverables_set_organization_id"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.organization_id IS NULL THEN
    SELECT organization_id INTO NEW.organization_id
    FROM public.enterprises
    WHERE id = NEW.enterprise_id;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."deliverables_set_organization_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_metering_org_detail"("p_org_id" "uuid", "period_start" timestamp with time zone, "period_end" timestamp with time zone) RETURNS TABLE("function_name" "text", "model" "text", "call_count" bigint, "total_cost" numeric, "total_input_tokens" bigint, "total_output_tokens" bigint)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin'::public.app_role) THEN
    RAISE EXCEPTION 'Forbidden: super_admin required';
  END IF;

  RETURN QUERY
  SELECT
    a.function_name,
    a.model,
    COUNT(*)::bigint,
    COALESCE(SUM(a.cost_usd), 0)::numeric,
    COALESCE(SUM(a.input_tokens), 0)::bigint,
    COALESCE(SUM(a.output_tokens), 0)::bigint
  FROM public.ai_cost_log a
  WHERE a.organization_id = p_org_id
    AND a.created_at >= period_start
    AND a.created_at <= period_end
  GROUP BY a.function_name, a.model
  ORDER BY SUM(a.cost_usd) DESC;
END;
$$;


ALTER FUNCTION "public"."get_metering_org_detail"("p_org_id" "uuid", "period_start" timestamp with time zone, "period_end" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_metering_summary"("period_start" timestamp with time zone, "period_end" timestamp with time zone, "org_filter" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("organization_id" "uuid", "organization_name" "text", "organization_type" "text", "total_cost" numeric, "call_count" bigint, "enterprise_count" bigint, "avg_cost_per_enterprise" numeric, "avg_cost_per_call" numeric)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin'::public.app_role) THEN
    RAISE EXCEPTION 'Forbidden: super_admin required';
  END IF;

  RETURN QUERY
  SELECT
    a.organization_id,
    o.name,
    o.type,
    COALESCE(SUM(a.cost_usd), 0)::numeric as total_cost,
    COUNT(*)::bigint as call_count,
    COUNT(DISTINCT a.enterprise_id)::bigint as enterprise_count,
    CASE WHEN COUNT(DISTINCT a.enterprise_id) > 0
      THEN ROUND(SUM(a.cost_usd) / COUNT(DISTINCT a.enterprise_id), 4)
      ELSE 0 END as avg_cost_per_enterprise,
    CASE WHEN COUNT(*) > 0
      THEN ROUND(SUM(a.cost_usd) / COUNT(*), 6)
      ELSE 0 END as avg_cost_per_call
  FROM public.ai_cost_log a
  JOIN public.organizations o ON o.id = a.organization_id
  WHERE a.created_at >= period_start
    AND a.created_at <= period_end
    AND (org_filter IS NULL OR a.organization_id = org_filter)
  GROUP BY a.organization_id, o.name, o.type
  ORDER BY total_cost DESC;
END;
$$;


ALTER FUNCTION "public"."get_metering_summary"("period_start" timestamp with time zone, "period_end" timestamp with time zone, "org_filter" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_organizations"() RETURNS SETOF "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT organization_id FROM public.organization_members
  WHERE user_id = auth.uid() AND is_active = true
$$;


ALTER FUNCTION "public"."get_user_organizations"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_user_organizations"() IS 'Liste des IDs d organisations du user courant';



CREATE OR REPLACE FUNCTION "public"."get_user_role_in"("org_id" "uuid") RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT role FROM public.organization_members
  WHERE user_id = auth.uid()
    AND organization_id = org_id
    AND is_active = true
  LIMIT 1
$$;


ALTER FUNCTION "public"."get_user_role_in"("org_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_user_role_in"("org_id" "uuid") IS 'Retourne le rôle du user dans l org, null si pas membre';



CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_role public.app_role;
  v_full_name text;
BEGIN
  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', '');

  INSERT INTO public.profiles (user_id, email, full_name)
  VALUES (NEW.id, NEW.email, v_full_name)
  ON CONFLICT (user_id) DO UPDATE SET
    full_name = CASE 
      WHEN EXCLUDED.full_name != '' THEN EXCLUDED.full_name 
      ELSE profiles.full_name 
    END,
    email = COALESCE(EXCLUDED.email, profiles.email);

  BEGIN
    v_role := (NEW.raw_user_meta_data->>'role')::public.app_role;
  EXCEPTION WHEN OTHERS THEN
    v_role := 'entrepreneur'::public.app_role;
  END;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, COALESCE(v_role, 'entrepreneur'::public.app_role))
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
  OR
  (auth.jwt() -> 'app_metadata' ->> 'role')::text = _role::text
$$;


ALTER FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_coach_of_enterprise"("ent_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.enterprise_coaches
    WHERE coach_id = auth.uid()
      AND enterprise_id = ent_id
      AND is_active = true
  )
  -- Fallback temporaire : vérifier aussi l'ancien coach_id (compat pendant migration UI)
  -- Ajout check org membership pour éviter qu'un coach retiré garde l'accès
  OR EXISTS (
    SELECT 1 FROM public.enterprises e
    WHERE e.id = ent_id AND e.coach_id = auth.uid()
      AND (e.organization_id IS NULL OR public.is_member_of(e.organization_id))
  )
$$;


ALTER FUNCTION "public"."is_coach_of_enterprise"("ent_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."is_coach_of_enterprise"("ent_id" "uuid") IS 'Vérifie que le user est coach assigné à cette entreprise (N-à-N + fallback 1-à-1)';



CREATE OR REPLACE FUNCTION "public"."is_member_of"("org_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = auth.uid()
      AND organization_id = org_id
      AND is_active = true
  )
$$;


ALTER FUNCTION "public"."is_member_of"("org_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."is_member_of"("org_id" "uuid") IS 'Vérifie que le user courant est membre actif de l org';



CREATE OR REPLACE FUNCTION "public"."is_owner_or_admin_of"("org_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = auth.uid()
      AND organization_id = org_id
      AND is_active = true
      AND role IN ('owner', 'admin')
  )
$$;


ALTER FUNCTION "public"."is_owner_or_admin_of"("org_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."is_owner_or_admin_of"("org_id" "uuid") IS 'Vérifie que le user est owner ou admin de l org';



CREATE OR REPLACE FUNCTION "public"."link_enterprise_to_coach_by_email"("enterprise_email" "text") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE _coach_id uuid := auth.uid(); _normalized_email text; _ent_id uuid; _existing_coach uuid;
BEGIN
  IF NOT public.has_role(_coach_id, 'coach') THEN RETURN 'unauthorized'; END IF;
  _normalized_email := lower(trim(enterprise_email));
  IF _normalized_email IS NULL OR _normalized_email = '' THEN RETURN 'invalid_email'; END IF;
  SELECT id, coach_id INTO _ent_id, _existing_coach FROM enterprises WHERE lower(trim(contact_email)) = _normalized_email LIMIT 1;
  IF _ent_id IS NULL THEN SELECT e.id, e.coach_id INTO _ent_id, _existing_coach FROM enterprises e JOIN profiles p ON p.user_id = e.user_id WHERE lower(trim(p.email)) = _normalized_email LIMIT 1; END IF;
  IF _ent_id IS NULL THEN RETURN 'not_found'; END IF;
  IF _existing_coach = _coach_id THEN RETURN 'already_yours'; END IF;
  IF _existing_coach IS NOT NULL THEN RETURN 'already_assigned'; END IF;
  UPDATE enterprises SET coach_id = _coach_id WHERE id = _ent_id;
  RETURN 'linked';
END; $$;


ALTER FUNCTION "public"."link_enterprise_to_coach_by_email"("enterprise_email" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."list_all_organizations_for_admin"() RETURNS TABLE("id" "uuid", "name" "text", "slug" "text", "type" "text", "country" "text", "is_active" boolean, "member_count" bigint, "enterprise_count" bigint, "created_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin'::public.app_role) THEN
    RAISE EXCEPTION 'Forbidden: super_admin role required';
  END IF;
  RETURN QUERY SELECT
    o.id, o.name, o.slug, o.type, o.country, o.is_active,
    (SELECT count(*) FROM public.organization_members om WHERE om.organization_id = o.id AND om.is_active),
    (SELECT count(*) FROM public.enterprises e WHERE e.organization_id = o.id),
    o.created_at
  FROM public.organizations o
  ORDER BY o.created_at DESC;
END;
$$;


ALTER FUNCTION "public"."list_all_organizations_for_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."search_knowledge"("query_embedding" "extensions"."vector", "match_threshold" double precision DEFAULT 0.7, "match_count" integer DEFAULT 10, "filter_categories" "text"[] DEFAULT NULL::"text"[], "filter_country" "text" DEFAULT NULL::"text", "filter_sector" "text" DEFAULT NULL::"text") RETURNS TABLE("id" "uuid", "title" "text", "content" "text", "category" "text", "source" "text", "country" "text", "sector" "text", "similarity" double precision)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN RETURN QUERY SELECT kb.id, kb.title, kb.content, kb.category, kb.source, kb.country, kb.sector,
  (1 - (kb.embedding <=> query_embedding))::FLOAT AS similarity FROM public.knowledge_base kb
  WHERE kb.embedding IS NOT NULL AND (filter_categories IS NULL OR kb.category = ANY(filter_categories))
  AND (filter_country IS NULL OR kb.country IS NULL OR kb.country ILIKE '%' || filter_country || '%')
  AND (filter_sector IS NULL OR kb.sector IS NULL OR kb.sector ILIKE '%' || filter_sector || '%')
  AND (1 - (kb.embedding <=> query_embedding))::FLOAT > match_threshold
  ORDER BY kb.embedding <=> query_embedding LIMIT match_count;
END;
$$;


ALTER FUNCTION "public"."search_knowledge"("query_embedding" "extensions"."vector", "match_threshold" double precision, "match_count" integer, "filter_categories" "text"[], "filter_country" "text", "filter_sector" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."search_knowledge_chunks"("query_embedding" "extensions"."vector", "match_threshold" double precision DEFAULT 0.3, "match_count" integer DEFAULT 10, "filter_country" "text" DEFAULT NULL::"text", "filter_sector" "text" DEFAULT NULL::"text", "filter_organization_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("id" "uuid", "kb_entry_id" "uuid", "org_entry_id" "uuid", "chunk_index" integer, "content" "text", "title" "text", "source" "text", "country" "text", "sector" "text", "category" "text", "source_url" "text", "publication_date" "date", "similarity" double precision)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions'
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id, c.kb_entry_id, c.org_entry_id, c.chunk_index,
    c.content, c.title, c.source, c.country, c.sector,
    c.category, c.source_url, c.publication_date,
    1 - (c.embedding <=> query_embedding) AS similarity
  FROM public.knowledge_chunks c
  WHERE
    c.embedding IS NOT NULL
    AND 1 - (c.embedding <=> query_embedding) > match_threshold
    AND (filter_country IS NULL OR c.country = filter_country OR c.country IN ('Afrique', 'Monde'))
    AND (filter_sector IS NULL OR c.sector = filter_sector OR c.sector = 'Tous secteurs')
    AND (
      filter_organization_id IS NULL
      OR c.kb_entry_id IS NOT NULL
      OR EXISTS (
        SELECT 1 FROM public.organization_knowledge ok
        WHERE ok.id = c.org_entry_id AND ok.organization_id = filter_organization_id
      )
    )
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;


ALTER FUNCTION "public"."search_knowledge_chunks"("query_embedding" "extensions"."vector", "match_threshold" double precision, "match_count" integer, "filter_country" "text", "filter_sector" "text", "filter_organization_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_enterprise_base_year"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.base_year IS NULL THEN
    NEW.base_year := EXTRACT(YEAR FROM now())::INTEGER;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_enterprise_base_year"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_organization_id_from_enterprise"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.organization_id IS NULL AND NEW.enterprise_id IS NOT NULL THEN
    SELECT organization_id INTO NEW.organization_id
    FROM public.enterprises
    WHERE id = NEW.enterprise_id;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_organization_id_from_enterprise"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."activity_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "enterprise_id" "uuid" NOT NULL,
    "actor_id" "uuid",
    "actor_role" "text",
    "action" "text" NOT NULL,
    "resource_type" "text",
    "resource_id" "uuid",
    "deliverable_type" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "organization_id" "uuid" NOT NULL
);


ALTER TABLE "public"."activity_log" OWNER TO "postgres";


COMMENT ON COLUMN "public"."activity_log"."organization_id" IS 'Organisation propriétaire (multi-tenant). Nullable temporairement pendant la migration.';



CREATE TABLE IF NOT EXISTS "public"."aggregated_benchmarks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "secteur" "text" NOT NULL,
    "pays" "text" NOT NULL,
    "nb_entreprises" integer DEFAULT 0,
    "marge_brute_p25" numeric,
    "marge_brute_mediane" numeric,
    "marge_brute_p75" numeric,
    "marge_ebitda_mediane" numeric,
    "ca_mediane" numeric,
    "effectifs_mediane" integer,
    "derniere_agregation" timestamp with time zone,
    "organization_id" "uuid" NOT NULL
);


ALTER TABLE "public"."aggregated_benchmarks" OWNER TO "postgres";


COMMENT ON COLUMN "public"."aggregated_benchmarks"."organization_id" IS 'Organisation propriétaire (multi-tenant). Nullable temporairement pendant la migration.';



CREATE TABLE IF NOT EXISTS "public"."ai_cost_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "enterprise_id" "uuid",
    "function_name" "text" NOT NULL,
    "model" "text" NOT NULL,
    "input_tokens" integer DEFAULT 0,
    "output_tokens" integer DEFAULT 0,
    "cost_usd" numeric(10,6) DEFAULT 0,
    "duration_ms" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "organization_id" "uuid" NOT NULL
);


ALTER TABLE "public"."ai_cost_log" OWNER TO "postgres";


COMMENT ON COLUMN "public"."ai_cost_log"."organization_id" IS 'Organisation propriétaire (multi-tenant). Nullable temporairement pendant la migration.';



CREATE TABLE IF NOT EXISTS "public"."candidatures" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "programme_id" "uuid" NOT NULL,
    "enterprise_id" "uuid",
    "form_data" "jsonb" DEFAULT '{}'::"jsonb",
    "company_name" "text",
    "contact_name" "text",
    "contact_email" "text",
    "contact_phone" "text",
    "status" "text" DEFAULT 'received'::"text" NOT NULL,
    "screening_score" numeric,
    "screening_data" "jsonb",
    "screening_date" timestamp with time zone,
    "assigned_coach_id" "uuid",
    "committee_notes" "text",
    "committee_decision" "text",
    "committee_date" timestamp with time zone,
    "documents" "jsonb" DEFAULT '[]'::"jsonb",
    "submitted_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "organization_id" "uuid" NOT NULL,
    CONSTRAINT "candidatures_status_check" CHECK (("status" = ANY (ARRAY['received'::"text", 'in_review'::"text", 'pre_selected'::"text", 'rejected'::"text", 'selected'::"text", 'waitlisted'::"text"])))
);


ALTER TABLE "public"."candidatures" OWNER TO "postgres";


COMMENT ON COLUMN "public"."candidatures"."organization_id" IS 'Organisation propriétaire (multi-tenant). Nullable temporairement pendant la migration.';



CREATE TABLE IF NOT EXISTS "public"."coach_uploads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "coach_id" "uuid" NOT NULL,
    "enterprise_id" "uuid" NOT NULL,
    "category" "text" NOT NULL,
    "filename" "text" NOT NULL,
    "file_size" bigint DEFAULT 0,
    "storage_path" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "organization_id" "uuid" NOT NULL
);


ALTER TABLE "public"."coach_uploads" OWNER TO "postgres";


COMMENT ON COLUMN "public"."coach_uploads"."organization_id" IS 'Organisation propriétaire (multi-tenant). Nullable temporairement pendant la migration.';



CREATE TABLE IF NOT EXISTS "public"."coaching_notes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "enterprise_id" "uuid" NOT NULL,
    "coach_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "input_type" "text" DEFAULT 'text'::"text" NOT NULL,
    "raw_content" "text",
    "file_path" "text",
    "file_name" "text",
    "resume_ia" "text",
    "infos_extraites" "jsonb" DEFAULT '[]'::"jsonb",
    "date_rdv" "date",
    "titre" "text",
    "visible_chef_programme" boolean DEFAULT true,
    "corrections_applied" "jsonb" DEFAULT '[]'::"jsonb",
    "organization_id" "uuid" NOT NULL
);


ALTER TABLE "public"."coaching_notes" OWNER TO "postgres";


COMMENT ON COLUMN "public"."coaching_notes"."organization_id" IS 'Organisation propriétaire (multi-tenant). Nullable temporairement pendant la migration.';



CREATE TABLE IF NOT EXISTS "public"."data_room_documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "enterprise_id" "uuid" NOT NULL,
    "category" "text" NOT NULL,
    "label" "text" NOT NULL,
    "filename" "text" NOT NULL,
    "storage_path" "text" NOT NULL,
    "file_size" integer,
    "evidence_level" integer DEFAULT 0,
    "is_generated" boolean DEFAULT false,
    "deliverable_type" "text",
    "uploaded_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "organization_id" "uuid" NOT NULL,
    CONSTRAINT "data_room_documents_category_check" CHECK (("category" = ANY (ARRAY['legal'::"text", 'finance'::"text", 'commercial'::"text", 'team'::"text", 'impact'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."data_room_documents" OWNER TO "postgres";


COMMENT ON COLUMN "public"."data_room_documents"."organization_id" IS 'Organisation propriétaire (multi-tenant). Nullable temporairement pendant la migration.';



CREATE TABLE IF NOT EXISTS "public"."data_room_shares" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "enterprise_id" "uuid" NOT NULL,
    "investor_email" "text",
    "investor_name" "text",
    "access_token" "text" DEFAULT "encode"("extensions"."gen_random_bytes"(32), 'hex'::"text"),
    "expires_at" timestamp with time zone,
    "can_download" boolean DEFAULT true,
    "viewed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "organization_id" "uuid" NOT NULL
);


ALTER TABLE "public"."data_room_shares" OWNER TO "postgres";


COMMENT ON COLUMN "public"."data_room_shares"."organization_id" IS 'Organisation propriétaire (multi-tenant). Nullable temporairement pendant la migration.';



CREATE TABLE IF NOT EXISTS "public"."deliverable_corrections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "enterprise_id" "uuid" NOT NULL,
    "deliverable_id" "uuid" NOT NULL,
    "deliverable_type" "text" NOT NULL,
    "corrected_by" "uuid" NOT NULL,
    "field_path" "text" NOT NULL,
    "original_value" "jsonb",
    "corrected_value" "jsonb",
    "correction_reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "organization_id" "uuid" NOT NULL
);


ALTER TABLE "public"."deliverable_corrections" OWNER TO "postgres";


COMMENT ON COLUMN "public"."deliverable_corrections"."organization_id" IS 'Organisation propriétaire (multi-tenant). Nullable temporairement pendant la migration.';



CREATE TABLE IF NOT EXISTS "public"."deliverable_versions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "deliverable_id" "uuid" NOT NULL,
    "enterprise_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "version" integer NOT NULL,
    "data" "jsonb" NOT NULL,
    "score" numeric(5,2),
    "validation_report" "jsonb",
    "generated_by" "text" DEFAULT 'ai'::"text",
    "trigger_reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "organization_id" "uuid" NOT NULL
);


ALTER TABLE "public"."deliverable_versions" OWNER TO "postgres";


COMMENT ON COLUMN "public"."deliverable_versions"."organization_id" IS 'Organisation propriétaire (multi-tenant). Nullable temporairement pendant la migration.';



CREATE TABLE IF NOT EXISTS "public"."deliverables" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "enterprise_id" "uuid" NOT NULL,
    "type" "public"."deliverable_type" NOT NULL,
    "version" integer DEFAULT 1 NOT NULL,
    "data" "jsonb" DEFAULT '{}'::"jsonb",
    "html_content" "text",
    "file_url" "text",
    "score" numeric(5,2),
    "ai_generated" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "generated_by" "text" DEFAULT 'entrepreneur'::"text",
    "visibility" "text" DEFAULT 'shared'::"text",
    "shared_at" timestamp with time zone,
    "coach_id" "uuid",
    "organization_id" "uuid" NOT NULL
);


ALTER TABLE "public"."deliverables" OWNER TO "postgres";


COMMENT ON TABLE "public"."deliverables" IS 'pipeline deliverables — auto-org_id via trigger';



COMMENT ON COLUMN "public"."deliverables"."organization_id" IS 'Organisation propriétaire (multi-tenant). Nullable temporairement pendant la migration.';



CREATE TABLE IF NOT EXISTS "public"."enterprise_coaches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "enterprise_id" "uuid" NOT NULL,
    "coach_id" "uuid" NOT NULL,
    "role" "text" DEFAULT 'principal'::"text",
    "assigned_by" "uuid",
    "assigned_at" timestamp with time zone DEFAULT "now"(),
    "unassigned_at" timestamp with time zone,
    "is_active" boolean DEFAULT true,
    "notes" "text",
    "organization_id" "uuid" NOT NULL,
    CONSTRAINT "enterprise_coaches_role_check" CHECK (("role" = ANY (ARRAY['principal'::"text", 'secondaire'::"text", 'financier'::"text", 'strategique'::"text", 'junior'::"text", 'senior'::"text"])))
);

ALTER TABLE ONLY "public"."enterprise_coaches" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."enterprise_coaches" OWNER TO "postgres";


COMMENT ON TABLE "public"."enterprise_coaches" IS 'Relation N-à-N entre coaches et entreprises. Remplace enterprises.coach_id (deprecated, conservée pour compat UI temporaire)';



COMMENT ON COLUMN "public"."enterprise_coaches"."role" IS 'Rôle du coach: principal (par défaut), secondaire, financier, strategique, junior, senior';



COMMENT ON COLUMN "public"."enterprise_coaches"."unassigned_at" IS 'Date de fin d assignation (soft delete via is_active=false)';



COMMENT ON COLUMN "public"."enterprise_coaches"."organization_id" IS 'Organisation propriétaire (multi-tenant). Nullable temporairement pendant la migration.';



CREATE TABLE IF NOT EXISTS "public"."enterprise_modules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "enterprise_id" "uuid" NOT NULL,
    "module" "public"."module_code" NOT NULL,
    "status" "public"."module_status" DEFAULT 'not_started'::"public"."module_status" NOT NULL,
    "progress" integer DEFAULT 0,
    "data" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    CONSTRAINT "enterprise_modules_progress_check" CHECK ((("progress" >= 0) AND ("progress" <= 100)))
);


ALTER TABLE "public"."enterprise_modules" OWNER TO "postgres";


COMMENT ON COLUMN "public"."enterprise_modules"."organization_id" IS 'Organisation propriétaire (multi-tenant). Nullable temporairement pendant la migration.';



CREATE TABLE IF NOT EXISTS "public"."enterprises" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "coach_id" "uuid",
    "name" "text" NOT NULL,
    "sector" "text",
    "country" "text" DEFAULT 'Côte d''Ivoire'::"text",
    "city" "text",
    "legal_form" "text",
    "creation_date" "date",
    "employees_count" integer DEFAULT 0,
    "description" "text",
    "logo_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "uploaded_files" "jsonb" DEFAULT '[]'::"jsonb",
    "contact_name" "text",
    "contact_email" "text",
    "contact_phone" "text",
    "phase" "text" DEFAULT 'identite'::"text",
    "score_ir" integer DEFAULT 0,
    "last_activity" timestamp with time zone DEFAULT "now"(),
    "base_year" integer,
    "document_content" "text",
    "document_content_updated_at" timestamp with time zone,
    "document_files_count" integer DEFAULT 0,
    "document_parsing_report" "jsonb",
    "operating_mode" "public"."operating_mode",
    "data_room_enabled" boolean DEFAULT false,
    "data_room_slug" "text",
    "data_changed_at" timestamp with time zone DEFAULT "now"(),
    "organization_id" "uuid" NOT NULL
);


ALTER TABLE "public"."enterprises" OWNER TO "postgres";


COMMENT ON COLUMN "public"."enterprises"."data_changed_at" IS 'Timestamp bumped only when data-impactful fields change (sector, country, description, document_content, employees_count). NOT bumped for cosmetic changes (name, city, legal_form, contact_*).';



COMMENT ON COLUMN "public"."enterprises"."organization_id" IS 'Organisation propriétaire (multi-tenant). Nullable temporairement pendant la migration.';



CREATE TABLE IF NOT EXISTS "public"."funding_matches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "enterprise_id" "uuid",
    "funding_program_id" "uuid",
    "match_score" integer DEFAULT 0,
    "criteria_met" "text"[] DEFAULT '{}'::"text"[],
    "criteria_missing" "text"[] DEFAULT '{}'::"text"[],
    "gap_analysis" "jsonb" DEFAULT '{}'::"jsonb",
    "computed_at" timestamp with time zone DEFAULT "now"(),
    "organization_id" "uuid" NOT NULL
);


ALTER TABLE "public"."funding_matches" OWNER TO "postgres";


COMMENT ON TABLE "public"."funding_matches" IS 'Matching automatique entreprise ↔ programme avec gap analysis';



COMMENT ON COLUMN "public"."funding_matches"."organization_id" IS 'Organisation propriétaire (multi-tenant). Nullable temporairement pendant la migration.';



CREATE TABLE IF NOT EXISTS "public"."funding_programs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "organisme" "text" NOT NULL,
    "type_financement" "text"[] DEFAULT '{}'::"text"[],
    "ticket_min" bigint DEFAULT 0,
    "ticket_max" bigint DEFAULT 0,
    "devise" "text" DEFAULT 'FCFA'::"text",
    "pays_eligibles" "text"[] DEFAULT '{}'::"text"[],
    "secteurs_eligibles" "text"[] DEFAULT '{}'::"text"[],
    "phase_entreprise" "text"[] DEFAULT '{}'::"text"[],
    "ca_min" bigint DEFAULT 0,
    "ca_max" bigint,
    "marge_brute_min" numeric,
    "ebitda_positif" boolean DEFAULT false,
    "resultat_net_positif" boolean DEFAULT false,
    "historique_min_ans" integer DEFAULT 0,
    "effectif_min" integer DEFAULT 0,
    "effectif_max" integer,
    "odd_requis" "text"[] DEFAULT '{}'::"text"[],
    "impact_social_requis" boolean DEFAULT false,
    "impact_environnemental_requis" boolean DEFAULT false,
    "conformite_ifc" boolean DEFAULT false,
    "etats_financiers_certifies" boolean DEFAULT false,
    "forme_juridique_requise" "text"[],
    "score_ir_min" integer DEFAULT 0,
    "description" "text",
    "site_web" "text",
    "contact_email" "text",
    "date_limite" "text",
    "is_active" boolean DEFAULT true,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "organization_id" "uuid"
);


ALTER TABLE "public"."funding_programs" OWNER TO "postgres";


COMMENT ON TABLE "public"."funding_programs" IS 'Base de données des programmes de financement / bailleurs avec critères d''éligibilité';



COMMENT ON COLUMN "public"."funding_programs"."organization_id" IS 'Organisation propriétaire (multi-tenant). Nullable temporairement pendant la migration.';



CREATE TABLE IF NOT EXISTS "public"."inputs_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "enterprise_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "data" "jsonb" NOT NULL,
    "score" integer,
    "trigger" "text" NOT NULL,
    "documents_added" "text"[],
    "diff" "jsonb",
    "organization_id" "uuid" NOT NULL
);


ALTER TABLE "public"."inputs_history" OWNER TO "postgres";


COMMENT ON COLUMN "public"."inputs_history"."organization_id" IS 'Organisation propriétaire (multi-tenant). Nullable temporairement pendant la migration.';



CREATE TABLE IF NOT EXISTS "public"."knowledge_base" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "category" "text" NOT NULL,
    "title" "text" NOT NULL,
    "content" "text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "source" "text",
    "country" "text",
    "sector" "text",
    "tags" "text"[] DEFAULT '{}'::"text"[],
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "embedding" "extensions"."vector"(1536),
    "expires_at" timestamp with time zone,
    "auto_refresh" boolean DEFAULT false,
    "refresh_source" "text",
    "last_refreshed_at" timestamp with time zone
);


ALTER TABLE "public"."knowledge_base" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."knowledge_benchmarks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "secteur" "text" NOT NULL,
    "pays" "text" DEFAULT 'all'::"text" NOT NULL,
    "zone" "text" DEFAULT 'uemoa'::"text",
    "marge_brute_min" numeric,
    "marge_brute_max" numeric,
    "marge_brute_mediane" numeric,
    "marge_ebitda_min" numeric,
    "marge_ebitda_max" numeric,
    "marge_nette_min" numeric,
    "marge_nette_max" numeric,
    "ratio_personnel_ca_min" numeric,
    "ratio_personnel_ca_max" numeric,
    "ratio_charges_fixes_ca_min" numeric,
    "ratio_charges_fixes_ca_max" numeric,
    "croissance_ca_max" numeric,
    "multiple_ebitda_min" numeric,
    "multiple_ebitda_max" numeric,
    "multiple_ca_min" numeric,
    "multiple_ca_max" numeric,
    "source" "text" NOT NULL,
    "source_url" "text",
    "source_type" "text" DEFAULT 'benchmark'::"text",
    "date_source" "date",
    "perimetre" "text",
    "notes" "text",
    "date_mise_a_jour" timestamp with time zone DEFAULT "now"(),
    "capex_typiques" "jsonb" DEFAULT '{}'::"jsonb",
    "opex_structure" "jsonb" DEFAULT '{}'::"jsonb",
    "bfr_typique" "jsonb" DEFAULT '{}'::"jsonb",
    "seuil_alerte" "jsonb" DEFAULT '{}'::"jsonb",
    "duree_amort_specifique" "jsonb" DEFAULT '{}'::"jsonb"
);


ALTER TABLE "public"."knowledge_benchmarks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."knowledge_chunks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "kb_entry_id" "uuid",
    "org_entry_id" "uuid",
    "chunk_index" integer NOT NULL,
    "content" "text" NOT NULL,
    "token_count" integer,
    "title" "text",
    "source" "text",
    "country" "text",
    "sector" "text",
    "category" "text",
    "source_url" "text",
    "publication_date" "date",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "embedding" "extensions"."vector"(1024),
    CONSTRAINT "chunks_one_parent" CHECK (((("kb_entry_id" IS NOT NULL) AND ("org_entry_id" IS NULL)) OR (("kb_entry_id" IS NULL) AND ("org_entry_id" IS NOT NULL))))
);


ALTER TABLE "public"."knowledge_chunks" OWNER TO "postgres";


COMMENT ON TABLE "public"."knowledge_chunks" IS 'Chunks de documents KB avec embeddings pour recherche vectorielle (RAG)';



CREATE TABLE IF NOT EXISTS "public"."knowledge_country_data" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "pays" "text" NOT NULL,
    "pib_usd_millions" numeric,
    "croissance_pib_pct" numeric,
    "inflation_pct" numeric,
    "population_millions" numeric,
    "cadre_comptable" "text" DEFAULT 'SYSCOHADA'::"text",
    "devise" "text" DEFAULT 'XOF'::"text",
    "taux_is" numeric,
    "taux_tva" numeric,
    "cotisations_sociales_pct" numeric,
    "salaire_minimum" numeric,
    "salaire_dirigeant_pme_min" numeric,
    "salaire_dirigeant_pme_max" numeric,
    "corruption_index" numeric,
    "risque_politique" "text",
    "taux_emprunt_pme" numeric,
    "acces_credit_pme_pct" numeric,
    "source" "text",
    "date_mise_a_jour" timestamp with time zone DEFAULT "now"(),
    "charges_patronales_pct" numeric,
    "charges_salariales_pct" numeric,
    "is_pme" numeric,
    "seuil_is_pme" "text",
    "patente_taux" "text",
    "taxe_apprentissage_pct" numeric,
    "contribution_fonciere_pct" numeric,
    "taux_usure" numeric,
    "taux_directeur" numeric,
    "duree_amort_immeubles_ans" integer DEFAULT 20,
    "duree_amort_vehicules_ans" integer DEFAULT 5,
    "duree_amort_materiel_ans" integer DEFAULT 10,
    "duree_amort_mobilier_ans" integer DEFAULT 10,
    "duree_amort_informatique_ans" integer DEFAULT 3,
    "duree_amort_equipement_agri_ans" integer DEFAULT 8,
    "taux_change_eur" numeric,
    "taux_change_usd" numeric,
    "zone_monetaire" "text",
    "regime_fiscal_notes" "text",
    "charges_sociales_detail" "jsonb" DEFAULT '{}'::"jsonb",
    "fiscalite_detail" "jsonb" DEFAULT '{}'::"jsonb",
    "opex_benchmarks" "jsonb" DEFAULT '{}'::"jsonb"
);


ALTER TABLE "public"."knowledge_country_data" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."knowledge_risk_factors" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "categorie" "text" NOT NULL,
    "titre" "text" NOT NULL,
    "description" "text" NOT NULL,
    "signaux" "jsonb" NOT NULL,
    "correction" "text",
    "secteurs_concernes" "text"[],
    "pays_concernes" "text"[],
    "severity" "text" DEFAULT 'medium'::"text",
    "source" "text",
    "is_active" boolean DEFAULT true
);


ALTER TABLE "public"."knowledge_risk_factors" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."knowledge_risk_params" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "pays" "text" NOT NULL,
    "zone" "text" NOT NULL,
    "risk_free_rate" numeric NOT NULL,
    "equity_risk_premium" numeric NOT NULL,
    "country_risk_premium" numeric,
    "default_spread" numeric,
    "size_premium_micro" numeric,
    "size_premium_small" numeric,
    "size_premium_medium" numeric,
    "illiquidity_premium_min" numeric,
    "illiquidity_premium_max" numeric,
    "cost_of_debt" numeric,
    "tax_rate" numeric,
    "taux_directeur" numeric,
    "decote_illiquidite" numeric DEFAULT 25,
    "decote_taille_micro" numeric DEFAULT 20,
    "decote_taille_small" numeric DEFAULT 10,
    "decote_gouvernance_no_audit" numeric DEFAULT 5,
    "decote_gouvernance_no_board" numeric DEFAULT 8,
    "risque_pays_label" "text",
    "risque_pays_prime" numeric,
    "source" "text" NOT NULL,
    "source_url" "text",
    "date_source" "date",
    "date_mise_a_jour" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."knowledge_risk_params" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."knowledge_sources" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nom" "text" NOT NULL,
    "organisme" "text" NOT NULL,
    "type_source" "text" NOT NULL,
    "url" "text",
    "acces" "text" DEFAULT 'public'::"text",
    "themes" "text"[],
    "pays_couverts" "text"[],
    "secteurs_couverts" "text"[],
    "date_publication" "date",
    "frequence_mise_a_jour" "text",
    "perimetre_temporel" "text",
    "utilise_dans" "text"[],
    "priorite" integer DEFAULT 5,
    "notes" "text"
);


ALTER TABLE "public"."knowledge_sources" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."organization_invitations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "role" "text" NOT NULL,
    "invited_by" "uuid",
    "personal_message" "text",
    "token" "text" DEFAULT "encode"("extensions"."gen_random_bytes"(32), 'hex'::"text") NOT NULL,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '7 days'::interval) NOT NULL,
    "accepted_at" timestamp with time zone,
    "revoked_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "enterprise_id" "uuid",
    CONSTRAINT "organization_invitations_role_check" CHECK (("role" = ANY (ARRAY['owner'::"text", 'admin'::"text", 'manager'::"text", 'analyst'::"text", 'coach'::"text", 'entrepreneur'::"text"])))
);

ALTER TABLE ONLY "public"."organization_invitations" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."organization_invitations" OWNER TO "postgres";


COMMENT ON TABLE "public"."organization_invitations" IS 'Invitations en attente pour rejoindre une organisation';



COMMENT ON COLUMN "public"."organization_invitations"."role" IS 'Rôle attribué à l acceptation (owner exclu — créé par super_admin)';



COMMENT ON COLUMN "public"."organization_invitations"."token" IS 'Token unique envoyé par email, valide 7 jours';



COMMENT ON COLUMN "public"."organization_invitations"."enterprise_id" IS 'Si renseigné, le user accepté devient propriétaire (user_id) de cette enterprise à l''acceptation.';



CREATE TABLE IF NOT EXISTS "public"."organization_knowledge" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "category" "text" DEFAULT 'general'::"text" NOT NULL,
    "title" "text" NOT NULL,
    "content" "text" NOT NULL,
    "country" "text",
    "sector" "text",
    "source" "text",
    "tags" "text"[] DEFAULT '{}'::"text"[],
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "is_active" boolean DEFAULT true,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."organization_knowledge" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."organization_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "invited_by" "uuid",
    "joined_at" timestamp with time zone DEFAULT "now"(),
    "is_active" boolean DEFAULT true,
    CONSTRAINT "organization_members_role_check" CHECK (("role" = ANY (ARRAY['owner'::"text", 'admin'::"text", 'manager'::"text", 'analyst'::"text", 'coach'::"text", 'entrepreneur'::"text"])))
);

ALTER TABLE ONLY "public"."organization_members" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."organization_members" OWNER TO "postgres";


COMMENT ON TABLE "public"."organization_members" IS 'Membres de chaque organisation avec leur rôle';



COMMENT ON COLUMN "public"."organization_members"."role" IS 'owner=créateur, admin=gestionnaire, manager=chef prog/MD, analyst=IM, coach=coach/analyste PE, entrepreneur=PE optionnel';



COMMENT ON COLUMN "public"."organization_members"."is_active" IS 'false = membre retiré (soft delete)';



CREATE TABLE IF NOT EXISTS "public"."organizations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "type" "text" NOT NULL,
    "country" "text",
    "logo_url" "text",
    "primary_color" "text",
    "secondary_color" "text",
    "settings" "jsonb" DEFAULT '{}'::"jsonb",
    "is_active" boolean DEFAULT true,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "organizations_type_check" CHECK (("type" = ANY (ARRAY['programme'::"text", 'pe'::"text", 'mixed'::"text"])))
);

ALTER TABLE ONLY "public"."organizations" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."organizations" OWNER TO "postgres";


COMMENT ON TABLE "public"."organizations" IS 'Organisations clientes ESONO — chaque org est un espace isolé (multi-tenant)';



COMMENT ON COLUMN "public"."organizations"."slug" IS 'Identifiant URL unique (ex: enabel-ci)';



COMMENT ON COLUMN "public"."organizations"."type" IS 'Type: programme (opérateur/bailleur), pe (private equity), mixed';



COMMENT ON COLUMN "public"."organizations"."primary_color" IS 'Couleur primaire branding (hex)';



COMMENT ON COLUMN "public"."organizations"."secondary_color" IS 'Couleur secondaire branding (hex)';



COMMENT ON COLUMN "public"."organizations"."settings" IS 'Configuration custom: modules activés, langue, devise, pipeline, etc.';



CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "full_name" "text",
    "email" "text",
    "phone" "text",
    "avatar_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."programme_criteria" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "min_score_ir" integer DEFAULT 0,
    "max_score_ir" integer DEFAULT 100,
    "required_deliverables" "text"[] DEFAULT '{}'::"text"[],
    "sector_filter" "text"[] DEFAULT '{}'::"text"[],
    "country_filter" "text"[] DEFAULT '{}'::"text"[],
    "min_revenue" numeric DEFAULT 0,
    "max_debt_ratio" numeric DEFAULT 100,
    "min_margin" numeric DEFAULT 0,
    "custom_criteria" "jsonb" DEFAULT '{}'::"jsonb",
    "is_active" boolean DEFAULT true,
    "created_by" "uuid" NOT NULL,
    "source_document_url" "text",
    "raw_criteria_text" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "organization_id" "uuid" NOT NULL
);


ALTER TABLE "public"."programme_criteria" OWNER TO "postgres";


COMMENT ON COLUMN "public"."programme_criteria"."organization_id" IS 'Organisation propriétaire (multi-tenant). Nullable temporairement pendant la migration.';



CREATE TABLE IF NOT EXISTS "public"."programme_kpi_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "kpi_id" "uuid" NOT NULL,
    "value" numeric NOT NULL,
    "period" "text" NOT NULL,
    "notes" "text",
    "recorded_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "organization_id" "uuid" NOT NULL
);


ALTER TABLE "public"."programme_kpi_history" OWNER TO "postgres";


COMMENT ON COLUMN "public"."programme_kpi_history"."organization_id" IS 'Organisation propriétaire (multi-tenant). Nullable temporairement pendant la migration.';



CREATE TABLE IF NOT EXISTS "public"."programme_kpis" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "programme_id" "uuid" NOT NULL,
    "kpi_name" "text" NOT NULL,
    "kpi_code" "text" NOT NULL,
    "kpi_category" "text" NOT NULL,
    "description" "text",
    "baseline_value" numeric DEFAULT 0,
    "target_value" numeric,
    "current_value" numeric DEFAULT 0,
    "unit" "text" NOT NULL,
    "source" "text" DEFAULT 'manual'::"text",
    "auto_formula" "text",
    "bailleur" "text",
    "reporting_frequency" "text" DEFAULT 'quarterly'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "organization_id" "uuid" NOT NULL,
    CONSTRAINT "programme_kpis_kpi_category_check" CHECK (("kpi_category" = ANY (ARRAY['emploi'::"text", 'financier'::"text", 'impact_social'::"text", 'impact_environnemental'::"text", 'genre'::"text", 'formation'::"text", 'gouvernance'::"text", 'custom'::"text"]))),
    CONSTRAINT "programme_kpis_reporting_frequency_check" CHECK (("reporting_frequency" = ANY (ARRAY['monthly'::"text", 'quarterly'::"text", 'semestrial'::"text", 'annual'::"text", 'final'::"text"]))),
    CONSTRAINT "programme_kpis_source_check" CHECK (("source" = ANY (ARRAY['auto'::"text", 'manual'::"text", 'mixed'::"text"])))
);


ALTER TABLE "public"."programme_kpis" OWNER TO "postgres";


COMMENT ON COLUMN "public"."programme_kpis"."organization_id" IS 'Organisation propriétaire (multi-tenant). Nullable temporairement pendant la migration.';



CREATE TABLE IF NOT EXISTS "public"."programmes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "organization" "text",
    "logo_url" "text",
    "country_filter" "text"[] DEFAULT '{}'::"text"[],
    "sector_filter" "text"[] DEFAULT '{}'::"text"[],
    "budget" numeric,
    "nb_places" integer,
    "currency" "text" DEFAULT 'XOF'::"text",
    "criteria_id" "uuid",
    "start_date" "date",
    "end_date" "date",
    "programme_start" "date",
    "programme_end" "date",
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "form_fields" "jsonb" DEFAULT '[]'::"jsonb",
    "form_slug" "text",
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "chef_programme_id" "uuid",
    "type" "text" DEFAULT 'appel_candidatures'::"text",
    "last_report" "jsonb",
    "last_report_type" "text",
    "last_report_at" timestamp with time zone,
    "organization_id" "uuid" NOT NULL,
    CONSTRAINT "programmes_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'open'::"text", 'closed'::"text", 'in_progress'::"text", 'completed'::"text"]))),
    CONSTRAINT "programmes_type_check" CHECK (("type" = ANY (ARRAY['appel_candidatures'::"text", 'cohorte_directe'::"text"])))
);


ALTER TABLE "public"."programmes" OWNER TO "postgres";


COMMENT ON COLUMN "public"."programmes"."organization_id" IS 'Organisation propriétaire (multi-tenant). Nullable temporairement pendant la migration.';



CREATE TABLE IF NOT EXISTS "public"."score_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "enterprise_id" "uuid" NOT NULL,
    "score" integer NOT NULL,
    "scores_detail" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "organization_id" "uuid" NOT NULL
);


ALTER TABLE "public"."score_history" OWNER TO "postgres";


COMMENT ON COLUMN "public"."score_history"."organization_id" IS 'Organisation propriétaire (multi-tenant). Nullable temporairement pendant la migration.';



CREATE TABLE IF NOT EXISTS "public"."user_roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "public"."app_role" NOT NULL
);


ALTER TABLE "public"."user_roles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."workspace_knowledge" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "cle" "text" NOT NULL,
    "valeur" "jsonb" NOT NULL,
    "notes" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "organization_id" "uuid" NOT NULL
);


ALTER TABLE "public"."workspace_knowledge" OWNER TO "postgres";


COMMENT ON COLUMN "public"."workspace_knowledge"."organization_id" IS 'Organisation propriétaire (multi-tenant). Nullable temporairement pendant la migration.';



ALTER TABLE ONLY "public"."activity_log"
    ADD CONSTRAINT "activity_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."aggregated_benchmarks"
    ADD CONSTRAINT "aggregated_benchmarks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."aggregated_benchmarks"
    ADD CONSTRAINT "aggregated_benchmarks_secteur_pays_key" UNIQUE ("secteur", "pays");



ALTER TABLE ONLY "public"."ai_cost_log"
    ADD CONSTRAINT "ai_cost_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."candidatures"
    ADD CONSTRAINT "candidatures_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."coach_uploads"
    ADD CONSTRAINT "coach_uploads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."coaching_notes"
    ADD CONSTRAINT "coaching_notes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."data_room_documents"
    ADD CONSTRAINT "data_room_documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."data_room_shares"
    ADD CONSTRAINT "data_room_shares_access_token_key" UNIQUE ("access_token");



ALTER TABLE ONLY "public"."data_room_shares"
    ADD CONSTRAINT "data_room_shares_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."deliverable_corrections"
    ADD CONSTRAINT "deliverable_corrections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."deliverable_versions"
    ADD CONSTRAINT "deliverable_versions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."deliverables"
    ADD CONSTRAINT "deliverables_enterprise_id_type_unique" UNIQUE ("enterprise_id", "type");



ALTER TABLE ONLY "public"."deliverables"
    ADD CONSTRAINT "deliverables_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."enterprise_coaches"
    ADD CONSTRAINT "enterprise_coaches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."enterprise_modules"
    ADD CONSTRAINT "enterprise_modules_enterprise_id_module_key" UNIQUE ("enterprise_id", "module");



ALTER TABLE ONLY "public"."enterprise_modules"
    ADD CONSTRAINT "enterprise_modules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."enterprises"
    ADD CONSTRAINT "enterprises_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."funding_matches"
    ADD CONSTRAINT "funding_matches_enterprise_id_funding_program_id_key" UNIQUE ("enterprise_id", "funding_program_id");



ALTER TABLE ONLY "public"."funding_matches"
    ADD CONSTRAINT "funding_matches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."funding_programs"
    ADD CONSTRAINT "funding_programs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inputs_history"
    ADD CONSTRAINT "inputs_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."knowledge_base"
    ADD CONSTRAINT "knowledge_base_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."knowledge_benchmarks"
    ADD CONSTRAINT "knowledge_benchmarks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."knowledge_benchmarks"
    ADD CONSTRAINT "knowledge_benchmarks_secteur_pays_key" UNIQUE ("secteur", "pays");



ALTER TABLE ONLY "public"."knowledge_chunks"
    ADD CONSTRAINT "knowledge_chunks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."knowledge_country_data"
    ADD CONSTRAINT "knowledge_country_data_pays_key" UNIQUE ("pays");



ALTER TABLE ONLY "public"."knowledge_country_data"
    ADD CONSTRAINT "knowledge_country_data_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."knowledge_risk_factors"
    ADD CONSTRAINT "knowledge_risk_factors_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."knowledge_risk_factors"
    ADD CONSTRAINT "knowledge_risk_factors_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."knowledge_risk_params"
    ADD CONSTRAINT "knowledge_risk_params_pays_key" UNIQUE ("pays");



ALTER TABLE ONLY "public"."knowledge_risk_params"
    ADD CONSTRAINT "knowledge_risk_params_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."knowledge_sources"
    ADD CONSTRAINT "knowledge_sources_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organization_invitations"
    ADD CONSTRAINT "organization_invitations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organization_invitations"
    ADD CONSTRAINT "organization_invitations_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."organization_knowledge"
    ADD CONSTRAINT "organization_knowledge_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organization_members"
    ADD CONSTRAINT "organization_members_organization_id_user_id_key" UNIQUE ("organization_id", "user_id");



ALTER TABLE ONLY "public"."organization_members"
    ADD CONSTRAINT "organization_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."programme_criteria"
    ADD CONSTRAINT "programme_criteria_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."programme_kpi_history"
    ADD CONSTRAINT "programme_kpi_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."programme_kpis"
    ADD CONSTRAINT "programme_kpis_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."programme_kpis"
    ADD CONSTRAINT "programme_kpis_programme_id_kpi_code_key" UNIQUE ("programme_id", "kpi_code");



ALTER TABLE ONLY "public"."programmes"
    ADD CONSTRAINT "programmes_form_slug_key" UNIQUE ("form_slug");



ALTER TABLE ONLY "public"."programmes"
    ADD CONSTRAINT "programmes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."score_history"
    ADD CONSTRAINT "score_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_role_key" UNIQUE ("user_id", "role");



ALTER TABLE ONLY "public"."workspace_knowledge"
    ADD CONSTRAINT "workspace_knowledge_owner_id_type_cle_key" UNIQUE ("owner_id", "type", "cle");



ALTER TABLE ONLY "public"."workspace_knowledge"
    ADD CONSTRAINT "workspace_knowledge_pkey" PRIMARY KEY ("id");



CREATE INDEX "data_room_documents_enterprise_idx" ON "public"."data_room_documents" USING "btree" ("enterprise_id");



CREATE INDEX "data_room_shares_enterprise_idx" ON "public"."data_room_shares" USING "btree" ("enterprise_id");



CREATE UNIQUE INDEX "deliverables_enterprise_type_unique" ON "public"."deliverables" USING "btree" ("enterprise_id", "type");



CREATE UNIQUE INDEX "enterprises_data_room_slug_idx" ON "public"."enterprises" USING "btree" ("data_room_slug") WHERE ("data_room_slug" IS NOT NULL);



CREATE INDEX "idx_activity_log_enterprise" ON "public"."activity_log" USING "btree" ("enterprise_id", "created_at" DESC);



CREATE INDEX "idx_activity_log_org_id" ON "public"."activity_log" USING "btree" ("organization_id");



CREATE INDEX "idx_aggregated_benchmarks_org_id" ON "public"."aggregated_benchmarks" USING "btree" ("organization_id");



CREATE INDEX "idx_ai_cost_created" ON "public"."ai_cost_log" USING "btree" ("created_at");



CREATE INDEX "idx_ai_cost_enterprise" ON "public"."ai_cost_log" USING "btree" ("enterprise_id");



CREATE INDEX "idx_ai_cost_log_date" ON "public"."ai_cost_log" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_ai_cost_log_org_date" ON "public"."ai_cost_log" USING "btree" ("organization_id", "created_at" DESC);



CREATE INDEX "idx_ai_cost_log_org_id" ON "public"."ai_cost_log" USING "btree" ("organization_id");



CREATE INDEX "idx_candidatures_enterprise" ON "public"."candidatures" USING "btree" ("enterprise_id");



CREATE INDEX "idx_candidatures_org_id" ON "public"."candidatures" USING "btree" ("organization_id");



CREATE INDEX "idx_candidatures_programme" ON "public"."candidatures" USING "btree" ("programme_id");



CREATE INDEX "idx_candidatures_status" ON "public"."candidatures" USING "btree" ("status");



CREATE INDEX "idx_chunks_country_sector" ON "public"."knowledge_chunks" USING "btree" ("country", "sector");



CREATE INDEX "idx_chunks_embedding" ON "public"."knowledge_chunks" USING "hnsw" ("embedding" "extensions"."vector_cosine_ops") WITH ("m"='16', "ef_construction"='64');



CREATE INDEX "idx_chunks_kb" ON "public"."knowledge_chunks" USING "btree" ("kb_entry_id") WHERE ("kb_entry_id" IS NOT NULL);



CREATE INDEX "idx_chunks_org" ON "public"."knowledge_chunks" USING "btree" ("org_entry_id") WHERE ("org_entry_id" IS NOT NULL);



CREATE INDEX "idx_coach_uploads_coach" ON "public"."coach_uploads" USING "btree" ("coach_id");



CREATE INDEX "idx_coach_uploads_enterprise" ON "public"."coach_uploads" USING "btree" ("enterprise_id");



CREATE INDEX "idx_coach_uploads_org_id" ON "public"."coach_uploads" USING "btree" ("organization_id");



CREATE INDEX "idx_coaching_notes_enterprise" ON "public"."coaching_notes" USING "btree" ("enterprise_id", "created_at" DESC);



CREATE INDEX "idx_coaching_notes_org_id" ON "public"."coaching_notes" USING "btree" ("organization_id");



CREATE INDEX "idx_corrections_enterprise" ON "public"."deliverable_corrections" USING "btree" ("enterprise_id");



CREATE INDEX "idx_data_room_documents_org_id" ON "public"."data_room_documents" USING "btree" ("organization_id");



CREATE INDEX "idx_data_room_shares_org_id" ON "public"."data_room_shares" USING "btree" ("organization_id");



CREATE INDEX "idx_deliverable_corrections_org_id" ON "public"."deliverable_corrections" USING "btree" ("organization_id");



CREATE INDEX "idx_deliverable_versions_org_id" ON "public"."deliverable_versions" USING "btree" ("organization_id");



CREATE INDEX "idx_deliverables_org_id" ON "public"."deliverables" USING "btree" ("organization_id");



CREATE INDEX "idx_deliverables_visibility" ON "public"."deliverables" USING "btree" ("visibility");



CREATE INDEX "idx_enterprise_coaches_coach" ON "public"."enterprise_coaches" USING "btree" ("coach_id") WHERE ("is_active" = true);



CREATE INDEX "idx_enterprise_coaches_enterprise" ON "public"."enterprise_coaches" USING "btree" ("enterprise_id") WHERE ("is_active" = true);



CREATE INDEX "idx_enterprise_coaches_org_id" ON "public"."enterprise_coaches" USING "btree" ("organization_id");



CREATE UNIQUE INDEX "idx_enterprise_coaches_unique_active" ON "public"."enterprise_coaches" USING "btree" ("enterprise_id", "coach_id") WHERE ("is_active" = true);



CREATE INDEX "idx_enterprise_modules_org_id" ON "public"."enterprise_modules" USING "btree" ("organization_id");



CREATE INDEX "idx_enterprises_coach" ON "public"."enterprises" USING "btree" ("coach_id");



CREATE INDEX "idx_enterprises_org_id" ON "public"."enterprises" USING "btree" ("organization_id");



CREATE INDEX "idx_funding_matches_org_id" ON "public"."funding_matches" USING "btree" ("organization_id");



CREATE INDEX "idx_funding_programs_active" ON "public"."funding_programs" USING "btree" ("is_active") WHERE ("is_active" = true);



CREATE INDEX "idx_funding_programs_org_id" ON "public"."funding_programs" USING "btree" ("organization_id");



CREATE INDEX "idx_funding_programs_pays" ON "public"."funding_programs" USING "gin" ("pays_eligibles");



CREATE INDEX "idx_funding_programs_secteurs" ON "public"."funding_programs" USING "gin" ("secteurs_eligibles");



CREATE INDEX "idx_inputs_history_enterprise" ON "public"."inputs_history" USING "btree" ("enterprise_id", "created_at" DESC);



CREATE INDEX "idx_inputs_history_org_id" ON "public"."inputs_history" USING "btree" ("organization_id");



CREATE INDEX "idx_knowledge_base_category" ON "public"."knowledge_base" USING "btree" ("category");



CREATE INDEX "idx_knowledge_base_country" ON "public"."knowledge_base" USING "btree" ("country");



CREATE INDEX "idx_knowledge_base_sector" ON "public"."knowledge_base" USING "btree" ("sector");



CREATE INDEX "idx_knowledge_base_tags" ON "public"."knowledge_base" USING "gin" ("tags");



CREATE INDEX "idx_org_invitations_email" ON "public"."organization_invitations" USING "btree" ("email");



CREATE INDEX "idx_org_invitations_org_pending" ON "public"."organization_invitations" USING "btree" ("organization_id") WHERE (("accepted_at" IS NULL) AND ("revoked_at" IS NULL));



CREATE INDEX "idx_org_invitations_token" ON "public"."organization_invitations" USING "btree" ("token");



CREATE INDEX "idx_org_knowledge_category" ON "public"."organization_knowledge" USING "btree" ("category") WHERE ("is_active" = true);



CREATE INDEX "idx_org_knowledge_org" ON "public"."organization_knowledge" USING "btree" ("organization_id") WHERE ("is_active" = true);



CREATE INDEX "idx_org_members_org" ON "public"."organization_members" USING "btree" ("organization_id");



CREATE INDEX "idx_org_members_org_role" ON "public"."organization_members" USING "btree" ("organization_id", "role") WHERE ("is_active" = true);



CREATE INDEX "idx_org_members_user" ON "public"."organization_members" USING "btree" ("user_id") WHERE ("is_active" = true);



CREATE INDEX "idx_organization_invitations_enterprise_id" ON "public"."organization_invitations" USING "btree" ("enterprise_id") WHERE ("enterprise_id" IS NOT NULL);



CREATE INDEX "idx_organizations_active" ON "public"."organizations" USING "btree" ("is_active") WHERE ("is_active" = true);



CREATE INDEX "idx_organizations_slug" ON "public"."organizations" USING "btree" ("slug");



CREATE INDEX "idx_programme_criteria_org_id" ON "public"."programme_criteria" USING "btree" ("organization_id");



CREATE INDEX "idx_programme_kpi_history_org_id" ON "public"."programme_kpi_history" USING "btree" ("organization_id");



CREATE INDEX "idx_programme_kpis_org_id" ON "public"."programme_kpis" USING "btree" ("organization_id");



CREATE INDEX "idx_programmes_form_slug" ON "public"."programmes" USING "btree" ("form_slug");



CREATE INDEX "idx_programmes_org_id" ON "public"."programmes" USING "btree" ("organization_id");



CREATE INDEX "idx_programmes_status" ON "public"."programmes" USING "btree" ("status");



CREATE INDEX "idx_score_history_org_id" ON "public"."score_history" USING "btree" ("organization_id");



CREATE INDEX "idx_versions_deliverable" ON "public"."deliverable_versions" USING "btree" ("deliverable_id", "version" DESC);



CREATE INDEX "idx_workspace_knowledge_org_id" ON "public"."workspace_knowledge" USING "btree" ("organization_id");



CREATE UNIQUE INDEX "knowledge_base_title_unique_idx" ON "public"."knowledge_base" USING "btree" ("title") WHERE ("title" IS NOT NULL);



CREATE OR REPLACE TRIGGER "trg_deliverables_set_organization_id" BEFORE INSERT OR UPDATE ON "public"."deliverables" FOR EACH ROW EXECUTE FUNCTION "public"."deliverables_set_organization_id"();



CREATE OR REPLACE TRIGGER "trg_set_enterprise_base_year" BEFORE INSERT ON "public"."enterprises" FOR EACH ROW EXECUTE FUNCTION "public"."set_enterprise_base_year"();



CREATE OR REPLACE TRIGGER "trg_set_org_id" BEFORE INSERT OR UPDATE ON "public"."activity_log" FOR EACH ROW EXECUTE FUNCTION "public"."set_organization_id_from_enterprise"();



CREATE OR REPLACE TRIGGER "trg_set_org_id" BEFORE INSERT OR UPDATE ON "public"."coaching_notes" FOR EACH ROW EXECUTE FUNCTION "public"."set_organization_id_from_enterprise"();



CREATE OR REPLACE TRIGGER "trg_set_org_id" BEFORE INSERT OR UPDATE ON "public"."deliverable_versions" FOR EACH ROW EXECUTE FUNCTION "public"."set_organization_id_from_enterprise"();



CREATE OR REPLACE TRIGGER "trg_set_org_id" BEFORE INSERT OR UPDATE ON "public"."enterprise_modules" FOR EACH ROW EXECUTE FUNCTION "public"."set_organization_id_from_enterprise"();



CREATE OR REPLACE TRIGGER "trg_set_org_id" BEFORE INSERT OR UPDATE ON "public"."score_history" FOR EACH ROW EXECUTE FUNCTION "public"."set_organization_id_from_enterprise"();



CREATE OR REPLACE TRIGGER "update_deliverables_updated_at" BEFORE UPDATE ON "public"."deliverables" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_enterprise_modules_updated_at" BEFORE UPDATE ON "public"."enterprise_modules" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_enterprises_updated_at" BEFORE UPDATE ON "public"."enterprises" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_knowledge_base_updated_at" BEFORE UPDATE ON "public"."knowledge_base" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_organizations_updated_at" BEFORE UPDATE ON "public"."organizations" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_programme_criteria_updated_at" BEFORE UPDATE ON "public"."programme_criteria" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."activity_log"
    ADD CONSTRAINT "activity_log_enterprise_id_fkey" FOREIGN KEY ("enterprise_id") REFERENCES "public"."enterprises"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."activity_log"
    ADD CONSTRAINT "activity_log_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."aggregated_benchmarks"
    ADD CONSTRAINT "aggregated_benchmarks_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_cost_log"
    ADD CONSTRAINT "ai_cost_log_enterprise_id_fkey" FOREIGN KEY ("enterprise_id") REFERENCES "public"."enterprises"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ai_cost_log"
    ADD CONSTRAINT "ai_cost_log_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."candidatures"
    ADD CONSTRAINT "candidatures_assigned_coach_id_fkey" FOREIGN KEY ("assigned_coach_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."candidatures"
    ADD CONSTRAINT "candidatures_enterprise_id_fkey" FOREIGN KEY ("enterprise_id") REFERENCES "public"."enterprises"("id");



ALTER TABLE ONLY "public"."candidatures"
    ADD CONSTRAINT "candidatures_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."candidatures"
    ADD CONSTRAINT "candidatures_programme_id_fkey" FOREIGN KEY ("programme_id") REFERENCES "public"."programmes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."coach_uploads"
    ADD CONSTRAINT "coach_uploads_enterprise_id_fkey" FOREIGN KEY ("enterprise_id") REFERENCES "public"."enterprises"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."coach_uploads"
    ADD CONSTRAINT "coach_uploads_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."coaching_notes"
    ADD CONSTRAINT "coaching_notes_enterprise_id_fkey" FOREIGN KEY ("enterprise_id") REFERENCES "public"."enterprises"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."coaching_notes"
    ADD CONSTRAINT "coaching_notes_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."data_room_documents"
    ADD CONSTRAINT "data_room_documents_enterprise_id_fkey" FOREIGN KEY ("enterprise_id") REFERENCES "public"."enterprises"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."data_room_documents"
    ADD CONSTRAINT "data_room_documents_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."data_room_shares"
    ADD CONSTRAINT "data_room_shares_enterprise_id_fkey" FOREIGN KEY ("enterprise_id") REFERENCES "public"."enterprises"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."data_room_shares"
    ADD CONSTRAINT "data_room_shares_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."deliverable_corrections"
    ADD CONSTRAINT "deliverable_corrections_deliverable_id_fkey" FOREIGN KEY ("deliverable_id") REFERENCES "public"."deliverables"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."deliverable_corrections"
    ADD CONSTRAINT "deliverable_corrections_enterprise_id_fkey" FOREIGN KEY ("enterprise_id") REFERENCES "public"."enterprises"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."deliverable_corrections"
    ADD CONSTRAINT "deliverable_corrections_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."deliverable_versions"
    ADD CONSTRAINT "deliverable_versions_deliverable_id_fkey" FOREIGN KEY ("deliverable_id") REFERENCES "public"."deliverables"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."deliverable_versions"
    ADD CONSTRAINT "deliverable_versions_enterprise_id_fkey" FOREIGN KEY ("enterprise_id") REFERENCES "public"."enterprises"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."deliverable_versions"
    ADD CONSTRAINT "deliverable_versions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."deliverables"
    ADD CONSTRAINT "deliverables_enterprise_id_fkey" FOREIGN KEY ("enterprise_id") REFERENCES "public"."enterprises"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."deliverables"
    ADD CONSTRAINT "deliverables_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."enterprise_coaches"
    ADD CONSTRAINT "enterprise_coaches_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."enterprise_coaches"
    ADD CONSTRAINT "enterprise_coaches_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."enterprise_coaches"
    ADD CONSTRAINT "enterprise_coaches_enterprise_id_fkey" FOREIGN KEY ("enterprise_id") REFERENCES "public"."enterprises"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."enterprise_coaches"
    ADD CONSTRAINT "enterprise_coaches_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."enterprise_modules"
    ADD CONSTRAINT "enterprise_modules_enterprise_id_fkey" FOREIGN KEY ("enterprise_id") REFERENCES "public"."enterprises"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."enterprise_modules"
    ADD CONSTRAINT "enterprise_modules_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."enterprises"
    ADD CONSTRAINT "enterprises_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."enterprises"
    ADD CONSTRAINT "enterprises_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."enterprises"
    ADD CONSTRAINT "enterprises_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."funding_matches"
    ADD CONSTRAINT "funding_matches_enterprise_id_fkey" FOREIGN KEY ("enterprise_id") REFERENCES "public"."enterprises"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."funding_matches"
    ADD CONSTRAINT "funding_matches_funding_program_id_fkey" FOREIGN KEY ("funding_program_id") REFERENCES "public"."funding_programs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."funding_matches"
    ADD CONSTRAINT "funding_matches_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."funding_programs"
    ADD CONSTRAINT "funding_programs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inputs_history"
    ADD CONSTRAINT "inputs_history_enterprise_id_fkey" FOREIGN KEY ("enterprise_id") REFERENCES "public"."enterprises"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inputs_history"
    ADD CONSTRAINT "inputs_history_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."knowledge_chunks"
    ADD CONSTRAINT "knowledge_chunks_kb_entry_id_fkey" FOREIGN KEY ("kb_entry_id") REFERENCES "public"."knowledge_base"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."knowledge_chunks"
    ADD CONSTRAINT "knowledge_chunks_org_entry_id_fkey" FOREIGN KEY ("org_entry_id") REFERENCES "public"."organization_knowledge"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organization_invitations"
    ADD CONSTRAINT "organization_invitations_enterprise_id_fkey" FOREIGN KEY ("enterprise_id") REFERENCES "public"."enterprises"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."organization_invitations"
    ADD CONSTRAINT "organization_invitations_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."organization_invitations"
    ADD CONSTRAINT "organization_invitations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organization_knowledge"
    ADD CONSTRAINT "organization_knowledge_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."organization_knowledge"
    ADD CONSTRAINT "organization_knowledge_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organization_members"
    ADD CONSTRAINT "organization_members_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."organization_members"
    ADD CONSTRAINT "organization_members_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organization_members"
    ADD CONSTRAINT "organization_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."programme_criteria"
    ADD CONSTRAINT "programme_criteria_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."programme_kpi_history"
    ADD CONSTRAINT "programme_kpi_history_kpi_id_fkey" FOREIGN KEY ("kpi_id") REFERENCES "public"."programme_kpis"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."programme_kpi_history"
    ADD CONSTRAINT "programme_kpi_history_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."programme_kpi_history"
    ADD CONSTRAINT "programme_kpi_history_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."programme_kpis"
    ADD CONSTRAINT "programme_kpis_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."programme_kpis"
    ADD CONSTRAINT "programme_kpis_programme_id_fkey" FOREIGN KEY ("programme_id") REFERENCES "public"."programmes"("id");



ALTER TABLE ONLY "public"."programmes"
    ADD CONSTRAINT "programmes_chef_programme_id_fkey" FOREIGN KEY ("chef_programme_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."programmes"
    ADD CONSTRAINT "programmes_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."programmes"
    ADD CONSTRAINT "programmes_criteria_id_fkey" FOREIGN KEY ("criteria_id") REFERENCES "public"."programme_criteria"("id");



ALTER TABLE ONLY "public"."programmes"
    ADD CONSTRAINT "programmes_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."score_history"
    ADD CONSTRAINT "score_history_enterprise_id_fkey" FOREIGN KEY ("enterprise_id") REFERENCES "public"."enterprises"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."score_history"
    ADD CONSTRAINT "score_history_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."workspace_knowledge"
    ADD CONSTRAINT "workspace_knowledge_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



CREATE POLICY "Anyone can read active funding programs" ON "public"."funding_programs" FOR SELECT USING (("is_active" = true));



CREATE POLICY "Anyone can read cost log" ON "public"."ai_cost_log" FOR SELECT USING (true);



CREATE POLICY "Anyone can read funding matches" ON "public"."funding_matches" FOR SELECT USING (true);



CREATE POLICY "Authenticated users can read knowledge_base" ON "public"."knowledge_base" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Chef programme can view coach profiles" ON "public"."profiles" FOR SELECT USING (("public"."has_role"("auth"."uid"(), 'chef_programme'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'coach'::"public"."app_role")));



CREATE POLICY "Coach crit del own" ON "public"."programme_criteria" FOR DELETE TO "authenticated" USING ((("created_by" = "auth"."uid"()) AND "public"."has_role"("auth"."uid"(), 'coach'::"public"."app_role")));



CREATE POLICY "Coach crit ins" ON "public"."programme_criteria" FOR INSERT TO "authenticated" WITH CHECK ("public"."has_role"("auth"."uid"(), 'coach'::"public"."app_role"));



CREATE POLICY "Coach crit read" ON "public"."programme_criteria" FOR SELECT TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'coach'::"public"."app_role") AND ("is_active" = true)));



CREATE POLICY "Coach crit upd own" ON "public"."programme_criteria" FOR UPDATE TO "authenticated" USING ((("created_by" = "auth"."uid"()) AND "public"."has_role"("auth"."uid"(), 'coach'::"public"."app_role")));



CREATE POLICY "Coach uploads delete v2" ON "public"."coach_uploads" FOR DELETE USING (("public"."is_member_of"("organization_id") AND ("coach_id" = "auth"."uid"())));



CREATE POLICY "Coach uploads insert v2" ON "public"."coach_uploads" FOR INSERT WITH CHECK (("public"."is_member_of"("organization_id") AND ("coach_id" = "auth"."uid"()) AND "public"."is_coach_of_enterprise"("enterprise_id")));



CREATE POLICY "Coach uploads select v2" ON "public"."coach_uploads" FOR SELECT USING (("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR ("public"."is_member_of"("organization_id") AND (("coach_id" = "auth"."uid"()) OR "public"."is_coach_of_enterprise"("enterprise_id") OR ("public"."get_user_role_in"("organization_id") = ANY (ARRAY['owner'::"text", 'admin'::"text", 'manager'::"text"]))))));



CREATE POLICY "Coaches delete assigned enterprises v2" ON "public"."enterprises" FOR DELETE TO "authenticated" USING ("public"."is_coach_of_enterprise"("id"));



CREATE POLICY "Coaches see assigned enterprises v2" ON "public"."enterprises" FOR SELECT TO "authenticated" USING ("public"."is_coach_of_enterprise"("id"));



CREATE POLICY "Coaches update assigned enterprises v2" ON "public"."enterprises" FOR UPDATE TO "authenticated" USING ("public"."is_coach_of_enterprise"("id"));



CREATE POLICY "Coaching notes access" ON "public"."coaching_notes" TO "authenticated" USING ((("coach_id" = "auth"."uid"()) OR ("enterprise_id" IN ( SELECT "enterprises"."id"
   FROM "public"."enterprises"
  WHERE ("enterprises"."user_id" = "auth"."uid"()))) OR "public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role")));



CREATE POLICY "Coaching notes access v2" ON "public"."coaching_notes" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR ("public"."is_member_of"("organization_id") AND ("public"."is_coach_of_enterprise"("enterprise_id") OR (("public"."get_user_role_in"("organization_id") = ANY (ARRAY['owner'::"text", 'admin'::"text", 'manager'::"text"])) AND (("visible_chef_programme" = true) OR ("coach_id" = "auth"."uid"())))))));



CREATE POLICY "DR docs del" ON "public"."data_room_documents" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."enterprises" "e"
  WHERE (("e"."id" = "data_room_documents"."enterprise_id") AND (("e"."user_id" = "auth"."uid"()) OR ("e"."coach_id" = "auth"."uid"()))))));



CREATE POLICY "DR docs ins" ON "public"."data_room_documents" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."enterprises" "e"
  WHERE (("e"."id" = "data_room_documents"."enterprise_id") AND (("e"."user_id" = "auth"."uid"()) OR ("e"."coach_id" = "auth"."uid"()))))));



CREATE POLICY "DR docs sel" ON "public"."data_room_documents" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."enterprises" "e"
  WHERE (("e"."id" = "data_room_documents"."enterprise_id") AND (("e"."user_id" = "auth"."uid"()) OR ("e"."coach_id" = "auth"."uid"()))))));



CREATE POLICY "DR docs upd" ON "public"."data_room_documents" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."enterprises" "e"
  WHERE (("e"."id" = "data_room_documents"."enterprise_id") AND (("e"."user_id" = "auth"."uid"()) OR ("e"."coach_id" = "auth"."uid"()))))));



CREATE POLICY "DR shares del" ON "public"."data_room_shares" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."enterprises" "e"
  WHERE (("e"."id" = "data_room_shares"."enterprise_id") AND (("e"."user_id" = "auth"."uid"()) OR ("e"."coach_id" = "auth"."uid"()))))));



CREATE POLICY "DR shares ins" ON "public"."data_room_shares" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."enterprises" "e"
  WHERE (("e"."id" = "data_room_shares"."enterprise_id") AND (("e"."user_id" = "auth"."uid"()) OR ("e"."coach_id" = "auth"."uid"()))))));



CREATE POLICY "DR shares sel" ON "public"."data_room_shares" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."enterprises" "e"
  WHERE (("e"."id" = "data_room_shares"."enterprise_id") AND (("e"."user_id" = "auth"."uid"()) OR ("e"."coach_id" = "auth"."uid"()))))));



CREATE POLICY "Data room docs access v2" ON "public"."data_room_documents" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR ("public"."is_member_of"("organization_id") AND (EXISTS ( SELECT 1
   FROM "public"."enterprises" "e"
  WHERE (("e"."id" = "data_room_documents"."enterprise_id") AND ("public"."is_coach_of_enterprise"("e"."id") OR ("e"."user_id" = "auth"."uid"()))))))));



CREATE POLICY "Data room shares access v2" ON "public"."data_room_shares" TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR ("public"."is_member_of"("organization_id") AND (EXISTS ( SELECT 1
   FROM "public"."enterprises" "e"
  WHERE (("e"."id" = "data_room_shares"."enterprise_id") AND ("public"."is_coach_of_enterprise"("e"."id") OR ("e"."user_id" = "auth"."uid"()))))))));



CREATE POLICY "Entrepreneurs create enterprises v2" ON "public"."enterprises" FOR INSERT TO "authenticated" WITH CHECK ((("auth"."uid"() = "user_id") AND "public"."is_member_of"("organization_id")));



CREATE POLICY "Entrepreneurs see own enterprises v2" ON "public"."enterprises" FOR SELECT TO "authenticated" USING ((("auth"."uid"() = "user_id") AND "public"."is_member_of"("organization_id")));



CREATE POLICY "Entrepreneurs update own enterprises v2" ON "public"."enterprises" FOR UPDATE TO "authenticated" USING ((("auth"."uid"() = "user_id") AND "public"."is_member_of"("organization_id")));



CREATE POLICY "Insert chunks admin" ON "public"."knowledge_chunks" FOR INSERT WITH CHECK ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role"));



CREATE POLICY "Insert score history v2" ON "public"."score_history" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_member_of"("organization_id") AND (EXISTS ( SELECT 1
   FROM "public"."enterprises" "e"
  WHERE (("e"."id" = "score_history"."enterprise_id") AND ("public"."is_coach_of_enterprise"("e"."id") OR ("e"."user_id" = "auth"."uid"())))))));



CREATE POLICY "Insert versions" ON "public"."deliverable_versions" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."enterprises" "e"
  WHERE (("e"."id" = "deliverable_versions"."enterprise_id") AND (("e"."user_id" = "auth"."uid"()) OR ("e"."coach_id" = "auth"."uid"()))))));



CREATE POLICY "Managers and self assign coaches" ON "public"."enterprise_coaches" FOR INSERT WITH CHECK ((("public"."get_user_role_in"("organization_id") = ANY (ARRAY['owner'::"text", 'admin'::"text", 'manager'::"text"])) OR "public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR (("coach_id" = "auth"."uid"()) AND "public"."is_member_of"("organization_id"))));



CREATE POLICY "Managers create invitations" ON "public"."organization_invitations" FOR INSERT WITH CHECK (("public"."is_owner_or_admin_of"("organization_id") OR ("public"."get_user_role_in"("organization_id") = 'manager'::"text") OR "public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role")));



CREATE POLICY "Managers remove coach assignments" ON "public"."enterprise_coaches" FOR DELETE USING ((("public"."get_user_role_in"("organization_id") = ANY (ARRAY['owner'::"text", 'admin'::"text", 'manager'::"text"])) OR "public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role")));



CREATE POLICY "Managers see all org deliverables" ON "public"."deliverables" FOR SELECT TO "authenticated" USING (("public"."is_member_of"("organization_id") AND ("public"."get_user_role_in"("organization_id") = ANY (ARRAY['owner'::"text", 'admin'::"text", 'manager'::"text", 'analyst'::"text"]))));



CREATE POLICY "Managers see all org enterprises" ON "public"."enterprises" FOR SELECT TO "authenticated" USING (("public"."is_member_of"("organization_id") AND ("public"."get_user_role_in"("organization_id") = ANY (ARRAY['owner'::"text", 'admin'::"text", 'manager'::"text", 'analyst'::"text"]))));



CREATE POLICY "Managers see invitations" ON "public"."organization_invitations" FOR SELECT USING (("public"."is_owner_or_admin_of"("organization_id") OR ("public"."get_user_role_in"("organization_id") = 'manager'::"text") OR "public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role")));



CREATE POLICY "Managers update coach assignments" ON "public"."enterprise_coaches" FOR UPDATE USING ((("public"."get_user_role_in"("organization_id") = ANY (ARRAY['owner'::"text", 'admin'::"text", 'manager'::"text"])) OR "public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role")));



CREATE POLICY "Members insert org knowledge" ON "public"."organization_knowledge" FOR INSERT WITH CHECK (("public"."is_member_of"("organization_id") OR "public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role")));



CREATE POLICY "Members read benchmarks" ON "public"."aggregated_benchmarks" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Members read org knowledge" ON "public"."organization_knowledge" FOR SELECT USING (("public"."is_member_of"("organization_id") OR "public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role")));



CREATE POLICY "Members see coaches of their org enterprises" ON "public"."enterprise_coaches" FOR SELECT USING (("public"."is_member_of"("organization_id") OR "public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role")));



CREATE POLICY "Members see org members" ON "public"."organization_members" FOR SELECT USING ((("organization_id" IN ( SELECT "public"."get_user_organizations"() AS "get_user_organizations")) OR "public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role")));



CREATE POLICY "Members see their org" ON "public"."organizations" FOR SELECT USING (("public"."is_member_of"("id") OR "public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role")));



CREATE POLICY "Members update org knowledge" ON "public"."organization_knowledge" FOR UPDATE USING (("public"."is_member_of"("organization_id") OR "public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role")));



CREATE POLICY "Org members can view profiles of co-members" ON "public"."profiles" FOR SELECT TO "authenticated" USING (("user_id" IN ( SELECT "om2"."user_id"
   FROM "public"."organization_members" "om2"
  WHERE (("om2"."organization_id" IN ( SELECT "om1"."organization_id"
           FROM "public"."organization_members" "om1"
          WHERE (("om1"."user_id" = "auth"."uid"()) AND "om1"."is_active"))) AND "om2"."is_active"))));



CREATE POLICY "Owner admin delete invitations" ON "public"."organization_invitations" FOR DELETE USING (("public"."is_owner_or_admin_of"("organization_id") OR "public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role")));



CREATE POLICY "Owner admin manage invitations" ON "public"."organization_invitations" FOR UPDATE USING (("public"."is_owner_or_admin_of"("organization_id") OR "public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role")));



CREATE POLICY "Owner admin manager delete org knowledge" ON "public"."organization_knowledge" FOR DELETE USING ((("public"."get_user_role_in"("organization_id") = ANY (ARRAY['owner'::"text", 'admin'::"text", 'manager'::"text"])) OR "public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role")));



CREATE POLICY "Owner admin manager invite members" ON "public"."organization_members" FOR INSERT WITH CHECK (("public"."is_owner_or_admin_of"("organization_id") OR ("public"."get_user_role_in"("organization_id") = 'manager'::"text") OR "public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role")));



CREATE POLICY "Owner admin remove members" ON "public"."organization_members" FOR DELETE USING (("public"."is_owner_or_admin_of"("organization_id") OR "public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role")));



CREATE POLICY "Owner admin update members" ON "public"."organization_members" FOR UPDATE USING (("public"."is_owner_or_admin_of"("organization_id") OR ("user_id" = "auth"."uid"()) OR "public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role")));



CREATE POLICY "Owner or admin updates org" ON "public"."organizations" FOR UPDATE USING (("public"."is_owner_or_admin_of"("id") OR "public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role")));



CREATE POLICY "Read agg benchmarks" ON "public"."aggregated_benchmarks" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Read benchmarks" ON "public"."knowledge_benchmarks" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Read country_data" ON "public"."knowledge_country_data" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Read kb chunks" ON "public"."knowledge_chunks" FOR SELECT USING ((("kb_entry_id" IS NOT NULL) OR (("org_entry_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."organization_knowledge" "ok"
  WHERE (("ok"."id" = "knowledge_chunks"."org_entry_id") AND ("public"."is_member_of"("ok"."organization_id") OR "public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role"))))))));



CREATE POLICY "Read risk_factors" ON "public"."knowledge_risk_factors" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Read risk_params" ON "public"."knowledge_risk_params" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Read sources" ON "public"."knowledge_sources" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "SA DR docs" ON "public"."data_room_documents" FOR SELECT TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role"));



CREATE POLICY "SA DR shares" ON "public"."data_room_shares" FOR SELECT TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role"));



CREATE POLICY "SA agg benchmarks" ON "public"."aggregated_benchmarks" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role"));



CREATE POLICY "SA benchmarks" ON "public"."knowledge_benchmarks" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role"));



CREATE POLICY "SA can view all profiles" ON "public"."profiles" FOR SELECT TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role"));



CREATE POLICY "SA country_data" ON "public"."knowledge_country_data" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role"));



CREATE POLICY "SA crit del" ON "public"."programme_criteria" FOR DELETE TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role"));



CREATE POLICY "SA crit ins" ON "public"."programme_criteria" FOR INSERT TO "authenticated" WITH CHECK ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role"));



CREATE POLICY "SA crit sel" ON "public"."programme_criteria" FOR SELECT TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role"));



CREATE POLICY "SA crit upd" ON "public"."programme_criteria" FOR UPDATE TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role"));



CREATE POLICY "SA delete deliverables" ON "public"."deliverables" FOR DELETE TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role"));



CREATE POLICY "SA delete enterprises" ON "public"."enterprises" FOR DELETE TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role"));



CREATE POLICY "SA manage benchmarks" ON "public"."aggregated_benchmarks" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role"));



CREATE POLICY "SA manage knowledge_base" ON "public"."knowledge_base" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role"));



CREATE POLICY "SA risk_factors" ON "public"."knowledge_risk_factors" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role"));



CREATE POLICY "SA risk_params" ON "public"."knowledge_risk_params" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role"));



CREATE POLICY "SA select coach_uploads" ON "public"."coach_uploads" FOR SELECT TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role"));



CREATE POLICY "SA select coaching_notes" ON "public"."coaching_notes" FOR SELECT TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role"));



CREATE POLICY "SA select deliverable_corrections" ON "public"."deliverable_corrections" FOR SELECT TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role"));



CREATE POLICY "SA select deliverable_versions" ON "public"."deliverable_versions" FOR SELECT TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role"));



CREATE POLICY "SA select deliverables" ON "public"."deliverables" FOR SELECT TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role"));



CREATE POLICY "SA select enterprises" ON "public"."enterprises" FOR SELECT TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role"));



CREATE POLICY "SA select modules" ON "public"."enterprise_modules" FOR SELECT TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role"));



CREATE POLICY "SA sources" ON "public"."knowledge_sources" TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role"));



CREATE POLICY "SA update enterprises" ON "public"."enterprises" FOR UPDATE TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role")) WITH CHECK ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role"));



CREATE POLICY "Super admin creates orgs" ON "public"."organizations" FOR INSERT WITH CHECK ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role"));



CREATE POLICY "Super admin deletes orgs" ON "public"."organizations" FOR DELETE USING ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role"));



CREATE POLICY "Super admins manage funding programs" ON "public"."funding_programs" USING (true);



CREATE POLICY "System can insert cost log" ON "public"."ai_cost_log" FOR INSERT WITH CHECK (true);



CREATE POLICY "System can manage funding matches" ON "public"."funding_matches" USING (true);



CREATE POLICY "System insert versions v2" ON "public"."deliverable_versions" FOR INSERT WITH CHECK (("public"."is_member_of"("organization_id") AND (EXISTS ( SELECT 1
   FROM "public"."enterprises" "e"
  WHERE (("e"."id" = "deliverable_versions"."enterprise_id") AND ("public"."is_coach_of_enterprise"("e"."id") OR ("e"."user_id" = "auth"."uid"())))))));



CREATE POLICY "Users can delete their own roles" ON "public"."user_roles" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own profile" ON "public"."profiles" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own profile" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own profile" ON "public"."profiles" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users delete deliverables v2" ON "public"."deliverables" FOR DELETE USING (("public"."is_member_of"("organization_id") AND (EXISTS ( SELECT 1
   FROM "public"."enterprises" "e"
  WHERE (("e"."id" = "deliverables"."enterprise_id") AND ("public"."is_coach_of_enterprise"("e"."id") OR ("e"."user_id" = "auth"."uid"())))))));



CREATE POLICY "Users delete modules v2" ON "public"."enterprise_modules" FOR DELETE USING (("public"."is_member_of"("organization_id") AND (EXISTS ( SELECT 1
   FROM "public"."enterprises" "e"
  WHERE (("e"."id" = "enterprise_modules"."enterprise_id") AND ("public"."is_coach_of_enterprise"("e"."id") OR ("e"."user_id" = "auth"."uid"())))))));



CREATE POLICY "Users inputs history" ON "public"."inputs_history" FOR SELECT TO "authenticated" USING ((("enterprise_id" IN ( SELECT "enterprises"."id"
   FROM "public"."enterprises"
  WHERE ("enterprises"."user_id" = "auth"."uid"()))) OR "public"."has_role"("auth"."uid"(), 'coach'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role")));



CREATE POLICY "Users insert activity" ON "public"."activity_log" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."enterprises" "e"
  WHERE (("e"."id" = "activity_log"."enterprise_id") AND (("e"."user_id" = "auth"."uid"()) OR ("e"."coach_id" = "auth"."uid"()))))));



CREATE POLICY "Users insert activity v2" ON "public"."activity_log" FOR INSERT WITH CHECK (("public"."is_member_of"("organization_id") AND (EXISTS ( SELECT 1
   FROM "public"."enterprises" "e"
  WHERE (("e"."id" = "activity_log"."enterprise_id") AND ("public"."is_coach_of_enterprise"("e"."id") OR ("e"."user_id" = "auth"."uid"())))))));



CREATE POLICY "Users insert deliverables v2" ON "public"."deliverables" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_member_of"("organization_id") AND (EXISTS ( SELECT 1
   FROM "public"."enterprises" "e"
  WHERE (("e"."id" = "deliverables"."enterprise_id") AND ("public"."is_coach_of_enterprise"("e"."id") OR ("e"."user_id" = "auth"."uid"())))))));



CREATE POLICY "Users insert modules v2" ON "public"."enterprise_modules" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_member_of"("organization_id") AND (EXISTS ( SELECT 1
   FROM "public"."enterprises" "e"
  WHERE (("e"."id" = "enterprise_modules"."enterprise_id") AND ("public"."is_coach_of_enterprise"("e"."id") OR ("e"."user_id" = "auth"."uid"())))))));



CREATE POLICY "Users manage corrections" ON "public"."deliverable_corrections" USING ((("corrected_by" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."enterprises" "e"
  WHERE (("e"."id" = "deliverable_corrections"."enterprise_id") AND (("e"."user_id" = "auth"."uid"()) OR ("e"."coach_id" = "auth"."uid"())))))));



CREATE POLICY "Users manage corrections v2" ON "public"."deliverable_corrections" USING (("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR ("public"."is_member_of"("organization_id") AND (("corrected_by" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."enterprises" "e"
  WHERE (("e"."id" = "deliverable_corrections"."enterprise_id") AND ("public"."is_coach_of_enterprise"("e"."id") OR ("e"."user_id" = "auth"."uid"())))))))));



CREATE POLICY "Users manage own workspace v2" ON "public"."workspace_knowledge" TO "authenticated" USING (((("owner_id" = "auth"."uid"()) AND "public"."is_member_of"("organization_id")) OR "public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role")));



CREATE POLICY "Users see activity" ON "public"."activity_log" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."enterprises" "e"
  WHERE (("e"."id" = "activity_log"."enterprise_id") AND (("e"."user_id" = "auth"."uid"()) OR ("e"."coach_id" = "auth"."uid"()))))));



CREATE POLICY "Users see deliverables v2" ON "public"."deliverables" FOR SELECT USING (("public"."is_member_of"("organization_id") AND (EXISTS ( SELECT 1
   FROM "public"."enterprises" "e"
  WHERE (("e"."id" = "deliverables"."enterprise_id") AND ("public"."is_coach_of_enterprise"("e"."id") OR (("e"."user_id" = "auth"."uid"()) AND (("deliverables"."generated_by" = 'entrepreneur'::"text") OR ("deliverables"."generated_by" = 'coach_mirror'::"text") OR ("deliverables"."visibility" = 'shared'::"text")))))))));



CREATE POLICY "Users see inputs history v2" ON "public"."inputs_history" FOR SELECT TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR ("public"."is_member_of"("organization_id") AND (("enterprise_id" IN ( SELECT "enterprises"."id"
   FROM "public"."enterprises"
  WHERE ("enterprises"."user_id" = "auth"."uid"()))) OR "public"."is_coach_of_enterprise"("enterprise_id") OR ("public"."get_user_role_in"("organization_id") = ANY (ARRAY['owner'::"text", 'admin'::"text", 'manager'::"text"]))))));



CREATE POLICY "Users see modules v2" ON "public"."enterprise_modules" FOR SELECT TO "authenticated" USING (("public"."is_member_of"("organization_id") AND (EXISTS ( SELECT 1
   FROM "public"."enterprises" "e"
  WHERE (("e"."id" = "enterprise_modules"."enterprise_id") AND ("public"."is_coach_of_enterprise"("e"."id") OR ("e"."user_id" = "auth"."uid"()) OR ("public"."get_user_role_in"("e"."organization_id") = ANY (ARRAY['owner'::"text", 'admin'::"text", 'manager'::"text", 'analyst'::"text"]))))))));



CREATE POLICY "Users see org activity v2" ON "public"."activity_log" FOR SELECT USING (("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR ("public"."is_member_of"("organization_id") AND (EXISTS ( SELECT 1
   FROM "public"."enterprises" "e"
  WHERE (("e"."id" = "activity_log"."enterprise_id") AND ("public"."is_coach_of_enterprise"("e"."id") OR ("e"."user_id" = "auth"."uid"()) OR ("public"."get_user_role_in"("e"."organization_id") = ANY (ARRAY['owner'::"text", 'admin'::"text", 'manager'::"text"])))))))));



CREATE POLICY "Users see score history v2" ON "public"."score_history" FOR SELECT TO "authenticated" USING (("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR ("public"."is_member_of"("organization_id") AND (EXISTS ( SELECT 1
   FROM "public"."enterprises" "e"
  WHERE (("e"."id" = "score_history"."enterprise_id") AND ("public"."is_coach_of_enterprise"("e"."id") OR ("e"."user_id" = "auth"."uid"()) OR ("public"."get_user_role_in"("e"."organization_id") = ANY (ARRAY['owner'::"text", 'admin'::"text", 'manager'::"text"])))))))));



CREATE POLICY "Users see versions" ON "public"."deliverable_versions" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."enterprises" "e"
  WHERE (("e"."id" = "deliverable_versions"."enterprise_id") AND (("e"."user_id" = "auth"."uid"()) OR ("e"."coach_id" = "auth"."uid"()))))));



CREATE POLICY "Users see versions v2" ON "public"."deliverable_versions" FOR SELECT USING (("public"."is_member_of"("organization_id") AND (EXISTS ( SELECT 1
   FROM "public"."enterprises" "e"
  WHERE (("e"."id" = "deliverable_versions"."enterprise_id") AND ("public"."is_coach_of_enterprise"("e"."id") OR ("e"."user_id" = "auth"."uid"()) OR ("public"."get_user_role_in"("e"."organization_id") = ANY (ARRAY['owner'::"text", 'admin'::"text", 'manager'::"text", 'analyst'::"text"]))))))));



CREATE POLICY "Users update deliverables v2" ON "public"."deliverables" FOR UPDATE TO "authenticated" USING (("public"."is_member_of"("organization_id") AND (EXISTS ( SELECT 1
   FROM "public"."enterprises" "e"
  WHERE (("e"."id" = "deliverables"."enterprise_id") AND ("public"."is_coach_of_enterprise"("e"."id") OR ("e"."user_id" = "auth"."uid"())))))));



CREATE POLICY "Users update modules v2" ON "public"."enterprise_modules" FOR UPDATE TO "authenticated" USING (("public"."is_member_of"("organization_id") AND (EXISTS ( SELECT 1
   FROM "public"."enterprises" "e"
  WHERE (("e"."id" = "enterprise_modules"."enterprise_id") AND ("public"."is_coach_of_enterprise"("e"."id") OR ("e"."user_id" = "auth"."uid"())))))));



ALTER TABLE "public"."activity_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."aggregated_benchmarks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ai_cost_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ai_cost_log_org_read" ON "public"."ai_cost_log" FOR SELECT TO "authenticated" USING ((("organization_id" IS NULL) OR "public"."is_member_of"("organization_id") OR "public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role")));



CREATE POLICY "ai_cost_log_service_insert" ON "public"."ai_cost_log" FOR INSERT TO "authenticated" WITH CHECK ((("organization_id" IS NULL) OR "public"."is_member_of"("organization_id") OR "public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role")));



CREATE POLICY "authenticated_candidatures_insert" ON "public"."candidatures" FOR INSERT TO "authenticated" WITH CHECK (true);



ALTER TABLE "public"."candidatures" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "candidatures_delete" ON "public"."candidatures" FOR DELETE TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role"));



CREATE POLICY "candidatures_insert" ON "public"."candidatures" FOR INSERT TO "authenticated" WITH CHECK ((("organization_id" IS NULL) OR "public"."is_member_of"("organization_id") OR "public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role")));



CREATE POLICY "candidatures_read" ON "public"."candidatures" FOR SELECT TO "authenticated" USING ((("organization_id" IS NULL) OR "public"."is_member_of"("organization_id") OR "public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role")));



CREATE POLICY "candidatures_update" ON "public"."candidatures" FOR UPDATE TO "authenticated" USING ((("organization_id" IS NULL) OR ("public"."get_user_role_in"("organization_id") = ANY (ARRAY['owner'::"text", 'admin'::"text", 'manager'::"text"])) OR "public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role")));



CREATE POLICY "chef_can_manage_kpi_history" ON "public"."programme_kpi_history" USING ((EXISTS ( SELECT 1
   FROM ("public"."programme_kpis" "pk"
     JOIN "public"."programmes" "p" ON (("p"."id" = "pk"."programme_id")))
  WHERE (("pk"."id" = "programme_kpi_history"."kpi_id") AND (("p"."chef_programme_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
           FROM "public"."user_roles" "ur"
          WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = 'super_admin'::"public"."app_role")))))))));



CREATE POLICY "chef_candidatures_select" ON "public"."candidatures" FOR SELECT USING ("public"."has_role"("auth"."uid"(), 'chef_programme'::"public"."app_role"));



CREATE POLICY "chef_candidatures_update" ON "public"."candidatures" FOR UPDATE USING ("public"."has_role"("auth"."uid"(), 'chef_programme'::"public"."app_role"));



CREATE POLICY "chef_programme_criteria_insert" ON "public"."programme_criteria" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'chef_programme'::"public"."app_role")))));



CREATE POLICY "chef_programme_manage_kpis" ON "public"."programme_kpis" USING ((EXISTS ( SELECT 1
   FROM "public"."programmes" "p"
  WHERE (("p"."id" = "programme_kpis"."programme_id") AND (("p"."chef_programme_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
           FROM "public"."user_roles" "ur"
          WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = 'super_admin'::"public"."app_role")))))))));



CREATE POLICY "chef_programmes_select" ON "public"."programmes" FOR SELECT USING ((("chef_programme_id" = "auth"."uid"()) OR ("created_by" = "auth"."uid"())));



CREATE POLICY "chef_programmes_update" ON "public"."programmes" FOR UPDATE USING ((("chef_programme_id" = "auth"."uid"()) OR ("created_by" = "auth"."uid"())));



CREATE POLICY "coach_candidatures_select" ON "public"."candidatures" FOR SELECT TO "authenticated" USING (("assigned_coach_id" = "auth"."uid"()));



CREATE POLICY "coach_programmes_select" ON "public"."programmes" FOR SELECT USING (("public"."has_role"("auth"."uid"(), 'coach'::"public"."app_role") AND ("status" = ANY (ARRAY['open'::"text", 'in_progress'::"text", 'completed'::"text"]))));



ALTER TABLE "public"."coach_uploads" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."coaching_notes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."data_room_documents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."data_room_shares" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."deliverable_corrections" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."deliverable_versions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."deliverables" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."enterprise_coaches" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."enterprise_modules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."enterprises" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."funding_matches" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "funding_matches_read" ON "public"."funding_matches" FOR SELECT TO "authenticated" USING ((("organization_id" IS NULL) OR "public"."is_member_of"("organization_id") OR "public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role")));



CREATE POLICY "funding_matches_write" ON "public"."funding_matches" FOR INSERT TO "authenticated" WITH CHECK ((("organization_id" IS NULL) OR "public"."is_member_of"("organization_id") OR "public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role")));



ALTER TABLE "public"."funding_programs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "funding_programs_read" ON "public"."funding_programs" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "funding_programs_write" ON "public"."funding_programs" FOR INSERT TO "authenticated" WITH CHECK ((("organization_id" IS NULL) OR "public"."is_member_of"("organization_id") OR "public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role")));



ALTER TABLE "public"."inputs_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."knowledge_base" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."knowledge_benchmarks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."knowledge_chunks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."knowledge_country_data" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."knowledge_risk_factors" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."knowledge_risk_params" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."knowledge_sources" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."organization_invitations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."organization_knowledge" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."organization_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."organizations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."programme_criteria" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "programme_criteria_delete" ON "public"."programme_criteria" FOR DELETE TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role"));



CREATE POLICY "programme_criteria_insert" ON "public"."programme_criteria" FOR INSERT TO "authenticated" WITH CHECK ((("organization_id" IS NULL) OR ("public"."get_user_role_in"("organization_id") = ANY (ARRAY['owner'::"text", 'admin'::"text", 'manager'::"text"])) OR "public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role")));



CREATE POLICY "programme_criteria_read" ON "public"."programme_criteria" FOR SELECT TO "authenticated" USING ((("organization_id" IS NULL) OR "public"."is_member_of"("organization_id") OR "public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role")));



CREATE POLICY "programme_criteria_update" ON "public"."programme_criteria" FOR UPDATE TO "authenticated" USING ((("organization_id" IS NULL) OR ("public"."get_user_role_in"("organization_id") = ANY (ARRAY['owner'::"text", 'admin'::"text", 'manager'::"text"])) OR "public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role")));



ALTER TABLE "public"."programme_kpi_history" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "programme_kpi_history_insert" ON "public"."programme_kpi_history" FOR INSERT TO "authenticated" WITH CHECK ((("organization_id" IS NULL) OR "public"."is_member_of"("organization_id") OR "public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role")));



CREATE POLICY "programme_kpi_history_read" ON "public"."programme_kpi_history" FOR SELECT TO "authenticated" USING ((("organization_id" IS NULL) OR "public"."is_member_of"("organization_id") OR "public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role")));



ALTER TABLE "public"."programme_kpis" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "programme_kpis_delete" ON "public"."programme_kpis" FOR DELETE TO "authenticated" USING ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role"));



CREATE POLICY "programme_kpis_insert" ON "public"."programme_kpis" FOR INSERT TO "authenticated" WITH CHECK ((("organization_id" IS NULL) OR ("public"."get_user_role_in"("organization_id") = ANY (ARRAY['owner'::"text", 'admin'::"text", 'manager'::"text"])) OR "public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role")));



CREATE POLICY "programme_kpis_read" ON "public"."programme_kpis" FOR SELECT TO "authenticated" USING ((("organization_id" IS NULL) OR "public"."is_member_of"("organization_id") OR "public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role")));



CREATE POLICY "programme_kpis_update" ON "public"."programme_kpis" FOR UPDATE TO "authenticated" USING ((("organization_id" IS NULL) OR ("public"."get_user_role_in"("organization_id") = ANY (ARRAY['owner'::"text", 'admin'::"text", 'manager'::"text"])) OR "public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role")));



ALTER TABLE "public"."programmes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "programmes_delete" ON "public"."programmes" FOR DELETE TO "authenticated" USING ((("chef_programme_id" = "auth"."uid"()) OR "public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role")));



CREATE POLICY "programmes_insert" ON "public"."programmes" FOR INSERT TO "authenticated" WITH CHECK ((("organization_id" IS NULL) OR ("public"."get_user_role_in"("organization_id") = ANY (ARRAY['owner'::"text", 'admin'::"text", 'manager'::"text"])) OR "public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role")));



CREATE POLICY "programmes_read" ON "public"."programmes" FOR SELECT TO "authenticated" USING ((("organization_id" IS NULL) OR "public"."is_member_of"("organization_id") OR "public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role")));



CREATE POLICY "programmes_update" ON "public"."programmes" FOR UPDATE TO "authenticated" USING ((("chef_programme_id" = "auth"."uid"()) OR (("organization_id" IS NOT NULL) AND ("public"."get_user_role_in"("organization_id") = ANY (ARRAY['owner'::"text", 'admin'::"text", 'manager'::"text"]))) OR "public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role")));



CREATE POLICY "public_candidatures_insert" ON "public"."candidatures" FOR INSERT TO "anon" WITH CHECK (true);



CREATE POLICY "public_programmes_form" ON "public"."programmes" FOR SELECT TO "anon" USING ((("status" = 'open'::"text") AND ("form_slug" IS NOT NULL)));



CREATE POLICY "sa_candidatures_all" ON "public"."candidatures" USING ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role"));



CREATE POLICY "sa_programmes_delete" ON "public"."programmes" FOR DELETE USING ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role"));



CREATE POLICY "sa_programmes_insert" ON "public"."programmes" FOR INSERT WITH CHECK (("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'chef_programme'::"public"."app_role")));



CREATE POLICY "sa_programmes_select" ON "public"."programmes" FOR SELECT USING ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role"));



CREATE POLICY "sa_programmes_update" ON "public"."programmes" FOR UPDATE USING ("public"."has_role"("auth"."uid"(), 'super_admin'::"public"."app_role"));



ALTER TABLE "public"."score_history" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "super_admin_programmes_insert" ON "public"."programmes" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'super_admin'::"public"."app_role")))));



ALTER TABLE "public"."workspace_knowledge" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."candidatures";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."deliverables";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."enterprise_modules";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."funding_matches";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."funding_programs";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."programmes";









GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

































































































































































































































































































































































































































































































































GRANT ALL ON FUNCTION "public"."check_slug_available"("p_slug" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."check_slug_available"("p_slug" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_slug_available"("p_slug" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."deliverables_set_organization_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."deliverables_set_organization_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."deliverables_set_organization_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_metering_org_detail"("p_org_id" "uuid", "period_start" timestamp with time zone, "period_end" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."get_metering_org_detail"("p_org_id" "uuid", "period_start" timestamp with time zone, "period_end" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_metering_org_detail"("p_org_id" "uuid", "period_start" timestamp with time zone, "period_end" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_metering_summary"("period_start" timestamp with time zone, "period_end" timestamp with time zone, "org_filter" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_metering_summary"("period_start" timestamp with time zone, "period_end" timestamp with time zone, "org_filter" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_metering_summary"("period_start" timestamp with time zone, "period_end" timestamp with time zone, "org_filter" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_organizations"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_organizations"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_organizations"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_role_in"("org_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_role_in"("org_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_role_in"("org_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") TO "anon";
GRANT ALL ON FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_coach_of_enterprise"("ent_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_coach_of_enterprise"("ent_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_coach_of_enterprise"("ent_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_member_of"("org_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_member_of"("org_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_member_of"("org_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_owner_or_admin_of"("org_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_owner_or_admin_of"("org_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_owner_or_admin_of"("org_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."link_enterprise_to_coach_by_email"("enterprise_email" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."link_enterprise_to_coach_by_email"("enterprise_email" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."link_enterprise_to_coach_by_email"("enterprise_email" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."list_all_organizations_for_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."list_all_organizations_for_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."list_all_organizations_for_admin"() TO "service_role";









GRANT ALL ON FUNCTION "public"."set_enterprise_base_year"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_enterprise_base_year"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_enterprise_base_year"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_organization_id_from_enterprise"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_organization_id_from_enterprise"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_organization_id_from_enterprise"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";




































GRANT ALL ON TABLE "public"."activity_log" TO "anon";
GRANT ALL ON TABLE "public"."activity_log" TO "authenticated";
GRANT ALL ON TABLE "public"."activity_log" TO "service_role";



GRANT ALL ON TABLE "public"."aggregated_benchmarks" TO "anon";
GRANT ALL ON TABLE "public"."aggregated_benchmarks" TO "authenticated";
GRANT ALL ON TABLE "public"."aggregated_benchmarks" TO "service_role";



GRANT ALL ON TABLE "public"."ai_cost_log" TO "anon";
GRANT ALL ON TABLE "public"."ai_cost_log" TO "authenticated";
GRANT ALL ON TABLE "public"."ai_cost_log" TO "service_role";



GRANT ALL ON TABLE "public"."candidatures" TO "anon";
GRANT ALL ON TABLE "public"."candidatures" TO "authenticated";
GRANT ALL ON TABLE "public"."candidatures" TO "service_role";



GRANT ALL ON TABLE "public"."coach_uploads" TO "anon";
GRANT ALL ON TABLE "public"."coach_uploads" TO "authenticated";
GRANT ALL ON TABLE "public"."coach_uploads" TO "service_role";



GRANT ALL ON TABLE "public"."coaching_notes" TO "anon";
GRANT ALL ON TABLE "public"."coaching_notes" TO "authenticated";
GRANT ALL ON TABLE "public"."coaching_notes" TO "service_role";



GRANT ALL ON TABLE "public"."data_room_documents" TO "anon";
GRANT ALL ON TABLE "public"."data_room_documents" TO "authenticated";
GRANT ALL ON TABLE "public"."data_room_documents" TO "service_role";



GRANT ALL ON TABLE "public"."data_room_shares" TO "anon";
GRANT ALL ON TABLE "public"."data_room_shares" TO "authenticated";
GRANT ALL ON TABLE "public"."data_room_shares" TO "service_role";



GRANT ALL ON TABLE "public"."deliverable_corrections" TO "anon";
GRANT ALL ON TABLE "public"."deliverable_corrections" TO "authenticated";
GRANT ALL ON TABLE "public"."deliverable_corrections" TO "service_role";



GRANT ALL ON TABLE "public"."deliverable_versions" TO "anon";
GRANT ALL ON TABLE "public"."deliverable_versions" TO "authenticated";
GRANT ALL ON TABLE "public"."deliverable_versions" TO "service_role";



GRANT ALL ON TABLE "public"."deliverables" TO "anon";
GRANT ALL ON TABLE "public"."deliverables" TO "authenticated";
GRANT ALL ON TABLE "public"."deliverables" TO "service_role";



GRANT ALL ON TABLE "public"."enterprise_coaches" TO "anon";
GRANT ALL ON TABLE "public"."enterprise_coaches" TO "authenticated";
GRANT ALL ON TABLE "public"."enterprise_coaches" TO "service_role";



GRANT ALL ON TABLE "public"."enterprise_modules" TO "anon";
GRANT ALL ON TABLE "public"."enterprise_modules" TO "authenticated";
GRANT ALL ON TABLE "public"."enterprise_modules" TO "service_role";



GRANT ALL ON TABLE "public"."enterprises" TO "anon";
GRANT ALL ON TABLE "public"."enterprises" TO "authenticated";
GRANT ALL ON TABLE "public"."enterprises" TO "service_role";



GRANT ALL ON TABLE "public"."funding_matches" TO "anon";
GRANT ALL ON TABLE "public"."funding_matches" TO "authenticated";
GRANT ALL ON TABLE "public"."funding_matches" TO "service_role";



GRANT ALL ON TABLE "public"."funding_programs" TO "anon";
GRANT ALL ON TABLE "public"."funding_programs" TO "authenticated";
GRANT ALL ON TABLE "public"."funding_programs" TO "service_role";



GRANT ALL ON TABLE "public"."inputs_history" TO "anon";
GRANT ALL ON TABLE "public"."inputs_history" TO "authenticated";
GRANT ALL ON TABLE "public"."inputs_history" TO "service_role";



GRANT ALL ON TABLE "public"."knowledge_base" TO "anon";
GRANT ALL ON TABLE "public"."knowledge_base" TO "authenticated";
GRANT ALL ON TABLE "public"."knowledge_base" TO "service_role";



GRANT ALL ON TABLE "public"."knowledge_benchmarks" TO "anon";
GRANT ALL ON TABLE "public"."knowledge_benchmarks" TO "authenticated";
GRANT ALL ON TABLE "public"."knowledge_benchmarks" TO "service_role";



GRANT ALL ON TABLE "public"."knowledge_chunks" TO "anon";
GRANT ALL ON TABLE "public"."knowledge_chunks" TO "authenticated";
GRANT ALL ON TABLE "public"."knowledge_chunks" TO "service_role";



GRANT ALL ON TABLE "public"."knowledge_country_data" TO "anon";
GRANT ALL ON TABLE "public"."knowledge_country_data" TO "authenticated";
GRANT ALL ON TABLE "public"."knowledge_country_data" TO "service_role";



GRANT ALL ON TABLE "public"."knowledge_risk_factors" TO "anon";
GRANT ALL ON TABLE "public"."knowledge_risk_factors" TO "authenticated";
GRANT ALL ON TABLE "public"."knowledge_risk_factors" TO "service_role";



GRANT ALL ON TABLE "public"."knowledge_risk_params" TO "anon";
GRANT ALL ON TABLE "public"."knowledge_risk_params" TO "authenticated";
GRANT ALL ON TABLE "public"."knowledge_risk_params" TO "service_role";



GRANT ALL ON TABLE "public"."knowledge_sources" TO "anon";
GRANT ALL ON TABLE "public"."knowledge_sources" TO "authenticated";
GRANT ALL ON TABLE "public"."knowledge_sources" TO "service_role";



GRANT ALL ON TABLE "public"."organization_invitations" TO "anon";
GRANT ALL ON TABLE "public"."organization_invitations" TO "authenticated";
GRANT ALL ON TABLE "public"."organization_invitations" TO "service_role";



GRANT ALL ON TABLE "public"."organization_knowledge" TO "anon";
GRANT ALL ON TABLE "public"."organization_knowledge" TO "authenticated";
GRANT ALL ON TABLE "public"."organization_knowledge" TO "service_role";



GRANT ALL ON TABLE "public"."organization_members" TO "anon";
GRANT ALL ON TABLE "public"."organization_members" TO "authenticated";
GRANT ALL ON TABLE "public"."organization_members" TO "service_role";



GRANT ALL ON TABLE "public"."organizations" TO "anon";
GRANT ALL ON TABLE "public"."organizations" TO "authenticated";
GRANT ALL ON TABLE "public"."organizations" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."programme_criteria" TO "anon";
GRANT ALL ON TABLE "public"."programme_criteria" TO "authenticated";
GRANT ALL ON TABLE "public"."programme_criteria" TO "service_role";



GRANT ALL ON TABLE "public"."programme_kpi_history" TO "anon";
GRANT ALL ON TABLE "public"."programme_kpi_history" TO "authenticated";
GRANT ALL ON TABLE "public"."programme_kpi_history" TO "service_role";



GRANT ALL ON TABLE "public"."programme_kpis" TO "anon";
GRANT ALL ON TABLE "public"."programme_kpis" TO "authenticated";
GRANT ALL ON TABLE "public"."programme_kpis" TO "service_role";



GRANT ALL ON TABLE "public"."programmes" TO "anon";
GRANT ALL ON TABLE "public"."programmes" TO "authenticated";
GRANT ALL ON TABLE "public"."programmes" TO "service_role";



GRANT ALL ON TABLE "public"."score_history" TO "anon";
GRANT ALL ON TABLE "public"."score_history" TO "authenticated";
GRANT ALL ON TABLE "public"."score_history" TO "service_role";



GRANT ALL ON TABLE "public"."user_roles" TO "anon";
GRANT ALL ON TABLE "public"."user_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_roles" TO "service_role";



GRANT ALL ON TABLE "public"."workspace_knowledge" TO "anon";
GRANT ALL ON TABLE "public"."workspace_knowledge" TO "authenticated";
GRANT ALL ON TABLE "public"."workspace_knowledge" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































