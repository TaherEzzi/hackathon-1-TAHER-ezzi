# Slides 11–44 — Actions for A Una Milla

Source: `Sitio web Sustraiak (Copy).html`, sections labelled slides 11 through 44.
Each slide below is turned into work on this product. Speaker notes are kept where they change the task.

Do these in order. Slide 11 is the map. Slides 20–31 are the build stages. Slides 34–41 are how the Cursor sessions run (`cursor.md`).

> **Historical note (2026-10-26):** several slides name Award Travel Finder and Seats.aero as research prompts. Those are kept verbatim as the deck method, but the provider outcome is settled: **D29 — no paid keys**, fixture award layer, Duffel cash side. Where a slide prompt conflicts, `docs/decision.md` wins.

---

## Slide 11 — From idea to delivery in twelve steps

**Note:** Quality is decided before the first line and after the last one. Coding is one of twelve steps.

| Stage | Steps | Done when |
|---|---|---|
| Understand | 01 Find information · 02 Find references · 03 Ask AI | Guide, Plan.pdf, and ten reference products are written down. |
| Design | 04 Branding · 05 UI · 06 Flows and features | Tokens exist. Every flow in `flow.md` has happy, edge, and failure states. |
| Build | 07 Code with agents | Chat → card → save → booking steps works on the MAD–JNB case. |
| Harden | 08 Security · 09 Scalability · 10 Cost · 11 Testing | Auth is a managed provider. Caps exist. Tests cover the core flow. |
| Ship | 12 Delivery | Live URL, repo, phone-tested, monitored. |

---

## Slide 12 — Use AI for everything

**Note:** Ten minutes stuck without asking is ten minutes wasted.

| Situation on this project | Ask |
|---|---|
| New domain (Avios, RevPoints, fuel surcharges) | How does this actually work in Spain, and what do people get wrong? |
| New technology (ATF enterprise API, Seats.aero, Stripe) | Best options and why, with cost and quota. |
| An error | Paste the error with the file, the input, and what you expected. |
| Stuck | Stop at ten minutes and ask with the failing case. |

---

## Slide 13 — Think the whole project

Order before code: inspiration → thinking → planning → architecture. Then cover every angle.

| Angle | Concrete bar for this app |
|---|---|
| SEO | Landing explains the saving in one sentence. Title, description, Open Graph. |
| Loading speed | First card of a cached route appears without a blank wait. |
| Branding | Espresso, cream, terracotta from the spec. Savings number is the largest type. |
| Responsive | Phone first. Chat input and the primary card action sit in thumb reach. |
| Accessibility | Buttons named, contrast AA, `prefers-reduced-motion` honoured. |
| Copywriting | Spanish for the user. No unexplained jargon. “Transfer partner”, “taxes”, “RevPoint” have one-line explanations. |
| Analytics | Count searches, saves, and booking-step opens. No PII in event names. |
| Security | Managed auth, server-side checks, secrets in env, rate limits. |

---

## Slide 14 — Think beyond the request

**Note:** Work the four layers out. The deck’s example was Iturrieta. Here it is A Una Milla.

| Layer | For this brief |
|---|---|
| 01 What they ask for | Talk to an AI and get from zero to a booked flight. Show price, points, how to earn, and the saving. |
| 02 What they want but did not say | A person who paid for a consulting session should get that same plan without waiting for Eriz: which card, whether to buy points, whether to move Avios, and whether cash is actually cheaper. |
| 03 What they do not know they need | A verdict that sometimes says **pay cash**. A block on buying points before a seat exists. A 30-day account warning before an Avios transfer. A points runway for “this summer”. |
| 04 What others would need | The same agent for another Spain-based points ecosystem later. Build the rules as data, with Avios and RevPoints as the first pack. |

Also from the slide:

- **Parallel thinking.** Run two or three approaches (ATF versus Seats.aero versus a curated chart) before locking one. Worktrees in `cursor.md`.
- **Out of the box.** Ask what the obvious “search awards” answer misses. The guide’s answer is the earn path and the transfer path, not another search box.

---

## Slide 15 — Good taste is in the details

