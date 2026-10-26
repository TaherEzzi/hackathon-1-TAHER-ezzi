# A Una Milla: Project Specification

**Hackathon 1 · Project B**
**Brand:** A Una Milla de Tu Destino (Instagram: @aunamilladetudestino)
**Tagline:** *Same trip. Much less money.*
**Challenge type:** Individual. Choose one project and build your own version.

> **How to read this document**
> Sections marked **[BRIEF]** come directly from the hackathon slides. Sections marked **[PROPOSED]** are my suggestions to fill the gaps (architecture, data model, MVP scope, etc.). Adjust them to your own judgment.
>
> **2026-10-26 update:** For current product truth see `docs/decision.md` (D1–D28) and `docs/OVERVIEW.md`. Where they differ from this brief, the decisions win — chat-first (D1), Duffel real booking for cash fares (D25), per-card point values (D19). `docs/flow.md` is the behavior of record.

---

## 1. Project Overview [BRIEF]

### 1.1 The Idea
Travel hacking, made simple for anyone. The app lets a user check a trip, see how much they could save by travel hacking it, and book the flight.

### 1.2 The Problem
Most people pay full price because travel hacking feels complicated. Miles, points, flexible dates, nearby airports and smarter routes can all produce real savings, but finding them takes specialist knowledge and hours of searching.

### 1.3 The Core Question
Every user is asking: **"How much could I save on this trip?"**

### 1.4 What We Will Build
An app that answers that question in seconds, then lets the user book.

### 1.5 The Guiding Principle
> **The savings are the product. Make them impossible to miss.**

Every design and product decision should make the savings number the most visible, most trusted and most understandable thing on screen.

---

## 2. The Brief [BRIEF]

Build an app where anyone can:

1. **Enter a trip**, either a full plan or a quick short flight.
2. **See the normal price, the hacked price and the savings.**
3. **Book the flight**, or get clear steps to book it.

**Suggested first step:** learn how travel hacking works (see Section 11).

---

## 3. Two Ways In [BRIEF]

| | Option 1: Quick Flight | Option 2: Full Trip Plan |
|---|---|---|
| **Purpose** | One route, one answer | Several stops, dates and travellers |
| **Target user** | Someone who knows where they want to go | Someone planning a bigger trip |
| **Savings potential** | Moderate | Highest (where the biggest savings usually are) |
| **Experience** | Fast and simple | Complete and detailed |

Both entry points must lead to the same result: a clear comparison of normal price vs hacked price, and a path to booking.

---

## 4. Target Users [PROPOSED]

| Persona | Description | Needs |
|---|---|---|
| **The Casual Traveller** | Books 1–3 trips a year, pays full price, has never heard of award flights | One-tap answer, plain-language explanations, zero jargon |
| **The Points Holder** | Has miles/points in a few programs and doesn't know how to use them | Enter balances, see the best redemption |
| **The Planner** | Organizes multi-city trips with family or friends | Multi-stop routing, several travellers, flexible dates |
| **The Deal Hunter** | Follows travel-hacking content (e.g. the Instagram audience) | Alerts, saved trips, total-saved tracker |

---

## 5. Features

The slides list these as "a starting point, not the full list." The jury also rewards **cases you found that nobody asked for**, so Section 5.4 is where you should differentiate.

### 5.1 Features From the Brief [BRIEF]

#### Search
- Quick flight or full trip plan
- Flexible dates and nearby airports
- Several stops and travellers
- Paste a booking link or screenshot
- Miles and points the user already has

#### Savings
- Normal price against hacked price
- Savings in euros and percentage
- Miles, points and transfer partners
- Smarter routes and stopovers
- Why each saving works, explained simply

#### Booking and More
- Book the flight inside the app
- Step-by-step guide for award bookings
- Price alerts for saved trips
- Saved trips and total saved
- Fully responsive, mobile first

### 5.2 Detailed Feature Specifications [PROPOSED]

#### F1. Trip Entry (Quick Flight)
- Fields: origin, destination, departure date, optional return date, passengers, cabin class.
- Airport autocomplete (IATA code + city name).
- Toggle: *Flexible dates (±3 days)* and *Include nearby airports*.
- **Acceptance:** a user can go from landing page to a result in under 3 interactions.

#### F2. Trip Entry (Full Trip Plan)
- Add multiple legs (A → B → C → D), each with a date or date range.
- Add multiple travellers with different origins if needed.
- Reorder, edit and delete legs.
- **Acceptance:** a 4-leg trip with 2 travellers produces a single combined savings summary.

