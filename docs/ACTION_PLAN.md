# Action plan — A Una Milla

Ordered work so every case in the guide and every line in Plan.pdf has an owner slice. Method: `docs/cursor.md`. Flows: `docs/flow.md`. Choices: `docs/decision.md`. Context: `docs/SUMMARY.md`.

Hackathon shape from the deck: both apps live with code shared by end of Wednesday, demo Thursday. This plan assumes A Una Milla is the project you are building. Dates below are the Indore week (24–29 October 2026). Today is Monday 26 October, so Sunday’s build day is behind you. What is left is Monday–Wednesday to a live path, Thursday to demo.

---

## Outcome

A traveller can open a phone, talk through Madrid → Johannesburg in Business, see miles plus taxes against cash, see how Revolut gets them there inside 90 days, see the Avios move only if a seat exists and the accounts qualify, save the itinerary, and follow booking steps. The five guide rules hold on every one of those screens. A live URL and a repo exist before the jury.

---

## Order of attack

Ship the core thread before any new surface. Slide 36: v1 end to end, then edges, then polish, then billing and admin.

| Phase | When | Goal | Cases closed |
|---|---|---|---|
| 0. Cost and coverage | Monday morning | Know what the APIs cost and how far ahead they see | P2, P8, P9, P10 started |
| 1. v1 thread | Monday | Chat, one book-now card, guided steps, deployed | P1, G2, G6 rule 4, G7 partial |
| 2. Rules | Monday night–Tuesday | Earn, Revolut, buy-points block, Avios checks | G1, G3, G4, G5, G6 |
| 3. Plan mode | Tuesday | 90-day runway on the same thread | P5, G7 |
| 4. Save and states | Tuesday | Save itinerary, empty, loading, error, mobile | P3, P4 as a card |
| 5. Caps and honesty | Wednesday morning | Request cap, labels, admin switches | P7, D12 |
| 6. Harden and demo | Wednesday | Auth, tests green, phone pass, 3-minute script | Slide 29–31 |
| 7. Money | After the live path, or Wednesday if phase 6 is green | Stripe test mode, price still uninvented | P6, P11 |

If Wednesday slips, drop phase 7 before dropping phase 1. A live thread beats a Stripe screen with no verdict.

---

## Phase 0 — What the data actually is (rewritten 2026-10-26, D29: no paid keys)

Paid-vendor pricing is moot — D13/D14 are closed. This phase is now: repo, fixture honesty, and measured horizons, all free. Write outcomes into `decision.md` D16/D27.

- [ ] **Repo.** Brainstorming is repo-less *by choice right now* — `.gitignore` and `.env.example` already exist so nothing is forgotten. The moment the first code file is written: `git init`, first commit, remote. The worktree method (`cursor.md` §3) still requires git before any parallel agent runs.
- [x] **Award key.** ~~Provision or reject a seats.aero Partner key~~ **Closed (D29): no paid keys.** The award layer is the labelled fixture (`app_settings.primary_provider = 'fixture'`). Refresh ritual per D30: run the MAD→JNB check on the free seats.aero website (no account, ≤60-day window) when numbers go stale; the UI keeps the `estimación` badge and `verified_at` age visible.
- [x] **P2 / P9.** ~~Cost the ATF enterprise API / compare paid partners~~ **Moot under D29** — no paid vendor enters the stack. The plan.pdf question was answered: they are paid and permission-gated; recorded in `decision.md` D29.
- [ ] **P8.** Measure the furthest date the **free** sources return for MAD–JNB Business and for a short Avios hop (MAD–LHR or MAD–BCN): the seats.aero free website (≤60 days, no account), and the airline award calendars (Iberia/BA). That number is the horizon the UI may offer; store it in `app_settings.max_horizon_days` and D16.
- [ ] **P10.** The matrix below shrinks to the fixture row — paid vendor rows are historical. Fill the fixture row only from what you have actually seen on the free sources; do not fill from memory.

| Source | Cost | Miles | Taxes + currency | Cabin | Deep link | Horizon | RevPoints earn math | BA / Avios boosters |
|---|---|---|---|---|---|---|---|---|
| Free / manual demo fixture | 0 | fixture (D30 refresh) | fixture | yes | official airline URLs | measured in P8; 90 days for the demo | computed in our rules | rules only, not live |
| ~~ATF enterprise / Seats.aero partner / SeatSpy~~ | ~~paid / permission-gated~~ | — | — | — | — | — | skipped per D29 | — |

RevPoints earn math and BA booster detection are **our** rules (G3, G5). The fixture carries the guide's numbers.

**Exit.** Fixture seeded and labelled, horizon measured and stored, D16/D27 updated.

---

## Phase 1 — v1 thread (demo spine)

Cases: **P1, G2, G7 (book-now half), G6 rule 4.**

