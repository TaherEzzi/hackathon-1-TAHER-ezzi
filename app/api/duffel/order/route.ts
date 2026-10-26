/**
 * POST /api/duffel/order — test-mode order (F8, D31). Sandbox airline, simulated
 * payment, dummy reference; permanently demo-grade in v1. No PAN ever enters this
 * route by design. The order writes an audit_log row (engine runs that mutate
 * data append to audit_log) and records the fresh Duffel usage.
 */
import { z } from "zod";
import { requireUser, typedError, serviceClient } from "../../../../lib/server/supabase";
import { engineForUser } from "../../../../lib/server/factory";
import { createTestOrder, type TestOrderPassenger, type DuffelOffer } from "../../../../lib/server/duffel";
import { writeAudit } from "../../../../lib/server/audit";

export const runtime = "nodejs";

const passengerSchema = z.object({
  id: z.string().trim().regex(/^pas_[A-Za-z0-9]+$/),
  title: z.string().trim().min(1).max(10),
  given_name: z.string().trim().min(1).max(60),
  family_name: z.string().trim().min(1).max(80),
  born_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  gender: z.enum(["m", "f", "x"]).optional(),
  email: z.string().email(),
  phone_number: z.string().trim().min(5).max(24),
});

const bodySchema = z.object({
  offer_id: z.string().trim().regex(/^orf_[A-Za-z0-9]+$/),
  offer_total: z.object({ amount: z.number().positive(), currency: z.string().trim().length(3) }),
  passenger_ids: z.array(z.string().trim().regex(/^pas_[A-Za-z0-9]+$/)).min(1),
  passengers: z.array(passengerSchema).min(1).max(9),
  contact_email: z.string().email(),
  contact_phone: z.string().trim().min(5).max(24),
});

export async function POST(req: Request): Promise<Response> {
  try {
    const { user } = await requireUser(req);
    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return typedError(400, "bad_request", parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
    const { ctx } = await engineForUser(req);

    // re-verify here too: the caller's snapshot is never trusted for money.
    const verified = await repriceCached(ctx, parsed.data.offer_id);
    const vOffer: DuffelOffer = verified.payload;
    if (Math.abs(vOffer.total.amount - parsed.data.offer_total.amount) > 0.01) {
      return typedError(409, "price_moved", "el precio cambió desde tu cita — confirma de nuevo con el total verificado", {
        old_total: parsed.data.offer_total,
        new_total: vOffer.total,
      });
    }

    const order = await createTestOrder({
      offer: vOffer,
      passengers: parsed.data.passengers as unknown as TestOrderPassenger[],
      contact_email: parsed.data.contact_email,
      contact_phone: parsed.data.contact_phone,
    });
    await writeAudit(serviceClient(), {
      actor: user.id,
      action: "test_order_created",
      entity: "duffel_order",
      details: {
        offer_id: vOffer.id,
        order_id: order.id,
        booking_reference: order.booking_reference,
        total: order.total,
        airline: order.airline,
        live_mode: false,
        note: "demo-grade sandbox order (D31); no real payment issued",
      },
    });
    ctx.usage("duffel").catch(() => undefined);
    return Response.json({ order }, { status: 201 });
  } catch (err) {
    if ((err as { status?: number }).status === 401) return typedError(401, "unauthorized", "sign in first");
    if ((err as { code?: string }).code === "provider_error") {
      const e = err as Error & { provider?: string };
      return typedError(502, "provider_error", e.message.slice(0, 400), { provider: e.provider ?? "duffel" });
    }
    return typedError(500, "internal", err instanceof Error ? err.message : String(err));
  }
}

async function repriceCached(ctx: Awaited<ReturnType<typeof engineForUser>>["ctx"], offerId: string) {
  const { repriceOfferCached } = await import("../../../../lib/server/duffel");
  const res = await repriceOfferCached({ offerId, store: ctx.cache, maxAgeHours: ctx.maxAgeHours });
  if (!res.source_error) await ctx.usage("duffel").catch(() => undefined);
  return res;
}