| State | What the user sees |
|---|---|
| Empty | First open: one example, MAD–JNB Business, and two prompts (“Quiero ir en verano”, “Lo quiero ya”). |
| Loading | Named steps, never a blank thread: “Buscando premios…”, “Comparando con el precio en efectivo…”, “Calculando si te compensa…”. |
| Error | Human language and a way out. Provider down → show the last saved reading and a retry. No seats → offer the nearest date that has one. |
| Mobile first | Designed at 360 px. Desktop is the expansion. |
| Consistency | One spacing scale, one type scale, one palette. Cards in the chat use the same components as the saved-trips screen. |
| Real content | Real route names, real Avios amounts, real tax currency. No “Lorem” and no “Card 1”. |

---

## Slide 16 — Developing good taste

Taste is the skill that does not copy. Daily input, then show the work.

| Habit | Apply it here |
|---|---|
| Watch | Award search UIs and chat products that render rich cards, not only text. |
| Read | Changelogs of the data providers we might pay. |
| Follow | Andrej Karpathy, Simon Willison, Guillermo Rauch, Emil Kowalski, Pieter Levels — as named on the slide. |
| Share | Post the savings card and the MAD–JNB thread for review before demo day. |

---

## Slide 17 — From zero to product

Section divider. One project, every layer, one builder. The stages that follow are the checklist.

---

## Slide 18 — Thinking in products

The client does not experience frontend, backend, or DevOps. They experience one product. If the earn math is right and the booking steps are wrong, the product is wrong.

Ownership for this build: brand, chat UI, savings math, Avios rules, admin, security, tests, and the live URL sit with the same builder.

---

## Slide 19 — Every component, listed before code

The deck’s example is a field-service platform. The same inventory, filled for A Una Milla:

| Area | Components |
|---|---|
| Brand | Wordmark, espresso / cream / terracotta, tone: direct, Spanish, no hype |
| Website | Landing with a real saving, legal pages (privacy, terms), SEO |
| Customer app | Sign-up and login, chat, generative cards, save itinerary, wallet (programs and balances), emails for transfer confirmation reminders |
| Team / owner | Eriz does not need a second app for the hackathon. A minimal admin covers users, request usage, and provider cost |
| Admin | Dashboard (searches, saves, estimated provider cost), roles (user, admin), audit of plan changes |
| Platform | Postgres, chat and search APIs, provider adapters, file storage only if screenshot upload ships |
| Quality | Unit tests on the rules engine, integration tests on adapters with fixtures, Playwright on the two intents |
| Operations | Hosting, CI with preview, backups, Sentry, analytics, a monthly cost note |

---

## Slide 20 — Stage 01 · Research and references

**Do:** Understand the business, the users, and the problem. Study ten products and the complaints. Collect flows to match or beat.

**Where:** Mobbin, Page Flows, Godly, Awwwards, Land-book, and an AI research pass.

**Reference set for this product**

1. The post-consulting guide itself (the quality bar for advice).
2. Seats.aero and its Google Flights extension.
3. SeatSpy.
4. Award Travel Finder (search and the enterprise API).
5. British Airways Combine My Avios.
6. Revolut plans and the RevPoints shop.
7. Google Flights (the cash side of the comparison).
8. Points Path / similar overlay tools, via the research notes.
9. The brand site aunamilladetudestino.com.
10. One chat product that renders structured cards inside a thread (for generative UI).

**Prompt, filled in**

> Act as a product strategist. Research how Spain-based travellers redeem Avios and Revolut RevPoints for long-haul business class. List the ten best products, what each one does well, the most common user complaints, and the features nobody offers yet. Weight the Madrid–Johannesburg business-class case and a 90-day earn window.

**Exit:** a one-page note of complaints we will not repeat (slow search, points shown without taxes, advice to buy points with no seat).

---

## Slide 21 — Stage 02 · Brand

**Do:** Personality first, then colour, type, and logo. A small system before the first screen. Apply it in the app and in any email.

**Where:** Brand New, Behance, Fonts In Use, Realtime Colors, Fontshare.

**Already settled by the spec and the deck:** deep espresso brown, cream, terracotta accent, geometric sans, uppercase letter-spaced eyebrows. The savings figure is the hero.

**Prompt, filled in**

> Create a brand identity for A Una Milla de Tu Destino: personality in three words, a colour palette with hex codes and when to use each, two font pairings, tone of voice with Spanish examples for a savings card and an error, and three logo directions. Keep the savings number as the loudest element.

**Exit:** tokens in code (`background`, `surface`, `text`, `accent`, `danger`) and three sample sentences: a verdict, a warning, an empty state.

---

## Slide 22 — Stage 03 · UI and components

