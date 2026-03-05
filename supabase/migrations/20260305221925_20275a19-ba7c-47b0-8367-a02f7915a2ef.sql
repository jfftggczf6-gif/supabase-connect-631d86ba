
-- Role enum
CREATE TYPE public.app_role AS ENUM ('coach', 'entrepreneur');

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- User roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);

-- Enterprises table
CREATE TABLE public.enterprises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  coach_id UUID REFERENCES auth.users(id),
  name TEXT NOT NULL,
  sector TEXT,
  country TEXT DEFAULT 'Côte d''Ivoire',
  city TEXT,
  legal_form TEXT,
  creation_date DATE,
  employees_count INTEGER DEFAULT 0,
  description TEXT,
  logo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.enterprises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Entrepreneurs see own enterprises" ON public.enterprises FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Coaches see assigned enterprises" ON public.enterprises FOR SELECT USING (auth.uid() = coach_id);
CREATE POLICY "Entrepreneurs can create enterprises" ON public.enterprises FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Entrepreneurs can update own enterprises" ON public.enterprises FOR UPDATE USING (auth.uid() = user_id);

-- Module enums
CREATE TYPE public.module_code AS ENUM ('bmc', 'sic', 'inputs', 'framework', 'diagnostic', 'plan_ovo', 'business_plan', 'odd');
CREATE TYPE public.module_status AS ENUM ('not_started', 'in_progress', 'completed');

CREATE TABLE public.enterprise_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enterprise_id UUID NOT NULL REFERENCES public.enterprises(id) ON DELETE CASCADE,
  module module_code NOT NULL,
  status module_status NOT NULL DEFAULT 'not_started',
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (enterprise_id, module)
);

ALTER TABLE public.enterprise_modules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see modules of own enterprises" ON public.enterprise_modules FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.enterprises e WHERE e.id = enterprise_id AND (e.user_id = auth.uid() OR e.coach_id = auth.uid())));
CREATE POLICY "Users can update modules of own enterprises" ON public.enterprise_modules FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.enterprises e WHERE e.id = enterprise_id AND (e.user_id = auth.uid() OR e.coach_id = auth.uid())));
CREATE POLICY "Users can insert modules for own enterprises" ON public.enterprise_modules FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.enterprises e WHERE e.id = enterprise_id AND (e.user_id = auth.uid() OR e.coach_id = auth.uid())));

-- Deliverables
CREATE TYPE public.deliverable_type AS ENUM (
  'bmc_analysis', 'bmc_html', 'sic_analysis', 'sic_html',
  'inputs_data', 'inputs_html', 'framework_data', 'framework_html', 'framework_excel',
  'diagnostic_data', 'diagnostic_html', 'diagnostic_analyses',
  'plan_ovo', 'business_plan', 'odd_analysis'
);

CREATE TABLE public.deliverables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enterprise_id UUID NOT NULL REFERENCES public.enterprises(id) ON DELETE CASCADE,
  type deliverable_type NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  data JSONB DEFAULT '{}',
  html_content TEXT,
  file_url TEXT,
  score NUMERIC(5,2),
  ai_generated BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.deliverables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see deliverables of own enterprises" ON public.deliverables FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.enterprises e WHERE e.id = enterprise_id AND (e.user_id = auth.uid() OR e.coach_id = auth.uid())));
CREATE POLICY "Users can insert deliverables for own enterprises" ON public.deliverables FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.enterprises e WHERE e.id = enterprise_id AND (e.user_id = auth.uid() OR e.coach_id = auth.uid())));
CREATE POLICY "Users can update deliverables of own enterprises" ON public.deliverables FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.enterprises e WHERE e.id = enterprise_id AND (e.user_id = auth.uid() OR e.coach_id = auth.uid())));

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Updated_at triggers
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_enterprises_updated_at BEFORE UPDATE ON public.enterprises FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_enterprise_modules_updated_at BEFORE UPDATE ON public.enterprise_modules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_deliverables_updated_at BEFORE UPDATE ON public.deliverables FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
