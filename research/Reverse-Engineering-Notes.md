# Reverse-Engineering Notes: Adoptable Parts From Existing Tools

**Purpose:** Consolidated observations from cloning and dissecting 9 open-source components that live behind (or are equivalent to) the existing products in the travel-hacking space. For each repo: what it is, license, and the **exact part we can put into our system** ("A Una Milla", especially feature **F12 – Points Runway**: *"I want to go to X in ~3 months → given my cards/balances/spend → WHEN should I book?"*).

**Cloned into:** `research/repos/` (shallow clones — do not build against them in-repo; copy concepts/patterns/transplant code under the terms of each license).

---

## 0. Executive map: which repo feeds which part of our system

| Our need | Best source repo | License | Copy code? |
|---|---|---|---|
| Award availability + taxes data layer | `seats-MCP` | GPL-3 | ❌ (schema/spec only) |
| Google Flights deep-links + cash price extraction | `gf-seats-aero-extension` | MIT | ✅ |
| Cash-vs-award verdict logic & prompt patterns | `gondola-mcp` | MIT | ✅ (commands/text; engine is closed) |
| CPP formula + transfer-bonus math | `genpark-award-skill` | MIT | ✅ |
| Welcome-offer (signup bonus) dataset → seed | `credit-card-bonuses-api` | MIT + Commons Clause | ✅ data (no reselling dataset) |
| Transfer-partner CPP valuations dataset → seed | `points-transfer-valuations` | MIT (code) + CC-BY-4.0 (data) | ✅ w/ attribution |
| Wallet (balances) data model + PWA offline shell | `miles-wallet` | MIT | ✅ |
| Transfer ratios, increments, balance-feasibility engine | `award-trip-agent` | MIT | ✅ |
| Program catalog, award-chart lookup, "when seats open" playbook | `awardtravelfinder-mcp` | MIT | ✅ (skill text; data is hosted API) |
| Decision contract, trust language, confidence model | `awardradar` | ⚠️ none (proprietary) | ❌ ideas only |
| Zone-based award charts + surcharges seed | `awardradar` (in-code) | ⚠️ none | ❌ retype numbers with own citation |

---

## 1. seats-MCP — Seats.aero + Rooms.aero Partner API client

**Repo:** https://github.com/baeleb/seats-MCP · Go · **GPL-3.0** (do not copy GPL code into our app; use as the behavioral spec — we reimplement the client CRUD into our own non-GPL architecture.)

### What it is
MCP server wrapping the seats.aero (award flights) and rooms.aero (award hotels) Partner APIs, including a full OAuth2 flow to act on behalf of a user's seats.aero account.

### The exact parts to adopt

**API surface (hard-won knowledge, usable regardless of license):**

| Call | Path | Key params |
|---|---|---|
| Cached multi-program search | `GET https://seats.aero/partnerapi/search` | `origin_airport` (comma list ok), `destination_airport`, `start_date`, `end_date` (YYYY-MM-DD), `sources`, `cabins` (economy\|premium\|business\|first), `carriers`, `order_by=lowest_mileage`, `only_direct_flights`, `include_trips`, `take`, `skip`, `cursor` |
| Single-program bulk | `GET …/api/availability` | `source` (required, e.g. `aeroplan`), `cabin`, date range, regions, paging |
| Itinerary detail | `GET …/api/trips/{id}` | returns `Trip` with per-segment detail + booking links |
| Real-time search | `POST …/api/live` | body: `origin_airport`, `destination_airport`, `departure_date`, `source`, `seat_count`, `disable_filters`, `show_dynamic_pricing` — 5–15s; failed searches don't count against quota; NOT available to Pro keys |
| OAuth per user | `GET {seats.aero}/oauth2/consent…`, `POST {seats.aero}/oauth2/token` (JSON body, not form-encoded) | header: `Partner-Authorization: <API key>` or `Bearer <token>`; userinfo via `GET /userinfo` |

**Auth *pattern* worth cloning:** one `Authorizer` interface (`Apply(ctx, req)`) with API-key and OAuth variants resolving to the same `Partner-Authorization` header; refresh token cache; atomic persistence (`FileTokenStore`: JSON → `.tmp` → `os.Rename`, chmod 0600).

**Response schema (mirror these names in our SearchResult):**
- `Availability` (route+date+program row): `Date`, `Source`, per-cabin flags `Y/W/J/F:Available`, **`YMileageCost`,`W..`,`J..`,`F..` (string-typed mileage)**, `YRemainingSeats…`, airlines per cabin.
- `Trip` (concrete itinerary): `TotalDuration`, `Stops`, `Carriers`, `MileageCost` (int), **`TotalTaxes` + `TaxesCurrency` + `TaxesCurrencySymbol`** (we need taxes for the CPP formula), `AllianceCost`, `FlightNumbers`, `Cabin`, `DepartsAt/ArrivesAt`.
- `Segment`: per-leg airports, flight numbers, aircraft, distance, `FareClass`.
- Envelope: `{data, count, hasMore, cursor}` — **prefer cursor over skip** to avoid duplicates.
- Booking links: `[{label, link, primary}]` per trip.

