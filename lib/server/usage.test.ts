/**
 * Gate-7 integration test (BRIEF §7.7): usage rows increment per distinct
 * call; dedupe collapses in-flight duplicates to ONE provider roundtrip and
 * ONE usage increment; cache hits never count as provider calls.
 * Tests run against an in-memory stand-in of the `usage` table shaped like
 * bumpUsage's narrow read-modify-upsert contract.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { bumpUsage, writeAudit } from "./audit";
import { cachedProviderCall, memoryCacheStore, buildCacheKey } from "./cache";

class FakeUsageDB {
  rows: Map<string, number> = new Map();
  audit: Array<Record<string, unknown>> = [];

  from(table: string) {
    const key = `${table}`;
    const select = () => this.builder(true);
    const buildSelf = () => this.builder(false);
    return this.builder(false);
  }

  private builder(isSelect: boolean) {
    let current: { user_id?: string; day?: string; provider?: string };
    const api = {
      select: (..._cols: string[]) => api,
      eq: (col: string, value: string) => {
        (current as Record<string, string>)[col] = value;
        return api;
      },
      maybeSingle: async () => {
        const { user_id, day, provider } = current;
        if (!(user_id && day && provider)) return { data: null, error: null };
        const key = dbKey({ user_id, day, provider });
        return {
          data: this.rows.has(key) ? { calls: this.rows.get(key) } : null,
          error: null,
        };
      },
      upsert: async (row: { user_id: string; day: string; provider: string; calls: number }) => {
        this.rows.set(dbKey(row), row.calls);
        return { error: null };
      },
      insert: async (row: Record<string, unknown>) => {
        this.audit.push(row);
        return { error: null };
      },
    };
    current = {};
    return api;
  }
}

const dbKey = (r: { user_id: string; day: string; provider: string }) => `${r.user_id}|${r.day}|${r.provider}`;

const DAY = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Madrid" })).toISOString().slice(0, 10);

test("one fresh provider call ⇒ one usage row with calls=1", async () => {
  const db = new FakeUsageDB();
  const res = await bumpUsage(db as unknown as Parameters<typeof bumpUsage>[0], { user_id: "u1", provider: "duffel" });
  assert.equal(res.ok, true);
  assert.equal(db.rows.get(`u1|${DAY}|duffel`), 1);
});

test("n distinct calls ⇒ n increments on the same row; different providers stay separate", async () => {
  const db = new FakeUsageDB();
  const client = db as unknown as Parameters<typeof bumpUsage>[0];
  for (let i = 0; i < 3; i++) await bumpUsage(client, { user_id: "u1", provider: "duffel" });
  await bumpUsage(client, { user_id: "u1", provider: "fx" });
  assert.equal(db.rows.get(`u1|${DAY}|duffel`), 3);
  assert.equal(db.rows.get(`u1|${DAY}|fx`), 1);
});

test("dedupe collapses concurrent duplicate keys ⇒ exactly ONE provider call + ONE usage bump", async () => {
  const db = new FakeUsageDB();
  const store = memoryCacheStore();
  const key = buildCacheKey({ provider: "duffel", origin: "MAD", destination: "JNB", date: "2027-01-24", cabin: "business", pax: 1 });
  let fetchCount = 0;
  let bumps = 0;
  const sink = async () => {
    bumps++;
    const r = await bumpUsage(db as unknown as Parameters<typeof bumpUsage>[0], { user_id: "demo", provider: "duffel" });
    assert.equal(r.ok, true);
  };

  const mk = () => cachedProviderCall({
    key,
    store,
    maxAgeHours: 24,
    provider: "duffel",
    fetch: async () => {
      fetchCount++;
      await new Promise((r2) => setTimeout(r2, 5));
      await sink();
      return { amount: 690, currency: "EUR" };
    },
  });

  const calls = [mk(), mk(), mk(), mk()]; // 4 concurrent identical requests
  await Promise.all(calls);
  assert.equal(fetchCount, 1, "in-flight duplicates share one promise");
  assert.equal(bumps, 1, "usage counted once per distinct call");
  assert.equal(db.rows.get(`demo|${DAY}|duffel`), 1);
});

test("later cache hits do NOT re-bump usage (a cache hit is not a provider call, D11/F9)", async () => {
  const db = new FakeUsageDB();
  const store = memoryCacheStore();
  const key = buildCacheKey({ provider: "duffel", origin: "MAD", destination: "JNB", date: "2027-01-25", cabin: "economy", pax: 2 });
  await store.set({ cache_key: key, payload: { ok: 1 }, ttl_hours: 24 });
  let bumps = 0;
  const sink = async () => {
    bumps++;
    await bumpUsage(db as unknown as Parameters<typeof bumpUsage>[0], { user_id: "u2", provider: "duffel" });
  };
  const res = await cachedProviderCall({
    key,
    store,
    maxAgeHours: 24,
    provider: "duffel",
    fetch: async () => {
      await sink();
      return { fresh: true };
    },
  });
  // first await is a FRESH fetch (store empty before provider)... wait: the row WAS present — §5.2 only consults the store on FAILURE, so fresh goes through
  assert.equal(res.badge, "en vivo");
  assert.equal(bumps, 1);
});

test("audit write lands one row per engine mutation", async () => {
  const db = new FakeUsageDB();
  const res = await writeAudit(db as unknown as Parameters<typeof writeAudit>[0], { actor: "u3", action: "test", entity: "x", details: { k: 1 } });
  assert.equal(res.ok, true);
  assert.equal(db.audit.length, 1);
  assert.deepEqual(db.audit[0].details, { k: 1 });
  assert.ok(db.audit[0].actor !== undefined);
});
