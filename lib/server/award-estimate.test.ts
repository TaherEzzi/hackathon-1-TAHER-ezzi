import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { awardForRoute, CabinError, estimateAward, estimateCashEur, parseCabin } from "./award-estimate";

describe("estimateAward", () => {
  it("prices a short business route on the first distance band", () => {
    const award = estimateAward("MAD", "LHR", "business");
    assert.equal(award.miles, 25_000);
    assert.equal(award.taxes_eur, 90);
  });

  it("prices a transatlantic business route on the long-haul band", () => {
    const award = estimateAward("MAD", "JFK", "business");
    assert.equal(award.miles, 100_000);
    assert.equal(award.taxes_eur, 400);
  });

  it("still returns miles when the airports are not in the table", () => {
    const award = estimateAward("XXX", "YYY", "economy");
    assert.equal(award.miles, 50_000);
    assert.ok(award.taxes_eur > 0);
  });
});

describe("parseCabin", () => {
  it("rejects a cabin the chart does not price", () => {
    assert.throws(() => parseCabin("biz"), (error: unknown) => error instanceof CabinError);
  });
});

describe("estimateCashEur", () => {
  it("returns a positive one-way cash figure for a known route", () => {
    const cash = estimateCashEur("MAD", "LHR", "business");
    assert.ok(cash >= 350 && cash <= 500);
  });
});

describe("awardForRoute", () => {
  it("keeps a fixture row ahead of a model estimate and the chart", () => {
    const award = awardForRoute({
      fixture: { miles: 34_000, taxes_eur: 120 },
      estimated: { miles: 80_000, taxes_eur: 200 },
      origin: "MAD",
      destination: "JFK",
      cabin: "business",
    });
    assert.deepEqual(award, { miles: 34_000, taxes_eur: 120, source: "fixture" });
  });

  it("uses the model estimate when the fixture has no row", () => {
    const award = awardForRoute({
      fixture: null,
      estimated: { miles: 62_000, taxes_eur: 175 },
      origin: "MAD",
      destination: "JFK",
      cabin: "business",
    });
    assert.equal(award.source, "model");
    assert.equal(award.miles, 62_000);
  });

  it("uses the distance chart when neither the fixture nor the model has miles", () => {
    const award = awardForRoute({
      fixture: null,
      estimated: null,
      origin: "MAD",
      destination: "LHR",
      cabin: "business",
    });
    assert.equal(award.source, "chart");
    assert.equal(award.miles, 25_000);
  });
});
