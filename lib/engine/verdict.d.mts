// lib/engine/verdict.d.ts — exact surface of verdict.mjs (mirror; math stays in .mjs)
export declare class InsufficientData extends Error {
  code: "insufficient_data";
  detail: string;
  constructor(detail: string);
}
export declare class ProviderError extends Error {
  code: "provider_error";
  provider: string;
  constructor(provider: string, detail: string);
}

export type PriceBadgeResult = { badge: "en vivo" | "cacheado" | "estimación"; stale: boolean; age_hours: number };

export declare function priceBadge(p: {
  kind: "live" | "cached" | "fixture";
  fetchedAt: Date | string | null | undefined;
  now?: Date;
  maxAgeHours?: number;
}): PriceBadgeResult;

export declare const floorCents: (eur: number) => number;
export declare const ceilPoints: (points: number) => number;

export declare function assertSameCurrency(
  figures: Array<{ amount: number; currency: string | null; label: string; valid?: boolean }>,
): string;

export declare function cppAfterTaxes(p: {
  cash: number;
  taxes: number;
  miles: number;
}): { cpp: number | null; after_tax_cash: number; invalid?: "taxes_gte_cash" };

export interface ComputeVerdictArgs {
  cash: { amount: number; currency: string };
  taxes: { amount: number; currency: string };
  miles: number;
  pair: { low: number; high: number; currency: string; verified_at?: string | null };
  pax?: number;
  cashFetchedAt?: Date | string | null;
  now?: Date;
  maxAgeHours?: number;
}

export interface VerdictResult {
  verdict: "usar_puntos" | "pagar_en_efectivo";
  savings_eur: number | null;
  savings_pct: number | null;
  breakdown: {
    currency: string;
    cash: number;
    taxes: number;
    miles: number;
    cpp: number | null;
    pair_used?: { low: number; high: number; verified_at: string | null };
    reason?: string;
    seat_basis?: 1;
    seat_capacity_note?: string | null;
  };
  badges: string[];
}

export declare function computeVerdict(args: ComputeVerdictArgs): VerdictResult;

export declare function perProgramGap(needed: number, reachable: number): { gap: number; enough: boolean };

export declare function monthlyEarn(p: {
  spendMonthly: number;
  rateLow: number;
  rateHigh: number;
  expiring?: number;
}): { low: number; high: number };

export declare function enoughBy(
  gap: number,
  monthlyEarnLow: number,
  monthlyEarnHigh: number,
  today?: Date,
): { feasible: boolean; by_date: string | null; by_date_high: string | null; months_low: number | null };

export declare function sanitizeBalance(balance: number): number;
