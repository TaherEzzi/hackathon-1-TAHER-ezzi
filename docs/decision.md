# Decisions — A Una Milla

Settled choices, and the open ones that block a slice. When a row changes, edit it here and leave the old line under it so the reason stays.

Sources: `docs/SUMMARY.md`, Plan.pdf, the post-consulting guide, slides 25–28, `A_Una_Milla_Project_Specification.md`.

---

## Settled

### D1. The product is a conversation that renders cards

**Choice.** The traveller talks. The answer is generative UI in the thread: price, points, how to earn, saving, and a save action. A classic search form can exist as a shortcut. It is not the product.

**Why.** Plan.pdf asks for an interface that goes from 0 to 100 in conversation, with generative UI. The spec’s savings hero still applies: the number on the card is the loudest element.

**Rejected shape.** A multi-step wizard with the chat bolted on as help text. That hides the saving and breaks “one thread until the flight is booked”.

### D2. Two intents, one agent

**Choice.** Plan mode (a season or a 90-day runway) and book-now mode (a date and a verdict). The same thread can switch. The same rules engine serves both.

**Why.** Plan.pdf asks for both, and names an agent that works with Avios for Spain. The guide’s own case is a 90-day plan that ends in a specific redemption.

### D3. Spain and Avios are the depth

**Choice.** First pack of programs: British Airways as the bridge, Iberia, Vueling, Aer Lingus, Finnair, Qatar Airways, plus Revolut RevPoints and Amex Business Platinum as earn sources. Other alliances wait.

**Why.** That is the guide’s map, including the warning that not every program transfers directly. A forty-program directory would miss the demo.

### D4. Five rules are invariants

Every recommendation must pass all five. They are tests, not copy.

1. Earn on spend the traveller already makes.
2. No interest and no debt to acquire points.
3. Use award search rather than airline-by-airline clicking.
4. Compare miles + taxes with the cash price before calling it a saving.
5. Transfer only when the seat and the redemption are clear.

A feature that needs to break one of these is out of scope.

### D5. Buying points is a close-the-gap action

**Choice.** The agent may describe buying RevPoints only when a seat is attached and the amount is the shortfall. Shopping multipliers are shown only with a “confirm it is live” label. Hotels and similar offers are accelerators on the runway card, not a second product.

**Why.** Guide section 3.3 and Plan.pdf’s hotel line. Buying “just in case” is the failure mode the guide names.

### D6. Guided booking is the default path

**Choice.** v1 ends in numbered steps and official links (Combine My Avios, the airline award page). The app does not collect card numbers. Affiliate links are allowed when the commission is disclosed in one sentence. A markup on a fare exists only after a partner confirms it is permitted, recorded as a change to D11.

**Why.** Plan.pdf leaves markup versus affiliate open. The spec already accepts guided booking as the reliable path. Shipping a fake checkout would fail the demo and the security bar.

### D7. Stack

**Choice.** TypeScript, React, Next.js, PostgreSQL via Supabase, managed auth (Supabase Auth or Auth.js), Zod on inputs, Vitest for rules, Playwright for the two intents. Streaming for the assistant reply. Cache award responses in the database or an in-process LRU before adding Redis.

**Why.** Slide 25’s table: TypeScript for the product, Postgres for the data. One language keeps a one-person build inside the week. Python stays available for a one-off data script and is not the app.

**Trade-off.** A Python FastAPI service would match the AI-and-data row on the slide. It adds a second deploy. The rules engine is pure functions and can move later if a job needs it.

### D8. Quality bar

**Choice.** Red → green → refactor. One bug in the MAD–JNB thread blocks new features. Definition of done is slide 30: tests, edge cases, mobile and desktop, no regressions, checked on the deployed URL.

**Why.** Slide 29. The jury’s first criterion in the spec is a complete path.

### D9. Brand

**Choice.** Keep the spec’s palette: espresso `#241B12`, cream `#F6F1E9`, terracotta accent, geometric sans. Real Spanish copy. Savings in euros is the largest type on a positive verdict. When cash wins, the cash price takes that role.

**Why.** Slides 15 and 21, and the spec’s design section. The deck and the brand site already share this palette.

