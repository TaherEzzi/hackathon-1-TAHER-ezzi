import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  CARD_RATE_TABLE,
  discountEuros,
  pointsPerEuro,
  routeSpend,
  bonusPointsByMonth,
  type CardProduct,
} from "./card-earn";
import { fillMissingFares, stampMissingCash, type FareLoad } from "./fare-estimate";
import type { CashFare } from "./engine";
import { InsufficientData } from "../engine/verdict.mjs";

const THREE: CardProduct[] = ["amex_gold", "revolut_metal", "amex_business_platinum"];

function emptyLoad(): FareLoad {
  return { fares: {}, dates: [], projection: null };
}

function liveFare(amount: number): CashFare {
  return {
    amount,
    currency: "EUR",
    badge: "en vivo",
    stale: false,
    age_hours: 0,
    fetched_at: "2026-10-27T00:00:00.000Z",
    cached: false,
    offer_id: "off_1",
  };
}

describe("routeSpend", () => {
  it("sends groceries to Business Platinum and travel to an Amex card at 1 per euro, ignoring cards that were not selected", () => {
    const routed = routeSpend(THREE, { groceries: 100, travel: 80, fuel: 40 });
    const groceries = routed.routes.find((row) => row.category === "groceries");
    const travel = routed.routes.find((row) => row.category === "travel");
    const fuel = routed.routes.find((row) => row.category === "fuel");
    assert.equal(groceries?.card, "amex_business_platinum");
    assert.equal(groceries?.pointsPerEuro, 1);
    assert.equal(groceries?.points, 100);
    assert.equal(travel?.pointsPerEuro, 1);
    assert.ok(travel?.card === "amex_gold" || travel?.card === "amex_business_platinum");
    assert.equal(fuel?.card, "amex_business_platinum");
    assert.equal(fuel?.pointsPerEuro, 1);
    assert.ok(routed.routes.every((row) => THREE.includes(row.card)));
    assert.equal(routed.amexTravelPerEuro, 2);
  });

  it("keeps the earlier card when two selected cards earn the same rate", () => {
    const routed = routeSpend(["amex_gold", "amex_business_platinum"], { travel: 10 });
    assert.equal(routed.routes[0]?.card, "amex_gold");
  });

  it("counts Gold groceries at 1 point per €5 and Business Platinum at 1 per €1", () => {
    assert.equal(pointsPerEuro("amex_gold", "groceries"), 0.2);
    assert.equal(routeSpend(["amex_gold"], { groceries: 200 }).monthlyPoints, 40);
    assert.equal(routeSpend(["amex_business_platinum"], { groceries: 200 }).monthlyPoints, 200);
  });

  it("lets Metal beat Gold on groceries and lose to Gold on travel", () => {
    const groceries = routeSpend(["amex_gold", "revolut_metal"], { groceries: 100 });
    const travel = routeSpend(["amex_gold", "revolut_metal"], { travel: 100 });
    assert.equal(groceries.routes[0]?.card, "revolut_metal");
    assert.equal(groceries.routes[0]?.pointsPerEuro, 0.5);
    assert.equal(travel.routes[0]?.card, "amex_gold");
    assert.equal(travel.routes[0]?.pointsPerEuro, 1);
  });

  it("splits a budget across every category and keeps each one on its own best card", () => {
    const routed = routeSpend(["amex_gold", "revolut_metal"], {}, 3000);
    const byCategory = Object.fromEntries(routed.routes.map((row) => [row.category, row]));
    assert.equal(routed.routes.length, 7);
    assert.equal(routed.routes.reduce((sum, row) => sum + row.euros, 0), 3000);
    assert.equal(byCategory.groceries?.card, "revolut_metal");
    assert.equal(byCategory.groceries?.pointsPerEuro, 0.5);
    assert.equal(byCategory.travel?.card, "amex_gold");
    assert.equal(byCategory.travel?.pointsPerEuro, 1);
    assert.equal(byCategory.fuel?.card, "amex_gold");
    assert.notEqual(byCategory.groceries?.card, byCategory.travel?.card);
  });

  it("keeps a typed category amount and splits only the rest of the budget", () => {
    const routed = routeSpend(["amex_gold"], { groceries: 200 }, 3000);
    const groceries = routed.routes.find((row) => row.category === "groceries");
    assert.equal(groceries?.euros, 200);
    assert.equal(groceries?.points, 40);
    assert.equal(routed.routes.reduce((sum, row) => sum + row.euros, 0), 3000);
    assert.equal(routed.monthlyPoints, 1675);
  });

  it("adds the published spend bonus only after that card's own spend clears its threshold", () => {
    const gold = routeSpend(["amex_gold"], {}, 3000);
    assert.equal(gold.monthlyPoints, 1587);
    assert.equal(gold.bonuses[0]?.card, "amex_gold");
    assert.equal(gold.bonuses[0]?.thresholdEuros, 1000);
    assert.equal(gold.bonuses[0]?.points, 2000);
    assert.equal(gold.bonuses[0]?.months, 10);
    assert.equal(bonusPointsByMonth(gold.bonuses, 4), 8000);
    assert.equal(bonusPointsByMonth(gold.bonuses, 12), 20_000);
    assert.throws(
      () => bonusPointsByMonth([{ card: "amex_gold", spendEuros: 1000, thresholdEuros: 1000, points: Number.NaN, months: 10 }], 4),
      (error: unknown) => error instanceof InsufficientData,
    );

    const short = routeSpend(["amex_gold"], { fuel: 999 });
    assert.equal(short.bonuses.length, 0);

    const platinum = routeSpend(["amex_platinum"], { shopping: 3000 }, 3000);
    assert.equal(platinum.monthlyPoints, 3000);
    assert.equal(platinum.bonuses[0]?.points, 5000);
    assert.equal(platinum.bonuses[0]?.thresholdEuros, 1500);
  });

  it("rejects a category amount that is not a real spend", () => {
    assert.throws(() => routeSpend(["amex_gold"], { fuel: -10 }), (error: unknown) => error instanceof InsufficientData);
    assert.throws(() => routeSpend(["amex_gold"], { fuel: Number.POSITIVE_INFINITY }), (error: unknown) => error instanceof InsufficientData);
  });

  it("rejects a monthly budget that is not a real amount", () => {
    assert.throws(() => routeSpend(["amex_gold"], {}, Number.NaN), (error: unknown) => error instanceof InsufficientData);
    assert.throws(() => routeSpend(["amex_gold"], {}, -1), (error: unknown) => error instanceof InsufficientData);
  });
});

