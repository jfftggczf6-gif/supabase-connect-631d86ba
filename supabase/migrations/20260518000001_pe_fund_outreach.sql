-- Migration : pe_fund_outreach
-- Tracking par-deal × par-fonds pour le module BA (fund_matching + deal_tracking).
-- Couvre les 8 étapes du wireframe : teaser → intéressé → NDA → IM → meeting → IOI → LOI → close.

create type pe_fund_outreach_status as enum (
  'matched',         -- candidat dans la shortlist, pas encore contacté
  'teaser_sent',     -- teaser anonyme envoyé
  'interested',      -- fonds a répondu positivement
  'nda_pending',     -- NDA envoyée, en attente signature
  'nda_signed',      -- NDA signée
  'im_shared',       -- IM (memo investissement) partagé
  'meeting_held',    -- management meeting réalisé
  'ioi_received',    -- IOI (Indication of Interest) reçue
  'loi_signed',      -- LOI (Letter of Intent) signée
  'closed',          -- deal closé avec ce fonds
  'declined'         -- fonds a décliné à n'importe quelle étape
);

create table public.pe_fund_outreach (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid not null references public.organizations(id) on delete cascade,
  deal_id               uuid not null references public.pe_deals(id) on delete cascade,
  funding_program_id    uuid not null references public.funding_programs(id) on delete cascade,

  status                pe_fund_outreach_status not null default 'matched',
  match_score           integer,
  rank                  integer,

  last_action_at        timestamptz,
  last_action_label     text,

  -- IOI fields (renseignés quand status = ioi_received ou plus avancé)
  ioi_amount            bigint,
  ioi_currency          text default 'USD',
  ioi_structure         text,
  ioi_conditions        text,
  ioi_exclusivity_days  integer,
  ioi_received_at       timestamptz,

  -- Notes privées de l'analyste sur ce fonds
  private_notes         text,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  unique (deal_id, funding_program_id)
);

create index idx_pe_fund_outreach_deal     on public.pe_fund_outreach(deal_id);
create index idx_pe_fund_outreach_status   on public.pe_fund_outreach(status);
create index idx_pe_fund_outreach_org      on public.pe_fund_outreach(organization_id);

alter table public.pe_fund_outreach enable row level security;

create policy "Members see outreach of their org"
  on public.pe_fund_outreach for select
  using (
    exists (
      select 1 from public.organization_members om
      where om.user_id = auth.uid()
        and om.organization_id = pe_fund_outreach.organization_id
        and om.is_active = true
    )
  );

create policy "Members manage outreach of their org"
  on public.pe_fund_outreach for all
  using (
    exists (
      select 1 from public.organization_members om
      where om.user_id = auth.uid()
        and om.organization_id = pe_fund_outreach.organization_id
        and om.is_active = true
        and om.role in ('owner','admin','manager','analyst','analyste','partner','managing_director','investment_manager')
    )
  )
  with check (
    exists (
      select 1 from public.organization_members om
      where om.user_id = auth.uid()
        and om.organization_id = pe_fund_outreach.organization_id
        and om.is_active = true
        and om.role in ('owner','admin','manager','analyst','analyste','partner','managing_director','investment_manager')
    )
  );

create trigger pe_fund_outreach_updated_at
  before update on public.pe_fund_outreach
  for each row execute function public.set_updated_at();