### D10. Demo case

**Choice.** Madrid → Johannesburg, Business, 90-day horizon, Iberia / British Airways / Qatar, Revolut + Amex Business Platinum.

**Why.** It is the cover of the guide. If the agent cannot walk this case, it does not match the consulting product.

### D11. Request budget is a product limit

**Choice.** Every traveller has a daily cap. Cache hits do not count. The cap is an admin setting. The UI states the reset. A capped user can still open saved trips and run earn maths on numbers they type.

**Why.** Plan.pdf asks how many requests a user may make. Seats.aero’s partner tier, from the research notes, is on the order of 1,000 requests a day per key. The cap protects that key.

### D12. Honest numbers

**Choice.** Estimated figures are labelled. Missing taxes suppress the saving percentage. Stale provider data shows the time it was fetched. Revolut rates that are not re-checked live are labelled as the guide’s figures (September 2026) and linked to Revolut.

**Why.** The spec’s risk table: a trustworthy number beats an impressive wrong one. Guide rule 4 depends on taxes.

### D19. Point value is per selected card, never estimated

**Choice.** The cents-per-point used anywhere in the app comes from the dataset row for the *selected card’s* loyalty currency → target program pair (the 98-pair transfer-valuations dataset, shown as `cppLow..cppHigh`). If no card is selected, no value and no verdict is shown. A universal 1.5¢ estimate is removed from the demo path; expert mode may expose it labeled `estimación`.

**Why.** Point value differs per card and per program pair; it is a huge driving force of every verdict. An estimate here would silently bend the whole product.

### D20. Cost breakdown shows taxes + fees + plan cost, from official sources

**Choice.** An award card always shows a breakdown, never one merged number: taxes, fees, the monthly plan cost of the selected earn method, and the points value. Plan figures come from Revolut’s official pricing page (checked 2026-10-26 against revolut.com/es-ES/our-pricing-plans): Premium 9,99 €/mes, Metal 15,99 €/mes, Ultra 55 €/mes — Ultra carries an “oferta de lanzamiento” label. The plan cost enters the net-savings math the same way taxes do.

**Why.** The user asked for exact official fees inside the cost, shown in the breakdown. The guide’s September 2026 figures happen to match the live site, but the label and link (D12) follow the live source, not the guide.

### D21. Booking window is ranked by best total money value, not by a fixed priority ladder

**Choice.** The engine ranks candidate months by `valueScore(t) = expectedCashPrice(trend(t)) − allInCost(t)`, where trend(t) = historic price trend + festive/seasonal demand + live offers (labeled source), and allInCost uses the selected card’s real point value (D19). It reads the traveller’s funding timeline: if France in 8 months prices lowest at month 4–5 and points fund by then, recommend month 4–5; if not, and waiting until month 7 closes the points gap with greater net savings, recommend month 7 — both cards shown. The only rule that outranks value is a hard veto: no seat at all, or the date is beyond the award release window.

**Why.** The user set this explicitly: best value in money, driven by trends, seasons, offers, and when the rewards arrive — not a fixed “wait-for-bonus first” ladder.

### D22. v1 builds without the request-budget enforcement

**Choice.** D11 stays decided as product behavior, but enforcement is not implemented in v1: no cap UI, no unit consumption, while the build phase is underway. It ships after the core path is complete (F9 + the admin setting switch on together).

**Why.** The user deferred it: “do not add a budget now, will add after complete development”. Cache + the 7-candidate-date rule already protect the provider quota during the demo.

### D23. ~~Amadeus for price discovery in v1~~ → superseded, see D25

**Choice (voided).** The cash-price and date-flex adapter targets Amadeus Self-Service (free tier) in v1. Duffel — a booking/issuance API, not a search API — is recorded as the first candidate if Path A "book inside the app" is ever opened, per D6. Guided booking remains the default of v1. D13–D15 stay open either way.

**Why.** Duffel and Amadeus answer different questions. We needed price discovery now; the user asked which is better — recommending Amadeus for that slice keeps Duffel's economics from blocking the engine.

