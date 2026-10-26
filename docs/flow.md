# Flows — A Una Milla

Every journey the product owes, from the post-consulting guide and from Plan.pdf. Screens come after these flows. If a flow has no happy path, edge, and failure, it is not ready to build (slide 23).

Roles: **Traveller** and **Admin**. Copy language for the traveller is Spanish.

Two intents share one thread:

- **Plan.** “Quiero ir en verano” / “en 90 días”. Output is a runway: earn, gap, when to book.
- **Book now.** “Lo quiero ya”. Output is a live comparison and booking steps.

---

## F0. Enter the product

**Happy.** First screen shows the brand, one real example (Madrid → Johannesburgo, Business, 90 días), and two prompts: plan and book now. The traveller types or taps. No account required to see the example.

**Edge.** Returning traveller with a saved itinerary lands on that thread, with balances still attached.

**Failure.** Session expired. Offer a one-tap restore. Do not drop the draft message.

**Sees.** Empty state with real copy. Loading state once they send. Composer stays usable.

---

## F1. Plan mode — summer or a 90-day horizon (P5, G7)

**Happy.**

1. Traveller: origin, destination, cabin, who travels, and a window (“verano”, “en 90 días”, or two dates).
2. Agent asks only for what is missing. Defaults: 1 adult, Business if they said business, Madrid if they said “desde casa” and the profile says Madrid.
3. Agent lays out a runway card: target miles, miles already held, gap, weekly earn at the current Revolut plan, whether the gap closes inside the window, and the cash fare beside it.
4. If the gap does not close, the agent offers accelerators that respect G1 and G4 (better plan, shopping multiplier, buy shortfall only if a seat is already held).
5. Traveller saves the itinerary. The thread keeps the card.

**Edge.** “Verano” with no year → the coming summer, and say which months you assumed. Several travellers → multiply seats and taxes, and say so. Flexible airports → show the nearby option as a second card, not a silent swap.

**Failure.** No award calendar inside the horizon → say so, show the furthest date the provider can see (P8), and offer cash for the same window. Provider error → retry once, then a human message and a way to continue with manual numbers.

**Sees.** Progress lines while searching. Runway card. Save action. A one-line why.

*Computation behind steps 3–4: F12.*

---

## F2. Book now (P5, G2, G6 rule 4)

**Happy.**

1. Traveller gives route, date, cabin, passengers.
2. Agent returns one primary card: cash price, award price as miles + taxes in euros, saving in euros and percent, verdict **usar puntos** or **pagar en efectivo**.
3. The verdict uses cents-per-point after taxes. If cash is cheaper or the redemption is poor, the card says pay cash and does not push a transfer.
4. If the verdict is use points, the next card is the transfer path (F6) or “you already have the miles in the right program”.
5. Booking steps (F8) follow on the same thread.

**Edge.** Screenshot or link pasted → extract route, date, price, passengers, and ask the traveller to confirm before search. Mixed cabins → price the cabin they asked for and mention the cheaper cabin as an alternative card.

**Failure.** No seats on that date → nearest date with a seat, plus the cash price of the original date. Taxes missing → show miles and label the taxes as unknown. Do not invent a saving percentage.

**Sees.** Side-by-side cash and miles. Saving is the largest number when there is a saving. When cash wins, the cash price is the largest number and the copy says why points lose.

---

## F3. Organic earn advice (G1, G6 rules 1–2)

**Happy.** Traveller asks how to get more miles. Agent asks what they already pay for (rent, food, fuel, travel) and which cards they hold. It recommends concentrating that spend on a points method available in Spain, and links to the card guide. It names the fee and tells them to read the conditions.

**Edge.** They already hold Amex Business Platinum and Revolut → do not pitch a new card first. Show how those two work together for the trip they have open.

**Failure / refusal.** They ask “¿gasto más para llegar?” or “¿lo financio?”. Agent refuses. It restates the rule: do not spend more, do not pay interest, do not take debt to earn points. It offers a legal accelerator (plan change, multiplier on a purchase they already intend).