#### F3. Paste a Booking Link or Screenshot
- User pastes a URL or uploads a screenshot of a flight they were about to book.
- App extracts route, dates, price and passengers (AI/vision extraction), then pre-fills the trip form for confirmation.
- **Acceptance:** extracted fields are shown for the user to confirm or correct before searching.

#### F4. Loyalty Wallet (Miles and Points)
- User adds programs and balances (e.g. airline miles, bank points).
- App considers only what the user actually has, plus what could be reached via transfer partners.
- Balances persist for signed-in users.
- **Acceptance:** results change visibly when balances change.

#### F5. Savings Engine
For each trip, compute and display:
- **Normal price**: cheapest standard cash fare for the request.
- **Hacked price**: best strategy found (award redemption, date/airport shift, routing trick, stopover).
- **Savings**: absolute (€) and percentage (%).
- **Strategy label**: e.g. "Use 30,000 miles + €45 taxes" or "Fly from nearby airport".
- **Confidence indicator**: how reliable the figure is (live data vs estimate).

#### F6. "Why This Works" Explainer
- Each saving includes a 1–3 sentence plain-language explanation.
- Optional expandable detail for curious users.
- **Acceptance:** no unexplained jargon; every term (e.g. "transfer partner") has a tooltip.

#### F7. Smarter Routes and Stopovers
- Suggest alternative routings and free/cheap stopovers that reduce cost or add a bonus destination.
- Show the comparison against the direct option.

#### F8. Booking
- **Path A: In-app booking** (if a flights/booking API is available).
- **Path B: Guided booking**: a step-by-step guide showing exactly where to go, what to search, which points to transfer, and what to click.
- **Acceptance:** every result ends in either a working booking action or a numbered guide.

#### F9. Saved Trips and Total Saved
- Save any result to an account.
- Dashboard shows all saved trips and a running **"Total saved"** figure.

#### F10. Price Alerts
- Subscribe to a saved trip.
- Notify (email and/or push) when the hacked price or savings change meaningfully.

#### F11. Responsive, Mobile-First UI
- Designed for phone screens first, scaling up to tablet and desktop.
- Large tap targets, minimal typing, sticky "Savings" summary.

### 5.3 Priority Matrix [PROPOSED]

> **Superseded 2026-10-26 by the settled decisions (D1, D19–D26). The current tiers live in `docs/OVERVIEW.md`:** the product is chat-first, the MVP issues real Duffel bookings for cash fares, plan mode is the runway. The matrix below is kept for history.

| Priority | Feature |
|---|---|
| **P0 (MVP, must work end to end)** | F1 Quick Flight, F5 Savings Engine, F6 Explainer, F8 Booking (guided at minimum), F11 Mobile-first UI |
| **P1 (strong differentiators)** | F2 Full Trip Plan, F4 Loyalty Wallet, F9 Saved Trips + Total Saved, F7 Smarter Routes |
| **P2 (polish and wow factor)** | F3 Paste link/screenshot, F10 Price Alerts, in-app booking |

> **Advice:** The jury's first criterion is *completeness*, meaning how much of the real flow works end to end. A smaller feature set that works fully beats a large set that is half-built.

### 5.4 "Cases Nobody Asked For" [PROPOSED]

Ideas to boost the *Product thinking* score:

1. **Savings Share Card**: generate a shareable image ("I saved €412 on Madrid → Lima") for Instagram, matching the brand's social audience.
2. **Cash vs Points Verdict**: a clear "use points" / "pay cash" recommendation, because points aren't always worth it.
3. **Points Value Calculator**: cents-per-point value of each redemption.
4. **Date Heatmap**: calendar view showing the cheapest hacked days.
5. **Group Trips**: travellers departing from different cities converging on one destination.
6. **Positioning Flights**: suggest a cheap flight to a nearby hub to unlock a much cheaper long-haul.
7. **Transfer Bonus Watch**: highlight when banks run limited-time transfer bonuses.
8. **Risk Warnings**: flag award availability volatility, fuel surcharges, separate-ticket risk and tight connections.
9. **Spanish / English Toggle**: fits the brand name and likely audience.
10. **Beginner Mode vs Expert Mode**: hide or reveal technical depth.
11. **Offline-friendly Saved Trips**: usable at the airport.
12. **Empty/Error States with Personality**: "No hack found today. Here's a date that works."
13. **Savings Leaderboard / Streaks** (optional, gamification).
14. **Accessibility**: screen-reader labels, contrast, reduced-motion support.

---

## 6. User Flows [PROPOSED]

### 6.1 Quick Flight Flow
```
Landing → Choose "Quick Flight" → Enter route, dates, travellers
        → (Optional) add miles/points → Loading state
        → Results: Normal price | Hacked price | Savings
        → "Why this works" → Book / Guided steps → (Save trip)
```