**Do:** Start from proven components. One design system. Every state: hover, focus, loading, empty, error.

**Where:** 21st.dev, shadcn/ui, Magic UI, Aceternity, v0, Lucide or Phosphor.

**Components this product needs**

- Chat thread and composer.
- Result card: cash price, miles + taxes, saving in euros and percent, verdict.
- Earn card: Revolut plan math, shopping multiplier, “buy the shortfall” only when a seat exists.
- Transfer card: from program, to program, amount, both balances, 30-day and name-match warnings.
- Saved itinerary row.
- Step list for Combine My Avios.

**Prompt, filled in**

> Using shadcn/ui and Tailwind, build a savings result card for this brand: espresso #241B12, cream #F6F1E9, terracotta accent. Include hover, focus, loading, empty and error states, keyboard access, and full responsiveness from 360 px. The saving in euros is the largest text.

---

## Slide 23 — Stage 04 · Flows and features

**Do:** Map every journey for every role before screens. Happy path, edge cases, failures. Fewer features, finished.

**Tools:** Mobbin flows, FigJam or Whimsical, AI as a critic, five minutes with a real user.

**Prompt, filled in**

> List every user flow in A Una Milla for each role: traveller and admin. For each flow give the happy path, the edge cases, the failure cases, and exactly what the user sees. Include: plan a summer trip, book now, organic earn advice, Revolut plan choice, buy RevPoints, Shopping ×20, Avios transfer with a 30-day block, cash-better-than-miles, provider quota exceeded, and save itinerary.

The written flows are in `flow.md`. If a flow is not listed there, it is out of the current build.

---

## Slide 24 — Stage 05 · Motion

**Do:** Motion explains what changed. 150–300 ms. Never block the user. Respect reduced motion. Stay at 60 fps.

**Where:** Motion for React, GSAP, Rive, LottieFiles, View Transitions, Codrops.

**Use it for:** the savings number counting up, a card arriving under the assistant message, the step list advancing. Do not animate the chat background.

**Prompt, filled in**

> Add subtle motion with Motion for React: the savings figure counts up once, cards fade and rise in under 300 ms, buttons have a small press state. Respect prefers-reduced-motion. Do not animate layout in a way that moves the text the user is reading.

---

## Slide 25 — Stage 06 · Platform and technology

**Choice for this product** (detail and trade-off in `decision.md`):

| Need | Choice |
|---|---|
| Web app and chat UI | TypeScript, React, Next.js |
| APIs and business logic | TypeScript on the same app |
| Rules that must be tested (CPP, transfer eligibility, “do not buy yet”) | Pure functions, unit-tested |
| Data | PostgreSQL (Supabase) |
| Cache and queues | Redis only if a provider quota forces it; start with an in-process LRU |
| Real time | Streaming the assistant reply |
| Mobile | Responsive web. A native app is a later product |

**Prompt, filled in**

> I am building a Spanish award-travel chat with plan mode, book-now mode, Avios transfers, and Revolut earn math. Propose the architecture, the stack with a reason for each choice, the data model, and the main API endpoints. Highlight the risks and what changes at ten times the users. Assume award availability is a paid third-party API with a daily quota.

---

## Slide 26 — Stage 07 · Admin and roles

**Do:** The admin is a product for the owner. Roles from day one. Settings without a developer.

| Admin piece | In this app |
|---|---|
| Dashboard | Searches today, provider calls today, saves, estimated cost |
| Roles | Traveller and admin |
| Search and bulk | Find a user, see their request count, disable a key abuser |
| Audit log | Who changed the monthly price, the request cap, or a provider key reference |
| Settings | Request cap, search horizon, feature flags for “buy points” and “hotel accelerators”, editable without a deploy |

**Prompt, filled in**

> Design the admin panel for A Una Milla: roles and permissions, dashboard metrics, user management with search and a suspend action, an audit log, and the settings the owner can change without a developer (request cap, search horizon, Stripe price id, which provider is primary).

---

## Slide 27 — Stage 08 · Security

**Note:** AI will write insecure code quickly if you let it. Review before delivery.

| Check | Implementation |
|---|---|
| Authentication | Supabase Auth, Clerk, or Auth.js. Do not build auth |
| Authorisation | Server checks on every saved trip and admin route. Row-level security if Supabase |
| Validation | Zod on every request body |
| Secrets | Environment variables. Nothing in Git |
| Protection | Rate limits per user, security headers, dependency alerts |

