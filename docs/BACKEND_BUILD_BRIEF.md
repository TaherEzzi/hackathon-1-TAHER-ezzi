# Backend Build Brief — A Una Milla v1

**Give this file to a fresh session and the whole backend gets built in one shot.**
It is self-contained: what the product is, what already exists (do not rebuild it), the binding rules, the exact contracts, the build order, and the acceptance gates. Source of truth for any conflict: `docs/decision.md`, then this file, then everything else.

---

## 1. What the product is (60 seconds)

A chat where anyone in Spain asks **"¿Cuánto ahorro en este viaje?"** and gets price, points, how to earn the points, and the saving — then books. Two intents in one thread:

- **Plan mode (F1)** — a 90-day runway to an award seat, ranked by total money value (D21).
- **Book now (F2)** — cash vs miles+taxes on a live seat, verdict `usar puntos` / `pagar en efectivo` via cents-per-point after taxes.

Cash fares are real (Duffel, test mode). Award seats end in guided steps, never issued programmatically (D31). Checkout/tickets are demo-grade by design, permanently for v1.

**Demo case:** Madrid → Johannesburg, Business, 90 days, 1 traveller, Iberia / BA / Qatar, funded by Revolut Metal + Iberia Plus 32.000 Avios (seeded T1 persona, one tap, no typing).

**Division of labour (binding, F12):** the LLM **only** parses the intent and explains the result. **All arithmetic is code**, in `lib/engine/`. The LLM never produces a number.

---

## 2. What already exists — do NOT rebuild

### Database — Supabase project `culmpmgyplcuromnewrt` (EU), CLI linked, 5 migrations applied and live:

| Migration | Contents |
|---|---|
| `20261026092644_core_schema` | 12 tables: `profiles`, `programs`, `wallet_balances`, `transfer_partners`, `pair_valuations`, `revolut_plans`, `itineraries`, `transfer_plans`, `usage`, `audit_log`, `subscriptions`, `app_settings`. RLS on all; explicit `TO` clauses; UPDATE policies carry USING + WITH CHECK; admin via `app_metadata.aum_admin`; auto-profile on signup. |
| `20261026092719_seed_reference_data` | 8 programs (BA, IB, VY, EI, AY, QR, REVOLUT, AMEX_ES), 9 guide-stated BA-bridge transfer edges (ratio 1.0, `verified_at = null` → "confírmalo"), official Revolut rates (premium 9,99 €/0.25 debit · metal 15,99 €/0.50 · ultra 55 €/1.00 debit + 1.50 credit, "oferta de lanzamiento"), `app_settings` row (provider=fixture, T1 persona JSON, CC-BY attribution). **`pair_valuations` is deliberately EMPTY** (D19: the 98-pair dataset loads from its official URL in the build slice — this brief §7). |
| `20261026092900_fix_advisor_findings` | Revoked the definer-trigger RPC path; merged dual permissive SELECT policies. |
| `20261026093100_fix_devils_advocate` | Wallet grants; idempotent `handle_new_user` (`on conflict do update`); date-sanity CHECKs on itineraries; savings invariants (`savings_eur`/`savings_pct` NULL-when-negative, `savings_pct` numeric(7,1), `verdict_brings_all_figures_chk`: a real verdict must carry cash+miles+taxes+savings or be `insufficient_data`); wallet balance ceiling 10M; `is_test_persona` server-owned; `audit_log` grant revoked; `transfer_plans.checks` → typed booleans `name_match / account_age_30d / seat_exists / both_balances`; `usage.day` defaults to Europe/Madrid local day. |
| `20261026093200_close_da_open_items` | `app_settings.cache_max_age_hours` integer default **24** (admin-editable, CHECK 1–168); T1 persona seeds `pax: 1`. |

### Engine code — `lib/engine/` (pure ESM, 27 tests pass via `node --test lib/engine/`)