### 6.2 Full Trip Plan Flow
```
Landing → Choose "Full Trip Plan" → Add legs, dates, travellers
        → (Optional) add wallet → Loading state
        → Combined results + per-leg breakdown
        → Savings summary → Book / Guided steps → Save trip → Set alert
```

### 6.3 Screenshot / Link Flow
```
Landing → "Paste link or screenshot" → Extraction → Confirm details
        → Same results flow as above
```

### 6.4 Returning User Flow
```
Sign in → Dashboard (Total saved, saved trips, alerts) → Open trip → Re-check price
```

---

### 7. Screens [PROPOSED — superseded shape, see D1 and `docs/flow.md`]

**D1 (2026-10-26): the chat is the product.** The thread with generative cards is screen 0; the forms below exist only as shortcuts into the same engine.

| # | Screen | Key Elements |
|---|---|---|
| 0 | **Chat thread (the shell)** | Composer, one-tap test persona, generative cards, badges `en vivo / cacheado / estimación / proyección` (D26) |
| 1 | Landing / Home | Value proposition, two prompt starters (plan / book now), example savings |
| 2 | Quick Flight Form | Route, dates, passengers, flexibility toggles |
| 3 | Full Trip Planner | Leg builder, traveller manager |
| 4 | Wallet | Programs, balances, transfer partners |
| 5 | Loading / Searching | Progress states ("Checking points programs…") |
| 6 | Results | Normal vs hacked vs savings, strategy, confidence |
| 7 | Explainer Drawer | Plain-language "why this works" |
| 8 | Booking / Guide | In-app checkout or numbered steps |
| 9 | Saved Trips Dashboard | Trip list, **Total saved**, alerts |
| 10 | Alert Settings | Thresholds, channels |
| 11 | Share Card | Generated savings image |

---

## 8. Design and Branding [BRIEF + PROPOSED]

The jury evaluates **branding, UI, details and mobile experience**.

**Observed in the brief's visual language (reuse for consistency or take inspiration):**
- Warm, editorial palette: deep espresso brown, cream/off-white and terracotta orange accent.
- Bold, geometric sans-serif headlines with generous spacing.
- Uppercase, letter-spaced orange eyebrow labels.
- Clean cards with strong contrast between light and dark panels.

**Design requirements [PROPOSED]:**
- The **savings figure is the hero** of the results screen: largest type, highest contrast.
- Show a clear **before → after** comparison (strikethrough normal price, highlighted hacked price).
- Consistent spacing scale, type scale and colour tokens.
- Thoughtful micro-interactions (count-up savings, subtle transitions).
- Mobile-first: thumb-reachable primary actions, no horizontal scrolling.
- WCAG AA contrast minimum.

---

## 9. Technical Specification [PROPOSED]

The jury scores **technical quality**: real time, security, scalability and cost.

### 9.1 Suggested Architecture
```
[ Client: Responsive Web App / PWA ]
              │
        [ API Layer ]
   ┌──────────┼────────────┐
   │          │            │
[Search &   [AI Service]  [Auth & DB]
 Pricing]    (extraction,  (users, trips,
(flights,     explanations) wallet, alerts)
 awards)
   │
[Savings Engine]  →  [Booking / Deep links]
   │
[Job Queue / Cron] → Price alerts → Notifications
```

### 9.2 Suggested Stack (swap for what you know best)
| Layer | Options |
|---|---|
| Frontend | Next.js or React + Tailwind (PWA, mobile-first) |
| Backend | Next.js API routes, Node/Express, or FastAPI |
| Database | PostgreSQL / Supabase / Firebase |
| Auth | Supabase Auth, Auth.js, or Firebase Auth |
| AI | Claude API for screenshot/link extraction, explanations, and strategy reasoning |
| Flight data | **Settled → D25 (2026-10-26): Duffel Flights API** — cash search + pricing AND real booking in one integration (offer → price re-verification → order; free test mode, sandbox airline). ~~Amadeus~~ Self-Service decommissioned 17 Jul 2026, enterprise-only — do not build against it. Kiwi/Tequila, Skyscanner-type APIs as fallback candidates only |
| Award data | **Settled → D29 (2026-10-26): the labelled demo fixture** — no paid keys; award figures badged `estimación`, manually refreshed from seats.aero's free website tier per D30. ~~seats.aero partner API~~ skipped (paid + commercial-permission-gated). No universal free award API exists; curated/seeded data must stay labelled `estimación` |
| Jobs | Cron / queue (e.g. Supabase cron, Vercel cron, BullMQ) |
| Hosting | Vercel / Netlify / Railway / Fly.io (needs a **live URL**) |

