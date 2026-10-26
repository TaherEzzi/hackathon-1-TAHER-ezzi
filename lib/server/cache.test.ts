/**
 * Gate-2 test (BRIEF §7.2): cache round-trip stores + serves TTL-stale badges
 * per §5.2 — success stores and serves `en vivo`; failure serves the stored row
 * badged `cacheado` (age visible) and keeps the typed ProviderError; a row
 * older than the staleness threshold serves `estimación` + stale; no row ⇒
 * the typed ProviderError propagates.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCacheKey,
  cachedProviderCall,
  memoryCacheStore,
  ProviderError,
} from "./cache";

const KEY = buildCacheKey({
  provider: "duffel",
  origin: "MAD",
  destination: "JNB",
  date: "2027-01-26",
  cabin: "business",
  pax: 1,
});
const MAX_AGE = 24;

test("cache key is the exact §5.2 string — same shape for dedupe and cache", () => {
  assert.equal(KEY, "duffel:MAD:JNB:2027-01-26:business:1");
});

test("provider success stores the row and serves it as `en vivo` (fresh live)", async () => {
  const store = memoryCacheStore();
  const res = await cachedProviderCall({
    provider: "duffel",
    key: KEY,
    store,
    maxAgeHours: MAX_AGE,
    fetch: async () => ({ amount: 690.0, currency: "EUR" }),
  });
  assert.equal(res.badge, "en vivo");
  assert.equal(res.cached, false);
  assert.equal(res.stale, false);
  assert.deepEqual(res.payload, { amount: 690.0, currency: "EUR" });
  // round trip: the row is now in the store with fetched_at + ttl
  const row = await store.get(KEY);
  assert.ok(row && typeof row.fetched_at === "string" && row.ttl_hours > 0);
});

test("provider failure serves the cache row badged `cacheado` with its age, keeping the typed error", async () => {
  const store = memoryCacheStore();
  await store.set({
    cache_key: KEY,
    payload: { amount: 655.4, currency: "EUR" },
    ttl_hours: 24,
    fetched_at: new Date(Date.now() - 2 * 3_600_000).toISOString(), // 2 h old, within 24 h
  });
  let fetchCalls = 0;
  const res = await cachedProviderCall({
    provider: "duffel",
    key: KEY,
    store,
    maxAgeHours: MAX_AGE,
    fetch: async () => {
      fetchCalls++;
      throw new ProviderError("duffel", "HTTP 503 from offer_requests");
    },
  });
  assert.equal(fetchCalls, 2, "retries exactly once");
  assert.equal(res.cached, true);
  assert.equal(res.badge, "cacheado");
  assert.equal(res.stale, false);
  assert.equal(res.age_hours, 2);
  assert.deepEqual(res.payload, { amount: 655.4, currency: "EUR" });
  // the error is never dropped — it rides in the payload
  assert.equal(res.source_error?.provider, "duffel");
  assert.match(res.source_error?.detail ?? "", /503/);
});

test("stored row older than the TTL threshold serves `estimación` + stale (never fresh)", async () => {
  const store = memoryCacheStore();
  await store.set({
    cache_key: KEY,
    payload: { amount: 610.9, currency: "EUR" },
    ttl_hours: 24,
    fetched_at: new Date(Date.now() - 30 * 3_600_000).toISOString(), // 30 h > 24 h threshold
  });
  const res = await cachedProviderCall({
    provider: "duffel",
    key: KEY,
    store,
    maxAgeHours: MAX_AGE,
    fetch: async () => {
      throw new ProviderError("duffel", "network unreachable");
    },
  });
  assert.equal(res.badge, "estimación");
  assert.equal(res.stale, true);
  assert.equal(res.age_hours, 30);
  assert.ok(res.source_error, "ProviderError kept in the payload");
});

test("failure with NO cache row throws the typed ProviderError (never silent, never invented)", async () => {
  const store = memoryCacheStore();
  await assert.rejects(
    cachedProviderCall({
      provider: "duffel",
      key: KEY,
      store,
      maxAgeHours: MAX_AGE,
      fetch: async () => {
        throw new Error("boom");
      },
    }),
    (err: unknown) => err instanceof ProviderError && err.provider === "duffel",
  );
});

test("non-ProviderError fetch failures are still surfaced typed, not swallowed", async () => {
  const store = memoryCacheStore();
  await assert.rejects(
    cachedProviderCall({
      provider: "duffel",
      key: KEY,
      store,
      maxAgeHours: MAX_AGE,
      fetch: async () => {
        throw new Error("socket hang up");
      },
    }),
    /boom|socket|insufficient|provider/i,
  );
});