**Quota reality:** 1,000 requests/day per key (rooms.aero has a separate 1,000/day). No client caching/retries in this repo — our layer must add dedupe + LRU + in-flight coalescing (see §2 for the exact pattern). Rooms.aero: results only returned if checked in the **last 21 days**; `POST /hotels/{id}/refresh` limited to 1/user/24h; hotel rows already include **`standard_cpp` / `suite_cpp` + cash cost in minor units** — a ready-made cash-vs-points template for hotels.

**Alert model to copy:** rooms.aero `Alert { date_type: fixed_date|date_range|any_date, arrival_date_start/end, num_nights, alert_mode: one_off|continuous, channel, max_points, expired }` → adopt verbatim as our `Alert` entity shape (maps to spec F10).

### Adopt checklist
- [ ] Reimplement `/search`, `/availability`, `/trips/{id}`, `/live` client (own code, GPL-clean) with `Partner-Authorization` header.
- [ ] Adopt `Trip.TotalTaxes` + currency into our savings engine.
- [ ] Adopt alert shape + 1,000/day quota scheduling + cursor pagination.

---

## 2. gf-seats-aero-extension — Google Flights ↔ award overlay (Chrome MV3)

**Repo:** https://github.com/jiahongc/google-flights-seats-aero-extension · JS · **MIT** (copy freely with attribution).

### What it is
"Points Path clone" — shows award prices on Google Flights and cash prices on seats.aero. Two directions of integration, both fully reverse-engineered here.

### The exact parts to adopt

**A. Google Flights `tfs` URL encoder (`protobuf.js`, MIT — our booking CTA engine).**
Hand-written protobuf encoder, verified by tests. Message layout:
- FlightData: field 2 = date string, field 5 = `max_stops` varint (**explicitly emit 0 → nonstop**), field 6 = repeated airline-code strings, field 13 = `{string airport=2}` origin, field 14 = destination.
- Info: field 3 = nested FlightData, field 8 = repeated enum `1` × passenger count (1–9), field 9 = cabin enum {economy:1→economy? — extension maps `SEAT_MAP = {economy:1, premium:2, business:3, first:4}` in seat slot}, field 19 = `2` (one-way).
- base64url → `https://www.google.com/travel/flights/search?tfs=<b64>&hl=en&curr=<ISO>`.
→ **This is how we deep-link the user from a Points Runway verdict ("book on Feb 15") straight into a live, pre-filled GF search.**

**B. Google Flights cash-price extraction (`background.js::extractPrices`).**
Fetch GF HTML server-side-style, then:
- Embedded blob lives in `<script class="ds:1">` (fallback: any `ds:N` containing `"Cj`).
- Per-flight prices via regex `/\["([A-Z\d]{2})","(\d+)",null,"[^"]+"\]/g` (carrier, flightNo) + within next 1500 chars `/\[\[null,(\d+)\],"Cj/` → `flightPrices[carrier+number] = price`.
- "Best" price = first `[[null,<price>],"Cj` in document (GF orders by Best).
- Sanity cap ~$50k/currency. Retry once on 429/5xx (2s delay).
→ Lets our next.js API route price **any candidate date's cash fare** without a commercial flight API. Combine with seats.aero `Trip.TotalTaxes` for true CPP.

**C. CPP formula with fee netting (`seats-content.js`).**
```
adjustedPrice = max(cashPrice − awardTaxes, 0)
cpp           = adjustedPrice × 100 / mileageCost
```
Taxes parsed/multi-currency (we get taxes from Seats.aero API instead of DOM — better).

**D. Per-program valuation baselines (`PROGRAM_BASELINES`, seats-content.js:350–377).**
Curated "good redemption" CPP thresholds per program (~30 entries; examples: Aeroplan 1.5¢, AAdvantage 1.6¢, SkyMiles 1.2¢, Smiles/LATAM/Azul 1.1¢). Adopt as our scoring table, editable per user (expert mode).

**E. Caching discipline (directly solves our quota problem).**
In-flight request dedup (`inflightRequests` map) + LRU cache (500 entries, 30-min TTL) keyed by `origin-dest-date-cabin-airline-direct-currency`; exchange rates via `https://api.frankfurter.dev/v1/latest?base=USD` (ECB), 6h TTL, in-flight dedupe, hardcoded fallback rates. **Exactly the pattern our Points Runway poller needs to stay inside 1,000/day.**

**F. Matching-degradation rule (UX honesty).** Exact-flight match when possible; for ambiguous (connecting) results degrade to route-level "from $X" and **never display CPP** ("price would be misleading"). Adopt as display rule.

**G. GF↔seats.aero filter mapping table** (README): `applicable_cabin`, `min_seats`, `direct_only`, `op_carriers`, `additional_days[_num]` — canonical vocabulary when translating user intent → both APIs.

### Adopt checklist
- [ ] Port `protobuf.js::buildGoogleFlightsTfsUrl` (MIT) into our utilities with a test.
- [ ] Port `extractPrices` blob regexes for server-side cash checks.
- [ ] Adopt CPP-after-taxes formula + `PROGRAM_BASELINES`.
- [ ] Adopt in-flight-dedup + LRU wrapper for all external calls.

---

## 3. gondola-mcp — Gondola's official "cash vs award" MCP

