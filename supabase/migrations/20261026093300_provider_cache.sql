-- provider_cache — the one migration this build writes (BACKEND_BUILD_BRIEF §6).
-- Cache rows keyed exactly like the dedup key (MUST #14):
--   provider:origin:destination:date:cabin:pax   — one string, both uses.
-- Server-only: service role writes/reads it; RLS enabled with NO policies and
-- NO grants to anon/authenticated (supabase-js publishable calls can't touch it).

create table public.provider_cache (
  cache_key  text        primary key,          -- provider:origin:destination:date:cabin:pax
  payload    jsonb       not null,
  fetched_at timestamptz not null default now(),
  ttl_hours  integer     not null default 24 check (ttl_hours between 1 and 168)
);

comment on table public.provider_cache is
  'Provider response cache (Duffel test mode only in v1). Payload normalised {amount,currency}, plus fetched_at age source for priceBadge. Key == dedup key: provider:origin:destination:date:cabin:pax.';

alter table public.provider_cache enable row level security;

-- no policies: server-only via service role. No grant to anon/authenticated.