**Change 2026-10-26 (user).** Amadeus Self-Service was decommissioned on 17 July 2026 — the sign-up-and-build portal and every self-service key are gone; what remains is enterprise-only. The old line is kept for the reason. Price discovery and the MVP booking requirement both move to Duffel (D25). See also the research note: nothing we had built depended on Amadeus yet. The cloned Amadeus references in earlier research docs are historical only.

### D29. No paid keys anywhere in the demo stack (user, 2026-10-26)

**Choice.** The product runs exclusively on free tiers and free utilities. The award-availability layer is the **labelled fixture** (`app_settings.primary_provider = 'fixture'`), seeded with the guide's case numbers and refreshed by hand from seats.aero's free no-registration website tier (≤60-day window) when numbers go stale. seats.aero's Pro/Partner API (~AU$12.99/mo) and its commercial written-permission process are both **out of scope** for v1. Duffel stays in free test mode end to end (D25); production search pricing is never crossed in the demo.

**Free stack (complete, zero paid components):** Duffel test mode (cash pricing + real bookings) · Google Flights MIT utilities for any-date cash fares and pre-filled deep links · fixture award data labelled `estimación` · points-transfer-valuations dataset (CC-BY-4.0, keyless) · credit-card-bonuses-api (free raw JSON) · guide-fixed Revolut rates (D20) · frankfurter.dev FX · the Grok free key already in `.env` · Supabase Free + Vercel Hobby.

**Why.** The user set the constraint: no paid keys in this build. The spec already anticipated it ("no simple free universal API exists; consider curated/seeded data, estimates"), and D12 turns the limitation into a product feature: availability figures arrive **badged** (`estimación`), never as fake live data. This closes D13 and D14.

### D30. Free-tier refresh flow (manual, part of the demo ritual)

**Choice.** The operator keeps the fixture honest with a two-minute routine: run the MAD→JNB Business check on the free seats.aero website (no account needed, ≤60-day window) or the airline award calendars, and update the fixture rows when the cash-side or miles numbers move. The UI keeps the fixture labelled `estimación` with its `verified_at` age — the honesty badges make staleness visible instead of hidden.

**Why.** The demo story must never drift from real data. Manual refresh inside the free tier keeps the numbers defensible without paying, and the badge system (D12/D26) is what makes the whole thing jury-legible.

### D24. Path-A booking partner resolved: Duffel

**Choice.** The spec's F8 "Path A: book inside the app" is served by Duffel for cash fares. The full requirement, flow order, and boundaries live in D25; this entry only closes the old open question of which in-app booking partner to use.

### D25. MVP must issue a real booking — Duffel is the booking + pricing engine

**Choice.** Booking real tickets is now a v1 requirement (user). The MVP runs on **Duffel**:
- **Search & price:** Duffel Flights API — offer requests for candidate dates, live cash fares + taxes, 300+ airlines (NDC, GDS, LCC) through one integration.
- **Book:** offer → order creation → payment → booking record (`duffel Airways` sandbox airline in test mode; **production issuance is out of scope for v1 — D31**).
- **Economics:** free test mode (`duffel_test_` tokens); production pricing is 1,500 free searches per confirmed order, then $0.005/search — search is effectively free as long as the agent converts searches into orders.
- **Boundary:** Duffel books **cash fares**. Award (Avios/points) seats stay on the guided path (F8/F6) — points redemptions cannot be issued through Duffel. So "book in-app" = cash-fare bookings real; award booking = guided as before.
- **Fallbacks:** Google Flights deep links + fare-blob regex for coverage Duffel lacks; the award-availability layer is the **labelled fixture** (D29/D30) — seats.aero's API is skipped under the no-paid-keys rule, and its free website tier is the manual refresh source.
- **Order of the flow (production-grade pattern):** search → **offer → price verification → booking** — never search → pay → book, because offers move. D12 honesty rules apply to the offer window.

**Why.** The user set "the MVP should be able to book tickets" as a requirement and asked which vendor is best. With Amadeus self-service gone, Duffel is the strongest candidate by every measure that matters for one builder in a week: single integration covering search-to-ticket, a reliable sandbox airline for the demo, free test mode, and honest per-use production pricing. Precedent includes Duffel powering Meta's Muse agent (Sept 2026) for end-to-end travel booking.

