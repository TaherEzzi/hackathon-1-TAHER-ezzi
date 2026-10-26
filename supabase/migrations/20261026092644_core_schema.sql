-- core_schema — A Una Milla v1
-- Aligned with docs/decision.md ("Data we store", D-blocks), docs/flow.md (F0–F12),
-- docs/OVERVIEW.md MUST tier. Security rules follow the Supabase skill checklist:
--   * RLS on every exposed table
--   * no auth.role() (deprecated) — explicit TO clauses
--   * UPDATE policies carry USING + WITH CHECK (ownership can't be reassigned)
--   * authorization reads app_metadata claims, never user_metadata
--   * no passport numbers, no card PANs, no airline credentials (decision.md table)
--   * computed verdict numbers are written server-side (service role) only —
--     clients get SELECT (+ DELETE for their own itineraries), not INSERT/UPDATE

-- ── 0. helpers ──────────────────────────────────────────────────────────────

create or replace function public.is_app_admin()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'aum_admin')::boolean, false)
$$;

comment on function public.is_app_admin() is
  'RLS admin predicate. Authorizes on the auth JWT app_metadata claim (raw_app_meta_data), which users cannot self-edit. Set via the admin API: {"aum_admin": true}.';

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end
$$;

-- ── 1. profiles ─────────────────────────────────────────────────────────────

create table public.profiles (
  id         uuid        primary key references auth.users (id) on delete cascade,
  locale     text        not null default 'es',
  is_test_persona boolean not null default false,  -- T1 label; never a real traveller
  created_at timestamptz not null default now()
);
comment on table public.profiles is 'Mirror of auth.users for product prefs. Email lives in auth.users; we do not duplicate PII here.';

create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ── 1. programs & the guide's first pack (D3) ───────────────────────────────

create table public.programs (
  id            uuid        primary key default gen_random_uuid(),
  code          text        not null unique,
  name          text        not null,
  kind          text        not null check (kind in ('airline', 'bank', 'hotel')),
  currency_name text        not null,
  is_active     boolean     not null default true
);

create table public.wallet_balances (
  id               uuid        primary key default gen_random_uuid(),
  user_id          uuid        not null references auth.users (id) on delete cascade,
  program_id       uuid        not null references public.programs (id) on delete restrict,
  balance          integer     not null default 0 check (balance >= 0),
  account_age_days integer     check (account_age_days is null or account_age_days >= 0),
  updated_at       timestamptz not null default now(),
  unique (user_id, program_id)
);
create index idx_wallet_user on public.wallet_balances (user_id);

-- ── 2. transfer graph + valuations (§1.4, D19) ──────────────────────────────

create table public.transfer_partners (
  from_program_id uuid    not null references public.programs (id) on delete cascade,
  to_program_id   uuid    not null references public.programs (id) on delete cascade,
  ratio           numeric not null check (ratio > 0),
  step            integer check (step is null or step > 0),  -- issuer increment; null = 'must confirm', never guess (1.4)
  bonus_pct       numeric check (bonus_pct is null or (bonus_pct >= 0 and bonus_pct <= 100)),
  verified_at     timestamptz,                               -- null = must confirm on the airline site
  primary key (from_program_id, to_program_id)
);

create table public.pair_valuations (
  id         uuid        primary key default gen_random_uuid(),
  from_code  text        not null,   -- card / bank currency  (D19: per selected card)
  to_code    text        not null,   -- target program currency
  cpp_low    numeric     not null check (cpp_low > 0),
  cpp_high   numeric     not null check (cpp_high >= cpp_low),
  currency   text        not null default 'USD',
  source_url text        not null,
  verified_at timestamptz not null,
  unique (from_code, to_code)
);
create index idx_pair_val_lookup on public.pair_valuations (from_code, to_code);

-- ── 3. earn plans — the guide's Revolut table, official rates (D20, F4) ─────

create table public.revolut_plans (
  plan                 text        primary key check (plan in ('premium', 'metal', 'ultra')),
  monthly_fee_eur      numeric(5,2) not null,
  debit_points_per_eur numeric(4,2) not null,
  credit_points_per_eur numeric(4,2),                -- null on premium/metal (credit = Ultra-only, G3/F4 test)
  note                 text,
  source_url           text        not null,
  verified_at          timestamptz not null
);