**Sees.** A short list, not a catalog. Each option has cost per month and points per euro.

---

## F4. Revolut plan picker (G3)

**Happy.** Given monthly debit spend, the agent shows Premium, Metal, and Ultra with the guide’s rates:

| Plan | Fee | Earn |
|---|---|---|
| Premium | 9,99 €/month | 1 RevPoint / 4 € debit |
| Metal | 15,99 €/month | 1 RevPoint / 2 € debit |
| Ultra | 55 €/month | 1 RevPoint / 1 € debit, and 1,5 / 1 € on Ultra credit |

It marks credit as Ultra-only. It recommends the cheapest plan that closes the gap inside the window. It tells them to confirm current Revolut prices before switching.

**Edge.** Spend is tiny → Premium, and say Ultra’s fee is not earned back. They already pay for Ultra → do not suggest a downgrade in the same breath as a 90-day goal unless the maths says the fee exceeds the value.

**Failure.** Rates cannot be confirmed live → label the table as the guide’s September 2026 figures and link to Revolut’s plan page.

**Sees.** Three columns, one recommended, the arithmetic visible (spend → points / month → months to the gap).

---

## F5. Close a points gap (G4, P4)

**Happy, seat already found.** Gap is small. Agent shows, in order: shopping multiplier if a purchase they already intend qualifies, then buying only the shortfall. The ×20 example is illustrative (100 € → 2.000 RevPoints) and is shown only with a “confirm the multiplier is live” line.

**Happy, no seat yet.** Agent does not offer a purchase. It says: find the seat first, then buy the difference if it still makes sense.

**Hotels and similar.** A hotel offer or a shopping boost appears only as an accelerator that reduces the gap. It is a card under the runway, with its own cost. It never replaces the flight answer.

**Edge.** Gap is zero → skip this flow and go to transfer or book. Gap is larger than any reasonable buy → say the buy is a bad deal and return to earn-over-time or pay cash.

**Failure.** Multiplier feed unavailable → omit the ×20 claim. Do not guess a multiplier.

**Sees.** A single “te faltan X” line, the cost to close it, and a clear primary action. When buying is inappropriate, that action is absent.

---

## F6. Move Avios (G5, G6 rule 5)

**Happy.**

1. A seat exists in a target program (Iberia, Qatar, Vueling, Aer Lingus, or Finnair).
2. British Airways is treated as the bridge. The agent does not claim a direct hop that the guide does not support.
3. Pre-checks: names and passport data match, both accounts are at least 30 days old, source balance covers the amount.
4. Card shows from, to, amount, source balance after, destination balance after.
5. Steps match the guide: Transfer your Avios → choose program → Next → amount → Transfer → Avios sent → check destination balance and keep the email.
6. Qatar adds the link step: connect Privilege Club before the move.

**Edge.** They want to move “all of them” → still show both resulting balances and ask for a number. Example amount in the guide is 50 Avios; the UI must work for real amounts too. Several hops (Revolut → BA → Iberia) → one step at a time, each with its own confirm.

**Failure.** Account under 30 days, or names differ → stop. Say which check failed and the date they can retry. No seat on the target → do not transfer. “Move BA directly to Vueling” if the tool requires the bridge → show the real path via BA.

**Sees.** A step list with the official links. Warnings before the amount field. No “Transfer” language while a check is red.

---

## F7. Save an itinerary and come back (P3)

**Happy.** From any result card, one action saves route, dates, cabin, cash, miles, taxes, verdict, and the earn snapshot. The traveller sees it in a list with the saving still visible. Opening it reloads the thread.

**Batch check (F12).** At the top of the list, “Comprobar todos” re-runs the forecast over every saved itinerary and stamps each row with the refreshed verdict, the badge it now carries, and its age. Rows stay rows; it is an engine pass, not a re-search storm.

**Edge.** Same route saved twice → update the existing one and say the numbers were refreshed. Guest saves → ask them to create an account before the save is durable.

**Failure.** Save failed → the card stays on screen, with a retry. Do not pretend it was stored.

