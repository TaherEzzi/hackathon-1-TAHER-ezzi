/**
 * lib/server/itinerary-request.ts — POST /api/itineraries body.
 * book_now (default, as before): one depart date → bookNowCompare.
 * plan: the planner's runway body (window + cards + spend) → runwayCompute.
 */
import { z } from "zod";
import { CARD_PRODUCTS, SPEND_CATEGORIES, type SpendCategory } from "./card-earn";

const iata = z.string().trim().regex(/^[A-Za-z]{3}$/).transform((s) => s.toUpperCase());
const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const program = z.string().trim().regex(/^[A-Z_]{2,12}$/);
const cabin = z.enum(["economy", "premium", "business", "first"]);
const money = z.number().min(0).max(1_000_000);

const spendSchema = z
  .object(Object.fromEntries(SPEND_CATEGORIES.map((c) => [c, money.optional()])) as Record<SpendCategory, z.ZodOptional<typeof money>>)
  .transform((spend) => {
    const out: Partial<Record<SpendCategory, number>> = {};
    for (const category of SPEND_CATEGORIES) {
      const amount = spend[category];
      if (amount !== undefined) out[category] = amount;
    }
    return out;
  });

const bookNowBody = z.object({
  mode: z.literal("book_now").default("book_now"),
  origin: iata,
  destination: iata,
  depart_date: isoDay,
  cabin,
  pax: z.number().int().min(1).max(9),
  card: program.optional().nullable(),
  target_program: program.optional().nullable(),
  explanation: z.string().max(4000).optional(),
});

const planBody = z.object({
  mode: z.literal("plan"),
  origin: iata,
  destination: iata,
  window: z.object({ start: isoDay, end: isoDay }).refine((w) => w.start <= w.end, { message: "window.start must be on or before window.end" }),
  cabin: cabin.default("business"),
  pax: z.number().int().min(1).max(9).default(1),
  card: program.optional().nullable(),
  plan: z.enum(["premium", "metal", "ultra"]).optional().nullable(),
  cards: z.array(z.enum(CARD_PRODUCTS)).max(CARD_PRODUCTS.length).optional(),
  spend: spendSchema.optional(),
  pointsHeld: z.number().min(0).max(10_000_000).optional(),
  monthlyTotal: money.optional(),
  travel_date: isoDay.optional().nullable(),
  lead_days: z.number().int().min(0).max(365).optional().nullable(),
});

export type BookNowRequest = z.infer<typeof bookNowBody>;
export type PlanRequest = z.infer<typeof planBody>;
export type ItineraryRequest = BookNowRequest | PlanRequest;

export function parseItineraryRequest(raw: unknown): { ok: true; value: ItineraryRequest } | { ok: false; message: string } {
  const isPlan = !!raw && typeof raw === "object" && (raw as { mode?: unknown }).mode === "plan";
  const parsed = isPlan ? planBody.safeParse(raw) : bookNowBody.safeParse(raw);
  if (parsed.success) return { ok: true, value: parsed.data };
  return { ok: false, message: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
}
