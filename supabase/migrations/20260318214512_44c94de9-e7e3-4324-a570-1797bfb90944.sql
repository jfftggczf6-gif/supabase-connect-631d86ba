ALTER TYPE public.deliverable_type ADD VALUE IF NOT EXISTS 'valuation';
ALTER TYPE public.deliverable_type ADD VALUE IF NOT EXISTS 'onepager';
ALTER TYPE public.deliverable_type ADD VALUE IF NOT EXISTS 'pitch_deck';
ALTER TYPE public.deliverable_type ADD VALUE IF NOT EXISTS 'investment_memo';

ALTER TYPE public.module_code ADD VALUE IF NOT EXISTS 'valuation';
ALTER TYPE public.module_code ADD VALUE IF NOT EXISTS 'onepager';
ALTER TYPE public.module_code ADD VALUE IF NOT EXISTS 'pitch_deck';
ALTER TYPE public.module_code ADD VALUE IF NOT EXISTS 'investment_memo';