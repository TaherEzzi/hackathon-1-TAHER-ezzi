import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  cardCodeFor,
  decideTurn,
  dropPastDates,
  mergeSlots,
  missingSlots,
  readSlots,
  revolutPlanFor,
  travelWindow,
  type ChatSlots,
} from "./chat-slots";

const COMPLETE: ChatSlots = {
  origin: "MAD",
  destination: "JNB",
  depart_date: "2027-03-10",
  cabin: "business",
  pax: 1,
  cards: ["amex_gold"],
  monthly_total: 2000,
};

describe("mergeSlots", () => {
  it("fills facts across turns without dropping earlier ones", () => {
    const first = mergeSlots({}, { origin: "mad", destination: null });
    const second = mergeSlots(first, { destination: "JNB", cabin: "business" });
    assert.deepEqual(second, { origin: "MAD", destination: "JNB", cabin: "business" });
  });

  it("totals points the model reports per card", () => {
    assert.equal(mergeSlots({}, { points_held: { amex_platinum: 500, revolut_premium: 300 } }).points_held, 800);
    assert.equal(mergeSlots({}, { points_held: { amex: 500, revolut: "lots" } }).points_held, undefined);
  });

  it("keeps every slot when the model returns nothing for a general question", () => {
    assert.deepEqual(mergeSlots(COMPLETE, {}), COMPLETE);
    assert.deepEqual(mergeSlots(COMPLETE, { origin: null, cards: [], pax: null }), COMPLETE);
  });

  it("ignores values that fail validation instead of storing them", () => {
    const merged = mergeSlots({ origin: "MAD" }, { origin: "Madrid", pax: 40, cabin: "sofa", cards: ["visa_black"] });
    assert.deepEqual(merged, { origin: "MAD" });
  });

  it("a new exact date replaces a window, and a window replaces a date", () => {
    const withWindow = mergeSlots({ depart_date: "2027-03-10" }, { window: { start: "2027-06-01", end: "2027-08-31" } });
    assert.deepEqual(withWindow, { window: { start: "2027-06-01", end: "2027-08-31" } });
    const withDate = mergeSlots(withWindow, { depart_date: "2027-07-01" });
    assert.deepEqual(withDate, { depart_date: "2027-07-01" });
  });

  it("merges spend by category and keeps unknown cards out", () => {
    const merged = mergeSlots({ spend: { fuel: 100 } }, { spend: { dining: 300, crypto: 50 }, cards: ["amex_gold", "revolut_metal", "nope"] });
    assert.deepEqual(merged, { spend: { fuel: 100, dining: 300 }, cards: ["amex_gold", "revolut_metal"] });
  });
});

describe("readSlots", () => {
  it("reads a stored jsonb value and drops anything malformed", () => {
    assert.deepEqual(readSlots({ origin: "MAD", pax: "two" }), { origin: "MAD" });
    assert.deepEqual(readSlots(null), {});
    assert.deepEqual(readSlots("garbage"), {});
  });
});

describe("missingSlots", () => {
  it("lists every fact the engine still needs", () => {
    assert.deepEqual(missingSlots({}), ["origin", "destination", "dates", "cabin", "cards", "monthly_total"]);
  });

  it("is empty once route, dates, cabin, cards and spend are known", () => {
    assert.deepEqual(missingSlots(COMPLETE), []);
  });

  it("accepts a zero monthly spend as an answer", () => {
    assert.deepEqual(missingSlots({ ...COMPLETE, monthly_total: 0 }), []);
  });
});

describe("decideTurn", () => {
  it("answers a general question without touching the engine", () => {
    assert.deepEqual(decideTurn(COMPLETE, "answer"), { kind: "answer" });
  });

  it("asks for missing facts and does not compute", () => {
    assert.deepEqual(decideTurn({ origin: "MAD" }, "search"), {
      kind: "ask",
      missing: ["destination", "dates", "cabin", "cards", "monthly_total"],
    });
  });

  it("runs the runway for a plan and book-now only when the traveller asked for an exact date now", () => {
    assert.deepEqual(decideTurn(COMPLETE, "search"), { kind: "compute", engine: "runway" });
    assert.deepEqual(decideTurn({ ...COMPLETE, mode: "book_now" }, "search"), { kind: "compute", engine: "book_now" });
    const windowOnly: ChatSlots = { ...COMPLETE, depart_date: undefined, window: { start: "2027-06-01", end: "2027-08-31" }, mode: "book_now" };
    delete windowOnly.depart_date;
    assert.deepEqual(decideTurn(windowOnly, "search"), { kind: "compute", engine: "runway" });
  });
});

describe("dropPastDates", () => {
  it("forgets a date or window that has already passed so the agent asks again", () => {
    assert.deepEqual(dropPastDates({ origin: "MAD", depart_date: "2026-10-01" }, "2026-10-27"), { origin: "MAD" });
    assert.deepEqual(dropPastDates({ window: { start: "2026-09-01", end: "2026-10-01" } }, "2026-10-27"), {});
    assert.deepEqual(dropPastDates({ depart_date: "2026-10-27" }, "2026-10-27"), { depart_date: "2026-10-27" });
  });
});

describe("card helpers", () => {
  it("picks the transfer program the dossier picks", () => {
    assert.equal(cardCodeFor(["revolut_metal", "amex_gold"]), "AMEX_ES");
    assert.equal(cardCodeFor(["revolut_metal"]), "REVOLUT");
    assert.equal(cardCodeFor([]), null);
  });

  it("reads the Revolut plan from the highest Revolut card", () => {
    assert.equal(revolutPlanFor(["revolut_premium", "revolut_ultra"]), "ultra");
    assert.equal(revolutPlanFor(["amex_gold"]), null);
  });
});

describe("travelWindow", () => {
  it("is three days either side of an exact date, never before today", () => {
    assert.deepEqual(travelWindow({ depart_date: "2027-03-10" }, "2026-10-27"), { start: "2027-03-07", end: "2027-03-13" });
    assert.deepEqual(travelWindow({ depart_date: "2026-10-28" }, "2026-10-27"), { start: "2026-10-27", end: "2026-10-31" });
  });

  it("uses the stated window as is", () => {
    assert.deepEqual(travelWindow({ window: { start: "2027-06-01", end: "2027-08-31" } }, "2026-10-27"), { start: "2027-06-01", end: "2027-08-31" });
  });
});