describe("discountEuros", () => {
  it("subtracts taxes once held points plus routed earn cover the miles", () => {
    assert.equal(
      discountEuros({ cashEur: 1200, taxesEur: 200, milesNeeded: 50_000, pointsHeld: 40_000, monthlyPoints: 5_000, months: 3, eurosPerPoint: 0.015 }),
      1000,
    );
  });

  it("prices a partial balance at the point's euro value, not as a slice of the award", () => {
    assert.equal(
      discountEuros({ cashEur: 1200, taxesEur: 200, milesNeeded: 50_000, pointsHeld: 1_000, monthlyPoints: 0, months: 2, eurosPerPoint: 0.015 }),
      15,
    );
  });

  it("caps the points' euro value at the fare above taxes", () => {
    assert.equal(
      discountEuros({ cashEur: 599, taxesEur: 132, milesNeeded: 140_000, pointsHeld: 11_400, monthlyPoints: 0, months: 1, eurosPerPoint: 0.015 }),
      171,
    );
  });

  it("returns no discount when no points are available", () => {
    assert.equal(
      discountEuros({ cashEur: 1200, taxesEur: 200, milesNeeded: 50_000, pointsHeld: 0, monthlyPoints: 0, months: 2, eurosPerPoint: 0.015 }),
      null,
    );
  });

  it("rejects extra points that are not a real balance", () => {
    assert.throws(
      () => discountEuros({ cashEur: 1200, taxesEur: 200, milesNeeded: 50_000, pointsHeld: 0, monthlyPoints: 0, months: 1, extraPoints: Number.NaN }),
      (error: unknown) => error instanceof InsufficientData,
    );
  });

  it("rejects a held balance that is not a real number", () => {
    assert.throws(
      () => discountEuros({ cashEur: 1200, taxesEur: 200, milesNeeded: 50_000, pointsHeld: Number.NaN, monthlyPoints: 0, months: 1 }),
      (error: unknown) => error instanceof InsufficientData,
    );
  });
});

