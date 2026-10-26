/**
 * lib/engine/verdict.test.mjs — the devil's-advocate attacks, as tests.
 * Run: node --test lib/engine/
 * Every failure mode from the hardening pass has a named test.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  InsufficientData,
  assertSameCurrency,
  cppAfterTaxes,
  computeVerdict,
  perProgramGap,
  monthlyEarn,
  enoughBy,
  sanitizeBalance,
  priceBadge,
  floorCents,
  ceilPoints,
} from './verdict.mjs';

const EUR = { amount: 3500, currency: 'EUR' };
const fixtureTaxes = { amount: 120, currency: 'EUR' };
const pair = { low: 0.012, high: 0.015, currency: 'EUR', verified_at: '2026-10-26' };

test('÷0 Miles: miles=0 raises InsufficientData, never crashes', () => {
  assert.throws(() => cppAfterTaxes({ cash: 100, taxes: 10, miles: 0 }), InsufficientData);
  assert.throws(() => cppAfterTaxes({ cash: 100, taxes: 10, miles: -5 }), InsufficientData);
});

test('negative cash fare is refused', () => {
  assert.throws(() => cppAfterTaxes({ cash: 0, taxes: 10, miles: 100 }), InsufficientData);
});

test('taxes ≥ cash → pagar_en_efectivo with NULL savings (no negative %)', () => {
  const v = computeVerdict({ cash: { amount: 80, currency: 'EUR' }, taxes: fixtureTaxes, miles: 25000, pair });
  assert.equal(v.verdict, 'pagar_en_efectivo');
  assert.equal(v.savings_eur, null);
  assert.equal(v.savings_pct, null);
  assert.equal(v.breakdown.cpp, null);
});

test('currency mismatch anywhere (taxes / valuation) → InsufficientData', () => {
  assert.throws(
    () =>
      computeVerdict({
        cash: { amount: 3500, currency: 'EUR' },
        taxes: { amount: 120, currency: 'GBP' },
        miles: 60000,
        pair,
      }),
    InsufficientData,
  );
  assert.throws(
    () =>
      computeVerdict({
        cash: { amount: 3500, currency: 'EUR' },
        taxes: fixtureTaxes,
        miles: 60000,
        pair: { low: 0.012, high: 0.015, currency: 'USD' },
      }),
    InsufficientData,
  );
});

const NOW = new Date('2026-10-26T12:00:00Z');
const freshFetch = new Date('2026-10-26T12:00:00Z');

test('happy path: cpp above pair → usar_puntos, savings floored to cents, pct ≤ 100', () => {
  // cpp            = (3500−120)/60000      ≈ 0.0563 €/pt  « pair high 0.015
  const v = computeVerdict({ cash: EUR, taxes: fixtureTaxes, miles: 60000, pair, cashFetchedAt: freshFetch, now: NOW });
  assert.equal(v.verdict, 'usar_puntos');
  assert.equal(v.savings_eur, floorCents(3500 - 120 - 60000 * 0.012));
  assert.ok(v.savings_pct > 0 && v.savings_pct <= 100);
  assert.deepEqual(v.badges, ['en vivo', 'estimación']);
});

test('cpp below pair value → pagar_en_efectivo even though miles cover the seat', () => {
  const v = computeVerdict({
    cash: { amount: 220, currency: 'EUR' },
    taxes: { amount: 120, currency: 'EUR' },
    miles: 25000,
    pair,
  }); // cpp = 100/25000 = 0.004 « 0.015
  assert.equal(v.verdict, 'pagar_en_efectivo');
  assert.equal(v.savings_eur, null);
});

test('pax=2 scales money but keeps seat_basis:1 + availability note', () => {
  const v1 = computeVerdict({ cash: EUR, taxes: fixtureTaxes, miles: 60000, pair });
  const v2 = computeVerdict({ cash: EUR, taxes: fixtureTaxes, miles: 60000, pair, pax: 2 });
  assert.equal(v2.breakdown.miles, 120000);
  assert.equal(v2.savings_eur, floorCents(v1.savings_eur * 2));
  assert.equal(v2.breakdown.seat_basis, 1);
  assert.match(v2.breakdown.seat_capacity_note, /1 asiento no garantiza 2/);
});

test('pax bounds enforced (0 and 10 refused)', () => {
  assert.throws(() => computeVerdict({ cash: EUR, taxes: fixtureTaxes, miles: 60000, pair, pax: 0 }), InsufficientData);
  assert.throws(() => computeVerdict({ cash: EUR, taxes: fixtureTaxes, miles: 60000, pair, pax: 10 }), InsufficientData);
});

test('gap is per-program: cross-program summing is impossible by API design', () => {
  // owned only counts the target program up to ONE transfer edge — the caller
  // can never pass a merged total because the signature takes a single number.
  assert.deepEqual(perProgramGap(60000, 32000), { gap: 28000, enough: false });
  assert.deepEqual(perProgramGap(60000, 60000), { gap: 0, enough: true });
  assert.throws(() => perProgramGap(0, 100), InsufficientData);
  assert.throws(() => perProgramGap(1000, -5), InsufficientData);
});

test('expiry subtracts once from the base, then clamps; never negative', () => {
  const m = monthlyEarn({ spendMonthly: 1800, rateLow: 0.5, rateHigh: 0.75, expiring: 2000 });
  assert.deepEqual(m, { low: 0, high: 0 }); // 2000 ≥ both ends of (900, 1350)
  const m2 = monthlyEarn({ spendMonthly: 1800, rateLow: 0.5, rateHigh: 0.75, expiring: 500 });
  assert.deepEqual(m2, { low: 400, high: 850 }); // subtracted once, not monthly
});

test('zero monthly earn → never feasible (accelerator path), never a fake date', () => {
  const r = enoughBy(200_000, 0, 0);
  assert.equal(r.feasible, false);
  assert.equal(r.by_date, null);
  assert.equal(r.months_low, null);
});

test('incoherent earn ranges (high < low) refused', () => {
  assert.throws(() => monthlyEarn({ spendMonthly: 100, rateLow: 1, rateHigh: 0.5 }), InsufficientData);
  assert.throws(() => enoughBy(1000, 200, 100), InsufficientData);
});

test('enoughBy ceiling-rounds months and dates', () => {
  const r = enoughBy(28000, 900, 900);
  assert.equal(r.months_low, ceilPoints(28000 / 900)); // 32 months
  assert.equal(r.feasible, true);
});

test('balance sanity ceiling mirrors the DB check (10,000,000)', () => {
  assert.throws(() => sanitizeBalance(999_999_999), InsufficientData);
  assert.throws(() => sanitizeBalance(-1), InsufficientData);
  assert.throws(() => sanitizeBalance(1000.5), InsufficientData);
  assert.equal(sanitizeBalance(32000), 32000);
});

test('savings round DOWN even at the last cent', () => {
  assert.equal(floorCents(3.999), 3.99);
  assert.equal(floorCents(3.005), 3.0);
  assert.equal(ceilPoints(27999.00001), 28000);
});

// ── settled 2026-10-26: 24 h staleness threshold ────────────────────────────

test('cached price within 24h keeps "cacheado"; older drops to "estimación" + stale', () => {
  const now = new Date('2026-10-26T12:00:00Z');
  const fresh = priceBadge({ kind: 'cached', fetchedAt: '2026-10-26T00:00:00Z', now }); // 12 h old
  assert.deepEqual(fresh, { badge: 'cacheado', stale: false, age_hours: 12 });
  const old = priceBadge({ kind: 'cached', fetchedAt: '2026-10-25T00:00:00Z', now }); // 36 h old
  assert.deepEqual(old, { badge: 'estimación', stale: true, age_hours: 36 });
});

test('boundary: exactly 24h is still fresh (<=)', () => {
  const now = new Date('2026-10-26T12:00:00Z');
  const b = priceBadge({ kind: 'cached', fetchedAt: '2026-10-25T12:00:00Z', now });
  assert.equal(b.badge, 'cacheado');
  assert.equal(b.stale, false);
});

test('custom threshold from app_settings is honoured', () => {
  const now = new Date('2026-10-26T12:00:00Z');
  const b = priceBadge({ kind: 'cached', fetchedAt: '2026-10-25T00:00:00Z', now, maxAgeHours: 48 });
  assert.equal(b.badge, 'cacheado');
});

test('live stays "en vivo" when fresh; stale live/cached prices become "estimación" + stale', () => {
  const now = new Date();
  const sixHoursAgo = new Date(now.getTime() - 6 * 3_600_000);
  assert.equal(priceBadge({ kind: 'live', fetchedAt: sixHoursAgo, now }).badge, 'en vivo');
  // a "live" fetch from 6 days ago is stored data → cache rules apply
  const sixDaysAgo = new Date(now.getTime() - 144 * 3_600_000);
  const old = priceBadge({ kind: 'live', fetchedAt: sixDaysAgo, now });
  assert.deepEqual(old, { badge: 'estimación', stale: true, age_hours: 144 });
  assert.equal(priceBadge({ kind: 'fixture', fetchedAt: '2026-09-01T00:00:00Z', now: new Date('2026-10-26T12:00:00Z') }).badge, 'estimación');
});

test('unknowable age (null/invalid fetchedAt) → honest "estimación" + stale, never fresh', () => {
  assert.deepEqual(priceBadge({ kind: 'cached', fetchedAt: null }), { badge: 'estimación', stale: true, age_hours: -1 });
  assert.deepEqual(priceBadge({ kind: 'live', fetchedAt: 'not-a-date' }), { badge: 'estimación', stale: true, age_hours: -1 });
});

test('future fetchedAt (clock skew) is refused, not trusted', () => {
  assert.throws(() => priceBadge({ kind: 'cached', fetchedAt: '2027-06-01T00:00:00Z' }), InsufficientData);
});

test('computeVerdict badges flow from the price-age rule', () => {
  const now = new Date('2026-10-26T12:00:00Z');
  const fresh = computeVerdict({ cash: EUR, taxes: fixtureTaxes, miles: 60000, pair, cashFetchedAt: now, now });
  assert.deepEqual(fresh.badges, ['en vivo', 'estimación']);
  const staleCash = computeVerdict({
    cash: EUR,
    taxes: fixtureTaxes,
    miles: 60000,
    pair,
    cashFetchedAt: '2026-10-20T00:00:00Z', // 6 days old "live" fetch → stale
    now,
  });
  assert.deepEqual(staleCash.badges, ['estimación', 'estimación']);
});
