# A Una Milla — Overview

**Read this file first. It is the single map: what the product is, which document owns what, what gets built and in which order, and what does not get built at all.** Section 8 is the plain-language explainer of how a fare is compared against the traveller's tokens.

The product: a chat where anyone in Spain asks **"How much could I save on this trip?"** and gets price, points, how to earn the points, and the saving — then books. Two intents in one thread: **plan mode** (a 90-day runway to an award) and **book now** (cash vs miles on a live seat). Cash fares are booked **for real** through Duffel; award seats end in guided steps.

The demo case: Madrid → Johannesburg, Business, 90 days, Iberia / British Airways / Qatar, funded by Revolut + Amex Business Platinum.

Deadline shape: demo Thursday 29 October 2026. A live URL and a repo must exist before the jury.

---

## 1. How the documents are grouped

| Group | Files | Role |
|---|---|---|
| **A. Why & What** (product truth) | `A_Una_Milla_Project_Specification.md` · `docs/SUMMARY.md` · `docs/decision.md` | The brief of record, the source synthesis, and the settled decisions. **`decision.md` wins any conflict.** |
| **B. How it behaves** (experience) | `docs/flow.md` | F0–F12. Every journey with its happy, edge, and failure states. |
| **C. How you work** (process) | `docs/cursor.md` · `docs/ACTION_PLAN.md` · `docs/slides-11-44-actions.md` · `.cursor/rules/*` | Session rules, ordered work, the slide method. |
| **D. Engineering reference** (reuse) | `components-and-math.md` · `research/Reverse-Engineering-Notes.md` | Borrowable formulas, datasets, license boundaries. |
| **E. External, read-only** | `research/repos/**` | Reference only. Never build against it in place; never edit it. |

---

## 2. Not everything gets built — scope statement

The documents describe a full product. **You do not build it all at once.** The rule from slide 36 and D-arena applies: v1 is ONE path end to end; edges next; polish last; billing and admin only if everything else is green. The tiers below are the contract. If a new idea appears mid-build, it goes to the bottom of `ACTION_PLAN.md` under Later — it never enters the current phase.

If Wednesday slips: drop Phase 7 → drop P2 items → protect the MUST spine only. A live thread beats a Stripe screen with no verdict.

---

## 3. MUST — the v1 spine (blocking; nothing ships without these)

| # | What | Anchor |
|---|---|---|
| 1 | Chat thread (F0) with two starter prompts and brand tokens | D1, F0 |
| 2 | Test persona one-tap: the seeded MAD→JNB 90-day traveller runs the engine without typing | T1, F12 |
| 3 | Book-now comparison: cash vs miles + taxes, verdict `usar puntos` / `pagar en efectivo` via CPP after taxes + ladder | F2, §1.1–1.2 |
| 4 | Selected-card gate: no card → ask; value comes from that card's program pair only | D19 |
| 5 | Full money breakdown, never one merged number: taxes + fees + plan cost (official dated rates) + points value | D20 |
| 6 | Projections as low–high ranges with cause and badge; feasibility on the low end | D26 |
| 7 | Plan-mode runway + booking-window ranking by total money value (`valueScore`), both cards shown when waiting saves more | D21, F12 |
| 8 | Duffel cash booking end to end in test mode: offer → price re-verification → order. **Dummy checkout + dummy ticket by construction** (sandbox airline, simulated payment — no real money, no card typed in our UI, D31). No card PANs stored | D25, D31, F8 |
| 9 | Guided award steps + Avios transfer pre-checks (BA bridge, 30-day rule, name match, both balances) | F6, F8 |
| 10 | Revolut plan picker with the guide's exact rates; credit = Ultra only | F4, G3 |
| 11 | The five guide rules as hard refusals (no debt, no spend-more, transfer only with a seat) | G6 |
| 12 | Save itinerary, saved list, savings hero; "Total saved" | F7 |
| 13 | Honesty: badges `en vivo / cacheado / estimación / proyección`; typed `ProviderError`; never % with missing taxes | D12 |
| 14 | Provider discipline: ≤ 7 candidate dates, live calls **cash-side only** (Duffel test mode; award side = labelled fixture per D29), cache + in-flight dedup | F12 |
| 15 | Mobile 360 px + empty/loading/error states, Spanish copy, no jargon without a one-line explanation | D8, slide 15 |
| 16 | Live URL deployed and stable **the same day the thread works** | slide 31 |

## 4. Priority 2 — right after the spine is green

- "Comprobar todos" batch re-check of saved itineraries (F7/F12).
- Shopping ×20 accelerator card and hotel accelerator card — always as accelerators, never a second product (F5, P4).
- Alternative cards: nearby airport, mixed cabin (F2 edge).
- Mini admin dashboard: day's aggregate counts + admin settings + audit log (F10).
- Auth for durable saves across devices (guest mode is acceptable for the demo).
- ES/EN toggle and beginner mode (spec 5.4 items 9–10).
- Share card for Instagram (brand fit).
- PWA shell + offline saved trips (miles-wallet pattern, MIT).
- Sentry + three analytics events (search, save, steps-opened), no PII.