- `verdict.mjs` — `computeVerdict`, `cppAfterTaxes`, `assertSameCurrency`, `perProgramGap`, `monthlyEarn`, `enoughBy`, `sanitizeBalance`, `priceBadge`, `floorCents`, `ceilPoints`, `InsufficientData`, `ProviderError`. **Import these; never reimplement the math.**
- `dedupe.mjs` — `dedupe(key, fn)` (shared-promise in-flight dedup), `inFlightCount`.
- `verdict.test.mjs`, `dedupe.test.mjs` — every guard is a named test. Keep them green; add tests for new code.

### Environment (`.env`, never print values, never commit)

`duffel_api_key` (starts `duffel_test_`), `grok_api_key`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `supabase_secret_key` (server-side service role ONLY), `SUPABASE_ACCESS_TOKEN`, `github_token`. Create `.env.example` with all key names and no values.

### Tooling

Node 24, `npx -y supabase` (CLI v2.122.0, project linked; push with `npx -y supabase db push --linked`). No `package.json` at repo root yet — the build step creates it.

### Other docs you must read first (read-only anchors)

`docs/decision.md` (settled truth) · `docs/flow.md` (F0–F12, the engine pipeline F12 §206–247) · `docs/OVERVIEW.md` (scope tiers) · `docs/ACTION_PLAN.md` (order of attack). `research/repos/**` is reference only — never build against it in place, never edit it.

---

## 3. Binding rules (violating any of these is a failure, not a bug)

