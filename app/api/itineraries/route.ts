/**
 * /api/itineraries — F7 saved-trip records.
 * POST computes SERVER-side (bookNowCompare for book_now, runwayCompute for a
 * plan) and the row is written with the SERVICE role — a client can never
 * mint a verdict. GET lists own rows, or one row with ?id=; DELETE removes
 * one (RLS: own rows). A DB CHECK violation is a bug in the engine, never a
 * suppressed insert.
 */
import { z } from "zod";
import { requireUser, typedError, serviceClient } from "../../../lib/server/supabase";
import { engineForActor } from "../../../lib/server/factory";
import { bookNowCompare, runwayCompute } from "../../../lib/server/engine";
import { parseItineraryRequest } from "../../../lib/server/itinerary-request";
import { bookNowRow, planUrl, runwayRow } from "../../../lib/server/itinerary-row";
import { insertItinerary } from "../../../lib/server/itinerary-store";
import { InsufficientData } from "../../../lib/engine/verdict.mjs";

export const runtime = "nodejs";

const LIST_LIMIT = 100;
/** The list never ships the stored runway; only the plan's own verdict is lifted out of it. */
const LIST_COLUMNS =
  "id, mode, origin, destination, window_start, window_end, depart_date, cabin, pax, cash_amount, cash_currency, miles, verdict, savings_eur, savings_pct, badges, created_at, plan_verdict:breakdown->runway->recommended->>verdict";

function errorResponse(err: unknown): Response {
  if ((err as { status?: number }).status === 401) return typedError(401, "unauthorized", "sign in first");
  if (err instanceof InsufficientData) return typedError(400, "insufficient_data", err.detail);
  if ((err as { code?: string }).code === "provider_error") {
    const e = err as Error & { provider?: string };
    return typedError(502, "provider_error", e.message.slice(0, 400), { provider: e.provider ?? "duffel" });
  }
  console.error("itineraries route failed", { error: err });
  return typedError(500, "internal", err instanceof Error ? err.message : String(err));
}

export async function GET(req: Request): Promise<Response> {
  try {
    const { client } = await requireUser(req);
    const id = new URL(req.url).searchParams.get("id");
    if (id) {
      if (!z.string().uuid().safeParse(id).success) return typedError(400, "bad_request", "id must be a uuid");
      const { data, error } = await client.from("itineraries").select("*").eq("id", id).maybeSingle();
      if (error) return typedError(500, "itinerary_read", error.message);
      if (!data) return typedError(404, "itinerary_not_found", "no saved trip with that id");
      return Response.json({ itinerary: data });
    }
    const { data, error } = await client
      .from("itineraries")
      .select(LIST_COLUMNS)
      .order("created_at", { ascending: false })
      .limit(LIST_LIMIT);
    if (error) return typedError(500, "itinerary_read", error.message);
    return Response.json({ itineraries: data ?? [] });
  } catch (err) {
    return errorResponse(err);
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
    return errorResponse(err);
  }
}

export async function POST(req: Request): Promise<Response> {
  try {
    const { user, client } = await requireUser(req);
    const parsed = parseItineraryRequest(await req.json().catch(() => ({})));
    if (!parsed.ok) return typedError(400, "bad_request", parsed.message);
    const ctx = await engineForActor(user, client);
    const input = parsed.value;
    const service = serviceClient();

    if (input.mode === "plan") {
      const result = await runwayCompute(ctx, {
        origin: input.origin,
        destination: input.destination,
        window: input.window,
        cabin: input.cabin,
        pax: input.pax,
        card: input.card ?? null,
        plan: input.plan ?? null,
        cards: input.cards,
        spend: input.spend,
        pointsHeld: input.pointsHeld,
        monthlyTotal: input.monthlyTotal,
      });
      const row = runwayRow(user.id, {
        origin: input.origin,
        destination: input.destination,
        window: input.window,
        cabin: input.cabin,
        pax: input.pax,
        travel_date: input.travel_date ?? null,
        lead_days: input.lead_days ?? null,
        cards: input.cards ?? [],
        points_held: input.pointsHeld ?? 0,
        monthly_total: input.monthlyTotal ?? 0,
        spend: input.spend ?? {},
        plan: input.plan ?? null,
      }, result);
      const id = row ? await insertItinerary(service, row, "planner") : null;
      return Response.json({ itinerary_id: id, plan_url: id ? planUrl(id) : null, result }, { status: id ? 201 : 200 });
    }

    const result = await bookNowCompare(ctx, {
      origin: input.origin,
      destination: input.destination,
      depart_date: input.depart_date,
      cabin: input.cabin,
      pax: input.pax,
      card: input.card ?? null,
      target_program: input.target_program ?? null,
    });
    const id = await insertItinerary(service, bookNowRow(user.id, input, result), "api");
    return Response.json({ itinerary_id: id, plan_url: planUrl(id), result }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
