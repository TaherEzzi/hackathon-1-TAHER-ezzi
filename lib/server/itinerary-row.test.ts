import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { planUrl, runwayRow, type PlanInputs } from "./itinerary-row";
import type { RunwayCandidate, RunwayResult } from "./engine";

const INPUTS: PlanInputs = {
  origin: "MAD",
  destination: "JNB",
  window: { start: "2027-03-07", end: "2027-03-13" },
  cabin: "business",
  pax: 1,
  travel_date: "2027-03-10",
  cards: ["amex_gold"],
  points_held: 5000,
  monthly_total: 2000,
  spend: { dining: 300 },
};

function candidate(over: Partial<RunwayCandidate> = {}): RunwayCandidate {
  return {
    depart_date: "2027-03-10",
    cash: { amount: 2400, currency: "EUR", badge: "en vivo", stale: false, age_hours: 0, fetched_at: "2026-10-27T00:00:00Z", cached: false, offer_id: null },
    verdict: "usar_puntos",
    savings_eur: 600,
    value_score: 600,
    trend: { factor: 1, source: "fixture", label: "estimación", verified_at: "2026-10-01" },
    gap: { gap: 0, enough: true },
    proyeccion: { low: 12000, high: 4000, badge: "proyección", causal_note: null },
    enough_by: null,
    why: null,
    miles_needed: 85000,
    ...over,
  };
}

function runway(rec: RunwayCandidate | null): RunwayResult {
  return {
    mode: "plan",
    candidates: rec ? [rec] : [],
    recommended: rec,
    alternative: null,
    accelerator: null,
    uses_program: "IB",
    card_gate: { asked: true, card: "AMEX_ES", reason: null },
    card_routing: [],
    spend_bonuses: [],
    spend_instructions: [],
    monthly_points: 1000,
    amex_travel_per_euro: null,
    badges: [],
    attribution: "",
  };
}

describe("runwayRow", () => {
  it("saves a plan-mode row from the recommended date without minting a verdict", () => {
    const row = runwayRow("user-1", INPUTS, runway(candidate()));
    assert.ok(row);
    assert.equal(row.mode, "plan");
    assert.equal(row.user_id, "user-1");
    assert.equal(row.window_start, "2027-03-07");
    assert.equal(row.window_end, "2027-03-13");
    assert.equal(row.depart_date, "2027-03-10");
    assert.equal(row.cash_amount, 2400);
    assert.equal(row.cash_currency, "EUR");
    assert.equal(row.miles, 85000);
    assert.equal(row.verdict, null, "plan rows carry no verdict column; the candidate verdict lives in breakdown");
    assert.equal(row.savings_eur, 600);
    assert.equal(row.savings_pct, 25);
    assert.equal(row.range_low, 4000);
    assert.equal(row.range_high, 12000);
    assert.deepEqual(row.badges, ["en vivo"]);
  });

  it("keeps the whole runway and the traveller's inputs so the plan page can redraw it", () => {
    const result = runway(candidate());
    const row = runwayRow("user-1", INPUTS, result);
    assert.ok(row);
    const breakdown = row.breakdown as { runway: unknown; inputs: unknown };
    assert.deepEqual(breakdown.runway, result);
    assert.deepEqual(breakdown.inputs, INPUTS);
  });

  it("never stores a negative saving", () => {
    const row = runwayRow("user-1", INPUTS, runway(candidate({ savings_eur: -50, verdict: "pagar_en_efectivo" })));
    assert.ok(row);
    assert.equal(row.savings_eur, null);
    assert.equal(row.savings_pct, null);
  });

  it("returns null when the engine found no date to recommend", () => {
    assert.equal(runwayRow("user-1", INPUTS, runway(null)), null);
  });
});

describe("planUrl", () => {
  it("opens the planner on the plan for that itinerary", () => {
    assert.equal(planUrl("abc-123"), "/trip-dossier.html?view=plan&id=abc-123");
  });
});
