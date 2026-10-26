/**
 * Gate-4 test (BRIEF §7.4): the loader refuses malformed rows — every failure
 * is InsufficientData('fixture: …'), never silence, never an invented value.
 * Also proves: empty routes is VALID (honest absence ⇒ insufficient_data),
 * and a verified lookup returns the always-`estimación` badge.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  validateAwardFixture,
  loadAwardFixture,
  indexFixture,
  fixtureQuote,
} from "./fixture";
import { InsufficientData } from "../engine/verdict.mjs";

const valid = {
  label: "estimación",
  verified_at: "2026-10-26",
  source: "free seats.aero website ritual (D30)",
  routes: [],
};

const expectFail = (name: string, mutate: (f: any) => void) => {
  test(name, () => {
    const f = structuredClone(valid);
    mutate(f);
    assert.throws(() => validateAwardFixture(f), (e: unknown) =>
      e instanceof InsufficientData && e.detail.startsWith("fixture: "),
    );
  });
};

test("empty routes file is VALID (the honest pre-ritual state)", () => {
  const f = validateAwardFixture(structuredClone(valid));
  const idx = indexFixture(f);
  assert.equal(f.routes.length, 0);
  // and an absent route yields NO quote — engine will answer insufficient_data
  assert.equal(fixtureQuote(idx, { origin: "MAD", destination: "JNB", airline_program: "IB", cabin: "business" }), null);
});

test("the shipped data/award-fixture.json loads and validates (route absent ⇒ null quote)", () => {
  const f = loadAwardFixture();
  assert.equal(f.label, "estimación");
  const idx = indexFixture(f);
  assert.equal(fixtureQuote(idx, { origin: "MAD", destination: "MAD", airline_program: "QR", cabin: "first" }), null);
});

expectFail("wrong label (fixture can never claim 'en vivo')", (f) => { f.label = "en vivo"; });
expectFail("missing label", (f) => { delete f.label; });
expectFail("non-ISO verified_at", (f) => { f.verified_at = "26/10/2026"; });
expectFail("missing verified_at", (f) => { delete f.verified_at; });
expectFail("empty source", (f) => { f.source = "  "; });
expectFail("routes is not an array", (f) => { f.routes = "none"; });
expectFail("route with lowercase origin", (f) => {
  f.routes.push({ origin: "mad", destination: "JNB", airline_program: "IB", cabin: "business", miles_one_way: 77000, taxes: { amount: 100, currency: "EUR" }, seats: "unknown" });
});
expectFail("route with unknown program code", (f) => {
  f.routes.push({ origin: "MAD", destination: "JNB", airline_program: "XX", cabin: "business", miles_one_way: 77000, taxes: { amount: 100, currency: "EUR" }, seats: "unknown" });
});
expectFail("route with bad cabin", (f) => {
  f.routes.push({ origin: "MAD", destination: "JNB", airline_program: "IB", cabin: "biz", miles_one_way: 77000, taxes: { amount: 100, currency: "EUR" }, seats: "unknown" });
});
expectFail("route with ZERO miles — 0 is not a real value (§5.4)", (f) => {
  f.routes.push({ origin: "MAD", destination: "JNB", airline_program: "IB", cabin: "business", miles_one_way: 0, taxes: { amount: 100, currency: "EUR" }, seats: "unknown" });
});
expectFail("route with fractional miles", (f) => {
  f.routes.push({ origin: "MAD", destination: "JNB", airline_program: "IB", cabin: "business", miles_one_way: 77000.5, taxes: { amount: 100, currency: "EUR" }, seats: "unknown" });
});
expectFail("route with negative miles", (f) => {
  f.routes.push({ origin: "MAD", destination: "JNB", airline_program: "IB", cabin: "business", miles_one_way: -5, taxes: { amount: 100, currency: "EUR" }, seats: "unknown" });
});
expectFail("route with missing taxes", (f) => {
  f.routes.push({ origin: "MAD", destination: "JNB", airline_program: "IB", cabin: "business", miles_one_way: 77000, seats: "unknown" });
});
expectFail("route with bad taxes currency", (f) => {
  f.routes.push({ origin: "MAD", destination: "JNB", airline_program: "IB", cabin: "business", miles_one_way: 77000, taxes: { amount: 100, currency: "eu" }, seats: "unknown" });
});
expectFail("route with NaN taxes", (f) => {
  f.routes.push({ origin: "MAD", destination: "JNB", airline_program: "IB", cabin: "business", miles_one_way: 77000, taxes: { amount: "n/a", currency: "EUR" }, seats: "unknown" });
});
expectFail("route with unknown seats state", (f) => {
  f.routes.push({ origin: "MAD", destination: "JNB", airline_program: "IB", cabin: "business", miles_one_way: 77000, taxes: { amount: 100, currency: "EUR" }, seats: "plenty" });
});
expectFail("exact duplicate route entry", (f) => {
  const route = { origin: "MAD", destination: "JNB", airline_program: "IB", cabin: "business", miles_one_way: 77000, taxes: { amount: 100, currency: "EUR" }, seats: "unknown" };
  f.routes.push(route, route);
});

test("valid full route: quote returns real miles/taxes + always-estimación badge with verified_at age", () => {
  const f = validateAwardFixture(structuredClone(valid));
  f.routes.push({
    origin: "MAD", destination: "JNB", airline_program: "IB", cabin: "business",
    miles_one_way: 77000, taxes: { amount: 187.35, currency: "EUR" }, seats: "unknown",
  });
  const idx = indexFixture(f);
  const q = fixtureQuote(idx, { origin: "MAD", destination: "JNB", airline_program: "IB", cabin: "business", now: new Date("2026-10-26T12:00:00Z") });
  assert.ok(q);
  assert.equal(q.miles, 77000);
  assert.deepEqual(q.taxes, { amount: 187.35, currency: "EUR" });
  assert.equal(q.badge.badge, "estimación");
  assert.equal(q.badge.verified_at, "2026-10-26");
  // unverified cabin/program combos stay absent even in a populated fixture
  assert.equal(fixtureQuote(idx, { origin: "MAD", destination: "JNB", airline_program: "QR", cabin: "business" }), null);
});
