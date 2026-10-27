import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { bookNowFacts, runwayFacts } from "./chat-facts";
import type { RunwayCandidate, RunwayResult } from "./engine";
import type { BookNowVerdict } from "./verdict-engine";

function candidate(over: Partial<RunwayCandidate>): RunwayCandidate {
  return {
    depart_date: "2027-03-12",
    cash: { amount: 1293.84, currency: "EUR", badge: "estimación", stale: false, age_hours: 0, fetched_at: "2026-10-27T00:00:00Z", cached: false, offer_id: null, projected: true },
    verdict: "pagar_en_efectivo",
    savings_eur: 574.5,
    value_score: 574.5,
    trend: { factor: 0.95, source: "fixture", label: "estimación", verified_at: "2026-10-01" },
    gap: { gap: 84200, enough: false },
    proyeccion: null,
    enough_by: null,
    why: null,
    miles_needed: 85000,
    ...over,
  };
}

function plan(recommended: RunwayCandidate | null, alternative: RunwayCandidate | null = null): RunwayResult {
  return {
    mode: "plan",
    candidates: [recommended, alternative].filter((c): c is RunwayCandidate => c !== null),
    recommended,
    alternative,
    accelerator: null,
    uses_program: "IB",
    card_gate: { asked: true, card: "AMEX_ES", reason: null },
    card_routing: [],
    spend_bonuses: [],
    spend_instructions: [],
    monthly_points: null,
    amex_travel_per_euro: null,
    badges: [],
    attribution: "",
  };
}

const RAW = /json|pagar_en_efectivo|usar_puntos|insufficient_data|trend|factor|candidate|"/i;

describe("runwayFacts", () => {
  it("states a pay-cash plan in plain words, with the reason and the next best day", () => {
    const facts = runwayFacts(plan(candidate({}), candidate({ depart_date: "2027-03-13" })), 800).join(" ");
    assert.doesNotMatch(facts, RAW);
    assert.match(facts, /12 March 2027/);
    assert.match(facts, /€1,293\.84/);
    assert.match(facts, /pay cash/i);
    assert.match(facts, /85,000 points/);
    assert.match(facts, /you have 800/i);
    assert.match(facts, /13 March 2027/);
    assert.match(facts, /estimate/i);
  });

  it("explains pay-cash from the points shortfall when the engine sets no gap", () => {
    const facts = runwayFacts(plan(candidate({ gap: null })), 800).join(" ");
    assert.match(facts, /85,000 points/);
    assert.match(facts, /you have 800/i);
    assert.match(facts, /worth about €574\.50 off/);
    assert.doesNotMatch(facts, /good value/i);
  });

  it("does not claim a zero balance when the traveller never gave one", () => {
    const facts = runwayFacts(plan(candidate({ gap: null })), undefined).join(" ");
    assert.match(facts, /85,000 points/);
    assert.doesNotMatch(facts, /you have/i);
  });

  it("recommends points with the saving when the traveller has enough", () => {
    const facts = runwayFacts(plan(candidate({ verdict: "usar_puntos", gap: { gap: 0, enough: true } })), 90000).join(" ");
    assert.doesNotMatch(facts, RAW);
    assert.match(facts, /use your points/i);
    assert.match(facts, /€574\.50/);
  });

  it("says when the points will be there at the current spending", () => {
    const rec = candidate({ enough_by: { feasible: true, by_date: "2027-02-01", by_date_high: null, months_low: 3 } });
    assert.match(runwayFacts(plan(rec), 800).join(" "), /enough points by 1 February 2027/);
  });

  it("is honest when no day could be priced", () => {
    const facts = runwayFacts(plan(null), 0).join(" ");
    assert.doesNotMatch(facts, RAW);
    assert.match(facts, /could not price/i);
  });
});

describe("bookNowFacts", () => {
  const base: BookNowVerdict = {
    verdict: "usar_puntos",
    savings_eur: 900,
    savings_pct: 40,
    badges: [],
    cash: { amount: 2400, currency: "EUR", badge: "en vivo", stale: false, age_hours: 0, fetched_at: "2026-10-27T00:00:00Z" },
    cash_moved: null,
    award: { miles: 85000, taxes: { amount: 350, currency: "EUR" }, seats: "2", badge: "fixture", verified_at: "2026-10-01", program: "IB" },
    pair: null,
    card_gate: { asked: true, card: "AMEX_ES", reason: null },
    breakdown: null,
    attribution: "",
  };

  it("compares cash and points for the date in plain words", () => {
    const facts = bookNowFacts(base, "2027-03-10").join(" ");
    assert.doesNotMatch(facts, RAW);
    assert.match(facts, /10 March 2027/);
    assert.match(facts, /€2,400/);
    assert.match(facts, /85,000 points plus €350 in taxes/);
    assert.match(facts, /use your points/i);
    assert.match(facts, /€900/);
  });

  it("is honest when the comparison cannot be made", () => {
    const facts = bookNowFacts({ ...base, verdict: "insufficient_data", award: null, savings_eur: null }, "2027-03-10").join(" ");
    assert.doesNotMatch(facts, RAW);
    assert.match(facts, /not enough data/i);
  });
});
