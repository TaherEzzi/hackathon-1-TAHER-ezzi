-- fix_devils_advocate — closes every finding from the 2026-10-26 devil's-advocate pass.
-- Each block cites the finding. Nothing here changes settled decisions; it
-- enforces them mechanically where the previous migrations left them implicit.

-- ── 1. wallet_balances had RLS policies but NO grant → wallet/T1 dead ──────
-- Data-API context (changelog 45329) does not auto-expose tables; a policy is
-- only a filter on top of a grant. Without the grant every wallet query
-- returned `permission denied`.
grant select, insert, update, delete on public.wallet_balances to authenticated;

-- Sanity ceiling on typed balances: the honesty model is "traveller-typed,
-- never verified", but no absurd render (999M Avios) can slip into the UI.
-- 10M is far above any real programme balance and far below int4 overflow.
alter table public.wallet_balances
  add constraint wallet_balance_ceiling_chk check (balance <= 10000000);

-- ── 2. handle_new_user was not idempotent → pre-existing profile row ────────
-- (admin pre-creates a user, seed re-run) made the auth insert roll back and
-- blocked signup entirely. Conflict now merges instead of crashing.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, locale)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'locale', 'es'))
  on conflict (id) do update
    set locale = coalesce(excluded.locale, public.profiles.locale);
  return new;
end
$$;
-- EXECUTE was revoked in fix_advisor_findings for the OLD function; the new
-- function object starts with default grants, so revoke again to keep the
-- /rest/v1/rpc path closed (trigger participation does not need EXECUTE).
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- ── 3. No sanity on itinerary dates → nonsense projections possible ────────
alter table public.itineraries
  add constraint it_window_dates_chk
    check (window_start is null or window_end is null or window_start <= window_end),
  add constraint it_depart_dates_chk
    check (depart_date is null or depart_date >= current_date),
  add constraint it_return_dates_chk
    check (depart_date is null or return_date is null or depart_date <= return_date);

-- ── 4. Savings invariants + percent overflow ───────────────────────────────
-- numeric(5,1) capped at 9999.9% and a server-side INSERT would fail after the
-- traveller already saw the verdict. Negative savings must be NULL (D12: never
-- publish "ahorras −35%"), and taxes ≥ cash forces pagar_en_efectivo with no
-- saving at all. Also: a real verdict can never exist without its full money
-- breakdown (D20 — never one merged number, never % with missing taxes).
alter table public.itineraries
  alter column savings_pct type numeric(7,1);
alter table public.itineraries
  add constraint savings_nonneg_chk
    check (savings_eur is null or savings_eur >= 0),
  add constraint savings_pct_nonneg_chk
    check (savings_pct is null or savings_pct >= 0),
  add constraint verdict_brings_all_figures_chk
    check (
      verdict is null or verdict = 'insufficient_data'
      or (
        cash_amount is not null and cash_amount > 0
        and miles is not null and miles > 0
        and taxes_amount is not null
        and cash_currency is not null
        and savings_eur is not null
      )
    );

-- ── 5. audit_log grant to authenticated was a landmine ─────────────────────
-- Policy correctly restricted reads to admins, but the grant itself means a
-- dropped policy silently leaks the whole log before anyone notices.
revoke select on public.audit_log from authenticated;

-- ── 6. is_test_persona was user-updatable → demo-data contamination ────────
-- A user could self-label as the T1 persona and pollute admin/test filters.
-- The flag is server-owned: WITH CHECK refuses any user write that sets it.
drop policy "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id and is_test_persona = false);

-- ── 7. transfer_plans.checks was free-form jsonb ───────────────────────────
-- {name_match: "yes"} counted as "passed". Typed boolean columns make a
-- falsy-but-present check impossible (F6: from/to, amount, checks passed).
alter table public.transfer_plans
  drop column checks,
  add column name_match        boolean not null default false,
  add column account_age_30d   boolean not null default false,
  add column seat_exists       boolean not null default false,
  add column both_balances     boolean not null default false;

-- ── 8. usage.day was DB-timezone (UTC) → off-by-hours day boundary ─────────
-- Request rows land on the Spain-local day the traveller means, so a future
-- daily cap (D22) can't be disputed by an hour at 23h Europe/Madrid.
alter table public.usage
  alter column day drop default;
alter table public.usage
  alter column day set default ((now() at time zone 'Europe/Madrid')::date);

-- ── 9. Comments locking in the honesty semantics ────────────────────────────
comment on column public.transfer_partners.ratio is
  'An edge with verified_at = null is ENTIRELY unconfirmed: the ratio itself must display "confírmalo en la web" and must never feed a verdict gap as fact. Only the engine treats it as a provisional ceiling.';
comment on column public.pair_valuations.cpp_low is
  'Loader contract: write verified_at + source_url on every row and append a diff summary to audit_log per load. No fallback/default cpp may ever be invented in engine code (D12/D19). Itineraries.breakdown must snapshot the cpp + verified_at used, so every verdict is reproducible.';
comment on column public.itineraries.breakdown is
  'Server-computed money breakdown (D20): taxes + fees + plan cost + point value. Must include the pair cpp and verified_at used (reproducibility) and, for pax > 1, seat_basis: 1 with the estimación badge (one fixture seat says nothing about two).';
comment on column public.itineraries.savings_pct is
  'NULL when using points saves nothing or costs more (taxes >= cash). Never negative (D12).';

-- ── 10. T1 persona: make the 90-day runway land by design ───────────────────
-- Metal 0.5 pts/€ on 1.800 €/mes = 900 pts/mes vs the ~200k+ Avios MAD-JNB
-- business gap → a runway of years. That is not a bug to hide; it IS the D26
-- low-end feasibility call. The seed now states the expected branch so the
-- engine + UI treat it as the accelerator-card outcome (MUST #7 "both cards
-- shown when waiting saves more"), not a dead end.
update public.app_settings
set test_persona = test_persona || jsonb_build_object(
      'plan_mode_expected', jsonb_build_object(
        'outcome',  'runway_not_feasible_in_window',
        'ui_path',  'accelerator_cards',
        'note',     'Runway de ejemplo: 900 pts/mes no alcanza el hueco JNB business en 90 días. Resultado esperado: tarjeta de aceleración, no callejón.'),
      'book_now_expected', jsonb_build_object(
        'outcome',  'cpp_verdict_from_selected_card',
        'note',     'F2: el valor sale solo del par de programa de la tarjeta seleccionada (D19).'))
where id = 1;
