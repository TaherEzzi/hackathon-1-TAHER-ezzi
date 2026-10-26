/**
 * lib/server/fx.ts — dated FX through frankfurter.dev (ECB, free, keyless),
 * served through the same dedupe+cache discipline as every other provider call
 * (free stack item, D29). Returns the dated rate + its badge; a failing lookup
 * is typed, never a silent default rate.
 */
import { cachedProviderCall, memoryCacheStore, type BadgedResult } from "./cache";
import { ProviderError } from "../engine/verdict.mjs";

async function fetchRate(base: string, quote: string): Promise<number> {
  let res: Response;
  try {
    res = await fetch(`https://api.frankfurter.dev/v1/latest?base=${base}&symbols=${quote}`);
  } catch (err) {
    throw new ProviderError("fx", err instanceof Error ? err.message : String(err));
  }
  const body = await res.json().catch(() => null);
  const rate = body?.rates?.[quote];
  if (!res.ok || !(Number(rate) > 0)) {
    throw new ProviderError("fx", `unreadable ${base}→${quote} rate from frankfurter`);
  }
  return Number(rate);
}

/** USD→EUR rate with badge/age through the shared cache store seam. */
export function usdEurCached(store = memoryCacheStore(), maxAgeHours = 24): Promise<BadgedResult<number>> {
  return cachedProviderCall<number>({
    provider: "fx",
    key: "fx:USD:EUR:latest:fx:1",
    store,
    maxAgeHours,
    ttlHours: 6, // ECB rates move once a day; 6 h keeps it honest
    fetch: () => fetchRate("USD", "EUR"),
  });
}