describe("fillMissingFares", () => {
  const dates = ["2027-01-15", "2027-02-15", "2027-03-15", "2027-04-15", "2027-05-15", "2027-06-15", "2027-07-15"];

  it("fills an empty Duffel window from one estimate and badges every amount as an estimate", async () => {
    let calls = 0;
    const filled = await fillMissingFares(emptyLoad(), dates, false, async (missing) => {
      calls += 1;
      assert.deepEqual(missing, dates);
      return {
        cash: missing.map((date) => ({ date, amount_eur: 900 })),
        award: { miles: 50_000, taxes_eur: 180 },
      };
    });
    assert.equal(calls, 1);
    assert.equal(filled.fares["2027-01-15"].amount, 900);
    assert.equal(filled.fares["2027-01-15"].badge, "estimación");
    assert.equal(filled.fares["2027-01-15"].offer_id, null);
    assert.equal(filled.award?.miles, 50_000);
    assert.equal(Object.keys(filled.fares).length, 7);
  });

  it("leaves a Duffel fare untouched when the estimate names a different amount", async () => {
    const load: FareLoad = {
      fares: { "2027-01-15": liveFare(640) },
      dates: ["2027-01-15"],
      projection: null,
    };
    const filled = await fillMissingFares(load, ["2027-01-15", "2027-06-15"], true, async () => ({
      cash: [
        { date: "2027-01-15", amount_eur: 9999 },
        { date: "2027-06-15", amount_eur: 800 },
      ],
      award: null,
    }));
    assert.equal(filled.fares["2027-01-15"].amount, 640);
    assert.equal(filled.fares["2027-01-15"].badge, "en vivo");
    assert.equal(filled.fares["2027-01-15"].offer_id, "off_1");
    assert.equal(filled.fares["2027-06-15"].amount, 800);
    assert.equal(filled.fares["2027-06-15"].badge, "estimación");
  });

  it("stamps only the missing dates and leaves the original fare map unchanged", () => {
    const existing = liveFare(640);
    const fares: Record<string, CashFare> = { "2027-01-15": existing };
    const stamped = stampMissingCash(fares, ["2027-01-15", "2027-06-15"], 900, new Date("2026-10-27T00:00:00.000Z"));
    assert.equal(stamped["2027-01-15"], existing);
    assert.equal(stamped["2027-06-15"]?.amount, 900);
    assert.equal(stamped["2027-06-15"]?.badge, "estimación");
    assert.equal(stamped["2027-06-15"]?.offer_id, null);
    assert.equal(fares["2027-06-15"], undefined);
  });

  it("does not call the estimator when every date is already priced and the award is known", async () => {
    let calls = 0;
    const load: FareLoad = {
      fares: { "2027-01-15": liveFare(640) },
      dates: ["2027-01-15"],
      projection: null,
    };
    await fillMissingFares(load, ["2027-01-15"], true, async () => {
      calls += 1;
      return { cash: [], award: null };
    });
    assert.equal(calls, 0);
  });
});

describe("card rate table on the trip page", () => {
  it("matches the server rates for every product and category", () => {
    const html = readFileSync(new URL("../../web/trip-dossier.html", import.meta.url), "utf8");
    const match = html.match(/<script type="application\/json" id="card-rates">([\s\S]*?)<\/script>/);
    assert.ok(match, "trip dossier is missing the card-rates table");
    const page: unknown = JSON.parse(match[1]);
    assert.deepEqual(page, CARD_RATE_TABLE);
  });
});
