# Cursor — How to build A Una Milla in this repo

Operating manual for Cursor sessions on this project. It applies slides 12, 29–30, and 34–41 to the files we already have.

Read first, in this order: `docs/SUMMARY.md`, `docs/decision.md`, `docs/flow.md`, `docs/ACTION_PLAN.md`.

---

## 1. What “done” means in a session

A session is done when:

- The slice from `ACTION_PLAN.md` that you picked has a failing test that you watched fail, then a change that makes it pass.
- The five guide rules still hold (see `decision.md`, invariants).
- You did not widen the slice into the next case.
- You say which flow you exercised and what you could not run.

Workspace rules already require red → green → refactor, a review of types, errors, modules, and cost, and a short design note before multi-file work. Follow them. This file says how they show up in Cursor.

---

## 2. Session loop

Match slide 34: plan, build, review, test, and repeat until the slice passes.

1. **Plan.** Name the case id (`G3`, `P5`, …). Paste the flow from `flow.md`. State the one assertion the new test will make.
2. **Red.** Add the test next to the existing test layout. Run it. Quote the failure.
3. **Green.** Smallest production change. Run the test again.
4. **Review.** Diff against types, errors, one reason to change per file, and unbounded loops. Security-sensitive slices get the slide 27 prompt.
5. **Refactor** only after green. Re-run the test.
6. **Phone check** when the slice is visible UI. Loading, empty, and error included.

While a long agent turn runs, do the next piece of research or write the following prompt. Do not sit on a spinner (slide 40).

---

## 3. Roles when more than one agent is running

| Role | Does | Does not |
|---|---|---|
| Plan | Splits one action-plan item into testable tasks | Write production code |
| Build | Implements the failing test | Change provider choice or pricing |
| Review | Reads the diff for secrets, auth gaps, and rule violations | Add features |
| Test | Runs Vitest and, for flows, Playwright | Declare success without a command output |

One worktree per agent (slide 41). **Prerequisite: the repo must be a `git` repo first.** It is not one yet — run `git init`, commit, and add a remote before any parallel work:

```bash
git worktree add ../milla-earn -b feature-earn
git worktree add ../milla-search -b feature-search
git worktree add ../milla-transfer -b feature-transfer
```

Merge only after the tests in that worktree pass. You decide. The agent does not merge onto the main line by itself.

---

## 4. Prompts to paste

Keep them short. Attach the case id and the file the test should land in.

**Rules engine**

> Add a failing Vitest for case G4: buying RevPoints is refused when no award seat is attached, and allowed only for the shortfall when a seat, a mileage cost, and a balance are present. Run the test, show me the failure, then make the smallest change.

**Transfer block**

> Add a failing test for case G5: a transfer from British Airways to Iberia is blocked when either account is under 30 days old or the names differ. The error text tells the user which check failed. No transfer instructions in that response.

**Chat card**

> For case P3, render a result card under the assistant message with cash price, miles plus taxes, saving in euros and percent, and one sentence on why. Include loading, empty, and error. Savings text is the largest element. Mobile width 360.

**Security pass**

> Act as a security auditor. Review the chat and provider adapter against the OWASP Top 10. List each issue with severity, file and line, and the fix. Apply the fixes. Do not print secret values.

**Do not paste** a prompt that asks the agent to scrape airline sites, bypass a quota, or store card numbers. Booking stays on the partner’s own page or a documented affiliate link.

---

## 5. Tool per task

| Task | Tool |
|---|---|
| Rules, API routes, UI components | Cursor agent in this repo |
| Long parallel slices | Separate worktrees, one agent each |
| Visual exploration of a card | v0 or a 21st.dev component, then adapt to the brand tokens |
| Provider docs and pricing pages | A research pass with links saved into `docs/decision.md` |
| Browser proof of a flow | Cursor browser tools, or Playwright if the dev server is up |
| Repeated review | A Cursor command or skill once the same prompt has been used twice (slide 37) |

Existing Cursor rules in `.cursor/rules/` stay on: TDD, debug from the cause, brainstorm before a wide change, review before you call it done.

---

## 6. Files the agent may create or edit

| Allowed during a slice | Leave alone unless the task says so |
|---|---|
| App source, tests, `docs/ACTION_PLAN.md` checkboxes | `research/repos/**` (reference only) |
| `.env.example` with key names | Real `.env` secrets |
| A short note in `docs/decision.md` when a decision flips | Rewriting `SUMMARY.md` to match a guess |

---

## 7. Definition of done, from slide 30

- Tests pass.
- Edge cases for that slice are covered.
- Mobile and desktop both work when the slice has UI.
- Neighbouring flow still works.
- The live or preview URL was opened for UI slices.

---

## 8. When to stop and ask

Ask the user, and do not invent the answer, when the slice needs:

- The Award Travel Finder enterprise price or contract. *(Closed 2026-10-26 — D29: no paid keys; the award layer is the labelled fixture.)*
- Whether booking is affiliate, markup, or guided link only.
- The Stripe monthly amount.
- A real traveller’s balances, passport data, or card numbers.

Those are open rows in `decision.md`.
