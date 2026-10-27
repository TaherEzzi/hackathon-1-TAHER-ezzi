/**
 * POST /api/engine/runway — F1 plan mode end to end: ONE ranged cash query
 * (≤ 7 candidate dates, MUST #14), per-program projections low–high (D26),
 * D21 value ranking with the labelled seasonal trend (D27), and the
 * accelerator branch when the low end is infeasible (T1 designed outcome).
 */
import { z } from "zod";
import { requireUser, typedError } from "../../../../lib/server/supabase";
import { engineForUser } from "../../../../lib/server/factory";
import { runwayCompute } from "../../../../lib/server/engine";
import { CARD_PRODUCTS, SPEND_CATEGORIES, type SpendCategory } from "../../../../lib/server/card-earn";
import { InsufficientData } from "../../../../lib/engine/verdict.mjs";

export const runtime = "nodejs";

const bodySchema = z.object({
  origin: z.string().trim().regex(/^[A-Za-z]{3}$/).transform((s) => s.toUpperCase()),
  destination: z.string().trim().regex(/^[A-Za-z]{3}$/).transform((s) => s.toUpperCase()),
  window: z.object({ start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }),
  cabin: z.enum(["economy", "premium", "business", "first"]).default("business"),
  pax: z.number().int().min(1).max(9).default(1),
  card: z.string().trim().regex(/^[A-Z_]{2,12}$/).optional().nullable(),
  plan: z.enum(["premium", "metal", "ultra"]).optional().nullable(),
  cards: z.array(z.enum(CARD_PRODUCTS)).max(CARD_PRODUCTS.length).optional(),
  spend: z.object({
    fuel: z.number().min(0).max(1_000_000).optional(),
    groceries: z.number().min(0).max(1_000_000).optional(),
    dining: z.number().min(0).max(1_000_000).optional(),
    shopping: z.number().min(0).max(1_000_000).optional(),
    leisure: z.number().min(0).max(1_000_000).optional(),
    transport: z.number().min(0).max(1_000_000).optional(),
    travel: z.number().min(0).max(1_000_000).optional(),
  }).optional(),
  pointsHeld: z.number().min(0).max(10_000_000).optional(),
  monthlyTotal: z.number().min(0).max(1_000_000).optional(),
});

export async function POST(req: Request): Promise<Response> {
  try {
    await requireUser(req);
    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return typedError(400, "bad_request", parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
    const { ctx } = await engineForUser(req);
    const spend = parsed.data.spend;
    const cleanSpend: Partial<Record<SpendCategory, number>> = {};
    if (spend) {
      for (const category of SPEND_CATEGORIES) {
        const amount = spend[category];
        if (amount !== undefined) cleanSpend[category] = amount;
      }
    }
    const result = await runwayCompute(ctx, { ...parsed.data, spend: spend ? cleanSpend : undefined });
    return Response.json(result);
  } catch (err) {
    if ((err as { status?: number }).status === 401) return typedError(401, "unauthorized", "sign in first");
    if (err instanceof InsufficientData) {
      return typedError(400, "insufficient_data", err.detail);
    }
    if ((err as { code?: string }).code === "provider_error") {
      const e = err as Error & { provider?: string };
      return typedError(502, "provider_error", e.message.slice(0, 400), { provider: e.provider ?? "duffel" });
    }
    return typedError(500, "internal", err instanceof Error ? err.message : String(err));
  }
}
