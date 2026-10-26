/**
 * lib/engine/dedupe.test.mjs — the settled MVP dedup rules, as tests.
 * Run: node --test lib/engine/
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { dedupe, inFlightCount, clearInFlight } from './dedupe.mjs';

test('same key running twice → provider called exactly once, both awaiters get the result', async () => {
  clearInFlight();
  let calls = 0;
  const fn = async () => {
    calls += 1;
    await new Promise((r) => setTimeout(r, 10));
    return 'offer-1';
  };
  const [a, b] = await Promise.all([dedupe('duffel:MAD:JNB', fn), dedupe('duffel:MAD:JNB', fn)]);
  assert.equal(calls, 1);
  assert.equal(a, 'offer-1');
  assert.equal(b, 'offer-1');
});

test('different keys do NOT share (result-changing fields belong in the key)', async () => {
  clearInFlight();
  let calls = 0;
  const fn = async () => {
    calls += 1;
    return calls;
  };
  const [a, b] = await Promise.all([dedupe('MAD:JNB:2pax', fn), dedupe('MAD:JNB:1pax', fn)]);
  assert.equal(calls, 2);
  assert.equal(a, 1);
  assert.equal(b, 2);
});

test('after settling, a new call runs fresh (no stale answers served)', async () => {
  clearInFlight();
  let calls = 0;
  const fn = async () => (++calls);
  await dedupe('k', fn);
  const second = await dedupe('k', fn);
  assert.equal(second, 2); // ran again — settled promise is never reused
  assert.equal(inFlightCount(), 0);
});

test('a failed request removes itself: the retry runs fresh, not against the rejection', async () => {
  clearInFlight();
  let attempts = 0;
  const failer = async () => {
    attempts += 1;
    throw new Error('duffel down');
  };
  const first = dedupe('k', failer).catch((e) => e);
  const shared = dedupe('k', failer).catch((e) => e); // shares the SAME failure
  const [e1, e2] = await Promise.all([first, shared]);
  assert.equal(attempts, 1);
  assert.equal(e1, e2);
  const ok = await dedupe('k', async () => 'recovered');
  assert.equal(ok, 'recovered');
});

test('bad keys are refused up front', () => {
  clearInFlight();
  assert.throws(() => dedupe('', async () => 1), /non-empty/);
  assert.throws(() => dedupe(42, async () => 1), /non-empty/);
});