### D31. Checkout and tickets are demo-grade by design (user, 2026-10-26)

**Choice.** The traveller never completes a real payment and never receives a real ticket in v1. The cash path's checkout is **Duffel test mode end to end**: simulated sandbox payment, sandbox airline (`Duffel Airways`), dummy booking reference — "dummy by construction, real by integration." The award path **issues nothing** (points redemptions cannot be issued programmatically by anyone, including Duffel) and stays the guided checklist (F6/F8); an optional *ticket preview* visual is allowed only if it is explicitly labelled a demo/`vista previa`. No hand-built fake checkout exists anywhere in the app (D6 stands). Stripe stays subscription-only (P11/F11) — it is not on the booking path.

**Why.** The user's constraint: points booking is impossible via Duffel, so the demo must not imply real issuance anywhere. Duffel's test mode already delivers the dummy checkout and dummy ticket the user asked for, while keeping the jury-visible pipeline real (completeness criterion). A drawn-by-hand fake checkout would fail D6.

### D26. Reward impact is shown as a range, never a bare value, on every hard path

**Choice.** Every projected figure (balance-by-date, points shortfall, savings) is rendered to the traveller as a **low–high range from the ±10% band** — e.g. "74.100 – 81.900 puntos · proyección" — not a single number. On hard paths the range widens honestly and the cause is shown: multi-card funding splits, multi-program legs, a welcome offer pending its spend deadline, **a balance expiring before the target date**, or a live transfer bonus that may expire. Simple single-card cases may show the band label with the narrower range; the number alone is never the published value.

**Why.** The user asked for an approximation for the hard path and a range for the user, not a false-precision point value. This is D12 made visual: the range is the honest answer; the badge explains its width.

---

## Open — do not invent these

| ID | Question | What we will do while it is open | Who closes it |
|---|---|---|---|
| D13 | ~~Award-availability partner economics~~ **Closed by D29** (no paid keys; award layer = labelled fixture, refreshed from the free seats.aero website tier per D30) | Fixtures stay labelled `estimación` with `verified_at` age. The provider interface keeps the seats.aero card for a future written-permission path | Closed 2026-10-26 (user) |
| D14 | ~~Cheaper partner with the same **award** fields~~ **Moot under D29** — there is no paid partner to compare against | N/A; revisit only if the no-paid-keys rule changes | Closed 2026-10-26 (user) |
| D15 | Booking economics: affiliate percent, markup, or links only | Ship D6. Duffel production pricing is settled (D25); markup/affiliate on top is still open. Add affiliate only with a named program and a disclosure line | Eriz |
| D16 | How many months ahead each provider actually returns | Measure on MAD–JNB and one short-haul Avios route. Store the number. The UI must not offer dates past it | Build, then Eriz confirms the copy |
| D17 | Monthly Stripe price and what each tier includes | Free tier with a tight cap for the demo. Paid tier after D13 and D14, via Stripe Checkout. No price invented in the UI | Eriz |
| D18 | Which model serves the chat, and the token budget per thread | Grok key present in `.env` (OpenAI-compatible); short structured outputs for cards. Prose only for the one-line why. Record cost per demo thread | Build |
| D27 | Historic price-trend source for `valueScore(t)` (D21): no live historic-fare provider exists in the stack | Demo runs on a labelled seasonal-curve fixture (`estimación`, never `en vivo`). No invented trend publishes as live | Build ships the fixture; Eriz confirms the curve |
| D28 | Amex Business Platinum (ES) earn rates for the G7 demo case — the guide encodes Revolut fully but never Amex | Revolut maths proceed (F4, D20). Amex earn input is typed by the traveller until Eriz confirms the official rates | Eriz |
| D32 | Revolut earn-rate caps: the guide says to check "the fee, **the cap**, and the conditions", but the F4/D20 table records only rates — no monthly cap is known | Earn projections stay ranges (`proyección`, D26) and never promise a monthly number. If Eriz confirms a cap, it becomes an input to `balanceBy(t)` and a new test | Eriz |
---

