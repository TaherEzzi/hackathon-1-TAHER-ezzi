/**
 * lib/server/itinerary-store.ts — the one service-role insert for saved trips,
 * with its audit row. A DB CHECK violation is an engine bug: it surfaces as a
 * typed error, never a suppressed insert.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../database.types";
import { writeAudit } from "./audit";
import type { ItineraryInsert } from "./itinerary-row";

export class ItineraryWriteError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "ItineraryWriteError";
  }
}

export async function insertItinerary(service: SupabaseClient<Database>, row: ItineraryInsert, source: "planner" | "chat" | "api"): Promise<string> {
  const { data, error } = await service.from("itineraries").insert(row).select("id").single();
  if (error || !data) {
    console.error("itinerary insert failed", { user: row.user_id, mode: row.mode, route: `${row.origin}-${row.destination}`, error: error?.message });
    throw new ItineraryWriteError(error?.message ?? "itinerary insert returned no row", { cause: error });
  }
  const audit = await writeAudit(service, {
    actor: row.user_id,
    action: "itinerary_saved",
    entity: "itineraries",
    details: { itinerary_id: data.id, mode: row.mode, verdict: row.verdict ?? null, route: `${row.origin}-${row.destination}`, source },
  });
  if (!audit.ok) console.error("itinerary audit write failed", { itinerary_id: data.id, error: audit.error });
  return data.id;
}
