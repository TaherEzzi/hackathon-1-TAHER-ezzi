-- close_da_open_items — implements the three settled decisions from the
-- devil's-advocate follow-up (2026-10-26):
--   1. Cache staleness threshold = 24 h (admin-editable, not hard-coded).
--   2. MVP in-flight dedup = simple shared-promise module (lib/engine/dedupe.mjs).
--   3. Pax asked upfront; verdict computed for the stated count — no apology
--      state; the honest one-seat note stays in the breakdown when pax > 1.

-- ── 1. staleness threshold as an admin setting (D12/D22 pattern: editable
--       without deploy). Cached price older than this → badge drops to
--       "estimación" with a stale flag; never shown as fresh.
alter table public.app_settings
  add column cache_max_age_hours integer not null default 24
    check (cache_max_age_hours > 0 and cache_max_age_hours <= 168);
comment on column public.app_settings.cache_max_age_hours is
  'Age limit (hours) for the "cacheado" badge. Older cached prices downgrade to "estimación" + stale flag. Settled 2026-10-26: 24 h. Admin-editable.';

-- ── 3. the T1 persona states its pax so the test run exercises the real
--       ask-upfront path (traveller count is asked before any verdict).
update public.app_settings
set test_persona = test_persona || jsonb_build_object('pax', 1)
where id = 1;