## 5. SKIP — not this week, by decision

- Price alerts and notifications (spec F10 → Later).
- Screenshot/link extraction (spec F3 → Later).
- Real Stripe billing — test mode only, and only if Phase 6 is green (D17 stays open).
- **Production booking issuance** — checkout and tickets stay demo-grade in Duffel test mode permanently for v1 (D31).
- Request-cap enforcement — **deferred by the user (D22)**; the F9 spec is written and ships unchanged later.
- Programs beyond the Avios pack (BA, Iberia, Vueling, Aer Lingus, Finnair, Qatar, Revolut, Amex BP).
- Hotel award search as its own destination.
- Native app.
- Positioning flights as a first-class feature.

## 6. Features to ADD — not in any existing list worth taking

| Feature | Why it fits | Cost |
|---|---|---|
| **Pre-filled Google Flights deep link from the verdict card** ("book these dates in GF") | The MIT `protobuf.js` encoder is already cloned in `research/repos/`; 1 util + 1 button | Small |
| **Award-release countdown** on vetoed candidates ("los asientos se abren el 3 de febrero") | Makes the hard veto (D21) explainable instead of a dead end | Small |
| **Fuel-surcharge warning for BA-family redemptions** | MAD–JNB is a classic BA surcharge trap; it is D12 correctness on the exact demo route | Small |
| **Points-expiry "value at risk"** in the wallet panel | Expiry math already exists (§1.6); gondola's framing is ready | Small |
| **Opportunity-cost card**: what the same points could otherwise buy | Deepens the verdict without new maths | Medium |
| `.env.example` + secret-scan pass | Required hygiene; real keys sit in `.env` | Trivial |

## 7. Open gaps that block a slice sooner than they look

| Gap | Status | Where |
|---|---|---|
| seats.aero Partner key | ~~Not provisioned~~ **Closed (D29): no paid keys.** Award layer = labelled fixture; free-website refresh ritual (D30) | Phase 0, D13 |
| ~~Git repo~~ | Repo intentionally deferred while brainstorming; `.gitignore` + `.env.example` stand guard. `git init` the moment the first code file lands | Phase 0 |
| `trendFor(t)` data source (D21) | No live provider; ship the labelled seasonal-curve fixture | D27 |
| Amex Business Platinum ES earn rates | Never encoded; typed by the traveller until confirmed | D28 |
| Revolut earn-rate caps | The guide says check "the cap" — no cap is in the table; earn projections stay ranges until confirmed | D32 |
| Welcome-offer dataset is US-only | Spanish cards need typed input, not the dataset | D19/F12 note |
| Guest → account save flow | Named in F7 edge, no drafted screen | Phase 4 note |
| Legal pages (privacy/terms) | In the slide-19 inventory, in no phase | Phase 6 note |
| CC-BY-4.0 attribution footer | Legally required; string in `components-and-math.md` §3 | Phase 4 note |
| "3 nobody asked for" features | Named: test persona (T1), batch check (B1), ranges (D26) | `docs/decision.md` |

---

## 8. How the fare ↔ tokens comparison works (plain version)

Think of it as a shopping comparison the engine runs in five steps. The chat AI never computes any of it — it only understands the request and explains the result.

**1. We know what the traveller owns.** They state it (or tap the demo profile): "32.000 Avios en Iberia, gasto 1.800 €/mes con Revolut Metal." Stored in the wallet. Balances are traveller-typed and never verified — projections carry ranges, never promises.

**2. We know what the trip costs in tokens.** For the route and cabin: miles + taxes (from the labelled fixture, `estimación`), and the cash price (live from Duffel, `en vivo`).

**3. Three small calculations:**
- **Do they have enough?** Needed − owned = the gap. **Counted per program only:** tokens in the target program (or reachable through a guide-stated transfer edge, F6) fund the seat — balances are never summed across programs.
- **When will they have enough?** Monthly earn = spend × the selected card's rate. **Minus anything expiring before the target date.** Result shown as a range (`proyección`), because the earn rate's cap is unconfirmed (D32) and future spend is an assumption.
- **Is it even worth it?** (cash price − taxes) ÷ miles = cents per token, from the *selected card's* pair value (D19). Above the program's good threshold → "usar puntos"; below → "pagar en efectivo".

**4. One card shows all of it.** Cash price, tokens + taxes, savings (€ and %), the gap, the "enough by" date, and the verdict. Savings is the biggest number when there is a saving; every figure carries its badge (`en vivo / cacheado / estimación / proyección`) and its age.

**5. Passengers multiply.** The seat price is per person: two travellers = double the miles and taxes, and the badge stays `estimación` — one seat's availability says nothing about two.

Where each piece lives: balances in `wallet_balances`, route prices in the fixture + Duffel, the math in `lib/engine/` (pure, unit-tested functions), the card in the chat UI.

---

*Sources: `docs/decision.md` (settled truth), `docs/SUMMARY.md`, `docs/flow.md`, `docs/ACTION_PLAN.md`, the spec, `components-and-math.md`. Changes to priorities happen in `docs/decision.md`, and this file mirrors them.*
