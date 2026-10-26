/**
 * POST /api/duffel/price — F8 re-verification of ONE chosen offer (offer →
 * price → order; never pay off a search snapshot). Same dedupe+cache+badge and
 * usage discipline as the offers route (fresh roundtrip = recorded; re-checks
 * of a stored verification are cache hits).
 */
import { z } from "zod";
import { requireUser, typedError } from "../../../../lib/server/supabase";
import { engineForUser } from "../../../../lib/server/factory";
import { repriceOfferCached } from "../../../../lib/server/duffel";

export const runtime = "nodejs";

const bodySchema = z.object({
  offer_id: z.string().trim().regex(/^orf_[A-Za-z0-9]+$/),
});

export async function POST(req: Request): Promise<Response> {
  try {
    await requireUser(req);
    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return typedError(400, "bad_request", "offer_id requerido (orf_…)");
    const { ctx } = await engineForUser(req);
    const res = await repriceOfferCached({
      offerId: parsed.data.offer_id,
      store: ctx.cache,
      maxAgeHours: ctx.maxAgeHours,
    });
    return Response.json({
      offer: res.payload,
      badge: res.badge,
      stale: res.stale,
      age_hours: res.age_hours,
      fetched_at: res.fetched_at,
      source_error: res.source_error ?? null,
    });
  } catch (err) {
    if ((err as { status?: number }).status === 401) return typedError(401, "unauthorized", "sign in first");
    if ((err as { code?: string }).code === "provider_error") {
      const e = err as Error & { provider?: string };
      return typedError(502, "provider_error", e.message.slice(0, 400), { provider: e.provider ?? "duffel" });
    }
    return typedError(500, "internal", err instanceof Error ? err.message : String(err));
  }
}
