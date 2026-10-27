import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseItineraryRequest } from "./itinerary-request";

describe("parseItineraryRequest", () => {
  it("accepts a plan request with a window and the planner's card inputs, no depart date", () => {
    const parsed = parseItineraryRequest({
      mode: "plan",
      origin: "mad",
      destination: "jnb",
      window: { start: "2027-03-07", end: "2027-03-13" },
      cabin: "business",
      pax: 1,
      card: "AMEX_ES",
      plan: "metal",
      cards: ["amex_gold", "revolut_metal"],
      spend: { dining: 300 },
      pointsHeld: 5000,
      monthlyTotal: 2000,
      travel_date: "2027-03-10",
      lead_days: 60,
    });
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.equal(parsed.value.mode, "plan");
    if (parsed.value.mode !== "plan") return;
    assert.equal(parsed.value.origin, "MAD");
    assert.deepEqual(parsed.value.cards, ["amex_gold", "revolut_metal"]);
    assert.equal(parsed.value.lead_days, 60);
  });

  it("still requires a depart date for book-now", () => {
    const parsed = parseItineraryRequest({ mode: "book_now", origin: "MAD", destination: "JNB", cabin: "business", pax: 1 });
    assert.equal(parsed.ok, false);
  });

  it("treats a request without mode as book-now, as before", () => {
    const parsed = parseItineraryRequest({ origin: "MAD", destination: "JNB", depart_date: "2027-03-10", cabin: "business", pax: 1 });
    assert.equal(parsed.ok, true);
    if (parsed.ok) assert.equal(parsed.value.mode, "book_now");
  });

  it("rejects a plan window that ends before it starts", () => {
    const parsed = parseItineraryRequest({ mode: "plan", origin: "MAD", destination: "JNB", window: { start: "2027-03-13", end: "2027-03-07" }, cabin: "business", pax: 1 });
    assert.equal(parsed.ok, false);
  });
});