**Prompt, filled in**

> Act as a security auditor. Review this codebase against the OWASP Top 10. List every vulnerability with severity, file and line, and the exact fix. Then apply the fixes and confirm each one. Pay extra attention to provider API keys, uploaded screenshots, and the chat endpoint.

---

## Slide 28 — Stage 09 · Scalability and cost

**Note:** Design for ten times the users. Build for today. Know the monthly cost per user, including AI calls.

| Lever | On this app |
|---|---|
| Database | Index trips by user, and search cache by route + dates + cabin |
| Caching | Cache award searches. Coalesce identical in-flight requests. This is how we stay inside partner quotas |
| Queues | Alerts and “recheck this saved trip” leave the request path |
| AI costs | Short prompts for the verdict. Cache explanations for the same strategy |
| Budgets | Alert on the provider account and the model account |

**Prompt, filled in**

> Analyse this architecture for 100 times the traffic. Identify bottlenecks, queries that need indexes, and what should be cached or queued. Estimate monthly cost at 1,000, 10,000 and 100,000 users, with award-search API calls and model tokens called out separately.

The cost spike itself is case P2 / P9 / P10 in `ACTION_PLAN.md`.

---

## Slide 29 — Quality first

Stop and treat this as a demo risk. Clients forget a beautiful screen. They remember the bug.

AI writes code faster, so this project tests more, not less. Excellent quality is how the hackathon demo holds.

---

## Slide 30 — Testing every layer

| Layer | Tool | What it covers here |
|---|---|---|
| Unit | Vitest | CPP after taxes, Revolut rates, “do not buy points yet”, 30-day transfer block, BA-as-bridge |
| Integration | API + database | Save itinerary, request cap, provider fixture in and card out |
| End to end | Playwright | Plan mode and book-now mode on MAD–JNB |
| Responsive | Playwright devices | 360 px and desktop |
| Access and speed | axe, Lighthouse | Usable and fast |
| Exploratory | You | Try to break the five rules |

**Definition of done**

- Tests pass in CI
- Edge cases covered (no seats, cash wins, account younger than 30 days, quota exceeded, missing balance)
- Works on mobile and desktop
- Nothing else broke
- Checked on the production URL

**Prompt, filled in**

> Write Playwright end-to-end tests for plan mode and book-now mode, including the error states: no availability, provider failure, and request cap reached. Run them, fix failures in the code, and repeat until every test passes.

Follow the repo rule: failing test first, then the smallest change, then refactor.

---

## Slide 31 — Stage 11 · Delivery

| Item | Bar |
|---|---|
| SEO | Meta, sitemap, schema, Open Graph with a real saving |
| Speed | Lighthouse 90+ on a real phone |
| Analytics | PostHog or Plausible |
| Monitoring | Sentry and an uptime check |
| Deploy | CI with preview links. Live URL shared before demo day |

**Prompt, filled in**

> Prepare this project for launch: audit SEO and Core Web Vitals, add meta tags, a sitemap, structured data and Open Graph images, set up error tracking and analytics, and write a launch checklist with every item verified.

Also from the note: a short demo video and a handover note. The 3-minute script is already outlined in the spec, section 16. Record it against the MAD–JNB thread.

---

## Slide 32 — Where to find what

Bookmark list from the deck. Use it; do not re-research the library each session.

| Need | Places |
|---|---|
| Components | 21st.dev, shadcn/ui, Magic UI |
| Screens and flows | Mobbin, Page Flows |
| Websites | Godly, Awwwards, Land-book |
| Brand and type | Brand New, Fonts In Use, Fontshare |
| Colour | Realtime Colors, Coolors |
| Motion | Motion, GSAP, Rive, LottieFiles |
| Icons | Lucide, Phosphor |
| Build with AI | Claude Code, Cursor, v0, Lovable |
| Test and monitor | Playwright, Vitest, Sentry |
| Deploy | Vercel, Netlify, Railway, Supabase |

---

## Slide 33 — Further efficiency

Section divider. Once the eleven stages are the process, multiply them with agents, skills, and tooling. The operating file is `cursor.md`.

---

## Slide 34 — Multi-agent workflows and loops

Roles: **Plan** splits the goal, **Build** writes code, **Review** checks quality and security, **Test** runs and verifies. Loop until it passes.

1. Run agents in parallel on separate tasks.
2. Let one agent review another’s work.
3. Close the loop: build, test, fix, repeat.