-- ── 4. itineraries — the saved result records (F7, D26, D20) ────────────────

create table public.itineraries (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null references auth.users (id) on delete cascade,
  mode          text        not null check (mode in ('plan', 'book_now')),
  origin        text        not null,
  destination   text        not null,
  window_start  date,                       -- plan mode runway
  window_end    date,
  depart_date   date,                       -- book-now chosen date
  return_date   date,
  cabin         text        not null check (cabin in ('economy', 'premium', 'business', 'first')),
  pax           integer     not null default 1 check (pax between 1 and 9),
  -- computed by the engine on the server; the client never writes these (F12 binding)
  cash_amount   numeric(12,2),
  cash_currency text,
  miles         integer,
  taxes_amount  numeric(8,2),
  taxes_currency text,                      -- may differ from cash currency → InsufficientData (CPP §1.1)
  verdict       text        check (verdict in ('usar_puntos', 'pagar_en_efectivo', 'insufficient_data')),
  savings_eur   numeric(12,2),
  savings_pct   numeric(5,1),
  range_low     integer,                    -- D26: never publish a bare projection
  range_high    integer,
  badges        text[]      not null default '{}',   -- en vivo / cacheado / estimación / proyección
  breakdown     jsonb       not null default '{}'::jsonb,  -- D20: taxes + fees + plan cost + point value
  explanation   text,
  is_test_persona boolean   not null default false,  -- T1 demo rows carry the label
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index idx_itineraries_user on public.itineraries (user_id, created_at desc);

create trigger trg_itineraries_updated_at
  before update on public.itineraries
  for each row execute function public.touch_updated_at();

-- ── 5. transfer plans (F6: from/to, amount, checks passed) ──────────────────

create table public.transfer_plans (
  id             uuid      primary key default gen_random_uuid(),
  itinerary_id   uuid      references public.itineraries (id) on delete cascade,
  user_id        uuid      not null references auth.users (id) on delete cascade,
  from_program_id uuid     not null references public.programs (id) on delete restrict,
  to_program_id  uuid      not null references public.programs (id) on delete restrict,
  amount         integer   not null check (amount > 0),
  checks         jsonb     not null default '{}'::jsonb,  -- {name_match, account_age_30d, seat_exists, both_balances_shown}
  status         text      not null default 'blocked' check (status in ('blocked', 'ready', 'confirmed')),
  created_at     timestamptz not null default now()
);
create index idx_transfer_plans_user on public.transfer_plans (user_id);

-- ── 6. observability: usage + audit (F10; enforcement deferred per D22) ─────

create table public.usage (
  user_id  uuid   not null references auth.users (id) on delete cascade,
  day      date   not null default current_date,
  provider text   not null,
  calls    integer not null default 0,
  primary key (user_id, day, provider)
);
-- v1 records provider calls for the admin dashboard (F10). Enforcement (D22/F9)
-- unlocks later against these same rows — schema is final.

create table public.audit_log (
  id         uuid        primary key default gen_random_uuid(),
  actor      uuid        references auth.users (id) on delete set null,
  action     text        not null,
  entity     text        not null,
  details    jsonb       not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index idx_audit_log_created on public.audit_log (created_at desc);

-- ── 7. subscriptions (P11, later) + admin switches (decision.md admin list) ─

create table public.subscriptions (
  user_id           uuid        primary key references auth.users (id) on delete cascade,
  stripe_customer_id text,
  stripe_price_id   text,
  status            text        not null default 'free' check (status in ('free', 'active', 'canceled', 'not_active')),
  updated_at        timestamptz not null default now()
);

create table public.app_settings (
  id                     integer primary key default 1 check (id = 1),
  primary_provider       text,
  daily_request_cap      integer,                 -- null = enforcement deferred (D22)
  max_horizon_days       integer,                 -- null until measured (P8 / D16)
  show_buy_points        boolean not null default true,
  show_hotel_accelerators boolean not null default true,
  stripe_price_id        text,                    -- null = no subscribe screen, no invented price (F11)
  affiliate_disclosure   text,                    -- null = no affiliate line anywhere (D15 open)
  test_persona           jsonb    not null default '{}'::jsonb,  -- T1 seed (synthetic, labelled)
  attribution_required   text    not null default '',             -- CC-BY-4.0 footer string
  updated_at             timestamptz not null default now()
);

create trigger trg_app_settings_updated_at
  before update on public.app_settings
  for each row execute function public.touch_updated_at();

-- ── 8. auto-profile on signup (standard Supabase pattern) ───────────────────

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, locale)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'locale', 'es'));
  return new;
