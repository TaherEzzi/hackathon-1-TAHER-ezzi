# A Una Milla — Source Summary

**Date:** 26 October 2026
**Sources:** `Guia_post_consultoria_millas_2026 1 2.pdf` (17 pages, Eriz, 6 Sep 2026), `Plan.pdf` (1 page), Sustraiak deck slides 11–44 in `Sitio web Sustraiak (Copy).html`, plus the existing `A_Una_Milla_Project_Specification.md`.

This file is the shared picture. Decisions live in `decision.md`. Journeys live in `flow.md`. How to build it in Cursor lives in `cursor.md`. The ordered work lives in `ACTION_PLAN.md`. Slide-by-slide tasks live in `slides-11-44-actions.md`.

---

## 1. What the three sources are

| Source | What it is | What it forces the product to do |
|---|---|---|
| Post-consulting guide | A real client playbook after a paid session. Worked case: **Business class Madrid → Johannesburg in 90 days**, via Iberia / British Airways / Qatar, funded by Revolut RevPoints and Amex Business Platinum. | The app must reproduce this advice, case by case, in plain Spanish, with the same safety rules. |
| Plan.pdf | Eriz’s product note for the build. | The interface is a conversation that goes from zero to a booked flight. Generative UI inside the chat. Costs, request caps, booking economics, and Stripe are open work, not afterthoughts. |
| Slides 11–44 | How Sustraiak expects a builder to work this week. | Research and taste before code. One person owns every layer. Ship a working path early. Agents loop until tests pass. |

The hackathon spec already says the product answers **“How much could I save on this trip?”** The plan note raises the bar: the answer arrives inside a chat that can also tell the user **how to get the points** and **how to finish the booking**.

---

## 2. The worked case in the guide

**Client context on the cover**

- Traveller: Eriz’s post-consulting client.
- Goal: **canje en Business en 90 días**.
- Route: **Madrid → Johannesburg**.
- Programs: **Iberia, British Airways, Qatar Airways**.
- Earn tools: **Revolut** and **Amex Business Platinum**.

Everything else in the guide is the method that makes that redemption possible. The product’s first demo should be this route, in Business, with a 90-day horizon.

---

## 3. The five strategies in the guide

### 3.1 Accumulate miles from spend that already happens

Long-term points come from daily spend: shopping, travel, restaurants, fuel. The key idea, stated as a rule:

> Do not spend more to earn miles. Turn normal spend into points. Do not take on interest or debt to chase rewards.

