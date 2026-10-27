import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { runChatTurn, type ChatTurnDeps, type ModelTurn } from "./chat-turn";
import type { ChatSlots } from "./chat-slots";
import type { BookNowInput, RunwayCandidate, RunwayInput, RunwayResult } from "./engine";
import type { ItineraryInsert } from "./itinerary-row";

const COMPLETE: ChatSlots = {
  origin: "MAD",
  destination: "JNB",
  depart_date: "2027-03-10",
  cabin: "business",
  pax: 1,
  cards: ["amex_gold", "revolut_metal"],
  points_held: 5000,
  monthly_total: 2000,
};

const REC: RunwayCandidate = {
  depart_date: "2027-03-10",
  cash: { amount: 2400, currency: "EUR", badge: "en vivo", stale: false, age_hours: 0, fetched_at: "2026-10-27T00:00:00Z", cached: false, offer_id: null },
  verdict: "usar_puntos",
  savings_eur: 600,
  value_score: 600,
  trend: { factor: 1, source: "fixture", label: "estimación", verified_at: "2026-10-01" },
  gap: null,
  proyeccion: null,
  enough_by: null,
  why: null,
  miles_needed: 85000,
};

function runwayResult(rec: RunwayCandidate | null): RunwayResult {
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

interface Calls {
  runway: RunwayInput[];
  bookNow: BookNowInput[];
  saved: ItineraryInsert[];
  explained: string[][];
}

function deps(model: ModelTurn, opts: { rec?: RunwayCandidate | null; explainFails?: boolean } = {}): { deps: ChatTurnDeps; calls: Calls } {
  const calls: Calls = { runway: [], bookNow: [], saved: [], explained: [] };
  return {
    calls,
    deps: {
      userId: "user-1",
      today: "2026-10-27",
      model: async () => model,
      runway: async (input) => {
        calls.runway.push(input);
        return runwayResult(opts.rec === undefined ? REC : opts.rec);
      },
      bookNow: async (input) => {
        calls.bookNow.push(input);
        throw new Error("book now not expected in this test");
      },
      explain: async (facts) => {
        calls.explained.push(facts);
        if (opts.explainFails) throw new Error("grok down");
        return "Use your points on the 10th.";
      },
      save: async (row) => {
        calls.saved.push(row);
        return "itin-1";
      },
    },
  };
}

describe("runChatTurn", () => {
  it("answers a general question, keeps every slot, and never calls the engine", async () => {
    const { deps: d, calls } = deps({ action: "answer", reply: "Avios are Iberia's points.", slots: {} });
    const out = await runChatTurn(d, { slots: COMPLETE, history: [], text: "what are avios?" });
    assert.equal(out.kind, "answer");
    assert.equal(out.reply, "Avios are Iberia's points.");
    assert.deepEqual(out.slots, COMPLETE);
    assert.equal(calls.runway.length, 0);
    assert.equal(calls.saved.length, 0);
    assert.equal(out.plan_url, null);
  });

  it("asks for what is missing and does not compute", async () => {
    const { deps: d, calls } = deps({ action: "search", reply: "Which cards do you hold?", slots: { origin: "MAD", destination: "JNB" } });
    const out = await runChatTurn(d, { slots: {}, history: [], text: "Madrid to Joburg" });
    assert.equal(out.kind, "ask");
    assert.equal(out.reply, "Which cards do you hold?");
    assert.deepEqual(out.slots, { origin: "MAD", destination: "JNB" });
    assert.deepEqual(out.missing, ["dates", "cabin", "cards", "monthly_total"]);
    assert.equal(calls.runway.length, 0);
  });

  it("says a past date was dropped instead of claiming to check prices", async () => {
    const { deps: d, calls } = deps({ action: "search", reply: "Checking prices now...", slots: { depart_date: "2026-03-15" } });
    const noDates: ChatSlots = { ...COMPLETE };
    delete noDates.depart_date;
    const out = await runChatTurn(d, { slots: noDates, history: [], text: "the 15th" });
    assert.equal(out.kind, "ask");
    assert.deepEqual(out.missing, ["dates"]);
    assert.doesNotMatch(out.reply, /checking prices/i);
    assert.match(out.reply, /2026-03-15/);
    assert.match(out.reply, /passed/i);
    assert.equal(calls.runway.length, 0);
  });

  it("asks the server's question when the model's reply asks nothing", async () => {
    const { deps: d } = deps({ action: "search", reply: "Checking prices now...", slots: {} });
    const out = await runChatTurn(d, { slots: { origin: "MAD", destination: "JNB" }, history: [], text: "go" });
    assert.equal(out.kind, "ask");
    assert.doesNotMatch(out.reply, /checking prices/i);
    assert.match(out.reply, /cards/i);
  });

  it("writes its own question when the model leaves the reply empty", async () => {
    const { deps: d } = deps({ action: "search", reply: "  ", slots: {} });
    const out = await runChatTurn(d, { slots: { origin: "MAD" }, history: [], text: "plan a trip" });
    assert.equal(out.kind, "ask");
    assert.match(out.reply, /where you are flying to/i);
  });

  it("runs the runway with the traveller's cards, saves the plan, and returns its URL", async () => {
    const { deps: d, calls } = deps({ action: "search", reply: "Searching.", slots: {} });
    const out = await runChatTurn(d, { slots: COMPLETE, history: [], text: "go ahead" });
    assert.equal(out.kind, "runway");
    assert.equal(calls.runway.length, 1);
    const input = calls.runway[0];
    assert.deepEqual(input.window, { start: "2027-03-07", end: "2027-03-13" });
    assert.equal(input.card, "AMEX_ES");
    assert.equal(input.plan, "metal");
    assert.deepEqual(input.cards, ["amex_gold", "revolut_metal"]);
    assert.equal(input.pointsHeld, 5000);
    assert.equal(input.monthlyTotal, 2000);
    assert.equal(calls.saved.length, 1);
    assert.equal(calls.saved[0].mode, "plan");
    assert.equal(out.itinerary_id, "itin-1");
    assert.equal(out.plan_url, "/trip-dossier.html?view=plan&id=itin-1");
    assert.equal(out.reply, "Use your points on the 10th.");
  });

  it("does not save when the engine has no date to recommend", async () => {
    const { deps: d, calls } = deps({ action: "search", reply: "", slots: {} }, { rec: null });
    const out = await runChatTurn(d, { slots: COMPLETE, history: [], text: "go" });
    assert.equal(out.kind, "runway");
    assert.equal(calls.saved.length, 0);
    assert.equal(out.plan_url, null);
  });

  it("gives the explainer plain-language facts, never the raw result", async () => {
    const { deps: d, calls } = deps({ action: "search", reply: "", slots: {} });
    await runChatTurn(d, { slots: COMPLETE, history: [], text: "go" });
    assert.equal(calls.explained.length, 1);
    const facts = calls.explained[0].join(" ");
    assert.match(facts, /10 March 2027/);
    assert.doesNotMatch(facts, /usar_puntos|depart_date|\{/);
  });

  it("falls back to the plain facts when the explanation call fails", async () => {
    const { deps: d } = deps({ action: "search", reply: "", slots: {} }, { explainFails: true });
    const out = await runChatTurn(d, { slots: COMPLETE, history: [], text: "go" });
    assert.equal(out.explained_by, "local_fallback");
    assert.match(out.reply, /€2,400/);
    assert.doesNotMatch(out.reply, /usar_puntos/);
  });
});