## Provider stance (D13/D14 closed by D29: no paid keys)

Live paid award feeds are out of scope. The live side of the stack is **Duffel (cash offers, test mode)** plus the free Google Flights utilities; the award side is the **labelled fixture** (D29/D30). The adapter contract below survives unchanged — the fixture sits behind the same internal shape, so a written-permission seats.aero card can slot in later without a rewrite.

Use an adapter with one internal result shape. Cash and taxes are separate money values. They are not subtracted until both currencies are known and equal.

- route, date, cabin, program
- mileage: integer, greater than 0, or the result is `InsufficientData`
- cash: amount + ISO currency, or absent
- taxes: amount + ISO currency, or absent
- seats remaining if present, deep link, fetched-at, source name

The adapter returns a typed result: `Quote` or `ProviderError { provider, route, date, cause }`. A transport failure is logged with those fields and returned as `ProviderError`. It is not swallowed, and it is not turned into a zero price.

Two adapters may exist behind it. The UI talks only to the internal shape. The research notes already describe a Seats.aero-shaped payload and an Award Travel Finder skill layer. Copy behaviour and field names. Do not copy GPL code from `seats-MCP` into the app. MIT pieces (CPP after taxes, Google Flights link builder) may be ported with attribution when that slice starts.

**CPP**, from the research notes, as a pure function:

```text
inputs: cash, taxes, miles
if miles is missing or miles <= 0 → InsufficientData
if cash or taxes is missing → InsufficientData
if cash.currency ≠ taxes.currency → InsufficientData
adjusted = max(cash.amount − taxes.amount, 0)
cents per point = adjusted × 100 / miles
```

`InsufficientData` has no percentage and no “usar puntos” verdict. “Usar puntos” also requires a seat and a cents-per-point at or above the program baseline. Otherwise the verdict is “pagar en efectivo”.

A search evaluates at most 7 candidate dates. The **live calls are cash-side only (Duffel offer requests, test mode)** — the single live re-verification happens for the date the traveller selects (F12 step 7). Award figures come from the fixture and stay badged `estimación` (D29). Identical in-flight calls share one promise. The dashboard reads the day's counts with an aggregate query, not by loading every search row.

---

## Data we store

| Record | Fields that matter | We do not store |
|---|---|---|
| User | id, email, locale | Passport number, card PAN |
| Wallet | program, balance, account age in days if the user states it | Passwords for airlines |
| Itinerary | route, dates, cabin, cash, miles, taxes, verdict, explanation | Raw provider payloads beyond a short JSON cache |
| Transfer plan | from, to, amount, checks passed | A claim that we moved the Avios ourselves |
| Usage | user, day, provider calls | Prompt logs with personal data |
| Subscription | Stripe customer id, price id, status | Card data (Stripe holds it) |

---

## Admin settings that exist because of open decisions

These are editable without a deploy, so D13–D17 can close without a rewrite:

- primary provider id
- daily request cap
- max horizon in days
- show-buy-points flag
- show-hotel-accelerators flag
- Stripe price id
- affiliate disclosure string

---

## Decision log