**Sees.** A quiet confirmation in the thread and the trip on the saved list. Total saved, when there is more than one trip, is the sum of positive savings only.

---

## F8. Booking path (P1, P6)

**Happy, real booking — the MVP requirement (D25).** Cash-fare offers go through Duffel end to end:

1. From a validated offer (search → **offer → price re-verification** → order), the app collects passenger details with Zod validation. **Payment is simulated by Duffel's sandbox in test mode (D31)** — the traveller never types a card into our UI and no PAN is stored anywhere.
2. The card shows: the verified total (taxes + fees in the D20 breakdown), what the payment authorization goes to, the airline and fare brand, the booking reference once the order is created.
3. Test environment runs against the sandbox airline (`Duffel Airways`, `duffel_test_` tokens) — this is the demo path **permanently in v1 (D31)**: dummy checkout, dummy ticket, no real money. Production issuance is out of scope; D15 economics gate nothing on the booking path.
4. Post-order: booking reference stored per data table rules ("Transfer plan"-style record, no raw provider payloads), link to the airline's own manage page.

**Happy, guided (default for award seats — unchanged).** Avios/points redemptions cannot be issued through Duffel, so they keep the guided path:

1. Card lists numbered steps: where to open, what to search, which points must already sit in that program, what the taxes should look like, what to tap.
2. Each external hop is a link the traveller can see the host of.
3. The thread ends when they mark "lo he reservado" or they leave at a named step.

**Happy, affiliate or in-partner booking.** Same card, with the partner named and the fact that the product may receive a commission stated in one sentence. Markup exists only if `decision.md` records a partner that allows it.

**Edge.** The offer re-verification fails or the total moved → the old quote is discarded, the new total is shown with the diff, and the traveller confirms again; we never pay off a stale snapshot. Taxes at payment differ from the card → tell them to stop and compare again. Mixed tickets (positioning flight on a separate ticket) → warn about separate-ticket risk before the steps. Passenger data on the passport mismatches the detail card → block the order and ask again.

**Failure.** Duffel order errors → typed `ProviderError` (per the adapter contract), the traveller keeps the verified quote but nothing was charged — say so explicitly. Partner link dead → fall back to the named airline page and the steps. Never collect card numbers in this app; Stripe/Duffel hold payment state.

**Sees.** For cash fares: a price-and-pay sheet with the breakdown, then a confirmation view with the airline reference. For awards: a checklist. The current step is obvious. Completed steps stay visible.

---

## F9. Request allowance (P7)

**Deferred (D22):** v1 ships without this. The cap, the composer counter, and the unit consumption switch on after the core path is complete. The cache, the 7-candidate-date rule, and the one-live-call rule already protect the provider quota during the build. The behavior below is the spec it will ship with — implemented, not rewritten.

**Happy.** Each traveller has a daily search budget. The composer shows remaining searches in quiet type. A search that hits the cache does not consume a unit.

**Edge.** They are one search from the cap → say so before the call. Admin raises the cap → the next search sees it, and the change is in the audit log.

**Failure.** Cap reached → no provider call. Message explains the reset time and offers saved trips. A what-if on numbers the traveller typed uses the pure CPP function in `decision.md`. It does not call the model to do arithmetic, and it does not call the provider.

**Sees.** A plain sentence, not a stack trace. Admin sees the same user on the usage dashboard.

---

## F10. Admin (slide 26)

**Happy.** Admin opens a dashboard whose numbers are aggregate counts for the current day: searches, provider calls, estimated cost, saves. One query per metric. They look up a user by exact id or email (one row), suspend them, and change cap, horizon, primary provider, and the Stripe price id. Each change writes who, what, and when.

**Edge.** Two admins edit the cap → last write wins and both appear in the audit log.

**Failure.** Non-admin hits the route → 403 with a normal page. A missing provider key is logged with the integration name and returned as a typed down state. Traveller search then uses F2’s failure state. The handler does not catch the error and render an empty dashboard.

---

## F11. Subscribe (P11)