1. **Honesty (D12):** every figure carries its badge `en vivo / cacheado / estimación / proyección` **and its age**. Never publish a bare projection (D26): ranges only, low–high, with the cause of widening. Never a % with missing taxes. Typed `InsufficientData` / `ProviderError`, never silent.
2. **Badge ages (settled 24 h):** within `cache_max_age_hours` → `en vivo`/`cacheado`; older than it → **any stored price drops to `estimación` + `stale: true`** (a stored "live" price is a cache); unknown age → never fresh; fixture is always `estimación`.
3. **Verdict math is server-side:** clients get SELECT (+DELETE) on itineraries; the engine writes verdict columns with the **service role only**. No client can mint a verdict.
4. **Per-program gap (binding):** balances are **never summed across programs** — only the target program, or reachable through ONE guide-stated F6 transfer edge, funds a seat. Feasibility is tested on the **low end** of the range (D26).
5. **D19 card gate:** until a card that can fund the trip is selected, no value is shown — ask which card; value comes ONLY from that card's program pair (`cpp_low..cpp_high` shown as a range with the dataset's `verified_at`). No global estimate, no invented cpp, no fallback constants. `pair_valuations` empty ⇒ verdict is `insufficient_data` — that is correct behaviour, not a bug.
6. **Pax (settled):** ask "¿cuántos viajáis?" **before** computing; verdict is computed for the stated count (1–9). For pax > 1 the breakdown keeps `seat_basis: 1` + the note "disponibilidad para 1 asiento no garantiza 2" (data note, not an apology).
7. **Dedup + budget (MUST #14):** ≤ 7 candidate dates per request. Live calls are **cash-side only** (Duffel test mode); award side = labelled fixture (D29). Every provider call goes through `dedupe()`; key = `provider:origin:destination:date:cabin:pax`.
8. **Money breakdown (D20):** taxes + fees + plan cost at official dated rates + points value — **never one merged number**. Every itinerary row snapshots the pair cpp + `verified_at` used in `breakdown` (verdict reproducibility).
9. **Never store:** passport numbers, card PANs, airline credentials. Verdict numbers server-written only.
10. **Scope (do not build):** real Stripe billing, price alerts, screenshot extraction, production booking issuance, request-cap enforcement (D22 — usage is recorded, not enforced), programs beyond the Avios pack, hotel award search, native app.

---

## 4. Architecture

Next.js (App Router) on Vercel, Node runtime for API routes. Server routes hold all secrets. Supabase JS client: publishable key + user session for reads (RLS), `supabase_secret_key` ONLY inside server routes for engine writes. Chat: Grok (`grok_api_key`) for parse/explain steps only.

```text
app/
  api/
    chat/route.ts            POST  F0/F12 turn
    engine/verdict/route.ts  POST  book-now comparison (F2)
    engine/runway/route.ts   POST  plan mode (F1, D21 ranking)
    duffel/offers/route.ts   POST  cash offers (cache + dedupe)
    duffel/price/route.ts    POST  re-verify one offer (F8)
    duffel/order/route.ts    POST  test-mode order (F8, D31)
    wallet/route.ts          CRUD  user's balances (RLS)
    itineraries/route.ts     GET/DELETE own; POST = engine computes + writes
    persona/route.ts         GET   T1 from app_settings
    admin/route.ts           GET   counts + settings (is_app_admin only)
lib/
  engine/verdict.mjs         (exists — import)
  engine/dedupe.mjs          (exists — import)
  server/
    supabase.ts              clients: user-scoped + service-role factory
    duffel.ts                offer request → offer → price → order; typed errors
    fixture.ts               labelled award fixture loader + validation
    cache.ts                 provider_cache read/write + TTL + badge handoff
    audit.ts                 audit_log + usage writers (service role)
    grok.ts                  parseIntent / explain — text in, JSON out, no math
supabase/migrations/
  *_provider_cache.sql       (to write — see §6)
```

---

## 5. Contracts

### 5.1 Engine (import from `lib/engine/verdict.mjs` — signatures fixed)

- `computeVerdict({cash:{amount,currency}, taxes:{amount,currency}, miles, pair:{low,high,currency,verified_at?}, pax, cashFetchedAt?, now?, maxAgeHours?})` → `{verdict:'usar_puntos'|'pagar_en_efectivo', savings_eur|null, savings_pct|null, breakdown:{currency, cash, taxes, miles, cpp, pair_used, seat_basis, seat_capacity_note}, badges[]}`. Throws `InsufficientData` on ÷0 miles, currency mismatch (cash/taxes/valuation), bad pax. Taxes ≥ cash ⇒ `pagar_en_efectivo` + NULL savings.
- `perProgramGap(needed, reachable)` → `{gap, enough}`; gap rounds UP, never −0.
- `monthlyEarn({spendMonthly, rateLow, rateHigh, expiring})` → `{low, high}`; expiry subtracts once, clamps ≥ 0.
- `enoughBy(gap, monthlyEarnLow, monthlyEarnHigh, today?)` → `{feasible, by_date, by_date_high, months_low}`; zero earn ⇒ `feasible:false` ⇒ accelerator-card path (T1 case — designed outcome, not a dead end).
- `priceBadge({kind:'live'|'cached'|'fixture', fetchedAt, now?, maxAgeHours?})` → `{badge, stale, age_hours}`.
- Rounding: savings DOWN (`floorCents`), gaps UP (`ceilPoints`). Balances sanity-capped at 10M (`sanitizeBalance`).

### 5.2 Cache + dedup key (MUST #14)

- Cache key: `provider:origin:destination:date:cabin:pax` (exact same shape as the dedup key — one string, both uses).
- On provider success: store payload + fetched_at + ttl in `provider_cache` (§6), serve through `priceBadge`.
- On provider failure: retry once; then serve cache row badged `cacheado` (with its age) and keep the typed `ProviderError` in the payload — the error is never dropped. No cache row ⇒ typed `ProviderError` to the client.
- In-flight duplicates share one promise via `dedupe(key, fn)`.

### 5.3 Duffel (test mode only)

Base `https://api.duffel.com`, header `Duffel-Version: v2`, Bearer `duffel_api_key` (assert prefix `duffel_test_` at startup). Flow (F8): `POST /air/offer_requests?return_offers=true` (slices origin/destination/departure_date, cabin_class, passengers ×pax) → pick the cheapest sane offer → **re-verify the price** (`POST /air/offers/{id}` on the chosen offer) before any order → `POST /air/orders` with the test payment type. Sandbox airline = "Duffel Airways"; simulated payment; dummy reference. Total money = `total_amount`/`total_currency` from the offer. Reference for shapes: `scripts/duffel-smoke.mjs` and `research/repos/duffel-starter-kit` (read-only). Every call is wrapped in `dedupe` + cache. All responses normalise to `{amount, currency}` and are stored with `fetched_at`.

### 5.4 Award fixture (D29/D30) — `lib/server/fixture.ts` + `data/award-fixture.json`

```json
{
  "label": "estimación",
  "verified_at": "2026-10-26",
  "source": "free seats.aero website ritual (D30)",
  "routes": [
    { "origin": "MAD", "destination": "JNB", "airline_program": "IB", "cabin": "business",
      "miles_one_way": 0, "taxes": {"amount": 0, "currency": "EUR"}, "seats": "unknown" }
  ]
}
```

Fill `miles_one_way`/`taxes` from the D30 ritual before demo day; **0 is not a real value** — if a number isn't verified, the route entry must be absent so the engine returns `insufficient_data` instead of computing on zero. Loader validates the schema and throws `InsufficientData('fixture: …')` on anything malformed. Never invent values. Fixture badges: always `estimación` (§3.2), with `verified_at` shown as age.

### 5.5 Pair-valuations loader (D19) — `scripts/load-pair-valuations.mjs`

Fetch the CC-BY-4.0 dataset (`components-and-math.md` §3 holds the URL; WanderWise Guide) → for each row `upsert into pair_valuations (from_code, to_code, cpp_low, cpp_high, currency, source_url, verified_at)` → **write a diff summary to `audit_log`** (pairs changed, old→new). Refuse to run if any row lacks `source_url` or `verified_at`. No default/fallback values ever. Run once in the build slice; keep the script re-runnable.

### 5.6 Chat turn (F12, step by step)

1. **Parse** (Grok): structured `{origin, destination, window{start,end}|depart_date, flexibility, pax, cabin, mode:'plan'|'book_now'}`. Missing origin/destination/window ⇒ `UnparsedIntent`, ask for the fields, never guess. Confirm with a card (route, window, travellers — this is where pax is asked, §3.6).
2. **Dates:** up to 7 candidates from ONE ranged cash query (Duffel, test mode). A second page = a new request.
3. **Project:** wallet balances + monthly earn (`monthlyEarn` with rateLow/high from the selected card's plan; expiring points netted once). `balanceBy(date)` on the 7 dates only, **per program**. Render as `proyección` ranges.
4. **Value:** card gate (§3.5) → `pair_valuations` lookup for the card's pair → `computeVerdict` per candidate. Full breakdown (D20) incl. plan cost from `revolut_plans` (official, dated).
5. **Rank (D21):** `valueScore(t) = expectedCashPrice(trend(t)) − allInCost(t)`; trend = labelled seasonal-curve fixture (D27, a `trendFor(t)` function with a source label). Hard veto above value: no seat at all, or date beyond the award release window. Both cards shown when waiting saves more; the later card carries the deferral reasoning. Runway infeasible at the low end ⇒ accelerator card (T1 case).
6. **Explain** (Grok): plain Spanish quoting the computed numbers. The structured payload is what the UI renders — numbers from the payload only.

Also: `ProviderError` payload carries `{provider, route, date, code}`; retry once, then cache-or-fail per §5.2. "Ver precio en vivo" re-runs the cash offer for the chosen date only.

### 5.7 Persistence rules

- `POST /api/itineraries` computes the verdict server-side (service role) and inserts: mode, route, dates, cabin, pax, `cash_amount/cash_currency`, `miles`, `taxes_amount/taxes_currency`, `verdict`, `savings_eur/savings_pct`, `range_low/range_high` (D26), `badges`, `breakdown` (snapshot cpp + verified_at + seat_basis), `explanation`. Validate against the DB CHECKs — a violation is a bug in the engine, not a suppressed insert.
- `transfer_plans` rows are service-written; the four boolean checks are set from real pre-checks (BA bridge exists, 30-day rule = `account_age_days >= 30`, name match = exact string equality of typed names, both balances shown). Never claim we moved Avios.
- Every provider call appends `(user_id, day, provider, calls)` to `usage` (upsert `calls = calls + 1`, Europe/Madrid day). Engine runs that mutate data append to `audit_log`.
- Admin route: gate on `is_app_admin` (app_metadata claim); returns day's aggregate counts + settings + audit tail. No writes to `app_settings` exposed in v1 (D15/D17 open).

---

## 6. The one migration this build writes

`supabase/migrations/20261026093300_provider_cache.sql`:

```sql
create table public.provider_cache (
  cache_key  text        primary key,          -- provider:origin:destination:date:cabin:pax
  payload    jsonb       not null,
  fetched_at timestamptz not null default now(),
  ttl_hours  integer     not null default 24 check (ttl_hours between 1 and 168)
);
alter table public.provider_cache enable row level security;
-- no policies: server-only via service role. No grant to anon/authenticated.
```

Push with `npx -y supabase db push --linked`, then regenerate types: `npx -y supabase gen types typescript --linked > lib/database.types.ts`.

---

## 7. Build order (one shot, in this sequence — commit after each gate)

1. Scaffold: `package.json` (next, @supabase/supabase-js, grok client, typescript), `tsconfig`, `.env.example`, wire `lib/engine/*` imports. **Gate:** `node --test lib/engine/` still 27/27.
2. `provider_cache` migration + `lib/server/cache.ts`, `audit.ts`. **Gate:** cache round-trip stores + serves TTL-stale badges per §5.2 (test).
3. `lib/server/duffel.ts`: offers → re-verify → order, wrapped in dedupe+cache, typed `ProviderError`. **Gate:** `npx tsx` script or test-mode curl gets MAD→CDG offers (smoke precedent exists; probe date must be future).
4. Fixture loader (§5.4) with MAD→JNB business values from the D30 ritual. **Gate:** loader refuses malformed rows (test).
5. Pair-valuations loader (§5.5). **Gate:** `pair_valuations` populated with source_url + verified_at, one audit_log diff row.
6. Routes: `/api/wallet` (CRUD through user client), `/api/persona`, `/api/engine/verdict` (F2 end-to-end), `/api/engine/runway` (F1 end-to-end incl. D21 ranking + accelerator branch), `/api/itineraries` (server-computed write), `/api/chat` (parse → compute → explain), `/api/admin`.
7. Wire usage recording into every provider call. **Gate:** usage rows increment per distinct call, dedupe collapses duplicates (integration test).
8. `GET /api/admin` gated by `is_app_admin`.

**Definition of done:** `node --test lib/engine/` green · every route returns typed errors, never silent · a fresh T1 tap runs F12 end-to-end without typing · the demo script in `docs/flow.md` §269–279 walks through without a dead end · no secret appears in any response or log · badges+ages on every figure.

---

## 8. Pitfalls already found and fixed — do not reintroduce

| Trap | Rule now |
|---|---|
| RLS policy without a grant = feature dead | Every new table gets grant + policy, or is explicitly server-only (§6) |
| `savings_pct` overflow / negative savings | NULL when nothing is saved; % bounds enforced by DB CHECK |
| ÷0 miles, currency mismatch, taxes ≥ cash | All guarded in `computeVerdict` — do not bypass it to hand-roll math |
| Balances summed across programs | Only `perProgramGap` with a single reachable total |
| Expiry double-counted | `monthlyEarn` subtracts once, clamps ≥ 0 |
| Old cache shown as fresh | `priceBadge` downgrade at 24 h — always compute badges through it |
| User-minted verdicts | Verdict columns written server-side only |
| Invented point values | Empty `pair_valuations` ⇒ `insufficient_data`, never a default cpp |
| Stale dedup promises reused | `dedupe.mjs` deletes on settle; retry runs fresh |
| `-0` gap, rounding up savings | `ceilPoints`/`floorCents` — covered by tests, keep them |
