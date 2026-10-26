/**
 * lib/server/audit.ts — usage + audit_log writers (service role only).
 *
 * - `bumpUsage`: every provider call appends (user_id, day, provider, calls) —
 *   upsert `calls = calls + 1`, Europe/Madrid day (DB default does the TZ work,
 *   migration 20261026093100 §8). v1 records only; no enforcement (D22).
 * - `writeAudit`: engine runs that mutate data append to audit_log.
 * Neither function ever swallows an error: they are safety-net writers, so
 * failures are returned, not silenced.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "../database.types";

export interface UsageBump {
  user_id: string;
  provider: string;
  /** how many calls this single logical operation represents (dedupe collapses duplicates upstream) */
  calls?: number;
}

/** One upsert per distinct call; duplicate keys are collapsed by the caller (dedupe). */
export async function bumpUsage(
  client: SupabaseClient<Database>,
  { user_id, provider, calls = 1 }: UsageBump,
): Promise<{ ok: boolean; error: string | null }> {
  // read-modify-upsert (PostgREST upsert can't increment; the row is tiny and
  // per-day — worst case under a race it loses an increment, never overcounts).
  const day = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Europe/Madrid" }),
  ).toISOString().slice(0, 10);
  const { data: existing, error: readError } = await client
    .from("usage")
    .select("calls")
    .eq("user_id", user_id)
    .eq("day", day)
    .eq("provider", provider)
    .maybeSingle();
  if (readError) return { ok: false, error: readError.message };
  const nextCalls = (existing?.calls ?? 0) + calls;
  const { error: writeError } = await client
    .from("usage")
    .upsert({ user_id, day, provider, calls: nextCalls }, { onConflict: "user_id,day,provider" });
  return writeError ? { ok: false, error: writeError.message } : { ok: true, error: null };
}

export interface AuditEntry {
  actor: string | null;
  action: string;
  entity: string;
  details?: Record<string, unknown>;
}

export async function writeAudit(
  client: SupabaseClient<Database>,
  { actor, action, entity, details = {} }: AuditEntry,
): Promise<{ ok: boolean; error: string | null }> {
  const { error } = await client
    .from("audit_log")
    .insert({ actor, action, entity, details: details as Json });
  return error ? { ok: false, error: error.message } : { ok: true, error: null };
}
