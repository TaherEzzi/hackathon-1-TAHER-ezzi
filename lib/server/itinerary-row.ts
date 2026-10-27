/**
 * lib/server/itinerary-row.ts — engine result → public.itineraries insert.
 * Pure mapping. Plan rows leave the verdict column null: the DB only accepts
 * a verdict with taxes and a saving beside it (verdict_brings_all_figures_chk),
 * and a runway candidate carries neither taxes nor a guaranteed saving. The
 * candidate's own verdict stays inside breakdown.runway, untouched.
 */
import type { Database, Json } from "../database.types";
import type { CardProduct, SpendCategory } from "./card-earn";
import type { bookNowCompare, RunwayResult } from "./engine";

export type ItineraryInsert = Database["public"]["Tables"]["itineraries"]["Insert"];
export type BookNowResult = Awaited<ReturnType<typeof bookNowCompare>>;

/** What the traveller told us; stored so the plan page can redraw without step 1. */
export interface PlanInputs {
  origin: string;
  destination: string;
  window: { start: string; end: string };
  cabin: string;
  pax: number;
  travel_date?: string | null;
  lead_days?: number | null;
  cards?: CardProduct[];
  points_held?: number;
  monthly_total?: number;
  spend?: Partial<Record<SpendCategory, number>>;
  plan?: string | null;
}

export interface BookNowInputs {
  mode: "plan" | "book_now";
  origin: string;
  destination: string;
  depart_date: string;
  cabin: string;
  pax: number;
  explanation?: string | null;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export function runwayRow(userId: string, inputs: PlanInputs, result: RunwayResult, explanation?: string | null): ItineraryInsert | null {
  const rec = result.recommended;
  if (!rec) return null;
  const cash = rec.cash?.amount != null && rec.cash.amount > 0 ? rec.cash.amount : null;
  const savings = rec.savings_eur != null && rec.savings_eur >= 0 ? rec.savings_eur : null;
  const range = rec.proyeccion
    ? { low: Math.min(rec.proyeccion.low, rec.proyeccion.high), high: Math.max(rec.proyeccion.low, rec.proyeccion.high) }
    : null;
  return {
    user_id: userId,
    mode: "plan",
    origin: inputs.origin,
    destination: inputs.destination,
    window_start: inputs.window.start,
    window_end: inputs.window.end,
    depart_date: rec.depart_date,
    cabin: inputs.cabin,
    pax: inputs.pax,
    cash_amount: cash,
    cash_currency: cash != null ? rec.cash.currency : null,
    miles: rec.miles_needed != null && rec.miles_needed > 0 ? Math.round(rec.miles_needed) : null,
    taxes_amount: null,
    taxes_currency: null,
    verdict: null,
    savings_eur: savings,
    savings_pct: savings != null && cash != null ? round1((savings / cash) * 100) : null,
    range_low: range ? Math.round(range.low) : null,
    range_high: range ? Math.round(range.high) : null,
    badges: rec.cash?.badge ? [rec.cash.badge] : [],
    breakdown: { runway: result, inputs } as unknown as Json,
    explanation: explanation ?? null,
  };
}

export function bookNowRow(userId: string, inputs: BookNowInputs, result: BookNowResult): ItineraryInsert {
  return {
    user_id: userId,
    mode: inputs.mode,
    origin: inputs.origin,
    destination: inputs.destination,
    depart_date: inputs.depart_date,
    cabin: inputs.cabin,
    pax: inputs.pax,
    cash_amount: result.cash?.amount ?? null,
    cash_currency: result.cash?.currency ?? null,
    miles: (result.award?.miles ?? null) as number | null,
    taxes_amount: result.award?.taxes.amount ?? null,
    taxes_currency: result.award?.taxes.currency ?? null,
    verdict: result.verdict as string,
    savings_eur: result.savings_eur,
    savings_pct: result.savings_pct,
    range_low: null, // book-now is a live comparison; ranges belong to plan mode rows
    range_high: null,
    badges: result.badges as unknown as string[],
    breakdown: (result.breakdown ?? {}) as unknown as Json,
    explanation: inputs.explanation ?? result.insufficient_reason ?? null,
  };
}

export function planUrl(itineraryId: string): string {
  return `/trip-dossier.html?view=plan&id=${encodeURIComponent(itineraryId)}`;
}