| When | Change |
|---|---|
| 2026-10-26 | Initial set from the guide, Plan.pdf, slides 11–44, the spec, and the research notes. D13–D18 left open on purpose. |
| 2026-10-26 | D19 settled from user review: per-card point values (no global estimate). D20: official Revolut fees verified live and folded into the breakdown. D21: booking window ranked by total money value (user's France/8-months rule), replacing the fixed wait-ladder. D22: budget enforcement deferred past v1 by the user. D23: Amadeus in v1, Duffel parked as Path-A option (open decision D24). LLM: Grok free API key added in `.env` for D18 — model-specific copy still open. |
| 2026-10-26 | Amadeus Self-Service found decommissioned (17 July 2026) → D23 voided. D25 settled by user requirement: MVP issues real bookings via Duffel (search + book + pay in one integration; award seats stay guided). D24 (Path-A partner) resolved. D26: projections render as low–high ranges, widened on hard paths. Verdict tables (CPP ladder) kept as-is per user. |
| 2026-10-26 | Duffel test token provisioned (`duffel_test_`, stored in `.env` as `duffel_api_key`, repaired after a corrupt paste — value never exposed). Smoke test passed from this machine: test-mode offer request MAD→CDG on 2027-01-26 returned 143 offers incl. Duffel Airways sandbox and real airlines (American, British Airways). Reference: `scripts/duffel-smoke.mjs`, starter kit cloned at `research/repos/duffel-starter-kit`. |
| 2026-10-26 | Doc audit: D24 recorded as Settled (closes the Path-A partner question, points to D25). D13/D14 narrowed to the award-availability partner question only — cash pricing and booking are D25/Duffel territory. D27 (trend-data source fixture) and D28 (Amex ES earn rates) opened. Feature priority tiers (MUST / P2 / SKIP / additions) published in `docs/OVERVIEW.md`. Also noted: the directory is not yet a git repo and no seats.aero key exists — both recorded in the action plan. |
| 2026-10-26 | **D29 settled (user): no paid keys anywhere in the demo stack.** Award layer = labelled fixture (D30 defines the free manual refresh ritual from seats.aero's free website tier); Duffel stays test-mode; free utilities (GF MIT regex/deep links, CC-BY-4.0 dataset, frankfurter FX, free Supabase/Vercel/Grok tiers) complete the zero-paid stack. D13 and D14 closed. seats.aero Pro/commercial permission remains a future option only if the rule changes. `app_settings.primary_provider` stays `fixture`. |
| 2026-10-26 | **D31 settled (user): checkout and tickets are demo-grade by design.** Duffel test mode end to end = simulated sandbox payment + sandbox airline + dummy reference (no real money, traveller never types a card in our UI). Award path issues nothing (points cannot be issued programmatically) — guided checklist only, optional labelled `vista previa` ticket visual. No hand-built fake checkout (D6). Stripe stays subscription-only, off the booking path. F8 updated to match; D25 production issuance moved out of v1 scope. |
| 2026-10-26 | **Token↔fare loopholes fixed.** `balanceBy(t)` now subtracts balances expiring before the target date (§1.6 wired in); feasibility is explicitly **per-program** — balances never summed across programs, only the target program or a guide-stated F6 edge funds the seat; pax > 1 multiplies the points need and keeps the `estimación` badge (fixture is one-seat data). Balance-expiry added to D26's range-widening causes. **D32 opened:** Revolut earn caps unknown (the guide says check "the cap"); earn projections stay ranges until confirmed. Plain-language explainer of the fare↔tokens flow added to `docs/OVERVIEW.md` §8. |
| 2026-10-26 | **Supabase project provisioned and schema live.** User created project `culmpmgyplcuromnewrt` (EU) and a full-scope access token (Option B). CLI v2.122.0: `init` → `link` → three migrations applied via `db push` (token-based DB access — no DB password needed): `core_schema` (12 tables: profiles, programs, wallet_balances, transfer_partners, pair_valuations, revolut_plans, itineraries, transfer_plans, usage, audit_log, subscriptions, app_settings; RLS on all; no auth.role(); UPDATE policies carry WITH CHECK; authorization via app_metadata claim `aum_admin`; profile row auto-created on signup via the standard definer trigger), `seed_reference_data` (8-program Avios/RevPoints pack per D3, the 9 guide-stated BA-bridge edges at ratio 1.0 with `verified_at = null` → UI says "confírmalo", official Revolut rates per D20 with source+date, app_settings row: provider=fixture, cap=none per D22, horizon=unmeasured per P8, T1 test persona as JSON, CC-BY-4.0 attribution string), `fix_advisor_findings` (revoked the definer-trigger RPC path; merged dual permissive SELECT policies per the security/performance advisors). Advisors now report **zero security and zero performance findings**. Data-API exposure verified with the publishable key: reference data readable anon, `itineraries`/`wallet_balances` return `[]` for anon (RLS holds, not a 401). TypeScript types generated to `lib/database.types.ts`. `pair_valuations` is deliberately empty — the 98-pair dataset loads from its official URL in the build slice; nothing invented (D19/D12). Migration history synced local = remote. |
