# hackathon-1-TAHER-ezzi — A Una Milla

**Hackathon 1 · Project B** · [A Una Milla de Tu Destino](https://www.instagram.com/aunamilladetudestino)

Travel hacking made simple for Spain: a conversational app that answers **“How much could I save on this trip?”** with price, points, how to earn them, and guided booking steps. Cash fares target **Duffel** (test mode in v1); award seats stay on official guided paths.

**Demo spine:** Madrid → Johannesburg, Business, 90 days — Iberia / British Airways / Qatar, Revolut + Amex Business Platinum.

---

## Status (October 2026)

| Layer | State |
|---|---|
| Product docs | Complete — decisions, flows, action plan, overview |
| Postgres schema | Applied on Supabase (migrations in `supabase/migrations/`) |
| Reference research | Notes + shallow clones (clones are **not** in this repo) |
| Next.js app / chat UI | Planned — see `docs/ACTION_PLAN.md` Phase 1 |

There is no `package.json` yet. This repository is the **spec, process, database, and integration groundwork** for the build week.

---

## Start here

1. **`docs/OVERVIEW.md`** — map of the project, MUST vs later scope, open gaps.
2. **`docs/decision.md`** — settled product truth (wins over the brief when they differ).
3. **`docs/flow.md`** — journeys F0–F12 (happy, edge, failure).
4. **`docs/ACTION_PLAN.md`** — ordered phases for the hackathon week.
5. **`docs/cursor.md`** — how to run Cursor sessions (TDD, slices, prompts).

Full brief: `A_Una_Milla_Project_Specification.md`. Source synthesis: `docs/SUMMARY.md`.

---

## Repository layout

```text
docs/                    Product and process (read OVERVIEW first)
supabase/migrations/     Postgres schema, seed, advisor fixes
lib/database.types.ts    Generated Supabase TypeScript types
components-and-math.md   Borrow vs invent — formulas and datasets
research/                Reverse-engineering notes (repos re-cloned locally)
scripts/                 Vendor smoke tests (e.g. Duffel)
.cursor/rules/           Workspace TDD and review rules
.agents/skills/          Supabase agent skills (local)
```

**Not in git:** `.env`, `research/repos/**` (third-party shallow clones — see `research/Reverse-Engineering-Notes.md`).

---

## Local setup

### 1. Secrets

```bash
cp .env.example .env
```

Fill in your own keys. **Never commit `.env`.** Required for the current groundwork:

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser-safe anon key |
| `supabase_secret_key` | Server-only service role |
| `SUPABASE_ACCESS_TOKEN` | CLI (`supabase link`, `db push`) |
| `duffel_api_key` | Duffel test token (`duffel_test_…`) |
| `grok_api_key` | LLM for chat (OpenAI-compatible Grok API) |

Award availability in v1 uses a **labelled fixture** (no paid seats.aero key). See `docs/decision.md` D29–D30.

### 2. Database

Install [Supabase CLI](https://supabase.com/docs/guides/cli), link your project, and apply migrations:

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

Regenerate types after schema changes:

```bash
supabase gen types typescript --linked > lib/database.types.ts
```

### 3. Duffel smoke test

Confirms test-mode API access (does not print tokens):

```bash
node scripts/duffel-smoke.mjs
```

---

## Stack (decided)

TypeScript, React, Next.js, PostgreSQL via Supabase, Zod, Vitest, Playwright. Streaming chat with generative UI cards. Details and trade-offs: `docs/decision.md` D7.

---

## Contributing / build method

- **Red → green → refactor** for behavior changes (`.cursor/rules/tdd-red-green-refactor.mdc`).
- One action-plan slice per session; do not widen scope mid-slice.
- Provider failures return typed errors — never silent zeros or empty catches in app code.

---

## Author

**Taher Ezzi** — [@TaherEzzi](https://github.com/TaherEzzi)

Hackathon delivery with Sustraiak methodology (slides captured in `docs/slides-11-44-actions.md`).

---

## Attribution

Transfer valuation data (when loaded in-app) must credit the CC-BY-4.0 **points-transfer-valuations** dataset per `components-and-math.md` §3. MIT utilities ported from repos listed in `research/Reverse-Engineering-Notes.md` carry their original licenses.
