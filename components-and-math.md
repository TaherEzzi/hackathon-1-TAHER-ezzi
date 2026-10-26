# Components & Math We Do NOT Need to Invent

> Everything below is proven working code / data / formulas borrowed from the dissected repos in
> `research/repos/` (full analysis: `research/Reverse-Engineering-Notes.md`).
> We assemble these; we only **invent the "when to book" verdict engine** — which nobody has built.

---

## 1. What we get for free (the "we do not invent this because the math already exists" section)

### 1.1 The universal formula of every award valuation
```ts
netCashSaved = cashPrice - awardTaxes
cpp          = (netCashSaved * 100) / awardPoints          // cents per point
// guards: if awardPoints <= 0 or netCashSaved <= 0 -> cpp = 0
```
Source: genpark-award-skill `core.py` + gf-seats-aero-extension `seats-content.js` (both MIT). Taxes come from seats.aero `Trip.TotalTaxes` + `TaxesCurrency`.

### 1.2 The "good deal" verdict ladder (copy verbatim, tested pattern)
| cpp | Verdict |
|---|---|
| ≥ 4.0¢ | OUTSTANDING_SWEETSPOT |
| ≥ 3.5¢ (business/first), ≥ 1.8¢ (economy) | EXCELLENT_VALUE |
| ≥ 1.3¢ | AVERAGE |
| else | POOR_USE_CASH |

Per-program baseline (seats-content.js `PROGRAM_BASELINES`): Aeroplan ≥1.5¢ good, AAdvantage ≥1.6¢, SkyMiles ≥1.2¢, etc.

### 1.3 Transfer-bonus math
```ts
discountFactor        = 1.0 + bonusPct / 100
bankPointsNeeded      = ceil(airlineMilesNeeded / discountFactor)
pointsSavedViaBonus   = airlineMilesNeeded - bankPointsNeeded
```
Source: genpark `core.py` (MIT). Rule to display: *"Transfer only after the seat is live on the airline site. Transfers cannot be reversed."*

### 1.4 Transfer rounding (issuer increments — most tools get this wrong)
```ts
bankPoints = ceil(miles / transferRatio / step) * step   // Amex→JetBlue steps of 250, →Qantas of 500
```
Source: award-trip-agent `reward_rules.json` + `transfer_options()` (MIT). `null` ratio → show "must confirm", never guess.

### 1.5 Points→wallet value

**Rule (settled → D19): the point value is never a global estimate. It is looked up per selected card.**
Once the traveller selects the card that funds the trip, the engine joins that card's loyalty
currency to the transfer-valuations dataset (98 pairs, CC-BY-4.0) and uses that pair's
`ratio` + `cppLow..cppHigh` in every downstream formula. No card selected → no value, no verdict.
An estimated universal 1.5¢ input is **removed** from the demo path (expert mode may expose it,
clearly labeled `estimación`, never silently).

```ts
partnerPoints = points * transferRatio                 // ratio is the card → program pair's ratio
usdValue      = partnerPoints * cpp / 100              // show as range: cppLow..cppHigh
```
Source: points-transfer-valuations README (CC-BY-4.0, attribute WanderWise Guide).

### 1.6 Expiry / deadline math (tested in miles-wallet, MIT)
```ts
daysUntil   = dateDiff(today, expiryDate)                  // whole days
status      = expired (<0) | urgent (0..30) | warning (31..180) | good (>180)
```
Same thresholds color our runway milestones and dashboard badges.

### 1.7 Confidence score (awardradar pattern, reimplemented)
```ts
score = (isLive ? 2 : 1) + (hasRealCashPrice ? 1 : 0) - confidencePenalty
// high ≥3, medium = 2, low ≤1; freshness never upgrades an estimate to a verdict
```

### 1.8 Welcome-offer runway input (credit-card-bonuses-api, MIT+CC — free daily data)
```json
{"spend": 5000, "amount": 90000, "days": 180, "expiration": "2026-07-15"}
```
= `minSpend / spendWindowDays / deadline / bonusPoints` → exactly the inputs the forecast needs.

---

## 2. The Points Runway forecast (the ONE thing we invent)