Needs: a card, debit, or payments ecosystem that pays transferable points or miles. Always check the fee, the cap, and the conditions. Spain card list lives at [aunamilladetudestino.com/tarjetas-de-credito](https://aunamilladetudestino.com/tarjetas-de-credito/).

How to use it: concentrate existing spend, prefer methods that earn without interest, and use promos and multipliers only when the purchase already makes sense.

### 3.2 Find award seats faster

Searching airline by airline is too slow. The guide names two tools:

| Tool | URL | Role |
|---|---|---|
| SeatSpy | https://www.seatspy.com/ | Award availability search |
| Seats.aero | https://seats.aero/ | Award availability search |

The Seats.aero Chrome extension can show points next to the cash price on Google Flights when Seats.aero has compatible data. That comparison is the decision: cash or miles. The guide recommends a computer for filters and comparison, and gives the install path: Seats.aero → Herramientas → Extensión de Chrome.

### 3.3 Revolut Premium, Metal, Ultra

Debit earn rates in Spain, as printed in the guide:

| Plan | Price | Instrument | Earn rate |
|---|---|---|---|
| Premium | 9,99 €/month | Debit only | 1 RevPoint per 4 € |
| Metal | 15,99 €/month | Debit only | 1 RevPoint per 2 € |
| Ultra | 55 €/month | Debit | 1 RevPoint per 1 € |
| Ultra credit | included in Ultra | Credit | 1,5 RevPoints per 1 € |

Reading: Premium and Metal earn on debit. Revolut credit is only in the Ultra reading. Premium is enough to start. Metal and Ultra accelerate. Ultra is the main tool when Revolut is the primary points engine.

### 3.4 Buy RevPoints, and use Shopping multipliers

Buy RevPoints **only after an award is found** and only the shortfall needed to book. Do not buy points “just in case”.

Revolut’s online shop can show multipliers up to **×20**. Worked arithmetic in the guide: **100 € × 20 = 2.000 RevPoints**, versus 100 points at the base rate. Confirm the multiplier and that the shop and promo are still live before recommending a purchase.

### 3.5 Move Avios between airlines

Avios can move between compatible programs so the user books where the seat actually exists.

Hard constraints from the guide:

- Account data must match. British Airways uses passport data for some transfers.
- Accounts must be at least **30 days** old.
- **British Airways is the bridge.** Do not assume every program transfers directly to every other program.

Links the guide gives:

| Path | Where |
|---|---|
| BA ↔ Iberia / Vueling / Aer Lingus / Finnair | [Combine My Avios](https://www.britishairways.com/content/the-british-airways-club/avios/combine-avios) |
| Move Avios | [avios.com transfer](https://www.avios.com/en-GB/move/transfer-avios) |
| BA ↔ Qatar Privilege Club | [Qatar exchange](https://www.avios.com/manage-avios/move-and-combine-avios/partner/qatar/exchange) |

The on-screen steps, which the booking guide in the app must mirror:

1. Open Combine My Avios and click **Transfer your Avios**.
2. Pick the destination program (example: Iberia) and press Next. Recheck matching personal data and the 30-day rule.
3. Enter the amount. The guide’s example moves **50 Avios** from BA to Iberia. Show origin, destination, and both resulting balances before **Transfer**.
4. The **Avios sent** screen confirms. Check the destination balance and keep the email.

Qatar is a separate link step: connect British Airways Club and Qatar Airways Privilege Club first, then choose direction, amount, and confirm.

### 3.6 The five rules on the last page

These are product invariants. Every recommendation the agent makes has to survive all five.

1. Earn mainly on spend the user was already going to make.
2. Do not pay interest or create debt to get points.
3. Use award search tools to save time.
4. Always compare **miles + taxes** against the cash price.
5. Transfer points only when the redemption and the availability are clear.

---

## 4. What Plan.pdf adds

The note is a build list, not a designed spec. Each line is an open case the action plan has to close.

| # | Note (as written) | Meaning for the build |
|---|---|---|
| 1 | An interface where the user talks to the AI and goes from 0 to 100 until they have the flights. | Chat is the shell. The session ends in a held award or a finished booking path, not a list of tips. |
| 2 | https://awardtravelfinder.com/enterprise-api — check the cost of doing all of this. | Price the Award Travel Finder enterprise API before depending on it. → **Closed 2026-10-26 (D29): paid and permission-gated; skipped under the no-paid-keys rule.** |
| 3 | Generative UI in the chat. Easy to save itineraries. Show price, points, how to get the points, and the saving. | Each answer renders cards: cash, points, earn path, saving. Saving an itinerary is one action. |
| 4 | Look at hotel offers and anything else that makes points easier to earn. | Hotels and shopping multipliers are earn accelerators, shown only when they close a points gap. |
| 5 | Works as a plan (“I want to go in summer”) and as book-now (“I want it now”). An OpenClaw-style agent that works properly with Avios for Spain. | Two intents, one agent. Spain and Avios are the depth. |
| 6 | Which companies we can use for booking, whether we can mark up, or whether we take an affiliate percent. | Booking economics are a decision, tracked in `decision.md`. |
| 7 | How many requests a user is allowed, and how. | Hard caps, because partner quotas are finite. |
| 8 | How far ahead we can look. | The search horizon is a product limit we must measure per provider. |
| 9 | Whether other partners give the same data for less. | Run a cost-and-coverage comparison before locking a vendor. |
| 10 | For each plan, which APIs it includes and what data they really return. Match that to RevPoints and British boosters. | A matrix: plan tier → APIs → fields we actually get → whether it can price a RevPoints or Avios Booster path. |
| 11 | Put a monthly price on it and charge it with Stripe. | Subscription billing is in scope. The number comes after the cost model. |

---

## 5. What slides 11–44 require of the build

The deck’s builder process is the method, applied to this product. Detail and checklists are in `slides-11-44-actions.md`. The spine:

1. **Twelve steps, five stages.** Understand, Design, Build, Harden, Ship. Coding is one step.
2. **Ask when stuck.** Ten minutes without progress means ask.
3. **Think the whole product** before the first screen: SEO, speed, brand, responsive, accessibility, copy, analytics, security.
4. **Four layers beyond the brief.** What they asked, what they meant, what they do not know they need, who else has the same problem.
5. **Taste is in states.** Empty, loading, error, mobile first, consistent tokens, real copy.
6. **One builder owns every layer.** Brand, platform, admin, security, quality, delivery.
7. **List every component before coding.** Most products fail on the pieces nobody listed: admin, email, monitoring, backups.
8. **Eleven stages.** Research, brand, UI, flows, motion, platform, admin, security, scalability and cost, testing, delivery. Each stage in the deck has a prompt. Those prompts are copied into `slides-11-44-actions.md` with this product filled in.
9. **Quality first.** One bug in the demo undoes the week. AI writes code faster, so testing increases.
10. **Ship in versions.** v1 is the core flow end to end. v2 covers edge cases. v3 is polish. v4 is secure and ready.
11. **Agents in a loop.** Plan, build, review, test, repeat. Work while agents run. Parallel work uses git worktrees.

---

## 6. How this sits on the existing spec

`A_Una_Milla_Project_Specification.md` already defines quick flight, full trip, savings hero, wallet, guided booking, and the jury criteria. This summary does not replace it. It specialises it:

- The first complete path is the **guide’s Madrid → Johannesburg Business case**, told as a chat.
- **Plan mode** is the 90-day earn-and-redeem runway. **Book-now mode** is cash versus miles on a live seat.
- The five guide rules override any clever hack that would create debt, buy points early, or transfer before a seat exists.
- Partner choice, request caps, horizon, markup versus affiliate, and the Stripe price are explicit work items from Plan.pdf. The spec left them open. They are now tracked.

The 26 October decision wave (`decision.md` D19–D28) settles what the spec left open:

- **D25:** the MVP issues **real cash-fare bookings through Duffel** (offer → price re-verification → order, test mode). Award seats stay guided. Amadeus Self-Service is dead; D23 voided.
- **D19:** the point value comes from the **selected card's** program pair (`cppLow..cppHigh`), never a global estimate. No card → no value, no verdict.
- **D20:** the cost breakdown is never one number: taxes + fees + plan cost at official dated rates.
- **D21:** the booking window is ranked by **best total money value**, not a fixed wait-ladder.
- **D26:** every projection renders as a **low–high range** with its cause; feasibility tests the low end.
- **D22:** request-cap enforcement is deferred past v1.
- Feature priority tiers: `docs/OVERVIEW.md` (MUST / Priority 2 / SKIP / additions).

---

## 7. Cases the action plan must cover

**From the guide**

| ID | Case |
|---|---|
| G1 | Organic earn. Recommend cards and ecosystems in Spain. Refuse “spend more” and debt. |
| G2 | Award search. SeatSpy and Seats.aero behaviour, cash versus points on the same result. |
| G3 | Revolut plan picker. Premium, Metal, Ultra, with the printed rates, and credit only on Ultra. |
| G4 | Buy the shortfall only after a seat is found. Surface Shopping ×20 when it closes the gap. |
| G5 | Avios moves with BA as the bridge: Iberia, Vueling, Aer Lingus, Finnair, Qatar. Name match. 30-day accounts. Confirm both balances. |
| G6 | The five rules as hard checks on every recommendation. |
| G7 | Demo story: MAD–JNB Business, 90 days, IB/BA/QR, Revolut + Amex Business Platinum. |

**From Plan.pdf**

| ID | Case |
|---|---|
| P1 | Chat from first message to a booking path. |
| P2 | Cost the Award Travel Finder enterprise API. *(Closed 2026-10-26, D29: paid → skipped.)* |
| P3 | Generative cards: price, points, how to earn, saving. Save itinerary in one action. |
| P4 | Hotel and shopping offers only as earn accelerators. |
| P5 | Plan mode and book-now mode, Avios-correct for Spain. |
| P6 | Booking partner: markup, affiliate percent, or guided deep link. |
| P7 | Per-user request allowance and how it is enforced. |
| P8 | How far ahead search actually works, per provider. |
| P9 | Same data from a cheaper partner, if one exists. |
| P10 | Plan-tier matrix: APIs included, real fields, fit for RevPoints and BA boosters. |
| P11 | Monthly price charged with Stripe. |