### 9.3 Core Data Model
```
User            (id, email, name, locale, created_at)
LoyaltyProgram  (id, name, type[airline|bank|hotel], currency)
WalletBalance   (id, user_id, program_id, balance)
TransferPartner (id, from_program_id, to_program_id, ratio, bonus_pct?)
Trip            (id, user_id, type[quick|full], status, created_at)
TripLeg         (id, trip_id, origin, destination, date_start, date_end?, order)
Traveller       (id, trip_id, name?, age_group, origin?)
SearchResult    (id, trip_id, normal_price, hacked_price, savings_eur,
                 savings_pct, strategy, points_used?, taxes?, confidence,
                 explanation, created_at)
Alert           (id, trip_id, threshold, channel, active)
Booking         (id, trip_id, provider, reference, status, price_paid)
```

### 9.4 Key API Endpoints [updated 2026-10-26 — chat-first + Duffel per D1/D25; full contracts in `docs/flow.md` F12/F8]
| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/chat` | The thread. LLM parses the intent only; the rules engine computes (F12). Streams recruiter-card payloads |
| POST | `/api/search/offers` | Duffel offer request for candidate dates (cash fares + taxes) |
| POST | `/api/book` | Price re-verification → order creation (Duffel test mode). Never pay off a stale snapshot |
| GET/PUT | `/api/wallet` | Programs, balances, selected card (D19 gate) |
| GET/POST | `/api/trips` | Saved itineraries; batch check ("Comprobar todos") re-runs F12 per itinerary |
| GET/PUT | `/api/admin/settings` | Horizon, provider, flags (cap enforcement ships post-v1 per D22) |

### 9.5 Savings Engine Logic [PROPOSED]
1. **Baseline:** get the cheapest standard cash fare for the exact request.
2. **Generate candidate strategies:**
   - Shifted dates (±N days)
   - Nearby origin/destination airports
   - Award redemption with the user's points
   - Transfer-partner redemption
   - Alternative routing / stopover / positioning flight
3. **Price each candidate** in euros (convert points via a value-per-point assumption plus taxes/fees).
4. **Rank** by net savings; discard options with risk or hassle above a threshold.
5. **Return** the best option plus 1–2 alternatives, each with explanation and confidence.

> **Important:** Be transparent when numbers are estimated. A trustworthy app beats an impressive but misleading one.

### 9.6 Non-Functional Requirements
| Area | Requirement |
|---|---|
| **Real time** | Results within seconds; stream progress or partial results; live price refresh on trip re-check |
| **Security** | Hashed credentials / managed auth, HTTPS only, input validation, secrets in env vars, rate limiting, no raw payment data stored, safe handling of uploaded screenshots |
| **Scalability** | Stateless API, caching of repeated searches, background jobs for alerts |
| **Cost** | Cache flight API calls, limit AI calls (batch/cached), use free tiers, set per-user rate limits |
| **Performance** | Fast first load on mobile, lazy-loaded assets, optimized images |
| **Reliability** | Graceful fallbacks if a data provider fails; clear error states |
| **Privacy** | Minimal data collection; allow deleting account and trips |

---

## 10. Use of AI [BRIEF + PROPOSED]

The jury evaluates *how AI and agents were used along the way*. That covers both the product and your build process.

**AI inside the product:**
- Extract trip details from pasted links and screenshots.
- Generate plain-language "why this works" explanations.
- Reason over strategies and recommend the best option.
- Conversational assistant ("Where could I go for under €300?").

**AI in your build process (document this for the demo):**
- Using AI coding assistants/agents to scaffold, build and refactor.
- Using AI for design iteration, copy and test data.
- Keep a short log of prompts/agents used and what they accomplished.

---

## 11. Research Starting Point: Travel Hacking Basics [PROPOSED]

Before building, learn and encode these concepts:

- **Award flights:** book with miles/points instead of cash.
- **Transfer partners:** move points from banks/cards to airline programs, often at 1:1.
- **Points value:** compare cents-per-point to decide whether to pay cash or points.
- **Flexible dates:** moving a day or two can change prices a lot.
- **Nearby airports:** a short ground trip may save hundreds.
- **Stopovers and open-jaws:** multi-city routings sometimes cost the same as a single destination.
- **Positioning flights:** cheap flight to a hub to start a cheaper long-haul.
- **Hidden-city / fuel surcharge / taxes:** know the risks and rules (some tactics violate airline terms; flag them clearly or avoid).

---

## 12. Rules and Deliverables [BRIEF]

| Stage | What is Required |
|---|---|
| **Before Demo Day** | **Live URL** and **Code repository**, both shared in advance so the jury can try the app |
| **Final Day (3 minutes each)** | 1. What you built<br>2. How you built it<br>3. What you would do next |
| **Result** | A jury chooses the best project; the winner gets a prize |

**Format:** Individual challenge. Choose one project (A or B) and build your own version.

---

## 13. Judging Criteria [BRIEF]

| # | Criterion | What the Jury Looks At | How to Win It |
|---|---|---|---|
| 01 | **Completeness** | How much of the real flow works, end to end | Ship one full path (search → savings → book/guide) before adding extras |
| 02 | **Product thinking** | The cases you found that nobody asked for | Pick 3–5 items from Section 5.4 and execute them well |
| 03 | **Design and taste** | Branding, UI, details and mobile experience | Strong savings hero, consistent system, polished mobile layout |
| 04 | **Technical quality** | Real time, security, scalability and cost | Caching, auth, validation, rate limiting, clean architecture |
| 05 | **Use of AI** | How AI and agents were used along the way | AI in both product features and build workflow, documented |

---

## 14. Suggested Build Plan [PROPOSED]

| Phase | Goal | Output |
|---|---|---|
| **0. Research** | Understand travel hacking; pick data sources | Notes, API keys, seed data |
| **1. Foundation** | Repo, hosting, auth, design tokens, DB | Deployed "hello world" with a live URL |
| **2. Core Flow (MVP)** | Quick Flight → savings result → guided booking | Working end-to-end path |
| **3. Depth** | Wallet, full trip plan, explainers, saved trips | Richer product |
| **4. Differentiators** | Share card, alerts, screenshot extraction, extras from 5.4 | "Wow" features |
| **5. Polish** | Mobile QA, error states, performance, security pass | Demo-ready app |
| **6. Demo Prep** | 3-minute script, test data, backup recording | Confident presentation |

> **Tip:** Deploy early and keep the live URL working at all times. Do not leave it until the last day.

---

## 15. Definition of Done (MVP Checklist) [PROPOSED]

- [ ] Live URL is accessible and stable
- [ ] Code repository is shared and has a clear README
- [ ] User can enter a quick flight and receive a result
- [ ] Result shows **normal price, hacked price, and savings (€ and %)**
- [ ] Each result has a plain-language explanation
- [ ] User can book or follow clear step-by-step booking instructions
- [ ] Works well on mobile and desktop
- [ ] Handles empty, loading and error states
- [ ] No secrets committed; inputs validated
- [ ] At least 3 "nobody asked for" features implemented — named 2026-10-26: **test persona one-tap on F0**, **"Comprobar todos" batch check**, **range-with-cause projections (D26)**
- [ ] AI used in the product and the build process is documented
- [ ] 3-minute demo script prepared (What / How / Next)

---

## 16. Demo Script Outline (3 Minutes) [PROPOSED]

| Time | Section | Content |
|---|---|---|
| 0:00–0:30 | **The problem** | "Most people pay full price because travel hacking feels complicated." |
| 0:30–1:45 | **What I built** | Live walkthrough: enter a trip → see savings → book/guide; show 1–2 differentiator features |
| 1:45–2:25 | **How I built it** | Architecture in one slide; how AI and agents were used |
| 2:25–3:00 | **What's next** | Real booking integration, more programs, alerts at scale, community deals |

---

## 17. Risks and Open Questions [PROPOSED]

| Risk / Question | Mitigation |
|---|---|
| Real award-availability data is hard to get | Use a mix of live cash fares plus curated/estimated award pricing, clearly labelled |
| Flight API limits and cost | Cache aggressively; use free tiers; limit searches per user |
| In-app booking requires licensed partners | Offer guided booking / deep links as the reliable fallback |
| Inaccurate savings damage trust | Show a confidence indicator and "estimate" labels |
| Some hacks violate airline terms | Flag risk clearly; prioritize safe, legitimate strategies |
| Scope creep | Lock the MVP checklist (Section 15) before adding extras |

---

## 18. Glossary [PROPOSED]

| Term | Meaning |
|---|---|
| **Travel hacking** | Using points, miles, routing and timing strategies to pay less for travel |
| **Award flight** | A flight booked with miles/points |
| **Transfer partner** | A program that lets you move points between loyalty currencies |
| **Stopover** | A deliberate extended stay at a connecting city |
| **Open-jaw** | A trip arriving in one city and departing from another |
| **Positioning flight** | A cheap flight to a different airport to start a cheaper journey |
| **CPP (cents per point)** | The cash value you get from each point or mile |
| **Hacked price** | The lowest price found using travel-hacking strategies |

---

*End of specification.*