- [ ] App shell on the brand tokens. Deploy a live URL the same day.
- [ ] Chat composer. Two starter prompts from F0.
- [ ] Book-now path for MAD–JNB: one card with cash, miles, taxes, saving in euros and percent, verdict.
- [ ] CPP after taxes as in `decision.md`. Unit tests: taxes in the same currency reduce the cash before dividing; `miles <= 0`, missing taxes, and mismatched currencies return `InsufficientData` with no percentage.
- [ ] Booking steps card with Combine My Avios and the airline link. No card fields.
- [ ] **Duffel cash booking in test mode (D25 + D31):** offer request → **price re-verification** → order creation on the sandbox airline (F8 happy path). Payment simulated by Duffel's sandbox — the traveller never types a card into our UI, and the booking reference/ticket are demo-grade by design. Tests: order never built off a stale offer; passenger details Zod-validated; no card PAN stored.
- [ ] Loading lines and an error with a retry (slide 15).
- [ ] Playwright: send the demo route, see a card, open steps.

**Exit.** A stranger can complete F2 and F8 on the live URL against a fixture if the provider key is not ready. The fixture is labelled.

---

## Phase 2 — The guide’s rules as tests

Build these as pure functions first. The chat calls them. Each item starts with a failing test (`cursor.md`).

### G1 and G6 rules 1–2 — organic earn

- [ ] Given spend categories, recommend concentrating existing spend. Copy refuses “spend more” and refuses financing.
- [ ] Test the refusal with a message that asks to go into debt for points. Expect no card recommendation that requires interest.
- [ ] Link out to https://aunamilladetudestino.com/tarjetas-de-credito/ rather than inventing a full card database this week.

### G3 — Revolut

- [ ] Table encoded exactly from the guide: Premium 9,99 € and 1/4 €, Metal 15,99 € and 1/2 €, Ultra 55 € and 1/1 € debit plus 1,5/1 € credit.
- [ ] Test: credit earn is unavailable on Premium and Metal.
- [ ] Test: given a monthly spend and a gap, the recommended plan is the cheapest one that closes the gap inside the window.
- [ ] Label the rates as guide figures until a live check exists.

### G4 and P4 — close the gap

- [ ] Test: buy-points action is absent when no seat is attached.
- [ ] Test: when a seat exists, the suggested buy equals the shortfall, not the whole balance.
- [ ] Shopping ×20 renders as an example with a confirm-it-is-live line, never as a guaranteed rate.
- [ ] Hotel or shop offer is a secondary card. It does not replace the flight verdict.

### G5 and G6 rule 5 — Avios

- [ ] Graph: BA connects to Iberia, Vueling, Aer Lingus, Finnair, and Qatar. Direct edges that the guide does not state are absent.
- [ ] Test: account age under 30 days blocks and names the check.
- [ ] Test: mismatched names block and name the check.
- [ ] Test: no seat on the target program blocks the transfer.
- [ ] Qatar path includes the link-accounts step before the amount.
- [ ] UI shows both balances before any “Transfer” wording.
- [ ] Steps match F6, including the email confirmation.

### G6 rule 3

- [ ] The book-now path calls the provider adapter (or the fixture), not a hand-written “try each airline site” list, except inside the booking steps where the official site is the point.

**Exit.** `vitest` green on the five rules. A transcript of the refusal and the 30-day block saved for the demo backup.

---

## Phase 3 — Plan mode

Cases: **P5, G7.**

- [ ] Parse a window: “90 días”, “verano”, or two dates. State the assumption in the reply.
- [ ] **Card gate (D19):** no selected card that can fund the trip → ask before showing any value; then use that card's program-pair value (`cppLow..cppHigh`).
- [ ] Tests for the 2026-10-26 loophole fixes: balances **never summed across programs** (only the target program or a guide-stated F6 edge funds); `balanceBy(t)` **subtracts balances expiring before the target date**; `pax > 1` multiplies the points need and keeps the `estimación` badge.
- [ ] Runway card: target miles, balance, gap, points per month at the chosen Revolut plan, whether the window is enough.
- [ ] Same thread can switch from runway to book-now without losing the route.
- [ ] Test: 90-day window with a gap the Ultra rate can close versus one it cannot. Copy differs.
- [ ] Playwright: the demo script steps 2 and 3 in `flow.md`.

**Exit.** F1 works on MAD–JNB Business.

---

## Phase 4 — Generative UI and save

Cases: **P3, taste items from slides 15 and 22.**

- [ ] Cards share one component: verdict, earn, transfer, steps.
- [ ] Save on the card. Persisted list. Reopen reloads the thread.
- [ ] Empty state uses the real MAD–JNB example. No placeholder copy.
- [ ] Mobile at 360 px: composer and primary action reachable. Check desktop too.
- [ ] **Test persona (T1):** the seeded demo traveller offered as a one-tap option on F0, labelled a test profile, runs the whole engine without typing.
- [ ] **Batch check (B1):** “Comprobar todos” from the saved list re-runs F12 over every saved itinerary in one sweep, one result per thread, provider budget unchanged.
- [ ] Motion under 300 ms, reduced-motion respected, only on the number and the card entrance.

