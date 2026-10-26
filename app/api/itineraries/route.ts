/**
 * /api/itineraries — F7 saved-trip records.
 * POST computes the verdict SERVER-side (the calls hit bookNowCompare on the
 * server; the route then writes the verdict columns with the SERVICE role) —
 * a client can never mint a verdict. GET/DELETE ride the caller's own client
 * (RLS: own rows). A DB CHECK violation is a bug in the engine, never a
 * suppressed insert.
 */
import { z } from "zod";
import { requireUser, typedError, serviceClient, userClientFrom } from "../../../lib/server/supabase";
import { engineForUser } from "../../../lib/server/factory";
import { bookNowCompare } from "../../../lib/server/engine";
import { writeAudit } from "../../../lib/server/audit";
import type { Database, Json } from "../../../lib/database.types";

export const runtime = "nodejs";

const postBody = z.object({
  mode: z.enum(["plan", "book_now"]).default("book_now"),
  origin: z.string().trim().regex(/^[A-Za-z]{3}$/).transform((s) => s.toUpperCase()),
  destination: z.string().trim().regex(/^[A-Za-z]{3}$/).transform((s) => s.toUpperCase()),
  depart_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  cabin: z.enum(["economy", "premium", "business", "first"]),
  pax: z.number().int().min(1).max(9),
  card: z.string().trim().regex(/^[A-Z_]{2,12}$/).optional().nullable(),
  target_program: z.string().trim().regex(/^[A-Z_]{2,12}$/).optional().nullable(),
  explanation: z.string().max(4000).optional(),
});

export async function GET(req: Request): Promise<Response> {
  try {
    const { client } = await requireUser(req);
    const { data, error } = await client
      .from("itineraries")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) return typedError(500, "itinerary_read", error.message);
    return Response.json({ itineraries: data ?? [] });
  } catch (err) {
    if ((err as { status?: number }).status === 401) return typedError(401, "unauthorized", "sign in first");
    return typedError(500, "internal", err instanceof Error ? err.message : String(err));
  }
}

export async function DELETE(req: Request): Promise<Response> {
  try {
    const { client, user } = await requireUser(req);
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return typedError(400, "bad_request", "id requerido");
    const { error } = await client.from("itineraries").delete().eq("id", id).eq("user_id", user.id);
    if (error) return typedError(400, "itinerary_delete", error.message);
    return Response.json({ ok: true });
  } catch (err) {
    if ((err as { status?: number }).status === 401) return typedError(401, "unauthorized", "sign in first");
    return typedError(500, "internal", err instanceof Error ? err.message : String(err));
  }
}

export async function POST(req: Request): Promise<Response> {
  try {
    const { user } = await requireUser(req);
    const parsed = postBody.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return typedError(400, "bad_request", parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
    const { ctx } = await engineForUser(req);
    const input = parsed.data;

    // engine computes (server-side, code-only math)
    const result = await bookNowCompare(ctx, {
      origin: input.origin,
      destination: input.destination,
      depart_date: input.depart_date,
      cabin: input.cabin,
      pax: input.pax,
      card: input.card ?? null,
      target_program: input.target_program ?? null,
    });

    const service = serviceClient();
    const row = {
      user_id: user.id,
      mode: input.mode,
      origin: input.origin,
      destination: input.destination,
      depart_date: input.depart_date,
      cabin: input.cabin,
      pax: input.pax,
      cash_amount: result.cash?.amount ?? null,
      cash_currency: result.cash?.currency ?? null,
      miles: (result.award?.miles ?? null) as number | null,
      taxes_amount: result.award?.taxes.amount ?? null,
      taxes_currency: result.award?.taxes.currency ?? null,
      verdict: result.verdict as string,
      savings_eur: result.savings_eur,
      savings_pct: result.savings_pct,
      range_low: null as number | null, // book-now is a live comparison; ranges belong to plan mode rows
      range_high: null as number | null,
      badges: result.badges as unknown as string[],
      breakdown: (result.breakdown ?? {}) as unknown as Json,
      explanation: input.explanation ?? result.insufficient_reason ?? null,
    };
    // a DB CHECK violation here is a bug in the engine — let it surface, never suppress
    const { data: inserted, error } = await service.from("itineraries").insert(row).select("id").single();
    if (error) return typedError(500, "itinerary_write", error.message);
    await writeAudit(service, {
      actor: user.id,
      action: "itinerary_saved",
      entity: "itineraries",
      details: { itinerary_id: inserted?.id, verdict: row.verdict, route: `${row.origin}-${row.destination}` },
    });
    return Response.json({ itinerary_id: inserted?.id, result }, { status: 201 });
  } catch (err) {
    if ((err as { status?: number }).status === 401) return typedError(401, "unauthorized", "sign in first");
    return typedError(500, "internal", err instanceof Error ? err.message : String(err));
  }
}

// keep the user client import referenced for routing-time tree-shaking clarity
void userClientFrom;
