/**
 * Fills dates Duffel did not price, and an award figure the fixture does not
 * have, from one caller-supplied estimate. A date that already has a fare is
 * left as it was.
 */
import { ProviderError } from "../engine/verdict.mjs";
import type { CashFare } from "./engine";

export class ChartFareError extends Error {
  readonly code = "chart_fare" as const;
  constructor(amount: number) {
    super(`chart cash is not a price (${amount})`);
    this.name = "ChartFareError";
  }
}

export interface FareEstimate {
  cash: { date: string; amount_eur: number }[];
  award: { miles: number; taxes_eur: number } | null;
}

export interface FareLoad {
  fares: Record<string, CashFare>;
  dates: string[];
  projection: { anchored_on: string; horizon_edge: string } | null;
}

export interface FilledFares extends FareLoad {
  award: { miles: number; taxes_eur: number } | null;
}

/** Copies `fares` and writes a chart price only onto dates that have none. */
export function stampMissingCash(
  fares: Record<string, CashFare>,
  dates: readonly string[],
  amountEur: number,
  now: Date = new Date(),
): Record<string, CashFare> {
  if (!(amountEur > 0) || !Number.isFinite(amountEur)) {
    throw new ChartFareError(amountEur);
  }
  const fetchedAt = now.toISOString();
  const next: Record<string, CashFare> = { ...fares };
  for (const date of dates) {
    if (next[date]) continue;
    next[date] = {
      amount: amountEur,
      currency: "EUR",
      badge: "estimación",
      stale: false,
      age_hours: 0,
      fetched_at: fetchedAt,
      cached: false,
      offer_id: null,
    };
  }
  return next;
}

export async function fillMissingFares(
  load: FareLoad,
  wanted: string[],
  haveAward: boolean,
  estimate: (missing: string[]) => Promise<FareEstimate>,
  now: Date = new Date(),
): Promise<FilledFares> {
  const missing = wanted.filter((date) => !load.fares[date]);
  if (missing.length === 0 && haveAward) {
    return { ...load, award: null };
  }
  const estimated = await estimate(missing);
  const fares: Record<string, CashFare> = { ...load.fares };
  for (const date of missing) {
    const row = estimated.cash.find((item) => item.date === date);
    if (!row || !(row.amount_eur > 0) || !Number.isFinite(row.amount_eur)) {
      throw new ProviderError("grok", `estimate missing a price for ${date}`);
    }
    fares[date] = {
      amount: row.amount_eur,
      currency: "EUR",
      badge: "estimación",
      stale: false,
      age_hours: 0,
      fetched_at: now.toISOString(),
      cached: false,
      offer_id: null,
    };
  }
  return {
    fares,
    dates: wanted.filter((date) => fares[date]),
    projection: load.projection,
    award: estimated.award,
  };
}