**Repo:** https://github.com/gondola-ai/gondola-mcp · MIT (interface only — the engine itself is closed-source/hosted at `mcp.gondola.ai`; OAuth 2.1 + DCR for end users).

### The exact parts to adopt (all inside `tools.json` + `commands/*.md` + `GEMINI.md`)

**1. Split "portfolio advice" from "this-trip advice" as two distinct modes.**
- `optimize_loyalty_portfolio` (no arguments): "points expiring soon (**ranked by value at risk**), best transfer opportunities from transferable card currencies, largest balances".
- Tool descriptions explicitly route: "To choose where to book a SPECIFIC trip, use search instead."
→ **Our Points Runway needs both: a trip-level planner and a portfolio auditor. This is the first product we've seen that makes the separation.**

**2. `predict_price` — the closest existing analog to "when should I book".**
Input: `hotel_id`, `checkin`, `checkout`, `nightly_cash_cost` (+currency), optional `nightly_points_cost`.
Output: confidence-scored **"book now" / "wait" / "prices typically rise"** verdict + supporting signals + price history. Note: it takes a *future* stay window → the shape is directly reusable for our runway verdict.
→ **Nobody we found does this for flights + points-earning; we extend it to "book on date X because you'll have N points".**

**3. Percentile framing as second signal.** `get_hotel_stats`: "this rate is in the 20th percentile — cheaper than 80% of historical observations". Adopt: express our projections as percentiles vs typical, not absolute claims.

**4. Async award pricing pattern.** `search_flights` returns `pending_sources[]` (award pricing still being fetched) → caller MUST follow up with `get_flight_points` which pairs cash itineraries with award price + CPP, per-program status `timeout` (retry) vs `no_results` (definitive).
→ Mirrors how we should run seat checks: immediate cash answer, award follow-up, honest "checking…" states.

**5. Loyalty asset decomposition (beyond point balances):**
- liquid balances (`get_loyalty_accounts`)
- free-night certs incl. **"whether a points top-up is allowed"** + expiry surfacing
- flight credits (airline, amount, currency, expiry)
- suite upgrade credits
- elite tier + home airport context
→ Extend our F4 wallet with these asset classes; "expiring soon sorted by value at risk" is our dashboard metric (matches spec F9).

**6. Anti-hallucination language for partial data (adopt verbatim into our prompt/policy):**
- "labeled **unconfirmed, not unavailable**"
- "**call again in a few seconds** before concluding a rate is unavailable"
- "never prove a missing date is unavailable from cached observations"
→ Award calendars are notoriously partial; these three sentences go straight into our system prompt.

**7. Presentation rules (`GEMINI.md`):** tables with tight columns, "**lead with the value signal (CPP or deal score)**", one best pick narrated in prose rather than restating every cell; `award-flights.md`: "decision-ready: lead with the best value, not a raw dump"; `hotel-points.md`: **affordability gating** — "note which stays they can actually afford on points today."

**8. Elite-status-into-real-cost rule:** "benefits (late checkout, breakfast, 5th-night-free) and balances belong in the recommendation alongside the raw price" — adjust effective price for program perks.

### Adopt checklist
- [ ] Two-mode product: trip planner ↔ portfolio auditor.
- [ ] `book now / wait / prices typically rise` verdict vocabulary + price-history support.
- [ ] `pending_sources → timed-out vs no-results` async award pattern.
- [ ] Wallet: balances + certs + credits + expiry (value-at-risk ranking).
- [ ] Copy the three anti-hallucination rules into system prompt/test assertions.

---

## 4. genpark-award-skill — CPP verdicts + transfer-bonus math

**Repo:** https://github.com/alphaparkinc/genpark-personal-agent-frequent-flyer-mileage-award-seat-sniper-skill · Python, zero-dependency · **MIT** (functional).

### The exact parts to adopt

**1. CPP verdict function — copy the formula + threshold ladder (core.py):**
```python
net_cash_saved = cash_ticket_price_usd − taxes_and_surcharges_usd
cpp            = round((net_cash_saved / required_points) × 100, 2)   # cents per point
# guards: cpp = 0 if required_points <= 0 or net_cash_saved <= 0
```
Verdict ladder (cabin-differentiated):
| Condition | Verdict |
|---|---|
| cpp ≥ **4.0** | `OUTSTANDING_SWEETSPOT` |
| cpp ≥ **3.5** (business/first) or **1.8** (economy/PE) | `EXCELLENT_VALUE` |
| cpp ≥ **1.3** | `AVERAGE` |
| else | `POOR_USE_CASH` |
→ Merge with §2's per-program baselines: use ladder for cabins, baseline table per program, show both in UI ("Good ≥ 1.5¢ for Aeroplan").

**2. Transfer-bonus discount factor (core.py):**
```python
discount_factor          = 1.0 + (bonus_pct / 100.0)
bank_points_required     = int(needed_airline_miles / discount_factor)   # floor
points_saved_via_bonus   = needed_airline_miles − bank_points_required
```
And the guardrail wording: **"Transfer points only after verifying award space is held or currently live."** (adopt into our guide copy — spec F8).

