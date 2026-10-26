/**
 * POST /api/engine/verdict — F2 book-now comparison, end to end: live cash
 * (Duffel test mode) + re-verify, the labelled award fixture, the D19 card
 * gate with pair_valuations, and computeVerdict server-side. The response
 * carries every badge + age; insufficiencies answer `insufficient_data` with
 * the exact cause — never silence, never an invented figure.
 */
import { z } from "zod";
import { requireUser, typedError } from "../../../../lib/server/supabase";
import { engineForUser } from "../../../../lib/server/factory";
import { bookNowCompare } from "../../../../lib/server/engine";

export const runtime = "nodejs";

const bodySchema = z.object({
  origin: z.string().trim().regex(/^[A-Za-z]{3}$/).transform((s) => s.toUpperCase()),
  destination: z.string().trim().regex(/^[A-Za-z]{3}$/).transform((s) => s.toUpperCase()),
  depart_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  cabin: z.enum(["economy", "premium", "business", "first"]).default("business"),
  pax: z.number().int().min(1).max(9).default(1),
  card: z.string().trim().regex(/^[A-Z_]{2,12}$/).optional().nullable(),
  target_program: z.string().trim().regex(/^[A-Z_]{2,12}$/).optional().nullable(),
  plan: z.enum(["premium", "metal", "ultra"]).optional().nullable(),
});

export async function POST(req: Request): Promise<Response> {
  try {
    const { user } = await requireUser(req);
    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return typedError(400, "bad_request", parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
    const { ctx } = await engineForUser(req);
    const result = await bookNowCompare(ctx, { ...parsed.data, card: parsed.data.card ?? null });
    return Response.json(result);
  } catch (err) {
    if ((err as { status?: number }).status === 401) return typedError(401, "unauthorized", "sign in first");
    return typedError(500, "internal", err instanceof Error ? err.message : String(err));
  }
}
