import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { InsufficientData } from "../engine/verdict.mjs";
import { loadTrendFixture } from "./trend";
import {
  chooseRunwayPicks,
  projectFaresFromAnchor,
  type RunwayCandidate,
} from "./engine";

const trend = loadTrendFixture();

function candidate(date: string, amount: number, extra: Partial<RunwayCandidate> = {}): RunwayCandidate {
  return {
    depart_date: date,
    cash: {
      amount,
      currency: "EUR",
      badge: "proyección",
      stale: false,
      age_hours: 0,
      fetched_at: "2026-10-27T00:00:00.000Z",
      cached: false,
      offer_id: null,
      projected: true,
      anchored_on: "2026-11-20",
      anchor_amount: 1000,
    },
    verdict: "insufficient_data",
    savings_eur: null,
    value_score: null,
    trend: { factor: 1, source: "test", label: "estimación", verified_at: "2026-10-26" },
    gap: null,
    proyeccion: null,
    enough_by: null,
    why: null,
    miles_needed: null,
    ...extra,
  };
}

describe("projectFaresFromAnchor", () => {
  it("prices every far date once, with the month factor, and never a bookable offer", () => {
    const fares = projectFaresFromAnchor(
      { date: "2026-11-20", amount: 1000, currency: "EUR" },
      ["2027-01-15", "2027-06-15", "2027-08-15"],
      trend,
    );
    assert.equal(fares["2027-01-15"].amount, 1000);
    assert.equal(fares["2027-06-15"].amount, 1080);
    assert.equal(fares["2027-08-15"].amount, 1180);
    assert.notEqual(fares["2027-06-15"].amount, fares["2027-08-15"].amount);
    for (const fare of Object.values(fares)) {
      assert.equal(fare.projected, true);
      assert.equal(fare.offer_id, null);
      assert.equal(fare.badge, "proyección");
      assert.equal(fare.anchored_on, "2026-11-20");
      assert.equal(fare.anchor_amount, 1000);
    }
  });

  it("refuses more than seven dates instead of quietly dropping them", () => {
    assert.throws(
      () => projectFaresFromAnchor({ date: "2026-11-20", amount: 1000, currency: "EUR" }, Array.from({ length: 8 }, (_, i) => `2027-01-${String(i + 1).padStart(2, "0")}`), trend),
      (error: unknown) => error instanceof InsufficientData,
    );
  });
});

describe("chooseRunwayPicks", () => {
  it("ranks a far window by cheapest projected cash when points cannot be scored", () => {
    const picks = chooseRunwayPicks([
      candidate("2027-08-15", 1180),
      candidate("2027-01-15", 1000),
      candidate("2027-06-15", 1080),
    ]);
    assert.equal(picks.recommended?.depart_date, "2027-01-15");
    assert.equal(picks.alternative?.depart_date, "2027-06-15");
  });

  it("keeps total-money ranking when a card can score the candidates", () => {
    const picks = chooseRunwayPicks([
      candidate("2027-01-15", 1000, { verdict: "pagar_en_efectivo", value_score: 10 }),
      candidate("2027-06-15", 1080, { verdict: "usar_puntos", value_score: 80 }),
    ]);
    assert.equal(picks.recommended?.depart_date, "2027-06-15");
    assert.equal(picks.alternative?.depart_date, "2027-01-15");
  });
});