**3. Known gap we must FIX, not copy:** `available_bank_points` is declared in the tool schema but **never used** — the "best" partner is chosen from a hard-coded 5-row bonus table ignoring what the user actually holds. Our engine must scan user's banks × partners × ratios and choose the *feasible* minimum-cost pair (award-trip-agent §7 shows how). Also: the "award seat polling" claimed in its README is not implemented — it's a scaffold, not working logic. Use it for the math, not the claims.

### Adopt checklist
- [ ] Copy formula + ladder into `savingsEngine/valuation.ts` with tests.
- [ ] Copy bonus-discount math; feed real user balances in (unlike the original).

---

## 5. credit-card-bonuses-api — welcome-offer dataset (seed data)

**Repo:** https://github.com/andenacitelli/credit-card-bonuses-api · static JSON/CSV/YAML via raw.githubusercontent.com · **MIT + Commons Clause** (use the data; do not resell the dataset as a product; keep license notice; daily-synced, no auth, no explicit rate limits → fetch politely, cache ~daily).

### The exact parts to adopt

**Schema (field-for-field match to our spec's model — spec 9.3):**

Card level: `cardId` (32-hex stable PK), `name`, `issuer` (18-enum), `network`, `currency` (43-enum loyalty program: DELTA, AVIOS, HILTON, HYATT, CHASE, …), `isBusiness`, `annualFee`, `isAnnualFeeWaived`, `universalCashbackPercent`, `credits[] {description, value, weight(0–1), currency?}`, `offers[]`, `historicalOffers[]`, `discontinued`, optional `countsTowards524`.

Offer level:
```json
{"spend": 5000, "amount": [{"amount": 90000}], "days": 180,
 "expiration": "2026-07-15",
 "details": "70k after $3k + 20k after additional $2k, both within 180 days.",
 "credits": [{"description": "Statement Credit", "value": 400, "weight": 1}],
 "referralUrl": "https://www.referyourchasecard.com/252u/ASVAYOAFR1"}
```

**This is literally our `WelcomeOffer` already:** `spend → minSpend`, `days → spendWindowDays`, `expiration → deadline`, `amount → bonusPoints`. The **`days` + `expiration` pair is exactly the input the Points Runway needs** for "you must hit $5k by 2026-07-15 to get 90k points."

Also adopt:
- **`Credit.weight` (0–1)** — discounts hard-to-use credits; we adopt weighted valuation for savings math.
- **`historicalOffers[]`** — nudge: "this offer is worse than usual (90k → 70k historically)".
- **`countsTowards524`** (spec guarantees field for rule-exceptions) — gates "can I open this card next".
- Stable `cardId` → store as external-ID (`source: 'cbapi'`) so daily upserts are idempotent.
- `currency` enum = ready-made **`LoyaltyProgram` seed** (spec 9.3).
- CSV is a flattened preview (offerUrl blank in export) — **use the JSON as source of truth**.

### Adopt checklist
- [ ] Daily cron → sync `/data.json` → `LoyaltyProgram` + `WelcomeOffer` tables (idempotent upsert on cardId).
- [ ] Points Runway consumes minSpend/windowDays/deadline directly.

---

## 6. points-transfer-valuations — CPP valuation dataset (seed data)

**Repo:** https://github.com/makenomistakesllc/points-transfer-valuations · JS + JSON · **MIT (code) + CC-BY-4.0 (data, attribute WanderWise Guide, wanderwiseguide.com)** → add a data-source footer line whenever valuations are displayed.

### The exact parts to adopt

**Schema (98 program→partner pairs; 14 Chase UR, 19 Amex MR, 22 Capital One, 18 Citi TY, 25 Bilt):**
```json
"Utimate Rewards" → { "display": "Chase Ultimate Rewards", "verifiedAt": "2026-07-30",
  "partners": { "Hyatt": { "ratio": 0.75, "cppLow": 1.5, "cppHigh": 2.3,
                            "note": "Best-value UR partner. Sapphire Preferred transfers 4:3 (new since Jun 15 2026)…" }, …}}
```
- `ratio` = partner points per 1 source point (1 = 1:1, 0.75 = 4:3, 2 = 1:2); values verified per-program with `verifiedAt` date.
- **Effective-value formula (README):** `partnerPoints = points × ratio; USD = partnerPoints × cpp / 100` — e.g. 100k UR → Hyatt = {partnerPoints: 75,000, USD low 1,125 / high 1,725}.
- `cppLow/cppHigh` as a **conservative range, never a point estimate** — matches our spec 9.5 transparency rule ("show at least X, at most Y").
- `note` = one-line caveat → surface as UI tooltip.

**Adopt notes:**
- It's a **pairs table**, not unique-airline table — model as `TransferValuation(programId, partnerId, ratio, cppLow, cppHigh, note, verifiedAt)`.
- **Join-key mismatch to fix at import:** names here ("Ultimate Rewards", "Air France/KLM", "Virgin Atlantic") vs bonuses-API enums (CHASE, AMERICAN_EXPRESS…) vs miles-wallet names — build one `programAlias → canonicalId` mapping table on ingest.
- Bonus percentages are *not* structured fields (sometimes inside `note` text) — our live bonus feed must come from elsewhere (Roame/Daily Drop-style manual seed for MVP).

### Adopt checklist
- [ ] Ingest 98 rows → `TransferValuation` with CC-BY attribution UI.
- [ ] Alias table to canonical program IDs.

---

## 7. miles-wallet — wallet data model + offline-first PWA shell

**Repo:** https://github.com/davidcjw/miles-wallet · Next.js 16 / React 19 / Tailwind v4 PWA · **MIT**.

### The exact parts to adopt

**1. Minimal proven balance schema (app/types.ts, 14 lines):**
```ts
interface BankAccount   { id, bankName, cardName?, points, expiryDate? }
interface LoyaltyAccount{ id, programmeName, miles, expiryDate? }
```
Key invariant (their AGENTS.md): **conversion rates are lookup data, never stored on the row** — join rates/datasets by name instead of denormalizing. Extend with `monthlySpend` per card (our runway input).

**2. Expiry math, tested verbatim + reusable (app/lib/utils.ts):**
- `getDaysUntilExpiry(date)`; `getExpiryStatus(date) → 'expired' (<0d) / 'urgent' (0–30) / 'warning' (31–180) / 'good' (>180)`.
- Same thresholds color our runway milestones ("points vest before/after trip date") and dashboard badges. Color tokens: expired/urgent = coral, warning = yellow, good = green.

**3. localStorage hook pattern (useWallet.ts):** single JSON blob under `'miles-wallet-data'`; read+parse in `useEffect` with `ready` flag (SSR-safe); write-back effects skip until `ready`. Lift tests (`useWallet.test.ts`) wholesale into our store hook.

**4. PWA shell (public/sw.js — copy-paste quality for our offline "saved trips at the airport" P2 feature):**
- Two caches (`mw-shell-v1`, `mw-runtime-v1`); shell precache with `Promise.allSettled`; navigations network-first; `/_next/static/*` **stale-while-revalidate**; `skipWaiting()` + update banner; registered in production only via a `Pwa.tsx` component; `next.config.ts` serves `/sw.js` `no-cache` + `Service-Worker-Allowed: /`; bump `CACHE_VERSION` on change (invariant documented).

**5. `SelectWithOther.tsx` — the cold-start killer for our seeded pickers:** `<select>` of dataset-seeded suggestions + "Other…" free-text mode; changing the parent resets incompatible child selections. Seed our suggestion lists from the bonuses-API issuer/currency enums.

**6. CSV import/export seam (app/lib/csv.ts, fully tested round-trip):** columns `Type, Institution, Card/Programme, Points/Miles, "<Prog>" Miles Equivalent, Expiry Date, Days Until Expiry`; quote-escaping; import **remints `uid()`s** (fine for them — but if our runway references balances by ID, do NOT adopt the remint behavior). Their parser exists but was never wired to any UI — the wiring gap is ours to fill first. Plus implement their **QR sync** (`'mw1:' + btoa(JSON)`) as our "move wallet between devices / demo machine" trick.

**7. Conversion maths honesty:** `milesFromPoints = Math.floor(points / rate)`, 0 if rate ≤ 0; unknown rate → show raw points + "no transfer rate" note (never pretend conversion exists).

### Adopt checklist
- [ ] Wallet CRUD + ready-gated localStorage hook + expiry utils (with tests).
- [ ] PWA shell + manifest + update banner (production-only registration).
- [ ] `SelectWithOther` for all dataset-driven pickers.
- [ ] CSV round-trip + QR sync for setup/demo portability.

---

## 8. award-trip-agent — transfer rules, balance feasibility, multi-city planning

**Repo:** https://github.com/450571066/award-trip-agent · Python · **MIT**.

### The exact parts to adopt

**1. `reward_rules.json` schema = our transfer-rule seed (135 lines, hand-curated, `last_verified: 2026-07-30`):**
```json
"banks": {
  "amex": { "name": "American Express Membership Rewards",
            "increments": { "B6": 250, "QF": 500 },
            "programmes": { "EI": 1.0, "AM": 1.6, "AC": 1.0, "CX": 0.8, "EK": 0.8, "B6": 0.8, … } },
  "capital_one": { "programmes": { "EK": 0.75, "BR": 0.75, "JL": 0.75, "B6": 0.6, … } },
  "citi": { "note": "Transfer ratios depend on the Citi card…", "programmes": { "AM": null, … } }
},
"stopovers": {
  "AC": { "name": "Aeroplan", "max_days": 45, "summary": "…5,000 pts, >24h, ≤45 days", "source": "https://…" },
  "AS": { "max_days": 14 }, "NH": { "requires_roundtrip": true }
}
```
- `null` ratio = "must confirm before transfer" (edge treated honestly,(ui shows "unknown")).
- **`increments`** → transfers round **up** to the issuer's step (Amex→JetBlue in 250s, →Qantas in 500s). Most tools ignore this — our runway projection must too.
- Every rule has `source` URL; recline flagg: rules **stale after 60 days**.

**2. Exact transfer math (award_trip_agent.py:354–399):**
```python
bank_points = ceil(miles / ratio / increment) * increment
best_flexible_points = min(bank_points)  # across banks holding the program
```

**3. ⭐ The code** — `allocate_bank_balances()` (lines 616–718).
Given trip points requirements per program + user's bank balances, a depth-first branch-and-bound search allocates banks → programs, returning exactly one of:
```
funded | not_checked | manual_split_required | ratio_unconfirmed | insufficient
```
ranked by `FUNDING_STATUS_RANK` — and **fundability outranks price** in sorting: `plan_sort_key = (funding.status_rank, cost, stops, points, len(programs))`. Crucially, an unsupported multi-bank split returns `manual_split_required` instead of falsely claiming "impossible". **Points Runway reuses this with a future-date balance to answer "will I be able to pay?"** Also adopting the merger into a single `estimated_cost_usd = points × point_value_cents/100 + taxes` (default 1.5¢ assumed value, user-tunable).

**4. Privacy boundary (tested, not just promised):** "never send user balances/preferences to the remote provider" (test `test_bank_preferences_are_not_sent_to_flightpoints`); local rules engine keeps the user private and the API dumb.

**5. Honesty patterns (each a named test):**
- `test_transport_failure_is_not_reported_as_empty_availability` — API failure ≠ no seats.
- Stopover suggestions are **advisory only**: "the displayed total still assumes separate tickets" — detection never changes prices.
- Every result ships `source: {live: false, warning: "Cached discovery data. Verify seats on the airline site before transferring points."}` + per-leg `last_seen` + verification `booking_url`.
- Ranking-disclosure sentence appended to every output ("Ranking values points at 1.5¢ each, then includes taxes…").

**6. Multi-city composition:** per-leg search with `delta` date-flexibility → `itertools.product` top options → `is_chronological()` pruning → per-program mile aggregation → balance feasibility. (MCP shape: `plan-award-trip`, `compare-award-routes`; includes 6-route compare with ≥1 plan guaranteed per route.)

### Adopt checklist
- [ ] Seed `TransferPartner` table from `reward_rules.json` (ratios + increments + sources + staleness flag).
- [ ] Port `allocate_bank_balances` concept → our "Points Runway feasibility" with future balances.
- [ ] Adopt 5-state funding vocabulary + fundability-first sorting.
- [ ] Adopt sequencing (F2 full trip), advisory-stopover, and disclosure sentence.

---

## 9. awardtravelfinder-mcp — program catalog + "when seats open" playbook

**Repo:** https://github.com/AwardTravelFinder/mcp · MIT (manifests + skill docs; data/engine is a hosted remote MCP: `https://mcp.awardtravelfinder.com/mcp`, OAuth 2.1; free tier 50 searches/mo — license note: **API-key auth retired 2026-06-07**, leftover `X-API-Key` header 401s permanently).

### The exact parts to adopt

**1. Canonical program catalog:** 23 award-chart programs (`get_program_rates`): british-airways, qatar-airways, singapore-airlines, cathay-pacific, emirates, etihad, flying-blue, aeroplan, turkish-airlines, ana, jetblue, virgin-atlantic, iberia, alaska-airlines, american-airlines, qantas, delta-skymiles, united, lifemiles, marriott-bonvoy, hilton-honors, hyatt (+jet2). Reference tables in `skills/award-travel/references/programs.md` (slug → currency) and `airlines.md` (alliance, hubs, cabins) → seed our `LoyaltyProgram` registry (compatibility with the bonuses-API currency enum: add e.g. `VIRGIN` ↔ "Virgin Atlantic").

**2. ⭐ Booking-window playbook (skills/plan-award-trip/SKILL.md §2) — the closest existing "when should I book" logic:**
> "If the date is more than 300 days away, call `get_award_release_window` for the likely carriers. If seats are not loaded yet, **say when they open and offer a monitor.**"
→ Our trip "in 3 months" = inside window, but the same pattern seats our verdict: state the window ("seats for Apr 2026 open Nov 7; couple to your transfer-bonus deadline → book Nov 7–12").

**3. Transfer-bonus verdict skill (skills/maximize-transfer-bonus/SKILL.md):**
- Rule: **"a bonus is only good if there is a redemption to spend the points on. Never transfer speculatively."**
- Math: `Effective value = target value × (1 + bonus)`.
- Output format: "Verdict: use it now / wait / skip, in one line" + redemption + math before/after + bonus end date.
- Constraint: **"Do not wait for a bonus if seats are scarce."**
→ Adopt verbatim as our runway tie-breaker rules.

**4. Reachability semantics (skills/where-can-my-points-take-me/SKILL.md):**
- "Mark a trip 'reachable' only if **balance + bonus covers the points for all passengers**" — defines "bookable" precisely; our definition too.
- Every cached row shows **its age** — "each row shows its age" as a UI rule (>spec F5 confidence indicator).

**5. Portfolio-audit risk taxonomy (skills/audit-my-portfolio/SKILL.md):**
- Status labels: **Expiring** (≤6 mo), **Idle** (no activity/no upcoming trip using it), **Stranded** (balance below cheapest award). Table: "programme, balance, cents-per-point, value, status" + top-3 actions.
→ Direct template for our Points Runway risk panel + saved-trips dashboard (F9).

**6. Pricing-first two-step workflow (award-travel/SKILL.md:90–101):** `get_pricing` (what route *should* cost per cabin) → THEN `search_availability` (what's actually there) → compare; missing taxes → `estimate_award_fees` and *say taxes are estimates*.

**7. Knowledge seeds for our data layer** (`commands/compare-programs.md`):
- Fuel surcharge heuristics: "BA and Virgin tend high; **Aeroplan, Asia Miles, Flying Blue tend lower or zero on partner metal**".
- Off-peak vs peak note discipline.
- Split-ticket risk vocabulary: "no IRROPS protection, carry-on only".

**8. Product patterns:** pricing skill requires the caller to *tell Premium plan before calling paid tools* (tier disclosure); rich skill-trigger description naming synonyms ("avios", "using miles"…) for AI routing.

### Adopt checklist
- [ ] Seed program registry from programs.md reconciled with bonuses-API enums.
- [ ] Adopt release-window >300-day pattern + "say when they open, offer a monitor".
- [ ] Adopt "never transfer speculatively" + "don't wait if seats are scarce" rules.
- [ ] Adopt expiring/idle/stranded taxonomy for runway risk surface.
- [ ] Adopt age-on-every-row + estimate-only-taxes language.

---

## 10. awardradar — decision contract, trust language, confidence model

**Repo:** https://github.com/FHoffarth/awardradar · Python/Flask · **⚠️ NO LICENSE — intelligence docs say "the intelligence will always remain proprietary". Do not copy code or docs verbatim; adopt the *concepts* (we document them for design; build our own implementation.)**

### The exact (conceptual) parts to adopt

**1. Two-axis decision object — never an imperative:**
- `signal` (value axis): `strong_miles_value / promising_miles_value / mixed_value / cash_may_be_stronger / insufficient_data`
- `verdict` (state axis): `miles_value_supported / miles_value_leaning / comparison_inconclusive / cash_value_supported / availability_only / insufficient_data`; recommend-eligible only for `*_supported/leaning` AND `evaluated_data_source === live`.
- Internal tokens like `book_miles`/`pay_cash` **never reach the UI** — "no externally emitted field contains an imperative product decision".
→ **Points Runway verdict framing: "jury score" answer like "evidence supports using points here" (never "book now!" as a promise).** Fail-closed normalization: unknown → `insufficient_data`.

**2. Identity chain + fail-closed logic:** verdict must bind to a specific `cash_offer_id`/`award_option_id` chain; missing link → `insufficient_data` ("no fallback inference from route, price or provider order"). Content-derived deterministic IDs (`award_<12-hex>` from SHA-256 of canonical fields) for dedupe-safe caching.

**3. Confidence = input-quality score, not vibes:**
```
score = (2 if is_live else 1) + (1 if cash_is_real else 0) − confidence_penalty
high ≥ 3 · medium = 2 · low ≤ 1
confidence_reason = "live award data; recent cash context; official availability not yet confirmed"
```
+ **"a recent timestamp on estimated data still cannot reach a supported verdict"** (freshness never upgrades a verdict).
→ Our spec F5 "confidence indicator" now has a concrete model.

**4. Freshness taxonomy + allowed-language matrix (their best contract, `awardTrustContract.ts`):**
- 10 states: `live_provider_reported / cached_recent (≤4h) / cached_stale / estimated / partial / no_results / rate_limited / provider_error / malformed_payload / unavailable`.
- Each state → fixed freshness label ("Provider-reported · Checked just now" / "Estimate, not confirmed availability" / etc.), allowed verdict tier, and required verify-now text.
- **Never list ("forbidden phrases", test-asserted absent from output):** "Guaranteed availability", "Confirmed seats", "Transfer points now", "No seats available", "Best option", "Exact final taxes and fees"…
- `no_results` ≠ provider failure — never conflate in either direction.
→ Points Runway states: `projected / estimated_balances / stale_balances / no_data` each with allowed copy; add forbidden-phrase assertions to our CI.

**5. Guardrails:**
- **A — trip-alias normalization** before any value math: cash and award must be the same trip type (round-trip × one-way → no CPM shown, "not safely normalizable here").
- **B — thresholds are provisional calibration**: their CPM ladder documented as founder calibration with TODO to calibrate against real data: **≥2.5 exceptional · ≥1.8 great · ≥1.2 good · ≥0.7 fair · <0.7 poor** (formula `calc_cpm = (cash_surcharge_excluded)/miles×100` — same shape as §4).
- Single offer can never be "great": `single_result_cap` (~71 pts, caps below "Good"); lone results → `context: limited_comparison, confidence: low`; include `disqualifying_signals: ["single_result_only", "incomplete_round_trip", "unknown_stops"]`.

**6. Maturity ladder directly naming our data dependency (decision_engine_level_1.md):**
```
L1 static verdicts → L2 provider-aware + freshness/confidence → L3 cross-program → L4 trend-aware → L5 personalized
"book now / wait" is NOT L1 — it needs time-series, repeated checks, alerts.
```
→ **Frame our demo honestly:** we run a Level-2 engine plus 3 seeded "checks" of history → "wait for the Feb 15 transfer bonus + you'll have the points by then" is defensible only because it cites its inputs (balances, bonuses, release windows). No invented trends.

**7. Zone-based award-chart seed (in-code, 2024 estimates — retype these numbers with our own citation):**
`MM_CHART`/`AEROPLAN_CHART`/`UNITED_CHART` = dict[(origin_zone, dest_zone)][cabin] → miles (8 zones incl. europe/north_america/asia…); `SURCHARGES_EUR` per program/zone (MM NA=280, Aeroplan=55, United=20); `TYPICAL_CASH_EUR` per zone×cabin. Every row labeled `is_estimate=true, last_seen_at=null, freshness="estimate", confidence="low"`. **This + the seats.aero cached API = our award-pricing fallback layer (spec 17 risk mitigation).**

**8. Provider-feasibility gate list (our procurement checklist):** gates per provider (GO/NO-GO/LATER) around authorization, commercial use, **redistribution (what can we display?)**, caching rules, rate limits, cost, freshness semantics (`last_seen_at`?), seat-count current-vs-historical. Plus reuses: "Estimates must never be presented as live availability"; cost guards (`SAFETY_FLOOR` on `/authorization/Remaining` header, per-user paid-call caps, fingerprinted call logging); **fixture-contract testing**: decision logic tested in CI without one paid call (provider boundaries panic-mocked if touched; fixtures declare `source_provenance="synthetic_test_fixture"`).

### Adopt checklist
- [ ] Two-axis decision object + fail-closed `insufficient_data` (own implementation).
- [ ] Confidence input-scoring + freshness-never-upgrades rule.
- [ ] Data-state → fixed language matrix + forbidden-phrase tests.
- [ ] Trip-basis normalization before CPP math.
- [ ] Level-ladder honesty for demo claims.
- [ ] Award-chart zone seed (retyped + cited) as fallback layer.

---

## 11. Consolidated build impact on the A Una Milla spec

### New/changed spec mappings
| Our entity (spec 9.3) | Seed/adapted from | Notes |
|---|---|---|
| `LoyaltyProgram` | bonuses-API `currency` enum + programs.md catalog + valuations partner names | one alias table at ingest |
| `WalletBalance` | miles-wallet `BankAccount`/`LoyaltyAccount` + `monthlySpend` extension | rates looked up, never stored |
| `WelcomeOffer` (new) | bonuses-API `offers[] {spend, days, expiration, amount}` | daily sync, idempotent on cardId |
| `TransferPartner` | award-trip-agent `reward_rules.json` (ratios + increments) + valuations (ratio/cppLow/cppHigh) | merge on canonical ids |
| `Alert` | rooms.aero alert shape (date_type/mode/max_points/channel) | F10 |
| `PointsForecast` (F12, new) | award-trip-agent funding feasibility + Gondola predict_price verdict shape | run over future balance timeline |

### The Points Runway verdict formula (assembled from dissected parts)
```
1. pointsNeeded(program choice)  = Σ award price (cached seats.aero search / zone-chart estimate, labeled)
2. effectiveNeeded(bank, bonus)  = ceil(pointsNeeded / (1+bonus_pct/100) / increment) × increment   [§4, §8]
3. balanceByDate(t)              = Σ balances + monthlySpend × earnRate × months(t) + welcomeOfferIfHit(t)   [§5]
4. feasibility(t)                = allocate_balances(balanceByDate(t)) → funded | split | insufficient      [§8]
5. candidate scoring             = cpp-after-taxes verdict (per-program baseline + cabin ladder)            [§2, §4]
6. timing constraints            = transfer-bonus expiry + welcome-offer deadline + >300-day release window
                                   + "don't wait if seats are scarce" + spec's "transfer only after live seat"  [§9]
7. output                        = signal + decision-state + confidence(input-quality) + ONE milestone
                                   ("Book window: Nov 7–Nov 15") + evidence rows each showing its age      [§3, §10]
```

### Legal note (important)
- **GPL-3** (`seats-MCP`): treat as spec/doc only, no GPL code compile into our repo.
- **MIT** repos: copy + attribution ok (gf-seats-aero, gondola interfaces, genpark, award-trip-agent, miles-wallet).
- **MIT + Commons Clause** (bonuses API): consume data fine; cannot resell dataset.
- **CC-BY-4.0** (valuations data): display with "Source: WanderWise Guide, wanderwiseguide.com".
- **awardradar**: no license — concepts only, never copy code/doc text.

### Sourced-attribution lines to ship in-app (data-provider footer)
```
Award availability: Seats.aero Partner API (cached observations — verify on the airline before transferring).
Welcome offers: credit-card-bonuses-api (andenacitelli), MIT + Commons Clause, synced daily.
Transfer valuations: WanderWise Guide Points Value Index, CC-BY 4.0.
Program rules: A Una Milla curated data, last verified dates shown per rule.
```

### Reference dump of repo paths
```
research/repos/seats-MCP                  # GPL-3 — API behavior spec
research/repos/gf-seats-aero-extension    # MIT — GF protobuf encoder, price extraction, CPP formula
research/repos/gondola-mcp                # MIT — verdict/affordance/prompt patterns (engine closed)
research/repos/genpark-award-skill        # MIT — CPP formula + bonus math (has known gaps)
research/repos/credit-card-bonuses-api    # MIT+CC — WelcomeOffer seed data
research/repos/points-transfer-valuations # MIT+CC-BY-4.0 — TransferValuation seed data
research/repos/miles-wallet               # MIT — wallet schema + PWA shell
research/repos/award-trip-agent           # MIT — transfer rules + balance feasibility engine
research/repos/awardtravelfinder-mcp      # MIT — program catalog + booking-window playbook
research/repos/awardradar                 # NO LICENSE — design concepts only
```
