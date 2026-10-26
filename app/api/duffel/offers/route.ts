/**
 * POST /api/duffel/offers — cash offers (test mode only), through the §5.2
 * dedupe+cache discipline. Response carries figure + badge + age; a provider
 * failure serves the stored row badged `cacheado` keeping the typed error,
 * or the typed ProviderError when no row exists. Usage recorded on FRESH calls.
 */
import { z } from "zod";
import { requireUser, typedError } from "../../../../lib/server/supabase";
import { engineForUser } from "../../../../lib/server/factory";
import { getOffersCached, cheapestSaneOffer } from "../../../../lib/server/duffel";
import { windowDates } from "../../../../lib/server/engine";

export const runtime = "nodejs";

const bodySchema = z.object({
  origin: z.string().trim().regex(/^[A-Za-z]{3}$/).transform((s) => s.toUpperCase()),
  destination: z.string().trim().regex(/^[A-Za-z]{3}$/).transform((s) => s.toUpperCase()),
  depart_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  window: z.object({ from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).optional(),
  cabin: z.enum(["economy", "premium", "business", "first"]),
  pax: z.number().int().min(1).max(9),
});

export async function POST(req: Request): Promise<Response> {
  try {
    const { user } = await requireUser(req);
    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return typedError(400, "bad_request", parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
    const { origin, destination, depart_date, window, cabin, pax } = parsed.data;
    if (!depart_date && !window) return typedError(400, "bad_request", "depart_date o window requerido");
    const { ctx } = await engineForUser(req);
    if (window && !depart_date) {
      // Duffel v2 offer requests accept only scalar departure dates (verified
      // live 2026-10-26): a window fans out to ≤7 per-date cached+deduped
      // scalar queries, one entry per date in the response.
      const dates = windowDates(window.from, window.to, 7);
      const byDate = await Promise.all(
        dates.map(async (departure_date) => {
          const res = await getOffersCached({ params: { origin, destination, departure_date, cabin, pax }, store: ctx.cache, maxAgeHours: ctx.maxAgeHours });
          if (!res.source_error) await ctx.usage("duffel").catch(() => undefined);
          return {
            depart_date: departure_date,
            badge: res.badge,
            stale: res.stale,
            age_hours: res.age_hours,
            fetched_at: res.fetched_at,
            source_error: res.source_error ?? null,
            cheapest: cheapestSaneOffer(res.payload.offers, "EUR") ?? cheapestSaneOffer(res.payload.offers),
          };
        }),
      );
      return Response.json({ mode: "window", window, by_date: byDate });
    }
    const res = await getOffersCached({
      params: {
        origin,
        destination,
        departure_date: depart_date!,
        cabin,
        pax,
      },
      store: ctx.cache,
      maxAgeHours: ctx.maxAgeHours,
    });
    return Response.json({
      offers: res.payload.offers,
      badge: res.badge,
      stale: res.stale,
      age_hours: res.age_hours,
      fetched_at: res.fetched_at,
      source_error: res.source_error ?? null,
      cheapest: cheapestSaneOffer(res.payload.offers, "EUR") ?? cheapestSaneOffer(res.payload.offers),
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