**Exit.** F7 and the slide 15 states are visible on a phone.

---

## Phase 5 — Horizon, honesty labels, admin switches

Cases: **P8 in the UI, D12.** Cap enforcement is **deferred past v1 (D22)** — see Later.

- [ ] Cache + in-flight dedup: two identical searches in flight count as one provider call.
- [ ] Date picker or the agent refuses dates past the measured horizon.
- [ ] Honesty labels on every figure: `en vivo / cacheado / estimación / proyección`; projections as low–high ranges with cause (D26).
- [ ] Admin can change horizon, primary provider, buy-points flag, hotel flag. Audit log records it.

**Exit.** The UI never offers a date past the horizon and every number carries its badge. The daily cap ships with F9 after the core path is complete.

---

## Phase 6 — Harden and show

Slides 27–31 and the spec’s definition of done.

- [ ] Managed auth on save and admin. Server-side checks. Zod on bodies. Secrets only in env.
- [ ] Security pass with the slide 27 prompt. Fix what it finds. Re-run tests.
- [ ] Sentry (or equivalent) and a basic analytics event: search, save, steps opened. No passport or card data.
- [ ] Lighthouse on a real phone for the thread. Fix the worst blocker if the score collapses.
- [ ] Production click-through of the demo script in `flow.md`.
- [ ] README: what it is, how to run, env var names, live URL.
- [ ] 3-minute script: problem, the thread, how it was built, what is next (real partner booking, more programs, alerts).

**Exit.** Jury can open the URL without you in the room and complete F2.

---

## Phase 7 — Booking economics and Stripe

Cases: **P6, P11.** Only after phase 6, and only with D15 and D17 answered. Until then the UI says guided booking and does not show a made-up monthly price.

- [ ] **P6.** Write the partner options Eriz named: who can issue or refer the booking, whether markup is allowed, what affiliate percent is published. Decision goes into D15.
- [ ] If affiliate is yes: one disclosed line on the steps card and the real link.
- [ ] **P11.** Stripe Checkout in test mode for the price id set in admin. Webhook sets subscription status. Cancel leaves the free cap. Thread survives.
- [ ] Test: webhook failure does not mark the user active.

**Exit.** F11 on test keys. Live keys only when Eriz says to switch.

---

## Case index

Use this to see that nothing from the two PDFs was dropped.

| ID | Case | Phase | Flow |
|---|---|---|---|
| G1 | Organic earn, no extra spend, no debt | 2 | F3 |
| G2 | Award search, cash beside points | 1 | F2 |
| G3 | Revolut Premium, Metal, Ultra | 2 | F4 |
| G4 | Buy shortfall only after a seat; ×20 with a caveat | 2 | F5 |
| G5 | Avios moves, BA bridge, 30 days, name match, Qatar link | 2 | F6 |
| G6 | Five rules as checks | 2 | all |
| G7 | MAD–JNB Business, 90 days, IB/BA/QR, Revolut + Amex | 1 and 3 | F1, F2 |
| P1 | Chat from zero to a booking path | 1 | F0, F8 |
| P2 | ~~Cost the ATF enterprise API~~ Moot — D29 no paid keys | Closed | — |
| P3 | Generative cards and save | 4 | F7 |
| P4 | Hotel and other earn accelerators | 2 and 4 | F5 |
| P5 | Plan mode and book-now, Avios for Spain | 3 | F1, F2 |
| P6 | Markup versus affiliate versus guided | 7 | F8 |
| P7 | Request allowance | Post-v1 (D22) | F9 |
| P8 | Search horizon | 0 and 5 | F1 |
| P9 | ~~Cheaper partner for the same data~~ Moot — D29 no paid keys | Closed | — |
| P10 | Plan × API × RevPoints × BA boosters matrix | 0 | F11 copy |
| P11 | Monthly price via Stripe | 7 | F11 |
| T1 | Test persona one-tap on F0, labelled test profile | 4 | F0 |
| B1 | "Comprobar todos" batch re-check of saved itineraries | 4 | F7, F12 |
| C1 | Selected-card gate before any value is shown (D19) | 3 | F12 step 4 |

---

## Working agreement

- One phase item at a time in a Cursor session. Prompt template is in `cursor.md`.
- Parallel only across worktrees: search, earn, transfer. Tests stay green before merge.
- A failing provider does not get patched around with a silent fake number. Use the labelled fixture or the error state.
- New ideas go to the bottom of this file under Later. They do not enter the current phase.

## Later

Not this week, unless the live path is done early:

- Request cap enforcement (D22; the F9 behavior spec is written and will ship unchanged — switch on after the core path).
- Price alerts on a saved itinerary.
- Screenshot extract as a first-class path (the spec’s F3).
- Share card for Instagram.
- More than the Avios pack.
- Native app.
- Hotel award search as its own destination.