```ts
// t = candidate booking date (ranking rule settled → D21)
balanceBy(t) = sum(balancesToday − balancesExpiringBefore(t))        // §1.6 expiry thresholds; a runway never
             + monthlySpend * earnRate(selectedCard) * monthsUntil(t)  //   counts tokens that die first (fix 2026-10-26)
             + welcomeOfferBonus(where minSpend is hit by deadline)
feasible(t)  = allocate(balanceBy(t), pointsNeededPerProgram)        // award-trip-agent 5-state funding check.
             // PER-PROGRAM ONLY: balances are never summed across programs — only tokens held in the
             // target program, or reachable through a guide-stated transfer edge (F6), fund the seat.
             // pax: pointsNeededPerProgram is per seat; pax > 1 multiplies the need, and the badge
             // stays `estimación` (the fixture is one-seat data; multi-seat availability is unverified).

// Rank CANDIDATE MONTHS by best TOTAL money value, not by the earliest or cheapest facts alone:
valueScore(t) = expectedCashPrice(trendFor(t)) − allInCost(t, pointsValue(selectedCard→program))
//   trendFor(t)   = historic price trend + festive/seasonal demand curve + live offers (labeled data, own citation)
//   allInCost(t)  = cashFare OR (taxes + fees + planCost(selectedCard) + pointsValueAtPairCPP)
verdict      = the month with max valueScore among feasible months;
               if a cheaper month exists but points fund LATER, still recommend it when
               net savings grow (user's rule: "cheapest in month 4–5 if funded; wait to month 7
               if closes the gap and saves more") — show both cards, defer en la card.
veto(t)      = no seat at all / award released not yet (>300 days → "seats open <date>")  → excluded,
               the only case that outranks value
```
Output = milestone sentence + full cost breakdown (insides shown, never a single mixed number):
> **"Reserva a partir del 15 de febrero."** Breakdown card: cash €690 → 45.000 pts = {taxes €52 + fees €0 + coste plan €15,99/mes + valor 45.000 pts × CPP del par (carta→programa) €..} ≈ **€412 saved (55%)**. Balance projection shown as a range per D26: **74.100 – 81.900 puntos · `proyección`**, Amex→Avios bonus (+40%) ends Feb 28, welcome-offer spend deadline Jan 10.

Honesty rules (from awardradar + awardtravelfinder, concepts only): every number labeled `projected`/`estimate`/`live`, each evidence row shows its age, verdict never sounds like a promise, forbidden phrases: "guaranteed", "confirmed", "transfer now".

**Range rule (settled → D26): no projected figure is ever published as a bare number.**
The ±10% band is the user-facing value, low–high, with badge and cause:
- Simple case (single card, single program, no pending bonuses): narrow band → "74.100 – 81.900 puntos · `proyección`".
- **Hard paths widen the band and its cause is shown**: funding split across several cards, multi-program legs (best-to-worst pair spread), welcome offer pending its spend deadline, expiring transfer bonus. E.g.: "68.000 – 84.000 puntos · `proyección` · banda legend: welcome offer not yet secured (+0–11.400) · bonus may expire (−10%)". The low end is the value the user can bank on; the verdict feasibility check uses the **low end only** — an option is only "funded" if even the low band covers it.
- Verdict tables (CPP ladder §1.2) stay unchanged: thresholds apply to the mid-case quote, and the ladder applies to cpp computed from live/verified numbers at booking time.

---

## 3. Datasets & APIs we do not build

