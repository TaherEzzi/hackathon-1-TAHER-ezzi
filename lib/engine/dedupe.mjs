/**
 * lib/engine/dedupe.mjs — MVP in-flight dedup (MUST #14, settled 2026-10-26:
 * "a simple dedup is enough"). One in-flight request per unique query key;
 * duplicates await the same promise instead of hammering the provider.
 *
 * Usage when the API layer lands:
 *   const offer = await dedupe(`duffel:${origin}:${dest}:${date}:${cabin}:${pax}`,
 *                              () => duffelOfferRequest(...));
 * The key must contain EVERYTHING that changes the result (route, dates,
 * cabin, pax) or two different queries will wrongly share one answer.
 */

/** @type {Map<string, Promise<unknown>>} */
const inFlight = new Map();

/**
 * Run `fn` once per key while a call is already flying; awaiters share it.
 * @template T
 * @param {string} key
 * @param {() => Promise<T>} fn
 * @returns {Promise<T>}
 */
export function dedupe(key, fn) {
  if (typeof key !== 'string' || key.length === 0) {
    throw new Error('dedupe: key must be a non-empty string');
  }
  const existing = inFlight.get(key);
  if (existing) return existing;

  const promise = (async () => fn())().finally(() => {
    // Gone the moment it settles — a retried query starts fresh, never
    // serves a settled (possibly failed) promise to a new caller.
    inFlight.delete(key);
  });
  inFlight.set(key, promise);
  return promise;
}

/** @returns {number} how many requests are currently in flight (F10 dashboard) */
export const inFlightCount = () => inFlight.size;

/** Test helper — clears module state. */
export const clearInFlight = () => inFlight.clear();