**Happy.** This screen exists only after D17 is set: an admin Stripe price id is stored. The page shows that price, the allowance, and the data sources, then Stripe Checkout. The return URL shows active only when the webhook has written `active`.

**Edge.** They subscribe mid-thread → allowance increases without losing the thread.

**Failure.** Checkout cancel, or a webhook error, leaves the free allowance. The handler logs the Stripe event id and the cause, and returns a typed `not_active`. It does not catch the error and mark the user active. The thread stays intact.

**Sees.** When the price id is set: that price, the allowance, and the data sources from the P10 matrix. When it is not set: no subscribe screen and no price.

---

## F12. Forecast pipeline — the engine behind F1 and F2

This is the computation flow a plan or book request runs through. It is not a screen. The model parses and explains. The rules functions in `decision.md` do the arithmetic. A request evaluates at most 7 candidate dates. **Live calls are cash-side only (Duffel, test mode); award figures come from the labelled fixture and stay `estimación` (D29).** Provider failures follow the `ProviderError` contract in `decision.md`: log provider, route, and date, then return the typed error.

### Division of labor (binding)

| Step | Who | Why |
|---|---|---|
| 1. Parse the intent | LLM | "Quiero ir a Lisboa en ~3 meses" → structured `{origin, destination, window, flexibility, pax, cabin}`. Its only job. No math. |
| 2. Cheapest-dates hunt | Code + one ranged cash query | Up to 7 candidate dates, ranked, with fares. A second page of dates is a new request under F9, not a loop inside this one. |
| 3. Project the balances | Code only | Wallet balances, monthly spend, and the Revolut rates from F4. `balanceBy(date)` runs on those 7 dates only, **per program and net of anything expiring before the date** (§1.6; balances are never summed across programs — only the target program or a guide-stated transfer edge funds the seat). The value inputs come from the **selected card** (D19): no card selected → ask; the engine never substitutes an estimated universal value. |
| 4. Do the maths and show it | Code only | Point value looked up per selected card → program pair (D19). CPP after taxes (§1.1, `components-and-math.md`), verdict ladder (§1.2), full cost breakdown = taxes + fees + plan cost at official rates (D20: Revolut Premium 9,99 € / Metal 15,99 € / Ultra 55 €, revived from [our-pricing-plans](https://www.revolut.com/es-ES/our-pricing-plans), checked 2026-10-26, Ultra marked "oferta de lanzamiento"). Transfer and buy-points checks are F6 and F5. |
| 5. Rank candidate months | Code only | **Best total money value wins (D21).** `valueScore(t) = expectedCashPrice(trend(t)) − allInCost(t)`, where trend(t) = historic price trend + festive/seasonal demand + live offers (labeled source). Example the user fixed: France 8 months out → prices lowest months 4–5 and points fund by then → book month 4–5; points late → recommend month 7 when waiting closes the gap with bigger net savings; both cards shown, and the later one carries the deferral reasoning. Hard veto above value: no seat at all, or date beyond the award release window. |
| 6. Explain | LLM | Turns the computed verdict into plain Spanish with the one-line why. It quotes the numbers; it does not produce them. |

### Happy. 

1. Intent parsed → confirmation card of route, window, travellers ( traveller confirms or corrects).
2. Candidate dates come back ranked with cash fares. Cached data is labeled `cacheado` with its age; live data says `en vivo`.
3. For each of the 7 candidates, in memory: estimated points (labelled `estimación`), balance-by-date shown as a **low–high range** per D26 (`proyección`), transfer path, feasibility — feasibility always tests the **low end of the range**. No provider call inside this loop.
4. Card gate (D19): until a card that can fund the trip is selected, the value is not shown — the app asks which card will fund it, then swaps in that card's program pair value (`cppLow..cppHigh`, shown as the pair's range, labeled with the dataset's `verifiedAt`).
5. Verdict card, including when the verdict is pay cash. The date is a computed result, with the balance projection beside it, and the **full breakdown, never one merged number (D20)**: taxes + fees + plan cost (at the official rate, dated) + the points' value at the pair's CPP. A fixed sample date is not hardcoded.
6. Month ranking (D21): the card carries the recommended month with the FR-style reasoning on screen when a later month wins ("vale esperar: punto de compensación en el mes 7"). The alternative month appears as a second card with its own valueScore.
7. **“Ver precio en vivo”** re-runs the **cash offer** for the chosen date (Duffel, test mode) so the cash side of the card flips to `en vivo`. The award figure stays `estimación` from the fixture (D29) — it never pretends to be live. A `ProviderError` on the cash call keeps the cached figure badged `cacheado` and shows the typed failure.

### Test persona and other itineraries

- **Test fixture (user request):** a seeded demo traveller (Madrid, ~€1,800/mo spend across rent/food/fuel, Revolut Metal + Iberia Plus 32.000 Avios, MAD–JNB Business 90 días per D10) is offered as a one-tap option on F0. It is clearly labeled a test profile and never presented as the traveller's own data. It runs the whole engine without typing.
- **Batch check (user request):** from the saved list (F7), “Comprobar todos” re-runs F12 over every saved itinerary in one sweep and stamps each with the refreshed verdict and its badge, oldest first. One result per thread; provider budget unchanged.

### Edge. 

Fuzzy window (“verano”) → state assumed months. No award data inside the horizon → say so, show the furthest visible date (P8), give cash for the window. Balance projection lands within 5% of the requirement → say “te falta muy poco” and offer F5 instead of a verdict. Seats scarce → do not wait for a bonus; say so.

### Failure. 

Provider down → log `ProviderError` with provider, route, and date, and retry once. If a cache row exists, return it labelled `cacheado` and keep the error on the result. If it does not, return `ProviderError`. The error is never dropped. A parse that is missing origin, destination, or window returns `UnparsedIntent` and asks for those fields. It does not guess a route. Projection inputs missing (no spend entered) → ask, or fall back to the book-now comparison (F2). The UI renders numbers only from the structured payload.

### Sees. 

Progress lines per step (“Buscando fechas… Proyectando tu saldo…”). Numbers carry badges: `en vivo / cacheado / proyección / estimación`. Projected figures always render as **ranges** (`74.100 – 81.900 · proyección`), widened on hard paths (multi-card splits, pending welcome offers, expiring bonuses) with the cause shown beside the band — never a bare number (D26). The booking-window date is the hero inside F1's runway card. Every figure has its age visible.

---

## Flow map

```text
F0 Enter
  ├─ F1 Plan mode ──────┬─ F3 Organic earn
  │                     ├─ F4 Revolut plan
  │                     └─ F5 Close the gap (only with a seat for a buy)
  └─ F2 Book now ───────┤
                        ├─ F6 Move Avios (only with a seat and checks green)
                        └─ F8 Booking steps
F7 Save sits on F1 and F2
F9 wraps every provider call
F11 wraps the allowance in F9
F10 is the owner’s view of F9 and F11
F12 is the engine inside F1 and F2 (LLM parses, code computes, LLM explains)
```

---

## Demo script, one thread

Use this as the Thursday walkthrough. It chains G7 with the flows above.

1. Open the app on a phone. Tap the Madrid → Johannesburgo example.
2. Plan mode: 90 days, Business, one adult. Show the runway and the Revolut maths.
3. The booking-window verdict: read the milestone aloud (“reserva a partir del …” with the balance projection and the transfer deadline behind it). Point at the badges: the runway date is `proyección`, the award miles are `estimación` (fixture, D29), and the cash price beside it is `en vivo` or `cacheado` with its age. Tap “ver precio en vivo” to flip the cash figure to `en vivo` and show the diff if it moved.
4. Flip to book now on a date that has a seat. Show miles + taxes against cash. Read the verdict aloud.
5. Show the Avios path through British Airways, including the 30-day warning on a second example.
6. Save the itinerary. Open the saved list. The saving is still the hero.
7. Open booking steps. Stop on the airline page. Do not pretend a ticket was issued inside the app unless a partner booking is actually live.