| Need | Source | Cost / terms |
|---|---|---|
| Welcome offers (179 cards, daily) | raw.githubusercontent `andenacitelli/credit-card-bonuses-api/main/exports/data.json` | free, MIT+Commons Clause (don't resell dataset) |
| Transfer partner CPP values (98 pairs) | `points-transfer-valuations` JSON | free, CC-BY-4.0 (attribution in UI footer) |
| Award availability + taxes | ~~seats.aero Partner API~~ **skipped in v1 — D29 no paid keys**; the labelled fixture carries this, refreshed from their free website tier (D30). Original API surface: `GET /search|/availability|/trips/{id}|/live` | fixture (free) |
| Cash fares (any date) | Google Flights blob regex (`background.js` MIT) or Amadeus Self-Service free tier | free (respect ToS: display with link-through, don't auto-scrape aggressively) |
| FX rates | `api.frankfurter.dev/v1/latest?base=USD` (ECB) | free, 6h TTL |
| Cars/hotels awards (stretch) | ~~rooms.aero~~ **dropped with D29** — same paid API gate as seats.aero | skipped |

**Required shipping item (CC-BY-4.0):** the UI footer must carry the points-transfer-valuations attribution (see that repo's README; attribute WanderWise Guide, link the dataset). It belongs on Phase 4's saved-list/results footer, not "somewhere later".
| Award charts (fallback, clearly labeled 2024 estimates) | zone chart tables (awardradar pattern — retype with own citation) | free |

**Provider choice (settled → D25 + D29, supersedes the old D23):**
- **⚠️ Amadeus Self-Service is gone** — decommissioned 17 July 2026; the sign-up-and-build portal is closed and what remains is enterprise-only. Do not build against it. Historical notes that mention it are voided.
- **Duffel = the MVP engine for both pricing AND real booking (one integration, one vendor):**
  - Price/date discovery: Duffel Flights API offer-requests over our candidate months (replaces the Amadeus date-flex plan).
  - **Real booking (v1 requirement):** offer → price verification → order creation → payment → real ticket. Test mode is free forever (`duffel_test_` tokens, sandbox "Duffel Airways"); production costs 1,500 free searches per confirmed order, then $0.005/search — **production pricing is never crossed in v1 (D29)**.
  - Books **cash fares only** — award/Avios seats stay on the guided path (F8/F6). Never present a Duffel offer as an award redemption.
  - Safety pattern: search → offer → price re-verify → book (offers move; never pay off a Search snapshot).
- **Award availability layer = the labelled fixture (D29/D30).** seats.aero's Partner API is skipped: its Pro tier is paid (~AU$12.99/mo) and commercial use needs written permission — both out of scope. The fixture carries the guide's case numbers, manually refreshed from seats.aero's **free website tier** (no account, ≤60-day window) per the D30 ritual, always badged `estimación` with its `verified_at` age.
- **Google Flights deep links + fare regex stay as free utilities** (MIT, cloned) for coverage/verification outside Duffel — the free backbone for any-date cash fares.
- rooms.aero (hotels) dropped with D29 — it lives behind the same paid API gate.

---

## 4. Utility functions we clone instead of write

| Function | Repo | License |
|---|---|---|
| `buildGoogleFlightsTfsUrl(origin,dest,date,cabin,airlines,nonstop,pax,currency)` → deep-link | gf-seats-aero-extension `protobuf.js` | MIT ✅ |
| `extractPrices(html)` — cash prices from GF results blob | gf-seats-aero-extension `background.js` | MIT ✅ |
| in-flight dedup + LRU cache (500 entries, 30-min TTL) | gf-seats-aero-extension | MIT ✅ |
| wallet CRUD + ready-gated localStorage hook + expiry utils + tests | miles-wallet | MIT ✅ |
| PWA shell (network-first navs + stale-while-revalidate assets + update banner) | miles-wallet `sw.js` | MIT ✅ |
| `SelectWithOther` dropdown (seeded suggestions + free-text fallback) | miles-wallet | MIT ✅ |
| funding feasibility (5-state allocation) | award-trip-agent | MIT ✅ |
| LLM verdict/prompt patterns worth copying | gondola-mcp commands + awardtravelfinder SKILL.md | MIT ✅ |

**GPL-3 seat (do NOT copy code):** seats-MCP — use only as API-behavior documentation.
**No-license seat (concepts only):** awardradar — never copy code or doc text.

---

## 5. What remains genuinely ours to build (the defensible IP)
1. **D1 — Balance-by-date projector** (deterministic; feeds 1.1–1.6 plus `monthlySpend`).
2. **D2 — Booking-window optimizer** (picks the *date*; nobody listed does this).
3. **D3 — Milestone/affordability conversational loop** ("Sticking to Feb 15 OK?") — LLM as conversation, code as math.
4. UI: savings-hero results (spec §8), share card, ES/EN toggle, beginner mode.
