/**
 * lib/server/verdict-engine.ts — the composition point for F2.
 * ALL verdict math lives in lib/engine/verdict.mjs (imported, never
 * reimplemented). This file only assembles the D20 breakdown — taxes + fees +
 * plan cost at official dated rates + the points value at the pair's cpp,
 * snapshots the pair cpp + verified_at actually used (reproducibility), and
 * carries badges + ages on every figure.
 */
import { computeVerdict } from "../engine/verdict.mjs";

export interface BookNowVerdictInput {
  cashAmount: number;
  cashCurrency: string;
  taxes: { amount: number; currency: string };
  miles: number;
  pair: { low: number; high: number; currency: string; verified_at: string };
  pax: number;
  cashFetchedAt: string;
  maxAgeHours: number;
  planCost: number | null;
  awardProgram: string;
  card: string;
  attribution: string;
  cashBadges: { badge: string; stale: boolean; age_hours: number; fetched_at: string; reverifyMoved: number | null };
  pairFx?: { rate: number; badge: string; stale: boolean; age_hours: number; fetched_at: string } | null;
  pairDataset: { cpp_low: number; cpp_high: number; source_url: string; verified_at: string };
}

export interface BookNowVerdict {
  verdict: "usar_puntos" | "pagar_en_efectivo" | "insufficient_data";
  savings_eur: number | null;
  savings_pct: number | null;
  badges: string[];
  cash: { amount: number; currency: string; badge: string; stale: boolean; age_hours: number; fetched_at: string } | null;
  cash_moved: number | null;
  award: { miles: number; taxes: { amount: number; currency: string }; seats: string; badge: string; verified_at: string; program: string } | null;
  pair: { low: number; high: number; currency: string; verified_at: string; source_url: string; fx: BookNowVerdictInput["pairFx"]; badge: "estimación" } | null;
  card_gate: { asked: boolean; card: string | null; reason: string | null };
  breakdown: Record<string, unknown> | null;
  insufficient_reason?: string;
  attribution: string;
}

export function computeBookNowVerdict(input: BookNowVerdictInput): BookNowVerdict {
  const { cashAmount, cashCurrency, taxes, miles, pair, pax, cashFetchedAt, maxAgeHours, planCost, awardProgram, card, attribution, cashBadges, pairFx, pairDataset } = input;
  let computed: ReturnType<typeof computeVerdict> | null;
  let insufficientReason: string | null = null;
  try {
    computed = computeVerdict({
      cash: { amount: cashAmount, currency: cashCurrency },
      taxes,
      miles,
      pair,
      pax,
      cashFetchedAt,
      maxAgeHours,
    });
  } catch (err) {
    insufficientReason = err instanceof Error ? err.message : String(err);
    computed = null;
  }

  if (!computed) {
    return {
      verdict: "insufficient_data",
      savings_eur: null,
      savings_pct: null,
      badges: ["estimación"],
      cash: {
        amount: cashAmount,
        currency: cashCurrency,
        badge: cashBadges.badge,
        stale: cashBadges.stale,
        age_hours: cashBadges.age_hours,
        fetched_at: cashBadges.fetched_at,
      },
      cash_moved: cashBadges.reverifyMoved,
      award: null,
      pair: null,
      card_gate: { asked: true, card, reason: insufficientReason },
      breakdown: null,
      insufficient_reason: insufficientReason ?? "verdict math refused the inputs",
      attribution,
    };
  }

  // D20 breakdown: taxes (award) + fees (award taxes include them) + plan cost
  // at the official dated rate + points value at the pair's cpp — never one
  // merged number; snapshots the pair cpp + verified_at used.
  const breakdown = {
    currency: computed.breakdown.currency,
    cash: computed.breakdown.cash,
    taxes: computed.breakdown.taxes,
    miles: computed.breakdown.miles,
    cpp_after_taxes: computed.breakdown.cpp,
    points_value: {
      low: Math.round(miles * pax * pair.low * 100) / 100,
      high: Math.round(miles * pax * pair.high * 100) / 100,
      currency: pair.currency,
    },
    plan_cost: planCost === null ? null : { amount: planCost, currency: "EUR", note: "cuota mensual oficial (D20), incluida en la comparación" },
    pair_snapshot: {
      low: pairDataset.cpp_low,
      high: pairDataset.cpp_high,
      unit: "USD céntimos por punto (dataset, CC-BY-4.0)",
      source_url: pairDataset.source_url,
      verified_at: pairDataset.verified_at,
      fx: pairFx,
    },
    seat_basis: computed.breakdown.seat_basis,
    seat_capacity_note: computed.breakdown.seat_capacity_note ?? null,
  };

  return {
    ...computed,
    badges: computed.badges,
    cash: {
      amount: cashAmount,
      currency: cashCurrency,
      badge: cashBadges.badge,
      stale: cashBadges.stale,
      age_hours: cashBadges.age_hours,
      fetched_at: cashBadges.fetched_at,
    },
    cash_moved: cashBadges.reverifyMoved,
    award: {
      miles,
      taxes,
      seats: "unknown",
      badge: "estimación",
      verified_at: pairDataset.verified_at,
      program: awardProgram,
    },
    pair: {
      low: pair.low,
      high: pair.high,
      currency: pair.currency,
      verified_at: pair.verified_at,
      source_url: pairDataset.source_url,
      fx: pairFx,
      badge: "estimación",
    },
    card_gate: { asked: true, card, reason: null },
    breakdown,
    attribution,
  };
}