Mapping for this repo is in `cursor.md`.

---

## Slide 35 — From workflow to mindset

1. Write down how you build (`cursor.md` and this file).
2. Repeat it on every slice of the action plan and improve it.
3. It becomes the default, including for hackathon 2.

---

## Slide 36 — Iteration after iteration

Ship a working version early. Show it before it is perfect.

| Version | Bar | Maps to |
|---|---|---|
| v1 | Core flow works end to end | Chat, one route, cash vs miles, guided Avios steps |
| v2 | Feedback applied, edge cases covered | Five rules, 30-day block, no-seat and cash-wins states |
| v3 | Design polished, performance tuned | Motion, mobile, real copy |
| v4 | Secure, scalable, ready for real users | Auth, caps, Stripe, monitoring |

Demo day can be a strong v2 or v3. Do not demo a v1 with a known math bug.

---

## Slide 37 — Skills worth building

A skill is instructions, templates, and rules an agent can follow. The second time you solve something, package it.

| Skill | Why it exists on this project |
|---|---|
| Project setup with auth, database, and deploy | So hackathon 2 does not start from zero |
| Brand and UI system from a reference | The espresso / cream / terracotta card |
| Security review checklist | Slide 27 prompt, saved |
| SEO and performance pass | Slide 31 prompt, saved |
| Payments and notifications | Stripe plus the “Avios sent, check your email” reminder |
| Release notes and handover | Demo-day note for the jury |

---

## Slide 38 — Make the process yours

This deck is Eriz’s process. Sequence: take it, adapt it, package it, improve it after every project.

Adaptation already made for this repo: tests go red before production code (workspace rule), and the Spain Avios rules from the guide outrank a generic award-search template.

---

## Slide 39 — Tooling

| Tool | Role here |
|---|---|
| Claude Code | Agentic coding in the terminal, including from the phone |
| Cursor | The editor for this workspace. Rules already live in `.cursor/rules` |
| Devin or another IDE | Fine if it keeps the same loop |
| Phone | Send a task, review later |
| Commands | One command for repeated prompts (security review, Playwright loop, brand card) |

Minutes saved every hour are the point. The right tool per task is recorded in `cursor.md`.

---

## Slide 40 — Working while the agents think

While an agent runs:

- Research the next case (hotel accelerator, BA booster, a second route).
- Review what another agent just finished.
- Write the plan and the prompt for the next task.
- Test the latest build on your phone.

Tools named on the slide: Superpowers (brainstorm, plan, TDD, sub-agents), Graphify (codebase graph), sub-agent frameworks, and your own skills.

Waiting time is working time.

---

## Slide 41 — Parallel agents with worktrees

One git worktree per agent so three slices move at once. The builder reviews, decides, and merges.

```text
git worktree add ../milla-earn -b feature-earn
git worktree add ../milla-search -b feature-search
git worktree add ../milla-tests -b feature-tests
```

Suggested split for this product:

| Worktree | Agent owns |
|---|---|
| `feature-search` | Book-now cards, provider adapter, cash vs miles |
| `feature-earn` | Revolut math, shopping multiplier, 90-day runway |
| `feature-transfer` | Avios graph, 30-day rule, step list |
| `feature-tests` | Vitest rules and Playwright flows |

---

## Slide 42 — What this means for you

Personal stakes from the deck, kept because they set the standard for the demo:

1. Work at the level of the top 1% of developers.
2. Be paid for the value created.
3. Win back time.
4. Work on exciting projects.
5. Solve real problems for real people.
6. This is the job.

The real person in this repo is the traveller in the guide, trying to sit in Business to Johannesburg without wasting the points.

---

## Slide 43 — Standing apart from the 99%

From Alexandr Wang, as quoted on the slide. Execution is the moat.

| Principle | On this hackathon |
|---|---|
| Absolute focus | One product: the Spain Avios agent. Hackathon 2 waits until hackathon 1 has a live path. |
| Over-deliver | The brief asks for a saving. Also ship the five rules, the transfer warnings, and a saved itinerary. |
| Targeted output | Every day ends on a flow from `flow.md` that a stranger can complete. |

---

## Slide 44 — Two hackathons

Divider into the briefs. Hackathon 1 is this product (Iturrieta or A Una Milla). The build that follows is A Una Milla. Hackathon 2 is a separate project and stays out of these files until the live URL for this one exists.
