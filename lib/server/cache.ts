/**
 * lib/server/cache.ts — provider_cache read/write + TTL + badge handoff (§5.2).
 *
 * One cache string serves BOTH dedupe and cache (MUST #14):
 *   provider:origin:destination:date:cabin:pax          (buildCacheKey)
 *
 * Serve-through contract (§5.2, badges via lib/engine priceBadge — never re-guessed):
 *   - provider success  → store payload + fetched_at + ttl, serve as `en vivo`
 *   - provider failure  → retry once; serve cache row badged `cacheado` (with its
 *     age) and keep the typed ProviderError — the error is never dropped
 *   - row older than maxAgeHours → badge drops to `estimación` + stale (priceBadge)
 *   - no cache row on failure → the typed ProviderError propagates
 */
import { priceBadge, ProviderError } from "../engine/verdict.mjs";
import { dedupe } from "../engine/dedupe.mjs";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "../database.types";

export { ProviderError };

export interface CacheKeyParts {
  provider: string;
  origin: string;
  destination: string;
  /** ISO date the offer/prices refer to */
  date: string;
  cabin: string;
  pax: number;
}

/** Exact §5.2 key shape — one string, both dedup and cache use. */
export function buildCacheKey({ provider, origin, destination, date, cabin, pax }: CacheKeyParts): string {
  return `${provider}:${origin}:${destination}:${date}:${cabin}:${pax}`;
}

/** A stored cache row as consumers see it. */
export interface CacheRow<P = unknown> {
  payload: P;
  fetched_at: string;
  ttl_hours: number;
}

/**
 * Narrow persistence seam so tests can inject a store without a database,
 * while production always goes through the real Supabase client/service role.
 */
export interface CacheStore {
  get(cacheKey: string): Promise<CacheRow | null>;
  set(row: { cache_key: string; payload: unknown; ttl_hours: number; fetched_at?: string }): Promise<void>;
}

/** Production store: `provider_cache` via the (service-role) Supabase client. */
export function supabaseCacheStore(client: SupabaseClient<Database>): CacheStore {
  return {
    async get(cacheKey) {
      const { data, error } = await client
        .from("provider_cache")
        .select("payload, fetched_at, ttl_hours")
        .eq("cache_key", cacheKey)
        .maybeSingle();
      if (error) return null; // a cache read failure never breaks the provider path
      return (data as CacheRow | null) ?? null;
    },
    async set({ cache_key, payload, ttl_hours, fetched_at }) {
      await client
        .from("provider_cache")
        .upsert({ cache_key, payload: payload as Json, ttl_hours, ...(fetched_at ? { fetched_at } : {}) }, { onConflict: "cache_key" });
    },
  };
}

/** In-memory store (tests and same-process warmups). */
export function memoryCacheStore(): CacheStore {
  const rows = new Map<string, CacheRow>();
  return {
    async get(cacheKey) {
      return rows.get(cacheKey) ?? null;
    },
    async set({ cache_key, payload, ttl_hours, fetched_at }) {
      rows.set(cache_key, { payload, ttl_hours, fetched_at: fetched_at ?? new Date().toISOString() });
    },
  };
}

export interface BadgedResult<P> {
  payload: P;
  /** when this figure was actually fetched from the provider */
  fetched_at: string;
  /** true when the answer came from provider_cache, not the provider */
  cached: boolean;
  badge: string;
  stale: boolean;
  age_hours: number;
  /** present ONLY when the live fetch failed and a stored row was served (§5.2) */
  source_error?: { provider: string; code: "provider_error"; detail: string };
}

export interface CachedCallOptions<P> {
  /** the fetched provider attempt for this exact key; throws ProviderError/details on failure */
  fetch: () => Promise<P>;
  key: string;
  store: CacheStore;
  /** app_settings.cache_max_age_hours — cached row older than this serves as estimación */
  maxAgeHours: number;
  /** how long the fresh payload may serve as the cache answer without a new fetch */
  ttlHours?: number;
  provider: string;
  now?: Date;
}

/**
 * The §5.2 flow, for every provider call in the app. In-flight duplicates of
 * the same key share one promise (MUST #14) via lib/engine dedupe.
 */
export function cachedProviderCall<P>(
  { fetch, key, store, maxAgeHours, ttlHours = 24, provider, now }: CachedCallOptions<P>,
): Promise<BadgedResult<P>> {
  return dedupe(key, async (): Promise<BadgedResult<P>> => {
    // ── 1. attempt (bounded): fetch → retry once → serve cache-or-fail ───────
    let attemptError: unknown = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const payload = await fetch();
        const fetchedAt = new Date();
        await store.set({ cache_key: key, payload, ttl_hours: ttlHours, fetched_at: fetchedAt.toISOString() });
        const badge = priceBadge({ kind: "live", fetchedAt, now, maxAgeHours });
        return {
          payload,
          fetched_at: fetchedAt.toISOString(),
          cached: false,
          badge: badge.badge,
          stale: badge.stale,
          age_hours: badge.age_hours,
        };
      } catch (err) {
        attemptError = err; // retry once, then fall through to cache-or-fail
      }
    }

    // ── 2. provider failed twice: cache row badged honestly keeps going ──────
    const row = await store.get(key);
    const typed = attemptError instanceof ProviderError
      ? attemptError
      : new ProviderError(provider, attemptError instanceof Error ? attemptError.message : String(attemptError));
    if (row) {
      const badge = priceBadge({ kind: "cached", fetchedAt: row.fetched_at, now, maxAgeHours });
      return {
        payload: row.payload as P,
        fetched_at: row.fetched_at,
        cached: true,
        badge: badge.badge,
        stale: badge.stale,
        age_hours: badge.age_hours,
        source_error: { provider: typed.provider, code: "provider_error", detail: typed.message },
      };
    }
    throw typed; // no cache row ⇒ the typed ProviderError reaches the client (never silent)
  });
}