end
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
-- definer is required only because the new user has no session yet inside the
-- trigger; function body writes exactly one row keyed by new.id. Not exposed
-- as an RPC (returns trigger).

-- ── 9. RLS: enable everywhere, then exact policies ──────────────────────────

alter table public.profiles          enable row level security;
alter table public.programs          enable row level security;
alter table public.wallet_balances   enable row level security;
alter table public.transfer_partners enable row level security;
alter table public.pair_valuations   enable row level security;
alter table public.revolut_plans     enable row level security;
alter table public.itineraries       enable row level security;
alter table public.transfer_plans    enable row level security;
alter table public.usage             enable row level security;
alter table public.audit_log         enable row level security;
alter table public.subscriptions     enable row level security;
alter table public.app_settings      enable row level security;

-- profiles: own row only; admins see all
create policy "profiles_select_own" on public.profiles
  for select to authenticated
  using ((select auth.uid()) = id);
create policy "profiles_select_admin" on public.profiles
  for select to authenticated
  using (public.is_app_admin());
create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- read-only reference data: everyone (thin data; cached; the engine needs it pre-signin)
create policy "programs_read" on public.programs for select to anon, authenticated using (true);
create policy "transfer_partners_read" on public.transfer_partners for select to anon, authenticated using (true);
create policy "pair_valuations_read" on public.pair_valuations for select to anon, authenticated using (true);
create policy "revolut_plans_read" on public.revolut_plans for select to anon, authenticated using (true);
create policy "app_settings_read" on public.app_settings for select to anon, authenticated using (true);

-- wallet: owner-only CRUD; ownership cannot be reassigned (WITH CHECK owner)
create policy "wallet_select_own" on public.wallet_balances
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "wallet_insert_own" on public.wallet_balances
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "wallet_update_own" on public.wallet_balances
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "wallet_delete_own" on public.wallet_balances
  for delete to authenticated using ((select auth.uid()) = user_id);

-- itineraries: verdict numbers are server-written (service role bypasses RLS).
-- Clients select their own rows and may delete; insert/update stay server-side
-- so no client can mint a "Usar puntos" verdict that the engine never computed.
create policy "itineraries_select_own" on public.itineraries
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "itineraries_select_admin" on public.itineraries
  for select to authenticated using (public.is_app_admin());
create policy "itineraries_delete_own" on public.itineraries
  for delete to authenticated using ((select auth.uid()) = user_id);

-- transfer_plans, usage, subscriptions: server-written; clients read their rows
create policy "transfer_plans_select_own" on public.transfer_plans
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "usage_select_own" on public.usage
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "subscriptions_select_own" on public.subscriptions
  for select to authenticated using ((select auth.uid()) = user_id);

-- audit_log: admins read; nobody else
create policy "audit_log_select_admin" on public.audit_log
  for select to authenticated using (public.is_app_admin());

-- ── 10. Data-API exposure grants (tables are NOT auto-exposed since 2026-05-30;
--        enforced everywhere 2026-10-30 — supabase changelog 45329) ─────────────

grant usage on schema public to anon, authenticated;
grant select on public.programs, public.transfer_partners, public.pair_valuations,
                public.revolut_plans, public.app_settings
  to anon, authenticated;
grant select on public.profiles to authenticated;
grant select, delete on public.itineraries to authenticated;
grant select on public.transfer_plans, public.usage, public.subscriptions to authenticated;
grant select on public.audit_log to authenticated;
